-- Uma entrega é um pedido do ERP que já foi impresso e ainda não chegou ao
-- cliente. A chave natural é o documento (tipo + número), e é ela que faz subir
-- o mesmo Excel duas vezes não duplicar nada.
--
-- O endereço vem de dois lugares diferentes porque o ERP é assim: cliente
-- cadastrado tem rua/bairro/CEP estruturados; venda avulsa de WhatsApp traz o
-- endereço em texto livre no campo "Entregar em". Guardamos os dois e deixamos
-- a tela decidir qual mostrar.

create table public.entregas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,

  documento_tipo     text not null,
  documento_numero   text not null,
  documento_data     date,

  cliente_codigo     text,
  cliente_nome       text not null,
  cliente_telefone   text,

  endereco_logradouro text,
  endereco_numero     text,
  bairro_id           uuid references public.entrega_bairros(id),
  bairro_texto        text,
  cidade              text,
  cep                 text,
  entregar_em         text,

  valor              numeric(12,2),
  itens              jsonb not null default '[]'::jsonb,

  situacao           public.entrega_situacao not null default 'na_fila',
  tentativas         int not null default 0,

  importada_em       timestamptz not null default now(),
  importada_por      uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (empresa_id, documento_tipo, documento_numero)
);

create index entregas_fila    on public.entregas (empresa_id, situacao);
create index entregas_bairro  on public.entregas (bairro_id);

comment on column public.entregas.bairro_texto is
  'Bairro como veio do ERP, mesmo quando não casou com entrega_bairros. Guardar o
   texto cru permite descobrir bairro novo sem perder a entrega.';

alter table public.entregas enable row level security;

create policy "le_entregas" on public.entregas
  for select using (empresa_id in (select equipe_empresas_visiveis()));

create policy "gestor_escreve_entregas" on public.entregas
  for all using (public.is_equipe_gestor_ou_admin())
  with check (public.is_equipe_gestor_ou_admin());
