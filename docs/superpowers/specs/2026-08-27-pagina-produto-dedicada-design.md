# Página dedicada de produto + produtos semelhantes

## Contexto

Hoje, clicar num produto na vitrine (`Products.tsx`) ou na página Automotivo
(`Automotivo.tsx`) abre um modal (`ProductDetailModal.tsx`) por cima da
página atual. Isso tem três problemas: não existe URL própria pra
compartilhar um produto específico (ex: mandar link no WhatsApp pro
cliente), o catálogo é invisível pro Google (nada pra indexar por produto),
e o modal já carrega um hack de `pushState`/`popstate` só pra fingir que o
botão "voltar" do celular fecha o modal em vez de sair da página.

A mudança: cada produto passa a ter uma página própria, com URL legível
(estilo Mercado Livre), e essa página ganha uma seção de "produtos
semelhantes" (mesma categoria) no final.

## 1. Slug de produto

### Modelo de dados

Nova coluna em `products`:

```sql
create extension if not exists unaccent;

alter table products add column slug text;

-- Gera slug a partir do nome: minúsculo, sem acento, espaços/pontuação
-- viram hífen, sem hífen duplicado nem nas pontas.
create or replace function generate_product_slug(product_name text)
returns text
language plpgsql
as $$
declare
  base_slug text;
begin
  base_slug := lower(unaccent(product_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  return base_slug;
end;
$$;

-- Trigger: (re)gera o slug sempre que o produto é inserido ou o nome muda.
-- Em colisão, acrescenta um sufixo curto do id (últimos 6 caracteres do uuid)
-- pra garantir unicidade sem precisar de lógica no app.
create or replace function set_product_slug()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  final_slug text;
begin
  if TG_OP = 'UPDATE' and NEW.name = OLD.name and NEW.slug is not null then
    return NEW;
  end if;

  candidate := generate_product_slug(NEW.name);
  final_slug := candidate;

  if exists (
    select 1 from products
    where slug = final_slug and id <> NEW.id
  ) then
    final_slug := candidate || '-' || right(NEW.id::text, 6);
  end if;

  NEW.slug := final_slug;
  return NEW;
end;
$$;

create trigger trg_set_product_slug
  before insert or update on products
  for each row
  execute function set_product_slug();

-- Backfill dos produtos existentes (dispara o trigger via update no próprio nome)
update products set name = name;

alter table products alter column slug set not null;
alter table products add constraint products_slug_unique unique (slug);
```

`slug` é gerado pelo banco, nunca pelo app — `sanitizeProductPayload` em
`useProducts.ts` **não** ganha `slug` na lista de `allowedKeys`, então
mesmo que o formulário de produto mande esse campo por engano, ele é
ignorado silenciosamente.

### Tipos e queries no front-end

- `slug: string` novo campo obrigatório em `ProductWithVariations`
  (`src/types/product.ts`).
- `useProducts.ts`: adicionar `slug` na lista de colunas do `select(...)`.

## 2. Rota e página

Nova rota em `App.tsx`:

```tsx
<Route path="/produto/:slug" element={<ProductPage />} />
```

Novo componente `src/pages/ProductPage.tsx`. Reusa `useProducts()` (já
carrega o catálogo completo com variações/fragrâncias — catálogo é pequeno,
~112 produtos, então não justifica uma query dedicada por enquanto) e
localiza o produto por `slug` nos dados já carregados. Estados:

- **Carregando:** enquanto `useProducts().loading` é true, skeleton simples
  (reaproveitar o padrão de `Skeleton` já usado em `ProductCard.tsx`).
- **Não encontrado:** slug não bate com nenhum produto carregado (produto
  não existe, foi despublicado, ou o link está errado/desatualizado) →
  reaproveita o componente `NotFound.tsx` já existente.

Conteúdo da página = o que hoje está dentro de `ProductDetailModal.tsx`
(imagem, seleção de fragrância/variação, preço, botão comprar,
especificações, detalhes técnicos), adaptado de conteúdo-de-modal pra
conteúdo-de-página (sem `Dialog`/`DialogContent`, com layout de página cheia
e botão "Voltar" que usa `navigate(-1)`).

`ProductDetailModal.tsx` é removido depois que `ProductPage.tsx` estiver
funcionando — nenhuma outra tela depende dele.

## 3. Produtos semelhantes

Seção no final de `ProductPage.tsx`: até 6 produtos com a mesma `category`
do produto atual, excluindo ele mesmo, na ordem de `display_order` já usada
no catálogo. Filtrados a partir do array que `useProducts()` já trouxe (sem
chamada nova ao banco). Cada card reusa `ProductCard.tsx` normalmente —
clicar num "semelhante" navega pra `/produto/:slug` dele.

Se a categoria do produto atual tiver menos de 2 outros produtos, a seção
não aparece (categoria "sozinha" não teria o que recomendar).

## 4. Ponto de entrada nas listagens

Em `Products.tsx` e `Automotivo.tsx`:

- `onShowDetails` passado pro `ProductCard` deixa de abrir modal e passa a
  chamar `navigate(`/produto/${product.slug}`)`.
- Comportamento de "adicionar direto ao carrinho" pra produto sem variação
  nem fragrância continua igual — só o caminho que hoje abria modal (produto
  com opção pra escolher) é que agora navega pra página.
- Estado `selectedProduct` e a renderização de `<ProductDetailModal />`
  somem dessas duas páginas.

## Fora de escopo

- Meta tags / Open Graph por produto (título, imagem de preview ao
  compartilhar link no WhatsApp) — próximo passo natural depois que a
  página existir, mas não faz parte desta spec.
- Query dedicada de produto único por slug (hoje reusa `useProducts()`
  completo) — revisar se o catálogo crescer muito além do tamanho atual.
- Mudança em `SortableAdminProductCard.tsx` / grid do admin — usa um
  componente próprio, não é afetado por nada aqui.
- Testar no navegador em tempo real (a sessão de browser desta conversa
  ficou ocupada com o sistema jrsweb) — a implementação vai direto, sem
  verificação visual ao vivo; revisão fica por conta do usuário depois.
