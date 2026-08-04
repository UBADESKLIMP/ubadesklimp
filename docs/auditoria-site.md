# Auditoria — Site Ubadesklimp (como o Lovable construiu)

Levantamento somente-leitura do estado atual deste repo (`Ubadesklimp.com`) e do seu Supabase (`ccrucholgsffichvzbpz`). Nada foi alterado — isto é insumo para decidir a padronização depois.

## 1. Stack e estrutura geral

- Vite + React 18 + TypeScript + shadcn/ui + Tailwind, roteado com `react-router-dom` (`src/App.tsx`).
- Rotas: `/` (Index), `/automotivo`, `/auth`, `/profile`, `/orders`, `/admin` (protegida, `requireAdmin`).
- Dados via `@tanstack/react-query` + cliente Supabase direto em `src/integrations/supabase/client.ts`.
- `src/integrations/supabase/types.ts` é gerado automaticamente (tem o aviso "Do not edit"), mas **não é usado em lugar nenhum do código de produtos** — `useProducts.ts` mantém seus próprios tipos e listas de colunas escritas à mão (ver seção 4).

## 2. Schema do banco (`public`, projeto `ccrucholgsffichvzbpz`)

Tabelas: `products`, `product_variations`, `product_fragrances`, `categories`, `orders`, `profiles`, `user_roles` (+ enum `app_role`: admin/moderator/user).

### `products` é uma tabela única servindo dois domínios bem diferentes

A mesma tabela guarda produtos de **limpeza** e produtos **automotivos**, distinguidos pela coluna `line_type` (`'limpeza' | 'automotivo'`). Reconstruindo a timeline pelas migrations, ela cresceu por acréscimos pontuais, não por um desenho inicial:

| Coluna | Migration que adicionou | Domínio |
|---|---|---|
| `priority`, `priority_order` | 2025-08-21, 2025-08-22 | Destaques (ambos) |
| `has_variations`, `material`, `validity`, `specifications` | 2025-08-22 | Limpeza |
| `has_fragrances` | 2025-09-10 | Limpeza |
| `literage_single`, `out_of_stock` | 2025-10-01 | Limpeza |
| `size_unit`, `display_order` (em `product_variations`) | 2025-10-08 | Ambos |
| `price_position` | 2025-10-16 | Layout/UI |
| `action_type`, `ph_level`, `application_area` | 2026-01-09 | Automotivo |
| `line_type` | 2026-01-12 | Divisor de domínio |
| `display_order` (em `products`) | 2026-01-21 | Ordenação geral |
| `brand` | 2026-01-24 | Ambos |

Resultado hoje: **~20 colunas**, boa parte opcional/nula dependendo do `line_type` do produto (ex.: `ph_level`/`application_area` só fazem sentido pra automotivo; `material`/`validity`/`has_fragrances` só pra limpeza). Não há separação estrutural entre os dois catálogos — é uma tabela "faz-tudo".

### Três mecanismos sobrepostos pra "produto especial"

- `priority` (bool) + `priority_order` (int) — usados na aba "Destaques" do admin.
- `display_order` (int) — ordem geral da vitrine/grid.
- `highlight_type` (`'bestseller' | 'promotion' | 'new' | 'featured' | 'none'`) — outro selo de destaque, conceitualmente sobreposto ao `priority`.

Três sistemas paralelos de "isso aqui é especial", sem um único conceito que os unifique.

### Tabela órfã já removida

`image_urls_backup` foi criada em 2026-03-20 e removida em 2026-03-25 (migrations `20260320125424` e `20260325120943`). Não é mais um problema hoje, mas mostra um padrão arriscado: usar `CREATE TABLE ... backup` via migration ao invés de um dump/snapshot real antes de mudanças destrutivas.

## 3. RLS / políticas — nomenclatura inconsistente

As policies foram escritas em inglês em algumas tabelas e em português em outras, sem convenção única:

- Inglês: `"Everyone can read categories"`, `"Admins can manage categories"`, `"Everyone can read product variations"`, `"Users can view their own orders"`.
- Português: `"Produtos são visíveis para todos"`, `"Admins podem gerenciar produtos"`, `"Admins podem gerenciar roles"`.

Todas convergem para a mesma função `has_role(auth.uid(), 'admin'::app_role)` — a lógica é consistente, só o nome das policies não é.

## 4. Duplicação de tipos / fonte da verdade do schema

- `src/integrations/supabase/types.ts` é o tipo gerado oficial (`Database["public"]["Tables"]["products"]["Row"]`), mas não é importado por `useProducts.ts`.
- `useProducts.ts` define seu próprio `interface Product` (linhas 7–18) que **não reflete o schema real** — falta material, validity, specifications, line_type, brand, todos os campos automotivos etc. Esse tipo não é realmente respeitado no runtime: `createProduct`/`updateProduct` fazem `as any` por cima dele.
- O schema real usado no dia a dia é `ProductWithVariations` (`src/types/product.ts`), um terceiro tipo, mantido manualmente e já levemente desalinhado (`display_order` é lido/gravado pelo hook mas não existe na interface).
- Toda vez que uma coluna é adicionada ao banco, alguém precisa lembrar de atualizar **três lugares à mão**: a string de `.select('id,name,...')` em `useProducts.ts`, o array `allowedKeys` de `sanitizeProductPayload`, e a interface em `types/product.ts`. Isso já causou uma pequena divergência (`display_order` ausente da interface).

## 5. Componentes duplicados para a mesma funcionalidade (drag-and-drop)

Existem dois sistemas paralelos de arrastar-e-soltar para reordenar produtos, com componentes próprios cada um:

- Grid geral: `DraggableAdminGrid.tsx` + `SortableAdminProductCard.tsx` (ordena por `display_order`).
- Destaques: `PriorityProductsManager.tsx` + `SortablePriorityItem.tsx` (ordena por `priority_order`).

Ambos usam `@dnd-kit`, mas a lógica de "lista ordenável" foi implementada duas vezes ao invés de uma vez só parametrizada.

## 6. Autenticação e papéis

- `AuthContext.tsx` expõe `isAdmin()` como uma função assíncrona que faz uma query nova ao Supabase toda vez que é chamada (não fica em cache no estado do contexto).
- Hoje existe só um papel relevante no app: **admin ou não-admin** (via `user_roles`/`app_role`). Isso é mais simples que o modelo Comprador/Operacional que já existe no projeto Compras — será preciso decidir se o `app_role` deste projeto é estendido (`admin`, `comprador`, `operacional`, ...) ou se os dois sistemas de papel convivem separados.

## 7. Convenção de nomes — panorama geral

- Tabelas e a maioria das colunas: inglês (`products`, `categories`, `orders`, `has_fragrances`).
- Valores de dados de negócio: português (`line_type` = `'limpeza' | 'automotivo'`, `size_unit` = `'litros'`).
- Páginas: mistura de idioma nos nomes de arquivo — `Automotivo.tsx`, `Profile.tsx`, `Auth.tsx`, `OrderHistory.tsx` (dois em português, dois em inglês).
- Nenhuma dessas escolhas está documentada como regra — cada arquivo/migration seguiu o instinto de quem escreveu na hora.

## Resumo — pontos que valem decisão consciente antes de "arrumar nome"

1. Separar (ou não) `products` em algo estruturalmente diferente para limpeza vs. automotivo, em vez de colunas opcionais empilhadas.
2. Unificar `priority`/`priority_order`/`highlight_type`/`display_order` num conceito só, ou documentar por que os três coexistem.
3. Escolher **uma** convenção de idioma para nomes de tabela/coluna/policy/arquivo e aplicar dali pra frente.
4. Fazer `useProducts.ts` consumir o tipo gerado (`Database`) em vez de manter 3 cópias manuais do schema.
5. Generalizar o componente de lista ordenável (dnd-kit) em vez de ter dois.
6. Decidir o modelo de papéis definitivo (admin binário vs. admin/comprador/operacional) antes de plugar o Compras.
