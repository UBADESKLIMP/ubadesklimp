alter table public.staff_members
  add column empresa_id uuid references public.empresas(id),
  add column escala_id uuid references public.equipe_escalas(id),
  add column almoco_previsto time,
  add column duracao_almoco_min int not null default 120,
  add column termo_adesao_path text,
  add column termo_assinado_em date,
  add column tentativas_login int not null default 0,
  add column bloqueado_em timestamptz;

comment on column public.staff_members.termo_adesao_path is
  'Caminho no bucket privado equipe-docs. Visível só pra admin — ver equipe_funcionarios_gestor.';
comment on column public.staff_members.duracao_almoco_min is
  'Duração padrão do almoço em minutos, usada pelo cálculo de atraso do retorno (equipe_trg_calcular_atraso).';
