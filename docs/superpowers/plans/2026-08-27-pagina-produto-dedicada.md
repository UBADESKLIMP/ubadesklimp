# Página Dedicada de Produto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada produto ganha uma página própria (`/produto/:slug`), substituindo o modal atual, com seção de produtos semelhantes (mesma categoria) no final.

**Architecture:** Slug gerado e mantido pelo banco (trigger em `products`), consumido pelo front-end como mais um campo do produto já carregado por `useProducts()`. Nova página React (`ProductPage.tsx`) reaproveita o conteúdo hoje em `ProductDetailModal.tsx` (que é removido), e os pontos de entrada (`Products.tsx`, `Automotivo.tsx`) passam a navegar em vez de abrir modal.

**Tech Stack:** React + TypeScript + Vite, react-router-dom v6, Supabase (Postgres + trigger), Tailwind, shadcn/ui.

## Global Constraints

- Projeto Supabase: `ccrucholgsffichvzbpz`.
- Sem suíte de testes automatizada no front-end (sem vitest/jest configurado) — a verificação de cada tarefa de front-end é `npm run build` (type-check + build do Vite) mais leitura cuidadosa do diff, mesmo padrão já usado nas specs anteriores deste projeto.
- Migrations do Supabase seguem o padrão `begin; ... commit;`, schema-qualificado (`public.products`), arquivo em `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`.
- `slug` é gerado pelo banco (trigger), nunca pelo app — não deve entrar na lista `allowedKeys` de `sanitizeProductPayload` em `useProducts.ts`.
- `ProductDetailModal.tsx` é removido só na Tarefa 4, depois que nada mais o referencia.

---

### Task 1: Migration — coluna `slug` em `products`

**Files:**
- Create: `supabase/migrations/20260827120000_products_slug.sql`

**Interfaces:**
- Produz: coluna `public.products.slug` (`text`, `not null`, `unique`), populada automaticamente via trigger `trg_set_product_slug` sempre que um produto é inserido ou seu `name` muda.

- [ ] **Step 1: Escrever a migration**

```sql
begin;

create extension if not exists unaccent;

alter table public.products add column slug text;

-- Gera slug a partir do nome: minúsculo, sem acento, espaços/pontuação
-- viram hífen, sem hífen duplicado nem nas pontas.
create or replace function public.generate_product_slug(product_name text)
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
create or replace function public.set_product_slug()
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

  candidate := public.generate_product_slug(NEW.name);
  final_slug := candidate;

  if exists (
    select 1 from public.products
    where slug = final_slug and id <> NEW.id
  ) then
    final_slug := candidate || '-' || right(NEW.id::text, 6);
  end if;

  NEW.slug := final_slug;
  return NEW;
end;
$$;

create trigger trg_set_product_slug
  before insert or update on public.products
  for each row
  execute function public.set_product_slug();

-- Backfill dos produtos existentes (dispara o trigger via update no próprio nome)
update public.products set name = name;

alter table public.products alter column slug set not null;
alter table public.products add constraint products_slug_unique unique (slug);

comment on column public.products.slug is 'Slug único gerado automaticamente a partir do nome (trigger trg_set_product_slug). Usado na URL pública /produto/:slug. Nunca escrever direto pelo app.';

commit;
```

- [ ] **Step 2: Aplicar a migration no projeto Supabase**

Usar a ferramenta MCP `mcp__claude_ai_Supabase__apply_migration` com `project_id: "ccrucholgsffichvzbpz"`, `name: "products_slug"` e o SQL do Step 1 (sem os comentários `begin;`/`commit;` se a ferramenta já envolver em transação — checar o comportamento da ferramenta; se ela não abrir transação própria, manter `begin;`/`commit;` no corpo enviado).

- [ ] **Step 3: Verificar o backfill**

Rodar via `mcp__claude_ai_Supabase__execute_sql` (`project_id: "ccrucholgsffichvzbpz"`):

```sql
select count(*) as total, count(distinct slug) as slugs_unicos, count(*) filter (where slug is null) as nulos
from public.products;
```

Esperado: `total` igual a `slugs_unicos`, `nulos = 0`.

```sql
select id, name, slug from public.products order by name limit 10;
```

Esperado: cada `slug` bate com o `name` correspondente, minúsculo, sem acento, com hífen no lugar de espaço.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260827120000_products_slug.sql
git commit -m "feat(produtos): adiciona slug único gerado por trigger, pra URL de produto"
```

---

### Task 2: Expor `slug` no front-end (tipos + hook)

**Files:**
- Modify: `src/types/product.ts`
- Modify: `src/hooks/useProducts.ts`

**Interfaces:**
- Consome: coluna `slug` de `public.products` (Task 1).
- Produz: `ProductWithVariations.slug: string`, disponível em todo produto retornado por `useProducts()`.

- [ ] **Step 1: Adicionar `slug` ao tipo `ProductWithVariations`**

Em `src/types/product.ts`, dentro da interface `ProductWithVariations` (a partir da linha 23), adicionar o campo logo após `id`:

```typescript
export interface ProductWithVariations {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  priority: boolean;
  priority_order: number;
  has_variations: boolean;
  has_fragrances?: boolean;
  highlight_type?: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
  material?: string;
  validity?: string;
  specifications?: string;
  fragrances?: ProductFragrance[];
  created_at: string;
  updated_at: string;
  variations: ProductVariation[];
  // Para produtos sem variações, usamos o preço base
  price?: number;
  size_unit?: 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades';
  price_position?: 'below_image' | 'below_text';
  // Campos automotivos
  action_type?: string | null;
  ph_level?: string | null;
  application_area?: string | null;
  brand?: string | null;
  // Linha do produto (automotivo ou limpeza)
  line_type?: 'limpeza' | 'automotivo';
  out_of_stock?: boolean;
  literage_single?: string;
  // Se falso, some do site público mas continua disponível no admin
  is_public?: boolean;
  // Uso interno de compras — nunca aparece no site
  purchase_min_quantity?: string | null;
  purchase_max_quantity?: string | null;
  purchase_notes?: string | null;
}
```

- [ ] **Step 2: Incluir `slug` na query do Supabase**

Em `src/hooks/useProducts.ts`, no `fetchProducts`, adicionar `slug` na string de colunas do `select` (linha 83):

```typescript
      let productsQuery = supabase
        .from('products')
        .select('id,slug,name,description,price,category,image_url,priority,priority_order,has_variations,has_fragrances,highlight_type,material,validity,specifications,out_of_stock,literage_single,size_unit,price_position,action_type,ph_level,application_area,line_type,brand,is_public,purchase_min_quantity,purchase_max_quantity,purchase_notes,display_order,created_at,updated_at')
```

- [ ] **Step 3: Repassar `slug` no objeto mapeado**

Ainda em `fetchProducts`, dentro do `productsData.map((product) => { ... })` (a partir da linha 112), adicionar `slug` no objeto retornado, logo após `id`:

```typescript
        return {
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
```

(mantém todo o resto do objeto igual — só essa linha nova).

- [ ] **Step 4: Checar que não faltou nenhum lugar (`sanitizeProductPayload`)**

Confirmar que `slug` **não** foi adicionado à lista `allowedKeys` de `sanitizeProductPayload` (linhas 38-65 do mesmo arquivo) — o slug é gerado pelo banco, o app nunca deve enviá-lo em insert/update.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build conclui sem erro de TypeScript (se houver erro do tipo `Property 'slug' is missing`, é sinal de algum outro lugar do código construindo um `ProductWithVariations` manualmente — resolver antes de prosseguir).

- [ ] **Step 6: Commit**

```bash
git add src/types/product.ts src/hooks/useProducts.ts
git commit -m "feat(produtos): expõe slug no tipo ProductWithVariations e no useProducts"
```

---

### Task 3: Página `/produto/:slug`

**Files:**
- Create: `src/pages/ProductPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consome: `useProducts()` (Task 2, já retorna `slug`), `useCart()` de `src/contexts/CartContext`, `ProductCard` de `src/components/ProductCard.tsx`, `Header`/`Footer` de `src/components`, `NotFound` de `src/pages/NotFound.tsx`.
- Produz: rota `/produto/:slug`, componente `ProductPage` default-exportado.

- [ ] **Step 1: Criar `src/pages/ProductPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import NotFound from './NotFound';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { ProductWithVariations, ProductVariation, ProductFragrance } from '@/types/product';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
};

const getUnitBadge = (value: string, sizeUnit?: string) => {
  const valueLower = value.toLowerCase();

  if (valueLower.match(/\d+\s*cm\b/)) {
    return <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>;
  }
  if (valueLower.match(/\d+\s*(kg|g)\b/)) {
    return <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>;
  }
  if (valueLower.match(/unidades?\b/)) {
    return <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>;
  }
  if (valueLower.match(/\d+\s*(l|ml)\b|litros?\b/)) {
    return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
  }

  if (sizeUnit) {
    switch (sizeUnit) {
      case 'cm':
        return <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>;
      case 'kg':
      case 'g':
        return <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>;
      case 'unidades':
        return <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>;
      case 'litros':
      case 'ml':
        return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
    }
  }

  return <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>;
};

const ProductPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="pt-14 md:pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid md:grid-cols-2 gap-8">
        <Skeleton className="h-[500px] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { products, loading } = useProducts();
  const { addToCart } = useCart();

  const product = products.find((p) => p.slug === slug) ?? null;

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedFragrance, setSelectedFragrance] = useState<ProductFragrance | null>(null);

  useEffect(() => {
    if (product?.has_variations && product.variations?.length > 0) {
      const primaryVariation = product.variations.find((v) => v.is_primary) || product.variations[0];
      setSelectedVariation(primaryVariation);
    } else {
      setSelectedVariation(null);
    }

    if (product?.has_fragrances && product.fragrances?.length > 0) {
      setSelectedFragrance(product.fragrances[0]);
    } else {
      setSelectedFragrance(null);
    }
  }, [product]);

  useEffect(() => {
    if (product?.has_variations && product.variations && selectedFragrance) {
      const availableVariations = product.variations.filter((variation) => {
        if (selectedFragrance.available_literages && selectedFragrance.available_literages.length > 0) {
          return selectedFragrance.available_literages.includes(variation.literage);
        }
        return true;
      });

      if (selectedVariation && availableVariations.length > 0) {
        const isCurrentVariationAvailable = availableVariations.some((v) => v.id === selectedVariation.id);
        if (!isCurrentVariationAvailable) {
          const primaryVariation = availableVariations.find((v) => v.is_primary) || availableVariations[0];
          setSelectedVariation(primaryVariation);
        }
      } else if (availableVariations.length > 0) {
        const primaryVariation = availableVariations.find((v) => v.is_primary) || availableVariations[0];
        setSelectedVariation(primaryVariation);
      }
    }
  }, [selectedFragrance, product]);

  if (loading) {
    return <ProductPageSkeleton />;
  }

  if (!product) {
    return <NotFound />;
  }

  const getCurrentPrice = () => {
    if (product.has_variations && product.variations?.length > 0 && selectedVariation) {
      return selectedVariation.price;
    }
    if (product.price) {
      return product.price;
    }
    return 0;
  };

  const getCurrentImage = () => {
    if (selectedFragrance?.image_url) {
      return selectedFragrance.image_url;
    }
    if (selectedVariation?.image_url) {
      return selectedVariation.image_url;
    }
    if (product.image_url) {
      return product.image_url;
    }
    return null;
  };

  const handleAddToCart = () => {
    let productName = product.name;
    let productId = product.id;

    if (product.has_variations && selectedVariation) {
      productName += ` - ${selectedVariation.literage}`;
      productId += `-${selectedVariation.id}`;
    }

    if (product.has_fragrances && selectedFragrance) {
      productName += ` - ${selectedFragrance.name}`;
      productId += `-${selectedFragrance.id}`;
    }

    if (product.has_variations && product.variations?.length > 0 && selectedVariation) {
      addToCart({
        id: productId,
        name: productName,
        price: selectedVariation.price,
        category: product.category,
        variation: selectedVariation,
        fragrance: selectedFragrance,
        productId: product.id,
        image_url: getCurrentImage() || undefined
      });
    } else if (product.price) {
      addToCart({
        id: productId,
        name: productName,
        price: product.price,
        category: product.category,
        fragrance: selectedFragrance,
        productId: product.id,
        image_url: getCurrentImage() || undefined
      });
    }

    toast({
      title: 'Produto adicionado!',
      description: `${productName} foi adicionado ao carrinho.`
    });
  };

  const backTo = product.line_type === 'automotivo' ? '/automotivo' : '/';

  const similarProducts = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-14 md:pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link to={backTo} className="inline-flex items-center text-primary hover:text-primary/80 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Imagem e compra */}
            <div className="space-y-4">
              <div className="relative w-full bg-white rounded-lg border border-border overflow-hidden">
                <div className="h-[500px] flex items-center justify-center p-4">
                  {getCurrentImage() ? (
                    <img
                      src={getCurrentImage()!}
                      alt={product.name}
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-6xl text-muted-foreground">📦</div>
                  )}
                </div>

                {product.priority && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold tracking-wider uppercase">
                          Produto Destaque
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6 space-y-4">
                {product.has_fragrances && product.fragrances && product.fragrances.length > 0 && (
                  <div className="space-y-3">
                    <label className="font-medium">Escolha a fragrância:</label>
                    <Select
                      value={selectedFragrance?.id || ''}
                      onValueChange={(value) => {
                        const fragrance = product.fragrances?.find((f) => f.id === value);
                        setSelectedFragrance(fragrance || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fragrância" />
                      </SelectTrigger>
                      <SelectContent>
                        {product.fragrances.map((fragrance) => (
                          <SelectItem key={fragrance.id} value={fragrance.id}>
                            {fragrance.name}
                            {fragrance.description && ` - ${fragrance.description}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {product.has_variations && product.variations && product.variations.length > 0 && (
                  <div className="space-y-3">
                    <label className="font-medium">
                      {product.variations[0]?.literage.match(/cm/i) ? 'Escolha o tamanho:' :
                       product.variations[0]?.literage.match(/kg|g/i) ? 'Escolha o peso:' :
                       product.variations[0]?.literage.match(/unidade/i) ? 'Escolha a quantidade:' : 'Escolha o volume:'}
                    </label>
                    <Select
                      value={selectedVariation?.id || ''}
                      onValueChange={(value) => {
                        const variation = product.variations.find((v) => v.id === value);
                        setSelectedVariation(variation || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          product.variations[0]?.literage.match(/cm/i) ? 'Selecione o tamanho' :
                          product.variations[0]?.literage.match(/kg|g/i) ? 'Selecione o peso' :
                          product.variations[0]?.literage.match(/unidade/i) ? 'Selecione a quantidade' : 'Selecione o volume'
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variations
                          .filter((variation) => {
                            if (selectedFragrance?.available_literages && selectedFragrance.available_literages.length > 0) {
                              return selectedFragrance.available_literages.includes(variation.literage);
                            }
                            return true;
                          })
                          .map((variation) => (
                            <SelectItem key={variation.id} value={variation.id}>
                              {variation.literage} - {formatPrice(variation.price)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {product.out_of_stock && (
                  <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-center">
                    <span className="text-destructive font-semibold">⚠️ Produto Esgotado</span>
                    <p className="text-sm text-muted-foreground mt-1">Este produto está temporariamente indisponível</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-primary">
                    {product.out_of_stock ? 'Em Falta' :
                      (getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível')
                    }
                  </span>
                </div>

                <Button
                  onClick={handleAddToCart}
                  className="w-full btn-secondary text-lg py-3"
                  disabled={getCurrentPrice() === 0 || product.out_of_stock}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {product.out_of_stock ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
              </div>
            </div>

            {/* Detalhes do produto */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
                <p className="text-sm text-primary font-medium uppercase tracking-wide">{product.category}</p>
              </div>

              <div className="space-y-4">
                <h2 className="font-semibold text-lg">Especificações:</h2>
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  {product.material && (
                    <div className="flex justify-between">
                      <span className="font-medium">Material:</span>
                      <span className="text-muted-foreground">{product.material}</span>
                    </div>
                  )}
                  {product.has_variations && selectedVariation ? (
                    <div className="flex justify-between items-center">
                      {getUnitBadge(selectedVariation.literage, product.size_unit)}
                      <span className="text-muted-foreground">{selectedVariation.literage}</span>
                    </div>
                  ) : !product.has_variations && product.literage_single && (
                    <div className="flex justify-between items-center">
                      {getUnitBadge(product.literage_single, product.size_unit)}
                      <span className="text-muted-foreground">{product.literage_single}</span>
                    </div>
                  )}
                  {product.validity && (
                    <div className="flex justify-between">
                      <span className="font-medium">Validade:</span>
                      <span>{product.validity}</span>
                    </div>
                  )}
                </div>
                {product.specifications && (
                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded whitespace-pre-wrap">
                      {product.specifications}
                    </p>
                  </div>
                )}

                {(product.action_type || product.ph_level || product.application_area) && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h3 className="font-medium text-sm mb-3 text-blue-400">Detalhes Técnicos</h3>
                    <div className="space-y-2">
                      {product.action_type && (
                        <div className="flex justify-between">
                          <span className="font-medium">Ação:</span>
                          <span className="text-muted-foreground">{product.action_type}</span>
                        </div>
                      )}
                      {product.ph_level && (
                        <div className="flex justify-between">
                          <span className="font-medium">PH:</span>
                          <span className="text-muted-foreground">{product.ph_level}</span>
                        </div>
                      )}
                      {product.application_area && (
                        <div className="flex justify-between">
                          <span className="font-medium">{product.line_type === 'limpeza' ? 'Uso Indicado:' : 'Local de Aplicação:'}</span>
                          <span className="text-muted-foreground">{product.application_area}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Produtos semelhantes */}
          {similarProducts.length >= 2 && (
            <div className="mt-16">
              <h2 className="text-2xl font-heading mb-6">Produtos semelhantes</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {similarProducts.map((similar) => (
                  <ProductCard
                    key={similar.id}
                    product={similar}
                    onShowDetails={() => {
                      window.location.href = `/produto/${similar.slug}`;
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductPage;
```

Nota sobre o `onShowDetails` dos cards de "produtos semelhantes": usa `window.location.href` em vez de `useNavigate` de propósito nesta primeira versão — simples e correto (recarrega a página do próximo produto), mas causa reload completo em vez de navegação client-side. Isso é aceitável porque a Task 4 vai trocar exatamente esse padrão nos outros dois pontos de entrada por `useNavigate`; ajustar aqui pro mesmo padrão faz parte da Task 4, não desta.

- [ ] **Step 2: Adicionar a rota em `src/App.tsx`**

Adicionar o import e a rota, mantendo o comentário de marcação existente:

```tsx
import ProductPage from "./pages/ProductPage";
```

```tsx
              <Route path="/produto/:slug" element={<ProductPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProductPage.tsx src/App.tsx
git commit -m "feat(produtos): página dedicada /produto/:slug com produtos semelhantes"
```

---

### Task 4: Trocar modal por navegação nos pontos de entrada + remover modal

**Files:**
- Modify: `src/components/Products.tsx`
- Modify: `src/pages/Automotivo.tsx`
- Modify: `src/pages/ProductPage.tsx` (trocar `window.location.href` por `navigate`)
- Delete: `src/components/ProductDetailModal.tsx`

**Interfaces:**
- Consome: `useNavigate` de `react-router-dom`.
- Produz: nenhuma interface nova — só remove o caminho antigo (modal) e liga o existente (`ProductCard.onShowDetails`) na rota da Task 3.

- [ ] **Step 1: `Products.tsx` — navegar em vez de abrir modal**

Em `src/components/Products.tsx`:

Trocar o import do router e remover o do modal:

```tsx
import { useNavigate } from 'react-router-dom';
```

(remove a linha `import ProductDetailModal from './ProductDetailModal';`)

Dentro do componente, trocar o estado e o handler (linhas 22-52):

```tsx
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Get unique categories from limpeza products only
  const categories = Array.from(new Set(limpezaProducts.map(product => product.category))).sort();

  // Filter products based on search and category (ignoring accents)
  const filteredProducts = limpezaProducts.filter(product => {
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch = normalizeText(product.name).includes(normalizedSearch) ||
                         (normalizeText(product.description || '').includes(normalizedSearch));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  const handleShowDetails = (product: ProductWithVariations) => {
    navigate(`/produto/${product.slug}`);
  };
```

No final do JSX, remover o bloco do modal:

```tsx
      {/* Modal de detalhes */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
```

(o `</section>` que fecha o componente passa a vir logo depois do grid/estado vazio, sem esse bloco).

- [ ] **Step 2: `Automotivo.tsx` — mesma troca**

Em `src/pages/Automotivo.tsx`:
- Remover `import ProductDetailModal from '@/components/ProductDetailModal';`.
- `useNavigate` já não está importado neste arquivo — adicionar ao import existente de `react-router-dom`: trocar

```tsx
import { Link } from 'react-router-dom';
```

por

```tsx
import { Link, useNavigate } from 'react-router-dom';
```

- Trocar as linhas 33-34 (estado do modal):

```tsx
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
```

por:

```tsx
  const navigate = useNavigate();
```

- Trocar as linhas 147-155 (`handleShowDetails`/`handleCloseModal`):

```tsx
  const handleShowDetails = (product: ProductWithVariations) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };
```

por:

```tsx
  const handleShowDetails = (product: ProductWithVariations) => {
    navigate(`/produto/${product.slug}`);
  };
```

(a chamada `onShowDetails={() => handleShowDetails(product)}` na linha 607, dentro do `.map()` que renderiza `ProductCard`, não muda — continua chamando `handleShowDetails`.)

- Remover as linhas 646-650 (a renderização do modal, logo depois de `<Footer />`):

```tsx
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
```

Ficando:

```tsx
      <Footer />
    </div>
  );
};

export default Automotivo;
```

- [ ] **Step 3: `ProductPage.tsx` — usar `navigate` nos produtos semelhantes**

Em `src/pages/ProductPage.tsx`, trocar o import:

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
```

Adicionar `const navigate = useNavigate();` junto de `const { slug } = useParams<{ slug: string }>();`.

Trocar o `onShowDetails` do bloco de produtos semelhantes:

```tsx
                  <ProductCard
                    key={similar.id}
                    product={similar}
                    onShowDetails={() => navigate(`/produto/${similar.slug}`)}
                  />
```

- [ ] **Step 4: Remover o modal**

```bash
git rm src/components/ProductDetailModal.tsx
```

- [ ] **Step 5: Confirmar que nada mais referencia o modal**

Run: `grep -rn "ProductDetailModal" src/`
Expected: nenhum resultado.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build conclui sem erro (confirma que não sobrou nenhum import quebrado nem uso de `selectedProduct`/`isModalOpen` órfão).

- [ ] **Step 7: Commit**

```bash
git add src/components/Products.tsx src/pages/Automotivo.tsx src/pages/ProductPage.tsx
git commit -m "feat(produtos): remove modal de detalhes, catálogo navega pra /produto/:slug"
```

---

## Fora de escopo (herdado da spec)

- Meta tags / Open Graph por produto.
- Query dedicada de produto único por slug (reusa `useProducts()` completo).
- Mudança em `SortableAdminProductCard.tsx` / grid do admin.
- Verificação visual ao vivo no navegador — cada task usa `npm run build` como checagem; revisão visual fica por conta do usuário depois do deploy (lembrar de clicar Publish no Lovable).
