-- FIX RLS FOR NOTIFICATIONS AND PROFILES

-- 1. Ensure Admins can view and update everything in profiles
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
CREATE POLICY "Admins can do everything on profiles"
ON public.profiles FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Ensure Operators can also view all profiles (if not already handled correctly)
DROP POLICY IF EXISTS "Operators can view all profiles." ON public.profiles;
CREATE POLICY "Operators can view all profiles."
ON public.profiles FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

-- 3. Fix Notifications Table Policies to be more robust
-- We use a simpler check or ensure it doesn't cause recursion

DROP POLICY IF EXISTS "Admins/Operators can create notifications" ON public.notifications;
CREATE POLICY "Admins/Operators can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
);

-- Also allow them to see the history of what they sent
DROP POLICY IF EXISTS "Admins/Operators can view all notifications" ON public.notifications;
CREATE POLICY "Admins/Operators can view all notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
);

-- Ensure users can still see their own
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
