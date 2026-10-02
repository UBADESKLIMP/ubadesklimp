-- O cálculo do retorno já servia pro café: referência = saída + duração. Só
-- faltava não medir o desvio da saída contra o horário previsto de almoço,
-- que não quer dizer nada para uma pausa de café.
create or replace function public.equipe_calcular_atraso(
  p_colaborador_id uuid,
  p_empresa_id uuid,
  p_data date,
  p_marcacao public.equipe_marcacao,
  p_hora_chegada time,
  p_estava_na_porta boolean default false,
  p_hora_chegada_porta time default null,
  p_saida_almoco_real time default null,
  p_duracao_almoco_override_min integer default null
)
returns table (
  horario_previsto time, horario_referencia time, variacao_bruta_min integer,
  desvio_saida_almoco_min integer, minutos_atraso integer, dentro_tolerancia boolean,
  soma_dia_min integer, abertura_atrasada boolean
)
language plpgsql stable security definer set search_path = public as $$
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
      raise exception 'saida_almoco_real é obrigatório quando marcacao = %', p_marcacao;
    end if;
    v_referencia := p_saida_almoco_real + make_interval(mins => v_duracao_almoco);
    v_efetiva := p_hora_chegada;
    v_previsto := v_referencia;
    -- Desvio da saída só faz sentido no almoço: a pausa de café não tem hora
    -- marcada no cadastro, então comparar com almoco_previsto daria um número
    -- enorme e sem significado.
    if p_marcacao = 'retorno_almoco' and v_almoco_previsto is not null then
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

-- O retorno do café também precisa guardar a hora da saída que ele mede.
alter table public.equipe_atrasos drop constraint if exists retorno_almoco_precisa_saida_real;
alter table public.equipe_atrasos add constraint retorno_precisa_saida_real
  check (marcacao = 'entrada' or saida_almoco_real is not null);

-- No modelo 2x15 cabem dois retornos de café no mesmo dia, cada um medindo a
-- sua saída. O índice de "um por dia" passa a distinguir pela hora da saída.
drop index if exists equipe_atrasos_um_por_dia;
create unique index equipe_atrasos_um_por_dia
  on public.equipe_atrasos (colaborador_id, data, marcacao, coalesce(saida_almoco_real, '00:00'::time))
  where status <> 'substituido';

create or replace function public.equipe_trg_atraso_unico_no_dia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from equipe_atrasos
    where colaborador_id = new.colaborador_id
      and data = new.data
      and marcacao = new.marcacao
      and coalesce(saida_almoco_real, '00:00'::time)
          = coalesce(new.saida_almoco_real, '00:00'::time)
      and status <> 'substituido'
  ) then
    raise exception
      'Já existe lançamento de % para esse colaborador em %. Para corrigir, substitua o lançamento existente.',
      new.marcacao, to_char(new.data, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;
