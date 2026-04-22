-- FIX RECURSIVE RLS POLICY ON PROFILES
-- This script fixes the issue where Admins/Operators couldn't see anything due to infinite recursion.

-- 1. Create a security-definer function to get the current user's role without recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- This is the key: it runs with the privileges of the creator (usually postgres), bypassing RLS
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$;

-- 2. Update Profiles policies to use the new function
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Staff can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated
USING (
  get_my_role() IN ('admin', 'operator')
);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated
USING (
  get_my_role() = 'admin'
);

-- 3. Also ensure transactions and other tables use this non-recursive check if they were using EXISTS(SELECT FROM profiles...)
-- Transactions fix
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" 
ON public.transactions FOR SELECT 
TO authenticated
USING (
  get_my_role() IN ('admin', 'operator')
);

DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
CREATE POLICY "Admins can update transactions" 
ON public.transactions FOR UPDATE 
TO authenticated
USING (
  get_my_role() IN ('admin', 'operator')
);

-- Bank Deposits fix
DROP POLICY IF EXISTS "Admins can view all deposits" ON public.bank_deposits;
CREATE POLICY "Admins can view all deposits" 
ON public.bank_deposits FOR ALL 
TO authenticated
USING (
  get_my_role() IN ('admin', 'operator')
);

-- Manual Balances fix
DROP POLICY IF EXISTS "Allow admin access to manual_balances" ON public.manual_balances;
CREATE POLICY "Allow admin access to manual_balances" 
ON public.manual_balances FOR ALL 
TO authenticated
USING (
  get_my_role() IN ('admin', 'operator')
);
