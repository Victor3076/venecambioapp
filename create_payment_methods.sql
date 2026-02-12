-- Crear tabla de métodos de pago de la empresa
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL, -- Ej: PERU, CHILE, VENEZUELA
  method_type TEXT NOT NULL, -- Ej: transferencia, yape, pago_movil, zelle
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  holder_id TEXT, -- Para ID o Documento si es necesario
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- 1. Cualquiera puede leer métodos activos (para pagar)
CREATE POLICY "Anyone can view active payment methods" 
ON public.payment_methods FOR SELECT 
USING (is_active = true);

-- 2. Admins pueden hacer todo
CREATE POLICY "Admins can manage payment methods" 
ON public.payment_methods FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
