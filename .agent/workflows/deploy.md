---
description: Subir cambios a producción (Vercel) via GitHub
---

## Pasos para subir cambios a la nube

// turbo-all

1. Agregar, commitear y pushear los cambios:
```
cmd /c "git add -A && git commit -m "DESCRIPCION_DEL_CAMBIO" && git push origin main"
```
Reemplaza `DESCRIPCION_DEL_CAMBIO` con una breve descripción de lo que cambiaste.

2. Vercel detectará automáticamente el nuevo commit y hará el deploy en ~30-60 segundos.

3. Puedes verificar el estado del deploy en: https://vercel.com/victor-rodriguezs-projects-f6d4c0b5/venecambioapp
