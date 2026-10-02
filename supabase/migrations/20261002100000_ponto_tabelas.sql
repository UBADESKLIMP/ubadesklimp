-- Módulo Ponto — tabelas (PRD seção 8).
--
-- empresa_id fica em tudo mesmo com uma empresa só: a coluna já existe no
-- resto do módulo Equipe e removê-la agora custaria caro pra devolver depois.
-- O que não se constrói é fluxo multiempresa (seletor, escopo por gestor).

create type public.ponto_local_tipo as enum ('estacao', 'qr');

create type public.ponto_marcacao_tipo as enum (
  'entrada', 'saida_almoco', 'retorno_almoco', 'saida',
  'hora_extra_inicio', 'hora_extra_saida', 'saida_pausa', 'retorno_pausa'
);

create type public.ponto_origem as enum ('individual', 'abertura_coletiva');

create type public.ponto_confirmacao as enum (
  'na', 'pendente', 'confirmada', 'contestada', 'confirmada_por_prazo'
);

create type public.ponto_rede_origem as enum ('heartbeat', 'manual');

create type public.ponto_dispositivo_status as enum ('pendente', 'aprovado', 'revogado');

create type public.ponto_motivo_recusa as enum (
  'fora_da_rede', 'dispositivo_nao_aprovado', 'pin_invalido', 'conta_bloqueada',
  'sequencia_invalida', 'local_nao_permite', 'token_qr_invalido',
  'estacao_invalida', 'duplicada', 'rate_limit', 'sem_ip', 'fora_da_janela',
  'sem_permissao'
);

create table public.ponto_locais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  tipo public.ponto_local_tipo not null,
  marcacoes_permitidas public.ponto_marcacao_tipo[] not null default
    '{entrada,saida_almoco,retorno_almoco,saida,hora_extra_inicio,hora_extra_saida}',
  qr_token_hash text,
  qr_dinamico boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ponto_estacoes (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.ponto_locais(id) on delete cascade,
  nome text not null,
  -- só o hash: o token fica no navegador do PC, nunca legível no banco
  device_token_hash text not null unique,
  registrado_por uuid references public.staff_members(user_id),
  ultimo_heartbeat timestamptz,
  ultimo_ip inet,
  revogada_em timestamptz,
  created_at timestamptz not null default now()
);

create table public.ponto_redes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ip inet not null,
  origem public.ponto_rede_origem not null,
  visto_em timestamptz not null default now(),
  ativo boolean not null default true,
  unique (empresa_id, ip)
);

create table public.ponto_dispositivos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.staff_members(user_id) on delete cascade,
  device_id_hash text not null,
  apelido text,
  status public.ponto_dispositivo_status not null default 'pendente',
  aprovado_por uuid references public.staff_members(user_id),
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (funcionario_id, device_id_hash)
);

-- 1 celular aprovado por funcionário (PRD 4.3)
create unique index ponto_dispositivos_um_aprovado
  on public.ponto_dispositivos (funcionario_id)
  where status = 'aprovado';

create table public.ponto_marcacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  funcionario_id uuid not null references public.staff_members(user_id),
  tipo public.ponto_marcacao_tipo not null,
  registrado_em timestamptz not null default now(),
  local_id uuid references public.ponto_locais(id),
  estacao_id uuid references public.ponto_estacoes(id),
  dispositivo_id uuid references public.ponto_dispositivos(id),
  origem public.ponto_origem not null default 'individual',
  marcado_por uuid references public.staff_members(user_id),
  confirmacao public.ponto_confirmacao not null default 'na',
  estava_na_porta boolean not null default false,
  ip inet,
  user_agent text,
  foto_path text,
  hash text not null,
  hash_anterior text,
  created_at timestamptz not null default now()
);

create index idx_ponto_marcacoes_func_dia
  on public.ponto_marcacoes (funcionario_id, (registrado_em at time zone 'America/Sao_Paulo'));
create index idx_ponto_marcacoes_empresa
  on public.ponto_marcacoes (empresa_id, registrado_em);

comment on table public.ponto_marcacoes is
  'Append-only: nenhum update ou delete, nem por admin (PRD R5). Cada linha encadeia o hash da anterior da mesma empresa.';

create table public.ponto_tentativas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  funcionario_id uuid references public.staff_members(user_id),
  local_id uuid references public.ponto_locais(id),
  tipo public.ponto_marcacao_tipo,
  motivo public.ponto_motivo_recusa not null,
  detalhe text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_ponto_tentativas_rate
  on public.ponto_tentativas (funcionario_id, created_at desc);
create index idx_ponto_tentativas_ip
  on public.ponto_tentativas (ip, created_at desc);

create table public.ponto_config (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, chave)
);

-- ------------------------------------------------------------------ RLS

alter table public.ponto_locais enable row level security;
alter table public.ponto_estacoes enable row level security;
alter table public.ponto_redes enable row level security;
alter table public.ponto_dispositivos enable row level security;
alter table public.ponto_marcacoes enable row level security;
alter table public.ponto_tentativas enable row level security;
alter table public.ponto_config enable row level security;

-- Funcionário lê só as próprias marcações e o próprio dispositivo.
create policy "Funcionário lê as próprias marcações"
  on public.ponto_marcacoes for select to authenticated
  using (funcionario_id = auth.uid());

create policy "Gestor/admin lê marcações da empresa"
  on public.ponto_marcacoes for select to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );

create policy "Funcionário lê os próprios dispositivos"
  on public.ponto_dispositivos for select to authenticated
  using (funcionario_id = auth.uid());

create policy "Gestor/admin gerencia dispositivos"
  on public.ponto_dispositivos for all to authenticated
  using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

create policy "Gestor/admin lê locais"
  on public.ponto_locais for select to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Só admin gerencia locais"
  on public.ponto_locais for all to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

create policy "Gestor/admin lê estações"
  on public.ponto_estacoes for select to authenticated
  using (public.is_equipe_gestor_ou_admin());

create policy "Só admin gerencia estações"
  on public.ponto_estacoes for all to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

create policy "Gestor/admin lê redes"
  on public.ponto_redes for select to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Só admin gerencia redes"
  on public.ponto_redes for all to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

create policy "Gestor/admin lê tentativas"
  on public.ponto_tentativas for select to authenticated
  using (public.is_equipe_gestor_ou_admin());

create policy "Gestor/admin lê config do ponto"
  on public.ponto_config for select to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Só admin altera config do ponto"
  on public.ponto_config for all to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

-- Nenhuma policy de insert/update/delete em ponto_marcacoes nem em
-- ponto_tentativas: só as funções SECURITY DEFINER escrevem.

-- ------------------------------------------------- append-only (PRD R5/P11)

create or replace function public.ponto_trg_marcacoes_append_only()
returns trigger language plpgsql as $$
begin
  raise exception
    'ponto_marcacoes é append-only: marcação não pode ser alterada nem apagada, nem por admin. Correção vai por justificativa (Parte 2).';
end;
$$;

create trigger trg_ponto_marcacoes_append_only
  before update or delete on public.ponto_marcacoes
  for each row execute function public.ponto_trg_marcacoes_append_only();

-- Seed dos parâmetros do ponto em toda empresa (nova e existente).
create or replace function public.ponto_seed_config()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ponto_config (empresa_id, chave, valor) values
    (new.id, 'foto_estacao', to_jsonb(false)),
    (new.id, 'foto_qr', to_jsonb(false)),
    (new.id, 'pausas_cafe_ativas', to_jsonb(false)),
    (new.id, 'retencao_fotos_dias', to_jsonb(90)),
    (new.id, 'janela_abertura_coletiva_min', to_jsonb(10)),
    (new.id, 'ignorar_repetida_min', to_jsonb(2)),
    (new.id, 'rate_limit_por_funcionario_min', to_jsonb(10)),
    (new.id, 'rate_limit_por_ip_min', to_jsonb(30))
  on conflict (empresa_id, chave) do nothing;
  return new;
end;
$$;

create trigger trg_ponto_seed_config
  after insert on public.empresas
  for each row execute function public.ponto_seed_config();

insert into public.ponto_config (empresa_id, chave, valor)
select e.id, c.chave, c.valor
from public.empresas e
cross join (values
  ('foto_estacao', to_jsonb(false)),
  ('foto_qr', to_jsonb(false)),
  ('pausas_cafe_ativas', to_jsonb(false)),
  ('retencao_fotos_dias', to_jsonb(90)),
  ('janela_abertura_coletiva_min', to_jsonb(10)),
  ('ignorar_repetida_min', to_jsonb(2)),
  ('rate_limit_por_funcionario_min', to_jsonb(10)),
  ('rate_limit_por_ip_min', to_jsonb(30))
) as c(chave, valor)
on conflict (empresa_id, chave) do nothing;
