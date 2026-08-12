# Adicionar produto com IA — Spec

## Contexto

Hoje, cadastrar um produto novo (`ProductForm.tsx`) é 100% manual: nome, descrição, categoria, campos técnicos, tamanhos/variações, fragrâncias e fotos, tudo digitado e enviado à mão pela pessoa que cadastra.

Esta parte adiciona um segundo caminho, opcional, pra criar produto: a pessoa digita só o nome (e opcionalmente um tamanho conhecido) e a IA pesquisa o resto — descrição, categoria, campos técnicos, todos os tamanhos vendidos, fragrâncias disponíveis e uma foto candidata pra cada uma dessas coisas. O resultado sempre abre no mesmo `ProductForm` de sempre, pré-preenchido, pra revisão humana antes de salvar — a IA nunca salva um produto sozinha.

**Por que isso importa agora:** o motor de pesquisa construído aqui (edge function + contrato de dados) é a peça que faltava pra fechar, numa próxima parte (fora deste spec), o fluxo descrito no `CLAUDE.md` de detecção de item faltante por foto de lista manuscrita — quando um item da lista não bate com nenhum produto já cadastrado, aquele fluxo futuro vai chamar esse mesmo motor pra criar o produto novo automaticamente. Este spec cobre só o gatilho manual (botão); o gatilho por foto fica pra depois, reaproveitando o que for construído aqui.

## Fora de escopo (explícito)

- Redesenhar o `ProductForm.tsx` — sinalizado pelo usuário como um projeto futuro separado, não misturado aqui.
- Página própria por produto no site público (tipo Shopee) — outro projeto futuro separado.
- Detecção de item faltante por foto de lista manuscrita, criação automática de produto a partir disso, e o restante do fluxo de Faltantes — **próxima parte**, spec e plano próprios, que vai consumir o motor construído aqui.
- Editar um produto já existente com ajuda da IA — só criação de produto novo.
- Sugestão de preço pela IA — preço é sempre deixado em branco pra pessoa preencher (decisão do usuário: preço é dado do negócio, não algo pesquisável).
- Fonte de imagem dedicada (ex: Google Custom Search Image API) — só Gemini com busca do Google, decisão do usuário por custo/simplicidade (uma API só, já configurada).
- Cache/histórico de pesquisas anteriores — cada clique em "Adicionar com IA" é uma pesquisa nova.

## 1. Entrada e gatilho

Nas telas **Produtos** (linha `limpeza`) e **Automotivo** (linha `automotivo`) do admin, ao lado do botão "Novo Produto" já existente, um botão novo: **"✨ Adicionar com IA"**. Mesma regra de visibilidade que já existe pra "Novo Produto" (permissão `produtos`, sem permissão nova).

Clicar abre um diálogo pequeno com:
- **Nome do produto** (texto livre, obrigatório) — ex: "veja multiuso", "cera vonixx hybrid wax".
- **Tamanho conhecido** (texto livre, opcional) — ex: "500ml". Serve só de pista pra IA; ela deve tentar descobrir os outros tamanhos vendidos mesmo sem essa pista.
- Botão "Pesquisar", desabilitado enquanto o campo nome estiver vazio.

Ao confirmar, chama a Edge Function (seção 2) passando `{ name, sizeHint, lineType }`, onde `lineType` vem de qual tela disparou o botão (`'limpeza'` em Produtos, `'automotivo'` em Automotivo) — não é escolhido na UI.

Enquanto a pesquisa roda, o diálogo mostra um estado de carregamento (mesmo padrão visual de loading já usado em outras telas do admin). A pesquisa tem um teto de tempo razoável (ex: 20s) — se estourar, trata como erro (seção 6).

## 2. Edge Function `research-product`

Segue o mesmo padrão de auth/permissão já estabelecido em `extract-quote-prices`:
- Valida o JWT com client anon.
- Confere `staff_members`/`staff_permissions` com client service role — exige permissão `produtos`.
- Todas as leituras/escritas usam o client service role.

**Passo 1 — categorias existentes:** busca (client service role) a lista de `category` distintos já cadastrados pra aquele `lineType`, pra passar como contexto ao modelo (evita a IA inventar uma categoria nova parecida com uma que já existe, ex: "Multi-uso" vs "Multiuso").

**Passo 2 — chamada ao Gemini:** `gemini-3.5-flash`, mesma `GEMINI_API_KEY` já configurada no projeto, com a ferramenta de busca do Google (`google_search` grounding) habilitada — primeira função do projeto a usar essa ferramenta, mas nenhuma credencial nova é necessária. `generationConfig.thinkingConfig: { thinkingLevel: "minimal" }`, tratamento de `status === 429` (cota excedida) e `finishReason === "MAX_TOKENS"`, mesmos moldes de `extract-quote-prices`.

O prompt inclui: nome digitado, tamanho conhecido (se houver), `lineType`, a lista de categorias existentes, e instruções de formato de nome (ver seção 4). Instrui explicitamente: **se não tiver certeza de um dado, devolver `null` nesse campo em vez de inventar** — nunca chutar especificação técnica.

**Contrato de resposta (JSON):**

```jsonc
{
  "confidence": "high" | "low" | "none", // "none" = não achou nada confiável sobre o produto
  "name": string | null,                 // já no padrão Tipo + Marca (seção 4)
  "description": string | null,
  "category": string | null,             // reaproveita uma categoria existente quando fizer sentido
  // presentes só quando lineType === 'limpeza':
  "material": string | null,
  "validity": string | null,
  "specifications": string | null,
  // presentes só quando lineType === 'automotivo':
  "brand": string | null,
  "action_type": string | null,
  "ph_level": string | null,
  "application_area": string | null,
  "main_image_url": string | null,       // candidata a foto principal do produto
  "sizes": [
    { "literage": string, "image_url": string | null }
  ],
  "fragrances": [
    { "name": string, "image_url": string | null }
  ]
}
```

- `sizes` com 0 ou 1 item → produto sem variações (`has_variations: false`, usa `literage_single`). `sizes` com 2+ itens → produto com variações (`has_variations: true`).
- `fragrances` vazio → `has_fragrances: false`.
- Nenhum preço em lugar nenhum deste contrato — reforça a decisão da seção "Fora de escopo".

## 3. Fotos — como funciona e limitação conhecida

Toda `image_url` candidata devolvida pela função é **só uma sugestão**, nunca salva direto. No `ProductForm` pré-preenchido (seção 5), cada campo de imagem (principal, por tamanho, por fragrância) que tiver uma sugestão mostra uma prévia com um botão "Usar esta foto" — ao clicar, o app sobe a imagem pro Cloudinary a partir dessa URL (mesmo pipeline de hoje, `useImageUpload`/preset `ubadesklimp`), preenchendo o campo com a URL final do Cloudinary.

**Limitação conhecida, sem solução 100% garantida:** como a pesquisa é só via Gemini com busca do Google (sem API de imagem dedicada, por decisão do usuário), a URL de foto encontrada pode não carregar, pode não ser exatamente a embalagem certa, ou o site de origem pode bloquear acesso direto. Por isso o botão de enviar foto manual (já existente hoje) continua disponível em todo campo de imagem, sugestão ou não — a foto da IA é sempre um atalho quando funciona, nunca a única forma de preencher.

Se "Usar esta foto" falhar ao subir pro Cloudinary, mostra um toast de erro e o campo simplesmente fica sem imagem, pronto pra upload manual — não bloqueia o resto do formulário.

## 4. Padrão de nome

Nome sempre no formato **Tipo + Marca** (ex: "Multiuso Veja", "Cera de Carnaúba Hybrid Wax Vonixx"), consistente com o padrão já predominante no catálogo atual. O prompt da Edge Function inclui essa regra explicitamente, com 2-3 exemplos reais do catálogo como referência de estilo.

## 5. Tela de revisão — plugando no `ProductForm` existente

O diálogo de pesquisa fecha e abre a mesma dialog "Novo Produto" que já existe hoje (`ProductForm.tsx`), mas com um `initialData` novo montado a partir da resposta da Edge Function, em vez de abrir vazia:

- `name`, `description`, `category` ← direto da resposta.
- Campos técnicos (`material`/`validity`/`specifications` ou `brand`/`action_type`/`ph_level`/`application_area`) ← direto da resposta, conforme `lineType`.
- `image_url` ← preenchido só depois que a pessoa clicar "Usar esta foto" na sugestão (seção 3); antes disso fica vazio, com a sugestão visível ao lado pra decidir.
- `has_variations` + `variations[]` (litragem + `price: ''` + sugestão de foto) quando `sizes.length >= 2`; senão `has_variations: false` + `literage_single`.
- `has_fragrances` + `fragrances[]` (nome + sugestão de foto) quando `fragrances.length > 0`.
- **Preço (base e de cada variação) sempre vazio**, obrigando a pessoa a preencher antes de conseguir salvar — mesma validação `required` que já existe no formulário hoje, sem mudança nela.

A partir daqui, a pessoa edita/corrige/apaga qualquer campo à vontade e salva pelo botão "Salvar" que já existe — nenhum caminho de escrita novo, nenhum salvamento automático.

## 6. Erros e casos de borda

- **Falha de rede / Gemini fora do ar / erro genérico:** toast de erro, diálogo de pesquisa continua aberto (não fecha, não perde o que a pessoa digitou) pra tentar de novo.
- **Cota do Gemini excedida (429):** toast específico ("a cota gratuita da IA acabou por hoje..."), mesmo texto/padrão já usado em `extract-quote-prices`.
- **Timeout (>20s):** tratado como falha de rede — mesmo toast genérico.
- **`confidence: "none"`** (IA não reconheceu o produto digitado): abre o `ProductForm` mesmo assim, só com `name` = o texto exatamente como a pessoa digitou e todo o resto vazio, mais um aviso visível no topo do formulário ("Não encontrei detalhes confiáveis pra esse produto — preencha manualmente."). Nunca bloqueia criar o produto na mão a partir daí.
- **`confidence: "low"`**: abre preenchido normalmente, mas com um aviso mais discreto sugerindo conferir os dados com atenção antes de salvar.

## Testes

Sem suíte automatizada (padrão do projeto — `npm run typecheck` é a verificação real). Verificação manual:

- `npm run typecheck` limpo.
- Pesquisar um produto bem conhecido (ex: "veja multiuso") → formulário abre com nome no padrão Tipo + Marca, categoria reaproveitada de uma já existente, pelo menos 1 tamanho, foto sugerida carregando.
- Pesquisar um produto automotivo conhecido (ex: "cera hybrid wax vonixx") → campos automotivos (marca/ph/área de aplicação) preenchidos, campos de limpeza (material/validade) ausentes.
- Pesquisar um produto com fragrâncias conhecidas → `has_fragrances` marcado, lista de fragrâncias preenchida, cada uma com sugestão de foto própria.
- Pesquisar um nome inventado/sem sentido → `confidence: "none"`, formulário abre só com o nome digitado e o aviso visível.
- Clicar "Usar esta foto" numa sugestão → imagem sobe pro Cloudinary e aparece no preview do campo certo.
- Preço continua obrigatório: tentar salvar sem preencher preço barra do jeito que já barra hoje.
- Provocar erro de rede (desligar wi-fi) durante a pesquisa → toast de erro, diálogo de entrada continua aberto e usável.
- Funcionário sem permissão `produtos` → botão "Adicionar com IA" nem aparece (mesma regra de "Novo Produto").
