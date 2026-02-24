-- BACKFILL DE GANANCIAS HISTÓRICAS
-- Basado en los valores proporcionados por el usuario
-- COP: Tasa USDT 3640, Margen 10%

-- 1. Reparar transacciones de COP que tienen ganancia 0
UPDATE transactions 
SET 
    profit_percentage = 10, 
    profit_amount = (amount_sent * 0.10) / 3640 
WHERE 
    currency_sent = 'COP' 
    AND (profit_amount IS NULL OR profit_amount = 0);

-- 2. (Opcional) Otros arreglos si se conocen las tasas históricas
-- Por ahora solo aplicamos lo solicitado explícitamente para COP.
