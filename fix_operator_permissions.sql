-- 1. Create a helper function to check for staff roles (admin or operator)
CREATE OR REPLACE FUNCTION public.is_staff_check()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'operator')
  );
END;
$$;

-- 2. Update BANK_DEPOSITS policies
DROP POLICY IF EXISTS "Admins can view all deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Admins can insert deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Admins can update deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Staff can view all deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Staff can insert deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Staff can update deposits" ON public.bank_deposits;

CREATE POLICY "Staff can view all deposits" ON public.bank_deposits FOR SELECT USING (public.is_staff_check());
CREATE POLICY "Staff can insert deposits" ON public.bank_deposits FOR INSERT WITH CHECK (public.is_staff_check());
CREATE POLICY "Staff can update deposits" ON public.bank_deposits FOR UPDATE USING (public.is_staff_check());

-- 3. Update ADMIN_SETTINGS policies
DROP POLICY IF EXISTS "Allow admins to update admin_settings" ON public.admin_settings;
CREATE POLICY "Allow staff to update admin_settings" ON public.admin_settings FOR UPDATE USING (public.is_staff_check());

-- 4. Update PAYMENT_METHODS policies
DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Staff can manage payment methods" ON public.payment_methods;
CREATE POLICY "Staff can manage payment methods" ON public.payment_methods FOR ALL USING (public.is_staff_check());

-- 5. Update CASHFLOW_ADJUSTMENTS policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cashflow_adjustments') THEN
        DROP POLICY IF EXISTS "Admins can manage cashflow adjustments" ON public.cashflow_adjustments;
        CREATE POLICY "Staff can manage cashflow adjustments" ON public.cashflow_adjustments FOR ALL USING (public.is_staff_check());
    END IF;
END $$;
