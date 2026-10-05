-- Ponto aberto pelo painel, funcionando como o balcão: o PIN diz quem está
-- batendo. O que muda é só a regra da rede, e ela muda por pessoa.
--
-- Na rede da loja, qualquer PIN da empresa bate — é o mesmo que o balcão.
-- Fora dela, só passa o PIN de quem tem 'bater_pelo_painel'. Assim abrir o
-- painel em casa não vira um jeito de bater o ponto dos outros: o PIN do
-- funcionário simplesmente não é aceito de lá.
--
-- A regra da rede existe para o funcionário: é ela que impede bater do caminho
-- de casa como se já estivesse no balcão. Para quem administra, a jornada não é
-- o que o sistema fiscaliza, e ajustar coisa fora de expediente é rotina —
-- daí a permissão nominal, nunca um afrouxamento geral.

alter table public.ponto_permissoes drop constraint if exists ponto_permissoes_permissao_check;
alter table public.ponto_permissoes add constraint ponto_permissoes_permissao_check
  check (permissao in ('abertura_coletiva', 'manutencao_quiosque', 'bater_pelo_painel'));

-- A empresa vem da sessão de quem abriu a tela; o PIN resolve quem bate.
create or replace function public.ponto_contexto_do_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_ip inet := public.ponto_ip_origem();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select empresa_id into v_empresa from staff_members where user_id = v_user;

  -- Admin sem empresa própria ainda precisa conseguir abrir a tela: cai na
  -- única empresa cadastrada.
  if v_empresa is null and public.is_equipe_admin() then
    select id into v_empresa from empresas where ativo order by created_at limit 1;
  end if;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_empresa',
      'mensagem', 'Seu cadastro não está vinculado a uma empresa.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'empresa_id', v_empresa,
    'local', (select razao_social from empresas where id = v_empresa),
    'rede_ok', v_ip is not null and exists (
      select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
    )
  );
end;
$$;

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

  -- A permissão é de quem bate, não de quem abriu a tela.
  if not v_na_rede and not public.ponto_tem_permissao(v_func, 'bater_pelo_painel') then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, p_tipo, 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja para bater o ponto.');
  end if;

  v_tipo := coalesce(p_tipo, public.ponto_proxima_marcacao(v_func));

  v_janela := public.ponto_config_int(v_empresa, 'ignorar_repetida_min', 2);
  select id, registrado_em into v_ultima_id, v_ultima_em from ponto_marcacoes
  where funcionario_id = v_func and tipo = v_tipo
    and registrado_em > now() - make_interval(mins => v_janela)
  order by registrado_em desc limit 1;

  if v_ultima_id is not null then
    return jsonb_build_object('ok', true, 'ignorada', true, 'nome', v_nome,
      'tipo', v_tipo, 'registrado_em', v_ultima_em,
      'mensagem', 'Você já bateu agora há pouco. Não registramos de novo.');
  end if;

  if not public.ponto_sequencia_valida(v_func, v_tipo) then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, v_tipo, 'sequencia_invalida');
    return jsonb_build_object('ok', false, 'motivo', 'sequencia_invalida',
      'mensagem', 'Essa marcação não encaixa no seu dia. Confira o que já bateu.');
  end if;

  select hash into v_hash_anterior from ponto_marcacoes
  where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

  v_hash := public.ponto_calcular_hash(v_empresa, v_func, v_tipo::text, now(), v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, origem, marcado_por, ip, user_agent, hash, hash_anterior
  ) values (
    v_empresa, v_func, v_tipo, 'painel', v_user, v_ip, public.ponto_user_agent(),
    v_hash, v_hash_anterior
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'marcacao_id', v_id, 'nome', v_nome, 'tipo', v_tipo,
    'registrado_em', (select registrado_em from ponto_marcacoes where id = v_id),
    'codigo', upper(left(v_hash, 8)), 'na_rede', v_na_rede,
    'proxima_sugerida', public.ponto_proxima_marcacao(v_func)
  );
end;
$$;
