# IA Stack

Antes de operar, leé `SKILL.md` (el núcleo) y `.ia-stack/ESTADO.md` (dónde quedó el trabajo). De
las fases leé **sólo la que está en curso**, en `phases/`. En un proyecto con IA Stack instalado
están en `.ia-stack/runtime/SKILL.md` y `.ia-stack/runtime/phases/`.

Reglas que no dependen de la fase:

- Preguntá antes de suponer: una tanda de preguntas por fase, con opciones y la recomendada primero.
- Sin test rojo visible no hay código. Nada visible se construye sin preview aprobado.
- Primero un script; si no alcanza, el modelo más barato que resuelva. Esfuerzo `low` siempre.
- Los gates son scripts de `scripts/*.mjs` (Node nativo, sin dependencias): se corren, no se narran.
- Un solo push al terminar, con todo verde. Producción sólo con orden explícita de la persona.
- Al cerrar no quedan temporales ni sesiones abiertas. Archivar nunca es borrar.

Este archivo es un puntero, no una copia: si dice algo distinto de `SKILL.md`, manda `SKILL.md`.
