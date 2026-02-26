-- Enable Realtime for Transactions and Bank Deposits
-- This allows the admin panel to receive automatic updates

-- 1. Check if the publication already exists (just in case)
-- 2. Add tables to the 'supabase_realtime' publication

ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_deposits;
ALTER PUBLICATION supabase_realtime ADD TABLE rates_configuration;

-- Verify it was added correctly
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
