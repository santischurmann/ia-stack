# Spec: vcp-hardening-round5-adoptar-candidates

**Date:** 2026-08-17
**Version:** 1.0
**Author:** Opus (VibeCodeProtocols) — meta: VCP mejorándose a sí mismo, formato de spec.md real de VCP
**Status:** Implemented — T01–T05 fueron aplicadas en `98d2058`; esta revisión reconcilia el
estado documental y cierra T06–T07.

---

## Problem / Problema

4 rondas de investigación real (13 fuentes, ~30 agentes independientes, evidencia con
file:line/SHA/commit) encontraron 5 candidatos de costo bajo-medio con veredicto **Adoptar**
tras una pasada final de refutación adversarial. Sin este spec, esos hallazgos quedan como
prosa dispersa en `research/vcp-improvement-proposal.md` — este documento los convierte en ACs
testeables y un plan de tareas atómicas, tal como VCP le exigiría a cualquier feature real.

---

## Target Users / Usuarios

El propio protocolo VCP (SKILL.md, skills/*.md) y cualquier usuario que corra Phase 4 (Security,
LESSONS, DEBT) en un proyecto real. Beneficio directo: menos re-litigar hallazgos ya conocidos,
mensajes de rechazo más claros, dedup de lecciones más confiable.

---

## Acceptance Criteria / Criterios de aceptación

- [x] **AC1 (IRON LAW):** GIVEN el orchestrator está por cerrar Phase 4.4 o 4.6, WHEN redacta su
  reporte de verificación, THEN `SKILL.md` contiene una lista verbatim de 4 racionalizaciones
  prohibidas ("debería funcionar ahora" / "estoy seguro" / "ya lo probé antes" / "es un cambio
  trivial") junto al principio "trust what's derived, not narrated" existente.
- [x] **AC2 (dedup LESSONS):** GIVEN una lección candidata en el 🔵 confirm-gate de Phase 4.8,
  WHEN se compara contra `LESSONS.md` existente para detectar duplicados, THEN
  `skills/vibe-memory.md` § LESSONS PROTOCOL especifica explícitamente normalización
  (minúsculas + espacios colapsados) antes de la comparación.
- [x] **AC3 (pre-chequeo sensible):** GIVEN una lección candidata contiene alguna de las palabras
  `token|authorization|cookie|secret|hash|password|bearer`, WHEN se muestra en el 🔵 confirm-gate,
  THEN aparece marcada con una advertencia visible (⚠) en vez de mostrarse sin señalizar.
- [x] **AC4 (missing vs corrupt receipt, documentación):** GIVEN alguien lee
  `scripts/verify-receipt.mjs` o `SKILL.md` § 4.5/4.6, WHEN busca entender qué significa cada
  mensaje de rechazo, THEN existe una nota explícita agrupando los 3 mensajes de error actuales
  en 2 categorías (ausente=reparable regenerando / corrupto=siempre requiere receipt nuevo) —
  **sin cambiar el comportamiento del script**, solo documentándolo.
- [x] **AC5 (baseline-diff DEBT.md):** GIVEN Phase 4.3 loguea un finding Medium/Low a
  `.vibe/DEBT.md`, WHEN se escribe la entrada, THEN incluye un campo `id` corto (hash de
  categoría+ubicación+regla) además de los campos ya existentes (Location/Severity/
  Description/Why deferred).
- [x] **AC6 (edge, AC1):** GIVEN el orchestrator ya tenía texto sobre "trust what's derived" antes
  de este cambio, WHEN se agrega la lista de 4 frases, THEN el texto existente NO se borra ni
  se contradice — se complementa.
- [x] **AC7 (error, AC5):** GIVEN dos findings distintos generan el mismo `id` corto por
  coincidencia de hash, THEN el formato de DEBT.md permite distinguirlos igual por
  fecha+ubicación (el `id` es una ayuda, no la única clave de unicidad).

**Requirement grammar:** sin `[NEEDS CLARIFICATION]` pendientes — los 5 candidatos ya pasaron
verificación exacta de mecánica en la pasada de decisión final (ver
`research/source-matrix.md` y los `research/sources/*.md` correspondientes).

---

## Constraints / Restricciones

- Cero dependencias nuevas — todos los cambios son texto (Markdown) o lógica mínima ya en JS
  puro dentro de `skills/vibe-memory.md` (protocolo, no código ejecutable nuevo).
- No modificar `scripts/verify-receipt.mjs` para AC4 — es documentación, no código (evita
  reabrir el hardening de gates ya cerrado en pasadas anteriores).
- Mantener el patrón 🔵 multiple-choice existente — cada AC se implementa solo si el usuario
  elige la opción A) correspondiente en `research/vcp-improvement-proposal.md`.

---

## Non-Goals / No-Goals

Este spec NO cubre:
- `slop-diff.ts` (bloquear solo findings nuevos) — veredicto final: no implementar, mecanismo
  frágil sin scanner propio.
- Hook PreToolUse de bloqueo pre-escritura (claude-seo-ai + gstack) — candidato fuerte pero
  requiere verificar soporte de plataforma primero, no es un cambio de texto simple.
- Capability-tiering generalizado a 4.3/4.4, checklist mecánico de spec, Risk Score en 4.3 —
  válidos pero de costo medio/alto, quedan para un spec separado si se aprueban.
- Cualquier cambio a `paperclip`/`gstack`/`gentle-ai`/`agency-agents`/`engram` como dependencias
  — VCP sigue sin dependencias externas nuevas.
- Motor SQL de migraciones, budget enforcement automático — explícitamente skip, requieren
  infraestructura que VCP no tiene por diseño.

---

## Stack & Dependencies

- **Stack:** Markdown (SKILL.md, skills/*.md) — sin código ejecutable nuevo salvo el formato de
  entrada de DEBT.md (sigue siendo Markdown, no JSON).
- **Test runner:** `verify-vcp-contract.mjs` (33 checks) + tests de contrato; los AC de wording se
  verifican mediante el contrato textual y revisión de diff.
- **New dependencies:** none

---

## Definition of Done (DoD)

- [x] Los 5 ACs (AC1-AC5) reflejados en los archivos correspondientes, verificados por lectura
- [x] AC6/AC7 (edge/error) confirmados por revisión y contrato textual
- [x] `CHANGELOG.md` con una entrada nueva describiendo los 5 cambios
- [x] `research/vcp-improvement-proposal.md` reconciliado con el estado implementado
- [x] Ningún archivo de `scripts/` con código nuevo en esta ronda documental

---

# Plan: vcp-hardening-round5-adoptar-candidates

**Date:** 2026-08-17
**Spec:** este mismo documento (arriba)
**Status:** Complete — T01–T07 reconciliadas con el árbol actual.

---

## Task Breakdown

| ID | Description | Files | Depends on |
|----|-------------|-------|------------|
| T01 | Agregar lista IRON LAW (4 frases) junto a "trust what's derived, not narrated" | `SKILL.md` | — |
| T02 | Agregar regla de normalización (dedup) al § LESSONS PROTOCOL | `skills/vibe-memory.md` | — |
| T03 | Agregar pre-chequeo de 7 keywords sensibles antes del 🔵 confirm-gate de LESSONS | `skills/vibe-memory.md` | T02 (mismo bloque, evita conflicto de edición) |
| T04 | Documentar la distinción ausente-vs-corrupto sobre los 3 mensajes YA existentes de `verify-receipt.mjs` | `SKILL.md` § 4.5/4.6 | — |
| T05 | Agregar campo `id` corto al formato de entrada de `.vibe/DEBT.md` | `skills/vibe-memory.md` (WRITE FORMATS § DEBT.md entry), `templates/vibe/DEBT.md` | — |
| T06 | Actualizar `research/vcp-improvement-proposal.md` marcando T01-T05 como implementados, con file:line real post-cambio | `research/vcp-improvement-proposal.md` | T01-T05 |
| T07 | Entrada de `CHANGELOG.md` describiendo los 5 cambios, citando las fuentes (gstack/engram×2/paperclip) | `CHANGELOG.md` | T01-T05 |

---

## Execution Order (topológico)

1. **T01** — independiente, solo SKILL.md
2. **T02** — independiente, solo vibe-memory.md (bloque LESSONS PROTOCOL)
3. **T03** — depende de T02 (mismo archivo, mismo bloque — hacerlas juntas evita 2 pasadas de
   edición sobre el mismo párrafo)
4. **T04** — independiente, SKILL.md (bloque distinto de T01, sin conflicto)
5. **T05** — independiente, vibe-memory.md (bloque DEBT.md, distinto del bloque LESSONS de T02/T03)
6. **T06, T07** — al final, después de que T01-T05 tengan sus file:line reales para citar

---

## Risk Notes

- T01 y T04 tocan `SKILL.md` en bloques distintos (§4.4/principios vs §4.5/4.6) — sin overlap,
  pero conviene aplicarlas en la misma sesión para evitar 2 diffs separados sobre el mismo archivo.
- T02/T03 y T05 tocan `skills/vibe-memory.md` en bloques distintos (LESSONS PROTOCOL vs DEBT.md
  entry format) — mismo archivo, sin overlap de líneas.
- Ninguna tarea toca `scripts/verify-receipt.mjs`, `scripts/verify-red.sh`, `scripts/verify-red.ps1`
  ni `templates/tasks.json` — cero riesgo de reabrir el hardening de gates ya cerrado y
  re-verificado en pasadas anteriores.
- Riesgo bajo global: `risk_level` esperado = bajo (0 `risk_reasons` — no toca `simplify-ignore`,
  no toca paths sensibles, cambios <400 líneas totales, sin reabrir DEBT.md existente).

---

## Subagent assignments

Dado que son cambios de texto puro (no código con tests unitarios), el ciclo
RED→GREEN→TRIANGULATE→REFACTOR no aplica literalmente — la "prueba" es la revisión de que el
texto resultante cumple el AC correspondiente, palabra por palabra. Rol sugerido: el propio
orchestrator aplica cada tarea (Docs role), sin necesidad de subagentes separados dado el bajo
riesgo y la naturaleza textual — a menos que el usuario prefiera el ciclo completo por
consistencia con el resto del protocolo.

```
🔵 CONFIG — antes de empezar Build (Phase 3 equivalente):
A) Aplicar las 7 tareas ahora, todas juntas, una sola revisión final — RECOMENDADO (cambios de
   texto de bajo riesgo, ya verificados en la investigación)
B) Aplicar tarea por tarea con 🔵 confirm individual entre cada una
C) Elegir un subconjunto de T01-T05 (decime cuáles) y dejar el resto para después
D) No implementar nada todavía — solo quería el spec para decidir más tarde
```
