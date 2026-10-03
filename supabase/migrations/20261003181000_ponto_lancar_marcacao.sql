-- Lançamento manual pelo gestor (PRD R7).
--
-- O que separa isto de uma fraude é o rastro: sai com origem própria, com o
-- nome de quem lançou, com motivo obrigatório, e pendente de confirmação da
-- pessoa — que pode contestar, abrindo ajuste na Parte 2. Entra na cadeia de
-- hash como qualquer outra, e alimenta o cálculo de atraso igual.

alter table public.ponto_marcacoes
  add column if not exists motivo_lancamento text;

comment on column public.ponto_marcacoes.motivo_lancamento is
  'Por que o gestor lançou esta marcação no lugar da pessoa. Obrigatório quando origem = lancamento_gestor.';

-- Quem lê a recusa é o gestor, não o banco: nada de "hora_extra_inicio".
create or replace function public.ponto_tipo_legivel(p_tipo public.ponto_marcacao_tipo)
returns text language sql immutable as $$
  select case p_tipo
    when 'entrada' then 'entrada'
    when 'saida_almoco' then 'saída para o almoço'
    when 'retorno_almoco' then 'retorno do almoço'
    when 'saida' then 'saída'
    when 'hora_extra_inicio' then 'início da hora extra'
    when 'hora_extra_saida' then 'fim da hora extra'
    when 'saida_pausa' then 'saída para a pausa'
    when 'retorno_pausa' then 'retorno da pausa'
  end
$$;

create or replace function public.ponto_lancar_marcacao(
  p_funcionario_id uuid,
  p_tipo public.ponto_marcacao_tipo,
  p_quando timestamptz,
  p_motivo text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_nome text;
  v_dia date;
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin lança marcação por outra pessoa.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_motivo',
      'mensagem', 'Diga por que está lançando. Sem motivo o registro não vale como prova.');
  end if;

  select sm.empresa_id, sm.display_name into v_empresa, v_nome
  from staff_members sm where sm.user_id = p_funcionario_id;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_empresa',
      'mensagem', 'Esta pessoa não está vinculada a uma empresa.');
  end if;

  if v_empresa not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  -- Hora no futuro não existe como jornada e bagunçaria "agora na loja".
  if p_quando > now() + interval '1 minute' then
    return jsonb_build_object('ok', false, 'motivo', 'no_futuro',
      'mensagem', 'Não dá para lançar uma batida que ainda não aconteceu.');
  end if;

  v_dia := (p_quando at time zone 'America/Sao_Paulo')::date;

  -- Repetir o mesmo tipo no mesmo dia quase sempre é engano. A correção de uma
  -- marcação existente vai por ajuste de ponto, não por outra marcação.
  if exists (
    select 1 from ponto_marcacoes
    where funcionario_id = p_funcionario_id
      and tipo = p_tipo
      and (registrado_em at time zone 'America/Sao_Paulo')::date = v_dia
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'duplicada',
      'mensagem', format('%s já tem %s em %s. Para corrigir a hora, use Ajustes de ponto.',
                         v_nome, public.ponto_tipo_legivel(p_tipo), to_char(v_dia, 'DD/MM')));
  end if;

  select hash into v_hash_anterior from ponto_marcacoes
  where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

  v_hash := public.ponto_calcular_hash(v_empresa, p_funcionario_id, p_tipo::text, p_quando, v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, registrado_em, origem, marcado_por,
    confirmacao, motivo_lancamento, ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, p_funcionario_id, p_tipo, p_quando, 'lancamento_gestor', auth.uid(),
    'pendente', trim(p_motivo), public.ponto_ip_origem(), public.ponto_user_agent(),
    v_hash, v_hash_anterior
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'marcacao_id', v_id, 'nome', v_nome,
    'codigo', upper(left(v_hash, 8)),
    'mensagem', format('Lançado para %s. Ela confirma ou contesta em Meu ponto.', v_nome));
end;
$$;

-- As batidas do dia passam a dizer quando a marcação foi lançada à mão.
create or replace function public.ponto_marcacoes_do_dia(p_empresa_id uuid, p_data date default null)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  v_dia date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê as marcações do dia.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'nome', sm.display_name, 'tipo', m.tipo,
    'hora', to_char(m.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
    'local', l.nome, 'origem', m.origem, 'confirmacao', m.confirmacao,
    'marcado_por', resp.display_name, 'motivo_lancamento', m.motivo_lancamento,
    'ip', host(m.ip), 'codigo', upper(left(m.hash, 8))
  ) order by m.registrado_em), '[]'::jsonb)
  into v_res
  from ponto_marcacoes m
  join staff_members sm on sm.user_id = m.funcionario_id
  left join ponto_locais l on l.id = m.local_id
  left join staff_members resp on resp.user_id = m.marcado_por
  where m.empresa_id = p_empresa_id
    and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_dia;

  return v_res;
end;
$$;

-- Quem o gestor pode lançar: nome e id, sem PIN nenhum envolvido.
create or replace function public.ponto_pessoas_da_empresa(p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Sem acesso.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'nome', display_name)
                              order by display_name), '[]'::jsonb)
    from staff_members where empresa_id = p_empresa_id
  );
end;
$$;
