-- Abrir a loja de novo no mesmo dia trocava a hora de abertura (que entra no
-- cálculo de atraso). Agora a primeira hora vale: dentro da janela da lista dá
-- para voltar a ela; depois disso a abertura é recusada.
-- Altera só estes trechos da ponto_abrir_loja vigente e falha se algum não existir.
do $migracao$
declare
  v_def text := replace(pg_get_functiondef('public.ponto_abrir_loja(uuid,text,text,text,text)'::regprocedure), E'\r', '');
  v_novo text;
begin
  -- 1) recusa depois da janela, antes de gravar qualquer coisa
  v_novo := regexp_replace(v_def, '(\n\s*insert into equipe_aberturas )', $t$
  if exists (
    select 1 from equipe_aberturas a
    where a.empresa_id = v_empresa and a.data = v_hoje
      and now() > a.created_at
        + make_interval(mins => public.ponto_config_int(v_empresa, 'janela_abertura_coletiva_min', 10))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela',
      'mensagem', 'A loja já foi aberta hoje. Quem ainda não bateu a entrada usa o próprio PIN.');
  end if;
\1$t$);
  if v_novo = v_def then raise exception 'trecho do insert não encontrado'; end if;
  v_def := v_novo;

  -- 2) a hora já gravada não é sobrescrita
  v_novo := regexp_replace(v_def,
    'on conflict \(empresa_id, data\) do update\s+set hora_abertura = excluded\.hora_abertura, registrado_por = excluded\.registrado_por;',
    'on conflict (empresa_id, data) do nothing;');
  if v_novo = v_def then raise exception 'trecho do on conflict não encontrado'; end if;
  v_def := v_novo;

  -- 3) a tela mostra a hora gravada, não a de agora
  v_novo := replace(v_def,
    $t$'hora_abertura', (now() at time zone 'America/Sao_Paulo')::time,$t$,
    $t$'hora_abertura', (select a.hora_abertura from equipe_aberturas a where a.empresa_id = v_empresa and a.data = v_hoje),$t$);
  if v_novo = v_def then raise exception 'trecho do retorno não encontrado'; end if;

  execute v_novo;
end
$migracao$;
