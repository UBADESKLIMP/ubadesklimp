create type public.equipe_ciencia_alvo as enum ('atraso', 'medida', 'fechamento');
create type public.equipe_ciencia_acao as enum ('ciente', 'recusa');

create table public.equipe_ciencias (
  id uuid primary key default gen_random_uuid(),
  alvo_tipo public.equipe_ciencia_alvo not null,
  alvo_id uuid not null,
  colaborador_id uuid not null references public.staff_members(user_id),
  acao public.equipe_ciencia_acao not null,
  justificativa text,
  assinatura_path text,
  ip inet,
  user_agent text,
  payload_hash text not null,
  testemunha_1 text,
  testemunha_2 text,
  signed_at timestamptz not null default now()
);

alter table public.equipe_ciencias enable row level security;

create policy "Colaborador lê as próprias ciências"
  on public.equipe_ciencias for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê ciências das empresas visíveis"
  on public.equipe_ciencias for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and exists (
      select 1 from equipe_atrasos a
      where a.id = equipe_ciencias.alvo_id
        and equipe_ciencias.alvo_tipo = 'atraso'
        and a.empresa_id in (select equipe_empresas_visiveis())
    )
  );

create or replace function public.equipe_registrar_ciencia(
  p_alvo_tipo public.equipe_ciencia_alvo,
  p_alvo_id uuid,
  p_acao public.equipe_ciencia_acao,
  p_justificativa text default null,
  p_testemunha_1 text default null,
  p_testemunha_2 text default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_colaborador uuid := auth.uid();
  v_termo_assinado date;
  v_payload jsonb;
  v_hash text;
  v_ip inet;
  v_ua text;
  v_id uuid;
begin
  select termo_assinado_em into v_termo_assinado from staff_members where user_id = v_colaborador;

  if v_termo_assinado is null and p_acao = 'ciente' then
    raise exception 'Colaborador sem termo de adesão assinado — use o fluxo de papel.';
  end if;

  if p_acao = 'recusa' and (p_testemunha_1 is null or p_testemunha_2 is null) then
    raise exception 'Recusa exige duas testemunhas.';
  end if;

  if p_alvo_tipo = 'atraso' then
    if not exists (select 1 from equipe_atrasos where id = p_alvo_id and colaborador_id = v_colaborador) then
      raise exception 'Atraso % não pertence ao colaborador logado.', p_alvo_id;
    end if;
  end if;

  begin
    v_ip := (current_setting('request.headers', true)::json ->> 'x-forwarded-for')::inet;
  exception when others then
    v_ip := null;
  end;
  v_ua := current_setting('request.headers', true)::json ->> 'user-agent';

  select to_jsonb(a) into v_payload from equipe_atrasos a where a.id = p_alvo_id and p_alvo_tipo = 'atraso';
  v_hash := encode(digest(coalesce(v_payload, '{}'::jsonb)::text || now()::text, 'sha256'), 'hex');

  insert into equipe_ciencias (
    alvo_tipo, alvo_id, colaborador_id, acao, justificativa,
    ip, user_agent, payload_hash, testemunha_1, testemunha_2
  ) values (
    p_alvo_tipo, p_alvo_id, v_colaborador, p_acao, p_justificativa,
    v_ip, v_ua, v_hash, p_testemunha_1, p_testemunha_2
  ) returning id into v_id;

  if p_alvo_tipo = 'atraso' then
    update equipe_atrasos
    set status = case when p_acao = 'ciente' then 'ciente'::equipe_atraso_status else 'sem_ciencia'::equipe_atraso_status end,
        updated_at = now()
    where id = p_alvo_id;
  end if;

  return v_id;
end;
$$;
