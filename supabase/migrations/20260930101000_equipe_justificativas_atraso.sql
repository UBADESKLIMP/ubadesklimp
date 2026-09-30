create type public.equipe_justificativa_decisao as enum ('pendente', 'abonado', 'rejeitado');

create table public.equipe_justificativas_atraso (
  id uuid primary key default gen_random_uuid(),
  atraso_id uuid not null references public.equipe_atrasos(id),
  texto text not null,
  anexo_path text,
  decisao public.equipe_justificativa_decisao not null default 'pendente',
  decidido_por uuid references public.staff_members(user_id),
  decidido_em timestamptz,
  motivo_decisao text,
  created_at timestamptz not null default now()
);

alter table public.equipe_justificativas_atraso enable row level security;

create trigger trg_audit_equipe_justificativas_atraso
  after insert or update or delete on public.equipe_justificativas_atraso
  for each row execute function public.equipe_trg_audit();

create policy "Colaborador/gestor lê justificativa dos atrasos acessíveis"
  on public.equipe_justificativas_atraso for select
  to authenticated
  using (
    exists (select 1 from equipe_atrasos a where a.id = atraso_id and a.colaborador_id = auth.uid())
    or (
      public.is_equipe_gestor_ou_admin()
      and exists (
        select 1 from equipe_atrasos a
        where a.id = atraso_id and a.empresa_id in (select equipe_empresas_visiveis())
      )
    )
  );

create policy "Colaborador cria justificativa do próprio atraso"
  on public.equipe_justificativas_atraso for insert
  to authenticated
  with check (
    exists (select 1 from equipe_atrasos a where a.id = atraso_id and a.colaborador_id = auth.uid())
  );

create or replace function public.equipe_decidir_justificativa(
  p_justificativa_id uuid,
  p_decisao public.equipe_justificativa_decisao,
  p_motivo text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_atraso_id uuid;
  v_empresa_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin decide justificativa.';
  end if;
  if p_decisao = 'pendente' then
    raise exception 'Decisão precisa ser abonado ou rejeitado.';
  end if;

  select atraso_id into v_atraso_id from equipe_justificativas_atraso where id = p_justificativa_id;
  select empresa_id into v_empresa_id from equipe_atrasos where id = v_atraso_id;

  if v_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update equipe_justificativas_atraso
  set decisao = p_decisao, decidido_por = auth.uid(), decidido_em = now(), motivo_decisao = p_motivo
  where id = p_justificativa_id;

  if p_decisao = 'abonado' then
    update equipe_atrasos set status = 'abonado', updated_at = now() where id = v_atraso_id;
  else
    update equipe_atrasos set status = 'pendente_ciencia', updated_at = now()
    where id = v_atraso_id and status = 'justificativa_pendente';
  end if;
end;
$$;
