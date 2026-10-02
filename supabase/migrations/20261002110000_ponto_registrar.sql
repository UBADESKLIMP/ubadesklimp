-- Núcleo do ponto: uma única porta de entrada pra toda batida (PRD seção 9).

-- IP de origem. Usa SEMPRE cf-connecting-ip, nunca x-forwarded-for.
--
-- Testado contra a API real: forjar cf-connecting-ip faz o Cloudflare recusar
-- a requisição com 403, antes de chegar aqui. Já o x-forwarded-for aceita
-- valor do cliente e o coloca NA FRENTE do IP real
-- ("10.0.0.1,168.121.98.95"), então quem lê o primeiro elemento valida um IP
-- escolhido pelo funcionário — exatamente a fraude que o módulo existe pra
-- impedir.
create or replace function public.ponto_ip_origem()
returns inet language plpgsql stable set search_path = public as $$
declare
  v_bruto text;
begin
  v_bruto := current_setting('request.headers', true)::json ->> 'cf-connecting-ip';
  if v_bruto is null or trim(v_bruto) = '' then
    return null;
  end if;
  return trim(v_bruto)::inet;
exception when others then
  return null;
end;
$$;

create or replace function public.ponto_user_agent()
returns text language sql stable set search_path = public as $$
  select left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300)
$$;

create or replace function public.ponto_config_int(p_empresa_id uuid, p_chave text, p_padrao int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select valor::text::int from ponto_config
                   where empresa_id = p_empresa_id and chave = p_chave), p_padrao)
$$;

-- Confere o PIN contra o hash do Supabase Auth, sem nunca expor o hash.
-- O sufixo existe porque o Auth exige 6 caracteres e o PIN tem 4; contas
-- criadas antes dessa mudança têm senha alfanumérica e são testadas direto.
create or replace function public.ponto_pin_confere(p_funcionario_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  select encrypted_password into v_hash from auth.users where id = p_funcionario_id;
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_pin || '-pin', v_hash) or v_hash = crypt(p_pin, v_hash);
end;
$$;

create or replace function public.ponto_registrar_tentativa(
  p_empresa_id uuid, p_funcionario_id uuid, p_local_id uuid,
  p_tipo public.ponto_marcacao_tipo, p_motivo public.ponto_motivo_recusa, p_detalhe text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into ponto_tentativas (empresa_id, funcionario_id, local_id, tipo, motivo, detalhe, ip, user_agent)
  values (p_empresa_id, p_funcionario_id, p_local_id, p_tipo, p_motivo, p_detalhe,
          public.ponto_ip_origem(), public.ponto_user_agent());
end;
$$;

-- Qual marcação faz sentido agora, pelo estado do dia (PRD R3).
create or replace function public.ponto_proxima_marcacao(p_funcionario_id uuid)
returns public.ponto_marcacao_tipo
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
begin
  select
    bool_or(tipo = 'entrada') as entrada,
    bool_or(tipo = 'saida_almoco') as saida_almoco,
    bool_or(tipo = 'retorno_almoco') as retorno_almoco,
    bool_or(tipo = 'saida') as saida
  into v_tem
  from ponto_marcacoes
  where funcionario_id = p_funcionario_id
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  if v_tem is null or not coalesce(v_tem.entrada, false) then return 'entrada'; end if;
  if not coalesce(v_tem.saida_almoco, false) then return 'saida_almoco'; end if;
  if not coalesce(v_tem.retorno_almoco, false) then return 'retorno_almoco'; end if;
  if not coalesce(v_tem.saida, false) then return 'saida'; end if;
  return 'hora_extra_inicio';
end;
$$;

-- Sequência possível? (PRD R3 / P9)
create or replace function public.ponto_sequencia_valida(
  p_funcionario_id uuid, p_tipo public.ponto_marcacao_tipo
)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
begin
  select
    bool_or(tipo = 'entrada') as entrada,
    bool_or(tipo = 'saida_almoco') as saida_almoco,
    bool_or(tipo = 'retorno_almoco') as retorno_almoco,
    bool_or(tipo = 'saida') as saida,
    count(*) filter (where tipo = 'saida_pausa') as saidas_pausa,
    count(*) filter (where tipo = 'retorno_pausa') as retornos_pausa,
    bool_or(tipo = 'hora_extra_inicio') as he_inicio,
    bool_or(tipo = 'hora_extra_saida') as he_saida
  into v_tem
  from ponto_marcacoes
  where funcionario_id = p_funcionario_id
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  return case p_tipo
    -- uma entrada por dia
    when 'entrada' then not coalesce(v_tem.entrada, false)
    -- almoço exige ter entrado e não ter saído pro almoço ainda
    when 'saida_almoco' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida_almoco, false)
    -- retorno exige a saída correspondente (P9)
    when 'retorno_almoco' then coalesce(v_tem.saida_almoco, false) and not coalesce(v_tem.retorno_almoco, false)
    when 'saida' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida, false)
    when 'hora_extra_inicio' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.he_inicio, false)
    when 'hora_extra_saida' then coalesce(v_tem.he_inicio, false) and not coalesce(v_tem.he_saida, false)
    -- pausa: sempre pareada
    when 'saida_pausa' then coalesce(v_tem.entrada, false)
      and coalesce(v_tem.saidas_pausa, 0) = coalesce(v_tem.retornos_pausa, 0)
    when 'retorno_pausa' then coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0)
  end;
end;
$$;

-- Hash encadeado (PRD R5): cada marcação carrega o hash da anterior da mesma
-- empresa, então mexer num registro antigo quebra a cadeia inteira daí pra
-- frente e a verificação acusa.
create or replace function public.ponto_calcular_hash(
  p_empresa_id uuid, p_funcionario_id uuid, p_tipo text,
  p_registrado_em timestamptz, p_hash_anterior text
)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(
    coalesce(p_empresa_id::text,'') || '|' || coalesce(p_funcionario_id::text,'') || '|' ||
    coalesce(p_tipo,'') || '|' || coalesce(p_registrado_em::text,'') || '|' ||
    coalesce(p_hash_anterior,''), 'sha256'), 'hex')
$$;

-- -------------------------------------------------------- ponto_registrar

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
  v_estacao record;
  v_local record;
  v_dispositivo record;
  v_tipo public.ponto_marcacao_tipo;
  v_ultima record;
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

  -- 0) IP é obrigatório: sem ele não dá pra provar que a batida veio da loja
  if v_ip is null then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'sem_ip');
    return jsonb_build_object('ok', false, 'motivo', 'sem_ip',
      'mensagem', 'Não conseguimos identificar sua conexão. Tente de novo.');
  end if;

  -- 1) rate limit, antes de qualquer coisa cara
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

  -- 2) conta bloqueada
  if v_bloqueado is not null then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'conta_bloqueada');
    return jsonb_build_object('ok', false, 'motivo', 'conta_bloqueada',
      'mensagem', 'Sua conta está bloqueada. Peça pro gestor liberar.');
  end if;

  -- 3) PIN
  if not public.ponto_pin_confere(p_funcionario_id, p_pin) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'pin_invalido');
    perform public.equipe_registrar_tentativa_login(p_funcionario_id, false);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN incorreto.');
  end if;
  perform public.equipe_registrar_tentativa_login(p_funcionario_id, true);

  -- 4) IP na lista de redes da loja
  if not exists (
    select 1 from ponto_redes
    where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo,
      'fora_da_rede', host(v_ip));
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja para bater o ponto.');
  end if;

  -- 5) ponto físico: estação registrada OU (QR válido + celular aprovado)
  if p_estacao_token is not null then
    select e.*, l.id as l_id, l.marcacoes_permitidas, l.empresa_id as l_empresa
    into v_estacao
    from ponto_estacoes e join ponto_locais l on l.id = e.local_id
    where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
      and e.revogada_em is null and l.ativo;

    if v_estacao is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'estacao_invalida');
      return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
        'mensagem', 'Este computador não está registrado como estação.');
    end if;

    select * into v_local from ponto_locais where id = v_estacao.l_id;

  elsif p_qr_token is not null then
    select * into v_local from ponto_locais
    where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
      and tipo = 'qr' and ativo and empresa_id = v_empresa;

    if v_local is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'token_qr_invalido');
      return jsonb_build_object('ok', false, 'motivo', 'token_qr_invalido',
        'mensagem', 'Este QR não vale mais. Peça o novo pro gestor.');
    end if;

    -- QR exige celular aprovado: é o que impede o colega bater pelo outro
    select * into v_dispositivo from ponto_dispositivos
    where funcionario_id = p_funcionario_id
      and device_id_hash = encode(digest(coalesce(p_device_id,''), 'sha256'), 'hex')
      and status = 'aprovado';

    if v_dispositivo is null then
      perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local.id, p_tipo,
        'dispositivo_nao_aprovado');
      return jsonb_build_object('ok', false, 'motivo', 'dispositivo_nao_aprovado',
        'mensagem', 'Seu celular ainda não foi liberado. Fale com o gestor.');
    end if;

  else
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, p_tipo, 'estacao_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Bata o ponto na estação da loja ou pelo QR.');
  end if;

  -- 6) tipo: usa o sugerido se não vier escolhido
  v_tipo := coalesce(p_tipo, public.ponto_proxima_marcacao(p_funcionario_id));

  if not (v_tipo = any (v_local.marcacoes_permitidas)) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local.id, v_tipo, 'local_nao_permite');
    return jsonb_build_object('ok', false, 'motivo', 'local_nao_permite',
      'mensagem', 'Este ponto não aceita esse tipo de marcação.');
  end if;

  -- 7) toque duplo: repetida do mesmo tipo dentro da janela é ignorada (P10)
  v_janela := public.ponto_config_int(v_empresa, 'ignorar_repetida_min', 2);
  select * into v_ultima from ponto_marcacoes
  where funcionario_id = p_funcionario_id and tipo = v_tipo
    and registrado_em > now() - make_interval(mins => v_janela)
  order by registrado_em desc limit 1;

  if v_ultima.id is not null then
    return jsonb_build_object('ok', true, 'ignorada', true, 'marcacao_id', v_ultima.id,
      'tipo', v_tipo, 'registrado_em', v_ultima.registrado_em,
      'mensagem', 'Você já bateu agora há pouco. Não registramos de novo.');
  end if;

  -- 8) sequência
  if not public.ponto_sequencia_valida(p_funcionario_id, v_tipo) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, v_local.id, v_tipo, 'sequencia_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'sequencia_invalida',
      'mensagem', 'Essa marcação não encaixa no seu dia. Confira o que já bateu.');
  end if;

  -- 9) grava, encadeando o hash
  select hash into v_hash_anterior from ponto_marcacoes
  where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

  v_hash := public.ponto_calcular_hash(v_empresa, p_funcionario_id, v_tipo::text, now(), v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, local_id, estacao_id, dispositivo_id,
    ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, p_funcionario_id, v_tipo, v_local.id, v_estacao.id, v_dispositivo.id,
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

-- Heartbeat da estação: o IP público dela vira o IP permitido da loja (PRD 4.1).
-- Resolve o IP dinâmico da internet comercial sem ninguém precisar configurar.
create or replace function public.ponto_heartbeat(p_estacao_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_estacao record;
  v_empresa uuid;
begin
  select e.*, l.empresa_id into v_estacao
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null;

  if v_estacao is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida');
  end if;
  if v_ip is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_ip');
  end if;

  v_empresa := v_estacao.empresa_id;

  update ponto_estacoes
  set ultimo_heartbeat = now(), ultimo_ip = v_ip
  where id = v_estacao.id;

  insert into ponto_redes (empresa_id, ip, origem, visto_em, ativo)
  values (v_empresa, v_ip, 'heartbeat', now(), true)
  on conflict (empresa_id, ip) do update
    set visto_em = now(), ativo = true, origem = excluded.origem;

  return jsonb_build_object('ok', true, 'ip', host(v_ip), 'empresa_id', v_empresa);
end;
$$;

-- Verificação da cadeia de hashes (PRD R5 / P12).
create or replace function public.ponto_verificar_integridade(p_empresa_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_esperado text;
  v_anterior text := null;
  v_total int := 0;
  v_quebras jsonb := '[]'::jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin verifica a integridade do ponto.';
  end if;

  for r in
    select * from ponto_marcacoes
    where empresa_id = p_empresa_id
    order by registrado_em, created_at
  loop
    v_total := v_total + 1;
    v_esperado := public.ponto_calcular_hash(
      r.empresa_id, r.funcionario_id, r.tipo::text, r.registrado_em, v_anterior);

    if r.hash is distinct from v_esperado or r.hash_anterior is distinct from v_anterior then
      v_quebras := v_quebras || jsonb_build_object(
        'marcacao_id', r.id,
        'registrado_em', r.registrado_em,
        'hash_guardado', r.hash,
        'hash_esperado', v_esperado
      );
    end if;
    v_anterior := r.hash;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_quebras) = 0,
    'marcacoes_verificadas', v_total,
    'quebras', v_quebras
  );
end;
$$;
