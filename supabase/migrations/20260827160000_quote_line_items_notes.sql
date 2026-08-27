begin;

alter table public.quote_line_items
  add column notes text;

comment on column public.quote_line_items.notes is 'Adendo/observação que o fornecedor deu sobre esse item nessa cotação específica (ex: tamanho que ele confirmou, marca, condição de promoção) — evita ambiguidade quando o item cotado tem várias variações possíveis (ex: "3L" quando o produto existe em 3L e 5L).';

commit;
