begin;

-- A aba "Fornecedor exclusivo" precisa mostrar o nome/contato/telefone do
-- fornecedor pra qualquer staff com 'faltantes' (inclusive Operacional, que
-- não tem 'fornecedores') — sem essa policy, o embed suppliers(...) usado
-- por useExclusiveBrands resolve null sob RLS pra esse papel, e a tela
-- mostra "Fornecedor removido" mesmo com o fornecedor existindo. Isso é só
-- leitura de dados de cadastro (nome/telefone/e-mail/observações) — preço e
-- financeiro continuam fora do alcance de quem só tem 'faltantes' (vivem em
-- quote_line_items/orders, não em suppliers).
create policy "Staff com permissão faltantes vê fornecedores"
  on public.suppliers
  for select
  using (
    public.is_staff_admin()
    or public.has_staff_permission('faltantes')
    or public.has_staff_permission('fornecedores')
  );

commit;
