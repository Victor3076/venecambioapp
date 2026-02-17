-- Table for global application settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_open boolean DEFAULT true,
    closed_message text DEFAULT 'Nuestro horario de atención es de 10:00 AM a 8:00 PM (Hora Venezuela). Regresa pronto para realizar tus operaciones.',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS admin_settings_single_row ON public.admin_settings ((true));

-- Seed initial data
INSERT INTO public.admin_settings (is_open)
VALUES (true)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to admin_settings"
ON public.admin_settings FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admins to update admin_settings"
ON public.admin_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Function to broadcast a notification to all users
-- This avoids doing N inserts from the client side
CREATE OR REPLACE FUNCTION broadcast_notification(
    p_title text,
    p_message text,
    p_type text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    SELECT id, p_title, p_message, p_type, false
    FROM public.profiles;
END;
$$;
