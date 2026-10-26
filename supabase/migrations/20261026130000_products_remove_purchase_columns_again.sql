-- Segunda remoção das colunas purchase_* de products (a primeira foi desfeita
-- em 20261026120000). Conferido antes: o JS publicado em ubadesklimp.com usa
-- product_purchase_info e não pede mais essas colunas; nenhuma linha divergia.
alter table public.products
  drop column if exists purchase_min_quantity,
  drop column if exists purchase_max_quantity,
  drop column if exists purchase_notes;
