-- Agregar columna para el comprobante de liquidación del operador
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS completion_proof_url text;
