---
name: ia-stack
description: Protocolo de once fases con gates que se ejecutan, para construir software con agentes sin romper lo que ya anda. Usalo al empezar o retomar un proyecto, al pedir una funcionalidad o un arreglo, o antes de publicar. Dice dónde está el protocolo completo y qué leer en cada fase.
---

# IA Stack

**Antes de operar, leé el protocolo por su § MAPA DE LECTURA**: el contrato interno, las leyes,
el mapa y la sección de la fase en curso. Son once fases encadenadas por gates que se ejecutan, y
saltarse uno invalida lo que sigue. Vive en el primero de estos lugares que exista:

- `SKILL.md` en la raíz — este es el repositorio de IA Stack.
- `.vibe/ia-stack-runtime/SKILL.md` — IA Stack está instalado como herramienta en este proyecto.
- `~/.claude/ia-stack-runtime/SKILL.md` — la instalación global, para un proyecto que todavía no lo tiene.

Este archivo es un **puntero, no una copia**, y es el mismo en los tres lugares donde lo deja el
instalador: `.claude/skills/ia-stack/` (Claude Code), `.agents/skills/ia-stack/` (Codex) y
`~/.claude/skills/ia-stack/` (global). Cada host descubre skills sólo en `<carpeta>/<nombre>/SKILL.md`:
un `SKILL.md` suelto en la raíz, los `skills/*.md` o un `.md` suelto en `skills/` le son invisibles.
Hasta la 3.3.0 el instalador dejaba ahí los 162 KB del protocolo como archivo suelto, y `/ia-stack` nunca
apareció en Claude Code. Una copia acá se
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

Las sub-skills están junto al protocolo, en `skills/*.md` (o `.vibe/ia-stack-runtime/skills/*.md`); entre ellas, los subagentes de cada rol
(`subagent-red`, `subagent-green`, `subagent-refactor`, `subagent-triangulate`, `subagent-docs`,
`subagent-chore`), el orquestador (`orchestrator-opus`), las plantillas de spec y plan
(`spec-plan-templates`), la memoria (`vibe-memory`), la línea base de seguridad
(`security-baseline`), el empaquetado (`deploy-zip`), el gate TDD (`caveman-tdd`) y el modo breve, el caveman interno (`modo-breve`). El modelo de cada rol sale de `contracts/model-routing.json`.
