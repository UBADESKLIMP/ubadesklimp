-- A cadeia de hash era montada na ordem de gravação ("a última batida por
-- registrado_em") mas conferida na ordem do horário do evento. Enquanto toda
-- batida acontecia agora, as duas ordens eram a mesma. Quando entrou o
-- lançamento manual, com hora retroativa, elas passaram a divergir — e a
-- verificação de integridade passou a acusar violação em registros intactos.
--
-- Reproduzido antes de corrigir: duas batidas, a segunda com hora três horas
-- atrás, e ponto_verificar_integridade devolvia ok:false com duas quebras.
-- Uma verificação que acusa sozinha é pior que nenhuma: ninguém volta a olhar.
--
-- A cadeia passa a seguir created_at, que é quando a linha foi escrita e nunca
-- muda. É o que ela deveria provar desde o começo: que nada foi inserido ou
-- alterado depois do fato. O horário do evento continua livre para ser
-- retroativo, que é o caso de uso legítimo.

create or replace function public.ponto_ultimo_hash(p_empresa_id uuid)
returns text language sql stable security definer set search_path = public as $FN$
  select hash from ponto_marcacoes
  where empresa_id = p_empresa_id
  order by created_at desc, id desc
  limit 1
$FN$;

create or replace function public.ponto_verificar_integridade(p_empresa_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $FN$
declare
  r record;
  v_esperado text;
  v_anterior text := null;
  v_total int := 0;
  v_quebras jsonb := '[]'::jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin verifica a integridade do ponto.';
  end if;

  for r in
    select * from ponto_marcacoes
    where empresa_id = p_empresa_id
    order by created_at, id
  loop
    v_total := v_total + 1;
    v_esperado := public.ponto_calcular_hash(
      r.empresa_id, r.funcionario_id, r.tipo::text, r.registrado_em, v_anterior);

    if r.hash is distinct from v_esperado or r.hash_anterior is distinct from v_anterior then
      v_quebras := v_quebras || jsonb_build_object(
        'marcacao_id', r.id,
        'registrado_em', r.registrado_em,
        'hash_guardado', r.hash,
        'hash_esperado', v_esperado
      );
    end if;
    v_anterior := r.hash;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_quebras) = 0,
    'marcacoes_verificadas', v_total,
    'quebras', v_quebras
  );
end;
$FN$;

-- As quatro funções que escrevem marcação repetem o mesmo trecho de montagem
-- da cadeia. Em vez de recopiar os corpos inteiros aqui — e arriscar que esta
-- cópia envelheça em relação ao que está no banco —, troca-se o trecho na
-- definição viva de cada uma.
do $PATCH$
declare
  r record;
  v_novo text;
  v_trocadas int := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('ponto_registrar', 'ponto_marcar_presentes',
                        'ponto_lancar_marcacao', 'ponto_registrar_pelo_painel')
  loop
    v_novo := regexp_replace(
      r.def,
      'select hash into v_hash_anterior from ponto_marcacoes\s+where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;',
      'v_hash_anterior := public.ponto_ultimo_hash(v_empresa);',
      'g'
    );

    if v_novo = r.def then
      raise exception 'Não encontrei o trecho da cadeia em %. Confira antes de seguir.', r.proname;
    end if;

    execute v_novo;
    v_trocadas := v_trocadas + 1;
  end loop;

  if v_trocadas <> 4 then
    raise exception 'Esperava corrigir 4 funções, corrigi %.', v_trocadas;
  end if;
end;
$PATCH$;
