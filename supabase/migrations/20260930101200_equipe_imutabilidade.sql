create or replace function public.equipe_trg_atrasos_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'pendente_ciencia' or exists (select 1 from equipe_medida_atrasos where atraso_id = old.id) then
      raise exception 'Atraso com ciência dada ou vinculado a medida não pode ser apagado — crie um registro substituto (substitui_id).';
    end if;
    return old;
  end if;

  if old.status not in ('pendente_ciencia', 'justificativa_pendente')
     or exists (select 1 from equipe_medida_atrasos where atraso_id = old.id) then
    if old.hora_chegada is distinct from new.hora_chegada
       or old.horario_referencia is distinct from new.horario_referencia
       or old.minutos_atraso is distinct from new.minutos_atraso
       or old.dentro_tolerancia is distinct from new.dentro_tolerancia
       or old.status is distinct from new.status then
      raise exception 'Atraso % com ciência dada ou medida vinculada é imutável — crie um registro substituto.', old.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_equipe_atrasos_imutavel
  before update or delete on public.equipe_atrasos
  for each row execute function public.equipe_trg_atrasos_imutavel();

create or replace function public.equipe_trg_ciencias_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  raise exception 'Ciências são imutáveis — não podem ser editadas nem apagadas.';
end;
$$;

create trigger trg_equipe_ciencias_imutavel
  before update or delete on public.equipe_ciencias
  for each row execute function public.equipe_trg_ciencias_imutavel();

create or replace function public.equipe_trg_medidas_aplicada_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' and old.status = 'aplicada' then
    raise exception 'Medida aplicada não pode ser apagada.';
  end if;
  if TG_OP = 'UPDATE' and old.status = 'aplicada' and new.status <> old.status then
    raise exception 'Medida já aplicada não pode mudar de status.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_equipe_medidas_aplicada_imutavel
  before update or delete on public.equipe_medidas
  for each row execute function public.equipe_trg_medidas_aplicada_imutavel();
