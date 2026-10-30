-- Excluir entrega da fila mesmo que já tenha passado por uma rota (sobra de dia
-- anterior). A parada antiga sai junto (ON DELETE CASCADE). Continua protegido:
-- o que está em rota agora e o que tem registro do entregador (append-only).
create or replace function public.entrega_excluir(
  p_empresa_id uuid,
  p_entrega_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_apagadas int := 0;
  v_pedidas int := coalesce(array_length(p_entrega_ids, 1), 0);
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin exclui entrega.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if v_pedidas = 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha ao menos uma entrega para excluir.');
  end if;

  with apagadas as (
    delete from public.entregas e
    where e.empresa_id = p_empresa_id
      and e.id = any(p_entrega_ids)
      and e.situacao = 'na_fila'
      and not exists (select 1 from public.entrega_eventos ev where ev.entrega_id = e.id)
    returning e.id
  )
  select count(*) into v_apagadas from apagadas;

  return jsonb_build_object(
    'ok', v_apagadas > 0,
    'excluidas', v_apagadas,
    'ignoradas', v_pedidas - v_apagadas,
    'mensagem', case
      when v_apagadas = 0 then 'Nenhuma foi excluída: só dá para excluir entrega que está na fila e nunca teve registro do entregador.'
      when v_pedidas > v_apagadas then format('%s excluída(s). %s não podiam ser excluídas (estão na rota de hoje ou têm registro do entregador).', v_apagadas, v_pedidas - v_apagadas)
      else format('%s excluída(s).', v_apagadas)
    end
  );
end;
$$;
