-- 1. Add FCM Token to profiles for push notifications
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fcm_token text;

-- 2. Create notifications table for in-app history
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info', -- 'status_update', 'promotion', 'alert'
    is_read boolean DEFAULT false,
    data jsonb, -- For storing relevant IDs (e.g. { transaction_id: '...' })
    created_at timestamp with time zone DEFAULT now()
);

-- 3. RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins/Operators can create notifications" ON public.notifications;
CREATE POLICY "Admins/Operators can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, is_read);
