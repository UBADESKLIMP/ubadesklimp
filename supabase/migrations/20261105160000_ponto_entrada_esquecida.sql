-- Entrada esquecida: o funcionário esquece de bater de manhã e, ao sair para o
-- almoço, a primeira batida do dia virava "Entrada às 12:00" (o tipo vem só da
-- ordem das batidas).
--
-- 1) Na batida pelo quiosque, se é a primeira do dia e já passaram 2 horas do
--    horário de entrada da escala, o quiosque pergunta antes de gravar.
-- 2) Se a pessoa diz "estou saindo para o almoço", grava a saída do almoço no
--    horário real E abre o pedido de ajuste da entrada, com a hora em que ela
--    chegou. O gestor aprova como qualquer outro pedido.

-- Existe um pedido de entrada esquecida para o dia (ainda não decidido ou aprovado)?
create or replace function public.ponto_entrada_pedida_hoje(p_funcionario_id uuid, p_data date)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from equipe_justificativas_ponto j
    join equipe_justificativa_marcacoes jm on jm.justificativa_id = j.id
    where j.colaborador_id = p_funcionario_id
      and j.data = p_data
      and j.tipo = 'esquecimento'
      and jm.marcacao = 'entrada'
      and j.status in ('pendente', 'aprovada', 'aguardando_ciencia', 'concluida')
  )
$$;

-- A entrada pedida conta como entrada para decidir a próxima batida.
create or replace function public.ponto_proxima_marcacao(p_funcionario_id uuid)
returns ponto_marcacao_tipo
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
  v_pedida boolean := public.ponto_entrada_pedida_hoje(p_funcionario_id, (now() at time zone 'America/Sao_Paulo')::date);
begin
  select
    bool_or(tipo = 'entrada') as entrada,
    bool_or(tipo = 'saida_almoco') as saida_almoco,
    bool_or(tipo = 'retorno_almoco') as retorno_almoco,
    bool_or(tipo = 'saida') as saida,
    count(*) filter (where tipo = 'saida_pausa') as saidas_pausa,
    count(*) filter (where tipo = 'retorno_pausa') as retornos_pausa
  into v_tem
  from ponto_marcacoes
  where funcionario_id = p_funcionario_id
    and substituida_por is null
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  if coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0) then
    return 'retorno_pausa';
  end if;

  if v_tem is null or not (coalesce(v_tem.entrada, false) or v_pedida) then return 'entrada'; end if;
  if not coalesce(v_tem.saida_almoco, false) then return 'saida_almoco'; end if;
  if not coalesce(v_tem.retorno_almoco, false) then return 'retorno_almoco'; end if;
  if not coalesce(v_tem.saida, false) then return 'saida'; end if;
  return 'hora_extra_inicio';
end;
$function$;

create or replace function public.ponto_sequencia_valida(p_funcionario_id uuid, p_tipo ponto_marcacao_tipo)
returns boolean
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
  v_cafe record;
  v_pedida boolean := public.ponto_entrada_pedida_hoje(p_funcionario_id, (now() at time zone 'America/Sao_Paulo')::date);
  v_chegou boolean;
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
    and substituida_por is null
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  select * into v_cafe from public.ponto_cafe_por_dia(p_funcionario_id, v_hoje);

  -- Chegou: bateu a entrada ou tem o pedido de entrada esquecida.
  v_chegou := coalesce(v_tem.entrada, false) or v_pedida;

  return case p_tipo
    when 'entrada' then not coalesce(v_tem.entrada, false)
    when 'saida_almoco' then v_chegou and not coalesce(v_tem.saida_almoco, false)
    when 'retorno_almoco' then coalesce(v_tem.saida_almoco, false) and not coalesce(v_tem.retorno_almoco, false)
    when 'saida' then v_chegou and not coalesce(v_tem.saida, false)
    when 'hora_extra_inicio' then v_chegou and not coalesce(v_tem.he_inicio, false)
    when 'hora_extra_saida' then coalesce(v_tem.he_inicio, false) and not coalesce(v_tem.he_saida, false)
    when 'saida_pausa' then v_chegou
      and coalesce(v_cafe.quantidade, 0) > 0
      and coalesce(v_tem.saidas_pausa, 0) = coalesce(v_tem.retornos_pausa, 0)
      and coalesce(v_tem.saidas_pausa, 0) < v_cafe.quantidade
    when 'retorno_pausa' then coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0)
  end;
end;
$function$;

-- A batida pelo quiosque: antes de gravar a primeira do dia fora de hora, pergunta.
create or replace function public.ponto_registrar_por_pin(
  p_pin text,
  p_estacao_token text default null,
  p_qr_token text default null,
  p_device_id text default null,
  p_tipo ponto_marcacao_tipo default null
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_res jsonb;
  v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_escala public.equipe_escalas;
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

  select display_name into v_nome from staff_members where user_id = v_func;

  -- Primeira batida do dia, mas já passou da hora de chegar: pode ser a saída do
  -- almoço de quem esqueceu a entrada. Pergunta antes de gravar. Quem escolhe
  -- o tipo (p_tipo) já respondeu e não é perguntado de novo.
  if p_tipo is null and p_estacao_token is not null
     and public.ponto_proxima_marcacao(v_func) = 'entrada' then
    v_escala := public.equipe_escala_do_dia(v_func, v_hoje);
    if v_escala.id is not null and v_escala.entrada is not null
       and extract(isodow from v_hoje)::int = any (v_escala.dias_semana)
       and (now() at time zone 'America/Sao_Paulo')::time
           >= v_escala.entrada + make_interval(hours => public.equipe_config_int(v_empresa, 'pergunta_entrada_horas', 2))
    then
      return jsonb_build_object(
        'ok', false, 'motivo', 'confirmar_entrada', 'nome', v_nome,
        'escala_entrada', to_char(v_escala.entrada, 'HH24:MI'),
        'agora', to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI'),
        'mensagem', 'Você ainda não bateu a entrada hoje.');
    end if;
  end if;

  v_res := public.ponto_registrar(v_func, p_pin, p_tipo, p_estacao_token, p_qr_token, p_device_id);

  -- O nome só volta depois da batida dar certo, pro comprovante.
  return v_res || jsonb_build_object('nome', v_nome);
end;
$function$;

-- "Estou saindo para o almoço, esqueci a entrada": grava a saída do almoço agora
-- e abre o pedido da entrada com a hora em que a pessoa chegou. Tudo ou nada:
-- se a batida falhar, o pedido também não fica.
create or replace function public.ponto_saida_almoco_sem_entrada(
  p_pin text,
  p_estacao_token text,
  p_hora_chegada text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_agora time := (now() at time zone 'America/Sao_Paulo')::time;
  v_chegada time;
  v_id uuid;
  v_res jsonb;
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
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN não encontrado.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;

  if p_hora_chegada is null or p_hora_chegada !~ '^\d{1,2}:\d{2}$' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga a que horas você chegou (por exemplo 08:00).');
  end if;
  v_chegada := p_hora_chegada::time;
  if v_chegada > v_agora then
    return jsonb_build_object('ok', false, 'mensagem', 'A hora em que você chegou não pode ser depois de agora.');
  end if;

  if exists (
    select 1 from ponto_marcacoes
    where funcionario_id = v_func and tipo = 'entrada' and substituida_por is null
      and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
  ) then
    return jsonb_build_object('ok', false, 'mensagem', 'Você já tem a entrada registrada hoje.');
  end if;

  begin
    if not public.ponto_entrada_pedida_hoje(v_func, v_hoje) then
      insert into equipe_justificativas_ponto (
        colaborador_id, empresa_id, data, tipo, motivo, criado_por, status, origem
      ) values (
        v_func, v_empresa, v_hoje, 'esquecimento',
        format('Pelo quiosque: esqueci de bater a entrada de %s; cheguei às %s. Bati a saída para o almoço às %s.',
               to_char(v_hoje, 'DD/MM'), to_char(v_chegada, 'HH24:MI'), to_char(v_agora, 'HH24:MI')),
        v_func, 'pendente', 'quiosque'
      ) returning id into v_id;

      insert into equipe_justificativa_marcacoes (justificativa_id, marcacao, horario)
      values (v_id, 'entrada', v_chegada);
    end if;

    v_res := public.ponto_registrar(v_func, p_pin, 'saida_almoco', p_estacao_token, null, null);
    if not coalesce((v_res ->> 'ok')::boolean, false) then
      raise exception 'ponto_registrar_falhou';
    end if;
  exception when others then
    if sqlerrm = 'ponto_registrar_falhou' then
      return v_res || jsonb_build_object('nome', v_nome);
    end if;
    return jsonb_build_object('ok', false,
      'mensagem', 'Não foi possível registrar agora (o mês pode estar fechado). Fale com o gestor.');
  end;

  return v_res || jsonb_build_object(
    'nome', v_nome,
    'chegada', to_char(v_chegada, 'HH24:MI'),
    'pedido_entrada', true);
end;
$function$;

revoke all on function public.ponto_saida_almoco_sem_entrada(text, text, text) from public;
grant execute on function public.ponto_saida_almoco_sem_entrada(text, text, text) to anon, authenticated;
