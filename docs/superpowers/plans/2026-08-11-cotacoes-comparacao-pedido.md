# Cotações — comparação, pedido de compra e reatribuição por IA (Parte D2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o fluxo de Cotações — comparar preços entre fornecedores, escolher vencedor por item (automático, manual ou por comando de IA), gerar o pedido de compra (WhatsApp + PDF) e fechar o lote resolvendo os itens de Faltantes correspondentes.

**Architecture:** Uma tabela nova (`quote_item_winners`) guarda o vencedor de cada item do lote. Uma tela nova (`QuoteBatchComparison`) mostra a matriz de preços, deixa reatribuir manualmente ou por chat (Edge Function `apply-quote-reassignment`, Gemini) e, ao confirmar, fecha o lote e gera os pedidos por fornecedor (WhatsApp via `wa.me`, PDF gerado no navegador com `jsPDF`).

**Tech Stack:** React + TypeScript, Supabase (Postgres + RLS + Edge Functions Deno), Gemini API (`gemini-3.5-flash`), `jsPDF` (novo, client-side).

## Global Constraints

- Sem suíte automatizada neste projeto — verificação é `npm run typecheck` + teste manual, mesmo padrão do D2a.
- RLS de toda tabela nova: `has_staff_permission('faltantes') AND has_staff_permission('fornecedores')` — mesma combinação já usada em todas as tabelas de Cotações, sem permissão nova.
- `created_by`/`updated_by`/`set_by` etc. sempre FK pra `public.staff_members(user_id)` (não `auth.users(id)` direto) `on delete set null`, com o campo `_name` denormalizado `not null` — confirmado no schema real de `quote_batches.created_by` (`supabase/migrations/20260811120000_quote_batches.sql`).
- Edge Functions novas seguem o padrão de auth de `supabase/functions/extract-quote-prices/index.ts`: valida JWT com client anon, confere `staff_members`/`staff_permissions` com client service role, todas as escritas usam o client service role.
- Chamadas ao Gemini usam `gemini-3.5-flash` (nunca `gemini-flash-latest`) com `generationConfig.thinkingConfig: { thinkingLevel: "minimal" }`, tratam `status === 429` com mensagem própria de cota excedida, e tratam `finishReason === "MAX_TOKENS"` — tudo copiado do padrão já em produção em `extract-quote-prices`.
- Mensagem de WhatsApp usa sempre `https://wa.me/<telefone-com-55>?text=<mensagem-codificada>` (`encodeURIComponent`) — mesmo padrão usado em `CartContext.tsx`, `OrderHistory.tsx`, `Cart.tsx`, `Hero.tsx`, `Header.tsx`.
- Card de tela admin sempre com `CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4"` e título `<h2 className="text-2xl font-heading text-white">` — mesmo padrão visual de `QuoteBatchDetail.tsx` e `QuoteBatchSupplierReview.tsx`.
- Nome de exibição de quem faz a ação sempre vem de `useCurrentStaffName()` (nunca de `user.email` ou similar).

---

### Task 1: Migração — quantidade, status `concluido` e tabela de vencedores

**Files:**
- Create: `supabase/migrations/20260811140000_quote_batch_comparison.sql`

**Interfaces:**
- Produces: coluna `quote_batch_items.quantity` (integer, not null, default 1, check > 0); `quote_batches.status` aceitando `'concluido'`; colunas `quote_batches.completed_at`, `completed_by`, `completed_by_name`; tabela `quote_item_winners(id, quote_batch_item_id, quote_batch_supplier_id, source, set_by, set_by_name, set_at)` com RLS.

- [ ] **Step 1: Escrever a migração**

```sql
begin;

alter table public.quote_batch_items
  add column quantity integer not null default 1
    constraint quote_batch_items_quantity_check check (quantity > 0);

alter table public.quote_batches
  drop constraint quote_batches_status_check,
  add constraint quote_batches_status_check check (status in ('aberto', 'cancelado', 'concluido')),
  add column completed_at timestamptz,
  add column completed_by uuid references public.staff_members(user_id) on delete set null,
  add column completed_by_name text;

create table public.quote_item_winners (
  id uuid primary key default gen_random_uuid(),
  quote_batch_item_id uuid not null unique references public.quote_batch_items(id) on delete cascade,
  quote_batch_supplier_id uuid not null references public.quote_batch_suppliers(id) on delete cascade,
  source text not null constraint quote_item_winners_source_check check (source in ('auto', 'manual', 'ia')),
  set_by uuid references public.staff_members(user_id) on delete set null,
  set_by_name text not null,
  set_at timestamptz not null default now()
);

alter table public.quote_item_winners enable row level security;

create policy "Staff com faltantes e fornecedores gerencia quote_item_winners"
  on public.quote_item_winners for all
  using (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'))
  with check (public.has_staff_permission('faltantes') and public.has_staff_permission('fornecedores'));

commit;
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase de produção**

Usar a ferramenta MCP do Supabase (`apply_migration`) com o nome
`quote_batch_comparison` e o SQL acima. Confirmar com `list_tables` que
`quote_item_winners` existe e que `quote_batch_items` tem a coluna
`quantity`.

- [ ] **Step 3: Gerar os tipos TypeScript atualizados**

Usar a ferramenta MCP do Supabase (`generate_typescript_types`) e
sobrescrever `src/integrations/supabase/types.ts` com o resultado — mesmo
processo já usado nas migrações anteriores do projeto.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811140000_quote_batch_comparison.sql src/integrations/supabase/types.ts
git commit -m "feat(db): quantidade por item, status concluido e tabela quote_item_winners"
```

---

### Task 2: Capturar quantidade ao criar o lote

**Files:**
- Modify: `src/hooks/useQuoteBatches.ts`
- Modify: `src/components/quotes/CotacoesManager.tsx`

**Interfaces:**
- Consumes: `quote_batch_items.quantity` (Task 1).
- Produces: `createBatch` agora recebe `items: { missingProductId: string; quantity: number }[]` em vez de `missingProductIds: string[]` — assinatura nova que a Task 3 (lista de itens no detalhe do lote) e a Task 4 (comparação) vão consumir via `quote_batch_items.quantity`.

- [ ] **Step 1: Atualizar `createBatch` em `useQuoteBatches.ts`**

Trocar a assinatura e o corpo de `createBatch` (linhas 104-177 do arquivo
atual):

```ts
export interface QuoteBatchItemInput {
  missingProductId: string;
  quantity: number;
}

// ... dentro de useQuoteBatches:

const createBatch = async (items: QuoteBatchItemInput[], supplierIds: string[]): Promise<string | null> => {
  if (!user) throw new Error('Usuário não autenticado');
  if (!displayName) {
    throw new Error('Não foi possível identificar seu nome de exibição. Recarregue a página e tente novamente.');
  }
  if (items.length === 0 || supplierIds.length === 0) {
    throw new Error('Escolha pelo menos 1 item e 1 fornecedor.');
  }

  try {
    const missingProductIds = items.map((item) => item.missingProductId);
    const { data: stillOpenItems, error: openItemsError } = await supabase
      .from('quote_batch_items')
      .select('missing_product_id, quote_batches!inner(status)')
      .eq('quote_batches.status', 'aberto')
      .in('missing_product_id', missingProductIds);
    if (openItemsError) throw openItemsError;
    if (stillOpenItems && stillOpenItems.length > 0) {
      throw new QuoteItemsAlreadyOpenError(
        'Um ou mais itens escolhidos já entraram em outro lote aberto nesse meio-tempo. Atualize a lista e tente de novo.'
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from('quote_batches')
      .insert([{ created_by: user.id, created_by_name: displayName }])
      .select('id')
      .single();
    if (batchError) throw batchError;

    const batchId = batch.id as string;

    const { data: itemRows, error: itemsError } = await supabase
      .from('quote_batch_items')
      .insert(
        items.map((item) => ({
          quote_batch_id: batchId,
          missing_product_id: item.missingProductId,
          quantity: item.quantity,
        }))
      )
      .select('id');
    if (itemsError) throw itemsError;

    const { data: supplierRows, error: suppliersError } = await supabase
      .from('quote_batch_suppliers')
      .insert(supplierIds.map((supplierId) => ({ quote_batch_id: batchId, supplier_id: supplierId })))
      .select('id');
    if (suppliersError) throw suppliersError;

    const lineItems = (supplierRows || []).flatMap((supplierRow) =>
      (itemRows || []).map((itemRow) => ({
        quote_batch_supplier_id: supplierRow.id as string,
        quote_batch_item_id: itemRow.id as string,
      }))
    );
    const { error: lineItemsError } = await supabase.from('quote_line_items').insert(lineItems);
    if (lineItemsError) throw lineItemsError;

    toast({
      title: 'Cotação criada',
      description: `Lote criado com ${itemRows?.length ?? 0} item(ns) e ${supplierRows?.length ?? 0} fornecedor(es).`,
    });
    await refetch();
    return batchId;
  } catch (error) {
    console.error('Error creating quote batch:', error);
    toast({
      title: 'Erro ao criar cotação',
      description:
        error instanceof QuoteItemsAlreadyOpenError ? error.message : 'Não foi possível criar o lote. Tente novamente.',
      variant: 'destructive',
    });
    throw error;
  }
};
```

Também trocar `QuoteBatchSummary['status']` de `'aberto' | 'cancelado'` pra
`'aberto' | 'cancelado' | 'concluido'` (linha 9 do arquivo atual) — a Task 3
usa esse tipo pra separar os lotes concluídos na lista.

- [ ] **Step 2: Atualizar `CreateQuoteBatchDialog` em `CotacoesManager.tsx` pra capturar quantidade**

Adicionar `Input` aos imports (linha 4, junto de `Checkbox`):

```ts
import { Input } from '@/components/ui/input';
```

Trocar `selectedItemIds: Set<string>` por `selectedItems: Map<string, number>`
(linha 36) e os handlers correspondentes:

```ts
const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
const [isSubmitting, setIsSubmitting] = useState(false);

const productById = new Map(products.map((p) => [p.id, p]));

const toggleItem = (id: string) => {
  setSelectedItems((prev) => {
    const next = new Map(prev);
    if (next.has(id)) next.delete(id);
    else next.set(id, 1);
    return next;
  });
};

const setItemQuantity = (id: string, quantity: number) => {
  setSelectedItems((prev) => {
    if (!prev.has(id)) return prev;
    const next = new Map(prev);
    next.set(id, quantity);
    return next;
  });
};
```

Trocar `handleCreate` (chamando o novo formato de `createBatch`):

```ts
const handleCreate = async () => {
  setIsSubmitting(true);
  try {
    const items = Array.from(selectedItems.entries()).map(([missingProductId, quantity]) => ({
      missingProductId,
      quantity,
    }));
    const batchId = await createBatch(items, Array.from(selectedSupplierIds));
    if (batchId) {
      setSelectedItems(new Map());
      setSelectedSupplierIds(new Set());
      onOpenChange(false);
      onCreated(batchId);
    }
  } catch {
    // erro já mostrado via toast dentro do hook
  } finally {
    setIsSubmitting(false);
  }
};
```

Trocar o `label` de cada item (dentro do `.map` dos itens faltantes, por
volta da linha 103-117) pra incluir o campo de quantidade e usar
`selectedItems` em vez de `selectedItemIds`:

```tsx
{missingProducts.map((item) => {
  const product = productById.get(item.product_id);
  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
  const alreadyInQuote = openItemIds.has(item.id);
  const isSelected = selectedItems.has(item.id);
  return (
    <label
      key={item.id}
      className={`flex items-center gap-2 p-1.5 rounded ${alreadyInQuote ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
    >
      <Checkbox checked={isSelected} disabled={alreadyInQuote} onCheckedChange={() => toggleItem(item.id)} />
      <span className="text-sm flex-1">{displayName}</span>
      {isSelected && (
        <Input
          type="number"
          min="1"
          step="1"
          className="w-16 h-7 text-xs"
          value={selectedItems.get(item.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setItemQuantity(item.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
      )}
      {alreadyInQuote && <Badge variant="secondary" className="text-xs">já em cotação</Badge>}
    </label>
  );
})}
```

Trocar a condição do botão "Criar cotação" (linha ~143):

```tsx
disabled={isSubmitting || selectedItems.size === 0 || selectedSupplierIds.size === 0}
```

- [ ] **Step 3: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Teste manual**

Abrir "Nova cotação", marcar 2 itens, mudar a quantidade de um deles pra 5,
escolher 1 fornecedor, criar — confirmar no lote criado (ou via SQL,
`select quantity from quote_batch_items where quote_batch_id = '<id>'`) que
as quantidades batem.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useQuoteBatches.ts src/components/quotes/CotacoesManager.tsx
git commit -m "feat(cotacoes): captura quantidade por item ao criar o lote"
```

---

### Task 3: Status `concluido` na lista e no detalhe do lote

**Files:**
- Modify: `src/hooks/useQuoteBatchDetail.ts`
- Modify: `src/components/quotes/QuoteBatchDetail.tsx`
- Modify: `src/components/quotes/CotacoesManager.tsx`

**Interfaces:**
- Consumes: `quote_batches.status` aceitando `'concluido'` (Task 1); `QuoteBatchSummary['status']` já atualizado (Task 2).
- Produces: botão "Comparação" em `QuoteBatchDetail` que chama uma prop
  `onCompare: () => void` (recebida de `CotacoesManager`) — a Task 5 conecta
  essa prop à tela nova de comparação.

- [ ] **Step 1: Atualizar `QuoteBatchDetail` (tipo) em `useQuoteBatchDetail.ts`**

Trocar a interface (linhas 5-28 do arquivo atual) pra incluir `quantity` no
item e `'concluido'` no status:

```ts
export interface QuoteBatchDetailItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  quantity: number;
}

export interface QuoteBatchDetailSupplier {
  id: string;
  supplier_id: string;
  company_name: string;
  contact_name: string;
  status: 'pendente' | 'revisado';
  filled_count: number;
}

export interface QuoteBatchDetail {
  id: string;
  status: 'aberto' | 'cancelado' | 'concluido';
  created_by_name: string;
  created_at: string;
}
```

Atualizar a query de `fetchDetail` que busca `quote_batch_items` (linha
47-50 do arquivo atual) pra incluir `quantity` direto na seleção, e o
`.map` que monta `items` (linha 64-73) pra incluir o campo:

```ts
const { data: itemRows, error: itemsError } = await supabase
  .from('quote_batch_items')
  .select('id, missing_product_id, quantity, missing_products(product_id, fragrance_id, variation_id, stock_remaining)')
  .eq('quote_batch_id', batchId);
if (itemsError) throw itemsError;

const typedItemRows = (itemRows || []) as unknown as Array<{
  id: string;
  missing_product_id: string;
  quantity: number;
  missing_products: {
    product_id: string;
    fragrance_id: string | null;
    variation_id: string | null;
    stock_remaining: number | null;
  } | null;
}>;

setItems(
  typedItemRows.map((row) => ({
    id: row.id,
    missing_product_id: row.missing_product_id,
    product_id: row.missing_products?.product_id ?? '',
    fragrance_id: row.missing_products?.fragrance_id ?? null,
    variation_id: row.missing_products?.variation_id ?? null,
    stock_remaining: row.missing_products?.stock_remaining ?? null,
    quantity: row.quantity,
  }))
);
```

- [ ] **Step 2: Atualizar `QuoteBatchDetail.tsx` — badge, quantidade na lista, botão de comparação**

Adicionar `ArrowRightLeft` (ou outro ícone de comparação) e `onCompare` à
interface de props:

```ts
import { ArrowLeft, ArrowRightLeft, Plus, X } from 'lucide-react';
```

```ts
interface QuoteBatchDetailProps {
  batchId: string;
  products: ProductWithVariations[];
  onBack: () => void;
  onCompare: (batchId: string) => void;
}

const QuoteBatchDetail = ({ batchId, products, onBack, onCompare }: QuoteBatchDetailProps) => {
```

No cabeçalho (linha 143-171 do arquivo atual), adicionar o botão de
comparação ao lado do botão "Cancelar lote" — visível pra `'aberto'` e
`'concluido'` (não pra `'cancelado'`):

```tsx
<div className="flex items-center justify-between gap-2">
  <Button variant="ghost" size="sm" onClick={onBack}>
    <ArrowLeft className="h-4 w-4 mr-2" />
    Voltar
  </Button>
  <div className="flex items-center gap-2">
    {batch.status !== 'cancelado' && (
      <Button variant="secondary" size="sm" onClick={() => onCompare(batchId)}>
        <ArrowRightLeft className="h-4 w-4 mr-2" />
        {batch.status === 'concluido' ? 'Ver comparação' : 'Comparar e gerar pedido'}
      </Button>
    )}
    {batch.status === 'aberto' && (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isCancelling}>
            <X className="h-4 w-4 mr-2" />
            Cancelar lote
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens voltam a ficar disponíveis pra entrar em um lote novo. O histórico deste lote continua
              salvo, só não aparece mais como aberto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancelar lote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
  </div>
</div>
```

Atualizar o título pra mostrar o badge certo (linha 173-176 do arquivo
atual):

```tsx
<h2 className="text-2xl font-heading text-white">
  Lote de {batch.created_by_name}
  {batch.status === 'cancelado' && <Badge variant="outline" className="ml-2">Cancelado</Badge>}
  {batch.status === 'concluido' && <Badge className="ml-2">Concluído</Badge>}
</h2>
```

Mostrar a quantidade na lista de itens (linha 193-201 do arquivo atual):

```tsx
{items.map((item) => {
  const product = productById.get(item.product_id);
  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
  return (
    <p key={item.id} className="text-sm text-muted-foreground">
      {item.quantity}x {displayName}
    </p>
  );
})}
```

Esconder "Adicionar fornecedor" quando o lote não está mais `'aberto'` — já
é `batch.status === 'aberto'` na condição existente (linha 207), nenhuma
mudança necessária ali.

- [ ] **Step 3: Ligar `onCompare` em `CotacoesManager.tsx`**

Adicionar um segundo estado de navegação (comparação), ao lado de
`selectedBatchId`:

```ts
const [compareBatchId, setCompareBatchId] = useState<string | null>(null);
```

Antes do `if (selectedBatchId)` existente, adicionar (import de
`QuoteBatchComparison` fica pra Task 5 — por enquanto deixar comentado ou
usar um placeholder inline, já que a Task 5 substitui isto):

```tsx
if (selectedBatchId) {
  return (
    <QuoteBatchDetail
      batchId={selectedBatchId}
      products={products}
      onBack={() => {
        setSelectedBatchId(null);
        refetch();
      }}
      onCompare={(batchId) => setCompareBatchId(batchId)}
    />
  );
}
```

(A Task 5 adiciona o bloco `if (compareBatchId)` que renderiza
`QuoteBatchComparison` — deixe `compareBatchId` declarado mas sem uso ainda
gera warning de "unused variable" no ESLint; pra evitar isso nesta task,
adicione temporariamente `void compareBatchId;` logo após a declaração, e
remova essa linha na Task 5 quando o bloco de renderização for adicionado.)

Atualizar a separação de lotes por status (linha 175-176 do arquivo atual)
pra três grupos:

```ts
const openBatches = batches.filter((b) => b.status === 'aberto');
const completedBatches = batches.filter((b) => b.status === 'concluido');
const cancelledBatches = batches.filter((b) => b.status === 'cancelado');
```

Atualizar `renderBatchCard` (linha 187-204 do arquivo atual) pra mostrar o
badge certo:

```tsx
const renderBatchCard = (batch: (typeof batches)[number]) => (
  <button
    key={batch.id}
    onClick={() => setSelectedBatchId(batch.id)}
    className="w-full text-left border rounded-lg p-4 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors"
  >
    <div>
      <p className="font-medium">
        {batch.item_count} item(ns) · {batch.supplier_count} fornecedor(es)
      </p>
      <p className="text-sm text-muted-foreground">
        Criado por {batch.created_by_name} em {formatDate(batch.created_at)} ·{' '}
        {batch.suppliers_reviewed_count} de {batch.supplier_count} revisado(s)
      </p>
    </div>
    {batch.status === 'cancelado' && <Badge variant="outline">Cancelado</Badge>}
    {batch.status === 'concluido' && <Badge>Concluído</Badge>}
  </button>
);
```

Adicionar a seção de concluídos no JSX (depois da seção de cancelados,
linha 224-229 do arquivo atual):

```tsx
{completedBatches.length > 0 && (
  <div className="space-y-3">
    <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
    {completedBatches.map(renderBatchCard)}
  </div>
)}
```

- [ ] **Step 4: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros (pode haver warning de variável não usada pro
`compareBatchId` — aceitável nesta task, resolvido na Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useQuoteBatchDetail.ts src/components/quotes/QuoteBatchDetail.tsx src/components/quotes/CotacoesManager.tsx
git commit -m "feat(cotacoes): suporte ao status concluido na lista e no detalhe do lote"
```

---

### Task 4: Hook `useQuoteBatchComparison` — estado da comparação e vencedor manual

**Files:**
- Create: `src/hooks/useQuoteBatchComparison.ts`

**Interfaces:**
- Consumes: tabela `quote_item_winners` (Task 1); `quote_batch_items.quantity` (Task 1).
- Produces: hook `useQuoteBatchComparison(batchId: string)` retornando
  `{ loading, batchStatus, items: ComparisonItem[], suppliers: ComparisonSupplier[], getPrice: (itemId: string, supplierId: string) => number | null, winners: Map<string, string>, setWinner: (itemId: string, supplierId: string) => Promise<void>, refetch: () => Promise<void> }`
  — consumido pela Task 5 (tela) e estendido pelas Tasks 6 e 8 (`applyCommand`,
  `finalizeBatch`).

- [ ] **Step 1: Criar o hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';

export interface ComparisonItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  quantity: number;
}

export interface ComparisonSupplier {
  id: string;
  company_name: string;
  phone: string;
}

type WinnerSource = 'auto' | 'manual' | 'ia';

export const useQuoteBatchComparison = (batchId: string) => {
  const { user } = useAuth();
  const { displayName } = useCurrentStaffName();
  const [loading, setLoading] = useState(true);
  const [batchStatus, setBatchStatus] = useState<'aberto' | 'cancelado' | 'concluido' | null>(null);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [suppliers, setSuppliers] = useState<ComparisonSupplier[]>([]);
  const [priceByKey, setPriceByKey] = useState<Record<string, number | null>>({});
  const [winners, setWinners] = useState<Map<string, string>>(new Map());

  const priceKey = (itemId: string, supplierId: string) => `${itemId}::${supplierId}`;
  const getPrice = useCallback(
    (itemId: string, supplierId: string): number | null => priceByKey[priceKey(itemId, supplierId)] ?? null,
    [priceByKey]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: batchRow, error: batchError } = await supabase
        .from('quote_batches')
        .select('status')
        .eq('id', batchId)
        .single();
      if (batchError) throw batchError;
      setBatchStatus(batchRow.status as 'aberto' | 'cancelado' | 'concluido');

      const { data: itemRows, error: itemsError } = await supabase
        .from('quote_batch_items')
        .select('id, missing_product_id, quantity, missing_products(product_id, fragrance_id, variation_id)')
        .eq('quote_batch_id', batchId);
      if (itemsError) throw itemsError;

      const typedItemRows = (itemRows || []) as unknown as Array<{
        id: string;
        missing_product_id: string;
        quantity: number;
        missing_products: { product_id: string; fragrance_id: string | null; variation_id: string | null } | null;
      }>;
      const nextItems: ComparisonItem[] = typedItemRows.map((row) => ({
        id: row.id,
        missing_product_id: row.missing_product_id,
        product_id: row.missing_products?.product_id ?? '',
        fragrance_id: row.missing_products?.fragrance_id ?? null,
        variation_id: row.missing_products?.variation_id ?? null,
        quantity: row.quantity,
      }));
      setItems(nextItems);

      const { data: supplierRows, error: suppliersError } = await supabase
        .from('quote_batch_suppliers')
        .select('id, suppliers(company_name, phone), quote_line_items(quote_batch_item_id, price)')
        .eq('quote_batch_id', batchId);
      if (suppliersError) throw suppliersError;

      const typedSupplierRows = (supplierRows || []) as unknown as Array<{
        id: string;
        suppliers: { company_name: string; phone: string } | null;
        quote_line_items: { quote_batch_item_id: string; price: number | null }[];
      }>;

      const nextSuppliers: ComparisonSupplier[] = typedSupplierRows.map((row) => ({
        id: row.id,
        company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
        phone: row.suppliers?.phone ?? '',
      }));
      setSuppliers(nextSuppliers);

      const nextPriceByKey: Record<string, number | null> = {};
      for (const supplierRow of typedSupplierRows) {
        for (const lineItem of supplierRow.quote_line_items) {
          nextPriceByKey[priceKey(lineItem.quote_batch_item_id, supplierRow.id)] = lineItem.price;
        }
      }
      setPriceByKey(nextPriceByKey);

      const { data: winnerRows, error: winnersError } = await supabase
        .from('quote_item_winners')
        .select('quote_batch_item_id, quote_batch_supplier_id')
        .in(
          'quote_batch_item_id',
          nextItems.map((item) => item.id)
        );
      if (winnersError) throw winnersError;

      const nextWinners = new Map<string, string>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.quote_batch_supplier_id as string])
      );

      // Inicialização automática: todo item sem vencedor ainda ganha o
      // fornecedor de menor preço não nulo. Item sem nenhum preço cotado
      // fica sem vencedor (nada pra escolher). Só roda quando o lote ainda
      // está aberto — lote concluído/cancelado não ganha vencedor novo.
      if (batchRow.status === 'aberto' && user && displayName) {
        const toInsert: Array<{
          quote_batch_item_id: string;
          quote_batch_supplier_id: string;
          source: WinnerSource;
          set_by: string;
          set_by_name: string;
        }> = [];
        for (const item of nextItems) {
          if (nextWinners.has(item.id)) continue;
          let cheapestSupplierId: string | null = null;
          let cheapestPrice = Infinity;
          for (const supplier of nextSuppliers) {
            const price = nextPriceByKey[priceKey(item.id, supplier.id)];
            if (price !== null && price !== undefined && price < cheapestPrice) {
              cheapestPrice = price;
              cheapestSupplierId = supplier.id;
            }
          }
          if (cheapestSupplierId) {
            toInsert.push({
              quote_batch_item_id: item.id,
              quote_batch_supplier_id: cheapestSupplierId,
              source: 'auto',
              set_by: user.id,
              set_by_name: displayName,
            });
            nextWinners.set(item.id, cheapestSupplierId);
          }
        }
        if (toInsert.length > 0) {
          const { error: insertWinnersError } = await supabase.from('quote_item_winners').insert(toInsert);
          if (insertWinnersError) {
            console.error('Error auto-assigning quote winners:', insertWinnersError);
          }
        }
      }

      setWinners(nextWinners);
    } catch (error) {
      console.error('Error fetching quote batch comparison:', error);
      toast({
        title: 'Erro ao carregar comparação',
        description: 'Não foi possível carregar os preços deste lote.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [batchId, user, displayName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setWinner = async (itemId: string, supplierId: string) => {
    if (!user || !displayName) return;
    try {
      const { error } = await supabase
        .from('quote_item_winners')
        .upsert(
          [
            {
              quote_batch_item_id: itemId,
              quote_batch_supplier_id: supplierId,
              source: 'manual' as WinnerSource,
              set_by: user.id,
              set_by_name: displayName,
              set_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'quote_batch_item_id' }
        );
      if (error) throw error;
      setWinners((prev) => {
        const next = new Map(prev);
        next.set(itemId, supplierId);
        return next;
      });
    } catch (error) {
      console.error('Error setting quote item winner:', error);
      toast({
        title: 'Erro ao trocar vencedor',
        description: 'Não foi possível salvar essa escolha.',
        variant: 'destructive',
      });
    }
  };

  return { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, refetch: fetchData };
};
```

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuoteBatchComparison.ts
git commit -m "feat(cotacoes): hook de comparação com vencedor automático e manual"
```

---

### Task 5: Tela de Comparação

**Files:**
- Create: `src/components/quotes/QuoteBatchComparison.tsx`
- Modify: `src/components/quotes/CotacoesManager.tsx`

**Interfaces:**
- Consumes: `useQuoteBatchComparison` (Task 4); `buildMissingItemDisplayName` (`src/lib/missingProductDisplay.ts`).
- Produces: componente `QuoteBatchComparison({ batchId, products, onBack })`
  — a Task 6 adiciona a caixa de chat dentro deste arquivo, a Task 8
  adiciona a seção de geração de pedido.

- [ ] **Step 1: Criar `QuoteBatchComparison.tsx`**

```tsx
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuoteBatchComparison } from '@/hooks/useQuoteBatchComparison';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

interface QuoteBatchComparisonProps {
  batchId: string;
  products: ProductWithVariations[];
  onBack: () => void;
}

const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

const QuoteBatchComparison = ({ batchId, products, onBack }: QuoteBatchComparisonProps) => {
  const { loading, batchStatus, items, suppliers, getPrice, winners, setWinner } = useQuoteBatchComparison(batchId);
  const productById = new Map(products.map((p) => [p.id, p]));
  const isReadOnly = batchStatus !== 'aberto';

  const subtotalBySupplier = new Map<string, number>();
  for (const item of items) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    subtotalBySupplier.set(winnerId, (subtotalBySupplier.get(winnerId) ?? 0) + price * item.quantity);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AdminLoadingState rows={4} tone="light" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-heading text-white">Comparação de preços</h2>
          <p className="text-sm text-blue-300/60 mt-1">
            {items.length} item(ns) · {suppliers.length} fornecedor(es)
            {isReadOnly && ' · somente leitura'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                {suppliers.map((supplier) => (
                  <TableHead key={supplier.id} className="min-w-32">
                    {supplier.company_name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const product = productById.get(item.product_id);
                const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                const winnerId = winners.get(item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.quantity}x {displayName}
                    </TableCell>
                    {suppliers.map((supplier) => {
                      const price = getPrice(item.id, supplier.id);
                      const isWinner = winnerId === supplier.id;
                      return (
                        <TableCell key={supplier.id}>
                          {price === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => setWinner(item.id, supplier.id)}
                              className={`text-sm px-2 py-1 rounded ${
                                isWinner ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/50'
                              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {formatPrice(price)}
                              {isWinner && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  Vencedor
                                </Badge>
                              )}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Subtotal por fornecedor</p>
          {suppliers.map((supplier) => (
            <p key={supplier.id} className="text-sm text-muted-foreground">
              {supplier.company_name}: {formatPrice(subtotalBySupplier.get(supplier.id) ?? 0)}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteBatchComparison;
```

- [ ] **Step 2: Ligar a tela em `CotacoesManager.tsx`**

Importar o componente novo:

```ts
import QuoteBatchComparison from './QuoteBatchComparison';
```

Substituir a linha `void compareBatchId;` (adicionada na Task 3) pelo bloco
de renderização, logo antes do `if (selectedBatchId)`:

```tsx
if (compareBatchId) {
  return (
    <QuoteBatchComparison
      batchId={compareBatchId}
      products={products}
      onBack={() => {
        setCompareBatchId(null);
        refetch();
      }}
    />
  );
}
```

- [ ] **Step 3: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Teste manual**

Abrir um lote com preços já extraídos (ou preenchidos na mão) de 2+
fornecedores, clicar em "Comparar e gerar pedido" — confirmar que o
vencedor automático é sempre o de menor preço, que clicar noutra célula
troca o vencedor, e que os subtotais batem.

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/QuoteBatchComparison.tsx src/components/quotes/CotacoesManager.tsx
git commit -m "feat(cotacoes): tela de comparação de preços com vencedor automático e manual"
```

---

### Task 6: Reatribuição por comando de IA

**Files:**
- Create: `supabase/functions/apply-quote-reassignment/index.ts`
- Modify: `src/hooks/useQuoteBatchComparison.ts`
- Modify: `src/components/quotes/QuoteBatchComparison.tsx`

**Interfaces:**
- Consumes: mesmo padrão de auth/permissão de `extract-quote-prices`; tabela `quote_item_winners` (Task 1).
- Produces: `apply-quote-reassignment` recebe `{ quoteBatchId: string, command: string }`, devolve `{ applied: number, skipped: number }`; hook ganha `applyCommand: (command: string) => Promise<{ applied: number; skipped: number }>`.

- [ ] **Step 1: Criar a Edge Function**

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

interface ReassignSuggestion {
  item: string;
  supplier: string;
}

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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY não configurada.");
      return jsonResponse(req, { error: "IA não configurada no servidor. Avise um administrador." }, 500);
    }

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
      .select("is_admin, display_name")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerStaff) {
      return jsonResponse(req, { error: "Não autorizado" }, 403);
    }

    if (!callerStaff.is_admin) {
      const { data: perms } = await adminClient
        .from("staff_permissions")
        .select("permission")
        .eq("user_id", caller.id);
      const permissionSet = new Set((perms || []).map((p) => p.permission));
      if (!permissionSet.has("faltantes") || !permissionSet.has("fornecedores")) {
        return jsonResponse(req, { error: "Você não tem permissão para cotações." }, 403);
      }
    }

    const body = await req.json().catch(() => null);
    const quoteBatchId = typeof body?.quoteBatchId === "string" ? body.quoteBatchId : "";
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!quoteBatchId || !command) {
      return jsonResponse(req, { error: "quoteBatchId e command são obrigatórios." }, 400);
    }

    const { data: batch, error: batchError } = await adminClient
      .from("quote_batches")
      .select("id, status")
      .eq("id", quoteBatchId)
      .maybeSingle();
    if (batchError || !batch) {
      return jsonResponse(req, { error: "Lote de cotação não encontrado." }, 404);
    }
    if (batch.status !== "aberto") {
      return jsonResponse(req, { error: "Este lote não está mais aberto." }, 400);
    }

    const { data: itemRows, error: itemsError } = await adminClient
      .from("quote_batch_items")
      .select(
        "id, quantity, missing_products(product_id, fragrance_id, variation_id, products(name), product_fragrances(name), product_variations(literage))"
      )
      .eq("quote_batch_id", quoteBatchId);
    if (itemsError) throw itemsError;

    type ItemRow = {
      id: string;
      quantity: number;
      missing_products: {
        products: { name: string } | null;
        product_fragrances: { name: string } | null;
        product_variations: { literage: string } | null;
      } | null;
    };
    const resolvedItems = ((itemRows || []) as unknown as ItemRow[]).map((row) => {
      const productName = row.missing_products?.products?.name ?? "Produto removido";
      const fragranceName = row.missing_products?.product_fragrances?.name;
      const literage = row.missing_products?.product_variations?.literage;
      const parts = [fragranceName, literage].filter((part): part is string => Boolean(part));
      const name = parts.length > 0 ? `${productName} — ${parts.join(" — ")}` : productName;
      return { id: row.id, name, quantity: row.quantity };
    });

    const { data: supplierRows, error: suppliersError } = await adminClient
      .from("quote_batch_suppliers")
      .select("id, suppliers(company_name), quote_line_items(quote_batch_item_id, price)")
      .eq("quote_batch_id", quoteBatchId);
    if (suppliersError) throw suppliersError;

    type SupplierRow = {
      id: string;
      suppliers: { company_name: string } | null;
      quote_line_items: { quote_batch_item_id: string; price: number | null }[];
    };
    const typedSuppliers = (supplierRows || []) as unknown as SupplierRow[];
    const resolvedSuppliers = typedSuppliers.map((row) => ({
      id: row.id,
      name: row.suppliers?.company_name ?? "Fornecedor removido",
    }));

    const priceByKey = new Map<string, number>();
    for (const supplierRow of typedSuppliers) {
      for (const lineItem of supplierRow.quote_line_items) {
        if (lineItem.price !== null) {
          priceByKey.set(`${lineItem.quote_batch_item_id}::${supplierRow.id}`, lineItem.price);
        }
      }
    }

    const { data: winnerRows, error: winnersError } = await adminClient
      .from("quote_item_winners")
      .select("quote_batch_item_id, quote_batch_supplier_id")
      .in(
        "quote_batch_item_id",
        resolvedItems.map((item) => item.id)
      );
    if (winnersError) throw winnersError;
    const winnerBySupplierId = new Map<string, string>();
    for (const row of winnerRows || []) {
      winnerBySupplierId.set(row.quote_batch_item_id as string, row.quote_batch_supplier_id as string);
    }
    const supplierNameById = new Map(resolvedSuppliers.map((s) => [s.id, s.name]));

    const itemsBlock = resolvedItems
      .map((item) => {
        const offers = resolvedSuppliers
          .map((supplier) => {
            const price = priceByKey.get(`${item.id}::${supplier.id}`);
            if (price === undefined) return null;
            const isWinner = winnerBySupplierId.get(item.id) === supplier.id;
            return `  - ${supplier.name}: R$ ${price.toFixed(2)}${isWinner ? " (vencedor atual)" : ""}`;
          })
          .filter((line): line is string => line !== null);
        return `${item.name} (quantidade: ${item.quantity}):\n${offers.join("\n") || "  (nenhum fornecedor cotou)"}`;
      })
      .join("\n\n");

    const promptText =
      `Você ajuda a decidir qual fornecedor vence cada item de um lote de cotação de uma loja de produtos de limpeza. ` +
      `Fornecedores deste lote: ${resolvedSuppliers.map((s) => s.name).join(", ")}.\n\n` +
      `Itens, preços cotados por fornecedor e vencedor atual:\n\n${itemsBlock}\n\n` +
      `Comando da pessoa: "${command}"\n\n` +
      `Interprete o comando e devolva as reatribuições de vencedor necessárias. Se o comando pedir pra tirar um ` +
      `fornecedor de tudo que ele venceu, reatribua cada item dele pro fornecedor de menor preço seguinte entre os ` +
      `que cotaram aquele item (nunca o fornecedor removido). Só reatribua entre os fornecedores listados acima — ` +
      `nunca invente fornecedor novo. Se não for possível cumprir uma parte do comando (não há outro fornecedor pra ` +
      `um item, por exemplo), simplesmente não inclua esse item no resultado. Responda APENAS com um array JSON, sem ` +
      `texto antes ou depois, no formato: [{"item": "<nome exatamente como listado acima>", "supplier": "<nome ` +
      `exatamente como listado acima>"}]. Se nenhuma reatribuição fizer sentido, responda [].`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
      }
    );

    if (geminiResponse.status === 429) {
      const errorText = await geminiResponse.text();
      console.error("Cota da API do Gemini excedida:", errorText);
      return jsonResponse(req, { error: "A cota gratuita da IA acabou por hoje. Tente de novo mais tarde." }, 429);
    }
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Erro na API do Gemini:", geminiResponse.status, errorText);
      return jsonResponse(req, { error: "A IA não conseguiu processar o comando. Tente novamente." }, 502);
    }

    const geminiBody = await geminiResponse.json();
    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      console.error("Resposta da IA truncada por MAX_TOKENS:", geminiBody);
      return jsonResponse(req, { error: "A resposta da IA ficou grande demais e foi cortada." }, 502);
    }
    const textPart = (candidate?.content?.parts || []).find(
      (part: { text?: string; thought?: boolean }) => typeof part.text === "string" && part.thought !== true
    );
    if (!textPart?.text) {
      console.error("Nenhuma part de texto utilizável na resposta da IA:", geminiBody);
      return jsonResponse(req, { error: "A IA não retornou um resultado legível." }, 502);
    }

    let suggestions: ReassignSuggestion[];
    try {
      const jsonMatch = textPart.text.match(/\[[\s\S]*\]/);
      suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : textPart.text);
    } catch (parseError) {
      console.error("Falha ao interpretar resposta da IA:", parseError, textPart.text);
      return jsonResponse(req, { error: "A IA retornou um formato inesperado. Tente novamente." }, 502);
    }

    const itemIdByName = new Map(resolvedItems.map((item) => [item.name, item.id]));
    const supplierIdByName = new Map(resolvedSuppliers.map((s) => [s.name, s.id]));

    let applied = 0;
    let skipped = 0;
    const toUpsert: Array<{
      quote_batch_item_id: string;
      quote_batch_supplier_id: string;
      source: "ia";
      set_by: string;
      set_by_name: string;
    }> = [];

    for (const suggestion of suggestions) {
      const itemId = itemIdByName.get(suggestion.item);
      const supplierId = supplierIdByName.get(suggestion.supplier);
      const price = itemId && supplierId ? priceByKey.get(`${itemId}::${supplierId}`) : undefined;
      if (!itemId || !supplierId || price === undefined) {
        skipped += 1;
        continue;
      }
      toUpsert.push({
        quote_batch_item_id: itemId,
        quote_batch_supplier_id: supplierId,
        source: "ia",
        set_by: caller.id,
        set_by_name: callerStaff.display_name,
      });
      applied += 1;
    }

    if (toUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from("quote_item_winners")
        .upsert(toUpsert, { onConflict: "quote_batch_item_id" });
      if (upsertError) throw upsertError;
    }

    return jsonResponse(req, { applied, skipped }, 200);
  } catch (error) {
    console.error("Erro inesperado em apply-quote-reassignment:", error);
    return jsonResponse(req, { error: "Erro inesperado ao aplicar o comando." }, 500);
  }
});
```

- [ ] **Step 2: Deployar a Edge Function**

Usar a ferramenta MCP do Supabase (`deploy_edge_function`) com o nome
`apply-quote-reassignment` e o conteúdo acima. Confirmar status `ACTIVE`
via `list_edge_functions`.

- [ ] **Step 3: Adicionar `applyCommand` ao hook `useQuoteBatchComparison.ts`**

Adicionar o import no topo do arquivo:

```ts
import { extractFunctionErrorMessage } from '@/lib/functionErrors';
```

Adicionar a função dentro do hook, antes do `return`:

```ts
const applyCommand = async (command: string): Promise<{ applied: number; skipped: number }> => {
  try {
    const { data, error } = await supabase.functions.invoke('apply-quote-reassignment', {
      body: { quoteBatchId: batchId, command },
    });
    if (error) {
      const message = await extractFunctionErrorMessage(error, 'Não foi possível aplicar o comando.');
      toast({ title: 'Erro no comando', description: message, variant: 'destructive' });
      throw error;
    }
    await fetchData();
    return { applied: data.applied as number, skipped: data.skipped as number };
  } catch (error) {
    console.error('Error applying quote reassignment command:', error);
    throw error;
  }
};
```

Atualizar o `return` do hook pra incluir `applyCommand`:

```ts
return { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, applyCommand, refetch: fetchData };
```

- [ ] **Step 4: Adicionar a caixa de chat em `QuoteBatchComparison.tsx`**

Adicionar imports:

```ts
import { useState } from 'react';
import { Input } from '@/components/ui/input';
```

Dentro do componente, adicionar estado e handler (junto das outras
constantes do componente):

```ts
const { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, applyCommand } =
  useQuoteBatchComparison(batchId);
const [command, setCommand] = useState('');
const [isApplyingCommand, setIsApplyingCommand] = useState(false);
const [commandLog, setCommandLog] = useState<string[]>([]);

const handleApplyCommand = async () => {
  const trimmed = command.trim();
  if (!trimmed) return;
  setIsApplyingCommand(true);
  try {
    const { applied, skipped } = await applyCommand(trimmed);
    setCommandLog((prev) => [
      `"${trimmed}" — ${applied} reatribuído(s)${skipped > 0 ? `, ${skipped} ignorado(s)` : ''}.`,
      ...prev,
    ]);
    setCommand('');
  } catch {
    // erro já mostrado via toast dentro do hook
  } finally {
    setIsApplyingCommand(false);
  }
};
```

Adicionar o bloco de chat no JSX, depois do bloco "Subtotal por fornecedor"
e antes do fechamento de `</CardContent>`:

```tsx
{!isReadOnly && (
  <div className="space-y-2">
    <p className="text-sm font-medium">Pedir ajuste à IA</p>
    <div className="flex items-center gap-2">
      <Input
        placeholder='Ex: "tira o Fornecedor X, passa os itens dele pro próximo colocado"'
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleApplyCommand();
        }}
        disabled={isApplyingCommand}
      />
      <Button onClick={handleApplyCommand} disabled={isApplyingCommand || !command.trim()}>
        {isApplyingCommand ? 'Aplicando...' : 'Aplicar'}
      </Button>
    </div>
    {commandLog.length > 0 && (
      <div className="space-y-1">
        {commandLog.map((entry, index) => (
          <p key={index} className="text-xs text-muted-foreground">
            {entry}
          </p>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Teste manual**

Num lote aberto com 2+ fornecedores cotando o mesmo item, digitar um
comando tipo "tira o [nome do fornecedor vencedor de algum item], passa
pro próximo colocado" — confirmar que o vencedor muda pro segundo menor
preço. Testar também um comando com fornecedor/item inexistente no lote —
confirmar que é ignorado (log mostra "0 reatribuído(s), 1 ignorado(s)" ou
similar) sem quebrar a tela.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/apply-quote-reassignment/index.ts src/hooks/useQuoteBatchComparison.ts src/components/quotes/QuoteBatchComparison.tsx
git commit -m "feat(cotacoes): reatribuição de vencedor por comando de IA"
```

---

### Task 7: Helpers de pedido de compra (WhatsApp + PDF)

**Files:**
- Create: `src/lib/whatsapp.ts`
- Create: `src/lib/purchaseOrder.ts`
- Modify: `src/components/SupplierManager.tsx`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Produces: `buildWhatsAppLink(phone: string, message?: string): string`;
  `buildPurchaseOrderMessage(items: PurchaseOrderItem[]): string`;
  `downloadPurchaseOrderPdf(supplierName: string, items: PurchaseOrderItem[]): void`
  onde `PurchaseOrderItem = { name: string; quantity: number; unitPrice: number }`
  — consumidos pela Task 8.

- [ ] **Step 1: Instalar o jsPDF**

Run: `npm install jspdf`
Expected: `package.json` ganha `"jspdf"` em `dependencies`.

- [ ] **Step 2: Extrair `buildWhatsAppLink` pra um módulo compartilhado**

Criar `src/lib/whatsapp.ts`:

```ts
// wa.me exige o número com código do país; se quem digitou já colocou 55 na
// frente mantemos, senão prefixamos — sem isso o link abre "número inválido".
// Mensagem opcional vai como parâmetro ?text= (mesmo padrão já usado em
// CartContext.tsx, OrderHistory.tsx, Cart.tsx, Hero.tsx e Header.tsx).
export const buildWhatsAppLink = (phone: string, message?: string): string => {
  const digits = phone.replace(/\D/g, '');
  const hasCountryCode = digits.length === 12 || digits.length === 13;
  const withCountryCode = hasCountryCode ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountryCode}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
```

Em `src/components/SupplierManager.tsx`, remover a definição local de
`buildWhatsAppLink` (linhas 42-49 do arquivo atual) e importar do módulo
novo:

```ts
import { buildWhatsAppLink } from '@/lib/whatsapp';
```

- [ ] **Step 3: Criar `src/lib/purchaseOrder.ts`**

```ts
import jsPDF from 'jspdf';

export interface PurchaseOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

const itemTotal = (item: PurchaseOrderItem) => item.quantity * item.unitPrice;
const orderTotal = (items: PurchaseOrderItem[]) => items.reduce((sum, item) => sum + itemTotal(item), 0);

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export const buildPurchaseOrderMessage = (items: PurchaseOrderItem[]): string => {
  const lines = items.map(
    (item) => `• ${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice)} (${formatCurrency(itemTotal(item))})`
  );
  return `Olá! Gostaríamos de fazer o seguinte pedido:\n\n${lines.join('\n')}\n\nTotal: ${formatCurrency(orderTotal(items))}`;
};

export const downloadPurchaseOrderPdf = (supplierName: string, items: PurchaseOrderItem[]): void => {
  const doc = new jsPDF();
  const marginX = 15;
  let y = 20;

  doc.setFontSize(16);
  doc.text('Pedido de compra', marginX, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`Fornecedor: ${supplierName}`, marginX, y);
  y += 6;
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, marginX, y);
  y += 10;

  doc.setFontSize(10);
  doc.text('Item', marginX, y);
  doc.text('Qtd', 120, y);
  doc.text('Preço unit.', 140, y);
  doc.text('Subtotal', 175, y);
  y += 2;
  doc.line(marginX, y, 195, y);
  y += 6;

  for (const item of items) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(item.name, marginX, y, { maxWidth: 100 });
    doc.text(String(item.quantity), 120, y);
    doc.text(formatCurrency(item.unitPrice), 140, y);
    doc.text(formatCurrency(itemTotal(item)), 175, y);
    y += 8;
  }

  y += 4;
  doc.line(marginX, y, 195, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`Total: ${formatCurrency(orderTotal(items))}`, marginX, y);

  const safeName = supplierName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  doc.save(`pedido-${safeName}.pdf`);
};
```

- [ ] **Step 4: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/whatsapp.ts src/lib/purchaseOrder.ts src/components/SupplierManager.tsx
git commit -m "feat(cotacoes): helpers de mensagem WhatsApp e PDF pro pedido de compra"
```

---

### Task 8: Gerar pedidos de compra e fechar o lote

**Files:**
- Modify: `src/hooks/useQuoteBatchComparison.ts`
- Modify: `src/components/quotes/QuoteBatchComparison.tsx`

**Interfaces:**
- Consumes: `buildPurchaseOrderMessage`, `downloadPurchaseOrderPdf` (Task 7); `buildWhatsAppLink` (Task 7).
- Produces: hook ganha `finalizeBatch: () => Promise<boolean>`; tela mostra os cards de pedido por fornecedor quando o lote está `'concluido'`.

- [ ] **Step 1: Adicionar `finalizeBatch` ao hook**

Adicionar a função dentro de `useQuoteBatchComparison`, antes do `return`:

```ts
const finalizeBatch = async (): Promise<boolean> => {
  if (!user || !displayName) return false;
  if (items.length === 0 || items.some((item) => !winners.has(item.id))) {
    toast({
      title: 'Ainda falta escolher vencedor',
      description: 'Todo item precisa de um vencedor antes de gerar os pedidos.',
      variant: 'destructive',
    });
    return false;
  }
  try {
    const { error: batchUpdateError } = await supabase
      .from('quote_batches')
      .update({
        status: 'concluido',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        completed_by_name: displayName,
      })
      .eq('id', batchId);
    if (batchUpdateError) throw batchUpdateError;

    // `items` já tem missing_product_id carregado por fetchData — não
    // precisa buscar de novo no banco.
    const missingProductIds = items.map((item) => item.missing_product_id);
    if (missingProductIds.length > 0) {
      const { error: resolveError } = await supabase
        .from('missing_products')
        .update({ status: 'resolvido', resolved_by: user.id, resolved_at: new Date().toISOString() })
        .in('id', missingProductIds);
      if (resolveError) {
        // O lote já fechou — não desfaz. Loga pra investigar depois, mesmo
        // padrão de risco aceito já usado em createBatch (sequência de
        // updates sem transação multi-tabela).
        console.error('Error resolving missing products after batch completion:', resolveError);
      }
    }

    toast({ title: 'Pedidos de compra gerados', description: 'O lote foi concluído.' });
    await fetchData();
    return true;
  } catch (error) {
    console.error('Error finalizing quote batch:', error);
    toast({
      title: 'Erro ao gerar pedidos',
      description: 'Não foi possível concluir o lote.',
      variant: 'destructive',
    });
    return false;
  }
};
```

Atualizar o `return` do hook:

```ts
return {
  loading,
  batchStatus,
  items,
  suppliers,
  getPrice,
  winners,
  setWinner,
  applyCommand,
  finalizeBatch,
  refetch: fetchData,
};
```

- [ ] **Step 2: Adicionar a seção de geração de pedidos em `QuoteBatchComparison.tsx`**

Adicionar imports:

```ts
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MessageCircle, FileDown } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { buildPurchaseOrderMessage, downloadPurchaseOrderPdf, PurchaseOrderItem } from '@/lib/purchaseOrder';
```

Adicionar `finalizeBatch` à desestruturação do hook e o estado de
submissão:

```ts
const { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, applyCommand, finalizeBatch } =
  useQuoteBatchComparison(batchId);
const [isFinalizing, setIsFinalizing] = useState(false);
```

Adicionar, depois de `subtotalBySupplier`, o cálculo dos itens por
fornecedor vencedor (usado tanto pra habilitar o botão quanto pra montar
os pedidos):

```ts
const allItemsHaveWinner = items.length > 0 && items.every((item) => winners.has(item.id));

const orderItemsBySupplier = new Map<string, PurchaseOrderItem[]>();
for (const item of items) {
  const winnerId = winners.get(item.id);
  if (!winnerId) continue;
  const price = getPrice(item.id, winnerId);
  if (price === null) continue;
  const product = productById.get(item.product_id);
  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
  const list = orderItemsBySupplier.get(winnerId) ?? [];
  list.push({ name: displayName, quantity: item.quantity, unitPrice: price });
  orderItemsBySupplier.set(winnerId, list);
}

const handleFinalize = async () => {
  setIsFinalizing(true);
  try {
    await finalizeBatch();
  } finally {
    setIsFinalizing(false);
  }
};
```

Adicionar o bloco de ação/pedidos no JSX, como último filho de
`<CardContent>` (depois do bloco de chat):

```tsx
{batchStatus === 'aberto' && (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button disabled={!allItemsHaveWinner || isFinalizing} className="w-full">
        Gerar pedidos de compra
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Gerar pedidos de compra?</AlertDialogTitle>
        <AlertDialogDescription>
          Isso fecha este lote de cotação e marca os itens de Faltantes correspondentes como resolvidos. Não
          tem como desfazer.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Voltar</AlertDialogCancel>
        <AlertDialogAction onClick={handleFinalize}>Gerar pedidos</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}

{batchStatus === 'concluido' && orderItemsBySupplier.size > 0 && (
  <div className="space-y-3">
    <p className="text-sm font-medium">Pedidos de compra</p>
    {Array.from(orderItemsBySupplier.entries()).map(([supplierId, orderItems]) => {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      return (
        <div key={supplierId} className="border rounded-lg p-4 space-y-2">
          <p className="font-medium text-sm">{supplier?.company_name ?? 'Fornecedor'}</p>
          <p className="text-xs text-muted-foreground">
            {orderItems.length} item(ns) · Total: {formatPrice(total)}
          </p>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a
                href={buildWhatsAppLink(supplier?.phone ?? '', buildPurchaseOrderMessage(orderItems))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadPurchaseOrderPdf(supplier?.company_name ?? 'fornecedor', orderItems)}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Teste manual**

Num lote aberto com todo item já com vencedor, clicar "Gerar pedidos de
compra", confirmar — checar que:
- O lote aparece como "Concluído" na lista e no detalhe.
- Os itens de Faltantes desse lote somem da lista de pendentes.
- Aparece um card por fornecedor vencedor com botão WhatsApp (abre com a
  mensagem certa, itens/preços/total batendo) e "Baixar PDF" (PDF baixa com
  os mesmos dados).
- Reabrir o lote depois mostra a mesma tela em modo leitura, com os cards
  de pedido ainda visíveis.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useQuoteBatchComparison.ts src/components/quotes/QuoteBatchComparison.tsx
git commit -m "feat(cotacoes): gera pedidos de compra (WhatsApp + PDF) e fecha o lote"
```
