# Colar Texto + Exportar/Importar Excel nas Cotações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar dois jeitos novos de registrar preço de cotação de fornecedor sem depender de foto/PDF: colar texto solto (WhatsApp) reaproveitando a IA já existente, e exportar/importar planilha Excel (sem IA, casamento por ID).

**Architecture:** A extração por IA já existente (`extract-quote-prices`) ganha um segundo modo de entrada (texto colado em vez de arquivo) sem duplicar a lógica de prompt/gravação. O caminho de Excel é inteiramente novo e roda no navegador (sem IA, sem passar pelo servidor) — gera e lê planilhas com uma coluna oculta de ID pra casamento exato de linha.

**Tech Stack:** React + TypeScript + Vite, Supabase Edge Function (Deno), Gemini API, pacote `xlsx` (SheetJS) novo no projeto.

## Global Constraints

- Sem suíte de testes automatizada no front-end — verificação de cada tarefa de front-end é `npm run build`.
- Sem suíte automatizada nas Edge Functions (Deno) — verificação é aplicar a function via `mcp__claude_ai_Supabase__deploy_edge_function` (project_id `ccrucholgsffichvzbpz`, `verify_jwt: false` — esta function já tinha isso desabilitado antes) e conferir com `get_edge_function` que os acentos em português não foram removidos na transmissão (problema recorrente já visto neste projeto).
- Nenhuma migration de banco é necessária nesta plano — a coluna `quote_line_items.notes` já existe (spec anterior).
- `xlsx` é dependência nova do projeto — instalar com `npm install xlsx@^0.18.5` (ou editar `package.json` e rodar `npm install`).

---

### Task 1: `src/lib/quoteExcel.ts` — gerar e ler a planilha de cotação

**Files:**
- Modify: `package.json` (adicionar dependência `xlsx`)
- Create: `src/lib/quoteExcel.ts`

**Interfaces:**
- Produz: `buildQuoteRequestExcel(items: { id: string; displayName: string }[], batchLabel: string): void` — gera e baixa a planilha.
- Produz: `parseQuoteRequestExcel(file: File): Promise<{ itemId: string; price: number | null; note: string | null }[]>` — lê uma planilha preenchida e devolve as linhas reconhecidas.

- [ ] **Step 1: Adicionar a dependência `xlsx`**

Em `package.json`, dentro do bloco `"dependencies"`, entre `"vaul"` e `"zod"` (ordem alfabética já usada no arquivo):

```json
    "vaul": "^0.9.9",
    "xlsx": "^0.18.5",
    "zod": "^3.25.76"
```

Depois rodar:

```bash
npm install
```

- [ ] **Step 2: Criar `src/lib/quoteExcel.ts`**

```ts
import * as XLSX from 'xlsx';

export interface QuoteExcelRow {
  id: string;
  displayName: string;
}

const HEADER_ROW = ['Item', 'Preço (R$)', 'Adendo', 'ID (não editar)'];

// Coluna D (índice 3, base 0) fica escondida — só serve pra casar cada
// linha de volta com o item certo na importação, sem depender de casar
// pelo texto do nome (que pode ter sido editado/reformatado pelo
// fornecedor ao preencher a planilha).
export const buildQuoteRequestExcel = (items: QuoteExcelRow[], batchLabel: string): void => {
  const rows = [HEADER_ROW, ...items.map((item) => [item.displayName, '', '', item.id])];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 30 }, { wch: 10, hidden: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cotação');
  XLSX.writeFile(workbook, `cotacao-${batchLabel}.xlsx`);
};

export interface QuoteExcelImportRow {
  itemId: string;
  price: number | null;
  note: string | null;
}

// Célula de preço pode vir como número (Excel já reconhece "13,90" digitado
// numa célula numérica e guarda como número puro) ou como texto (célula
// formatada como texto) — nesse segundo caso troca vírgula por ponto antes
// de converter.
const parsePrice = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const normalized = trimmed.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const parseQuoteRequestExcel = (file: File): Promise<QuoteExcelImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Arquivo vazio.'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        const dataRows = rows.slice(1); // pula a linha de cabeçalho

        const parsed: QuoteExcelImportRow[] = [];
        for (const row of dataRows) {
          const itemId = row[3];
          if (typeof itemId !== 'string' || itemId.trim() === '') continue;
          parsed.push({
            itemId: itemId.trim(),
            price: parsePrice(row[1]),
            note: typeof row[2] === 'string' && row[2].trim() !== '' ? row[2].trim() : null,
          });
        }
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Não foi possível ler a planilha.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erro (confirma que o pacote `xlsx` foi instalado e importa corretamente).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/quoteExcel.ts
git commit -m "feat(cotacoes): funções de gerar/ler planilha Excel de cotação"
```

---

### Task 2: Edge function `extract-quote-prices` — aceitar texto colado

**Files:**
- Modify: `supabase/functions/extract-quote-prices/index.ts`

**Interfaces:**
- Consome: corpo da requisição ganha campo opcional `pastedText?: string`, junto do já existente `quoteBatchSupplierId: string`.
- Produz: mesmo formato de resposta já existente (`{ matched, totalItems, filesProcessed, filesSkipped }` em sucesso, `{ error }` em falha) — `filesProcessed`/`filesSkipped` ficam `0` quando a chamada usa `pastedText` (não há arquivo envolvido).

- [ ] **Step 1: Reescrever o arquivo com suporte a `pastedText`**

Substituir o conteúdo completo de `supabase/functions/extract-quote-prices/index.ts` por:

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// btoa só aceita binary string, não Uint8Array direto, e passar o array
// inteiro pro spread de String.fromCharCode estoura o limite da call stack
// em arquivos grandes (PDF de várias páginas) — por isso o encode é feito
// em blocos.
const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const corsHeadersFor = (req: Request) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") ??
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const jsonResponse = (req: Request, body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });

const MEDIA_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

// O limite real que importa aqui não é o da API do Gemini (~100MB por
// arquivo) — é o de memória do isolate da Edge Function do Supabase
// (256MB). Bytes crus, string base64, corpo JSON.stringify e a codificação
// UTF-8 que o fetch faz do corpo ficam todos na memória ao mesmo tempo, uns
// 1.37x o tamanho cru cada — um limite de 60MB estouraria isso de sobra.
// 12MB crus (~16MB em base64) dá pra várias fotos ou um PDF comum por
// rodada, com folga real sob o limite do isolate.
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

interface GeminiMatch {
  item: string;
  price: number | null;
  note?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiApiKey2 = Deno.env.get("GEMINI_API_KEY_2");

    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY não configurada.");
      return jsonResponse(req, { error: "IA não configurada no servidor. Avise um administrador." }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse(req, { error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerStaff } = await adminClient
      .from("staff_members")
      .select("is_admin, display_name")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerStaff) {
      return jsonResponse(req, { error: "Não autorizado" }, 403);
    }

    if (!callerStaff.is_admin) {
      const { data: perms } = await adminClient
        .from("staff_permissions")
        .select("permission")
        .eq("user_id", caller.id);
      const permissionSet = new Set((perms || []).map((p) => p.permission));
      if (!permissionSet.has("faltantes") || !permissionSet.has("fornecedores")) {
        return jsonResponse(req, { error: "Você não tem permissão para cotações." }, 403);
      }
    }

    const body = await req.json().catch(() => null);
    const quoteBatchSupplierId = typeof body?.quoteBatchSupplierId === "string" ? body.quoteBatchSupplierId : "";
    const pastedText = typeof body?.pastedText === "string" ? body.pastedText.trim() : "";
    if (!quoteBatchSupplierId) {
      return jsonResponse(req, { error: "quoteBatchSupplierId é obrigatório." }, 400);
    }

    const { data: batchSupplier, error: batchSupplierError } = await adminClient
      .from("quote_batch_suppliers")
      .select("id, quote_batch_id")
      .eq("id", quoteBatchSupplierId)
      .maybeSingle();
    if (batchSupplierError || !batchSupplier) {
      return jsonResponse(req, { error: "Cotação de fornecedor não encontrada." }, 404);
    }

    // Modo texto colado pula completamente a busca/download de quote_files
    // — não existe nenhum arquivo envolvido nesse caminho.
    let files: { id: string; storage_path: string }[] = [];
    if (!pastedText) {
      const { data: filesData, error: filesError } = await adminClient
        .from("quote_files")
        .select("id, storage_path")
        .eq("quote_batch_supplier_id", quoteBatchSupplierId)
        .is("processed_at", null);
      if (filesError) throw filesError;

      if (!filesData || filesData.length === 0) {
        return jsonResponse(req, { error: "Nenhum arquivo novo pra processar." }, 400);
      }
      files = filesData;
    }

    // Monta a lista de itens pedidos nesse lote, com o nome resolvido
    // (Produto — Fragrância — Tamanho), pra IA casar contra o material do
    // fornecedor. Roda com service_role, então ignora RLS de propósito —
    // a permissão de quem chamou já foi checada acima.
    const { data: batchItems, error: batchItemsError } = await adminClient
      .from("quote_batch_items")
      .select(
        "id, missing_products(product_id, fragrance_id, variation_id, products(name), product_fragrances(name), product_variations(literage))"
      )
      .eq("quote_batch_id", batchSupplier.quote_batch_id);
    if (batchItemsError) throw batchItemsError;

    type BatchItemRow = {
      id: string;
      missing_products: {
        product_id: string;
        fragrance_id: string | null;
        variation_id: string | null;
        products: { name: string } | null;
        product_fragrances: { name: string } | null;
        product_variations: { literage: string } | null;
      } | null;
    };

    const resolvedItems = ((batchItems || []) as unknown as BatchItemRow[]).map((row) => {
      const productName = row.missing_products?.products?.name ?? "Produto removido";
      const fragranceName = row.missing_products?.product_fragrances?.name;
      const literage = row.missing_products?.product_variations?.literage;
      const parts = [fragranceName, literage].filter((part): part is string => Boolean(part));
      const name = parts.length > 0 ? `${productName} — ${parts.join(" — ")}` : productName;
      return { quoteBatchItemId: row.id, name };
    });

    if (resolvedItems.length === 0) {
      return jsonResponse(req, { error: "Este lote não tem itens." }, 400);
    }

    // Baixa cada arquivo ainda não processado e monta as parts de visão pro
    // request do Gemini — imagem ou PDF, conforme a extensão do caminho
    // salvo no Storage (o caminho sempre preserva a extensão do arquivo
    // original, ver useQuoteSupplierReview.ts). Pulado inteiramente no modo
    // texto colado (files fica vazio nesse caso).
    // Só marca processed_at nos arquivos que realmente viraram uma part —
    // um arquivo pulado (extensão não suportada, falha de download) não
    // pode desaparecer da fila de "ainda não processado", senão fica preso
    // pra sempre sem nenhuma forma de tentar de novo.
    const processedFileIds: string[] = [];
    const parts: Array<Record<string, unknown>> = [];
    let totalBytes = 0;
    for (const file of files) {
      const ext = file.storage_path.split(".").pop()?.toLowerCase() ?? "";
      const mediaType = MEDIA_TYPE_BY_EXT[ext];
      if (!mediaType) {
        console.error(`Extensão não suportada em ${file.storage_path}, pulando.`);
        continue;
      }
      const { data: blob, error: downloadError } = await adminClient.storage
        .from("quote-files")
        .download(file.storage_path);
      if (downloadError || !blob) {
        console.error(`Falha ao baixar ${file.storage_path}:`, downloadError);
        continue;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (totalBytes + bytes.length > MAX_TOTAL_BYTES) {
        console.error(`Pulando ${file.storage_path}: ultrapassaria o limite de tamanho do request.`);
        continue;
      }
      totalBytes += bytes.length;
      const base64 = encodeBase64(bytes);
      parts.push({ inline_data: { mime_type: mediaType, data: base64 } });
      processedFileIds.push(file.id);
    }

    if (!pastedText && parts.length === 0) {
      return jsonResponse(req, { error: "Não foi possível ler os arquivos enviados." }, 400);
    }

    const itemListText = resolvedItems.map((item) => `- ${item.name}`).join("\n");
    const promptText =
      `Você está lendo uma cotação de fornecedor (mensagem de texto, foto ou PDF) pra uma loja de produtos de limpeza. ` +
      `Aqui está a lista EXATA de itens que foram pedidos nessa cotação:\n\n${itemListText}\n\n` +
      `Encontre, no material fornecido abaixo, o preço unitário de cada item da lista acima. ` +
      `IGNORE qualquer outro produto que apareça mas não esteja nessa lista — o fornecedor pode vender outras coisas, ` +
      `mas só nos interessam os itens listados. Se um item da lista não aparecer, não o inclua na resposta. ` +
      `Além do preço, se o material trouxer alguma informação específica que ajude a confirmar exatamente qual ` +
      `variação daquele item é essa cotação — principalmente tamanho/litragem/peso quando o nome pedido não especifica um, ` +
      `mas também marca, cor ou se é um preço promocional — inclua essa informação num campo "note" curto (ex: "3L", "500ml ECO"). ` +
      `Só preencha "note" quando o material realmente trouxer algo relevante — não invente nem repita o que já está óbvio no nome do item. ` +
      `Responda APENAS com um array JSON, sem nenhum texto antes ou depois, no formato:\n` +
      `[{"item": "<nome exatamente como na lista>", "price": <número, sem "R$" nem separador de milhar, use ponto decimal>, "note": "<opcional, curto, ou omita se não houver nada relevante>"}]`;

    if (pastedText) {
      parts.push({ text: `Material da cotação (mensagem de texto colada):\n\n${pastedText}\n\n${promptText}` });
    } else {
      parts.push({ text: promptText });
    }

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

    if (geminiResponse.status === 429) {
      const errorText = await geminiResponse.text();
      console.error("Cota da API do Gemini excedida:", errorText);
      return jsonResponse(req, { error: "A cota gratuita da IA acabou por hoje. Tente de novo mais tarde." }, 429);
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Erro na API do Gemini:", geminiResponse.status, errorText);
      return jsonResponse(req, { error: "A IA não conseguiu processar os arquivos. Tente novamente." }, 502);
    }

    const geminiBody = await geminiResponse.json();
    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      console.error("Resposta da IA truncada por MAX_TOKENS:", geminiBody);
      return jsonResponse(req, { error: "A resposta da IA ficou grande demais e foi cortada. Tente com menos arquivos por vez." }, 502);
    }
    const textPart = (candidate?.content?.parts || []).find(
      (part: { text?: string; thought?: boolean }) => typeof part.text === "string" && part.thought !== true
    );
    if (!textPart?.text) {
      console.error("Nenhuma part de texto utilizável na resposta da IA:", geminiBody);
      return jsonResponse(req, { error: "A IA não retornou um resultado legível." }, 502);
    }

    let matches: GeminiMatch[];
    try {
      const jsonMatch = textPart.text.match(/\[[\s\S]*\]/);
      matches = JSON.parse(jsonMatch ? jsonMatch[0] : textPart.text);
    } catch (parseError) {
      console.error("Falha ao interpretar resposta da IA:", parseError, textPart.text);
      return jsonResponse(req, { error: "A IA retornou um formato inesperado. Tente novamente." }, 502);
    }

    const itemByName = new Map(resolvedItems.map((item) => [item.name, item.quoteBatchItemId]));
    let matchedCount = 0;

    for (const match of matches) {
      if (typeof match.price !== "number") continue;
      const quoteBatchItemId = itemByName.get(match.item);
      if (!quoteBatchItemId) continue;

      const updatePayload: Record<string, unknown> = {
        price: match.price,
        updated_by: caller.id,
        updated_by_name: callerStaff.display_name,
      };
      if (typeof match.note === "string" && match.note.trim() !== "") {
        updatePayload.notes = match.note.trim();
      }

      const { data: updateData, error: updateError } = await adminClient
        .from("quote_line_items")
        .update(updatePayload)
        .eq("quote_batch_supplier_id", quoteBatchSupplierId)
        .eq("quote_batch_item_id", quoteBatchItemId)
        .select("id");

      if (updateError) {
        console.error(`Falha ao salvar preço de ${match.item}:`, updateError);
        continue;
      }
      if (!updateData || updateData.length === 0) {
        console.error(`Nenhuma linha de preço encontrada pra ${match.item} (lote incompleto?).`);
        continue;
      }
      matchedCount += 1;
    }

    if (processedFileIds.length > 0) {
      const { error: markProcessedError } = await adminClient
        .from("quote_files")
        .update({ processed_at: new Date().toISOString() })
        .in("id", processedFileIds);
      if (markProcessedError) {
        console.error("Falha ao marcar arquivos como processados:", markProcessedError);
      }
    }

    return jsonResponse(
      req,
      {
        matched: matchedCount,
        totalItems: resolvedItems.length,
        filesProcessed: processedFileIds.length,
        filesSkipped: files.length - processedFileIds.length,
      },
      200
    );
  } catch (error) {
    console.error("Erro inesperado em extract-quote-prices:", error);
    return jsonResponse(req, { error: "Erro inesperado ao processar a cotação." }, 500);
  }
});
```

- [ ] **Step 2: Aplicar a function no projeto Supabase**

Usar `mcp__claude_ai_Supabase__deploy_edge_function` com `project_id: "ccrucholgsffichvzbpz"`, `name: "extract-quote-prices"`, `entrypoint_path: "index.ts"`, `verify_jwt: false` (esta function já tinha isso desabilitado — checar `supabase/config.toml`, seção `[functions.extract-quote-prices]`, antes de aplicar, pra confirmar) e o conteúdo do Step 1 como único arquivo `index.ts`.

- [ ] **Step 3: Verificar que os acentos não foram corrompidos**

Rodar `mcp__claude_ai_Supabase__get_edge_function` com o mesmo `project_id` e `function_slug: "extract-quote-prices"`, e conferir no `content` retornado que palavras como "não", "cotação", "está" aparecem com acento normal (não como `Ã£o`/sequências quebradas). Se vier corrompido, reaplicar o deploy.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/extract-quote-prices/index.ts
git commit -m "feat(cotacoes): extração por IA aceita texto colado, além de arquivo"
```

---

### Task 3: Colar texto + Importar Excel na tela do fornecedor

**Files:**
- Modify: `src/hooks/useQuoteSupplierReview.ts`
- Modify: `src/components/quotes/QuoteBatchSupplierReview.tsx`

**Interfaces:**
- Consome: `parseQuoteRequestExcel` de `src/lib/quoteExcel.ts` (Task 1).
- Produz: `runExtraction` do hook `useQuoteSupplierReview` passa a aceitar um argumento opcional `pastedText?: string`.

- [ ] **Step 1: `runExtraction` aceita texto colado**

Em `src/hooks/useQuoteSupplierReview.ts`, trocar a assinatura e o corpo de `runExtraction` (linhas 162-186 no arquivo atual):

```ts
  const runExtraction = async (pastedText?: string) => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-quote-prices', {
        body: pastedText ? { quoteBatchSupplierId, pastedText } : { quoteBatchSupplierId },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, 'Não foi possível extrair os preços.');
        toast({ title: 'Erro na extração', description: message, variant: 'destructive' });
        return;
      }
      const skippedNote =
        data.filesSkipped > 0 ? ` ${data.filesSkipped} arquivo(s) não pôde(puderam) ser lido(s).` : '';
      toast({
        title: 'Extração concluída',
        description: `A IA encontrou preço pra ${data.matched} de ${data.totalItems} item(ns).${skippedNote}`,
      });
      await fetchData();
    } catch (error) {
      console.error('Error running quote extraction:', error);
      toast({ title: 'Erro na extração', description: 'Não foi possível extrair os preços.', variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  };
```

(A única mudança real é a assinatura `async (pastedText?: string)` e o `body` condicional — o resto do corpo é idêntico ao atual.)

- [ ] **Step 2: Novos imports em `QuoteBatchSupplierReview.tsx`**

Trocar o bloco de imports do topo do arquivo por:

```tsx
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, RotateCcw, Sparkles, Check, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuoteSupplierReview } from '@/hooks/useQuoteSupplierReview';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { parseQuoteRequestExcel } from '@/lib/quoteExcel';
import { toast } from '@/hooks/use-toast';
import { QuoteBatchDetailItem } from '@/hooks/useQuoteBatchDetail';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';
```

- [ ] **Step 3: Novo estado e handlers**

Logo após a declaração de `const [isMarking, setIsMarking] = useState(false);` (dentro do componente), adicionar:

```tsx
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedTextValue, setPastedTextValue] = useState('');
  const [importingExcel, setImportingExcel] = useState(false);
```

Depois da função `handleMarkReviewed` (antes do `return (`), adicionar:

```tsx
  const handleExtractFromText = async () => {
    const trimmed = pastedTextValue.trim();
    if (trimmed === '') return;
    await runExtraction(trimmed);
    setPastedTextValue('');
    setIsPasteOpen(false);
  };

  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (!file) return;

    setImportingExcel(true);
    try {
      const rows = await parseQuoteRequestExcel(file);
      const knownItemIds = new Set(items.map((item) => item.id));
      let matched = 0;
      for (const row of rows) {
        if (!knownItemIds.has(row.itemId)) continue;
        if (row.price !== null) {
          await updatePrice(row.itemId, row.price);
        }
        if (row.note !== null) {
          await updateNote(row.itemId, row.note);
        }
        matched += 1;
      }
      toast({
        title: 'Planilha importada',
        description: `${matched} de ${rows.length} linha(s) reconhecida(s) e aplicada(s).`,
      });
    } catch (error) {
      console.error('Error importing quote excel:', error);
      toast({ title: 'Erro ao importar', description: 'Não foi possível ler essa planilha.', variant: 'destructive' });
    } finally {
      setImportingExcel(false);
    }
  };
```

- [ ] **Step 4: Trocar o bloco de botões e adicionar a caixa de texto colado**

Trocar o bloco (dentro de `<div className="space-y-2">` da seção "Arquivos da cotação"):

```tsx
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              onChange={handleFileChange}
              disabled={uploading || isReadOnly}
              className="hidden"
              id="quote-file-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading || isReadOnly}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar arquivo(s)'}
            </Button>
            <Button size="sm" disabled={extracting || unprocessedCount === 0 || isReadOnly} onClick={runExtraction}>
              <Sparkles className="h-4 w-4 mr-2" />
              {extracting ? 'Extraindo...' : `Extrair com IA (${unprocessedCount} novo(s))`}
            </Button>
          </div>
```

por:

```tsx
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              onChange={handleFileChange}
              disabled={uploading || isReadOnly}
              className="hidden"
              id="quote-file-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading || isReadOnly}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar arquivo(s)'}
            </Button>
            <Button size="sm" disabled={extracting || unprocessedCount === 0 || isReadOnly} onClick={() => runExtraction()}>
              <Sparkles className="h-4 w-4 mr-2" />
              {extracting ? 'Extraindo...' : `Extrair com IA (${unprocessedCount} novo(s))`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isReadOnly}
              onClick={() => setIsPasteOpen((prev) => !prev)}
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Colar texto
            </Button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              disabled={importingExcel || isReadOnly}
              className="hidden"
              id="quote-excel-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={importingExcel || isReadOnly}
              onClick={() => excelInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {importingExcel ? 'Importando...' : 'Importar Excel'}
            </Button>
          </div>
          {isPasteOpen && (
            <div className="space-y-2 border rounded-md p-3">
              <Textarea
                placeholder="Cole aqui o texto que o fornecedor mandou no WhatsApp..."
                value={pastedTextValue}
                onChange={(e) => setPastedTextValue(e.target.value)}
                disabled={extracting || isReadOnly}
                rows={6}
              />
              <Button
                size="sm"
                disabled={extracting || pastedTextValue.trim() === '' || isReadOnly}
                onClick={handleExtractFromText}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {extracting ? 'Extraindo...' : 'Extrair do texto colado'}
              </Button>
            </div>
          )}
```

Nota: o botão "Extrair com IA" muda de `onClick={runExtraction}` pra `onClick={() => runExtraction()}` — chamando direto, `runExtraction` recebia o clique como argumento e agora que aceita `pastedText?: string` isso quebraria (o evento de clique não é `undefined`, então cairia no branch errado do `body` condicional dentro do hook).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQuoteSupplierReview.ts src/components/quotes/QuoteBatchSupplierReview.tsx
git commit -m "feat(cotacoes): colar texto e importar Excel na tela do fornecedor"
```

---

### Task 4: Exportar Excel na tela do lote

**Files:**
- Modify: `src/components/quotes/QuoteBatchDetail.tsx`

**Interfaces:**
- Consome: `buildQuoteRequestExcel` de `src/lib/quoteExcel.ts` (Task 1).

- [ ] **Step 1: Novo import**

Trocar a linha de import dos ícones e adicionar o import da função de export:

```tsx
import { ArrowLeft, ArrowRightLeft, Plus, X, FileSpreadsheet } from 'lucide-react';
```

Adicionar, junto dos outros imports de `@/lib`:

```tsx
import { buildQuoteRequestExcel } from '@/lib/quoteExcel';
```

- [ ] **Step 2: Handler de exportação**

O componente já tem, nesta ordem: `productById` (logo no início), depois o `if (selectedSupplierId) { return ...}`, depois `handleCancel`, depois o guard `if (loading || !batch) { return <Card>...</Card>; }`. `handleExportExcel` referencia `batch.created_at`, então só pode ser declarada **depois** desse guard — antes disso, `batch` ainda é tipado como `QuoteBatchDetail | null`. Adicionar logo depois do bloco:

```tsx
  if (loading || !batch) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AdminLoadingState rows={4} tone="light" />
        </CardContent>
      </Card>
    );
  }
```

o novo handler:

```tsx
  const handleExportExcel = () => {
    const rows = items.map((item) => ({
      id: item.id,
      displayName: buildMissingItemDisplayName(productById.get(item.product_id), item.fragrance_id, item.variation_id),
    }));
    const batchLabel = new Date(batch.created_at).toLocaleDateString('pt-BR').replace(/\//g, '-');
    buildQuoteRequestExcel(rows, batchLabel);
  };
```

(antes do `return (` que monta o JSX principal do componente.)

- [ ] **Step 3: Botão "Exportar Excel" na seção de Itens**

Trocar:

```tsx
        <div className="space-y-2">
          <p className="text-sm font-medium">Itens ({items.length})</p>
          <div className="space-y-1">
```

por:

```tsx
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Itens ({items.length})</p>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
          <div className="space-y-1">
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/QuoteBatchDetail.tsx
git commit -m "feat(cotacoes): exportar planilha Excel com os itens do lote"
```

---

## Fora de escopo (herdado da spec)

- Casamento por nome como *fallback* quando o ID da planilha não bate.
- Suporte a `.csv`.
- Sincronização bidirecional automática entre planilha e sistema.
- Verificação visual ao vivo no navegador — cada task usa `npm run build` como checagem; revisão fica por conta do usuário depois do Publish no Lovable.
