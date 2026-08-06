begin;

-- Bloqueia remover ou desmarcar is_admin do último administrador restante
-- em staff_members. Sem isso, o caminho de EDITAR um funcionário (ao
-- contrário do de excluir, que já tinha essa checagem na edge function)
-- não tinha nenhuma trava: desmarcar "é administrador" do último admin
-- zeraria staff_members, e como o cadastro público continua aberto e
-- promote_first_user_to_admin() ainda promove o primeiro novo cadastro a
-- admin automaticamente, isso abriria uma tomada de admin anônima pelo
-- próximo usuário a se cadastrar no site.
--
-- É um trigger BEFORE ... FOR EACH ROW porque tanto o client (via RLS)
-- quanto a edge function excluir-funcionario (via service_role, que
-- ignora RLS) passam pela tabela — só um trigger no banco cobre os dois
-- casos e serializa corretamente duas remoções concorrentes do "penúltimo"
-- admin (o padrão READ COMMITTED do Postgres bloqueia a segunda linha até
-- a primeira commitar).
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.is_admin)
     or (tg_op = 'UPDATE' and old.is_admin and not new.is_admin) then
    if (select count(*) from public.staff_members where is_admin) <= 1 then
      raise exception 'Não é possível remover o último administrador.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists staff_members_keep_one_admin on public.staff_members;

create trigger staff_members_keep_one_admin
  before update or delete on public.staff_members
  for each row
  execute function public.prevent_last_admin_removal();

commit;
