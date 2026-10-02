-- O trigger que alimenta a Parte 1 passa a cobrir o retorno do café e a usar
-- a duração do almoço do MODELO da pessoa (90 ou 120), não mais só a coluna
-- fixa do cadastro.
create or replace function public.ponto_trg_gerar_atraso()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_marcacao public.equipe_marcacao;
  v_data date;
  v_hora time;
  v_saida time;
  v_duracao int;
  v_porta boolean := false;
  v_hora_porta time;
  v_cafe record;
  v_calc record;
begin
  v_marcacao := case new.tipo
    when 'entrada' then 'entrada'::public.equipe_marcacao
    when 'retorno_almoco' then 'retorno_almoco'::public.equipe_marcacao
    when 'retorno_pausa' then 'retorno_pausa'::public.equipe_marcacao
    else null
  end;
  if v_marcacao is null then
    return new;
  end if;

  v_data := (new.registrado_em at time zone 'America/Sao_Paulo')::date;
  v_hora := (new.registrado_em at time zone 'America/Sao_Paulo')::time;

  if v_marcacao = 'entrada' then
    v_porta := new.estava_na_porta;

    select p.hora_chegada_porta into v_hora_porta
    from equipe_abertura_presentes p
    where p.empresa_id = new.empresa_id
      and p.data = v_data
      and p.colaborador_id = new.funcionario_id;

    -- found, e não "hora não nula": a hora de chegada é opcional.
    if found then
      v_porta := true;
    end if;

  else
    -- Qual saída esta volta está medindo: a do almoço ou a da última pausa.
    select (registrado_em at time zone 'America/Sao_Paulo')::time
    into v_saida
    from ponto_marcacoes
    where funcionario_id = new.funcionario_id
      and tipo = (case when v_marcacao = 'retorno_almoco' then 'saida_almoco' else 'saida_pausa' end)
        ::public.ponto_marcacao_tipo
      and (registrado_em at time zone 'America/Sao_Paulo')::date = v_data
      and registrado_em < new.registrado_em
    order by registrado_em desc
    limit 1;

    if v_saida is null then
      return new;
    end if;

    if v_marcacao = 'retorno_almoco' then
      v_duracao := public.ponto_duracao_almoco(new.funcionario_id, v_data);
    else
      select * into v_cafe from public.ponto_cafe_por_dia(new.funcionario_id, v_data);
      v_duracao := v_cafe.minutos;
      -- Modelo sem café: a batida existe (veio de antes da troca de modelo),
      -- mas não há duração contra a qual medir.
      if coalesce(v_duracao, 0) = 0 then
        return new;
      end if;
    end if;
  end if;

  select * into v_calc from public.equipe_calcular_atraso(
    new.funcionario_id, new.empresa_id, v_data, v_marcacao, v_hora,
    v_porta, v_hora_porta, v_saida, v_duracao
  );

  if coalesce(v_calc.variacao_bruta_min, 0) <= 0 then
    return new;
  end if;

  if exists (
    select 1 from equipe_atrasos
    where colaborador_id = new.funcionario_id
      and data = v_data
      and marcacao = v_marcacao
      and coalesce(saida_almoco_real, '00:00'::time) = coalesce(v_saida, '00:00'::time)
      and status <> 'substituido'
  ) then
    return new;
  end if;

  insert into equipe_atrasos (
    colaborador_id, empresa_id, data, marcacao, hora_chegada,
    estava_na_porta, hora_chegada_porta, saida_almoco_real,
    duracao_almoco_override_min, criado_por
  ) values (
    new.funcionario_id, new.empresa_id, v_data, v_marcacao, v_hora,
    v_porta, v_hora_porta, v_saida,
    case when v_marcacao = 'entrada' then null else v_duracao end,
    coalesce(new.marcado_por, new.funcionario_id)
  );

  return new;

exception when others then
  raise warning 'ponto_trg_gerar_atraso falhou para a marcação %: %', new.id, sqlerrm;
  return new;
end;
$$;
