create table public.equipe_audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id text not null,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.equipe_audit_log enable row level security;

create policy "Só admin lê audit log"
  on public.equipe_audit_log for select
  to authenticated
  using (public.is_equipe_admin());

create or replace function public.equipe_trg_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_id text;
begin
  v_id := coalesce(
    (case when TG_OP = 'DELETE' then old.id else new.id end)::text,
    'sem_pk'
  );
  insert into public.equipe_audit_log (tabela, registro_id, acao, dados_antes, dados_depois, user_id)
  values (
    TG_TABLE_NAME,
    v_id,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_equipe_atrasos
  after insert or update or delete on public.equipe_atrasos
  for each row execute function public.equipe_trg_audit();

create trigger trg_audit_equipe_aberturas
  after insert or update or delete on public.equipe_aberturas
  for each row execute function public.equipe_trg_audit();

create trigger trg_audit_equipe_config
  after insert or update or delete on public.equipe_config
  for each row execute function public.equipe_trg_audit();
