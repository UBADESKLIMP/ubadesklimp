begin;

-- Backfill pontual: order_supplier_name foi criado nesta mesma leva de
-- migrações, sem valor pras linhas 'pedido_enviado' que já existiam. Sem
-- isso, essas linhas perderiam o nome do fornecedor na aba "Aguardando
-- confirmação" assim que o cruzamento antigo (via quote_batch_items) fosse
-- removido do código do cliente. Pega o lote mais recente por item, caso o
-- mesmo item tenha sido cotado em mais de um lote ao longo do tempo — a
-- própria ambiguidade que motivou trocar pelo campo direto.
update public.missing_products mp
set order_supplier_name = latest.supplier_label
from (
  select distinct on (qbi.missing_product_id)
    qbi.missing_product_id,
    s.company_name || ' (' || s.contact_name || ')' as supplier_label
  from public.quote_batch_items qbi
  join public.quote_item_winners qiw on qiw.quote_batch_item_id = qbi.id
  join public.quote_batch_suppliers qbs on qbs.id = qiw.quote_batch_supplier_id
  join public.suppliers s on s.id = qbs.supplier_id
  join public.quote_batches qb on qb.id = qbi.quote_batch_id
  order by qbi.missing_product_id, qb.created_at desc
) latest
where latest.missing_product_id = mp.id
  and mp.status = 'pedido_enviado'
  and mp.order_supplier_name is null;

commit;
