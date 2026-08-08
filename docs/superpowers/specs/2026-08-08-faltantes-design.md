# Faltantes — Registro e Lista (Parte D1) — Spec

## Contexto

Quarto (e último) sub-projeto do redesign do admin (A. Papéis/permissões ✅ → B. Visual/nav ✅ → C. Fornecedores ✅ → **D. Faltantes**). As três partes anteriores já estão em produção.

O item "Faltantes" já aparece na sidebar (grupo Operação), marcado "em breve". A permissão `faltantes` já existe no enum `staff_permission` desde a Parte A, mas ainda não tem nenhuma tela por trás dela.

Esta parte (D1) cobre o fluxo básico: funcionário reporta que um produto está acabando/faltando, e quem tem acesso mais amplo vê essa lista consolidada e pode marcar como resolvido.

**D1 não inclui** o fluxo de cotação (selecionar itens pendentes → gerar mensagem → coletar preços de vários fornecedores → comparar → gerar pedido de compra). Esse fluxo, bem mais robusto — inclusive com comparação de preço assistida e geração de documento de pedido — vai ser desenhado e implementado como **Parte D2**, com seu próprio spec e plano. Nada nesta parte pode assumir que D2 já existe.

## 1. Modelo de dados

Tabela nova `missing_products`. Cada linha representa **um produto pendente** — enquanto o status for `pendente`, só pode existir uma linha por produto (índice único parcial). Quando resolvida, a linha muda de status em vez de ser apagada (histórico simples, sem tela dedicada por enquanto).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | — | PK |
| `product_id` | uuid (FK → `products.id`, `on delete cascade`) | sim | Produto escolhido de entre os já cadastrados (limpeza ou automotivo — mesma tabela `products`, discriminada por `line_type`) |
| `stock_remaining` | inteiro | não | "Quantos ainda tem" — o funcionário que reporta só sabe o estoque atual, não decide quanto comprar |
| `report_count` | inteiro, default 1 | — | Quantas vezes esse produto foi reportado enquanto pendente. Sobe 1 a cada novo report do mesmo produto (em vez de criar linha duplicada) |
| `status` | texto/enum, default `'pendente'` | — | `pendente` \| `resolvido`. A Parte D2 vai estender esse conjunto com `em_cotacao` — não implementado aqui |
| `reported_by` | uuid (FK → `staff_members.user_id`) | sim | Quem reportou por último. Sobrescrito a cada novo report do mesmo produto (mostra sempre o relato mais recente) |
| `resolved_by` | uuid (FK → `staff_members.user_id`) | não | Preenchido ao marcar como resolvido |
| `resolved_at` | timestamptz | não | Preenchido ao marcar como resolvido |
| `created_at` / `updated_at` | timestamptz | — | Automáticos |

**Índice único parcial**: `unique (product_id) where status = 'pendente'` — garante que nunca existam duas linhas pendentes pro mesmo produto, tanto para a lógica normal (incrementar em vez de duplicar) quanto pra corrida entre dois funcionários reportando ao mesmo tempo.

### RLS

Reaproveitando os helpers já existentes (`is_staff_admin()`, `has_staff_permission(perm)`):

- **Select e Insert** (ver a lista, reportar): `is_staff_admin() or has_staff_permission('faltantes')`
- **Update** (marcar como resolvido): `is_staff_admin() or (has_staff_permission('faltantes') and has_staff_permission('fornecedores'))` — só quem tem as duas permissões (perfil "administrativo") pode resolver. Um funcionário só com `faltantes` ("simples") consegue ver a lista e reportar, mas não resolver.
- **Delete**: não previsto nesta parte — resolver é sempre uma mudança de status, nunca exclusão.

Nenhuma migration de permissão nova é necessária — `faltantes` já existe no enum desde a Parte A.

## 2. Navegação

O item "Faltantes" (`missing` em `adminNav.ts`) deixa de ser `comingSoon: true` e passa a ter `permission: 'faltantes'` — mesmo padrão já usado por "Fornecedores" e "Produtos". Continua no grupo Operação, mesma posição.

`AdminHome.tsx` precisa do mesmo ajuste já feito pra `fornecedores` na Parte C: hoje `hasNothing` não considera a permissão `faltantes`, então um funcionário só com essa permissão veria "Ainda sem seções liberadas" mesmo com o item já liberado na sidebar. Adicionar `showFaltantes` ao `hasNothing` e um `ShortcutCard` de Faltantes no Início (mesmo padrão do card de Fornecedores), e atualizar a mensagem do estado vazio (que hoje ainda cita "Faltantes" como algo "a caminho").

## 3. Tela

Mesmo espírito visual das telas anteriores: `Card` com `CardHeader` escurecido (`bg-[#12121a] border-b border-blue-500/20 rounded-t-lg`) e `CardContent` no tema claro padrão — `AdminEmptyState`/`AdminLoadingState` usados dentro do `CardContent` precisam de `tone="light"`.

### Reportar falta — em lote

Botão "Reportar falta" abre um diálogo com uma lista de linhas, cada uma com:
- Combobox pesquisável (usando os componentes `Command`/`Popover` do shadcn, já existentes no projeto em `src/components/ui/` mas ainda não usados em nenhuma tela) pra escolher o produto entre os já cadastrados. Busca por nome, sem distinguir linha (limpeza/automotivo aparecem juntos).
- Campo numérico opcional "Quantos ainda tem".

Um botão "+ Adicionar outro produto" acrescenta novas linhas ao diálogo. Um produto já escolhido numa linha do lote atual não pode ser escolhido de novo em outra linha do mesmo lote (evita duas linhas conflitantes na mesma leva — o combobox filtra/desabilita produtos já usados nas outras linhas abertas).

Só ao clicar "Enviar" (não por linha) o lote inteiro é submetido de uma vez. Cada linha do lote, em sequência:
1. Busca se já existe uma linha `pendente` pra aquele `product_id`.
2. Se existir: `update` incrementando `report_count` em 1, sobrescrevendo `stock_remaining` (se informado nesse envio) e `reported_by` com o usuário atual.
3. Se não existir: `insert` uma linha nova com `report_count = 1`.

Se alguma linha do lote falhar (rede, RLS etc.), as linhas que já foram salvas com sucesso somem do diálogo; as que falharam continuam visíveis pra tentar reenviar, com um toast de erro indicando quantas foram salvas e quantas falharam.

### Lista de pendentes

- Ordenada por `report_count` decrescente (mais pedido primeiro).
- Cada linha mostra: nome do produto, "quantos ainda tem" (se informado), badge com o contador (ex: "pedido 3x"), nome de quem reportou por último (`display_name` do `staff_members`, via `reported_by = staff_members.user_id`).
- Botão "Marcar como resolvido": visível/habilitado só para quem tem também a permissão `fornecedores` (checagem client-side usando o `staffAccess` já carregado — a RLS é a barreira real, a UI só evita mostrar um botão que vai falhar pra quem não tem a segunda permissão). Ao clicar, sem confirmação extra (não é uma exclusão), atualiza `status = 'resolvido'`, `resolved_by`, `resolved_at`, e a linha some da lista de pendentes.
- Sem paginação nem busca — volume esperado é baixo (mesmo raciocínio de Fornecedores).
- Estado vazio (nenhum item pendente) e estado de carregamento seguindo o padrão `AdminEmptyState`/`AdminLoadingState` com `tone="light"`.

## Fora de escopo (explícito)

- Fluxo de cotação inteiro: selecionar itens → gerar mensagem → mandar pra fornecedores → coletar preços recebidos → comparação de preço (inclusive assistida por IA) → geração de pedido de compra (Excel/PDF) com fornecedor vencedor e opção de backup. Tudo isso é a **Parte D2**, com spec e plano próprios.
- Tela/aba de histórico dos itens resolvidos — fica salvo no banco (`status = 'resolvido'`), mas sem tela dedicada por enquanto.
- Qualquer edição de uma linha pendente além de reportar de novo (que incrementa) ou resolver — não tem "editar quantidade" isolado, nem excluir um report por engano.

## Testes

Sem suíte automatizada (padrão do projeto — `npm run typecheck` é a verificação real). Verificação manual:

- `npm run typecheck` limpo.
- Reportar 1 produto, com e sem "quantos ainda tem".
- Reportar um lote de vários produtos numa única submissão.
- Reportar um produto que já está pendente → incrementa o contador, não duplica linha.
- Nome de quem reportou aparece certo e atualiza pro último quando o mesmo produto é reportado de novo por outra pessoa.
- Marcar como resolvido como funcionário com `faltantes` + `fornecedores` → item some da lista de pendentes.
- Funcionário só com `faltantes` (sem `fornecedores`) → vê a lista e consegue reportar, mas não vê/consegue usar o botão de resolver.
- Funcionário sem `faltantes` → item nem aparece na sidebar.
- Item some da lista de faltantes automaticamente se o produto correspondente for excluído do catálogo (cascade).
