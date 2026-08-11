import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

interface ReassignSuggestion {
  item: string;
  supplier: string;
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
    const quoteBatchId = typeof body?.quoteBatchId === "string" ? body.quoteBatchId : "";
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!quoteBatchId || !command) {
      return jsonResponse(req, { error: "quoteBatchId e command são obrigatórios." }, 400);
    }

    const { data: batch, error: batchError } = await adminClient
      .from("quote_batches")
      .select("id, status")
      .eq("id", quoteBatchId)
      .maybeSingle();
    if (batchError || !batch) {
      return jsonResponse(req, { error: "Lote de cotação não encontrado." }, 404);
    }
    if (batch.status !== "aberto") {
      return jsonResponse(req, { error: "Este lote não está mais aberto." }, 400);
    }

    const { data: itemRows, error: itemsError } = await adminClient
      .from("quote_batch_items")
      .select(
        "id, quantity, missing_products(product_id, fragrance_id, variation_id, products(name), product_fragrances(name), product_variations(literage))"
      )
      .eq("quote_batch_id", quoteBatchId);
    if (itemsError) throw itemsError;

    type ItemRow = {
      id: string;
      quantity: number;
      missing_products: {
        products: { name: string } | null;
        product_fragrances: { name: string } | null;
        product_variations: { literage: string } | null;
      } | null;
    };
    const resolvedItems = ((itemRows || []) as unknown as ItemRow[]).map((row) => {
      const productName = row.missing_products?.products?.name ?? "Produto removido";
      const fragranceName = row.missing_products?.product_fragrances?.name;
      const literage = row.missing_products?.product_variations?.literage;
      const parts = [fragranceName, literage].filter((part): part is string => Boolean(part));
      const name = parts.length > 0 ? `${productName} — ${parts.join(" — ")}` : productName;
      return { id: row.id, name, quantity: row.quantity };
    });

    const { data: supplierRows, error: suppliersError } = await adminClient
      .from("quote_batch_suppliers")
      .select("id, suppliers(company_name), quote_line_items(quote_batch_item_id, price)")
      .eq("quote_batch_id", quoteBatchId);
    if (suppliersError) throw suppliersError;

    type SupplierRow = {
      id: string;
      suppliers: { company_name: string } | null;
      quote_line_items: { quote_batch_item_id: string; price: number | null }[];
    };
    const typedSuppliers = (supplierRows || []) as unknown as SupplierRow[];
    const resolvedSuppliers = typedSuppliers.map((row) => ({
      id: row.id,
      name: row.suppliers?.company_name ?? "Fornecedor removido",
    }));

    const priceByKey = new Map<string, number>();
    for (const supplierRow of typedSuppliers) {
      for (const lineItem of supplierRow.quote_line_items) {
        if (lineItem.price !== null) {
          priceByKey.set(`${lineItem.quote_batch_item_id}::${supplierRow.id}`, lineItem.price);
        }
      }
    }

    const { data: winnerRows, error: winnersError } = await adminClient
      .from("quote_item_winners")
      .select("quote_batch_item_id, quote_batch_supplier_id")
      .in(
        "quote_batch_item_id",
        resolvedItems.map((item) => item.id)
      );
    if (winnersError) throw winnersError;
    const winnerBySupplierId = new Map<string, string>();
    for (const row of winnerRows || []) {
      winnerBySupplierId.set(row.quote_batch_item_id as string, row.quote_batch_supplier_id as string);
    }
    const supplierNameById = new Map(resolvedSuppliers.map((s) => [s.id, s.name]));

    const itemsBlock = resolvedItems
      .map((item) => {
        const offers = resolvedSuppliers
          .map((supplier) => {
            const price = priceByKey.get(`${item.id}::${supplier.id}`);
            if (price === undefined) return null;
            const isWinner = winnerBySupplierId.get(item.id) === supplier.id;
            return `  - ${supplier.name}: R$ ${price.toFixed(2)}${isWinner ? " (vencedor atual)" : ""}`;
          })
          .filter((line): line is string => line !== null);
        return `${item.name} (quantidade: ${item.quantity}):\n${offers.join("\n") || "  (nenhum fornecedor cotou)"}`;
      })
      .join("\n\n");

    const promptText =
      `Você ajuda a decidir qual fornecedor vence cada item de um lote de cotação de uma loja de produtos de limpeza. ` +
      `Fornecedores deste lote: ${resolvedSuppliers.map((s) => s.name).join(", ")}.\n\n` +
      `Itens, preços cotados por fornecedor e vencedor atual:\n\n${itemsBlock}\n\n` +
      `Comando da pessoa: "${command}"\n\n` +
      `Interprete o comando e devolva as reatribuições de vencedor necessárias. Se o comando pedir pra tirar um ` +
      `fornecedor de tudo que ele venceu, reatribua cada item dele pro fornecedor de menor preço seguinte entre os ` +
      `que cotaram aquele item (nunca o fornecedor removido). Só reatribua entre os fornecedores listados acima — ` +
      `nunca invente fornecedor novo. Se não for possível cumprir uma parte do comando (não há outro fornecedor pra ` +
      `um item, por exemplo), simplesmente não inclua esse item no resultado. Responda APENAS com um array JSON, sem ` +
      `texto antes ou depois, no formato: [{"item": "<nome exatamente como listado acima>", "supplier": "<nome ` +
      `exatamente como listado acima>"}]. Se nenhuma reatribuição fizer sentido, responda [].`;

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

    if (geminiResponse.status === 429) {
      const errorText = await geminiResponse.text();
      console.error("Cota da API do Gemini excedida:", errorText);
      return jsonResponse(req, { error: "A cota gratuita da IA acabou por hoje. Tente de novo mais tarde." }, 429);
    }
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Erro na API do Gemini:", geminiResponse.status, errorText);
      return jsonResponse(req, { error: "A IA não conseguiu processar o comando. Tente novamente." }, 502);
    }

    const geminiBody = await geminiResponse.json();
    const candidate = geminiBody.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      console.error("Resposta da IA truncada por MAX_TOKENS:", geminiBody);
      return jsonResponse(req, { error: "A resposta da IA ficou grande demais e foi cortada." }, 502);
    }
    const textPart = (candidate?.content?.parts || []).find(
      (part: { text?: string; thought?: boolean }) => typeof part.text === "string" && part.thought !== true
    );
    if (!textPart?.text) {
      console.error("Nenhuma part de texto utilizável na resposta da IA:", geminiBody);
      return jsonResponse(req, { error: "A IA não retornou um resultado legível." }, 502);
    }

    let suggestions: ReassignSuggestion[];
    try {
      const jsonMatch = textPart.text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : textPart.text);
      if (!Array.isArray(parsed)) {
        throw new Error("Resposta da IA não é um array.");
      }
      suggestions = parsed;
    } catch (parseError) {
      console.error("Falha ao interpretar resposta da IA:", parseError, textPart.text);
      return jsonResponse(req, { error: "A IA retornou um formato inesperado. Tente novamente." }, 502);
    }

    const itemIdByName = new Map(resolvedItems.map((item) => [item.name, item.id]));
    const supplierIdByName = new Map(resolvedSuppliers.map((s) => [s.name, s.id]));

    let applied = 0;
    let skipped = 0;
    const toUpsert: Array<{
      quote_batch_item_id: string;
      quote_batch_supplier_id: string;
      source: "ia";
      set_by: string;
      set_by_name: string;
      set_at: string;
    }> = [];

    for (const suggestion of suggestions) {
      const itemId = itemIdByName.get(suggestion.item);
      const supplierId = supplierIdByName.get(suggestion.supplier);
      const price = itemId && supplierId ? priceByKey.get(`${itemId}::${supplierId}`) : undefined;
      if (!itemId || !supplierId || price === undefined) {
        skipped += 1;
        continue;
      }
      toUpsert.push({
        quote_batch_item_id: itemId,
        quote_batch_supplier_id: supplierId,
        source: "ia",
        set_by: caller.id,
        set_by_name: callerStaff.display_name,
        set_at: new Date().toISOString(),
      });
      applied += 1;
    }

    if (toUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from("quote_item_winners")
        .upsert(toUpsert, { onConflict: "quote_batch_item_id" });
      if (upsertError) throw upsertError;
    }

    return jsonResponse(req, { applied, skipped }, 200);
  } catch (error) {
    console.error("Erro inesperado em apply-quote-reassignment:", error);
    return jsonResponse(req, { error: "Erro inesperado ao aplicar o comando." }, 500);
  }
});
