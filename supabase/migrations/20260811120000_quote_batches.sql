begin;

create table public.quote_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'aberto' constraint quote_batches_status_check check (status in ('aberto', 'cancelado')),
  created_by uuid,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  constraint quote_batches_created_by_fkey foreign key (created_by) references public.staff_members(user_id) on delete set null
);

create table public.quote_batch_items (
  id uuid primary key default gen_random_uuid(),
  quote_batch_id uuid not null references public.quote_batches(id) on delete cascade,
  missing_product_id uuid not null references public.missing_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint quote_batch_items_unique unique (quote_batch_id, missing_product_id)
);

create table public.quote_batch_suppliers (
  id uuid primary key default gen_random_uuid(),
  quote_batch_id uuid not null references public.quote_batches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'pendente' constraint quote_batch_suppliers_status_check check (status in ('pendente', 'revisado')),
  created_at timestamptz not null default now(),
  constraint quote_batch_suppliers_unique unique (quote_batch_id, supplier_id)
);

create table public.quote_files (
  id uuid primary key default gen_random_uuid(),
  quote_batch_supplier_id uuid not null references public.quote_batch_suppliers(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid,
  uploaded_by_name text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quote_files_uploaded_by_fkey foreign key (uploaded_by) references public.staff_members(user_id) on delete set null
);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_batch_supplier_id uuid not null references public.quote_batch_suppliers(id) on delete cascade,
  quote_batch_item_id uuid not null references public.quote_batch_items(id) on delete cascade,
  price numeric,
  updated_by uuid,
  updated_by_name text not null default 'Sistema',
  updated_at timestamptz not null default now(),
  constraint quote_line_items_unique unique (quote_batch_supplier_id, quote_batch_item_id),
  constraint quote_line_items_updated_by_fkey foreign key (updated_by) references public.staff_members(user_id) on delete set null
);

create trigger update_quote_line_items_updated_at
  before update on public.quote_line_items
  for each row
  execute function public.update_updated_at_column();

alter table public.quote_batches enable row level security;
alter table public.quote_batch_items enable row level security;
alter table public.quote_batch_suppliers enable row level security;
alter table public.quote_files enable row level security;
alter table public.quote_line_items enable row level security;

create policy "Staff com faltantes e fornecedores gerencia quote_batches"
  on public.quote_batches for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores gerencia quote_batch_items"
  on public.quote_batch_items for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores gerencia quote_batch_suppliers"
  on public.quote_batch_suppliers for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores gerencia quote_files"
  on public.quote_files for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores gerencia quote_line_items"
  on public.quote_line_items for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

-- Bucket privado pra arquivo de cotação (foto/PDF) — guardado permanentemente,
-- nunca fica público como product-images.
insert into storage.buckets (id, name, public) values ('quote-files', 'quote-files', false);

create policy "Staff com faltantes e fornecedores vê arquivos de cotação"
  on storage.objects for select
  using (bucket_id = 'quote-files' and public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores envia arquivos de cotação"
  on storage.objects for insert
  with check (bucket_id = 'quote-files' and public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores atualiza arquivos de cotação"
  on storage.objects for update
  using (bucket_id = 'quote-files' and public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

create policy "Staff com faltantes e fornecedores apaga arquivos de cotação"
  on storage.objects for delete
  using (bucket_id = 'quote-files' and public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

commit;
