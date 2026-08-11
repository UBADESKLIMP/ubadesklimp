# Cotações — comparação, pedido de compra e reatribuição por IA (Parte D2b) — Spec

## Contexto

A Parte D2a (já em produção) cobre criar um lote de cotação, escolher fornecedores,
subir arquivos de cotação e deixar a IA (Gemini) extrair os preços por fornecedor. O
que ficou fora de escopo, listado explicitamente na spec do D2a, é esta parte:

- Comparar os preços entre fornecedores e escolher vencedor por item.
- Gerar o pedido de compra (mensagem WhatsApp + PDF) por fornecedor vencedor.
- Reatribuir itens dinamicamente entre fornecedores (manual e por comando de IA).
- Fechar o lote e resolver os itens de Faltantes correspondentes.

## 1. Modelo de dados

### `quote_batch_items` — novo campo

| Campo | Tipo | Descrição |
|---|---|---|
| `quantity` | integer, not null, default 1, check `quantity > 0` | Quantidade a comprar desse item. Perguntada na tela de criação do lote (D2a), junto da seleção de itens. Linhas existentes (criadas antes desta parte) recebem `1` via `DEFAULT` da migração. |

### `quote_batches` — novo status e campos de conclusão

- `status` passa a aceitar `'aberto' | 'cancelado' | 'concluido'` (era só os dois
  primeiros).
- Novos campos: `completed_at` (timestamptz, nullable), `completed_by` (uuid, FK →
  `auth.users(id)` on delete set null, nullable), `completed_by_name` (text,
  nullable) — mesmo padrão denormalizado das outras colunas `_by_name` do módulo,
  preenchidos só quando o lote é concluído (gerar pedido de compra).

### Nova tabela `quote_item_winners`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `quote_batch_item_id` | uuid, FK → `quote_batch_items(id)` on delete cascade, **unique** | Um vencedor por item — o `unique` é a própria garantia de integridade. |
| `quote_batch_supplier_id` | uuid, FK → `quote_batch_suppliers(id)` on delete cascade | O fornecedor vencedor. |
| `source` | text, check `'auto'` \| `'manual'` \| `'ia'` | Como esse vencedor foi definido — só informativo (mostrado no log da tela), não muda o comportamento. |
| `set_by` | uuid, FK → `auth.users(id)` on delete set null, nullable | |
| `set_by_name` | text, not null | |
| `set_at` | timestamptz, default now() | |

RLS: mesma regra das outras 5 tabelas do módulo — `has_staff_permission('faltantes')
AND has_staff_permission('fornecedores')` pra select/insert/update/delete.

Não existe fluxo de remover fornecedor de um lote (D2a não tem essa ação), então não
há necessidade de tratar "vencedor apontando pra fornecedor removido" — a FK com
cascade já cobre o caso de cancelamento do lote inteiro.

## 2. Tela de Comparação

Novo componente, acessado pela tela do lote (D2a) através de um botão "Comparar e
gerar pedido" — visível quando `quote_batches.status = 'aberto'`. Lotes
`'concluido'` mostram a mesma tela em modo somente leitura (histórico do que foi
decidido); lotes `'cancelado'` não têm esse botão.

### Tabela comparativa

- Uma linha por item do lote (nome resolvido "Produto — Fragrância — Tamanho" +
  quantidade), uma coluna por fornecedor do lote, célula = preço unitário cotado
  (`quote_line_items.price`) ou "—" quando nulo.
- **Inicialização automática**: ao abrir a tela pela primeira vez, todo item que
  ainda não tem linha em `quote_item_winners` recebe uma automaticamente — o
  fornecedor de menor preço não nulo pra aquele item, `source = 'auto'`. Item sem
  nenhum preço cotado por nenhum fornecedor fica sem vencedor (não tem o que
  escolher).
- A célula do vencedor atual de cada linha é destacada (badge estilo "carimbo" —
  ver padrão visual do projeto, cor de acento `#0F6B5C`).
- Clicar numa célula com preço (de um fornecedor que não é o vencedor atual) troca o
  vencedor daquele item — upsert em `quote_item_winners` com `source = 'manual'`.
- Rodapé: subtotal por fornecedor = soma de (preço × quantidade) de todo item onde
  esse fornecedor é o vencedor atual.

### Chat de reatribuição por IA

- Campo de texto + botão "Aplicar" — cada comando é independente (sem histórico de
  conversa; a IA só enxerga o estado atual do lote a cada chamada).
- Exemplos de comando: "tira o Sr. Carlos, passa os itens dele pro próximo
  colocado", "dá o item X pro fornecedor Y".
- Escopo do comando: só reatribuição de vencedor **entre fornecedores já presentes
  no lote** — não cria fornecedor novo, não edita preço, não edita quantidade, não
  remove fornecedor do lote.
- Um log local (só nesta sessão de tela, não persistido) mostra o resultado de cada
  comando aplicado (quantos itens reatribuídos, quantos ignorados por serem
  inválidos).

### Botão "Gerar pedidos de compra"

- Habilitado só quando todo item do lote tem um vencedor definido.
- Confirmação explícita antes de agir (mesmo padrão de "Cancelar lote" do D2a) —
  avisando que fecha o lote e marca os itens de Faltantes como resolvidos; não tem
  desfazer nesta entrega.
- Ao confirmar:
  1. Agrupa os itens por `quote_batch_supplier_id` vencedor.
  2. Marca `quote_batches.status = 'concluido'`, preenche `completed_at`,
     `completed_by`, `completed_by_name`.
  3. Marca `missing_products.status = 'resolvido'` pra todo `missing_product_id`
     ligado a algum `quote_batch_items` deste lote (mesma operação que
     `resolveMissingProduct` já faz hoje em Faltantes, aplicada em lote).
  4. Pra cada fornecedor com pelo menos um item vencedor, mostra um card com:
     - Botão WhatsApp: link `wa.me` (mesma função `buildWhatsAppLink` já usada em
       `SupplierManager.tsx`) com mensagem pré-formatada listando item, quantidade,
       preço unitário e subtotal por item, mais o total do pedido.
     - Botão "Baixar PDF": gera no navegador (biblioteca `jsPDF`, sem Edge Function
       nova) um documento simples — nome do fornecedor, data, tabela de itens
       (nome, quantidade, preço unitário, subtotal), total geral. Sem
       logotipo/identidade visual da empresa nesta entrega.

## 3. Reatribuição por IA — Edge Function `apply-quote-reassignment`

- Mesmo padrão de autenticação/autorização da `extract-quote-prices`: valida o JWT
  do chamador, confere `staff_permissions` (`faltantes` E `fornecedores`) via
  service role.
- Recebe `{ quoteBatchId: string, command: string }`.
- Monta o estado atual do lote pro prompt: lista de itens (nome resolvido,
  quantidade), lista de fornecedores (nome da empresa), matriz de preços por
  item×fornecedor, vencedor atual de cada item.
- Chama a API do Gemini (`gemini-3.5-flash`, mesmos parâmetros de `thinkingConfig`
  e tratamento de erro/cota já usados na `extract-quote-prices`) pedindo um array
  JSON de reatribuições: `[{"item": "<nome exato>", "supplier": "<nome exato da
  empresa>"}]`.
- Validação antes de aplicar cada reatribuição sugerida: o item precisa existir
  neste lote, o fornecedor precisa existir neste lote, e o fornecedor precisa ter
  um preço não nulo pra esse item (não dá pra declarar vencedor quem não cotou).
  Sugestões inválidas são descartadas e contam pro total de "ignoradas" na
  resposta.
- Reatribuições válidas são aplicadas via upsert em `quote_item_winners`
  (`source = 'ia'`, `set_by` = quem chamou, `set_by_name` = nome de exibição).
- Resposta: `{ applied: number, skipped: number }` — o client monta a mensagem do
  log a partir disso.

## 4. Fora de escopo (explícito)

- Desfazer um lote já concluído (reabrir, gerar pedido de novo).
- Remover fornecedor de um lote já criado.
- Editar preço ou quantidade via comando de chat (só reatribuição de vencedor).
- Histórico de comandos de chat entre sessões/telas (é só um log local da tela
  atual).
- Logotipo ou identidade visual da empresa no PDF gerado.
- Enviar a mensagem de WhatsApp automaticamente (o botão abre o `wa.me` com a
  mensagem pronta; quem envia é a pessoa, como já é o padrão do projeto).

## Testes

Sem suíte automatizada (padrão do projeto). Verificação manual:

- `npm run typecheck` limpo.
- Migração aplicada em produção, RLS conferida na tabela nova.
- Criar lote com quantidade por item (campo novo na tela do D2a).
- Abrir a tela de Comparação de um lote com preços de 2+ fornecedores — vencedor
  automático é sempre o de menor preço.
- Clicar noutra célula muda o vencedor manualmente.
- Comando de chat tipo "tira o fornecedor X" reatribui os itens dele pro segundo
  colocado; comando inválido (fornecedor ou item inexistente no lote) é ignorado e
  reportado.
- Item sem nenhum preço cotado não deixa habilitar "Gerar pedidos de compra" até
  ganhar um vencedor manual (impossível — precisa de pelo menos um preço; nesse
  caso o lote fica bloqueado até algum fornecedor cotar esse item ou ele ser
  removido, o que está fora de escopo — anotar como limitação conhecida).
- Gerar pedidos de compra: lote muda pra `concluido`, itens de Faltantes
  correspondentes somem da lista de pendentes, aparece um card por fornecedor
  vencedor com WhatsApp funcionando (número certo, mensagem com itens/preços
  batendo) e PDF baixável com os mesmos dados.
- Lote concluído reabre em modo somente leitura ao ser acessado depois.
