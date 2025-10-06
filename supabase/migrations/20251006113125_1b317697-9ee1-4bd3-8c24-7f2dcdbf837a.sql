-- Corrigir vulnerabilidades de segurança críticas

-- 1. Adicionar política para proteger pedidos de convidados (sem user_id)
-- Apenas admins podem ver pedidos sem user_id
CREATE POLICY "Guest orders are only visible to admins"
ON public.orders
FOR SELECT
USING (
  user_id IS NOT NULL 
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Adicionar política para admins visualizarem todos os perfis
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. Adicionar política para admins gerenciarem todos os perfis
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));