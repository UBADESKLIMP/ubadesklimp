-- Registro do PC como estação (PRD 4.6): o admin faz uma vez, o navegador
-- guarda o token. O token em claro só volta NESTA chamada; o banco fica só
-- com o hash.
create or replace function public.ponto_registrar_estacao(
  p_nome text,
  p_local_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_local uuid := p_local_id;
  v_token text;
  v_id uuid;
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin registra uma estação.';
  end if;

  select empresa_id into v_empresa from staff_members where user_id = auth.uid();
  if v_empresa is null then
    select id into v_empresa from empresas order by created_at limit 1;
  end if;

  -- sem local informado, cria/reaproveita o local padrão de entrada
  if v_local is null then
    select id into v_local from ponto_locais
    where empresa_id = v_empresa and tipo = 'estacao' and ativo order by created_at limit 1;

    if v_local is null then
      insert into ponto_locais (empresa_id, nome, tipo)
      values (v_empresa, 'Entrada', 'estacao') returning id into v_local;
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into ponto_estacoes (local_id, nome, device_token_hash, registrado_por)
  values (v_local, p_nome, encode(digest(v_token, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'estacao_id', v_id, 'local_id', v_local, 'token', v_token);
end;
$$;

-- O quiosque não tem sessão: identifica-se pelo token da estação e recebe a
-- lista de nomes pra pessoa tocar no dela.
create or replace function public.ponto_estacao_contexto(p_estacao_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_est record;
  v_ip inet := public.ponto_ip_origem();
  v_funcs jsonb;
begin
  select e.id, e.nome, l.id as local_id, l.nome as local_nome, l.empresa_id,
         l.marcacoes_permitidas
  into v_est
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_est is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', sm.user_id,
           'nome', sm.display_name,
           'pode_abrir_loja', public.ponto_tem_permissao(sm.user_id, 'abertura_coletiva')
         ) order by sm.display_name), '[]'::jsonb)
  into v_funcs
  from staff_members sm
  where sm.empresa_id = v_est.empresa_id;

  return jsonb_build_object(
    'ok', true,
    'estacao', v_est.nome,
    'local', v_est.local_nome,
    'empresa_id', v_est.empresa_id,
    'rede_ok', exists (select 1 from ponto_redes
                       where empresa_id = v_est.empresa_id and ativo and ip = v_ip),
    'funcionarios', v_funcs
  );
end;
$$;

-- "Agora na loja" (PRD 7): quem está dentro, em almoço, em pausa ou não chegou.
create or replace function public.ponto_agora_na_loja(p_empresa_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê quem está na loja.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'funcionario_id', x.user_id,
    'nome', x.display_name,
    'situacao', x.situacao,
    'desde', x.desde
  ) order by x.display_name), '[]'::jsonb)
  into v_res
  from (
    select sm.user_id, sm.display_name,
      case
        when d.saida then 'saiu'
        when d.saida_pausa > d.retorno_pausa then 'em pausa'
        when d.saida_almoco and not d.retorno_almoco then 'em almoço'
        when d.entrada then 'na loja'
        else 'não chegou'
      end as situacao,
      d.ultima as desde
    from staff_members sm
    left join lateral (
      select
        bool_or(tipo='entrada') as entrada,
        bool_or(tipo='saida_almoco') as saida_almoco,
        bool_or(tipo='retorno_almoco') as retorno_almoco,
        bool_or(tipo='saida') as saida,
        count(*) filter (where tipo='saida_pausa') as saida_pausa,
        count(*) filter (where tipo='retorno_pausa') as retorno_pausa,
        max(registrado_em) as ultima
      from ponto_marcacoes m
      where m.funcionario_id = sm.user_id
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    ) d on true
    where sm.empresa_id = p_empresa_id
  ) x;

  return v_res;
end;
$$;

-- Marcações do dia, pro painel do gestor.
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
    'marcado_por', resp.display_name,
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
