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
