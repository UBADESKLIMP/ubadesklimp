-- Fluxo da Parte 2: criar, aprovar/rejeitar e os efeitos no controle de
-- atrasos da Parte 1. Tudo via função — o cliente não escreve direto.

-- Cria a solicitação com as marcações numa tacada. Aplica o prazo do
-- colaborador (R3/J7) e a validação de intervalo (R4).
create or replace function public.equipe_criar_justificativa_ponto(
  p_colaborador_id uuid,
  p_data date,
  p_tipo public.equipe_justificativa_tipo,
  p_motivo text,
  p_marcacoes jsonb,
  p_atraso_id uuid default null,
  p_anexo_path text default null,
  p_valor_pago numeric default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_gestor boolean := public.is_equipe_gestor_ou_admin();
  v_prazo int;
  v_dias int;
  v_id uuid;
  v_marcacao jsonb;
begin
  select empresa_id into v_empresa_id from staff_members where user_id = p_colaborador_id;
  if v_empresa_id is null then
    raise exception 'Colaborador sem empresa vinculada.';
  end if;

  -- Colaborador só cria pra si mesmo; gestor cria em nome de alguém da empresa dele.
  if not v_gestor then
    if p_colaborador_id <> auth.uid() then
      raise exception 'Você só pode criar justificativa para si mesmo.';
    end if;
  elsif v_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  -- J13: intervalo reduzido é pedido DA empresa, então só gestor lança.
  if p_tipo = 'intervalo_reduzido_empresa' and not v_gestor then
    raise exception 'Intervalo reduzido a pedido da empresa só pode ser lançado pelo gestor.';
  end if;

  -- J7: fora do prazo, só gestor (com motivo, que já é obrigatório).
  v_prazo := public.equipe_config_int(v_empresa_id, 'prazo_colaborador_dias_uteis', 2);
  v_dias := public.equipe_dias_uteis(p_data, current_date);
  if not v_gestor and v_dias > v_prazo then
    raise exception
      'Prazo de % dias úteis para justificar o dia % já passou (% dias úteis). Peça para o gestor lançar.',
      v_prazo, to_char(p_data, 'DD/MM'), v_dias;
  end if;

  insert into equipe_justificativas_ponto (
    colaborador_id, empresa_id, data, tipo, motivo, anexo_path,
    atraso_id, valor_pago, criado_por,
    -- Criada pelo gestor já nasce aprovada, esperando a ciência do
    -- colaborador; criada pelo colaborador espera decisão do gestor (R7).
    status
  ) values (
    p_colaborador_id, v_empresa_id, p_data, p_tipo, p_motivo, p_anexo_path,
    p_atraso_id, p_valor_pago, auth.uid(),
    case when v_gestor then 'aguardando_ciencia'::equipe_justificativa_status
         else 'pendente'::equipe_justificativa_status end
  ) returning id into v_id;

  for v_marcacao in select * from jsonb_array_elements(coalesce(p_marcacoes, '[]'::jsonb))
  loop
    insert into equipe_justificativa_marcacoes (justificativa_id, marcacao, horario)
    values (
      v_id,
      (v_marcacao ->> 'marcacao')::public.equipe_marcacao_ponto,
      (v_marcacao ->> 'horario')::time
    );
  end loop;

  perform public.equipe_validar_justificativa(v_id);

  -- Se já nasce aprovada (lançada pelo gestor), os efeitos valem na hora.
  if v_gestor then
    perform public.equipe_aplicar_efeitos_justificativa(v_id);
  end if;

  return v_id;
end;
$$;

-- Efeitos de uma justificativa aprovada sobre o controle de atrasos (R5).
create or replace function public.equipe_aplicar_efeitos_justificativa(p_justificativa_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  j record;
  v_entrada time;
  v_empresa_id uuid;
  v_atraso_existente uuid;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;

  -- J4/J11: compensação aprovada tira o atraso do desconto, mas ele continua
  -- contando no escalonamento (por isso vira 'compensado', não 'abonado').
  if j.tipo = 'compensacao_atraso' and j.atraso_id is not null then
    update equipe_atrasos
    set status = 'compensado',
        justificativa_ponto_id = j.id,
        updated_at = now()
    where id = j.atraso_id
      and status in ('pendente_ciencia', 'justificativa_pendente', 'ciente');
    return;
  end if;

  -- J3: falha do sistema / esquecimento NÃO abonam atraso. Se a entrada
  -- informada à mão está depois do horário da escala, o atraso é gerado na
  -- Parte 1 normalmente — a falha explica a marcação, não desculpa o atraso.
  if j.tipo in ('falha_sistema', 'esquecimento', 'marcacao_incorreta') then
    select horario into v_entrada
    from equipe_justificativa_marcacoes
    where justificativa_id = p_justificativa_id and marcacao = 'entrada';

    if v_entrada is null then
      return;
    end if;

    select a.id into v_atraso_existente
    from equipe_atrasos a
    where a.colaborador_id = j.colaborador_id
      and a.data = j.data
      and a.marcacao = 'entrada'
      and a.status <> 'substituido';

    if v_atraso_existente is not null then
      return;
    end if;

    select empresa_id into v_empresa_id from staff_members where user_id = j.colaborador_id;

    insert into equipe_atrasos (
      colaborador_id, empresa_id, data, marcacao, hora_chegada,
      justificativa_ponto_id, criado_por
    ) values (
      j.colaborador_id, v_empresa_id, j.data, 'entrada', v_entrada,
      j.id, j.criado_por
    );
  end if;
end;
$$;

create or replace function public.equipe_decidir_justificativa_ponto(
  p_justificativa_id uuid,
  p_aprovar boolean,
  p_motivo_rejeicao text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  j record;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;
  if j.id is null then
    raise exception 'Solicitação não encontrada.';
  end if;

  if not (public.is_equipe_gestor_ou_admin() and j.empresa_id in (select equipe_empresas_visiveis())) then
    raise exception 'Só gestor ou admin decide solicitação de ajuste.';
  end if;

  if j.status <> 'pendente' then
    raise exception 'Esta solicitação já foi decidida (status %).', j.status;
  end if;

  if not p_aprovar and coalesce(trim(p_motivo_rejeicao), '') = '' then
    raise exception 'Rejeição exige motivo.';
  end if;

  update equipe_justificativas_ponto
  set status = case when p_aprovar then 'aguardando_ciencia'::equipe_justificativa_status
                    else 'rejeitada'::equipe_justificativa_status end,
      decidido_por = auth.uid(),
      decidido_em = now(),
      motivo_rejeicao = case when p_aprovar then null else p_motivo_rejeicao end
  where id = p_justificativa_id;

  if p_aprovar then
    perform public.equipe_aplicar_efeitos_justificativa(p_justificativa_id);
  end if;
end;
$$;

-- Evento de falha coletiva (R6/J2): cria o evento e, pra cada colaborador da
-- grade, uma solicitação já aprovada esperando só a ciência.
create or replace function public.equipe_criar_evento_falha(
  p_empresa_id uuid,
  p_data date,
  p_descricao text,
  p_grade jsonb,
  p_inicio time default null,
  p_fim time default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_evento_id uuid;
  v_linha jsonb;
  v_justificativa_id uuid;
begin
  if not (public.is_equipe_gestor_ou_admin() and p_empresa_id in (select equipe_empresas_visiveis())) then
    raise exception 'Só gestor ou admin registra falha do sistema de ponto.';
  end if;

  insert into equipe_eventos_falha (empresa_id, data, inicio, fim, descricao, criado_por)
  values (p_empresa_id, p_data, p_inicio, p_fim, p_descricao, auth.uid())
  returning id into v_evento_id;

  for v_linha in select * from jsonb_array_elements(p_grade)
  loop
    v_justificativa_id := public.equipe_criar_justificativa_ponto(
      (v_linha ->> 'colaborador_id')::uuid,
      p_data,
      'falha_sistema'::equipe_justificativa_tipo,
      p_descricao,
      v_linha -> 'marcacoes'
    );

    update equipe_justificativas_ponto
    set evento_falha_id = v_evento_id
    where id = v_justificativa_id;
  end loop;

  return v_evento_id;
end;
$$;

-- Fechamento mensal (R8). Depois disso o trigger bloqueia escrita no período.
create or replace function public.equipe_fechar_competencia(p_empresa_id uuid, p_competencia date)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (public.is_equipe_gestor_ou_admin() and p_empresa_id in (select equipe_empresas_visiveis())) then
    raise exception 'Só gestor ou admin fecha a competência.';
  end if;

  insert into equipe_fechamentos (empresa_id, competencia, fechado_por)
  values (p_empresa_id, date_trunc('month', p_competencia)::date, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- --------------------------------------------------------------------- RLS

create policy "Colaborador lê as próprias solicitações"
  on public.equipe_justificativas_ponto for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê solicitações das empresas visíveis"
  on public.equipe_justificativas_ponto for select
  to authenticated
  using (
    public.is_equipe_gestor_ou_admin()
    and empresa_id in (select equipe_empresas_visiveis())
  );

create policy "Marcações seguem a solicitação"
  on public.equipe_justificativa_marcacoes for select
  to authenticated
  using (
    exists (
      select 1 from equipe_justificativas_ponto j
      where j.id = justificativa_id
        and (
          j.colaborador_id = auth.uid()
          or (public.is_equipe_gestor_ou_admin() and j.empresa_id in (select equipe_empresas_visiveis()))
        )
    )
  );

create policy "Gestor/admin lê eventos de falha"
  on public.equipe_eventos_falha for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Gestor/admin lê fechamentos"
  on public.equipe_fechamentos for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));
