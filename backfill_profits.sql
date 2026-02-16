-- SCRIPT DE ACTUALIZACIÓN DE GANANCIAS (BACKFILL)
-- Este script estima la ganancia de transacciones antiguas y la guarda en USDT.
-- Ejecuta esto en el SQL Editor de Supabase.

-- 1. Perú (PEN): Estimación al 5% de margen, Tasa 3.75 PEN/USDT
UPDATE public.transactions
SET profit_percentage = 5,
    profit_amount = (amount_sent * 0.05) / 3.75
WHERE currency_sent = 'PERU' 
  AND (profit_percentage IS NULL OR profit_amount = 0);

-- 2. Chile (CLP): Estimación al 7% de margen, Tasa 980 CLP/USDT
UPDATE public.transactions
SET profit_percentage = 7,
    profit_amount = (amount_sent * 0.07) / 980
WHERE currency_sent = 'CHILE' 
  AND (profit_percentage IS NULL OR profit_amount = 0);

-- 3. Colombia (COP): Estimación al 10% de margen, Tasa 3900 COP/USDT
UPDATE public.transactions
SET profit_percentage = 10,
    profit_amount = (amount_sent * 0.10) / 3900
WHERE currency_sent = 'COLOMBIA' 
  AND (profit_percentage IS NULL OR profit_amount = 0);

-- 4. USA (Zelle): Estimación al 3% de margen, Tasa 1.0 $/USDT
UPDATE public.transactions
SET profit_percentage = 3,
    profit_amount = (amount_sent * 0.03)
WHERE currency_sent = 'USA' 
  AND (profit_percentage IS NULL OR profit_amount = 0);

-- 5. Otros: Estimación al 2%
UPDATE public.transactions
SET profit_percentage = 2,
    profit_amount = (amount_sent * 0.02)
WHERE (profit_percentage IS NULL OR profit_amount = 0);
