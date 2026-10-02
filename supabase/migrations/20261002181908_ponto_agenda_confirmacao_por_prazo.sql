-- P24 só vale se alguém rodar: sem agendamento, a marcação pendente ficava
-- pendente pra sempre e o prazo de 48h era letra morta.
-- De hora em hora é suficiente — a regra é de 48h, não de minuto.
do $$
begin
  perform cron.unschedule('ponto_confirmar_por_prazo');
exception when others then
  null; -- ainda não existia
end $$;

select cron.schedule(
  'ponto_confirmar_por_prazo',
  '7 * * * *',
  $$select public.ponto_confirmar_por_prazo()$$
);
