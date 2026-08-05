import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerStaff } = await adminClient
      .from("staff_members")
      .select("is_admin")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerStaff?.is_admin) {
      return jsonResponse({ error: "Apenas administradores podem excluir funcionários" }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.userId === "string" ? body.userId : "";

    if (!targetUserId) {
      return jsonResponse({ error: "userId é obrigatório" }, 400);
    }
    // auth.admin.deleteUser valida UUID internamente e lança um erro comum
    // (não um AuthError) fora do próprio try/catch dele — sem essa checagem
    // aqui, um userId mal formado derrubaria a função inteira sem os
    // cabeçalhos de CORS na resposta.
    if (!UUID_RE.test(targetUserId)) {
      return jsonResponse({ error: "userId inválido" }, 400);
    }
    if (targetUserId === caller.id) {
      return jsonResponse({ error: "Você não pode excluir a si mesmo." }, 400);
    }

    // Confirma que o alvo é de fato um funcionário antes de excluir — esta
    // function apaga qualquer usuário de auth.users que receber, então sem
    // essa checagem um userId errado (bug de cliente ou digitação) apagaria
    // uma conta de cliente por engano, de forma irreversível.
    const { data: targetStaff } = await adminClient
      .from("staff_members")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetStaff) {
      return jsonResponse({ error: "Usuário não é um funcionário." }, 404);
    }

    // staff_members/staff_permissions têm ON DELETE CASCADE a partir de
    // auth.users, então apagar o usuário já limpa as duas tabelas.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    // Registro mínimo de auditoria — exclusão de usuário é irreversível e
    // roda com service_role, então isso é o único rastro de quem fez o quê.
    console.log(`Funcionário excluído: ${targetUserId} (por admin ${caller.id})`);

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Erro inesperado em excluir-funcionario:", error);
    return jsonResponse({ error: "Erro inesperado ao excluir funcionário." }, 500);
  }
});
