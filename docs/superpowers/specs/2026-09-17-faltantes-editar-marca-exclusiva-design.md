# Faltantes — editar item, marca exclusiva por fornecedor (Parte D3) — Spec

## Contexto

Depois de usar a Parte D2c em produção, três lacunas apareceram:

1. Não dá pra corrigir um item já reportado em Faltantes (produto, fragrância,
   tamanho, quantidade restante) — só dá pra criar, resolver ou cancelar.
2. Várias marcas só são compradas de um fornecedor específico (ex: Yoma só do
   fornecedor Yoma, Azulim e Start só do fornecedor Start, e o mesmo vale pra
   marcas automotivas como Bugatti, Dub Boyz, Vonix). Hoje esses itens entram
   na lista de Faltantes misturados com todo o resto e, se fossem pro fluxo
   normal de cotação, passariam por uma comparação de preço que não faz
   sentido (só existe 1 fornecedor possível).
3. Ao mesmo tempo, a atribuição de "pra qual fornecedor foi esse pedido" (aba
   Aguardando confirmação, D2c) é frágil: hoje vem de um cruzamento
   `quote_batch_items → quote_item_winners → quote_batch_suppliers →
   suppliers`, que erra se o mesmo item foi cotado em mais de um lote ao longo
   do tempo. Esta parte troca isso por um campo gravado direto no momento do
   pedido, e reaproveita esse mesmo campo pro novo fluxo de marca exclusiva.

## 1. Modelo de dados

### Nova tabela `supplier_exclusive_brands`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `supplier_id` | uuid, FK → `suppliers(id)` on delete cascade | |
| `brand` | text, not null | Nome da marca exatamente como aparece em `products.brand`. |
| `created_at` | timestamptz, default now() | |

Índice único em `lower(unaccent(brand))` — uma marca só pode ser exclusiva de
um fornecedor por vez (cadastrar a mesma marca de novo noutro fornecedor
substitui, nunca duplica). RLS: mesma policy de `suppliers` (`is_staff_admin()
or has_staff_permission('fornecedores')`, `for all`).

### `missing_products` — novos campos

| Campo | Tipo | Descrição |
|---|---|---|
| `order_supplier_name` | text, nullable | Nome do fornecedor pro qual o pedido foi enviado — gravado no momento de marcar `pedido_enviado`, tanto pelo fluxo de cotação (`generateSupplierOrder`) quanto pelo novo fluxo direto (marca exclusiva). Substitui o cruzamento via `quote_batch_items` usado até agora na aba "Aguardando confirmação". |
| `order_quantity` | integer, nullable, check `order_quantity > 0` | Quantidade a pedir, usada só no fluxo direto de marca exclusiva (o fluxo de cotação já tem quantidade própria em `quote_batch_items.quantity`). Editável na aba nova antes de mandar o pedido; pode ficar em branco (mensagem manda "quantidade a combinar" nesse caso). |

`useQuoteBatchComparison.ts`'s `generateSupplierOrder` passa a gravar
`order_supplier_name = supplier.company_name` (ou `company_name (contact_name)`,
mesmo formato já usado em outros lugares da tela) junto com `order_sent_at`/
`order_sent_by`. `useMissingProducts.ts`'s `fetchOrderedProducts` troca o
cruzamento de 3 tabelas por um simples `select` de `order_supplier_name` —
menos código, sem a ambiguidade de multi-lote.

## 2. Parte 1 — Editar item de Faltantes

Botão "Editar" (ícone lápis) em cada linha da aba Pendente. Editar não mexe em
preço nem fornecedor, só corrige o que foi reportado — mesmo gate de quem
pode reportar (`staffAccess.isAdmin || staffAccess.permissions.has('faltantes')`),
não o gate mais restrito de resolver (`canResolve`, que exige também
`fornecedores`). Abre um diálogo igual ao de
"Reportar falta" (reaproveita `ProductPicker` e `FragranceVariationFields`),
mas com um item só, pré-preenchido com produto/fragrância/tamanho/"quantos
ainda tem" atuais.

Salvar faz um `update` direto na linha (`product_id`, `fragrance_id`,
`variation_id`, `stock_remaining`) — não cria linha nova, não mexe em
`report_count`/`status`. Se a combinação nova colidir com outra linha
pendente já existente (índice único `missing_products_pending_item_idx`), a
tela mostra um erro claro ("já existe uma faltante pendente pra esse mesmo
produto — resolva o conflito antes de editar") em vez de deixar o Postgres
devolver um 23505 cru. Sem merge automático aqui (diferente do que existe em
"Fornecedor não tinha") — é uma ação deliberada da pessoa editando, ela decide
o que fazer com o conflito.

## 3. Parte 2 — Cadastro de marca exclusiva (tela Fornecedores)

`SupplierFormFields` ganha um campo "Marcas exclusivas": input de texto +
botão "Adicionar" que empilha a marca digitada numa lista de badges
removíveis (mesma UX de tag-list, sem componente novo — só JSX). Ao salvar
(criar ou editar fornecedor), grava a lista inteira em
`supplier_exclusive_brands` pra aquele fornecedor: apaga todas as marcas
anteriores dele e insere a lista atual (substituição completa, mesmo padrão
já usado em `updatePermissions` de Funcionários).

Um novo hook `useExclusiveBrands()` concentra leitura (lista completa,
usada tanto aqui quanto em Faltantes) e escrita
(`setSupplierBrands(supplierId, brands: string[])`).

## 4. Parte 3 — Aba "Fornecedor exclusivo" em Faltantes

Terceira aba em `MissingProductsManager.tsx`, entre "Pendente" e "Aguardando
confirmação". Um item pendente cujo produto tem uma marca (`products.brand`,
comparado via `normalizeText` pra ignorar acento/caixa) presente em
`supplier_exclusive_brands` sai da aba Pendente e aparece aqui — partição,
não duplicação (um item nunca aparece nas duas abas ao mesmo tempo).

Itens agrupados por fornecedor exclusivo (um bloco por fornecedor, cabeçalho
com o nome dele). Cada item do bloco mostra: nome do produto/fragrância/
tamanho, "X restando" (`stock_remaining`, somente leitura, mesmo texto de
hoje), e um campo de quantidade editável (`order_quantity`, grava direto no
blur, mesmo padrão de UX da quantidade editável em Comparação de preços).

Cada bloco de fornecedor tem um botão "Enviar pedido" que:

1. Monta a mensagem de WhatsApp (nova função `buildDirectOrderMessage`,
   parecida com `buildPurchaseOrderMessage` mas sem preço — não teve
   cotação): `• {quantidade}x {nome}` quando `order_quantity` está
   preenchido, `• {nome} (quantidade a combinar)` quando não está.
2. Abre o link `wa.me` desse fornecedor com a mensagem pronta
   (`buildWhatsAppLink`, já existente).
3. Marca todo item do bloco como `status = 'pedido_enviado'`,
   `order_sent_at`, `order_sent_by`, `order_supplier_name = <nome do
   fornecedor>` — mesmo status usado pelo fluxo de cotação, cai na mesma aba
   "Aguardando confirmação" já existente, com "Confirmar recebido"/
   "Fornecedor não tinha" funcionando igual.

Sem confirmação extra antes de enviar (mesmo padrão de "Marcar como
resolvido", que também não tem `window.confirm`) — clicar já é a
confirmação.

O botão "Enviar pedido" (e o campo de quantidade editável) só aparece pra
quem tem `canResolve` (`faltantes` + `fornecedores`) — mesmo gate da aba
"Aguardando confirmação" e do fluxo de cotação, já que é uma ação de compra.
Quem só tem `faltantes` ainda vê a aba e os itens agrupados por fornecedor
(útil pra saber o que está parado), só não vê o botão de enviar nem o campo
de quantidade.

## 5. Fora de escopo (explícito)

- Editar item já em "Aguardando confirmação" ou "Fornecedor exclusivo" (só
  itens ainda pendentes são editáveis).
- Merge automático de conflito ao editar (diferente do fluxo de reverter
  pedido) — só mostra erro.
- Marca exclusiva "parcial" (ex: um fornecedor pra uns tamanhos da marca, outro
  pra outros) — é sempre marca inteira → 1 fornecedor.
- Reordenar/priorizar blocos de fornecedor na aba nova (ordem alfabética por
  nome do fornecedor, sem drag-and-drop nem prioridade manual).

## Testes

Sem suíte automatizada (padrão do projeto). Verificação manual:

- `npm run typecheck` limpo.
- Migração aplicada; `supplier_exclusive_brands` e as 2 colunas novas de
  `missing_products` confirmadas via `execute_sql`.
- Editar um item pendente (trocar fragrância) — grava, não cria linha nova.
- Editar um item pra uma combinação que já existe pendente — mostra erro
  claro, não deixa salvar.
- Cadastrar marca exclusiva num fornecedor, reportar um produto dessa marca
  como faltante — item aparece na aba "Fornecedor exclusivo", não em
  "Pendente".
- Editar quantidade de um item na aba nova, mandar pedido — WhatsApp abre com
  a mensagem certa (com e sem quantidade preenchida), item some de
  "Fornecedor exclusivo" e aparece em "Aguardando confirmação" com o nome do
  fornecedor certo.
- Gerar pedido pelo fluxo normal de cotação (D2c) — nome do fornecedor em
  "Aguardando confirmação" continua correto, agora via `order_supplier_name`
  em vez do cruzamento antigo.
