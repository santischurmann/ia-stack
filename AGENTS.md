# VibeCodeProtocols

El protocolo vive en `SKILL.md`. **Leelo entero antes de operar**: son 9 fases con gates
mecánicos, y saltarse uno invalida el resto.

Reglas que no dependen de la fase:

- Cada decisión se presenta como **menú de opciones en lista Markdown**, con una recomendación
  explícita, y se espera la respuesta antes de seguir. Nunca una pregunta abierta para una
  decisión de protocolo.
- Sin test rojo visible no hay implementación.
- Los gates viven en `scripts/*.mjs`, son Node nativo sin dependencias y se corren, no se narran.

Este archivo es un puntero, no una copia: si dice algo distinto de `SKILL.md`, manda `SKILL.md`.
