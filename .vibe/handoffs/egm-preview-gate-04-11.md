# Handoff — EGM + preview antes de construir (04-11-2026)

**Rama:** `feat/egm-preview-gate`, cortada de `feat/escalera-8-niveles` (0558f69, todavía sin merge a
`main`). Sin push (LAW 9): el push y el merge salen una vez, al cerrar, con el «sí» del operador.

## Qué se agregó

- **LAW 10 — Preview antes de construir** y **LAW 11 — Producción sólo con orden explícita y
  vigente** en `SKILL.md` § LAWS. Las dos se leen de `.vibe/APROBACIONES.md` (tabla de 8 columnas,
  fechas `DD-MM-AAAA HH:MM`, sólo se agregan filas).
- **Gate `scripts/verify-aprobacion-humana.mjs`**: `preview` (PHASE 3), `tareas` (Build, antes del
  rojo de cada tarea `visible: true`), `produccion --sha` (8.1, antes del 🔵 de producción; la orden
  vale una vez y se cierra con la fila `usada`). Un `quien` que sea agente, modelo o sesión rechaza.
- **Revisión goldfish (EGM)** como etapa de PHASE 3 (`phases/04-spec.md` § Revisión goldfish (EGM) y
  preview) y del plan con riesgo medio o más (`phases/05-plan.md`): cómo invocar `/egm:*` en Claude
  Code, paneles, severidades, resolve como menú 🔵, convergencia (2 rondas limpias; 1 con riesgo bajo o
  medio y motivo escrito), tope de 5, y qué hacer sin subagentes frescos (EGM frena).
- **Gate `scripts/verify-egm-convergencia.mjs`** sobre `docs/egm/<pieza>.json` (`ia.egm-rondas/1`).
- **Panel de audiencia** en `skills/egm-panel-audiencia.md` (scroller, escéptico, primerizo, comprador).
- **`context-guard`**: handoff al 70 % (`contracts/model-routing.json` `aviso_desde: 0.7`).
- **Aprendizajes oct-nov 2026** como tabla con detector en `phases/00-reglas-extendidas.md`; los tres
  sin detector quedan en `.vibe/DEBT.md` (`id:egm041`).
- Registro en `contracts/ia-stack-index.json` (incluye los 4 handoffs de la 3.4.1 que el índice no
  declaraba: el gate de índice ya estaba rojo en la base), `contracts/empty-probe.json`,
  `skills/gates.md`, `tests/fixtures/gates-3.4.0.json` y `CHANGELOG.md`.

## Rojo visible antes de cada verde

- `tests/context-guard.test.mjs` + `tests/presupuesto-contexto.test.mjs`: 4 fallas con el contrato
  al 80 %, verde tras bajarlo al 70 %.
- `tests/verify-aprobacion-humana.test.mjs` y `tests/verify-egm-convergencia.test.mjs`:
  `ERR_MODULE_NOT_FOUND` antes de existir el gate; después 3 y 1 fallas de aserción que llevaron a
  arreglos; verde con cobertura 100 % de líneas, ramas y funciones de cada gate.

## Pendiente / cómo retomar

1. Decisiones abiertas para el operador (abajo).
2. Reinstalar el runtime en los proyectos (`scripts/install.*`) cuando se mergee, para que
   `.vibe/ia-stack-runtime/` traiga los gates nuevos.
3. Detectores de `id:egm041` (Dueños, choque entre sesiones, reserva de migraciones).

## Decisiones del operador (04-11-2026, vía el orquestador)

- K = 1 alcanza en spec o plan de riesgo bajo o medio; riesgo alto (plata, auth, migraciones,
  seguridad) y toda pieza pública, siempre 2. Aplicado en `verify-egm-convergencia` con rojo primero.
- Pieza pública de riesgo bajo o medio: 6 revisores por ronda (audiencia + `design_critic` +
  `implementation_readiness`); riesgo alto, 9.
- `.vibe/APROBACIONES.md` queda en Markdown.
- Push único a `main` con las dos ramas: el merge local está hecho; el push espera la confirmación
  directa del operador en su conversación (LAW 11: un «sí» reenviado por un agente no vale).

## 3.4.2 (04-11-2026)

- EGM revisado contra el plugin instalado `egm@egm` 0.1.0 (`~/.claude/plugins/cache/egm/egm/0.1.0`):
  nombres reales de los revisores (`egm-zoom-out`, `egm-comprehension`, `egm-design`,
  `egm-structural`, `egm-style`, `egm-implementation-readiness`, `egm-codebase-details`; tipo de
  Agent `egm:<nombre>`), las cinco etapas en orden de `/egm:egm-review`, que la persona escribe las
  skills (traen `disable-model-invocation`), `egm-review-loop`/`egm-resolve` leídos y seguidos en el
  mismo hilo, directorio de artefactos, permisos de lectura del caché y Claude Code ≥ 2.1.271.
- LAW 10 ampliada: preview antes de escribir código, también del diseño técnico; `tareas` exige
  `preview` en toda tarea (pieza aprobada o `no-aplica: <motivo>`).
- Versión 3.4.2 en `SKILL.md` y `CHANGELOG.md`; etiqueta `v3.4.2` local.
