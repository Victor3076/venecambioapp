-- Allow admins to manage user_accounts by defining policies
-- that check if the executing user has role 'admin' in profiles table.

-- 1. Drop existing policies to be safe (or create new ones if they conflict? 
-- The existing ones are:
-- "Users can allow view own accounts."
-- "Users can insert own accounts."
-- "Users can update own accounts."
-- "Users can delete own accounts."
-- We want to ADD policies for admins, or modify existing ones. Adding new ones is cleaner.

DROP POLICY IF EXISTS "Admins can view all accounts." on public.user_accounts;
create policy "Admins can view all accounts."
  on public.user_accounts
  for select
  using (
    exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
  );

DROP POLICY IF EXISTS "Admins can insert accounts for any user." on public.user_accounts;
create policy "Admins can insert accounts for any user."
  on public.user_accounts
  for insert
  with check (
    exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
  );

DROP POLICY IF EXISTS "Admins can update all accounts." on public.user_accounts;
create policy "Admins can update all accounts."
  on public.user_accounts
  for update
  using (
    exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
  );

DROP POLICY IF EXISTS "Admins can delete all accounts." on public.user_accounts;
create policy "Admins can delete all accounts."
  on public.user_accounts
  for delete
  using (
    exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
  );
