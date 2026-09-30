create or replace function public.equipe_trg_calcular_atraso()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_escala_entrada time;
  v_duracao_almoco int;
  v_almoco_previsto time;
  v_abertura time;
  v_referencia time;
  v_efetiva time;
begin
  select ee.entrada, sm.duracao_almoco_min, sm.almoco_previsto
    into v_escala_entrada, v_duracao_almoco, v_almoco_previsto
  from staff_members sm
  join equipe_escalas ee on ee.id = sm.escala_id
  where sm.user_id = new.colaborador_id;

  if v_escala_entrada is null then
    raise exception 'Colaborador % não tem escala configurada (staff_members.escala_id)', new.colaborador_id;
  end if;

  if new.duracao_almoco_override_min is not null then
    v_duracao_almoco := new.duracao_almoco_override_min;
  end if;

  if new.marcacao = 'entrada' then
    select hora_abertura into v_abertura
    from equipe_aberturas
    where empresa_id = new.empresa_id and data = new.data;

    if v_abertura is null or v_abertura <= v_escala_entrada then
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada;
    elsif new.estava_na_porta and new.hora_chegada_porta is not null then
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada_porta;
    elsif new.estava_na_porta then
      v_referencia := v_abertura;
      v_efetiva := new.hora_chegada;
    else
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada;
    end if;

    new.horario_previsto := v_escala_entrada;
  else
    v_referencia := new.saida_almoco_real + make_interval(mins => v_duracao_almoco);
    v_efetiva := new.hora_chegada;
    new.horario_previsto := v_referencia;

    if v_almoco_previsto is not null then
      new.desvio_saida_almoco_min :=
        round(extract(epoch from (new.saida_almoco_real - v_almoco_previsto)) / 60)::int;
    end if;
  end if;

  new.horario_referencia := v_referencia;
  new.variacao_bruta_min := greatest(0, round(extract(epoch from (v_efetiva - v_referencia)) / 60)::int);
  new.minutos_atraso := new.variacao_bruta_min;
  new.dentro_tolerancia := false;

  return new;
end;
$$;

create trigger trg_equipe_calcular_atraso
  before insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_calcular_atraso();

create or replace function public.equipe_recalcular_tolerancia_dia(p_colaborador_id uuid, p_data date)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tol_marcacao int;
  v_tol_dia int;
  v_soma int;
begin
  select ee.tol_marcacao_min, ee.tol_dia_min into v_tol_marcacao, v_tol_dia
  from staff_members sm
  join equipe_escalas ee on ee.id = sm.escala_id
  where sm.user_id = p_colaborador_id;

  select coalesce(sum(variacao_bruta_min), 0) into v_soma
  from equipe_atrasos
  where colaborador_id = p_colaborador_id and data = p_data and status <> 'substituido';

  update equipe_atrasos
  set minutos_atraso = case
        when variacao_bruta_min <= v_tol_marcacao and v_soma <= v_tol_dia then 0
        else variacao_bruta_min
      end,
      dentro_tolerancia = (variacao_bruta_min <= v_tol_marcacao and v_soma <= v_tol_dia),
      updated_at = now()
  where colaborador_id = p_colaborador_id
    and data = p_data
    and status = 'pendente_ciencia';
end;
$$;

create or replace function public.equipe_trg_recalcular_tolerancia_dia()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.equipe_recalcular_tolerancia_dia(new.colaborador_id, new.data);
  return null;
end;
$$;

create trigger trg_equipe_recalcular_tolerancia_dia
  after insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_recalcular_tolerancia_dia();
