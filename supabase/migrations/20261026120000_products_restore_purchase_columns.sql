-- Desfaz temporariamente 20261024120000: o site publicado em ubadesklimp.com
-- ainda era a versão antiga (lia purchase_* direto de products) e o catálogo
-- deixou de carregar quando as colunas saíram. As colunas voltam e os 60
-- valores foram copiados de product_purchase_info.
-- Só dá para remover de novo depois de conferir que o site no ar já usa
-- product_purchase_info (procurar o nome da tabela no JS publicado).
alter table public.products
  add column if not exists purchase_min_quantity text,
  add column if not exists purchase_max_quantity text,
  add column if not exists purchase_notes text;

update public.products p
set purchase_min_quantity = i.purchase_min_quantity,
    purchase_max_quantity = i.purchase_max_quantity,
    purchase_notes = i.purchase_notes
from public.product_purchase_info i
where i.product_id = p.id
  and p.purchase_min_quantity is null and p.purchase_max_quantity is null and p.purchase_notes is null;
