-- Montar a rota de novo no mesmo dia apagava as paradas que não fossem
-- escolhidas outra vez. As já entregues (ou que voltaram) não estão mais na fila,
-- então nunca eram escolhidas e sumiam da rota do dia, embora a entrega seguisse
-- "entregue". Agora só sai da rota a parada que ainda está em_rota.
create or replace function public.entrega_montar_rota(
  p_empresa_id uuid, p_data date, p_entrega_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_rota uuid;
  v_n int := 0;
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

  update entregas set situacao = 'na_fila', updated_at = now()
  where id in (
    select p.entrega_id from entrega_paradas p
    where p.rota_id = v_rota and not (p.entrega_id = any(p_entrega_ids))
  ) and situacao = 'em_rota';

  -- Só sai da rota o que ainda está para sair. Entregue e "voltou" ficam como
  -- registro do dia.
  delete from entrega_paradas p
  using entregas e
  where p.rota_id = v_rota
    and e.id = p.entrega_id
    and e.situacao = 'em_rota'
    and not (p.entrega_id = any(p_entrega_ids));

  insert into entrega_paradas (rota_id, entrega_id, ordem)
  select v_rota, e.id,
         row_number() over (
           order by coalesce(b.ordem, 999999), e.cliente_nome
         ) * 10
  from entregas e
  left join entrega_bairros b on b.id = e.bairro_id
  where e.id = any(p_entrega_ids)
    and e.empresa_id = p_empresa_id
    and e.situacao in ('na_fila', 'nao_entregue', 'em_rota')
  on conflict (rota_id, entrega_id) do nothing;

  update entregas set situacao = 'em_rota', updated_at = now()
  where id = any(p_entrega_ids)
    and empresa_id = p_empresa_id
    and situacao in ('na_fila', 'nao_entregue');

  select count(*) into v_n from entrega_paradas where rota_id = v_rota;

  return jsonb_build_object('ok', true, 'rota_id', v_rota, 'paradas', v_n);
end;
$function$;

-- Recupera as paradas que o comportamento antigo já apagou: todo registro do
-- entregador aponta para a rota onde aconteceu.
insert into entrega_paradas (rota_id, entrega_id, ordem)
select distinct on (ev.rota_id, ev.entrega_id) ev.rota_id, ev.entrega_id, 0
from entrega_eventos ev
where ev.rota_id is not null
  and not exists (
    select 1 from entrega_paradas p
    where p.rota_id = ev.rota_id and p.entrega_id = ev.entrega_id
  )
on conflict (rota_id, entrega_id) do nothing;
