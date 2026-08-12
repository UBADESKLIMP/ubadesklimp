# Adicionar produto com IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Adicionar com IA" nas telas Produtos e Automotivo que pesquisa um produto (via Gemini com busca do Google), pré-preenche o formulário de cadastro existente, e — quando encontra mais de um tamanho e/ou fragrâncias — oferece essas opções como sugestões clicáveis depois que o produto é salvo pela primeira vez.

**Architecture:** Uma Edge Function nova (`research-product`) pesquisa e devolve um JSON estruturado. Um mapeador puro no cliente (`productResearchDraft.ts`) transforma essa resposta num rascunho pro `ProductForm` existente (fase 1: informações básicas) e numa lista de sugestões (fase 2: tamanhos/fragrâncias, só destravada depois que o produto tem `id`). Preço nunca é sugerido pela IA; fotos sugeridas só entram no produto quando a pessoa clica pra usar.

**Tech Stack:** React + TypeScript, Supabase (Postgres + RLS + Edge Functions Deno), Gemini API (`gemini-3.5-flash` com `google_search` grounding), Cloudinary (upload de imagem já existente).

## Global Constraints

- Sem suíte automatizada neste projeto — verificação é `npm run typecheck` + teste manual, mesmo padrão dos planos anteriores (D2a/D2b).
- Nenhuma migração de banco nesta parte — a IA só pesquisa e devolve dados; a escrita real usa os caminhos já existentes (`createProduct`, `createVariation`, `saveFragrances` etc.).
- Permissão exigida: `produtos` (já existe, nenhuma permissão nova).
- Edge Function nova segue o padrão de auth de `supabase/functions/extract-quote-prices/index.ts`: valida JWT com client anon, confere `staff_members`/`staff_permissions` com client service role, todas as leituras usam client service role.
- Chamadas ao Gemini usam `gemini-3.5-flash` (nunca `gemini-flash-latest`) com `generationConfig.thinkingConfig: { thinkingLevel: "minimal" }`, tratam `status === 429` (cota excedida) e `finishReason === "MAX_TOKENS"` — mesmo padrão já em produção em `extract-quote-prices`/`apply-quote-reassignment`.
- **Preço nunca é preenchido pela IA** — nem no produto base, nem em variação nenhuma. É sempre a pessoa quem digita, usando os campos e validações que já existem hoje.
- **Nenhuma foto é salva sem um clique explícito** ("Usar esta foto" ou clicar num chip de sugestão) — sugestão de foto é sempre só uma sugestão ao lado do upload manual, nunca a única forma de preencher.
- Nome de produto sugerido pela IA sempre no padrão **Tipo + Marca** (ex: "Multiuso Veja"), sem litragem dentro do nome.
- Card de dialog do admin: `bg-[#0f0f18] border-blue-500/30 text-white` — mesmo padrão visual já usado no dialog do `ProductForm`.
- Todo componente/hook novo segue a convenção já usada no projeto de nomear em português nos textos visíveis e inglês nos identificadores de código.

---

### Task 1: Edge Function `research-product`

**Files:**
- Create: `supabase/functions/research-product/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: tabela `categories` (leitura), `staff_members`/`staff_permissions` (checagem de permissão).
- Produces: endpoint que recebe `{ name: string, sizeHint: string, lineType: 'limpeza' | 'automotivo' }` e devolve um objeto `ResearchResult` (ver corpo da função) — consumido pela Task 2 (`useProductResearch`).

- [ ] **Step 1: Escrever a Edge Function**

```ts
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

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
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
      }
    );

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

    const normalized: ResearchResult = {
      confidence: result.confidence === "high" || result.confidence === "low" ? result.confidence : "none",
      name: typeof result.name === "string" && result.name.trim() ? result.name.trim() : null,
      description: typeof result.description === "string" ? result.description : null,
      category: typeof result.category === "string" ? result.category : null,
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
```

- [ ] **Step 2: Adicionar a entrada no `supabase/config.toml`**

Adicionar ao final do arquivo (mesmo padrão das outras funções):

```toml

[functions.research-product]
verify_jwt = false
```

- [ ] **Step 3: Deployar a Edge Function**

Usar a ferramenta MCP do Supabase (`deploy_edge_function`) com o nome
`research-product` e o conteúdo do Step 1. Confirmar status `ACTIVE` via
`list_edge_functions`.

- [ ] **Step 4: Teste manual via curl**

Pegar um JWT válido de staff logado (ex: do `localStorage` do navegador,
chave `sb-<ref>-auth-token`, campo `access_token`) e rodar:

```bash
curl -X POST "https://ccrucholgsffichvzbpz.supabase.co/functions/v1/research-product" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "veja multiuso", "sizeHint": "", "lineType": "limpeza"}'
```

Expected: JSON 200 com `confidence`, `name` no padrão "Multiuso Veja",
`sizes` com pelo menos 1 item, `fragrances` (pode ser vazio ou não).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/research-product/index.ts supabase/config.toml
git commit -m "feat(produtos): edge function research-product"
```

---

### Task 2: Tipos e hook `useProductResearch`

**Files:**
- Create: `src/types/productResearch.ts`
- Create: `src/hooks/useProductResearch.ts`

**Interfaces:**
- Consumes: Edge Function `research-product` (Task 1); `extractFunctionErrorMessage` de `src/lib/functionErrors.ts` (já existe no projeto).
- Produces: tipo `ProductResearchResult`; hook `useProductResearch()` retornando `{ research: (name: string, sizeHint: string, lineType: 'limpeza' | 'automotivo') => Promise<ProductResearchResult | null>, researching: boolean }` — consumido pela Task 4 (mapeador) e Task 5 (diálogo).

- [ ] **Step 1: Criar `src/types/productResearch.ts`**

```ts
export interface ProductResearchSize {
  literage: string;
  image_url: string | null;
}

export interface ProductResearchFragrance {
  name: string;
  image_url: string | null;
}

export interface ProductResearchResult {
  confidence: 'high' | 'low' | 'none';
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
  sizes: ProductResearchSize[];
  fragrances: ProductResearchFragrance[];
}
```

- [ ] **Step 2: Criar `src/hooks/useProductResearch.ts`**

```ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';
import { ProductResearchResult } from '@/types/productResearch';

export const useProductResearch = () => {
  const [researching, setResearching] = useState(false);

  const research = async (
    name: string,
    sizeHint: string,
    lineType: 'limpeza' | 'automotivo'
  ): Promise<ProductResearchResult | null> => {
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('research-product', {
        body: { name, sizeHint, lineType },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, 'Não foi possível pesquisar esse produto.');
        toast({ title: 'Erro na pesquisa', description: message, variant: 'destructive' });
        return null;
      }
      return data as ProductResearchResult;
    } catch (error) {
      console.error('Error researching product:', error);
      toast({
        title: 'Erro na pesquisa',
        description: 'Não foi possível pesquisar esse produto. Tente novamente.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setResearching(false);
    }
  };

  return { research, researching };
};
```

- [ ] **Step 3: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/types/productResearch.ts src/hooks/useProductResearch.ts
git commit -m "feat(produtos): tipos e hook useProductResearch"
```

---

### Task 3: `useImageUpload` — upload a partir de URL remota

**Files:**
- Modify: `src/hooks/useImageUpload.ts`

**Interfaces:**
- Produces: `uploadImageFromUrl(url: string): Promise<string | null>` no retorno do hook — consumido pelas Tasks 6, 7 e 8 pra transformar uma foto candidata da IA numa URL do Cloudinary.

- [ ] **Step 1: Adicionar `uploadImageFromUrl` ao hook**

O upload "unsigned" do Cloudinary aceita tanto um arquivo binário (já usado
em `uploadImage`) quanto uma URL remota no mesmo campo `file` — nesse caso o
Cloudinary busca a imagem no servidor dele, sem precisar baixar o arquivo no
navegador primeiro (evita problema de CORS ao tentar `fetch` a URL de
origem direto do cliente).

```ts
  const uploadImageFromUrl = async (url: string): Promise<string | null> => {
    if (!url) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', url);
      formData.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Falha no upload para Cloudinary a partir da URL');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image from URL:', error);
      toast({
        title: "Não foi possível usar essa foto sugerida",
        description: "Envie uma foto manualmente.",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploadImageFromUrl, uploading };
```

Isso substitui o `return { uploadImage, uploading };` existente no final do
hook (última linha antes do fechamento da função).

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros (vai reclamar em qualquer lugar que já desestrutura só
`{ uploadImage, uploading }` — não deve reclamar de nada, já que
desestruturação parcial de um objeto com campo a mais é válida em TS).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useImageUpload.ts
git commit -m "feat(produtos): useImageUpload aceita subir imagem a partir de URL remota"
```

---

### Task 4: Helpers de mapeamento `productResearchDraft.ts`

**Files:**
- Create: `src/lib/productResearchDraft.ts`

**Interfaces:**
- Consumes: `ProductResearchResult` (Task 2); `ProductWithVariations` (`src/types/product.ts`, já existe).
- Produces: `buildProductDraft(result, typedName, lineType): Partial<ProductWithVariations>`; tipo `ProductAiSuggestions`; `buildAiSuggestions(result): ProductAiSuggestions` — consumidos pela Task 5 (diálogo) e Tasks 6-8 (`ProductForm` e as seções de variação/fragrância).

- [ ] **Step 1: Criar o arquivo**

```ts
import { ProductWithVariations } from '@/types/product';
import { ProductResearchResult, ProductResearchSize, ProductResearchFragrance } from '@/types/productResearch';

export interface ProductAiSuggestions {
  confidence: 'high' | 'low' | 'none';
  mainImageUrl: string | null;
  sizes: ProductResearchSize[];
  fragrances: ProductResearchFragrance[];
}

// Fase 1: só os campos editáveis antes do produto existir (nome, descrição,
// categoria, campos técnicos, tamanho único quando só há 1). Tamanhos
// múltiplos e fragrâncias não entram aqui — ver buildAiSuggestions, que
// alimenta a Fase 2 (depois que o produto já tem id).
export const buildProductDraft = (
  result: ProductResearchResult,
  typedName: string,
  lineType: 'limpeza' | 'automotivo'
): Partial<ProductWithVariations> => {
  const hasMultipleSizes = result.sizes.length >= 2;
  const singleSize = result.sizes.length === 1 ? result.sizes[0] : null;

  return {
    name: result.name || typedName,
    description: result.description || '',
    category: result.category || '',
    line_type: lineType,
    has_variations: hasMultipleSizes,
    literage_single: singleSize?.literage || '',
    material: result.material || '',
    validity: result.validity || '',
    specifications: result.specifications || '',
    brand: result.brand || '',
    action_type: result.action_type || '',
    ph_level: result.ph_level || '',
    application_area: result.application_area || '',
  };
};

// Fase 2: sugestões que só ficam disponíveis depois que o produto tem id
// (aba Variações). Tamanho único já virou literage_single na Fase 1, então
// só entra em "sizes" aqui quando há 2 ou mais.
export const buildAiSuggestions = (result: ProductResearchResult): ProductAiSuggestions => ({
  confidence: result.confidence,
  mainImageUrl: result.main_image_url,
  sizes: result.sizes.length >= 2 ? result.sizes : [],
  fragrances: result.fragrances,
});
```

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/productResearchDraft.ts
git commit -m "feat(produtos): mapeia resultado da pesquisa de IA pro rascunho do produto"
```

---

### Task 5: Diálogo `AddProductWithAiDialog`

**Files:**
- Create: `src/components/AddProductWithAiDialog.tsx`

**Interfaces:**
- Consumes: `useProductResearch` (Task 2); `buildProductDraft`/`buildAiSuggestions`/`ProductAiSuggestions` (Task 4).
- Produces: componente `AddProductWithAiDialog({ lineType, onResult })`, onde `onResult: (draft: Partial<ProductWithVariations>, suggestions: ProductAiSuggestions) => void` — consumido pelas Tasks 9 e 10.

- [ ] **Step 1: Criar o componente**

```tsx
import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductResearch } from '@/hooks/useProductResearch';
import { buildProductDraft, buildAiSuggestions, ProductAiSuggestions } from '@/lib/productResearchDraft';
import { ProductWithVariations } from '@/types/product';

interface AddProductWithAiDialogProps {
  lineType: 'limpeza' | 'automotivo';
  onResult: (draft: Partial<ProductWithVariations>, suggestions: ProductAiSuggestions) => void;
}

const AddProductWithAiDialog = ({ lineType, onResult }: AddProductWithAiDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sizeHint, setSizeHint] = useState('');
  const { research, researching } = useProductResearch();

  const handleSearch = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const result = await research(trimmedName, sizeHint.trim(), lineType);
    if (!result) return;

    onResult(buildProductDraft(result, trimmedName, lineType), buildAiSuggestions(result));
    setOpen(false);
    setName('');
    setSizeHint('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
          <Sparkles className="h-4 w-4 mr-2" />
          Adicionar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f18] border-blue-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Adicionar produto com IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ai-product-name">Nome do produto</Label>
            <Input
              id="ai-product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: veja multiuso"
              disabled={researching}
            />
          </div>
          <div>
            <Label htmlFor="ai-product-size">Tamanho conhecido (opcional)</Label>
            <Input
              id="ai-product-size"
              value={sizeHint}
              onChange={(e) => setSizeHint(e.target.value)}
              placeholder="Ex: 500ml"
              disabled={researching}
            />
          </div>
          <Button onClick={handleSearch} disabled={researching || !name.trim()} className="w-full">
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pesquisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Pesquisar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductWithAiDialog;
```

- [ ] **Step 2: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddProductWithAiDialog.tsx
git commit -m "feat(produtos): diálogo Adicionar com IA"
```

---

### Task 6: `ProductForm` — abas controladas, sugestão de foto principal, avanço automático

**Files:**
- Modify: `src/components/ProductForm.tsx`

**Interfaces:**
- Consumes: `ProductAiSuggestions` (Task 4); `uploadImageFromUrl` (Task 3).
- Produces: `ProductForm` ganha prop opcional `aiSuggestions?: ProductAiSuggestions`, repassa `aiSuggestions.sizes`/`aiSuggestions.fragrances` pro `ProductVariationsSection` (consumido pelas Tasks 7 e 8).

- [ ] **Step 1: Imports e prop nova**

Trocar a linha de imports do React (linha 2) e o import de `useImageUpload`
(linha 12):

```ts
import { useState, useEffect, useRef } from 'react';
```

```ts
import { useImageUpload } from '@/hooks/useImageUpload';
import { ProductAiSuggestions } from '@/lib/productResearchDraft';
```

Adicionar `aiSuggestions` à interface de props (linhas 18-22):

```ts
interface ProductFormProps {
  product?: ProductWithVariations | null;
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
  aiSuggestions?: ProductAiSuggestions;
}

const ProductForm = ({ product, onSave, onCancel, aiSuggestions }: ProductFormProps) => {
  const { uploadImage, uploadImageFromUrl, uploading } = useImageUpload();
```

(A linha `const { uploadImage, uploading } = useImageUpload();` existente
vira a linha acima, com `uploadImageFromUrl` a mais.)

- [ ] **Step 2: Aba controlada e avanço automático pra Variações**

Logo após a declaração de `saving` (`const [saving, setSaving] = useState(false);`),
adicionar:

```ts
  const [activeTab, setActiveTab] = useState('basic');
  const previousProductIdRef = useRef<string | undefined>(product?.id);

  useEffect(() => {
    const hadNoId = !previousProductIdRef.current;
    const hasIdNow = !!product?.id;
    const hasPendingSuggestions =
      !!aiSuggestions && (aiSuggestions.sizes.length > 0 || aiSuggestions.fragrances.length > 0);
    if (hadNoId && hasIdNow && hasPendingSuggestions) {
      setActiveTab('variations');
    }
    previousProductIdRef.current = product?.id;
  }, [product?.id, aiSuggestions]);
```

Trocar `<Tabs defaultValue="basic" className="w-full">` (linha ~181) por:

```tsx
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
```

- [ ] **Step 3: Aviso de confiança da pesquisa**

Logo no início do `<form>`, antes do `<Tabs>` (linha ~180), adicionar:

```tsx
      {aiSuggestions?.confidence === 'none' && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground">
          Não encontrei detalhes confiáveis pra esse produto — preencha manualmente.
        </div>
      )}
      {aiSuggestions?.confidence === 'low' && (
        <div className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-sm text-yellow-100">
          Não tenho certeza sobre alguns destes dados — confira com atenção antes de salvar.
        </div>
      )}
```

- [ ] **Step 4: Sugestão de foto principal**

No bloco "Imagem Principal" (dentro de `<div className="space-y-2">`, logo
depois do `{formData.image_url && (...)}` existente), adicionar:

```tsx
                  {!formData.image_url && aiSuggestions?.mainImageUrl && (
                    <div className="flex items-center gap-3 p-2 rounded border border-dashed border-blue-500/40">
                      <img
                        src={aiSuggestions.mainImageUrl}
                        alt="Sugestão da IA"
                        className="w-16 h-16 object-contain rounded border bg-muted/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="flex-1 text-sm text-muted-foreground">Foto sugerida pela IA</div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={uploading}
                        onClick={async () => {
                          const uploaded = await uploadImageFromUrl(aiSuggestions.mainImageUrl!);
                          if (uploaded) setFormData(prev => ({ ...prev, image_url: uploaded }));
                        }}
                      >
                        Usar esta foto
                      </Button>
                    </div>
                  )}
```

- [ ] **Step 5: Repassar as sugestões pro `ProductVariationsSection`**

Trocar a chamada existente (dentro da aba "Variações"):

```tsx
                <ProductVariationsSection 
                  productId={product.id} 
                  fragrances={formData.fragrances}
                  onFragrancesChange={(fragrances) => setFormData(prev => ({ ...prev, fragrances }))}
                  onMainImageChange={updateMainImage}
                  aiSuggestedSizes={aiSuggestions?.sizes}
                  aiSuggestedFragrances={aiSuggestions?.fragrances}
                />
```

- [ ] **Step 6: Rodar o typecheck**

Run: `npm run typecheck`
Expected: erro esperado nesta etapa — `ProductVariationsSection` ainda não
aceita `aiSuggestedSizes`/`aiSuggestedFragrances` (Task 7 resolve isso). Se
aparecer qualquer outro erro além desse, corrigir antes de continuar.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductForm.tsx
git commit -m "feat(produtos): ProductForm aceita sugestões da IA e avança pra aba Variações"
```

---

### Task 7: `ProductVariationsSection` — sugestões de tamanho

**Files:**
- Modify: `src/components/ProductVariationsSection.tsx`

**Interfaces:**
- Consumes: `uploadImageFromUrl` (Task 3); prop `aiSuggestedSizes`/`aiSuggestedFragrances` vinda do `ProductForm` (Task 6).
- Produces: repassa `aiSuggestedFragrances` pro `ProductFragrancesSection` (consumido pela Task 8).

- [ ] **Step 1: Prop nova e estado de sugestões pendentes**

Trocar a interface de props e a desestruturação (linhas 16-23):

```tsx
interface ProductVariationsSectionProps {
  productId: string;
  fragrances: any[];
  onFragrancesChange: (fragrances: any[]) => void;
  onMainImageChange?: (imageUrl: string) => void;
  aiSuggestedSizes?: { literage: string; image_url: string | null }[];
  aiSuggestedFragrances?: { name: string; image_url: string | null }[];
}

const ProductVariationsSection = ({
  productId,
  fragrances,
  onFragrancesChange,
  onMainImageChange,
  aiSuggestedSizes,
  aiSuggestedFragrances,
}: ProductVariationsSectionProps) => {
  const { uploadImage, uploadImageFromUrl, uploading } = useImageUpload();
  const { variations, loading, createVariation, updateVariation, deleteVariation, reorderVariation, setPrimaryVariation } = useProductVariations(productId);
  const { saveFragrances } = useProductFragrances(productId);
  const [newVariation, setNewVariation] = useState({
    literage: '',
    price: '',
    image_url: ''
  });
  const [pendingSizeSuggestions, setPendingSizeSuggestions] = useState(aiSuggestedSizes ?? []);
```

- [ ] **Step 2: Handler de clique numa sugestão**

Adicionar logo depois de `handleFragrancesChange`:

```tsx
  const applySizeSuggestion = async (suggestion: { literage: string; image_url: string | null }) => {
    setPendingSizeSuggestions((prev) => prev.filter((s) => s.literage !== suggestion.literage));
    setNewVariation({ literage: suggestion.literage, price: '', image_url: '' });
    if (suggestion.image_url) {
      const uploaded = await uploadImageFromUrl(suggestion.image_url);
      if (uploaded) {
        setNewVariation((prev) => ({ ...prev, image_url: uploaded }));
      }
    }
  };
```

- [ ] **Step 3: Renderizar os chips de sugestão**

Adicionar imediatamente antes do comentário `{/* Nova variação */}`:

```tsx
        {pendingSizeSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashed border-blue-500/40 bg-muted/20">
            <span className="text-sm text-muted-foreground mr-1">Sugestões da IA:</span>
            {pendingSizeSuggestions.map((suggestion) => (
              <Button
                key={suggestion.literage}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applySizeSuggestion(suggestion)}
              >
                {suggestion.literage}
              </Button>
            ))}
          </div>
        )}

```

- [ ] **Step 4: Repassar `aiSuggestedFragrances` pro `ProductFragrancesSection`**

Trocar a chamada existente no final do arquivo:

```tsx
        <ProductFragrancesSection 
          fragrances={fragrances}
          onFragrancesChange={handleFragrancesChange}
          onMainImageChange={onMainImageChange}
          availableLiterages={variations.map(v => v.literage)}
          aiSuggestedFragrances={aiSuggestedFragrances}
        />
```

- [ ] **Step 5: Rodar o typecheck**

Run: `npm run typecheck`
Expected: erro esperado nesta etapa — `ProductFragrancesSection` ainda não
aceita `aiSuggestedFragrances` (Task 8 resolve isso). Nenhum outro erro deve
aparecer.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProductVariationsSection.tsx
git commit -m "feat(produtos): chips de tamanho sugerido pela IA"
```

---

### Task 8: `ProductFragrancesSection` — sugestões de fragrância

**Files:**
- Modify: `src/components/ProductFragrancesSection.tsx`

**Interfaces:**
- Consumes: `uploadImageFromUrl` (Task 3); prop `aiSuggestedFragrances` vinda do `ProductVariationsSection` (Task 7).

- [ ] **Step 1: Prop nova e estado de sugestões pendentes**

Trocar a interface de props e a desestruturação (linhas 11-19):

```tsx
interface ProductFragrancesSectionProps {
  fragrances: ProductFragrance[];
  onFragrancesChange: (fragrances: ProductFragrance[]) => void;
  onMainImageChange?: (url: string) => void;
  availableLiterages: string[];
  aiSuggestedFragrances?: { name: string; image_url: string | null }[];
}

const ProductFragrancesSection = ({
  fragrances,
  onFragrancesChange,
  onMainImageChange,
  availableLiterages,
  aiSuggestedFragrances,
}: ProductFragrancesSectionProps) => {
  const { uploadImage, uploadImageFromUrl, uploading } = useImageUpload();
  const [newFragrance, setNewFragrance] = useState({
    name: '',
    description: '',
    image_url: '',
    available_literages: [...availableLiterages] // Por padrão, todas as litragens
  });
  const [pendingFragranceSuggestions, setPendingFragranceSuggestions] = useState(aiSuggestedFragrances ?? []);
```

- [ ] **Step 2: Handler de clique numa sugestão**

Adicionar logo depois do `useEffect` que sincroniza `available_literages`:

```tsx
  const applyFragranceSuggestion = async (suggestion: { name: string; image_url: string | null }) => {
    setPendingFragranceSuggestions((prev) => prev.filter((f) => f.name !== suggestion.name));
    setNewFragrance((prev) => ({ ...prev, name: suggestion.name, image_url: '' }));
    if (suggestion.image_url) {
      const uploaded = await uploadImageFromUrl(suggestion.image_url);
      if (uploaded) {
        setNewFragrance((prev) => ({ ...prev, image_url: uploaded }));
      }
    }
  };
```

- [ ] **Step 3: Renderizar os chips de sugestão**

Adicionar imediatamente antes do comentário `{/* Nova fragrância */}`:

```tsx
      {pendingFragranceSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashed border-blue-500/40 bg-muted/20">
          <span className="text-sm text-muted-foreground mr-1">Sugestões da IA:</span>
          {pendingFragranceSuggestions.map((suggestion) => (
            <Button
              key={suggestion.name}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyFragranceSuggestion(suggestion)}
            >
              {suggestion.name}
            </Button>
          ))}
        </div>
      )}

```

- [ ] **Step 4: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros — esta é a última peça das Tasks 6-8, então qualquer
erro pendente das etapas anteriores deve estar resolvido agora.

- [ ] **Step 5: Teste manual (fluxo completo do formulário)**

Com o servidor local rodando (`npm run dev`), sem ainda ter o botão "Adicionar
com IA" ligado (isso é a Task 9), é possível testar as Tasks 6-8 chamando
`buildProductDraft`/`buildAiSuggestions` manualmente no console do navegador
com um resultado fake, ou simplesmente adiar essa verificação visual pro
teste manual da Task 9, que já exercita o fluxo ponta a ponta de verdade.
Por enquanto, confirmar só que a tela de edição de um produto já existente
(fluxo manual, sem IA) continua funcionando exatamente como antes — abrir
"Editar" num produto qualquer, aba Variações, adicionar uma variação na mão.
Expected: nenhuma mudança de comportamento pro fluxo manual.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProductFragrancesSection.tsx
git commit -m "feat(produtos): chips de fragrância sugerida pela IA"
```

---

### Task 9: Ligar em `Admin.tsx` (tela Produtos)

**Files:**
- Modify: `src/pages/Admin.tsx`

**Interfaces:**
- Consumes: `AddProductWithAiDialog` (Task 5); `ProductAiSuggestions` (Task 4).

- [ ] **Step 1: Imports**

Adicionar aos imports existentes (perto da linha 8, junto de `ProductForm`):

```ts
import AddProductWithAiDialog from '@/components/AddProductWithAiDialog';
import { ProductAiSuggestions } from '@/lib/productResearchDraft';
```

- [ ] **Step 2: Estado novo pras sugestões**

Logo depois de `const [isDialogOpen, setIsDialogOpen] = useState(false);`
(linha 38):

```ts
  const [aiSuggestions, setAiSuggestions] = useState<ProductAiSuggestions | null>(null);

  const handleAiResult = (draft: Partial<ProductWithVariations>, suggestions: ProductAiSuggestions) => {
    setEditingProduct(draft as ProductWithVariations);
    setAiSuggestions(suggestions);
    setIsDialogOpen(true);
  };
```

- [ ] **Step 3: Guardar o produto recém-criado em `handleSaveProduct`**

Na função `handleSaveProduct`, dentro do `else` (branch de criação, onde já
existe `savedProduct = await createProduct(productPayload);`), adicionar
logo depois dessa linha:

```ts
        savedProduct = await createProduct(productPayload);
        if (savedProduct) {
          setEditingProduct(savedProduct);
        }
```

- [ ] **Step 4: Botão "Adicionar com IA" ao lado de "Novo Produto"**

Trocar o `action` do `AdminPageHeader` da seção `products` (linhas 182-203)
de um único `<Dialog>` pra um `<div>` com os dois:

```tsx
              action={
                <div className="flex items-center gap-2">
                  <AddProductWithAiDialog lineType="limpeza" onResult={handleAiResult} />
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingProduct(null);
                          setAiSuggestions(null);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Produto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f18] border-blue-500/30 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">
                          {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                        </DialogTitle>
                      </DialogHeader>
                      <ProductForm
                        product={editingProduct}
                        onSave={handleSaveProduct}
                        onCancel={() => {
                          setIsDialogOpen(false);
                          setAiSuggestions(null);
                        }}
                        aiSuggestions={aiSuggestions ?? undefined}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              }
```

- [ ] **Step 5: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Teste manual — fluxo completo**

Com `npm run dev` rodando, logar como staff com permissão `produtos`, ir em
Produtos:
1. Clicar "Adicionar com IA", digitar "veja multiuso", pesquisar.
2. Confirmar que o formulário abre com nome no padrão Tipo + Marca, categoria,
   descrição preenchidos, e (se achou foto) a sugestão de foto principal
   visível com o botão "Usar esta foto".
3. Preencher o preço (obrigatório) e salvar.
4. Confirmar que o diálogo NÃO fecha e pula sozinho pra aba "Variações", com
   chips de tamanho sugeridos (e de fragrância, se achou).
5. Clicar num chip de tamanho, confirmar que litragem e foto (se tinha)
   preenchem o mini-formulário; digitar um preço e clicar "Adicionar
   Variação"; confirmar que a variação aparece na lista acima.
6. Repetir pra um segundo tamanho sugerido, se houver.
7. Fechar o diálogo; confirmar na grade de produtos que o produto novo
   aparece com as variações certas.
8. Testar também o caminho "Novo Produto" manual (sem IA) pra garantir que
   nada quebrou: abre vazio, sem sugestões, comportamento igual a antes.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(produtos): liga Adicionar com IA na tela Produtos"
```

---

### Task 10: Ligar em `AutomotiveProductsManager.tsx` (tela Automotivo)

**Files:**
- Modify: `src/components/AutomotiveProductsManager.tsx`

**Interfaces:**
- Consumes: `AddProductWithAiDialog` (Task 5); `ProductAiSuggestions` (Task 4). Mesmo padrão da Task 9, adaptado pra este arquivo.

- [ ] **Step 1: Imports**

Adicionar aos imports existentes (perto da linha 10, junto de `ProductForm`):

```ts
import AddProductWithAiDialog from '@/components/AddProductWithAiDialog';
import { ProductAiSuggestions } from '@/lib/productResearchDraft';
```

- [ ] **Step 2: Estado novo pras sugestões**

Logo depois de `const [isDialogOpen, setIsDialogOpen] = useState(false);`
(linha 27):

```ts
  const [aiSuggestions, setAiSuggestions] = useState<ProductAiSuggestions | null>(null);

  const handleAiResult = (draft: Partial<ProductWithVariations>, suggestions: ProductAiSuggestions) => {
    setEditingProduct(draft as ProductWithVariations);
    setAiSuggestions(suggestions);
    setIsDialogOpen(true);
  };
```

- [ ] **Step 3: Guardar o produto recém-criado em `handleSaveProduct`**

Dentro do `else` de `handleSaveProduct` (linha ~109,
`const savedProduct = await createProduct(productPayload);`), adicionar
logo depois:

```ts
        const savedProduct = await createProduct(productPayload);
        if (savedProduct) {
          setEditingProduct(savedProduct);
        }
```

- [ ] **Step 4: Botão "Adicionar com IA" ao lado de "Novo Produto"**

Trocar o `action` do `AdminPageHeader` (linhas 321-346) de um único
`<Dialog>` pra um `<div>` com os dois:

```tsx
        action={
          <div className="flex items-center gap-2">
            <AddProductWithAiDialog lineType="automotivo" onResult={handleAiResult} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingProduct(null);
                    setAiSuggestions(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-500/25"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f18] border-blue-500/30 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-400" />
                    {editingProduct ? 'Editar Produto Automotivo' : 'Novo Produto Automotivo'}
                  </DialogTitle>
                </DialogHeader>
                <ProductForm
                  product={editingProduct}
                  onSave={handleSaveProduct}
                  onCancel={() => {
                    setIsDialogOpen(false);
                    setAiSuggestions(null);
                  }}
                  aiSuggestions={aiSuggestions ?? undefined}
                />
              </DialogContent>
            </Dialog>
          </div>
        }
```

- [ ] **Step 5: Rodar o typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Teste manual — mesmo roteiro da Task 9, na tela Automotivo**

Repetir o roteiro da Task 9 (Step 6) na tela Automotivo, pesquisando um
produto automotivo conhecido (ex: "cera hybrid wax vonixx"). Confirmar
adicionalmente que os campos automotivos (marca, ph, área de aplicação)
vêm preenchidos e os campos de limpeza (material, validade) ficam vazios/
ausentes, e que `line_type` do produto salvo é `automotivo` mesmo que o
formulário internamente permita trocar a linha (o `handleSaveProduct` deste
arquivo já força `line_type = 'automotivo'` antes de salvar, sem mudança
nesta task).

- [ ] **Step 7: Commit**

```bash
git add src/components/AutomotiveProductsManager.tsx
git commit -m "feat(produtos): liga Adicionar com IA na tela Automotivo"
```
