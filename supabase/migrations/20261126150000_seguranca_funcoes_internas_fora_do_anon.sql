-- Funcoes SECURITY DEFINER internas (helpers, calculos, escritas que nao sao chamadas pelo site sem login)
-- deixam de ser executaveis por "anon". Ficam para anon so: quiosque/QR do ponto (PIN + estacao)
-- e a rota do entregador (PIN). Quem esta logado (authenticated) continua igual.
-- Fecha, entre outras, ponto_pin_confere (dava para testar PIN de qualquer id sem limite).
do $do$
declare
  r record;
  permitidas_anon text[] := array[
    'ponto_abrir_loja_por_pin','ponto_anotar_chinelo','ponto_ativar_estacao','ponto_buscar_produto',
    'ponto_contestar_por_pin','ponto_contexto_do_painel','ponto_definir_atalhos','ponto_dispositivo_por_pin',
    'ponto_estacao_contexto','ponto_estacao_ficha','ponto_heartbeat','ponto_marcar_presentes_por_pin',
    'ponto_meu_ponto_por_pin','ponto_minhas_marcacoes_por_pin','ponto_qr_contexto','ponto_registrar_estacao',
    'ponto_registrar_pelo_painel','ponto_registrar_por_pin','ponto_reportar_faltantes_por_pin',
    'ponto_saida_almoco_sem_entrada','ponto_sair_do_quiosque',
    'entrega_minha_rota','entrega_registrar'
  ];
  usadas text;
  n int := 0;
begin
  -- Tudo que policies, defaults, constraints e views chamam precisa continuar executavel por anon.
  select string_agg(coalesce(pg_get_expr(polqual, polrelid),'') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid),''), ' ')
    into usadas from pg_policy;
  usadas := coalesce(usadas,'') || ' ' || coalesce((select string_agg(pg_get_expr(adbin, adrelid), ' ') from pg_attrdef), '')
         || ' ' || coalesce((select string_agg(pg_get_constraintdef(oid), ' ') from pg_constraint where contype = 'c'), '')
         || ' ' || coalesce((select string_agg(definition, ' ') from pg_views where schemaname not in ('pg_catalog','information_schema')), '');

  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (permitidas_anon)
      and position(p.proname in usadas) = 0
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'funcoes ajustadas: %', n;
end
$do$;
