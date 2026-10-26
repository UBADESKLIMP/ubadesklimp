-- Excluir entregas que ainda não foram colocadas em rota.
--
-- Só apaga entrega que NUNCA saiu: situação na_fila, nenhuma tentativa, fora de
-- qualquer rota e sem nenhum registro do entregador. O que já foi para a rua
-- (em rota, entregue, voltou) é histórico e fica. Quem pede por um id que não
-- cumpre isso recebe a contagem de "ignoradas", nunca uma exclusão parcial
-- escondida.
create or replace function public.entrega_excluir(
  p_empresa_id uuid,
  p_entrega_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_apagadas int := 0;
  v_pedidas int := coalesce(array_length(p_entrega_ids, 1), 0);
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin exclui entrega.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
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
      and e.tentativas = 0
      and not exists (select 1 from public.entrega_paradas p where p.entrega_id = e.id)
      and not exists (select 1 from public.entrega_eventos ev where ev.entrega_id = e.id)
    returning e.id
  )
  select count(*) into v_apagadas from apagadas;

  return jsonb_build_object(
    'ok', v_apagadas > 0,
    'excluidas', v_apagadas,
    'ignoradas', v_pedidas - v_apagadas,
    'mensagem', case
      when v_apagadas = 0 then 'Nenhuma foi excluída: só dá para excluir entrega que ainda não entrou em rota.'
      when v_pedidas > v_apagadas then format('%s excluída(s). %s não podiam ser excluídas porque já entraram em rota.', v_apagadas, v_pedidas - v_apagadas)
      else format('%s excluída(s).', v_apagadas)
    end
  );
end;
$$;

revoke all on function public.entrega_excluir(uuid, uuid[]) from public, anon;
grant execute on function public.entrega_excluir(uuid, uuid[]) to authenticated;
