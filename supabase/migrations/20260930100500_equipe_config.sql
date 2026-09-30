create table public.equipe_config (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, chave)
);

alter table public.equipe_config enable row level security;

create policy "Gestor/admin lê config das empresas visíveis"
  on public.equipe_config for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

create policy "Só admin altera config"
  on public.equipe_config for all
  to authenticated
  using (public.is_equipe_admin())
  with check (public.is_equipe_admin());

create or replace function public.equipe_seed_config()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.equipe_config (empresa_id, chave, valor) values
    (new.id, 'escalonamento', jsonb_build_object('verbal_a_partir_de', 3, 'escrita_a_partir_de', 4)),
    (new.id, 'prazo_justificativa_horas', to_jsonb(48)),
    (new.id, 'prazo_imediatidade_dias_uteis', to_jsonb(5)),
    (new.id, 'prazo_ciencia_horas', to_jsonb(48));
  return new;
end;
$$;

create trigger trg_equipe_seed_config
  after insert on public.empresas
  for each row execute function public.equipe_seed_config();
