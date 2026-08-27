begin;

alter table public.missing_products
  drop constraint missing_products_status_check;

alter table public.missing_products
  add constraint missing_products_status_check
  check (status = any (array['pendente'::text, 'resolvido'::text, 'cancelado'::text]));

alter table public.missing_products
  add column cancelled_by uuid references public.staff_members(user_id) on delete set null,
  add column cancelled_at timestamp with time zone;

comment on column public.missing_products.cancelled_by is 'Quem marcou este item como cancelado (reportado por engano/produto errado) — distinto de resolvido, que é item efetivamente comprado.';
comment on column public.missing_products.cancelled_at is 'Quando o item foi cancelado.';

commit;
