import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "product-images";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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

// Baixa a foto sugerida pela IA (research-product) e o usuário aprovou usar,
// e sobe pro nosso Storage. Precisa ser server-side: a URL vem de qualquer
// lugar da web indicado pela busca do Gemini, e a maioria desses hosts não
// libera CORS pro navegador ler os bytes direto (fetch cross-origin falharia
// no client). Mesmo padrão de auth do research-product: verify_jwt=false no
// config.toml pra não travar o preflight, checagem manual aqui dentro.
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
    const sourceUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
      return jsonResponse(req, { error: "url inválida." }, 400);
    }

    let sourceResponse: Response;
    try {
      sourceResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    } catch (fetchError) {
      console.error("Falha ao baixar imagem sugerida:", fetchError);
      return jsonResponse(req, { error: "Não foi possível baixar essa foto." }, 502);
    }
    if (!sourceResponse.ok) {
      return jsonResponse(req, { error: "Não foi possível baixar essa foto." }, 502);
    }

    const contentType = sourceResponse.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const extension = ALLOWED_TYPES[contentType];
    if (!extension) {
      return jsonResponse(req, { error: "Formato de imagem não suportado." }, 415);
    }

    const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return jsonResponse(req, { error: "Imagem inválida ou grande demais." }, 413);
    }

    const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, cacheControl: "31536000" });
    if (uploadError) {
      console.error("Falha ao subir imagem pro Storage:", uploadError);
      return jsonResponse(req, { error: "Falha ao salvar a imagem." }, 500);
    }

    const { data: publicUrlData } = adminClient.storage.from(BUCKET).getPublicUrl(path);
    return jsonResponse(req, { url: publicUrlData.publicUrl }, 200);
  } catch (error) {
    console.error("Erro inesperado em upload-image-from-url:", error);
    return jsonResponse(req, { error: "Erro inesperado ao salvar a imagem." }, 500);
  }
});
