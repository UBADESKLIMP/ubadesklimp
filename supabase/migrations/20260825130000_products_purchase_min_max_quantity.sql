begin;

alter table public.products
  drop column if exists purchase_avg_quantity,
  add column purchase_min_quantity text,
  add column purchase_max_quantity text;

comment on column public.products.purchase_min_quantity is 'Quantidade mínima que costuma ser comprada (texto livre, ex: "2cx"). Uso interno de compras, não aparece no site.';
comment on column public.products.purchase_max_quantity is 'Quantidade máxima que costuma ser comprada / o que cabe no estoque (texto livre, ex: "5cx"). Uso interno de compras, não aparece no site.';

commit;
