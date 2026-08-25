begin;

alter table public.products
  add column purchase_avg_quantity text,
  add column purchase_notes text;

comment on column public.products.purchase_avg_quantity is 'Quantidade que costuma ser comprada deste produto (texto livre, ex: "5 caixas de 12"). Uso interno de compras, não aparece no site.';
comment on column public.products.purchase_notes is 'Observações de compra (fornecedor preferido, prazo, etc). Uso interno, não aparece no site.';

commit;
