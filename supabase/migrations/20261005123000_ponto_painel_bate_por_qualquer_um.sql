-- O ponto do painel passa a bater por qualquer pessoa, de qualquer lugar —
-- paridade com o programa de ponto que a loja usa hoje, e que não vai mudar de
-- rotina por causa do sistema novo.
--
-- A trava deixa de ser a rede e passa a ser quem abre a tela: só gestor, admin
-- ou quem recebeu 'bater_pelo_painel'. O funcionário comum continua preso ao
-- balcão e ao Wi-Fi da loja, que é onde a regra importa.
--
-- E o registro não finge que a pessoa bateu sozinha: quando o PIN não é o de
-- quem abriu a tela, a marcação sai com marcado_por preenchido e pendente de
-- confirmação — a pessoa vê em Meu ponto e pode contestar, como na abertura
-- coletiva. É isso que mantém a batida valendo como prova mesmo tendo sido
-- digitada por outra pessoa.
create or replace function public.ponto_registrar_pelo_painel(
  p_pin text,
  p_tipo public.ponto_marcacao_tipo default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_bloqueado timestamptz;
  v_ip inet := public.ponto_ip_origem();
  v_na_rede boolean;
  v_por_outro boolean;
  v_tipo public.ponto_marcacao_tipo;
  v_ultima_id uuid;
  v_ultima_em timestamptz;
  v_janela int;
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao',
      'mensagem', 'Entre na sua conta para bater por aqui.');
  end if;

  -- Quem pode usar esta tela. O funcionário comum não entra aqui: o ponto dele
  -- é o balcão, dentro do Wi-Fi da loja.
  if not (public.is_equipe_gestor_ou_admin()
          or public.ponto_tem_permissao(v_user, 'bater_pelo_painel')) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu ponto é no computador da loja.');
  end if;

  select empresa_id into v_empresa from staff_members where user_id = v_user;
  if v_empresa is null and public.is_equipe_admin() then
    select id into v_empresa from empresas where ativo order by created_at limit 1;
  end if;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_empresa',
      'mensagem', 'Seu cadastro não está vinculado a uma empresa.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, p_tipo, 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  if v_amb then
    return jsonb_build_object('ok', false, 'motivo', 'pin_repetido',
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  select display_name, bloqueado_em into v_nome, v_bloqueado
  from staff_members where user_id = v_func;

  if v_bloqueado is not null then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, p_tipo, 'conta_bloqueada');
    return jsonb_build_object('ok', false, 'motivo', 'conta_bloqueada',
      'mensagem', 'Esta conta está bloqueada. Peça pro gestor liberar.');
  end if;

  v_na_rede := v_ip is not null and exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  );
  v_por_outro := v_func <> v_user;

  v_tipo := coalesce(p_tipo, public.ponto_proxima_marcacao(v_func));

  v_janela := public.ponto_config_int(v_empresa, 'ignorar_repetida_min', 2);
  select id, registrado_em into v_ultima_id, v_ultima_em from ponto_marcacoes
  where funcionario_id = v_func and tipo = v_tipo
    and registrado_em > now() - make_interval(mins => v_janela)
  order by registrado_em desc limit 1;

  if v_ultima_id is not null then
    return jsonb_build_object('ok', true, 'ignorada', true, 'nome', v_nome,
      'tipo', v_tipo, 'registrado_em', v_ultima_em,
      'mensagem', 'Essa batida já foi registrada agora há pouco.');
  end if;

  if not public.ponto_sequencia_valida(v_func, v_tipo) then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, v_tipo, 'sequencia_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'sequencia_invalida',
      'mensagem', format('Essa marcação não encaixa no dia de %s. Confira o que já foi batido.', v_nome));
  end if;

  select hash into v_hash_anterior from ponto_marcacoes
  where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

  v_hash := public.ponto_calcular_hash(v_empresa, v_func, v_tipo::text, now(), v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, origem, marcado_por, confirmacao,
    ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, v_func, v_tipo, 'painel',
    case when v_por_outro then v_user else null end,
    case when v_por_outro then 'pendente'::public.ponto_confirmacao
         else 'na'::public.ponto_confirmacao end,
    v_ip, public.ponto_user_agent(), v_hash, v_hash_anterior
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'marcacao_id', v_id, 'nome', v_nome, 'tipo', v_tipo,
    'registrado_em', (select registrado_em from ponto_marcacoes where id = v_id),
    'codigo', upper(left(v_hash, 8)), 'na_rede', v_na_rede, 'por_outro', v_por_outro,
    'proxima_sugerida', public.ponto_proxima_marcacao(v_func)
  );
end;
$$;
