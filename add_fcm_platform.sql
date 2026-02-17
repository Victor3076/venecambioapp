-- Add fcm_platform to profiles to differentiate between native and web tokens
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fcm_platform text;

-- Update existing profiles to 'web' by default if they have a token but no platform
UPDATE public.profiles 
SET fcm_platform = 'web' 
WHERE fcm_token IS NOT NULL AND fcm_platform IS NULL;
