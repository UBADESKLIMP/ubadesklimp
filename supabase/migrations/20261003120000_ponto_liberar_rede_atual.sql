-- Furo encontrado em uso real: a lista de redes permitidas só era preenchida
-- pelo heartbeat da estação. Quem criasse um ponto de QR antes de registrar um
-- PC ficava com um QR que nunca funciona — todo mundo recebendo "Conecte no
-- Wi-Fi da loja" sem ter o que fazer a respeito, porque não existia nenhum
-- jeito de cadastrar o IP da loja pelo painel.
--
-- O front não pode descobrir o próprio IP público (e se pudesse, aceitar um IP
-- enviado pelo cliente seria justamente o buraco que o módulo inteiro existe
-- pra fechar). Então quem lê o IP é o servidor, como em toda batida.
create or replace function public.ponto_liberar_rede_atual(p_empresa_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ip inet := public.ponto_ip_origem();
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin libera uma rede.';
  end if;

  if v_ip is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_ip',
      'mensagem', 'Não conseguimos identificar a conexão deste aparelho.');
  end if;

  insert into ponto_redes (empresa_id, ip, origem, visto_em, ativo)
  values (p_empresa_id, v_ip, 'manual', now(), true)
  on conflict (empresa_id, ip) do update
    set ativo = true, visto_em = now();

  return jsonb_build_object('ok', true, 'ip', host(v_ip));
end;
$$;

comment on function public.ponto_liberar_rede_atual(uuid) is
  'Cadastra o IP de quem está chamando como rede da loja. Serve para o admin destravar o ponto de dentro da loja antes de existir estação.';
