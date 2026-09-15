# Cotações — pedido por fornecedor, editar/excluir preço, quantidade (D2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o botão único "Gerar pedidos de compra" (que exige 100% do lote
cotado) por geração de pedido **por fornecedor**, e acrescentar quantidade
editável, exclusão de preço e correção de preço direto na tela de comparação.

**Architecture:** Todo o estado vem do hook `useQuoteBatchComparison` (uma
consulta ao Supabase por carregamento + mutações pontuais que disparam
`refetch()`), consumido só por `QuoteBatchComparison.tsx`. Faltantes ganha um
novo status intermediário (`pedido_enviado`) entre `pendente` e `resolvido`,
com uma segunda aba na tela de Faltantes pra confirmar ou reverter.

**Tech Stack:** React + TypeScript (Vite), Supabase (Postgres + RLS), shadcn/ui,
lucide-react.

## Global Constraints

- Sem suíte de teste automatizada neste projeto — verificação é `npm run
  typecheck` + checagem manual no navegador, mesmo padrão das specs anteriores
  do módulo de cotações.
- RLS de `missing_products` já permite qualquer transição de status pra quem
  tem as permissões `faltantes` E `fornecedores` (policy "Staff com faltantes
  e fornecedores resolve faltante", sem restrição de status no `with check`)
  — nenhuma migração de RLS é necessária pro novo status `pedido_enviado`.
- Migrações aplicadas via Supabase MCP (`mcp__claude_ai_Supabase__apply_migration`,
  `project_id: "ccrucholgsffichvzbpz"`), depois salvas em
  `supabase/migrations/` pra manter o histórico local em sincronia — é assim
  que este projeto já gerencia schema (ver `CLAUDE.md`).

---

## Task 1: Migrações

**Files:**
- Create: `supabase/migrations/20260915130000_quote_line_items_exclude_correct.sql`
- Create: `supabase/migrations/20260915131000_quote_batch_suppliers_order_generated.sql`
- Create: `supabase/migrations/20260915132000_missing_products_pedido_enviado.sql`

**Interfaces:**
- Consumes: nada.
- Produces: colunas novas usadas por todas as outras tasks —
  `quote_line_items.excluded_at/excluded_by/excluded_by_name/corrected_at`,
  `quote_batch_suppliers.order_generated_at/order_generated_by/order_generated_by_name`,
  `missing_products.status` aceitando `'pedido_enviado'` +
  `missing_products.order_sent_at/order_sent_by`.

- [ ] **Step 1: Criar a migração de `quote_line_items`**

```sql
begin;

alter table public.quote_line_items
  add column excluded_at timestamptz,
  add column excluded_by uuid references public.staff_members(user_id) on delete set null,
  add column excluded_by_name text,
  add column corrected_at timestamptz;

comment on column public.quote_line_items.excluded_at is 'Quando este preço foi excluído da comparação (não conta como "mais barato", não pode ser vencedor). Null = preço válido.';
comment on column public.quote_line_items.excluded_by is 'Quem excluiu.';
comment on column public.quote_line_items.excluded_by_name is 'Nome de quem excluiu, denormalizado (mesmo padrão de updated_by_name).';
comment on column public.quote_line_items.corrected_at is 'Quando o preço foi editado manualmente na tela de comparação — distinto de updated_at/updated_by_name, que também é gravado pela extração por IA e pela revisão do fornecedor. Null = nunca corrigido na comparação.';

commit;
```

Salvar em `supabase/migrations/20260915130000_quote_line_items_exclude_correct.sql`.

- [ ] **Step 2: Criar a migração de `quote_batch_suppliers`**

```sql
begin;

alter table public.quote_batch_suppliers
  add column order_generated_at timestamptz,
  add column order_generated_by uuid references public.staff_members(user_id) on delete set null,
  add column order_generated_by_name text;

comment on column public.quote_batch_suppliers.order_generated_at is 'Quando o pedido de compra deste fornecedor foi gerado pela primeira vez (independente do lote inteiro estar concluído/arquivado). Null = ainda não gerado.';

commit;
```

Salvar em `supabase/migrations/20260915131000_quote_batch_suppliers_order_generated.sql`.

- [ ] **Step 3: Criar a migração de `missing_products`**

Mesmo padrão de `supabase/migrations/20260827140000_missing_products_cancelado.sql`
(drop + recria o check constraint de status):

```sql
begin;

alter table public.missing_products
  drop constraint missing_products_status_check;

alter table public.missing_products
  add constraint missing_products_status_check
  check (status = any (array['pendente'::text, 'resolvido'::text, 'cancelado'::text, 'pedido_enviado'::text]));

alter table public.missing_products
  add column order_sent_at timestamptz,
  add column order_sent_by uuid references public.staff_members(user_id) on delete set null;

comment on column public.missing_products.order_sent_at is 'Quando um pedido de compra foi gerado pro fornecedor vencedor deste item — status vira pedido_enviado. Distinto de resolvido (compra confirmada) e pendente (nenhum pedido gerado ainda).';
comment on column public.missing_products.order_sent_by is 'Quem gerou o pedido que moveu este item pra pedido_enviado.';

commit;
```

Salvar em `supabase/migrations/20260915132000_missing_products_pedido_enviado.sql`.

- [ ] **Step 4: Aplicar as 3 migrações no projeto Supabase**

Usar a tool `mcp__claude_ai_Supabase__apply_migration` com `project_id:
"ccrucholgsffichvzbpz"`, uma chamada por arquivo, na ordem acima (`name` = o
nome do arquivo sem `.sql`, `query` = o conteúdo do Step correspondente).

- [ ] **Step 5: Verificar as colunas novas**

Rodar via `mcp__claude_ai_Supabase__execute_sql` (mesmo `project_id`):

```sql
select column_name from information_schema.columns
where table_name = 'quote_line_items' and column_name in ('excluded_at', 'excluded_by', 'excluded_by_name', 'corrected_at');

select column_name from information_schema.columns
where table_name = 'quote_batch_suppliers' and column_name like 'order_generated%';

select column_name from information_schema.columns
where table_name = 'missing_products' and column_name in ('order_sent_at', 'order_sent_by');
```

Expected: cada query retorna todas as colunas esperadas.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260915130000_quote_line_items_exclude_correct.sql \
        supabase/migrations/20260915131000_quote_batch_suppliers_order_generated.sql \
        supabase/migrations/20260915132000_missing_products_pedido_enviado.sql
git commit -m "feat(cotacoes): colunas pra excluir/corrigir preço, pedido por fornecedor e status pedido_enviado"
```

---

## Task 2: `useQuoteBatchComparison` — excluir, corrigir, quantidade, pedido por fornecedor

**Files:**
- Modify: `src/hooks/useQuoteBatchComparison.ts` (substituição completa do arquivo)

**Interfaces:**
- Consumes: colunas novas da Task 1.
- Produces (usado pela Task 3):
  - `ComparisonSupplier.order_generated_at: string | null`
  - `getExcluded(itemId: string, supplierId: string): boolean`
  - `getCorrected(itemId: string, supplierId: string): boolean`
  - `setPriceExcluded(itemId: string, supplierId: string, excluded: boolean): Promise<void>`
  - `correctPrice(itemId: string, supplierId: string, price: number): Promise<void>`
  - `updateItemQuantity(itemId: string, quantity: number | null): Promise<void>`
  - `generateSupplierOrder(supplierId: string): Promise<boolean>`
  - `archiveBatch(): Promise<boolean>` (substitui `finalizeBatch`)

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

O arquivo `src/hooks/useQuoteBatchComparison.ts` muda em praticamente todas as
seções (tipos, fetch, lógica de vencedor automático, mutações, retorno) —
substituir o arquivo inteiro pelo conteúdo abaixo. As mudanças em relação à
versão atual:

1. `ComparisonSupplier` ganha `order_generated_at`.
2. `fetchData` busca também `excluded_at`/`corrected_at` por linha de preço e
   `order_generated_at` por fornecedor; novos estados `excludedByKey` e
   `correctedByKey` com getters `getExcluded`/`getCorrected`.
3. A lógica de vencedor automático passa a ignorar preço excluído no cálculo
   do mais barato, e **sempre** reatribui (ou remove) o vencedor cujo preço
   foi excluído — mesmo se a escolha era manual/ia (não existe "respeitar
   escolha manual" quando o valor escolhido deixou de ser válido).
4. `setWinner` recusa apontar pra um preço excluído.
5. Novas mutações: `setPriceExcluded`, `correctPrice`, `updateItemQuantity`,
   `generateSupplierOrder`.
6. `finalizeBatch` vira `archiveBatch`: não exige mais todo item ter vencedor,
   e não mexe mais em `missing_products` (isso passou pra
   `generateSupplierOrder`, por fornecedor).

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';

export interface ComparisonItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  quantity: number | null;
}

export interface ComparisonSupplier {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  order_generated_at: string | null;
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
  const [noteByKey, setNoteByKey] = useState<Record<string, string | null>>({});
  const [excludedByKey, setExcludedByKey] = useState<Record<string, boolean>>({});
  const [correctedByKey, setCorrectedByKey] = useState<Record<string, boolean>>({});
  const [winners, setWinners] = useState<Map<string, string>>(new Map());
  const [winnerSources, setWinnerSources] = useState<Map<string, WinnerSource>>(new Map());

  const priceKey = (itemId: string, supplierId: string) => `${itemId}::${supplierId}`;
  const getPrice = useCallback(
    (itemId: string, supplierId: string): number | null => priceByKey[priceKey(itemId, supplierId)] ?? null,
    [priceByKey]
  );
  const getNote = useCallback(
    (itemId: string, supplierId: string): string | null => noteByKey[priceKey(itemId, supplierId)] ?? null,
    [noteByKey]
  );
  const getExcluded = useCallback(
    (itemId: string, supplierId: string): boolean => excludedByKey[priceKey(itemId, supplierId)] ?? false,
    [excludedByKey]
  );
  const getCorrected = useCallback(
    (itemId: string, supplierId: string): boolean => correctedByKey[priceKey(itemId, supplierId)] ?? false,
    [correctedByKey]
  );
  const getWinnerSource = useCallback(
    (itemId: string): WinnerSource | null => winnerSources.get(itemId) ?? null,
    [winnerSources]
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
        quantity: number | null;
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
        .select(
          'id, order_generated_at, suppliers(company_name, contact_name, phone), quote_line_items(quote_batch_item_id, price, notes, excluded_at, corrected_at)'
        )
        .eq('quote_batch_id', batchId);
      if (suppliersError) throw suppliersError;

      const typedSupplierRows = (supplierRows || []) as unknown as Array<{
        id: string;
        order_generated_at: string | null;
        suppliers: { company_name: string; contact_name: string; phone: string } | null;
        quote_line_items: {
          quote_batch_item_id: string;
          price: number | null;
          notes: string | null;
          excluded_at: string | null;
          corrected_at: string | null;
        }[];
      }>;

      const nextSuppliers: ComparisonSupplier[] = typedSupplierRows.map((row) => ({
        id: row.id,
        company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
        contact_name: row.suppliers?.contact_name ?? '',
        phone: row.suppliers?.phone ?? '',
        order_generated_at: row.order_generated_at,
      }));
      setSuppliers(nextSuppliers);

      const nextPriceByKey: Record<string, number | null> = {};
      const nextNoteByKey: Record<string, string | null> = {};
      const nextExcludedByKey: Record<string, boolean> = {};
      const nextCorrectedByKey: Record<string, boolean> = {};
      for (const supplierRow of typedSupplierRows) {
        for (const lineItem of supplierRow.quote_line_items) {
          const key = priceKey(lineItem.quote_batch_item_id, supplierRow.id);
          nextPriceByKey[key] = lineItem.price;
          nextNoteByKey[key] = lineItem.notes;
          nextExcludedByKey[key] = lineItem.excluded_at !== null;
          nextCorrectedByKey[key] = lineItem.corrected_at !== null;
        }
      }
      setPriceByKey(nextPriceByKey);
      setNoteByKey(nextNoteByKey);
      setExcludedByKey(nextExcludedByKey);
      setCorrectedByKey(nextCorrectedByKey);

      const { data: winnerRows, error: winnersError } = await supabase
        .from('quote_item_winners')
        .select('quote_batch_item_id, quote_batch_supplier_id, source')
        .in(
          'quote_batch_item_id',
          nextItems.map((item) => item.id)
        );
      if (winnersError) throw winnersError;

      const nextWinners = new Map<string, string>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.quote_batch_supplier_id as string])
      );
      const nextWinnerSources = new Map<string, WinnerSource>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.source as WinnerSource])
      );

      // Inicialização/atualização automática: todo item sem vencedor válido
      // ganha o fornecedor de menor preço não nulo e não excluído. Vencedor
      // 'auto' é reavaliado a cada carregamento (preço mais barato pode ter
      // chegado depois). Vencedor cujo preço foi EXCLUÍDO é sempre
      // reavaliado, não importa como foi definido (manual/ia incluídos) — um
      // preço excluído não é mais válido, não existe "respeitar a escolha
      // manual" quando o valor escolhido deixou de existir. Escolha
      // manual/ia com preço ainda válido nunca é tocada aqui. Só roda com o
      // lote aberto.
      if (batchRow.status === 'aberto' && user && displayName) {
        const toInsert: Array<{
          quote_batch_item_id: string;
          quote_batch_supplier_id: string;
          source: WinnerSource;
          set_by: string;
          set_by_name: string;
        }> = [];
        const toUpdate: Array<{ quote_batch_item_id: string; quote_batch_supplier_id: string }> = [];
        const toDelete: string[] = [];

        for (const item of nextItems) {
          let cheapestSupplierId: string | null = null;
          let cheapestPrice = Infinity;
          for (const supplier of nextSuppliers) {
            const key = priceKey(item.id, supplier.id);
            const price = nextPriceByKey[key];
            if (price !== null && price !== undefined && !nextExcludedByKey[key] && price < cheapestPrice) {
              cheapestPrice = price;
              cheapestSupplierId = supplier.id;
            }
          }

          const currentWinnerId = nextWinners.get(item.id);
          const currentSource = nextWinnerSources.get(item.id);
          const currentWinnerExcluded = currentWinnerId
            ? nextExcludedByKey[priceKey(item.id, currentWinnerId)]
            : false;

          if (!currentWinnerId) {
            if (cheapestSupplierId) {
              toInsert.push({
                quote_batch_item_id: item.id,
                quote_batch_supplier_id: cheapestSupplierId,
                source: 'auto',
                set_by: user.id,
                set_by_name: displayName,
              });
              nextWinnerSources.set(item.id, 'auto');
            }
            continue;
          }

          if (currentWinnerExcluded) {
            if (cheapestSupplierId) {
              toUpdate.push({ quote_batch_item_id: item.id, quote_batch_supplier_id: cheapestSupplierId });
              nextWinnerSources.set(item.id, 'auto');
            } else {
              toDelete.push(item.id);
              nextWinners.delete(item.id);
              nextWinnerSources.delete(item.id);
            }
            continue;
          }

          if (currentSource === 'auto' && cheapestSupplierId && currentWinnerId !== cheapestSupplierId) {
            toUpdate.push({ quote_batch_item_id: item.id, quote_batch_supplier_id: cheapestSupplierId });
          }
        }

        if (toInsert.length > 0) {
          const { error: insertWinnersError } = await supabase.from('quote_item_winners').insert(toInsert);
          if (insertWinnersError) {
            console.error('Error auto-assigning quote winners:', insertWinnersError);
          } else {
            for (const row of toInsert) {
              nextWinners.set(row.quote_batch_item_id, row.quote_batch_supplier_id);
            }
          }
        }

        for (const row of toUpdate) {
          // Sem filtro de source: cobre tanto o auto desatualizado (preço
          // mais barato chegou) quanto o vencedor atual ter sido excluído
          // (mesmo se era manual/ia) — nos dois casos vira 'auto' de novo,
          // é uma reatribuição automática nova.
          const { error: updateWinnerError } = await supabase
            .from('quote_item_winners')
            .update({
              quote_batch_supplier_id: row.quote_batch_supplier_id,
              source: 'auto',
              set_by: user.id,
              set_by_name: displayName,
              set_at: new Date().toISOString(),
            })
            .eq('quote_batch_item_id', row.quote_batch_item_id);
          if (updateWinnerError) {
            console.error('Error refreshing quote winner:', updateWinnerError);
            continue;
          }
          nextWinners.set(row.quote_batch_item_id, row.quote_batch_supplier_id);
        }

        if (toDelete.length > 0) {
          const { error: deleteWinnersError } = await supabase
            .from('quote_item_winners')
            .delete()
            .in('quote_batch_item_id', toDelete);
          if (deleteWinnersError) {
            console.error('Error clearing quote winners with no valid price left:', deleteWinnersError);
          }
        }
      }

      setWinners(nextWinners);
      setWinnerSources(nextWinnerSources);
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
    if (getExcluded(itemId, supplierId)) return;
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
      setWinnerSources((prev) => {
        const next = new Map(prev);
        next.set(itemId, 'manual');
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

  const setPriceExcluded = async (itemId: string, supplierId: string, excluded: boolean) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update(
          excluded
            ? { excluded_at: new Date().toISOString(), excluded_by: user.id, excluded_by_name: displayName }
            : { excluded_at: null, excluded_by: null, excluded_by_name: null }
        )
        .eq('quote_batch_item_id', itemId)
        .eq('quote_batch_supplier_id', supplierId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      await fetchData();
    } catch (error) {
      console.error('Error toggling quote line item exclusion:', error);
      toast({
        title: excluded ? 'Erro ao excluir preço' : 'Erro ao restaurar preço',
        description: 'Não foi possível salvar essa mudança.',
        variant: 'destructive',
      });
    }
  };

  const correctPrice = async (itemId: string, supplierId: string, price: number) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update({
          price,
          updated_by: user.id,
          updated_by_name: displayName,
          corrected_at: new Date().toISOString(),
        })
        .eq('quote_batch_item_id', itemId)
        .eq('quote_batch_supplier_id', supplierId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      await fetchData();
    } catch (error) {
      console.error('Error correcting quote line item price:', error);
      toast({
        title: 'Erro ao corrigir preço',
        description: 'Não foi possível salvar o valor.',
        variant: 'destructive',
      });
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number | null) => {
    try {
      const { error } = await supabase.from('quote_batch_items').update({ quantity }).eq('id', itemId);
      if (error) throw error;
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
    } catch (error) {
      console.error('Error updating quote batch item quantity:', error);
      toast({
        title: 'Erro ao salvar quantidade',
        description: 'Não foi possível salvar esse valor.',
        variant: 'destructive',
      });
    }
  };

  // Gera o pedido de um fornecedor: marca a primeira geração em
  // quote_batch_suppliers e move pra 'pedido_enviado' todo missing_product
  // ligado a um item em que ele é vencedor atual. Não exige que o lote
  // inteiro esteja pronto — só os itens deste fornecedor.
  const generateSupplierOrder = async (supplierId: string): Promise<boolean> => {
    if (!user || !displayName) return false;
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return false;

    const missingProductIds = items
      .filter((item) => winners.get(item.id) === supplierId)
      .map((item) => item.missing_product_id);
    if (missingProductIds.length === 0) return false;

    try {
      if (!supplier.order_generated_at) {
        const { error: supplierUpdateError } = await supabase
          .from('quote_batch_suppliers')
          .update({
            order_generated_at: new Date().toISOString(),
            order_generated_by: user.id,
            order_generated_by_name: displayName,
          })
          .eq('id', supplierId)
          .is('order_generated_at', null);
        if (supplierUpdateError) throw supplierUpdateError;
      }

      const { error: missingUpdateError } = await supabase
        .from('missing_products')
        .update({
          status: 'pedido_enviado',
          order_sent_at: new Date().toISOString(),
          order_sent_by: user.id,
        })
        .in('id', missingProductIds)
        .eq('status', 'pendente');
      if (missingUpdateError) throw missingUpdateError;

      toast({
        title: 'Pedido gerado',
        description: `${supplier.company_name}: ${missingProductIds.length} item(ns) marcados como pedido enviado.`,
      });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error generating supplier order:', error);
      toast({
        title: 'Erro ao gerar pedido',
        description: 'Não foi possível marcar os itens como pedidos.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Arquiva o lote — só organização, não mexe em Faltantes (isso já
  // aconteceu por fornecedor em generateSupplierOrder). Não exige que todo
  // item tenha vencedor: itens ainda sem cotação continuam pendentes
  // normalmente em Faltantes, disponíveis pra entrar num lote novo depois.
  const archiveBatch = async (): Promise<boolean> => {
    if (!user || !displayName) return false;
    try {
      const { error: batchUpdateError } = await supabase
        .from('quote_batches')
        .update({
          status: 'concluido',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          completed_by_name: displayName,
        })
        .eq('id', batchId)
        .eq('status', 'aberto');
      if (batchUpdateError) throw batchUpdateError;

      toast({ title: 'Lote arquivado' });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error archiving quote batch:', error);
      toast({
        title: 'Erro ao arquivar lote',
        description: 'Não foi possível arquivar o lote.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    loading,
    batchStatus,
    items,
    suppliers,
    getPrice,
    getNote,
    getExcluded,
    getCorrected,
    winners,
    getWinnerSource,
    setWinner,
    applyCommand,
    setPriceExcluded,
    correctPrice,
    updateItemQuantity,
    generateSupplierOrder,
    archiveBatch,
    refetch: fetchData,
  };
};
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: erros só em `src/components/quotes/QuoteBatchComparison.tsx` (ainda
não atualizado — resolvido na Task 3), nenhum erro dentro do próprio
`useQuoteBatchComparison.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useQuoteBatchComparison.ts
git commit -m "feat(cotacoes): hook ganha excluir/corrigir preço, quantidade editável e pedido por fornecedor"
```

---

## Task 3: `QuoteBatchComparison.tsx` — UI

**Files:**
- Modify: `src/components/quotes/QuoteBatchComparison.tsx` (substituição completa do arquivo)

**Interfaces:**
- Consumes: tudo que a Task 2 produz.
- Produces: nada consumido por outra task — é a ponta final desta parte
  (junto com a Task 5, independente).

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

Mudanças em relação à versão atual:

1. Quantidade vira um input editável na coluna "Item" (grava via
   `updateItemQuantity` no blur).
2. Cada célula de preço ganha, ao passar o mouse: ícone de lápis (edita,
   chama `correctPrice`) e ícone de X (exclui, chama `setPriceExcluded`).
   Célula excluída mostra o preço riscado com ícone de restaurar no lugar do
   X, e não pode mais ser clicada pra virar vencedor.
3. Badge azul "Editado" quando `getCorrected` é true.
4. O botão único "Gerar pedidos de compra" (com o gate de 100% do lote) é
   removido. Em seu lugar: um card por fornecedor com itens prontos (mesmo
   cálculo de `orderItemsBySupplier` que já existia, sem mudança de lógica),
   mostrado sempre que o lote está `aberto` ou `concluido` (não em
   `cancelado`). Cada card mostra "Gerar pedido" (confirmação, chama
   `generateSupplierOrder`) enquanto `order_generated_at` for nulo; depois
   disso mostra os botões WhatsApp/PDF (mesmos de antes) em vez do botão de
   gerar.
5. Um botão "Arquivar lote" substitui a antiga confirmação de "Gerar pedidos
   de compra" — disponível a qualquer momento com o lote `aberto`, chama
   `archiveBatch`.

```tsx
import { useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, FileDown, Pencil, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useQuoteBatchComparison } from '@/hooks/useQuoteBatchComparison';
import { buildMissingItemDisplayName, compareMissingItems } from '@/lib/missingProductDisplay';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { buildPurchaseOrderMessage, downloadPurchaseOrderPdf, PurchaseOrderItem } from '@/lib/purchaseOrder';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

interface QuoteBatchComparisonProps {
  batchId: string;
  products: ProductWithVariations[];
  onBack: () => void;
}

const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

const QuoteBatchComparison = ({ batchId, products, onBack }: QuoteBatchComparisonProps) => {
  const {
    loading,
    batchStatus,
    items,
    suppliers,
    getPrice,
    getNote,
    getExcluded,
    getCorrected,
    winners,
    getWinnerSource,
    setWinner,
    applyCommand,
    setPriceExcluded,
    correctPrice,
    updateItemQuantity,
    generateSupplierOrder,
    archiveBatch,
  } = useQuoteBatchComparison(batchId);
  const [command, setCommand] = useState('');
  const [isApplyingCommand, setIsApplyingCommand] = useState(false);
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [generatingSupplierId, setGeneratingSupplierId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; supplierId: string } | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const productById = new Map(products.map((p) => [p.id, p]));
  const isReadOnly = batchStatus !== 'aberto';
  // Agrupa variações do mesmo produto lado a lado (tabela, subtotais e pedido
  // final), em vez da ordem de inserção no banco.
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        compareMissingItems(
          { product: productById.get(a.product_id), fragranceId: a.fragrance_id, variationId: a.variation_id },
          { product: productById.get(b.product_id), fragranceId: b.fragrance_id, variationId: b.variation_id }
        )
      ),
    [items, products]
  );

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

  const subtotalBySupplier = new Map<string, number>();
  for (const item of items) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    subtotalBySupplier.set(winnerId, (subtotalBySupplier.get(winnerId) ?? 0) + price * (item.quantity ?? 1));
  }

  const orderItemsBySupplier = new Map<string, PurchaseOrderItem[]>();
  for (const item of sortedItems) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    const product = productById.get(item.product_id);
    const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
    const list = orderItemsBySupplier.get(winnerId) ?? [];
    // Pedido final precisa de uma quantidade real pro fornecedor — cotação
    // pode ficar sem quantidade definida, mas o pedido assume 1 nesse caso.
    list.push({ name: displayName, quantity: item.quantity ?? 1, unitPrice: price });
    orderItemsBySupplier.set(winnerId, list);
  }

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveBatch();
    } finally {
      setIsArchiving(false);
    }
  };

  const handleGenerateSupplierOrder = async (supplierId: string) => {
    setGeneratingSupplierId(supplierId);
    try {
      await generateSupplierOrder(supplierId);
    } finally {
      setGeneratingSupplierId(null);
    }
  };

  const handleQuantityBlur = (itemId: string, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      updateItemQuantity(itemId, null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    updateItemQuantity(itemId, !Number.isNaN(parsed) && parsed > 0 ? parsed : null);
  };

  const startEditingPrice = (itemId: string, supplierId: string, currentPrice: number) => {
    setEditingCell({ itemId, supplierId });
    setEditingPriceValue(String(currentPrice));
  };

  const saveEditingPrice = async () => {
    const cell = editingCell;
    setEditingCell(null);
    if (!cell) return;
    const parsed = parseFloat(editingPriceValue.replace(',', '.'));
    if (Number.isNaN(parsed)) return;
    await correctPrice(cell.itemId, cell.supplierId, parsed);
  };

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
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit text-blue-300 hover:text-blue-200 hover:bg-blue-500/10">
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
                    <span className="block font-normal text-muted-foreground">({supplier.contact_name})</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => {
                const product = productById.get(item.product_id);
                const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                const winnerId = winners.get(item.id);
                const winnerSource = getWinnerSource(item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          key={item.id}
                          type="number"
                          min="1"
                          disabled={isReadOnly}
                          defaultValue={item.quantity ?? ''}
                          placeholder="Qtd"
                          className="h-7 w-16"
                          onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                        />
                        <span>{displayName}</span>
                      </div>
                    </TableCell>
                    {suppliers.map((supplier) => {
                      const price = getPrice(item.id, supplier.id);
                      const note = getNote(item.id, supplier.id);
                      const excluded = getExcluded(item.id, supplier.id);
                      const corrected = getCorrected(item.id, supplier.id);
                      const isWinner = winnerId === supplier.id;
                      const isManualWinner = isWinner && winnerSource !== 'auto';
                      const isEditingCell = editingCell?.itemId === item.id && editingCell?.supplierId === supplier.id;
                      return (
                        <TableCell key={supplier.id}>
                          {price === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : isEditingCell ? (
                            <Input
                              type="number"
                              step="0.01"
                              autoFocus
                              className="h-7 w-24"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              onBlur={saveEditingPrice}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : (
                            <div className="group flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isReadOnly || excluded}
                                onClick={() => setWinner(item.id, supplier.id)}
                                className={`text-sm px-2 py-1 rounded ${
                                  excluded
                                    ? 'text-muted-foreground line-through'
                                    : isManualWinner
                                      ? 'bg-amber-600 text-white font-semibold'
                                      : isWinner
                                        ? 'bg-emerald-600 text-white font-semibold'
                                        : 'hover:bg-muted/50'
                                } ${isReadOnly || excluded ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                {formatPrice(price)}
                                {isWinner && !excluded && (
                                  <Badge variant="secondary" className="ml-2 text-[10px]">
                                    {isManualWinner ? 'Manual' : 'Mais barato'}
                                  </Badge>
                                )}
                                {corrected && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 text-[10px] bg-blue-600 text-white hover:bg-blue-600"
                                  >
                                    Editado
                                  </Badge>
                                )}
                              </button>
                              {!isReadOnly &&
                                (excluded ? (
                                  <button
                                    type="button"
                                    aria-label="Restaurar preço"
                                    title="Restaurar preço"
                                    onClick={() => setPriceExcluded(item.id, supplier.id, false)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Editar preço"
                                      title="Editar preço"
                                      onClick={() => startEditingPrice(item.id, supplier.id, price)}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Excluir preço da comparação"
                                      title="Excluir preço da comparação"
                                      onClick={() => setPriceExcluded(item.id, supplier.id, true)}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ))}
                            </div>
                          )}
                          {note && <p className="text-xs text-muted-foreground px-2">{note}</p>}
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
              {supplier.company_name} ({supplier.contact_name}): {formatPrice(subtotalBySupplier.get(supplier.id) ?? 0)}
            </p>
          ))}
        </div>
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

        {batchStatus !== 'cancelado' && orderItemsBySupplier.size > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Pedidos de compra</p>
            {Array.from(orderItemsBySupplier.entries()).map(([supplierId, orderItems]) => {
              const supplier = suppliers.find((s) => s.id === supplierId);
              const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
              return (
                <div key={supplierId} className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">
                    {supplier ? `${supplier.company_name} (${supplier.contact_name})` : 'Fornecedor'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {orderItems.length} item(ns) · Total: {formatPrice(total)}
                    {supplier?.order_generated_at &&
                      ` · Pedido gerado em ${new Date(supplier.order_generated_at).toLocaleDateString('pt-BR')}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!supplier?.order_generated_at ? (
                      !isReadOnly && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" disabled={generatingSupplierId === supplierId}>
                              Gerar pedido
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Gerar pedido pra {supplier?.company_name ?? 'este fornecedor'}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Marca os {orderItems.length} item(ns) dele como pedido enviado em Faltantes. Os
                                outros itens do lote continuam como estão.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleGenerateSupplierOrder(supplierId)}>
                                Gerar pedido
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )
                    ) : (
                      <>
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
                          onClick={() =>
                            downloadPurchaseOrderPdf(
                              supplier ? `${supplier.company_name} (${supplier.contact_name})` : 'fornecedor',
                              orderItems
                            )
                          }
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Baixar PDF
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {batchStatus === 'aberto' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isArchiving} className="w-full">
                Arquivar lote
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar este lote?</AlertDialogTitle>
                <AlertDialogDescription>
                  Só organiza a lista de lotes — itens ainda sem vencedor continuam pendentes em Faltantes
                  normalmente, sem mudança. Não tem como desarquivar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Arquivar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteBatchComparison;
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Verificação manual — quantidade, excluir, editar preço**

Com `npm run dev` rodando, abrir Cotações → o lote aberto com itens já
cotados (ex: o lote de 145 itens) → tela de Comparação:

1. Mudar a quantidade de um item, clicar fora — recarrega e o subtotal do
   fornecedor vencedor daquele item muda de acordo.
2. Passar o mouse numa célula com preço — aparecem os ícones de lápis e X.
3. Clicar no X do preço que é vencedor atual de um item com 2+ fornecedores
   cotando — o preço fica riscado, e o vencedor muda automaticamente pro
   próximo mais barato (badge "Mais barato" aparece na nova célula).
4. Clicar em restaurar (ícone de desfazer) no preço excluído — volta a
   contar, badge de "Editado"/"Mais barato" recalcula se fizer sentido.
5. Clicar no lápis de um preço, digitar outro valor, Enter — preço muda,
   badge azul "Editado" aparece na célula.

- [ ] **Step 4: Verificação manual — pedido por fornecedor e arquivar**

No mesmo lote (145 itens, boa parte sem cotação nenhuma):

1. Um fornecedor que já é vencedor de pelo menos 1 item com preço mostra um
   card em "Pedidos de compra" com botão "Gerar pedido" — mesmo com outros
   itens do lote ainda sem preço nenhum.
2. Confirmar "Gerar pedido" — o card passa a mostrar WhatsApp/PDF em vez do
   botão de gerar; abrir Faltantes (fora desta tela) confirma que os itens
   daquele fornecedor saíram da lista principal (aba Pendente, feito na
   Task 5).
3. Botão "Arquivar lote" funciona a qualquer momento, mesmo com itens sem
   vencedor — depois de arquivar, a tela vira somente leitura mas os cards já
   gerados continuam com WhatsApp/PDF funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/QuoteBatchComparison.tsx
git commit -m "feat(cotacoes): UI de pedido por fornecedor, excluir/editar preço e quantidade editável"
```

---

## Task 4: `useMissingProducts` — status `pedido_enviado`

**Files:**
- Modify: `src/hooks/useMissingProducts.ts`

**Interfaces:**
- Consumes: colunas novas da Task 1.
- Produces (usado pela Task 5):
  - `MissingProduct.status` inclui `'pedido_enviado'`; `order_sent_at: string
    | null`, `order_sent_by: string | null`.
  - `orderedProducts: MissingProduct[]`, `ordersLoading: boolean`
  - `supplierByMissingId: Record<string, string>` (nome do fornecedor pro
    qual o pedido foi gerado, quando encontrado)
  - `confirmOrderReceived(id: string): Promise<void>`
  - `revertOrderToPending(id: string): Promise<void>`
  - `refetchOrdered(): Promise<void>`

- [ ] **Step 1: Atualizar o tipo `MissingProduct`**

Em `src/hooks/useMissingProducts.ts:7-23`, trocar:

```typescript
export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido' | 'cancelado';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
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
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Novo estado pra pedidos enviados**

Em `src/hooks/useMissingProducts.ts:40-42`, depois de:

```typescript
  const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { displayName: currentDisplayName, status: displayNameStatus } = useCurrentStaffName();
```

adicionar:

```typescript
  const [orderedProducts, setOrderedProducts] = useState<MissingProduct[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [supplierByMissingId, setSupplierByMissingId] = useState<Record<string, string>>({});
```

- [ ] **Step 3: `fetchOrderedProducts`**

Em `src/hooks/useMissingProducts.ts`, logo depois de `fetchMissingProducts`
(depois da linha 65, antes de `findExistingPending`), adicionar:

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

- [ ] **Step 4: Mutações `confirmOrderReceived` e `revertOrderToPending`**

Em `src/hooks/useMissingProducts.ts`, logo depois de `cancelMissingProduct`
(depois da linha 257, antes do `useEffect`), adicionar:

```typescript
  const confirmOrderReceived = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({ status: 'resolvido', resolved_by: user.id, resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pedido_enviado');
      if (error) throw error;

      setOrderedProducts((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Recebimento confirmado' });
    } catch (error) {
      console.error('Error confirming missing product order received:', error);
      toast({
        title: 'Erro ao confirmar',
        description: 'Não foi possível marcar como recebido.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const revertOrderToPending = async (id: string) => {
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({ status: 'pendente', order_sent_at: null, order_sent_by: null })
        .eq('id', id)
        .eq('status', 'pedido_enviado');
      if (error) throw error;

      setOrderedProducts((prev) => prev.filter((item) => item.id !== id));
      await fetchMissingProducts();
      toast({ title: 'Item voltou pra pendente' });
    } catch (error) {
      console.error('Error reverting missing product order to pending:', error);
      toast({
        title: 'Erro ao reverter',
        description: 'Não foi possível voltar este item pra pendente.',
        variant: 'destructive',
      });
      throw error;
    }
  };
```

- [ ] **Step 5: Buscar pedidos enviados no mount e expor tudo no retorno**

Em `src/hooks/useMissingProducts.ts:259-272`, trocar:

```typescript
  useEffect(() => {
    fetchMissingProducts();
  }, [fetchMissingProducts]);

  return {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    refetch: fetchMissingProducts,
    displayNameStatus,
  };
};
```

por:

```typescript
  useEffect(() => {
    fetchMissingProducts();
    fetchOrderedProducts();
  }, [fetchMissingProducts, fetchOrderedProducts]);

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

- [ ] **Step 6: Verificar tipos**

Run: `npm run typecheck`
Expected: erros só em `MissingProductsManager.tsx` (ainda não usa os campos
novos — resolvido na Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useMissingProducts.ts
git commit -m "feat(faltantes): hook busca itens pedido_enviado com confirmar/reverter"
```

---

## Task 5: `MissingProductsManager.tsx` — aba "Aguardando confirmação"

**Files:**
- Modify: `src/components/MissingProductsManager.tsx`

**Interfaces:**
- Consumes: tudo que a Task 4 produz.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Imports novos**

Em `src/components/MissingProductsManager.tsx:1-28`, trocar a linha de ícones
(linha 3):

```typescript
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck, Trash2, ExternalLink } from 'lucide-react';
```

por:

```typescript
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck, Trash2, ExternalLink, PackageCheck } from 'lucide-react';
```

E adicionar, depois da linha `import { Badge } from '@/components/ui/badge';`
(linha 27):

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
```

- [ ] **Step 2: Puxar os campos novos do hook**

Em `src/components/MissingProductsManager.tsx:203-204`, trocar:

```typescript
  const { missingProducts, loading, reportMissingProducts, resolveMissingProduct, cancelMissingProduct, displayNameStatus } =
    useMissingProducts();
```

por:

```typescript
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
```

- [ ] **Step 3: Handlers de confirmar/reverter**

Em `src/components/MissingProductsManager.tsx`, logo depois de `handleCancel`
(depois da linha 297, antes do `return`), adicionar:

```typescript
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const handleConfirmReceived = async (id: string) => {
    setConfirmingId(id);
    try {
      await confirmOrderReceived(id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRevertToPending = async (id: string) => {
    if (!window.confirm('Fornecedor não tinha o produto? O item volta pra pendente.')) return;
    setRevertingId(id);
    try {
      await revertOrderToPending(id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setRevertingId(null);
    }
  };
```

- [ ] **Step 4: Envolver a lista existente numa aba "Pendente" e adicionar "Aguardando confirmação"**

Em `src/components/MissingProductsManager.tsx:400-467`, o `<CardContent>`
atual (lista direta de `missingProducts`) passa de:

```tsx
      <CardContent className="pt-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : missingProducts.length === 0 ? (
          <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
        ) : (
          <div className="space-y-3">
            {sortedMissingProducts.map((item) => {
```

(mantendo o miolo do `.map` igual até o fechamento) para, envolvendo tudo em
`Tabs`:

```tsx
      <CardContent className="pt-6">
        <Tabs defaultValue="pendente">
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
          <TabsContent value="pendente">
            {loading ? (
              <AdminLoadingState rows={3} tone="light" />
            ) : missingProducts.length === 0 ? (
              <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
            ) : (
              <div className="space-y-3">
                {sortedMissingProducts.map((item) => {
```

E o fechamento atual (linhas ~462-467):

```tsx
              );
            })}
          </div>
        )}
      </CardContent>
```

vira:

```tsx
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="aguardando">
            {ordersLoading ? (
              <AdminLoadingState rows={3} tone="light" />
            ) : orderedProducts.length === 0 ? (
              <AdminEmptyState icon={PackageCheck} title="Nenhum pedido aguardando confirmação." tone="light" />
            ) : (
              <div className="space-y-3">
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
                          {item.order_sent_at &&
                            ` · ${new Date(item.order_sent_at).toLocaleDateString('pt-BR')}`}
                        </p>
                      </div>
                      {canResolve && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmingId === item.id}
                            onClick={() => handleConfirmReceived(item.id)}
                          >
                            Confirmar recebido
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={revertingId === item.id}
                            onClick={() => handleRevertToPending(item.id)}
                          >
                            Fornecedor não tinha
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
```

**Atenção**: o `.map` de `sortedMissingProducts` que fica dentro da aba
"Pendente" precisa ganhar +2 níveis de indentação (por causa do
`<Tabs><TabsContent>` novos em volta) — indentação em JSX não muda
comportamento, só mantenha o JSX balanceado (todo `{` `(` `<div>` que abre
tem que fechar na mesma ordem). Mais seguro: abrir o arquivo, localizar o
bloco inteiro de `<CardContent className="pt-6">` até o `</CardContent>` de
fechamento (linhas 400-467 na versão atual) e substituir o bloco inteiro
pelos dois trechos acima concatenados, mantendo o `.map((item) => { ... })`
original **sem alteração no miolo** (linhas 407-463 do arquivo atual)
encaixado entre `{sortedMissingProducts.map((item) => {` e o fechamento
`})}`.

- [ ] **Step 5: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Verificação manual**

1. Abrir Faltantes — aba "Pendente" é a mesma lista de sempre, comportamento
   idêntico ao de antes.
2. Depois de gerar um pedido de um fornecedor na tela de Comparação (Task 3),
   voltar em Faltantes — os itens daquele fornecedor sumiram da aba
   Pendente e aparecem em "Aguardando confirmação" com o nome do fornecedor e
   a data.
3. "Confirmar recebido" — item some de Aguardando confirmação (foi pra
   resolvido, não aparece em nenhuma aba desta tela).
4. "Fornecedor não tinha" — item some de Aguardando confirmação e reaparece
   em Pendente.
5. Usuário com só a permissão `faltantes` (sem `fornecedores`) não vê os
   botões de ação na aba Aguardando confirmação (mesma regra de `canResolve`
   já usada na aba Pendente).

- [ ] **Step 7: Commit**

```bash
git add src/components/MissingProductsManager.tsx
git commit -m "feat(faltantes): aba Aguardando confirmação pra itens com pedido enviado"
```

---

## Self-Review Notes

- **Spec coverage:** quantidade editável (Task 3 Step 1, coluna Item) ✓,
  excluir preço com desfazer (Task 2 `setPriceExcluded` + Task 3 ícones
  X/RotateCcw) ✓, reatribuição automática ao excluir vencedor mesmo se
  manual/ia (Task 2, bloco `currentWinnerExcluded`) ✓, editar preço com badge
  "Editado" distinto de extração/revisão (Task 1 coluna `corrected_at`, Task
  2 `correctPrice`, Task 3 badge azul) ✓, cards por fornecedor substituindo o
  botão único (Task 3) ✓, "Arquivar lote" sem exigir 100% cotado (Task 2
  `archiveBatch`, Task 3) ✓, novo status `pedido_enviado` + aba "Aguardando
  confirmação" com confirmar/reverter (Tasks 1, 4, 5) ✓.
- **Placeholder scan:** nenhum "TBD" — todo step com código completo; o único
  aviso de cuidado manual é o Step 4 da Task 5 (edição de JSX aninhado), que
  já vem com a orientação exata de onde cortar/colar.
- **Type consistency:** `getExcluded`/`getCorrected`/`setPriceExcluded`/
  `correctPrice`/`updateItemQuantity`/`generateSupplierOrder`/`archiveBatch`
  usados com a mesma assinatura em Task 2 (definição) e Task 3 (uso).
  `orderedProducts`/`supplierByMissingId`/`confirmOrderReceived`/
  `revertOrderToPending` usados com a mesma assinatura em Task 4 (definição)
  e Task 5 (uso).
- **Risco a observar na verificação manual:** a query de `supplierByMissingId`
  na Task 4 Step 3 (embed de 3 níveis via PostgREST) é a peça mais arriscada
  deste plano — se o nome do fornecedor não aparecer na aba "Aguardando
  confirmação" (Task 5 Step 6, item 2), checar o console do navegador por erro
  de sintaxe do embed antes de mexer em qualquer outra coisa.
