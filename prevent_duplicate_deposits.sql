-- Add unique constraint to bank_deposits to prevent duplicate references for the same currency and day
-- This handles the case where reference codes might be reused across different days or currencies

-- FIRST: Clean up existing duplicates if any (keeps the most recent one or the matched one)
DELETE FROM public.bank_deposits a
USING public.bank_deposits b
WHERE a.id > b.id -- Keep the one with the smallest ID (usually the first one created)
  AND a.reference_number = b.reference_number
  AND a.currency = b.currency
  AND a.created_at::date = b.created_at::date;

-- SECOND: Add the unique index on reference, currency and date
CREATE UNIQUE INDEX IF NOT EXISTS bank_deposits_unique_ref_idx 
ON public.bank_deposits (reference_number, currency, (created_at::date));
