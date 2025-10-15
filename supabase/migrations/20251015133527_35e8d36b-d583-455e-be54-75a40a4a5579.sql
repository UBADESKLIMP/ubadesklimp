-- Fix RLS policy on orders table to prevent unauthorized access to customer data
-- Drop the problematic policy that allows any authenticated user to see orders
DROP POLICY IF EXISTS "Guest orders are only visible to admins" ON public.orders;

-- Recreate the policy with correct logic:
-- Only admins can see guest orders (user_id IS NULL)
-- Combined with existing policies, this ensures:
-- 1. Users can only see their own orders (existing "Users can view their own orders" policy)
-- 2. Admins can see all orders (existing "Admins can view all orders" policy)
-- 3. Guest orders are only visible to admins
CREATE POLICY "Guest orders are only visible to admins"
ON public.orders
FOR SELECT
USING (
  (user_id IS NULL AND has_role(auth.uid(), 'admin'::app_role))
);