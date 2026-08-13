# Fallback pra segunda chave do Gemini — Spec

## Contexto

Em 2026-08-13, a chave `GEMINI_API_KEY` (compartilhada pelas três funções que usam IA — `research-product`, `extract-quote-prices`, `apply-quote-reassignment`) bateu a cota gratuita diária do Gemini. Como as três funções dividem a mesma chave, qualquer uma pode ficar indisponível assim que o teto diário é atingido, mesmo que o uso pesado tenha vindo de outra tela.

O usuário já tem uma segunda conta Google legítima (não criada só pra isso) e vai gerar uma segunda chave de API nela. Este spec cobre um fallback automático: quando a chave 1 bate cota (`429`), a mesma requisição tenta a chave 2 na hora, sem a pessoa precisar clicar de novo.

## Fora de escopo (explícito)

- Terceiro provedor de IA (Groq ou outro) — decisão já tomada nesta conversa: a busca do Google é exclusiva do Gemini, e `extract-quote-prices` depende de aceitar PDF, que Groq não suporta hoje. Fica fora.
- Cache de pesquisas repetidas (evitar gastar cota com o mesmo produto pesquisado duas vezes) — mencionado como ideia separada, não misturado aqui.
- Terceira chave — o design abaixo já fica fácil de estender pra uma 3ª conta no futuro, mas a implementação cobre só 2.
- Qualquer mudança de UI — o fallback é inteiramente no backend (Edge Functions); a pessoa não vê diferença nenhuma quando funciona, só continua funcionando em vez de dar erro de cota.

## 1. Onde a segunda chave mora

Secret novo no Supabase: `GEMINI_API_KEY_2` — já cadastrado pelo usuário (fora do escopo desta implementação, é ação manual dele feita antes deste spec).

Se `GEMINI_API_KEY_2` não estiver configurado (`Deno.env.get` retorna `undefined`), o comportamento das três funções continua **idêntico ao de hoje** — sem fallback, sem erro novo, só ignora silenciosamente a tentativa de fallback.

## 2. Comportamento do fallback (as 3 funções)

Cada função duplica a mesma lógica (mesmo padrão de duplicação já usado no projeto pra auth/CORS — nenhuma das três importa código da outra):

1. Tenta a chamada ao Gemini com `GEMINI_API_KEY` (chave 1), do jeito que já funciona hoje.
2. Se a resposta vier `status === 429` **e** `GEMINI_API_KEY_2` estiver configurada, tenta de novo — mesmo corpo de requisição, só trocando o header `x-goog-api-key` pra chave 2 — dentro da mesma execução da função, sem round-trip novo do cliente.
3. Todo o resto do fluxo (parse da resposta, tratamento de `MAX_TOKENS`, erro de parse, etc.) continua exatamente igual, agora operando sobre a resposta final (seja da chave 1 ou da chave 2).
4. Se a chave 2 também vier `429` (ou não estiver configurada), o fluxo cai no mesmo tratamento de erro de cota que já existe hoje — mesma mensagem pro usuário (`"A cota gratuita da IA acabou por hoje. Tente de novo mais tarde."`), sem mudança de texto.

## 3. Particularidade do `research-product`

Essa função já tem timeout de 20s (`AbortSignal.timeout(20000)`) numa única tentativa, adicionado numa correção anterior. Com o fallback, o timeout precisa valer **por tentativa** (20s pra chave 1, e se cair pro fallback, outros 20s pra chave 2) — nunca somando as duas tentativas num timeout só. As outras duas funções não têm timeout hoje e continuam sem, sem mudança nisso.

## 4. Logging

Quando a chave 1 bate cota e a função tenta a chave 2, loga um `console.error` simples indicando a troca (ex: `"Chave 1 do Gemini bateu cota, tentando a chave 2."`) — ajuda a acompanhar pelos logs do Supabase com que frequência o fallback está sendo usado, sem expor nenhuma das chaves no log.

## Testes

Sem suíte automatizada (padrão do projeto) — verificação é `npm run typecheck` (não se aplica a `supabase/functions/`, que é Deno fora do projeto Vite/tsc — verificação ali é deploy + leitura cuidadosa do código, mesmo padrão já usado nas funções anteriores) + teste manual:

- Com `GEMINI_API_KEY_2` configurada e `GEMINI_API_KEY` (1) válida e dentro da cota: comportamento idêntico a hoje, sempre usa a chave 1.
- Simular a chave 1 esgotada (ex: temporariamente usar uma chave inválida/vencida só pra teste) com a chave 2 válida: a requisição deve completar com sucesso usando a chave 2, sem erro pro usuário.
- Com as duas chaves esgotadas (ou só a 1 esgotada e `GEMINI_API_KEY_2` não configurada): mesma mensagem de erro de cota que já existe hoje.
- Testar isso nas 3 funções, não só em `research-product`.
