-- Correções dos achados "baixos" da auditoria de segurança de 2026-10-22.
--
-- 1) Justificativa de ponto: o atraso citado e o colaborador precisam ser da
--    mesma pessoa, e quem está logado (e não é gestor) só age em nome de si.
-- 2) Faltantes: quem só tem a permissão "faltantes" (Operacional) não mexe em
--    campos de pedido, resolução ou cancelamento, nem cria linha já resolvida.
-- 3) Produtos: visitante e cliente logado só enxergam produto público; produto
--    não público fica para a equipe.

-- ---------------------------------------------------------------------------
-- 1) equipe_justificativas_ponto
-- ---------------------------------------------------------------------------
create or replace function public.equipe_trg_justificativa_identidade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Só valida quando a linha nasce ou quando esses dois campos mudam, para não
  -- travar atualizações de status em linhas antigas.
  if tg_op = 'UPDATE'
     and new.atraso_id is not distinct from old.atraso_id
     and new.colaborador_id is not distinct from old.colaborador_id then
    return new;
  end if;

  -- Quem está logado e não é gestor/admin só age em nome de si mesmo. Chamadas
  -- sem sessão (PIN do quiosque, migrações) não têm auth.uid().
  if auth.uid() is not null
     and not public.is_equipe_gestor_ou_admin()
     and new.colaborador_id is distinct from auth.uid() then
    raise exception 'Você só pode lançar justificativa em seu próprio nome.'
      using errcode = '42501';
  end if;

  -- O atraso citado tem que ser do próprio colaborador da justificativa.
  if new.atraso_id is not null and not exists (
    select 1 from public.equipe_atrasos a
    where a.id = new.atraso_id and a.colaborador_id = new.colaborador_id
  ) then
    raise exception 'Esse atraso não pertence a este colaborador.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.equipe_trg_justificativa_identidade() from public, anon, authenticated;

drop trigger if exists trg_equipe_just_ponto_identidade on public.equipe_justificativas_ponto;
create trigger trg_equipe_just_ponto_identidade
  before insert or update on public.equipe_justificativas_ponto
  for each row execute function public.equipe_trg_justificativa_identidade();

-- ---------------------------------------------------------------------------
-- 2) missing_products
-- ---------------------------------------------------------------------------
-- Comprador = admin ou quem tem "fornecedores" (mesma regra da policy que
-- resolve faltante). Operacional = só "faltantes".
create or replace function public.missing_products_guarda_operacional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null
     or public.is_staff_admin()
     or public.has_staff_permission('fornecedores'::public.staff_permission) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pendente'
       or new.resolved_by is not null or new.resolved_at is not null
       or new.cancelled_by is not null or new.cancelled_at is not null
       or new.order_sent_at is not null or new.order_sent_by is not null
       or new.order_supplier_name is not null or new.order_quantity is not null then
      raise exception 'Operacional só registra faltante pendente.' using errcode = '42501';
    end if;
  else
    if new.status is distinct from old.status
       or new.resolved_by is distinct from old.resolved_by
       or new.resolved_at is distinct from old.resolved_at
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancelled_at is distinct from old.cancelled_at
       or new.order_sent_at is distinct from old.order_sent_at
       or new.order_sent_by is distinct from old.order_sent_by
       or new.order_supplier_name is distinct from old.order_supplier_name
       or new.order_quantity is distinct from old.order_quantity then
      raise exception 'Operacional não altera pedido, resolução ou cancelamento.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.missing_products_guarda_operacional() from public, anon, authenticated;

drop trigger if exists trg_missing_products_guarda_operacional on public.missing_products;
create trigger trg_missing_products_guarda_operacional
  before insert or update on public.missing_products
  for each row execute function public.missing_products_guarda_operacional();

-- ---------------------------------------------------------------------------
-- 3) products: linhas não públicas só para a equipe
-- ---------------------------------------------------------------------------
create or replace function public.is_staff_member()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid())
$$;

grant execute on function public.is_staff_member() to anon, authenticated;

drop policy if exists "Produtos são visíveis para todos" on public.products;
create policy "Produtos públicos para todos, todos para a equipe"
  on public.products for select
  using (is_public or public.is_staff_member());
