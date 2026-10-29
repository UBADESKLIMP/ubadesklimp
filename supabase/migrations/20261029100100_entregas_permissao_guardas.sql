-- Quem monta a rota de entregas: gestor/admin da equipe OU funcionário com a
-- permissão 'entregas' (marcada em Funcionários). Os demais acessos da equipe
-- (atrasos, ponto, medidas) continuam só com gestor/admin.

create or replace function public.is_entregas_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_equipe_gestor_ou_admin()
    or public.has_staff_permission('entregas'::public.staff_permission)
$$;

-- Empresas que a pessoa pode operar no módulo de entregas. Quem só tem a
-- permissão enxerga a própria empresa (staff_members.empresa_id).
create or replace function public.entregas_empresas_visiveis()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.equipe_empresas_visiveis()
  union
  select empresa_id from staff_members
  where user_id = auth.uid()
    and empresa_id is not null
    and public.has_staff_permission('entregas'::public.staff_permission)
$$;

grant execute on function public.is_entregas_gestor() to authenticated;
grant execute on function public.entregas_empresas_visiveis() to authenticated;

-- Troca a guarda nas funções e políticas do módulo, sem reescrever cada corpo.
do $$
declare
  f record;
  p record;
  def text;
begin
  for f in
    select pr.oid, pr.proname
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    where n.nspname = 'public'
      and pr.prokind = 'f'
      and pr.proname like 'entrega\_%'
      and pr.prosrc like '%is_equipe_gestor_ou_admin%'
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def, 'is_equipe_gestor_ou_admin()', 'is_entregas_gestor()');
    def := replace(def, 'equipe_empresas_visiveis()', 'entregas_empresas_visiveis()');
    execute def;
  end loop;

  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('entregas', 'entrega_bairros', 'entrega_rotas', 'entrega_paradas')
      and (qual like '%is_equipe_gestor_ou_admin%' or with_check like '%is_equipe_gestor_ou_admin%')
  loop
    execute format(
      'alter policy %I on %I.%I using (%s) with check (%s)',
      p.policyname, p.schemaname, p.tablename,
      replace(coalesce(p.qual, p.with_check), 'is_equipe_gestor_ou_admin()', 'is_entregas_gestor()'),
      replace(coalesce(p.with_check, p.qual), 'is_equipe_gestor_ou_admin()', 'is_entregas_gestor()')
    );
  end loop;
end $$;
