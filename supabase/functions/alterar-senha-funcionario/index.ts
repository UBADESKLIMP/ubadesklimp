import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Precisa ficar idêntico ao sufixo usado em criar-funcionario e no login
// (AuthContext.tsx) — senão a senha trocada aqui nunca bate na hora de entrar.
const STAFF_PIN_SUFFIX = "-pin";

// Reflete de volta exatamente os cabeçalhos que o navegador pediu no
// preflight, em vez de uma lista fixa — mesmo padrão das outras functions de
// funcionário (ver criar-funcionario/index.ts).
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

    if (!callerStaff?.is_admin) {
      return jsonResponse(req, { error: "Apenas administradores podem alterar senha de funcionário" }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!targetUserId || !UUID_RE.test(targetUserId)) {
      return jsonResponse(req, { error: "userId inválido" }, 400);
    }
    // Mesma regra de PIN da criação (criar-funcionario/index.ts:99) — decisão
    // já aceita de praticidade (equipe loga no chão da loja) sobre segurança.
    if (!/^\d{4}$/.test(newPassword)) {
      return jsonResponse(req, { error: "Senha precisa ter exatamente 4 dígitos numéricos." }, 400);
    }

    const { data: targetStaff } = await adminClient
      .from("staff_members")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetStaff) {
      return jsonResponse(req, { error: "Usuário não é um funcionário." }, 404);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword + STAFF_PIN_SUFFIX,
    });

    if (updateError) {
      return jsonResponse(req, { error: updateError.message }, 500);
    }

    // Registro mínimo de auditoria — mesma convenção de criar/excluir-funcionario.
    console.log(`Senha alterada: funcionário ${targetUserId} (por admin ${caller.id})`);

    return jsonResponse(req, { success: true }, 200);
  } catch (error) {
    console.error("Erro inesperado em alterar-senha-funcionario:", error);
    return jsonResponse(req, { error: "Erro inesperado ao alterar senha." }, 500);
  }
});
