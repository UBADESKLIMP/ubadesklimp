import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STAFF_EMAIL_DOMAIN = "equipe.ubadesklimp.internal";
const VALID_PERMISSIONS = ["faltantes", "produtos", "fornecedores", "financeiro"];
// O dashboard do Supabase trava "Minimum password length" em >= 6, sem
// exceção — não dá pra usar o PIN de 4 dígitos puro como senha do Auth.
// Completa com um sufixo fixo só pra passar no piso da plataforma; a
// entropia real continua sendo só a dos 4 dígitos (o sufixo é público, está
// no código-fonte). Precisa ficar idêntico ao usado em AuthContext.tsx no
// login, senão a senha gerada aqui nunca bate na hora de entrar.
const STAFF_PIN_SUFFIX = "-pin";

// Reflete de volta exatamente os cabeçalhos que o navegador pediu no
// preflight, em vez de uma lista fixa — se o cliente supabase-js manda um
// cabeçalho que não está numa lista hardcoded, o navegador cancela a
// requisição real silenciosamente (nem chega a sair, só o OPTIONS aparece
// nos logs), então refletir é o padrão robusto recomendado pelo Supabase.
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

  // Sem este try/catch, qualquer throw não previsto (env var ausente,
  // falha de rede no Auth Admin API, etc.) derruba a função com o 500 cru
  // do runtime do Deno, sem os cabeçalhos de CORS — no navegador isso
  // aparece como uma falha de CORS opaca, escondendo a causa real.
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
      return jsonResponse(req, { error: "Apenas administradores podem criar funcionários" }, 403);
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
        req,
        {
          error:
            "Nome de usuário precisa ter 3-32 caracteres (letras, números, ponto, traço), sem começar ou terminar com ponto/traço.",
        },
        400,
      );
    }
    // PIN numérico de 4 dígitos — decisão do usuário em favor de praticidade
    // (equipe loga no chão da loja), ciente de que é bem mais fácil de
    // forçar por tentativa e erro do que uma senha alfanumérica maior.
    if (!/^\d{4}$/.test(password)) {
      return jsonResponse(req, { error: "Senha precisa ter exatamente 4 dígitos numéricos." }, 400);
    }

    const syntheticEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: password + STAFF_PIN_SUFFIX,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      const message = createError?.message?.includes("already been registered")
        ? "Esse nome de usuário já está em uso."
        : createError?.message ?? "Não foi possível criar o funcionário.";
      return jsonResponse(req, { error: message }, 400);
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
      return jsonResponse(req, { error: `Não foi possível salvar o funcionário: ${staffError.message}` }, 500);
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
          return jsonResponse(req, { error: `Não foi possível salvar as permissões: ${permError.message}` }, 500);
        }
      }
    }

    // Registro mínimo de auditoria — criar um funcionário (às vezes um admin
    // novo) roda com service_role, então isso é o único rastro de quem fez o quê.
    console.log(
      `Funcionário criado: ${newUserId} (${username}, admin=${isAdminFlag}) por admin ${caller.id}`,
    );

    return jsonResponse(req, { userId: newUserId, username, displayName }, 200);
  } catch (error) {
    console.error("Erro inesperado em criar-funcionario:", error);
    return jsonResponse(req, { error: "Erro inesperado ao criar funcionário." }, 500);
  }
});
