-- Add DELETE policy for bank_deposits to allow staff to delete available deposits
DROP POLICY IF EXISTS "Staff can delete available deposits" ON public.bank_deposits;

CREATE POLICY "Staff can delete available deposits"
ON public.bank_deposits
FOR DELETE
USING (
    public.is_staff_check()
    AND status = 'available'
);
