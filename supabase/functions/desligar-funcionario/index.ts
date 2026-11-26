import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reflete os cabeçalhos pedidos no preflight (mesmo padrão de excluir-funcionario).
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

/**
 * Desligar / reativar funcionário.
 *
 * Excluir a conta de verdade não é possível (nem desejável): o ponto, os atrasos,
 * as justificativas e as medidas apontam para a pessoa e precisam ser guardados.
 * Desligar = bloqueia o login, embaralha a senha (o PIN deixa de valer em qualquer
 * tela), tira permissões e papéis, e marca staff_members.desligado_em.
 * Reativar = desbloqueia; a pessoa volta sem senha válida e o admin define um PIN novo.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, { error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return jsonResponse(req, { error: "Não autenticado" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerStaff } = await adminClient
      .from("staff_members")
      .select("is_admin")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerStaff?.is_admin) {
      return jsonResponse(req, { error: "Apenas administradores podem desligar funcionários" }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";
    const acao = body?.acao === "reativar" ? "reativar" : "desligar";

    if (!UUID_RE.test(targetUserId)) return jsonResponse(req, { error: "userId inválido" }, 400);
    if (targetUserId === caller.id) {
      return jsonResponse(req, { error: "Você não pode desligar a si mesmo." }, 400);
    }

    const { data: target } = await adminClient
      .from("staff_members")
      .select("user_id, is_admin, desligado_em")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!target) return jsonResponse(req, { error: "Usuário não é um funcionário." }, 404);

    if (acao === "reativar") {
      if (!target.desligado_em) return jsonResponse(req, { success: true }, 200);
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (unbanError) return jsonResponse(req, { error: unbanError.message }, 500);
      const { error: updError } = await adminClient
        .from("staff_members")
        .update({ desligado_em: null })
        .eq("user_id", targetUserId);
      if (updError) return jsonResponse(req, { error: updError.message }, 500);
      console.log(`Funcionário reativado: ${targetUserId} (por admin ${caller.id})`);
      return jsonResponse(req, { success: true }, 200);
    }

    if (target.desligado_em) return jsonResponse(req, { success: true }, 200);

    // Nunca deixar zero admins ativos.
    if (target.is_admin) {
      const { count: adminCount } = await adminClient
        .from("staff_members")
        .select("user_id", { count: "exact", head: true })
        .eq("is_admin", true)
        .is("desligado_em", null);
      if ((adminCount ?? 0) <= 1) {
        return jsonResponse(req, { error: "Não é possível desligar o último administrador." }, 400);
      }
    }

    // 1) Bloqueia o login e embaralha a senha: o PIN para de valer em tudo.
    const senhaDescartada = crypto.randomUUID() + crypto.randomUUID();
    const { error: banError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h",
      password: senhaDescartada,
    });
    if (banError) return jsonResponse(req, { error: banError.message }, 500);

    // 2) Tira permissões e papéis (o histórico de ponto não é tocado).
    await adminClient.from("staff_permissions").delete().eq("user_id", targetUserId);
    await adminClient.from("equipe_papeis").delete().eq("user_id", targetUserId);

    // 3) Marca como desligado (e deixa de ser admin, se era).
    const { error: updError } = await adminClient
      .from("staff_members")
      .update({ desligado_em: new Date().toISOString(), is_admin: false })
      .eq("user_id", targetUserId);
    if (updError) return jsonResponse(req, { error: updError.message }, 500);

    console.log(`Funcionário desligado: ${targetUserId} (por admin ${caller.id})`);
    return jsonResponse(req, { success: true }, 200);
  } catch (error) {
    console.error("Erro inesperado em desligar-funcionario:", error);
    return jsonResponse(req, { error: "Erro inesperado ao desligar funcionário." }, 500);
  }
});
