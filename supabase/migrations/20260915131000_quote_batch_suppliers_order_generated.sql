begin;

alter table public.quote_batch_suppliers
  add column order_generated_at timestamptz,
  add column order_generated_by uuid references public.staff_members(user_id) on delete set null,
  add column order_generated_by_name text;

comment on column public.quote_batch_suppliers.order_generated_at is 'Quando o pedido de compra deste fornecedor foi gerado pela primeira vez (independente do lote inteiro estar concluído/arquivado). Null = ainda não gerado.';

commit;
