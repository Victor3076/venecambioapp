-- FIX OPERATOR AUTOMATIC COMMISSIONS
-- Allows operators to record bank commissions without giving them access to the full cashflow history.

-- 1. Update Cashflow Adjustments policies
DROP POLICY IF EXISTS "Admins manage cashflow adjustments" ON public.cashflow_adjustments;
DROP POLICY IF EXISTS "Staff manage cashflow adjustments" ON public.cashflow_adjustments;

-- Only Admins can see the whole history, update or delete.
CREATE POLICY "Admins full manage cashflow" 
ON public.cashflow_adjustments FOR ALL 
TO authenticated
USING (public.is_admin());

-- Operators can INSERT (to record the automatic 0.3% VES fee upon completion)
CREATE POLICY "Operators can record adjustments" 
ON public.cashflow_adjustments FOR INSERT 
TO authenticated
WITH CHECK (public.is_staff());

-- 2. Minor fix for Admin Settings (Ensure Operators can read them for the UI)
DROP POLICY IF EXISTS "Public view admin settings" ON public.admin_settings;
CREATE POLICY "Public view admin settings" 
ON public.admin_settings FOR SELECT 
USING (true);
