-- A estação ganha um bastidor: um lugar, no próprio computador, onde dá pra
-- ver o que ele é e escolher o que ele faz — sem precisar sair pro painel.
--
-- O "modo fácil" é o que a equipe usa o dia inteiro: só o que está nos
-- atalhos. O bastidor fica atrás do PIN de manutenção.

alter table public.ponto_estacoes
  add column if not exists atalhos text[] not null
    default '{bater_ponto,abrir_loja,reportar_faltante}';

comment on column public.ponto_estacoes.atalhos is
  'O que aparece no modo fácil desta estação. bater_ponto é sempre o centro da tela; os outros são opcionais.';

-- O quiosque já lê o contexto a cada abertura: os atalhos vão junto.
create or replace function public.ponto_estacao_contexto(p_estacao_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_est record;
  v_ip inet := public.ponto_ip_origem();
  v_funcs jsonb;
begin
  select e.id, e.nome, e.atalhos, l.id as local_id, l.nome as local_nome, l.empresa_id,
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
    'estacao_id', v_est.id,
    'local', v_est.local_nome,
    'empresa_id', v_est.empresa_id,
    'atalhos', to_jsonb(v_est.atalhos),
    'rede_ok', exists (select 1 from ponto_redes
                       where empresa_id = v_est.empresa_id and ativo and ip = v_ip),
    'modo_quiosque', public.ponto_tem_pin_manutencao(v_est.empresa_id),
    'funcionarios', v_funcs
  );
end;
$$;

-- Ficha do aparelho, pro bastidor. Pede o PIN de manutenção de novo em vez de
-- confiar na tela: quem abriu pode ter saído de perto.
create or replace function public.ponto_estacao_ficha(
  p_estacao_token text,
  p_pin text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_libera jsonb;
  v_est record;
begin
  v_libera := public.ponto_sair_do_quiosque(p_estacao_token, p_pin);
  if not (v_libera ->> 'ok')::boolean then
    return v_libera;
  end if;

  select e.nome, e.atalhos, e.ultimo_heartbeat, e.ultimo_ip, e.created_at,
         l.nome as local_nome, l.empresa_id
  into v_est
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null;

  return jsonb_build_object(
    'ok', true,
    'nome', v_est.nome,
    'local', v_est.local_nome,
    'atalhos', to_jsonb(v_est.atalhos),
    'ultimo_ip', host(v_est.ultimo_ip),
    'ultimo_heartbeat', v_est.ultimo_heartbeat,
    'registrado_em', v_est.created_at,
    'batidas_hoje', (
      select count(*) from ponto_marcacoes m
      where m.empresa_id = v_est.empresa_id
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date
            = (now() at time zone 'America/Sao_Paulo')::date
    )
  );
end;
$$;

create or replace function public.ponto_definir_atalhos(
  p_estacao_token text,
  p_pin text,
  p_atalhos text[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_libera jsonb;
  v_validos text[];
begin
  v_libera := public.ponto_sair_do_quiosque(p_estacao_token, p_pin);
  if not (v_libera ->> 'ok')::boolean then
    return v_libera;
  end if;

  -- bater_ponto é o motivo de a estação existir: não sai nunca.
  select array_agg(distinct a) into v_validos
  from unnest(coalesce(p_atalhos, '{}') || array['bater_ponto']) a
  where a in ('bater_ponto', 'abrir_loja', 'reportar_faltante');

  update ponto_estacoes set atalhos = v_validos
  where device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and revogada_em is null;

  return jsonb_build_object('ok', true, 'atalhos', to_jsonb(v_validos));
end;
$$;
