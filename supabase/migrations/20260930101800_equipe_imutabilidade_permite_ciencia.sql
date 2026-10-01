-- Refina a trava de imutabilidade (R7).
--
-- Antes: qualquer atraso vinculado a uma medida ficava 100% congelado,
-- inclusive o status. Isso criava uma armadilha real: se o gestor aplicasse a
-- medida antes de o colaborador dar ciência (o que a tela permite, e o fluxo
-- de 48h/sem_ciencia pressupõe), a ciência passava a ser impossível pra sempre
-- e o registro ficava preso em pendente_ciencia.
--
-- Agora: os FATOS (hora de chegada, referência, minutos, tolerância) continuam
-- congelados assim que há ciência ou medida vinculada — é o que R7 protege.
-- O STATUS continua podendo sair de pendente_ciencia/justificativa_pendente
-- (ou seja, a ciência ainda pode ser registrada), mas nunca mais muda depois
-- disso.
create or replace function public.equipe_trg_atrasos_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_tem_medida boolean;
  v_mutavel boolean;
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'pendente_ciencia' or exists (select 1 from equipe_medida_atrasos where atraso_id = old.id) then
      raise exception 'Atraso com ciência dada ou vinculado a medida não pode ser apagado — crie um registro substituto (substitui_id).';
    end if;
    return old;
  end if;

  v_tem_medida := exists (select 1 from equipe_medida_atrasos where atraso_id = old.id);
  v_mutavel := old.status in ('pendente_ciencia', 'justificativa_pendente');

  -- Fatos: congelados se já houve ciência ou se há medida apoiada neste atraso.
  if not v_mutavel or v_tem_medida then
    if old.hora_chegada is distinct from new.hora_chegada
       or old.hora_chegada_porta is distinct from new.hora_chegada_porta
       or old.saida_almoco_real is distinct from new.saida_almoco_real
       or old.horario_referencia is distinct from new.horario_referencia
       or old.minutos_atraso is distinct from new.minutos_atraso
       or old.variacao_bruta_min is distinct from new.variacao_bruta_min
       or old.dentro_tolerancia is distinct from new.dentro_tolerancia then
      raise exception 'Atraso % tem ciência ou medida vinculada — os fatos são imutáveis. Crie um registro substituto.', old.id;
    end if;
  end if;

  -- Status: só sai de um estado ainda mutável.
  if not v_mutavel and old.status is distinct from new.status then
    raise exception 'Atraso % já teve o status definido (%) — não pode mudar de novo.', old.id, old.status;
  end if;

  return new;
end;
$$;
