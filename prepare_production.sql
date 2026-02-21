-- SCRIPT DE PREPARACIÓN PARA PRODUCCIÓN (V3)
-- Este script limpia datos de prueba pero PRESERVA Tasas y Cuentas de la Empresa.

BEGIN;

-- 1. Eliminar datos operativos (Historial de pruebas y beneficiarios)
-- NO SE TOCAN: rates_configuration (Tasas) ni payment_methods (Cuentas de la empresa)
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.bank_deposits CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.user_accounts CASCADE;
TRUNCATE TABLE public.cashflow_adjustments CASCADE;

-- 2. Limpiar usuarios (Manteniendo solo Administrador y Operador)
-- Primero borramos los perfiles para evitar errores de clave foránea (FK)
DELETE FROM public.profiles 
WHERE email NOT IN ('+584144007220', '+584124139923');

-- Luego borramos los usuarios de autenticación que ya no tienen perfil
DELETE FROM auth.users 
WHERE id NOT IN (
    SELECT id FROM public.profiles
);

COMMIT;

-- INSTRUCCIONES:
-- 1. Ve a Supabase -> SQL Editor.
-- 2. Pega este código y presiona "Run".
-- 3. RESULTADO: Solo quedarán los 2 usuarios autorizados. 
-- 4. SE MANTENDRÁN: Cuentas de la Empresa (métodos de pago) y Configuración de Tasas.
