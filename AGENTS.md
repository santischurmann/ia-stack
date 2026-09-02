# VibeCodeProtocols

**Leé el protocolo entero antes de operar**: son 9 fases con gates mecánicos, y saltarse uno
invalida el resto. Está en `SKILL.md` si este es el repositorio de VCP, o en
`.vibe/vcp-runtime/SKILL.md` si VCP está instalado acá como herramienta.

Reglas que no dependen de la fase:

- Cada decisión se presenta como **menú de opciones en lista Markdown**, con una recomendación
  explícita, y se espera la respuesta antes de seguir. Nunca una pregunta abierta para una
  decisión de protocolo.
- Sin test rojo visible no hay implementación.
- Los gates viven en `scripts/*.mjs`, son Node nativo sin dependencias y se corren, no se narran.

- La limpieza de PHASE 9 **no borra nada**: archiva y deja un comando de vuelta atrás.

Este archivo es un puntero, no una copia: si dice algo distinto del protocolo, manda el protocolo.
