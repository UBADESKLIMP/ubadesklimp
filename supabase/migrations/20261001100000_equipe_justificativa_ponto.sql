-- Parte 2 do módulo Equipe: Justificativa de Ponto.
-- Substitui o caderno de papel por solicitações estruturadas, com aprovação
-- do gestor e ciência do colaborador reusando equipe_ciencias da Parte 1.

-- Salário-hora é usado só pra conferir se o valor pago pelo intervalo
-- suprimido cobre o mínimo legal (art. 71 §4º: período suprimido + 50%).
-- Dado sensível: fica atrás da mesma barreira do termo de adesão (admin).
alter table public.staff_members
  add column salario_hora numeric(10, 2);

comment on column public.staff_members.salario_hora is
  'Usado só no cálculo do mínimo legal do intervalo reduzido (art. 71 §4º CLT). Visível apenas para admin — equipe_funcionarios_gestor não expõe.';

create type public.equipe_justificativa_tipo as enum (
  'falha_sistema',
  'esquecimento',
  'marcacao_incorreta',
  'servico_externo',
  'consulta_atestado',
  'troca_turno_autorizada',
  'compensacao_atraso',
  'intervalo_reduzido_empresa'
);

create type public.equipe_justificativa_status as enum (
  'pendente', 'aprovada', 'rejeitada', 'aguardando_ciencia', 'concluida', 'substituida'
);

create type public.equipe_marcacao_ponto as enum (
  'entrada', 'saida_almoco', 'retorno_almoco', 'saida',
  'hora_extra_inicio', 'hora_extra_saida',
  'saida_intermediaria', 'retorno_intermediario'
);

-- Ciência passa a cobrir justificativa (a Parte 1 já previa 'fechamento').
alter type public.equipe_ciencia_alvo add value if not exists 'justificativa';

create table public.equipe_eventos_falha (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  data date not null,
  inicio time,
  fim time,
  descricao text not null,
  criado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now()
);

create table public.equipe_fechamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  competencia date not null,
  fechado_por uuid not null references public.staff_members(user_id),
  fechado_em timestamptz not null default now(),
  unique (empresa_id, competencia)
);

create table public.equipe_justificativas_ponto (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.staff_members(user_id),
  empresa_id uuid not null references public.empresas(id),
  data date not null,
  tipo public.equipe_justificativa_tipo not null,
  motivo text not null,
  anexo_path text,
  status public.equipe_justificativa_status not null default 'pendente',
  evento_falha_id uuid references public.equipe_eventos_falha(id) on delete set null,
  atraso_id uuid references public.equipe_atrasos(id),
  minutos_compensados int check (minutos_compensados is null or minutos_compensados >= 0),
  minutos_suprimidos int check (minutos_suprimidos is null or minutos_suprimidos >= 0),
  valor_pago numeric(10, 2) check (valor_pago is null or valor_pago >= 0),
  intervalo_calculado_min int,
  criado_por uuid not null references public.staff_members(user_id),
  decidido_por uuid references public.staff_members(user_id),
  decidido_em timestamptz,
  motivo_rejeicao text,
  substitui_id uuid references public.equipe_justificativas_ponto(id),
  created_at timestamptz not null default now(),
  -- J6: atestado sem anexo não entra.
  constraint atestado_exige_anexo
    check (tipo <> 'consulta_atestado' or anexo_path is not null)
);

create table public.equipe_justificativa_marcacoes (
  id uuid primary key default gen_random_uuid(),
  justificativa_id uuid not null references public.equipe_justificativas_ponto(id) on delete cascade,
  marcacao public.equipe_marcacao_ponto not null,
  horario time not null
);

create index idx_equipe_just_ponto_colab_data
  on public.equipe_justificativas_ponto (colaborador_id, data);

-- Fecha o vínculo que a Parte 1 deixou preparado.
alter table public.equipe_atrasos
  add constraint equipe_atrasos_justificativa_ponto_fkey
  foreign key (justificativa_ponto_id)
  references public.equipe_justificativas_ponto(id);

alter table public.equipe_eventos_falha enable row level security;
alter table public.equipe_fechamentos enable row level security;
alter table public.equipe_justificativas_ponto enable row level security;
alter table public.equipe_justificativa_marcacoes enable row level security;

create trigger trg_audit_equipe_justificativas_ponto
  after insert or update or delete on public.equipe_justificativas_ponto
  for each row execute function public.equipe_trg_audit();

create trigger trg_audit_equipe_fechamentos
  after insert or update or delete on public.equipe_fechamentos
  for each row execute function public.equipe_trg_audit();

-- ---------------------------------------------------------------- parâmetros

-- Seed dos parâmetros da Parte 2 em toda empresa (nova e existente).
create or replace function public.equipe_seed_config()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.equipe_config (empresa_id, chave, valor) values
    (new.id, 'escalonamento', jsonb_build_object('verbal_a_partir_de', 3, 'escrita_a_partir_de', 4)),
    (new.id, 'prazo_justificativa_horas', to_jsonb(48)),
    (new.id, 'prazo_imediatidade_dias_uteis', to_jsonb(5)),
    (new.id, 'prazo_ciencia_horas', to_jsonb(48)),
    (new.id, 'intervalo_minimo_min', to_jsonb(60)),
    (new.id, 'intervalo_reduzido_minimo_min', to_jsonb(30)),
    (new.id, 'intervalo_reduzido_valor', to_jsonb(30)),
    (new.id, 'intervalo_reduzido_alerta_mes', to_jsonb(8)),
    (new.id, 'prazo_colaborador_dias_uteis', to_jsonb(2))
  on conflict (empresa_id, chave) do nothing;
  return new;
end;
$$;

insert into public.equipe_config (empresa_id, chave, valor)
select e.id, c.chave, c.valor
from public.empresas e
cross join (values
  ('intervalo_minimo_min', to_jsonb(60)),
  ('intervalo_reduzido_minimo_min', to_jsonb(30)),
  ('intervalo_reduzido_valor', to_jsonb(30)),
  ('intervalo_reduzido_alerta_mes', to_jsonb(8)),
  ('prazo_colaborador_dias_uteis', to_jsonb(2))
) as c(chave, valor)
on conflict (empresa_id, chave) do nothing;

create or replace function public.equipe_config_int(p_empresa_id uuid, p_chave text, p_padrao int)
returns int
language sql security definer stable
set search_path = public
as $$
  select coalesce((select valor::text::int from equipe_config
                   where empresa_id = p_empresa_id and chave = p_chave), p_padrao)
$$;

-- ------------------------------------------------------------------- regras

-- Dias úteis entre duas datas (seg-sex). Usado no prazo do colaborador (R3).
create or replace function public.equipe_dias_uteis(p_de date, p_ate date)
returns int
language sql immutable
as $$
  select count(*)::int
  from generate_series(p_de + 1, p_ate, interval '1 day') as d
  where extract(isodow from d) < 6
$$;

-- Bloqueia qualquer escrita em competência já fechada (R8 / J8).
create or replace function public.equipe_trg_bloqueia_mes_fechado()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_data date;
begin
  v_empresa := coalesce(new.empresa_id, old.empresa_id);
  v_data := coalesce(new.data, old.data);

  if exists (
    select 1 from equipe_fechamentos
    where empresa_id = v_empresa
      and competencia = date_trunc('month', v_data)::date
  ) then
    raise exception 'A competência de % já foi fechada — nada pode ser criado ou alterado nela.',
      to_char(v_data, 'MM/YYYY');
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_equipe_just_ponto_mes_fechado
  before insert or update or delete on public.equipe_justificativas_ponto
  for each row execute function public.equipe_trg_bloqueia_mes_fechado();

create trigger trg_equipe_atrasos_mes_fechado
  before insert on public.equipe_atrasos
  for each row execute function public.equipe_trg_bloqueia_mes_fechado();

-- Calcula o intervalo a partir das marcações e valida as regras do art. 71.
-- Roda depois das marcações existirem, por isso é chamada pela função de
-- criação, não por trigger na própria linha.
create or replace function public.equipe_validar_justificativa(p_justificativa_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  j record;
  v_saida time;
  v_retorno time;
  v_intervalo int;
  v_minimo int;
  v_piso_reduzido int;
  v_minutos_atraso int;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;

  select horario into v_saida from equipe_justificativa_marcacoes
  where justificativa_id = p_justificativa_id and marcacao = 'saida_almoco';
  select horario into v_retorno from equipe_justificativa_marcacoes
  where justificativa_id = p_justificativa_id and marcacao = 'retorno_almoco';

  if v_saida is not null and v_retorno is not null then
    v_intervalo := round(extract(epoch from (v_retorno - v_saida)) / 60)::int;
    update equipe_justificativas_ponto
    set intervalo_calculado_min = v_intervalo
    where id = p_justificativa_id;
  end if;

  v_minimo := public.equipe_config_int(j.empresa_id, 'intervalo_minimo_min', 60);
  v_piso_reduzido := public.equipe_config_int(j.empresa_id, 'intervalo_reduzido_minimo_min', 30);

  if j.tipo = 'compensacao_atraso' then
    if j.atraso_id is null then
      raise exception 'Compensação precisa apontar para o atraso que está sendo compensado.';
    end if;

    -- J10: só compensa atraso do mesmo dia.
    select minutos_atraso into v_minutos_atraso
    from equipe_atrasos where id = j.atraso_id and data = j.data;
    if v_minutos_atraso is null then
      raise exception 'A compensação só vale para um atraso do mesmo dia (R4).';
    end if;

    -- J5: almoço abaixo do mínimo legal não serve de compensação.
    if v_intervalo is not null and v_intervalo < v_minimo then
      raise exception
        'Intervalo de % min é menor que o mínimo de % min (art. 71 da CLT) — não pode ser usado para compensar atraso.',
        v_intervalo, v_minimo;
    end if;

    -- J14: dia com intervalo reduzido pago não pode também compensar atraso
    -- (seria pagar e compensar o mesmo tempo duas vezes).
    if exists (
      select 1 from equipe_justificativas_ponto o
      where o.colaborador_id = j.colaborador_id
        and o.data = j.data
        and o.tipo = 'intervalo_reduzido_empresa'
        and o.status in ('aprovada', 'aguardando_ciencia', 'concluida')
        and o.id <> j.id
    ) then
      raise exception
        'Este dia já tem intervalo reduzido pago pela empresa — o mesmo tempo não pode ser pago e compensado.';
    end if;

    -- Minutos compensados nunca passam do atraso; excedente é ignorado (R5).
    update equipe_justificativas_ponto
    set minutos_compensados = least(coalesce(j.minutos_compensados, v_minutos_atraso), v_minutos_atraso)
    where id = p_justificativa_id;

  elsif j.tipo = 'intervalo_reduzido_empresa' then
    if v_intervalo is not null and v_intervalo < v_piso_reduzido then
      raise exception
        'Intervalo de % min é menor que o piso de % min para intervalo reduzido a pedido da empresa.',
        v_intervalo, v_piso_reduzido;
    end if;

    if v_intervalo is not null then
      update equipe_justificativas_ponto
      set minutos_suprimidos = greatest(0, v_minimo - v_intervalo),
          valor_pago = coalesce(
            j.valor_pago,
            public.equipe_config_int(j.empresa_id, 'intervalo_reduzido_valor', 30)
          )
      where id = p_justificativa_id;
    end if;
  end if;
end;
$$;

-- Avisos pro admin sobre o intervalo reduzido (J15 e J16). Não bloqueia nada:
-- é decisão de negócio, o sistema só não deixa passar silencioso.
create or replace function public.equipe_alertas_intervalo_reduzido(p_justificativa_id uuid)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  j record;
  v_salario_hora numeric;
  v_minimo_legal numeric;
  v_ocorrencias int;
  v_limite int;
  v_alertas jsonb := '[]'::jsonb;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;
  if j.tipo <> 'intervalo_reduzido_empresa' then
    return v_alertas;
  end if;

  select salario_hora into v_salario_hora from staff_members where user_id = j.colaborador_id;

  -- art. 71 §4º: período suprimido com adicional de no mínimo 50%.
  if v_salario_hora is not null and j.minutos_suprimidos is not null then
    v_minimo_legal := round((j.minutos_suprimidos / 60.0) * v_salario_hora * 1.5, 2);
    if coalesce(j.valor_pago, 0) < v_minimo_legal then
      v_alertas := v_alertas || jsonb_build_object(
        'tipo', 'valor_abaixo_do_minimo',
        'valor_pago', j.valor_pago,
        'minimo_legal', v_minimo_legal,
        'mensagem', format(
          'O valor de R$ %s não cobre o mínimo legal de R$ %s (%s min suprimidos + 50%%).',
          coalesce(j.valor_pago, 0), v_minimo_legal, j.minutos_suprimidos)
      );
    end if;
  end if;

  v_limite := public.equipe_config_int(j.empresa_id, 'intervalo_reduzido_alerta_mes', 8);
  select count(*)::int into v_ocorrencias
  from equipe_justificativas_ponto
  where colaborador_id = j.colaborador_id
    and tipo = 'intervalo_reduzido_empresa'
    and date_trunc('month', data) = date_trunc('month', j.data)
    and status in ('aprovada', 'aguardando_ciencia', 'concluida');

  if v_ocorrencias > v_limite then
    v_alertas := v_alertas || jsonb_build_object(
      'tipo', 'habitualidade',
      'ocorrencias', v_ocorrencias,
      'limite', v_limite,
      'mensagem', format(
        '%s intervalos reduzidos neste mês (limite de alerta: %s). Redução habitual sem norma coletiva é ponto sensível em fiscalização.',
        v_ocorrencias, v_limite)
    );
  end if;

  return v_alertas;
end;
$$;
