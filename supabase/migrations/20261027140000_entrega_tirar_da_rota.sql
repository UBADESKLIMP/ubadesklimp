-- Tirar uma parada da rota do dia e devolvê-la à fila.
--
-- Só vale para parada que ainda não foi resolvida (situação em_rota). Entrega
-- já entregue ou que já voltou é histórico e não sai da rota. A ordem das
-- outras paradas não muda (não refaz a rota inteira, que perderia o arrasto
-- manual da funcionária).
create or replace function public.entrega_tirar_da_rota(p_parada_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid;
  v_entrega uuid;
  v_situacao public.entrega_situacao;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin muda a rota.';
  end if;

  select r.empresa_id, p.entrega_id into v_emp, v_entrega
  from public.entrega_paradas p join public.entrega_rotas r on r.id = p.rota_id
  where p.id = p_parada_id;

  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Parada não encontrada (talvez já tenha saído da rota).');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  select situacao into v_situacao from public.entregas where id = v_entrega;
  if v_situacao is distinct from 'em_rota' then
    return jsonb_build_object('ok', false,
      'mensagem', 'Esta entrega já foi resolvida e não pode sair da rota.');
  end if;

  delete from public.entrega_paradas where id = p_parada_id;
  update public.entregas set situacao = 'na_fila', updated_at = now() where id = v_entrega;

  return jsonb_build_object('ok', true, 'mensagem', 'Voltou para a fila.');
end;
$$;

revoke all on function public.entrega_tirar_da_rota(uuid) from public, anon;
grant execute on function public.entrega_tirar_da_rota(uuid) to authenticated;
