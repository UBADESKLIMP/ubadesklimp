-- Correção: estar na porta é o fato que importa, não a hora de chegada.
-- A hora é opcional (Parte 1 R3: sem ela, a referência vira a hora da
-- abertura). A versão anterior só aplicava a regra quando a hora existia, o
-- que deixava de fora exatamente o caso mais comum — a responsável marca quem
-- estava ali sem anotar hora nenhuma.
create or replace function public.ponto_trg_gerar_atraso()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_marcacao public.equipe_marcacao;
  v_data date;
  v_hora time;
  v_saida_almoco time;
  v_porta boolean := false;
  v_hora_porta time;
  v_calc record;
begin
  v_marcacao := case new.tipo
    when 'entrada' then 'entrada'::public.equipe_marcacao
    when 'retorno_almoco' then 'retorno_almoco'::public.equipe_marcacao
    else null
  end;
  if v_marcacao is null then
    return new;
  end if;

  v_data := (new.registrado_em at time zone 'America/Sao_Paulo')::date;
  v_hora := (new.registrado_em at time zone 'America/Sao_Paulo')::time;

  if v_marcacao = 'retorno_almoco' then
    select (registrado_em at time zone 'America/Sao_Paulo')::time
    into v_saida_almoco
    from ponto_marcacoes
    where funcionario_id = new.funcionario_id
      and tipo = 'saida_almoco'
      and (registrado_em at time zone 'America/Sao_Paulo')::date = v_data
    order by registrado_em desc
    limit 1;

    if v_saida_almoco is null then
      return new;
    end if;
  else
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
  end if;

  select * into v_calc from public.equipe_calcular_atraso(
    new.funcionario_id, new.empresa_id, v_data, v_marcacao, v_hora,
    v_porta, v_hora_porta, v_saida_almoco, null
  );

  if coalesce(v_calc.variacao_bruta_min, 0) <= 0 then
    return new;
  end if;

  if exists (
    select 1 from equipe_atrasos
    where colaborador_id = new.funcionario_id
      and data = v_data
      and marcacao = v_marcacao
      and status <> 'substituido'
  ) then
    return new;
  end if;

  insert into equipe_atrasos (
    colaborador_id, empresa_id, data, marcacao, hora_chegada,
    estava_na_porta, hora_chegada_porta, saida_almoco_real, criado_por
  ) values (
    new.funcionario_id, new.empresa_id, v_data, v_marcacao, v_hora,
    v_porta, v_hora_porta, v_saida_almoco,
    coalesce(new.marcado_por, new.funcionario_id)
  );

  return new;

exception when others then
  raise warning 'ponto_trg_gerar_atraso falhou para a marcação %: %', new.id, sqlerrm;
  return new;
end;
$$;
