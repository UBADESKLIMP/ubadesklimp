create type public.equipe_medida_tipo as enum (
  'orientacao_verbal', 'orientacao_verbal_coletiva', 'advertencia_escrita', 'suspensao'
);
create type public.equipe_medida_status as enum (
  'rascunho', 'aguardando_assinatura', 'aplicada', 'recusada'
);

create table public.equipe_medidas (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.staff_members(user_id),
  tipo public.equipe_medida_tipo not null,
  dias_suspensao int,
  data_aplicacao date not null default current_date,
  fundamento text not null,
  pdf_path text,
  assinado_path text,
  status public.equipe_medida_status not null default 'rascunho',
  criado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  constraint suspensao_precisa_dias check (tipo <> 'suspensao' or dias_suspensao is not null)
);

create table public.equipe_medida_atrasos (
  medida_id uuid not null references public.equipe_medidas(id) on delete cascade,
  atraso_id uuid not null references public.equipe_atrasos(id) unique,
  primary key (medida_id, atraso_id)
);

alter table public.equipe_medidas enable row level security;
alter table public.equipe_medida_atrasos enable row level security;

create trigger trg_audit_equipe_medidas
  after insert or update or delete on public.equipe_medidas
  for each row execute function public.equipe_trg_audit();

create policy "Colaborador lê as próprias medidas"
  on public.equipe_medidas for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê medidas das empresas visíveis"
  on public.equipe_medidas for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and exists (
      select 1 from staff_members sm
      where sm.user_id = equipe_medidas.colaborador_id
        and sm.empresa_id in (select equipe_empresas_visiveis())
    )
  );

create policy "Gestor cria medida (exceto suspensão), admin cria qualquer uma"
  on public.equipe_medidas for insert
  to authenticated
  with check (
    exists (
      select 1 from staff_members sm
      where sm.user_id = colaborador_id and sm.empresa_id in (select equipe_empresas_visiveis())
    )
    and (
      public.is_equipe_admin()
      or (public.is_equipe_gestor_ou_admin() and tipo <> 'suspensao')
    )
  );

create policy "Gestor/admin lê vínculos medida-atraso"
  on public.equipe_medida_atrasos for select
  to authenticated
  using (public.is_equipe_gestor_ou_admin());

create policy "Gestor/admin vincula atraso a medida"
  on public.equipe_medida_atrasos for insert
  to authenticated
  with check (public.is_equipe_gestor_ou_admin());

create or replace function public.equipe_contar_atrasos_mes(p_colaborador_id uuid, p_referencia date)
returns int
language sql security definer stable
set search_path = public
as $$
  select count(*)::int
  from equipe_atrasos a
  where a.colaborador_id = p_colaborador_id
    and date_trunc('month', a.data) = date_trunc('month', p_referencia)
    and a.dentro_tolerancia = false
    and a.status not in ('abonado', 'substituido')
    and not exists (select 1 from equipe_medida_atrasos ma where ma.atraso_id = a.id)
$$;

create or replace function public.equipe_sugerir_medida(p_colaborador_id uuid, p_referencia date)
returns public.equipe_medida_tipo
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_verbal_a_partir_de int;
  v_escrita_a_partir_de int;
  v_count int;
begin
  select empresa_id into v_empresa_id from staff_members where user_id = p_colaborador_id;
  select (valor ->> 'verbal_a_partir_de')::int, (valor ->> 'escrita_a_partir_de')::int
    into v_verbal_a_partir_de, v_escrita_a_partir_de
  from equipe_config where empresa_id = v_empresa_id and chave = 'escalonamento';

  v_count := public.equipe_contar_atrasos_mes(p_colaborador_id, p_referencia);

  if v_count >= v_escrita_a_partir_de then
    return 'advertencia_escrita'::equipe_medida_tipo;
  elsif v_count >= v_verbal_a_partir_de then
    return 'orientacao_verbal'::equipe_medida_tipo;
  else
    return null;
  end if;
end;
$$;
