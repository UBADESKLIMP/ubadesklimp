-- Papéis/permissões de equipe, construídos do zero (independente do projeto Compras).
-- staff_members: quem é da equipe e se é admin (admin sempre tem acesso total).
-- staff_permissions: permissões extras por seção, só relevantes pra quem não é admin.
--
-- Migration inteira roda numa transação: se qualquer passo falhar (ex.: DROP
-- POLICY em storage.objects, que pertence a outro owner), tudo desfaz — nunca
-- fica um estado pela metade com política antiga derrubada e nova ausente.
begin;

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.staff_permission as enum ('faltantes', 'produtos', 'fornecedores', 'financeiro');

create table public.staff_permissions (
  user_id uuid not null references public.staff_members(user_id) on delete cascade,
  permission public.staff_permission not null,
  primary key (user_id, permission)
);

alter table public.staff_members enable row level security;
alter table public.staff_permissions enable row level security;

-- SECURITY DEFINER: evita recursão de RLS ao consultar staff_members de dentro
-- de policies de outras tabelas (mesmo padrão que has_role() já usa no projeto).
create or replace function public.is_staff_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from public.staff_members where user_id = auth.uid()), false)
$$;

create or replace function public.has_staff_permission(perm public.staff_permission)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    public.is_staff_admin()
    or exists (
      select 1 from public.staff_permissions
      where user_id = auth.uid() and permission = perm
    )
$$;

-- staff_members: só admin gerencia; qualquer membro autenticado lê a própria linha
-- (o hook useStaffAccess do cliente precisa disso pra saber o que o usuário pode ver).
create policy "Admins podem gerenciar staff_members"
  on public.staff_members for all
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

create policy "Usuário vê a própria linha de staff_members"
  on public.staff_members for select
  using (auth.uid() = user_id);

create policy "Admins podem gerenciar staff_permissions"
  on public.staff_permissions for all
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

create policy "Usuário vê as próprias permissões"
  on public.staff_permissions for select
  using (auth.uid() = user_id);

-- E-mail automático em profiles no cadastro (hoje só é preenchido se o cliente
-- mexer na própria tela de Perfil — sem isso não dá pra buscar funcionário por
-- e-mail de forma confiável na tela de Funcionários).
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Gatilho de bootstrap existente (promove o primeiro usuário a admin) passa a
-- escrever em staff_members em vez de user_roles.
create or replace function public.promote_first_user_to_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_members where is_admin = true) then
    insert into public.staff_members (user_id, is_admin, display_name)
    values (new.id, true, coalesce(new.email, 'admin'));
  end if;
  return new;
end;
$$;

-- Migra o(s) admin(s) atual(is) de user_roles pra staff_members.
insert into public.staff_members (user_id, is_admin, display_name)
select ur.user_id, true, coalesce(p.email, 'admin')
from public.user_roles ur
left join public.profiles p on p.user_id = ur.user_id
where ur.role = 'admin'
on conflict (user_id) do nothing;

-- Trava de segurança: se nenhum admin migrou (ex.: user_roles não tinha
-- 'admin' por algum motivo), aborta a transação inteira em vez de deixar
-- staff_members vazia — o que travaria todo mundo pra fora das telas
-- administrativas e faria o próximo cadastro público virar admin sozinho
-- (via promote_first_user_to_admin).
do $$
begin
  if not exists (select 1 from public.staff_members where is_admin) then
    raise exception 'Nenhum admin migrado para staff_members — abortando migration';
  end if;
end $$;

-- Troca has_role(uid,'admin') por is_staff_admin()/has_staff_permission(...)
-- nas policies que existem hoje. Nomes de policy mantidos onde possível.

drop policy "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories
  for all using (public.has_staff_permission('produtos'));

drop policy "Admins can manage product variations" on public.product_variations;
create policy "Admins can manage product variations" on public.product_variations
  for all using (public.has_staff_permission('produtos'));

drop policy "Admins can manage product_fragrances" on public.product_fragrances;
create policy "Admins can manage product_fragrances" on public.product_fragrances
  for all using (public.has_staff_permission('produtos'));

drop policy "Apenas admins autenticados podem gerenciar produtos" on public.products;
create policy "Apenas admins autenticados podem gerenciar produtos" on public.products
  for all
  using (public.has_staff_permission('produtos'))
  with check (public.has_staff_permission('produtos'));

drop policy "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders
  for all using (public.has_staff_permission('financeiro'));

drop policy "Guest orders are only visible to admins" on public.orders;
create policy "Guest orders are only visible to admins" on public.orders
  for select using (user_id is null and public.has_staff_permission('financeiro'));

-- profiles fica admin-only (dado de cliente/PII, não faz parte das 4 permissões
-- de seção) — decisão explícita, não uma omissão.
drop policy "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles" on public.profiles
  for all using (public.is_staff_admin());

drop policy "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (auth.uid() = user_id or public.is_staff_admin());

drop policy "Admins podem fazer upload de imagens de produtos" on storage.objects;
create policy "Admins podem fazer upload de imagens de produtos" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.has_staff_permission('produtos'));

drop policy "Admins podem atualizar imagens de produtos" on storage.objects;
create policy "Admins podem atualizar imagens de produtos" on storage.objects
  for update using (bucket_id = 'product-images' and public.has_staff_permission('produtos'));

drop policy "Admins podem deletar imagens de produtos" on storage.objects;
create policy "Admins podem deletar imagens de produtos" on storage.objects
  for delete using (bucket_id = 'product-images' and public.has_staff_permission('produtos'));

commit;
