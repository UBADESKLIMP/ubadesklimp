-- Registrar a estação exigia entrar com a conta de admin no PC do balcão.
-- Isso é ruim por dois motivos: o botão fica escondido numa tela que o admin
-- não abre (ele administra do próprio computador), e deixa a senha de admin
-- circulando num micro que fica ligado o dia inteiro na frente da loja.
--
-- Agora o admin prepara o computador pelo painel e recebe um código curto. No
-- PC da loja, alguém digita o código em /ponto e ele vira estação — sem login
-- nenhum, e só de dentro da rede da loja.

create table public.ponto_estacao_convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  codigo_hash text not null,
  local_id uuid references public.ponto_locais(id) on delete set null,
  criado_por uuid references public.staff_members(user_id),
  expira_em timestamptz not null,
  usado_em timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ponto_estacao_convites_abertos
  on public.ponto_estacao_convites (empresa_id, expira_em)
  where usado_em is null;

alter table public.ponto_estacao_convites enable row level security;

-- Nunca se lê o hash pelo cliente: o painel só precisa saber que existe um
-- convite aberto e até quando ele vale.
create policy "Gestor/admin lê convites de estação"
  on public.ponto_estacao_convites for select to authenticated
  using (public.is_equipe_gestor_ou_admin());

create or replace function public.ponto_preparar_estacao(
  p_empresa_id uuid,
  p_nome text,
  p_local_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_codigo text;
  v_expira timestamptz := now() + interval '30 minutes';
begin
  if not public.is_equipe_admin() then
    raise exception 'Só admin prepara um computador.';
  end if;

  -- 6 dígitos: é pra alguém digitar num teclado de balcão, não pra guardar.
  -- A proteção real é o prazo curto, o uso único e a rede da loja.
  v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');

  -- Um convite aberto por vez evita código velho rodando por aí.
  update ponto_estacao_convites set usado_em = now()
  where empresa_id = p_empresa_id and usado_em is null and expira_em > now();

  insert into ponto_estacao_convites (empresa_id, nome, codigo_hash, local_id, criado_por, expira_em)
  values (p_empresa_id, p_nome, encode(digest(v_codigo, 'sha256'), 'hex'),
          p_local_id, auth.uid(), v_expira);

  return jsonb_build_object('ok', true, 'codigo', v_codigo, 'expira_em', v_expira, 'nome', p_nome);
end;
$$;

-- Chamada pelo próprio quiosque, sem sessão. As travas são: código certo,
-- dentro do prazo, ainda não usado, e de dentro da rede da loja.
create or replace function public.ponto_ativar_estacao(p_codigo text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_convite record;
  v_ip inet := public.ponto_ip_origem();
  v_local uuid;
  v_token text;
  v_id uuid;
begin
  select * into v_convite
  from ponto_estacao_convites
  where codigo_hash = encode(digest(coalesce(p_codigo, ''), 'sha256'), 'hex')
    and usado_em is null
    and expira_em > now();

  if v_convite is null then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido',
      'mensagem', 'Código errado ou vencido. Gere outro no painel.');
  end if;

  if v_ip is null or not exists (
    select 1 from ponto_redes
    where empresa_id = v_convite.empresa_id and ativo and ip = v_ip
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_rede',
      'mensagem', 'Este computador precisa estar no Wi-Fi da loja.');
  end if;

  v_local := v_convite.local_id;
  if v_local is null then
    select id into v_local from ponto_locais
    where empresa_id = v_convite.empresa_id and tipo = 'estacao' and ativo
    order by created_at limit 1;

    if v_local is null then
      insert into ponto_locais (empresa_id, nome, tipo)
      values (v_convite.empresa_id, 'Entrada', 'estacao') returning id into v_local;
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into ponto_estacoes (local_id, nome, device_token_hash, registrado_por, ultimo_ip, ultimo_heartbeat)
  values (v_local, v_convite.nome, encode(digest(v_token, 'sha256'), 'hex'),
          v_convite.criado_por, v_ip, now())
  returning id into v_id;

  update ponto_estacao_convites set usado_em = now() where id = v_convite.id;

  return jsonb_build_object('ok', true, 'estacao_id', v_id, 'nome', v_convite.nome,
    'local_id', v_local, 'token', v_token);
end;
$$;

-- O painel só precisa saber se há um convite aberto, e até quando.
create or replace function public.ponto_convite_aberto(p_empresa_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c record;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Sem acesso.';
  end if;

  select nome, expira_em into v_c from ponto_estacao_convites
  where empresa_id = p_empresa_id and usado_em is null and expira_em > now()
  order by created_at desc limit 1;

  if v_c is null then
    return jsonb_build_object('aberto', false);
  end if;
  return jsonb_build_object('aberto', true, 'nome', v_c.nome, 'expira_em', v_c.expira_em);
end;
$$;
