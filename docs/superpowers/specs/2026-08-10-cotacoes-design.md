# Cotações — captura de preços por IA (Parte D2a) — Spec

## Contexto

A Parte D1 (Faltantes) e a D1.1 (fragrância/tamanho em Faltantes) já estão em produção:
funcionário reporta um item faltando (produto + fragrância + tamanho, quando existirem),
e a lista de pendentes fica visível pra quem resolve compras.

O próximo passo é pedir cotação desses itens pra vários fornecedores ao mesmo tempo,
comparar os preços e gerar os pedidos de compra — esse fluxo completo é a Parte D2. Ele
foi dividido em duas entregas menores:

- **D2a (esta spec)**: criar um lote de itens faltantes, escolher fornecedores, subir o
  arquivo de cotação de cada um (foto/PDF), deixar a IA extrair os preços, revisar e
  confirmar.
- **D2b (depois, spec própria)**: comparar os preços entre fornecedores, escolher
  vencedores por item, gerar o documento do pedido de compra, permitir reatribuir itens
  dinamicamente entre fornecedores, e um chat por lote pra pedir ajustes à IA.

D2a sozinho já entrega valor (substitui "mandar mensagem pro fornecedor e anotar preço
na mão"), e deixa os dados prontos pro D2b consumir depois.

## 1. Modelo de dados

### `quote_batches` (lote de cotação)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `status` | text, check `'aberto'` \| `'cancelado'` | Sem status "concluído" — fechar o lote definitivamente é trabalho do D2b (quando o pedido de compra for gerado) |
| `created_by` | uuid, FK → `auth.users(id)` on delete set null | Mesmo padrão de nullable-on-delete já usado em `missing_products.reported_by` |
| `created_by_name` | text, not null | Denormalizado, mesmo motivo de `missing_products.reported_by_name`: sobrevive à exclusão do usuário |
| `created_at` | timestamptz, default now() | |

### `quote_batch_items`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `quote_batch_id` | uuid, FK → `quote_batches(id)` on delete cascade | |
| `missing_product_id` | uuid, FK → `missing_products(id)` on delete cascade | |
| `created_at` | timestamptz, default now() | |

"Um item só pode estar num lote aberto por vez" não é uma invariante de integridade
referencial (não depende só das colunas desta tabela — depende do `status` da tabela
`quote_batches` relacionada), então não dá pra expressar como índice único parcial
direto. É garantida na camada de aplicação: a tela de criação de lote consulta quais
`missing_product_id` já aparecem em algum `quote_batch_items` cujo `quote_batch_id`
está com `status = 'aberto'`, e desabilita esses itens na seleção; o insert do lote novo
revalida a mesma condição no servidor antes de gravar. Cancelar um lote
(`status = 'cancelado'`) libera os itens automaticamente, já que a consulta de "já em
lote aberto" para de encontrá-los.

### `quote_batch_suppliers`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `quote_batch_id` | uuid, FK → `quote_batches(id)` on delete cascade | |
| `supplier_id` | uuid, FK → `suppliers(id)` on delete cascade | Tabela de Fornecedores da Parte C |
| `status` | text, check `'pendente'` \| `'revisado'` | Default `'pendente'`; marca se alguém já confirmou os preços deste fornecedor pelo menos uma vez |
| `created_at` | timestamptz, default now() | |

Único: `unique (quote_batch_id, supplier_id)` — não faz sentido o mesmo fornecedor
duas vezes no mesmo lote.

### `quote_files`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `quote_batch_supplier_id` | uuid, FK → `quote_batch_suppliers(id)` on delete cascade | |
| `storage_path` | text, not null | Caminho no bucket do Supabase Storage |
| `uploaded_by` | uuid, FK → `auth.users(id)` on delete set null | |
| `uploaded_by_name` | text, not null | Denormalizado, mesmo motivo dos campos acima |
| `processed_at` | timestamptz, nullable | Preenchido quando a extração por IA rodou usando este arquivo; `null` = ainda não processado |
| `created_at` | timestamptz, default now() | |

Guardados permanentemente (não são apagados quando a extração termina nem quando o
fornecedor é revisado).

### `quote_line_items`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `quote_batch_supplier_id` | uuid, FK → `quote_batch_suppliers(id)` on delete cascade | |
| `quote_batch_item_id` | uuid, FK → `quote_batch_items(id)` on delete cascade | |
| `price` | numeric, nullable | Vazio até a IA achar ou alguém preencher na mão |
| `updated_by` | uuid, FK → `auth.users(id)` on delete set null | |
| `updated_by_name` | text, not null | |
| `updated_at` | timestamptz, default now() | |

Único: `unique (quote_batch_supplier_id, quote_batch_item_id)` — uma linha de preço por
combinação fornecedor×item do lote. As linhas são criadas (com `price = null`) assim
que um fornecedor é adicionado ao lote, uma por item já presente no lote naquele
momento; se um item novo for adicionado ao lote depois, uma linha nova é criada pra
cada fornecedor que já estava no lote (e vice-versa: fornecedor novo ganha uma linha
pra cada item já no lote).

### RLS

Mesma regra de acesso em todas as 5 tabelas novas + no bucket de Storage: exige
`has_staff_permission('faltantes') AND has_staff_permission('fornecedores')` pra
qualquer operação (select/insert/update/delete) — é a combinação de permissões que já
protege a tela de Fornecedores (Parte C) e a ação de resolver Faltantes (Parte D1),
reaproveitada sem criar permissão nova.

## 2. Fluxo de telas

### Sidebar

Novo item "Cotações" (ícone de cotação/orçamento), na seção Operação, ao lado de
Fornecedores e Faltantes. Visível só pra quem tem as duas permissões acima.

### Lista de lotes

Mostra os lotes com `status = 'aberto'` (cards ou lista simples: data de criação, quem
criou, quantos itens, quantos fornecedores, quantos já revisados). Um link/filtro
separado mostra o histórico (lotes cancelados) — sem exclusão física, é só filtro de
status.

Botão "Nova cotação" abre a tela de criação.

### Criar lote

1. Lista os itens de Faltantes com `status = 'pendente'`, com checkbox — mesma fonte de
   dados de `MissingProductsManager`, mostrando "Produto — Fragrância — Tamanho" como já
   existe hoje. Itens que já estão em outro lote aberto aparecem desabilitados com uma
   nota "já em cotação".
2. Escolhe um ou mais fornecedores da lista de Fornecedores cadastrados (Parte C).
3. Confirma → cria o `quote_batch`, os `quote_batch_items`, os `quote_batch_suppliers` e
   as `quote_line_items` vazias (produto cartesiano itens × fornecedores escolhidos) —
   e leva pra tela do lote recém-criado.

Precisa de pelo menos 1 item e 1 fornecedor pra criar.

### Tela do lote

- Cabeçalho: data, criador, botão "Cancelar lote" (com confirmação, já que esconde os
  itens da lista de "em cotação" mas não apaga histórico).
- Lista dos itens do lote (só leitura aqui — adicionar/remover item do lote já criado
  fica fora do escopo do D2a; pra mudar o conjunto de itens, cancela e cria de novo).
- Lista dos fornecedores do lote, cada um com status (Pendente / Revisado) e o número de
  itens já com preço preenchido (ex. "3 de 5"). Clicar num fornecedor abre a tela dele.
- Botão "Adicionar fornecedor" — abre um seletor da lista de Fornecedores (excluindo os
  que já estão no lote), adiciona com status `'pendente'` e cria as `quote_line_items`
  vazias pra ele, uma por item já no lote.

### Tela do fornecedor (upload + revisão)

- Área de upload: aceita múltiplos arquivos (imagem ou PDF), cada um vira uma linha em
  `quote_files` associada a este `quote_batch_supplier_id`.
- Botão "Extrair com IA": manda os arquivos com `processed_at is null` pra Edge
  Function, junto com a lista de itens do lote (nomes resolvidos); a function marca
  `processed_at = now()` neles ao terminar. Cada arquivo é processado uma vez só por
  padrão — se quiser repetir a extração de um arquivo específico (ex. a IA errou), um
  botão "Processar de novo" por arquivo limpa o `processed_at` dele antes de rodar. O
  resultado preenche/atualiza o `price` das `quote_line_items` correspondentes — só as
  que a IA achou; as que não achou continuam como estavam (vazias ou com valor
  preenchido manualmente antes, que não é sobrescrito por um "não achei").
- Tabela de revisão: uma linha por item do lote, com o preço (editável, numérico) — a
  IA preenche o que achou, o resto fica vazio pra preencher na mão. Qualquer edição
  salva direto (sem botão "salvar" por campo, autosave on blur, mesmo padrão de UX já
  usado em outras telas do admin).
- Botão "Marcar como revisado": muda `quote_batch_suppliers.status` pra `'revisado'`.
  Não trava os preços — continuam editáveis a qualquer momento, mesmo depois de
  revisado (reabrir/editar de novo simplesmente não muda o status de volta pra
  `'pendente'` automaticamente; é só um indicador de "já dei uma conferida", não um
  lock).

## 3. Extração por IA

- Edge Function nova, ex. `extract-quote-prices`, recebe `quote_batch_supplier_id`.
- Busca os arquivos com `processed_at is null` desse fornecedor no Storage, busca a
  lista de itens do lote (nomes resolvidos: "Produto — Fragrância — Tamanho" ou só
  "Produto" quando não tem variação).
- Chama a API da Claude (Anthropic), passando os arquivos como input de visão (imagem
  ou PDF) num único request, com um prompt pedindo pra casar cada item da lista contra
  o que aparece no(s) arquivo(s), e devolver um JSON estruturado:
  `[{ item: "nome exato da lista", price: number | null }]` — só os itens da lista
  fornecida; qualquer outro produto que apareça no arquivo do fornecedor (ele pode
  vender outras coisas) é ignorado pela IA, não aparece no resultado.
- A function mapeia a resposta de volta pros `quote_batch_item_id` corretos (por nome
  exato) e faz upsert nas `quote_line_items.price` correspondentes, só para os itens com
  `price` não-nulo no resultado.
- `ANTHROPIC_API_KEY` como secret da Edge Function — nunca exposta no client.
- Fallback pro Gemini fica fora do escopo do D2a. A function fica isolada (prompt e
  chamada de API num módulo próprio, separado da lógica de mapeamento pros
  `quote_line_items`), pra trocar de provider depois sem mexer no resto, se precisar.

## 4. Storage de arquivos

- Bucket privado novo no Supabase Storage (ex. `quote-files`).
- RLS do bucket: mesma regra `has_staff_permission('faltantes') AND
  has_staff_permission('fornecedores')`.
- Caminho sugerido: `{quote_batch_supplier_id}/{uuid-do-arquivo}-{nome-original}`.
- Sem limite de quantidade de arquivo por fornecedor; validação de tipo (imagem ou PDF)
  e tamanho máximo no client antes do upload (mesmo padrão do upload de imagem de
  produto já existente no projeto).

## 5. Integração com Faltantes

- `MissingProductsManager.tsx` passa a mostrar um indicador "Em cotação" nos itens que
  aparecem em algum `quote_batch_items` cujo `quote_batch_id` tem `status = 'aberto'`
  (join simples, sem mudar o campo `status` de `missing_products` em si — continua
  `'pendente'`/`'resolvido'` como já é hoje).
- Resolver um item em Faltantes continua funcionando exatamente como hoje,
  independente de estar em cotação ou não — D2a não sincroniza os dois. Decidir se
  resolver automaticamente quando o pedido de compra for gerado é decisão do D2b.
- Cancelar um lote muda `quote_batches.status` pra `'cancelado'` — os itens dele deixam
  de aparecer como "em cotação" (porque a consulta olha só lotes `'aberto'`) e voltam a
  ficar disponíveis pra entrar num lote novo. Nenhuma linha é apagada.

## Fora de escopo (explícito, fica pro D2b)

- Comparar os preços dos fornecedores entre si e escolher vencedores por item.
- Gerar o documento/pedido de compra por fornecedor.
- Reatribuir itens dinamicamente entre fornecedores.
- Chat por lote pra pedir ajustes à IA (ex. "tira o Sr. Carlos, passa os itens dele pro
  próximo colocado").
- Fechar/concluir um lote automaticamente depois de gerar os pedidos (por enquanto só
  existe `'aberto'`/`'cancelado'`).
- Adicionar ou remover item de um lote já criado (só cancela e cria de novo).
- Fallback pro Gemini (arquitetura já deixa preparado, mas não implementado agora).
- Quantidade/embalagem por item cotado — só preço unitário.

## Testes

Sem suíte automatizada (padrão do projeto). Verificação manual:

- `npm run typecheck` limpo.
- Criar um lote com 2+ itens e 1 fornecedor — aparece na lista de lotes abertos.
- Itens do lote somem da lista de seleção ao tentar criar outro lote (aparecem
  desabilitados com "já em cotação").
- Adicionar um segundo fornecedor ao lote já criado — ganha linhas de preço vazias pra
  todos os itens do lote.
- Subir um arquivo de cotação (foto ou PDF) e rodar a extração — preços batem com o que
  está no arquivo, itens que o fornecedor não tem ficam vazios.
- Item que não existe na lista pedida (mas aparece no arquivo do fornecedor) não
  aparece no resultado.
- Editar manualmente um preço (achado pela IA ou vazio) — salva.
- Marcar fornecedor como revisado — status muda, preços continuam editáveis depois.
- Cancelar o lote — itens voltam a aparecer disponíveis em Faltantes (sem indicador "em
  cotação") e disponíveis pra um lote novo.
- Faltantes continua mostrando "Em cotação" nos itens certos e permite resolver
  normalmente mesmo estando em cotação.
