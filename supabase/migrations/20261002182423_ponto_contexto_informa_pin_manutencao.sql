-- O quiosque só tranca o resto do site depois que existe PIN de manutenção.
-- Sem isso, quem registrasse o próprio PC ficava sem saída: o painel some e o
-- único jeito de voltar seria limpar o storage do navegador na mão.
create or replace function public.ponto_estacao_contexto(p_estacao_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_est record;
  v_ip inet := public.ponto_ip_origem();
  v_funcs jsonb;
begin
  select e.id, e.nome, l.id as local_id, l.nome as local_nome, l.empresa_id,
         l.marcacoes_permitidas
  into v_est
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_est is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', sm.user_id,
           'nome', sm.display_name,
           'pode_abrir_loja', public.ponto_tem_permissao(sm.user_id, 'abertura_coletiva')
         ) order by sm.display_name), '[]'::jsonb)
  into v_funcs
  from staff_members sm
  where sm.empresa_id = v_est.empresa_id;

  return jsonb_build_object(
    'ok', true,
    'estacao', v_est.nome,
    'local', v_est.local_nome,
    'empresa_id', v_est.empresa_id,
    'rede_ok', exists (select 1 from ponto_redes
                       where empresa_id = v_est.empresa_id and ativo and ip = v_ip),
    'modo_quiosque', public.ponto_tem_pin_manutencao(v_est.empresa_id),
    'funcionarios', v_funcs
  );
end;
$$;
