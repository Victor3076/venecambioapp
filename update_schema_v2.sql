-- 1. Update Profiles Role Check to allow 'operator'
-- Note: We might need to drop the constraint first if it's strictly enforced by SQL
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'operator'));

-- 2. Add Profit Columns to Transactions
-- These will store the snapshot of the profit at the time of transaction creation
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS profit_percentage numeric, -- e.g. 5.0
ADD COLUMN IF NOT EXISTS profit_amount numeric;     -- e.g. 2.5 (USDT or source currency equiv)

-- 3. RLS for Operator
-- Operators should view profiles and transactions, but only manage 'user' profiles.

-- Allow Operators to view all profiles
DROP POLICY IF EXISTS "Operators can view all profiles." on public.profiles;
CREATE POLICY "Operators can view all profiles."
ON public.profiles
FOR SELECT
USING (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' )
);

-- Allow Operators to view all transactions
DROP POLICY IF EXISTS "Operators can view all transactions." on public.transactions;
CREATE POLICY "Operators can view all transactions."
ON public.transactions
FOR SELECT
USING (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' )
);

-- Allow Operators to update transactions (e.g. verify/complete)
DROP POLICY IF EXISTS "Operators can update transactions." on public.transactions;
CREATE POLICY "Operators can update transactions."
ON public.transactions
FOR UPDATE
USING (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'operator' )
);

-- Note: User creation is handled via Servicer Role (supabase_admin), so RLS on profiles might not strictly block creation if using service role key in actions.
-- However, we should restrict UPDATE/DELETE on profiles if done via client or standard RLS.
-- "Only admins can update rates" -> remains true (Operators don't touch rates).
