# Admin — Redesign Visual e Navegação (Parte B) — Spec

## Contexto

Este é o segundo dos quatro sub-projetos do redesign do admin (A. Papéis/permissões → **B. Visual/nav** → C. Fornecedores → D. Faltantes). A Parte A já está em produção: sistema de permissões granulares por funcionário (`faltantes`/`produtos`/`fornecedores`/`financeiro`), login por usuário+senha, tela de Funcionários.

Hoje o admin usa 7 abas horizontais no mesmo nível hierárquico (Dashboard, Produtos, Automotivo, Destaques, Pedidos, Categorias, Funcionários), cada seção com seu próprio estilo de cartão/vazio/carregamento, sem uma tela de entrada para quem não tem permissão `financeiro`. O dono do projeto descreveu o resultado como "quebra-galho" — funcional, mas sem cara de produto pronto pra usar todo dia.

**Objetivo desta parte:** trocar a casca de navegação e unificar a linguagem visual das telas existentes, **sem** adicionar nenhuma funcionalidade nova (isso fica pras Partes C e D) e **sem** alterar a lógica de permissões (já pronta na Parte A) — só como ela se expressa visualmente.

## Fora de escopo (explícito)

- Nenhuma funcionalidade nova de Fornecedores ou Faltantes (Partes C/D). Só entram como itens de navegação "em breve".
- Nenhuma mudança na lógica de `useStaffAccess`/RLS/permissões — só na apresentação.
- Nenhuma mudança de comportamento nas telas existentes (Produtos, Automotivo, Destaques, Pedidos, Categorias, Funcionários) — os dados, formulários e ações continuam os mesmos, só a casca visual muda.
- Os gráficos/dados do Dashboard (`AdminDashboard.tsx`) continuam os mesmos — só entram no novo visual.
- Paleta de cores não muda — `hsl(210 85% 45%)` (azul) continua sendo a cor primária. Tipografia continua Inter/Poppins.

## 1. Navegação — desktop

Sidebar fixa à esquerda, substituindo as abas horizontais atuais (`Tabs`/`TabsList`/`TabsTrigger` em `Admin.tsx`).

**Estado padrão: recolhida** (52px de largura, só ícones). **Expande ao passar o mouse** (hover) pra ~200px mostrando os rótulos e os separadores de grupo; recolhe de novo quando o mouse sai. Não é um botão de toggle persistente — é hover-driven.

**Estrutura de itens** (mesma orientada por `TAB_PERMISSION` já existente em `Admin.tsx`, só reorganizada visualmente):

```
Início            (visível pra todo mundo — conteúdo varia por papel, ver seção 3)
Financeiro         (permissão: financeiro)
─── Catálogo ───
Produtos           (permissão: produtos)
Automotivo         (permissão: produtos)
Destaques          (permissão: produtos)
Categorias         (permissão: produtos)
─── Operação ───
Fornecedores        ("em breve" — sempre visível, sempre desabilitado nesta parte)
Faltantes           ("em breve" — sempre visível, sempre desabilitado nesta parte)
─── Equipe ───
Funcionários        (admin only)
```

Os rótulos de grupo ("Catálogo", "Operação", "Equipe") só aparecem no estado expandido (hover); no estado recolhido, um espaçamento maior entre grupos de ícones substitui o rótulo.

Cada item segue a mesma regra de visibilidade condicional que já existe: um item só aparece na sidebar se `canSeeTab()` retornar `true` para ele **ou** se for um item "em breve" (que aparece pra todo mundo, mas nunca é clicável).

## 2. Navegação — mobile

Barra inferior fixa (substitui a sidebar em telas estreitas), com no máximo 5 posições:

```
Início | Produtos | Pedidos | Financeiro | Mais
```

**Adaptação por papel:** cada posição só aparece se o usuário tiver a permissão correspondente (mesma regra de `canSeeTab`). Se um item não aparece, o próximo da lista de prioridade ocupa a posição — a barra nunca fica com buraco vazio nem menos que os itens permitidos couberem. Prioridade de preenchimento: Início → Produtos → Pedidos → Financeiro → (Automotivo, Destaques, Categorias, Funcionários — sempre dentro de "Mais", nunca na barra principal).

"Mais" abre uma folha (sheet/drawer) com o restante dos itens permitidos, incluindo Automotivo, Destaques, Categorias, Funcionários, e Fornecedores/Faltantes ("em breve", desabilitados).

Alvos de toque grandes (mínimo 44×44px), consistente com o uso real no chão do estoque mencionado no `CLAUDE.md`.

## 3. Início — conteúdo por papel

Hoje `AdminDashboard.tsx` (gráficos de venda, faturamento, produtos mais vendidos) só é acessível por quem tem permissão `financeiro`. Quem não tem cai direto na primeira seção permitida, sem tela de entrada.

Novo comportamento: **todo mundo tem um Início**, mas o conteúdo muda por papel:

- **Admin / financeiro**: o dashboard atual (`AdminDashboard.tsx`), sem mudança de dados ou lógica — só entra dentro da nova casca visual (sidebar, cabeçalho padronizado).
- **Produtos** (sem `financeiro`): tela nova e simples — não reaproveita `AdminDashboard`. Mostra:
  - Contagem de produtos ativos, e quantos por categoria.
  - Quantos produtos estão incompletos (sem imagem, ou campos essenciais em branco) — ajuda no trabalho de cadastro do dia a dia.
  - Atalho rápido pra "Novo produto".
  - Nenhum dado de venda/faturamento (sem permissão `financeiro` pra ver isso).
- **Faltantes / Fornecedores apenas** (interino, até Partes C/D existirem): tela "em breve", com o mesmo tratamento visual dos itens de nav desabilitados — não é uma funcionalidade nova, é a mesma tela vazia que já existe hoje (`visibleTabs.length === 0` em `Admin.tsx`), só re-estilizada pra combinar com o resto.

## 4. Sistema visual consistente

Pontos levantados como "parece protótipo": cada seção com seu próprio jeito de cartão/vazio/carregamento. Esta parte introduz componentes compartilhados, usados por todas as seções existentes (sem mudar o que cada uma faz):

- **Cabeçalho de página**: título + descrição curta + ação primária (quando houver), mesmo padrão em Produtos, Automotivo, Destaques, Pedidos, Categorias, Funcionários.
- **Estado vazio**: ícone + mensagem, generalizando o padrão que já existe em `AdminDashboard.tsx` ("Nenhuma venda registrada ainda") pra todas as listas (produtos sem resultado de busca, nenhum pedido, nenhuma categoria, nenhum funcionário).
- **Estado de carregamento**: skeleton consistente (não o emoji `📊` com pulse que existe hoje em `AdminDashboard.tsx`) em todas as seções que buscam dados.
- **Cartão de estatística** (usado no novo Início de Produtos e reaproveitável em Fornecedores/Faltantes nas Partes C/D).

Não inclui: redesenhar formulários (`ProductForm`, `CategoryManager` etc.) por dentro — isso é conteúdo de cada seção, fora do escopo desta parte. O que muda é a casca em volta (cabeçalho, vazio, carregamento) e a navegação.

## Testes

Sem suíte automatizada de UI (padrão já estabelecido no projeto — `npm run typecheck` é a verificação real). Verificação:

- `npm run typecheck` limpo.
- Teste manual: sidebar recolhe/expande no hover; navegação mobile mostra os itens certos por papel; Início mostra o conteúdo certo pra admin, produtos-only, e faltantes/fornecedores-only; itens "em breve" aparecem visíveis mas não-clicáveis; nenhuma tela existente perdeu funcionalidade (formulários, ações de editar/excluir continuam funcionando).
