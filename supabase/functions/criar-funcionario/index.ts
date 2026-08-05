import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STAFF_EMAIL_DOMAIN = "equipe.ubadesklimp.internal";
const VALID_PERMISSIONS = ["faltantes", "produtos", "fornecedores", "financeiro"];

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
    return jsonResponse({ error: "Apenas administradores podem criar funcionários" }, 403);
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" && body.displayName.trim()
    ? body.displayName.trim().slice(0, 100)
    : username;
  const isAdminFlag = body?.isAdmin === true;
  const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : [];

  if (!/^[a-z0-9]([a-z0-9._-]{1,30})[a-z0-9]$/.test(username)) {
    return jsonResponse(
      {
        error:
          "Nome de usuário precisa ter 3-32 caracteres (letras, números, ponto, traço), sem começar ou terminar com ponto/traço.",
      },
      400,
    );
  }
  // 8+ caracteres: essas contas são autenticadas por um e-mail sintético
  // previsível (username@equipe.ubadesklimp.internal) e podem ter is_admin
  // true, então o mínimo de senha precisa ser mais forte que um cadastro
  // comum de cliente.
  if (!password || password.length < 8) {
    return jsonResponse({ error: "Senha precisa ter pelo menos 8 caracteres." }, 400);
  }

  const syntheticEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    const message = createError?.message?.includes("already been registered")
      ? "Esse nome de usuário já está em uso."
      : createError?.message ?? "Não foi possível criar o funcionário.";
    return jsonResponse({ error: message }, 400);
  }

  const newUserId = created.user.id;

  const { error: staffError } = await adminClient.from("staff_members").insert({
    user_id: newUserId,
    is_admin: isAdminFlag,
    display_name: displayName,
  });

  if (staffError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(newUserId);
    if (cleanupError) {
      console.error(`Falha ao limpar usuário órfão ${newUserId} após erro em staff_members:`, cleanupError);
    }
    return jsonResponse({ error: `Não foi possível salvar o funcionário: ${staffError.message}` }, 500);
  }

  if (!isAdminFlag && permissions.length > 0) {
    const uniquePermissions = [...new Set(permissions)];
    const rows = uniquePermissions
      .filter((permission) => VALID_PERMISSIONS.includes(permission))
      .map((permission) => ({ user_id: newUserId, permission }));

    if (rows.length > 0) {
      const { error: permError } = await adminClient.from("staff_permissions").insert(rows);
      if (permError) {
        await adminClient.from("staff_members").delete().eq("user_id", newUserId);
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(newUserId);
        if (cleanupError) {
          console.error(`Falha ao limpar usuário órfão ${newUserId} após erro em staff_permissions:`, cleanupError);
        }
        return jsonResponse({ error: `Não foi possível salvar as permissões: ${permError.message}` }, 500);
      }
    }
  }

  // Registro mínimo de auditoria — criar um funcionário (às vezes um admin
  // novo) roda com service_role, então isso é o único rastro de quem fez o quê.
  console.log(
    `Funcionário criado: ${newUserId} (${username}, admin=${isAdminFlag}) por admin ${caller.id}`,
  );

  return jsonResponse({ userId: newUserId, username, displayName }, 200);
});
