-- As duas caixas revezam o turno de sábado: uma semana a Bianca abre às 8h e a
-- Gabriela às 9h, na semana seguinte troca.
--
-- A tentação é deduzir o turno pela batida ("dá pra ver no ponto quem chegou
-- mais cedo"). Não serve: se o horário esperado vira o que a pessoa fez, ninguém
-- mais se atrasa no sábado — chegar 09:40 no turno das 8h viraria "turno das 9h,
-- adiantada". A regra tem que existir antes da batida para poder ser violada.
-- Conferido com setembro: a Gabi chegando 08:21 no sábado em que ela faz as 8h
-- aparece com 21 minutos de atraso; pela dedução, apareceria adiantada.
--
-- Como o revezamento é regular, ele é calculável: duas escalas, uma data âncora
-- e de que lado cada pessoa começou. Nada para alimentar toda semana — mas por
-- isso mesmo precisa ficar à vista e ter como inverter, que é o único jeito de
-- errar um revezamento calculado.

create table if not exists public.equipe_rodizios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  escala_a_id uuid not null references public.equipe_escalas(id),
  escala_b_id uuid not null references public.equipe_escalas(id),
  -- na semana da âncora, o lado A faz a escala A. Na seguinte, inverte.
  ancora      date not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.equipe_rodizio_pessoa (
  user_id    uuid not null references public.staff_members(user_id) on delete cascade,
  rodizio_id uuid not null references public.equipe_rodizios(id) on delete cascade,
  lado       text not null check (lado in ('A', 'B')),
  created_at timestamptz not null default now(),
  primary key (user_id, rodizio_id)
);

alter table public.equipe_rodizios       enable row level security;
alter table public.equipe_rodizio_pessoa enable row level security;

drop policy if exists "le_rodizios" on public.equipe_rodizios;
create policy "le_rodizios" on public.equipe_rodizios
  for select using (
    empresa_id in (select equipe_empresas_visiveis()) or public.is_equipe_gestor_ou_admin());

drop policy if exists "escreve_rodizios" on public.equipe_rodizios;
create policy "escreve_rodizios" on public.equipe_rodizios
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

drop policy if exists "le_rodizio_pessoa" on public.equipe_rodizio_pessoa;
create policy "le_rodizio_pessoa" on public.equipe_rodizio_pessoa
  for select using (public.is_equipe_gestor_ou_admin() or user_id = auth.uid());

drop policy if exists "escreve_rodizio_pessoa" on public.equipe_rodizio_pessoa;
create policy "escreve_rodizio_pessoa" on public.equipe_rodizio_pessoa
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

create or replace function public.equipe_escala_do_rodizio(p_user uuid, p_data date)
returns public.equipe_escalas
language plpgsql stable security definer set search_path = public as $$
declare
  v_dow int := extract(isodow from p_data)::int;
  v_e public.equipe_escalas;
begin
  select e.* into v_e
  from equipe_rodizio_pessoa rp
  join equipe_rodizios r on r.id = rp.rodizio_id and r.ativo
  join equipe_escalas e
    on e.id = case
         when (((floor((p_data - r.ancora)::numeric / 7)::int % 2) + 2) % 2 = 0)
            = (rp.lado = 'A')
         then r.escala_a_id else r.escala_b_id end
  where rp.user_id = p_user and e.ativo and v_dow = any(e.dias_semana)
  limit 1;

  return v_e;  -- nulo quando a pessoa não está em rodízio naquele dia
end;
$$;

-- O rodízio passa na frente da escala fixa, porque é mais específico ainda.
create or replace function public.equipe_escala_do_dia(p_user uuid, p_data date)
returns public.equipe_escalas
language plpgsql stable security definer set search_path = public as $$
declare
  v_dow int := extract(isodow from p_data)::int;
  v_e public.equipe_escalas;
begin
  v_e := public.equipe_escala_do_rodizio(p_user, p_data);
  if v_e.id is not null then return v_e; end if;

  select e.* into v_e
  from equipe_escalas_pessoa ep
  join equipe_escalas e on e.id = ep.escala_id
  where ep.user_id = p_user and e.ativo and v_dow = any(e.dias_semana)
  order by coalesce(array_length(e.dias_semana, 1), 99)
  limit 1;
  if found then return v_e; end if;

  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user and v_dow = any(e.dias_semana);
  if found then return v_e; end if;

  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user;
  return v_e;
end;
$$;

-- Quem está em qual turno a cada semana do mês.
create or replace function public.equipe_rodizios_do_mes(p_empresa_id uuid, p_mes date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê os revezamentos.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'nome', r.nome,
    'pessoas', (select coalesce(jsonb_agg(sm.display_name order by sm.display_name), '[]'::jsonb)
                  from equipe_rodizio_pessoa rp
                  join staff_members sm on sm.user_id = rp.user_id
                 where rp.rodizio_id = r.id),
    'semanas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'data', to_char(s.dia, 'YYYY-MM-DD'),
        'quem', (select coalesce(jsonb_agg(jsonb_build_object(
                    'nome', sm.display_name,
                    'escala', (public.equipe_escala_do_dia(rp.user_id, s.dia)).nome,
                    'entrada', to_char((public.equipe_escala_do_dia(rp.user_id, s.dia)).entrada,'HH24:MI'))
                   order by sm.display_name), '[]'::jsonb)
                   from equipe_rodizio_pessoa rp
                   join staff_members sm on sm.user_id = rp.user_id
                  where rp.rodizio_id = r.id)
      ) order by s.dia), '[]'::jsonb)
      from (select g::date as dia from generate_series(v_ini, v_fim, '1 day') g) s
      where extract(isodow from s.dia)::int = any(ea.dias_semana)
    )
  ) order by r.nome), '[]'::jsonb)
  into v_res
  from equipe_rodizios r
  join equipe_escalas ea on ea.id = r.escala_a_id
  where r.empresa_id = p_empresa_id and r.ativo;

  return v_res;
end;
$$;

-- Inverte o revezamento: empurra a âncora uma semana e tudo troca de lado.
create or replace function public.equipe_rodizio_trocar_semanas(p_rodizio_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin altera o revezamento.';
  end if;

  select empresa_id into v_emp from equipe_rodizios where id = p_rodizio_id;
  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Revezamento não encontrado.');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update equipe_rodizios set ancora = ancora + 7 where id = p_rodizio_id;
  return jsonb_build_object('ok', true, 'mensagem', 'Semanas trocadas.');
end;
$$;

grant execute on function public.equipe_escala_do_rodizio(uuid, date)   to authenticated;
grant execute on function public.equipe_escala_do_dia(uuid, date)       to authenticated;
grant execute on function public.equipe_rodizios_do_mes(uuid, date)     to authenticated;
grant execute on function public.equipe_rodizio_trocar_semanas(uuid)    to authenticated;
