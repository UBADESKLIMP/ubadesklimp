-- Sábado na loja é 08h às 13h, mas a equipe se divide: um grupo faz 08h-12h e
-- outro 09h-13h. O sistema só conhecia uma escala por pessoa e nem olhava o dia
-- da semana — media todo sábado contra as 08:00, então quem é do turno das 9h
-- levaria 60 minutos de atraso toda semana, e as horas previstas do sábado eram
-- zero (o dia inteiro caía como saldo positivo).
--
-- Em vez de uma coluna "escala_sabado_id", que pediria outra coluna no dia em
-- que a sexta for diferente, a pessoa passa a poder seguir várias escalas. Cada
-- escala já declara os dias que cobre; a do dia ganha da geral, e a que cobre
-- menos dias ganha da que cobre mais.

create table if not exists public.equipe_escalas_pessoa (
  user_id    uuid not null references public.staff_members(user_id) on delete cascade,
  escala_id  uuid not null references public.equipe_escalas(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, escala_id)
);

alter table public.equipe_escalas_pessoa enable row level security;

drop policy if exists "gestor_le_escalas_pessoa" on public.equipe_escalas_pessoa;
create policy "gestor_le_escalas_pessoa" on public.equipe_escalas_pessoa
  for select using (public.is_equipe_gestor_ou_admin() or user_id = auth.uid());

drop policy if exists "gestor_escreve_escalas_pessoa" on public.equipe_escalas_pessoa;
create policy "gestor_escreve_escalas_pessoa" on public.equipe_escalas_pessoa
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

-- Qual escala vale para esta pessoa neste dia.
create or replace function public.equipe_escala_do_dia(p_user uuid, p_data date)
returns public.equipe_escalas
language plpgsql stable security definer set search_path = public as $$
declare
  v_dow int := extract(isodow from p_data)::int;
  v_e public.equipe_escalas;
begin
  -- 1. escala atribuída à pessoa que cobre este dia; a que cobre menos dias
  --    ganha, porque é a mais específica (sábado vence seg-sáb).
  select e.* into v_e
  from equipe_escalas_pessoa ep
  join equipe_escalas e on e.id = ep.escala_id
  where ep.user_id = p_user and e.ativo and v_dow = any(e.dias_semana)
  order by coalesce(array_length(e.dias_semana, 1), 99)
  limit 1;
  if found then return v_e; end if;

  -- 2. a escala principal, quando ela cobre o dia
  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user and v_dow = any(e.dias_semana);
  if found then return v_e; end if;

  -- 3. a principal mesmo fora dos dias dela: é o que o sistema fazia antes de
  --    existir escala por dia, e quem lê decide o que fazer com isso.
  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user;
  return v_e;
end;
$$;

grant execute on function public.equipe_escala_do_dia(uuid, date) to authenticated;

-- O cálculo de atraso lia a escala fixa da pessoa; passa a perguntar qual vale
-- no dia. O corpo da função é trocado na definição viva porque ela é longa e
-- uma cópia aqui envelheceria em relação ao banco.
do $PATCH$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'equipe_calcular_atraso';

  v_novo := regexp_replace(v_def,
    'from\s+staff_members\s+sm\s+join\s+equipe_escalas\s+ee\s+on\s+ee\.id\s*=\s*sm\.escala_id\s+where\s+sm\.user_id\s*=\s*p_colaborador_id;',
    'from staff_members sm cross join lateral public.equipe_escala_do_dia(p_colaborador_id, p_data) ee where sm.user_id = p_colaborador_id;',
    'i');

  if v_novo = v_def then
    -- já aplicado numa execução anterior
    if v_def ilike '%equipe_escala_do_dia%' then return; end if;
    raise exception 'Não encontrei o trecho da escala em equipe_calcular_atraso.';
  end if;

  execute v_novo;
end;
$PATCH$;

-- Os dois turnos de sábado da loja. Ficam como escalas normais, de um dia só,
-- porque é isso que são.
insert into public.equipe_escalas
  (empresa_id, nome, dias_semana, entrada, saida, tol_marcacao_min, tol_dia_min, ativo)
select e.id, 'Sábado 08h-12h', array[6], '08:00', '12:00', 5, 10, true
from public.empresas e
where e.ativo and not exists (
  select 1 from public.equipe_escalas x where x.empresa_id = e.id and x.nome = 'Sábado 08h-12h');

insert into public.equipe_escalas
  (empresa_id, nome, dias_semana, entrada, saida, tol_marcacao_min, tol_dia_min, ativo)
select e.id, 'Sábado 09h-13h', array[6], '09:00', '13:00', 5, 10, true
from public.empresas e
where e.ativo and not exists (
  select 1 from public.equipe_escalas x where x.empresa_id = e.id and x.nome = 'Sábado 09h-13h');
