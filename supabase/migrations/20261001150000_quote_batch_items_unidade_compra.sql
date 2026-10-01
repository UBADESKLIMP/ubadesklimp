-- Pedir "10" não diz nada pro fornecedor: 10 unidades ou 10 caixas muda o
-- pedido inteiro. O produto tem size_unit, mas ele é o tamanho da embalagem
-- (1L, 500ml) — não a forma como a compra é feita.
--
-- Fica por item do lote porque é decisão de compra, não característica do
-- produto: do mesmo fornecedor dá pra pedir 2 caixas de um e 5 unidades de
-- outro.
alter table public.quote_batch_items
  add column unidade_compra text not null default 'unidade'
  check (unidade_compra in ('unidade', 'caixa'));

comment on column public.quote_batch_items.unidade_compra is
  'Se a quantidade do pedido é em unidades ou caixas. Aparece na mensagem de WhatsApp e no PDF do pedido.';
