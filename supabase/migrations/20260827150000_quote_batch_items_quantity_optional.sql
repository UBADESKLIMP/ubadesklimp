begin;

alter table public.quote_batch_items
  alter column quantity drop not null,
  alter column quantity drop default;

comment on column public.quote_batch_items.quantity is 'Quantidade desejada — opcional na hora de pedir cotação (cotação é sobre preço, quantidade pode ser decidida depois). Nula = quantidade ainda não definida.';

commit;
