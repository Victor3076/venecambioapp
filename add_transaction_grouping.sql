-- Add group_id to group multiple transfers under one deposit
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS group_id uuid;

-- Index for performance when filtering by group
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON public.transactions(group_id);
