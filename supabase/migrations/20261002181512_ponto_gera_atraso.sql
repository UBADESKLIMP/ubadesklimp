-- Etapa 3 (A): a Parte 1 para de depender de lançamento manual.
-- Toda batida de entrada ou de retorno do almoço passa pelo cálculo da Parte 1
-- e, se a pessoa chegou depois da referência, vira um registro de atraso.
--
-- Chegar na hora ou adiantado NÃO gera linha. Atraso pequeno (dentro da
-- tolerância da marcação) gera, porque é ele que soma pra tolerância do dia
-- (tol_dia_min) — três chegadas de 4 min viram atraso no fim do dia.

-- Um lançamento por colaborador/dia/marcação. A correção continua possível
-- pelo caminho de sempre (substitui_id marca a antiga como 'substituido').
create unique index if not exists equipe_atrasos_um_por_dia
  on public.equipe_atrasos (colaborador_id, data, marcacao)
  where status <> 'substituido';

-- O índice é a garantia; este trigger é só pra mensagem legível no painel.
create or replace function public.equipe_trg_atraso_unico_no_dia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from equipe_atrasos
    where colaborador_id = new.colaborador_id
      and data = new.data
      and marcacao = new.marcacao
      and status <> 'substituido'
  ) then
    raise exception
      'Já existe lançamento de % para esse colaborador em %. Para corrigir, substitua o lançamento existente.',
      new.marcacao, to_char(new.data, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipe_atraso_unico_no_dia on public.equipe_atrasos;
create trigger trg_equipe_atraso_unico_no_dia
  before insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_atraso_unico_no_dia();

-- Esta primeira versão só aplicava a regra da porta quando havia hora de
-- chegada anotada; a migration seguinte corrige.
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
  -- Só entrada e retorno do almoço viram atraso (Parte 1 R1 e R1.1).
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
    select hora_chegada_porta into v_hora_porta
    from equipe_abertura_presentes
    where empresa_id = new.empresa_id
      and data = v_data
      and colaborador_id = new.funcionario_id;
    if v_hora_porta is not null then
      v_porta := true;
    end if;
  end if;

  select * into v_calc from public.equipe_calcular_atraso(
    new.funcionario_id, new.empresa_id, v_data, v_marcacao, v_hora,
    v_porta, v_hora_porta, v_saida_almoco, null
  );

  -- Sem escala cadastrada o cálculo volta nulo: não inventa atraso.
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
  -- Nada aqui pode derrubar a batida: a marcação é a prova da jornada e já
  -- está gravada. Se o lançamento do atraso falhar (mês fechado, escala
  -- incompleta), o gestor lança pela tela, e o motivo fica no log do banco.
  raise warning 'ponto_trg_gerar_atraso falhou para a marcação %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_ponto_gerar_atraso on public.ponto_marcacoes;
create trigger trg_ponto_gerar_atraso
  after insert on public.ponto_marcacoes
  for each row execute function public.ponto_trg_gerar_atraso();

comment on trigger trg_ponto_gerar_atraso on public.ponto_marcacoes is
  'Etapa 3: a batida alimenta a Parte 1 sozinha. Lançamento manual continua valendo para o que não passou pelo ponto.';
