-- Extrai o núcleo do cálculo (antes embutido no trigger) pra uma função pura e
-- reutilizável, com o nome que o PRD usa. Dois consumidores:
--   1. o trigger BEFORE INSERT em equipe_atrasos (gravação de verdade);
--   2. a tela "Lançar atraso", via RPC, pra mostrar a prévia do cálculo antes
--      de salvar — assim o front NUNCA reimplementa a regra em JS.
create or replace function public.equipe_calcular_atraso(
  p_colaborador_id uuid,
  p_empresa_id uuid,
  p_data date,
  p_marcacao public.equipe_marcacao,
  p_hora_chegada time,
  p_estava_na_porta boolean default false,
  p_hora_chegada_porta time default null,
  p_saida_almoco_real time default null,
  p_duracao_almoco_override_min int default null
)
returns table (
  horario_previsto time,
  horario_referencia time,
  variacao_bruta_min int,
  desvio_saida_almoco_min int,
  minutos_atraso int,
  dentro_tolerancia boolean,
  soma_dia_min int,
  abertura_atrasada boolean
)
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_escala_entrada time;
  v_tol_marcacao int;
  v_tol_dia int;
  v_duracao_almoco int;
  v_almoco_previsto time;
  v_abertura time;
  v_referencia time;
  v_efetiva time;
  v_previsto time;
  v_desvio int;
  v_bruta int;
  v_soma_outras int;
  v_soma_total int;
begin
  select ee.entrada, ee.tol_marcacao_min, ee.tol_dia_min, sm.duracao_almoco_min, sm.almoco_previsto
    into v_escala_entrada, v_tol_marcacao, v_tol_dia, v_duracao_almoco, v_almoco_previsto
  from staff_members sm
  join equipe_escalas ee on ee.id = sm.escala_id
  where sm.user_id = p_colaborador_id;

  if v_escala_entrada is null then
    raise exception 'Colaborador % não tem escala configurada (staff_members.escala_id)', p_colaborador_id;
  end if;

  if p_duracao_almoco_override_min is not null then
    v_duracao_almoco := p_duracao_almoco_override_min;
  end if;

  select hora_abertura into v_abertura
  from equipe_aberturas
  where empresa_id = p_empresa_id and data = p_data;

  if p_marcacao = 'entrada' then
    if v_abertura is null or v_abertura <= v_escala_entrada then
      v_referencia := v_escala_entrada;
      v_efetiva := p_hora_chegada;
    elsif p_estava_na_porta and p_hora_chegada_porta is not null then
      -- Brecha fechada (R3): hora da porta contra a escala, não contra a abertura.
      v_referencia := v_escala_entrada;
      v_efetiva := p_hora_chegada_porta;
    elsif p_estava_na_porta then
      v_referencia := v_abertura;
      v_efetiva := p_hora_chegada;
    else
      v_referencia := v_escala_entrada;
      v_efetiva := p_hora_chegada;
    end if;
    v_previsto := v_escala_entrada;
  else
    if p_saida_almoco_real is null then
      raise exception 'saida_almoco_real é obrigatório quando marcacao = retorno_almoco';
    end if;
    v_referencia := p_saida_almoco_real + make_interval(mins => v_duracao_almoco);
    v_efetiva := p_hora_chegada;
    v_previsto := v_referencia;
    if v_almoco_previsto is not null then
      v_desvio := round(extract(epoch from (p_saida_almoco_real - v_almoco_previsto)) / 60)::int;
    end if;
  end if;

  v_bruta := greatest(0, round(extract(epoch from (v_efetiva - v_referencia)) / 60)::int);

  select coalesce(sum(a.variacao_bruta_min), 0) into v_soma_outras
  from equipe_atrasos a
  where a.colaborador_id = p_colaborador_id and a.data = p_data and a.status <> 'substituido';

  v_soma_total := v_soma_outras + v_bruta;

  return query select
    v_previsto,
    v_referencia,
    v_bruta,
    v_desvio,
    case when v_bruta <= v_tol_marcacao and v_soma_total <= v_tol_dia then 0 else v_bruta end,
    (v_bruta <= v_tol_marcacao and v_soma_total <= v_tol_dia),
    v_soma_total,
    (v_abertura is not null and v_abertura > v_escala_entrada);
end;
$$;

-- Trigger passa a delegar pra função pura, em vez de repetir a regra.
create or replace function public.equipe_trg_calcular_atraso()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_calc record;
begin
  select * into v_calc from public.equipe_calcular_atraso(
    new.colaborador_id,
    new.empresa_id,
    new.data,
    new.marcacao,
    new.hora_chegada,
    new.estava_na_porta,
    new.hora_chegada_porta,
    new.saida_almoco_real,
    new.duracao_almoco_override_min
  );

  new.horario_previsto := v_calc.horario_previsto;
  new.horario_referencia := v_calc.horario_referencia;
  new.variacao_bruta_min := v_calc.variacao_bruta_min;
  new.desvio_saida_almoco_min := v_calc.desvio_saida_almoco_min;
  -- Valor provisório; o AFTER INSERT reconfere a soma do dia e pode
  -- reclassificar as linhas irmãs ainda pendentes.
  new.minutos_atraso := v_calc.minutos_atraso;
  new.dentro_tolerancia := v_calc.dentro_tolerancia;

  return new;
end;
$$;
