begin;

alter table public.missing_products
  add column fragrance_id uuid,
  add column variation_id uuid;

alter table public.missing_products
  add constraint missing_products_fragrance_id_fkey
    foreign key (fragrance_id) references public.product_fragrances(id) on delete cascade,
  add constraint missing_products_variation_id_fkey
    foreign key (variation_id) references public.product_variations(id) on delete cascade;

-- Substitui o índice único da Parte D1 (só por product_id) por um que
-- considera também fragrância e tamanho — "Ypê Rosa 2L" e "Ypê Azul 1L"
-- passam a contar como itens diferentes, cada um com sua própria pendência.
-- coalesce trata "sem fragrância"/"sem tamanho" (null) como um valor fixo,
-- não como "qualquer coisa" — senão o índice não pegaria duplicata em
-- produtos sem variação nenhuma (onde as duas colunas ficam null sempre).
drop index public.missing_products_pending_product_idx;

create unique index missing_products_pending_item_idx
  on public.missing_products (
    product_id,
    coalesce(fragrance_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pendente';

commit;
