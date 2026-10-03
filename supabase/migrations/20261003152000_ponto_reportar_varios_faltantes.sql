-- No balcão quase nunca falta um produto só: quem vai ao estoque volta com
-- três ou quatro. Pedir PIN a cada item fazia a pessoa desistir no segundo.
-- Agora o PIN vem uma vez e a lista vai junto.
create or replace function public.ponto_reportar_faltantes_por_pin(
  p_pin text,
  p_estacao_token text,
  p_produtos uuid[]
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_produto uuid;
  v_res jsonb;
  v_novos int := 0;
  v_somados int := 0;
  v_falhou int := 0;
begin
  select l.empresa_id into v_empresa
  from ponto_estacoes e join ponto_locais l on l.id = e.local_id
  where e.device_token_hash = encode(digest(p_estacao_token, 'sha256'), 'hex')
    and e.revogada_em is null and l.ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'estacao_invalida',
      'mensagem', 'Este computador não está registrado como estação.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, null, 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  if coalesce(array_length(p_produtos, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'lista_vazia',
      'mensagem', 'Nenhum produto na lista.');
  end if;

  -- Um item ruim não derruba a lista inteira: a pessoa já está de saída.
  foreach v_produto in array p_produtos loop
    v_res := public.ponto_reportar_faltante(v_func, p_pin, p_estacao_token, v_produto, null);
    if (v_res ->> 'ok')::boolean then
      if (v_res ->> 'ja_existia')::boolean then
        v_somados := v_somados + 1;
      else
        v_novos := v_novos + 1;
      end if;
    else
      v_falhou := v_falhou + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', v_novos + v_somados > 0,
    'novos', v_novos, 'somados', v_somados, 'falhou', v_falhou,
    'total', v_novos + v_somados,
    'mensagem', case
      when v_novos + v_somados = 0 then 'Não conseguimos registrar agora. Tente de novo.'
      when v_somados = 0 then 'Tudo entrou na lista de compras.'
      when v_novos = 0 then 'Já estavam na lista — seus avisos foram somados.'
      else format('%s novo(s) e %s que já estavam na lista.', v_novos, v_somados)
    end);
end;
$$;
