-- Fecha o baixo 1 da auditoria: os dados internos de compra já vivem em
-- product_purchase_info (só a equipe lê). As colunas antigas em products eram
-- legíveis por qualquer visitante pela API, então saem.
-- Conferido antes: 60 linhas na tabela nova, nenhuma divergente das colunas
-- antigas, nenhuma função ou view usando as colunas.
alter table public.products
  drop column if exists purchase_min_quantity,
  drop column if exists purchase_max_quantity,
  drop column if exists purchase_notes;
