# Unificar tipos de dados dos hooks com o schema real do Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar as interfaces de tabela reinventadas à mão em `src/hooks` e `src/types`, substituindo-as pelo tipo gerado do Supabase (`Database`/`Tables<>` em `src/integrations/supabase/types.ts`), e formalizar o formato de item de pedido (`orders.items`) num schema Zod único compartilhado entre escrita (carrinho) e leitura (admin).

**Architecture:** Cada arquivo passa a derivar seu tipo de linha de `Tables<'tabela'>`, com um `Omit<...> & {...}` local só onde o app precisa de um union literal mais estrito que o `string | null` genérico do Postgres (ex.: `line_type`, `type` de categoria). Para a coluna livre `orders.items` (JSON sem schema no Postgres), a fonte da verdade passa a ser `cartItemSchema` (Zod) em `src/lib/validations.ts`, usado tanto por quem grava (`Cart.tsx`/`CartContext.tsx`) quanto por quem lê (`useAdminOrders`, `useSalesStats`, via um parser compartilhado em `src/types/order.ts`).

**Tech Stack:** React + TypeScript + Vite, `@supabase/supabase-js` (cliente já tipado com `Database`), Zod (já é dependência do projeto, usado em `src/lib/validations.ts`).

## Global Constraints

- Não criar nenhuma migration de banco nem alterar RLS — isto é uma refatoração só de tipos/código.
- Não adicionar nenhuma dependência nova (Zod, react-hook-form, etc. já estão no projeto).
- Não existe suíte de testes automatizados neste repositório — a verificação de cada tarefa é `npm run typecheck` (roda `tsc --noEmit -p tsconfig.app.json`, script novo adicionado na Task 1) e, na tarefa final, um smoke test manual no navegador. **Importante:** `npm run build` (Vite/SWC) NÃO faz checagem de tipo nenhuma — só transpila — então não serve como verificação aqui, apesar do nome sugestivo. Note também que este projeto tem `strict: false` e `strictNullChecks: false` no `tsconfig.app.json`, então incompatibilidades de nulidade (`string | null` vs. `string | undefined`) não necessariamente viram erro de compilação — mas incompatibilidades estruturais (ex.: passar um objeto onde `ReactNode`/`string`/`number` é esperado) continuam sendo pegas normalmente.
- Strings visíveis ao usuário (toasts, labels) continuam em português, seguindo o padrão já usado em todo o repositório.
- Cada tarefa termina com commit próprio.

---

### Task 1: `src/types/product.ts` — derivar tipos de produto do schema gerado

**Files:**
- Modify: `src/types/product.ts` (reescrita completa, 55 linhas hoje)

**Interfaces:**
- Produces: `ProductRow` (linha crua da tabela `products`, com `line_type`/`size_unit`/`price_position`/`highlight_type` estreitados para os unions literais que o app usa), `ProductVariation`, `ProductFragrance`, `ProductWithVariations` — todos re-exportados com os mesmos nomes de hoje, para não quebrar os ~15 arquivos que já importam daqui.

- [ ] **Step 1: Reescrever o arquivo**

```ts
import { Tables } from '@/integrations/supabase/types';

export type ProductRow = Omit<
  Tables<'products'>,
  'line_type' | 'size_unit' | 'price_position' | 'highlight_type'
> & {
  line_type: 'limpeza' | 'automotivo' | null;
  size_unit: 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades' | null;
  price_position: 'below_image' | 'below_text' | null;
  highlight_type: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
};

export type ProductVariation = Tables<'product_variations'>;

export interface ProductFragrance {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  available_literages?: string[]; // Quais litragens estão disponíveis para esta fragrância
  order?: number; // Para ordenação das fragrâncias (mapeado de order_index no banco)
}

export interface ProductWithVariations extends ProductRow {
  fragrances?: ProductFragrance[];
  variations: ProductVariation[];
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: o build ainda vai FALHAR neste ponto (outros arquivos ainda usam o `ProductWithVariations` antigo com campos opcionais que agora são `| null`, e `useProducts.ts` ainda declara sua própria `Product` local) — isso é esperado, as próximas tarefas corrigem cada consumidor. Confira que os erros reportados são só em `src/hooks/useProducts.ts`, `src/hooks/usePriorityProducts.ts` e possivelmente componentes de produto — não deve haver erro de sintaxe dentro do próprio `src/types/product.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/product.ts
git commit -m "refactor(types): derive product types from generated Supabase schema"
```

---

### Task 2: `src/hooks/useProducts.ts` — usar `ProductRow` em vez da interface `Product` local

**Files:**
- Modify: `src/hooks/useProducts.ts:1-20` (import + remoção da interface `Product`), `:24-56` (`sanitizeProductPayload`), `:148,176` (assinaturas de `createProduct`/`updateProduct`)

**Interfaces:**
- Consumes: `ProductRow` de `@/types/product` (Task 1).
- Produces: `createProduct(data: Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>)`, `updateProduct(id, data: Partial<Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>>)` — mesma forma de chamada de antes (quem chama já passa objetos soltos/`any`), só o tipo interno muda.

- [ ] **Step 1: Trocar o import e remover a interface `Product`**

Substituir as linhas 1–18:

```ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProductRow, ProductWithVariations } from '@/types/product';

export const useProducts = () => {
```

(remove a interface `Product` inteira — ela estava desatualizada frente ao schema real e não era respeitada em runtime).

- [ ] **Step 2: Tipar `allowedKeys` contra o schema real**

Substituir a função `sanitizeProductPayload` (linhas 24–56 no arquivo atual):

```ts
  type ProductInsertable = Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>;

  // Sanitize payload to only include columns that exist in 'products' table.
  // Tipar allowedKeys contra ProductInsertable faz um nome de coluna errado
  // virar erro de compilação em vez de falha silenciosa em runtime.
  const sanitizeProductPayload = (data: any) => {
    if (!data) return {};
    const allowedKeys: (keyof ProductInsertable)[] = [
      'name',
      'description',
      'price',
      'category',
      'image_url',
      'priority',
      'priority_order',
      'has_variations',
      'has_fragrances',
      'highlight_type',
      'material',
      'validity',
      'specifications',
      'literage_single',
      'out_of_stock',
      'size_unit',
      'price_position',
      'action_type',
      'ph_level',
      'application_area',
      'line_type',
      'brand',
      'display_order',
    ];
    const payload: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in data) payload[key] = (data as any)[key];
    }
    return payload;
  };
```

(`display_order` foi incluído — antes não estava na lista de `allowedKeys`, então reordenar produtos via `updateProduct` genérico silenciosamente ignorava esse campo; hoje só funciona porque `updateDisplayOrder` faz um `.update({ display_order })` direto, fora do sanitize).

- [ ] **Step 3: Atualizar as assinaturas de `createProduct`/`updateProduct`**

Trocar (linha ~148):
```ts
  const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
```
por:
```ts
  const createProduct = async (productData: ProductInsertable) => {
```

Trocar (linha ~176):
```ts
  const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) => {
```
por:
```ts
  const updateProduct = async (id: string, productData: Partial<ProductInsertable>) => {
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: erros relacionados a `useProducts.ts` desaparecem. Podem sobrar erros em outros consumidores de `ProductWithVariations` (componentes) — não corrija esses aqui, ficam para a Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProducts.ts
git commit -m "refactor(hooks): type useProducts against generated ProductRow schema"
```

---

### Task 3: `src/hooks/useCategories.ts` — usar `Tables<'categories'>`

**Files:**
- Modify: `src/hooks/useCategories.ts:1-11`

**Interfaces:**
- Produces: `Category` (mesmo shape público de antes: `id`, `name`, `type: 'limpeza' | 'automotivo' | null`, `created_at`, `updated_at`).

- [ ] **Step 1: Trocar a interface por um tipo derivado**

Substituir linhas 1–11:

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

export type Category = Omit<Tables<'categories'>, 'type'> & {
  type: 'limpeza' | 'automotivo' | null;
};
```

O resto do arquivo (`fetchCategories`, `createCategory`, `updateCategory`, `deleteCategory`) não muda — já faz `data as Category[]` / `data as Category`, o que continua válido.

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `useCategories.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCategories.ts
git commit -m "refactor(hooks): type useCategories against generated schema"
```

---

### Task 4: `src/hooks/usePriorityProducts.ts` — usar `Pick<ProductRow, ...>`

**Files:**
- Modify: `src/hooks/usePriorityProducts.ts:1-13` (tipo), `:126-135` (`getNextAvailablePosition`), `:119-123` (`getOccupiedPositions`)

**Interfaces:**
- Consumes: `ProductRow` de `@/types/product` (Task 1).
- Produces: `PriorityProduct` com os mesmos 8 campos de antes.

- [ ] **Step 1: Trocar a interface local por um `Pick`**

Substituir linhas 1–13:

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductRow } from '@/types/product';

export type PriorityProduct = Pick<
  ProductRow,
  'id' | 'name' | 'image_url' | 'priority_order' | 'highlight_type' | 'line_type' | 'category' | 'price'
>;
```

`ProductRow['priority_order']` é `number | null` (a coluna é nullable no banco, mesmo tendo default 0) — os dois pontos abaixo usavam esse campo assumindo que nunca era nulo e precisam de um fallback.

- [ ] **Step 2: Corrigir `getNextAvailablePosition`**

Trocar (linha ~133):
```ts
    const maxOrder = Math.max(...filtered.map(p => p.priority_order));
```
por:
```ts
    const maxOrder = Math.max(...filtered.map(p => p.priority_order ?? 0));
```

- [ ] **Step 3: Corrigir `getOccupiedPositions`**

Trocar (linhas 119–123):
```ts
  const getOccupiedPositions = (excludeProductId?: string): number[] => {
    return priorityProducts
      .filter(p => p.id !== excludeProductId)
      .map(p => p.priority_order);
  };
```
por:
```ts
  const getOccupiedPositions = (excludeProductId?: string): number[] => {
    return priorityProducts
      .filter(p => p.id !== excludeProductId)
      .map(p => p.priority_order ?? 0);
  };
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `usePriorityProducts.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePriorityProducts.ts
git commit -m "refactor(hooks): type usePriorityProducts against generated ProductRow"
```

---

### Task 5: `src/hooks/useProfile.ts` — usar `Tables<'profiles'>`

**Files:**
- Modify: `src/hooks/useProfile.ts:1-24`

**Interfaces:**
- Produces: `Profile` (mesmo shape público, mas com nulabilidade real do banco em vez de campos `?:` otimistas).

- [ ] **Step 1: Trocar a interface por um tipo derivado**

Substituir linhas 1–24:

```ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

export type Profile = Omit<Tables<'profiles'>, 'person_type'> & {
  person_type: 'pf' | 'pj' | null;
};
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `useProfile.ts`. Se `src/pages/Profile.tsx` ou `src/components/OrderForm.tsx` quebrarem por causa de `person_type` agora aceitar `null`, isso fica registrado para a Task 13 (não corrija aqui).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfile.ts
git commit -m "refactor(hooks): type useProfile against generated schema"
```

---

### Task 6: `src/lib/validations.ts` — adicionar `cartItemSchema`

**Files:**
- Modify: `src/lib/validations.ts` (adicionar import + schema + type export, sem remover nada existente)

**Interfaces:**
- Consumes: `ProductVariation`, `ProductFragrance` de `@/types/product` (Task 1).
- Produces: `cartItemSchema` (Zod), `CartItem` (`z.infer<typeof cartItemSchema>`) — usados pelas Tasks 7, 8, 9.

- [ ] **Step 1: Adicionar o import no topo do arquivo**

Depois de `import { z } from 'zod';` (linha 1), adicionar:

```ts
import type { ProductVariation, ProductFragrance } from '@/types/product';
```

- [ ] **Step 2: Adicionar o schema**

No fim do arquivo, antes da seção de `export type ... = z.infer<...>` (linha 142), adicionar:

```ts
// Validação de item do carrinho / pedido — espelha exatamente as regras que
// isValidCartItem já aplicava em CartContext.tsx antes desta unificação,
// incluindo a tolerância a price como string (carrinhos antigos salvos no
// localStorage antes do preço virar number).
export const cartItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  quantity: z.number().finite().min(1),
  price: z.union([z.number().finite().min(0), z.string().trim().min(1)]),
  productId: z.string().optional(),
  image_url: z.string().optional(),
  variation: z.custom<ProductVariation>().optional(),
  fragrance: z.custom<ProductFragrance>().optional(),
});
```

- [ ] **Step 3: Exportar o tipo inferido**

Junto com os outros `export type ... = z.infer<...>` no fim do arquivo (perto da linha 145), adicionar:

```ts
export type CartItem = z.infer<typeof cartItemSchema>;
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: build passa sem novo erro (este arquivo só ganhou exports novos, nada foi removido).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts
git commit -m "feat(validations): add shared cartItemSchema for order items"
```

---

### Task 7: `src/contexts/CartContext.tsx` — usar `CartItem`/`cartItemSchema` compartilhados

**Files:**
- Modify: `src/contexts/CartContext.tsx:1-14` (imports + remoção da interface local), `:198-215` (`isValidCartItem`)

**Interfaces:**
- Consumes: `cartItemSchema`, `CartItem` de `@/lib/validations` (Task 6).

- [ ] **Step 1: Trocar os imports e remover a interface `CartItem` local**

Substituir linhas 1–14:

```ts
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ProductVariation, ProductFragrance } from '@/types/product';
import { cartItemSchema, type CartItem } from '@/lib/validations';

export type { CartItem };

interface CartState {
  items: CartItem[];
  total: number;
}
```

(o `export type { CartItem }` mantém `import { CartItem } from '@/contexts/CartContext'` funcionando nos arquivos que já importam daqui, sem precisar caçar e trocar cada import espalhado pelo resto do app).

- [ ] **Step 2: Reescrever `isValidCartItem` usando o schema compartilhado**

Substituir (linhas 198–215):

```ts
// Validar se um item do carrinho tem todos os campos obrigatórios
const isValidCartItem = (item: unknown): item is CartItem => {
  return cartItemSchema.safeParse(item).success;
};
```

`validateCartState`, logo abaixo, não muda — já chama `isValidCartItem` internamente.

- [ ] **Step 3: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `CartContext.tsx`.

- [ ] **Step 4: Smoke test manual rápido**

Rodar `npm run dev`, abrir o site, adicionar um produto ao carrinho, e confirmar no DevTools (`Application > Local Storage > ubadesk_cart`) que o item foi salvo normalmente. Isso confirma que `cartItemSchema` aceita o formato real que `addToCart` já produz.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/CartContext.tsx
git commit -m "refactor(cart): validate CartItem through shared cartItemSchema"
```

---

### Task 8: `src/components/Cart.tsx` — gravar `items` validado pelo schema compartilhado

**Files:**
- Modify: `src/components/Cart.tsx:1-24` (imports), `:38-48` (`orderPayload`)

**Interfaces:**
- Consumes: `cartItemSchema` de `@/lib/validations` (Task 6), `Json` de `@/integrations/supabase/types`.

- [ ] **Step 1: Adicionar os imports**

Depois de `import { supabase } from '@/integrations/supabase/client';` (linha 23), adicionar:

```ts
import { cartItemSchema } from '@/lib/validations';
import type { Json } from '@/integrations/supabase/types';
```

- [ ] **Step 2: Trocar a montagem de `items` no `orderPayload`**

Trocar (linha 44):
```ts
        items: JSON.parse(JSON.stringify(state.items)) as any,
```
por:
```ts
        items: cartItemSchema.array().parse(state.items) as unknown as Json,
```

`cartItemSchema.array().parse(...)` já devolve uma cópia de dados simples (equivalente ao round-trip `JSON.parse(JSON.stringify(...))` de antes), validando o formato no processo — se algum item não bater com o schema, o erro aparece aqui, antes de ir pro banco, em vez de silenciosamente virar lixo em `orders.items`.

- [ ] **Step 3: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `Cart.tsx`.

- [ ] **Step 4: Smoke test manual**

Com `npm run dev` rodando: adicionar um produto ao carrinho (incluindo um com variação e um com fragrância, se o catálogo tiver), abrir o carrinho, finalizar pelo WhatsApp. Confirmar que não aparece o toast de erro "Não foi possível salvar o pedido" e que o pedido aparece na tabela `orders` do Supabase com `items` preenchido.

- [ ] **Step 5: Commit**

```bash
git add src/components/Cart.tsx
git commit -m "refactor(cart): validate order items with cartItemSchema before insert"
```

---

### Task 9: `src/types/order.ts` (novo) — tipo de pedido + parser tolerante a dado legado

**Files:**
- Create: `src/types/order.ts`

**Interfaces:**
- Consumes: `cartItemSchema`, `CartItem` de `@/lib/validations` (Task 6).
- Produces: `OrderRow`, `OrderItem`, `UnrecognizedOrderItem`, `parseOrderItems(raw: Json, orderId: string): OrderItem[]` — usados pelas Tasks 10 e 12.

- [ ] **Step 1: Criar o arquivo**

```ts
import { cartItemSchema, type CartItem } from '@/lib/validations';
import type { Tables, Json } from '@/integrations/supabase/types';

export type OrderRow = Tables<'orders'>;

// Um item de orders.items que não bateu com cartItemSchema (pedido gravado
// antes desse schema existir, ou dado corrompido). Os campos opcionais que
// CartItem também tem ficam como `undefined` aqui, pra quem consome OrderItem
// não precisar de narrowing pra acessá-los.
export interface UnrecognizedOrderItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  productId?: undefined;
  image_url?: undefined;
  variation?: undefined;
  fragrance?: undefined;
  unrecognized: true;
}

export type OrderItem = CartItem | UnrecognizedOrderItem;

/**
 * Converte o JSON livre de orders.items numa lista tipada. Itens que não
 * batem com cartItemSchema (pedidos antigos, dado corrompido) viram um
 * placeholder "Item não reconhecido" em vez de quebrar a tela ou sumir —
 * mesma filosofia que validateCartState já usa pro localStorage do carrinho.
 */
export const parseOrderItems = (raw: Json, orderId: string): OrderItem[] => {
  if (!Array.isArray(raw)) {
    if (raw !== null && raw !== undefined) {
      console.warn(`Pedido ${orderId}: campo items não é uma lista, ignorando.`);
    }
    return [];
  }

  return raw.map((rawItem, index) => {
    const result = cartItemSchema.safeParse(rawItem);
    if (result.success) return result.data;

    console.warn(`Pedido ${orderId}: item ${index} não reconhecido`, result.error.flatten());

    const obj = rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    const quantity = typeof obj.quantity === 'number' && Number.isFinite(obj.quantity) ? obj.quantity : 0;
    const price = typeof obj.price === 'number' && Number.isFinite(obj.price) ? obj.price : 0;

    return {
      id: typeof obj.id === 'string' ? obj.id : `unrecognized-${orderId}-${index}`,
      name: 'Item não reconhecido',
      category: '',
      quantity,
      price,
      unrecognized: true as const,
    };
  });
};
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck`
Expected: sem erro — este arquivo ainda não é importado por ninguém, então só precisa compilar sozinho.

- [ ] **Step 3: Commit**

```bash
git add src/types/order.ts
git commit -m "feat(types): add OrderRow type and parseOrderItems helper"
```

---

### Task 10: `src/hooks/useAdminOrders.ts` — usar `OrderRow`/`parseOrderItems`

**Files:**
- Modify: `src/hooks/useAdminOrders.ts:1-17` (imports + tipo `Order`), `:60-64` (atribuição de `orders`)

**Interfaces:**
- Consumes: `OrderRow`, `OrderItem`, `parseOrderItems` de `@/types/order` (Task 9).
- Produces: `Order` (agora `Omit<OrderRow, 'items'> & { items: OrderItem[] }`), consumido pela Task 11 (`OrdersManager.tsx`).

- [ ] **Step 1: Trocar imports e a interface `Order`**

Substituir linhas 1–17:

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OrderRow, type OrderItem, parseOrderItems } from '@/types/order';

export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export type Order = Omit<OrderRow, 'items'> & { items: OrderItem[] };

const ORDERS_PER_PAGE = 10;
```

- [ ] **Step 2: Parsear `items` ao guardar no estado**

Trocar (linhas 60–64):
```ts
      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setOrders(data || []);
```
por:
```ts
      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setOrders((data || []).map((order) => ({
        ...order,
        items: parseOrderItems(order.items, order.id),
      })));
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `useAdminOrders.ts`. Deve aparecer erro em `src/components/OrdersManager.tsx` (esperado — corrigido na Task 11).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdminOrders.ts
git commit -m "refactor(hooks): type useAdminOrders items via parseOrderItems"
```

---

### Task 11: `src/components/OrdersManager.tsx` — corrigir renderização de `variation`/`fragrance`

Esta tarefa corrige um bug real que a Task 10 vai expor no compilador: o código hoje tenta renderizar `item.variation` e `item.fragrance` diretamente como texto (`{item.variation}`), mas esses campos sempre foram objetos (`ProductVariation`/`ProductFragrance`, com `.literage`/`.name`), nunca strings. Até agora isso não quebrava só porque `items` era `any` — qualquer pedido salvo com variação ou fragrância selecionada faria essa tela tentar renderizar um objeto cru como filho do React.

**Files:**
- Modify: `src/components/OrdersManager.tsx:184-187` (tipo local de `items`), `:257,270-282` (bloco de renderização dos itens)

**Interfaces:**
- Consumes: `Order` (agora tipado) de `@/hooks/useAdminOrders` (Task 10) — sem mudança de import, já é importado via `useAdminOrders`.

- [ ] **Step 1: Remover o array-guard manual, já garantido pelo tipo**

Trocar (linhas 184–187):
```ts
                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const items = Array.isArray(order.items) ? order.items : [];
                    
```
por:
```ts
                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const items = order.items;

```

- [ ] **Step 2: Corrigir a renderização de variation/fragrance**

Trocar (linhas 257, 270–282):
```ts
                                      items.map((item: any, index: number) => (
```
por:
```ts
                                      items.map((item, index) => (
```

E trocar o bloco de nome/variação/fragrância (linhas 270–282):
```ts
                                            <div>
                                              <p className="font-medium">{item.name}</p>
                                              {item.variation && (
                                                <p className="text-xs text-muted-foreground">
                                                  {item.variation}
                                                </p>
                                              )}
                                              {item.fragrance && (
                                                <p className="text-xs text-muted-foreground">
                                                  Fragrância: {item.fragrance}
                                                </p>
                                              )}
                                            </div>
```
por:
```ts
                                            <div>
                                              <p className="font-medium">{item.name}</p>
                                              {item.variation && (
                                                <p className="text-xs text-muted-foreground">
                                                  {item.variation.literage}
                                                </p>
                                              )}
                                              {item.fragrance && (
                                                <p className="text-xs text-muted-foreground">
                                                  Fragrância: {item.fragrance.name}
                                                </p>
                                              )}
                                            </div>
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `OrdersManager.tsx`.

- [ ] **Step 4: Smoke test manual — o caso que motivou a correção**

Com `npm run dev` rodando e logado como admin: abrir `/admin`, aba "Pedidos", expandir um pedido que tenha um item com variação ou fragrância selecionada (criar um pedido de teste pelo carrinho se não houver nenhum). Confirmar que aparece a litragem/nome da fragrância como texto — não `[object Object]` e sem a tela quebrar.

- [ ] **Step 5: Commit**

```bash
git add src/components/OrdersManager.tsx
git commit -m "fix(admin): render variation/fragrance name instead of raw object in order items"
```

---

### Task 12: `src/hooks/useSalesStats.ts` — usar `OrderRow`/`parseOrderItems`

**Files:**
- Modify: `src/hooks/useSalesStats.ts:1-47` (imports + tipos locais removidos), `:80-86` (parse de `items`), `:104-131` (agrupamento por produto)

**Interfaces:**
- Consumes: `OrderRow`, `OrderItem`, `parseOrderItems` de `@/types/order` (Task 9).

- [ ] **Step 1: Trocar imports e remover `OrderItem`/`Order` locais**

Substituir linhas 1–47 (mantém `ProductSales`, `SalesStats` e `parsePrice`, remove só `OrderItem` e `Order`):

```ts
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type OrderRow, type OrderItem, parseOrderItems } from '@/types/order';

type Order = Pick<OrderRow, 'id' | 'total_amount' | 'status' | 'created_at'> & {
  items: OrderItem[];
};

interface ProductSales {
  productId: string;
  name: string;
  category: string;
  image_url?: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface SalesStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  productsSold: ProductSales[];
  salesByDay: { date: string; revenue: number; orders: number }[];
  salesByMonth: { month: string; revenue: number; orders: number }[];
}

const parsePrice = (price: number | string): number => {
  if (typeof price === 'number') return price;
  const cleaned = price.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};
```

- [ ] **Step 2: Parsear `items` ao guardar no estado**

Trocar (linhas 80–86):
```ts
      // Parse items JSON
      const parsedOrders = (data || []).map((order) => ({
        ...order,
        items: (order.items as unknown as OrderItem[]) || []
      }));

      setOrders(parsedOrders);
```
por:
```ts
      const parsedOrders = (data || []).map((order) => ({
        ...order,
        items: parseOrderItems(order.items, order.id),
      }));

      setOrders(parsedOrders);
```

- [ ] **Step 3: Corrigir o agrupamento por produto**

`item.productId` agora é `string | undefined` (era `string` obrigatório na interface antiga, mas nunca foi de fato garantido — o próprio `Cart.tsx` já tem lógica pra tentar achar o produto pelo nome quando `productId` falta). Trocar (linhas 106–131):
```ts
    validOrders.forEach((order) => {
      order.items.forEach((item) => {
        // Apply category filter if specified
        if (categoryFilter && item.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
          return;
        }

        const existing = productSalesMap.get(item.productId);
        const itemPrice = parsePrice(item.price);
        const itemRevenue = itemPrice * item.quantity;

        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += itemRevenue;
        } else {
          productSalesMap.set(item.productId, {
            productId: item.productId,
            name: item.name,
            category: item.category,
            image_url: item.image_url,
            totalQuantity: item.quantity,
            totalRevenue: itemRevenue
          });
        }
      });
    });
```
por:
```ts
    validOrders.forEach((order) => {
      order.items.forEach((item) => {
        // Apply category filter if specified
        if (categoryFilter && item.category.toLowerCase() !== categoryFilter.toLowerCase()) {
          return;
        }

        // productId pode faltar (itens antigos de carrinho identificavam o
        // produto só pelo nome) — cai pro id do próprio item do pedido nesse caso.
        const productKey = item.productId ?? item.id;
        const existing = productSalesMap.get(productKey);
        const itemPrice = parsePrice(item.price);
        const itemRevenue = itemPrice * item.quantity;

        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalRevenue += itemRevenue;
        } else {
          productSalesMap.set(productKey, {
            productId: productKey,
            name: item.name,
            category: item.category,
            image_url: item.image_url,
            totalQuantity: item.quantity,
            totalRevenue: itemRevenue
          });
        }
      });
    });
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck`
Expected: sem novos erros originados em `useSalesStats.ts`.

- [ ] **Step 5: Smoke test manual**

Com `npm run dev` rodando e logado como admin: abrir `/admin`, aba "Dashboard", conferir que "Produtos Mais Vendidos" e os gráficos de vendas continuam mostrando os mesmos números de antes da mudança (comparar mentalmente com o que se via antes de começar este plano, ou com a aba "Pedidos").

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSalesStats.ts
git commit -m "refactor(hooks): type useSalesStats items via parseOrderItems"
```

---

### Task 13: Build completo + smoke test final

Agora que todos os hooks/tipos-fonte foram trocados, esta tarefa fecha o build inteiro (inclusive os componentes consumidores que não foram tocados diretamente nas tarefas anteriores — `ProductForm.tsx`, `ProductCard.tsx`, `ProductDetailModal.tsx`, `AutomotiveProductsManager.tsx`, `SortableAdminProductCard.tsx`, `PriorityProductsManager.tsx`, `CategoryManager.tsx`, `ProductVariationsSection.tsx`, `ProductFragrancesSection.tsx`, `src/pages/Profile.tsx`, `src/components/OrderForm.tsx`) e faz a varredura manual completa combinada no spec.

**Files:**
- Modify: qualquer arquivo que `npm run build` apontar com erro de tipo remanescente (nulabilidade `| null` vs. `?:` opcional é a causa mais provável — resolva com `?.`/`??`, seguindo o padrão já usado nos arquivos das tarefas anteriores).

- [ ] **Step 1: Build limpo**

Run: `npm run typecheck`
Expected: exit code 0, zero erros de TypeScript. Se aparecer erro num componente não coberto pelas tarefas 1–12, ajuste esse componente pontualmente (o padrão é sempre o mesmo: campo que era `string | undefined` agora é `string | null`, então troque a checagem/fallback pra aceitar `null` também) e rode `npm run build` de novo até zerar.

- [ ] **Step 2: Smoke test — fluxo de cliente**

Com `npm run dev`: adicionar ao carrinho um produto sem variação, um produto com variação (trocar a litragem) e, se houver, um produto com fragrância (trocar a fragrância) → abrir o carrinho e conferir preços/imagens → finalizar pelo WhatsApp.

- [ ] **Step 3: Smoke test — fluxo de admin**

Logado como admin em `/admin`: aba "Produtos", editar um produto existente e salvar → aba "Destaques", reordenar (drag and drop) e confirmar que a ordem persiste ao recarregar → aba "Pedidos", expandir o pedido criado no Step 2 e conferir que os itens (inclusive variação/fragrância) aparecem certos → aba "Dashboard", conferir que o pedido novo aparece nas estatísticas.

- [ ] **Step 4: Conferir um pedido antigo de produção**

Abrir a aba "Pedidos" e expandir pelo menos um pedido criado antes desta mudança (dado real de produção). Confirmar que ele continua aparecendo — se algum item dele não bater com `cartItemSchema`, deve aparecer como "Item não reconhecido" em vez de quebrar a tela ou sumir da lista. Checar o console do navegador por um `console.warn` correspondente.

- [ ] **Step 5: Commit final (se o Step 1 exigiu ajustes em componentes)**

```bash
git add -A
git commit -m "fix: resolve remaining type errors from Supabase schema type migration"
```
