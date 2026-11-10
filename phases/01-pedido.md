# Fase 1 · Pedido

## Para qué
Entender qué quiere la persona y dejarlo por escrito con criterios que se puedan comprobar.

## Entra
- Lo que la persona pidió, con sus palabras.
- `.ia-stack/ESTADO.md`.

## Pasos
1. Hacé una sola tanda de preguntas, cada una con opciones y la recomendada primero: qué quiere
   lograr, para quién, qué tiene hecho, qué no debe pasar y «¿toca plata, seguridad,
   autenticación o migra datos?».
2. Si hay al menos dos enfoques razonables, brainstorming (`skills/brainstorm-egm.md`): mínimo,
   equilibrado y ambicioso, cada uno con costo, riesgo y qué deja afuera. La persona elige o mezcla.
3. Repetí el pedido en 3 líneas y pedí confirmación. Si no coincide, corregí y repetí una vez.
4. Fijá el tamaño con las respuestas: `node scripts/tamano.mjs --archivos <n> [--pantalla-nueva]
   [--proyecto-nuevo] [--riesgo plata|seguridad|auth|migracion]`. Para un cambio ya hecho:
   `--diff <base>`. Ante la duda, el tamaño mayor.
5. Escribí `docs/pedido.md` con `templates/pedido.md`: qué, para quién, qué no, y criterios de
   aceptación numerados, cada uno con una forma de comprobarlo.
6. Anotá tamaño y recorrido en `.ia-stack/ESTADO.md`.
7. Pedí la aprobación 1: que la persona escriba en el chat **«apruebo pedido v1»**. El hook
   `node scripts/aprobar.mjs hook` la registra en `.ia-stack/APROBACIONES.md`. Sin hook:
   `node scripts/aprobar.mjs registrar --tipo pedido --ref v1 --texto "<lo que escribió>"`.

## Entrega
`docs/pedido.md` aprobado. En tamaño chico, este archivo hace de spec: llevá el qué, el qué no y
los criterios con el mismo detalle que llevaría una spec.

## Gate
Aprobación 1, registrada en `APROBACIONES.md`. No hay script que frene acá.
Chico con cambio visible: mostrá un boceto, pedí **«apruebo boceto v1»** y declaralo en el campo
`preview` de la tarea en `docs/tasks.json` (valor `boceto`). Sin eso la fase 7 no arranca.

## Modelo
Sesión principal. Nada se delega: la conversación con la persona no se reparte.
