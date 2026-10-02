-- Corrige: v_estacao/v_dispositivo são records e só um dos dois é preenchido
-- (estação OU QR). Ler .id do que ficou sem atribuição estoura
-- "record is not assigned yet". Guarda os ids em uuid simples, que aceitam null.
create or replace function public.ponto_registrar(
  p_funcionario_id uuid,
  p_pin text,
  p_tipo public.ponto_marcacao_tipo default null,
  p_estacao_token text default null,
  p_qr_token text default null,
  p_device_id text default null
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_ua text := public.ponto_user_agent();
  v_empresa uuid;
  v_bloqueado timestamptz;
  v_local record;
  v_estacao_id uuid;
  v_dispositivo_id uuid;
  v_local_id uuid;
  v_tipo public.ponto_marcacao_tipo;
  v_ultima_id uuid;
  v_ultima_em timestamptz;
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
  v_janela int;
  v_limite_func int;
  v_limite_ip int;
begin
  select empresa_id, bloqueado_em into v_empresa, v_bloqueado
  from staff_members where user_id = p_funcionario_id;

  if v_empresa is null then
    perform public.ponto_registrar_tentativa(null, p_funcionario_id, null, p_tipo,
      'sem_permissao', 'funcionário sem empresa vinculada');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu cadastro ainda não está completo. Fale com o gestor.');
  end if;

  if v_ip is null then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'sem_ip');
    return jsonb_build_object('ok', false, 'motivo', 'sem_ip',
      'mensagem', 'Não conseguimos identificar sua conexão. Tente de novo.');
  end if;

  v_limite_func := public.ponto_config_int(v_empresa, 'rate_limit_por_funcionario_min', 10);
  v_limite_ip := public.ponto_config_int(v_empresa, 'rate_limit_por_ip_min', 30);

  if (select count(*) from ponto_tentativas
      where funcionario_id = p_funcionario_id and created_at > now() - interval '1 minute')
     >= v_limite_func
     or (select count(*) from ponto_tentativas
         where ip = v_ip and created_at > now() - interval '1 minute') >= v_limite_ip then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'rate_limit');
    return jsonb_build_object('ok', false, 'motivo', 'rate_limit',
      'mensagem', 'Muitas tentativas seguidas. Espere um minuto e tente de novo.');
  end if;

  if v_bloqueado is not null then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'conta_bloqueada');
    return jsonb_build_object('ok', false, 'motivo', 'conta_bloqueada',
      'mensagem', 'Sua conta está bloqueada. Peça pro gestor liberar.');
  end if;

  if not public.ponto_pin_confere(p_funcionario_id, p_pin) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'pin_invalido');
    perform public.equipe_registrar_tentativa_login(p_funcionario_id, false);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN incorreto.');
  end if;
  perform public.equipe_registrar_tentativa_login(p_funcionario_id, true);

  if not exists (
    select 1 from ponto_redes
    where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo,
      'fora_da_rede', host(v_ip));
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja para bater o ponto.');
  end if;

  if p_estacao_token is not null then
    select e.id, e.local_id into v_estacao_id, v_local_id
    from ponto_estacoes e join ponto_locais l on l.id = e.local_id
    where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
      and e.revogada_em is null and l.ativo;

    if v_estacao_id is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'estacao_invalida');
      return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
        'mensagem', 'Este computador não está registrado como estação.');
    end if;

  elsif p_qr_token is not null then
    select id into v_local_id from ponto_locais
    where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
      and tipo = 'qr' and ativo and empresa_id = v_empresa;

    if v_local_id is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'token_qr_invalido');
      return jsonb_build_object('ok', false, 'motivo', 'token_qr_invalido',
        'mensagem', 'Este QR não vale mais. Peça o novo pro gestor.');
    end if;

    select id into v_dispositivo_id from ponto_dispositivos
    where funcionario_id = p_funcionario_id
      and device_id_hash = encode(digest(coalesce(p_device_id,''), 'sha256'), 'hex')
      and status = 'aprovado';

    if v_dispositivo_id is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local_id, p_tipo,
        'dispositivo_nao_aprovado');
      return jsonb_build_object('ok', false, 'motivo', 'dispositivo_nao_aprovado',
        'mensagem', 'Seu celular ainda não foi liberado. Fale com o gestor.');
    end if;

  else
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'estacao_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Bata o ponto na estação da loja ou pelo QR.');
  end if;

  select * into v_local from ponto_locais where id = v_local_id;

  v_tipo := coalesce(p_tipo, public.ponto_proxima_marcacao(p_funcionario_id));

  if not (v_tipo = any (v_local.marcacoes_permitidas)) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local_id, v_tipo, 'local_nao_permite');
    return jsonb_build_object('ok', false, 'motivo', 'local_nao_permite',
      'mensagem', 'Este ponto não aceita esse tipo de marcação.');
  end if;

  v_janela := public.ponto_config_int(v_empresa, 'ignorar_repetida_min', 2);
  select id, registrado_em into v_ultima_id, v_ultima_em from ponto_marcacoes
  where funcionario_id = p_funcionario_id and tipo = v_tipo
    and registrado_em > now() - make_interval(mins => v_janela)
  order by registrado_em desc limit 1;

  if v_ultima_id is not null then
    return jsonb_build_object('ok', true, 'ignorada', true, 'marcacao_id', v_ultima_id,
      'tipo', v_tipo, 'registrado_em', v_ultima_em,
      'mensagem', 'Você já bateu agora há pouco. Não registramos de novo.');
  end if;

  if not public.ponto_sequencia_valida(p_funcionario_id, v_tipo) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local_id, v_tipo, 'sequencia_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'sequencia_invalida',
      'mensagem', 'Essa marcação não encaixa no seu dia. Confira o que já bateu.');
  end if;

  select hash into v_hash_anterior from ponto_marcacoes
  where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

  v_hash := public.ponto_calcular_hash(v_empresa, p_funcionario_id, v_tipo::text, now(), v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, local_id, estacao_id, dispositivo_id,
    ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, p_funcionario_id, v_tipo, v_local_id, v_estacao_id, v_dispositivo_id,
    v_ip, v_ua, v_hash, v_hash_anterior
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'marcacao_id', v_id, 'tipo', v_tipo,
    'registrado_em', (select registrado_em from ponto_marcacoes where id = v_id),
    'local', v_local.nome,
    'codigo', upper(left(v_hash, 8)),
    'proxima_sugerida', public.ponto_proxima_marcacao(p_funcionario_id)
  );
end;
$$;
