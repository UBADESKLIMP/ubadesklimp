begin;

-- immutable_unaccent (Task 1, 20260917120000) ficou sem search_path fixo,
-- reintroduzindo o mesmo alerta de segurança (function_search_path_mutable)
-- que 20260827130000_products_slug_search_path.sql já tinha corrigido pra
-- generate_product_slug. Não é explorável aqui (o corpo já qualifica
-- public.unaccent e o literal do dicionário), mas fixa o search_path por
-- consistência com o resto do projeto.
alter function public.immutable_unaccent(text) set search_path = public, pg_temp;

commit;
