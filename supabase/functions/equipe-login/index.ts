import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Login do módulo Equipe. Diferente do login geral (AuthContext.tsx, usado
// por Compras/Produtos/Financeiro), este passa pelo servidor ANTES de
// chamar o Auth pra poder checar/atualizar tentativas_login e bloqueado_em
// (PRD exige essa trava no servidor, não só no front) — o login geral
// continua chamando signInWithPassword direto do cliente, sem trava.
const STAFF_EMAIL_DOMAIN = "equipe.ubadesklimp.internal";
const STAFF_PIN_SUFFIX = "-pin";

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !/^\d{4}$/.test(password)) {
      return jsonResponse(req, { error: "Usuário e PIN de 4 dígitos são obrigatórios." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const syntheticEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;

    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    const user = authUsers?.users.find((u) => u.email === syntheticEmail);
    if (!user) {
      return jsonResponse(req, { error: "Usuário ou senha inválidos." }, 401);
    }

    const { data: liberado } = await adminClient.rpc("equipe_checar_login", { p_user_id: user.id });
    if (liberado === false) {
      return jsonResponse(
        req,
        { error: "Conta bloqueada por tentativas incorretas. Peça pro admin desbloquear." },
        403,
      );
    }

    const { data: signIn, error: signInError } = await adminClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: password + STAFF_PIN_SUFFIX,
    });

    await adminClient.rpc("equipe_registrar_tentativa_login", {
      p_user_id: user.id,
      p_sucesso: !signInError,
    });

    if (signInError || !signIn?.session) {
      return jsonResponse(req, { error: "Usuário ou senha inválidos." }, 401);
    }

    return jsonResponse(req, { session: signIn.session }, 200);
  } catch (error) {
    console.error("Erro inesperado em equipe-login:", error);
    return jsonResponse(req, { error: "Erro inesperado ao entrar." }, 500);
  }
});
