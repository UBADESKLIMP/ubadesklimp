begin;

-- status é texto simples (com check), não um enum: a Parte D2 vai estender
-- esse conjunto (ex.: 'em_cotacao') e alterar um check constraint é mais
-- simples/seguro do que alterar um enum do Postgres em produção.
create table public.missing_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  stock_remaining integer,
  report_count integer not null default 1,
  status text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  reported_by uuid not null,
  reported_by_name text not null,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missing_products_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade,
  constraint missing_products_reported_by_fkey foreign key (reported_by) references public.staff_members(user_id),
  constraint missing_products_resolved_by_fkey foreign key (resolved_by) references public.staff_members(user_id)
);

-- Só pode existir 1 linha pendente por produto — reportar de novo o mesmo
-- produto atualiza essa linha (incrementa report_count) em vez de duplicar.
create unique index missing_products_pending_product_idx
  on public.missing_products (product_id)
  where status = 'pendente';

create trigger update_missing_products_updated_at
  before update on public.missing_products
  for each row
  execute function public.update_updated_at_column();

alter table public.missing_products enable row level security;

create policy "Staff com permissão faltantes vê faltantes"
  on public.missing_products
  for select
  using (public.has_staff_permission('faltantes'));

create policy "Staff com permissão faltantes reporta produto novo"
  on public.missing_products
  for insert
  with check (public.has_staff_permission('faltantes') and reported_by = auth.uid());

-- Deixa qualquer um com 'faltantes' reportar de novo um produto já pendente
-- (incrementando o contador), mas o with check trava a linha resultante em
-- status = 'pendente' — esse caminho nunca pode ser usado pra resolver.
create policy "Staff com permissão faltantes reporta de novo produto pendente"
  on public.missing_products
  for update
  using (public.has_staff_permission('faltantes'))
  with check (public.has_staff_permission('faltantes') and status = 'pendente');

-- Só quem tem as duas permissões consegue de fato marcar como resolvido —
-- como as duas policies de update são combinadas com OR, quem só tem
-- 'faltantes' nunca satisfaz o with check de nenhuma das duas ao tentar
-- setar status = 'resolvido' (a de cima barra pelo status, esta barra pela
-- permissão).
create policy "Staff com faltantes e fornecedores resolve faltante"
  on public.missing_products
  for update
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

commit;
