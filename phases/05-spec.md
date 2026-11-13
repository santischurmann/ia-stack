# Fase 5 · Spec

## Para qué
Escribir en una página lo que se va a construir, para que alguien que no vio la conversación
pueda implementarlo.

## Entra
- `docs/pedido.md`, `docs/caio.md` y `docs/research.md` (los que existan).
- `docs/marca.md`, si hay pantallas.

## Pasos
1. Si la tecnología admite al menos dos caminos razonables, brainstorming
   (`skills/brainstorm-egm.md`): tres alternativas, la persona elige.
2. Escribí `docs/spec.md` con `templates/spec.md`, en una página:
   - qué se construye;
   - qué no se construye;
   - tecnología con versiones fijadas (las del radar);
   - criterios de aceptación numerados y medibles, los del pedido más los técnicos.
3. Marcala como borrador. No se congela hasta que la persona apruebe el preview (fase 6).
4. Corré el panel EGM según el tamaño (`skills/brainstorm-egm.md`): medio 2 lectores, grande 4.
   Cada lector recibe sólo la spec.
5. Resolvé cada hallazgo: aplicalo o descartalo con el motivo en una línea.
6. Registrá cada ronda: `node scripts/metricas.mjs egm --pieza spec --lectores <n> --ronda <n>
   --altos <n> --medios <n> --bajos <n>`. Máximo 2 rondas; la segunda sólo si quedaron altos.
7. Si después de la ronda 2 quedan altos, decide la persona.
8. Si la persona pidió la ronda de brainstormings + EGM: completa, en Opus (`skills/brainstorm-egm.md`).
9. Actualizá `.ia-stack/ESTADO.md`.

## Entrega
`docs/spec.md` en borrador, sin hallazgos altos abiertos, o con altos que la persona aceptó.

## Gate
`node scripts/verify-egm-convergencia.mjs check --pieza spec --tamano <medio|grande>`: pasa si la
última ronda no tiene altos o si la persona decidió.

## Modelo
Nivel fuerte para escribirla. Lectores EGM: barato y medio; el de diseño sube a fuerte sólo si
hay área de riesgo.
