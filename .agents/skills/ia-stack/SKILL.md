---
name: ia-stack
description: Método de trabajo para construir software con un agente LLM gastando lo mínimo, en 10 fases con gates que se ejecutan. Usalo al empezar o retomar un proyecto, al pedir una funcionalidad o un arreglo, o antes de publicar. Dice dónde está el protocolo y qué leer en cada fase.
---

# IA Stack

**Antes de operar, leé `SKILL.md` (el núcleo) y después sólo la fase en curso.** Vive en el primero
de estos lugares que exista:

- `SKILL.md` en la raíz: este es el repositorio de IA Stack.
- `.ia-stack/runtime/SKILL.md`: IA Stack está instalado en este proyecto.
- `~/.claude/ia-stack-runtime/SKILL.md`: instalación global.

Este archivo es un **puntero, no una copia**. Es el mismo en `.claude/skills/ia-stack/`,
`.agents/skills/ia-stack/` y `~/.claude/skills/ia-stack/`, porque cada host sólo descubre skills en
`<carpeta>/<nombre>/SKILL.md`. Si dice algo distinto de `SKILL.md`, manda `SKILL.md`.

## Lo que no depende de la fase

- Las 10 fases están en `phases/` (`00-arranque.md` a `09-cierre.md`).
- Las skills de apoyo están en `skills/`: `brainstorm-egm`, `encargo`, `modo-breve`,
  `recibo-y-seguridad`, `stack` y `tdd`.
- Sin test rojo visible no hay implementación. Nada visible se construye sin preview aprobado.
- Los gates viven en `scripts/*.mjs`, son Node nativo y se corren, no se narran.
- Nada se declara terminado sin la salida real del comando que lo prueba.
