begin;

alter table public.quote_line_items
  add column excluded_at timestamptz,
  add column excluded_by uuid references public.staff_members(user_id) on delete set null,
  add column excluded_by_name text,
  add column corrected_at timestamptz;

comment on column public.quote_line_items.excluded_at is 'Quando este preço foi excluído da comparação (não conta como "mais barato", não pode ser vencedor). Null = preço válido.';
comment on column public.quote_line_items.excluded_by is 'Quem excluiu.';
comment on column public.quote_line_items.excluded_by_name is 'Nome de quem excluiu, denormalizado (mesmo padrão de updated_by_name).';
comment on column public.quote_line_items.corrected_at is 'Quando o preço foi editado manualmente na tela de comparação — distinto de updated_at/updated_by_name, que também é gravado pela extração por IA e pela revisão do fornecedor. Null = nunca corrigido na comparação.';

commit;
