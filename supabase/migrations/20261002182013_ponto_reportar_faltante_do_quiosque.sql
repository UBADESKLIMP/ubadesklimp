-- Etapa 3 (C): atalho "Reportar faltante" no quiosque (PRD 4.6 e P33).
--
-- Única mudança no módulo de Compras: uma coluna nova, nula, dizendo em que
-- estação o reporte foi feito. O resto do fluxo de faltantes continua igual.
alter table public.missing_products
  add column if not exists ponto_estacao_id uuid references public.ponto_estacoes(id);

comment on column public.missing_products.ponto_estacao_id is
  'Estação do quiosque onde o faltante foi reportado. Nulo quando veio pelo painel.';

-- Busca de produto sem sessão: o quiosque se identifica pelo token da estação.
create or replace function public.ponto_buscar_produto(
  p_estacao_token text,
  p_termo text
)
returns jsonb language plpgsql security definer stable set search_path = public, extensions as $$
declare
  v_ok boolean;
  v_res jsonb;
begin
  select exists (
    select 1 from ponto_estacoes e join ponto_locais l on l.id = e.local_id
    where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
      and e.revogada_em is null and l.ativo
  ) into v_ok;

  if not v_ok then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida');
  end if;

  if length(coalesce(trim(p_termo), '')) < 2 then
    return jsonb_build_object('ok', true, 'produtos', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res from (
    select p.id, p.name as nome, p.brand as marca
    from products p
    where p.name ilike '%' || trim(p_termo) || '%'
       or coalesce(p.brand, '') ilike '%' || trim(p_termo) || '%'
    order by p.name
    limit 20
  ) x;

  return jsonb_build_object('ok', true, 'produtos', v_res);
end;
$$;

-- O reporte sai com o nome de quem reportou (PIN confere), não da estação.
create or replace function public.ponto_reportar_faltante(
  p_funcionario_id uuid,
  p_pin text,
  p_estacao_token text,
  p_product_id uuid,
  p_stock_remaining int default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip inet := public.ponto_ip_origem();
  v_empresa uuid;
  v_nome text;
  v_estacao uuid;
  v_existente uuid;
  v_contagem int;
  v_produto text;
begin
  select sm.empresa_id, sm.display_name into v_empresa, v_nome
  from staff_members sm where sm.user_id = p_funcionario_id;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu cadastro ainda não está completo. Fale com o gestor.');
  end if;

  select e.id into v_estacao
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_estacao is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
  ) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, null, 'fora_da_rede');
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Conecte no Wi-Fi da loja.');
  end if;

  if not public.ponto_pin_confere(p_funcionario_id, p_pin) then
    perform public.ponto_registrar_tentativa(v_empresa, p_funcionario_id, null, null, 'pin_invalido');
    perform public.equipe_registrar_tentativa_login(p_funcionario_id, false);
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN incorreto.');
  end if;
  perform public.equipe_registrar_tentativa_login(p_funcionario_id, true);

  select name into v_produto from products where id = p_product_id;
  if v_produto is null then
    return jsonb_build_object('ok', false, 'motivo', 'produto_invalido',
      'mensagem', 'Produto não encontrado.');
  end if;

  -- Mesma regra do painel: já pendente, soma um reporte em vez de duplicar.
  select id, report_count into v_existente, v_contagem
  from missing_products
  where product_id = p_product_id and status = 'pendente'
    and fragrance_id is null and variation_id is null
  limit 1;

  if v_existente is not null then
    update missing_products
    set report_count = v_contagem + 1,
        stock_remaining = coalesce(p_stock_remaining, stock_remaining),
        ponto_estacao_id = coalesce(ponto_estacao_id, v_estacao),
        updated_at = now()
    where id = v_existente;

    return jsonb_build_object('ok', true, 'ja_existia', true, 'produto', v_produto,
      'reportes', v_contagem + 1,
      'mensagem', format('%s já estava na lista. Seu aviso foi somado.', v_produto));
  end if;

  insert into missing_products (
    product_id, stock_remaining, reported_by, reported_by_name, ponto_estacao_id
  ) values (
    p_product_id, p_stock_remaining, p_funcionario_id, v_nome, v_estacao
  );

  return jsonb_build_object('ok', true, 'ja_existia', false, 'produto', v_produto,
    'reportes', 1, 'mensagem', format('%s entrou na lista de faltantes.', v_produto));
end;
$$;
