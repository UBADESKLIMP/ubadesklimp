-- Três leituras, três telas. A da loja e a da fila exigem gestor; a do celular
-- se identifica pelo PIN, porque o entregador não tem conta de painel.
--
-- A fila devolve o que não foi entregue antes no topo, com tentativas e motivo:
-- é exatamente o que some hoje quando ele volta e não avisa.

create or replace function public.entrega_fila(p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê a fila de entregas.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  -- prioridade e bairro_ordem servem só para ordenar; não vão para a tela
  select coalesce(jsonb_agg(to_jsonb(x) - 'prioridade' - 'bairro_ordem'
                            order by x.prioridade, x.bairro_ordem, x.cliente_nome), '[]'::jsonb)
  into v_res
  from (
    select e.id, e.documento_tipo, e.documento_numero, e.cliente_nome,
           e.cliente_telefone, e.valor, e.itens, e.situacao::text as situacao,
           e.tentativas,
           coalesce(b.nome, e.bairro_texto) as bairro,
           coalesce(b.ordem, 999999) as bairro_ordem,
           trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)) as endereco,
           e.entregar_em,
           -- quem já voltou sem entregar vem primeiro: é dívida
           case when e.situacao = 'nao_entregue' then 0 else 1 end as prioridade,
           (select ev.motivo::text from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultimo_motivo,
           (select ev.registrado_em from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultima_tentativa
    from entregas e
    left join entrega_bairros b on b.id = e.bairro_id
    where e.empresa_id = p_empresa_id
      and e.situacao in ('na_fila', 'nao_entregue')
  ) x;

  return v_res;
end;
$$;

create or replace function public.entrega_rota_do_dia(p_empresa_id uuid, p_data date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rota public.entrega_rotas; v_res jsonb;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin vê a rota do dia.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  select * into v_rota from entrega_rotas
  where empresa_id = p_empresa_id and data = p_data;

  if v_rota.id is null then
    return jsonb_build_object('existe', false, 'data', p_data, 'paradas', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'existe', true,
    'rota_id', v_rota.id,
    'data', v_rota.data,
    'invertida', v_rota.invertida,
    'paradas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parada_id', p.id,
        'entrega_id', e.id,
        'ordem', p.ordem,
        'documento', e.documento_tipo || ' ' || e.documento_numero,
        'cliente_nome', e.cliente_nome,
        'cliente_telefone', e.cliente_telefone,
        'bairro', coalesce(b.nome, e.bairro_texto),
        'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
        'entregar_em', e.entregar_em,
        'itens', e.itens,
        'valor', e.valor,
        'situacao', e.situacao::text,
        'evento', (
          select jsonb_build_object(
            'tipo', ev.tipo::text,
            'motivo', ev.motivo::text,
            'motivo_texto', ev.motivo_texto,
            'quem_recebeu', ev.quem_recebeu,
            'hora', to_char(ev.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
            'lat', ev.lat, 'lng', ev.lng, 'precisao_m', ev.precisao_m,
            'ip', host(ev.ip))
          from entrega_eventos ev
          where ev.entrega_id = e.id order by ev.registrado_em desc limit 1)
      ) order by case when v_rota.invertida then -p.ordem else p.ordem end)
      from entrega_paradas p
      join entregas e on e.id = p.entrega_id
      left join entrega_bairros b on b.id = e.bairro_id
      where p.rota_id = v_rota.id
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

create or replace function public.entrega_minha_rota(p_pin text, p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_func uuid; v_amb boolean; v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rota public.entrega_rotas;
begin
  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(p_empresa_id, p_pin);

  if v_func is null then
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

grant execute on function public.entrega_fila(uuid)                to authenticated;
grant execute on function public.entrega_rota_do_dia(uuid, date)   to authenticated;
grant execute on function public.entrega_minha_rota(text, uuid)    to anon, authenticated;
