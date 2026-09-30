# Módulo Equipe — Parte 1 — Banco (Etapa 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir toda a camada de banco (schema, cálculo de atraso, ciência eletrônica, escalonamento, imutabilidade, RLS, proteção de PIN) do Módulo Equipe Parte 1, com os 26 critérios de aceite do PRD (`A1`-`A26`) passando via SQL antes de qualquer tela.

**Architecture:** Postgres/Supabase puro. Toda regra de negócio em função SQL (`SECURITY DEFINER` quando precisa rodar com privilégio elevado, `search_path = public` sempre). RLS em cada tabela nova. Nenhum `insert/update/delete` direto do cliente nas tabelas `equipe_*` além do que a RLS explicitamente libera (client só grava direto em `equipe_atrasos`/`equipe_aberturas`/`equipe_justificativas_atraso`/`equipe_medidas` via policy de gestor/admin; tudo que precisa de hash/evidência — ciência — só via função `SECURITY DEFINER`).

**Tech Stack:** Supabase Postgres 17, `pgcrypto` (já habilitada), `unaccent` (já habilitada), Edge Functions Deno (`supabase/functions/*`), projeto Supabase `ccrucholgsffichvzbpz`.

## Global Constraints

- Todo cálculo de atraso/escalonamento roda no banco — front só exibe (PRD R4).
- Nenhum `update`/`delete` direto do cliente nas tabelas `equipe_*`.
- RLS em todas as tabelas novas, sempre filtrando por empresa.
- PIN: nunca texto puro (já garantido pelo Supabase Auth — ver spec de design).
- Escalonamento nunca sugere suspensão — só `admin` aplica manualmente (PRD R6).
- Cada migration aplicada via `mcp__claude_ai_Supabase__apply_migration` (`project_id=ccrucholgsffichvzbpz`) **e** salva em `supabase/migrations/<timestamp>_<slug>.sql` no repo, idênticas — mantém o histórico local em sync com o remoto (convenção já usada neste projeto).
- Testes = scripts SQL rodados via `mcp__claude_ai_Supabase__execute_sql`, terminando com `DO $$ BEGIN IF NOT (<condição esperada>) THEN RAISE EXCEPTION 'FAIL: <mensagem>'; END IF; RAISE NOTICE 'PASS: <mensagem>'; END $$;` — não há suíte automatizada neste repo (confirmado na spec de papéis/permissões), então "rodar o teste" = executar o script e ler `PASS`/`FAIL` no retorno.
- Referência completa das regras: `.superpowers/prd-equipe-atrasos-advertencias.md`. Decisões de mapeamento: `docs/superpowers/specs/2026-09-30-equipe-atrasos-advertencias-design.md`.

---

## Task 1: `empresas`

**Files:**
- Create: `supabase/migrations/20260930100000_equipe_empresas.sql`

**Interfaces:**
- Produces: tabela `public.empresas(id uuid pk, razao_social text, cnpj text unique, ativo bool, created_at, updated_at)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 20260930100000_equipe_empresas.sql
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
```

- [ ] **Step 2: Aplicar via MCP**

Chamar `mcp__claude_ai_Supabase__apply_migration` com `project_id="ccrucholgsffichvzbpz"`, `name="equipe_empresas"`, `query=<conteúdo do arquivo>`.

- [ ] **Step 3: Testar**

```sql
insert into empresas (razao_social, cnpj) values ('Empresa Teste LTDA', '00000000000191') returning id;
-- guardar o id retornado como :empresa_teste_id para os próximos tasks
select cnpj from empresas where razao_social = 'Empresa Teste LTDA';
```

Esperado: 1 linha, `cnpj = '00000000000191'`. Se der erro de RLS rodando como usuário anônimo via `execute_sql` (que roda com privilégio do service role do MCP, não afetado por RLS) é esperado não bloquear — RLS só é testada de fato a partir do Task 16. Não apagar a linha de teste ainda: outros tasks vão referenciá-la.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260930100000_equipe_empresas.sql docs/superpowers/specs/2026-09-30-equipe-atrasos-advertencias-design.md docs/superpowers/plans/2026-09-30-equipe-atrasos-advertencias-banco.md
git commit -m "feat(equipe): tabela empresas"
```

---

## Task 2: `equipe_escalas`

**Files:**
- Create: `supabase/migrations/20260930100100_equipe_escalas.sql`

**Interfaces:**
- Consumes: `empresas.id` (Task 1).
- Produces: `public.equipe_escalas(id, empresa_id, nome, dias_semana int[], entrada time, saida time, tol_marcacao_min int, tol_dia_min int, ativo bool)`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100100_equipe_escalas.sql
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
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_escalas"`)

- [ ] **Step 3: Testar**

```sql
insert into equipe_escalas (empresa_id, nome, saida)
select id, 'Padrão 08h-17h', '17:00' from empresas where razao_social = 'Empresa Teste LTDA'
returning id, entrada, tol_marcacao_min, tol_dia_min;
```

Esperado: 1 linha, `entrada = 08:00:00`, `tol_marcacao_min = 5`, `tol_dia_min = 10`.

- [ ] **Step 4: Commit**

---

## Task 3: Colunas novas em `staff_members`

**Files:**
- Create: `supabase/migrations/20260930100200_staff_members_equipe_columns.sql`

**Interfaces:**
- Consumes: `empresas.id`, `equipe_escalas.id`.
- Produces: colunas `staff_members.{empresa_id, escala_id, almoco_previsto, duracao_almoco_min, termo_adesao_path, termo_assinado_em, tentativas_login, bloqueado_em}`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100200_staff_members_equipe_columns.sql
alter table public.staff_members
  add column empresa_id uuid references public.empresas(id),
  add column escala_id uuid references public.equipe_escalas(id),
  add column almoco_previsto time,
  add column duracao_almoco_min int not null default 120,
  add column termo_adesao_path text,
  add column termo_assinado_em date,
  add column tentativas_login int not null default 0,
  add column bloqueado_em timestamptz;

comment on column public.staff_members.termo_adesao_path is
  'Caminho no bucket privado equipe-docs. Visível só pra admin — ver equipe_funcionarios_gestor.';
comment on column public.staff_members.duracao_almoco_min is
  'Duração padrão do almoço em minutos, usada pelo cálculo de atraso do retorno (equipe_trg_calcular_atraso).';
```

- [ ] **Step 2: Aplicar via MCP** (`name="staff_members_equipe_columns"`)

- [ ] **Step 3: Testar**

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'staff_members' and column_name in
  ('empresa_id','escala_id','almoco_previsto','duracao_almoco_min',
   'termo_adesao_path','termo_assinado_em','tentativas_login','bloqueado_em')
order by column_name;
```

Esperado: 8 linhas, `duracao_almoco_min` com `column_default = '120'`, `tentativas_login` com `column_default = '0'`.

- [ ] **Step 4: Commit**

---

## Task 4: Papéis de equipe (`equipe_papeis`, `equipe_gestor_empresas`) + funções auxiliares

**Files:**
- Create: `supabase/migrations/20260930100300_equipe_papeis.sql`

**Interfaces:**
- Consumes: `staff_members.user_id`, `empresas.id`, `public.is_staff_admin()` (já existe).
- Produces: `public.equipe_papel` enum, `equipe_papeis`, `equipe_gestor_empresas`, funções `public.is_equipe_admin()`, `public.is_equipe_gestor_ou_admin()`, `public.equipe_empresas_visiveis() returns setof uuid`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100300_equipe_papeis.sql
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

-- Empresas que o usuário logado pode ver: todas se for admin de equipe,
-- só as vinculadas em equipe_gestor_empresas se for gestor, nenhuma senão.
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
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_papeis"`)

- [ ] **Step 3: Testar**

```sql
-- usa o admin real já existente (display_name = 'admin') como fixture
select public.is_equipe_admin() as deveria_ser_null_fora_de_sessao;
-- fora de uma sessão autenticada auth.uid() é null — is_staff_admin() também
-- retorna false nesse caso, então o resultado esperado aqui é `false`, não erro.

do $$
declare
  v_result boolean;
begin
  select coalesce((select is_admin from staff_members where display_name = 'admin'), false) into v_result;
  if not v_result then
    raise exception 'FAIL: staff admin existente não encontrado — fixture quebrada';
  end if;
  raise notice 'PASS: fixture do admin existe';
end $$;
```

Esperado: `PASS: fixture do admin existe`. (Teste de `is_equipe_admin()` de verdade, autenticado como um usuário específico, fica pro Task 16 — o MCP `execute_sql` roda com privilégio de service role, sem `auth.uid()` de sessão real.)

- [ ] **Step 4: Commit**

---

## Task 5: `equipe_aberturas` (regra da porta)

**Files:**
- Create: `supabase/migrations/20260930100400_equipe_aberturas.sql`

**Interfaces:**
- Consumes: `empresas.id`, `staff_members.user_id`, `equipe_empresas_visiveis()`.
- Produces: `public.equipe_aberturas(empresa_id, data, hora_abertura, motivo, registrado_por, created_at)`, pk `(empresa_id, data)`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100400_equipe_aberturas.sql
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
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_aberturas"`)

- [ ] **Step 3: Testar**

```sql
insert into equipe_aberturas (empresa_id, data, hora_abertura, registrado_por)
select e.id, date '2026-10-05', time '08:05',
       (select user_id from staff_members where display_name = 'admin')
from empresas e where e.razao_social = 'Empresa Teste LTDA'
returning empresa_id, data, hora_abertura;
```

Esperado: 1 linha, `hora_abertura = 08:05:00`.

- [ ] **Step 4: Commit**

---

## Task 6: `equipe_config`

**Files:**
- Create: `supabase/migrations/20260930100500_equipe_config.sql`

**Interfaces:**
- Consumes: `empresas.id`.
- Produces: `public.equipe_config(empresa_id, chave, valor jsonb)`, seed automático ao criar empresa.

- [ ] **Step 1: Migration**

```sql
-- 20260930100500_equipe_config.sql
create table public.equipe_config (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, chave)
);

alter table public.equipe_config enable row level security;

create policy "Gestor/admin lê config das empresas visíveis"
  on public.equipe_config for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Só admin altera config"
  on public.equipe_config for all
  to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

-- Seed automático dos parâmetros padrão do PRD (seção 11 + R5/R6) toda vez
-- que uma empresa nova é criada.
create or replace function public.equipe_seed_config()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.equipe_config (empresa_id, chave, valor) values
    (new.id, 'escalonamento', jsonb_build_object('verbal_a_partir_de', 3, 'escrita_a_partir_de', 4)),
    (new.id, 'prazo_justificativa_horas', to_jsonb(48)),
    (new.id, 'prazo_imediatidade_dias_uteis', to_jsonb(5)),
    (new.id, 'prazo_ciencia_horas', to_jsonb(48));
  return new;
end;
$$;

create trigger trg_equipe_seed_config
  after insert on public.empresas
  for each row execute function public.equipe_seed_config();
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_config"`)

- [ ] **Step 3: Testar**

```sql
select chave, valor from equipe_config
where empresa_id = (select id from empresas where razao_social = 'Empresa Teste LTDA')
order by chave;
```

Esperado: 4 linhas (`escalonamento`, `prazo_ciencia_horas`, `prazo_imediatidade_dias_uteis`, `prazo_justificativa_horas`) — a empresa de teste foi criada no Task 1, **antes** deste trigger existir, então rodar também:

```sql
-- backfill pra empresa de teste (trigger só pega inserts futuros)
insert into equipe_config (empresa_id, chave, valor)
select id, 'escalonamento', jsonb_build_object('verbal_a_partir_de', 3, 'escrita_a_partir_de', 4) from empresas where razao_social = 'Empresa Teste LTDA'
union all
select id, 'prazo_justificativa_horas', to_jsonb(48) from empresas where razao_social = 'Empresa Teste LTDA'
union all
select id, 'prazo_imediatidade_dias_uteis', to_jsonb(5) from empresas where razao_social = 'Empresa Teste LTDA'
union all
select id, 'prazo_ciencia_horas', to_jsonb(48) from empresas where razao_social = 'Empresa Teste LTDA'
on conflict do nothing;
```

- [ ] **Step 4: Commit**

---

## Task 7: `equipe_atrasos` (schema)

**Files:**
- Create: `supabase/migrations/20260930100600_equipe_atrasos.sql`

**Interfaces:**
- Consumes: `staff_members.user_id`, `empresas.id`.
- Produces: `public.equipe_marcacao`, `public.equipe_atraso_status` enums; `public.equipe_atrasos` (colunas do PRD + `variacao_bruta_min` e `duracao_almoco_override_min`, ver spec de design).

- [ ] **Step 1: Migration**

```sql
-- 20260930100600_equipe_atrasos.sql
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
  'Variação em minutos antes de aplicar a tolerância do dia (R2) — nunca muda depois de calculado, usado pra somar o dia. Não existe no PRD literal; necessário pro recálculo retroativo.';
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
```

Sem policy de `update`/`delete` pro client — Global Constraint (nada de update/delete direto); mudança de status roda via as funções dos Tasks 10-12, que são `SECURITY DEFINER` e não passam pela RLS de linha (mas ainda respeitam a lógica que elas mesmas implementam).

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_atrasos"`)

- [ ] **Step 3: Testar**

```sql
select column_name from information_schema.columns where table_name = 'equipe_atrasos' order by ordinal_position;
```

Esperado: lista incluindo `variacao_bruta_min` e `duracao_almoco_override_min`.

- [ ] **Step 4: Commit**

---

## Task 8: Cálculo de atraso (`equipe_trg_calcular_atraso` + `equipe_recalcular_tolerancia_dia`) — R1, R1.1, R2, R3, R4

**Files:**
- Create: `supabase/migrations/20260930100700_equipe_calcular_atraso.sql`

**Interfaces:**
- Consumes: `equipe_atrasos`, `staff_members.{escala_id, duracao_almoco_min, almoco_previsto}`, `equipe_escalas.{entrada, tol_marcacao_min, tol_dia_min}`, `equipe_aberturas.hora_abertura`.
- Produces: trigger `trg_equipe_calcular_atraso` (`before insert`), trigger `trg_equipe_recalcular_tolerancia_dia` (`after insert`), função standalone `public.equipe_recalcular_tolerancia_dia(uuid, date)`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100700_equipe_calcular_atraso.sql
create or replace function public.equipe_trg_calcular_atraso()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_escala_entrada time;
  v_duracao_almoco int;
  v_almoco_previsto time;
  v_abertura time;
  v_referencia time;
  v_efetiva time;
begin
  select ee.entrada, sm.duracao_almoco_min, sm.almoco_previsto
    into v_escala_entrada, v_duracao_almoco, v_almoco_previsto
  from staff_members sm
  join equipe_escalas ee on ee.id = sm.escala_id
  where sm.user_id = new.colaborador_id;

  if v_escala_entrada is null then
    raise exception 'Colaborador % não tem escala configurada (staff_members.escala_id)', new.colaborador_id;
  end if;

  if new.duracao_almoco_override_min is not null then
    v_duracao_almoco := new.duracao_almoco_override_min;
  end if;

  if new.marcacao = 'entrada' then
    select hora_abertura into v_abertura
    from equipe_aberturas
    where empresa_id = new.empresa_id and data = new.data;

    if v_abertura is null or v_abertura <= v_escala_entrada then
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada;
    elsif new.estava_na_porta and new.hora_chegada_porta is not null then
      -- Brecha fechada (R3): compara a hora da porta contra a escala, não contra a abertura.
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada_porta;
    elsif new.estava_na_porta then
      v_referencia := v_abertura;
      v_efetiva := new.hora_chegada;
    else
      v_referencia := v_escala_entrada;
      v_efetiva := new.hora_chegada;
    end if;

    new.horario_previsto := v_escala_entrada;
  else
    -- retorno_almoco (R1.1): referência = saída real + duração, nunca o horário fixo.
    v_referencia := new.saida_almoco_real + make_interval(mins => v_duracao_almoco);
    v_efetiva := new.hora_chegada;
    new.horario_previsto := v_referencia;

    if v_almoco_previsto is not null then
      new.desvio_saida_almoco_min :=
        round(extract(epoch from (new.saida_almoco_real - v_almoco_previsto)) / 60)::int;
    end if;
  end if;

  new.horario_referencia := v_referencia;
  new.variacao_bruta_min := greatest(0, round(extract(epoch from (v_efetiva - v_referencia)) / 60)::int);
  -- Valor provisório — o trigger AFTER INSERT confere a soma do dia e pode
  -- reclassificar (inclusive as linhas irmãs já inseridas hoje).
  new.minutos_atraso := new.variacao_bruta_min;
  new.dentro_tolerancia := false;

  return new;
end;
$$;

create trigger trg_equipe_calcular_atraso
  before insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_calcular_atraso();

-- Re-soma as variações brutas do dia e reclassifica minutos_atraso/dentro_tolerancia.
-- Congela linhas que já têm ciência dada ou estão fora de pendente_ciencia —
-- mudar o número depois de uma ciência assinada invalidaria o hash (ver design spec).
create or replace function public.equipe_recalcular_tolerancia_dia(p_colaborador_id uuid, p_data date)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tol_marcacao int;
  v_tol_dia int;
  v_soma int;
begin
  select ee.tol_marcacao_min, ee.tol_dia_min into v_tol_marcacao, v_tol_dia
  from staff_members sm
  join equipe_escalas ee on ee.id = sm.escala_id
  where sm.user_id = p_colaborador_id;

  select coalesce(sum(variacao_bruta_min), 0) into v_soma
  from equipe_atrasos
  where colaborador_id = p_colaborador_id and data = p_data and status <> 'substituido';

  update equipe_atrasos
  set minutos_atraso = case
        when variacao_bruta_min <= v_tol_marcacao and v_soma <= v_tol_dia then 0
        else variacao_bruta_min
      end,
      dentro_tolerancia = (variacao_bruta_min <= v_tol_marcacao and v_soma <= v_tol_dia),
      updated_at = now()
  where colaborador_id = p_colaborador_id
    and data = p_data
    and status = 'pendente_ciencia';
end;
$$;

create or replace function public.equipe_trg_recalcular_tolerancia_dia()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.equipe_recalcular_tolerancia_dia(new.colaborador_id, new.data);
  return null;
end;
$$;

create trigger trg_equipe_recalcular_tolerancia_dia
  after insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_recalcular_tolerancia_dia();
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_calcular_atraso"`)

- [ ] **Step 3: Testar — fixture de colaborador**

```sql
-- Fixture: um colaborador de teste vinculado à empresa/escala de teste.
-- (staff_members.user_id referencia auth.users — reaproveita o admin real
-- já existente só pra ter uma fk válida; os testes de RLS por pessoa ficam
-- pro Task 16, que cria usuários de verdade via auth.admin.)
update staff_members
set empresa_id = (select id from empresas where razao_social = 'Empresa Teste LTDA'),
    escala_id = (select id from equipe_escalas where nome = 'Padrão 08h-17h'),
    almoco_previsto = '12:00',
    duracao_almoco_min = 120
where display_name = 'admin';
```

- [ ] **Step 4: Testar A1-A3 (tolerância simples)**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_empresa uuid := (select id from empresas where razao_social = 'Empresa Teste LTDA');
  v_id uuid;
  v_minutos int;
  v_tol boolean;
begin
  -- A1: chegada 08:04 -> atraso 0, dentro da tolerância
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-01', 'entrada', time '08:04', v_colab)
  returning id into v_id;
  select minutos_atraso, dentro_tolerancia into v_minutos, v_tol from equipe_atrasos where id = v_id;
  if v_minutos <> 0 or v_tol <> true then
    raise exception 'FAIL A1: esperado 0/true, veio %/%', v_minutos, v_tol;
  end if;
  raise notice 'PASS A1';

  -- A2: chegada 08:45 -> atraso 45
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-02', 'entrada', time '08:45', v_colab)
  returning id into v_id;
  select minutos_atraso into v_minutos from equipe_atrasos where id = v_id;
  if v_minutos <> 45 then
    raise exception 'FAIL A2: esperado 45, veio %', v_minutos;
  end if;
  raise notice 'PASS A2';

  -- A3: chegada 08:06 -> atraso 6 (integral, não só o excedente)
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-03', 'entrada', time '08:06', v_colab)
  returning id into v_id;
  select minutos_atraso into v_minutos from equipe_atrasos where id = v_id;
  if v_minutos <> 6 then
    raise exception 'FAIL A3: esperado 6, veio %', v_minutos;
  end if;
  raise notice 'PASS A3';
end $$;
```

- [ ] **Step 5: Testar A4, A5, A13 (regra da porta)**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_empresa uuid := (select id from empresas where razao_social = 'Empresa Teste LTDA');
  v_id uuid;
  v_ref time;
  v_min int;
begin
  -- A4: abertura 08:05, estava na porta (sem hora_chegada_porta) -> referência 08:05, atraso 0
  insert into equipe_aberturas (empresa_id, data, hora_abertura, registrado_por)
  values (v_empresa, date '2026-10-04', time '08:05', v_colab);
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, estava_na_porta, criado_por)
  values (v_colab, v_empresa, date '2026-10-04', 'entrada', time '08:05', true, v_colab)
  returning id into v_id;
  select horario_referencia, minutos_atraso into v_ref, v_min from equipe_atrasos where id = v_id;
  if v_ref <> time '08:05' or v_min <> 0 then
    raise exception 'FAIL A4: esperado 08:05/0, veio %/%', v_ref, v_min;
  end if;
  raise notice 'PASS A4';

  -- A5: abertura 08:05, chegou 08:12 depois da abertura -> referência 08:00, atraso 12
  insert into equipe_aberturas (empresa_id, data, hora_abertura, registrado_por)
  values (v_empresa, date '2026-10-05', time '08:05', v_colab);
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, estava_na_porta, criado_por)
  values (v_colab, v_empresa, date '2026-10-05', 'entrada', time '08:12', false, v_colab)
  returning id into v_id;
  select horario_referencia, minutos_atraso into v_ref, v_min from equipe_atrasos where id = v_id;
  if v_ref <> time '08:00' or v_min <> 12 then
    raise exception 'FAIL A5: esperado 08:00/12, veio %/%', v_ref, v_min;
  end if;
  raise notice 'PASS A5';

  -- A13: abertura 08:30, estava na porta desde 08:20 -> atraso 20
  insert into equipe_aberturas (empresa_id, data, hora_abertura, registrado_por)
  values (v_empresa, date '2026-10-06', time '08:30', v_colab);
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, estava_na_porta, hora_chegada_porta, criado_por)
  values (v_colab, v_empresa, date '2026-10-06', 'entrada', time '08:30', true, time '08:20', v_colab)
  returning id into v_id;
  select horario_referencia, minutos_atraso into v_ref, v_min from equipe_atrasos where id = v_id;
  if v_ref <> time '08:00' or v_min <> 20 then
    raise exception 'FAIL A13: esperado 08:00/20, veio %/%', v_ref, v_min;
  end if;
  raise notice 'PASS A13';
end $$;
```

- [ ] **Step 6: Testar A6 (soma do dia estoura tolerância, retroativo)**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_empresa uuid := (select id from empresas where razao_social = 'Empresa Teste LTDA');
  v_id1 uuid; v_id2 uuid; v_id3 uuid;
  v_min1 int; v_min2 int; v_min3 int;
begin
  -- Entrada 08:04 (4 min) + retorno almoço 4 min + terceira variação 3 min = soma 11 > 10.
  -- "Terceira variação" modelada como uma segunda entrada corrigida no mesmo dia
  -- (não existe um terceiro tipo de marcação no PRD; o que se testa aqui é só a
  -- aritmética da soma/retroatividade, não a semântica de marcação).
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-07', 'entrada', time '08:04', v_colab)
  returning id into v_id1;
  select minutos_atraso into v_min1 from equipe_atrasos where id = v_id1;
  if v_min1 <> 0 then raise exception 'FAIL A6 (etapa 1): esperado 0, veio %', v_min1; end if;

  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-07', 'retorno_almoco', time '12:00', time '14:04', v_colab)
  returning id into v_id2;
  select minutos_atraso into v_min2 from equipe_atrasos where id = v_id2;
  if v_min2 <> 0 then raise exception 'FAIL A6 (etapa 2): esperado 0 (soma 8<=10), veio %', v_min2; end if;

  -- terceira variação: 3 min (saída 16:00 + 120min = referência 18:00, chegou 18:03)
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-07', 'retorno_almoco', time '16:00', time '18:03', v_colab)
  returning id into v_id3;

  select minutos_atraso into v_min1 from equipe_atrasos where id = v_id1;
  select minutos_atraso into v_min2 from equipe_atrasos where id = v_id2;
  select minutos_atraso into v_min3 from equipe_atrasos where id = v_id3;

  if v_min1 <> 4 or v_min2 <> 4 or v_min3 <> 3 then
    raise exception 'FAIL A6: esperado 4/4/3 (retroativo), veio %/%/%', v_min1, v_min2, v_min3;
  end if;
  raise notice 'PASS A6 (retroatividade: soma 11 > 10, todas contam integral)';
end $$;
```

- [ ] **Step 7: Testar A23-A26 (almoço)**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_empresa uuid := (select id from empresas where razao_social = 'Empresa Teste LTDA');
  v_id uuid;
  v_min int; v_desvio int; v_tol boolean;
begin
  -- A23: almoço previsto 12:00, saiu 12:05, voltou 14:05 -> sem atraso, desvio +5 na saída
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-08', 'retorno_almoco', time '12:05', time '14:05', v_colab)
  returning id into v_id;
  select minutos_atraso, desvio_saida_almoco_min into v_min, v_desvio from equipe_atrasos where id = v_id;
  if v_min <> 0 or v_desvio <> 5 then
    raise exception 'FAIL A23: esperado 0/+5, veio %/%', v_min, v_desvio;
  end if;
  raise notice 'PASS A23';

  -- A24: saiu 12:05, voltou 14:12 -> atraso 7 (passou de 5, integral)
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-09', 'retorno_almoco', time '12:05', time '14:12', v_colab)
  returning id into v_id;
  select minutos_atraso into v_min from equipe_atrasos where id = v_id;
  if v_min <> 7 then raise exception 'FAIL A24: esperado 7, veio %', v_min; end if;
  raise notice 'PASS A24';

  -- A25: saiu 12:00, voltou 14:04 -> dentro da tolerância
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-10', 'retorno_almoco', time '12:00', time '14:04', v_colab)
  returning id into v_id;
  select minutos_atraso, dentro_tolerancia into v_min, v_tol from equipe_atrasos where id = v_id;
  if v_min <> 0 or v_tol <> true then raise exception 'FAIL A25: esperado 0/true, veio %/%', v_min, v_tol; end if;
  raise notice 'PASS A25';

  -- A26: intervalo reduzido 40 min (override), saiu 12:00, voltou 12:48 -> atraso 8
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, saida_almoco_real, duracao_almoco_override_min, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-10-11', 'retorno_almoco', time '12:00', 40, time '12:48', v_colab)
  returning id into v_id;
  select minutos_atraso into v_min from equipe_atrasos where id = v_id;
  if v_min <> 8 then raise exception 'FAIL A26: esperado 8, veio %', v_min; end if;
  raise notice 'PASS A26';
end $$;
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260930100700_equipe_calcular_atraso.sql
git commit -m "feat(equipe): calculo de atraso (R1, R1.1, R2, R3) com recalculo retroativo do dia"
```

---

## Task 9: `equipe_audit_log`

**Files:**
- Create: `supabase/migrations/20260930100800_equipe_audit_log.sql`

**Interfaces:**
- Produces: `public.equipe_audit_log`, função genérica `public.equipe_trg_audit()`, anexada em `equipe_atrasos`, `equipe_aberturas`, `equipe_config` (as demais tabelas `equipe_*` criadas depois recebem o trigger no próprio migration que as cria).

- [ ] **Step 1: Migration**

```sql
-- 20260930100800_equipe_audit_log.sql
create table public.equipe_audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id text not null,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.equipe_audit_log enable row level security;

create policy "Só admin lê audit log"
  on public.equipe_audit_log for select
  to authenticated
  using (public.is_equipe_admin());
-- Sem policy de insert/update/delete pro client — só a função abaixo escreve,
-- rodando SECURITY DEFINER.

create or replace function public.equipe_trg_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_id text;
begin
  v_id := coalesce(
    (case when TG_OP = 'DELETE' then old.id else new.id end)::text,
    'sem_pk'
  );
  insert into public.equipe_audit_log (tabela, registro_id, acao, dados_antes, dados_depois, user_id)
  values (
    TG_TABLE_NAME,
    v_id,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_equipe_atrasos
  after insert or update or delete on public.equipe_atrasos
  for each row execute function public.equipe_trg_audit();

create trigger trg_audit_equipe_aberturas
  after insert or update or delete on public.equipe_aberturas
  for each row execute function public.equipe_trg_audit();

create trigger trg_audit_equipe_config
  after insert or update or delete on public.equipe_config
  for each row execute function public.equipe_trg_audit();
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_audit_log"`)

- [ ] **Step 3: Testar**

```sql
select tabela, acao, count(*) from equipe_audit_log
where tabela in ('equipe_atrasos', 'equipe_aberturas')
group by tabela, acao
order by tabela, acao;
```

Esperado: linhas `acao='INSERT'` para `equipe_atrasos` e `equipe_aberturas` — os inserts de teste do Task 8 já devem ter gerado audit log (o trigger foi criado depois, então só os *próximos* inserts aparecem; rodar mais um insert de teste se a contagem vier zero, confirmando que o trigger captura o evento).

- [ ] **Step 4: Commit**

---

## Task 10: `equipe_ciencias` + `equipe_registrar_ciencia` (A10, A11)

**Files:**
- Create: `supabase/migrations/20260930100900_equipe_ciencias.sql`

**Interfaces:**
- Consumes: `equipe_atrasos`, `staff_members.termo_assinado_em`.
- Produces: enum `equipe_ciencia_alvo`, `equipe_ciencia_acao`; tabela `equipe_ciencias`; função `public.equipe_registrar_ciencia(p_alvo_tipo equipe_ciencia_alvo, p_alvo_id uuid, p_acao equipe_ciencia_acao, p_justificativa text default null, p_testemunha_1 text default null, p_testemunha_2 text default null) returns uuid`.

- [ ] **Step 1: Migration**

```sql
-- 20260930100900_equipe_ciencias.sql
create type public.equipe_ciencia_alvo as enum ('atraso', 'medida', 'fechamento');
create type public.equipe_ciencia_acao as enum ('ciente', 'recusa');

create table public.equipe_ciencias (
  id uuid primary key default gen_random_uuid(),
  alvo_tipo public.equipe_ciencia_alvo not null,
  alvo_id uuid not null,
  colaborador_id uuid not null references public.staff_members(user_id),
  acao public.equipe_ciencia_acao not null,
  justificativa text,
  assinatura_path text,
  ip inet,
  user_agent text,
  payload_hash text not null,
  testemunha_1 text,
  testemunha_2 text,
  signed_at timestamptz not null default now()
);

alter table public.equipe_ciencias enable row level security;

create policy "Colaborador lê as próprias ciências"
  on public.equipe_ciencias for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê ciências das empresas visíveis"
  on public.equipe_ciencias for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and exists (
      select 1 from equipe_atrasos a
      where a.id = equipe_ciencias.alvo_id
        and equipe_ciencias.alvo_tipo = 'atraso'
        and a.empresa_id in (select equipe_empresas_visiveis())
    )
  );
-- Sem policy de insert direto — só via equipe_registrar_ciencia (SECURITY DEFINER).

-- A11: colaborador sem termo de adesão não entra no fluxo eletrônico.
create or replace function public.equipe_registrar_ciencia(
  p_alvo_tipo public.equipe_ciencia_alvo,
  p_alvo_id uuid,
  p_acao public.equipe_ciencia_acao,
  p_justificativa text default null,
  p_testemunha_1 text default null,
  p_testemunha_2 text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_colaborador uuid := auth.uid();
  v_termo_assinado date;
  v_payload jsonb;
  v_hash text;
  v_ip inet;
  v_ua text;
  v_id uuid;
begin
  select termo_assinado_em into v_termo_assinado from staff_members where user_id = v_colaborador;

  if v_termo_assinado is null and p_acao = 'ciente' then
    raise exception 'Colaborador sem termo de adesão assinado — use o fluxo de papel.';
  end if;

  if p_acao = 'recusa' and (p_testemunha_1 is null or p_testemunha_2 is null) then
    raise exception 'Recusa exige duas testemunhas.';
  end if;

  if p_alvo_tipo = 'atraso' then
    if not exists (select 1 from equipe_atrasos where id = p_alvo_id and colaborador_id = v_colaborador) then
      raise exception 'Atraso % não pertence ao colaborador logado.', p_alvo_id;
    end if;
  end if;

  begin
    v_ip := (current_setting('request.headers', true)::json ->> 'x-forwarded-for')::inet;
  exception when others then
    v_ip := null;
  end;
  v_ua := current_setting('request.headers', true)::json ->> 'user-agent';

  select to_jsonb(a) into v_payload from equipe_atrasos a where a.id = p_alvo_id and p_alvo_tipo = 'atraso';
  v_hash := encode(digest(coalesce(v_payload, '{}'::jsonb)::text || now()::text, 'sha256'), 'hex');

  insert into equipe_ciencias (
    alvo_tipo, alvo_id, colaborador_id, acao, justificativa,
    ip, user_agent, payload_hash, testemunha_1, testemunha_2
  ) values (
    p_alvo_tipo, p_alvo_id, v_colaborador, p_acao, p_justificativa,
    v_ip, v_ua, v_hash, p_testemunha_1, p_testemunha_2
  ) returning id into v_id;

  if p_alvo_tipo = 'atraso' then
    update equipe_atrasos
    set status = case when p_acao = 'ciente' then 'ciente'::equipe_atraso_status else 'sem_ciencia'::equipe_atraso_status end,
        updated_at = now()
    where id = p_alvo_id;
  end if;

  return v_id;
end;
$$;
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_ciencias"`)

- [ ] **Step 3: Testar A11 (sem termo → bloqueado)**

```sql
do $$
declare
  v_id uuid;
  v_ok boolean := false;
begin
  -- staff_members.termo_assinado_em está null pro admin de teste (nunca foi setado)
  begin
    perform public.equipe_registrar_ciencia('atraso'::equipe_ciencia_alvo,
      (select id from equipe_atrasos where data = date '2026-10-01'), 'ciente'::equipe_ciencia_acao);
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FAIL A11: deveria ter bloqueado ciência sem termo de adesão';
  end if;
  raise notice 'PASS A11';
end $$;
```

- [ ] **Step 4: Testar A10 (ciência grava hash/timestamp — com termo assinado)**

```sql
do $$
declare
  v_atraso_id uuid := (select id from equipe_atrasos where data = date '2026-10-01');
  v_ciencia_id uuid;
  v_hash text;
  v_status equipe_atraso_status;
begin
  update staff_members set termo_assinado_em = current_date where display_name = 'admin';

  v_ciencia_id := public.equipe_registrar_ciencia('atraso'::equipe_ciencia_alvo, v_atraso_id, 'ciente'::equipe_ciencia_acao);

  select payload_hash into v_hash from equipe_ciencias where id = v_ciencia_id;
  select status into v_status from equipe_atrasos where id = v_atraso_id;

  if v_hash is null or length(v_hash) <> 64 then
    raise exception 'FAIL A10: hash SHA-256 ausente ou tamanho errado (%)', v_hash;
  end if;
  if v_status <> 'ciente' then
    raise exception 'FAIL A10: status esperado ciente, veio %', v_status;
  end if;
  raise notice 'PASS A10';
end $$;
```

- [ ] **Step 5: Commit**

---

## Task 11: `equipe_justificativas_atraso` — R5

**Files:**
- Create: `supabase/migrations/20260930101000_equipe_justificativas_atraso.sql`

**Interfaces:**
- Consumes: `equipe_atrasos`.
- Produces: tabela `equipe_justificativas_atraso`; função `public.equipe_decidir_justificativa(p_justificativa_id uuid, p_decisao text, p_motivo text default null) returns void` (abonar → `equipe_atrasos.status = 'abonado'`; rejeitar → mantém `justificativa_pendente` → volta pro status anterior, aqui simplificado pra `pendente_ciencia` se ainda não tinha ciência, ou mantém o que já tinha).

- [ ] **Step 1: Migration**

```sql
-- 20260930101000_equipe_justificativas_atraso.sql
create type public.equipe_justificativa_decisao as enum ('pendente', 'abonado', 'rejeitado');

create table public.equipe_justificativas_atraso (
  id uuid primary key default gen_random_uuid(),
  atraso_id uuid not null references public.equipe_atrasos(id),
  texto text not null,
  anexo_path text,
  decisao public.equipe_justificativa_decisao not null default 'pendente',
  decidido_por uuid references public.staff_members(user_id),
  decidido_em timestamptz,
  motivo_decisao text,
  created_at timestamptz not null default now()
);

alter table public.equipe_justificativas_atraso enable row level security;

create trigger trg_audit_equipe_justificativas_atraso
  after insert or update or delete on public.equipe_justificativas_atraso
  for each row execute function public.equipe_trg_audit();

create policy "Colaborador lê/cria justificativa dos próprios atrasos"
  on public.equipe_justificativas_atraso for select
  to authenticated
  using (
    exists (select 1 from equipe_atrasos a where a.id = atraso_id and a.colaborador_id = auth.uid())
    or (
      public.is_equipe_gestor_ou_admin()
      and exists (
        select 1 from equipe_atrasos a
        where a.id = atraso_id and a.empresa_id in (select equipe_empresas_visiveis())
      )
    )
  );

create policy "Colaborador cria justificativa do próprio atraso"
  on public.equipe_justificativas_atraso for insert
  to authenticated
  with check (
    exists (select 1 from equipe_atrasos a where a.id = atraso_id and a.colaborador_id = auth.uid())
  );

create or replace function public.equipe_decidir_justificativa(
  p_justificativa_id uuid,
  p_decisao public.equipe_justificativa_decisao,
  p_motivo text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_atraso_id uuid;
  v_empresa_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin decide justificativa.';
  end if;
  if p_decisao = 'pendente' then
    raise exception 'Decisão precisa ser abonado ou rejeitado.';
  end if;

  select atraso_id into v_atraso_id from equipe_justificativas_atraso where id = p_justificativa_id;
  select empresa_id into v_empresa_id from equipe_atrasos where id = v_atraso_id;

  if v_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update equipe_justificativas_atraso
  set decisao = p_decisao, decidido_por = auth.uid(), decidido_em = now(), motivo_decisao = p_motivo
  where id = p_justificativa_id;

  if p_decisao = 'abonado' then
    update equipe_atrasos set status = 'abonado', updated_at = now() where id = v_atraso_id;
  else
    update equipe_atrasos set status = 'pendente_ciencia', updated_at = now()
    where id = v_atraso_id and status = 'justificativa_pendente';
  end if;
end;
$$;
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_justificativas_atraso"`)

- [ ] **Step 3: Testar (R5 — abonar tira do desconto)**

```sql
do $$
declare
  v_atraso_id uuid := (select id from equipe_atrasos where data = date '2026-10-02'); -- A2, 45 min
  v_just_id uuid;
  v_status equipe_atraso_status;
begin
  update equipe_atrasos set status = 'justificativa_pendente' where id = v_atraso_id;
  insert into equipe_justificativas_atraso (atraso_id, texto)
  values (v_atraso_id, 'Atendimento médico de urgência, sem aviso prévio.')
  returning id into v_just_id;

  perform public.equipe_decidir_justificativa(v_just_id, 'abonado'::equipe_justificativa_decisao, 'Atestado anexado.');

  select status into v_status from equipe_atrasos where id = v_atraso_id;
  if v_status <> 'abonado' then
    raise exception 'FAIL R5: esperado abonado, veio %', v_status;
  end if;
  raise notice 'PASS R5 (abonar)';
end $$;
```

- [ ] **Step 4: Commit**

---

## Task 12: `equipe_medidas` + `equipe_medida_atrasos` — escalonamento R6 (A7, A14-A17, A20)

**Files:**
- Create: `supabase/migrations/20260930101100_equipe_medidas.sql`

**Interfaces:**
- Consumes: `equipe_atrasos`, `equipe_config` (chave `escalonamento`).
- Produces: enums `equipe_medida_tipo`, `equipe_medida_status`; tabelas `equipe_medidas`, `equipe_medida_atrasos` (unique em `atraso_id` — non bis in idem); funções `public.equipe_contar_atrasos_mes(p_colaborador_id uuid, p_referencia date) returns int` e `public.equipe_sugerir_medida(p_colaborador_id uuid, p_referencia date) returns equipe_medida_tipo`.

- [ ] **Step 1: Migration**

```sql
-- 20260930101100_equipe_medidas.sql
create type public.equipe_medida_tipo as enum (
  'orientacao_verbal', 'orientacao_verbal_coletiva', 'advertencia_escrita', 'suspensao'
);
create type public.equipe_medida_status as enum (
  'rascunho', 'aguardando_assinatura', 'aplicada', 'recusada'
);

create table public.equipe_medidas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.staff_members(user_id),
  tipo public.equipe_medida_tipo not null,
  dias_suspensao int,
  data_aplicacao date not null default current_date,
  fundamento text not null,
  pdf_path text,
  assinado_path text,
  status public.equipe_medida_status not null default 'rascunho',
  criado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  constraint suspensao_precisa_dias check (tipo <> 'suspensao' or dias_suspensao is not null)
);

create table public.equipe_medida_atrasos (
  medida_id uuid not null references public.equipe_medidas(id) on delete cascade,
  atraso_id uuid not null references public.equipe_atrasos(id) unique,
  primary key (medida_id, atraso_id)
);

alter table public.equipe_medidas enable row level security;
alter table public.equipe_medida_atrasos enable row level security;

create trigger trg_audit_equipe_medidas
  after insert or update or delete on public.equipe_medidas
  for each row execute function public.equipe_trg_audit();

create policy "Colaborador lê as próprias medidas"
  on public.equipe_medidas for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê medidas das empresas visíveis"
  on public.equipe_medidas for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and exists (
      select 1 from staff_members sm
      where sm.user_id = equipe_medidas.colaborador_id
        and sm.empresa_id in (select equipe_empresas_visiveis())
    )
  );

-- Suspensão só admin (A17) — enforçado na própria policy de insert, não só no front.
create policy "Gestor cria medida (exceto suspensão), admin cria qualquer uma"
  on public.equipe_medidas for insert
  to authenticated
  with check (
    exists (
      select 1 from staff_members sm
      where sm.user_id = colaborador_id and sm.empresa_id in (select equipe_empresas_visiveis())
    )
    and (
      public.is_equipe_admin()
      or (public.is_equipe_gestor_ou_admin() and tipo <> 'suspensao')
    )
  );

create policy "Gestor/admin lê vínculos medida-atraso"
  on public.equipe_medida_atrasos for select
  to authenticated
  using (public.is_equipe_gestor_ou_admin());

create policy "Gestor/admin vincula atraso a medida"
  on public.equipe_medida_atrasos for insert
  to authenticated
  with check (public.is_equipe_gestor_ou_admin());

-- Conta atrasos fora da tolerância e não abonados/substituídos no mês
-- calendário de p_referencia (A20: contador zera na virada do mês porque
-- o filtro é sempre pela data, nunca um contador armazenado).
create or replace function public.equipe_contar_atrasos_mes(p_colaborador_id uuid, p_referencia date)
returns int
language sql security definer stable
set search_path = public
as $$
  select count(*)::int
  from equipe_atrasos a
  where a.colaborador_id = p_colaborador_id
    and date_trunc('month', a.data) = date_trunc('month', p_referencia)
    and a.dentro_tolerancia = false
    and a.status not in ('abonado', 'substituido')
    and not exists (select 1 from equipe_medida_atrasos ma where ma.atraso_id = a.id)
$$;

-- R6: 1º/2º = só registro; 3º = verbal; 4º em diante = escrita. Nunca suspensão.
create or replace function public.equipe_sugerir_medida(p_colaborador_id uuid, p_referencia date)
returns public.equipe_medida_tipo
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_verbal_a_partir_de int;
  v_escrita_a_partir_de int;
  v_count int;
begin
  select empresa_id into v_empresa_id from staff_members where user_id = p_colaborador_id;
  select (valor ->> 'verbal_a_partir_de')::int, (valor ->> 'escrita_a_partir_de')::int
    into v_verbal_a_partir_de, v_escrita_a_partir_de
  from equipe_config where empresa_id = v_empresa_id and chave = 'escalonamento';

  v_count := public.equipe_contar_atrasos_mes(p_colaborador_id, p_referencia);

  if v_count >= v_escrita_a_partir_de then
    return 'advertencia_escrita'::equipe_medida_tipo;
  elsif v_count >= v_verbal_a_partir_de then
    return 'orientacao_verbal'::equipe_medida_tipo;
  else
    return null;
  end if;
end;
$$;
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_medidas"`)

- [ ] **Step 3: Testar A14-A17, A20**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_empresa uuid := (select id from empresas where razao_social = 'Empresa Teste LTDA');
  v_sugestao equipe_medida_tipo;
  v_count int;
begin
  -- Zera o mês de novembro/2026 pra esse teste não herdar atrasos de outubro.
  -- A14: força o 3º atraso não-tolerado do mês.
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values
    (v_colab, v_empresa, date '2026-11-02', 'entrada', time '08:20', v_colab),
    (v_colab, v_empresa, date '2026-11-03', 'entrada', time '08:20', v_colab),
    (v_colab, v_empresa, date '2026-11-04', 'entrada', time '08:20', v_colab);

  v_count := public.equipe_contar_atrasos_mes(v_colab, date '2026-11-04');
  if v_count <> 3 then raise exception 'FAIL A14 (contagem): esperado 3, veio %', v_count; end if;

  v_sugestao := public.equipe_sugerir_medida(v_colab, date '2026-11-04');
  if v_sugestao <> 'orientacao_verbal' then
    raise exception 'FAIL A14: esperado orientacao_verbal, veio %', v_sugestao;
  end if;
  raise notice 'PASS A14';

  -- A15: 4º atraso -> escrita
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  values (v_colab, v_empresa, date '2026-11-05', 'entrada', time '08:20', v_colab);
  v_sugestao := public.equipe_sugerir_medida(v_colab, date '2026-11-05');
  if v_sugestao <> 'advertencia_escrita' then
    raise exception 'FAIL A15: esperado advertencia_escrita, veio %', v_sugestao;
  end if;
  raise notice 'PASS A15';

  -- A16: 10º atraso -> continua escrita, nunca suspensão
  insert into equipe_atrasos (colaborador_id, empresa_id, data, marcacao, hora_chegada, criado_por)
  select v_colab, v_empresa, date '2026-11-06' + (n || ' days')::interval, 'entrada', time '08:20', v_colab
  from generate_series(0, 5) as n;
  v_sugestao := public.equipe_sugerir_medida(v_colab, date '2026-11-12');
  if v_sugestao <> 'advertencia_escrita' then
    raise exception 'FAIL A16: esperado advertencia_escrita (nunca suspensão), veio %', v_sugestao;
  end if;
  raise notice 'PASS A16';

  -- A20: mês seguinte (dezembro) sem atrasos -> contador volta a zero
  v_count := public.equipe_contar_atrasos_mes(v_colab, date '2026-12-01');
  if v_count <> 0 then raise exception 'FAIL A20: esperado 0 em dezembro, veio %', v_count; end if;
  raise notice 'PASS A20';
end $$;

-- A17: gestor (não-admin) tenta suspensão -> bloqueado pela própria policy de insert.
-- Testado de verdade com sessão de gestor no Task 16 (aqui o service role do MCP
-- ignora RLS, então o teste efetivo do "opção não existe pro papel" fica lá).

-- A7: atraso já vinculado a medida não aparece pra nova medida (non bis in idem).
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_atraso_id uuid := (select id from equipe_atrasos where data = date '2026-11-02');
  v_medida_id uuid;
  v_count_antes int;
  v_count_depois int;
begin
  select public.equipe_contar_atrasos_mes(v_colab, date '2026-11-02') into v_count_antes;

  insert into equipe_medidas (colaborador_id, tipo, fundamento, criado_por)
  values (v_colab, 'orientacao_verbal', 'Teste A7', v_colab)
  returning id into v_medida_id;
  insert into equipe_medida_atrasos (medida_id, atraso_id) values (v_medida_id, v_atraso_id);

  select public.equipe_contar_atrasos_mes(v_colab, date '2026-11-02') into v_count_depois;

  if v_count_depois <> v_count_antes - 1 then
    raise exception 'FAIL A7: contagem deveria cair em 1 (% -> %)', v_count_antes, v_count_depois;
  end if;
  raise notice 'PASS A7';
end $$;
```

- [ ] **Step 4: Commit**

---

## Task 13: Imutabilidade — R7 (A8)

**Files:**
- Create: `supabase/migrations/20260930101200_equipe_imutabilidade.sql`

**Interfaces:**
- Consumes: `equipe_atrasos.status`, `equipe_medida_atrasos`, `equipe_ciencias`, `equipe_medidas.status`.
- Produces: trigger `trg_equipe_atrasos_imutavel` (`before update or delete`), trigger `trg_equipe_ciencias_imutavel`, trigger `trg_equipe_medidas_aplicada_imutavel`.

- [ ] **Step 1: Migration**

```sql
-- 20260930101200_equipe_imutabilidade.sql
create or replace function public.equipe_trg_atrasos_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'pendente_ciencia' or exists (select 1 from equipe_medida_atrasos where atraso_id = old.id) then
      raise exception 'Atraso com ciência dada ou vinculado a medida não pode ser apagado — crie um registro substituto (substitui_id).';
    end if;
    return old;
  end if;

  -- UPDATE: bloqueia mudança dos campos de fato depois de ciência ou medida.
  -- Exceção: as próprias funções do sistema (equipe_recalcular_tolerancia_dia,
  -- equipe_registrar_ciencia, equipe_decidir_justificativa) mudam só
  -- status/minutos_atraso/dentro_tolerancia/updated_at em linhas ainda
  -- pendentes — isso já é coberto porque elas só tocam status='pendente_ciencia'.
  if old.status not in ('pendente_ciencia', 'justificativa_pendente')
     or exists (select 1 from equipe_medida_atrasos where atraso_id = old.id) then
    if old.hora_chegada is distinct from new.hora_chegada
       or old.horario_referencia is distinct from new.horario_referencia
       or old.minutos_atraso is distinct from new.minutos_atraso
       or old.dentro_tolerancia is distinct from new.dentro_tolerancia
       or old.status is distinct from new.status then
      raise exception 'Atraso % com ciência dada ou medida vinculada é imutável — crie um registro substituto.', old.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_equipe_atrasos_imutavel
  before update or delete on public.equipe_atrasos
  for each row execute function public.equipe_trg_atrasos_imutavel();

create or replace function public.equipe_trg_ciencias_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  raise exception 'Ciências são imutáveis — não podem ser editadas nem apagadas.';
end;
$$;

create trigger trg_equipe_ciencias_imutavel
  before update or delete on public.equipe_ciencias
  for each row execute function public.equipe_trg_ciencias_imutavel();

create or replace function public.equipe_trg_medidas_aplicada_imutavel()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' and old.status = 'aplicada' then
    raise exception 'Medida aplicada não pode ser apagada.';
  end if;
  if TG_OP = 'UPDATE' and old.status = 'aplicada' and new.status <> old.status then
    raise exception 'Medida já aplicada não pode mudar de status.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_equipe_medidas_aplicada_imutavel
  before update or delete on public.equipe_medidas
  for each row execute function public.equipe_trg_medidas_aplicada_imutavel();
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_imutabilidade"`)

- [ ] **Step 3: Testar A8**

```sql
do $$
declare
  v_atraso_id uuid := (select id from equipe_atrasos where data = date '2026-10-01'); -- já tem ciência (Task 10)
  v_ok boolean := false;
begin
  begin
    update equipe_atrasos set hora_chegada = time '09:00' where id = v_atraso_id;
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FAIL A8: deveria ter bloqueado edição de atraso com ciência dada';
  end if;
  raise notice 'PASS A8';
end $$;
```

- [ ] **Step 4: Commit**

---

## Task 14: Proteção de PIN — `equipe-login` Edge Function (A19)

**Files:**
- Create: `supabase/migrations/20260930101300_equipe_pin_lockout.sql`
- Create: `supabase/functions/equipe-login/index.ts`

**Interfaces:**
- Consumes: `staff_members.{tentativas_login, bloqueado_em}`.
- Produces: função `public.equipe_checar_login(p_user_id uuid) returns boolean` (true = liberado), `public.equipe_registrar_tentativa_login(p_user_id uuid, p_sucesso boolean) returns void`; Edge Function `equipe-login` (`POST { username, password }`) usada só pelas telas do módulo Equipe (login geral de `AuthContext.tsx` não muda).

- [ ] **Step 1: Migration**

```sql
-- 20260930101300_equipe_pin_lockout.sql
create or replace function public.equipe_checar_login(p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(bloqueado_em is null, true) from staff_members where user_id = p_user_id
$$;

create or replace function public.equipe_registrar_tentativa_login(p_user_id uuid, p_sucesso boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_sucesso then
    update staff_members set tentativas_login = 0 where user_id = p_user_id;
  else
    update staff_members
    set tentativas_login = tentativas_login + 1,
        bloqueado_em = case when tentativas_login + 1 >= 5 then now() else bloqueado_em end
    where user_id = p_user_id;
  end if;
end;
$$;
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_pin_lockout"`)

- [ ] **Step 3: Edge Function**

```ts
// supabase/functions/equipe-login/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STAFF_EMAIL_DOMAIN = "equipe.ubadesklimp.internal";
const STAFF_PIN_SUFFIX = "-pin";

const corsHeadersFor = (req: Request) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") ??
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const jsonResponse = (req: Request, body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !/^\d{4}$/.test(password)) {
      return jsonResponse(req, { error: "Usuário e PIN de 4 dígitos são obrigatórios." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const syntheticEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;

    const { data: authUser } = await adminClient.auth.admin.listUsers();
    const user = authUser?.users.find((u) => u.email === syntheticEmail);
    if (!user) {
      return jsonResponse(req, { error: "Usuário ou senha inválidos." }, 401);
    }

    const { data: liberado } = await adminClient.rpc("equipe_checar_login", { p_user_id: user.id });
    if (liberado === false) {
      return jsonResponse(req, { error: "Conta bloqueada por tentativas incorretas. Peça pro admin desbloquear." }, 403);
    }

    const { data: signIn, error: signInError } = await adminClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: password + STAFF_PIN_SUFFIX,
    });

    await adminClient.rpc("equipe_registrar_tentativa_login", {
      p_user_id: user.id,
      p_sucesso: !signInError,
    });

    if (signInError || !signIn?.session) {
      return jsonResponse(req, { error: "Usuário ou senha inválidos." }, 401);
    }

    return jsonResponse(req, { session: signIn.session }, 200);
  } catch (error) {
    console.error("Erro inesperado em equipe-login:", error);
    return jsonResponse(req, { error: "Erro inesperado ao entrar." }, 500);
  }
});
```

- [ ] **Step 4: Deploy da função**

Chamar `mcp__claude_ai_Supabase__deploy_edge_function` com o conteúdo acima (`project_id="ccrucholgsffichvzbpz"`, `name="equipe-login"`).

- [ ] **Step 5: Testar A19 (lockout em SQL, sem depender da function em runtime)**

```sql
do $$
declare
  v_colab uuid := (select user_id from staff_members where display_name = 'admin');
  v_bloqueado_em timestamptz;
  v_liberado boolean;
begin
  update staff_members set tentativas_login = 0, bloqueado_em = null where user_id = v_colab;

  perform public.equipe_registrar_tentativa_login(v_colab, false);
  perform public.equipe_registrar_tentativa_login(v_colab, false);
  perform public.equipe_registrar_tentativa_login(v_colab, false);
  perform public.equipe_registrar_tentativa_login(v_colab, false);
  select public.equipe_checar_login(v_colab) into v_liberado;
  if v_liberado <> true then raise exception 'FAIL A19 (4 tentativas): ainda deveria estar liberado'; end if;

  perform public.equipe_registrar_tentativa_login(v_colab, false); -- 5ª
  select bloqueado_em, public.equipe_checar_login(v_colab) into v_bloqueado_em, v_liberado from staff_members where user_id = v_colab;
  if v_bloqueado_em is null or v_liberado <> false then
    raise exception 'FAIL A19: esperado bloqueado após 5 tentativas, bloqueado_em=%, liberado=%', v_bloqueado_em, v_liberado;
  end if;
  raise notice 'PASS A19';

  -- limpa pro próximo teste não herdar bloqueio
  update staff_members set tentativas_login = 0, bloqueado_em = null where user_id = v_colab;
end $$;
```

- [ ] **Step 6: Commit**

---

## Task 15: Bucket privado `equipe-docs` + view `equipe_funcionarios_gestor` (A18)

**Files:**
- Create: `supabase/migrations/20260930101400_equipe_docs_bucket.sql`

**Interfaces:**
- Produces: bucket Storage `equipe-docs` (privado), policies restringindo pasta `termos/` a admin; view `public.equipe_funcionarios_gestor` (sem `termo_adesao_path`).

- [ ] **Step 1: Migration**

```sql
-- 20260930101400_equipe_docs_bucket.sql
insert into storage.buckets (id, name, public)
values ('equipe-docs', 'equipe-docs', false)
on conflict (id) do nothing;

create policy "Só admin lê termos de adesão"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'termos'
    and public.is_equipe_admin()
  );

create policy "Só admin faz upload de termos de adesão"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'termos'
    and public.is_equipe_admin()
  );

create policy "Colaborador lê os próprios anexos de justificativa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'justificativas'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Gestor/admin lê anexos de justificativa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'justificativas'
    and public.is_equipe_gestor_ou_admin()
  );

-- A18: gestor vê só o indicador, nunca o path do arquivo.
create view public.equipe_funcionarios_gestor as
select
  user_id,
  display_name,
  empresa_id,
  escala_id,
  almoco_previsto,
  duracao_almoco_min,
  (termo_adesao_path is not null) as termo_adesao_enviado,
  termo_assinado_em
from public.staff_members;

alter view public.equipe_funcionarios_gestor set (security_invoker = true);
```

- [ ] **Step 2: Aplicar via MCP** (`name="equipe_docs_bucket"`)

- [ ] **Step 3: Testar**

```sql
select column_name from information_schema.columns where table_name = 'equipe_funcionarios_gestor';
```

Esperado: NÃO deve conter `termo_adesao_path` na lista — só `termo_adesao_enviado` (boolean).

```sql
select id, name, public from storage.buckets where id = 'equipe-docs';
```

Esperado: 1 linha, `public = false`.

- [ ] **Step 4: Commit**

---

## Task 16: RLS multiempresa + colaborador — testes de sessão real (A9, A17, A21)

**Files:**
- Nenhum arquivo novo — task de verificação usando usuários reais via `mcp__claude_ai_Supabase__execute_sql` rodando como `service_role` para **criar** fixtures, e a checagem de RLS de fato via `set local role authenticated; set local "request.jwt.claims" = '{"sub": "<uuid>"}';` dentro de uma transação, que é como se testa RLS por SQL puro no Postgres do Supabase sem precisar de um browser.

**Interfaces:**
- Consumes: tudo dos Tasks 1-15.

- [ ] **Step 1: Criar fixtures — segunda empresa, colaborador e gestor de teste**

```sql
do $$
declare
  v_empresa_b uuid;
  v_escala_b uuid;
begin
  insert into empresas (razao_social, cnpj) values ('Empresa Teste B LTDA', '00000000000272')
  returning id into v_empresa_b;

  insert into equipe_escalas (empresa_id, nome, saida) values (v_empresa_b, 'Padrão B', '17:00')
  returning id into v_escala_b;
end $$;
```

(Criação de `auth.users` reais pra colaborador/gestor de teste precisa de `auth.admin.createUser`, que não está disponível via `execute_sql` — rodar via `mcp__claude_ai_Supabase__execute_sql` chamando a função helper abaixo não é suficiente; usar a Edge Function `criar-funcionario` já existente, com um token de admin válido, OU pedir pro usuário criar 1 colaborador e 1 gestor de teste pela tela de Funcionários já existente antes deste task, informando os `user_id` gerados para os testes de RLS por sessão. Documentar essa dependência explicitamente ao reportar o resultado deste task.)

- [ ] **Step 2: Testar RLS com `SET LOCAL request.jwt.claims`**

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<uuid_do_colaborador_teste>')::text, true);
set local role authenticated;

-- A9: colaborador tenta ler atraso de outro colaborador -> vazio
select count(*) from equipe_atrasos where colaborador_id <> '<uuid_do_colaborador_teste>';
-- Esperado: 0 linhas (RLS filtra, não erro)
rollback;
```

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<uuid_do_gestor_empresa_b>')::text, true);
set local role authenticated;

-- A21: gestor vinculado só à empresa B não vê funcionários/atrasos da empresa A
select count(*) from equipe_atrasos where empresa_id = (select id from empresas where razao_social = 'Empresa Teste LTDA');
-- Esperado: 0

-- A17: gestor tenta inserir medida de suspensão -> policy de insert recusa
insert into equipe_medidas (colaborador_id, tipo, fundamento, criado_por)
values ('<uuid_do_colaborador_teste>', 'suspensao', 'Teste A17', '<uuid_do_gestor_empresa_b>');
-- Esperado: erro de RLS (new row violates row-level security policy)
rollback;
```

Esperado: cada bloco confirma o comportamento comentado. Se a criação de usuários reais (Step 1) não foi possível nesta sessão, marcar este task como bloqueado e reportar ao usuário exatamente o que falta (não simular "PASS" sem testar de verdade).

- [ ] **Step 3: Commit** (se nada mudou no schema, commit só se algum ajuste de policy foi necessário por um teste que falhou)

---

## Task 17: Regressão completa A1-A26

**Files:**
- Nenhum novo — reexecuta os blocos `do $$ ... $$` dos Tasks 8, 10, 11, 12, 13, 14 em sequência num único `execute_sql`, do zero (limpando as tabelas de teste antes).

- [ ] **Step 1: Reset das tabelas de teste**

```sql
delete from equipe_medida_atrasos;
delete from equipe_medidas;
delete from equipe_justificativas_atraso;
delete from equipe_ciencias;
delete from equipe_atrasos;
update staff_members set tentativas_login = 0, bloqueado_em = null, termo_assinado_em = null where display_name = 'admin';
```

- [ ] **Step 2: Rodar, em um único `execute_sql`, todos os blocos `do $$ ... $$` dos Tasks 8 (A1-A6, A23-A26), 10 (A10, A11), 11 (R5), 12 (A7, A14-A16, A20), 13 (A8), 14 (A19), na ordem exata em que aparecem neste plano.**

Esperado: só linhas `NOTICE: PASS ...`, nenhum `EXCEPTION`/`FAIL`.

- [ ] **Step 3: Reportar ao usuário**

Resumo: quais de A1-A26 passaram via SQL puro (todas exceto A9/A17/A18/A21/A22, que dependem de sessão real de usuário ou de PDF — A18 já verificado estruturalmente no Task 15, A22 é Etapa 3). Pendências explícitas: Task 16 (RLS com sessão real) precisa de pelo menos 1 colaborador e 1 gestor de teste criados via tela de Funcionários — pedir pro usuário criar ou autorizar a Edge Function a criar.

- [ ] **Step 4: Commit final da etapa**

```bash
git add -A
git commit -m "feat(equipe): fundação de banco da Parte 1 completa (schema, calculo, ciencia, escalonamento, imutabilidade, RLS, lockout de PIN)"
```

---

## Self-review (cobertura do PRD)

| PRD | Task |
|---|---|
| R1/R1.1/R2/R3/R4 | 8 |
| R5 | 11 |
| R6 | 12 |
| R7 | 13 |
| 5.1 termo de adesão | 3, 15 |
| 5.2 ciência eletrônica | 10 |
| 5.3 recusa + testemunhas | 10 |
| 5.4 medida/PDF | 12 (dados prontos; geração de PDF é Etapa 3) |
| Multiempresa | 1, 4, 16 |
| Proteções de PIN | 3, 14 |
| RLS em tudo | todos os tasks de tabela |
| Audit log | 9 (+ triggers anexados em 11, 12) |
| A1-A26 | 8, 10, 11, 12, 13, 14, 16, 17 |

Gaps conhecidos, fora do escopo desta etapa (documentados, não esquecidos): geração de PDF (A22, Etapa 3); rate limit por IP no nível de rede/WAF (a Edge Function do Task 14 já nega por `bloqueado_em`, mas rate limit de infraestrutura fica fora do banco); tipos TS gerados + Zod (roda depois que todas as migrations da Etapa 1 estiverem aplicadas, listado como primeiro passo da Etapa 2).
