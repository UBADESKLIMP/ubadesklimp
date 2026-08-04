# Unificar tipos de dados dos hooks com o schema real do Supabase

## Contexto

Auditoria em `docs/auditoria-site.md` encontrou que nenhum hook de `src/hooks` usa o tipo gerado do Supabase (`src/integrations/supabase/types.ts`, `Database`). Seis hooks (`useProducts`, `useAdminOrders`, `useSalesStats`, `useCategories`, `usePriorityProducts`, `useProfile`) declaram interfaces próprias que reimplementam à mão o formato de cada tabela. Isso já causou divergência real: `useAdminOrders.ts` e `useSalesStats.ts` definem duas interfaces `Order` diferentes e incompatíveis para a mesma tabela `orders`, com o campo `items` tipado de dois jeitos (`any` vs. `OrderItem[]` local). `Cart.tsx`, que grava esse campo, também não usa nenhum tipo validado (`JSON.parse(JSON.stringify(state.items)) as any`).

Este é o primeiro de uma série de passos de padronização do site (ver `docs/auditoria-site.md`), escolhido por ser o de menor risco: não toca em schema de banco, RLS, nem em comportamento visível ao cliente — é só correção da camada de tipos em código.

Outros hooks (`useProductVariations`, `useBrands`) já usam o padrão correto — dependem do tipo inferido pelo cliente Supabase tipado (`createClient<Database>` em `src/integrations/supabase/client.ts`) sem reinventar interface — e servem de referência para o padrão a seguir.

Este repositório não tem suíte de testes automatizados.

## Escopo

**Dentro do escopo:**
- `src/types/product.ts` — `ProductVariation`, `ProductFragrance`, `ProductWithVariations` passam a derivar de `Tables<'product_variations'>`, `Tables<'product_fragrances'>` e `Tables<'products'>`.
- `src/hooks/useProducts.ts` — remove a interface `Product` local (hoje desatualizada frente ao schema real) e o array `allowedKeys` de `sanitizeProductPayload` vira um tipo derivado (`Omit<Tables<'products'>, 'id' | 'created_at' | 'updated_at'>`) em vez de uma lista mantida à mão.
- `src/hooks/useCategories.ts` — `Category` vira `Tables<'categories'>`.
- `src/hooks/usePriorityProducts.ts` — `PriorityProduct` vira um recorte (`Pick`) de `Tables<'products'>`.
- `src/hooks/useProfile.ts` — `Profile` vira `Tables<'profiles'>`.
- `src/hooks/useAdminOrders.ts` e `src/hooks/useSalesStats.ts` — as duas interfaces `Order` divergentes são substituídas por uma só, baseada em `Tables<'orders'>`, com `items` tipado via o schema Zod compartilhado descrito abaixo (não mais `any` nem uma interface `OrderItem` própria).
- `src/lib/validations.ts` — ganha `cartItemSchema` (Zod), a definição única do formato de um item de pedido.
- `src/contexts/CartContext.tsx` — `CartItem` passa a ser `z.infer<typeof cartItemSchema>`, e a validação manual hoje existente (`isValidCartItem`, `validateCartState`) passa a usar esse schema em vez de checagens de campo escritas à mão.
- `src/components/Cart.tsx` — a gravação de `items` no pedido passa a usar o mesmo schema compartilhado em vez de `JSON.parse(JSON.stringify(...)) as any`.

**Fora do escopo (fica para as próximas etapas combinadas em `docs/auditoria-site.md`):**
- Qualquer migração de banco (schema de `products`, RLS, colunas).
- Unificação de `priority`/`display_order`/`highlight_type`.
- Deduplicação dos componentes de drag-and-drop.
- Migração para react-query ou qualquer outra reestruturação da camada de fetch.
- Qualquer trabalho relacionado ao projeto Compras.

## Arquitetura

O tipo gerado `Database` (em `types.ts`) já expõe helpers (`Tables<'nome_da_tabela'>`) para o formato exato de cada linha de tabela, incluindo nulabilidade real (`string | null`, não `string | undefined`). Hoje as interfaces manuais usam `campo?: string` (opcional/undefined) onde o banco na verdade devolve `null` para campo vazio — essa troca corrige essa imprecisão como efeito colateral, não como escopo à parte.

Fluxo de dados não muda: os hooks continuam fazendo fetch direto via `supabase.from(...).select(...)` e devolvendo estado local via `useState`/`useEffect`, como já fazem hoje. A mudança é só de onde vem a definição de tipo de cada linha — do `Database` gerado, não de uma interface escrita à mão.

Para `orders.items` (coluna `Json` livre no banco, sem tipo estruturado do lado do Postgres), a fonte da verdade passa a ser um schema Zod único (`cartItemSchema`) em vez de uma interface TypeScript solta:

```ts
// src/lib/validations.ts
export const cartItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  quantity: z.number().min(1).finite(),
  price: z.union([z.number().min(0).finite(), z.string().trim().min(1)]),
  productId: z.string().optional(),
  image_url: z.string().optional(),
  variation: z.any().optional(),
  fragrance: z.any().optional(),
});
export type CartItem = z.infer<typeof cartItemSchema>;
```

Isso espelha exatamente as regras que `isValidCartItem` já aplica hoje em `CartContext.tsx` (inclusive a tolerância a `price` como `string`, herdada de carrinhos antigos no localStorage) — não é uma regra nova, é a regra existente formalizada num único lugar. `variation`/`fragrance` continuam frouxos (`z.any()`) porque a validação atual também não desce nesse nível de detalhe.

`CartItem` deixa de ser declarado à mão em `CartContext.tsx` e passa a ser `z.infer<typeof cartItemSchema>`, importado de `lib/validations.ts`. `isValidCartItem`/`validateCartState` passam a usar `cartItemSchema.safeParse` internamente em vez da checagem campo a campo manual — mesmo comportamento, uma fonte a menos pra manter sincronizada.

## Tratamento de erro / dados legados

`orders.items` no banco de produção tem pedidos gravados antes desse schema existir. Ao ler (`useAdminOrders`, `useSalesStats`), cada pedido usa `cartItemSchema.array().safeParse(row.items)`:
- Sucesso → usa os itens tipados normalmente.
- Falha → o pedido continua aparecendo na lista (não desaparece, não quebra a tela), mas os itens que não bateram com o schema são substituídos por um placeholder "Item não reconhecido" (mantendo `quantity`/`price` quando dá pra extrair, senão zerado) e um `console.warn` é emitido com o `order.id` afetado, pro problema ficar rastreável sem virar erro visível pro admin.

Essa é a mesma filosofia que `validateCartState` já usa hoje para o localStorage (filtra o que não é válido, avisa no console, não quebra a UI) — só estendida pra leitura do banco.

## Testes

Não há suíte automatizada neste repositório. Verificação:

1. `npm run build` após cada arquivo alterado — qualquer incompatibilidade de tipo (ex.: um componente que hoje assume `campo === undefined` onde o tipo gerado diz `campo: string | null`) aparece como erro de `tsc` e é corrigida no componente afetado.
2. Smoke test manual em `npm run dev`, cobrindo o caminho que passa por todos os arquivos tocados: adicionar item ao carrinho (com e sem variação/fragrância) → finalizar pedido → conferir na aba "Pedidos" do admin → conferir números na aba "Dashboard" → editar um produto na aba "Produtos" → reordenar a aba "Destaques".
3. Conferir manualmente pelo menos um pedido antigo já existente na tabela `orders` de produção, pra validar o fallback "Item não reconhecido" contra dado real (não só um caso hipotético).
