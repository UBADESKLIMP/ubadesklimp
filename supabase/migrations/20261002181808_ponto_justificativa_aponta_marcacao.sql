-- Etapa 3 (B): a Parte 2 passa a apontar para a batida real.
--
-- Antes, uma justificativa de "marcação incorreta" era texto solto com os
-- horários digitados. Agora ela guarda o id da marcação contestada, então dá
-- pra ir do ajuste até a batida original (com hash, IP e local) sem adivinhar.

alter table public.equipe_justificativas_ponto
  add column if not exists marcacao_id uuid references public.ponto_marcacoes(id);

comment on column public.equipe_justificativas_ponto.marcacao_id is
  'Batida contestada ou corrigida. Nulo quando a justificativa é de batida que nunca existiu (esquecimento, falha de sistema).';

create index if not exists idx_equipe_justificativas_ponto_marcacao
  on public.equipe_justificativas_ponto (marcacao_id) where marcacao_id is not null;

-- Os dois enums de tipo de marcação nasceram em módulos diferentes e não
-- batem nos nomes das pausas. Uma função só pra tradução evita espalhar case.
create or replace function public.ponto_tipo_para_justificativa(
  p_tipo public.ponto_marcacao_tipo
)
returns public.equipe_marcacao_ponto language sql immutable as $$
  select case p_tipo
    when 'entrada' then 'entrada'
    when 'saida_almoco' then 'saida_almoco'
    when 'retorno_almoco' then 'retorno_almoco'
    when 'saida' then 'saida'
    when 'hora_extra_inicio' then 'hora_extra_inicio'
    when 'hora_extra_saida' then 'hora_extra_saida'
    when 'saida_pausa' then 'saida_intermediaria'
    when 'retorno_pausa' then 'retorno_intermediario'
  end::public.equipe_marcacao_ponto
$$;

-- Troca de assinatura: derruba a antiga antes, senão o PostgREST fica com duas
-- sobrecargas e não sabe qual chamar.
drop function if exists public.equipe_criar_justificativa_ponto(
  uuid, date, public.equipe_justificativa_tipo, text, jsonb, uuid, text, numeric
);

create or replace function public.equipe_criar_justificativa_ponto(
  p_colaborador_id uuid,
  p_data date,
  p_tipo public.equipe_justificativa_tipo,
  p_motivo text,
  p_marcacoes jsonb,
  p_atraso_id uuid default null,
  p_anexo_path text default null,
  p_valor_pago numeric default null,
  p_marcacao_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

  if not v_gestor then
    if p_colaborador_id <> auth.uid() then
      raise exception 'Você só pode criar justificativa para si mesmo.';
    end if;
  elsif v_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  if p_tipo = 'intervalo_reduzido_empresa' and not v_gestor then
    raise exception 'Intervalo reduzido a pedido da empresa só pode ser lançado pelo gestor.';
  end if;

  -- A batida apontada precisa ser do próprio colaborador e do mesmo dia:
  -- sem isso, dava pra abrir ajuste em cima da marcação de outra pessoa.
  if p_marcacao_id is not null and not exists (
    select 1 from ponto_marcacoes m
    where m.id = p_marcacao_id
      and m.funcionario_id = p_colaborador_id
      and (m.registrado_em at time zone 'America/Sao_Paulo')::date = p_data
  ) then
    raise exception 'A batida informada não é desse colaborador nesse dia.';
  end if;

  v_prazo := public.equipe_config_int(v_empresa_id, 'prazo_colaborador_dias_uteis', 2);
  v_dias := public.equipe_dias_uteis(p_data, current_date);
  if not v_gestor and v_dias > v_prazo then
    raise exception
      'Prazo de % dias úteis para justificar o dia % já passou (% dias úteis). Peça para o gestor lançar.',
      v_prazo, to_char(p_data, 'DD/MM'), v_dias;
  end if;

  insert into equipe_justificativas_ponto (
    colaborador_id, empresa_id, data, tipo, motivo, anexo_path,
    atraso_id, valor_pago, marcacao_id, criado_por, status
  ) values (
    p_colaborador_id, v_empresa_id, p_data, p_tipo, p_motivo, p_anexo_path,
    p_atraso_id, p_valor_pago, p_marcacao_id, auth.uid(),
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

  if v_gestor then
    perform public.equipe_aplicar_efeitos_justificativa(v_id);
  end if;

  return v_id;
end;
$$;

-- P23: "Não estava" abre o ajuste sozinho, já apontando pra batida contestada.
create or replace function public.ponto_confirmar_marcacao(
  p_marcacao_id uuid, p_confirma boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m record;
  v_novo public.ponto_confirmacao;
  v_resp text;
  v_data date;
  v_hora time;
  v_just uuid;
begin
  select * into v_m from ponto_marcacoes where id = p_marcacao_id;
  if v_m is null or v_m.funcionario_id <> auth.uid() then
    raise exception 'Marcação não encontrada para você.';
  end if;
  if v_m.confirmacao <> 'pendente' then
    return jsonb_build_object('ok', false, 'mensagem', 'Esta marcação já foi respondida.');
  end if;

  v_novo := case when p_confirma then 'confirmada' else 'contestada' end;
  update ponto_marcacoes set confirmacao = v_novo where id = p_marcacao_id;

  if p_confirma then
    return jsonb_build_object('ok', true, 'confirmacao', v_novo);
  end if;

  v_data := (v_m.registrado_em at time zone 'America/Sao_Paulo')::date;
  v_hora := (v_m.registrado_em at time zone 'America/Sao_Paulo')::time;
  select display_name into v_resp from staff_members where user_id = v_m.marcado_por;

  -- Entra direto, sem passar pelo prazo de justificativa: a janela de
  -- contestação é a do ponto (48h), e quem contesta não pode ser punido por
  -- um prazo de outro módulo. Fica 'pendente' e aparece em Ajustes de ponto.
  insert into equipe_justificativas_ponto (
    colaborador_id, empresa_id, data, tipo, motivo, marcacao_id, criado_por, status
  ) values (
    v_m.funcionario_id, v_m.empresa_id, v_data, 'marcacao_incorreta',
    format('Contestou a %s das %s registrada por %s.',
           v_m.tipo, to_char(v_hora, 'HH24:MI'), coalesce(v_resp, 'outra pessoa')),
    p_marcacao_id, auth.uid(), 'pendente'
  ) returning id into v_just;

  insert into equipe_justificativa_marcacoes (justificativa_id, marcacao, horario)
  values (v_just, public.ponto_tipo_para_justificativa(v_m.tipo), v_hora);

  return jsonb_build_object('ok', true, 'confirmacao', v_novo, 'justificativa_id', v_just,
    'mensagem', 'Avisamos a gestão. Seu ajuste ficou em Meus registros > Ajustes de ponto.');
end;
$$;
