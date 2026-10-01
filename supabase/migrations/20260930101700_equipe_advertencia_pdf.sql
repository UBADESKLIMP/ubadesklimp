-- Dados da advertência pro PDF (PRD 5.4): identificação do empregador correto
-- (A22 — razão social e CNPJ da empresa do colaborador, nunca da outra),
-- fatos, fundamento, histórico anterior e os hashes das ciências.
-- Tudo montado aqui pra o front não precisar cruzar 5 tabelas nem decidir
-- qual empresa é a certa.
create or replace function public.equipe_dados_advertencia(p_medida_id uuid)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  v_colaborador_id uuid;
  v_empresa_id uuid;
  v_resultado jsonb;
begin
  select m.colaborador_id, sm.empresa_id
    into v_colaborador_id, v_empresa_id
  from equipe_medidas m
  join staff_members sm on sm.user_id = m.colaborador_id
  where m.id = p_medida_id;

  if v_colaborador_id is null then
    raise exception 'Medida % não encontrada', p_medida_id;
  end if;

  -- Gestor/admin da empresa do colaborador, ou o próprio colaborador.
  if not (
    v_colaborador_id = auth.uid()
    or (public.is_equipe_gestor_ou_admin() and v_empresa_id in (select equipe_empresas_visiveis()))
  ) then
    raise exception 'Sem acesso a esta medida.';
  end if;

  select jsonb_build_object(
    'medida', (
      select jsonb_build_object(
        'id', m.id,
        'tipo', m.tipo,
        'dias_suspensao', m.dias_suspensao,
        'data_aplicacao', m.data_aplicacao,
        'fundamento', m.fundamento,
        'status', m.status,
        'assinado_path', m.assinado_path
      )
      from equipe_medidas m where m.id = p_medida_id
    ),
    'colaborador', (
      select jsonb_build_object(
        'nome', sm.display_name,
        'termo_assinado_em', sm.termo_assinado_em
      )
      from staff_members sm where sm.user_id = v_colaborador_id
    ),
    'empresa', (
      select jsonb_build_object('razao_social', e.razao_social, 'cnpj', e.cnpj)
      from empresas e where e.id = v_empresa_id
    ),
    'atrasos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', a.data,
        'marcacao', a.marcacao,
        'hora_chegada', a.hora_chegada,
        'horario_referencia', a.horario_referencia,
        'minutos_atraso', a.minutos_atraso
      ) order by a.data)
      from equipe_medida_atrasos ma
      join equipe_atrasos a on a.id = ma.atraso_id
      where ma.medida_id = p_medida_id
    ), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data_aplicacao', m2.data_aplicacao,
        'tipo', m2.tipo,
        'fundamento', m2.fundamento
      ) order by m2.data_aplicacao)
      from equipe_medidas m2
      where m2.colaborador_id = v_colaborador_id
        and m2.id <> p_medida_id
        and m2.status in ('aplicada', 'aguardando_assinatura')
    ), '[]'::jsonb),
    -- Hashes das ciências dos atrasos que fundamentam a medida + da própria
    -- medida: é a evidência técnica de que o colaborador foi informado.
    'ciencias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alvo_tipo', c.alvo_tipo,
        'acao', c.acao,
        'signed_at', c.signed_at,
        'payload_hash', c.payload_hash,
        'ip', c.ip,
        'testemunha_1', c.testemunha_1,
        'testemunha_2', c.testemunha_2
      ) order by c.signed_at)
      from equipe_ciencias c
      where c.colaborador_id = v_colaborador_id
        and (
          c.alvo_id = p_medida_id
          or c.alvo_id in (select ma.atraso_id from equipe_medida_atrasos ma where ma.medida_id = p_medida_id)
        )
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

-- Upload do scan assinado fecha a medida (PRD 5.4: medida escrita só fica
-- aplicada depois do upload assinado ou da recusa com testemunhas).
create or replace function public.equipe_registrar_assinatura_medida(
  p_medida_id uuid,
  p_assinado_path text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
begin
  select sm.empresa_id into v_empresa_id
  from equipe_medidas m
  join staff_members sm on sm.user_id = m.colaborador_id
  where m.id = p_medida_id;

  if not (public.is_equipe_gestor_ou_admin() and v_empresa_id in (select equipe_empresas_visiveis())) then
    raise exception 'Só gestor ou admin da empresa registra a assinatura.';
  end if;

  update equipe_medidas
  set assinado_path = p_assinado_path,
      status = 'aplicada'
  where id = p_medida_id;
end;
$$;

-- equipe_registrar_ciencia passa a tratar alvo_tipo = 'medida': confere que a
-- medida é do colaborador logado, e fecha a medida quando cabe (verbal com
-- ciência, ou escrita recusada com duas testemunhas).
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
  v_medida_tipo public.equipe_medida_tipo;
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
    select to_jsonb(a) into v_payload from equipe_atrasos a where a.id = p_alvo_id;
  elsif p_alvo_tipo = 'medida' then
    select tipo into v_medida_tipo
    from equipe_medidas
    where id = p_alvo_id and colaborador_id = v_colaborador;
    if v_medida_tipo is null then
      raise exception 'Medida % não pertence ao colaborador logado.', p_alvo_id;
    end if;
    select to_jsonb(m) into v_payload from equipe_medidas m where m.id = p_alvo_id;
  end if;

  begin
    v_ip := (current_setting('request.headers', true)::json ->> 'x-forwarded-for')::inet;
  exception when others then
    v_ip := null;
  end;
  v_ua := current_setting('request.headers', true)::json ->> 'user-agent';

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
  elsif p_alvo_tipo = 'medida' then
    -- Verbal não gera PDF: a ciência eletrônica já encerra.
    -- Escrita recusada com testemunhas também encerra (a medida vale mesmo
    -- sem a assinatura); escrita com ciência segue aguardando o scan assinado.
    if v_medida_tipo = 'orientacao_verbal' and p_acao = 'ciente' then
      update equipe_medidas set status = 'aplicada' where id = p_alvo_id;
    elsif p_acao = 'recusa' then
      update equipe_medidas set status = 'aplicada' where id = p_alvo_id;
    end if;
  end if;

  return v_id;
end;
$$;

-- Pasta medidas/ no bucket privado: gestor/admin grava e lê, colaborador lê
-- só as próprias (PRD: "Minhas medidas — advertências/suspensões com PDF").
create policy "Gestor/admin grava medidas"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'medidas'
    and public.is_equipe_gestor_ou_admin()
  );

create policy "Gestor/admin lê medidas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'medidas'
    and public.is_equipe_gestor_ou_admin()
  );

create policy "Colaborador lê as próprias medidas"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'medidas'
    and exists (
      select 1 from equipe_medidas m
      where m.colaborador_id = auth.uid()
        and (storage.foldername(name))[2] = m.id::text
    )
  );
