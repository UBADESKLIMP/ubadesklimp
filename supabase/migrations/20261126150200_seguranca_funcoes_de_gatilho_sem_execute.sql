-- Funcao de gatilho nao precisa de EXECUTE para disparar (so se confere ao criar o gatilho).
do $do$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
  end loop;
end
$do$;
