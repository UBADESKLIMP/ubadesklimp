begin;

-- A policy de edição (Task 1, 20260917122000) tinha o with check certo
-- (status = 'pendente' na linha resultante), mas o using ficou sem
-- restrição de status — como policies permissivas se combinam com OR, isso
-- deixava qualquer staff com 'faltantes' (inclusive Operacional, que não
-- deveria mexer em financeiro/status) atualizar uma linha resolvida,
-- cancelada ou com pedido já enviado, desde que o resultado voltasse pra
-- 'pendente'. Corrige travando o using no mesmo status = 'pendente' do
-- with check — editar só nunca deveria alcançar linha que não está
-- pendente.
drop policy "Staff com permissão faltantes edita faltante pendente" on public.missing_products;

create policy "Staff com permissão faltantes edita faltante pendente"
  on public.missing_products
  for update
  using (
    (public.is_staff_admin() or public.has_staff_permission('faltantes'))
    and status = 'pendente'
  )
  with check (
    (public.is_staff_admin() or public.has_staff_permission('faltantes'))
    and status = 'pendente'
  );

commit;
