create or replace function public.equipe_checar_login(p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(bloqueado_em is null, true) from staff_members where user_id = p_user_id
$$;

create or replace function public.equipe_registrar_tentativa_login(p_user_id uuid, p_sucesso boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_sucesso then
    update staff_members set tentativas_login = 0 where user_id = p_user_id;
  else
    update staff_members
    set tentativas_login = tentativas_login + 1,
        bloqueado_em = case when tentativas_login + 1 >= 5 then now() else bloqueado_em end
    where user_id = p_user_id;
  end if;
end;
$$;
