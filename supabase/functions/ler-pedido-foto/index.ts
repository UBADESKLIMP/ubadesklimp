import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Lê um pedido de cliente (foto/print do WhatsApp ou texto colado), acha cada item na lista de
// produtos do ERP (tabela erp_produtos) e devolve a lista pronta para virar orçamento.
// Passos: 1) a IA lê as linhas do pedido; 2) o banco traz candidatos do ERP para cada linha;
// 3) a IA escolhe o melhor candidato e diz o quanto tem de certeza. Quem confere é gente.

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

const MODELO = "gemini-3.5-flash";
const MAX_LINHAS = 60;
const MAX_BASE64 = 14 * 1024 * 1024;
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

class CotaEsgotada extends Error {}

const chamarGemini = async (parts: Array<Record<string, unknown>>, chaves: string[]) => {
  for (const chave of chaves) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": chave, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "minimal" } },
      }),
    });
    if (r.status === 429) continue;
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
    const corpo = await r.json();
    const cand = corpo.candidates?.[0];
    if (cand?.finishReason === "MAX_TOKENS") throw new Error("Resposta da IA cortada");
    const texto = (cand?.content?.parts || []).find(
      (p: { text?: string; thought?: boolean }) => typeof p.text === "string" && p.thought !== true,
    )?.text;
    if (!texto) throw new Error("A IA não devolveu texto");
    const m = texto.match(/\[[\s\S]*\]/);
    return JSON.parse(m ? m[0] : texto);
  }
  throw new CotaEsgotada();
};

interface LinhaPedido { pedido: string; quantidade: number; unidade: string | null }
interface Candidato {
  codpro: string; codref: string | null; descr: string; unidade: string | null;
  vrvenda: number | null; saldo: number | null; vendas: number; ultima: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, { error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const chaves = [Deno.env.get("GEMINI_API_KEY"), Deno.env.get("GEMINI_API_KEY_2")].filter(
      (k): k is string => Boolean(k),
    );
    if (chaves.length === 0) return jsonResponse(req, { error: "IA não configurada no servidor. Avise um administrador." }, 500);

    // Tudo roda com o login de quem chamou: as regras de acesso do banco valem aqui também.
    const cliente = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: erroUser } = await cliente.auth.getUser();
    if (erroUser || !user) return jsonResponse(req, { error: "Não autenticado" }, 401);
    const { data: gestor } = await cliente.rpc("is_entregas_gestor");
    if (!gestor) return jsonResponse(req, { error: "Você não tem permissão para orçamentos." }, 403);

    const body = await req.json().catch(() => null);
    const empresaId = typeof body?.empresaId === "string" ? body.empresaId : "";
    const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
    const imagens: Array<{ mime: string; base64: string }> = Array.isArray(body?.imagens) ? body.imagens : [];
    if (!empresaId) return jsonResponse(req, { error: "empresaId é obrigatório." }, 400);
    if (!texto && imagens.length === 0) return jsonResponse(req, { error: "Mande uma foto ou cole o texto do pedido." }, 400);
    const total = imagens.reduce((s, i) => s + (i.base64?.length ?? 0), 0);
    if (total > MAX_BASE64) return jsonResponse(req, { error: "As fotos são grandes demais. Mande menos fotos por vez." }, 413);

    // 1) Ler as linhas do pedido.
    const partes: Array<Record<string, unknown>> = [];
    for (const img of imagens) {
      if (typeof img?.base64 === "string" && /^image\/(jpeg|png|webp)$/.test(img.mime ?? "")) {
        partes.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
      }
    }
    if (!texto && partes.length === 0) return jsonResponse(req, { error: "Não consegui abrir as fotos enviadas." }, 400);
    const promptLer =
      `Você lê pedidos de clientes enviados por WhatsApp (foto, print ou texto) para uma loja de produtos de limpeza e descartáveis em Ubatuba. ` +
      `Liste cada PRODUTO pedido. Ignore saudações, cabeçalhos, endereço, datas, totais e números de página. ` +
      `Se houver uma coluna de quantidade, use ela; não confunda tamanho/volume do produto (ex.: 5 LITROS, 500ML) com a quantidade. ` +
      `Se a quantidade não estiver clara, use 1. ` +
      `Responda APENAS com um array JSON, sem texto antes ou depois: ` +
      `[{"pedido": "<nome do produto como está escrito, sem a quantidade>", "quantidade": <número>, "unidade": "<UN, CX, PCT, FD, GL, KG, LT, PAR, RL ou null>"}]`;
    partes.push({ text: texto ? `Texto do pedido:\n\n${texto}\n\n${promptLer}` : promptLer });

    let linhas: LinhaPedido[] = await chamarGemini(partes, chaves);
    linhas = (Array.isArray(linhas) ? linhas : [])
      .filter((l) => l && typeof l.pedido === "string" && l.pedido.trim() !== "")
      .slice(0, MAX_LINHAS)
      .map((l) => ({
        pedido: l.pedido.trim(),
        quantidade: Number.isFinite(Number(l.quantidade)) && Number(l.quantidade) > 0 ? Number(l.quantidade) : 1,
        unidade: typeof l.unidade === "string" && l.unidade !== "null" ? l.unidade : null,
      }));
    if (linhas.length === 0) return jsonResponse(req, { error: "Não achei itens nesse pedido." }, 422);

    // 2) Candidatos do ERP para cada linha.
    const candidatos: Candidato[][] = await Promise.all(
      linhas.map(async (l) => {
        const { data } = await cliente.rpc("erp_produto_candidatos", {
          p_empresa_id: empresaId, p_texto: semAcento(l.pedido), p_limite: 8,
        });
        return (data ?? []) as Candidato[];
      }),
    );

    // 3) A IA escolhe o melhor candidato de cada linha (só das que têm candidato).
    const paraEscolher = linhas
      .map((l, i) => ({ i, pedido: l.pedido, quantidade: l.quantidade, unidade: l.unidade,
        candidatos: candidatos[i].map((c) => ({ c: c.codpro, d: c.descr, u: c.unidade, p: c.vrvenda, s: c.saldo, v: c.vendas, ult: c.ultima })) }))
      .filter((x) => x.candidatos.length > 0);

    const escolhas = new Map<number, { escolha: string | null; confianca: string; nota: string }>();
    if (paraEscolher.length > 0) {
      const promptEscolher =
        `Para cada linha de pedido abaixo, escolha entre os "candidatos" (produtos do ERP da loja) o que o cliente provavelmente quer. ` +
        `Campos do candidato: c=código, d=descrição, u=unidade, p=preço, s=saldo em estoque, v=vezes vendido recentemente, ult=última venda. ` +
        `Regras: prefira candidatos com v>0 (a loja realmente vende) e saldo s>0; só escolha um com saldo <= 0 se não houver alternativa equivalente. ` +
        `Se nenhum candidato for razoável, use escolha null. ` +
        `confianca "alta" SÓ quando tipo do produto, tamanho/volume e variação batem com o pedido; senão "media" ou "baixa". ` +
        `Em "nota" escreva, em português e em poucas palavras, o que ficou em dúvida (tamanho diferente do pedido, marca ou aroma não informado, ` +
        `existe outra opção parecida, saldo zerado, quantidade que pode ser em pacote/caixa). Deixe "" se não houver dúvida. ` +
        `Responda APENAS com um array JSON: [{"i": <i da linha>, "escolha": "<c do candidato>" ou null, "confianca": "alta"|"media"|"baixa", "nota": "<curta>"}]\n\n` +
        JSON.stringify(paraEscolher);
      const resp: Array<{ i: number; escolha: string | null; confianca: string; nota: string }> =
        await chamarGemini([{ text: promptEscolher }], chaves);
      for (const r of Array.isArray(resp) ? resp : []) {
        if (typeof r?.i === "number") escolhas.set(r.i, { escolha: r.escolha ?? null, confianca: r.confianca ?? "baixa", nota: r.nota ?? "" });
      }
    }

    const itens = linhas.map((l, i) => {
      const e = escolhas.get(i);
      const produto = e?.escolha ? candidatos[i].find((c) => c.codpro === e.escolha) ?? null : null;
      return {
        pedido: l.pedido,
        quantidade: l.quantidade,
        unidade_pedida: l.unidade,
        produto: produto
          ? { codpro: produto.codpro, codigo: produto.codref || produto.codpro, descr: produto.descr,
              unidade: produto.unidade, vrvenda: produto.vrvenda, saldo: produto.saldo }
          : null,
        confianca: produto ? (e?.confianca ?? "baixa") : "baixa",
        nota: produto ? (e?.nota ?? "") : (candidatos[i].length === 0 ? "Não achei nada parecido na lista do ERP." : (e?.nota || "Nenhum candidato serviu.")),
      };
    });

    return jsonResponse(req, { itens }, 200);
  } catch (e) {
    if (e instanceof CotaEsgotada) {
      return jsonResponse(req, { error: "A cota gratuita da IA acabou por hoje. Tente de novo mais tarde." }, 429);
    }
    console.error("ler-pedido-foto:", e);
    return jsonResponse(req, { error: "Não consegui ler o pedido. Tente de novo." }, 502);
  }
});
