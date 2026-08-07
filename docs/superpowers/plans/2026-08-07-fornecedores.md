# Fornecedores (Parte C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastro de fornecedores (CRUD) com atalho pra abrir WhatsApp, destravando o item "Fornecedores" que já existe na sidebar (hoje "em breve").

**Architecture:** Uma tabela nova `suppliers` no Supabase, com RLS usando as funções `is_staff_admin()`/`has_staff_permission()` já existentes (Parte A) e a permissão `fornecedores` (já existe no enum, não precisa de migration de permissão). Um hook `useSuppliers.ts` (CRUD direto na tabela, sem edge function — diferente de funcionários, fornecedores não são contas de login) e um componente `SupplierManager.tsx`, ambos seguindo o mesmo padrão já estabelecido em `useCategories.ts`/`CategoryManager.tsx` e `useStaffMembers.ts`/`StaffManager.tsx`. `adminNav.ts` e `Admin.tsx` são atualizados pra trocar o placeholder "em breve" pela tela de verdade.

**Tech Stack:** React + TypeScript + Tailwind + shadcn/ui + Supabase (já usados no projeto). Nenhuma dependência nova.

## Global Constraints

- Nenhuma mudança em `useStaffAccess`, RLS de outras tabelas, ou qualquer lógica das Partes A/B — só a tabela `suppliers` é nova, e as duas edições em `adminNav.ts`/`Admin.tsx` são estritamente as descritas na Task 5.
- Cada fornecedor = um contato + uma empresa (linhas separadas se a mesma pessoa representa mais de uma empresa) — não existe relação fornecedor↔produto nesta parte.
- Botão de WhatsApp abre `https://wa.me/<telefone só dígitos, com código do país 55 se não tiver>`, sem mensagem pré-preenchida.
- Componentes visuais reaproveitam os já existentes da Parte B (`AdminPageHeader`, `AdminEmptyState`, `AdminLoadingState`) — `Card`/`CardHeader` seguem o padrão descoberto na Parte B: `CardHeader` com `className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg"`, `CardContent` no tema claro padrão, e qualquer `AdminEmptyState`/`AdminLoadingState` dentro do `CardContent` leva `tone="light"`.
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) é a verificação real do projeto — não `npm run build`.
- Strings visíveis pro usuário em português.

---

### Task 1: Migration — tabela `suppliers`

**Files:**
- Create: `supabase/migrations/20260807120000_suppliers.sql`

**Interfaces:**
- Produz: tabela `public.suppliers` com colunas `id, contact_name, company_name, phone, email, avg_delivery_days, max_installments, notes, created_at, updated_at`. RLS restringindo leitura/escrita a admin ou quem tem a permissão `fornecedores`.
- Consome: `public.is_staff_admin()`, `public.has_staff_permission(staff_permission)` e `public.update_updated_at_column()` — todas já existentes em produção (`is_staff_admin`/`has_staff_permission` da migration `20260805120000_staff_roles_permissions.sql`; `update_updated_at_column` da migration `20250819120444_e68b7f65-75c5-4e65-af11-2a308fa24679.sql`, já usada por `products`).

- [ ] **Step 1: Escrever a migration**

```sql
begin;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  company_name text not null,
  phone text not null,
  email text,
  avg_delivery_days integer,
  max_installments integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.update_updated_at_column();

alter table public.suppliers enable row level security;

-- Mesmo padrão de RLS por permissão já usado em products/categories/orders
-- (Parte A): admin sempre passa, ou quem tem a permissão fornecedores.
create policy "Staff com permissão fornecedores gerenciam fornecedores"
  on public.suppliers
  for all
  using (public.is_staff_admin() or public.has_staff_permission('fornecedores'))
  with check (public.is_staff_admin() or public.has_staff_permission('fornecedores'));

commit;
```

- [ ] **Step 2: Verificar que o arquivo não tem erro de sintaxe óbvio**

Este arquivo só será executado de verdade na Task 2 (controller, via `apply_migration`). Nesta task, confirme que o SQL está bem formado lendo o arquivo de volta — não há `npm run typecheck` que valide SQL.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260807120000_suppliers.sql
git commit -m "feat(db): tabela suppliers com RLS por permissão fornecedores (não aplicada ainda)"
```

---

### Task 2 (controller): Aplicar migration + regenerar tipos

**Não delega pra subagent** — mudança direta em produção, mesmo padrão usado nas Partes A/B (migrations sempre aplicadas pelo controller via MCP, nunca por um subagent).

- [ ] Aplicar a migration da Task 1 em produção via `apply_migration` (project_id `ccrucholgsffichvzbpz`).
- [ ] Confirmar que a tabela `suppliers` existe e a policy foi criada (`list_tables` ou uma query direta).
- [ ] Regenerar `src/integrations/supabase/types.ts` via `generate_typescript_types` e sobrescrever o arquivo.
- [ ] Rodar `npm run typecheck` pra confirmar que o novo `types.ts` compila.
- [ ] Commit:

```bash
git add supabase/migrations/20260807120000_suppliers.sql src/integrations/supabase/types.ts
git commit -m "chore(db): aplicar migration suppliers e regenerar tipos"
```

(O `git add` da migration aqui é só pra atualizar a mensagem do commit anterior caso o arquivo não tenha mudado — se a Task 1 já commitou o arquivo sem alterações posteriores, `git add` não gera nenhuma mudança extra e o commit desta task só contém o `types.ts`.)

---

### Task 3: `useSuppliers.ts`

**Files:**
- Create: `src/hooks/useSuppliers.ts`

**Interfaces:**
- Consome: `supabase` de `@/integrations/supabase/client`, `toast` de `@/hooks/use-toast` (ambos já existentes, mesmo padrão de `useCategories.ts`). A tabela `suppliers` (Task 2, já aplicada e nos tipos gerados).
- Produz: `Supplier` interface, `useSuppliers()` retornando `{ suppliers, loading, createSupplier, updateSupplier, deleteSupplier, refetch }`.

- [ ] **Step 1: Criar o hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Supplier {
  id: string;
  contact_name: string;
  company_name: string;
  phone: string;
  email: string | null;
  avg_delivery_days: number | null;
  max_installments: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierInput {
  contact_name: string;
  company_name: string;
  phone: string;
  email: string | null;
  avg_delivery_days: number | null;
  max_installments: number | null;
  notes: string | null;
}

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('contact_name');

      if (error) throw error;
      setSuppliers((data as Supplier[]) || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Erro ao carregar fornecedores',
        description: 'Não foi possível carregar a lista de fornecedores.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createSupplier = async (input: SupplierInput) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([input])
        .select()
        .single();

      if (error) throw error;

      setSuppliers((prev) => [...prev, data as Supplier].sort((a, b) => a.contact_name.localeCompare(b.contact_name, 'pt-BR')));
      toast({
        title: 'Fornecedor criado',
        description: `"${input.contact_name}" foi adicionado com sucesso.`,
      });
      return data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: 'Erro ao criar fornecedor',
        description: 'Não foi possível criar o fornecedor.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateSupplier = async (id: string, input: SupplierInput) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setSuppliers((prev) =>
        prev.map((supplier) => (supplier.id === id ? (data as Supplier) : supplier))
          .sort((a, b) => a.contact_name.localeCompare(b.contact_name, 'pt-BR'))
      );
      toast({ title: 'Fornecedor atualizado' });
      return data;
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: 'Erro ao atualizar fornecedor',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;

      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
      toast({ title: 'Fornecedor excluído' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: 'Erro ao excluir fornecedor',
        description: 'Não foi possível excluir o fornecedor.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, loading, createSupplier, updateSupplier, deleteSupplier, refetch: fetchSuppliers };
};
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros. Se der erro sobre `suppliers` não existir no tipo `Database`, o `types.ts` da Task 2 não foi aplicado corretamente neste worktree — pare e avise, não invente um tipo manual pra contornar.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSuppliers.ts
git commit -m "feat(hooks): useSuppliers (CRUD de fornecedores)"
```

---

### Task 4: `SupplierManager.tsx`

**Files:**
- Create: `src/components/SupplierManager.tsx`

**Interfaces:**
- Consome: `useSuppliers`/`Supplier`/`SupplierInput` (Task 3), `AdminPageHeader`/`AdminEmptyState`/`AdminLoadingState` de `./admin/...` (já existentes, Parte B), `normalizeText` de `@/lib/utils` (já existente, usado em `Admin.tsx`), `Textarea` de `@/components/ui/textarea` (já existente).
- Produz: `SupplierManager` — componente sem props, export default.

- [ ] **Step 1: Criar o componente**

```tsx
import { useState } from 'react';
import { Plus, Trash2, Pencil, Truck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSuppliers, Supplier, SupplierInput } from '@/hooks/useSuppliers';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { normalizeText } from '@/lib/utils';

interface SupplierFormState {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  avgDeliveryDays: string;
  maxInstallments: string;
  notes: string;
}

const emptyForm = (): SupplierFormState => ({
  contactName: '',
  companyName: '',
  phone: '',
  email: '',
  avgDeliveryDays: '',
  maxInstallments: '',
  notes: '',
});

// wa.me exige o número com código do país; se quem digitou já colocou 55 na
// frente mantemos, senão prefixamos — sem isso o link abre "número inválido".
const buildWhatsAppLink = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
};

const toNullableInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
};

const formToInput = (form: SupplierFormState): SupplierInput => ({
  contact_name: form.contactName.trim(),
  company_name: form.companyName.trim(),
  phone: form.phone.trim(),
  email: form.email.trim() || null,
  avg_delivery_days: toNullableInt(form.avgDeliveryDays),
  max_installments: toNullableInt(form.maxInstallments),
  notes: form.notes.trim() || null,
});

const isFormValid = (form: SupplierFormState) =>
  form.contactName.trim().length > 0 && form.companyName.trim().length > 0 && form.phone.trim().length > 0;

interface SupplierFormFieldsProps {
  form: SupplierFormState;
  onChange: (updater: (form: SupplierFormState) => SupplierFormState) => void;
  idPrefix: string;
}

const SupplierFormFields = ({ form, onChange, idPrefix }: SupplierFormFieldsProps) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-contact-name`}>Nome do contato</Label>
      <Input
        id={`${idPrefix}-contact-name`}
        placeholder="Maria"
        value={form.contactName}
        onChange={(e) => onChange((f) => ({ ...f, contactName: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-company-name`}>Empresa</Label>
      <Input
        id={`${idPrefix}-company-name`}
        placeholder="Distribuidora ABC"
        value={form.companyName}
        onChange={(e) => onChange((f) => ({ ...f, companyName: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-phone`}>Telefone/WhatsApp</Label>
      <Input
        id={`${idPrefix}-phone`}
        placeholder="(12) 99999-9999"
        value={form.phone}
        onChange={(e) => onChange((f) => ({ ...f, phone: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-email`}>E-mail (opcional)</Label>
      <Input
        id={`${idPrefix}-email`}
        type="email"
        placeholder="contato@empresa.com"
        value={form.email}
        onChange={(e) => onChange((f) => ({ ...f, email: e.target.value }))}
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-avg-delivery`}>Prazo médio de entrega (dias)</Label>
        <Input
          id={`${idPrefix}-avg-delivery`}
          type="number"
          min="0"
          placeholder="5"
          value={form.avgDeliveryDays}
          onChange={(e) => onChange((f) => ({ ...f, avgDeliveryDays: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-max-installments`}>Parcela em até (vezes)</Label>
        <Input
          id={`${idPrefix}-max-installments`}
          type="number"
          min="1"
          placeholder="3"
          value={form.maxInstallments}
          onChange={(e) => onChange((f) => ({ ...f, maxInstallments: e.target.value }))}
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-notes`}>Observações (opcional)</Label>
      <Textarea
        id={`${idPrefix}-notes`}
        placeholder="Observações sobre esse fornecedor"
        value={form.notes}
        onChange={(e) => onChange((f) => ({ ...f, notes: e.target.value }))}
      />
    </div>
  </div>
);

const SupplierManager = () => {
  const { suppliers, loading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SupplierFormState>(emptyForm());

  const filteredSuppliers = suppliers.filter((supplier) => {
    const normalizedSearch = normalizeText(searchTerm);
    return (
      normalizeText(supplier.contact_name).includes(normalizedSearch) ||
      normalizeText(supplier.company_name).includes(normalizedSearch)
    );
  });

  const handleCreate = async () => {
    if (!isFormValid(createForm)) return;
    setIsSubmitting(true);
    try {
      await createSupplier(formToInput(createForm));
      setCreateForm(emptyForm());
      setIsCreateOpen(false);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setEditForm({
      contactName: supplier.contact_name,
      companyName: supplier.company_name,
      phone: supplier.phone,
      email: supplier.email || '',
      avgDeliveryDays: supplier.avg_delivery_days?.toString() || '',
      maxInstallments: supplier.max_installments?.toString() || '',
      notes: supplier.notes || '',
    });
  };

  const saveEditing = async () => {
    if (!editingId || !isFormValid(editForm)) return;
    await updateSupplier(editingId, formToInput(editForm));
    setEditingId(null);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!window.confirm(`Excluir o fornecedor "${supplier.contact_name}" (${supplier.company_name})? Essa ação não pode ser desfeita.`)) return;
    await deleteSupplier(supplier.id);
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={Truck}
          title="Fornecedores"
          description="Cadastre os fornecedores e abra o WhatsApp deles direto por aqui."
          action={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setCreateForm(emptyForm())}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo fornecedor</DialogTitle>
                </DialogHeader>
                <SupplierFormFields form={createForm} onChange={setCreateForm} idPrefix="create" />
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={isSubmitting || !isFormValid(createForm)}>
                    {isSubmitting ? 'Criando...' : 'Criar fornecedor'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm bg-white"
        />
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : suppliers.length === 0 ? (
          <AdminEmptyState icon={Truck} title="Nenhum fornecedor cadastrado ainda." tone="light" />
        ) : filteredSuppliers.length === 0 ? (
          <AdminEmptyState icon={Truck} title="Nenhum fornecedor encontrado" description="Tente ajustar a busca" tone="light" />
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{supplier.contact_name}</p>
                    <p className="text-sm text-muted-foreground">{supplier.company_name}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" asChild>
                      <a href={buildWhatsAppLink(supplier.phone)} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => startEditing(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(supplier)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingId === supplier.id && (
                  <div className="border-t pt-3 space-y-3">
                    <SupplierFormFields form={editForm} onChange={setEditForm} idPrefix={`edit-${supplier.id}`} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
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

export default SupplierManager;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/SupplierManager.tsx
git commit -m "feat(admin): componente SupplierManager (cadastro de fornecedores)"
```

---

### Task 5: Destravar "Fornecedores" na navegação

**Files:**
- Modify: `src/components/admin/adminNav.ts` (1 linha)
- Modify: `src/pages/Admin.tsx` (imports + 1 `case`)

**Interfaces:**
- Consome: `SupplierManager` (Task 4).

- [ ] **Step 1: Editar `adminNav.ts`**

Troque a linha do item `suppliers` (dentro de `ADMIN_NAV_ITEMS`):

```ts
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, comingSoon: true, group: 'operacao' },
```

por:

```ts
  { key: 'suppliers', label: 'Fornecedores', icon: Truck, permission: 'fornecedores', group: 'operacao' },
```

Nenhuma outra linha do arquivo muda — `Truck` continua importado e usado, `comingSoon: true` só sai deste item específico (o item `missing`/Faltantes continua com `comingSoon: true`, intocado).

- [ ] **Step 2: Editar `Admin.tsx`**

Adicione o import do `SupplierManager` junto aos outros imports de componentes de seção (perto de `import StaffManager from '@/components/StaffManager';`):

```tsx
import SupplierManager from '@/components/SupplierManager';
```

Troque o `case 'suppliers'` dentro de `renderSection()`:

```tsx
      case 'suppliers':
        return (
          <AdminComingSoon
            icon={Truck}
            title="Fornecedores"
            description="Em breve você vai poder cadastrar fornecedores e enviar cotações direto por aqui."
          />
        );
```

por:

```tsx
      case 'suppliers':
        return <SupplierManager />;
```

Depois de fazer essa troca, o import `Truck` de `'lucide-react'` no topo de `Admin.tsx` fica sem uso (ele só era usado neste `case`; o `case 'missing'` usa `ClipboardCheck`, que continua). Remova `Truck` da lista de ícones importada de `lucide-react` no topo do arquivo. Não remova `ClipboardCheck` nem `AdminComingSoon` — ambos continuam usados pelo `case 'missing'`.

- [ ] **Step 3: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/adminNav.ts src/pages/Admin.tsx
git commit -m "feat(admin): destravar seção Fornecedores na navegação"
```

---

### Task 6 (controller): Verificação final e testes manuais

**Files:**
- Nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Typecheck limpo**

Run: `npm run typecheck`
Expected: 0 erros.

- [ ] **Step 2: Subir o servidor de dev e testar manualmente**

Run: `npm run dev`

Roteiro de teste:

1. Logar como admin, abrir `/admin`, clicar em "Fornecedores" na sidebar. Confirmar que não é mais a tela "em breve" — é a lista de fornecedores (vazia no início).
2. Criar um fornecedor de teste com todos os campos preenchidos (nome, empresa, telefone, e-mail, prazo de entrega, parcelamento, observações). Confirmar que aparece na lista.
3. Criar um segundo fornecedor só com os campos obrigatórios (nome, empresa, telefone) — confirmar que salva sem erro mesmo com os opcionais em branco.
4. Buscar por parte do nome e por parte do nome da empresa — confirmar que o filtro funciona pros dois casos.
5. Clicar no botão de WhatsApp de um fornecedor — confirmar que abre `wa.me` com o número certo (com `55` na frente).
6. Editar um fornecedor (mudar o nome da empresa, por exemplo) e salvar — confirmar que a lista atualiza.
7. Excluir os dois fornecedores de teste — confirmar que somem da lista e que a tela volta pro estado vazio corretamente.
8. Testar como um funcionário sem a permissão `fornecedores` (pode reaproveitar o padrão de conta de teste das Partes A/B): confirmar que o item "Fornecedores" não aparece na sidebar pra esse funcionário.
9. Testar como um funcionário só com a permissão `fornecedores`: confirmar que ele vê e acessa a seção normalmente.

- [ ] **Step 3: Reportar resultado**

Se algum item do roteiro falhar, corrigir antes de considerar a task concluída. Se tudo passar, seguir pra revisão final de branch inteira (fora do escopo desta task — próxima etapa do processo).
