# Fornecedores (Parte C) — Spec

## Contexto

Terceiro dos quatro sub-projetos do redesign do admin (A. Papéis/permissões ✅ → B. Visual/nav ✅ → **C. Fornecedores** → D. Faltantes). As Partes A e B já estão em produção: sistema de permissões granulares por funcionário (incluindo a permissão `fornecedores`, já existente desde a Parte A mas ainda sem nenhuma tela por trás dela), e a nova casca visual/navegação do admin (sidebar, Início por papel, componentes compartilhados de cabeçalho/estado-vazio/estado-de-carregamento).

Hoje o item "Fornecedores" já aparece na sidebar (grupo Operação), marcado "em breve" — clicável, mas só mostra uma tela informativa (`AdminComingSoon`). Esta parte substitui isso pelo cadastro de verdade.

**Objetivo desta parte:** cadastro de fornecedores (CRUD simples) com atalho pra abrir WhatsApp — nada além disso. Vincular fornecedor a produtos, gerar mensagem de cotação, e registrar de qual fornecedor uma compra foi feita são decisões que dependem do desenho da Parte D (Faltantes) e ficam fora daqui, mesmo que a permissão `fornecedores` já preveja esse uso futuro.

## Fora de escopo (explícito)

- Vincular fornecedor a quais produtos ele vende — não existe uma tabela de relação fornecedor↔produto nesta parte. Quando a Parte D precisar disso, decide-se lá.
- Geração de mensagem de cotação e qualquer fluxo de "enviar pra todos os fornecedores de uma vez" — depende da lista de faltantes existir (Parte D). Tecnicamente, o link `wa.me/` não suporta enviar a mesma mensagem pra vários contatos com um clique só (isso exigiria a API paga do WhatsApp Business); a solução realista pra Parte D é uma mensagem gerada uma vez + um botão por fornecedor que abre a conversa já com o texto pronto — deixado anotado aqui pra não se perder, mas não implementado nesta parte.
- Registro de compra (qual fornecedor vendeu, por qual preço) — Parte D.
- Nenhuma mudança na navegação/visual além de destravar o item "Fornecedores" que já existe.

## 1. Modelo de dados

Tabela nova `suppliers`, cada linha representando **um contato numa empresa específica** (se a mesma pessoa vende por duas empresas, são duas linhas — decisão explícita pra manter o cadastro simples de bater o olho, em vez de aninhar uma lista de empresas dentro de cada contato).

Campos:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `contact_name` | texto | sim | Nome da pessoa de contato |
| `company_name` | texto | sim | Nome da empresa que ela representa |
| `phone` | texto | sim | WhatsApp/telefone, usado pro atalho de abrir conversa |
| `email` | texto | não | |
| `avg_delivery_days` | número inteiro | não | Prazo médio de entrega, em dias |
| `max_installments` | número inteiro | não | Em quantas vezes esse fornecedor costuma parcelar a compra |
| `notes` | texto | não | Observações livres |
| `created_at` / `updated_at` | timestamp | — | Automáticos |

RLS seguindo o mesmo padrão já estabelecido na Parte A (`is_staff_admin()`/`has_staff_permission()`): leitura e escrita liberadas pra quem é admin ou tem a permissão `fornecedores` (que já existe no enum `staff_permission` desde a Parte A — nenhuma migration de permissão nova é necessária, só a policy da tabela nova).

## 2. Navegação

O item "Fornecedores" (`suppliers` em `adminNav.ts`) deixa de ser `comingSoon: true` e passa a ter `permission: 'fornecedores'` — mesmo padrão que "Produtos" já usa com `permission: 'produtos'`. Continua no grupo Operação, mesma posição.

## 3. Tela

Lista simples, no mesmo espírito visual da tela de Funcionários (Parte A/B): um `Card` com `CardHeader` escurecido (`AdminPageHeader`) e `CardContent` no tema claro padrão — já sabendo, pela experiência da Parte B, que qualquer `AdminEmptyState`/`AdminLoadingState` usado dentro desse `CardContent` precisa da prop `tone="light"` pra não repetir o bug de texto invisível.

- Campo de busca por nome do contato ou empresa (filtro local, sem paginação — volume esperado é baixo).
- Botão "Novo fornecedor" abrindo um diálogo de criação (mesmo padrão de dialog do `StaffManager`/`CategoryManager`): nome, empresa, telefone, e-mail, prazo médio de entrega, parcelamento, observações.
- Cada linha da lista mostra: nome do contato, empresa, telefone (com botão de abrir WhatsApp ao lado — `https://wa.me/<telefone só dígitos, com código do país>`, sem mensagem pré-preenchida), botões de editar e excluir.
- Editar reaproveita o mesmo formulário de criação, preenchido.
- Excluir pede confirmação (`window.confirm`, mesmo padrão já usado em outras exclusões do admin) — sem soft-delete, sem guarda especial (diferente do "último admin" da Parte A, aqui não existe a noção de "último fornecedor obrigatório").

## Testes

Sem suíte automatizada (padrão do projeto — `npm run typecheck` é a verificação real). Verificação manual:

- `npm run typecheck` limpo.
- Criar, editar e excluir um fornecedor de teste.
- Busca por nome e por empresa retornando os resultados certos.
- Botão de WhatsApp abrindo `wa.me` com o número certo.
- Um funcionário sem a permissão `fornecedores` não vê o item na sidebar nem consegue acessar a tela.
- Um funcionário com a permissão `fornecedores` (e sem outras) vê exatamente essa seção liberada, consistente com o padrão já testado nas Partes A/B.
