-- O quiosque deixa de pedir o nome: a pessoa digita só o PIN e o sistema
-- descobre quem é. Escolher o nome numa lista e depois digitar o PIN é um
-- passo a mais com fila esperando, e o nome na tela já entrega quem está
-- batendo pra quem estiver olhando.
--
-- Isso só é correto se dois PINs nunca forem iguais dentro da mesma empresa.
-- Duas defesas: a função abaixo recusa quando mais de uma pessoa bate com o
-- PIN digitado (em vez de escolher uma e registrar ponto no nome errado), e
-- ponto_pin_disponivel deixa o cadastro barrar a repetição na origem.

-- Resolve o PIN em uma pessoa. Fica fora do alcance do cliente: solta assim
-- ela viraria um oráculo pra descobrir PIN válido por tentativa.
create or replace function public.ponto_quem_tem_o_pin(
  p_empresa_id uuid,
  p_pin text
)
returns table (funcionario_id uuid, ambiguo boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_achados uuid[] := '{}';
  v_sm record;
begin
  if p_pin !~ '^\d{4,8}$' then
    return;
  end if;

  -- São poucas pessoas por loja; conferir uma a uma custa menos que manter
  -- uma segunda cópia do PIN em algum índice.
  for v_sm in
    select user_id from staff_members where empresa_id = p_empresa_id
  loop
    if public.ponto_pin_confere(v_sm.user_id, p_pin) then
      v_achados := v_achados || v_sm.user_id;
    end if;
  end loop;

  if array_length(v_achados, 1) is null then
    return;
  end if;

  return query select v_achados[1], array_length(v_achados, 1) > 1;
end;
$$;

revoke all on function public.ponto_quem_tem_o_pin(uuid, text) from public, anon, authenticated;

-- Usada pelo cadastro de funcionário pra não deixar nascer PIN repetido.
create or replace function public.ponto_pin_disponivel(
  p_empresa_id uuid,
  p_pin text,
  p_user_id uuid default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_dono uuid; v_amb boolean;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Sem acesso.';
  end if;
  if p_empresa_id is null then
    return true;
  end if;

  select funcionario_id, ambiguo into v_dono, v_amb
  from public.ponto_quem_tem_o_pin(p_empresa_id, p_pin);

  if v_dono is null then
    return true;
  end if;
  -- Trocar o PIN de alguém para o PIN que já é dele não é conflito.
  return (v_dono = p_user_id and not v_amb);
end;
$$;

-- Bater ponto só com o PIN.
create or replace function public.ponto_registrar_por_pin(
  p_pin text,
  p_estacao_token text default null,
  p_qr_token text default null,
  p_device_id text default null,
  p_tipo public.ponto_marcacao_tipo default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_res jsonb;
  v_nome text;
begin
  if p_estacao_token is not null then
    select l.empresa_id into v_empresa
    from ponto_estacoes e join ponto_locais l on l.id = e.local_id
    where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
      and e.revogada_em is null and l.ativo;
  elsif p_qr_token is not null then
    select empresa_id into v_empresa from ponto_locais
    where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
      and tipo = 'qr' and ativo;
  end if;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este ponto não está registrado. Fale com o gestor.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, p_tipo, 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  -- Nunca registrar ponto no nome errado: na dúvida, não bate.
  if v_amb then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, p_tipo, 'pin_invalido',
      'PIN repetido entre duas pessoas');
    return jsonb_build_object('ok', false, 'motivo', 'pin_repetido',
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  v_res := public.ponto_registrar(v_func, p_pin, p_tipo, p_estacao_token, p_qr_token, p_device_id);

  -- O nome só volta depois da batida dar certo, pro comprovante.
  select display_name into v_nome from staff_members where user_id = v_func;
  return v_res || jsonb_build_object('nome', v_nome);
end;
$$;

-- Abrir a loja só com o PIN de quem tem a permissão.
create or replace function public.ponto_abrir_loja_por_pin(
  p_pin text,
  p_estacao_token text,
  p_motivo text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, null, 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  if not public.ponto_tem_permissao(v_func, 'abertura_coletiva') then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, null, 'sem_permissao');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Este PIN não abre a loja.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;

  return public.ponto_abrir_loja(v_func, p_pin, p_estacao_token, null, p_motivo)
         || jsonb_build_object('responsavel_id', v_func, 'nome', v_nome);
end;
$$;

create or replace function public.ponto_marcar_presentes_por_pin(
  p_pin text,
  p_estacao_token text,
  p_funcionarios uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  return public.ponto_marcar_presentes(v_func, p_pin, p_funcionarios);
end;
$$;

create or replace function public.ponto_reportar_faltante_por_pin(
  p_pin text,
  p_estacao_token text,
  p_product_id uuid,
  p_stock_remaining int default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  return public.ponto_reportar_faltante(v_func, p_pin, p_estacao_token, p_product_id, p_stock_remaining);
end;
$$;
