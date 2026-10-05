-- "Entre na sua conta para bater por aqui." foi lida como "entre na conta da
-- pessoa que vai bater" — e o aviso só aparecia depois de digitar o PIN, num
-- teclado que nunca ia funcionar. Dois defeitos no mesmo lugar: a frase e o
-- momento.
--
-- Agora o contexto da tela já responde se dá para usar: ou vem ok, ou vem o
-- motivo antes de qualquer PIN ser digitado. A permissão passa a ser checada
-- aqui também, e não só na hora de gravar.

create or replace function public.ponto_contexto_do_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_ip inet := public.ponto_ip_origem();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao',
      'mensagem', 'Esta tela usa o seu login de gestor. Entre no painel e abra de novo.');
  end if;

  -- Quem pode usar a tela. Antes isto era conferido só na gravação, então o
  -- funcionário comum via o teclado, digitava e tomava uma recusa.
  if not (public.is_equipe_gestor_ou_admin()
          or public.ponto_tem_permissao(v_user, 'bater_pelo_painel')) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao',
      'mensagem', 'Seu ponto é no computador da loja.');
  end if;

  select empresa_id into v_empresa from staff_members where user_id = v_user;

  -- Admin sem empresa própria ainda precisa conseguir abrir a tela: cai na
  -- única empresa cadastrada.
  if v_empresa is null and public.is_equipe_admin() then
    select id into v_empresa from empresas where ativo order by created_at limit 1;
  end if;

  if v_empresa is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_empresa',
      'mensagem', 'Seu cadastro não está vinculado a uma empresa.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'empresa_id', v_empresa,
    'local', (select razao_social from empresas where id = v_empresa),
    'rede_ok', v_ip is not null and exists (
      select 1 from ponto_redes where empresa_id = v_empresa and ativo and ip = v_ip
    )
  );
end;
$$;

-- A mesma frase na gravação, para o caso da sessão cair com a tela aberta.
do $PATCH$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'ponto_registrar_pelo_painel';

  v_novo := replace(v_def,
    '''mensagem'', ''Entre na sua conta para bater por aqui.''',
    '''mensagem'', ''Seu login de gestor expirou. Entre no painel de novo.''');

  if v_novo = v_def then
    raise exception 'Não encontrei a frase antiga em ponto_registrar_pelo_painel.';
  end if;

  execute v_novo;
end;
$PATCH$;
