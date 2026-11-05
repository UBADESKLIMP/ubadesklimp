-- Contestar o ponto pelo quiosque.
--
-- O funcionário não abre o site para justificar. Pelo quiosque (PIN + computador
-- registrado) ele pede o ajuste, e o pedido entra na MESMA fila de aprovação que
-- já existe (equipe_justificativas_ponto, status 'pendente'). Nada muda no ponto
-- sozinho: só vale depois que o gestor aprova. Quem pediu vê a resposta no próprio
-- quiosque.

alter table public.equipe_justificativas_ponto
  add column if not exists origem text not null default 'site'
  check (origem in ('site', 'quiosque'));

-- O que o funcionário vê: as batidas dos últimos 3 dias e os pedidos dele.
create or replace function public.ponto_meu_ponto_por_pin(
  p_pin text, p_estacao_token text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
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

  return jsonb_build_object(
    'ok', true,
    'nome', v_nome,
    'hoje', v_hoje,
    'dias', (
      select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'marcacoes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', m.id,
            'tipo', m.tipo::text,
            'hora', to_char(m.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
            'origem', m.origem::text
          ) order by m.registrado_em)
          from ponto_marcacoes m
          where m.empresa_id = v_empresa
            and m.funcionario_id = v_func
            and m.substituida_por is null
            and (m.registrado_em at time zone 'America/Sao_Paulo')::date = d.dia
        ), '[]'::jsonb)
      ) order by d.dia desc)
      from (select v_hoje - g as dia from generate_series(0, 2) g) d
    ),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id,
        'data', j.data,
        'tipo', j.tipo::text,
        'motivo', j.motivo,
        'status', j.status::text,
        'motivo_rejeicao', j.motivo_rejeicao,
        'origem', j.origem,
        'criado_em', j.created_at
      ) order by j.created_at desc)
      from (
        select * from equipe_justificativas_ponto
        where colaborador_id = v_func
          and status <> 'substituida'
          and tipo in ('esquecimento', 'marcacao_duplicada', 'marcacao_incorreta', 'falha_sistema')
          and created_at > now() - interval '30 days'
        order by created_at desc
        limit 8
      ) j
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.ponto_meu_ponto_por_pin(text, text) from public;
grant execute on function public.ponto_meu_ponto_por_pin(text, text) to anon, authenticated;

-- Pedir o ajuste. p_tipo:
--   esquecimento       -> p_batida + p_horario (a batida que faltou e a hora certa)
--   marcacao_duplicada -> p_marcacao_id (a batida repetida)
--   marcacao_incorreta -> p_marcacao_id + p_horario (a batida errada e a hora certa)
--   falha_sistema      -> p_motivo (o ponto não funcionou / outro motivo)
create or replace function public.ponto_contestar_por_pin(
  p_pin text,
  p_estacao_token text,
  p_data date,
  p_tipo text,
  p_marcacao_id uuid default null,
  p_batida text default null,
  p_horario text default null,
  p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date := p_data;
  v_nota text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_hora time;
  v_marc record;
  v_batida public.equipe_marcacao_ponto;
  v_prazo int;
  v_dias int;
  v_texto text;
  v_id uuid;

  rotulo text;
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

  if p_tipo not in ('esquecimento', 'marcacao_duplicada', 'marcacao_incorreta', 'falha_sistema') then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha o que aconteceu.');
  end if;

  -- Quem está com 6 pedidos em análise espera o gestor antes de abrir mais.
  if (select count(*) from equipe_justificativas_ponto
      where colaborador_id = v_func and status = 'pendente') >= 6 then
    return jsonb_build_object('ok', false,
      'mensagem', 'Você já tem 6 pedidos esperando o gestor. Espere a resposta antes de pedir outro.');
  end if;

  -- Horário certo (quando o tipo pede).
  if p_tipo in ('esquecimento', 'marcacao_incorreta') then
    if p_horario is null or p_horario !~ '^\d{1,2}:\d{2}$' then
      return jsonb_build_object('ok', false, 'mensagem', 'Diga o horário certo (por exemplo 08:00).');
    end if;
    v_hora := p_horario::time;
  end if;

  -- Tipos que apontam para uma batida: precisa ser dele e vigente. O dia do
  -- pedido é o da batida (não o que veio digitado).
  if p_tipo in ('marcacao_duplicada', 'marcacao_incorreta') then
    select * into v_marc from ponto_marcacoes
    where id = p_marcacao_id and funcionario_id = v_func and empresa_id = v_empresa
      and substituida_por is null;
    if v_marc.id is null then
      return jsonb_build_object('ok', false, 'mensagem', 'Escolha uma das suas batidas.');
    end if;
    v_data := (v_marc.registrado_em at time zone 'America/Sao_Paulo')::date;
  end if;

  if v_data is null or v_data > v_hoje then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha um dia que já passou ou hoje.');
  end if;

  -- Mesmo prazo de quem justifica pelo site (dias úteis).
  v_prazo := public.equipe_config_int(v_empresa, 'prazo_colaborador_dias_uteis', 2);
  v_dias := public.equipe_dias_uteis(v_data, v_hoje);
  if v_dias > v_prazo then
    return jsonb_build_object('ok', false,
      'mensagem', format('Já passou o prazo de %s dias úteis para pedir ajuste do dia %s. Fale com o gestor.',
                         v_prazo, to_char(v_data, 'DD/MM')));
  end if;

  if p_tipo = 'esquecimento' then
    if p_batida not in ('entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'hora_extra_inicio', 'hora_extra_saida') then
      return jsonb_build_object('ok', false, 'mensagem', 'Escolha qual batida você esqueceu.');
    end if;
    v_batida := p_batida::public.equipe_marcacao_ponto;
    if exists (
      select 1 from ponto_marcacoes m
      where m.funcionario_id = v_func and m.substituida_por is null
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_data
        and public.ponto_tipo_para_justificativa(m.tipo) = v_batida
    ) then
      return jsonb_build_object('ok', false,
        'mensagem', 'Você já tem essa batida registrada nesse dia. Use "Bati errado" se o horário estiver errado.');
    end if;
  end if;

  if p_tipo = 'falha_sistema' and (v_nota is null or char_length(v_nota) < 3) then
    return jsonb_build_object('ok', false, 'mensagem', 'Escreva em poucas palavras o que aconteceu.');
  end if;

  -- Já pediu o mesmo e ainda está esperando.
  if exists (
    select 1 from equipe_justificativas_ponto j
    where j.colaborador_id = v_func and j.status = 'pendente' and j.tipo = p_tipo::public.equipe_justificativa_tipo
      and j.data = v_data
      and j.marcacao_id is not distinct from p_marcacao_id
      and (p_tipo <> 'esquecimento' or exists (
        select 1 from equipe_justificativa_marcacoes jm
        where jm.justificativa_id = j.id and jm.marcacao = v_batida))
  ) then
    return jsonb_build_object('ok', false, 'mensagem', 'Você já pediu esse ajuste. Espere o gestor responder.');
  end if;

  rotulo := case
    when p_tipo = 'esquecimento' then case v_batida
      when 'entrada' then 'entrada' when 'saida_almoco' then 'saída para o almoço'
      when 'retorno_almoco' then 'volta do almoço' when 'saida' then 'saída'
      when 'hora_extra_inicio' then 'início da hora extra' else 'fim da hora extra' end
    when p_tipo in ('marcacao_duplicada', 'marcacao_incorreta') then case v_marc.tipo::text
      when 'entrada' then 'entrada' when 'saida_almoco' then 'saída para o almoço'
      when 'retorno_almoco' then 'volta do almoço' when 'saida' then 'saída'
      else 'batida' end
    else null end;

  v_texto := case p_tipo
    when 'esquecimento' then format('Pelo quiosque: esqueci de bater a %s de %s; o horário certo era %s.',
                                    rotulo, to_char(v_data, 'DD/MM'), to_char(v_hora, 'HH24:MI'))
    when 'marcacao_duplicada' then format('Pelo quiosque: bati duas vezes; a repetida é a %s das %s de %s.',
                                    rotulo, to_char(v_marc.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
                                    to_char(v_data, 'DD/MM'))
    when 'marcacao_incorreta' then format('Pelo quiosque: a %s das %s de %s está errada; o horário certo é %s.',
                                    rotulo, to_char(v_marc.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
                                    to_char(v_data, 'DD/MM'), to_char(v_hora, 'HH24:MI'))
    else format('Pelo quiosque: %s', v_nota) end;
  if p_tipo <> 'falha_sistema' and v_nota is not null then
    v_texto := v_texto || ' Obs.: ' || v_nota;
  end if;

  begin
    insert into equipe_justificativas_ponto (
      colaborador_id, empresa_id, data, tipo, motivo, marcacao_id, criado_por, status, origem
    ) values (
      v_func, v_empresa, v_data, p_tipo::public.equipe_justificativa_tipo, left(v_texto, 500),
      p_marcacao_id, v_func, 'pendente', 'quiosque'
    ) returning id into v_id;

    if p_tipo = 'esquecimento' then
      insert into equipe_justificativa_marcacoes (justificativa_id, marcacao, horario)
      values (v_id, v_batida, v_hora);
    elsif p_tipo = 'marcacao_incorreta' then
      insert into equipe_justificativa_marcacoes (justificativa_id, marcacao, horario)
      values (v_id, public.ponto_tipo_para_justificativa(v_marc.tipo), v_hora);
    end if;
  exception when others then
    return jsonb_build_object('ok', false,
      'mensagem', 'Não foi possível pedir esse ajuste (o mês desse dia pode já estar fechado). Fale com o gestor.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id,
    'mensagem', 'Pedido enviado ao gestor. Você não precisa fazer mais nada.');
end;
$function$;

revoke all on function public.ponto_contestar_por_pin(text, text, date, text, uuid, text, text, text) from public;
grant execute on function public.ponto_contestar_por_pin(text, text, date, text, uuid, text, text, text) to anon, authenticated;
