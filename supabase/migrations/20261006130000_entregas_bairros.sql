-- A rota de Ubatuba é uma linha: quase tudo pendurado na Rio-Santos. Por isso a
-- ordem geográfica do bairro já é, na prática, a ordem da rota — e inverter a
-- lista é a operação que o dono mais usa (na temporada o sul entope, e convém
-- bater no extremo primeiro e voltar fazendo).
--
-- `ordem` é int com espaço entre os valores (10, 20, 30...) para caber bairro
-- novo no meio sem renumerar tudo.

create type public.entrega_situacao as enum
  ('na_fila', 'em_rota', 'entregue', 'nao_entregue', 'cancelada');

create type public.entrega_evento_tipo as enum ('entregue', 'nao_entregue');

create type public.entrega_motivo as enum
  ('fechado', 'ninguem_atendeu', 'endereco_errado', 'cliente_recusou',
   'nao_coube', 'outro');

create table public.entrega_bairros (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null,
  ordem      int  not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create index entrega_bairros_ordem on public.entrega_bairros (empresa_id, ordem);

alter table public.entrega_bairros enable row level security;

create policy "le_bairros" on public.entrega_bairros
  for select using (empresa_id in (select equipe_empresas_visiveis()));

create policy "gestor_escreve_bairros" on public.entrega_bairros
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());

-- Ordem do extremo norte ao extremo sul. ESTA LISTA PRECISA DA REVISÃO DO DONO
-- antes de entrar em uso: se um bairro estiver na posição errada, a rota sai
-- errada todos os dias e ninguém percebe de imediato.
insert into public.entrega_bairros (empresa_id, nome, ordem)
select e.id, b.nome, b.ordem
from public.empresas e
cross join (values
  ('Picinguaba', 10), ('Camburi', 20), ('Ubatumirim', 30), ('Almada', 40),
  ('Engenho', 50), ('Puruba', 60), ('Prumirim', 70), ('Itamambuca', 80),
  ('Vermelha do Norte', 90), ('Felix', 100), ('Santa Rita', 110),
  ('Ipiranguinha', 120), ('Horto Florestal', 130), ('Perequê-Açu', 140),
  ('Centro', 150), ('Itaguá', 160), ('Toninhas', 170), ('Praia Grande', 180),
  ('Tenório', 190), ('Enseada', 200), ('Flamengo', 210), ('Lázaro', 220),
  ('Domingas Dias', 230), ('Sapê', 240), ('Maranduba', 250),
  ('Sertão da Quina', 260), ('Oliveira', 270), ('Pulso', 280),
  ('Lagoinha', 290), ('Bonete', 300)
) as b(nome, ordem)
where e.ativo;
