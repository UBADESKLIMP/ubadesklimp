# Fragrância e tamanho em Faltantes (Parte D1.1) — Spec

## Contexto

A Parte D1 (Faltantes) já está em produção: funcionário reporta produto faltando, escolhido de entre os já cadastrados no catálogo. Mas muitos produtos do catálogo têm variações — fragrância/cor (`product_fragrances`) e/ou tamanho/litragem (`product_variations`) — e hoje o formulário de reportar falta só deixa escolher o produto "genérico", sem dizer qual fragrância ou tamanho específico está faltando. Isso foi notado testando a tela em produção: reportar "faltou Ypê" sem saber se é o de 1L rosa ou o de 2L azul não é útil pra ninguém repor o estoque certo.

Essa parte é um pré-requisito pra Parte D2 (fluxo de cotação): a IA que vai ler os arquivos de cotação dos fornecedores precisa saber o nome exato do item (produto + fragrância + tamanho) pra conseguir casar o que o fornecedor cotou com o que foi pedido. Por isso ela é resolvida agora, antes de desenhar a D2, e entregue sozinha (spec/plano/PR próprios) em vez de virar mais uma task dentro do plano da D2.

## 1. Modelo de dados

Duas colunas novas em `missing_products`, ambas opcionais no banco:

| Campo | Tipo | Descrição |
|---|---|---|
| `fragrance_id` | uuid (FK → `product_fragrances.id`, `on delete cascade`) | Fragrância/cor faltando, quando o produto tem fragrâncias cadastradas |
| `variation_id` | uuid (FK → `product_variations.id`, `on delete cascade`) | Tamanho/litragem faltando, quando o produto tem variações cadastradas |

`on delete cascade` (não `set null`, diferente do que foi feito pra `reported_by`/`resolved_by` na D1): se a fragrância ou variação específica for excluída do catálogo, a pendência daquele exato item deixa de fazer sentido — mesmo raciocínio já usado pro `product_id` em si.

**Índice único parcial**: hoje é `unique (product_id) where status = 'pendente'`. Passa a ser sobre a combinação `(product_id, fragrance_id, variation_id)` — tratando "sem fragrância" e "sem tamanho" (`null`) como um valor fixo (não como "qualquer coisa"), pra continuar garantindo no máximo uma linha pendente por combinação exata, inclusive pra produtos sem fragrância/tamanho nenhum (onde as duas colunas ficam `null` em toda linha).

### RLS

Sem mudança nas policies existentes — `fragrance_id`/`variation_id` são só colunas a mais nas mesmas linhas, cobertas pelas mesmas regras já em produção (ver Parte D1).

## 2. Tela — Reportar falta

Depois de escolher o produto numa linha do lote:
- Se o produto tem fragrâncias cadastradas (`has_fragrances` + lista de `product_fragrances` não vazia): aparece um seletor "Fragrância", obrigatório, com as opções daquele produto.
- Se o produto tem variações cadastradas (`has_variations` + lista de `product_variations` não vazia): aparece um seletor "Tamanho", obrigatório. Se uma fragrância já foi escolhida, a lista de tamanhos é filtrada pelas litragens que aquela fragrância tem disponível (`product_fragrances.available_literages`); sem fragrância escolhida (produto não tem fragrâncias, ou ainda não escolheu), mostra todas as variações do produto.
- Produto sem fragrância nem variação cadastrada: formulário continua exatamente como está hoje (só produto + quantos ainda tem).
- O botão "Enviar" do lote fica desabilitado se alguma linha tiver produto escolhido mas fragrância/tamanho obrigatórios ainda não preenchidos.

**Escolher o mesmo produto duas vezes no lote**: a trava atual (não deixar escolher um produto já usado em outra linha do mesmo lote) sai. Motivo: agora faz sentido reportar "Ypê Rosa" e "Ypê Azul" ao mesmo tempo — são itens diferentes apesar de ser o "mesmo produto" na tabela `products`. Não existe mais nenhuma validação de duplicidade no cliente; se por engano a pessoa montar duas linhas com exatamente o mesmo combo (produto + fragrância + tamanho), cada uma tenta se registrar normalmente e a segunda cai no mesmo caminho que já existe hoje pra "reportar de novo" (incrementa o contador daquele item em vez de duplicar ou dar erro) — o índice único do banco garante isso, igual já garante pra produtos sem variação.

## 3. Tela — Lista de pendentes

Cada linha passa a mostrar fragrância/tamanho junto do nome do produto quando existirem, por exemplo:

> **Amaciante Ypê** — Rosa — 2L

Sem fragrância nem tamanho, mostra só o nome do produto (igual hoje).

## Fora de escopo (explícito)

- Nenhuma mudança na Parte D2 (cotação) em si — essa parte só prepara o dado que a D2 vai consumir.
- Nenhuma mudança na tela de cadastro de produtos (`ProductForm`) ou em como fragrâncias/variações são cadastradas — só consome o que já existe.
- Sem edição de fragrância/tamanho depois de reportado — pra corrigir, teria que resolver e reportar de novo (mesma limitação que já existe hoje pra outros campos do reporte).

## Testes

Sem suíte automatizada (padrão do projeto). Verificação manual:

- `npm run typecheck` limpo.
- Reportar falta de um produto sem fragrância nem variação — formulário igual ao de hoje, sem seletores extras.
- Reportar falta de um produto só com variações (sem fragrância) — aparece seletor de Tamanho, obrigatório.
- Reportar falta de um produto com fragrâncias e variações — aparece Fragrância e Tamanho; escolher uma fragrância filtra a lista de tamanhos pelas litragens dela.
- Tentar enviar o lote com um produto escolhido mas fragrância/tamanho obrigatórios em branco — botão "Enviar" fica desabilitado.
- Reportar o mesmo produto duas vezes no mesmo lote com fragrâncias diferentes — as duas linhas são aceitas, viram itens pendentes separados.
- Reportar de novo exatamente o mesmo combo (produto + fragrância + tamanho) de um item já pendente — incrementa o contador, não duplica.
- Lista de pendentes mostra fragrância/tamanho junto do nome quando existirem.
