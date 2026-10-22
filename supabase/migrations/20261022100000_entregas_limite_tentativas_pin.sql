-- Limite de tentativas de PIN nas Entregas.
--
-- entrega_minha_rota e entrega_registrar são abertas ao anon e identificam o
-- entregador só pelo PIN de 4 dígitos. Sem nenhuma contagem de erros, qualquer
-- pessoa com o link da loja podia testar os 10 mil PINs e, no acerto, ler a rota
-- do dia (nome, telefone, endereço e itens dos clientes).
--
-- Agora: 10 PINs errados em 15 minutos, do mesmo IP, bloqueiam aquele IP. Como
-- um atacante pode trocar de IP, existe também um teto por loja (30 erros em
-- 15 minutos). Passou o prazo, libera sozinho.
--
-- Acerto NÃO zera o contador de propósito: quem tem um PIN válido (o dele) não
-- pode intercalar acertos para continuar chutando o PIN dos outros.

create table public.entrega_pin_falhas (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ip inet,
  created_at timestamptz not null default now()
);

create index idx_entrega_pin_falhas_ip on public.entrega_pin_falhas (ip, created_at desc);
create index idx_entrega_pin_falhas_empresa on public.entrega_pin_falhas (empresa_id, created_at desc);

-- Só as funções abaixo (security definer) leem e gravam. Sem policy = sem acesso
-- direto pela API.
alter table public.entrega_pin_falhas enable row level security;
revoke all on table public.entrega_pin_falhas from anon, authenticated;

create or replace function public.entrega_pin_bloqueado(p_empresa_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ip inet := public.ponto_ip_origem();
begin
  if v_ip is not null and (
    select count(*) from public.entrega_pin_falhas
    where ip = v_ip and created_at > now() - interval '15 minutes'
  ) >= 10 then
    return true;
  end if;

  return (
    select count(*) from public.entrega_pin_falhas
    where empresa_id = p_empresa_id and created_at > now() - interval '15 minutes'
  ) >= 30;
end;
$$;

create or replace function public.entrega_pin_falhou(p_empresa_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.entrega_pin_falhas where created_at < now() - interval '1 day';
  insert into public.entrega_pin_falhas (empresa_id, ip)
  values (p_empresa_id, public.ponto_ip_origem());
end;
$$;

-- Funções internas: só as RPCs de entrega (security definer) chamam.
revoke all on function public.entrega_pin_bloqueado(uuid) from public, anon, authenticated;
revoke all on function public.entrega_pin_falhou(uuid) from public, anon, authenticated;

-- entrega_minha_rota deixa de ser "stable": agora grava a falha.
create or replace function public.entrega_minha_rota(p_pin text, p_empresa_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_func uuid; v_amb boolean; v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rota public.entrega_rotas;
begin
  if public.entrega_pin_bloqueado(p_empresa_id) then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado',
      'mensagem', 'Muitas tentativas com PIN errado. Espere 15 minutos ou fale com o gestor.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(p_empresa_id, p_pin);

  if v_func is null then
    perform public.entrega_pin_falhou(p_empresa_id);
    return jsonb_build_object('ok', false, 'mensagem', 'PIN não encontrado.');
  end if;
  if v_amb then
    return jsonb_build_object('ok', false,
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;
  select * into v_rota from entrega_rotas
  where empresa_id = p_empresa_id and data = v_hoje;

  if v_rota.id is null then
    return jsonb_build_object('ok', true, 'nome', v_nome,
      'mensagem', 'Nenhuma rota montada para hoje.', 'paradas', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'nome', v_nome,
    'rota_id', v_rota.id,
    'invertida', v_rota.invertida,
    'paradas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entrega_id', e.id,
        'ordem', p.ordem,
        'documento', e.documento_tipo || ' ' || e.documento_numero,
        'cliente_nome', e.cliente_nome,
        'cliente_telefone', e.cliente_telefone,
        'bairro', coalesce(b.nome, e.bairro_texto),
        'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
        'entregar_em', e.entregar_em,
        'itens', e.itens,
        'situacao', e.situacao::text
      ) order by case when v_rota.invertida then -p.ordem else p.ordem end)
      from entrega_paradas p
      join entregas e on e.id = p.entrega_id
      left join entrega_bairros b on b.id = e.bairro_id
      where p.rota_id = v_rota.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.entrega_registrar(
  p_pin          text,
  p_entrega_id   uuid,
  p_tipo         public.entrega_evento_tipo,
  p_motivo       public.entrega_motivo default null,
  p_motivo_texto text default null,
  p_quem_recebeu text default null,
  p_lat          numeric default null,
  p_lng          numeric default null,
  p_precisao_m   numeric default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_entrega public.entregas;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_rota uuid;
  v_evento uuid;
  v_situacao public.entrega_situacao;
begin
  select * into v_entrega from entregas where id = p_entrega_id;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Entrega não encontrada.');
  end if;

  if public.entrega_pin_bloqueado(v_entrega.empresa_id) then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado',
      'mensagem', 'Muitas tentativas com PIN errado. Espere 15 minutos ou fale com o gestor.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_entrega.empresa_id, p_pin);

  if v_func is null then
    perform public.entrega_pin_falhou(v_entrega.empresa_id);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;
  if v_amb then
    return jsonb_build_object('ok', false, 'motivo', 'pin_repetido',
      'mensagem', 'Esse PIN está com mais de uma pessoa. Peça pro gestor trocar o seu.');
  end if;

  if p_tipo = 'nao_entregue' and p_motivo is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_motivo',
      'mensagem', 'Diga por que não deu para entregar.');
  end if;

  if v_entrega.situacao = 'entregue' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_entregue',
      'mensagem', 'Esta entrega já foi dada como entregue.');
  end if;
  if v_entrega.situacao = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'cancelada',
      'mensagem', 'Esta entrega foi cancelada. Fale com a loja.');
  end if;

  select p.rota_id into v_rota
  from entrega_paradas p join entrega_rotas r on r.id = p.rota_id
  where p.entrega_id = p_entrega_id and r.empresa_id = v_entrega.empresa_id
  order by r.data desc limit 1;

  insert into entrega_eventos (
    empresa_id, entrega_id, rota_id, tipo, motivo, motivo_texto, quem_recebeu,
    funcionario_id, lat, lng, precisao_m, ip, user_agent
  ) values (
    v_entrega.empresa_id, p_entrega_id, v_rota, p_tipo, p_motivo,
    nullif(trim(p_motivo_texto), ''), nullif(trim(p_quem_recebeu), ''),
    v_func, p_lat, p_lng, p_precisao_m,
    public.ponto_ip_origem(), public.ponto_user_agent()
  ) returning id into v_evento;

  if p_tipo = 'entregue' then
    v_situacao := 'entregue';
    update entregas set situacao = 'entregue', updated_at = now()
    where id = p_entrega_id;
  else
    v_situacao := 'nao_entregue';
    update entregas set situacao = 'nao_entregue',
                        tentativas = tentativas + 1,
                        updated_at = now()
    where id = p_entrega_id;
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;

  return jsonb_build_object(
    'ok', true,
    'evento_id', v_evento,
    'situacao', v_situacao,
    'nome', v_nome,
    'mensagem', case when p_tipo = 'entregue'
      then format('Entrega de %s registrada.', v_entrega.cliente_nome)
      else format('%s ficou pendente. Volta para a fila de amanhã.', v_entrega.cliente_nome)
    end
  );
end;
$$;
