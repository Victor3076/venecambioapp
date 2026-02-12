# Guía de Despliegue en Vercel

## Requisitos Previos
- Cuenta en GitHub (gratis)
- Cuenta en Vercel (gratis)

## Paso 1: Subir el Código a GitHub

1. Abre una terminal en tu proyecto:
```bash
cd c:\Users\MorochosPC\Documents\venecambioapp
```

2. Inicializa Git (si no lo has hecho):
```bash
git init
git add .
git commit -m "Initial commit"
```

3. Crea un repositorio en GitHub:
   - Ve a https://github.com/new
   - Nombre: `venecambioapp`
   - Haz clic en "Create repository"

4. Conecta tu proyecto local con GitHub:
```bash
git remote add origin https://github.com/TU_USUARIO/venecambioapp.git
git branch -M main
git push -u origin main
```

## Paso 2: Desplegar en Vercel

1. Ve a https://vercel.com y crea una cuenta (usa tu cuenta de GitHub)

2. Haz clic en "New Project"

3. Importa tu repositorio `venecambioapp`

4. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`: Tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Tu clave anónima de Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Tu clave de servicio (opcional, para admin)

5. Haz clic en "Deploy"

## Paso 3: Configurar Dominio Personalizado (Opcional)

Si tienes un dominio en GoDaddy:

1. En Vercel, ve a Settings → Domains
2. Agrega tu dominio (ej: `venecambio.com`)
3. Vercel te dará registros DNS para configurar
4. En GoDaddy, ve a DNS Management y agrega los registros que Vercel te indicó

## Actualizaciones Futuras

Cada vez que hagas cambios:
```bash
git add .
git commit -m "Descripción de cambios"
git push
```

Vercel automáticamente desplegará la nueva versión.

## Alternativa: Build Manual para GoDaddy (No Recomendado)

Si insistes en usar GoDaddy:

1. Genera un build estático:
```bash
npm run build
```

2. Sube la carpeta `out/` a tu hosting de GoDaddy vía FTP

⚠️ **Limitaciones**: Perderás funcionalidades server-side, API routes no funcionarán correctamente.

## Soporte

- Documentación Vercel: https://vercel.com/docs
- Documentación Next.js: https://nextjs.org/docs/deployment
