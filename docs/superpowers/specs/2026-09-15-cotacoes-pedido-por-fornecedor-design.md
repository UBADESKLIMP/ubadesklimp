# Cotações — pedido por fornecedor, editar/excluir preço, quantidade editável (Parte D2c) — Spec

## Contexto

A Parte D2b (spec `2026-08-11-cotacoes-comparacao-pedido-design.md`, em produção) já
cobre a tela de comparação de preços e geração de pedido de compra, mas com uma
limitação anotada explicitamente naquela spec como conhecida:

> Item sem nenhum preço cotado não deixa habilitar "Gerar pedidos de compra" [...]
> nesse caso o lote fica bloqueado até algum fornecedor cotar esse item.

Na prática isso travou o uso real: um lote com 145 itens e 13 fornecedores tem, a
qualquer momento, dezenas de itens ainda sem nenhuma cotação — e o botão único
"tudo ou nada" nunca libera, mesmo com vários fornecedores já prontos pra receber
pedido. Esta parte (D2c) resolve isso trocando o botão único por geração de pedido
**por fornecedor**, e aproveita pra fechar três lacunas que o uso real revelou:
quantidade não editável na comparação, impossível corrigir um preço digitado errado,
e impossível descartar um preço claramente errado sem apagar o histórico.

## 1. Modelo de dados

### `quote_line_items` — excluir preço da disputa

| Campo | Tipo | Descrição |
|---|---|---|
| `excluded_at` | timestamptz, nullable | Quando o preço foi excluído da comparação. `null` = preço válido, entra na disputa normalmente. |
| `excluded_by` | uuid, FK → `staff_members(user_id)` on delete set null, nullable | |
| `excluded_by_name` | text, nullable | |

Preço excluído continua no banco (nunca é apagado) — só passa a ser ignorado no
cálculo de "mais barato" e não pode ser escolhido como vencedor enquanto excluído.
Reversível: reexcluir com `excluded_at = null` restaura.

### `quote_batch_suppliers` — pedido gerado por fornecedor

| Campo | Tipo | Descrição |
|---|---|---|
| `order_generated_at` | timestamptz, nullable | Quando o pedido desse fornecedor foi gerado pela primeira vez. `null` = ainda não gerado. |
| `order_generated_by` | uuid, FK → `staff_members(user_id)` on delete set null, nullable | |
| `order_generated_by_name` | text, nullable | |

Clicar em "Gerar pedido" de novo depois (reenviar) não limpa esses campos — eles
marcam só a primeira geração, pra saber que aquele fornecedor já está "em
andamento".

### `missing_products` — novo status `pedido_enviado`

Segue o padrão da migração `20260827140000_missing_products_cancelado.sql`:

```sql
alter table public.missing_products drop constraint missing_products_status_check;
alter table public.missing_products add constraint missing_products_status_check
  check (status = any (array['pendente'::text, 'resolvido'::text, 'cancelado'::text, 'pedido_enviado'::text]));

alter table public.missing_products
  add column order_sent_at timestamptz,
  add column order_sent_by uuid references public.staff_members(user_id) on delete set null;
```

Sem campo de referência ao fornecedor/lote aqui — a tela de "Aguardando
confirmação" descobre isso via join (`missing_products.id` →
`quote_batch_items.missing_product_id` → `quote_item_winners` →
`quote_batch_suppliers` → `suppliers`).

### `quote_batches` — sem novo status

`'concluido'` passa a significar **"arquivado"**, não mais "pedido gerado" (isso
agora é por fornecedor). Botão da tela troca de "Gerar pedidos de compra" pra
"Arquivar lote". Arquivar só grava `completed_at/completed_by/completed_by_name` —
**não** mexe em `missing_products` (diferença chave em relação ao D2b: fechar o
lote não resolve mais nada em Faltantes, isso passou a acontecer por fornecedor, no
momento de gerar o pedido dele).

## 2. Tela de Comparação — mudanças

### Quantidade editável

Cada linha da tabela ganha um campo numérico editável (onde hoje só mostra
`{quantity}x`), gravando direto em `quote_batch_items.quantity` ao perder o foco.
Entra no cálculo de subtotal por fornecedor e no pedido final, como já acontece
hoje.

### Excluir preço de uma célula

Ícone "×" pequeno, visível ao passar o mouse numa célula com preço. Clicar:
`update quote_line_items set excluded_at = now(), excluded_by, excluded_by_name`.
Célula excluída mostra o preço riscado/acinzentado com um ícone de desfazer no
lugar do "×" (`excluded_at = null` reverte). Preço excluído:

- Não entra no cálculo de "mais barato" (auto-winner).
- Não pode ser clicado pra virar vencedor manual enquanto excluído.
- Se **já era o vencedor atual** do item, dispara reatribuição imediata pro próximo
  mais barato entre os não-excluídos (mesma lógica do auto-winner, `source =
  'auto'`), **independente de como o vencedor tinha sido definido antes** — um
  preço excluído não é mais válido, não faz sentido manter alguém apontando pra
  ele. Se não sobrar nenhum preço válido, o item fica sem vencedor (mesmo
  comportamento de item nunca cotado).

### Editar preço de uma célula

Ícone de lápis pequeno, visível ao passar o mouse numa célula com preço (não
aparece em célula excluída — precisa desfazer a exclusão primeiro pra editar).
Clicar abre um input numérico inline; salvar faz o mesmo `update quote_line_items
set price, updated_by, updated_by_name` que a tela de revisão do fornecedor
(`useQuoteSupplierReview.ts`) já usa hoje — mesmo padrão, reaproveitado.

Célula com preço editado ganha um badge próprio, cor azul, texto "Editado" —
visualmente distinto do verde "Mais barato" e do amarelo "Manual" (que indicam o
motivo do item ter aquele vencedor, um eixo diferente de "esse preço foi
corrigido"). Os dois badges podem aparecer juntos na mesma célula quando se aplica.

Salvar a edição recarrega os dados do lote (mesmo `refetch()` já disparado após
outras mutações da tela), o que reavalia o vencedor automático normalmente — se o
preço editado passou a ser o mais barato, ou deixou de ser, o vencedor `'auto'` se
ajusta sozinho como já acontece hoje quando um fornecedor manda preço novo.

### Cards "Gerar pedido" por fornecedor (substitui o botão único)

Pra cada fornecedor do lote, calcula os itens onde ele é vencedor atual e o preço
não está excluído. Se esse conjunto não é vazio e todo item nele tem preço válido
(sempre verdade, já que só vira vencedor com preço válido), mostra um card:

- "Fornecedor X — N item(ns) — Total R$ Y"
- Botão "Gerar pedido" (com confirmação, mesmo padrão do AlertDialog atual). Ao
  confirmar:
  1. Se `order_generated_at` ainda é `null`, grava
     `order_generated_at/by/by_name` nesse `quote_batch_suppliers`.
  2. Marca `missing_products.status = 'pedido_enviado'`,
     `order_sent_at = now()`, `order_sent_by` pra todo `missing_product_id`
     ligado a um item vencedor desse fornecedor (via `quote_batch_items`).
  3. Mostra os botões WhatsApp (`buildWhatsAppLink` + `buildPurchaseOrderMessage`)
     e "Baixar PDF" (`downloadPurchaseOrderPdf`) — já existentes, sem mudança de
     conteúdo, só passam a ficar disponíveis por fornecedor a qualquer momento
     (antes só apareciam depois do lote inteiro "concluido").
- Depois de gerado uma vez (`order_generated_at` não nulo), o card continua visível
  com os mesmos botões (reenviar/rebaixar de novo é permitido, não precisa
  confirmação de novo) e um texto pequeno "Pedido gerado em `<data>`".

Itens sem vencedor (nenhum fornecedor cotou, ou todos excluídos) não aparecem em
nenhum card — continuam pendentes na tabela até algum fornecedor cotar ou uma
exclusão ser desfeita.

### Botão "Arquivar lote"

Substitui "Gerar pedidos de compra". Disponível a qualquer momento com
`batchStatus === 'aberto'`, sem depender de todo item ter vencedor. Confirmação
avisando que os itens ainda sem vencedor continuam pendentes em Faltantes
normalmente (nada muda pra eles) — o lote só some da lista de lotes abertos.

## 3. Faltantes — aba "Aguardando confirmação"

`MissingProductsManager.tsx` ganha duas abas (a existente vira "Pendente"):

- **Pendente** (atual, sem mudança): `status = 'pendente'`.
- **Aguardando confirmação** (nova): `status = 'pedido_enviado'`, ordenado por
  `order_sent_at desc`. Cada linha mostra produto + quantidade + fornecedor pro
  qual foi pedido (via join) + data do pedido. Duas ações:
  - **"Confirmar recebido"** → `status = 'resolvido'`, `resolved_at`,
    `resolved_by` (mesma mutação que já existe em `resolveMissingProduct`).
  - **"Fornecedor não tinha"** → `status = 'pendente'`, limpa `order_sent_at` e
    `order_sent_by` — item volta a aparecer na aba Pendente, disponível pra entrar
    num lote de cotação novo.

Sem aba de histórico pra `resolvido`/`cancelado` nesta entrega (não fazia parte do
pedido, fora de escopo).

## 4. Fora de escopo (explícito)

- Editar preço/quantidade por comando de chat (IA continua só reatribuindo
  vencedor entre fornecedores já cotados, sem mudar).
- Reabrir/desfazer um pedido já gerado por fornecedor (o "Fornecedor não tinha" em
  Faltantes cobre o caso de a compra não se confirmar, sem precisar desfazer o
  pedido em si).
- Notificação/lembrete automático pra itens parados há muito tempo em "Aguardando
  confirmação".
- Histórico/listagem de itens `resolvido` ou `cancelado` em Faltantes.
- Múltiplas exclusões/edições em lote (uma célula por vez).

## Testes

Sem suíte automatizada (padrão do projeto). Verificação manual:

- `npm run typecheck` limpo.
- Migração aplicada em produção; conferir os 3 lotes existentes continuam
  acessíveis (principalmente o lote aberto com 145 itens).
- Editar quantidade de um item na tabela — reflete no subtotal e no pedido final.
- Excluir o preço do vencedor atual de um item — reatribui pro próximo mais barato
  automaticamente; se não sobra nenhum, item fica sem vencedor.
- Desfazer uma exclusão — preço volta a valer, pode ser escolhido de novo.
- Editar um preço — grava, badge "Editado" aparece, recalcula "mais barato" se
  necessário.
- No lote real de 145 itens: fornecedores com todos os itens deles prontos mostram
  card "Gerar pedido" mesmo com os outros 81 itens ainda sem cotação.
- Gerar pedido de um fornecedor — WhatsApp/PDF corretos (quantidade e preço
  batendo), itens dele saem de Faltantes/Pendente e aparecem em
  Faltantes/Aguardando confirmação.
- "Confirmar recebido" e "Fornecedor não tinha" na aba Aguardando confirmação —
  cada um leva o item pro status certo.
- Arquivar lote com itens ainda sem vencedor — não altera esses itens em Faltantes.
