-- O que este registro prova, e o que ele não prova — está escrito aqui porque é
-- a coisa mais fácil de vender errado neste módulo:
--
--   registrado_em  vem de now() no servidor. Não dá para antedatar.
--   ip             vem de ponto_ip_origem(), lido do cabeçalho da borda. Diz se
--                  a marcação saiu do 4G na rua ou do Wi-Fi da loja — e essa é a
--                  diferença que interessa.
--   lat/lng        vêm do GPS do aparelho. Coordenada só existe no celular, então
--                  é DECLARADA, não provada: quem instalar um falsificador de GPS
--                  engana. Serve contra descuido e desonestidade casual, não
--                  contra alguém determinado.
--
-- Append-only: corrigir é gravar outro evento, nunca apagar. Um histórico que
-- pode ser reescrito não serve para conferir ninguém.

create table public.entrega_eventos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  entrega_id     uuid not null references public.entregas(id) on delete cascade,
  rota_id        uuid references public.entrega_rotas(id),

  tipo           public.entrega_evento_tipo not null,
  motivo         public.entrega_motivo,
  motivo_texto   text,
  quem_recebeu   text,

  funcionario_id uuid not null,
  registrado_em  timestamptz not null default now(),

  lat            numeric(10,7),
  lng            numeric(10,7),
  precisao_m     numeric(8,2),

  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now(),

  constraint entrega_evento_motivo_quando_nao_entregue
    check (tipo = 'entregue' or motivo is not null)
);

create index entrega_eventos_por_entrega on public.entrega_eventos (entrega_id, registrado_em);

comment on table public.entrega_eventos is
  'Append-only. Prova quando e de que rede; apenas afirma onde.';

create or replace function public.entrega_trg_eventos_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'O registro de entrega não pode ser alterado nem apagado. Para corrigir, registre de novo.';
end;
$$;

create trigger trg_entrega_eventos_append_only
  before update or delete on public.entrega_eventos
  for each row execute function public.entrega_trg_eventos_append_only();

alter table public.entrega_eventos enable row level security;

create policy "le_eventos" on public.entrega_eventos
  for select using (empresa_id in (select equipe_empresas_visiveis()));
-- Sem policy de insert: só a função entrega_registrar (SECURITY DEFINER) grava.
