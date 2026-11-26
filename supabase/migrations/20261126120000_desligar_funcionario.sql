-- Desligar funcionário: perde o acesso, some das listas, e o histórico de ponto fica guardado.
-- (Excluir de vez não dá: ponto, atrasos, justificativas e medidas apontam para a pessoa.)

alter table public.staff_members
  add column if not exists desligado_em timestamptz;

comment on column public.staff_members.desligado_em is
  'Quando foi desligado. Nulo = ativo. A conta de login fica bloqueada e o histórico de ponto é mantido.';

-- PIN de quem foi desligado nunca confere (quiosque, painel, qualquer tela por PIN).
create or replace function public.ponto_pin_confere(p_funcionario_id uuid, p_pin text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text;
begin
  if exists (select 1 from public.staff_members where user_id = p_funcionario_id and desligado_em is not null) then
    return false;
  end if;
  select encrypted_password into v_hash from auth.users where id = p_funcionario_id;
  if v_hash is null then
    return false;
  end if;
  return v_hash = crypt(p_pin || '-pin', v_hash) or v_hash = crypt(p_pin, v_hash);
end;
$function$;

-- Lista de pessoas do lançamento manual: só quem está ativo.
create or replace function public.ponto_pessoas_da_empresa(p_empresa_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Sem acesso.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'nome', display_name)
                              order by display_name), '[]'::jsonb)
    from staff_members where empresa_id = p_empresa_id and desligado_em is null
  );
end;
$function$;

-- Espelho do mês: desligado some a partir do mês seguinte ao desligamento;
-- no mês em que saiu, os dias depois da saída não contam como falta.
create or replace function public.ponto_espelho_mensal(p_empresa_id uuid, p_mes date, p_funcionario_id uuid default null::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê o espelho de ponto.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  with pessoas as (
    select sm.user_id, sm.display_name, sm.matricula, sm.cargo, sm.cpf, sm.pis, sm.endereco,
           coalesce(sm.duracao_almoco_min, 120) as almoco_min,
           (sm.desligado_em at time zone 'America/Sao_Paulo')::date as desligado_dia
    from staff_members sm
    where sm.empresa_id = p_empresa_id and sm.fora_do_ponto = false
      and (sm.desligado_em is null or (sm.desligado_em at time zone 'America/Sao_Paulo')::date >= v_ini)
      and (p_funcionario_id is null or sm.user_id = p_funcionario_id)
  ),
  batidas as (
    select m.funcionario_id, (m.registrado_em at time zone 'America/Sao_Paulo')::date as d,
           m.tipo, (m.registrado_em at time zone 'America/Sao_Paulo')::time as h
    from ponto_marcacoes m
    where m.empresa_id = p_empresa_id and m.substituida_por is null
      and (m.registrado_em at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
  ),
  base as (
    select p.user_id, dias.d::date as d,
           max(b.h) filter (where b.tipo='entrada')           as entrada,
           max(b.h) filter (where b.tipo='saida_almoco')      as saida_almoco,
           max(b.h) filter (where b.tipo='retorno_almoco')    as retorno_almoco,
           max(b.h) filter (where b.tipo='saida')             as saida,
           max(b.h) filter (where b.tipo='hora_extra_inicio') as extra_entrada,
           max(b.h) filter (where b.tipo='hora_extra_saida')  as extra_saida,
           esc.nome    as escala_nome,
           esc.entrada as esc_entrada,
           esc.saida   as esc_saida,
           ((extract(isodow from dias.d)::int = any(esc.dias_semana))
             and (p.desligado_dia is null or dias.d::date <= p.desligado_dia)) as previsto,
           case
             when extract(epoch from (esc.saida - esc.entrada))/60 <= 360
               then (extract(epoch from (esc.saida - esc.entrada))/60)::int
             else greatest(extract(epoch from (esc.saida - esc.entrada))/60 - p.almoco_min, 0)::int
           end as jornada_min
    from pessoas p
    cross join generate_series(v_ini, v_fim, '1 day') dias(d)
    cross join lateral public.equipe_escala_do_dia(p.user_id, dias.d::date) esc
    left join batidas b on b.funcionario_id = p.user_id and b.d = dias.d::date
    group by p.user_id, dias.d, esc.nome, esc.entrada, esc.saida, esc.dias_semana, p.almoco_min, p.desligado_dia
  ),
  t as (
    select b.*,
      case
        when b.entrada is null and b.previsto and b.d < v_hoje then 'falta'
        when b.entrada is null then null
        when b.saida is null then 'sem_saida'
        when b.saida_almoco is not null and b.retorno_almoco is null then 'sem_retorno'
        when b.saida_almoco is null
             and extract(epoch from (b.saida - b.entrada))/60 > 360 then 'sem_almoco'
        else null
      end as problema,
      case
        when b.entrada is null or b.saida is null then null
        when b.saida_almoco is not null and b.retorno_almoco is not null
          then (extract(epoch from (b.saida_almoco - b.entrada) + (b.saida - b.retorno_almoco))/60)::int
        else (extract(epoch from (b.saida - b.entrada))/60)::int
      end as total_min
    from base b
  ),
  calc as (
    select t.*,
      case when t.problema in ('falta','sem_saida','sem_retorno') then 'furo'
           when t.problema = 'sem_almoco' then 'aviso'
           else null end as grau,
      case when t.total_min is null then null
           when t.previsto then t.total_min - t.jornada_min
           else t.total_min end as saldo_min,
      (not t.previsto and t.entrada is not null) as fora_da_escala
    from t
  )
  select jsonb_build_object(
    'empresa', (select jsonb_build_object('razao_social', razao_social, 'cnpj', cnpj)
                  from empresas where id = p_empresa_id),
    'mes', to_char(v_ini, 'YYYY-MM'),
    'pessoas', coalesce(jsonb_agg(pessoa order by nome), '[]'::jsonb))
  into v_res
  from (
    select p.display_name as nome,
      jsonb_build_object(
        'funcionario_id', p.user_id, 'nome', p.display_name,
        'matricula', p.matricula, 'cargo', p.cargo, 'cpf', p.cpf, 'pis', p.pis,
        'endereco', p.endereco,
        'jornada', (select string_agg(distinct x.escala_nome, ' · ')
                      from calc x where x.user_id = p.user_id),
        'jornada_min', (select max(x.jornada_min) from calc x where x.user_id = p.user_id),
        'dias', (
          select jsonb_agg(jsonb_build_object(
            'data', to_char(c.d, 'YYYY-MM-DD'),
            'previsto', c.previsto,
            'futuro', (c.d > v_hoje),
            'fora_da_escala', c.fora_da_escala,
            'escala_nome', c.escala_nome,
            'escala_entrada', to_char(c.esc_entrada,'HH24:MI'),
            'escala_saida', to_char(c.esc_saida,'HH24:MI'),
            'jornada_min', case when c.previsto then c.jornada_min else 0 end,
            'entrada', to_char(c.entrada,'HH24:MI'),
            'saida_almoco', to_char(c.saida_almoco,'HH24:MI'),
            'retorno_almoco', to_char(c.retorno_almoco,'HH24:MI'),
            'saida', to_char(c.saida,'HH24:MI'),
            'extra_entrada', to_char(c.extra_entrada,'HH24:MI'),
            'extra_saida', to_char(c.extra_saida,'HH24:MI'),
            'total_min', c.total_min,
            'saldo_min', c.saldo_min,
            'problema', c.problema,
            'grau', c.grau,
            'atraso_min', (select max(a.minutos_atraso) from equipe_atrasos a
                            where a.colaborador_id = p.user_id and a.data = c.d
                              and not a.dentro_tolerancia)
          ) order by c.d)
          from calc c where c.user_id = p.user_id),
        'totais', (
          select jsonb_build_object(
            'trabalhado_min', coalesce(sum(c.total_min),0),
            'previsto_min', coalesce(sum(case when c.previsto and (c.d < v_hoje or c.total_min is not null) then c.jornada_min else 0 end),0),
            'saldo_min', coalesce(sum(c.saldo_min),0),
            'dias_trabalhados', count(*) filter (where c.entrada is not null),
            'furos', count(*) filter (where c.grau = 'furo'),
            'avisos', count(*) filter (where c.grau = 'aviso'),
            'faltas', count(*) filter (where c.problema = 'falta'),
            'dias_fora_da_escala', count(*) filter (where c.fora_da_escala),
            'min_fora_da_escala', coalesce(sum(c.total_min) filter (where c.fora_da_escala), 0),
            'atrasos', (select count(*) from equipe_atrasos a
                         where a.colaborador_id = p.user_id and not a.dentro_tolerancia
                           and a.data between v_ini and v_fim))
          from calc c where c.user_id = p.user_id)
      ) as pessoa
    from pessoas p
  ) x;

  return v_res;
end;
$function$;
