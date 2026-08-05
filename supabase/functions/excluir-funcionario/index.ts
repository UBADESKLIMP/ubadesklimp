import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  if (targetUserId === caller.id) {
    return jsonResponse({ error: "Você não pode excluir a si mesmo." }, 400);
  }

  // staff_members/staff_permissions têm ON DELETE CASCADE a partir de
  // auth.users, então apagar o usuário já limpa as duas tabelas.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ success: true }, 200);
});
