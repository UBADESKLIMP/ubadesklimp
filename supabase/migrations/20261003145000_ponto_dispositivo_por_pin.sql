-- A tela do QR segue a mesma regra do balcão: o PIN diz quem é. Sem isso ela
-- continuaria mostrando a lista com o nome de todo mundo da loja, num papel
-- colado na parede que qualquer um escaneia.
create or replace function public.ponto_dispositivo_por_pin(
  p_pin text,
  p_qr_token text,
  p_device_id text,
  p_apelido text default null,
  p_registrar boolean default false
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text;
  v_status public.ponto_dispositivo_status;
  v_res jsonb;
begin
  select empresa_id into v_empresa from ponto_locais
  where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
    and tipo = 'qr' and ativo;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'token_qr_invalido',
      'mensagem', 'Este QR não vale mais. Peça o novo pro gestor.');
  end if;

  select funcionario_id, ambiguo into v_func, v_amb
  from public.ponto_quem_tem_o_pin(v_empresa, p_pin);

  if v_func is null or v_amb then
    perform public.ponto_registrar_tentativa(v_empresa, null, null, null, 'pin_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido',
      'mensagem', 'PIN não encontrado.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_func;

  if p_registrar then
    v_res := public.ponto_registrar_dispositivo(v_func, p_pin, p_device_id, p_apelido);
    return v_res || jsonb_build_object('nome', v_nome);
  end if;

  select status into v_status from ponto_dispositivos
  where funcionario_id = v_func
    and device_id_hash = encode(digest(coalesce(p_device_id, ''), 'sha256'), 'hex');

  return jsonb_build_object('ok', true, 'nome', v_nome,
    'status', coalesce(v_status::text, 'novo'));
end;
$$;
