create type public.equipe_papel as enum ('admin', 'gestor', 'colaborador');

create table public.equipe_papeis (
  user_id uuid primary key references public.staff_members(user_id) on delete cascade,
  papel public.equipe_papel not null,
  created_at timestamptz not null default now()
);

create table public.equipe_gestor_empresas (
  user_id uuid not null references public.equipe_papeis(user_id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  primary key (user_id, empresa_id)
);

alter table public.equipe_papeis enable row level security;
alter table public.equipe_gestor_empresas enable row level security;

create or replace function public.is_equipe_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_staff_admin()
    or coalesce((select papel = 'admin' from equipe_papeis where user_id = auth.uid()), false)
$$;

create or replace function public.is_equipe_gestor_ou_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_equipe_admin()
    or coalesce((select papel = 'gestor' from equipe_papeis where user_id = auth.uid()), false)
$$;

create or replace function public.equipe_empresas_visiveis()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select id from empresas where public.is_equipe_admin()
  union
  select empresa_id from equipe_gestor_empresas where user_id = auth.uid()
$$;

create policy "Staff autenticado lê seu próprio papel"
  on public.equipe_papeis for select
  to authenticated
  using (user_id = auth.uid() or public.is_equipe_admin());

create policy "Só admin gerencia papéis"
  on public.equipe_papeis for all
  to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

create policy "Staff autenticado lê vínculos de gestor"
  on public.equipe_gestor_empresas for select
  to authenticated
  using (user_id = auth.uid() or public.is_equipe_admin());

create policy "Só admin gerencia vínculos de gestor"
  on public.equipe_gestor_empresas for all
  to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());
