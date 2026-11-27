-- Aplicada no Supabase em 27/11/2026 (migration ponto_abertura_desligados_e_entrada_da_responsavel).
-- Achado no teste real de 27/11:
--  1) Larissa (desligada em 26/11) ainda aparecia na lista "quem estava na porta" -> pendentes e
--     marcar_presentes agora ignoram desligado_em e fora_do_ponto.
--  2) Quem abre a loja (Leticia) nao tinha a propria entrada gravada: P25 tira a responsavel da
--     lista, e abrir_loja so gravava a hora de abertura -> agora abrir_loja (via estacao) tambem
--     registra a entrada individual dela, se ainda nao bateu hoje.
-- Corpo completo das funcoes: ver pg_get_functiondef de public.ponto_abrir_loja e public.ponto_marcar_presentes.

-- ponto_abrir_loja: trecho novo depois do insert em equipe_aberturas
--   if v_origem = 'estacao' and not exists (entrada da responsavel hoje) then
--     v_propria := public.ponto_registrar(p_responsavel_id, p_pin, 'entrada', p_estacao_token);
--   end if;
-- e no filtro de pendentes: and sm.desligado_em is null and not sm.fora_do_ponto
-- retorno ganhou 'entrada_propria' (boolean).

-- ponto_marcar_presentes: a checagem de existencia do funcionario agora exige desligado_em is null.
