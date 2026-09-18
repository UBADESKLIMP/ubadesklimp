begin;

alter table public.missing_products
  add column order_supplier_name text,
  add column order_quantity integer check (order_quantity > 0);

comment on column public.missing_products.order_supplier_name is 'Nome do fornecedor pro qual o pedido foi enviado — gravado no momento de marcar pedido_enviado (fluxo de cotação e fluxo direto de marca exclusiva). Substitui o cruzamento via quote_batch_items usado antes.';
comment on column public.missing_products.order_quantity is 'Quantidade a pedir no fluxo direto de marca exclusiva (sem cotação) — o fluxo de cotação usa quote_batch_items.quantity, não este campo. Null = ainda não definida.';

commit;
