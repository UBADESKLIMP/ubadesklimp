begin;

alter table public.quote_batch_items
  add column quantity integer not null default 1
    constraint quote_batch_items_quantity_check check (quantity > 0);

alter table public.quote_batches
  drop constraint quote_batches_status_check,
  add constraint quote_batches_status_check check (status in ('aberto', 'cancelado', 'concluido')),
  add column completed_at timestamptz,
  add column completed_by uuid references public.staff_members(user_id) on delete set null,
  add column completed_by_name text;

create table public.quote_item_winners (
  id uuid primary key default gen_random_uuid(),
  quote_batch_item_id uuid not null unique references public.quote_batch_items(id) on delete cascade,
  quote_batch_supplier_id uuid not null references public.quote_batch_suppliers(id) on delete cascade,
  source text not null constraint quote_item_winners_source_check check (source in ('auto', 'manual', 'ia')),
  set_by uuid references public.staff_members(user_id) on delete set null,
  set_by_name text not null,
  set_at timestamptz not null default now()
);

alter table public.quote_item_winners enable row level security;

create policy "Staff com faltantes e fornecedores gerencia quote_item_winners"
  on public.quote_item_winners for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

commit;
