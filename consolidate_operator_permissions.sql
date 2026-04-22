-- CONSOLIDATED PERMISSIONS SCRIPT
-- Roles: Admin (Full Access), Operator (Selected Access), User (Restricted Access)

-- 1. Helper Functions (Security Definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator');
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin';
END; $$;

-- 2. PROFILES (Usuarios)
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (public.is_staff());
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- 3. TRANSACTIONS (Operaciones)
DROP POLICY IF EXISTS "Users can view own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;

CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff manage transactions" ON public.transactions FOR ALL USING (public.is_staff());

-- 4. BANK DEPOSITS (Depósitos)
DROP POLICY IF EXISTS "Admins can view all deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Staff can view all deposits" ON public.bank_deposits;
DROP POLICY IF EXISTS "Staff can manage deposits" ON public.bank_deposits;

CREATE POLICY "Staff manage deposits" ON public.bank_deposits FOR ALL USING (public.is_staff());

-- 5. RATES CONFIGURATION (Tasas)
DROP POLICY IF EXISTS "Rates are viewable by everyone" ON public.rates_configuration;
DROP POLICY IF EXISTS "Only admins can manage rates" ON public.rates_configuration;
DROP POLICY IF EXISTS "Operators can update rates." ON public.rates_configuration;

CREATE POLICY "Rates public view" ON public.rates_configuration FOR SELECT USING (true);
CREATE POLICY "Staff manage rates" ON public.rates_configuration FOR ALL USING (public.is_staff());

-- 6. USER ACCOUNTS & PAYMENT METHODS (Cuentas)
DROP POLICY IF EXISTS "Operators can manage user accounts." ON public.user_accounts;
DROP POLICY IF EXISTS "Staff manage user accounts" ON public.user_accounts;
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Staff manage payment methods" ON public.payment_methods;

CREATE POLICY "Staff manage accounts" ON public.user_accounts FOR ALL USING (public.is_staff());
CREATE POLICY "Public view active payment methods" ON public.payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage payment methods" ON public.payment_methods FOR ALL USING (public.is_staff());

-- 7. NOTIFICATIONS (Notificaciones)
DROP POLICY IF EXISTS "Admins/Operators can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins/Operators can create notifications" ON public.notifications;

CREATE POLICY "Staff manage notifications" ON public.notifications FOR ALL USING (public.is_staff());

-- 8. RESTRICTED TABLES (Admin Only)
-- manual_balances, cashflow_adjustments, admin_settings

-- Manual Balances
DROP POLICY IF EXISTS "Allow admin access to manual_balances" ON public.manual_balances;
CREATE POLICY "Admins manage manual balances" ON public.manual_balances FOR ALL USING (public.is_admin());

-- Cashflow Adjustments
DROP POLICY IF EXISTS "Admins can manage cashflow adjustments" ON public.cashflow_adjustments;
DROP POLICY IF EXISTS "Staff can manage cashflow adjustments" ON public.cashflow_adjustments;
CREATE POLICY "Admins manage cashflow adjustments" ON public.cashflow_adjustments FOR ALL USING (public.is_admin());

-- Admin Settings
DROP POLICY IF EXISTS "Allow public read-only access to admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Allow staff to update admin_settings" ON public.admin_settings;
CREATE POLICY "Public view admin settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage admin settings" ON public.admin_settings FOR ALL USING (public.is_admin());
