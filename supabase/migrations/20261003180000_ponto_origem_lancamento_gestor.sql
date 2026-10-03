-- PRD R7: quando o sistema cai (ou alguém esquece), o gestor lança a marcação
-- no lugar da pessoa. Isso precisa existir, mas não pode se passar por batida
-- de verdade — senão o registro inteiro deixa de servir como prova da jornada.
--
-- Valor novo de enum vai sozinho na migration: o Postgres não deixa usá-lo na
-- mesma transação em que foi criado.
alter type public.ponto_origem add value if not exists 'lancamento_gestor';
