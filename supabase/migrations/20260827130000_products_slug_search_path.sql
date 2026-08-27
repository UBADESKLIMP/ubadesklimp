begin;

alter function public.generate_product_slug(text) set search_path = public, pg_temp;
alter function public.set_product_slug() set search_path = public, pg_temp;

commit;
