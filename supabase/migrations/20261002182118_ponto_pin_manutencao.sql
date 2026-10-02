-- PRD 4.6: o quiosque trava o resto do admin (P34). Isso só é seguro com uma
-- saída: o PIN de manutenção. Sem ele, quem registrasse o próprio PC ficaria
-- sem painel naquele navegador.
--
-- O PIN fica em hash, igual ao PIN das pessoas, e só funciona no PC registrado
-- e dentro da rede da loja (P32).

create or replace function public.ponto_definir_pin_manutencao(
  p_empresa_id uuid,
  p_pin text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin define o PIN de manutenção.';
  end if;
  if p_pin !~ '^\d{4,8}$' then
    raise exception 'O PIN de manutenção precisa ter de 4 a 8 dígitos.';
  end if;

  insert into ponto_config (empresa_id, chave, valor, updated_at)
  values (p_empresa_id, 'pin_manutencao_hash',
          to_jsonb(extensions.crypt(p_pin, extensions.gen_salt('bf'))), now())
  on conflict (empresa_id, chave) do update
    set valor = excluded.valor, updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ponto_sair_do_quiosque(
  p_estacao_token text,
  p_pin text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_empresa uuid;
  v_hash text;
  v_erros int;
begin
  -- P32: o PIN não vale em aparelho que não é a estação registrada.
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Só dá para sair do modo quiosque dentro da loja.');
  end if;

  -- 5 erros em 15 min travam a tentativa, igual ao PIN das pessoas.
  select count(*) into v_erros from ponto_tentativas
  where ip = v_ip and motivo = 'pin_invalido' and funcionario_id is null
    and created_at > now() - interval '15 minutes';

  if v_erros >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'conta_bloqueada',
      'mensagem', 'Muitas tentativas. Espere 15 minutos.');
  end if;

  select valor #>> '{}' into v_hash
  from ponto_config where empresa_id = v_empresa and chave = 'pin_manutencao_hash';

  if v_hash is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Nenhum PIN de manutenção foi definido ainda. Defina em Ponto > Estações.');
  end if;

  if extensions.crypt(p_pin, v_hash) <> v_hash then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, null, 'pin_invalido',
      'pin de manutenção');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN de manutenção incorreto.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Diz ao painel se a empresa já tem PIN definido, sem expor o hash.
create or replace function public.ponto_tem_pin_manutencao(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ponto_config
    where empresa_id = p_empresa_id and chave = 'pin_manutencao_hash'
  )
$$;
