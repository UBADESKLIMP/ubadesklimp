# Papéis, permissões e cadastro de funcionários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o admin/não-admin binário atual por um sistema de permissões por seção (`faltantes`/`produtos`/`fornecedores`/`financeiro`) construído do zero, com funcionários cadastrados pelo Admin usando usuário+senha (sem e-mail), e corrigir o travamento do `ProtectedRoute` quando a rota exige acesso e o usuário não está logado.

**Architecture:** Duas tabelas novas (`staff_members`, `staff_permissions`) substituem o uso de `user_roles`/`has_role()` em todo RLS relevante, através de duas funções `SECURITY DEFINER` (`is_staff_admin()`, `has_staff_permission()`). Login de funcionário usa um e-mail sintético determinístico (`{usuario}@equipe.ubadesklimp.internal`) gerado no cliente a partir do nome de usuário — sem round-trip ao banco antes de logar. Criar/excluir funcionário exige `service_role` (não pode ser feito como um signup comum, que trocaria a sessão do admin pela do funcionário no navegador), então passa por duas Edge Functions.

**Tech Stack:** Igual ao resto do projeto — React + TypeScript + Vite + Supabase (Postgres/RLS/Auth/Edge Functions em Deno) + shadcn/ui + Zod.

## Global Constraints

- Este é o projeto Supabase de produção real (`ccrucholgsffichvzbpz`) — não existe projeto de QA separado.
- Não existe suíte de testes automatizada neste repositório. Verificação de código: `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`). **`npm run build` NÃO faz checagem de tipo neste projeto** (só transpila) — não usar como evidência de tipo correto.
- **Aplicar a migration e fazer deploy das Edge Functions contra o banco real são passos que o controller (sessão principal) executa diretamente via MCP do Supabase, não um subagente implementador.** Cada uma dessas tarefas abaixo diz explicitamente quando isso se aplica.
- `src/integrations/supabase/types.ts` é gerado automaticamente — depois de aplicar a migration, o controller regenera esse arquivo via MCP (`generate_typescript_types`) antes de qualquer tarefa que use `staff_members`/`staff_permissions` no código TypeScript, senão o Supabase client não infere os tipos dessas tabelas novas.
- Classes do Tailwind não podem ser montadas em runtime por interpolação de string (`` `grid-cols-${n}` ``) — o compilador do Tailwind só reconhece classes literais no código-fonte. Onde o número de colunas variar em runtime, usar `style={{ gridTemplateColumns: ... }}` em vez de uma classe dinâmica.
- `staff_permissions` só tem sentido pra quem não é admin — administradores sempre têm acesso total, independente de qualquer linha em `staff_permissions`.
- `user_roles`/`app_role`/`has_role()` continuam existindo no banco (não apagar) mas nenhum código novo deve depender deles — são legado congelado, a ser removido numa limpeza futura confirmada separadamente.
- Strings visíveis ao usuário em português, seguindo o padrão do resto do repositório.
- Cada tarefa termina com commit próprio.

---

### Task 1: Escrever a migration SQL (schema, funções, gatilhos, RLS)

**Files:**
- Create: `supabase/migrations/20260805120000_staff_roles_permissions.sql`

- [ ] **Step 1: Escrever o arquivo da migration**

```sql
-- Papéis/permissões de equipe, construídos do zero (independente do projeto Compras).
-- staff_members: quem é da equipe e se é admin (admin sempre tem acesso total).
-- staff_permissions: permissões extras por seção, só relevantes pra quem não é admin.

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.staff_permission as enum ('faltantes', 'produtos', 'fornecedores', 'financeiro');

create table public.staff_permissions (
  user_id uuid not null references public.staff_members(user_id) on delete cascade,
  permission public.staff_permission not null,
  primary key (user_id, permission)
);

alter table public.staff_members enable row level security;
alter table public.staff_permissions enable row level security;

-- SECURITY DEFINER: evita recursão de RLS ao consultar staff_members de dentro
-- de policies de outras tabelas (mesmo padrão que has_role() já usa no projeto).
create or replace function public.is_staff_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from public.staff_members where user_id = auth.uid()), false)
$$;

create or replace function public.has_staff_permission(perm public.staff_permission)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    public.is_staff_admin()
    or exists (
      select 1 from public.staff_permissions
      where user_id = auth.uid() and permission = perm
    )
$$;

-- staff_members: só admin gerencia; qualquer membro autenticado lê a própria linha
-- (o hook useStaffAccess do cliente precisa disso pra saber o que o usuário pode ver).
create policy "Admins podem gerenciar staff_members"
  on public.staff_members for all
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

create policy "Usuário vê a própria linha de staff_members"
  on public.staff_members for select
  using (auth.uid() = user_id);

create policy "Admins podem gerenciar staff_permissions"
  on public.staff_permissions for all
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

create policy "Usuário vê as próprias permissões"
  on public.staff_permissions for select
  using (auth.uid() = user_id);

-- E-mail automático em profiles no cadastro (hoje só é preenchido se o cliente
-- mexer na própria tela de Perfil — sem isso não dá pra buscar funcionário por
-- e-mail de forma confiável na tela de Funcionários).
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Gatilho de bootstrap existente (promove o primeiro usuário a admin) passa a
-- escrever em staff_members em vez de user_roles.
create or replace function public.promote_first_user_to_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_members where is_admin = true) then
    insert into public.staff_members (user_id, is_admin, display_name)
    values (new.id, true, coalesce(new.email, 'admin'));
  end if;
  return new;
end;
$$;

-- Migra o(s) admin(s) atual(is) de user_roles pra staff_members.
insert into public.staff_members (user_id, is_admin, display_name)
select ur.user_id, true, coalesce(p.email, 'admin')
from public.user_roles ur
left join public.profiles p on p.user_id = ur.user_id
where ur.role = 'admin'
on conflict (user_id) do nothing;

-- Troca has_role(uid,'admin') por is_staff_admin()/has_staff_permission(...)
-- nas policies que existem hoje. Nomes de policy mantidos onde possível.

drop policy "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories
  for all using (public.has_staff_permission('produtos'));

drop policy "Admins can manage product variations" on public.product_variations;
create policy "Admins can manage product variations" on public.product_variations
  for all using (public.has_staff_permission('produtos'));

drop policy "Admins can manage product_fragrances" on public.product_fragrances;
create policy "Admins can manage product_fragrances" on public.product_fragrances
  for all using (public.has_staff_permission('produtos'));

drop policy "Apenas admins autenticados podem gerenciar produtos" on public.products;
create policy "Apenas admins autenticados podem gerenciar produtos" on public.products
  for all
  using (public.has_staff_permission('produtos'))
  with check (public.has_staff_permission('produtos'));

drop policy "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders
  for all using (public.has_staff_permission('financeiro'));

drop policy "Guest orders are only visible to admins" on public.orders;
create policy "Guest orders are only visible to admins" on public.orders
  for select using (user_id is null and public.has_staff_permission('financeiro'));

-- profiles fica admin-only (dado de cliente/PII, não faz parte das 4 permissões
-- de seção) — decisão explícita, não uma omissão.
drop policy "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles" on public.profiles
  for all using (public.is_staff_admin());

drop policy "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (auth.uid() = user_id or public.is_staff_admin());

drop policy "Admins podem fazer upload de imagens de produtos" on storage.objects;
create policy "Admins podem fazer upload de imagens de produtos" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.has_staff_permission('produtos'));

drop policy "Admins podem atualizar imagens de produtos" on storage.objects;
create policy "Admins podem atualizar imagens de produtos" on storage.objects
  for update using (bucket_id = 'product-images' and public.has_staff_permission('produtos'));

drop policy "Admins podem deletar imagens de produtos" on storage.objects;
create policy "Admins podem deletar imagens de produtos" on storage.objects
  for delete using (bucket_id = 'product-images' and public.has_staff_permission('produtos'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260805120000_staff_roles_permissions.sql
git commit -m "feat(db): add staff_members/staff_permissions schema and RLS (not yet applied)"
```

Este commit só adiciona o arquivo — a migration ainda não foi rodada contra o banco. Isso acontece na Task 2, fora do fluxo de subagente.

---

### Task 2 (controller, não delegar): Aplicar a migration e regenerar os tipos

Esta tarefa NÃO é executada por um subagente implementador — é o controller (sessão principal) rodando diretamente contra o projeto Supabase real `ccrucholgsffichvzbpz`, porque envolve DDL em produção e criação de função `SECURITY DEFINER`.

- [ ] **Step 1: Aplicar a migration**

Usar a ferramenta MCP `apply_migration` (`project_id: ccrucholgsffichvzbpz`, `name: staff_roles_permissions`, `query`: o conteúdo exato do arquivo da Task 1).

- [ ] **Step 2: Conferir a migração dos dados**

Rodar via `execute_sql`:
```sql
select sm.user_id, sm.is_admin, sm.display_name,
  (select count(*) from public.staff_permissions sp where sp.user_id = sm.user_id) as permission_count
from public.staff_members sm;
```
Esperado: pelo menos 1 linha com `is_admin = true` (o admin atual migrado de `user_roles`).

- [ ] **Step 3: Regenerar os tipos TypeScript**

Usar a ferramenta MCP `generate_typescript_types` (`project_id: ccrucholgsffichvzbpz`) e sobrescrever `src/integrations/supabase/types.ts` com o resultado.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: regenerate Supabase types after staff roles migration"
```

---

### Task 3: Edge Function `criar-funcionario`

**Files:**
- Create: `supabase/functions/criar-funcionario/index.ts`

**Interfaces:**
- Produces: endpoint invocado via `supabase.functions.invoke('criar-funcionario', { body: { username, password, displayName?, isAdmin, permissions } })`, retorna `{ userId, username, displayName }` em sucesso ou `{ error: string }` com status 4xx/5xx.

- [ ] **Step 1: Escrever o arquivo**

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STAFF_EMAIL_DOMAIN = "equipe.ubadesklimp.internal";
const VALID_PERMISSIONS = ["faltantes", "produtos", "fornecedores", "financeiro"];

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerStaff } = await adminClient
    .from("staff_members")
    .select("is_admin")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (!callerStaff?.is_admin) {
    return jsonResponse({ error: "Apenas administradores podem criar funcionários" }, 403);
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" && body.displayName.trim()
    ? body.displayName.trim()
    : username;
  const isAdminFlag = body?.isAdmin === true;
  const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : [];

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return jsonResponse(
      { error: "Nome de usuário precisa ter 3-32 caracteres (letras, números, ponto, traço)." },
      400,
    );
  }
  if (!password || password.length < 4) {
    return jsonResponse({ error: "Senha precisa ter pelo menos 4 caracteres." }, 400);
  }

  const syntheticEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    const message = createError?.message?.includes("already been registered")
      ? "Esse nome de usuário já está em uso."
      : createError?.message ?? "Não foi possível criar o funcionário.";
    return jsonResponse({ error: message }, 400);
  }

  const newUserId = created.user.id;

  const { error: staffError } = await adminClient.from("staff_members").insert({
    user_id: newUserId,
    is_admin: isAdminFlag,
    display_name: displayName,
  });

  if (staffError) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: `Não foi possível salvar o funcionário: ${staffError.message}` }, 500);
  }

  if (!isAdminFlag && permissions.length > 0) {
    const rows = permissions
      .filter((permission) => VALID_PERMISSIONS.includes(permission))
      .map((permission) => ({ user_id: newUserId, permission }));

    if (rows.length > 0) {
      const { error: permError } = await adminClient.from("staff_permissions").insert(rows);
      if (permError) {
        await adminClient.from("staff_members").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        return jsonResponse({ error: `Não foi possível salvar as permissões: ${permError.message}` }, 500);
      }
    }
  }

  return jsonResponse({ userId: newUserId, username, displayName }, 200);
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/criar-funcionario/index.ts
git commit -m "feat(edge-function): add criar-funcionario (not yet deployed)"
```

Deploy real acontece na Task 5, junto com a segunda function — não delegar deploy a subagente (ver Global Constraints).

---

### Task 4: Edge Function `excluir-funcionario`

**Files:**
- Create: `supabase/functions/excluir-funcionario/index.ts`

**Interfaces:**
- Produces: endpoint invocado via `supabase.functions.invoke('excluir-funcionario', { body: { userId } })`, retorna `{ success: true }` ou `{ error: string }`.

- [ ] **Step 1: Escrever o arquivo**

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerStaff } = await adminClient
    .from("staff_members")
    .select("is_admin")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (!callerStaff?.is_admin) {
    return jsonResponse({ error: "Apenas administradores podem excluir funcionários" }, 403);
  }

  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";

  if (!targetUserId) {
    return jsonResponse({ error: "userId é obrigatório" }, 400);
  }
  if (targetUserId === caller.id) {
    return jsonResponse({ error: "Você não pode excluir a si mesmo." }, 400);
  }

  // staff_members/staff_permissions têm ON DELETE CASCADE a partir de
  // auth.users, então apagar o usuário já limpa as duas tabelas.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ success: true }, 200);
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/excluir-funcionario/index.ts
git commit -m "feat(edge-function): add excluir-funcionario (not yet deployed)"
```

---

### Task 5 (controller, não delegar): Deploy das Edge Functions

Não delegar a um subagente — as functions rodam com `service_role` contra o projeto real.

- [ ] **Step 1: Deploy de `criar-funcionario`**

Usar a ferramenta MCP `deploy_edge_function` (`project_id: ccrucholgsffichvzbpz`, `name: criar-funcionario`, `entrypoint_path: index.ts`, `verify_jwt: true`, `files`: conteúdo do arquivo da Task 3).

- [ ] **Step 2: Deploy de `excluir-funcionario`**

Mesma ferramenta, `name: excluir-funcionario`, conteúdo do arquivo da Task 4.

- [ ] **Step 3: Testar via SQL/REST que as functions existem**

Usar `list_edge_functions` (`project_id: ccrucholgsffichvzbpz`) e confirmar as duas na lista com status `ACTIVE`. Teste funcional completo de ponta a ponta fica pra Task 12 (depois que a UI existir).

---

### Task 6: `src/hooks/useStaffAccess.ts` (novo)

**Files:**
- Create: `src/hooks/useStaffAccess.ts`

**Interfaces:**
- Consumes: `useAuth()` de `@/contexts/AuthContext` (só o `user`), tabelas `staff_members`/`staff_permissions` (precisa da Task 2 já aplicada e dos tipos regenerados).
- Produces: `useStaffAccess(): { loading: boolean; isStaff: boolean; isAdmin: boolean; permissions: Set<StaffPermission> }`, tipo `StaffPermission = 'faltantes' | 'produtos' | 'fornecedores' | 'financeiro'` — usado pelas Tasks 7 (ProtectedRoute), 9 (Header), 11 (Admin.tsx).

- [ ] **Step 1: Criar o arquivo**

```ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type StaffPermission = 'faltantes' | 'produtos' | 'fornecedores' | 'financeiro';

interface StaffAccess {
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  permissions: Set<StaffPermission>;
}

const EMPTY_ACCESS: Omit<StaffAccess, 'loading'> = {
  isStaff: false,
  isAdmin: false,
  permissions: new Set(),
};

export const useStaffAccess = (): StaffAccess => {
  const { user } = useAuth();
  const [access, setAccess] = useState<StaffAccess>({ loading: true, ...EMPTY_ACCESS });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY_ACCESS });
        return;
      }

      setAccess((prev) => ({ ...prev, loading: true }));

      const { data: member } = await supabase
        .from('staff_members')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY_ACCESS });
        return;
      }

      const { data: permissionRows } = await supabase
        .from('staff_permissions')
        .select('permission')
        .eq('user_id', user.id);

      if (!cancelled) {
        setAccess({
          loading: false,
          isStaff: true,
          isAdmin: member.is_admin,
          permissions: new Set((permissionRows || []).map((row) => row.permission as StaffPermission)),
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return access;
};
```

Nota (não corrigir agora, só ciente): este hook não usa cache — cada componente que o chama (`Header`, `ProtectedRoute`, `Admin`) faz sua própria busca ao montar. Aceitável para o volume de dados aqui (2 linhas pequenas); virar um Context compartilhado é uma otimização futura, não necessária agora.

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erros (a Task 2 já deve ter regenerado os tipos com `staff_members`/`staff_permissions`; se faltou, este passo vai falhar e sinaliza isso).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStaffAccess.ts
git commit -m "feat(hooks): add useStaffAccess"
```

---

### Task 7: `src/components/ProtectedRoute.tsx` — corrigir travamento + suportar permissão por seção

**Files:**
- Modify: `src/components/ProtectedRoute.tsx` (reescrita completa, 112 linhas hoje)

**Interfaces:**
- Consumes: `useStaffAccess` de `@/hooks/useStaffAccess` (Task 6).
- Produces: `<ProtectedRoute requireAdmin? requireStaff? requirePermission?>` — usado pelas Tasks 8 (App.tsx) e futuras telas (D, fora desta spec).

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAccess, StaffPermission } from '@/hooks/useStaffAccess';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStaff?: boolean;
  requirePermission?: StaffPermission;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireStaff = false,
  requirePermission,
}) => {
  const { user, loading: authLoading } = useAuth();
  const needsStaffCheck = requireAdmin || requireStaff || !!requirePermission;
  const staffAccess = useStaffAccess();

  const stillChecking = authLoading || (needsStaffCheck && !!user && staffAccess.loading);

  if (stillChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasAccess =
    !needsStaffCheck ||
    staffAccess.isAdmin ||
    (requireStaff && staffAccess.isStaff) ||
    (requirePermission !== undefined && staffAccess.permissions.has(requirePermission));

  if (needsStaffCheck && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center text-white max-w-md">
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="mb-6">Você não tem permissão para acessar esta página.</p>
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 bg-white text-primary rounded-lg hover:bg-white/90 transition-colors"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

A correção do bug original está na condição `stillChecking`: antes, com `requireAdmin=true` e `user=null`, `adminCheckLoading` nunca virava `false` (nenhum dos dois `useEffect` cobria esse caso), travando o spinner pra sempre. Agora `stillChecking` só depende do estado real de `staffAccess.loading` quando existe um `user` — sem usuário, cai direto no `if (!user) return <Navigate ...>` logo abaixo.

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: pode aparecer erro em `src/App.tsx` (ainda usa `requireAdmin` na rota `/admin`, o que continua válido — mas confira se não há erro de fato; se houver, é esperado até a Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/ProtectedRoute.tsx
git commit -m "fix(auth): stop ProtectedRoute hanging when unauthenticated, add permission-based gating"
```

---

### Task 8: `src/App.tsx` — rota `/admin` passa a exigir "é da equipe", não "é admin"

**Files:**
- Modify: `src/App.tsx:56-63`

**Interfaces:**
- Consumes: `requireStaff` de `ProtectedRoute` (Task 7).

- [ ] **Step 1: Trocar `requireAdmin` por `requireStaff` na rota `/admin`**

Trocar:
```tsx
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
```
por:
```tsx
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute requireStaff>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
```

Isso libera a rota pra qualquer funcionário (não só admin) — o controle fino de qual aba cada um vê acontece dentro de `Admin.tsx` (Task 11).

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(auth): open /admin to any staff member, not just admins"
```

---

### Task 9: `src/contexts/AuthContext.tsx` — login com usuário OU e-mail, `isAdmin()` via `staff_members`

**Files:**
- Modify: `src/contexts/AuthContext.tsx:1-4` (imports não mudam, mas a função nova entra antes do `AuthProvider`), `:79-99` (`signIn`), `:109-120` (`isAdmin`)

- [ ] **Step 1: Adicionar a resolução de e-mail sintético**

Logo abaixo dos imports (linha 4), antes de `const AuthContext = ...`:

```ts
const STAFF_EMAIL_DOMAIN = 'equipe.ubadesklimp.internal';

// Login de funcionário usa um "usuário" (ex. "leticia"), sem e-mail de verdade.
// Resolve pra um e-mail sintético determinístico, sem round-trip ao banco.
const resolveLoginEmail = (identifier: string): string => {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
};
```

- [ ] **Step 2: Usar a resolução dentro de `signIn`**

Trocar (linhas 79–83):
```ts
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
```
por:
```ts
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(email),
      password,
    });
```

(o parâmetro continua se chamando `email` pra não mudar a assinatura pública de `signIn` — quem chama passa o que o usuário digitou, seja e-mail ou nome de usuário).

- [ ] **Step 3: Trocar `isAdmin()` para consultar `staff_members`**

Trocar (linhas 109–120):
```ts
  const isAdmin = async (): Promise<boolean> => {
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    return !error && !!data;
  };
```
por:
```ts
  const isAdmin = async (): Promise<boolean> => {
    if (!user) return false;

    const { data, error } = await supabase
      .from('staff_members')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    return !error && !!data?.is_admin;
  };
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat(auth): support username login for staff, check isAdmin via staff_members"
```

---

### Task 10: `src/pages/Auth.tsx` + `src/lib/validations.ts` — campo de login único

**Files:**
- Modify: `src/lib/validations.ts` (adicionar `loginSchema`), `src/pages/Auth.tsx:15-23` (estado), `:30-52` (`handleSubmit`), `:115-137` (formulário de login)

**Interfaces:**
- Consumes: `resolveLoginEmail` já embutido em `AuthContext.signIn` (Task 9) — este arquivo só precisa mandar o texto digitado, sem resolver nada aqui.

- [ ] **Step 1: Adicionar `loginSchema` em `validations.ts`**

No fim do arquivo, junto aos outros `export type ... = z.infer<...>` (perto da linha 145), adicionar antes deles:

```ts
// Login aceita e-mail (cliente) ou nome de usuário (funcionário) no mesmo
// campo — por isso não usa .email() aqui como authSchema usa pro cadastro.
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Informe seu e-mail ou usuário').max(255, 'Muito longo'),
  password: z.string().min(1, 'Senha é obrigatória').max(100, 'Senha muito longa'),
});
```

E adicionar à lista de exports de tipo:
```ts
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Ajustar o estado e o import em `Auth.tsx`**

Trocar (linha 12):
```ts
import { authSchema, signUpSchema } from '@/lib/validations';
```
por:
```ts
import { loginSchema, signUpSchema } from '@/lib/validations';
```

Trocar (linhas 19–23):
```ts
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
```
por:
```ts
  const [formData, setFormData] = useState({
    identifier: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
```

(`identifier` é só do login; `email` continua exclusivo do cadastro, que precisa mesmo de e-mail real.)

- [ ] **Step 3: Ajustar `handleSubmit`**

Trocar (linhas 34–40):
```ts
    try {
      if (type === 'signin') {
        authSchema.parse({ email: formData.email, password: formData.password });
      } else {
        signUpSchema.parse(formData);
      }
    } catch (error) {
```
por:
```ts
    try {
      if (type === 'signin') {
        loginSchema.parse({ identifier: formData.identifier, password: formData.password });
      } else {
        signUpSchema.parse(formData);
      }
    } catch (error) {
```

Trocar (linha 58):
```ts
        await signIn(formData.email, formData.password);
```
por:
```ts
        await signIn(formData.identifier, formData.password);
```

- [ ] **Step 4: Ajustar o campo no formulário de login**

Trocar o bloco do campo de login (linhas 123–137):
```tsx
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                    {validationErrors.email && (
                      <p className="text-sm text-destructive">{validationErrors.email}</p>
                    )}
                  </div>
```
por:
```tsx
                  <div className="space-y-2">
                    <Label htmlFor="identifier">E-mail ou usuário</Label>
                    <Input
                      id="identifier"
                      name="identifier"
                      type="text"
                      placeholder="seu@email.com ou usuário"
                      value={formData.identifier}
                      onChange={handleInputChange}
                      required
                    />
                    {validationErrors.identifier && (
                      <p className="text-sm text-destructive">{validationErrors.identifier}</p>
                    )}
                  </div>
```

O formulário de cadastro (linhas 172–228) não muda — continua usando `formData.email`/`authSchema`-via-`signUpSchema` normalmente, exigindo e-mail de verdade (funcionário nunca passa por esse formulário).

- [ ] **Step 5: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations.ts src/pages/Auth.tsx
git commit -m "feat(auth): accept username or email in a single login field"
```

---

### Task 11: `src/components/Header.tsx` — link do admin visível pra qualquer funcionário

**Files:**
- Modify: `src/components/Header.tsx:1-18` (imports/estado), `:38-54` (efeito de checagem removido), `:145`, `:239` (troca `isUserAdmin` por `isStaff`)

**Interfaces:**
- Consumes: `useStaffAccess` de `@/hooks/useStaffAccess` (Task 6).

- [ ] **Step 1: Trocar o import e o estado local**

Trocar (linha 6):
```tsx
import { useAuth } from '@/contexts/AuthContext';
```
por:
```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAccess } from '@/hooks/useStaffAccess';
```

Trocar (linhas 14–18):
```tsx
  const { user, signOut, loading, isAdmin } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const isAutomotivoPage = location.pathname === '/automotivo';
  const [isUserAdmin, setIsUserAdmin] = useState(false);
```
por:
```tsx
  const { user, signOut, loading } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const isAutomotivoPage = location.pathname === '/automotivo';
  const { isStaff } = useStaffAccess();
```

- [ ] **Step 2: Remover o efeito de checagem de admin (agora redundante)**

Remover o bloco (linhas 38–54):
```tsx
  // Check if user is admin when component mounts and user changes
  useEffect(() => {
    const checkAdmin = async () => {
      if (user && isAdmin) {
        try {
          const adminStatus = await isAdmin();
          setIsUserAdmin(adminStatus);
        } catch (error) {
          setIsUserAdmin(false);
        }
      } else {
        setIsUserAdmin(false);
      }
    };

    checkAdmin();
  }, [user, isAdmin]);

```

- [ ] **Step 3: Trocar as duas referências a `isUserAdmin` por `isStaff`**

Nas linhas 145 e 239 (`{isUserAdmin && (`), trocar `isUserAdmin` por `isStaff` nas duas ocorrências.

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: sem erros. Se `useState`/`useEffect` ficarem sem outro uso no arquivo depois dessa remoção, confirme que ainda são usados em outro lugar (são — `isMenuOpen`/`isScrolled` no topo do componente) antes de mexer no import de `react`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(header): show admin link to any staff member via useStaffAccess"
```

---

### Task 12: `src/hooks/useStaffMembers.ts` (novo) — CRUD de funcionários

**Files:**
- Create: `src/hooks/useStaffMembers.ts`

**Interfaces:**
- Consumes: `StaffPermission` de `@/hooks/useStaffAccess` (Task 6), Edge Functions `criar-funcionario`/`excluir-funcionario` (Tasks 3-5, já implantadas).
- Produces: `useStaffMembers()` retornando `{ staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember, refetch }` — consumido pela Task 13 (`StaffManager.tsx`).

- [ ] **Step 1: Criar o arquivo**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { StaffPermission } from '@/hooks/useStaffAccess';

export interface StaffMember {
  user_id: string;
  is_admin: boolean;
  display_name: string;
  created_at: string;
  permissions: StaffPermission[];
}

export const useStaffMembers = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResult, permissionsResult] = await Promise.all([
        supabase
          .from('staff_members')
          .select('user_id,is_admin,display_name,created_at')
          .order('created_at', { ascending: true }),
        supabase.from('staff_permissions').select('user_id,permission'),
      ]);

      if (membersResult.error) throw membersResult.error;

      const permissionsByUser = new Map<string, StaffPermission[]>();
      (permissionsResult.data || []).forEach((row) => {
        const list = permissionsByUser.get(row.user_id) || [];
        list.push(row.permission as StaffPermission);
        permissionsByUser.set(row.user_id, list);
      });

      setStaffMembers(
        (membersResult.data || []).map((member) => ({
          ...member,
          permissions: permissionsByUser.get(member.user_id) || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching staff members:', error);
      toast({
        title: 'Erro ao carregar funcionários',
        description: 'Não foi possível carregar a lista de funcionários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createStaffMember = async (input: {
    username: string;
    password: string;
    displayName?: string;
    isAdmin: boolean;
    permissions: StaffPermission[];
  }) => {
    const { data, error } = await supabase.functions.invoke('criar-funcionario', {
      body: input,
    });

    if (error) {
      const message = (data as { error?: string } | null)?.error || error.message;
      toast({ title: 'Erro ao criar funcionário', description: message, variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Funcionário criado', description: `${input.username} já pode fazer login.` });
    await fetchStaffMembers();
    return data;
  };

  const updatePermissions = async (userId: string, isAdmin: boolean, permissions: StaffPermission[]) => {
    try {
      const { error: memberError } = await supabase
        .from('staff_members')
        .update({ is_admin: isAdmin })
        .eq('user_id', userId);
      if (memberError) throw memberError;

      const { error: deleteError } = await supabase.from('staff_permissions').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;

      if (!isAdmin && permissions.length > 0) {
        const { error: insertError } = await supabase
          .from('staff_permissions')
          .insert(permissions.map((permission) => ({ user_id: userId, permission })));
        if (insertError) throw insertError;
      }

      toast({ title: 'Permissões atualizadas' });
      await fetchStaffMembers();
    } catch (error) {
      console.error('Error updating staff permissions:', error);
      toast({
        title: 'Erro ao atualizar permissões',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteStaffMember = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('excluir-funcionario', {
      body: { userId },
    });

    if (error) {
      const message = (data as { error?: string } | null)?.error || error.message;
      toast({ title: 'Erro ao excluir funcionário', description: message, variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Funcionário excluído' });
    await fetchStaffMembers();
  };

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  return { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember, refetch: fetchStaffMembers };
};
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStaffMembers.ts
git commit -m "feat(hooks): add useStaffMembers CRUD hook"
```

---

### Task 13: `src/components/StaffManager.tsx` (novo) — tela de Funcionários

**Files:**
- Create: `src/components/StaffManager.tsx`

**Interfaces:**
- Consumes: `useStaffMembers` (Task 12), `StaffPermission` (Task 6).

- [ ] **Step 1: Criar o arquivo**

```tsx
import { useState } from 'react';
import { Plus, Trash2, Shield, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useStaffMembers, StaffMember } from '@/hooks/useStaffMembers';
import { StaffPermission } from '@/hooks/useStaffAccess';

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  faltantes: 'Faltantes',
  produtos: 'Produtos',
  fornecedores: 'Fornecedores',
  financeiro: 'Financeiro',
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as StaffPermission[];

interface StaffFormState {
  username: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
  permissions: Set<StaffPermission>;
}

const emptyForm = (): StaffFormState => ({
  username: '',
  password: '',
  displayName: '',
  isAdmin: false,
  permissions: new Set(),
});

const StaffManager = () => {
  const { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember } = useStaffMembers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StaffFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<StaffPermission>>(new Set());
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const togglePermission = (set: Set<StaffPermission>, permission: StaffPermission): Set<StaffPermission> => {
    const next = new Set(set);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    return next;
  };

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) return;
    setIsSubmitting(true);
    try {
      await createStaffMember({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName || undefined,
        isAdmin: createForm.isAdmin,
        permissions: Array.from(createForm.permissions),
      });
      setCreateForm(emptyForm());
      setIsCreateOpen(false);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (member: StaffMember) => {
    setEditingUserId(member.user_id);
    setEditIsAdmin(member.is_admin);
    setEditPermissions(new Set(member.permissions));
  };

  const saveEditing = async () => {
    if (!editingUserId) return;
    await updatePermissions(editingUserId, editIsAdmin, Array.from(editPermissions));
    setEditingUserId(null);
  };

  const handleDelete = async (member: StaffMember) => {
    if (!window.confirm(`Excluir o funcionário "${member.display_name}"? Essa ação não pode ser desfeita.`)) return;
    await deleteStaffMember(member.user_id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Funcionários
        </CardTitle>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setCreateForm(emptyForm())}>
              <Plus className="h-4 w-4 mr-2" />
              Novo funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo funcionário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-username">Nome de usuário</Label>
                <Input
                  id="staff-username"
                  placeholder="leticia"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Senha</Label>
                <Input
                  id="staff-password"
                  type="text"
                  placeholder="1409"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-display-name">Nome de exibição (opcional)</Label>
                <Input
                  id="staff-display-name"
                  placeholder="Letícia"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="staff-is-admin"
                  checked={createForm.isAdmin}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, isAdmin: checked === true }))
                  }
                />
                <Label htmlFor="staff-is-admin">É administrador (acesso total)</Label>
              </div>
              {!createForm.isAdmin && (
                <div className="space-y-2">
                  <Label>Permissões</Label>
                  {ALL_PERMISSIONS.map((permission) => (
                    <div key={permission} className="flex items-center gap-2">
                      <Checkbox
                        id={`staff-perm-${permission}`}
                        checked={createForm.permissions.has(permission)}
                        onCheckedChange={() =>
                          setCreateForm((f) => ({ ...f, permissions: togglePermission(f.permissions, permission) }))
                        }
                      />
                      <Label htmlFor={`staff-perm-${permission}`}>{PERMISSION_LABELS[permission]}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !createForm.username || !createForm.password}
              >
                {isSubmitting ? 'Criando...' : 'Criar funcionário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : staffMembers.length === 0 ? (
          <p className="text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {staffMembers.map((member) => (
              <div key={member.user_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{member.display_name}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {member.is_admin ? (
                        <Badge>Administrador</Badge>
                      ) : member.permissions.length === 0 ? (
                        <Badge variant="outline">Sem permissões</Badge>
                      ) : (
                        member.permissions.map((permission) => (
                          <Badge key={permission} variant="outline">
                            {PERMISSION_LABELS[permission]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => startEditing(member)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(member)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingUserId === member.user_id && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-is-admin-${member.user_id}`}
                        checked={editIsAdmin}
                        onCheckedChange={(checked) => setEditIsAdmin(checked === true)}
                      />
                      <Label htmlFor={`edit-is-admin-${member.user_id}`}>É administrador (acesso total)</Label>
                    </div>
                    {!editIsAdmin && (
                      <div className="space-y-2">
                        {ALL_PERMISSIONS.map((permission) => (
                          <div key={permission} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-perm-${member.user_id}-${permission}`}
                              checked={editPermissions.has(permission)}
                              onCheckedChange={() =>
                                setEditPermissions((prev) => togglePermission(prev, permission))
                              }
                            />
                            <Label htmlFor={`edit-perm-${member.user_id}-${permission}`}>
                              {PERMISSION_LABELS[permission]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffManager;
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/StaffManager.tsx
git commit -m "feat(admin): add StaffManager UI component"
```

---

### Task 14: `src/pages/Admin.tsx` — abas filtradas por permissão + aba Funcionários

**Files:**
- Modify: `src/pages/Admin.tsx:1-19` (imports), `:215-241` (`TabsList`), `:350-355` (fim das `TabsContent`, antes de `</Tabs>`)

**Interfaces:**
- Consumes: `useStaffAccess` (Task 6), `StaffManager` (Task 13).

- [ ] **Step 1: Adicionar imports**

Depois do import de `PriorityProductsManager` (linha 16), adicionar:

```tsx
import StaffManager from '@/components/StaffManager';
import { useStaffAccess, StaffPermission } from '@/hooks/useStaffAccess';
```

- [ ] **Step 2: Calcular quais abas aparecem, logo no início do componente**

Depois de `const { products, loading, ... } = useProducts();` (linha 22), adicionar:

```tsx
  const staffAccess = useStaffAccess();

  type TabKey = 'dashboard' | 'products' | 'automotive' | 'highlights' | 'orders' | 'categories' | 'staff';

  const TAB_PERMISSION: Partial<Record<TabKey, StaffPermission>> = {
    dashboard: 'financeiro',
    orders: 'financeiro',
    products: 'produtos',
    automotive: 'produtos',
    highlights: 'produtos',
    categories: 'produtos',
  };

  const canSeeTab = (tab: TabKey): boolean => {
    if (staffAccess.isAdmin) return true;
    if (tab === 'staff') return false;
    const permission = TAB_PERMISSION[tab];
    return permission ? staffAccess.permissions.has(permission) : false;
  };

  const visibleTabs = (
    ['dashboard', 'products', 'automotive', 'highlights', 'orders', 'categories'] as TabKey[]
  ).filter(canSeeTab);
  if (staffAccess.isAdmin) visibleTabs.push('staff');
```

- [ ] **Step 3: Trocar o loading inicial pra também esperar `staffAccess`**

Trocar (linha 180, dentro do `if (loading) {`):
```tsx
  if (loading) {
```
por:
```tsx
  if (loading || staffAccess.loading) {
```

- [ ] **Step 4: Trocar `TabsList` para renderizar só as abas visíveis, com colunas dinâmicas**

Trocar (linhas 215–241, o `<TabsList>` inteiro) por uma versão que usa `visibleTabs` e `defaultValue` dinâmico. Trocar também a abertura da `<Tabs>` (linha 215 hoje é `<Tabs defaultValue="dashboard" className="w-full">`):

```tsx
        <Tabs defaultValue={visibleTabs[0] ?? 'dashboard'} className="w-full">
          <TabsList
            className="grid w-full mb-8 bg-[#12121a] border border-blue-500/20"
            style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
          >
            {visibleTabs.includes('dashboard') && (
              <TabsTrigger value="dashboard" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('products') && (
              <TabsTrigger value="products" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
                <Package className="h-4 w-4" />
                <span>Produtos</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('automotive') && (
              <TabsTrigger value="automotive" className="flex items-center space-x-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-300/70">
                <Car className="h-4 w-4" />
                <span>Automotivo</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('highlights') && (
              <TabsTrigger value="highlights" className="flex items-center space-x-2 data-[state=active]:bg-yellow-600/30 data-[state=active]:text-yellow-300 text-blue-300/70">
                <Star className="h-4 w-4" />
                <span>Destaques</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('orders') && (
              <TabsTrigger value="orders" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
                <ClipboardList className="h-4 w-4" />
                <span>Pedidos</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('categories') && (
              <TabsTrigger value="categories" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
                <Tags className="h-4 w-4" />
                <span>Categorias</span>
              </TabsTrigger>
            )}
            {visibleTabs.includes('staff') && (
              <TabsTrigger value="staff" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
                <Shield className="h-4 w-4" />
                <span>Funcionários</span>
              </TabsTrigger>
            )}
          </TabsList>
```

`Shield` precisa entrar no import de ícones do `lucide-react` no topo do arquivo (linha 2) — adicionar `Shield` à lista existente.

Os blocos `<TabsContent value="dashboard">` até `<TabsContent value="categories">` (linhas ~244–353) não mudam — continuam do jeito que estão, só ficam inacessíveis pela `TabsList` se a aba correspondente não estiver em `visibleTabs` (o Radix Tabs não exige que todo `TabsContent` tenha um `TabsTrigger` visível).

- [ ] **Step 5: Adicionar o `TabsContent` de Funcionários**

Logo antes do `</Tabs>` de fechamento (depois do `<TabsContent value="categories">...</TabsContent>`, linha ~353):

```tsx
          {visibleTabs.includes('staff') && (
            <TabsContent value="staff">
              <StaffManager />
            </TabsContent>
          )}
```

- [ ] **Step 6: Verificar**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(admin): filter tabs by staff permission, add Funcionários tab"
```

---

### Task 15: Build completo + smoke test manual

**Files:**
- Modify: qualquer arquivo que `npm run typecheck` apontar com erro remanescente.

- [ ] **Step 1: Typecheck e build limpos**

Run: `npm run typecheck` — esperado: 0 erros.
Run: `npm run build` — esperado: build limpo (não é evidência de tipo correto, só de que o bundle gera).

- [ ] **Step 2: Smoke test — cliente comum continua igual**

`npm run dev`, cadastrar um cliente novo pelo `/auth` (aba Cadastrar, e-mail de verdade) → confirmar que loga normalmente com e-mail+senha na aba Entrar → confirmar que o header NÃO mostra link de admin pra esse usuário.

- [ ] **Step 3: Smoke test — criar funcionário e logar com usuário+senha**

Logado como admin, ir em `/admin` → aba Funcionários → criar um funcionário de teste (ex. usuário `teste-funcionario`, senha `1234`, só permissão `produtos`) → deslogar → ir em `/auth`, aba Entrar, digitar `teste-funcionario` / `1234` (sem e-mail) → confirmar que loga, que o header mostra o link de admin, e que `/admin` mostra só a aba Produtos (mais nenhuma outra, sem Funcionários).

- [ ] **Step 4: Smoke test — o bug do travamento está corrigido**

Deslogado, acessar `/admin` direto pela URL → confirmar que redireciona pra `/auth` em vez de ficar preso em "Verificando permissões...".

- [ ] **Step 5: Limpeza**

Voltar a logar como admin, excluir o funcionário de teste criado no Step 3, confirmar que ele não consegue mais logar depois de excluído.

- [ ] **Step 6: Commit final (se o Step 1 exigiu ajustes)**

```bash
git add -A
git commit -m "fix: resolve remaining type errors from staff roles/permissions rollout"
```
