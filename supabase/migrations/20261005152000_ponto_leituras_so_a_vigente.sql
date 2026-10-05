-- Toda leitura passa a enxergar só a batida que vale. A substituída continua no
-- banco e na verificação de integridade, mas não aparece em tela nenhuma — era
-- ela que faria a lista ter duas linhas e precisar de explicação.

create or replace function public.ponto_marcacoes_do_dia(p_empresa_id uuid, p_data date default null)
returns jsonb language plpgsql security definer stable set search_path = public as $FN$
declare
  v_dia date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê as marcações do dia.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'nome', sm.display_name, 'tipo', m.tipo,
    'hora', to_char(m.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
    'local', l.nome, 'origem', m.origem, 'confirmacao', m.confirmacao,
    'marcado_por', resp.display_name, 'motivo_lancamento', m.motivo_lancamento,
    -- a hora que estava antes, pra quem quiser conferir sem sair da tela
    'hora_anterior', to_char(ant.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
    'ip', host(m.ip), 'codigo', upper(left(m.hash, 8))
  ) order by m.registrado_em), '[]'::jsonb)
  into v_res
  from ponto_marcacoes m
  join staff_members sm on sm.user_id = m.funcionario_id
  left join ponto_locais l on l.id = m.local_id
  left join staff_members resp on resp.user_id = m.marcado_por
  left join ponto_marcacoes ant on ant.substituida_por = m.id
  where m.empresa_id = p_empresa_id
    and m.substituida_por is null
    and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_dia;

  return v_res;
end;
$FN$;

create or replace function public.ponto_agora_na_loja(p_empresa_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $FN$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê quem está na loja.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'funcionario_id', x.user_id,
    'nome', x.display_name,
    'situacao', x.situacao,
    'desde', x.desde
  ) order by x.display_name), '[]'::jsonb)
  into v_res
  from (
    select sm.user_id, sm.display_name,
      case
        when d.saida then 'saiu'
        when d.saida_pausa > d.retorno_pausa then 'em pausa'
        when d.saida_almoco and not d.retorno_almoco then 'em almoço'
        when d.entrada then 'na loja'
        else 'não chegou'
      end as situacao,
      d.ultima as desde
    from staff_members sm
    left join lateral (
      select
        bool_or(tipo='entrada') as entrada,
        bool_or(tipo='saida_almoco') as saida_almoco,
        bool_or(tipo='retorno_almoco') as retorno_almoco,
        bool_or(tipo='saida') as saida,
        count(*) filter (where tipo='saida_pausa') as saida_pausa,
        count(*) filter (where tipo='retorno_pausa') as retorno_pausa,
        max(registrado_em) as ultima
      from ponto_marcacoes m
      where m.funcionario_id = sm.user_id
        and m.substituida_por is null
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    ) d on true
    where sm.empresa_id = p_empresa_id
  ) x;

  return v_res;
end;
$FN$;

create or replace function public.ponto_proxima_marcacao(p_funcionario_id uuid)
returns public.ponto_marcacao_tipo
language plpgsql stable security definer set search_path = public as $FN$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
begin
  select
    bool_or(tipo = 'entrada') as entrada,
    bool_or(tipo = 'saida_almoco') as saida_almoco,
    bool_or(tipo = 'retorno_almoco') as retorno_almoco,
    bool_or(tipo = 'saida') as saida,
    count(*) filter (where tipo = 'saida_pausa') as saidas_pausa,
    count(*) filter (where tipo = 'retorno_pausa') as retornos_pausa
  into v_tem
  from ponto_marcacoes
  where funcionario_id = p_funcionario_id
    and substituida_por is null
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  if coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0) then
    return 'retorno_pausa';
  end if;

  if v_tem is null or not coalesce(v_tem.entrada, false) then return 'entrada'; end if;
  if not coalesce(v_tem.saida_almoco, false) then return 'saida_almoco'; end if;
  if not coalesce(v_tem.retorno_almoco, false) then return 'retorno_almoco'; end if;
  if not coalesce(v_tem.saida, false) then return 'saida'; end if;
  return 'hora_extra_inicio';
end;
$FN$;

create or replace function public.ponto_sequencia_valida(
  p_funcionario_id uuid,
  p_tipo public.ponto_marcacao_tipo
)
returns boolean language plpgsql stable security definer set search_path = public as $FN$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem record;
  v_cafe record;
begin
  select
    bool_or(tipo = 'entrada') as entrada,
    bool_or(tipo = 'saida_almoco') as saida_almoco,
    bool_or(tipo = 'retorno_almoco') as retorno_almoco,
    bool_or(tipo = 'saida') as saida,
    count(*) filter (where tipo = 'saida_pausa') as saidas_pausa,
    count(*) filter (where tipo = 'retorno_pausa') as retornos_pausa,
    bool_or(tipo = 'hora_extra_inicio') as he_inicio,
    bool_or(tipo = 'hora_extra_saida') as he_saida
  into v_tem
  from ponto_marcacoes
  where funcionario_id = p_funcionario_id
    and substituida_por is null
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  select * into v_cafe from public.ponto_cafe_por_dia(p_funcionario_id, v_hoje);

  return case p_tipo
    when 'entrada' then not coalesce(v_tem.entrada, false)
    when 'saida_almoco' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida_almoco, false)
    when 'retorno_almoco' then coalesce(v_tem.saida_almoco, false) and not coalesce(v_tem.retorno_almoco, false)
    when 'saida' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida, false)
    when 'hora_extra_inicio' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.he_inicio, false)
    when 'hora_extra_saida' then coalesce(v_tem.he_inicio, false) and not coalesce(v_tem.he_saida, false)
    when 'saida_pausa' then coalesce(v_tem.entrada, false)
      and coalesce(v_cafe.quantidade, 0) > 0
      and coalesce(v_tem.saidas_pausa, 0) = coalesce(v_tem.retornos_pausa, 0)
      and coalesce(v_tem.saidas_pausa, 0) < v_cafe.quantidade
    when 'retorno_pausa' then coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0)
  end;
end;
$FN$;
