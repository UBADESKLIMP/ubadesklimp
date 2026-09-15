# Funcionários — editar nome de exibição e alterar senha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar um admin editar o nome de exibição e trocar a senha (PIN de 4
dígitos) de um funcionário já existente, direto do painel de Funcionários.

**Architecture:** Nome de exibição grava direto em `staff_members.display_name`
via cliente Supabase (RLS de admin já cobre). Senha usa uma nova Edge Function
`alterar-senha-funcionario` (mesmo esqueleto de auth de `criar-funcionario`/
`excluir-funcionario`), porque trocar senha de outro usuário exige
`service_role`, que o cliente nunca deve ter.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres + Auth + Edge
Functions em Deno), shadcn/ui.

## Global Constraints

- PIN sempre exatamente 4 dígitos numéricos (`/^\d{4}$/`), igual à criação.
- Sufixo de senha do Auth (`STAFF_PIN_SUFFIX = "-pin"`) tem que ficar idêntico
  em toda function que grava/lê senha de funcionário — já existe em
  `criar-funcionario/index.ts:12` e `AuthContext.tsx:10`.
- Sem suíte de teste automatizado neste projeto (`package.json` não tem script
  `test`) — verificação é manual: `npm run typecheck` + checar no navegador.
  Cada task abaixo segue esse padrão em vez de TDD com testes automatizados.

---

## Task 1: Edge Function `alterar-senha-funcionario`

**Files:**
- Create: `supabase/functions/alterar-senha-funcionario/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: endpoint invocado via `supabase.functions.invoke('alterar-senha-funcionario', { body: { userId: string, newPassword: string } })`, resposta `{ success: true }` (200) ou `{ error: string }` (4xx/5xx) — usado pela Task 2.

- [ ] **Step 1: Criar o arquivo da function**

Criar `supabase/functions/alterar-senha-funcionario/index.ts` com o conteúdo
completo abaixo. É o mesmo esqueleto de auth/autorização de
`supabase/functions/excluir-funcionario/index.ts` (JWT do chamador → confere
`is_admin` via service role → age com service role), com a lógica de senha
(validação de 4 dígitos + sufixo) copiada de
`supabase/functions/criar-funcionario/index.ts:96-107`.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Precisa ficar idêntico ao sufixo usado em criar-funcionario e no login
// (AuthContext.tsx) — senão a senha trocada aqui nunca bate na hora de entrar.
const STAFF_PIN_SUFFIX = "-pin";

// Reflete de volta exatamente os cabeçalhos que o navegador pediu no
// preflight, em vez de uma lista fixa — mesmo padrão das outras functions de
// funcionário (ver criar-funcionario/index.ts).
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse(req, { error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerStaff } = await adminClient
      .from("staff_members")
      .select("is_admin")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerStaff?.is_admin) {
      return jsonResponse(req, { error: "Apenas administradores podem alterar senha de funcionário" }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!targetUserId || !UUID_RE.test(targetUserId)) {
      return jsonResponse(req, { error: "userId inválido" }, 400);
    }
    // Mesma regra de PIN da criação (criar-funcionario/index.ts:99) — decisão
    // já aceita de praticidade (equipe loga no chão da loja) sobre segurança.
    if (!/^\d{4}$/.test(newPassword)) {
      return jsonResponse(req, { error: "Senha precisa ter exatamente 4 dígitos numéricos." }, 400);
    }

    const { data: targetStaff } = await adminClient
      .from("staff_members")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetStaff) {
      return jsonResponse(req, { error: "Usuário não é um funcionário." }, 404);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword + STAFF_PIN_SUFFIX,
    });

    if (updateError) {
      return jsonResponse(req, { error: updateError.message }, 500);
    }

    // Registro mínimo de auditoria — mesma convenção de criar/excluir-funcionario.
    console.log(`Senha alterada: funcionário ${targetUserId} (por admin ${caller.id})`);

    return jsonResponse(req, { success: true }, 200);
  } catch (error) {
    console.error("Erro inesperado em alterar-senha-funcionario:", error);
    return jsonResponse(req, { error: "Erro inesperado ao alterar senha." }, 500);
  }
});
```

- [ ] **Step 2: Registrar a function no config.toml**

Abrir `supabase/config.toml` e localizar o bloco:

```toml
[functions.excluir-funcionario]
verify_jwt = false
```

Adicionar logo abaixo dele (a function valida o JWT manualmente dentro do
código, igual `criar-funcionario` e `excluir-funcionario` — por isso
`verify_jwt = false`, não porque é aberta):

```toml
[functions.alterar-senha-funcionario]
verify_jwt = false
```

- [ ] **Step 3: Deploy da function**

Esta function precisa estar publicada no projeto Supabase antes da Task 2/3
funcionarem de ponta a ponta. Publicar via MCP do Supabase (tool
`mcp__claude_ai_Supabase__deploy_edge_function`, projeto `ccrucholgsffichvzbpz`)
com o conteúdo do Step 1, `entrypoint_path: "index.ts"`, `verify_jwt: false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/alterar-senha-funcionario/index.ts supabase/config.toml
git commit -m "feat(funcionarios): edge function pra admin trocar senha de funcionário"
```

---

## Task 2: `useStaffMembers` — mutações de nome e senha

**Files:**
- Modify: `src/hooks/useStaffMembers.ts`

**Interfaces:**
- Consumes: Edge Function `alterar-senha-funcionario` da Task 1.
- Produces: `updateDisplayName(userId: string, displayName: string): Promise<void>` e `changePassword(userId: string, newPassword: string): Promise<void>`, expostas no retorno do hook — usadas pela Task 3.

- [ ] **Step 1: Adicionar `updateDisplayName` e `changePassword` ao hook**

Em `src/hooks/useStaffMembers.ts`, adicionar as duas funções logo depois de
`updatePermissions` (depois da linha 108, antes de `deleteStaffMember`):

```typescript
  const updateDisplayName = async (userId: string, displayName: string) => {
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ display_name: displayName })
        .eq('user_id', userId);
      if (error) throw error;

      toast({ title: 'Nome atualizado' });
      await fetchStaffMembers();
    } catch (error) {
      console.error('Error updating staff display name:', error);
      toast({
        title: 'Erro ao atualizar nome',
        description: 'Não foi possível salvar o nome de exibição.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const changePassword = async (userId: string, newPassword: string) => {
    const { error } = await supabase.functions.invoke('alterar-senha-funcionario', {
      body: { userId, newPassword },
    });

    if (error) {
      const message = await extractFunctionErrorMessage(error, 'Não foi possível alterar a senha.');
      toast({ title: 'Erro ao alterar senha', description: message, variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Senha alterada' });
  };
```

- [ ] **Step 2: Expor as duas funções no retorno do hook**

No final do arquivo, o `return` (linha 129 hoje) passa de:

```typescript
  return { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember, refetch: fetchStaffMembers };
```

para:

```typescript
  return {
    staffMembers,
    loading,
    createStaffMember,
    updatePermissions,
    updateDisplayName,
    changePassword,
    deleteStaffMember,
    refetch: fetchStaffMembers,
  };
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros novos relacionados a `useStaffMembers.ts` (o arquivo ainda
não é consumido pelas novas funções — isso acontece na Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useStaffMembers.ts
git commit -m "feat(funcionarios): hook ganha updateDisplayName e changePassword"
```

---

## Task 3: `StaffManager.tsx` — UI de editar nome e trocar senha

**Files:**
- Modify: `src/components/StaffManager.tsx`

**Interfaces:**
- Consumes: `updateDisplayName` e `changePassword` da Task 2.
- Produces: nada consumido por outra task — é a ponta final desta feature.

- [ ] **Step 1: Puxar as novas funções do hook**

Em `src/components/StaffManager.tsx:49`, trocar:

```typescript
  const { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember } = useStaffMembers();
```

por:

```typescript
  const { staffMembers, loading, createStaffMember, updatePermissions, updateDisplayName, changePassword, deleteStaffMember } =
    useStaffMembers();
```

- [ ] **Step 2: Novo estado de edição (nome e senha)**

Em `src/components/StaffManager.tsx:54-56`, trocar:

```typescript
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<StaffPermission>>(new Set());
  const [editIsAdmin, setEditIsAdmin] = useState(false);
```

por:

```typescript
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<StaffPermission>>(new Set());
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
```

- [ ] **Step 3: Inicializar nome ao começar a editar**

Em `src/components/StaffManager.tsx:85-89`, `startEditing` passa de:

```typescript
  const startEditing = (member: StaffMember) => {
    setEditingUserId(member.user_id);
    setEditIsAdmin(member.is_admin);
    setEditPermissions(new Set(member.permissions));
  };
```

para:

```typescript
  const startEditing = (member: StaffMember) => {
    setEditingUserId(member.user_id);
    setEditIsAdmin(member.is_admin);
    setEditPermissions(new Set(member.permissions));
    setEditDisplayName(member.display_name);
    setEditNewPassword('');
  };
```

- [ ] **Step 4: `saveEditing` também salva o nome**

Em `src/components/StaffManager.tsx:91-95`, `saveEditing` passa de:

```typescript
  const saveEditing = async () => {
    if (!editingUserId) return;
    await updatePermissions(editingUserId, editIsAdmin, Array.from(editPermissions));
    setEditingUserId(null);
  };
```

para:

```typescript
  const saveEditing = async () => {
    if (!editingUserId) return;
    setIsSavingProfile(true);
    try {
      const trimmedName = editDisplayName.trim();
      await Promise.all([
        updatePermissions(editingUserId, editIsAdmin, Array.from(editPermissions)),
        trimmedName ? updateDisplayName(editingUserId, trimmedName) : Promise.resolve(),
      ]);
      setEditingUserId(null);
    } catch {
      // erro já mostrado via toast dentro dos hooks
    } finally {
      setIsSavingProfile(false);
    }
  };
```

- [ ] **Step 5: Handler de trocar senha**

Adicionar logo depois de `saveEditing` (mesmo padrão de try/catch/finally de
`handleCreate`, linha 65-83):

```typescript
  const handleChangePassword = async () => {
    if (!editingUserId || !/^\d{4}$/.test(editNewPassword)) return;
    setIsChangingPassword(true);
    try {
      await changePassword(editingUserId, editNewPassword);
      setEditNewPassword('');
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsChangingPassword(false);
    }
  };
```

- [ ] **Step 6: Campo "Nome de exibição" no painel de edição**

Em `src/components/StaffManager.tsx:238-253`, o bloco `{editingUserId ===
member.user_id && (...)}` começa com o checkbox de admin. Adicionar o campo de
nome **antes** desse checkbox — trecho atual:

```tsx
                {editingUserId === member.user_id && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-is-admin-${member.user_id}`}
```

vira:

```tsx
                {editingUserId === member.user_id && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-display-name-${member.user_id}`}>Nome de exibição</Label>
                      <Input
                        id={`edit-display-name-${member.user_id}`}
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-is-admin-${member.user_id}`}
```

- [ ] **Step 7: Botão "Salvar" passa a refletir o novo estado de loading**

Em `src/components/StaffManager.tsx:272-279`, trocar:

```tsx
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                        Cancelar
                      </Button>
                    </div>
```

por (adiciona a seção "Alterar senha" logo acima do rodapé de botões):

```tsx
                    <div className="border-t pt-3 space-y-2">
                      <Label htmlFor={`edit-password-${member.user_id}`}>Alterar senha (novo PIN de 4 dígitos)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`edit-password-${member.user_id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          placeholder="0000"
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleChangePassword}
                          disabled={isChangingPassword || !/^\d{4}$/.test(editNewPassword)}
                        >
                          {isChangingPassword ? 'Salvando...' : 'Salvar nova senha'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing} disabled={isSavingProfile}>
                        {isSavingProfile ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                        Cancelar
                      </Button>
                    </div>
```

- [ ] **Step 8: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 9: Verificação manual**

Com o app rodando (`npm run dev`), logado como admin, na tela Funcionários:

1. Abrir a edição da própria conta admin (a que hoje mostra "admin" como
   nome) → trocar o campo "Nome de exibição" pro nome real → Salvar → o card
   do funcionário na lista mostra o nome novo.
2. Abrir Faltantes e reportar um item — "Reportado por" mostra o nome novo
   (confere que `useCurrentStaffName` pegou a mudança).
3. Abrir a edição de um funcionário qualquer → digitar um PIN novo de 4
   dígitos em "Alterar senha" → Salvar nova senha → toast de sucesso.
4. Deslogar, logar com o funcionário usando o PIN novo → funciona. Tentar com
   o PIN antigo → falha.
5. Tentar salvar senha com menos de 4 dígitos → botão continua desabilitado.

- [ ] **Step 10: Commit**

```bash
git add src/components/StaffManager.tsx
git commit -m "feat(funcionarios): editar nome de exibição e trocar senha de funcionário existente"
```

---

## Self-Review Notes

- **Spec coverage:** campo de nome editável (Task 3 Step 6) ✓, seção de trocar
  senha visível em texto claro (Task 3 Step 7, `type="text"` sem mascarar) ✓,
  Edge Function admin-only (Task 1) ✓, fora de escopo (ver senha atual,
  autoatendimento, histórico) intencionalmente não implementado ✓.
- **Placeholder scan:** nenhum "TBD"/"implementar depois" — todo step tem
  código completo.
- **Type consistency:** `updateDisplayName(userId: string, displayName:
  string)` e `changePassword(userId: string, newPassword: string)` usados com
  a mesma assinatura em Task 2 (definição) e Task 3 (uso).
