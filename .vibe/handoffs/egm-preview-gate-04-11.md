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

## Decisiones para el operador

- ¿K = 1 ronda limpia alcanza con riesgo bajo o medio, o se exige siempre 2 como pide EGM?
- ¿El registro `.vibe/APROBACIONES.md` en Markdown con `DD-MM-AAAA HH:MM` está bien, o lo querés en JSON?
- ¿Una pieza pública de riesgo medio también corre el panel de audiencia completo (9 agentes por ronda)?
- ¿Se mergea esta rama junto con `feat/escalera-8-niveles` en un solo push?
