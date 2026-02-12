-- Permitir que los usuarios actualicen sus propias transacciones (necesario para guardar la URL del comprobante)
create policy "Users can update own transactions" on public.transactions
for update using (auth.uid() = user_id);

-- Opcional: Si queremos ser más específicos para que solo puedan actualizar si el estado es 'verifying'
-- create policy "Users can update own transactions" on public.transactions
-- for update using (auth.uid() = user_id)
-- with check (status = 'verifying');
