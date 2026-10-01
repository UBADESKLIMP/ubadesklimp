-- Quem estava esperando na porta quando a loja abriu atrasada.
--
-- Antes isso só existia como dois campos na linha do atraso (estava_na_porta,
-- hora_chegada_porta), preenchidos depois, de memória, ao lançar cada pessoa.
-- Só que a regra da porta é o que separa "30 min de atraso" de "atraso zero",
-- então esse fato merece ser registrado no momento em que é sabido — na
-- abertura — e antes de se saber quanto vai dar de atraso pra cada um.
--
-- A linha do atraso continua guardando o que foi efetivamente usado no
-- cálculo (o registro disciplinar tem que ser auto-contido); esta tabela é a
-- origem do dado e a prova de quando ele foi registrado.
create table public.equipe_abertura_presentes (
  empresa_id uuid not null,
  data date not null,
  colaborador_id uuid not null references public.staff_members(user_id) on delete cascade,
  hora_chegada_porta time,
  registrado_por uuid not null references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  primary key (empresa_id, data, colaborador_id),
  foreign key (empresa_id, data)
    references public.equipe_aberturas(empresa_id, data) on delete cascade
);

comment on table public.equipe_abertura_presentes is
  'Colaboradores que já estavam na porta no momento da abertura atrasada (R3). Registrado junto com a abertura, não no lançamento do atraso.';

alter table public.equipe_abertura_presentes enable row level security;

create trigger trg_audit_equipe_abertura_presentes
  after insert or update or delete on public.equipe_abertura_presentes
  for each row execute function public.equipe_trg_audit();

create policy "Colaborador vê que estava na porta"
  on public.equipe_abertura_presentes for select
  to authenticated
  using (colaborador_id = auth.uid());

create policy "Gestor/admin lê presentes das empresas visíveis"
  on public.equipe_abertura_presentes for select
  to authenticated
  using (empresa_id in (select equipe_empresas_visiveis()));

-- Substitui a lista do dia inteira. Chamar com lista vazia limpa.
create or replace function public.equipe_registrar_presentes_porta(
  p_empresa_id uuid,
  p_data date,
  p_presentes jsonb
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_linha jsonb;
  v_total int := 0;
begin
  if not (public.is_equipe_gestor_ou_admin() and p_empresa_id in (select equipe_empresas_visiveis())) then
    raise exception 'Só gestor ou admin registra quem estava na porta.';
  end if;

  if not exists (
    select 1 from equipe_aberturas where empresa_id = p_empresa_id and data = p_data
  ) then
    raise exception 'Registre primeiro a hora de abertura do dia %.', to_char(p_data, 'DD/MM');
  end if;

  delete from equipe_abertura_presentes
  where empresa_id = p_empresa_id and data = p_data;

  for v_linha in select * from jsonb_array_elements(coalesce(p_presentes, '[]'::jsonb))
  loop
    insert into equipe_abertura_presentes (
      empresa_id, data, colaborador_id, hora_chegada_porta, registrado_por
    ) values (
      p_empresa_id,
      p_data,
      (v_linha ->> 'colaborador_id')::uuid,
      nullif(v_linha ->> 'hora_chegada_porta', '')::time,
      auth.uid()
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;
