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
4. Ronda de brainstormings sobre la spec: los 5 pasos de `skills/brainstorm-egm.md`, en nivel fuerte.
5. Rondas de EGM con lectores de nivel fuerte: 2 en medio, 4 en grande. Cada lector recibe sólo la
   spec. Mínimo 5 rondas; si la quinta trae algo, se sigue hasta una limpia; máximo 10.
6. Resolvé cada hallazgo: aplicalo o descartalo con el motivo en una línea.
7. Registrá cada ronda: `node scripts/metricas.mjs egm --pieza spec --lectores <n> --ronda <n>
   --altos <n> --medios <n> --bajos <n>` (sólo los hallazgos aplicados).
8. Si la ronda 10 no sale limpia, decide la persona: se registra con `--decide-persona`.
9. Actualizá `.ia-stack/ESTADO.md`.

## Entrega
`docs/spec.md` en borrador, con la última ronda de EGM limpia, o con la décima aceptada por la persona.

## Gate
`node scripts/verify-egm-convergencia.mjs check --pieza spec --tamano <medio|grande>`: pasa con 5 a
10 rondas y la última limpia, o con la décima si la persona decidió.

## Modelo
Nivel fuerte para escribirla, para la ronda de brainstormings y para los lectores EGM. En tamaño
chico esta fase no se recorre.
