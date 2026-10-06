-- Montar a rota é ordenar por bairro e numerar. Entrega sem bairro casado vai
-- para o fim, não some: endereço solto ainda precisa ser entregue, e o gestor
-- resolve arrastando.
--
-- Inverter não mexe nas paradas — vira uma marca na rota. Assim o ajuste que o
-- gestor fez na mão sobrevive a inverter e desinverter, o que não aconteceria se
-- a gente reescrevesse a ordem toda vez.

create or replace function public.entrega_montar_rota(
  p_empresa_id uuid,
  p_data date,
  p_entrega_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rota uuid;
  v_n int := 0;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin monta a rota.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if coalesce(array_length(p_entrega_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false,
      'mensagem', 'Escolha ao menos uma entrega para montar a rota.');
  end if;

  insert into entrega_rotas (empresa_id, data, criada_por)
  values (p_empresa_id, p_data, auth.uid())
  on conflict (empresa_id, data) do update set data = excluded.data
  returning id into v_rota;

  -- quem já estava na rota e não veio na lista nova sai e volta para a fila
  update entregas set situacao = 'na_fila', updated_at = now()
  where id in (
    select p.entrega_id from entrega_paradas p
    where p.rota_id = v_rota and not (p.entrega_id = any(p_entrega_ids))
  ) and situacao = 'em_rota';

  delete from entrega_paradas
  where rota_id = v_rota and not (entrega_id = any(p_entrega_ids));

  insert into entrega_paradas (rota_id, entrega_id, ordem)
  select v_rota, e.id,
         row_number() over (
           order by coalesce(b.ordem, 999999), e.cliente_nome
         ) * 10
  from entregas e
  left join entrega_bairros b on b.id = e.bairro_id
  where e.id = any(p_entrega_ids)
    and e.empresa_id = p_empresa_id
    and e.situacao in ('na_fila', 'nao_entregue', 'em_rota')
  on conflict (rota_id, entrega_id) do nothing;

  update entregas set situacao = 'em_rota', updated_at = now()
  where id = any(p_entrega_ids)
    and empresa_id = p_empresa_id
    and situacao in ('na_fila', 'nao_entregue');

  select count(*) into v_n from entrega_paradas where rota_id = v_rota;

  return jsonb_build_object('ok', true, 'rota_id', v_rota, 'paradas', v_n);
end;
$$;

create or replace function public.entrega_inverter_rota(p_rota_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_inv boolean;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin muda a rota.';
  end if;

  select empresa_id into v_emp from entrega_rotas where id = p_rota_id;
  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Rota não encontrada.');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entrega_rotas set invertida = not invertida
  where id = p_rota_id returning invertida into v_inv;

  return jsonb_build_object('ok', true, 'invertida', v_inv);
end;
$$;

create or replace function public.entrega_mover_parada(
  p_parada_id uuid,
  p_nova_ordem int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin muda a rota.';
  end if;

  select r.empresa_id into v_emp
  from entrega_paradas p join entrega_rotas r on r.id = p.rota_id
  where p.id = p_parada_id;

  if v_emp is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Parada não encontrada.');
  end if;
  if v_emp not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entrega_paradas set ordem = p_nova_ordem where id = p_parada_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.entrega_montar_rota(uuid, date, uuid[]) to authenticated;
grant execute on function public.entrega_inverter_rota(uuid)             to authenticated;
grant execute on function public.entrega_mover_parada(uuid, int)         to authenticated;
