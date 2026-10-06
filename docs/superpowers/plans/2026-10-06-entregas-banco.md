# Módulo Entregas — Etapa 1 — Banco Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir toda a camada de banco do Módulo Entregas — importação idempotente do Excel do ERP, bairros de Ubatuba em ordem geográfica, rota do dia com inversão, e registro append-only de entregue/não entregue com hora e rede do servidor — com os testes SQL passando antes de qualquer tela.

**Architecture:** Postgres/Supabase puro, no mesmo padrão do módulo Ponto. Toda regra em função SQL (`SECURITY DEFINER` + `set search_path`). RLS em cada tabela. O entregador nunca toca tabela direto: ele chega pelo PIN através de função `SECURITY DEFINER`, exatamente como bate ponto hoje. O registro de entrega é append-only — corrigir é gravar outro evento, nunca apagar.

**Tech Stack:** Supabase Postgres 17, `pgcrypto` em `extensions` (já habilitada), projeto Supabase `ccrucholgsffichvzbpz`.

## Global Constraints

- Cada migration aplicada via `mcp__claude_ai_Supabase__apply_migration` (`project_id=ccrucholgsffichvzbpz`) **e** salva idêntica em `supabase/migrations/<timestamp>_<slug>.sql`.
- Antes de qualquer `apply_migration` ou `execute_sql`, rodar `mcp__claude_ai_Supabase__list_projects` e conferir que o projeto é `UBADESKLIMP` — a conexão já trocou de conta no meio de sessão neste projeto.
- Toda migration começa com comentário explicando **o porquê** da decisão, não o que o SQL faz.
- Mensagem de erro em português, dirigida a quem vai ler na tela — nunca jargão de banco.
- RLS em todas as tabelas novas, sempre filtrando por empresa via `equipe_empresas_visiveis()`.
- **Hora e IP vêm do servidor; coordenada vem do aparelho.** `registrado_em` é `now()` no banco e `ip` é `ponto_ip_origem()` — nenhum dos dois aceita valor do cliente. Latitude e longitude só existem no celular, então são declaradas pelo aparelho e podem ser falsificadas por quem quiser muito. Isso precisa estar escrito no comentário da tabela: o módulo prova **quando** e **de que rede**, e apenas afirma **onde**.
- Nenhum `update`/`delete` do cliente em `entrega_eventos` — append-only garantido por trigger.
- Testes = scripts SQL via `mcp__claude_ai_Supabase__execute_sql`, terminando com
  `DO $$ BEGIN IF NOT (<condição>) THEN RAISE EXCEPTION 'FAIL: <msg>'; END IF; RAISE NOTICE 'PASS: <msg>'; END $$;`
  Não existe suíte automatizada neste repo.
- Todo teste que cria dado roda dentro de `begin; ... rollback;` ou limpa por filtro explícito ao final. O dono mexe no banco em paralelo — **nunca** `delete` sem `where`.
- Spec de referência: `docs/superpowers/specs/2026-10-06-entregas-design.md`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `20261006130000_entregas_bairros.sql` | Enums do módulo + `entrega_bairros` + seed de Ubatuba |
| `20261006131000_entregas_tabela.sql` | `entregas` + RLS |
| `20261006132000_entregas_rota.sql` | `entrega_rotas` + `entrega_paradas` + RLS |
| `20261006133000_entregas_eventos.sql` | `entrega_eventos` append-only + RLS |
| `20261006134000_entregas_importar.sql` | `entrega_importar_lote` |
| `20261006135000_entregas_montar_rota.sql` | `entrega_montar_rota`, `entrega_inverter_rota`, `entrega_mover_parada` |
| `20261006136000_entregas_registrar.sql` | `entrega_registrar` — o coração |
| `20261006137000_entregas_leituras.sql` | `entrega_fila`, `entrega_rota_do_dia`, `entrega_minha_rota` |

---

## Task 1: Enums e bairros de Ubatuba

**Files:**
- Create: `supabase/migrations/20261006130000_entregas_bairros.sql`

**Interfaces:**
- Produces: enums `public.entrega_situacao`, `public.entrega_evento_tipo`, `public.entrega_motivo`; tabela `public.entrega_bairros(id uuid pk, empresa_id uuid, nome text, ordem int, ativo boolean)`.

- [ ] **Step 1: Escrever a migration**

```sql
-- A rota de Ubatuba é uma linha: quase tudo pendurado na Rio-Santos. Por isso a
-- ordem geográfica do bairro já é, na prática, a ordem da rota — e inverter a
-- lista é a operação que o dono mais usa (na temporada o sul entope, e convém
-- bater no extremo primeiro e voltar fazendo).
--
-- `ordem` é int com espaço entre os valores (10, 20, 30...) para caber bairro
-- novo no meio sem renumerar tudo.

create type public.entrega_situacao as enum
  ('na_fila', 'em_rota', 'entregue', 'nao_entregue', 'cancelada');

create type public.entrega_evento_tipo as enum ('entregue', 'nao_entregue');

create type public.entrega_motivo as enum
  ('fechado', 'ninguem_atendeu', 'endereco_errado', 'cliente_recusou',
   'nao_coube', 'outro');

create table public.entrega_bairros (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null,
  ordem      int  not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create index entrega_bairros_ordem on public.entrega_bairros (empresa_id, ordem);

alter table public.entrega_bairros enable row level security;

create policy "le_bairros" on public.entrega_bairros
  for select using (empresa_id in (select equipe_empresas_visiveis()));

create policy "gestor_escreve_bairros" on public.entrega_bairros
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

-- Ordem do extremo norte ao extremo sul. ESTA LISTA PRECISA DA REVISÃO DO DONO
-- antes de entrar em uso: se um bairro estiver na posição errada, a rota sai
-- errada todos os dias e ninguém percebe de imediato.
insert into public.entrega_bairros (empresa_id, nome, ordem)
select e.id, b.nome, b.ordem
from public.empresas e
cross join (values
  ('Picinguaba', 10), ('Camburi', 20), ('Ubatumirim', 30), ('Almada', 40),
  ('Engenho', 50), ('Puruba', 60), ('Prumirim', 70), ('Itamambuca', 80),
  ('Vermelha do Norte', 90), ('Felix', 100), ('Santa Rita', 110),
  ('Ipiranguinha', 120), ('Horto Florestal', 130), ('Perequê-Açu', 140),
  ('Centro', 150), ('Itaguá', 160), ('Toninhas', 170), ('Praia Grande', 180),
  ('Tenório', 190), ('Enseada', 200), ('Flamengo', 210), ('Lázaro', 220),
  ('Domingas Dias', 230), ('Sapê', 240), ('Maranduba', 250),
  ('Sertão da Quina', 260), ('Oliveira', 270), ('Pulso', 280),
  ('Lagoinha', 290), ('Bonete', 300)
) as b(nome, ordem)
where e.ativo;
```

- [ ] **Step 2: Aplicar e conferir o projeto antes**

```
mcp__claude_ai_Supabase__list_projects   → confirmar "UBADESKLIMP" / ccrucholgsffichvzbpz
mcp__claude_ai_Supabase__apply_migration  name=entregas_bairros  query=<conteúdo acima>
```

- [ ] **Step 3: Rodar o teste**

```sql
do $$
declare v_n int; v_primeiro text; v_ultimo text;
begin
  select count(*) into v_n from entrega_bairros;
  select nome into v_primeiro from entrega_bairros order by ordem limit 1;
  select nome into v_ultimo   from entrega_bairros order by ordem desc limit 1;

  if v_n < 25 then
    raise exception 'FAIL: esperava ao menos 25 bairros, achei %', v_n;
  end if;
  if v_primeiro <> 'Picinguaba' then
    raise exception 'FAIL: o primeiro bairro deveria ser Picinguaba, veio %', v_primeiro;
  end if;
  if v_ultimo <> 'Bonete' then
    raise exception 'FAIL: o ultimo bairro deveria ser Bonete, veio %', v_ultimo;
  end if;
  raise notice 'PASS: % bairros, de % a %', v_n, v_primeiro, v_ultimo;
end $$;
```

Esperado: `PASS: 30 bairros, de Picinguaba a Bonete`

- [ ] **Step 4: Salvar o arquivo e commitar**

```bash
git add supabase/migrations/20261006130000_entregas_bairros.sql
git commit -m "feat(entregas): bairros de Ubatuba em ordem geografica"
```

---

## Task 2: Tabela `entregas`

**Files:**
- Create: `supabase/migrations/20261006131000_entregas_tabela.sql`

**Interfaces:**
- Consumes: `entrega_situacao`, `entrega_bairros` (Task 1).
- Produces: tabela `public.entregas` com unique `(empresa_id, documento_tipo, documento_numero)` — é essa chave que torna a importação idempotente.

- [ ] **Step 1: Escrever a migration**

```sql
-- Uma entrega é um pedido do ERP que já foi impresso e ainda não chegou ao
-- cliente. A chave natural é o documento (tipo + número), e é ela que faz subir
-- o mesmo Excel duas vezes não duplicar nada.
--
-- O endereço vem de dois lugares diferentes porque o ERP é assim: cliente
-- cadastrado tem rua/bairro/CEP estruturados; venda avulsa de WhatsApp traz o
-- endereço em texto livre no campo "Entregar em". Guardamos os dois e deixamos
-- a tela decidir qual mostrar.

create table public.entregas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,

  documento_tipo     text not null,
  documento_numero   text not null,
  documento_data     date,

  cliente_codigo     text,
  cliente_nome       text not null,
  cliente_telefone   text,

  endereco_logradouro text,
  endereco_numero     text,
  bairro_id           uuid references public.entrega_bairros(id),
  bairro_texto        text,
  cidade              text,
  cep                 text,
  entregar_em         text,

  valor              numeric(12,2),
  itens              jsonb not null default '[]'::jsonb,

  situacao           public.entrega_situacao not null default 'na_fila',
  tentativas         int not null default 0,

  importada_em       timestamptz not null default now(),
  importada_por      uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (empresa_id, documento_tipo, documento_numero)
);

create index entregas_fila    on public.entregas (empresa_id, situacao);
create index entregas_bairro  on public.entregas (bairro_id);

comment on column public.entregas.bairro_texto is
  'Bairro como veio do ERP, mesmo quando não casou com entrega_bairros. Guardar o
   texto cru permite descobrir bairro novo sem perder a entrega.';

alter table public.entregas enable row level security;

create policy "le_entregas" on public.entregas
  for select using (empresa_id in (select equipe_empresas_visiveis()));

create policy "gestor_escreve_entregas" on public.entregas
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_tabela  query=<acima>
```

- [ ] **Step 3: Rodar o teste — a chave única é o que segura a idempotência**

```sql
begin;
do $$
declare v_emp uuid; v_erro text := '';
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome)
  values (v_emp, 'OR', '99999', 'TESTE ZZ');

  begin
    insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome)
    values (v_emp, 'OR', '99999', 'TESTE ZZ DE NOVO');
    v_erro := 'aceitou documento duplicado';
  exception when unique_violation then
    null;  -- é isso que tem que acontecer
  end;

  if v_erro <> '' then
    raise exception 'FAIL: %', v_erro;
  end if;
  raise notice 'PASS: documento repetido e recusado pela chave unica';
end $$;
rollback;
```

Esperado: `PASS: documento repetido e recusado pela chave unica`

- [ ] **Step 4: Commitar**

```bash
git add supabase/migrations/20261006131000_entregas_tabela.sql
git commit -m "feat(entregas): tabela de entregas com chave pelo documento do ERP"
```

---

## Task 3: Rota do dia e paradas

**Files:**
- Create: `supabase/migrations/20261006132000_entregas_rota.sql`

**Interfaces:**
- Consumes: `entregas` (Task 2).
- Produces: `public.entrega_rotas(id, empresa_id, data, invertida, fechada_em, criada_por)` com unique `(empresa_id, data)`; `public.entrega_paradas(id, rota_id, entrega_id, ordem)` com unique `(rota_id, entrega_id)`.

- [ ] **Step 1: Escrever a migration**

```sql
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
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_rota  query=<acima>
```

- [ ] **Step 3: Rodar o teste**

```sql
begin;
do $$
declare v_emp uuid; v_rota uuid; v_erro text := '';
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entrega_rotas (empresa_id, data) values (v_emp, '2099-01-01')
  returning id into v_rota;

  begin
    insert into entrega_rotas (empresa_id, data) values (v_emp, '2099-01-01');
    v_erro := 'aceitou duas rotas no mesmo dia';
  exception when unique_violation then null;
  end;

  if v_erro <> '' then raise exception 'FAIL: %', v_erro; end if;
  raise notice 'PASS: so existe uma rota por empresa por dia';
end $$;
rollback;
```

Esperado: `PASS: so existe uma rota por empresa por dia`

- [ ] **Step 4: Commitar**

```bash
git add supabase/migrations/20261006132000_entregas_rota.sql
git commit -m "feat(entregas): rota do dia e paradas"
```

---

## Task 4: Eventos de entrega, append-only

**Files:**
- Create: `supabase/migrations/20261006133000_entregas_eventos.sql`

**Interfaces:**
- Consumes: `entregas` (Task 2), `entrega_rotas` (Task 3), enums (Task 1).
- Produces: `public.entrega_eventos`; trigger `trg_entrega_eventos_append_only`.

- [ ] **Step 1: Escrever a migration**

```sql
-- O que este registro prova, e o que ele não prova — está escrito aqui porque é
-- a coisa mais fácil de vender errado neste módulo:
--
--   registrado_em  vem de now() no servidor. Não dá para antedatar.
--   ip             vem de ponto_ip_origem(), lido do cabeçalho da borda. Diz se
--                  a marcação saiu do 4G na rua ou do Wi-Fi da loja — e essa é a
--                  diferença que interessa.
--   lat/lng        vêm do GPS do aparelho. Coordenada só existe no celular, então
--                  é DECLARADA, não provada: quem instalar um falsificador de GPS
--                  engana. Serve contra descuido e desonestidade casual, não
--                  contra alguém determinado.
--
-- Append-only: corrigir é gravar outro evento, nunca apagar. Um histórico que
-- pode ser reescrito não serve para conferir ninguém.

create table public.entrega_eventos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  entrega_id     uuid not null references public.entregas(id) on delete cascade,
  rota_id        uuid references public.entrega_rotas(id),

  tipo           public.entrega_evento_tipo not null,
  motivo         public.entrega_motivo,
  motivo_texto   text,
  quem_recebeu   text,

  funcionario_id uuid not null,
  registrado_em  timestamptz not null default now(),

  lat            numeric(10,7),
  lng            numeric(10,7),
  precisao_m     numeric(8,2),

  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now(),

  constraint entrega_evento_motivo_quando_nao_entregue
    check (tipo = 'entregue' or motivo is not null)
);

create index entrega_eventos_por_entrega on public.entrega_eventos (entrega_id, registrado_em);

comment on table public.entrega_eventos is
  'Append-only. Prova quando e de que rede; apenas afirma onde.';

create or replace function public.entrega_trg_eventos_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'O registro de entrega não pode ser alterado nem apagado. Para corrigir, registre de novo.';
end;
$$;

create trigger trg_entrega_eventos_append_only
  before update or delete on public.entrega_eventos
  for each row execute function public.entrega_trg_eventos_append_only();

alter table public.entrega_eventos enable row level security;

create policy "le_eventos" on public.entrega_eventos
  for select using (empresa_id in (select equipe_empresas_visiveis()));
-- Sem policy de insert: só a função entrega_registrar (SECURITY DEFINER) grava.
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_eventos  query=<acima>
```

- [ ] **Step 3: Rodar o teste — o append-only tem que morder**

```sql
begin;
do $$
declare v_emp uuid; v_ent uuid; v_ev uuid; v_erro text := '';
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome)
  values (v_emp, 'OR', 'ZZ-APPEND', 'TESTE ZZ') returning id into v_ent;

  insert into entrega_eventos (empresa_id, entrega_id, tipo, funcionario_id)
  values (v_emp, v_ent, 'entregue',
          (select user_id from staff_members limit 1))
  returning id into v_ev;

  begin
    update entrega_eventos set quem_recebeu = 'outro' where id = v_ev;
    v_erro := 'deixou alterar o evento';
  exception when others then null;
  end;
  if v_erro <> '' then raise exception 'FAIL: %', v_erro; end if;

  begin
    delete from entrega_eventos where id = v_ev;
    v_erro := 'deixou apagar o evento';
  exception when others then null;
  end;
  if v_erro <> '' then raise exception 'FAIL: %', v_erro; end if;

  raise notice 'PASS: evento de entrega nao pode ser alterado nem apagado';
end $$;
rollback;
```

Esperado: `PASS: evento de entrega nao pode ser alterado nem apagado`

- [ ] **Step 4: Commitar**

```bash
git add supabase/migrations/20261006133000_entregas_eventos.sql
git commit -m "feat(entregas): eventos append-only, com o que provam escrito na tabela"
```

---

## Task 5: Importar o lote do Excel

**Files:**
- Create: `supabase/migrations/20261006134000_entregas_importar.sql`

**Interfaces:**
- Consumes: `entregas` (Task 2), `entrega_bairros` (Task 1).
- Produces: `public.entrega_importar_lote(p_empresa_id uuid, p_linhas jsonb) returns jsonb` devolvendo `{ok, criadas, atualizadas, ignoradas, bairros_novos}`.

Cada elemento de `p_linhas` tem a forma:
```json
{"documento_tipo":"OR","documento_numero":"55071","documento_data":"2026-10-06",
 "cliente_codigo":"172","cliente_nome":"CONDOMINIO EDIFICIO WIMBLEDON",
 "cliente_telefone":"12 3842-0869","endereco_logradouro":"R IDALINA GRACA",
 "endereco_numero":"25","bairro":"TONINHAS","cidade":"UBATUBA","cep":"11680-000",
 "entregar_em":null,"valor":1151.00,
 "itens":[{"codigo":"00030303","descricao":"CLORO GRANULADO GENCO 10 KG","qtd":3}]}
```

- [ ] **Step 1: Escrever a migration**

```sql
-- A importação roda todo dia com o mesmo arquivo podendo repetir linhas de
-- ontem. Por isso ela é idempotente pelo documento: entrega que já existe só
-- tem os dados cadastrais atualizados, e entrega que já foi entregue não volta
-- para a fila de jeito nenhum — senão o entregador veria de novo algo que ele já
-- levou.
--
-- O bairro é casado sem acento e sem caixa, porque o ERP grava "TONINHAS" e o
-- cadastro diz "Toninhas". Bairro que não casar fica em bairro_texto e volta na
-- resposta, para o gestor cadastrar e a entrega não sumir da rota.

create or replace function public.entrega_importar_lote(
  p_empresa_id uuid,
  p_linhas jsonb
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  v_bairro_id uuid;
  v_bairro_txt text;
  v_existente public.entregas;
  v_criadas int := 0;
  v_atualizadas int := 0;
  v_ignoradas int := 0;
  v_novos text[] := '{}';
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin importa entregas.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  for r in select * from jsonb_array_elements(p_linhas) loop
    v_bairro_txt := nullif(trim(r->>'bairro'), '');
    v_bairro_id := null;

    if v_bairro_txt is not null then
      select b.id into v_bairro_id
      from entrega_bairros b
      where b.empresa_id = p_empresa_id and b.ativo
        and lower(public.unaccent(b.nome)) = lower(public.unaccent(v_bairro_txt))
      limit 1;

      if v_bairro_id is null and not (v_bairro_txt = any(v_novos)) then
        v_novos := v_novos || v_bairro_txt;
      end if;
    end if;

    select * into v_existente from entregas
    where empresa_id = p_empresa_id
      and documento_tipo = r->>'documento_tipo'
      and documento_numero = r->>'documento_numero';

    if found then
      -- entrega já resolvida não volta para a fila
      if v_existente.situacao in ('entregue', 'cancelada') then
        v_ignoradas := v_ignoradas + 1;
        continue;
      end if;

      update entregas set
        cliente_nome        = r->>'cliente_nome',
        cliente_telefone    = r->>'cliente_telefone',
        endereco_logradouro = r->>'endereco_logradouro',
        endereco_numero     = r->>'endereco_numero',
        bairro_id           = coalesce(v_bairro_id, bairro_id),
        bairro_texto        = coalesce(v_bairro_txt, bairro_texto),
        cidade              = r->>'cidade',
        cep                 = r->>'cep',
        entregar_em         = r->>'entregar_em',
        valor               = nullif(r->>'valor','')::numeric,
        itens               = coalesce(r->'itens', '[]'::jsonb),
        updated_at          = now()
      where id = v_existente.id;

      v_atualizadas := v_atualizadas + 1;
    else
      insert into entregas (
        empresa_id, documento_tipo, documento_numero, documento_data,
        cliente_codigo, cliente_nome, cliente_telefone,
        endereco_logradouro, endereco_numero, bairro_id, bairro_texto,
        cidade, cep, entregar_em, valor, itens, importada_por
      ) values (
        p_empresa_id, r->>'documento_tipo', r->>'documento_numero',
        nullif(r->>'documento_data','')::date,
        r->>'cliente_codigo', r->>'cliente_nome', r->>'cliente_telefone',
        r->>'endereco_logradouro', r->>'endereco_numero', v_bairro_id, v_bairro_txt,
        r->>'cidade', r->>'cep', r->>'entregar_em',
        nullif(r->>'valor','')::numeric, coalesce(r->'itens','[]'::jsonb), auth.uid()
      );
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'criadas', v_criadas,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas,
    'bairros_novos', to_jsonb(v_novos)
  );
end;
$$;

grant execute on function public.entrega_importar_lote(uuid, jsonb) to authenticated;
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_importar  query=<acima>
```

- [ ] **Step 3: Rodar o teste — importar duas vezes não pode duplicar**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare
  v_emp uuid; v_linhas jsonb; v_r1 jsonb; v_r2 jsonb; v_n int;
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  v_linhas := jsonb_build_array(jsonb_build_object(
    'documento_tipo','OR','documento_numero','ZZ-IMP-1','documento_data','2026-10-06',
    'cliente_codigo','172','cliente_nome','TESTE ZZ WIMBLEDON',
    'cliente_telefone','12 3842-0869','endereco_logradouro','R IDALINA GRACA',
    'endereco_numero','25','bairro','TONINHAS','cidade','UBATUBA','cep','11680-000',
    'valor',1151.00,
    'itens', jsonb_build_array(jsonb_build_object('codigo','00030303','descricao','CLORO','qtd',3))
  ));

  v_r1 := public.entrega_importar_lote(v_emp, v_linhas);
  v_r2 := public.entrega_importar_lote(v_emp, v_linhas);

  select count(*) into v_n from entregas
  where empresa_id = v_emp and documento_numero = 'ZZ-IMP-1';

  if v_n <> 1 then
    raise exception 'FAIL: esperava 1 entrega apos importar duas vezes, achei %', v_n;
  end if;
  if (v_r1->>'criadas')::int <> 1 then
    raise exception 'FAIL: primeira importacao deveria criar 1, veio %', v_r1->>'criadas';
  end if;
  if (v_r2->>'atualizadas')::int <> 1 then
    raise exception 'FAIL: segunda importacao deveria atualizar 1, veio %', v_r2->>'atualizadas';
  end if;
  if not exists (select 1 from entregas e join entrega_bairros b on b.id = e.bairro_id
                 where e.documento_numero = 'ZZ-IMP-1' and b.nome = 'Toninhas') then
    raise exception 'FAIL: TONINHAS do ERP nao casou com o bairro Toninhas';
  end if;

  raise notice 'PASS: importacao idempotente e bairro casado sem acento';
end $$;
rollback;
```

Esperado: `PASS: importacao idempotente e bairro casado sem acento`

- [ ] **Step 4: Rodar o segundo teste — entrega já entregue não volta pra fila**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare v_emp uuid; v_linhas jsonb; v_r jsonb; v_sit public.entrega_situacao;
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  v_linhas := jsonb_build_array(jsonb_build_object(
    'documento_tipo','OR','documento_numero','ZZ-IMP-2',
    'cliente_nome','TESTE ZZ JA ENTREGUE','bairro','CENTRO'));

  perform public.entrega_importar_lote(v_emp, v_linhas);
  update entregas set situacao = 'entregue'
   where empresa_id = v_emp and documento_numero = 'ZZ-IMP-2';

  v_r := public.entrega_importar_lote(v_emp, v_linhas);

  select situacao into v_sit from entregas
   where empresa_id = v_emp and documento_numero = 'ZZ-IMP-2';

  if v_sit <> 'entregue' then
    raise exception 'FAIL: a reimportacao devolveu a entrega para %', v_sit;
  end if;
  if (v_r->>'ignoradas')::int <> 1 then
    raise exception 'FAIL: esperava 1 ignorada, veio %', v_r->>'ignoradas';
  end if;
  raise notice 'PASS: entrega ja entregue nao volta para a fila';
end $$;
rollback;
```

Esperado: `PASS: entrega ja entregue nao volta para a fila`

- [ ] **Step 5: Commitar**

```bash
git add supabase/migrations/20261006134000_entregas_importar.sql
git commit -m "feat(entregas): importacao idempotente do lote do ERP"
```

---

## Task 6: Montar, inverter e reordenar a rota

**Files:**
- Create: `supabase/migrations/20261006135000_entregas_montar_rota.sql`

**Interfaces:**
- Consumes: `entregas` (Task 2), `entrega_rotas`/`entrega_paradas` (Task 3), `entrega_bairros` (Task 1).
- Produces:
  - `public.entrega_montar_rota(p_empresa_id uuid, p_data date, p_entrega_ids uuid[]) returns jsonb` → `{ok, rota_id, paradas}`
  - `public.entrega_inverter_rota(p_rota_id uuid) returns jsonb` → `{ok, invertida}`
  - `public.entrega_mover_parada(p_parada_id uuid, p_nova_ordem int) returns jsonb` → `{ok}`

- [ ] **Step 1: Escrever a migration**

```sql
-- Montar a rota é ordenar por bairro e numerar. Entrega sem bairro casado vai
-- para o fim, não some: endereço solto ainda precisa ser entregue, e o gestor
-- resolve arrastando.
--
-- Inverter não mexe nas paradas — vira uma marca na rota. Assim o ajuste que o
-- gestor fez na mão sobrevive a inverter e desinverter, o que não aconteceria se
-- a gente reescrevesse a ordem toda vez.

create or replace function public.entrega_montar_rota(
  p_empresa_id uuid,
  p_data date,
  p_entrega_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rota uuid;
  v_n int := 0;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin monta a rota.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if coalesce(array_length(p_entrega_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false,
      'mensagem', 'Escolha ao menos uma entrega para montar a rota.');
  end if;

  insert into entrega_rotas (empresa_id, data, criada_por)
  values (p_empresa_id, p_data, auth.uid())
  on conflict (empresa_id, data) do update set data = excluded.data
  returning id into v_rota;

  -- quem já estava na rota e não veio na lista nova sai e volta para a fila
  update entregas set situacao = 'na_fila', updated_at = now()
  where id in (
    select p.entrega_id from entrega_paradas p
    where p.rota_id = v_rota and not (p.entrega_id = any(p_entrega_ids))
  ) and situacao = 'em_rota';

  delete from entrega_paradas
  where rota_id = v_rota and not (entrega_id = any(p_entrega_ids));

  insert into entrega_paradas (rota_id, entrega_id, ordem)
  select v_rota, e.id,
         row_number() over (
           order by coalesce(b.ordem, 999999), e.cliente_nome
         ) * 10
  from entregas e
  left join entrega_bairros b on b.id = e.bairro_id
  where e.id = any(p_entrega_ids)
    and e.empresa_id = p_empresa_id
    and e.situacao in ('na_fila', 'nao_entregue', 'em_rota')
  on conflict (rota_id, entrega_id) do nothing;

  update entregas set situacao = 'em_rota', updated_at = now()
  where id = any(p_entrega_ids)
    and empresa_id = p_empresa_id
    and situacao in ('na_fila', 'nao_entregue');

  select count(*) into v_n from entrega_paradas where rota_id = v_rota;

  return jsonb_build_object('ok', true, 'rota_id', v_rota, 'paradas', v_n);
end;
$$;

create or replace function public.entrega_inverter_rota(p_rota_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_inv boolean;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin muda a rota.';
  end if;

  select empresa_id into v_emp from entrega_rotas where id = p_rota_id;
  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Rota não encontrada.');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entrega_rotas set invertida = not invertida
  where id = p_rota_id returning invertida into v_inv;

  return jsonb_build_object('ok', true, 'invertida', v_inv);
end;
$$;

create or replace function public.entrega_mover_parada(
  p_parada_id uuid,
  p_nova_ordem int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin muda a rota.';
  end if;

  select r.empresa_id into v_emp
  from entrega_paradas p join entrega_rotas r on r.id = p.rota_id
  where p.id = p_parada_id;

  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Parada não encontrada.');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entrega_paradas set ordem = p_nova_ordem where id = p_parada_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.entrega_montar_rota(uuid, date, uuid[]) to authenticated;
grant execute on function public.entrega_inverter_rota(uuid)             to authenticated;
grant execute on function public.entrega_mover_parada(uuid, int)         to authenticated;
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_montar_rota  query=<acima>
```

- [ ] **Step 3: Rodar o teste — a ordem sai pelo bairro, e o sem-bairro vai pro fim**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare
  v_emp uuid; v_sul uuid; v_norte uuid; v_sem uuid;
  v_r jsonb; v_rota uuid; v_primeiro text; v_ultimo text;
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_id)
  values (v_emp,'OR','ZZ-R-SUL','ZZ SUL',
          (select id from entrega_bairros where nome='Maranduba' and empresa_id=v_emp))
  returning id into v_sul;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_id)
  values (v_emp,'OR','ZZ-R-NORTE','ZZ NORTE',
          (select id from entrega_bairros where nome='Picinguaba' and empresa_id=v_emp))
  returning id into v_norte;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_texto)
  values (v_emp,'OR','ZZ-R-SEM','ZZ SEM BAIRRO','BAIRRO QUE NAO EXISTE')
  returning id into v_sem;

  v_r := public.entrega_montar_rota(v_emp, '2099-02-02', array[v_sul, v_norte, v_sem]);
  v_rota := (v_r->>'rota_id')::uuid;

  select e.cliente_nome into v_primeiro
  from entrega_paradas p join entregas e on e.id = p.entrega_id
  where p.rota_id = v_rota order by p.ordem limit 1;

  select e.cliente_nome into v_ultimo
  from entrega_paradas p join entregas e on e.id = p.entrega_id
  where p.rota_id = v_rota order by p.ordem desc limit 1;

  if v_primeiro <> 'ZZ NORTE' then
    raise exception 'FAIL: a rota deveria comecar no norte, comecou em %', v_primeiro;
  end if;
  if v_ultimo <> 'ZZ SEM BAIRRO' then
    raise exception 'FAIL: entrega sem bairro deveria ir para o fim, no fim veio %', v_ultimo;
  end if;
  if (select situacao from entregas where id = v_norte) <> 'em_rota' then
    raise exception 'FAIL: a entrega escolhida nao ficou em_rota';
  end if;

  raise notice 'PASS: rota ordenada do norte para o sul, sem-bairro no fim';
end $$;
rollback;
```

Esperado: `PASS: rota ordenada do norte para o sul, sem-bairro no fim`

- [ ] **Step 4: Rodar o teste de inversão — ida e volta não pode embaralhar**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare v_emp uuid; v_e uuid; v_r jsonb; v_rota uuid; v_ordem int;
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_id)
  values (v_emp,'OR','ZZ-INV','ZZ INVERTE',
          (select id from entrega_bairros where nome='Centro' and empresa_id=v_emp))
  returning id into v_e;

  v_r := public.entrega_montar_rota(v_emp, '2099-03-03', array[v_e]);
  v_rota := (v_r->>'rota_id')::uuid;
  select ordem into v_ordem from entrega_paradas where rota_id = v_rota;

  perform public.entrega_inverter_rota(v_rota);
  if not (select invertida from entrega_rotas where id = v_rota) then
    raise exception 'FAIL: inverter nao marcou a rota como invertida';
  end if;

  perform public.entrega_inverter_rota(v_rota);
  if (select invertida from entrega_rotas where id = v_rota) then
    raise exception 'FAIL: inverter duas vezes deveria voltar ao normal';
  end if;
  if (select ordem from entrega_paradas where rota_id = v_rota) <> v_ordem then
    raise exception 'FAIL: inverter mexeu na ordem gravada das paradas';
  end if;

  raise notice 'PASS: inverter e uma marca na rota, nao reescreve as paradas';
end $$;
rollback;
```

Esperado: `PASS: inverter e uma marca na rota, nao reescreve as paradas`

- [ ] **Step 5: Commitar**

```bash
git add supabase/migrations/20261006135000_entregas_montar_rota.sql
git commit -m "feat(entregas): montar, inverter e reordenar a rota do dia"
```

---

## Task 7: Registrar entregue / não entregue

**Files:**
- Create: `supabase/migrations/20261006136000_entregas_registrar.sql`

**Interfaces:**
- Consumes: `entrega_eventos` (Task 4), `entregas` (Task 2), `ponto_quem_tem_o_pin(uuid, text)`, `ponto_ip_origem()`, `ponto_user_agent()`.
- Produces: `public.entrega_registrar(p_pin text, p_entrega_id uuid, p_tipo public.entrega_evento_tipo, p_motivo public.entrega_motivo, p_motivo_texto text, p_quem_recebeu text, p_lat numeric, p_lng numeric, p_precisao_m numeric) returns jsonb` → `{ok, evento_id, situacao, mensagem}`.

- [ ] **Step 1: Escrever a migration**

```sql
-- O entregador chega pelo PIN, como já bate ponto: ele não tem conta de painel e
-- não deve ter. O PIN diz quem é; a empresa sai da entrega, não do que o celular
-- mandar.
--
-- Hora e IP são do servidor. Latitude e longitude vêm do aparelho e por isso são
-- declaradas — está escrito na tabela e precisa estar escrito na tela também.
--
-- Não entregue incrementa tentativas e devolve para a fila: é assim que a
-- entrega vira dívida e aparece no topo da rota de amanhã, que é o problema que
-- este módulo existe para resolver.

create or replace function public.entrega_registrar(
  p_pin          text,
  p_entrega_id   uuid,
  p_tipo         public.entrega_evento_tipo,
  p_motivo       public.entrega_motivo default null,
  p_motivo_texto text default null,
  p_quem_recebeu text default null,
  p_lat          numeric default null,
  p_lng          numeric default null,
  p_precisao_m   numeric default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_entrega public.entregas;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_rota uuid;
  v_evento uuid;
  v_situacao public.entrega_situacao;
begin
  select * into v_entrega from entregas where id = p_entrega_id;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Entrega não encontrada.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_entrega.empresa_id, p_pin);

  if v_func is null then
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;
  if v_amb then
    return jsonb_build_object('ok', false, 'motivo', 'pin_repetido',
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  if p_tipo = 'nao_entregue' and p_motivo is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_motivo',
      'mensagem', 'Diga por que não deu para entregar.');
  end if;

  if v_entrega.situacao = 'entregue' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_entregue',
      'mensagem', 'Esta entrega já foi dada como entregue.');
  end if;
  if v_entrega.situacao = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'cancelada',
      'mensagem', 'Esta entrega foi cancelada. Fale com a loja.');
  end if;

  select p.rota_id into v_rota
  from entrega_paradas p join entrega_rotas r on r.id = p.rota_id
  where p.entrega_id = p_entrega_id and r.empresa_id = v_entrega.empresa_id
  order by r.data desc limit 1;

  insert into entrega_eventos (
    empresa_id, entrega_id, rota_id, tipo, motivo, motivo_texto, quem_recebeu,
    funcionario_id, lat, lng, precisao_m, ip, user_agent
  ) values (
    v_entrega.empresa_id, p_entrega_id, v_rota, p_tipo, p_motivo,
    nullif(trim(p_motivo_texto), ''), nullif(trim(p_quem_recebeu), ''),
    v_func, p_lat, p_lng, p_precisao_m,
    public.ponto_ip_origem(), public.ponto_user_agent()
  ) returning id into v_evento;

  if p_tipo = 'entregue' then
    v_situacao := 'entregue';
    update entregas set situacao = 'entregue', updated_at = now()
    where id = p_entrega_id;
  else
    v_situacao := 'nao_entregue';
    update entregas set situacao = 'nao_entregue',
                        tentativas = tentativas + 1,
                        updated_at = now()
    where id = p_entrega_id;
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;

  return jsonb_build_object(
    'ok', true,
    'evento_id', v_evento,
    'situacao', v_situacao,
    'nome', v_nome,
    'mensagem', case when p_tipo = 'entregue'
      then format('Entrega de %s registrada.', v_entrega.cliente_nome)
      else format('%s ficou pendente. Volta para a fila de amanhã.', v_entrega.cliente_nome)
    end
  );
end;
$$;

grant execute on function public.entrega_registrar(
  text, uuid, public.entrega_evento_tipo, public.entrega_motivo,
  text, text, numeric, numeric, numeric) to anon, authenticated;
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_registrar  query=<acima>
```

- [ ] **Step 3: Rodar o teste — não entregue vira dívida, e a hora é do servidor**

Antes de rodar, descubra um PIN válido de teste com:
`select display_name from staff_members where empresa_id is not null;`
e use o PIN de uma dessas pessoas (o do Henrique, se souber). Troque `'1234'` abaixo.

```sql
begin;
do $$
declare
  v_emp uuid; v_e uuid; v_r jsonb; v_ev public.entrega_eventos;
  v_pin text := '1234';   -- TROCAR por um PIN real da empresa
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, situacao)
  values (v_emp,'OR','ZZ-REG','ZZ CLIENTE','em_rota') returning id into v_e;

  -- sem motivo tem que recusar
  v_r := public.entrega_registrar(v_pin, v_e, 'nao_entregue');
  if (v_r->>'ok')::boolean then
    raise exception 'FAIL: aceitou nao entregue sem motivo';
  end if;

  -- com motivo tem que gravar e virar divida
  v_r := public.entrega_registrar(v_pin, v_e, 'nao_entregue', 'fechado');
  if not (v_r->>'ok')::boolean then
    raise exception 'FAIL: recusou um nao entregue valido: %', v_r->>'mensagem';
  end if;

  if (select situacao from entregas where id = v_e) <> 'nao_entregue' then
    raise exception 'FAIL: a entrega nao ficou como nao_entregue';
  end if;
  if (select tentativas from entregas where id = v_e) <> 1 then
    raise exception 'FAIL: nao contou a tentativa';
  end if;

  select * into v_ev from entrega_eventos where entrega_id = v_e;
  if v_ev.registrado_em is null or v_ev.registrado_em > now() then
    raise exception 'FAIL: registrado_em nao veio do servidor';
  end if;

  raise notice 'PASS: nao entregue exige motivo, conta tentativa e grava hora do servidor';
end $$;
rollback;
```

Esperado: `PASS: nao entregue exige motivo, conta tentativa e grava hora do servidor`

- [ ] **Step 4: Rodar o teste — entregue não pode ser registrado duas vezes**

```sql
begin;
do $$
declare v_emp uuid; v_e uuid; v_r jsonb;
  v_pin text := '1234';   -- TROCAR por um PIN real da empresa
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, situacao)
  values (v_emp,'OR','ZZ-REG2','ZZ CLIENTE 2','em_rota') returning id into v_e;

  v_r := public.entrega_registrar(v_pin, v_e, 'entregue', null, null, 'Dona Maria');
  if not (v_r->>'ok')::boolean then
    raise exception 'FAIL: recusou uma entrega valida: %', v_r->>'mensagem';
  end if;
  if (select quem_recebeu from entrega_eventos where entrega_id = v_e) <> 'Dona Maria' then
    raise exception 'FAIL: nao guardou quem recebeu';
  end if;

  v_r := public.entrega_registrar(v_pin, v_e, 'entregue');
  if (v_r->>'ok')::boolean then
    raise exception 'FAIL: deixou registrar a mesma entrega duas vezes';
  end if;

  raise notice 'PASS: entrega registrada uma vez so, com quem recebeu guardado';
end $$;
rollback;
```

Esperado: `PASS: entrega registrada uma vez so, com quem recebeu guardado`

- [ ] **Step 5: Commitar**

```bash
git add supabase/migrations/20261006136000_entregas_registrar.sql
git commit -m "feat(entregas): registrar entregue e nao entregue pelo PIN"
```

---

## Task 8: Leituras para as telas

**Files:**
- Create: `supabase/migrations/20261006137000_entregas_leituras.sql`

**Interfaces:**
- Consumes: tudo das tasks 1-7.
- Produces:
  - `public.entrega_fila(p_empresa_id uuid) returns jsonb` — o que falta entregar, com a dívida no topo
  - `public.entrega_rota_do_dia(p_empresa_id uuid, p_data date) returns jsonb` — tela da loja
  - `public.entrega_minha_rota(p_pin text, p_empresa_id uuid) returns jsonb` — tela do celular

- [ ] **Step 1: Escrever a migration**

```sql
-- Três leituras, três telas. A da loja e a da fila exigem gestor; a do celular
-- se identifica pelo PIN, porque o entregador não tem conta de painel.
--
-- A fila devolve o que não foi entregue antes no topo, com tentativas e motivo:
-- é exatamente o que some hoje quando ele volta e não avisa.

create or replace function public.entrega_fila(p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê a fila de entregas.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  select coalesce(jsonb_agg(x order by x.prioridade, x.bairro_ordem, x.cliente_nome), '[]'::jsonb)
  into v_res
  from (
    select e.id, e.documento_tipo, e.documento_numero, e.cliente_nome,
           e.cliente_telefone, e.valor, e.itens, e.situacao::text,
           e.tentativas,
           coalesce(b.nome, e.bairro_texto) as bairro,
           coalesce(b.ordem, 999999) as bairro_ordem,
           trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)) as endereco,
           e.entregar_em,
           -- quem já voltou sem entregar vem primeiro: é dívida
           case when e.situacao = 'nao_entregue' then 0 else 1 end as prioridade,
           (select ev.motivo::text from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultimo_motivo,
           (select ev.registrado_em from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultima_tentativa
    from entregas e
    left join entrega_bairros b on b.id = e.bairro_id
    where e.empresa_id = p_empresa_id
      and e.situacao in ('na_fila', 'nao_entregue')
  ) x;

  return v_res;
end;
$$;

create or replace function public.entrega_rota_do_dia(p_empresa_id uuid, p_data date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rota public.entrega_rotas; v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê a rota do dia.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  select * into v_rota from entrega_rotas
  where empresa_id = p_empresa_id and data = p_data;

  if v_rota.id is null then
    return jsonb_build_object('existe', false, 'data', p_data, 'paradas', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'existe', true,
    'rota_id', v_rota.id,
    'data', v_rota.data,
    'invertida', v_rota.invertida,
    'paradas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parada_id', p.id,
        'entrega_id', e.id,
        'ordem', p.ordem,
        'documento', e.documento_tipo || ' ' || e.documento_numero,
        'cliente_nome', e.cliente_nome,
        'cliente_telefone', e.cliente_telefone,
        'bairro', coalesce(b.nome, e.bairro_texto),
        'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
        'entregar_em', e.entregar_em,
        'itens', e.itens,
        'valor', e.valor,
        'situacao', e.situacao::text,
        'evento', (
          select jsonb_build_object(
            'tipo', ev.tipo::text,
            'motivo', ev.motivo::text,
            'motivo_texto', ev.motivo_texto,
            'quem_recebeu', ev.quem_recebeu,
            'hora', to_char(ev.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
            'lat', ev.lat, 'lng', ev.lng, 'precisao_m', ev.precisao_m,
            'ip', host(ev.ip))
          from entrega_eventos ev
          where ev.entrega_id = e.id order by ev.registrado_em desc limit 1)
      ) order by case when v_rota.invertida then -p.ordem else p.ordem end)
      from entrega_paradas p
      join entregas e on e.id = p.entrega_id
      left join entrega_bairros b on b.id = e.bairro_id
      where p.rota_id = v_rota.id
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

create or replace function public.entrega_minha_rota(p_pin text, p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_func uuid; v_amb boolean; v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rota public.entrega_rotas;
begin
  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(p_empresa_id, p_pin);

  if v_func is null then
    return jsonb_build_object('ok', false, 'mensagem', 'PIN não encontrado.');
  end if;
  if v_amb then
    return jsonb_build_object('ok', false,
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;
  select * into v_rota from entrega_rotas
  where empresa_id = p_empresa_id and data = v_hoje;

  if v_rota.id is null then
    return jsonb_build_object('ok', true, 'nome', v_nome,
      'mensagem', 'Nenhuma rota montada para hoje.', 'paradas', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'nome', v_nome,
    'rota_id', v_rota.id,
    'invertida', v_rota.invertida,
    'paradas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entrega_id', e.id,
        'ordem', p.ordem,
        'documento', e.documento_tipo || ' ' || e.documento_numero,
        'cliente_nome', e.cliente_nome,
        'cliente_telefone', e.cliente_telefone,
        'bairro', coalesce(b.nome, e.bairro_texto),
        'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
        'entregar_em', e.entregar_em,
        'itens', e.itens,
        'situacao', e.situacao::text
      ) order by case when v_rota.invertida then -p.ordem else p.ordem end)
      from entrega_paradas p
      join entregas e on e.id = p.entrega_id
      left join entrega_bairros b on b.id = e.bairro_id
      where p.rota_id = v_rota.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.entrega_fila(uuid)                to authenticated;
grant execute on function public.entrega_rota_do_dia(uuid, date)   to authenticated;
grant execute on function public.entrega_minha_rota(text, uuid)    to anon, authenticated;
```

- [ ] **Step 2: Aplicar**

```
mcp__claude_ai_Supabase__list_projects   → confirmar UBADESKLIMP
mcp__claude_ai_Supabase__apply_migration  name=entregas_leituras  query=<acima>
```

- [ ] **Step 3: Rodar o teste — a dívida vem no topo da fila**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare v_emp uuid; v_fila jsonb; v_primeiro text;
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  -- nova, num bairro do extremo norte (ordem baixa)
  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_id, situacao)
  values (v_emp,'OR','ZZ-F-NOVA','ZZ NOVA NORTE',
          (select id from entrega_bairros where nome='Picinguaba' and empresa_id=v_emp), 'na_fila');

  -- divida, num bairro do extremo sul (ordem alta) — mesmo assim tem que vir antes
  insert into entregas (empresa_id, documento_tipo, documento_numero, cliente_nome, bairro_id, situacao, tentativas)
  values (v_emp,'OR','ZZ-F-DIVIDA','ZZ DIVIDA SUL',
          (select id from entrega_bairros where nome='Maranduba' and empresa_id=v_emp), 'nao_entregue', 1);

  v_fila := public.entrega_fila(v_emp);
  v_primeiro := v_fila->0->>'cliente_nome';

  if v_primeiro <> 'ZZ DIVIDA SUL' then
    raise exception 'FAIL: a divida deveria vir no topo da fila, veio %', v_primeiro;
  end if;
  raise notice 'PASS: entrega que voltou sem ser entregue aparece no topo';
end $$;
rollback;
```

Esperado: `PASS: entrega que voltou sem ser entregue aparece no topo`

- [ ] **Step 4: Commitar**

```bash
git add supabase/migrations/20261006137000_entregas_leituras.sql
git commit -m "feat(entregas): leituras da fila, da rota do dia e do celular"
```

---

## Task 9: Teste de ponta a ponta

**Files:**
- Nenhum arquivo novo. Script de verificação rodado via `execute_sql`.

**Interfaces:**
- Consumes: todas as funções das tasks 5-8.

- [ ] **Step 1: Rodar o caminho inteiro, do Excel até a rota de amanhã**

Troque `'1234'` pelo PIN real antes de rodar.

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"8dc81b79-08d7-4279-9454-05852f34a507","role":"authenticated"}';

do $$
declare
  v_emp uuid; v_linhas jsonb; v_imp jsonb; v_rota jsonb; v_rid uuid;
  v_e1 uuid; v_e2 uuid; v_reg jsonb; v_fila jsonb;
  v_pin text := '1234';   -- TROCAR
begin
  select id into v_emp from empresas where ativo order by created_at limit 1;

  -- 1. chega o Excel com duas entregas
  v_linhas := jsonb_build_array(
    jsonb_build_object('documento_tipo','OR','documento_numero','ZZ-E2E-1',
      'cliente_nome','ZZ WIMBLEDON','bairro','TONINHAS',
      'endereco_logradouro','R IDALINA GRACA','endereco_numero','25'),
    jsonb_build_object('documento_tipo','OR','documento_numero','ZZ-E2E-2',
      'cliente_nome','ZZ PICINGUABA','bairro','PICINGUABA')
  );
  v_imp := public.entrega_importar_lote(v_emp, v_linhas);
  if (v_imp->>'criadas')::int <> 2 then
    raise exception 'FAIL: importacao criou % em vez de 2', v_imp->>'criadas';
  end if;

  select id into v_e1 from entregas where empresa_id=v_emp and documento_numero='ZZ-E2E-1';
  select id into v_e2 from entregas where empresa_id=v_emp and documento_numero='ZZ-E2E-2';

  -- 2. monta a rota: Picinguaba (norte) antes de Toninhas (sul)
  v_rota := public.entrega_montar_rota(v_emp, '2099-04-04', array[v_e1, v_e2]);
  v_rid := (v_rota->>'rota_id')::uuid;
  if (select e.cliente_nome from entrega_paradas p join entregas e on e.id=p.entrega_id
      where p.rota_id=v_rid order by p.ordem limit 1) <> 'ZZ PICINGUABA' then
    raise exception 'FAIL: a rota nao comecou pelo norte';
  end if;

  -- 3. uma entregue, uma fechada
  v_reg := public.entrega_registrar(v_pin, v_e2, 'entregue', null, null, 'Porteiro Jose',
                                    -23.3661, -44.8378, 12.5);
  if not (v_reg->>'ok')::boolean then
    raise exception 'FAIL: nao registrou a entrega: %', v_reg->>'mensagem';
  end if;

  v_reg := public.entrega_registrar(v_pin, v_e1, 'nao_entregue', 'fechado');
  if not (v_reg->>'ok')::boolean then
    raise exception 'FAIL: nao registrou o nao entregue: %', v_reg->>'mensagem';
  end if;

  -- 4. a fila de amanha tem so a que voltou, e ela esta no topo
  v_fila := public.entrega_fila(v_emp);
  if not exists (select 1 from jsonb_array_elements(v_fila) f
                 where f->>'cliente_nome' = 'ZZ WIMBLEDON') then
    raise exception 'FAIL: a entrega que voltou nao esta na fila';
  end if;
  if exists (select 1 from jsonb_array_elements(v_fila) f
             where f->>'cliente_nome' = 'ZZ PICINGUABA') then
    raise exception 'FAIL: a entrega ja entregue continua na fila';
  end if;

  -- 5. reimportar o mesmo Excel nao ressuscita a entregue
  perform public.entrega_importar_lote(v_emp, v_linhas);
  if (select situacao from entregas where id = v_e2) <> 'entregue' then
    raise exception 'FAIL: reimportar devolveu a entrega concluida para a fila';
  end if;

  raise notice 'PASS: ciclo completo — importa, monta rota, entrega, volta divida, reimporta sem estragar';
end $$;
rollback;
```

Esperado: `PASS: ciclo completo — importa, monta rota, entrega, volta divida, reimporta sem estragar`

- [ ] **Step 2: Conferir que nada de teste ficou no banco**

```sql
select count(*) as sobrou_entrega_de_teste from entregas where documento_numero like 'ZZ-%';
select count(*) as sobrou_rota_de_teste    from entrega_rotas where data >= '2099-01-01';
```

Esperado: `0` nas duas. Se não for zero, apagar **com o filtro explícito**:

```sql
delete from entrega_paradas where entrega_id in (select id from entregas where documento_numero like 'ZZ-%');
delete from entregas where documento_numero like 'ZZ-%';
delete from entrega_rotas where data >= '2099-01-01';
```

- [ ] **Step 3: Conferir que o dono revisou os bairros**

```sql
select ordem, nome from entrega_bairros order by ordem;
```

Mostrar a lista ao dono e **esperar o OK dele** antes de considerar a etapa pronta. Bairro
na posição errada faz a rota sair errada todo dia sem ninguém perceber.

- [ ] **Step 4: Commitar o fechamento da etapa**

```bash
git add -A supabase/migrations docs/superpowers/plans
git commit -m "test(entregas): ciclo completo do modulo de entregas passando"
```

---

## Uma coisa que ficou de fora de propósito

**O aparelho não é amarrado nesta etapa.** O módulo Ponto exige celular aprovado pelo
gestor (`ponto_dispositivos`) além do PIN; aqui só o PIN identifica.

O motivo: no Ponto a amarração existe para impedir que alguém bata o ponto de casa. Na
entrega, o celular já está na rua por definição — o que prende o registro ao mundo real é
a hora e o IP, não o aparelho. Amarrar o dispositivo custaria um passo de aprovação toda
vez que ele trocar de celular ou limpar o navegador, para resolver um risco menor: alguém
que soubesse o PIN dele marcar entrega de outro aparelho.

Se isso virar problema, o caminho é curto — `entrega_registrar` passa a receber o
`device_id` e consultar `ponto_dispositivos`, sem mexer em tabela nenhuma. Decidir agora
seria encarecer a Etapa 1 por um risco que ainda não apareceu.

## Depois desta etapa

Etapa 2 — telas: importar o Excel (upload e conferência), montar a rota do dia na loja,
a tela do celular do Henrique, e a tela ao vivo. A tela do celular precisa do aviso de
localização em texto, conforme a spec.

Etapa 3 — ler o arquivo do ERP de verdade, quando o Excel de exemplo chegar. Até lá a
`entrega_importar_lote` recebe o JSON já normalizado e quem normaliza é o front.
