# Venecambio App - Deployment Checklist

## Pre-Deploy

- [ ] Asegúrate de que todas las variables de entorno estén en `.env.local`
- [ ] Verifica que la app funcione correctamente en local (`npm run dev`)
- [ ] Revisa que no haya errores en la consola del navegador
- [ ] Prueba todas las funcionalidades principales:
  - [ ] Registro e inicio de sesión
  - [ ] Crear nueva transacción
  - [ ] Subir comprobante
  - [ ] Panel de admin (si eres admin)

## GitHub Setup

- [ ] Crear cuenta en GitHub (si no tienes)
- [ ] Crear repositorio `venecambioapp`
- [ ] Subir código con Git:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/TU_USUARIO/venecambioapp.git
  git push -u origin main
  ```

## Vercel Deployment

- [ ] Crear cuenta en Vercel (https://vercel.com)
- [ ] Conectar con GitHub
- [ ] Importar repositorio `venecambioapp`
- [ ] Configurar variables de entorno:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (opcional)
- [ ] Hacer clic en "Deploy"
- [ ] Esperar a que termine el deploy (2-3 minutos)

## Post-Deploy

- [ ] Probar la URL de Vercel (ej: `venecambioapp.vercel.app`)
- [ ] Verificar que todas las funcionalidades funcionen
- [ ] Configurar dominio personalizado (opcional):
  - [ ] Agregar dominio en Vercel
  - [ ] Configurar DNS en GoDaddy

## Supabase Configuration

- [ ] Agregar la URL de Vercel a "Allowed URLs" en Supabase:
  - Ve a Authentication → URL Configuration
  - Agrega: `https://tu-app.vercel.app`

## Mantenimiento

Para actualizar la app en producción:
```bash
git add .
git commit -m "Descripción de cambios"
git push
```

Vercel automáticamente desplegará los cambios.
