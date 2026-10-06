-- A importação roda todo dia com o mesmo arquivo podendo repetir linhas de
-- ontem. Por isso ela é idempotente pelo documento: entrega que já existe só
-- tem os dados cadastrais atualizados, e entrega que já foi entregue não volta
-- para a fila de jeito nenhum — senão o entregador veria de novo algo que ele já
-- levou.
--
-- O bairro é casado sem acento e sem caixa, porque o ERP grava "TONINHAS" e o
-- cadastro diz "Toninhas". Bairro que não casar fica em bairro_texto e volta na
-- resposta, para o gestor cadastrar e a entrega não sumir da rota.

create or replace function public.entrega_importar_lote(
  p_empresa_id uuid,
  p_linhas jsonb
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  v_bairro_id uuid;
  v_bairro_txt text;
  v_existente public.entregas;
  v_criadas int := 0;
  v_atualizadas int := 0;
  v_ignoradas int := 0;
  v_novos text[] := '{}';
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin importa entregas.';
  end if;
  if p_empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  for r in select * from jsonb_array_elements(p_linhas) loop
    v_bairro_txt := nullif(trim(r->>'bairro'), '');
    v_bairro_id := null;

    if v_bairro_txt is not null then
      select b.id into v_bairro_id
      from entrega_bairros b
      where b.empresa_id = p_empresa_id and b.ativo
        and lower(public.unaccent(b.nome)) = lower(public.unaccent(v_bairro_txt))
      limit 1;

      if v_bairro_id is null and not (v_bairro_txt = any(v_novos)) then
        v_novos := v_novos || v_bairro_txt;
      end if;
    end if;

    select * into v_existente from entregas
    where empresa_id = p_empresa_id
      and documento_tipo = r->>'documento_tipo'
      and documento_numero = r->>'documento_numero';

    if found then
      -- entrega já resolvida não volta para a fila
      if v_existente.situacao in ('entregue', 'cancelada') then
        v_ignoradas := v_ignoradas + 1;
        continue;
      end if;

      update entregas set
        cliente_nome        = r->>'cliente_nome',
        cliente_telefone    = r->>'cliente_telefone',
        endereco_logradouro = r->>'endereco_logradouro',
        endereco_numero     = r->>'endereco_numero',
        bairro_id           = coalesce(v_bairro_id, bairro_id),
        bairro_texto        = coalesce(v_bairro_txt, bairro_texto),
        cidade              = r->>'cidade',
        cep                 = r->>'cep',
        entregar_em         = r->>'entregar_em',
        valor               = nullif(r->>'valor','')::numeric,
        itens               = coalesce(r->'itens', '[]'::jsonb),
        updated_at          = now()
      where id = v_existente.id;

      v_atualizadas := v_atualizadas + 1;
    else
      insert into entregas (
        empresa_id, documento_tipo, documento_numero, documento_data,
        cliente_codigo, cliente_nome, cliente_telefone,
        endereco_logradouro, endereco_numero, bairro_id, bairro_texto,
        cidade, cep, entregar_em, valor, itens, importada_por
      ) values (
        p_empresa_id, r->>'documento_tipo', r->>'documento_numero',
        nullif(r->>'documento_data','')::date,
        r->>'cliente_codigo', r->>'cliente_nome', r->>'cliente_telefone',
        r->>'endereco_logradouro', r->>'endereco_numero', v_bairro_id, v_bairro_txt,
        r->>'cidade', r->>'cep', r->>'entregar_em',
        nullif(r->>'valor','')::numeric, coalesce(r->'itens','[]'::jsonb), auth.uid()
      );
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'criadas', v_criadas,
    'atualizadas', v_atualizadas,
    'ignoradas', v_ignoradas,
    'bairros_novos', to_jsonb(v_novos)
  );
end;
$$;

grant execute on function public.entrega_importar_lote(uuid, jsonb) to authenticated;
