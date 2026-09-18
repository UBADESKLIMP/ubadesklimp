begin;

-- unaccent() nativo é STABLE (depende de configuração de dicionário), e
-- Postgres não deixa usar função STABLE em expressão de índice — só
-- IMMUTABLE. Este wrapper (padrão documentado no wiki do Postgres/Supabase
-- pra esse exato problema) fixa o dicionário explicitamente e assume a
-- garantia de imutabilidade, o que é seguro aqui porque o mapeamento de
-- acentuação não muda.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select public.unaccent('public.unaccent'::regdictionary, $1);
$$;

create table public.supplier_exclusive_brands (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  brand text not null,
  created_at timestamptz not null default now()
);

-- Uma marca só pode ser exclusiva de 1 fornecedor por vez.
create unique index supplier_exclusive_brands_brand_idx
  on public.supplier_exclusive_brands (lower(public.immutable_unaccent(brand)));

alter table public.supplier_exclusive_brands enable row level security;

-- Leitura: qualquer staff com 'faltantes' precisa ver essas marcas pra saber
-- quais itens tirar da aba Pendente normal e mostrar na aba "Fornecedor
-- exclusivo" — mesmo sem ter 'fornecedores'.
create policy "Staff com permissão faltantes vê marcas exclusivas"
  on public.supplier_exclusive_brands
  for select
  using (
    public.is_staff_admin()
    or public.has_staff_permission('faltantes')
    or public.has_staff_permission('fornecedores')
  );

-- Gerenciar (criar/editar/excluir) continua restrito a quem cuida de
-- fornecedores, mesmo padrão de RLS da tabela suppliers.
create policy "Staff com permissão fornecedores gerencia marcas exclusivas"
  on public.supplier_exclusive_brands
  for all
  using (public.is_staff_admin() or public.has_staff_permission('fornecedores'))
  with check (public.is_staff_admin() or public.has_staff_permission('fornecedores'));

comment on table public.supplier_exclusive_brands is 'Marcas que só são compradas de um fornecedor específico (ex: Yoma só do fornecedor Yoma) — usado pra separar esses itens do fluxo normal de cotação em Faltantes.';

commit;
