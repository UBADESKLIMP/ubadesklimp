# Colar texto + Exportar/Importar Excel nas cotações

## Contexto

Hoje, pra registrar o que um fornecedor cotou, só existem dois caminhos na
tela de cada fornecedor (`QuoteBatchSupplierReview.tsx`): digitar preço a
preço manualmente, ou enviar foto/PDF pra IA ler (`extract-quote-prices`).
Na prática a maioria dos fornecedores manda a cotação como texto solto no
WhatsApp — hoje isso só vira dado no sistema se alguém colar esse texto pra
mim (Claude) numa conversa, o que não escala pro resto da equipe. Outros
fornecedores preferem receber e devolver planilha Excel, que hoje não tem
nenhum suporte.

Esta spec cobre três adições, todas no módulo de Cotações já existente:

1. **Colar texto** — extrair preço (e adendo) de texto colado, reaproveitando
   a mesma IA que já lê arquivo.
2. **Exportar Excel** — gerar uma planilha com os itens do lote, pra mandar
   pro fornecedor preencher.
3. **Importar Excel** — ler a planilha preenchida e aplicar os preços/adendos
   automaticamente, sem IA (dado estruturado, casamento por ID).

## 1. Colar texto

### Back-end (`supabase/functions/extract-quote-prices/index.ts`)

A função já aceita `{ quoteBatchSupplierId }` no corpo e processa arquivos
pendentes em `quote_files`. Passa a aceitar também `pastedText` (string
opcional) no corpo:

- Se `pastedText` vier preenchido (não vazio após `.trim()`): pula todo o
  bloco de buscar/baixar `quote_files` — não precisa de nenhum arquivo
  cadastrado. Monta `parts` com uma única part de texto combinando o texto
  colado com o prompt de instrução (ver abaixo). Não marca nenhum
  `quote_files.processed_at` no final (não existe arquivo envolvido —
  `processedFileIds` fica vazio, o bloco existente já trata isso como no-op).
- Se `pastedText` não vier (ou vier vazio): comportamento idêntico ao atual
  (exige arquivo novo em `quote_files`, senão retorna o erro já existente
  "Nenhum arquivo novo pra processar.").
- `quoteBatchSupplierId` continua obrigatório nos dois casos.

O texto do prompt (usado nos dois modos) generaliza a referência de
"arquivo(s) anexado(s)" pra "material fornecido", já que agora pode ser
texto em vez de imagem/PDF — resto do prompt (pedir "note" quando houver
info de tamanho/marca/promoção, formato de resposta JSON) não muda, é o
mesmo já implementado pra extração por arquivo.

No modo texto, a part enviada ao Gemini é:
`{ text: `Material da cotação (mensagem de texto colada):\n\n${pastedText}\n\n${promptText}` }`

No modo arquivo, comportamento idêntico ao atual (parts com `inline_data`
de cada arquivo + uma part final com `promptText`).

### Front-end

`useQuoteSupplierReview.ts`: `runExtraction` passa a aceitar um parâmetro
opcional `pastedText?: string`, repassado no body da chamada à function
quando presente.

`QuoteBatchSupplierReview.tsx`: novo botão "Colar texto" ao lado de "Enviar
arquivo(s)"/"Extrair com IA". Ao clicar, abre uma `Textarea` (mesmo padrão
visual dos outros campos) com um botão "Extrair do texto colado" abaixo.
Ao extrair com sucesso, limpa a caixa de texto e fecha (mesmo toast de
resultado — "IA encontrou preço pra X de Y itens" — já usado pra arquivo).

## 2. Exportar Excel

Novo botão "Exportar Excel" em `QuoteBatchDetail.tsx`, na seção de itens do
lote (mesmo nível do botão de "Adicionar fornecedor"). Gera e baixa
(client-side, sem passar pelo servidor) uma planilha `.xlsx` com uma linha
de cabeçalho e uma linha por item do lote:

| Item | Preço (R$) | Adendo | ID (não editar) |
|---|---|---|---|
| Sabão Líquido Urca — Azul | *(vazio)* | *(vazio)* | `3a08aaed-...` |

A coluna "ID (não editar)" fica **oculta** (`!cols` com `hidden: true` no
SheetJS) — existe só pra garantir que a importação (seção 3) case cada linha
com o item certo por ID, não por nome (nome pode ter variação de digitação
quando o fornecedor edita a planilha). Nome do arquivo:
`cotacao-{dataDoLote}.xlsx`.

Nova dependência: pacote `xlsx` (SheetJS) — não usado no projeto ainda.
Import estático (`import * as XLSX from 'xlsx'`), mesmo padrão de uso
client-side já existente pra PDF em `src/lib/purchaseOrder.ts` (usa
`jspdf` do mesmo jeito, chamado direto de um clique de botão).

Novo arquivo `src/lib/quoteExcel.ts`, com duas funções (exportação nesta
seção, importação na seção 3):

```ts
export const buildQuoteRequestExcel = (
  items: { id: string; displayName: string }[],
  batchLabel: string
): void => { /* gera e chama XLSX.writeFile(...) */ };
```

`QuoteBatchDetail.tsx` monta `displayName` de cada item com
`buildMissingItemDisplayName` (já importado e usado ali) antes de chamar.

## 3. Importar Excel

Novo botão "Importar Excel" em `QuoteBatchSupplierReview.tsx`, ao lado de
"Enviar arquivo(s)". Abre um seletor de arquivo (`accept=".xlsx,.xls"`,
mesmo padrão do input de arquivo já existente ali). Ao selecionar:

1. Lê o arquivo no navegador (`XLSX.read`), pega a primeira aba.
2. Pra cada linha (pulando o cabeçalho): lê ID (coluna D), Preço (coluna B),
   Adendo (coluna C). A célula de preço pode vir como número (caso comum —
   Excel já reconhece "13,90" digitado numa célula numérica e guarda como
   número puro) ou como texto (se o fornecedor digitou numa célula formatada
   como texto) — nesse segundo caso, troca vírgula por ponto antes de
   `parseFloat`. Preço inválido/vazio na célula: linha entra só se o ID bater
   e o preço for um número válido (ver item 3) — célula de preço vazia não é
   erro, só não gera atualização de preço pra aquele item.
3. Se o ID bater com um item deste lote (`items` já vem como prop pro
   componente) **e** a célula de preço tiver um número válido: chama
   `updatePrice(itemId, preco)` (função já existente no hook) e, se a
   célula de adendo não estiver vazia, `updateNote(itemId, adendo)` (função
   já existente, adicionada na spec anterior).
4. Linha com ID que não bate com nenhum item do lote (planilha
   editada/coluna removida) é ignorada — não é erro fatal, só não conta.
5. Ao final, toast único: "Planilha importada — X de Y itens preenchidos."
   (mesmo padrão de mensagem já usado na extração por IA).

```ts
export const parseQuoteRequestExcel = (
  file: File
): Promise<Array<{ itemId: string; price: number | null; note: string | null }>> => { ... };
```

Sem IA nessa etapa — é leitura direta e determinística da planilha, mais
rápida e sem custo de API. `updatePrice`/`updateNote` já existem e já
salvam no banco um por um (mesmo caminho que a digitação manual usa hoje) —
a importação só automatiza clicar/digitar em cada célula.

## Fora de escopo

- Casamento por nome como *fallback* quando o ID não bate — se a coluna de
  ID for removida/alterada, a linha é só ignorada (ver item 4 da seção 3).
  Adicionar fallback é trabalho futuro se isso se mostrar um problema real.
- Suporte a `.csv` — só `.xlsx`/`.xls` por enquanto (formato que o Excel
  gera por padrão).
- Editar itens/preço dentro da própria planilha exportada de forma
  bidirecional automática (nada de "sincronizar" — é só exportar uma vez,
  importar uma vez).
- Testar no navegador em tempo real — a implementação vai direto, sem
  verificação visual ao vivo; revisão fica por conta do usuário depois.
