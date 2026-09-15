begin;

alter table public.missing_products
  drop constraint missing_products_status_check;

alter table public.missing_products
  add constraint missing_products_status_check
  check (status = any (array['pendente'::text, 'resolvido'::text, 'cancelado'::text, 'pedido_enviado'::text]));

alter table public.missing_products
  add column order_sent_at timestamptz,
  add column order_sent_by uuid references public.staff_members(user_id) on delete set null;

comment on column public.missing_products.order_sent_at is 'Quando um pedido de compra foi gerado pro fornecedor vencedor deste item — status vira pedido_enviado. Distinto de resolvido (compra confirmada) e pendente (nenhum pedido gerado ainda).';
comment on column public.missing_products.order_sent_by is 'Quem gerou o pedido que moveu este item pra pedido_enviado.';

commit;
