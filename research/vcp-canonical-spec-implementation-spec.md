# Spec: vcp-canonical-delta-spec

**Date:** 2026-08-20
**Version:** 1.0
**Author:** Sonnet 5 (VibeCodeProtocols) — VCP mejorándose a sí mismo, formato de spec.md real de VCP
**Status:** Draft — **NADA de esto se implementó todavía, espera tu 🔵 en cada AC/tarea**

---

## Problem / Problema

VCP hoy produce un `docs/spec.md` **por feature** (Phase 1), que se lee una vez y se archiva
implícitamente cuando la feature cierra. No existe ningún artefacto que responda "¿qué hace el
sistema completo, HOY?" sin leer el código — quien llega nuevo a un proyecto que usó VCP en 10
features distintas tiene que reconstruir el estado actual leyendo 10 specs históricas + el código,
porque ninguna de ellas es la fuente de verdad vigente. `research/sources/protocolo-muralla.md`
puntos #9/#10 documentan la alternativa real de otro protocolo: una spec canónica por dominio que
se actualiza por delta (`ADDED`/`MODIFIED`/`REMOVED`/`RENAMED`) en cada feature, nunca se pudre, y
el delta de cada feature se archiva con fecha como registro histórico del "por qué".

---

## Target Users / Usuarios

Cualquier proyecto VCP con más de 1-2 features shippeadas — el valor crece con el número de
features acumuladas. Beneficio directo: onboarding sin leer código, Phase 0 Bootstrap con
contexto real del sistema (hoy solo lee `PROJECT.md`/`SESSION.md`/`DECISIONS.md`, ninguno es una
spec funcional viva), y una fuente de verdad auditable para qué requisitos existen.

---

## Acceptance Criteria / Criterios de aceptación

- [ ] **AC1 (estructura):** GIVEN un proyecto nuevo bajo VCP, WHEN corre Phase 0 Bootstrap, THEN
  existe (o se crea desde template) `specs/{dominio}/spec.md` — un archivo por dominio funcional
  del proyecto (no uno global monolítico), con secciones de requisitos en formato RFC 2119 +
  GIVEN/WHEN/THEN, igual convención que `docs/spec.md` de feature ya usa hoy.
- [ ] **AC2 (delta, 4 operaciones tipadas):** GIVEN Phase 1 de una feature que toca un dominio con
  spec canónica existente, WHEN se escribe `docs/spec.md` de esa feature, THEN cada requisito
  nuevo/tocado se declara como `ADDED` (aparece por primera vez), `MODIFIED` (reemplaza un
  requisito existente — **el bloque completo se copia entero antes de editar**, nunca parcial),
  `REMOVED` (con motivo obligatorio + migración recomendada), o `RENAMED` (nombre viejo → nuevo +
  migración de referencias) — mismo vocabulario que `research/sources/protocolo-muralla.md`
  `plantillas/spec-delta.md`.
- [ ] **AC3 (merge mecánico en Phase 7/4.7):** GIVEN una feature cierra (Phase 4.6 post-commit),
  WHEN el delta tiene operaciones declaradas, THEN cada operación se aplica a
  `specs/{dominio}/spec.md`: `ADDED` appendea, `MODIFIED` reemplaza el bloque entero identificado
  por nombre de requisito, `REMOVED` borra el bloque, `RENAMED` renombra preservando el resto del
  contenido — el merge es mecánico (script determinista), no una reescritura libre del modelo.
- [ ] **AC4 (archivo con fecha, nunca se edita ni se borra):** GIVEN el merge del AC3 se aplicó,
  WHEN la feature cierra, THEN el `docs/spec.md` de esa feature se copia (no se mueve — el
  original de Phase 1 vive donde vivió siempre) a
  `.vibe/spec-archive/<feature-slug>-<fecha>.md` — registro permanente del "por qué llegamos acá",
  igual función que `.vibe/receipts/` para evidencia de gates.
- [ ] **AC5 (Bootstrap lee la canónica):** GIVEN Phase 0 Bootstrap arranca en un proyecto con
  `specs/` existente, WHEN reporta memoria cargada (paso 7), THEN incluye qué dominios tienen spec
  canónica y su fecha de última actualización — visible antes de que el usuario pida nada.
- [ ] **AC6 (edge — dominio nuevo):** GIVEN una feature toca un dominio sin `specs/{dominio}/
  spec.md` todavía, WHEN se aplica el merge del AC3, THEN se crea el archivo nuevo (todo el delta
  es efectivamente `ADDED`) — no es un error, es el caso esperado la primera vez que un dominio
  se toca.
- [ ] **AC7 (error — merge ambiguo):** GIVEN un `MODIFIED` referencia un nombre de requisito que
  NO existe en la canónica actual (typo, o el requisito ya fue `RENAMED`/`REMOVED` por otra
  feature en paralelo), WHEN el merge mecánico corre, THEN falla explícito (no crea un requisito
  nuevo por accidente, no ignora el delta en silencio) y reporta al usuario para resolución manual
  — mismo espíritu que `verify-receipt.mjs` fallando cerrado ante ambigüedad.

**Requirement grammar:** sin `[NEEDS CLARIFICATION]` pendientes.

---

## Constraints / Restricciones

- Cero dependencias nuevas — el merge mecánico es un script Node puro (mismo estilo que
  `verify-receipt.mjs`/`ratchet.mjs`/`pretooluse-red.mjs`), no un parser de Markdown externo.
- No reabrir `scripts/verify-red.sh`/`.ps1`/`verify-receipt.mjs` — feature ortogonal, gates
  hardeneados existentes quedan intocados.
- `docs/spec.md` de feature (Phase 1, formato actual) NO desaparece — sigue siendo el artefacto de
  trabajo de la feature. `specs/{dominio}/spec.md` es nuevo y adicional, no un reemplazo.
- El merge debe ser determinista y re-ejecutable: correrlo dos veces sobre el mismo delta +
  misma canónica da el mismo resultado (idempotente para el caso sin conflicto).

---

## Non-Goals / No-Goals

- Parser de Markdown genérico / AST de Markdown — el merge mecánico opera sobre el formato
  estructurado específico de VCP (headers `### Requisito: <nombre>` + operación declarada), no
  Markdown arbitrario.
- Resolución automática de conflictos cuando 2 features en paralelo tocan el mismo requisito —
  AC7 falla explícito, la resolución es manual (🔵 al usuario), no hay merge de 3 vías.
- Migrar retroactivamente las specs de features ya cerradas de proyectos VCP existentes a este
  formato — el sistema arranca desde el primer uso post-adopción, no reconstruye historia.
- UI/visualización de la spec canónica — sigue siendo un `.md` plano, igual que todo lo demás
  en `.vibe/`.

---

## Stack & Dependencies

- **Stack:** Markdown (`specs/`, `.vibe/spec-archive/`) + 1 script Node nuevo para el merge
  mecánico (`scripts/spec-merge.mjs`), mismo patrón sin-deps que los 3 scripts de gate existentes.
- **Test runner:** `node --test` — el script de merge lleva tests `FALSIFICACIÓN ·` igual que
  `ratchet.mjs`/`pretooluse-red.mjs` (proponer un merge ambiguo y confirmar que rechaza, no que
  adivina).
- **New dependencies:** none.

---

## Definition of Done (DoD)

- [ ] AC1-AC7 reflejados en código/templates, verificados por tests reales (no narrados)
- [ ] `scripts/spec-merge.mjs` con cobertura 100% línea/rama/función (mismo estándar que los 3
  gates existentes) y tests `FALSIFICACIÓN ·`
- [ ] `templates/vibe/` incluye `specs/{dominio}/spec.md` template + carpeta `spec-archive/`
  con `.gitkeep`
- [ ] `SKILL.md` Phase 1 (delta contra canónica) y Phase 4.6/4.7 (merge post-commit) actualizados
- [ ] `README.md` refleja la nueva carpeta `specs/` en la estructura de archivos
- [ ] `CHANGELOG.md` con entrada nueva

---

# Plan: vcp-canonical-delta-spec

**Date:** 2026-08-20
**Spec:** este mismo documento (arriba)
**Status:** Draft — esperando aprobación 🔵 por tarea

---

## Task Breakdown

| ID | Description | Files | Depends on |
|----|-------------|-------|------------|
| T01 | Template de spec canónica por dominio + carpeta `spec-archive/` | `templates/vibe/specs/spec.md`, `templates/vibe/spec-archive/.gitkeep` | — |
| T02 | Script de merge mecánico (`ADDED`/`MODIFIED`/`REMOVED`/`RENAMED`) + tests `FALSIFICACIÓN ·` | `scripts/spec-merge.mjs`, `tests/spec-merge.test.mjs` | T01 |
| T03 | `templates/spec.md` de feature: sección de delta explícita contra la canónica (4 operaciones) | `templates/spec.md` | T01 |
| T04 | `SKILL.md` Phase 1: instrucción de declarar delta contra `specs/{dominio}/spec.md` si existe | `SKILL.md` | T02, T03 |
| T05 | `SKILL.md` Phase 4.6/4.7: paso mecánico de merge + archivado con fecha post-commit | `SKILL.md` | T02 |
| T06 | `SKILL.md` Phase 0 paso 7: reportar dominios con spec canónica + fecha última actualización | `SKILL.md` | T02 |
| T07 | `README.md` estructura de archivos + `CHANGELOG.md` | `README.md`, `CHANGELOG.md` | T01-T06 |

---

## Execution Order (topológico)

1. **T01** — templates, independiente
2. **T02** — el script real, depende de saber el formato exacto de T01
3. **T03** — extiende el template de feature-spec existente, en paralelo con T02 posible pero más
   simple hacerlo después de fijar el formato de delta que T02 va a parsear
4. **T04, T05, T06** — texto de protocolo en `SKILL.md`, dependen de que T02 exista para
   documentar el comando real
5. **T07** — al final, con file:line real post-cambio

---

## Risk Notes

- **Riesgo real de esta feature: el parser del merge.** A diferencia de los 3 gates anteriores
  (que comparan estado binario: pasa/no pasa), este script tiene que **entender y modificar
  contenido Markdown estructurado** — mucha más superficie de bugs sutiles que un fingerprint o un
  contador de regex. Mitigación: formato de entrada deliberadamente rígido (headers exactos,
  nunca Markdown libre), AC7 falla cerrado ante cualquier ambigüedad en vez de adivinar.
- No toca ningún gate ya hardeneado (`verify-red.*`, `verify-receipt.mjs`, `ratchet.mjs`,
  `pretooluse-red.mjs`) — cero riesgo de reabrir esas 4 superficies.
- `risk_level` esperado: **estandar** (toca protocolo central de Phase 1/4.6/4.7, pero sin
  `sensitive_path` ni `simplify_ignore_touch`) — 2 revisores independientes en 4.4 si esto se
  implementa bajo el propio VCP.

---

## Subagent assignments

Mezcla de texto puro (Phase 1/4.6/4.7 de `SKILL.md`, templates) y código real con tests (T02) —
a diferencia del spec anterior (`vcp-implementation-spec.md`, 100% texto), T02 sí amerita el
ciclo RED→GREEN→TRIANGULATE→REFACTOR completo por ser lógica de parseo/merge no trivial.

```
🔵 CONFIG — antes de empezar:
A) Implementar T01-T07 ahora, fase por fase, con 🔵 individual en cada una — RECOMENDADO (T02 es
   la única con riesgo real, el resto es texto de bajo riesgo ya patrón-probado en esta sesión)
B) Implementar solo T01-T03 (templates + script + delta en feature-spec) y dejar la integración a
   SKILL.md (T04-T06) para una sesión donde se pueda probar end-to-end sobre un proyecto real
C) No implementar todavía — el spec queda como documento de referencia para más adelante
D) Elegir un subconjunto distinto (decime cuáles)
```
