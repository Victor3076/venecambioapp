-- Fixed SQL script for duplicate prevention in bank_deposits
-- Enforces uniqueness (reference, currency, day) without immutability errors

-- 1. Add a dedicated date column to avoid timezone-dependent index issues
ALTER TABLE public.bank_deposits ADD COLUMN IF NOT EXISTS deposit_date DATE;

-- 2. Populate existing rows
UPDATE public.bank_deposits SET deposit_date = (created_at AT TIME ZONE 'UTC')::date WHERE deposit_date IS NULL;

-- 3. Set the column as NOT NULL for future rows
ALTER TABLE public.bank_deposits ALTER COLUMN deposit_date SET NOT NULL;

-- 4. Create a trigger function to keep deposit_date updated automatically
CREATE OR REPLACE FUNCTION public.sync_deposit_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deposit_date := (NEW.created_at AT TIME ZONE 'UTC')::date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach the trigger
DROP TRIGGER IF EXISTS trg_sync_deposit_date ON public.bank_deposits;
CREATE TRIGGER trg_sync_deposit_date
BEFORE INSERT OR UPDATE OF created_at ON public.bank_deposits
FOR EACH ROW EXECUTE FUNCTION public.sync_deposit_date();

-- 6. CLEANUP: Delete existing duplicates (keeping the most recent/matched/first one)
DELETE FROM public.bank_deposits a
USING public.bank_deposits b
WHERE a.id > b.id 
  AND a.reference_number = b.reference_number
  AND a.currency = b.currency
  AND a.deposit_date = b.deposit_date;

-- 7. FINALLY: Add the unique constraint safely
ALTER TABLE public.bank_deposits 
DROP CONSTRAINT IF EXISTS bank_deposits_ref_curr_day_unique;

ALTER TABLE public.bank_deposits 
ADD CONSTRAINT bank_deposits_ref_curr_day_unique 
UNIQUE (reference_number, currency, deposit_date);
