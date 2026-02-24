-- MIGRACIÓN DE MONEDAS: REGIONES -> ISO CODES
-- Fecha: 2026-02-24

-- 1. Actualizar transacciones
UPDATE transactions SET currency_sent = 'USD' WHERE currency_sent = 'USA';
UPDATE transactions SET currency_sent = 'PEN' WHERE currency_sent = 'PERU';
UPDATE transactions SET currency_sent = 'CLP' WHERE currency_sent = 'CHILE';
UPDATE transactions SET currency_sent = 'COP' WHERE currency_sent = 'COLOMBIA';
UPDATE transactions SET currency_sent = 'VES' WHERE currency_sent = 'VENEZUELA';

UPDATE transactions SET currency_received = 'USD' WHERE currency_received = 'USA';
UPDATE transactions SET currency_received = 'PEN' WHERE currency_received = 'PERU';
UPDATE transactions SET currency_received = 'CLP' WHERE currency_received = 'CHILE';
UPDATE transactions SET currency_received = 'COP' WHERE currency_received = 'COLOMBIA';
UPDATE transactions SET currency_received = 'VES' WHERE currency_received = 'VENEZUELA';

-- 2. Actualizar depósitos bancarios
UPDATE bank_deposits SET currency = 'USD' WHERE currency = 'USA';
UPDATE bank_deposits SET currency = 'PEN' WHERE currency = 'PERU';
UPDATE bank_deposits SET currency = 'CLP' WHERE currency = 'CHILE';
UPDATE bank_deposits SET currency = 'COP' WHERE currency = 'COLOMBIA';
UPDATE bank_deposits SET currency = 'VES' WHERE currency = 'VENEZUELA';

-- 3. Actualizar configuración de tasas (JSONB)
UPDATE rates_configuration 
SET usdt_prices = jsonb_build_object(
    'USD', COALESCE((usdt_prices->>'USA')::numeric, (usdt_prices->>'USD')::numeric, 1.0),
    'PEN', COALESCE((usdt_prices->>'PERU')::numeric, (usdt_prices->>'PEN')::numeric, 3.70),
    'CLP', COALESCE((usdt_prices->>'CHILE')::numeric, (usdt_prices->>'CLP')::numeric, 950),
    'COP', COALESCE((usdt_prices->>'COLOMBIA')::numeric, (usdt_prices->>'COP')::numeric, 3900),
    'VES', COALESCE((usdt_prices->>'VENEZUELA')::numeric, (usdt_prices->>'VES')::numeric, 35),
    'MONITOR', (usdt_prices->>'MONITOR')::numeric,
    'BCV', (usdt_prices->>'BCV')::numeric
)
WHERE usdt_prices IS NOT NULL;
