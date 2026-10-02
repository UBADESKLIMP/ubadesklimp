-- Etapa 4 (MVP+) — modelos de intervalo (PRD R4).
--
-- O intervalo total do dia continua sendo 2h. O que muda é como ele se divide.
-- Os modelos com café nascem DESLIGADOS por empresa (ponto_config
-- 'pausas_cafe_ativas'), porque dividir o intervalo é zona cinzenta e precisa
-- de aditivo/acordo antes (PRD R4, nota jurídica).

create type public.ponto_modelo_intervalo as enum (
  'almoco_2h',             -- padrão: 2h corridas, sem café
  'almoco_1h30_cafe_2x15', -- 1h30 + 15 min de manhã + 15 à tarde
  'almoco_1h30_cafe_1x30'  -- 1h30 + 30 min, de manhã ou à tarde
);

alter table public.staff_members
  add column if not exists modelo_intervalo public.ponto_modelo_intervalo
    not null default 'almoco_2h',
  -- A troca vale a partir do dia seguinte: mudar o modelo no meio do dia
  -- mexeria no cálculo de um almoço que já aconteceu.
  add column if not exists modelo_intervalo_desde date;

comment on column public.staff_members.modelo_intervalo is
  'Como o intervalo de 2h se divide. Troca registrada em modelo_intervalo_desde e válida a partir dela.';

create or replace function public.ponto_cafe_ativo(p_empresa_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (valor #>> '{}')::boolean from ponto_config
     where empresa_id = p_empresa_id and chave = 'pausas_cafe_ativas'),
    false
  )
$$;

-- Modelo em vigor num dia. Antes da data da troca, vale o padrão: quem nunca
-- escolheu, e quem escolheu ontem pra valer amanhã, cai no almoço de 2h.
create or replace function public.ponto_modelo_vigente(
  p_funcionario_id uuid,
  p_data date default null
)
returns public.ponto_modelo_intervalo
language plpgsql stable security definer set search_path = public as $$
declare
  v_dia date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_modelo public.ponto_modelo_intervalo;
  v_desde date;
  v_empresa uuid;
begin
  select modelo_intervalo, modelo_intervalo_desde, empresa_id
  into v_modelo, v_desde, v_empresa
  from staff_members where user_id = p_funcionario_id;

  if v_modelo is null then
    return 'almoco_2h';
  end if;

  -- P15: café desligado na empresa derruba o modelo pro padrão, mesmo que o
  -- cadastro do funcionário ainda guarde a escolha antiga.
  if v_modelo <> 'almoco_2h' and not public.ponto_cafe_ativo(v_empresa) then
    return 'almoco_2h';
  end if;

  if v_modelo <> 'almoco_2h' and (v_desde is null or v_dia < v_desde) then
    return 'almoco_2h';
  end if;

  return v_modelo;
end;
$$;

/** Minutos de almoço do modelo. É o que entra no cálculo do retorno (R1.1). */
create or replace function public.ponto_duracao_almoco(
  p_funcionario_id uuid,
  p_data date default null
)
returns int language sql stable security definer set search_path = public as $$
  select case public.ponto_modelo_vigente(p_funcionario_id, p_data)
    when 'almoco_2h' then 120
    else 90
  end
$$;

/** Quantas pausas de café o modelo permite no dia, e de quantos minutos. */
create or replace function public.ponto_cafe_por_dia(
  p_funcionario_id uuid,
  p_data date default null
)
returns table (quantidade int, minutos int)
language sql stable security definer set search_path = public as $$
  select case public.ponto_modelo_vigente(p_funcionario_id, p_data)
           when 'almoco_1h30_cafe_2x15' then 2
           when 'almoco_1h30_cafe_1x30' then 1
           else 0
         end,
         case public.ponto_modelo_vigente(p_funcionario_id, p_data)
           when 'almoco_1h30_cafe_2x15' then 15
           when 'almoco_1h30_cafe_1x30' then 30
           else 0
         end
$$;

-- Troca do modelo. Fica registrada com a data e só vale do dia seguinte.
create or replace function public.ponto_definir_modelo_intervalo(
  p_funcionario_id uuid,
  p_modelo public.ponto_modelo_intervalo
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_vale_de date;
begin
  select empresa_id into v_empresa from staff_members where user_id = p_funcionario_id;
  if v_empresa is null then
    raise exception 'Colaborador sem empresa vinculada.';
  end if;

  if not (public.is_equipe_gestor_ou_admin() or p_funcionario_id = auth.uid()) then
    raise exception 'Você só pode trocar o próprio modelo de intervalo.';
  end if;

  -- P15: enquanto o café estiver desligado na empresa, os modelos com café
  -- nem podem ser escolhidos.
  if p_modelo <> 'almoco_2h' and not public.ponto_cafe_ativo(v_empresa) then
    raise exception
      'As pausas de café estão desligadas nesta empresa. Ligue em Ponto > Configurações antes de escolher este modelo.';
  end if;

  v_vale_de := ((now() at time zone 'America/Sao_Paulo')::date) + 1;

  update staff_members
  set modelo_intervalo = p_modelo,
      modelo_intervalo_desde = case when p_modelo = 'almoco_2h' then null else v_vale_de end
  where user_id = p_funcionario_id;

  return jsonb_build_object('ok', true, 'modelo', p_modelo,
    'vale_a_partir_de', case when p_modelo = 'almoco_2h' then null else v_vale_de end);
end;
$$;
