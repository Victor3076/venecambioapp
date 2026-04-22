-- FINAL FIX FOR OPERATOR COMMISSIONS RLS
-- Allows staff to INSERT and SELECT their own records to ensure automatic VES commissions work.

-- 1. Refresh global helper functions (just in case)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin';
END; $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator');
END; $$;

-- 2. Update Cashflow Adjustments policies
DROP POLICY IF EXISTS "Admins full manage cashflow" ON public.cashflow_adjustments;
DROP POLICY IF EXISTS "Operators can record adjustments" ON public.cashflow_adjustments;
DROP POLICY IF EXISTS "Staff can select own adjustments" ON public.cashflow_adjustments;

-- Admins can do everything
CREATE POLICY "Admins full manage cashflow" 
ON public.cashflow_adjustments FOR ALL 
TO authenticated
USING (public.is_admin());

-- Staff can INSERT (to record the automatic 0.3% VES fee)
CREATE POLICY "Staff can insert adjustments" 
ON public.cashflow_adjustments FOR INSERT 
TO authenticated
WITH CHECK (public.is_staff());

-- Staff can SELECT their OWN adjustments (necessary for the 'select().single()' in JS to work)
CREATE POLICY "Staff can select own adjustments" 
ON public.cashflow_adjustments FOR SELECT 
TO authenticated
USING (public.is_staff() AND (created_by = auth.uid() OR public.is_admin()));
