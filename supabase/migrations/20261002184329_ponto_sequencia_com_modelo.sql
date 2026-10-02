-- A sequência passa a conhecer o modelo de intervalo (PRD R4).
--
-- Antes, pausa de café era aceita por qualquer um desde que tivesse batido
-- entrada — o que deixava alguém no almoço de 2h tirar café por cima das 2h
-- (P15b) e deixava tirar pausa sem limite no modelo 2x15 (P13).
create or replace function public.ponto_sequencia_valida(
  p_funcionario_id uuid,
  p_tipo public.ponto_marcacao_tipo
)
returns boolean language plpgsql stable security definer set search_path = public as $$
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
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  select * into v_cafe from public.ponto_cafe_por_dia(p_funcionario_id, v_hoje);

  return case p_tipo
    when 'entrada' then not coalesce(v_tem.entrada, false)
    when 'saida_almoco' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida_almoco, false)
    when 'retorno_almoco' then coalesce(v_tem.saida_almoco, false) and not coalesce(v_tem.retorno_almoco, false)
    when 'saida' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.saida, false)
    when 'hora_extra_inicio' then coalesce(v_tem.entrada, false) and not coalesce(v_tem.he_inicio, false)
    when 'hora_extra_saida' then coalesce(v_tem.he_inicio, false) and not coalesce(v_tem.he_saida, false)

    -- P15b (modelo sem café) e P13 (pausa além do que o modelo dá) caem aqui:
    -- quantidade 0 reprova qualquer pausa.
    when 'saida_pausa' then coalesce(v_tem.entrada, false)
      and coalesce(v_cafe.quantidade, 0) > 0
      and coalesce(v_tem.saidas_pausa, 0) = coalesce(v_tem.retornos_pausa, 0)
      and coalesce(v_tem.saidas_pausa, 0) < v_cafe.quantidade

    when 'retorno_pausa' then coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0)
  end;
end;
$$;

-- A sugestão também respeita o modelo: quem não tem café nunca vê pausa.
create or replace function public.ponto_proxima_marcacao(p_funcionario_id uuid)
returns public.ponto_marcacao_tipo
language plpgsql stable security definer set search_path = public as $$
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
    and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje;

  -- Está no café agora: o que falta é voltar dele, antes de qualquer outra coisa.
  if coalesce(v_tem.saidas_pausa, 0) > coalesce(v_tem.retornos_pausa, 0) then
    return 'retorno_pausa';
  end if;

  if v_tem is null or not coalesce(v_tem.entrada, false) then return 'entrada'; end if;
  if not coalesce(v_tem.saida_almoco, false) then return 'saida_almoco'; end if;
  if not coalesce(v_tem.retorno_almoco, false) then return 'retorno_almoco'; end if;
  if not coalesce(v_tem.saida, false) then return 'saida'; end if;
  return 'hora_extra_inicio';
end;
$$;
