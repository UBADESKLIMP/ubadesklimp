-- Editar o bairro de uma entrega e remover um bairro da lista.
--
-- O bairro da entrega vem de dois campos: bairro_id (bairro cadastrado, que dá a
-- ordem da rota) e bairro_texto (o texto que veio do pedido). Escolher um bairro
-- da lista grava os dois; digitar outro nome grava só o texto e a entrega vai
-- para o fim da rota até esse bairro ser cadastrado.

create or replace function public.entrega_definir_bairro(
  p_entrega_id uuid,
  p_bairro_id uuid default null,
  p_bairro_texto text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_entrega public.entregas;
  v_bairro public.entrega_bairros;
  v_texto text := nullif(trim(coalesce(p_bairro_texto, '')), '');
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin edita o bairro da entrega.';
  end if;

  select * into v_entrega from entregas where id = p_entrega_id;
  if v_entrega.id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Entrega não encontrada.');
  end if;
  if v_entrega.empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if v_entrega.situacao in ('entregue', 'cancelada') then
    return jsonb_build_object('ok', false,
      'mensagem', 'Esta entrega já foi resolvida: o bairro não muda mais.');
  end if;

  if p_bairro_id is not null then
    select * into v_bairro from entrega_bairros
    where id = p_bairro_id and empresa_id = v_entrega.empresa_id;
    if v_bairro.id is null then
      return jsonb_build_object('ok', false, 'mensagem', 'Esse bairro não está na lista.');
    end if;
    update entregas set bairro_id = v_bairro.id, bairro_texto = v_bairro.nome, updated_at = now()
    where id = v_entrega.id;
    return jsonb_build_object('ok', true, 'mensagem', format('Bairro: %s.', v_bairro.nome));
  end if;

  if v_texto is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha um bairro ou escreva o nome.');
  end if;

  update entregas set bairro_id = null, bairro_texto = v_texto, updated_at = now()
  where id = v_entrega.id;
  return jsonb_build_object('ok', true,
    'mensagem', format('Bairro: %s. Cadastre em Bairros para entrar na ordem da rota.', v_texto));
end;
$function$;

revoke all on function public.entrega_definir_bairro(uuid, uuid, text) from public, anon;
grant execute on function public.entrega_definir_bairro(uuid, uuid, text) to authenticated;

-- Remover um bairro da lista. As entregas que o usavam não perdem o nome: ele
-- passa para o texto delas, e elas vão para o fim da rota até novo cadastro.
create or replace function public.entrega_bairro_remover(p_bairro_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_bairro public.entrega_bairros;
  v_afetadas int;
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin remove bairro.';
  end if;

  select * into v_bairro from entrega_bairros where id = p_bairro_id;
  if v_bairro.id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Bairro não encontrado.');
  end if;
  if v_bairro.empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entregas
  set bairro_texto = coalesce(nullif(trim(bairro_texto), ''), v_bairro.nome),
      bairro_id = null,
      updated_at = now()
  where bairro_id = v_bairro.id;
  get diagnostics v_afetadas = row_count;

  delete from entrega_bairros where id = v_bairro.id;

  return jsonb_build_object('ok', true, 'afetadas', v_afetadas,
    'mensagem', case
      when v_afetadas = 0 then format('%s saiu da lista.', v_bairro.nome)
      else format('%s saiu da lista. %s entrega(s) ficam com o nome e vão para o fim da rota.',
                  v_bairro.nome, v_afetadas)
    end);
end;
$function$;

revoke all on function public.entrega_bairro_remover(uuid) from public, anon;
grant execute on function public.entrega_bairro_remover(uuid) to authenticated;
