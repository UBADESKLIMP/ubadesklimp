create table public.equipe_escalas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  dias_semana int[] not null default '{1,2,3,4,5}',
  entrada time not null default '08:00',
  saida time not null,
  tol_marcacao_min int not null default 5,
  tol_dia_min int not null default 10,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.equipe_escalas enable row level security;

create policy "Staff autenticado lê escalas"
  on public.equipe_escalas for select
  to authenticated
  using (true);

create policy "Só admin gerencia escalas"
  on public.equipe_escalas for all
  to authenticated
  using (public.is_staff_admin())
  with check (public.is_staff_admin());
