-- Abertura coletiva (PRD 4.5): a responsável bate a entrada de quem já estava
-- na porta, com o login DELA — sem PIN mestre compartilhado.
--
-- Reaproveita o que a Parte 1 já tem: equipe_aberturas (hora de abertura, a
-- mesma da regra da porta R3) e equipe_abertura_presentes (quem estava lá).
-- Aqui só se acrescenta a geração das marcações de ponto.
--
-- ponto_confirmar_marcacao fica na migration seguinte
-- (20261002140000_ponto_append_only_permite_confirmacao.sql): a primeira versão
-- desligava o trigger append-only dentro da função e foi substituída.

-- Permissão nominal, dada pelo admin a pessoas específicas (hoje a Letícia).
create table public.ponto_permissoes (
  user_id uuid not null references public.staff_members(user_id) on delete cascade,
  permissao text not null check (permissao in ('abertura_coletiva', 'manutencao_quiosque')),
  concedida_por uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  primary key (user_id, permissao)
);

alter table public.ponto_permissoes enable row level security;

create policy "Staff lê as próprias permissões de ponto"
  on public.ponto_permissoes for select to authenticated
  using (user_id = auth.uid() or public.is_equipe_gestor_ou_admin());

create policy "Só admin concede permissão de ponto"
  on public.ponto_permissoes for all to authenticated
  using (public.is_equipe_admin()) with check (public.is_equipe_admin());

create or replace function public.ponto_tem_permissao(p_user_id uuid, p_permissao text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ponto_permissoes where user_id = p_user_id and permissao = p_permissao
  )
$$;

-- Abre a loja: grava a hora (regra da porta da Parte 1) e devolve quem ainda
-- não bateu entrada. P20 (sem permissão), P25 (não se inclui), P22 (quem já bateu sai da lista).
create or replace function public.ponto_abrir_loja(
  p_responsavel_id uuid,
  p_pin text,
  p_estacao_token text default null,
  p_device_id text default null,
  p_motivo text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_empresa uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_origem text;
  v_pendentes jsonb;
begin
  select empresa_id into v_empresa from staff_members where user_id = p_responsavel_id;
  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu cadastro não está completo.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, null, 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja para abrir a loja.');
  end if;

  if not public.ponto_pin_confere(p_responsavel_id, p_pin) then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, null, 'pin_invalido');
    perform public.equipe_registrar_tentativa_login(p_responsavel_id, false);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN incorreto.');
  end if;

  -- P20: só quem tem a permissão nominal
  if not public.ponto_tem_permissao(p_responsavel_id, 'abertura_coletiva') then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, null, 'sem_permissao');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Você não tem permissão para abrir a loja.');
  end if;

  -- estação OU celular aprovado da própria responsável (PRD 4.5 / P26, P27)
  if p_estacao_token is not null then
    if not exists (
      select 1 from ponto_estacoes
      where device_token_hash = encode(digest(p_estacao_token,'sha256'),'hex') and revogada_em is null
    ) then
      return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
        'mensagem', 'Este computador não está registrado como estação.');
    end if;
    v_origem := 'estacao';
  else
    if not exists (
      select 1 from ponto_dispositivos
      where funcionario_id = p_responsavel_id
        and device_id_hash = encode(digest(coalesce(p_device_id,''),'sha256'),'hex')
        and status = 'aprovado'
    ) then
      perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, null, 'dispositivo_nao_aprovado');
      return jsonb_build_object('ok', false, 'motivo', 'dispositivo_nao_aprovado',
        'mensagem', 'Seu celular ainda não foi liberado para abrir a loja.');
    end if;
    v_origem := 'celular';
  end if;

  -- grava a hora de abertura: é o MESMO dado que a Parte 1 usa na regra da porta
  insert into equipe_aberturas (empresa_id, data, hora_abertura, motivo, registrado_por)
  values (v_empresa, v_hoje, (now() at time zone 'America/Sao_Paulo')::time, p_motivo, p_responsavel_id)
  on conflict (empresa_id, data) do update
    set hora_abertura = excluded.hora_abertura, registrado_por = excluded.registrado_por;

  -- P22 + P25: quem ainda não bateu entrada hoje, menos a própria responsável
  select coalesce(jsonb_agg(jsonb_build_object('funcionario_id', sm.user_id, 'nome', sm.display_name)
                            order by sm.display_name), '[]'::jsonb)
  into v_pendentes
  from staff_members sm
  where sm.empresa_id = v_empresa
    and sm.user_id <> p_responsavel_id
    and not exists (
      select 1 from ponto_marcacoes m
      where m.funcionario_id = sm.user_id and m.tipo = 'entrada'
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    );

  return jsonb_build_object('ok', true, 'origem', v_origem,
    'hora_abertura', (now() at time zone 'America/Sao_Paulo')::time,
    'pendentes', v_pendentes);
end;
$$;

-- Marca os presentes: gera as entradas com origem coletiva (P19), dentro da
-- janela de 10 min (P21), e alimenta a Parte 1 com estava_na_porta.
create or replace function public.ponto_marcar_presentes(
  p_responsavel_id uuid,
  p_pin text,
  p_funcionarios uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_empresa uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_abertura record;
  v_janela int;
  v_func uuid;
  v_hash_anterior text;
  v_hash text;
  v_criadas int := 0;
  v_hora time;
begin
  select empresa_id into v_empresa from staff_members where user_id = p_responsavel_id;

  if not public.ponto_pin_confere(p_responsavel_id, p_pin)
     or not public.ponto_tem_permissao(p_responsavel_id, 'abertura_coletiva') then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, 'entrada', 'sem_permissao');
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'PIN incorreto ou sem permissão para abrir a loja.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, 'entrada', 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja.');
  end if;

  select * into v_abertura from equipe_aberturas
  where empresa_id = v_empresa and data = v_hoje;

  if v_abertura is null then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela',
      'mensagem', 'Registre a abertura da loja primeiro.');
  end if;

  -- P21: a lista vale por 10 min depois do "Abrir loja"
  v_janela := public.ponto_config_int(v_empresa, 'janela_abertura_coletiva_min', 10);
  if now() > v_abertura.created_at + make_interval(mins => v_janela) then
    perform public.ponto_registrar_tentativa(v_empresa, p_responsavel_id, null, 'entrada', 'fora_da_janela');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela',
      'mensagem', format('A lista fecha %s minutos depois de abrir a loja. Quem chegou depois bate sozinho.', v_janela));
  end if;

  v_hora := v_abertura.hora_abertura;

  foreach v_func in array p_funcionarios loop
    -- P25: a responsável não entra na própria lista
    continue when v_func = p_responsavel_id;
    -- P22: quem já bateu entrada fica de fora
    continue when exists (
      select 1 from ponto_marcacoes
      where funcionario_id = v_func and tipo = 'entrada'
        and (registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    );
    continue when not exists (
      select 1 from staff_members where user_id = v_func and empresa_id = v_empresa
    );

    select hash into v_hash_anterior from ponto_marcacoes
    where empresa_id = v_empresa order by registrado_em desc, created_at desc limit 1;

    v_hash := public.ponto_calcular_hash(v_empresa, v_func, 'entrada', now(), v_hash_anterior);

    insert into ponto_marcacoes (
      empresa_id, funcionario_id, tipo, origem, marcado_por, confirmacao,
      estava_na_porta, ip, user_agent, hash, hash_anterior
    ) values (
      v_empresa, v_func, 'entrada', 'abertura_coletiva', p_responsavel_id, 'pendente',
      true, v_ip, public.ponto_user_agent(), v_hash, v_hash_anterior
    );

    -- alimenta a regra da porta da Parte 1
    insert into equipe_abertura_presentes (empresa_id, data, colaborador_id, hora_chegada_porta, registrado_por)
    values (v_empresa, v_hoje, v_func, v_hora, p_responsavel_id)
    on conflict (empresa_id, data, colaborador_id) do nothing;

    v_criadas := v_criadas + 1;
  end loop;

  return jsonb_build_object('ok', true, 'entradas_registradas', v_criadas,
    'hora', v_hora, 'aguardando_confirmacao', v_criadas);
end;
$$;
