# Spec: eleccion-de-stack

**Fecha:** 2026-09-14 · **Estado:** en redacción — la escribe la fase 3, después del research
La spec anterior (`lanzamiento-ia-stack`, **implementada**, sus nueve etapas cerradas y publicadas)
se recupera entera con `git show 7d98266:docs/spec.md`.

---

## Todavía no está escrita, y por qué

Este archivo existe para que los documentos no se contradigan sobre en qué se está trabajando, no
para adelantar contenido. La spec se escribe en la **fase 3**, y no antes: hacerlo ahora obligaría a
inventar criterios de aceptación sobre versiones que el research todavía no verificó, que es
exactamente el orden que el protocolo prohíbe.

Mientras tanto el alcance vive donde corresponde: `.vibe/SESSION.md` declara la funcionalidad, el
objetivo y lo que queda fuera, y `docs/phase-plan.json` declara el orden de fases de este ciclo
(`1.5`, `2`, `3`).

## Qué va a congelar cuando se escriba

Cinco cosas, en tablas y no en prosa, porque el tope de 650 palabras cuenta narración:

1. La novena pregunta de Intake —el tipo de producto— y su enum A-H.
2. La forma de `contracts/free-tier-limits.json` y del artefacto `stack-matrix.json`.
3. Los tres adaptadores de test rojo y la lista blanca del despachador.
4. Los arreglos de vocabulario de fases y su detector.
5. Dónde quedó el expediente de fases archivado.

## Límite de este archivo

No es una spec: es un encabezado que declara identidad. Ningún gate de calidad lo aprueba todavía, y
no debería. `verify-spec-wordcap.mjs check docs/spec.md --quality` va a rechazarlo hasta que la
fase 3 lo complete, y ese rechazo es correcto.
