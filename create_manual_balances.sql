-- Create manual_balances table for manual cash balance feature
CREATE TABLE IF NOT EXISTS public.manual_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    egli JSONB NOT NULL DEFAULT '{"yesterday": "0", "today_pass": "0", "today_clps": "0", "total": 0}'::jsonb,
    vicmar JSONB NOT NULL DEFAULT '{"yesterday": "0", "today_pass": "0", "today_clps": "0", "total": 0}'::jsonb,
    corriente JSONB NOT NULL DEFAULT '{"yesterday": "0", "today_pass": "0", "today_clps": "0", "total": 0}'::jsonb,
    cyber JSONB NOT NULL DEFAULT '{"yesterday": "0", "today_pass": "0", "today_clps": "0", "total": 0}'::jsonb,
    adjustment TEXT DEFAULT '0'
);

-- Enable RLS
ALTER TABLE public.manual_balances ENABLE ROW LEVEL SECURITY;

-- Create policy for admin/operator access (full access for now, similar to rates)
CREATE POLICY "Allow admin access to manual_balances" 
ON public.manual_balances 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.role = 'operator')
    )
);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_manual_balances_updated_at
BEFORE UPDATE ON public.manual_balances
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
