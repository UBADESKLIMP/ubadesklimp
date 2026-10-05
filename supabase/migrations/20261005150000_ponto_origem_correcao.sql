-- Correção de uma batida: a hora passa a aparecer certa no lugar da errada.
-- A linha antiga continua existindo por baixo, apontada pela nova.
--
-- Valor novo de enum vai sozinho na migration: o Postgres não deixa usá-lo na
-- mesma transação em que foi criado.
alter type public.ponto_origem add value if not exists 'correcao';
