-- "Checar ponto" no quiosque: a pessoa digita o PIN e vê as batidas dela de hoje.
-- Evita a batida repetida por medo de não ter registrado. Só leitura, só o
-- próprio dia, só as batidas vigentes (a corrigida some e fica a que a substituiu).
-- PIN errado entra no mesmo registro de tentativas das outras telas do quiosque.
create or replace function public.ponto_minhas_marcacoes_por_pin(
  p_pin text, p_estacao_token text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
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

  select display_name into v_nome from staff_members where user_id = v_func;

  return jsonb_build_object(
    'ok', true,
    'nome', v_nome,
    'dia', v_hoje,
    'marcacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', m.tipo::text,
        'hora', to_char(m.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
        'origem', m.origem::text
      ) order by m.registrado_em)
      from ponto_marcacoes m
      where m.empresa_id = v_empresa
        and m.funcionario_id = v_func
        and m.substituida_por is null
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.ponto_minhas_marcacoes_por_pin(text, text) from public;
grant execute on function public.ponto_minhas_marcacoes_por_pin(text, text) to anon, authenticated;
