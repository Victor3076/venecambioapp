-- Añadir campo de comentario (notas) a la tabla de depósitos bancarios
ALTER TABLE bank_deposits ADD COLUMN IF NOT EXISTS notes TEXT;
