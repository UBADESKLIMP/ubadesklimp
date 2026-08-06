# Papéis, permissões e cadastro de funcionários

## Contexto

O admin do Ubadesklimp hoje só distingue admin/não-admin (`user_roles`/`app_role`, checado via `has_role()`). O CLAUDE.md do projeto já pedia um painel administrativo com pelo menos dois papéis (Comprador/Operacional), e a conversa que originou esta spec expandiu isso: em vez de papéis fixos, o dono do site quer criar cada funcionário manualmente e marcar, um por um, quais seções do admin ele pode acessar — ex.: "Leticia só vê Faltantes", "João vê Faltantes e Produtos". Funcionários também não devem precisar de e-mail: o dono cria um usuário simples (ex. `leticia` / `1409`) e a pessoa loga só com isso, sem nunca lidar com e-mail.

Este é o primeiro de quatro passos combinados pra reformular o admin (ver conversa): **A. Papéis/permissões (esta spec) → B. Casca visual/navegação nova → C. Módulo Fornecedores → D. Módulo Faltantes**. B, C e D ficam para specs/planos separados, na mesma ordem. Esta spec cobre só a Parte A.

Decisão já tomada e confirmada com o usuário: este modelo de papéis é construído do zero, independente do projeto "Compras" (`Projeto Compras ubadesk`) — não porta schema nem código de lá.

## Escopo

**Dentro do escopo:**
- Tabelas novas `staff_members` (quem é da equipe, se é admin) e `staff_permissions` (quais seções cada um acessa).
- Gatilho que grava o e-mail em `profiles` automaticamente no cadastro (hoje só 1 de 6 usuários tem e-mail salvo lá, porque só é preenchido se o cliente mexer na tela de Perfil).
- Atualização do gatilho `promote_first_user_to_admin()` (hoje escreve em `user_roles`) para escrever em `staff_members`.
- Migração do admin atual de `user_roles` para `staff_members`.
- Atualização de toda política RLS que hoje usa `has_role(auth.uid(), 'admin'::app_role)` para usar o novo modelo.
- Uma Edge Function para criar funcionário com usuário+senha (precisa de service role — não pode ser feito como um signUp comum do cliente, porque trocaria a sessão logada do admin pela do funcionário novo no meio do processo).
- Página de login (`/auth`) aceitando um campo único que funciona tanto para e-mail (cliente) quanto para nome de usuário (funcionário).
- Tela nova "Funcionários" no admin (só admin acessa): listar, criar, editar (trocar permissões), excluir.
- Hook `useStaffAccess` no cliente, expondo `isAdmin` e o conjunto de permissões do usuário logado.
- Correção do bug em `ProtectedRoute.tsx`: hoje fica travado para sempre em "Verificando permissões..." quando a rota exige autenticação e o usuário não está logado, em vez de redirecionar para `/auth`.

**Fora do escopo (fica para B/C/D ou depois):**
- Qualquer redesign visual (cores, tipografia, sidebar) — a tela "Funcionários" nasce no visual atual (escuro), igual às outras abas de hoje.
- Fornecedores e Faltantes como funcionalidade (só as permissões `fornecedores`/`financeiro`/`produtos`/`faltantes` já existem como conceito nesta spec, mas as telas que elas protegem em C/D ainda não existem).
- Apagar `user_roles`/`app_role`/`has_role()` — ficam parados, sem uso, até uma limpeza futura confirmada depois que o novo sistema estiver estável em produção.
- Fluxo de "esqueci minha senha" para contas de funcionário (elas não têm e-mail real; reset de senha, se precisar, é o admin trocando manualmente na tela de edição).

## Arquitetura

### Banco de dados

```sql
create table staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type staff_permission as enum ('faltantes', 'produtos', 'fornecedores', 'financeiro');

create table staff_permissions (
  user_id uuid not null references staff_members(user_id) on delete cascade,
  permission staff_permission not null,
  primary key (user_id, permission)
);
```

`display_name` guarda o nome de usuário escolhido (ex. `leticia`) para reexibir na tela de edição sem precisar decompor o e-mail sintético.

Funções auxiliares (mesmo padrão de `has_role()` já usado no projeto — `SECURITY DEFINER`, evita RLS recursiva):

```sql
create or replace function public.is_staff_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from staff_members where user_id = auth.uid()), false)
$$;

create or replace function public.has_staff_permission(perm staff_permission)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    public.is_staff_admin()
    or exists (
      select 1 from staff_permissions
      where user_id = auth.uid() and permission = perm
    )
$$;
```

`is_staff_admin()` sempre libera tudo; `has_staff_permission('produtos')` libera quem é admin OU tem a permissão específica.

### E-mail automático em `profiles`

```sql
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
```

Roda em paralelo ao `auto_promote_first_admin` já existente (dois triggers `AFTER INSERT` na mesma tabela, sem conflito).

### `promote_first_user_to_admin()` — atualizado

Troca o corpo para checar/inserir em `staff_members` em vez de `user_roles`:

```sql
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
```

### Migração do admin atual

Dentro da mesma migration, depois de criar as tabelas:

```sql
insert into public.staff_members (user_id, is_admin, display_name)
select ur.user_id, true, coalesce(p.email, 'admin')
from public.user_roles ur
left join public.profiles p on p.user_id = ur.user_id
where ur.role = 'admin'
on conflict (user_id) do nothing;
```

### RLS — troca de `has_role(uid,'admin')` por `is_staff_admin()`/`has_staff_permission(...)`

Toda policy que hoje usa `has_role(auth.uid(), 'admin'::app_role)` passa a usar `is_staff_admin()` (mantém exatamente o mesmo comportamento pra quem já é admin) ou, onde fizer sentido dar acesso a funcionário com permissão específica, `has_staff_permission('produtos')` etc. Tabelas afetadas (rastreadas na auditoria original): `products`, `categories`, `product_variations`, `product_fragrances`, `orders` (admin vê tudo), `profiles` (admin vê/gerencia tudo), políticas do bucket `product-images`. `staff_members`/`staff_permissions` em si: só `is_staff_admin()` pode inserir/editar/excluir; qualquer membro autenticado pode `select` a própria linha (pra o hook do cliente funcionar).

### Criar funcionário (Edge Function)

Nome: `criar-funcionario`. Recebe `{ username, password, display_name, is_admin, permissions[] }`, roda com `service_role`:

1. Verifica que quem chamou é admin (`is_staff_admin()` via o JWT do caller).
2. Monta e-mail sintético: `${username.toLowerCase().trim()}@equipe.ubadesklimp.internal`.
3. Chama `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — cria a conta sem afetar a sessão de quem chamou (diferente de `signUp`, que trocaria a sessão do browser).
4. Insere em `staff_members` (`user_id`, `is_admin`, `display_name` = `username` original) e em `staff_permissions` (uma linha por permissão marcada).
5. Se qualquer passo falhar depois do `createUser`, deleta o usuário criado (`auth.admin.deleteUser`) antes de retornar erro — evita conta órfã sem registro em `staff_members`.

Edição de permissões e exclusão de funcionário não precisam de Edge Function — são `update`/`delete` diretos em `staff_permissions`/`staff_members`, protegidos por RLS (só admin). Exclusão do funcionário também chama a Edge Function (ou uma segunda, `excluir-funcionario`) pra remover o `auth.users` correspondente via `admin.deleteUser`, já que isso exige service role.

### Login com campo único

Em `src/pages/Auth.tsx` (ou onde for o formulário de login), a função de submit decide o e-mail a usar:

```ts
const resolveLoginEmail = (input: string): string => {
  const trimmed = input.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@equipe.ubadesklimp.internal`;
};
```

E chama `supabase.auth.signInWithPassword({ email: resolveLoginEmail(input), password })`. Sem round-trip ao banco antes do login — o e-mail sintético é determinístico a partir do nome de usuário, então não precisa de lookup.

### Cliente: `useStaffAccess`

Hook novo (`src/hooks/useStaffAccess.ts`), consumido por `ProtectedRoute` e pelo menu do admin:

```ts
interface StaffAccess {
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  permissions: Set<'faltantes' | 'produtos' | 'fornecedores' | 'financeiro'>;
}
```

Busca a linha de `staff_members` + `staff_permissions` do usuário logado uma vez por sessão (cache simples em memória, mesmo espírito do cache de 60s que `ProtectedRoute.tsx` já tem hoje pra admin).

### Correção do bug em `ProtectedRoute.tsx`

Hoje, se `requireAdmin` é `true` e `user` é `null`, nenhum dos dois `useEffect` marca `adminCheckLoading` como `false`, então a tela fica presa no spinner "Verificando permissões..." para sempre em vez de redirecionar para `/auth`. A causa: o efeito só roda a checagem `if (requireAdmin && user)`, e o `else if (!requireAdmin)` correspondente nunca cobre o caso `requireAdmin && !user`. Fix: adicionar esse terceiro caso explicitamente (`else { setAdminCheckLoading(false); }`), deixando o `if (!user) return <Navigate to="/auth" />` mais abaixo assumir o redirecionamento — que já existe e já está correto, só nunca era alcançado.

`ProtectedRoute` também troca de `requireAdmin?: boolean` para aceitar `requirePermission?: 'faltantes' | 'produtos' | 'fornecedores' | 'financeiro'` (admin sempre passa, independente da permissão pedida), usando `useStaffAccess` no lugar da chamada direta a `isAdmin()` do `AuthContext`.

### Mapeamento das permissões às abas de hoje

As 4 permissões já existem como conceito nesta spec, mas duas delas (`faltantes`, `fornecedores`) ainda não têm tela nenhuma pra proteger — isso só chega em C/D. As outras duas mapeiam pra abas que já existem em `Admin.tsx` hoje:

- `produtos` → abas Produtos, Automotivo, Destaques, Categorias
- `financeiro` → abas Pedidos, Dashboard

Um funcionário sem a permissão `produtos`, por exemplo, não vê essas 4 abas no menu nem consegue acessá-las direto pela URL (bloqueado pelo `ProtectedRoute` com `requirePermission="produtos"`).

### Tela "Funcionários"

Nova aba em `Admin.tsx` (visível só se `isAdmin`), com:
- Lista dos funcionários (nome de usuário, admin ou não, badges das permissões).
- Botão "Novo funcionário": nome de usuário, senha, nome de exibição, checkboxes das 4 permissões (desabilitados/irrelevantes se marcar "é admin").
- Editar: troca as permissões (update direto, sem Edge Function) ou "é admin" (também update direto — só quem já é admin pode promover outro a admin, garantido pela RLS de `staff_members`).
- Excluir: chama a Edge Function de exclusão.

## Tratamento de erro

- **Nome de usuário duplicado:** a criação do e-mail sintético é determinística, então `auth.admin.createUser` falha com erro de e-mail já existente — a Edge Function repassa isso como "Esse nome de usuário já está em uso."
- **Falha a meio da criação** (ex.: `createUser` funciona mas o insert em `staff_members` falha): a Edge Function desfaz criando→apagando o usuário auth, para não sobrar conta órfã sem registro de permissão.
- **Funcionário sem nenhuma permissão marcada:** válido (fica logado mas sem acessar nenhuma seção do admin além do que for público) — não é um estado proibido, só pouco útil; a UI não bloqueia, mas mostra um aviso leve na hora de salvar.
- **`ProtectedRoute` sem usuário e sem permissão nenhuma:** redireciona para `/auth` (usuário não logado) ou mostra a tela "Acesso Negado" já existente (usuário logado mas sem a permissão pedida) — ambos os caminhos já existem no componente, só precisam ser alcançáveis de fato (ver correção do bug acima).

## Testes

Este repositório não tem suíte de testes automatizada. Verificação:

1. `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) — `npm run build` não serve como verificação de tipos neste projeto (só transpila).
2. Migration aplicada e conferida via MCP do Supabase (`ccrucholgsffichvzbpz`) antes de qualquer teste manual — conferir que o admin atual migrou corretamente para `staff_members` e que as policies novas produzem o mesmo resultado de acesso que as antigas.
3. Smoke test manual no navegador: criar um funcionário de teste só com permissão `faltantes`, logar como ele (usuário+senha, sem e-mail), confirmar que só a seção correspondente aparece/funciona e as outras ficam bloqueadas; conferir que login de cliente normal (e-mail+senha) continua funcionando sem mudança perceptível; conferir que `/admin` não fica mais travado em "Verificando permissões..." ao acessar deslogado.
4. Excluir o funcionário de teste ao final, confirmando que a Edge Function de exclusão remove tanto `staff_members` quanto o usuário em `auth.users`.
