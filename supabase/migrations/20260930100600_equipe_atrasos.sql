create type public.equipe_marcacao as enum ('entrada', 'retorno_almoco');

create type public.equipe_atraso_status as enum (
  'pendente_ciencia', 'ciente', 'sem_ciencia', 'justificativa_pendente',
  'abonado', 'compensado', 'substituido'
);

create table public.equipe_atrasos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.staff_members(user_id),
  empresa_id uuid not null references public.empresas(id),
  data date not null,
  marcacao public.equipe_marcacao not null,
  horario_previsto time,
  saida_almoco_real time,
  desvio_saida_almoco_min int,
  duracao_almoco_override_min int,
  estava_na_porta boolean not null default false,
  hora_chegada_porta time,
  hora_chegada time not null,
  horario_referencia time,
  variacao_bruta_min int,
  minutos_atraso int,
  dentro_tolerancia boolean,
  status public.equipe_atraso_status not null default 'pendente_ciencia',
  justificativa_ponto_id uuid,
  substitui_id uuid references public.equipe_atrasos(id),
  criado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retorno_almoco_precisa_saida_real
    check (marcacao <> 'retorno_almoco' or saida_almoco_real is not null)
);

comment on column public.equipe_atrasos.variacao_bruta_min is
  'Variação em minutos antes de aplicar a tolerância do dia (R2) — nunca muda depois de calculado, usado pra somar o dia.';
comment on column public.equipe_atrasos.duracao_almoco_override_min is
  'Override pontual da duração do almoço (ex.: intervalo reduzido da Parte 2). Null = usa staff_members.duracao_almoco_min.';

create index idx_equipe_atrasos_colaborador_data on public.equipe_atrasos (colaborador_id, data);

alter table public.equipe_atrasos enable row level security;

create policy "Colaborador lê os próprios atrasos"
  on public.equipe_atrasos for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê atrasos das empresas visíveis"
  on public.equipe_atrasos for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );

create policy "Gestor/admin lança atraso"
  on public.equipe_atrasos for insert
  to authenticated
  with check (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );
