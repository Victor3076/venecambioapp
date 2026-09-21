-- =========================================================
-- Script SQL: Habilitar Notificaciones de Operaciones hacia PEN, USD, COP y CLP
-- =========================================================

-- 1. Asegurar que la tabla fcm_tokens existe con soporte para administradores y plataformas
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    token text PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    platform text NOT NULL, -- 'web', 'android', 'ios'
    last_active timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS en fcm_tokens
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can manage their own fcm tokens"
    ON public.fcm_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can read all tokens" ON public.fcm_tokens;
CREATE POLICY "Service role can read all tokens"
    ON public.fcm_tokens
    FOR SELECT
    TO service_role
    USING (true);

-- Index para optimizar búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- 2. Asegurar que la tabla notifications permita el tipo 'cross_currency_alert'
-- y que los administradores puedan consultar sus alertas
DROP POLICY IF EXISTS "Admins can view their notifications" ON public.notifications;
CREATE POLICY "Admins can view their notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- 3. (Opcional) Trigger opcional de Supabase para llamar al webhook en caso de inserts directos en BD
-- Si configuras un Database Webhook en Supabase Dashboard:
-- - Table: transactions
-- - Event: INSERT
-- - HTTP URL: https://venecambio.com/api/notifications/cross-currency
-- - HTTP Method: POST
