# Fallback pra segunda chave do Gemini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando a chamada ao Gemini der `429` (cota estourada) na chave 1 (`GEMINI_API_KEY`), as três funções que usam IA tentam automaticamente a chave 2 (`GEMINI_API_KEY_2`) na mesma requisição, sem a pessoa precisar tentar de novo.

**Architecture:** Cada uma das três Edge Functions ganha uma pequena função local `callGemini(key)` que encapsula a chamada `fetch` já existente (mesmo corpo de requisição, só troca a chave no header). O fluxo principal chama `callGemini(geminiApiKey)`; se vier `429` e `GEMINI_API_KEY_2` estiver configurada, chama `callGemini(geminiApiKey2)` de novo, e segue com o resultado dessa segunda tentativa. Sem `GEMINI_API_KEY_2` configurada, o comportamento é idêntico ao de hoje.

**Tech Stack:** Supabase Edge Functions (Deno), Gemini API.

## Global Constraints

- Sem suíte automatizada nas Edge Functions (Deno, fora do projeto Vite/tsc) — verificação é deploy + leitura cuidadosa do código, mesmo padrão das partes anteriores.
- `GEMINI_API_KEY_2` já está cadastrada como secret no Supabase (feito pelo usuário, fora deste plano) — não é preciso configurar nada além do código.
- Sem `GEMINI_API_KEY_2` configurada, nenhuma das três funções muda de comportamento — a tentativa de fallback é sempre condicional a essa variável existir.
- Mesma mensagem de erro de cota de hoje (`"A cota gratuita da IA acabou por hoje. Tente de novo mais tarde."`) quando as duas chaves falham — não muda o texto.
- Nenhuma chave aparece em log — só um aviso genérico tipo `"Chave 1 do Gemini bateu cota, tentando a chave 2."`.
- `research-product` mantém seu timeout de 20s (`AbortSignal.timeout(20000)`) por tentativa — cada chave tem seu próprio timeout de 20s, não soma.
- Cada função continua 100% independente — nenhuma importa código de outra (mesmo padrão de duplicação já usado no projeto pra auth/CORS).
- Ao deployar via `deploy_edge_function`, sempre confirmar depois (via `get_edge_function`) que os acentos em português não foram removidos na transmissão — problema recorrente já visto neste projeto; redeployar se vier sem acento.

---

### Task 1: Fallback em `research-product`

**Files:**
- Modify: `supabase/functions/research-product/index.ts`

**Interfaces:**
- Nenhuma interface nova exposta ao cliente — o contrato de request/response de `research-product` não muda.

- [ ] **Step 1: Ler a segunda chave**

Logo depois da linha 62 (`const geminiApiKey = Deno.env.get("GEMINI_API_KEY");`), adicionar:

```ts
    const geminiApiKey2 = Deno.env.get("GEMINI_API_KEY_2");
```

- [ ] **Step 2: Extrair `callGemini` e tentar a chave 2 em caso de 429**

Trocar o bloco atual (linhas 150-177 do arquivo atual):

```ts
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": geminiApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }],
            generationConfig: {
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingLevel: "minimal" },
            },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "TimeoutError") {
        console.error("Timeout ao chamar a API do Gemini.");
        return jsonResponse(req, { error: "A pesquisa demorou demais e foi cancelada. Tente novamente." }, 502);
      }
      throw fetchError;
    }
```

Por:

```ts
    const callGemini = (key: string) =>
      fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            tools: [{ google_search: {} }],
            generationConfig: {
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingLevel: "minimal" },
            },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

    let geminiResponse: Response;
    try {
      geminiResponse = await callGemini(geminiApiKey);
      if (geminiResponse.status === 429 && geminiApiKey2) {
        console.error("Chave 1 do Gemini bateu cota, tentando a chave 2.");
        geminiResponse = await callGemini(geminiApiKey2);
      }
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "TimeoutError") {
        console.error("Timeout ao chamar a API do Gemini.");
        return jsonResponse(req, { error: "A pesquisa demorou demais e foi cancelada. Tente novamente." }, 502);
      }
      throw fetchError;
    }
```

Nada abaixo desse bloco muda — o restante do arquivo (checagem de `429`/`!ok`/`MAX_TOKENS`, parse, normalização) continua igual, agora operando sobre o resultado final de `geminiResponse` (seja da chave 1 ou da 2).

- [ ] **Step 3: Deployar**

Usar `deploy_edge_function` (project_id `ccrucholgsffichvzbpz`, nome `research-product`, `verify_jwt: false`) com o conteúdo atualizado do arquivo. Confirmar `ACTIVE` via `list_edge_functions`, e confirmar acentos intactos via `get_edge_function` (comparar contra o arquivo local) — redeployar se vier sem acento.

- [ ] **Step 4: Teste manual**

Sem uma chave 1 realmente esgotada disponível pra testar ao vivo, validar por leitura cuidadosa do código deployado (comparar com o Step 2) + confirmar que, com `GEMINI_API_KEY_2` ausente (cenário de hoje), o fluxo continua idêntico ao anterior — `geminiApiKey2` vira `undefined`, a condição `geminiResponse.status === 429 && geminiApiKey2` nunca é `true`, então `callGemini(geminiApiKey2!)` nunca roda.

Se quiser um teste ao vivo de verdade: usar uma chave 1 temporariamente inválida (ex: string qualquer) só nesse teste, confirmar que a pesquisa mesmo assim retorna resultado (usando a chave 2), depois desfazer a chave de teste.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/research-product/index.ts
git commit -m "feat(ia): fallback pra segunda chave do Gemini em research-product"
```

---

### Task 2: Fallback em `extract-quote-prices`

**Files:**
- Modify: `supabase/functions/extract-quote-prices/index.ts`

**Interfaces:**
- Nenhuma interface nova exposta ao cliente.

- [ ] **Step 1: Ler a segunda chave**

Logo depois da linha 71 (`const geminiApiKey = Deno.env.get("GEMINI_API_KEY");`), adicionar:

```ts
    const geminiApiKey2 = Deno.env.get("GEMINI_API_KEY_2");
```

- [ ] **Step 2: Extrair `callGemini` e tentar a chave 2 em caso de 429**

Esta função não tem timeout nem try/catch ao redor do fetch (diferente de `research-product`) — o bloco atual (linhas 224-247 do arquivo atual) é:

```ts
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            maxOutputTokens: 8192,
            // thinking_budget é legado e não é mais aceito em modelos
            // Gemini 3.x — thinkingLevel é o parâmetro atual, e nesses
            // modelos não dá pra desligar o "thinking" por completo, só
            // reduzir. Fixa o modelo (em vez de "gemini-flash-latest")
            // porque esse alias já trocou de versão duas vezes em 2026, e
            // qual parâmetro de thinking é válido depende de qual modelo
            // ele aponta hoje.
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
      }
    );
```

Trocar por (note que `parts` já foi montado mais acima no arquivo — este bloco só usa a variável, não a recria):

```ts
    const callGemini = (key: string) =>
      fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              maxOutputTokens: 8192,
              // thinking_budget é legado e não é mais aceito em modelos
              // Gemini 3.x — thinkingLevel é o parâmetro atual, e nesses
              // modelos não dá pra desligar o "thinking" por completo, só
              // reduzir. Fixa o modelo (em vez de "gemini-flash-latest")
              // porque esse alias já trocou de versão duas vezes em 2026, e
              // qual parâmetro de thinking é válido depende de qual modelo
              // ele aponta hoje.
              thinkingConfig: { thinkingLevel: "minimal" },
            },
          }),
        }
      );

    let geminiResponse = await callGemini(geminiApiKey);
    if (geminiResponse.status === 429 && geminiApiKey2) {
      console.error("Chave 1 do Gemini bateu cota, tentando a chave 2.");
      geminiResponse = await callGemini(geminiApiKey2);
    }
```

Nada abaixo desse bloco muda.

- [ ] **Step 3: Deployar**

Usar `deploy_edge_function` (project_id `ccrucholgsffichvzbpz`, nome `extract-quote-prices`, `verify_jwt: false`) com o conteúdo atualizado do arquivo. Confirmar `ACTIVE` via `list_edge_functions`, e confirmar acentos intactos via `get_edge_function`.

- [ ] **Step 4: Teste manual**

Mesmo raciocínio do Task 1, Step 4: confirmar por leitura que sem `GEMINI_API_KEY_2` o comportamento não muda, e opcionalmente testar ao vivo com uma chave 1 temporariamente inválida.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/extract-quote-prices/index.ts
git commit -m "feat(ia): fallback pra segunda chave do Gemini em extract-quote-prices"
```

---

### Task 3: Fallback em `apply-quote-reassignment`

**Files:**
- Modify: `supabase/functions/apply-quote-reassignment/index.ts`

**Interfaces:**
- Nenhuma interface nova exposta ao cliente.

- [ ] **Step 1: Ler a segunda chave**

Logo depois da linha 40 (`const geminiApiKey = Deno.env.get("GEMINI_API_KEY");`), adicionar:

```ts
    const geminiApiKey2 = Deno.env.get("GEMINI_API_KEY_2");
```

- [ ] **Step 2: Extrair `callGemini` e tentar a chave 2 em caso de 429**

O bloco atual (linhas 190-206 do arquivo atual) é:

```ts
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
      }
    );
```

Trocar por:

```ts
    const callGemini = (key: string) =>
      fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingLevel: "minimal" },
            },
          }),
        }
      );

    let geminiResponse = await callGemini(geminiApiKey);
    if (geminiResponse.status === 429 && geminiApiKey2) {
      console.error("Chave 1 do Gemini bateu cota, tentando a chave 2.");
      geminiResponse = await callGemini(geminiApiKey2);
    }
```

Nada abaixo desse bloco muda.

- [ ] **Step 3: Deployar**

Usar `deploy_edge_function` (project_id `ccrucholgsffichvzbpz`, nome `apply-quote-reassignment`, `verify_jwt: false`) com o conteúdo atualizado do arquivo. Confirmar `ACTIVE` via `list_edge_functions`, e confirmar acentos intactos via `get_edge_function`.

- [ ] **Step 4: Teste manual**

Mesmo raciocínio das tasks anteriores.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/apply-quote-reassignment/index.ts
git commit -m "feat(ia): fallback pra segunda chave do Gemini em apply-quote-reassignment"
```
