-- Etapa 4 (MVP+) — pontos QR e aprovação de celular (PRD 4.2 e 4.3).
--
-- O QR impresso não é segredo: pode ser fotografado. Por isso a batida pelo QR
-- exige, além do token, a rede da loja e o celular aprovado daquela pessoa —
-- é o conjunto que impede um colega de bater pelo outro.

create or replace function public.ponto_criar_local_qr(
  p_empresa_id uuid,
  p_nome text,
  p_marcacoes public.ponto_marcacao_tipo[] default array['saida_pausa','retorno_pausa']::public.ponto_marcacao_tipo[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
  v_id uuid;
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin cria ponto de QR.';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into ponto_locais (empresa_id, nome, tipo, marcacoes_permitidas, qr_token_hash)
  values (p_empresa_id, p_nome, 'qr', p_marcacoes,
          encode(digest(v_token, 'sha256'), 'hex'))
  returning id into v_id;

  -- O token em claro só aparece aqui: dá pra imprimir agora ou rotacionar e
  -- imprimir de novo, nunca "consultar depois".
  return jsonb_build_object('ok', true, 'local_id', v_id, 'token', v_token);
end;
$$;

-- P8: rotacionar invalida o QR antigo na hora.
create or replace function public.ponto_rotacionar_qr(p_local_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin rotaciona o QR.';
  end if;

  if not exists (select 1 from ponto_locais where id = p_local_id and tipo = 'qr') then
    raise exception 'Este local não é um ponto de QR.';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  update ponto_locais
  set qr_token_hash = encode(digest(v_token, 'sha256'), 'hex')
  where id = p_local_id;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

-- A tela do QR não tem sessão: identifica-se pelo token e devolve o que
-- aquele local aceita e quem pode bater ali.
create or replace function public.ponto_qr_contexto(p_qr_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_local record;
  v_ip inet := public.ponto_ip_origem();
  v_funcs jsonb;
begin
  select l.id, l.nome, l.empresa_id, l.marcacoes_permitidas
  into v_local
  from ponto_locais l
  where l.qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
    and l.tipo = 'qr' and l.ativo;

  if v_local is null then
    return jsonb_build_object('ok', false, 'motivo', 'token_qr_invalido',
      'mensagem', 'Este QR não vale mais. Peça o novo pro gestor.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', sm.user_id, 'nome', sm.display_name)
                            order by sm.display_name), '[]'::jsonb)
  into v_funcs
  from staff_members sm
  where sm.empresa_id = v_local.empresa_id;

  return jsonb_build_object(
    'ok', true,
    'local_id', v_local.id,
    'local', v_local.nome,
    'empresa_id', v_local.empresa_id,
    'marcacoes', to_jsonb(v_local.marcacoes_permitidas),
    'rede_ok', exists (select 1 from ponto_redes
                       where empresa_id = v_local.empresa_id and ativo and ip = v_ip),
    'funcionarios', v_funcs
  );
end;
$$;

-- P5: celular novo entra pendente. A pessoa confirma com o próprio PIN que o
-- aparelho é dela; quem libera é o gestor.
create or replace function public.ponto_registrar_dispositivo(
  p_funcionario_id uuid,
  p_pin text,
  p_device_id text,
  p_apelido text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_hash text;
  v_status public.ponto_dispositivo_status;
begin
  select empresa_id into v_empresa from staff_members where user_id = p_funcionario_id;
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu cadastro ainda não está completo. Fale com o gestor.');
  end if;

  if not public.ponto_pin_confere(p_funcionario_id, p_pin) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, null, 'pin_invalido');
    perform public.equipe_registrar_tentativa_login(p_funcionario_id, false);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN incorreto.');
  end if;
  perform public.equipe_registrar_tentativa_login(p_funcionario_id, true);

  v_hash := encode(digest(coalesce(p_device_id, ''), 'sha256'), 'hex');

  insert into ponto_dispositivos (funcionario_id, device_id_hash, apelido)
  values (p_funcionario_id, v_hash, p_apelido)
  on conflict (funcionario_id, device_id_hash) do update
    set apelido = coalesce(excluded.apelido, ponto_dispositivos.apelido)
  returning status into v_status;

  return jsonb_build_object('ok', true, 'status', v_status,
    'mensagem', case v_status
      when 'aprovado' then 'Celular já liberado. Pode bater pelo QR.'
      when 'revogado' then 'Este celular foi bloqueado. Fale com o gestor.'
      else 'Celular registrado. Aguarde o gestor liberar para bater pelo QR.'
    end);
end;
$$;

-- Status do aparelho, pra tela saber o que mostrar antes de tentar bater.
create or replace function public.ponto_status_dispositivo(
  p_funcionario_id uuid,
  p_device_id text
)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_status public.ponto_dispositivo_status;
  v_outro boolean;
begin
  select status into v_status from ponto_dispositivos
  where funcionario_id = p_funcionario_id
    and device_id_hash = encode(digest(coalesce(p_device_id, ''), 'sha256'), 'hex');

  -- P6: a pessoa tem outro aparelho liberado — este aqui é emprestado.
  select exists (
    select 1 from ponto_dispositivos
    where funcionario_id = p_funcionario_id and status = 'aprovado'
      and device_id_hash <> encode(digest(coalesce(p_device_id, ''), 'sha256'), 'hex')
  ) into v_outro;

  return jsonb_build_object('status', coalesce(v_status::text, 'novo'),
                            'tem_outro_aprovado', v_outro);
end;
$$;

create or replace function public.ponto_decidir_dispositivo(
  p_dispositivo_id uuid,
  p_aprovar boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_func uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin libera celular.';
  end if;

  select funcionario_id into v_func from ponto_dispositivos where id = p_dispositivo_id;
  if v_func is null then
    raise exception 'Celular não encontrado.';
  end if;

  if p_aprovar then
    -- 1 celular aprovado por pessoa (PRD 4.3): trocar de aparelho revoga o
    -- anterior, senão os dois ficariam valendo.
    update ponto_dispositivos set status = 'revogado'
    where funcionario_id = v_func and status = 'aprovado' and id <> p_dispositivo_id;

    update ponto_dispositivos
    set status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = now()
    where id = p_dispositivo_id;
  else
    update ponto_dispositivos set status = 'revogado' where id = p_dispositivo_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
