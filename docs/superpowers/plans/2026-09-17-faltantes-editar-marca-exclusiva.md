# Faltantes — editar item, marca exclusiva por fornecedor (D3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar editar um item já reportado em Faltantes, e separar itens de
marca exclusiva de fornecedor (Yoma, Start/Azulim, automotivas como Bugatti/
Dub Boyz/Vonix) numa aba própria com pedido direto, sem cotação.

**Architecture:** Nova tabela `supplier_exclusive_brands` mapeia marca →
fornecedor (1 marca = 1 fornecedor). `missing_products` ganha
`order_supplier_name` (substitui o cruzamento antigo de 3 tabelas usado em
"Aguardando confirmação") e `order_quantity` (só usado pelo fluxo direto de
marca exclusiva). A separação de aba em Faltantes é 100% client-side:
`products.brand` já carregado é comparado (via `normalizeText`) contra a
lista de marcas exclusivas.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres + RLS),
shadcn/ui, lucide-react.

## Global Constraints

- Sem suíte de teste automatizada — verificação é `npm run typecheck` +
  checagem manual, mesmo padrão de todo o projeto até aqui.
- Migrações aplicadas via Supabase MCP
  (`mcp__claude_ai_Supabase__apply_migration`, `project_id:
  "ccrucholgsffichvzbpz"`), depois salvas em `supabase/migrations/`.
- Regenerar `src/integrations/supabase/types.ts`
  (`mcp__claude_ai_Supabase__generate_typescript_types`) logo depois de
  aplicar as migrações da Task 1 — sem isso, `npm run typecheck` quebra em
  todo lugar que usa as tabelas/colunas novas, não só nos arquivos desta
  spec (aconteceu na entrega anterior, D2c).
- Uma marca exclusiva pertence a exatamente 1 fornecedor — recadastrar a
  mesma marca noutro fornecedor move a exclusividade (apaga de onde estava,
  cria no novo), nunca duplica nem erra.

---

## Task 1: Migrações

**Files:**
- Create: `supabase/migrations/20260917120000_supplier_exclusive_brands.sql`
- Create: `supabase/migrations/20260917121000_missing_products_order_supplier_quantity.sql`
- Create: `supabase/migrations/20260917122000_missing_products_edit_policy.sql`
- Modify: `src/integrations/supabase/types.ts` (regeneração completa)

**Interfaces:**
- Consumes: nada.
- Produces: tabela `supplier_exclusive_brands` (`id`, `supplier_id`, `brand`)
  e colunas `missing_products.order_supplier_name` /
  `missing_products.order_quantity`, usadas por todas as outras tasks.

- [ ] **Step 1: Migração da tabela `supplier_exclusive_brands`**

```sql
begin;

-- unaccent() nativo é STABLE (depende de configuração de dicionário), e
-- Postgres não deixa usar função STABLE em expressão de índice — só
-- IMMUTABLE. Este wrapper (padrão documentado no wiki do Postgres/Supabase
-- pra esse exato problema) fixa o dicionário explicitamente e assume a
-- garantia de imutabilidade, o que é seguro aqui porque o mapeamento de
-- acentuação não muda.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select public.unaccent('public.unaccent'::regdictionary, $1);
$$;

create table public.supplier_exclusive_brands (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  brand text not null,
  created_at timestamptz not null default now()
);

-- Uma marca só pode ser exclusiva de 1 fornecedor por vez.
create unique index supplier_exclusive_brands_brand_idx
  on public.supplier_exclusive_brands (lower(public.immutable_unaccent(brand)));

alter table public.supplier_exclusive_brands enable row level security;

-- Leitura: qualquer staff com 'faltantes' precisa ver essas marcas pra saber
-- quais itens tirar da aba Pendente normal e mostrar na aba "Fornecedor
-- exclusivo" — mesmo sem ter 'fornecedores'.
create policy "Staff com permissão faltantes vê marcas exclusivas"
  on public.supplier_exclusive_brands
  for select
  using (
    public.is_staff_admin()
    or public.has_staff_permission('faltantes')
    or public.has_staff_permission('fornecedores')
  );

-- Gerenciar (criar/editar/excluir) continua restrito a quem cuida de
-- fornecedores, mesmo padrão de RLS da tabela suppliers.
create policy "Staff com permissão fornecedores gerencia marcas exclusivas"
  on public.supplier_exclusive_brands
  for all
  using (public.is_staff_admin() or public.has_staff_permission('fornecedores'))
  with check (public.is_staff_admin() or public.has_staff_permission('fornecedores'));

comment on table public.supplier_exclusive_brands is 'Marcas que só são compradas de um fornecedor específico (ex: Yoma só do fornecedor Yoma) — usado pra separar esses itens do fluxo normal de cotação em Faltantes.';

commit;
```

Salvar em `supabase/migrations/20260917120000_supplier_exclusive_brands.sql`.

- [ ] **Step 2: Migração de `missing_products` — colunas novas**

```sql
begin;

alter table public.missing_products
  add column order_supplier_name text,
  add column order_quantity integer check (order_quantity > 0);

comment on column public.missing_products.order_supplier_name is 'Nome do fornecedor pro qual o pedido foi enviado — gravado no momento de marcar pedido_enviado (fluxo de cotação e fluxo direto de marca exclusiva). Substitui o cruzamento via quote_batch_items usado antes.';
comment on column public.missing_products.order_quantity is 'Quantidade a pedir no fluxo direto de marca exclusiva (sem cotação) — o fluxo de cotação usa quote_batch_items.quantity, não este campo. Null = ainda não definida.';

commit;
```

Salvar em `supabase/migrations/20260917121000_missing_products_order_supplier_quantity.sql`.

- [ ] **Step 3: Migração de RLS — editar item pendente**

A policy de update existente ("Staff com permissão faltantes reporta de novo
produto pendente", em `20260808120000_missing_products.sql`) só permite
atualizar quem tem `reported_by = auth.uid()` — ou seja, só quem reportou
originalmente conseguiria editar. Esta migração adiciona uma policy nova,
mais aberta pro caso de edição (qualquer staff com `faltantes`, sem exigir
ser quem reportou), mas ainda travada em `status = 'pendente'` no
`with check` — não dá pra usar essa policy pra mudar o status pra
`resolvido`/`pedido_enviado` (isso continua exigindo a policy de
`faltantes` + `fornecedores` já existente).

```sql
begin;

create policy "Staff com permissão faltantes edita faltante pendente"
  on public.missing_products
  for update
  using (public.is_staff_admin() or public.has_staff_permission('faltantes'))
  with check (
    (public.is_staff_admin() or public.has_staff_permission('faltantes'))
    and status = 'pendente'
  );

commit;
```

Salvar em `supabase/migrations/20260917122000_missing_products_edit_policy.sql`.

- [ ] **Step 4: Aplicar as 3 migrações**

Via `mcp__claude_ai_Supabase__apply_migration`, `project_id:
"ccrucholgsffichvzbpz"`, uma chamada por arquivo, na ordem acima.

- [ ] **Step 5: Verificar as tabelas/colunas/policies novas**

Via `mcp__claude_ai_Supabase__execute_sql` (mesmo `project_id`):

```sql
select column_name from information_schema.columns
where table_name = 'supplier_exclusive_brands';

select column_name from information_schema.columns
where table_name = 'missing_products' and column_name in ('order_supplier_name', 'order_quantity');

select policyname from pg_policies
where tablename = 'missing_products' and policyname = 'Staff com permissão faltantes edita faltante pendente';

select policyname from pg_policies where tablename = 'supplier_exclusive_brands';
```

Expected: cada query retorna o que se espera (4 colunas na primeira, 2 na
segunda, 1 linha na terceira, 2 linhas na quarta).

- [ ] **Step 6: Regenerar `src/integrations/supabase/types.ts`**

Rodar `mcp__claude_ai_Supabase__generate_typescript_types` (mesmo
`project_id`) e sobrescrever o arquivo inteiro com o resultado.

- [ ] **Step 7: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros novos (o projeto já estava limpo antes desta task).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260917120000_supplier_exclusive_brands.sql \
        supabase/migrations/20260917121000_missing_products_order_supplier_quantity.sql \
        supabase/migrations/20260917122000_missing_products_edit_policy.sql \
        src/integrations/supabase/types.ts
git commit -m "feat(faltantes,fornecedores): marcas exclusivas, order_supplier_name/order_quantity e policy de edição"
```

---

## Task 2: Hook `useExclusiveBrands`

**Files:**
- Create: `src/hooks/useExclusiveBrands.ts`

**Interfaces:**
- Consumes: tabela `supplier_exclusive_brands` da Task 1.
- Produces (usado pelas Tasks 3 e 6):
  - `ExclusiveBrand { id: string; supplier_id: string; brand: string; supplier_company_name: string; supplier_contact_name: string; supplier_phone: string }`
  - `exclusiveBrands: ExclusiveBrand[]`
  - `brandsForSupplier(supplierId: string): string[]`
  - `setSupplierBrands(supplierId: string, brands: string[]): Promise<void>`

- [ ] **Step 1: Criar o hook**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExclusiveBrand {
  id: string;
  supplier_id: string;
  brand: string;
  supplier_company_name: string;
  supplier_contact_name: string;
  supplier_phone: string;
}

export const useExclusiveBrands = () => {
  const [exclusiveBrands, setExclusiveBrands] = useState<ExclusiveBrand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExclusiveBrands = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_exclusive_brands')
        .select('id, supplier_id, brand, suppliers(company_name, contact_name, phone)')
        .order('brand');
      if (error) throw error;

      const typedRows = (data || []) as unknown as Array<{
        id: string;
        supplier_id: string;
        brand: string;
        suppliers: { company_name: string; contact_name: string; phone: string } | null;
      }>;

      setExclusiveBrands(
        typedRows.map((row) => ({
          id: row.id,
          supplier_id: row.supplier_id,
          brand: row.brand,
          supplier_company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
          supplier_contact_name: row.suppliers?.contact_name ?? '',
          supplier_phone: row.suppliers?.phone ?? '',
        }))
      );
    } catch (error) {
      console.error('Error fetching exclusive brands:', error);
      toast({
        title: 'Erro ao carregar marcas exclusivas',
        description: 'Não foi possível carregar a lista de marcas exclusivas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const brandsForSupplier = (supplierId: string): string[] =>
    exclusiveBrands.filter((row) => row.supplier_id === supplierId).map((row) => row.brand);

  // Substituição completa: apaga o cadastro atual deste fornecedor e de
  // qualquer OUTRO fornecedor que já tivesse alguma dessas marcas (recadastrar
  // uma marca move a exclusividade — nunca duplica, nunca erra por marca já
  // existir noutro fornecedor), depois insere a lista nova.
  const setSupplierBrands = async (supplierId: string, brands: string[]) => {
    try {
      const uniqueBrands = [...new Set(brands.map((b) => b.trim()).filter(Boolean))];

      const { error: deleteOwnError } = await supabase
        .from('supplier_exclusive_brands')
        .delete()
        .eq('supplier_id', supplierId);
      if (deleteOwnError) throw deleteOwnError;

      if (uniqueBrands.length > 0) {
        const { error: deleteOthersError } = await supabase
          .from('supplier_exclusive_brands')
          .delete()
          .in('brand', uniqueBrands);
        if (deleteOthersError) throw deleteOthersError;

        const { error: insertError } = await supabase
          .from('supplier_exclusive_brands')
          .insert(uniqueBrands.map((brand) => ({ supplier_id: supplierId, brand })));
        if (insertError) throw insertError;
      }

      await fetchExclusiveBrands();
    } catch (error) {
      console.error('Error updating supplier exclusive brands:', error);
      toast({
        title: 'Erro ao salvar marcas exclusivas',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchExclusiveBrands();
  }, [fetchExclusiveBrands]);

  return { exclusiveBrands, loading, brandsForSupplier, setSupplierBrands, refetch: fetchExclusiveBrands };
};
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros (arquivo novo, ainda não consumido por ninguém).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useExclusiveBrands.ts
git commit -m "feat(fornecedores): hook useExclusiveBrands pra marcas exclusivas por fornecedor"
```

---

## Task 3: `SupplierManager.tsx` — cadastro de marcas exclusivas

**Files:**
- Modify: `src/components/SupplierManager.tsx`

**Interfaces:**
- Consumes: `useExclusiveBrands` da Task 2.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Novos imports**

Em `src/components/SupplierManager.tsx:1-21`, trocar a linha de ícones
(linha 2):

```typescript
import { Plus, Trash2, Pencil, Truck, MessageCircle } from 'lucide-react';
```

por:

```typescript
import { Plus, Trash2, Pencil, Truck, MessageCircle, X } from 'lucide-react';
```

E adicionar, depois de `import { normalizeText } from '@/lib/utils';`
(linha 20):

```typescript
import { Badge } from '@/components/ui/badge';
import { useExclusiveBrands } from '@/hooks/useExclusiveBrands';
```

- [ ] **Step 2: `exclusiveBrands` no form state**

Em `src/components/SupplierManager.tsx:23-41`, trocar:

```typescript
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
```

por:

```typescript
interface SupplierFormState {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  avgDeliveryDays: string;
  maxInstallments: string;
  notes: string;
  exclusiveBrands: string[];
}

const emptyForm = (): SupplierFormState => ({
  contactName: '',
  companyName: '',
  phone: '',
  email: '',
  avgDeliveryDays: '',
  maxInstallments: '',
  notes: '',
  exclusiveBrands: [],
});
```

(`formToInput`, logo abaixo, **não muda** — `exclusiveBrands` não é coluna de
`suppliers`, é gravado à parte via `setSupplierBrands`.)

- [ ] **Step 3: Campo de marcas exclusivas em `SupplierFormFields`**

Em `src/components/SupplierManager.tsx:69`, a função `SupplierFormFields`
passa de:

```typescript
const SupplierFormFields = ({ form, onChange, idPrefix }: SupplierFormFieldsProps) => (
  <div className="space-y-4">
```

para (vira uma function com corpo, pra ter o `useState` do campo de texto
novo):

```typescript
const SupplierFormFields = ({ form, onChange, idPrefix }: SupplierFormFieldsProps) => {
  const [newBrand, setNewBrand] = useState('');

  const addBrand = () => {
    const trimmed = newBrand.trim();
    if (!trimmed) return;
    if (form.exclusiveBrands.some((b) => normalizeText(b) === normalizeText(trimmed))) {
      setNewBrand('');
      return;
    }
    onChange((f) => ({ ...f, exclusiveBrands: [...f.exclusiveBrands, trimmed] }));
    setNewBrand('');
  };

  const removeBrand = (brand: string) => {
    onChange((f) => ({ ...f, exclusiveBrands: f.exclusiveBrands.filter((b) => b !== brand) }));
  };

  return (
  <div className="space-y-4">
```

E, no final da função (em `src/components/SupplierManager.tsx:132-142`, logo
antes do fechamento), trocar:

```typescript
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
```

por:

```typescript
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-notes`}>Observações (opcional)</Label>
      <Textarea
        id={`${idPrefix}-notes`}
        placeholder="Observações sobre esse fornecedor"
        value={form.notes}
        onChange={(e) => onChange((f) => ({ ...f, notes: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-exclusive-brand`}>Marcas exclusivas (opcional)</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`${idPrefix}-exclusive-brand`}
          placeholder="Ex: Yoma"
          value={newBrand}
          onChange={(e) => setNewBrand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addBrand();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addBrand}>
          Adicionar
        </Button>
      </div>
      {form.exclusiveBrands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {form.exclusiveBrands.map((brand) => (
            <Badge key={brand} variant="secondary" className="gap-1">
              {brand}
              <button
                type="button"
                aria-label={`Remover marca ${brand}`}
                onClick={() => removeBrand(brand)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Produtos dessas marcas saem da lista normal de Faltantes e vão direto
        pra esse fornecedor, sem cotação.
      </p>
    </div>
  </div>
  );
};
```

- [ ] **Step 4: Usar o hook e carregar marcas ao editar**

Em `src/components/SupplierManager.tsx:144-145`, trocar:

```typescript
const SupplierManager = () => {
  const { suppliers, loading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
```

por:

```typescript
const SupplierManager = () => {
  const { suppliers, loading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { brandsForSupplier, setSupplierBrands } = useExclusiveBrands();
```

Em `src/components/SupplierManager.tsx:177-188`, `startEditing` passa de:

```typescript
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
```

para:

```typescript
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
      exclusiveBrands: brandsForSupplier(supplier.id),
    });
  };
```

- [ ] **Step 5: Salvar marcas ao criar e ao editar**

Em `src/components/SupplierManager.tsx:163-175`, `handleCreate` passa de:

```typescript
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
```

para:

```typescript
  const handleCreate = async () => {
    if (!isFormValid(createForm)) return;
    setIsSubmitting(true);
    try {
      const created = await createSupplier(formToInput(createForm));
      if (created && createForm.exclusiveBrands.length > 0) {
        await setSupplierBrands(created.id, createForm.exclusiveBrands);
      }
      setCreateForm(emptyForm());
      setIsCreateOpen(false);
    } catch {
      // erro já mostrado via toast dentro dos hooks
    } finally {
      setIsSubmitting(false);
    }
  };
```

Em `src/components/SupplierManager.tsx:190-201`, `saveEditing` passa de:

```typescript
  const saveEditing = async () => {
    if (!editingId || !isFormValid(editForm) || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updateSupplier(editingId, formToInput(editForm));
      setEditingId(null);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSavingEdit(false);
    }
  };
```

para:

```typescript
  const saveEditing = async () => {
    if (!editingId || !isFormValid(editForm) || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await Promise.all([
        updateSupplier(editingId, formToInput(editForm)),
        setSupplierBrands(editingId, editForm.exclusiveBrands),
      ]);
      setEditingId(null);
    } catch {
      // erro já mostrado via toast dentro dos hooks
    } finally {
      setIsSavingEdit(false);
    }
  };
```

- [ ] **Step 6: Mostrar as marcas exclusivas no card do fornecedor**

Em `src/components/SupplierManager.tsx:273-279`, logo depois do bloco de
`avg_delivery_days`/`max_installments`, adicionar:

```tsx
                    {(supplier.avg_delivery_days != null || supplier.max_installments != null) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {supplier.avg_delivery_days != null && `Entrega em ~${supplier.avg_delivery_days} dias`}
                        {supplier.avg_delivery_days != null && supplier.max_installments != null && ' · '}
                        {supplier.max_installments != null && `Até ${supplier.max_installments}x`}
                      </p>
                    )}
                    {brandsForSupplier(supplier.id).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Marcas exclusivas: {brandsForSupplier(supplier.id).join(', ')}
                      </p>
                    )}
```

(o trecho existente de `avg_delivery_days`/`max_installments` continua
igual — só adiciona o novo `<p>` de marcas logo depois dele.)

- [ ] **Step 7: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 8: Verificação manual**

Com `npm run dev` rodando, na tela Fornecedores:

1. Criar um fornecedor novo, adicionar 2 marcas exclusivas (ex: "Start",
   "Azulim") — aparecem como badges removíveis antes de salvar, e no card
   depois de criado.
2. Editar esse fornecedor, remover uma marca, adicionar outra — salva
   corretamente.
3. Cadastrar a mesma marca ("Start") num fornecedor diferente — a marca some
   do primeiro fornecedor e aparece só no segundo (move, não duplica).

- [ ] **Step 9: Commit**

```bash
git add src/components/SupplierManager.tsx
git commit -m "feat(fornecedores): cadastro de marcas exclusivas na tela de fornecedores"
```

---

## Task 4: `useQuoteBatchComparison.ts` — grava `order_supplier_name`

**Files:**
- Modify: `src/hooks/useQuoteBatchComparison.ts`

**Interfaces:**
- Consumes: coluna `missing_products.order_supplier_name` da Task 1.
- Produces: nada consumido por outra task nesta spec (é consumido
  indiretamente pela Task 5, que lê a coluna, não a escrita em si).

- [ ] **Step 1: Gravar `order_supplier_name` em `generateSupplierOrder`**

Em `src/hooks/useQuoteBatchComparison.ts`, dentro de `generateSupplierOrder`,
o `update` de `missing_products` passa de:

```typescript
      const { error: missingUpdateError } = await supabase
        .from('missing_products')
        .update({
          status: 'pedido_enviado',
          order_sent_at: new Date().toISOString(),
          order_sent_by: user.id,
        })
        .in('id', missingProductIds)
        .eq('status', 'pendente');
```

para:

```typescript
      const { error: missingUpdateError } = await supabase
        .from('missing_products')
        .update({
          status: 'pedido_enviado',
          order_sent_at: new Date().toISOString(),
          order_sent_by: user.id,
          order_supplier_name: `${supplier.company_name} (${supplier.contact_name})`,
        })
        .in('id', missingProductIds)
        .eq('status', 'pendente');
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuoteBatchComparison.ts
git commit -m "feat(cotacoes): grava order_supplier_name ao gerar pedido por fornecedor"
```

---

## Task 5: `useMissingProducts.ts` — simplifica atribuição de fornecedor, edição, quantidade, envio direto

**Files:**
- Modify: `src/hooks/useMissingProducts.ts`

**Interfaces:**
- Consumes: colunas/policy da Task 1.
- Produces (usado pela Task 6):
  - `MissingProduct` ganha `order_supplier_name: string | null` e
    `order_quantity: number | null`; `supplierByMissingId` é removido do
    retorno do hook (não existe mais).
  - `updateMissingProduct(id: string, input: { productId: string; fragranceId: string | null; variationId: string | null; stockRemaining: number | null }): Promise<void>`
  - `updateOrderQuantity(id: string, quantity: number | null): Promise<void>`
  - `sendExclusiveSupplierOrder(itemIds: string[], supplierName: string): Promise<void>`

- [ ] **Step 1: Atualizar o tipo `MissingProduct`**

Em `src/hooks/useMissingProducts.ts:7-25`, trocar:

```typescript
export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido' | 'cancelado' | 'pedido_enviado';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  order_sent_at: string | null;
  order_sent_by: string | null;
  created_at: string;
  updated_at: string;
}
```

por:

```typescript
export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido' | 'cancelado' | 'pedido_enviado';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  order_sent_at: string | null;
  order_sent_by: string | null;
  order_supplier_name: string | null;
  order_quantity: number | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Remover o estado `supplierByMissingId`**

Em `src/hooks/useMissingProducts.ts:45-47`, trocar:

```typescript
  const [orderedProducts, setOrderedProducts] = useState<MissingProduct[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [supplierByMissingId, setSupplierByMissingId] = useState<Record<string, string>>({});
```

por:

```typescript
  const [orderedProducts, setOrderedProducts] = useState<MissingProduct[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
```

- [ ] **Step 3: Simplificar `fetchOrderedProducts`**

Em `src/hooks/useMissingProducts.ts:72-128`, trocar o bloco inteiro (do
comentário antes de `fetchOrderedProducts` até o fechamento da função):

```typescript
  // Busca os itens 'pedido_enviado' + o nome do fornecedor pra quem o
  // pedido foi gerado, via quote_batch_items → quote_item_winners →
  // quote_batch_suppliers → suppliers (mesmo padrão de embed reverso/forward
  // já usado em useQuoteBatchComparison.ts). quote_item_winners vem como
  // array (relação reversa a partir de quote_batch_items), mesmo sendo no
  // máximo 1 por item — o unique constraint garante isso no banco, não no
  // formato da resposta.
  const fetchOrderedProducts = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('missing_products')
        .select('*')
        .eq('status', 'pedido_enviado')
        .order('order_sent_at', { ascending: false });
      if (error) throw error;
      const rows = (data as MissingProduct[]) || [];
      setOrderedProducts(rows);

      if (rows.length === 0) {
        setSupplierByMissingId({});
        return;
      }

      const { data: winnerRows, error: winnerError } = await supabase
        .from('quote_batch_items')
        .select('missing_product_id, quote_item_winners(quote_batch_suppliers(suppliers(company_name)))')
        .in(
          'missing_product_id',
          rows.map((row) => row.id)
        );
      if (winnerError) throw winnerError;

      const typedWinnerRows = (winnerRows || []) as unknown as Array<{
        missing_product_id: string;
        quote_item_winners: Array<{
          quote_batch_suppliers: { suppliers: { company_name: string } | null } | null;
        }>;
      }>;

      const nextSupplierByMissingId: Record<string, string> = {};
      for (const row of typedWinnerRows) {
        const companyName = row.quote_item_winners[0]?.quote_batch_suppliers?.suppliers?.company_name;
        if (companyName) nextSupplierByMissingId[row.missing_product_id] = companyName;
      }
      setSupplierByMissingId(nextSupplierByMissingId);
    } catch (error) {
      console.error('Error fetching ordered missing products:', error);
      toast({
        title: 'Erro ao carregar pedidos enviados',
        description: 'Não foi possível carregar os itens aguardando confirmação.',
        variant: 'destructive',
      });
    } finally {
      setOrdersLoading(false);
    }
  }, []);
```

por:

```typescript
  // Busca os itens 'pedido_enviado'. O nome do fornecedor já vem pronto em
  // order_supplier_name (gravado no momento do pedido, tanto pelo fluxo de
  // cotação quanto pelo fluxo direto de marca exclusiva) — não precisa mais
  // cruzar com quote_batch_items/quote_item_winners.
  const fetchOrderedProducts = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('missing_products')
        .select('*')
        .eq('status', 'pedido_enviado')
        .order('order_sent_at', { ascending: false });
      if (error) throw error;
      setOrderedProducts((data as MissingProduct[]) || []);
    } catch (error) {
      console.error('Error fetching ordered missing products:', error);
      toast({
        title: 'Erro ao carregar pedidos enviados',
        description: 'Não foi possível carregar os itens aguardando confirmação.',
        variant: 'destructive',
      });
    } finally {
      setOrdersLoading(false);
    }
  }, []);
```

- [ ] **Step 4: `updateMissingProduct` (Parte 1 — editar item)**

Em `src/hooks/useMissingProducts.ts`, logo depois de `resolveMissingProduct`
(depois do fechamento da função, antes de `cancelMissingProduct`), adicionar:

```typescript
  const updateMissingProduct = async (
    id: string,
    input: {
      productId: string;
      fragranceId: string | null;
      variationId: string | null;
      stockRemaining: number | null;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({
          product_id: input.productId,
          fragrance_id: input.fragranceId,
          variation_id: input.variationId,
          stock_remaining: input.stockRemaining,
        })
        .eq('id', id)
        .eq('status', 'pendente');

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            'Já existe uma faltante pendente pra esse mesmo produto — resolva o conflito antes de editar.'
          );
        }
        throw error;
      }

      setMissingProducts((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                product_id: input.productId,
                fragrance_id: input.fragranceId,
                variation_id: input.variationId,
                stock_remaining: input.stockRemaining,
              }
            : item
        )
      );
      toast({ title: 'Faltante atualizada' });
    } catch (error) {
      console.error('Error updating missing product:', error);
      toast({
        title: 'Erro ao editar',
        description: error instanceof Error ? error.message : 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };
```

- [ ] **Step 5: `updateOrderQuantity` e `sendExclusiveSupplierOrder` (Parte 3)**

Logo depois de `cancelMissingProduct` (antes de `confirmOrderReceived`),
adicionar:

```typescript
  const updateOrderQuantity = async (id: string, quantity: number | null) => {
    try {
      const { error } = await supabase.from('missing_products').update({ order_quantity: quantity }).eq('id', id);
      if (error) throw error;
      setMissingProducts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, order_quantity: quantity } : item))
      );
    } catch (error) {
      console.error('Error updating missing product order quantity:', error);
      toast({
        title: 'Erro ao salvar quantidade',
        description: 'Não foi possível salvar esse valor.',
        variant: 'destructive',
      });
    }
  };

  // Fluxo direto de marca exclusiva: sem cotação, sem quote_batch — marca
  // os itens escolhidos direto como pedido_enviado, com o nome do
  // fornecedor gravado ali mesmo (mesmo campo que o fluxo de cotação usa).
  const sendExclusiveSupplierOrder = async (itemIds: string[], supplierName: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({
          status: 'pedido_enviado',
          order_sent_at: new Date().toISOString(),
          order_sent_by: user.id,
          order_supplier_name: supplierName,
        })
        .in('id', itemIds)
        .eq('status', 'pendente');
      if (error) throw error;

      setMissingProducts((prev) => prev.filter((item) => !itemIds.includes(item.id)));
      await fetchOrderedProducts();
      toast({ title: 'Pedido enviado', description: `${itemIds.length} item(ns) marcados como pedido enviado.` });
    } catch (error) {
      console.error('Error sending exclusive supplier order:', error);
      toast({
        title: 'Erro ao enviar pedido',
        description: 'Não foi possível marcar os itens como pedido enviado.',
        variant: 'destructive',
      });
      throw error;
    }
  };
```

- [ ] **Step 6: Expor tudo no retorno do hook**

Em `src/hooks/useMissingProducts.ts:429-444`, trocar:

```typescript
  return {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    refetch: fetchMissingProducts,
    displayNameStatus,
    orderedProducts,
    ordersLoading,
    supplierByMissingId,
    confirmOrderReceived,
    revertOrderToPending,
    refetchOrdered: fetchOrderedProducts,
  };
};
```

por:

```typescript
  return {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    updateMissingProduct,
    updateOrderQuantity,
    sendExclusiveSupplierOrder,
    refetch: fetchMissingProducts,
    displayNameStatus,
    orderedProducts,
    ordersLoading,
    confirmOrderReceived,
    revertOrderToPending,
    refetchOrdered: fetchOrderedProducts,
  };
};
```

- [ ] **Step 7: Verificar tipos**

Run: `npm run typecheck`
Expected: erros só em `src/components/MissingProductsManager.tsx` (ainda usa
`supplierByMissingId`, removido nesta task — resolvido na Task 6).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useMissingProducts.ts
git commit -m "refactor(faltantes): simplifica atribuição de fornecedor, adiciona editar item, quantidade e envio direto"
```

---

## Task 6: `MissingProductsManager.tsx` + `lib/purchaseOrder.ts` — UI

**Files:**
- Modify: `src/components/MissingProductsManager.tsx`
- Modify: `src/lib/purchaseOrder.ts`

**Interfaces:**
- Consumes: `useExclusiveBrands` (Task 2), `useMissingProducts` novo
  (Task 5).
- Produces: `buildDirectOrderMessage` em `purchaseOrder.ts`, usado só aqui.

- [ ] **Step 1: `buildDirectOrderMessage` em `purchaseOrder.ts`**

Em `src/lib/purchaseOrder.ts`, adicionar ao final do arquivo:

```typescript
export interface DirectOrderItem {
  name: string;
  quantity: number | null;
}

// Mensagem do fluxo direto de marca exclusiva — sem preço, já que não teve
// cotação (só existe 1 fornecedor possível pra essas marcas).
export const buildDirectOrderMessage = (items: DirectOrderItem[]): string => {
  const lines = items.map((item) =>
    item.quantity ? `• ${item.quantity}x ${item.name}` : `• ${item.name} (quantidade a combinar)`
  );
  return `Olá! Preciso desses itens:\n\n${lines.join('\n')}`;
};
```

- [ ] **Step 2: Novos imports em `MissingProductsManager.tsx`**

Em `src/components/MissingProductsManager.tsx:1-29`, trocar a linha de
ícones (linha 3):

```typescript
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck, Trash2, ExternalLink, PackageCheck } from 'lucide-react';
```

por:

```typescript
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck, Trash2, ExternalLink, PackageCheck, Pencil, Truck } from 'lucide-react';
```

E adicionar, depois de `import { useQuoteBatches } from '@/hooks/useQuoteBatches';`
(linha 29):

```typescript
import { useExclusiveBrands } from '@/hooks/useExclusiveBrands';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { buildDirectOrderMessage } from '@/lib/purchaseOrder';
```

- [ ] **Step 3: Puxar os hooks e montar o agrupamento de marca exclusiva**

Em `src/components/MissingProductsManager.tsx:203-227`, trocar:

```typescript
const MissingProductsManager = ({ products, staffAccess, onGoToProduct }: MissingProductsManagerProps) => {
  const {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    displayNameStatus,
    orderedProducts,
    ordersLoading,
    supplierByMissingId,
    confirmOrderReceived,
    revertOrderToPending,
  } = useMissingProducts();
  const { openItemIds } = useQuoteBatches();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const canOpenProduct = staffAccess.isAdmin || staffAccess.permissions.has('produtos');
  const productById = new Map(products.map((p) => [p.id, p]));
  // Prioridade continua sendo o mais reportado, mas dentro do mesmo report_count
  // agrupa variações do mesmo produto lado a lado em vez de ficarem espalhadas
  // na ordem em que cada uma foi reportada.
  const sortedMissingProducts = [...missingProducts].sort((a, b) => {
    if (b.report_count !== a.report_count) return b.report_count - a.report_count;
    return compareMissingItems(
      { product: productById.get(a.product_id), fragranceId: a.fragrance_id, variationId: a.variation_id },
      { product: productById.get(b.product_id), fragranceId: b.fragrance_id, variationId: b.variation_id }
    );
  });
  const hasChosenProduct = rows.some((row) => row.productId !== null);
  const hasIncompleteRow = rows.some((row) => row.productId !== null && !isRowComplete(row, productById));
```

por:

```typescript
const MissingProductsManager = ({ products, staffAccess, onGoToProduct }: MissingProductsManagerProps) => {
  const {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    updateMissingProduct,
    updateOrderQuantity,
    sendExclusiveSupplierOrder,
    displayNameStatus,
    orderedProducts,
    ordersLoading,
    confirmOrderReceived,
    revertOrderToPending,
  } = useMissingProducts();
  const { openItemIds } = useQuoteBatches();
  const { exclusiveBrands } = useExclusiveBrands();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const canOpenProduct = staffAccess.isAdmin || staffAccess.permissions.has('produtos');
  const productById = new Map(products.map((p) => [p.id, p]));
  // Prioridade continua sendo o mais reportado, mas dentro do mesmo report_count
  // agrupa variações do mesmo produto lado a lado em vez de ficarem espalhadas
  // na ordem em que cada uma foi reportada.
  const sortedMissingProducts = [...missingProducts].sort((a, b) => {
    if (b.report_count !== a.report_count) return b.report_count - a.report_count;
    return compareMissingItems(
      { product: productById.get(a.product_id), fragranceId: a.fragrance_id, variationId: a.variation_id },
      { product: productById.get(b.product_id), fragranceId: b.fragrance_id, variationId: b.variation_id }
    );
  });
  const hasChosenProduct = rows.some((row) => row.productId !== null);
  const hasIncompleteRow = rows.some((row) => row.productId !== null && !isRowComplete(row, productById));

  // Marca exclusiva: item sai da lista normal de Pendente e entra numa aba
  // própria, agrupado por fornecedor. Comparação por normalizeText ignora
  // acento/caixa entre products.brand e o texto cadastrado em Fornecedores.
  const exclusiveBrandByNormalized = new Map(exclusiveBrands.map((eb) => [normalizeText(eb.brand), eb]));
  const isExclusiveBrandItem = (item: (typeof sortedMissingProducts)[number]) => {
    const brand = productById.get(item.product_id)?.brand;
    return !!(brand && exclusiveBrandByNormalized.has(normalizeText(brand)));
  };
  const pendingNormalItems = sortedMissingProducts.filter((item) => !isExclusiveBrandItem(item));
  const pendingExclusiveItems = sortedMissingProducts.filter((item) => isExclusiveBrandItem(item));

  const exclusiveGroupsBySupplier = new Map<
    string,
    { supplierId: string; companyName: string; contactName: string; phone: string; items: typeof pendingExclusiveItems }
  >();
  for (const item of pendingExclusiveItems) {
    const brand = productById.get(item.product_id)?.brand ?? '';
    const eb = exclusiveBrandByNormalized.get(normalizeText(brand));
    if (!eb) continue;
    const group =
      exclusiveGroupsBySupplier.get(eb.supplier_id) ??
      {
        supplierId: eb.supplier_id,
        companyName: eb.supplier_company_name,
        contactName: eb.supplier_contact_name,
        phone: eb.supplier_phone,
        items: [],
      };
    group.items.push(item);
    exclusiveGroupsBySupplier.set(eb.supplier_id, group);
  }
  const sortedExclusiveGroups = Array.from(exclusiveGroupsBySupplier.values()).sort((a, b) =>
    a.companyName.localeCompare(b.companyName, 'pt-BR')
  );
```

- [ ] **Step 4: Handlers de editar item, quantidade e envio direto**

Em `src/components/MissingProductsManager.tsx`, logo depois de `handleCancel`
(antes do bloco `const [confirmingId, setConfirmingId] = ...`), adicionar:

```typescript
  const [editingItem, setEditingItem] = useState<(typeof sortedMissingProducts)[number] | null>(null);
  const [editRow, setEditRow] = useState<ReportRow>(emptyRow());
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [sendingSupplierId, setSendingSupplierId] = useState<string | null>(null);

  const startEditingItem = (item: (typeof sortedMissingProducts)[number]) => {
    setEditingItem(item);
    setEditRow({
      key: item.id,
      productId: item.product_id,
      fragranceId: item.fragrance_id,
      variationId: item.variation_id,
      stockRemaining: item.stock_remaining !== null ? String(item.stock_remaining) : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editRow.productId || !isRowComplete(editRow, productById)) return;
    setIsSavingEdit(true);
    try {
      await updateMissingProduct(editingItem.id, {
        productId: editRow.productId,
        fragranceId: editRow.fragranceId,
        variationId: editRow.variationId,
        stockRemaining: toNullableInt(editRow.stockRemaining),
      });
      setEditingItem(null);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOrderQuantityBlur = (id: string, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      updateOrderQuantity(id, null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    updateOrderQuantity(id, !Number.isNaN(parsed) && parsed > 0 ? parsed : null);
  };

  const handleSendExclusiveOrder = async (group: (typeof sortedExclusiveGroups)[number]) => {
    if (group.items.length === 0) return;
    setSendingSupplierId(group.supplierId);
    try {
      const supplierLabel = `${group.companyName} (${group.contactName})`;
      const messageItems = group.items.map((item) => ({
        name: buildMissingItemDisplayName(productById.get(item.product_id), item.fragrance_id, item.variation_id),
        quantity: item.order_quantity,
      }));
      // Abrir a aba do WhatsApp ANTES do await — alguns navegadores bloqueiam
      // window.open chamado depois de uma pausa assíncrona (tratam como
      // popup não-solicitado).
      window.open(buildWhatsAppLink(group.phone, buildDirectOrderMessage(messageItems)), '_blank', 'noopener,noreferrer');
      await sendExclusiveSupplierOrder(
        group.items.map((item) => item.id),
        supplierLabel
      );
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setSendingSupplierId(null);
    }
  };
```

- [ ] **Step 5: Botão "Editar" na aba Pendente**

Em `src/components/MissingProductsManager.tsx`, dentro do `.map` da aba
Pendente, o bloco de botões de ação passa de:

```tsx
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full px-2 py-1">
                          pedido {item.report_count}x
                        </span>
                        {canResolve && (
```

para:

```tsx
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full px-2 py-1">
                          pedido {item.report_count}x
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="Editar faltante"
                          onClick={() => startEditingItem(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canResolve && (
```

(o resto do bloco — botões "Marcar como resolvido" e o de cancelar — fica
igual, só ganhou o botão de Editar antes deles.)

Também trocar a fonte do `.map` da aba Pendente e do `AdminEmptyState`: onde
hoje é `sortedMissingProducts.map(...)` com gate em
`missingProducts.length === 0`, passa a ser `pendingNormalItems.map(...)`
com gate em `pendingNormalItems.length === 0` — ou seja, em
`src/components/MissingProductsManager.tsx`, dentro de `<TabsContent
value="pendente">`:

```tsx
          <TabsContent value="pendente">
            {loading ? (
              <AdminLoadingState rows={3} tone="light" />
            ) : missingProducts.length === 0 ? (
              <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
            ) : (
              <div className="space-y-3">
                {sortedMissingProducts.map((item) => {
```

vira:

```tsx
          <TabsContent value="pendente">
            {loading ? (
              <AdminLoadingState rows={3} tone="light" />
            ) : pendingNormalItems.length === 0 ? (
              <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
            ) : (
              <div className="space-y-3">
                {pendingNormalItems.map((item) => {
```

(o corpo do `.map` — o miolo que monta `displayName`, `inQuote`, os botões
etc — **não muda**, só a fonte dos dados iterados e a condição do empty
state.)

- [ ] **Step 6: Diálogo de editar item**

Em `src/components/MissingProductsManager.tsx`, logo depois do fechamento do
`<Dialog>` de "Reportar falta" (depois de `</Dialog></>` que fecha a `action`
do `AdminPageHeader`, ainda dentro do `<CardHeader>`), adicionar, como
elemento irmão logo após o `<AdminPageHeader ... />`:

```tsx
        {editingItem &&
          createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in-0 duration-300"
              onClick={() => setEditingItem(null)}
            />,
            document.body
          )}
        <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)} modal={false}>
          <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain">
            <DialogHeader>
              <DialogTitle>Editar faltante</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <ProductPicker
                products={products}
                value={editRow.productId}
                onChange={(productId) => setEditRow((r) => ({ ...r, productId, fragranceId: null, variationId: null }))}
              />
              <FragranceVariationFields
                product={editRow.productId ? productById.get(editRow.productId) : undefined}
                fragranceId={editRow.fragranceId}
                variationId={editRow.variationId}
                onFragranceChange={(fragranceId) => setEditRow((r) => ({ ...r, fragranceId, variationId: null }))}
                onVariationChange={(variationId) => setEditRow((r) => ({ ...r, variationId }))}
              />
              <div className="space-y-1">
                <Label htmlFor="edit-stock-remaining" className="text-xs text-muted-foreground">
                  Quantos ainda tem (opcional)
                </Label>
                <Input
                  id="edit-stock-remaining"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={editRow.stockRemaining}
                  onChange={(e) => setEditRow((r) => ({ ...r, stockRemaining: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editRow.productId || !isRowComplete(editRow, productById)}
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
```

Esse `<Dialog>` fica dentro do `<CardHeader>...</CardHeader>` (mesmo nível do
`AdminPageHeader`), não dentro da prop `action` — é um diálogo controlado à
parte, sem `DialogTrigger` (quem abre é o botão de lápis na linha, via
`startEditingItem`).

- [ ] **Step 7: Nova aba "Fornecedor exclusivo"**

Em `src/components/MissingProductsManager.tsx`, o `<TabsList>` passa de:

```tsx
          <TabsList className="mb-4">
            <TabsTrigger value="pendente">Pendente</TabsTrigger>
            <TabsTrigger value="aguardando">
              Aguardando confirmação
              {orderedProducts.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {orderedProducts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
```

para:

```tsx
          <TabsList className="mb-4">
            <TabsTrigger value="pendente">Pendente</TabsTrigger>
            <TabsTrigger value="exclusivo">
              Fornecedor exclusivo
              {pendingExclusiveItems.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {pendingExclusiveItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aguardando">
              Aguardando confirmação
              {orderedProducts.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {orderedProducts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
```

E, logo depois do `</TabsContent>` que fecha `value="pendente"` e antes do
`<TabsContent value="aguardando">`, adicionar:

```tsx
          <TabsContent value="exclusivo">
            {loading ? (
              <AdminLoadingState rows={3} tone="light" />
            ) : sortedExclusiveGroups.length === 0 ? (
              <AdminEmptyState icon={Truck} title="Nenhum item de marca exclusiva no momento." tone="light" />
            ) : (
              <div className="space-y-4">
                {sortedExclusiveGroups.map((group) => (
                  <div key={group.supplierId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium">
                        {group.companyName} ({group.contactName})
                      </p>
                      {canResolve && (
                        <Button
                          size="sm"
                          disabled={sendingSupplierId === group.supplierId}
                          onClick={() => handleSendExclusiveOrder(group)}
                        >
                          Enviar pedido
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => {
                        const displayName = buildMissingItemDisplayName(
                          productById.get(item.product_id),
                          item.fragrance_id,
                          item.variation_id
                        );
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.stock_remaining !== null
                                  ? `${item.stock_remaining} restando`
                                  : 'Quantidade não informada'}
                              </p>
                            </div>
                            {canResolve && (
                              <Input
                                key={item.id}
                                type="number"
                                min="1"
                                placeholder="Qtd"
                                className="h-8 w-20"
                                defaultValue={item.order_quantity ?? ''}
                                onBlur={(e) => handleOrderQuantityBlur(item.id, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
```

- [ ] **Step 8: Trocar o nome do fornecedor na aba "Aguardando confirmação"**

Em `src/components/MissingProductsManager.tsx`, dentro de `<TabsContent
value="aguardando">`, trocar:

```tsx
                {orderedProducts.map((item) => {
                  const product = productById.get(item.product_id);
                  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                  const supplierName = supplierByMissingId[item.id];
                  return (
                    <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {supplierName ? `Pedido em ${supplierName}` : 'Pedido gerado'}
```

por:

```tsx
                {orderedProducts.map((item) => {
                  const product = productById.get(item.product_id);
                  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                  return (
                    <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.order_supplier_name ? `Pedido em ${item.order_supplier_name}` : 'Pedido gerado'}
```

- [ ] **Step 9: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 10: Verificação manual**

Com `npm run dev` rodando, na tela Faltantes:

1. Editar um item pendente (ícone lápis) — troca fragrância, salva, reflete
   na lista.
2. Editar um item pra um combo que já existe pendente — mostra o erro
   específico, não deixa salvar.
3. Depois de cadastrar uma marca exclusiva num fornecedor (Task 3), reportar
   um produto dessa marca como faltante — aparece na aba "Fornecedor
   exclusivo", não em "Pendente".
4. Preencher quantidade num item da aba nova, clicar "Enviar pedido" —
   WhatsApp abre com a mensagem certa (com e sem quantidade preenchida em
   itens diferentes do mesmo grupo), o grupo some da aba (ou fica menor) e os
   itens aparecem em "Aguardando confirmação" com o nome do fornecedor
   certo.
5. Gerar um pedido pelo fluxo normal de cotação (D2c) — nome do fornecedor
   em "Aguardando confirmação" continua aparecendo certo.
6. Usuário com só `faltantes` (sem `fornecedores`): vê a aba "Fornecedor
   exclusivo" e os itens, mas não vê o botão "Enviar pedido" nem o campo de
   quantidade.

- [ ] **Step 11: Commit**

```bash
git add src/components/MissingProductsManager.tsx src/lib/purchaseOrder.ts
git commit -m "feat(faltantes): editar item, aba Fornecedor exclusivo com pedido direto sem cotação"
```

---

## Self-Review Notes

- **Spec coverage:** editar produto/fragrância/quantidade de item pendente
  (Task 5 `updateMissingProduct` + Task 6 diálogo) ✓; cadastro de marca
  exclusiva na tela de Fornecedores, marca pertence a 1 fornecedor só, mover
  em vez de duplicar (Tasks 1-3) ✓; aba "Fornecedor exclusivo" com partição
  (não duplicação) dos itens, agrupado por fornecedor, quantidade editável,
  pedido direto sem cotação (Task 6) ✓; automotivo tratado como "mais uma
  marca exclusiva", sem mecanismo especial (confirmado na conversa, não
  precisa de task própria) ✓; `order_supplier_name` substituindo o
  cruzamento antigo, usado pelos dois fluxos (Tasks 1, 4, 5) ✓; gate de
  permissão do botão Editar (faltantes, igual reportar) vs. Enviar
  pedido/quantidade (faltantes+fornecedores, igual resolver) — refletido na
  policy de RLS nova (Task 1 Step 3) e nos gates de UI (Task 6) ✓.
- **Placeholder scan:** nenhum "TBD" — todo step com código completo.
- **Type consistency:** `updateMissingProduct`/`updateOrderQuantity`/
  `sendExclusiveSupplierOrder` usados com a mesma assinatura em Task 5
  (definição) e Task 6 (uso); `ExclusiveBrand`/`brandsForSupplier`/
  `setSupplierBrands` usados com a mesma assinatura em Task 2 (definição) e
  Tasks 3/6 (uso).
- **Risco a observar na verificação manual:** a policy de RLS nova (Task 1
  Step 3) é o ponto mais sensível — se editar um item pendente falhar com
  erro de permissão pra alguém que só tem `faltantes` (não é quem reportou
  originalmente), checar se essa policy foi aplicada e está com o `with
  check` certo antes de mexer em qualquer código de cliente.
