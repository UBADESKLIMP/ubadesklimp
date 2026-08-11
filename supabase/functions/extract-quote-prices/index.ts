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

interface ClaudeMatch {
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
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      console.error("ANTHROPIC_API_KEY não configurada.");
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

    // Baixa cada arquivo ainda não processado e monta os content blocks de
    // visão pro request da Claude — imagem ou PDF, conforme a extensão do
    // caminho salvo no Storage (ver useQuoteSupplierReview, Task 7: o
    // caminho sempre preserva a extensão do arquivo original).
    // Só marca processed_at nos arquivos que realmente viraram um content
    // block — um arquivo pulado (extensão não suportada, falha de download)
    // não pode desaparecer da fila de "ainda não processado" (files.filter
    // abaixo), senão fica preso pra sempre sem nenhuma forma de tentar de
    // novo.
    const processedFileIds: string[] = [];
    const contentBlocks: Array<Record<string, unknown>> = [];
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
      const base64 = encodeBase64(bytes);
      contentBlocks.push({
        type: mediaType === "application/pdf" ? "document" : "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
      processedFileIds.push(file.id);
    }

    if (contentBlocks.length === 0) {
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

    contentBlocks.push({ type: "text", text: promptText });

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        // Sonnet 5 liga "thinking" adaptativo por padrão quando o parâmetro
        // não é informado, e max_tokens é o teto de thinking+resposta
        // somados — 2048 deixava o thinking consumir o orçamento inteiro
        // antes de gerar o JSON. Desliga o thinking (não precisamos de
        // raciocínio encadeado pra esse tipo de extração) e dá folga real
        // pra resposta.
        max_tokens: 8192,
        thinking: { type: "disabled" },
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error("Erro na API da Claude:", claudeResponse.status, errorText);
      return jsonResponse(req, { error: "A IA não conseguiu processar os arquivos. Tente novamente." }, 502);
    }

    const claudeBody = await claudeResponse.json();
    if (claudeBody.stop_reason === "max_tokens") {
      console.error("Resposta da IA truncada por max_tokens:", claudeBody);
      return jsonResponse(req, { error: "A resposta da IA ficou grande demais e foi cortada. Tente com menos arquivos por vez." }, 502);
    }
    const textBlock = (claudeBody.content || []).find((block: { type: string }) => block.type === "text");
    if (!textBlock?.text) {
      return jsonResponse(req, { error: "A IA não retornou um resultado legível." }, 502);
    }

    let matches: ClaudeMatch[];
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      matches = JSON.parse(jsonMatch ? jsonMatch[0] : textBlock.text);
    } catch (parseError) {
      console.error("Falha ao interpretar resposta da IA:", parseError, textBlock.text);
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
