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

interface ResearchSize {
  literage: string;
  image_url: string | null;
}

interface ResearchFragrance {
  name: string;
  image_url: string | null;
}

interface ResearchResult {
  confidence: "high" | "low" | "none";
  name: string | null;
  description: string | null;
  category: string | null;
  material: string | null;
  validity: string | null;
  specifications: string | null;
  brand: string | null;
  action_type: string | null;
  ph_level: string | null;
  application_area: string | null;
  main_image_url: string | null;
  sizes: ResearchSize[];
  fragrances: ResearchFragrance[];
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
      .select("is_admin")
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
      if (!permissionSet.has("produtos")) {
        return jsonResponse(req, { error: "Você não tem permissão para produtos." }, 403);
      }
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const sizeHint = typeof body?.sizeHint === "string" ? body.sizeHint.trim() : "";
    const lineType = body?.lineType === "automotivo" ? "automotivo" : "limpeza";
    if (!name) {
      return jsonResponse(req, { error: "name é obrigatório." }, 400);
    }

    const { data: categoryRows, error: categoriesError } = await adminClient
      .from("categories")
      .select("name")
      .eq("type", lineType)
      .order("name");
    if (categoriesError) throw categoriesError;
    const existingCategories = (categoryRows || []).map((row) => row.name as string);

    const fieldsBlock =
      lineType === "automotivo"
        ? `"brand": string ou null (marca do produto, ex: "Vonixx", "Vintex"),
"action_type": string ou null (ex: "Desengraxante", "Limpador"),
"ph_level": string ou null (ex: "Neutro", "Ácido", "7.0"),
"application_area": string ou null (ex: "Motor", "Lataria", "Rodas")`
        : `"material": string ou null (ex: "Plástico", "Metal"),
"validity": string ou null (ex: "2 anos", "6 meses"),
"specifications": string ou null (informações adicionais em texto livre)`;

    const promptText =
      `Você ajuda a cadastrar produtos numa loja de produtos de ${lineType === "automotivo" ? "estética automotiva" : "limpeza"} no Brasil. ` +
      `A pessoa digitou o nome "${name}"${sizeHint ? ` e informou que um dos tamanhos vendidos é "${sizeHint}"` : ""}. ` +
      `Use busca do Google pra pesquisar esse produto real e devolver os dados dele.\n\n` +
      `Categorias já cadastradas nesta loja para esta linha (reaproveite uma destas sempre que fizer sentido, em vez de inventar uma nova parecida): ` +
      `${existingCategories.length > 0 ? existingCategories.join(", ") : "(nenhuma cadastrada ainda)"}.\n\n` +
      `Regras importantes:\n` +
      `- O campo "name" da resposta deve seguir o padrão "Tipo + Marca" já usado no catálogo desta loja, por exemplo: "Multiuso Veja", "Cera de Carnaúba Hybrid Wax Vonixx", "Soda Líquida Ita". Nunca inclua o tamanho dentro do nome.\n` +
      `- Se você não tiver certeza de um dado, devolva null nesse campo em vez de chutar. Nunca invente especificação técnica.\n` +
      `- Em "sizes", liste TODOS os tamanhos/volumes desse produto que você conseguir confirmar que são vendidos de verdade (ex: 500ml, 1L, 5L), cada um com uma URL de foto candidata daquele tamanho específico se achar (ou null). Se só existir 1 tamanho, devolva só ele.\n` +
      `- Em "fragrances", liste as variações de fragrância/cheiro desse produto, se ele tiver mais de uma (ex: "Regular", "Flor de Laranjeira", "Talco"), cada uma com uma URL de foto candidata daquela fragrância se achar (ou null). Se o produto não tiver fragrâncias diferentes, devolva uma lista vazia.\n` +
      `- "confidence" deve ser "high" se você reconhece o produto com confiança, "low" se achou algo mas não tem certeza, ou "none" se não conseguiu identificar esse produto de jeito nenhum.\n\n` +
      `Responda APENAS com um objeto JSON, sem nenhum texto antes ou depois, exatamente neste formato:\n` +
      `{\n` +
      `"confidence": "high" | "low" | "none",\n` +
      `"name": string ou null,\n` +
      `"description": string ou null,\n` +
      `"category": string ou null,\n` +
      `${fieldsBlock},\n` +
      `"main_image_url": string ou null,\n` +
      `"sizes": [{ "literage": string, "image_url": string ou null }],\n` +
      `"fragrances": [{ "name": string, "image_url": string ou null }]\n` +
      `}`;

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

    if (geminiResponse.status === 429) {
      const errorText = await geminiResponse.text();
      console.error("Cota da API do Gemini excedida:", errorText);
      return jsonResponse(req, { error: "A cota gratuita da IA acabou por hoje. Tente de novo mais tarde." }, 429);
    }
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Erro na API do Gemini:", geminiResponse.status, errorText);
      return jsonResponse(req, { error: "A IA não conseguiu pesquisar esse produto. Tente novamente." }, 502);
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

    let result: Partial<ResearchResult> & { sizes?: unknown; fragrances?: unknown };
    try {
      const jsonMatch = textPart.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : textPart.text);
    } catch (parseError) {
      console.error("Falha ao interpretar resposta da IA:", parseError, textPart.text);
      return jsonResponse(req, { error: "A IA retornou um formato inesperado. Tente novamente." }, 502);
    }

    const rawSizes = Array.isArray(result.sizes) ? (result.sizes as Array<Record<string, unknown>>) : [];
    const rawFragrances = Array.isArray(result.fragrances) ? (result.fragrances as Array<Record<string, unknown>>) : [];

    // A IA só pode reaproveitar uma categoria que já existe no cadastro desta
    // loja. Se ela devolver algo que não bate com nenhuma existente (mesmo
    // ignorando maiúsculas/minúsculas e espaços), o campo vira null em vez de
    // persistir uma categoria "fantasma" que não aparece no <Select> do
    // formulário (que só lista as categorias reais).
    const rawCategory = typeof result.category === "string" ? result.category.trim() : "";
    const matchedCategory = rawCategory
      ? existingCategories.find((cat) => cat.trim().toLowerCase() === rawCategory.toLowerCase()) ?? null
      : null;

    const normalized: ResearchResult = {
      confidence: result.confidence === "high" || result.confidence === "low" ? result.confidence : "none",
      name: typeof result.name === "string" && result.name.trim() ? result.name.trim() : null,
      description: typeof result.description === "string" ? result.description : null,
      category: matchedCategory,
      material: typeof result.material === "string" ? result.material : null,
      validity: typeof result.validity === "string" ? result.validity : null,
      specifications: typeof result.specifications === "string" ? result.specifications : null,
      brand: typeof result.brand === "string" ? result.brand : null,
      action_type: typeof result.action_type === "string" ? result.action_type : null,
      ph_level: typeof result.ph_level === "string" ? result.ph_level : null,
      application_area: typeof result.application_area === "string" ? result.application_area : null,
      main_image_url: typeof result.main_image_url === "string" ? result.main_image_url : null,
      sizes: rawSizes
        .filter((s) => typeof s.literage === "string" && (s.literage as string).trim().length > 0)
        .map((s) => ({
          literage: (s.literage as string).trim(),
          image_url: typeof s.image_url === "string" ? (s.image_url as string) : null,
        })),
      fragrances: rawFragrances
        .filter((f) => typeof f.name === "string" && (f.name as string).trim().length > 0)
        .map((f) => ({
          name: (f.name as string).trim(),
          image_url: typeof f.image_url === "string" ? (f.image_url as string) : null,
        })),
    };

    return jsonResponse(req, normalized, 200);
  } catch (error) {
    console.error("Erro inesperado em research-product:", error);
    return jsonResponse(req, { error: "Erro inesperado ao pesquisar o produto." }, 500);
  }
});
