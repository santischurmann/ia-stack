# Fase 8 · Verificar y publicar

## Para qué
Comprobar que todo anda con evidencia real, y publicar una sola vez.

## Entra
- Todas las tareas del plan hechas y con commit local.
- Árbol de trabajo limpio.
- El comando de cada suite, declarado en `.ia-stack/ESTADO.md` o en el README del proyecto. Si
  falta, se frena y se le pregunta a la persona.

## Pasos
1. Corré las suites completas en local; si van a la vez, cada una con su puerto y su base de prueba
   (`contracts/model-routing.json` § encargo). Guardá la salida y el código de salida fuera del
   árbol de trabajo (una carpeta temporal): un archivo nuevo sin commit hace frenar el paso 6.
2. Seguridad base: `node scripts/verify-security-baseline.mjs check`. Revisá a mano los
   hallazgos nuevos.
3. Repo limpio: `node scripts/verify-repo-clean.mjs check`. Lo versionado no lleva rutas personales
   ni la identidad de quien lo corre; temporales y archivos de más se miran a mano.
4. Revisión: un nivel fuerte distinto del que construyó, en otra sesión u otro host que abre la rama
   del constructor sin su conversación, con la spec. Si el host lo tiene, corre `/code-review medium <rama>`,
   sin `--fix`; otro nivel, sólo si la persona lo pide. Si no hay otra sesión, revisa la persona.
5. En tamaño grande o con área de riesgo, rondas de EGM sobre el diff y las secciones de la spec que
   toca (`skills/brainstorm-egm.md`), registradas con `--pieza publicar`: 5 a 10, nivel fuerte. Suma
   una lectura sin contexto; no reemplaza al revisor. Si los pasos 4 o 5 cambian código, commit
   local y volvé al paso 1. `metricas.jsonl` y `ESTADO.md` van con `git add` antes del paso 6.
6. Armá el recibo (la evidencia de los comandos reales corridos; `skills/recibo-y-seguridad.md`) y
   verificalo: `node scripts/verify-receipt.mjs check <receipt.json> --require-clean-worktree`.
7. Antes del push: `node scripts/verify-ci-push.mjs check`. Hacé un solo push. Nunca dispares
   CI «para probar». `/ship` y `/steward` no se usan: pushean sin recibo ni gate 8, el watch empuja
   arreglos solo y la revisión de `/ship` es de la misma sesión que construyó.
8. Si el CI falla, corregí en local, armá un recibo nuevo y hacé un único push de corrección.
   Es retrabajo: `node scripts/leccion.mjs anotar --tipo retrabajo ...` lo anota. Si el CI de
   corrección también falla, se frena y decide la persona.
9. Producción sólo con la orden de la persona: **«apruebo produccion <sha del commit>»**. Verificala
   con `node scripts/verify-aprobacion-humana.mjs produccion .ia-stack/APROBACIONES.md --sha <sha>`
   y corré `node scripts/aprobar.mjs usar --sha <sha>` justo antes de desplegar: la orden vale una
   vez. Si el despliegue falla, se pide una orden nueva.

## Entrega
Recibo verificado y un push. La publicación a producción, sólo con orden.

## Gate
Gate 4 (verificación con recibo): `scripts/verify-receipt.mjs`, `verify-security-baseline.mjs` y
`verify-repo-clean.mjs`. Gate 5 (producción atada al sha): `verify-aprobacion-humana.mjs` en modo
`produccion`. Gate 8 (CI sólo en el push único o el de corrección): `verify-ci-push.mjs check`.
Los gates 4 y 5 están protegidos.

## Modelo
Scripts para los gates. Nivel fuerte para la revisión, distinto del que construyó.
