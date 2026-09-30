create table public.equipe_aberturas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  data date not null,
  hora_abertura time not null,
  motivo text,
  registrado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  primary key (empresa_id, data)
);

alter table public.equipe_aberturas enable row level security;

create policy "Gestor/admin lê aberturas das empresas visíveis"
  on public.equipe_aberturas for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Gestor/admin registra abertura"
  on public.equipe_aberturas for insert
  to authenticated
  with check (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );

create policy "Gestor/admin corrige abertura do mesmo dia"
  on public.equipe_aberturas for update
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  )
  with check (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );
