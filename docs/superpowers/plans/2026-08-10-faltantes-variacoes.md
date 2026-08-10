# Fragrância e tamanho em Faltantes (Parte D1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar escolher fragrância/tamanho ao reportar uma falta, quando o produto tiver essas opções cadastradas — pré-requisito pra Parte D2 (cotação) saber o item exato a pedir aos fornecedores.

**Architecture:** Duas colunas novas em `missing_products` (`fragrance_id`, `variation_id`, ambas opcionais, `on delete cascade`), um índice único parcial que agora considera as três colunas juntas (produto + fragrância + tamanho, tratando `null` como valor fixo via `coalesce`). No hook, a busca de "já existe pendente" e o insert passam a levar em conta as duas colunas novas. No componente, cada linha do lote ganha seletores de Fragrância/Tamanho (shadcn `Select`, já usado em outras telas) que só aparecem quando o produto escolhido tem essas opções, e a trava de "não repetir produto no mesmo lote" sai — o próprio banco resolve duplicata exata via o índice único.

**Tech Stack:** React + TypeScript + Tailwind + shadcn/ui (`Select`, já existente) + Supabase. Nenhuma dependência nova.

## Global Constraints

- Nenhuma mudança em `ProductForm`, no cadastro de fragrâncias/variações, ou em qualquer outra tabela além de `missing_products`.
- `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) é a verificação real do projeto.
- Strings visíveis pro usuário em português.
- Mantém o padrão visual já estabelecido (`tone="light"` nos estados compartilhados, `CardHeader` escuro) — nenhuma mudança nesse quesito nesta parte, só nos campos do formulário e na linha da lista.

---

### Task 1: Migration — `fragrance_id`/`variation_id` em `missing_products`

**Files:**
- Create: `supabase/migrations/20260810120000_missing_products_variations.sql`

**Interfaces:**
- Produz: colunas `fragrance_id`, `variation_id` em `public.missing_products`, com FKs pra `product_fragrances(id)`/`product_variations(id)` (`on delete cascade`). Novo índice único parcial substituindo o antigo.
- Consome: `public.product_fragrances(id)`, `public.product_variations(id)` — ambas já existentes.

- [ ] **Step 1: Escrever a migration**

```sql
begin;

alter table public.missing_products
  add column fragrance_id uuid,
  add column variation_id uuid;

alter table public.missing_products
  add constraint missing_products_fragrance_id_fkey
    foreign key (fragrance_id) references public.product_fragrances(id) on delete cascade,
  add constraint missing_products_variation_id_fkey
    foreign key (variation_id) references public.product_variations(id) on delete cascade;

-- Substitui o índice único da Parte D1 (só por product_id) por um que
-- considera também fragrância e tamanho — "Ypê Rosa 2L" e "Ypê Azul 1L"
-- passam a contar como itens diferentes, cada um com sua própria pendência.
-- coalesce trata "sem fragrância"/"sem tamanho" (null) como um valor fixo,
-- não como "qualquer coisa" — senão o índice não pegaria duplicata em
-- produtos sem variação nenhuma (onde as duas colunas ficam null sempre).
drop index public.missing_products_pending_product_idx;

create unique index missing_products_pending_item_idx
  on public.missing_products (
    product_id,
    coalesce(fragrance_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pendente';

commit;
```

- [ ] **Step 2: Verificar que o arquivo não tem erro de sintaxe óbvio**

Este arquivo só será executado de verdade na Task 2 (controller, via `apply_migration`). Nesta task, confirme que o SQL está bem formado lendo o arquivo de volta.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260810120000_missing_products_variations.sql
git commit -m "feat(db): fragrance_id/variation_id em missing_products (não aplicada ainda)"
```

---

### Task 2 (controller): Aplicar migration + regenerar tipos

**Não delega pra subagent** — mudança direta em produção, mesmo padrão usado nas partes anteriores.

- [ ] Aplicar a migration da Task 1 em produção via `apply_migration` (project_id `ccrucholgsffichvzbpz`).
- [ ] Confirmar que as colunas, FKs e o novo índice único existem (`list_tables` ou uma query direta).
- [ ] Regenerar `src/integrations/supabase/types.ts` via `generate_typescript_types` e sobrescrever o arquivo.
- [ ] Rodar `npm run typecheck` pra confirmar que o novo `types.ts` compila.
- [ ] Commit:

```bash
git add supabase/migrations/20260810120000_missing_products_variations.sql src/integrations/supabase/types.ts
git commit -m "chore(db): aplicar migration de fragrância/tamanho e regenerar tipos"
```

---

### Task 3: Atualizar `useMissingProducts.ts`

**Files:**
- Modify: `src/hooks/useMissingProducts.ts`

**Interfaces:**
- Consome: a tabela `missing_products` com as colunas novas (Task 2, já aplicada e nos tipos gerados).
- Produz: `MissingProduct` com `fragrance_id`/`variation_id`; `MissingProductReportItem` com `key`/`fragranceId`/`variationId`; `ReportBatchResult.succeeded`/`failed` passam a ser arrays da `key` do item (não mais do `productId`) — necessário porque agora o mesmo `productId` pode aparecer duas vezes no lote (fragrâncias diferentes), e usar `productId` pra rastrear sucesso/falha misturaria as duas linhas.

- [ ] **Step 1: Atualizar as interfaces**

No topo do arquivo, troque:

```ts
export interface MissingProduct {
  id: string;
  product_id: string;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido';
  reported_by: string | null;
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
```

por:

```ts
export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissingProductReportItem {
  key: string;
  productId: string;
  fragranceId: string | null;
  variationId: string | null;
  stockRemaining: number | null;
}

export interface ReportBatchResult {
  succeeded: string[];
  failed: string[];
}
```

(`ReportBatchResult` não muda de forma — só o que os arrays guardam passa a ser a `key` do item, não mais o `productId`. Isso é responsabilidade de quem preenche o array, tratado no Step 3.)

- [ ] **Step 2: Adicionar um helper pra buscar a linha pendente exata (produto + fragrância + tamanho)**

Logo antes de `const applyIncrement = ...`, adicione:

```ts
  // Busca a linha pendente pro combo exato (produto + fragrância + tamanho).
  // .is() é obrigatório pra comparar com null — .eq('col', null) não funciona
  // no Postgres (null = null nunca é true), então precisa dessa ramificação.
  const findExistingPending = (productId: string, fragranceId: string | null, variationId: string | null) => {
    let query = supabase
      .from('missing_products')
      .select('id, report_count')
      .eq('product_id', productId)
      .eq('status', 'pendente');

    query = fragranceId ? query.eq('fragrance_id', fragranceId) : query.is('fragrance_id', null);
    query = variationId ? query.eq('variation_id', variationId) : query.is('variation_id', null);

    return query.maybeSingle();
  };
```

- [ ] **Step 3: Usar o helper e incluir fragrance_id/variation_id no insert; trocar productId por key no rastreio de sucesso/falha**

Troque o corpo de `reportMissingProducts` (a partir do `for (const item of items) {`) de:

```ts
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
```

por:

```ts
    for (const item of items) {
      try {
        const { data: existing, error: fetchError } = await findExistingPending(
          item.productId,
          item.fragranceId,
          item.variationId
        );

        if (fetchError) throw fetchError;

        if (existing) {
          await applyIncrement(existing.id, existing.report_count, item.stockRemaining, userId, reporterName);
        } else {
          const { error: insertError } = await supabase
            .from('missing_products')
            .insert([
              {
                product_id: item.productId,
                fragrance_id: item.fragranceId,
                variation_id: item.variationId,
                stock_remaining: item.stockRemaining,
                reported_by: userId,
                reported_by_name: reporterName,
              },
            ]);

          if (insertError) {
            // Código 23505 = violação de índice único: outra pessoa criou a
            // linha pendente entre o select acima e este insert (ou o próprio
            // lote tinha duas linhas com o mesmo combo). Busca a linha que
            // acabou de aparecer e trata como reporte de novo, em vez de
            // mostrar erro pro usuário.
            if (insertError.code === '23505') {
              const { data: justCreated, error: refetchError } = await findExistingPending(
                item.productId,
                item.fragranceId,
                item.variationId
              );

              if (refetchError || !justCreated) throw insertError;

              await applyIncrement(justCreated.id, justCreated.report_count, item.stockRemaining, userId, reporterName);
            } else {
              throw insertError;
            }
          }
        }

        succeeded.push(item.key);
      } catch (error) {
        console.error('Error reporting missing product:', error, item);
        failed.push(item.key);
      }
    }
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros. Se der erro sobre `fragrance_id`/`variation_id` não existir no tipo `Database`, o `types.ts` da Task 2 não foi aplicado corretamente neste worktree — pare e avise, não invente um tipo manual pra contornar.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMissingProducts.ts
git commit -m "feat(hooks): fragrância/tamanho em useMissingProducts, rastreio de lote por key"
```

---

### Task 4: Atualizar `MissingProductsManager.tsx`

**Files:**
- Modify: `src/components/MissingProductsManager.tsx`

**Interfaces:**
- Consome: `useMissingProducts`/`MissingProduct`/`MissingProductReportItem` (Task 3). `ProductFragrance`/`ProductVariation` (via `ProductWithVariations.fragrances`/`.variations`, já preenchidos por `useProducts` — confirmado que cada produto já vem com esses arrays montados, nenhuma mudança necessária em `useProducts.ts`). `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` de `@/components/ui/select` (já existente, padrão já usado em outras telas do admin, ex. `PriorityPositionSelect.tsx`).

- [ ] **Step 1: Atualizar `ReportRow` e `emptyRow`**

Troque:

```tsx
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
```

por:

```tsx
interface ReportRow {
  key: string;
  productId: string | null;
  fragranceId: string | null;
  variationId: string | null;
  stockRemaining: string;
}

const emptyRow = (): ReportRow => ({
  key: crypto.randomUUID(),
  productId: null,
  fragranceId: null,
  variationId: null,
  stockRemaining: '',
});
```

- [ ] **Step 2: Adicionar o import do `Select` e simplificar o `ProductPicker` (tira a exclusão de duplicata)**

No topo do arquivo, adicione ao lado dos outros imports de `@/components/ui/...`:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
```

Troque o `ProductPicker` inteiro (interface + componente) de:

```tsx
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
```

por:

```tsx
interface ProductPickerProps {
  products: ProductWithVariations[];
  value: string | null;
  onChange: (productId: string) => void;
}

// Combobox pesquisável — padrão shadcn (Popover + Command). Não tem mais
// exclusão de produto já escolhido em outra linha: com fragrância/tamanho,
// o mesmo produto pode legitimamente aparecer duas vezes no lote (ex: "Ypê
// Rosa" e "Ypê Azul"). Duplicata exata do mesmo combo é resolvida pelo
// índice único do banco (vira incremento, não erro — ver useMissingProducts).
const ProductPicker = ({ products, value, onChange }: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

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
              {products.map((product) => (
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
```

- [ ] **Step 3: Criar o componente `FragranceVariationFields`**

Logo depois do `ProductPicker` (antes de `interface MissingProductsManagerProps`), adicione:

```tsx
interface FragranceVariationFieldsProps {
  product: ProductWithVariations | undefined;
  fragranceId: string | null;
  variationId: string | null;
  onFragranceChange: (fragranceId: string) => void;
  onVariationChange: (variationId: string) => void;
}

// Só renderiza os seletores que fazem sentido pro produto escolhido. Quando
// uma fragrância tem available_literages preenchido, o seletor de Tamanho
// mostra só as variações daquela fragrância; sem fragrância escolhida (ou
// produto sem fragrância), mostra todas as variações do produto.
const FragranceVariationFields = ({
  product,
  fragranceId,
  variationId,
  onFragranceChange,
  onVariationChange,
}: FragranceVariationFieldsProps) => {
  if (!product) return null;

  const fragrances = product.fragrances ?? [];
  const hasFragrances = fragrances.length > 0;

  const allVariations = product.variations ?? [];
  const selectedFragrance = fragrances.find((f) => f.id === fragranceId);
  const availableVariations = selectedFragrance?.available_literages?.length
    ? allVariations.filter((v) => selectedFragrance.available_literages!.includes(v.literage))
    : allVariations;
  const hasVariations = allVariations.length > 0;

  if (!hasFragrances && !hasVariations) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {hasFragrances && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fragrância</Label>
          <Select value={fragranceId ?? undefined} onValueChange={onFragranceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher..." />
            </SelectTrigger>
            <SelectContent>
              {fragrances.map((fragrance) => (
                <SelectItem key={fragrance.id} value={fragrance.id}>
                  {fragrance.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {hasVariations && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tamanho</Label>
          <Select value={variationId ?? undefined} onValueChange={onVariationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher..." />
            </SelectTrigger>
            <SelectContent>
              {availableVariations.map((variation) => (
                <SelectItem key={variation.id} value={variation.id}>
                  {variation.literage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Adicionar `isRowComplete` e trocar a lógica de habilitar o botão "Enviar"**

Logo antes de `const MissingProductsManager = ...`, adicione:

```tsx
// Uma linha com produto escolhido só está "completa" se as fragrâncias/
// tamanhos obrigatórios (quando o produto tem) também foram escolhidos.
const isRowComplete = (row: ReportRow, productById: Map<string, ProductWithVariations>): boolean => {
  if (!row.productId) return false;
  const product = productById.get(row.productId);
  if (!product) return false;
  const needsFragrance = (product.fragrances?.length ?? 0) > 0;
  const needsVariation = (product.variations?.length ?? 0) > 0;
  if (needsFragrance && !row.fragranceId) return false;
  if (needsVariation && !row.variationId) return false;
  return true;
};
```

Dentro de `MissingProductsManager`, troque:

```tsx
  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const productById = new Map(products.map((p) => [p.id, p]));
  const chosenProductIds = rows.map((r) => r.productId).filter((id): id is string => id !== null);
  const hasChosenProduct = chosenProductIds.length > 0;
```

por:

```tsx
  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const productById = new Map(products.map((p) => [p.id, p]));
  const hasChosenProduct = rows.some((row) => row.productId !== null);
  const hasIncompleteRow = rows.some((row) => row.productId !== null && !isRowComplete(row, productById));
```

- [ ] **Step 5: Atualizar `handleSubmit` pra usar `key` em vez de `productId` no rastreio, e incluir fragrância/tamanho**

Troque:

```tsx
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
    } catch {
      // erro já mostrado via toast dentro do hook, ou lançado antes do toast
      // (ex: nome de exibição ainda não carregado) — nesse caso não há toast,
      // mas o botão de enviar já fica desabilitado até o nome carregar.
    } finally {
      setIsSubmitting(false);
    }
  };
```

por:

```tsx
  const handleSubmit = async () => {
    const items: MissingProductReportItem[] = rows
      .filter((row) => row.productId !== null)
      .map((row) => ({
        key: row.key,
        productId: row.productId as string,
        fragranceId: row.fragranceId,
        variationId: row.variationId,
        stockRemaining: toNullableInt(row.stockRemaining),
      }));

    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      const { succeeded } = await reportMissingProducts(items);
      const stillPending = rows.filter((row) => row.productId !== null && !succeeded.includes(row.key));

      if (stillPending.length === 0) {
        setRows([emptyRow()]);
        setIsReportOpen(false);
      } else {
        setRows(stillPending);
      }
    } catch {
      // erro já mostrado via toast dentro do hook, ou lançado antes do toast
      // (ex: nome de exibição ainda não carregado) — nesse caso não há toast,
      // mas o botão de enviar já fica desabilitado até o nome carregar.
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 6: Atualizar o JSX do diálogo — remover `excludeIds`, adicionar `FragranceVariationFields`, ajustar o `disabled` do botão Enviar**

Troque o bloco de cada linha do lote (dentro de `{rows.map((row) => (`) de:

```tsx
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
```

por:

```tsx
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <ProductPicker
                          products={products}
                          value={row.productId}
                          onChange={(productId) =>
                            updateRow(row.key, (r) => ({ ...r, productId, fragranceId: null, variationId: null }))
                          }
                        />
                        <FragranceVariationFields
                          product={row.productId ? productById.get(row.productId) : undefined}
                          fragranceId={row.fragranceId}
                          variationId={row.variationId}
                          onFragranceChange={(fragranceId) =>
                            updateRow(row.key, (r) => ({ ...r, fragranceId, variationId: null }))
                          }
                          onVariationChange={(variationId) => updateRow(row.key, (r) => ({ ...r, variationId }))}
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
```

Troque o botão "Enviar":

```tsx
                <DialogFooter>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !hasChosenProduct || displayNameStatus !== 'ready'}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </DialogFooter>
```

por:

```tsx
                <DialogFooter>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !hasChosenProduct || hasIncompleteRow || displayNameStatus !== 'ready'}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </DialogFooter>
```

- [ ] **Step 7: Mostrar fragrância/tamanho na lista de pendentes**

Troque:

```tsx
            {missingProducts.map((item) => {
              const product = productById.get(item.product_id);
              return (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{product?.name || 'Produto removido'}</p>
```

por:

```tsx
            {missingProducts.map((item) => {
              const product = productById.get(item.product_id);
              const fragranceName = product?.fragrances?.find((f) => f.id === item.fragrance_id)?.name;
              const variationLabel = product?.variations?.find((v) => v.id === item.variation_id)?.literage;
              const detailParts = [fragranceName, variationLabel].filter((part): part is string => Boolean(part));
              const displayName =
                detailParts.length > 0
                  ? `${product?.name ?? 'Produto removido'} — ${detailParts.join(' — ')}`
                  : product?.name || 'Produto removido';
              return (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{displayName}</p>
```

- [ ] **Step 8: Verificar que compila**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/components/MissingProductsManager.tsx
git commit -m "feat(admin): seletor de fragrância/tamanho ao reportar falta"
```

---

### Task 5 (controller): Verificação final e testes manuais

**Files:**
- Nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Typecheck limpo**

Run: `npm run typecheck`
Expected: 0 erros.

- [ ] **Step 2: Subir o servidor de dev e testar manualmente**

Run: `npm run dev`

Roteiro de teste (logado como admin, na tela Faltantes):

1. Reportar falta de um produto **sem** fragrância nem variação cadastrada — formulário igual ao de antes, sem seletores extras, envia normal.
2. Reportar falta de um produto **só com variações** (sem fragrância) — aparece só o seletor "Tamanho", obrigatório. Tentar enviar sem escolher: botão "Enviar" fica desabilitado.
3. Reportar falta de um produto **com fragrâncias e variações** — aparecem os dois seletores. Escolher uma fragrância e confirmar que a lista de "Tamanho" filtra pelas litragens daquela fragrância (se o cadastro tiver essa relação) ou mostra todas (se não tiver).
4. No mesmo lote, adicionar duas linhas do **mesmo produto** com fragrâncias diferentes (ex: "Ypê Rosa" e "Ypê Azul") — confirmar que as duas são aceitas e viram itens pendentes separados na lista.
5. Reportar de novo o **mesmo combo exato** (produto + fragrância + tamanho) de um item já pendente — confirmar que incrementa o contador em vez de duplicar.
6. Confirmar que a lista de pendentes mostra "Produto — Fragrância — Tamanho" nas linhas que têm essa informação, e só o nome nas que não têm.
7. Marcar um dos itens de variação como resolvido — confirmar que funciona normalmente (sem regressão no fluxo já existente).

- [ ] **Step 3: Reportar resultado**

Se algum item do roteiro falhar, corrigir antes de considerar a task concluída. Se tudo passar, seguir pra revisão final de branch inteira (fora do escopo desta task — próxima etapa do processo).
