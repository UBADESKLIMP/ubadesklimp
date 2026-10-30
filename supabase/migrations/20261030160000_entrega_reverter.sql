-- Reverter uma entrega marcada por engano (o motorista tocou "entregue" sem ter
-- entregue). O registro do entregador é imutável, então a reversão NÃO apaga
-- nada: entra um evento novo, "revertida", com quem desfez, e a entrega volta
-- para "em rota" na mesma parada. O histórico mostra os dois lados.

-- "revertida" não tem motivo, como "entregue".
alter table public.entrega_eventos drop constraint if exists entrega_evento_motivo_quando_nao_entregue;
alter table public.entrega_eventos add constraint entrega_evento_motivo_quando_nao_entregue
  check (tipo in ('entregue', 'revertida') or motivo is not null);

create or replace function public.entrega_reverter(p_parada_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_parada public.entrega_paradas;
  v_entrega public.entregas;
  v_max int;
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin reverte uma entrega.';
  end if;

  select * into v_parada from entrega_paradas where id = p_parada_id;
  if v_parada.id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Parada não encontrada.');
  end if;

  select * into v_entrega from entregas where id = v_parada.entrega_id;
  if v_entrega.empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  if v_entrega.situacao not in ('entregue', 'nao_entregue') then
    return jsonb_build_object('ok', false,
      'mensagem', 'Esta entrega não está marcada como entregue nem como não entregue.');
  end if;

  insert into entrega_eventos (
    empresa_id, entrega_id, rota_id, tipo, funcionario_id, ip, user_agent
  ) values (
    v_entrega.empresa_id, v_entrega.id, v_parada.rota_id, 'revertida', auth.uid(),
    public.ponto_ip_origem(), public.ponto_user_agent()
  );

  update entregas set
    situacao = 'em_rota',
    tentativas = case when v_entrega.situacao = 'nao_entregue'
                      then greatest(tentativas - 1, 0) else tentativas end,
    updated_at = now()
  where id = v_entrega.id;

  -- Parada recuperada tem ordem 0 (ficaria no topo): vai para o fim da rota.
  if v_parada.ordem = 0 then
    select coalesce(max(ordem), 0) + 10 into v_max
    from entrega_paradas where rota_id = v_parada.rota_id;
    update entrega_paradas set ordem = v_max where id = v_parada.id;
  end if;

  return jsonb_build_object('ok', true,
    'mensagem', format('%s voltou para a rota.', v_entrega.cliente_nome));
end;
$function$;

revoke all on function public.entrega_reverter(uuid) from public, anon;
grant execute on function public.entrega_reverter(uuid) to authenticated;

-- A rota do dia só mostra o "evento" de quem está resolvido agora. Entrega que
-- voltou para a rota não deve aparecer como entregue.
create or replace function public.entrega_rota_do_dia(p_empresa_id uuid, p_data date)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_rota public.entrega_rotas; v_res jsonb;
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin vê a rota do dia.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
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
            'entregador', (select s.display_name from staff_members s where s.user_id = ev.funcionario_id),
            'lat', ev.lat, 'lng', ev.lng, 'precisao_m', ev.precisao_m,
            'ip', host(ev.ip))
          from entrega_eventos ev
          where ev.entrega_id = e.id
            and e.situacao in ('entregue', 'nao_entregue')
            and ev.tipo <> 'revertida'
          order by ev.registrado_em desc limit 1)
      ) order by case when v_rota.invertida then -p.ordem else p.ordem end)
      from entrega_paradas p
      join entregas e on e.id = p.entrega_id
      left join entrega_bairros b on b.id = e.bairro_id
      where p.rota_id = v_rota.id
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$function$;

-- O histórico marca como "desfeita" a marcação que foi revertida depois.
create or replace function public.entrega_historico(
  p_empresa_id uuid, p_de date, p_ate date
) returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin vê o histórico de entregas.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if p_ate < p_de or p_ate - p_de > 366 then
    raise exception 'Escolha um período de até 1 ano.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'evento_id', ev.id,
      'entrega_id', e.id,
      'dia', (ev.registrado_em at time zone 'America/Sao_Paulo')::date,
      'hora', to_char(ev.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
      'tipo', ev.tipo::text,
      'desfeita', (ev.tipo <> 'revertida' and exists (
        select 1 from entrega_eventos r
        where r.entrega_id = ev.entrega_id and r.tipo = 'revertida'
          and r.registrado_em > ev.registrado_em)),
      'motivo', ev.motivo::text,
      'motivo_texto', ev.motivo_texto,
      'quem_recebeu', ev.quem_recebeu,
      'entregador', coalesce(s.display_name, 'Sem nome'),
      'documento', e.documento_tipo || ' ' || e.documento_numero,
      'cliente_nome', e.cliente_nome,
      'cliente_telefone', e.cliente_telefone,
      'bairro', coalesce(b.nome, e.bairro_texto),
      'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
      'valor', e.valor,
      'itens', e.itens
    ) order by ev.registrado_em desc)
    from entrega_eventos ev
    join entregas e on e.id = ev.entrega_id
    left join entrega_bairros b on b.id = e.bairro_id
    left join staff_members s on s.user_id = ev.funcionario_id
    where ev.empresa_id = p_empresa_id
      and (ev.registrado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ), '[]'::jsonb);
end;
$function$;
