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

// ~82MB em base64 (bytes * ~1.37), com folga sob o limite de request
// inline de ~100MB da API do Gemini.
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

interface GeminiMatch {
  item: string;
  price: number | null;
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

    const { data: files, error: filesError } = await adminClient
      .from("quote_files")
      .select("id, storage_path")
      .eq("quote_batch_supplier_id", quoteBatchSupplierId)
      .is("processed_at", null);
    if (filesError) throw filesError;

    if (!files || files.length === 0) {
      return jsonResponse(req, { error: "Nenhum arquivo novo pra processar." }, 400);
    }

    // Monta a lista de itens pedidos nesse lote, com o nome resolvido
    // (Produto — Fragrância — Tamanho), pra IA casar contra o arquivo do
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
    // original, ver useQuoteSupplierReview.ts).
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

    if (parts.length === 0) {
      return jsonResponse(req, { error: "Não foi possível ler os arquivos enviados." }, 400);
    }

    const itemListText = resolvedItems.map((item) => `- ${item.name}`).join("\n");
    const promptText =
      `Você está lendo uma cotação de fornecedor (foto ou PDF) pra uma loja de produtos de limpeza. ` +
      `Aqui está a lista EXATA de itens que foram pedidos nessa cotação:\n\n${itemListText}\n\n` +
      `Encontre, no(s) arquivo(s) anexado(s), o preço unitário de cada item da lista acima. ` +
      `IGNORE qualquer outro produto que apareça no arquivo mas não esteja nessa lista — o fornecedor pode vender outras coisas, ` +
      `mas só nos interessam os itens listados. Se um item da lista não aparecer no arquivo, não o inclua na resposta. ` +
      `Responda APENAS com um array JSON, sem nenhum texto antes ou depois, no formato:\n` +
      `[{"item": "<nome exatamente como na lista>", "price": <número, sem "R$" nem separador de milhar, use ponto decimal>}]`;

    parts.push({ text: promptText });

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

      const { data: updateData, error: updateError } = await adminClient
        .from("quote_line_items")
        .update({
          price: match.price,
          updated_by: caller.id,
          updated_by_name: callerStaff.display_name,
        })
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
