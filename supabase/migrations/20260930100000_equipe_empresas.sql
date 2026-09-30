create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas enable row level security;

create policy "Staff autenticado lê empresas"
  on public.empresas for select
  to authenticated
  using (true);

create policy "Só admin gerencia empresas"
  on public.empresas for all
  to authenticated
  using (public.is_staff_admin())
  with check (public.is_staff_admin());
