-- GRANT PERMISSIONS TO OPERATOR ROLE
-- This script allows users with role 'operator' to manage Rates and Bank Accounts.

-- 1. Rates Configuration
DROP POLICY IF EXISTS "Operators can view rates." on public.rates_configuration;
CREATE POLICY "Operators can view rates."
ON public.rates_configuration FOR SELECT
USING ( exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' ) );

DROP POLICY IF EXISTS "Operators can update rates." on public.rates_configuration;
CREATE POLICY "Operators can update rates."
ON public.rates_configuration FOR ALL -- Using ALL to include INSERT/UPDATE/DELETE if needed
USING ( exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' ) );

-- 2. Payment Methods (Company Accounts)
DROP POLICY IF EXISTS "Operators can manage payment methods." on public.payment_methods;
CREATE POLICY "Operators can manage payment methods."
ON public.payment_methods FOR ALL
USING ( exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' ) );

-- 3. User Accounts (Client Accounts)
DROP POLICY IF EXISTS "Operators can view user accounts." on public.user_accounts;
CREATE POLICY "Operators can view user accounts."
ON public.user_accounts FOR SELECT
USING ( exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' ) );

DROP POLICY IF EXISTS "Operators can manage user accounts." on public.user_accounts;
CREATE POLICY "Operators can manage user accounts."
ON public.user_accounts FOR ALL
USING ( exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' ) );
