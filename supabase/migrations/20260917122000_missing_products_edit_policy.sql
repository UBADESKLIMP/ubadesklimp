begin;

create policy "Staff com permissão faltantes edita faltante pendente"
  on public.missing_products
  for update
  using (public.is_staff_admin() or public.has_staff_permission('faltantes'))
  with check (
    (public.is_staff_admin() or public.has_staff_permission('faltantes'))
    and status = 'pendente'
  );

commit;
