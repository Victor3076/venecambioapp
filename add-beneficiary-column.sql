-- Add beneficiary_data column to transactions table
-- This stores a JSON snapshot of the beneficiary account at the time of transaction
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS beneficiary_data jsonb;

-- Example of what beneficiary_data looks like:
-- {
--   "alias": "Mamá Banesco",
--   "country": "VENEZUELA",
--   "bank_name": "Banesco",
--   "account_number": "01340123456789012345",
--   "details": { "id_number": "12345678", "venezuela_type": "Cuenta" }
-- }
