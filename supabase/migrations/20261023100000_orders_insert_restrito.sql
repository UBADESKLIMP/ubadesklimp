-- Pedido do carrinho: a policy de INSERT aceitava qualquer coisa (WITH CHECK true).
-- Agora o pedido só entra pendente, em nome de quem está logado (ou anônimo),
-- com itens em lista e valor não negativo.
drop policy if exists "Anyone can create orders" on public.orders;

create policy "Carrinho cria pedido pendente"
  on public.orders for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and coalesce(status, 'pending') = 'pending'
    and jsonb_typeof(items) = 'array'
    and total_amount >= 0
  );
