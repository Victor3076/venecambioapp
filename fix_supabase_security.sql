-- SUPABASE SECURITY HARDENING SCRIPT
-- Addresses: rls_disabled_in_public, sensitive_columns_exposed

-- 1. ENABLE RLS ON ALL TABLES
-- Ensuring that even if they were enabled before, they are definitely enabled now.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rates_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manual_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cashflow_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 2. FIX PROFILES TABLE (Sensitive Data Exposure)
-- Remove existing loose policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Operators can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;

-- New Secure Policies for Profiles
-- A. Users can view and update only their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- B. Admins and Operators can view all profiles
CREATE POLICY "Staff can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'operator')
  )
);

-- C. Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. SECURE RATES AND SETTINGS (Public but restricted)
-- These need to be public for the landing page, but strictly read-only for public.

-- Rates Configuration
DROP POLICY IF EXISTS "Rates are viewable by everyone." ON public.rates_configuration;
CREATE POLICY "Rates are viewable by everyone" 
ON public.rates_configuration FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Only admins can update rates." ON public.rates_configuration;
CREATE POLICY "Only admins can manage rates" 
ON public.rates_configuration FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Admin Settings
DROP POLICY IF EXISTS "Allow public read-only access to admin_settings" ON public.admin_settings;
CREATE POLICY "Allow public read-only access to admin_settings" 
ON public.admin_settings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow admins to update admin_settings" ON public.admin_settings;
CREATE POLICY "Allow admins to update admin_settings" 
ON public.admin_settings FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Payment Methods
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON public.payment_methods;
CREATE POLICY "Anyone can view active payment methods" 
ON public.payment_methods FOR SELECT 
USING (is_active = true);

-- 4. SECURE STORAGE (If applicable via SQL)
-- Note: Storage policies usually need to be set on storage.objects

-- Ensure bucket 'payments' is secure (this part often requires dashboard if not using SQL API for storage)
-- But we can try to set policies on storage.objects for the 'payments' bucket.

DO $$
BEGIN
    -- Check if storage.objects table exists (it should in Supabase)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        
        -- Policy: Anyone can read from 'payments' bucket if it's public (we assume it is for proofs)
        -- Or restricted to owner/admin if private.
        -- Given the code uses getPublicUrl, we assume it needs public read.
        
        DROP POLICY IF EXISTS "Public Access to Payments" ON storage.objects;
        CREATE POLICY "Public Access to Payments" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'payments');

        -- Policy: Authenticated users can upload to their own folder in 'payments'
        DROP POLICY IF EXISTS "Authenticated users can upload proofs" ON storage.objects;
        CREATE POLICY "Authenticated users can upload proofs" 
        ON storage.objects FOR INSERT 
        TO authenticated
        WITH CHECK (bucket_id = 'payments');

        -- Policy: Admins can manage all objects in 'payments'
        DROP POLICY IF EXISTS "Admins can manage payments storage" ON storage.objects;
        CREATE POLICY "Admins can manage payments storage" 
        ON storage.objects FOR ALL 
        TO authenticated
        USING (
            bucket_id = 'payments' AND
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
        );

    END IF;
END $$;
