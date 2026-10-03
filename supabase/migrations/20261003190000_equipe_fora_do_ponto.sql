-- Nem todo mundo no painel bate ponto: o dono e quem só administra entram por
-- e-mail e senha e não têm PIN. Sem isso o painel ficava avisando pra sempre
-- que "2 pessoas não conseguem bater ponto" — um alarme que nunca apaga vira
-- paisagem, e aí o dia em que ele apontar alguém de verdade ninguém olha.
alter table public.staff_members
  add column if not exists fora_do_ponto boolean not null default false;

comment on column public.staff_members.fora_do_ponto is
  'Marcado para quem não bate ponto (dono, sócio). Tira a pessoa dos avisos de cadastro incompleto do módulo Ponto.';
