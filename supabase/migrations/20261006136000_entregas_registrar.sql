-- O entregador chega pelo PIN, como já bate ponto: ele não tem conta de painel e
-- não deve ter. O PIN diz quem é; a empresa sai da entrega, não do que o celular
-- mandar.
--
-- Hora e IP são do servidor. Latitude e longitude vêm do aparelho e por isso são
-- declaradas — está escrito na tabela e precisa estar escrito na tela também.
--
-- Não entregue incrementa tentativas e devolve para a fila: é assim que a
-- entrega vira dívida e aparece no topo da rota de amanhã, que é o problema que
-- este módulo existe para resolver.

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

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_entrega.empresa_id, p_pin);

  if v_func is null then
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

grant execute on function public.entrega_registrar(
  text, uuid, public.entrega_evento_tipo, public.entrega_motivo,
  text, text, numeric, numeric, numeric) to anon, authenticated;
