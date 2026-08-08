begin;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  company_name text not null,
  phone text not null,
  email text,
  avg_delivery_days integer,
  max_installments integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.update_updated_at_column();

alter table public.suppliers enable row level security;

-- Mesmo padrão de RLS por permissão já usado em products/categories/orders
-- (Parte A): admin sempre passa, ou quem tem a permissão fornecedores.
create policy "Staff com permissão fornecedores gerenciam fornecedores"
  on public.suppliers
  for all
  using (public.is_staff_admin() or public.has_staff_permission('fornecedores'))
  with check (public.is_staff_admin() or public.has_staff_permission('fornecedores'));

commit;
