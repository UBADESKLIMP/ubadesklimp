-- Mandar entregas da fila para a rota do dia só ACRESCENTA. Antes a função
-- tratava a lista enviada como a rota inteira e devolvia para a fila tudo que
-- já estava em rota e não tinha sido marcado de novo. Para tirar uma entrega da
-- rota existe o X em cada parada (entrega_tirar_da_rota).
-- As novas entram depois das que já estavam, sem embaralhar a ordem que o
-- gestor já arrastou.
create or replace function public.entrega_montar_rota(
  p_empresa_id uuid, p_data date, p_entrega_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_rota uuid;
  v_n int := 0;
  v_ordem_base int := 0;
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin monta a rota.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if coalesce(array_length(p_entrega_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false,
      'mensagem', 'Escolha ao menos uma entrega para montar a rota.');
  end if;

  insert into entrega_rotas (empresa_id, data, criada_por)
  values (p_empresa_id, p_data, auth.uid())
  on conflict (empresa_id, data) do update set data = excluded.data
  returning id into v_rota;

  select coalesce(max(ordem), 0) into v_ordem_base
  from entrega_paradas where rota_id = v_rota;

  insert into entrega_paradas (rota_id, entrega_id, ordem)
  select v_rota, e.id,
         v_ordem_base + row_number() over (
           order by coalesce(b.ordem, 999999), e.cliente_nome
         ) * 10
  from entregas e
  left join entrega_bairros b on b.id = e.bairro_id
  where e.id = any(p_entrega_ids)
    and e.empresa_id = p_empresa_id
    and e.situacao in ('na_fila', 'nao_entregue')
  on conflict (rota_id, entrega_id) do nothing;

  update entregas set situacao = 'em_rota', updated_at = now()
  where id = any(p_entrega_ids)
    and empresa_id = p_empresa_id
    and situacao in ('na_fila', 'nao_entregue');

  select count(*) into v_n from entrega_paradas where rota_id = v_rota;

  return jsonb_build_object('ok', true, 'rota_id', v_rota, 'paradas', v_n);
end;
$function$;
