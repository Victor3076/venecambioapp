-- Create table for cashflow adjustments (withdrawals and initializations)
CREATE TABLE IF NOT EXISTS cashflow_adjustments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount NUMERIC(20, 2) NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('withdrawal', 'initialization')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE cashflow_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies (Admin only)
CREATE POLICY "Admins can manage cashflow adjustments" 
ON cashflow_adjustments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin')
    )
);

-- Grant access to authenticated users (role check happens in policy)
GRANT ALL ON cashflow_adjustments TO authenticated;
