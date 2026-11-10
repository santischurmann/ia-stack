# Fase 8 · Verificar y publicar

## Para qué
Comprobar que todo anda con evidencia real, y publicar una sola vez.

## Entra
- Todas las tareas del plan hechas y con commit local.
- Árbol de trabajo limpio.
- El comando de cada suite, declarado en `.ia-stack/ESTADO.md` o en el README del proyecto.

## Pasos
1. Antes de una suite o un build, medí la RAM y el disco libres. Corré las suites completas en
   local, de a una. Guardá la salida y el código de salida en un archivo.
2. Seguridad base: `node scripts/verify-security-baseline.mjs check`. Revisá a mano los
   hallazgos nuevos.
3. Repo limpio: `node scripts/verify-repo-clean.mjs check`. No deben quedar temporales,
   secretos ni archivos de más.
4. Revisión: un nivel fuerte distinto del que construyó, en otra sesión u otro host; si no hay,
   revisa la persona. El revisor recibe el diff y la spec, nada más.
5. Armá el recibo (la evidencia de los comandos reales corridos; `skills/recibo-y-seguridad.md`) y
   verificalo: `node scripts/verify-receipt.mjs check <receipt.json> --require-clean-worktree`.
6. Antes del push: `node scripts/verify-ci-push.mjs check`. Hacé un solo push. Nunca dispares
   CI «para probar».
7. Si el CI falla, corregí en local, armá un recibo nuevo y hacé un único push de corrección.
   Es retrabajo: `node scripts/leccion.mjs anotar --tipo retrabajo ...` lo anota.
8. Producción sólo con la orden de la persona: **«apruebo produccion <sha del commit>»**. Verificala
   con `node scripts/verify-aprobacion-humana.mjs produccion .ia-stack/APROBACIONES.md --sha <sha>`
   y, después de desplegar, `node scripts/aprobar.mjs usar --sha <sha>`: la orden vale una vez.

## Entrega
Recibo verificado y un push. La publicación a producción, sólo con orden.

## Gate
Gate 4 (verificación con recibo): `scripts/verify-receipt.mjs`, `verify-security-baseline.mjs` y
`verify-repo-clean.mjs`. Gate 5 (producción atada al sha): `verify-aprobacion-humana.mjs` en modo
`produccion`. Gate 8 (CI sólo en el push único o el de corrección): `verify-ci-push.mjs check`.
Los gates 4 y 5 están protegidos.

## Modelo
Scripts para los gates. Nivel fuerte para la revisión, distinto del que construyó.
