-- Dados internos de compra do produto (mínimo, máximo e observações) saem da
-- tabela products, que o site público lê, e vão para uma tabela só da equipe.
--
-- As colunas antigas em products continuam por enquanto: o site publicado
-- ainda lê delas. Depois que o site novo for publicado, uma migração seguinte
-- tira o acesso de anon/authenticated a elas.

create table public.product_purchase_info (
  product_id uuid primary key references public.products(id) on delete cascade,
  purchase_min_quantity text,
  purchase_max_quantity text,
  purchase_notes text,
  updated_at timestamptz not null default now()
);

comment on table public.product_purchase_info is
  'Uso interno de compras (mínimo, máximo, observações). Só a equipe lê; nunca vai para o site público.';

alter table public.product_purchase_info enable row level security;

create policy "Equipe lê dados de compra do produto"
  on public.product_purchase_info for select
  to authenticated
  using (public.is_staff_member());

create policy "Quem gerencia produtos grava dados de compra"
  on public.product_purchase_info for all
  to authenticated
  using (public.has_staff_permission('produtos'::public.staff_permission))
  with check (public.has_staff_permission('produtos'::public.staff_permission));

revoke all on table public.product_purchase_info from anon;

create trigger update_product_purchase_info_updated_at
  before update on public.product_purchase_info
  for each row execute function public.update_updated_at_column();

insert into public.product_purchase_info (product_id, purchase_min_quantity, purchase_max_quantity, purchase_notes)
select id, purchase_min_quantity, purchase_max_quantity, purchase_notes
from public.products
where purchase_min_quantity is not null
   or purchase_max_quantity is not null
   or purchase_notes is not null;
