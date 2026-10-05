-- Bater ponto pelo painel, sem estação física. Nasce como origem própria
-- porque é exatamente o que diferencia essa batida das outras: ela não
-- aconteceu num ponto físico registrado, então não carrega a prova de "estava
-- na loja". O IP continua gravado.
--
-- Valor novo de enum vai sozinho na migration: o Postgres não deixa usá-lo na
-- mesma transação em que foi criado.
alter type public.ponto_origem add value if not exists 'painel';
