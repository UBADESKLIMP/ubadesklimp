-- PRD R4: "Retorno do café passa pela tolerância de 5 min; passou disso, vira
-- atraso de retorno na Parte 1." Para isso a Parte 1 precisa conhecer o tipo.
--
-- Migration só com o ALTER TYPE de propósito: em Postgres, um valor novo de
-- enum não pode ser usado na mesma transação em que foi criado.
alter type public.equipe_marcacao add value if not exists 'retorno_pausa';
