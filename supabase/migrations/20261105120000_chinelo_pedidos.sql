-- Pedidos de chinelo Havaianas anotados no quiosque.
--
-- O cliente quer um número e uma cor que não estão na loja; o funcionário anota
-- na hora (nome, telefone para avisar, número, cor) em vez de papel. O escritório
-- vê tudo em "Chinelos", imprime o relatório para encomendar e avisa o cliente
-- quando o chinelo chegar.

create table public.chinelo_pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_nome text not null check (char_length(btrim(cliente_nome)) between 2 and 80),
  cliente_telefone text not null check (char_length(regexp_replace(cliente_telefone, '\D', '', 'g')) >= 8),
  numero text not null check (char_length(btrim(numero)) between 1 and 30),
  cor text not null check (char_length(btrim(cor)) between 1 and 40),
  observacao text check (observacao is null or char_length(observacao) <= 200),
  status text not null default 'pendente'
    check (status in ('pendente', 'encomendado', 'chegou', 'entregue', 'cancelado')),
  anotado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chinelo_pedidos_empresa_status_idx
  on public.chinelo_pedidos (empresa_id, status, created_at desc);

alter table public.chinelo_pedidos enable row level security;

-- Quem cuida de compras (permissão 'faltantes') lê e atualiza os pedidos.
-- Ninguém insere direto: o funcionário anota pelo quiosque (função abaixo, que
-- confere o PIN e o computador registrado).
create policy "Compras lê pedidos de chinelo"
  on public.chinelo_pedidos for select
  using (public.has_staff_permission('faltantes'));

create policy "Compras atualiza pedidos de chinelo"
  on public.chinelo_pedidos for update
  using (public.has_staff_permission('faltantes'))
  with check (public.has_staff_permission('faltantes'));

create policy "Compras apaga pedidos de chinelo"
  on public.chinelo_pedidos for delete
  using (public.has_staff_permission('faltantes'));

create or replace function public.chinelo_pedidos_toca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger chinelo_pedidos_updated_at
  before update on public.chinelo_pedidos
  for each row execute function public.chinelo_pedidos_toca_updated_at();

-- Anotar pelo quiosque: confere o computador, descobre quem é pelo PIN e grava.
-- Um toque duplo no botão (mesmo pedido em 2 minutos) não vira dois pedidos.
create or replace function public.ponto_anotar_chinelo(
  p_pin text,
  p_estacao_token text,
  p_nome text,
  p_telefone text,
  p_numero text,
  p_cor text,
  p_observacao text default null
) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa uuid;
  v_func uuid;
  v_amb boolean;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_fone text := btrim(coalesce(p_telefone, ''));
  v_numero text := btrim(coalesce(p_numero, ''));
  v_cor text := btrim(coalesce(p_cor, ''));
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_existente uuid;
  v_id uuid;
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
    return jsonb_build_object('ok', false, 'motivo', 'pin_invalido', 'mensagem', 'PIN não encontrado.');
  end if;

  if char_length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'mensagem', 'Escreva o nome de quem pediu.');
  end if;
  if char_length(regexp_replace(v_fone, '\D', '', 'g')) < 8 then
    return jsonb_build_object('ok', false, 'mensagem', 'Confira o telefone: precisa ter pelo menos 8 números.');
  end if;
  if v_numero = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha o número do chinelo.');
  end if;
  if v_cor = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Escolha a cor.');
  end if;

  select id into v_existente from chinelo_pedidos
  where empresa_id = v_empresa
    and lower(cliente_nome) = lower(v_nome)
    and regexp_replace(cliente_telefone, '\D', '', 'g') = regexp_replace(v_fone, '\D', '', 'g')
    and lower(numero) = lower(v_numero) and lower(cor) = lower(v_cor)
    and created_at > now() - interval '2 minutes'
  limit 1;

  if v_existente is not null then
    return jsonb_build_object('ok', true, 'id', v_existente, 'ja_existia', true,
      'mensagem', 'Esse pedido já tinha sido anotado agora há pouco.');
  end if;

  insert into chinelo_pedidos (empresa_id, cliente_nome, cliente_telefone, numero, cor, observacao, anotado_por)
  values (v_empresa, left(v_nome, 80), left(v_fone, 30), left(v_numero, 30), left(v_cor, 40), left(v_obs, 200), v_func)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'ja_existia', false,
    'mensagem', format('Pedido de %s anotado: nº %s, %s.', v_nome, v_numero, v_cor));
end;
$function$;

revoke all on function public.ponto_anotar_chinelo(text, text, text, text, text, text, text) from public;
grant execute on function public.ponto_anotar_chinelo(text, text, text, text, text, text, text) to anon, authenticated;
