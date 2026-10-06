-- A rota é do dia e da empresa — uma só, por isso o unique. "invertida" não
-- reordena as paradas no banco: ela diz como a lista deve ser lida. Guardar a
-- ordem canônica e virar na leitura evita que inverter duas vezes embaralhe o
-- que o gestor ajustou na mão.

create table public.entrega_rotas (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  data       date not null,
  invertida  boolean not null default false,
  fechada_em timestamptz,
  criada_por uuid,
  created_at timestamptz not null default now(),
  unique (empresa_id, data)
);

create table public.entrega_paradas (
  id         uuid primary key default gen_random_uuid(),
  rota_id    uuid not null references public.entrega_rotas(id) on delete cascade,
  entrega_id uuid not null references public.entregas(id)      on delete cascade,
  ordem      int  not null,
  created_at timestamptz not null default now(),
  unique (rota_id, entrega_id)
);

create index entrega_paradas_ordem on public.entrega_paradas (rota_id, ordem);

alter table public.entrega_rotas   enable row level security;
alter table public.entrega_paradas enable row level security;

create policy "le_rotas" on public.entrega_rotas
  for select using (empresa_id in (select equipe_empresas_visiveis()));

create policy "gestor_escreve_rotas" on public.entrega_rotas
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

create policy "le_paradas" on public.entrega_paradas
  for select using (
    rota_id in (select id from public.entrega_rotas
                 where empresa_id in (select equipe_empresas_visiveis())));

create policy "gestor_escreve_paradas" on public.entrega_paradas
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());
