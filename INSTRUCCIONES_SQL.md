# Instrucciones Importantes para Activar la Funcionalidad

Para que las transacciones guarden y muestren los datos del beneficiario correctamente, necesitas ejecutar el siguiente script SQL en tu base de datos de Supabase.

1.  Ve a tu proyecto en **Supabase** (https://app.supabase.com).
2.  Entra a la sección **SQL Editor** (icono de terminal en la barra lateral izquierda).
3.  Crea una **New Query**.
4.  Copia y pega el siguiente código SQL:

```sql
-- Agregar columna beneficiary_data a la tabla transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS beneficiary_data jsonb;

-- (Opcional) Verificar que se agregó
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'beneficiary_data';
```

5.  Haz clic en **Run**.

Una vez hecho esto, las **nuevas transacciones** que se creen guardarán los datos del beneficiario y podrás verlos en el panel de administrador con los botones de copiar.

**Nota:** Las transacciones antiguas no tendrán estos datos, pero las nuevas sí.
