# Faltantes — Registro e Lista (Parte D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registro de produtos faltando (funcionário escolhe produto(s) já cadastrado(s), em lote, com quantidade opcional) + lista consolidada pra quem também tem a permissão `fornecedores` marcar como resolvido — destravando o item "Faltantes" que já existe na sidebar (hoje "em breve").

**Architecture:** Uma tabela nova `missing_products` no Supabase — uma linha por produto **enquanto pendente** (índice único parcial garante isso; reportar de novo o mesmo produto incrementa um contador em vez de duplicar linha). RLS usa os helpers já existentes (`has_staff_permission`) com um detalhe novo: reportar/reincrementar exige só `faltantes`, mas resolver (mudar o status pra `resolvido`) exige `faltantes` **e** `fornecedores` — implementado com duas policies de `update` permissivas, uma travada por `with check` a nunca deixar o status sair de `pendente`. O nome de quem reportou é gravado direto na linha (`reported_by_name`) porque a RLS de `staff_members` (Parte A, não alterada aqui) só deixa cada funcionário ver a própria linha — não dá pra resolver o nome de outro funcionário via join. Um hook `useMissingProducts.ts` e um componente `MissingProductsManager.tsx`, seguindo o mesmo padrão de `useSuppliers.ts`/`SupplierManager.tsx` (Parte C). `adminNav.ts`, `Admin.tsx` e `AdminHome.tsx` são atualizados pra destravar o item e corrigir o Início (mesmo ajuste já feito pra `fornecedores`).

**Tech Stack:** React + TypeScript + Tailwind + shadcn/ui + Supabase (já usados no projeto). Usa os componentes `Command`/`Popover` do shadcn (já existem em `src/components/ui/`, nunca usados em nenhuma tela ainda) pra montar um combobox pesquisável de produtos — nenhuma dependência nova.

## Global Constraints

- Esta parte é só o registro + lista de faltantes (D1). **Não implementar** nada do fluxo de cotação (selecionar itens → gerar mensagem → coletar preços → comparar → gerar pedido de compra) — isso é a Parte D2, com spec e plano próprios, fora do escopo deste plano.
- Nenhuma mudança em `useStaffAccess.ts`, na RLS de `staff_members`/`staff_permissions`/`products`, ou em qualquer lógica das Partes A/B/C — só a tabela `missing_products` é nova.
- Sem tela/aba de histórico de itens resolvidos nesta parte — fica só `status = 'resolvido'` no banco.
- Sem edição de uma linha pendente além de "reportar de novo" (incrementa) ou "resolver" — sem editar quantidade isolada, sem excluir um report por engano.
- Componentes visuais reaproveitam os já existentes (`AdminPageHeader`, `AdminEmptyState`, `AdminLoadingState`) — `Card`/`CardHeader` seguem o padrão: `CardHeader` com `className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg"`, `CardContent` no tema claro padrão, qualquer `AdminEmptyState`/`AdminLoadingState` dentro do `CardContent` leva `tone="light"`.
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) é a verificação real do projeto — não `npm run build`.
- Strings visíveis pro usuário em português.

---

### Task 1: Migration — tabela `missing_products`

**Files:**
- Create: `supabase/migrations/20260808120000_missing_products.sql`

**Interfaces:**
- Produz: tabela `public.missing_products` com colunas `id, product_id, stock_remaining, report_count, status, reported_by, reported_by_name, resolved_by, resolved_at, created_at, updated_at`. Índice único parcial `(product_id) where status = 'pendente'`. Quatro policies de RLS (select, insert, update-reportar-de-novo, update-resolver).
- Consome: `public.has_staff_permission(staff_permission)` e `public.update_updated_at_column()` (já existentes em produção), `public.products(id)` e `public.staff_members(user_id)` (já existentes).

- [ ] **Step 1: Escrever a migration**

```sql
begin;

-- status é texto simples (com check), não um enum: a Parte D2 vai estender
-- esse conjunto (ex.: 'em_cotacao') e alterar um check constraint é mais
-- simples/seguro do que alterar um enum do Postgres em produção.
create table public.missing_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  stock_remaining integer,
  report_count integer not null default 1,
  status text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  reported_by uuid not null,
  reported_by_name text not null,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missing_products_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade,
  constraint missing_products_reported_by_fkey foreign key (reported_by) references public.staff_members(user_id),
  constraint missing_products_resolved_by_fkey foreign key (resolved_by) references public.staff_members(user_id)
);

-- Só pode existir 1 linha pendente por produto — reportar de novo o mesmo
-- produto atualiza essa linha (incrementa report_count) em vez de duplicar.
create unique index missing_products_pending_product_idx
  on public.missing_products (product_id)
  where status = 'pendente';

create trigger update_missing_products_updated_at
  before update on public.missing_products
  for each row
  execute function public.update_updated_at_column();

alter table public.missing_products enable row level security;

create policy "Staff com permissão faltantes vê faltantes"
  on public.missing_products
  for select
  using (public.has_staff_permission('faltantes'));

create policy "Staff com permissão faltantes reporta produto novo"
  on public.missing_products
  for insert
  with check (public.has_staff_permission('faltantes') and reported_by = auth.uid());

-- Deixa qualquer um com 'faltantes' reportar de novo um produto já pendente
-- (incrementando o contador), mas o with check trava a linha resultante em
-- status = 'pendente' — esse caminho nunca pode ser usado pra resolver.
create policy "Staff com permissão faltantes reporta de novo produto pendente"
  on public.missing_products
  for update
  using (public.has_staff_permission('faltantes'))
  with check (public.has_staff_permission('faltantes') and status = 'pendente');

-- Só quem tem as duas permissões consegue de fato marcar como resolvido —
-- como as duas policies de update são combinadas com OR, quem só tem
-- 'faltantes' nunca satisfaz o with check de nenhuma das duas ao tentar
-- setar status = 'resolvido' (a de cima barra pelo status, esta barra pela
-- permissão).
create policy "Staff com faltantes e fornecedores resolve faltante"
  on public.missing_products
  for update
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

commit;
```

- [ ] **Step 2: Verificar que o arquivo não tem erro de sintaxe óbvio**

Este arquivo só será executado de verdade na Task 2 (controller, via `apply_migration`). Nesta task, confirme que o SQL está bem formado lendo o arquivo de volta — não há `npm run typecheck` que valide SQL.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260808120000_missing_products.sql
git commit -m "feat(db): tabela missing_products com RLS por permissão faltantes/fornecedores (não aplicada ainda)"
```

---

### Task 2 (controller): Aplicar migration + regenerar tipos

**Não delega pra subagent** — mudança direta em produção, mesmo padrão usado nas Partes A/B/C (migrations sempre aplicadas pelo controller via MCP, nunca por um subagent).

- [ ] Aplicar a migration da Task 1 em produção via `apply_migration` (project_id `ccrucholgsffichvzbpz`).
- [ ] Confirmar que a tabela `missing_products` existe, o índice único parcial e as 4 policies foram criados (`list_tables` ou uma query direta).
- [ ] Regenerar `src/integrations/supabase/types.ts` via `generate_typescript_types` e sobrescrever o arquivo.
- [ ] Rodar `npm run typecheck` pra confirmar que o novo `types.ts` compila.
- [ ] Commit:

```bash
git add supabase/migrations/20260808120000_missing_products.sql src/integrations/supabase/types.ts
git commit -m "chore(db): aplicar migration missing_products e regenerar tipos"
```

---

### Task 3: `useMissingProducts.ts`

**Files:**
- Create: `src/hooks/useMissingProducts.ts`

**Interfaces:**
- Consome: `supabase` de `@/integrations/supabase/client`, `useAuth` de `@/contexts/AuthContext`, `toast` de `@/hooks/use-toast` (todos já existentes). A tabela `missing_products` (Task 2, já aplicada e nos tipos gerados).
- Produz: `MissingProduct` interface, `MissingProductReportItem` interface, `ReportBatchResult` interface, `useMissingProducts()` retornando `{ missingProducts, loading, reportMissingProducts, resolveMissingProduct, refetch }`.

- [ ] **Step 1: Criar o hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface MissingProduct {
  id: string;
  product_id: string;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido';
  reported_by: string;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissingProductReportItem {
  productId: string;
  stockRemaining: number | null;
}

export interface ReportBatchResult {
  succeeded: string[];
  failed: string[];
}

export const useMissingProducts = () => {
  const { user } = useAuth();
  const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null);

  // RLS de staff_members só deixa cada funcionário ver a própria linha, então
  // buscamos o display_name do usuário atual uma vez pra carimbar em
  // reported_by_name — não dá pra resolver o nome de OUTRO funcionário via
  // join (por isso o nome é gravado direto na linha, não buscado depois).
  useEffect(() => {
    if (!user) {
      setCurrentDisplayName(null);
      return;
    }
    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCurrentDisplayName(data?.display_name ?? null));
  }, [user]);

  const fetchMissingProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('missing_products')
        .select('*')
        .eq('status', 'pendente')
        .order('report_count', { ascending: false });

      if (error) throw error;
      setMissingProducts((data as MissingProduct[]) || []);
    } catch (error) {
      console.error('Error fetching missing products:', error);
      toast({
        title: 'Erro ao carregar faltantes',
        description: 'Não foi possível carregar a lista de produtos faltando.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Incrementa uma linha pendente já existente — usado tanto pro caminho
  // normal (já existia quando buscamos) quanto pra corrida (Postgres recusou
  // o insert por violar o índice único; buscamos a linha que apareceu nesse
  // meio-tempo e tratamos como um reporte de novo, sem propagar erro).
  const applyIncrement = async (
    existingId: string,
    existingReportCount: number,
    stockRemaining: number | null,
    userId: string,
    reporterName: string
  ) => {
    const updatePayload: Record<string, unknown> = {
      report_count: existingReportCount + 1,
      reported_by: userId,
      reported_by_name: reporterName,
    };
    if (stockRemaining !== null) {
      updatePayload.stock_remaining = stockRemaining;
    }
    const { error } = await supabase.from('missing_products').update(updatePayload).eq('id', existingId);
    if (error) throw error;
  };

  const reportMissingProducts = async (items: MissingProductReportItem[]): Promise<ReportBatchResult> => {
    if (!user) throw new Error('Usuário não autenticado');

    const userId = user.id;
    const reporterName = currentDisplayName || user.email || 'Funcionário';
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      try {
        const { data: existing, error: fetchError } = await supabase
          .from('missing_products')
          .select('id, report_count')
          .eq('product_id', item.productId)
          .eq('status', 'pendente')
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
          await applyIncrement(existing.id, existing.report_count, item.stockRemaining, userId, reporterName);
        } else {
          const { error: insertError } = await supabase
            .from('missing_products')
            .insert([
              {
                product_id: item.productId,
                stock_remaining: item.stockRemaining,
                reported_by: userId,
                reported_by_name: reporterName,
              },
            ]);

          if (insertError) {
            // Código 23505 = violação de índice único: outra pessoa criou a
            // linha pendente entre o select acima e este insert. Busca a
            // linha que acabou de aparecer e trata como reporte de novo, em
            // vez de mostrar erro pro usuário por causa de uma corrida.
            if (insertError.code === '23505') {
              const { data: justCreated, error: refetchError } = await supabase
                .from('missing_products')
                .select('id, report_count')
                .eq('product_id', item.productId)
                .eq('status', 'pendente')
                .maybeSingle();

              if (refetchError || !justCreated) throw insertError;

              await applyIncrement(justCreated.id, justCreated.report_count, item.stockRemaining, userId, reporterName);
            } else {
              throw insertError;
            }
          }
        }

        succeeded.push(item.productId);
      } catch (error) {
        console.error('Error reporting missing product:', error, item);
        failed.push(item.productId);
      }
    }

    await fetchMissingProducts();

    if (failed.length === 0) {
      toast({
        title: 'Faltantes registradas',
        description: `${succeeded.length} produto(s) registrado(s) com sucesso.`,
      });
    } else if (succeeded.length > 0) {
      toast({
        title: 'Alguns itens não foram registrados',
        description: `${succeeded.length} salvos, ${failed.length} com erro. Tente reenviar os que falharam.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erro ao registrar faltantes',
        description: 'Não foi possível registrar os produtos.',
        variant: 'destructive',
      });
    }

    return { succeeded, failed };
  };

  const resolveMissingProduct = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({
          status: 'resolvido',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setMissingProducts((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Faltante resolvida' });
    } catch (error) {
      console.error('Error resolving missing product:', error);
      toast({
        title: 'Erro ao marcar como resolvido',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMissingProducts();
  }, [fetchMissingProducts]);

  return { missingProducts, loading, reportMissingProducts, resolveMissingProduct, refetch: fetchMissingProducts };
};
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros. Se der erro sobre `missing_products` não existir no tipo `Database`, o `types.ts` da Task 2 não foi aplicado corretamente neste worktree — pare e avise, não invente um tipo manual pra contornar.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMissingProducts.ts
git commit -m "feat(hooks): useMissingProducts (registro em lote e resolução de faltantes)"
```

---

### Task 4: `MissingProductsManager.tsx`

**Files:**
- Create: `src/components/MissingProductsManager.tsx`

**Interfaces:**
- Consome: `useMissingProducts`/`MissingProduct`/`MissingProductReportItem` (Task 3), `ProductWithVariations` de `@/types/product` (já existente), `StaffAccess` de `@/hooks/useStaffAccess` (já existente), `AdminPageHeader`/`AdminEmptyState`/`AdminLoadingState` de `./admin/...` (já existentes), `cn` de `@/lib/utils` (já existente), componentes `Command`/`Popover` de `@/components/ui/...` (já existem, nunca usados em nenhuma tela ainda).
- Produz: `MissingProductsManager` — recebe `products: ProductWithVariations[]` e `staffAccess: StaffAccess` como props, export default.

- [ ] **Step 1: Criar o componente**

```tsx
import { useState } from 'react';
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useMissingProducts, MissingProductReportItem } from '@/hooks/useMissingProducts';
import { ProductWithVariations } from '@/types/product';
import { StaffAccess } from '@/hooks/useStaffAccess';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { cn } from '@/lib/utils';

interface ReportRow {
  key: string;
  productId: string | null;
  stockRemaining: string;
}

const emptyRow = (): ReportRow => ({
  key: crypto.randomUUID(),
  productId: null,
  stockRemaining: '',
});

const toNullableInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
};

interface ProductPickerProps {
  products: ProductWithVariations[];
  excludeIds: string[];
  value: string | null;
  onChange: (productId: string) => void;
}

// Combobox pesquisável — padrão shadcn (Popover + Command). excludeIds tira
// da lista os produtos já escolhidos em OUTRAS linhas do lote atual, pra não
// deixar reportar o mesmo produto duas vezes na mesma leva.
const ProductPicker = ({ products, excludeIds, value, onChange }: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const available = products.filter((p) => p.id === value || !excludeIds.includes(p.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.name : 'Escolher produto...'}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {available.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onChange(product.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === product.id ? 'opacity-100' : 'opacity-0')} />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface MissingProductsManagerProps {
  products: ProductWithVariations[];
  staffAccess: StaffAccess;
}

const MissingProductsManager = ({ products, staffAccess }: MissingProductsManagerProps) => {
  const { missingProducts, loading, reportMissingProducts, resolveMissingProduct } = useMissingProducts();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const canResolve = staffAccess.isAdmin || staffAccess.permissions.has('fornecedores');
  const productById = new Map(products.map((p) => [p.id, p]));
  const chosenProductIds = rows.map((r) => r.productId).filter((id): id is string => id !== null);
  const hasChosenProduct = chosenProductIds.length > 0;

  const updateRow = (key: string, updater: (row: ReportRow) => ReportRow) => {
    setRows((prev) => prev.map((row) => (row.key === key ? updater(row) : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (key: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)));

  const openReportDialog = () => {
    setRows([emptyRow()]);
    setIsReportOpen(true);
  };

  const handleSubmit = async () => {
    const items: MissingProductReportItem[] = rows
      .filter((row) => row.productId !== null)
      .map((row) => ({ productId: row.productId as string, stockRemaining: toNullableInt(row.stockRemaining) }));

    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      const { succeeded } = await reportMissingProducts(items);
      const stillPending = rows.filter((row) => row.productId !== null && !succeeded.includes(row.productId));

      if (stillPending.length === 0) {
        setRows([emptyRow()]);
        setIsReportOpen(false);
      } else {
        setRows(stillPending);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await resolveMissingProduct(id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={ClipboardCheck}
          title="Faltantes"
          description="Registre produtos que estão acabando e acompanhe o que ainda precisa ser resolvido."
          action={
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
              <DialogTrigger asChild>
                <Button onClick={openReportDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Reportar falta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Reportar produtos faltando</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <ProductPicker
                          products={products}
                          excludeIds={chosenProductIds.filter((id) => id !== row.productId)}
                          value={row.productId}
                          onChange={(productId) => updateRow(row.key, (r) => ({ ...r, productId }))}
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`stock-${row.key}`} className="text-xs text-muted-foreground">
                            Quantos ainda tem (opcional)
                          </Label>
                          <Input
                            id={`stock-${row.key}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.stockRemaining}
                            onChange={(e) => updateRow(row.key, (r) => ({ ...r, stockRemaining: e.target.value }))}
                          />
                        </div>
                      </div>
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-1"
                          aria-label="Remover produto"
                          onClick={() => removeRow(row.key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar outro produto
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={handleSubmit} disabled={isSubmitting || !hasChosenProduct}>
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : missingProducts.length === 0 ? (
          <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
        ) : (
          <div className="space-y-3">
            {missingProducts.map((item) => {
              const product = productById.get(item.product_id);
              return (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{product?.name || 'Produto removido'}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.stock_remaining !== null ? `${item.stock_remaining} restando` : 'Quantidade não informada'}
                      {' · '}
                      Reportado por {item.reported_by_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full px-2 py-1">
                      pedido {item.report_count}x
                    </span>
                    {canResolve && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === item.id}
                        onClick={() => handleResolve(item.id)}
                      >
                        Marcar como resolvido
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MissingProductsManager;
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/MissingProductsManager.tsx
git commit -m "feat(admin): componente MissingProductsManager (registro e lista de faltantes)"
```

---

### Task 5: Destravar "Faltantes" na navegação e no Início

**Files:**
- Modify: `src/components/admin/adminNav.ts` (1 linha)
- Modify: `src/pages/Admin.tsx` (imports + 1 `case`)
- Modify: `src/components/admin/AdminHome.tsx` (atalho + correção de texto)

**Interfaces:**
- Consome: `MissingProductsManager` (Task 4).

- [ ] **Step 1: Editar `adminNav.ts`**

Troque a linha do item `missing` (dentro de `ADMIN_NAV_ITEMS`):

```ts
  { key: 'missing', label: 'Faltantes', icon: ClipboardCheck, comingSoon: true, group: 'operacao' },
```

por:

```ts
  { key: 'missing', label: 'Faltantes', icon: ClipboardCheck, permission: 'faltantes', group: 'operacao' },
```

Nenhuma outra linha do arquivo muda.

- [ ] **Step 2: Editar `Admin.tsx`**

Adicione o import do `MissingProductsManager` junto aos outros imports de componentes de seção (perto de `import SupplierManager from '@/components/SupplierManager';`):

```tsx
import MissingProductsManager from '@/components/MissingProductsManager';
```

Troque o `case 'missing'` dentro de `renderSection()`:

```tsx
      case 'missing':
        return (
          <AdminComingSoon
            icon={ClipboardCheck}
            title="Faltantes"
            description="Em breve você vai poder registrar produtos faltantes e gerar cotações automaticamente."
          />
        );
```

por:

```tsx
      case 'missing':
        return <MissingProductsManager products={products} staffAccess={staffAccess} />;
```

Depois dessa troca, `ClipboardCheck` (de `'lucide-react'`) e `AdminComingSoon` (de `'@/components/admin/AdminComingSoon'`) ficam sem nenhum uso em `Admin.tsx` — eram usados só neste `case`, e o `case 'suppliers'` já não usa nenhum dos dois desde a Parte C. Remova as duas importações:
- Tire `ClipboardCheck` da lista de ícones importada de `lucide-react` no topo do arquivo (a linha fica `import { Plus, Package, Search, Loader2 } from 'lucide-react';`).
- Remova a linha inteira `import AdminComingSoon from '@/components/admin/AdminComingSoon';`.

- [ ] **Step 3: Editar `AdminHome.tsx`**

Adicione `ClipboardCheck` à importação de ícones (linha 2):

```ts
import { DollarSign, ClipboardList, ChevronRight, Truck, ClipboardCheck } from 'lucide-react';
```

Adicione a checagem de `faltantes` junto com as outras (depois de `showFornecedores`):

```ts
  const showFaltantes = staffAccess.isAdmin || staffAccess.permissions.has('faltantes');
```

E inclua no `hasNothing`:

```ts
  const hasNothing = !showFinanceiro && !showProdutos && !showFornecedores && !showFaltantes;
```

Como esta é a última das quatro seções (Financeiro, Produtos, Fornecedores, Faltantes) a ganhar tela de verdade, o texto do estado vazio não faz mais sentido apontando pra "próxima etapa" — troque a `description` do `AdminComingSoon` dentro de `hasNothing`:

```tsx
        <AdminComingSoon
          title="Ainda sem seções liberadas"
          description="Sua conta ainda não tem nenhuma seção com conteúdo pronto. Peça para um administrador liberar alguma permissão pra você."
        />
```

Por fim, adicione o atalho de Faltantes depois do bloco de `showFornecedores` (mesmo padrão dos outros `ShortcutCard`):

```tsx
          {showFaltantes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShortcutCard
                icon={ClipboardCheck}
                title="Faltantes"
                description="Veja e registre produtos que estão acabando"
                onClick={() => onNavigate('missing')}
              />
            </div>
          )}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/adminNav.ts src/pages/Admin.tsx src/components/admin/AdminHome.tsx
git commit -m "feat(admin): destravar seção Faltantes na navegação e no Início"
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

1. Logar como admin, abrir `/admin`, clicar em "Faltantes" na sidebar. Confirmar que não é mais a tela "em breve" — é a lista de faltantes (vazia no início). Conferir também que o atalho "Faltantes" aparece no Início.
2. Reportar 1 produto sozinho, com "quantos ainda tem" preenchido. Confirmar que aparece na lista com o contador "pedido 1x".
3. Reportar um lote de 2-3 produtos numa única submissão do diálogo (usando "+ Adicionar outro produto"), um deles sem preencher "quantos ainda tem". Confirmar que todos aparecem na lista.
4. Tentar escolher, numa segunda linha do mesmo lote (antes de enviar), um produto já escolhido na primeira linha — confirmar que ele não aparece mais como opção no combobox dessa segunda linha.
5. Reportar de novo um produto que já está pendente (fora do lote, numa nova abertura do diálogo) — confirmar que o contador daquele item sobe (ex: de "pedido 1x" pra "pedido 2x") em vez de criar uma linha duplicada, e que "Reportado por" atualiza pro nome de quem reportou agora.
6. Confirmar que a lista está ordenada do maior contador pro menor.
7. Marcar um item como resolvido logado como admin (ou como funcionário com `faltantes` + `fornecedores`) — confirmar que ele some da lista.
8. Testar como funcionário só com `faltantes` (sem `fornecedores`): confirmar que ele vê a lista e consegue reportar, mas o botão "Marcar como resolvido" não aparece nas linhas.
9. Testar como funcionário sem `faltantes`: confirmar que o item "Faltantes" não aparece na sidebar nem no atalho do Início.

- [ ] **Step 3: Reportar resultado**

Se algum item do roteiro falhar, corrigir antes de considerar a task concluída. Se tudo passar, seguir pra revisão final de branch inteira (fora do escopo desta task — próxima etapa do processo).
