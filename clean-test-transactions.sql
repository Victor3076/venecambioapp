-- Script SQL para limpiar transacciones de prueba
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Ver todas las transacciones actuales
SELECT 
    t.id,
    t.created_at,
    t.amount_sent,
    t.currency_sent,
    t.amount_received,
    t.currency_received,
    t.status,
    p.email,
    p.full_name
FROM transactions t
LEFT JOIN profiles p ON t.user_id = p.id
ORDER BY t.created_at DESC;

-- 2. Eliminar las 3 transacciones de prueba específicas
-- ⚠️ Basado en los resultados de la query anterior
DELETE FROM transactions 
WHERE id IN (
    'd50bc8e8-7dee-4ebd-bb3a-dba8af3a7831',  -- COL 220
    '55c3a0be-5da1-49b4-8b2e-2360abb3b55f',  -- prueba prueba
    'd690760b-872f-4a8c-b177-6d26dff0b4ed'   -- VICTOR RODRIGUEZ (120 PERU → 17926.66...)
);

-- NOTA: Si solo quieres eliminar las de los usuarios de prueba (COL 220 y prueba prueba),
-- usa este comando en su lugar:
-- DELETE FROM transactions 
-- WHERE id IN (
--     'd50bc8e8-7dee-4ebd-bb3a-dba8af3a7831',
--     '55c3a0be-5da1-49b4-8b2e-2360abb3b55f'
-- );

-- 3. Verificar que solo quedan las transacciones reales de VICTOR RODRIGUEZ
SELECT 
    t.id,
    t.created_at,
    t.amount_sent,
    t.currency_sent,
    t.amount_received,
    t.currency_received,
    t.status,
    p.email,
    p.full_name
FROM transactions t
INNER JOIN profiles p ON t.user_id = p.id
ORDER BY t.created_at DESC;
