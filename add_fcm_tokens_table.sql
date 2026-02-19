-- Create a table to store multiple FCM tokens per user
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    token text PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform text NOT NULL, -- 'web', 'android', 'ios'
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert/update their own tokens
DROP POLICY IF EXISTS "Users can manage their own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can manage their own fcm tokens"
    ON public.fcm_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role (Admin API) can read everything
DROP POLICY IF EXISTS "Service role can read all tokens" ON public.fcm_tokens;
CREATE POLICY "Service role can read all tokens"
    ON public.fcm_tokens
    FOR SELECT
    TO service_role
    USING (true);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- Function to clean up old tokens (optional, can be run periodically or on insert)
CREATE OR REPLACE FUNCTION public.cleanup_old_fcm_tokens()
RETURNS trigger AS $$
BEGIN
    -- Delete tokens that haven't been active in 6 months
    DELETE FROM public.fcm_tokens
    WHERE last_active < now() - interval '6 months';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
