-- Permissão "entregas": deixa um funcionário (que não é gestor da equipe)
-- montar a rota e importar pedidos. O valor novo do enum só pode ser usado em
-- outra transação, por isso o uso fica na migration seguinte.
alter type public.staff_permission add value if not exists 'entregas';
