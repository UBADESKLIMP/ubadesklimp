-- No verão a loja estica o sábado até as 17h, mas só durante a temporada e só
-- para alguns grupos. Hoje uma escala atribuída vale para sempre: a escala de
-- temporada passaria a valer em todo sábado do ano.
--
-- Então a atribuição ganha período. Sem período — que é o caso de tudo que já
-- existe — continua valendo sempre, e a de período ganha da permanente enquanto
-- estiver valendo. Quando a temporada acabar, o horário volta sozinho; ninguém
-- precisa lembrar de desfazer, que é exatamente o passo que seria esquecido.
--
-- Conferido: sábado fora da janela cai no turno normal, dentro cai no de
-- temporada, depois volta ao normal, e quinta-feira na temporada não muda.

alter table public.equipe_escalas_pessoa
  add column if not exists vigencia_inicio date,
  add column if not exists vigencia_fim    date;

alter table public.equipe_rodizios
  add column if not exists vigencia_inicio date,
  add column if not exists vigencia_fim    date;

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
  where rp.user_id = p_user
    and e.ativo
    and v_dow = any(e.dias_semana)
    and (r.vigencia_inicio is null or p_data >= r.vigencia_inicio)
    and (r.vigencia_fim    is null or p_data <= r.vigencia_fim)
  -- um rodízio de período em cima de um permanente: o de período ganha
  order by (r.vigencia_inicio is null), r.vigencia_inicio desc nulls last
  limit 1;

  return v_e;
end;
$$;

create or replace function public.equipe_escala_do_dia(p_user uuid, p_data date)
returns public.equipe_escalas
language plpgsql stable security definer set search_path = public as $$
declare
  v_dow int := extract(isodow from p_data)::int;
  v_e public.equipe_escalas;
begin
  -- 0. rodízio que estiver valendo neste dia
  v_e := public.equipe_escala_do_rodizio(p_user, p_data);
  if v_e.id is not null then return v_e; end if;

  -- 1. escala atribuída que cobre este dia. Entre duas, ganha a que vale só
  --    num período (temporada) e, depois, a que cobre menos dias da semana.
  select e.* into v_e
  from equipe_escalas_pessoa ep
  join equipe_escalas e on e.id = ep.escala_id
  where ep.user_id = p_user
    and e.ativo
    and v_dow = any(e.dias_semana)
    and (ep.vigencia_inicio is null or p_data >= ep.vigencia_inicio)
    and (ep.vigencia_fim    is null or p_data <= ep.vigencia_fim)
  order by (ep.vigencia_inicio is null and ep.vigencia_fim is null),
           coalesce(array_length(e.dias_semana, 1), 99)
  limit 1;
  if found then return v_e; end if;

  -- 2. a escala principal, quando ela cobre o dia
  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user and v_dow = any(e.dias_semana);
  if found then return v_e; end if;

  -- 3. a principal mesmo fora dos dias dela
  select e.* into v_e
  from staff_members sm join equipe_escalas e on e.id = sm.escala_id
  where sm.user_id = p_user;
  return v_e;
end;
$$;
