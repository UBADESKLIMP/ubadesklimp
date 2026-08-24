begin;

alter table public.products
  add column is_public boolean not null default true;

comment on column public.products.is_public is 'Se falso, o produto some do site público mas continua disponível no admin (compras, faltantes, cotações).';

commit;
