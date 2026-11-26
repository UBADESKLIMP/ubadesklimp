-- empresas e escalas eram legiveis por qualquer pessoa com login (inclusive cliente da loja).
-- Passam a ser legiveis so por quem e da equipe.
drop policy if exists "Staff autenticado lê empresas" on public.empresas;
create policy "Equipe lê empresas" on public.empresas
  for select to authenticated
  using (public.is_staff_member());

drop policy if exists "Staff autenticado lê escalas" on public.equipe_escalas;
create policy "Equipe lê escalas" on public.equipe_escalas
  for select to authenticated
  using (public.is_staff_member());

-- Funcoes puras sem search_path fixo.
alter function public.equipe_dias_uteis(date, date) set search_path = public, pg_temp;
alter function public.ponto_tipo_para_justificativa(ponto_marcacao_tipo) set search_path = public, pg_temp;
alter function public.ponto_tipo_legivel(ponto_marcacao_tipo) set search_path = public, pg_temp;
alter function public.ponto_tipo_do_ajuste(equipe_marcacao_ponto) set search_path = public, pg_temp;
