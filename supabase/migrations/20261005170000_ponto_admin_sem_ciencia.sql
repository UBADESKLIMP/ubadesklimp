-- Admin deixa de precisar justificar e de deixar a batida pendente de ciência.
--
-- O dono testa o módulo o dia inteiro: lança batida, corrige hora, bate com o
-- PIN de alguém pra ver como fica do outro lado. Cada uma dessas ações pedia um
-- "por quê" escrito e saía pendente, obrigando a entrar na conta da pessoa pra
-- fechar. Pedido dele, com estas palavras: "os demais pode manter tudo, só para
-- eu admin".
--
-- Gestor continua como era: motivo obrigatório e ciência da pessoa. A diferença
-- vale só para is_equipe_admin().
--
-- O que se perde, escrito aqui pra não se perder: a batida que o admin faz pela
-- pessoa não passa mais por ela, então deixa de carregar a concordância dela.
-- Continua registrando quem fez (marcado_por), de onde (IP), com que navegador,
-- e continua presa na cadeia de hash — dá pra auditar, só não dá pra dizer que
-- a pessoa viu. Se um dia isso precisar valer como prova numa discussão de
-- jornada, é esta linha que vai fazer falta.

-- Um lugar só pra decidir, pra não espalhar a regra por três funções.
create or replace function public.ponto_exige_ciencia()
returns boolean language sql stable security definer set search_path = public as $$
  select not public.is_equipe_admin()
$$;

-- O front precisa saber pra não travar o botão pedindo um motivo que o banco
-- não vai cobrar.
create or replace function public.ponto_sou_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_equipe_admin()
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
  v_exige boolean := public.ponto_exige_ciencia();
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin lança marcação por outra pessoa.';
  end if;

  if coalesce(trim(p_motivo), '') = '' and v_exige then
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
    where funcionario_id = p_funcionario_id and tipo = p_tipo
      and substituida_por is null
      and (registrado_em at time zone 'America/Sao_Paulo')::date = v_dia
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'duplicada',
      'mensagem', format('%s já tem %s em %s. Para corrigir a hora, use o lápis na batida.',
        v_nome, public.ponto_tipo_legivel(p_tipo), to_char(v_dia, 'DD/MM')));
  end if;

  v_hash_anterior := public.ponto_ultimo_hash(v_empresa);
  v_hash := public.ponto_calcular_hash(v_empresa, p_funcionario_id, p_tipo::text, p_quando, v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, registrado_em, origem, marcado_por,
    confirmacao, motivo_lancamento, ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, p_funcionario_id, p_tipo, p_quando, 'lancamento_gestor', auth.uid(),
    case when v_exige then 'pendente'::public.ponto_confirmacao
         else 'na'::public.ponto_confirmacao end,
    nullif(trim(p_motivo), ''),
    public.ponto_ip_origem(), public.ponto_user_agent(), v_hash, v_hash_anterior
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'marcacao_id', v_id, 'nome', v_nome,
    'codigo', upper(left(v_hash, 8)),
    'mensagem', case when v_exige
      then format('Lançado para %s. Ela confirma ou contesta em Meu ponto.', v_nome)
      else format('Lançado para %s.', v_nome) end);
end;
$$;

create or replace function public.ponto_corrigir_marcacao(
  p_marcacao_id uuid,
  p_quando timestamptz,
  p_motivo text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_m record;
  v_nome text;
  v_atraso record;
  v_exige boolean := public.ponto_exige_ciencia();
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin corrige uma batida.';
  end if;

  if coalesce(trim(p_motivo), '') = '' and v_exige then
    return jsonb_build_object('ok', false, 'motivo', 'sem_motivo',
      'mensagem', 'Diga por que está corrigindo. Sem motivo a correção não vale como prova.');
  end if;

  select * into v_m from ponto_marcacoes where id = p_marcacao_id;

  if v_m is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada',
      'mensagem', 'Batida não encontrada.');
  end if;

  if v_m.substituida_por is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_corrigida',
      'mensagem', 'Esta batida já foi corrigida. Corrija a que está valendo.');
  end if;

  if v_m.empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  if p_quando > now() + interval '1 minute' then
    return jsonb_build_object('ok', false, 'motivo', 'no_futuro',
      'mensagem', 'Não dá para marcar uma hora que ainda não chegou.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_m.funcionario_id;

  -- O atraso que nasceu da hora errada sai de cena antes, senão o trigger
  -- enxerga um lançamento ativo no dia e não recalcula com a hora certa.
  select * into v_atraso from equipe_atrasos
  where colaborador_id = v_m.funcionario_id
    and data = (v_m.registrado_em at time zone 'America/Sao_Paulo')::date
    and status <> 'substituido'
  order by created_at desc limit 1;

  if v_atraso.id is not null then
    begin
      update equipe_atrasos set status = 'substituido' where id = v_atraso.id;
    exception when others then
      return jsonb_build_object('ok', false, 'motivo', 'atraso_travado', 'mensagem', format(
        'O atraso de %s nesse dia já teve ciência ou virou medida, então não dá para refazer o cálculo por aqui. Resolva pelo ajuste de ponto.',
        v_nome));
    end;
  end if;

  v_hash_anterior := public.ponto_ultimo_hash(v_m.empresa_id);
  v_hash := public.ponto_calcular_hash(
    v_m.empresa_id, v_m.funcionario_id, v_m.tipo::text, p_quando, v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, registrado_em, local_id, estacao_id,
    origem, marcado_por, confirmacao, motivo_lancamento, estava_na_porta,
    ip, user_agent, hash, hash_anterior
  ) values (
    v_m.empresa_id, v_m.funcionario_id, v_m.tipo, p_quando, v_m.local_id, v_m.estacao_id,
    'correcao', auth.uid(),
    case when v_exige then 'pendente'::public.ponto_confirmacao
         else 'na'::public.ponto_confirmacao end,
    nullif(trim(p_motivo), ''), v_m.estava_na_porta,
    public.ponto_ip_origem(), public.ponto_user_agent(), v_hash, v_hash_anterior
  ) returning id into v_id;

  update ponto_marcacoes set substituida_por = v_id where id = p_marcacao_id;

  return jsonb_build_object('ok', true, 'marcacao_id', v_id, 'nome', v_nome,
    'codigo', upper(left(v_hash, 8)),
    'mensagem', case when v_exige
      then format('Hora corrigida para %s. %s confirma ou contesta em Meu ponto.',
             to_char(p_quando at time zone 'America/Sao_Paulo', 'HH24:MI'), v_nome)
      else format('Hora corrigida para %s.',
             to_char(p_quando at time zone 'America/Sao_Paulo', 'HH24:MI')) end);
end;
$$;

-- Bater pelo painel com o PIN de outra pessoa: mesma ideia. Continua saindo com
-- marcado_por preenchido — some só a pendência.
do $PATCH$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'ponto_registrar_pelo_painel';

  v_novo := replace(v_def,
    'case when v_por_outro then ''pendente''::public.ponto_confirmacao',
    'case when v_por_outro and public.ponto_exige_ciencia() then ''pendente''::public.ponto_confirmacao');

  if v_novo = v_def then
    raise exception 'Não encontrei o trecho da confirmação em ponto_registrar_pelo_painel.';
  end if;

  execute v_novo;
end;
$PATCH$;
