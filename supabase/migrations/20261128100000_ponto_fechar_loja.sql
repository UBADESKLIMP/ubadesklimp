-- Fechar loja: o espelho do "Abrir loja", para a saída. Liberado a partir das 18h,
-- com a mesma permissão nominal (abertura_coletiva) e o mesmo PIN. As saídas de
-- quem é marcado ficam com origem coletiva e pendentes de contestação.

-- Passo 1: confere quem está fechando, grava a saída dessa pessoa e devolve quem
-- chegou hoje e ainda não bateu saída.
create or replace function public.ponto_fechar_loja_por_pin(p_pin text, p_estacao_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_propria jsonb := null;
  v_pendentes jsonb;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, 'saida', 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN não encontrado.');
  end if;

  if not public.ponto_tem_permissao(v_func, 'abertura_coletiva') then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, 'saida', 'sem_permissao');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao', 'mensagem', 'Este PIN não fecha a loja.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, v_func, null, 'saida', 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja para fechar a loja.');
  end if;

  if v_agora::time < time '18:00' then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela',
      'mensagem', 'Fechar a loja só a partir das 18h.');
  end if;

  if public.ponto_sequencia_valida(v_func, 'saida') then
    v_propria := public.ponto_registrar(v_func, p_pin, 'saida'::public.ponto_marcacao_tipo, p_estacao_token);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('funcionario_id', sm.user_id, 'nome', sm.display_name)
                            order by sm.display_name), '[]'::jsonb)
  into v_pendentes
  from staff_members sm
  where sm.empresa_id = v_empresa
    and sm.user_id <> v_func
    and sm.desligado_em is null
    and not sm.fora_do_ponto
    and public.ponto_sequencia_valida(sm.user_id, 'saida');

  select display_name into v_nome from staff_members where user_id = v_func;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'hora', v_agora::time,
    'pendentes', v_pendentes,
    'saida_propria', coalesce(v_propria ->> 'ok', 'false')::boolean);
end;
$$;

-- Passo 2: grava a saída de quem foi marcado, na hora em que foi marcado.
create or replace function public.ponto_marcar_saidas_por_pin(
  p_pin text,
  p_estacao_token text,
  p_funcionarios uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_empresa uuid;
  v_resp uuid;
  v_amb boolean;
  v_func uuid;
  v_hash_anterior text;
  v_hash text;
  v_criadas int := 0;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_resp, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_resp is null or v_amb or not public.ponto_tem_permissao(v_resp, 'abertura_coletiva') then
    perform public.ponto_registrar_tentativa(v_empresa, v_resp, null, 'saida', 'sem_permissao');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'PIN incorreto ou sem permissão para fechar a loja.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, v_resp, null, 'saida', 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede', 'mensagem', 'Conecte no Wi-Fi da loja.');
  end if;

  if v_agora::time < time '18:00' then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela',
      'mensagem', 'Fechar a loja só a partir das 18h.');
  end if;

  foreach v_func in array p_funcionarios loop
    continue when v_func = v_resp;
    continue when not exists (
      select 1 from staff_members
      where user_id = v_func and empresa_id = v_empresa
        and desligado_em is null and not fora_do_ponto
    );
    -- quem não chegou hoje ou já bateu saída fica de fora
    continue when not public.ponto_sequencia_valida(v_func, 'saida');

    v_hash_anterior := public.ponto_ultimo_hash(v_empresa);
    v_hash := public.ponto_calcular_hash(v_empresa, v_func, 'saida', now(), v_hash_anterior);

    insert into ponto_marcacoes (
      empresa_id, funcionario_id, tipo, origem, marcado_por, confirmacao,
      ip, user_agent, hash, hash_anterior
    ) values (
      v_empresa, v_func, 'saida', 'abertura_coletiva', v_resp, 'pendente',
      v_ip, public.ponto_user_agent(), v_hash, v_hash_anterior
    );

    v_criadas := v_criadas + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saidas_registradas', v_criadas, 'hora', v_agora::time);
end;
$$;

-- Mesmo alcance das funções de abrir a loja: o quiosque chama sem login.
revoke all on function public.ponto_fechar_loja_por_pin(text, text) from public;
revoke all on function public.ponto_marcar_saidas_por_pin(text, text, uuid[]) from public;
grant execute on function public.ponto_fechar_loja_por_pin(text, text) to anon, authenticated;
grant execute on function public.ponto_marcar_saidas_por_pin(text, text, uuid[]) to anon, authenticated;
