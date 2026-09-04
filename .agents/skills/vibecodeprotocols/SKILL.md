---
name: vibecodeprotocols
description: Protocolo de 9 fases con gates mecánicos para investigar, diseñar, construir, verificar y publicar software con agentes. Sin test rojo visible no hay implementación. Cada decisión se presenta como menú de opciones con recomendación explícita.
---

# VibeCodeProtocols

**Leé el protocolo entero antes de operar**: son once fases encadenadas por gates que se ejecutan, y
saltarse uno invalida lo que sigue. Vive en uno de estos dos lugares, según cómo llegó VCP acá:

- `SKILL.md` en la raíz — este es el repositorio de VCP.
- `.vibe/vcp-runtime/SKILL.md` — VCP está instalado como herramienta en este proyecto.

Este archivo es un **puntero, no una copia**. Codex descubre skills de repositorio sólo en
`.agents/skills/<nombre>/SKILL.md` y en `.codex/skills/<nombre>/SKILL.md` — verificado ejecutando:
un `SKILL.md` suelto en la raíz y los `skills/*.md` le son invisibles. Una copia acá se
desincronizaría del original y ningún gate las mantendría iguales, así que apunta en vez de copiar.
Si este archivo dice algo distinto de `SKILL.md`, manda `SKILL.md`.

## Lo que no depende de la fase

- **Cada decisión se presenta como menú de opciones en lista Markdown**, con recomendación
  explícita, y se espera la respuesta antes de seguir. Nunca una pregunta abierta para una decisión
  de protocolo. La forma exacta la verifica `scripts/verify-menu-shape.mjs`.
- **Sin test rojo visible no hay implementación.**
- Los gates viven en `scripts/*.mjs`, son Node nativo sin dependencias, y **se corren, no se
  narran**: un gate que no se ejecutó no es evidencia de nada.
- Nada se declara terminado sin la salida real del comando que lo prueba.

## Sub-skills

Las doce sub-skills están junto al protocolo, en `skills/*.md` (o `.vibe/vcp-runtime/skills/*.md`): los subagentes de cada rol
(`subagent-red`, `subagent-green`, `subagent-refactor`, `subagent-triangulate`, `subagent-docs`,
`subagent-chore`), el orquestador (`orchestrator-opus`), las plantillas de spec y plan
(`spec-plan-templates`), la memoria (`vibe-memory`), la línea base de seguridad
(`security-baseline`), el empaquetado (`deploy-zip`) y el modo de escritura (`caveman-tdd`).
