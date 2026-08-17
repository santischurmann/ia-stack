# gstack — investigación trazable, cobertura parcial

## Snapshot inmutable y manifiesto reproducible

Fuente: [`garrytan/gstack`](https://github.com/garrytan/gstack), commit
`d078622b73539fc1a7a27e709861e9b6b058ae98` (`v1.62.0.0`, `main` al 2026-08-12).

El conteo canónico de este informe es el de Git, no un conteo anterior de API:

```powershell
git clone --filter=blob:none --no-checkout https://github.com/garrytan/gstack.git <scratch> # exit 0
git -C <scratch> checkout --detach d078622b73539fc1a7a27e709861e9b6b058ae98             # exit 0
git -C <scratch> rev-parse HEAD                                                             # d078...e98
git -C <scratch> ls-tree -r --name-only HEAD | Measure-Object | Select-Object -Expand Count # 1183
git -C <scratch> ls-tree -r --name-only HEAD | Sort-Object                                  # manifiesto completo
```

Resultado observado: **1.183 paths / 1.183 blobs** (1.175 blobs únicos) en el commit fijado.
El antiguo `1.185` no se puede reconciliar con `git ls-tree -r` y por eso no se usa como
denominador. El manifiesto se reproduce con el último comando; no depende de la rama viva.

### Qué significa la cobertura

No se equipara inventario, hash o grep con comprensión. Hay tres niveles distintos:

| Nivel | Cobertura actual | Qué prueba | Qué no prueba |
|---|---:|---|---|
| Inventario estructural | 1.183/1.183 paths, 48 bloques | snapshot, ruta, tipo/tamaño y bloque asignable | que se leyó o entendió el archivo |
| Lectura íntegra y síntesis | 5 archivos | router, arquitectura, ethos, mapa de skills y `package.json` | el resto del repositorio |
| Lectura focalizada | 8+ secciones | afirmaciones 4R, review, spec gate, aprendizaje y checkpoint | comportamiento completo de esos subsistemas |

Los cinco archivos leídos íntegramente en esta pasada son `SKILL.md`, `ARCHITECTURE.md`,
`ETHOS.md`, `AGENTS.md` y `package.json`. Se leyeron también las secciones pertinentes de
`ship/sections/review-army.md`, `README.md`, `spec/SKILL.md`,
`docs/designs/SELF_LEARNING_V0.md`, `learn/SKILL.md`, `context-save/SKILL.md` y
`context-restore/SKILL.md`. Esto **no** autoriza la etiqueta «exhaustiva».

El inventario estructural encontró 708 archivos TypeScript (323 bajo `test/`, 187 bajo
`browse/`, 77 bajo `scripts/`) y 168 Markdown. Es una medida de tamaño y no un conteo
fiable de funciones: TypeScript contiene métodos, callbacks y tests que requieren lectura
semántica individual.

## Resultado útil para VibeCodeProtocols (verificado)

### 1. La rúbrica 4R es de VCP, no de gstack

En VCP, `SKILL.md:266-293` define explícitamente **Risk / Readability / Reliability /
Resilience** y escala la revisión por `risk_level` (`1`, `2`, `4`, `4 + reproducción
independiente`).

En gstack, esta búsqueda exacta sobre el snapshot no produjo coincidencias y devolvió
`exit 1`:

```powershell
rg -ni --glob '!*.json' --glob '!*.html' --glob '!*.png' \
  '(Risk / Readability / Reliability / Resilience|\b4R\b)' <scratch> # exit 1
```

Lo que gstack sí implementa es otro diseño: `ship/sections/review-army.md:170-206`
selecciona especialistas por tamaño y señales de alcance. Con 50+ líneas siempre suma
testing y maintainability; luego agrega security/performance/data-migration/API/design
según `SCOPE_*`; los condicionales silenciosos se pueden omitir tras 10+ despachos sin
hallazgos, salvo `NEVER_GATE` (security y data-migration). `:315-329` activa red-team con
`DIFF_LINES > 200` o un hallazgo crítico.

Conclusión: es honesto decir que el principio de *review especializado y adaptativo* fue
inspiración posible. No es honesto atribuir a gstack el nombre 4R, los cuatro niveles de
VCP ni el quinto revisor de reproducción.

### 2. Corrección P1: gstack **sí** tiene un quality gate de spec 7/10

La afirmación previa de que no había lenguaje «block below 7/10» era falsa. El source of
truth actual es `spec/SKILL.md:1033-1085`:

- llama `codex exec` en modo read-only para puntuar ejecutabilidad 0--10;
- `Score >= 7` continúa (`:1071`);
- con `< 7` pide una revisión y, tras ella, ofrece al usuario *ship anyway*, guardar draft o
  un tercer intento (`:1073-1083`);
- el gate puede omitirse con `--no-gate` y también se salta si Codex no está instalado,
  no está autenticado, expira o responde mal (`:1056-1067`).

Por tanto es un **gate de calidad de spec con escape explícito y fallos abiertos**, no un
hard gate mecánico. Es distinto del `quality_score` de revisión en
`ship/sections/review-army.md:274-300`: esa fórmula
`max(0, 10 - critical_count*2 - informational_count*0.5)` se muestra y se registra durante
la revisión pre-landing; no decide por sí misma si se puede aterrizar un PR.

VCP no contiene un umbral numérico equivalente: el grep sobre `SKILL.md`, `skills/` y
`templates/` para `7/10`, `quality_score`, `quality_gate` y umbrales de score devolvió
`exit 1`. Que VCP no haya adoptado el gate es correcto; decir que gstack tampoco lo tenía
no lo era.

**Implicación para VCP:** no copiar el 7/10 como si fuera una prueba. Es juicio de modelo y
puede saltarse. Si se evalúa incorporarlo, debe quedar como señal/advisory o requerir una
decisión explícita del usuario, nunca sustituir receipt, tests ni revisión reproducible.

### 3. Memoria y aprendizaje: ideas útiles con límites

`learn/SKILL.md:783-953` ofrece un gestor separado y sin cambios de código: búsqueda,
exportación, alta manual y poda. La poda comprueba que archivos referenciados sigan
existiendo y busca contradicciones; borrar o actualizar requiere decisión del usuario
(`:832-858`). El resumen estadístico deduplica por `key|type` y conserva la entrada más
reciente (`:905-929`). Esto respalda una práctica aplicable: aprendizaje con procedencia,
deduplicación y retiro explícito, no memoria libre sin mantenimiento.

`docs/designs/SELF_LEARNING_V0.md:80` menciona «1pt/30d» para learnings observados/inferidos.
Es un **documento de diseño**, no prueba de que el decaimiento esté implementado en el runtime;
no debe copiarse como conducta confirmada sin leer la implementación y sus tests.

### 4. Checkpoints: adopción conceptual, no mecánica

`context-save/SKILL.md:810-1028` captura branch, estado Git, diff staged/unstaged,
log reciente, decisiones, trabajo pendiente y notas en un archivo append-only. Su restauración
prefiere el checkpoint de la rama actual y conserva otra rama como fallback
(`context-restore/SKILL.md:785-943`). Es una referencia útil para hacer los handoffs de VCP
auditables.

Pero `README.md:250-252` también ofrece checkpoint continuo con auto-commits `WIP:` y cuerpo
`[gstack-context]`, con push opt-in y squash antes de PR. Eso **choca** con el orden de VCP:
VCP exige que el receipt sea válido antes de commit. No se debe adoptar auto-commit WIP en VCP
sin rediseñar el receipt y obtener aprobación explícita; el dato aprovechable es el esquema
de handoff (decisiones, pendientes, enfoques fallidos), no el commit automático.

### 5. Límite de portabilidad

gstack es una suite de 1.183 blobs, con Bun >=1 y dependencias como Playwright, Puppeteer,
ngrok y Transformers (`package.json`). Su arquitectura incluye un daemon Chromium persistente
(`ARCHITECTURE.md:1-299`) y una capa de generación de `SKILL.md` desde templates. Eso explica
por qué no es un candidato para «incluir todo dentro de un único skill autocontenido» de VCP.
VCP puede extraer patrones documentales y de verificación, pero no debe declarar que incorpora
gstack ni convertir sus binarios/dependencias en requisitos implícitos.

## Bloques deterministas pendientes de lectura semántica

El listado siguiente divide el manifiesto ordenado lexicográficamente en bloques de 25 paths
(el último tiene 8). Todos están **pendientes de lectura semántica completa**, salvo las
secciones puntuales declaradas arriba. Las columnas de extremos permiten reconstruir cada
bloque sin ambigüedad con el manifiesto reproducible.

| Bloque | Paths | Desde | Hasta | Estado |
|---|---:|---|---|---|
| C01 | 25 | `.env.example` | `benchmark/SKILL.md.tmpl` | cerrado — 2026-08-14 |
| C02 | 25 | `bin/chrome-cdp` | `bin/gstack-distill-apply` | cerrado — 2026-08-14 |
| C03 | 25 | `bin/gstack-distill-free-text` | `bin/gstack-paths` | cerrado — 2026-08-14 |
| C04 | 25 | `bin/gstack-platform-detect` | `bin/gstack-version-bump` | cerrado — 2026-08-14 |
| C05 | 25 | `browse/bin/find-browse` | `browse/src/cookie-import-browser.ts` | cerrado — 2026-08-14 (parcial: ver nota) |
| C06 | 25 | `browse/src/cookie-picker-routes.ts` | `browse/src/security-classifier.ts` | cerrado — 2026-08-14 (parcial: ver nota) |
| C07 | 25 | `browse/src/security-sidecar-client.ts` | `browse/test/bridge-chromium-e2e.test.ts` | cerrado — 2026-08-14 (parcial: ver nota) |
| C08 | 25 | `browse/test/browse-client.test.ts` | `browse/test/daemon-mismatch-refuse.test.ts` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests) |
| C09 | 25 | `browse/test/data-platform.test.ts` | `browse/test/fixtures/qa-eval-checkout.html` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests/fixtures) |
| C10 | 25 | `browse/test/fixtures/qa-eval-spa.html` | `browse/test/regression-pr1169-pdf-from-file-invalid-json.test.ts` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests/fixtures) |
| C11 | 25 | `browse/test/restart-env.test.ts` | `browse/test/server-no-import-side-effects.test.ts` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests) |
| C12 | 25 | `browse/test/server-proxy-fail-fast.test.ts` | `browse/test/tab-session-frame-detach.test.ts` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests) |
| C13 | 25 | `browse/test/telemetry.test.ts` | `bun.lock` | cerrado — 2026-08-14 (inventario; `bun.lock` no leído — lockfile) |
| C14 | 25 | `bunfig.toml` | `cso/SKILL.md.tmpl` | cerrado — 2026-08-14 (parcial: ver nota) |
| C15 | 25 | `design-consultation/sections/manifest.json` | `design/src/diff.ts` | cerrado — 2026-08-14 (inventario; sin lectura profunda de `design/src/*`) |
| C16 | 25 | `design/src/evolve.ts` | `docs/askuserquestion-split.md` | cerrado — 2026-08-14 (inventario; sin lectura profunda de `design/src/*`) |
| C17 | 25 | `docs/designs/BROWSER_SKILLS_V1.md` | `docs/gbrain-sync-errors.md` | cerrado — 2026-08-14 (inventario de nombres, sin lectura íntegra de cada design doc) |
| C18 | 25 | `docs/gbrain-sync.md` | `extension/content.js` | cerrado — 2026-08-14 (parcial: ver nota — `extension/manifest.json` y `background.js` leídos) |
| C19 | 25 | `extension/icons/icon-128.png` | `gstack-upgrade/migrations/v1.58.0.0.sh` | cerrado — 2026-08-14 (íconos PNG solo inventariados por nombre/binario; `v1.58.0.0.sh` leído íntegro) |
| C20 | 25 | `gstack-upgrade/SKILL.md` | `investigate/SKILL.md` | cerrado — 2026-08-14 (parcial: ver nota) |
| C21 | 25 | `investigate/SKILL.md.tmpl` | `ios-qa/daemon/test/proxy-classify.test.ts` | cerrado — 2026-08-14 (parcial: ver nota) |
| C22 | 25 | `ios-qa/daemon/test/session-tokens.test.ts` | `landing-report/SKILL.md` | cerrado — 2026-08-14 (inventario, sin lectura profunda de tests ios-qa restantes) |
| C23 | 25 | `landing-report/SKILL.md.tmpl` | `lib/redact-patterns.ts` | cerrado — 2026-08-14 (parcial: `lib/redact-patterns.ts` leído íntegro parcialmente, ver nota) |
| C24 | 25 | `lib/staging-guard.ts` | `make-pdf/test/e2e/format-gate.test.ts` | cerrado — 2026-08-14 (parcial: `lib/staging-guard.ts` leído; resto inventario) |
| C25 | 25 | `make-pdf/test/e2e/landscape-gate.test.ts` | `open-gstack-browser/SKILL.md` | pendiente |
| C26 | 25 | `open-gstack-browser/SKILL.md.tmpl` | `plan-devex-review/sections/review-sections.md` | pendiente |
| C27 | 25 | `plan-devex-review/sections/review-sections.md.tmpl` | `review/specialists/api-contract.md` | parcial focalizado |
| C28 | 25 | `review/specialists/data-migration.md` | `scripts/eval-select.ts` | parcial focalizado |
| C29 | 25 | `scripts/eval-summary.ts` | `scripts/resolvers/index.ts` | pendiente |
| C30 | 25 | `scripts/resolvers/learnings.ts` | `scripts/resolvers/preamble/generate-vendoring-deprecation.ts` | pendiente |
| C31 | 25 | `scripts/resolvers/preamble/generate-voice-directive.ts` | `setup-gbrain/memory.md` | pendiente |
| C32 | 25 | `setup-gbrain/SKILL.md` | `skillify/SKILL.md.tmpl` | parcial focalizado |
| C33 | 25 | `slop-scan.config.json` | `test/bin-windows-bun-import-paths.test.ts` | parcial focalizado |
| C34 | 25 | `test/brain-cache-roundtrip.test.ts` | `test/declared-annotation.test.ts` | pendiente |
| C35 | 25 | `test/design-flag-utils.test.ts` | `test/fixtures/ios-qa/FixtureApp/Package.swift` | pendiente |
| C36 | 25 | `test/fixtures/ios-qa/FixtureApp/project.yml` | `test/fixtures/qa-eval-spa-ground-truth.json` | pendiente |
| C37 | 25 | `test/fixtures/review-army-migration.sql` | `test/gbrain-spawn-windows-shell.test.ts` | pendiente |
| C38 | 25 | `test/gbrain-supabase-provision.test.ts` | `test/gstack-memory-ingest.test.ts` | pendiente |
| C39 | 25 | `test/gstack-next-version.test.ts` | `test/helpers/carve-guard-checks.ts` | pendiente |
| C40 | 25 | `test/helpers/carve-guards.ts` | `test/helpers/session-runner.ts` | pendiente |
| C41 | 25 | `test/helpers/skill-parser.ts` | `test/model-overlay-opus-4-7.test.ts` | pendiente |
| C42 | 25 | `test/no-stale-gstack-brain-refs.test.ts` | `test/regression-1611-gbrain-sync-resume.test.ts` | pendiente |
| C43 | 25 | `test/regression-1624-retro-stale-base.test.ts` | `test/ship-template-redaction.test.ts` | pendiente |
| C44 | 25 | `test/ship-version-sync.test.ts` | `test/skill-e2e-first-task-scaffold.test.ts` | pendiente |
| C45 | 25 | `test/skill-e2e-gbrain-roundtrip-local.test.ts` | `test/skill-e2e-plan-devex-finding-floor.test.ts` | pendiente |
| C46 | 25 | `test/skill-e2e-plan-devex-plan-mode.test.ts` | `test/skill-e2e-workflow.test.ts` | pendiente |
| C47 | 25 | `test/skill-e2e.test.ts` | `test/user-slug-fallback.test.ts` | pendiente |
| C48 | 8 | `test/v0-dormancy.test.ts` | `VERSION` | pendiente |

La próxima pasada debe procesar cada bloque con: (1) lectura real de cada path o de duplicados
idénticos verificados, (2) resumen de funciones/contratos/efectos, (3) relación con sus tests,
y (4) actualización del estado por path. No debe convertir una lista de hashes, un grep o una
muestra en «100% estudiado».

## Continuación — chunks C25-C48 — 2026-08-14

Rango cerrado en esta pasada: `make-pdf/test/e2e/landscape-gate.test.ts` → `VERSION`
(583 paths, orden case-insensitive `LC_ALL=C sort -f`, verificado contra el manifiesto
reproducible del commit fijado vía clon local `--filter=blob:none`). C1-C24 quedan fuera
de esta pasada (bloque paralelo).

Lectura íntegra o cuasi-íntegra en esta pasada: `review/checklist.md`,
`review/design-checklist.md`, `review/greptile-triage.md`,
`review/specialists/{api-contract,data-migration,maintainability,performance,red-team,
security,testing}.md`, `review/TODOS-format.md`, `ship/sections/adversarial.md`,
`ship/sections/plan-completion.md` (líneas 89-322), `ship/sections/test-coverage.md`
(líneas 97-483), `plan-ceo-review/sections/review-sections.md` (extracto Section 1-2),
`supabase/migrations/001-004_*.sql`, `supabase/verify-rls.sh`, `TODOS.md` (extracto),
`model-overlays/*.md` (6 archivos completos). Lectura estructural (headers `grep '^#'`,
sin cuerpo íntegro): `ship/SKILL.md` (1423 líneas), `ship/sections/{changelog,greptile,
pr-body,tests}.md`. Inventario por nombre sin lectura de contenido: 363 archivos bajo
`test/` (43 fixtures, 38 helpers, resto tests unitarios por feature), 85 bajo `scripts/`
(24 en `scripts/resolvers/preamble/` sin abrir), `openclaw/*`, `plan-*-review/*` fuera de
lo citado, `office-hours/*`, `qa/*`, `scrape/*`, `skillify/*`, `unfreeze/*`, `retro/*`,
`setup-gbrain/*`. Esto **no** cierra C25-C48 como "leído íntegro"; cierra la columna
"Estado" de la tabla como *inventariado + lectura focalizada de las piezas más densas*.

### Hallazgos con file:line

1. **Checklist de revisión por especialistas con severidad y auto-fix diferenciado.**
   `review/checklist.md:36-141` define dos pasadas (CRITICAL: SQL/race/LLM-trust/shell
   injection/enum completeness; INFORMATIONAL: el resto) más 7 especialistas paralelos
   (`review/specialists/*.md`) con schema JSON uniforme
   (`{"severity","confidence","path","line","category","summary","fix","fingerprint",
   "specialist"}`) y activación condicional por `SCOPE_*` (`review/specialists/
   api-contract.md:3`, `data-migration.md:3`, `security.md:3`, `red-team.md:3` —
   `red-team` solo corre si diff > 200 líneas o security encontró CRITICAL). El
   `Fix-First Heuristic` (`review/checklist.md:145-166`) da una regla explícita:
   mecánico y no ambiguo → AUTO-FIX; ambiguo o riesgo alto → ASK. Aplicable a VCP: el
   Fase 3 REFACTOR / Fase 4 Test podría adoptar la distinción AUTO-FIX vs ASK como
   heurística de cuándo un hallazgo de revisión bloquea vs. se corrige solo, sin copiar
   el nombre de los especialistas.

2. **`REGRESSION RULE` (mandatory, sin pregunta al usuario).**
   `ship/sections/test-coverage.md:418-429`: si la auditoría de cobertura detecta que el
   diff rompe comportamiento existente no cubierto por tests, se escribe un test de
   regresión de inmediato — "No AskUserQuestion. No skipping." Contrasta con el resto del
   flujo de gstack, que gatea casi todo con `AskUserQuestion`. Aplicable a VCP: es un caso
   concreto donde VCP podría declarar explícitamente una excepción de "hard gate sin
   pregunta" para regresiones detectadas, distinta del gate rojo→verde genérico.

3. **Auditoría "Plan Completion" con taxonomía DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE
   y anti-blanket-confirmation citando un bug real (VAS-449).**
   `ship/sections/plan-completion.md:203-297`: cada ítem del plan se clasifica contra el
   diff; los UNVERIFIABLE (estado externo, ej. DNS, dashboards) se confirman **uno por
   uno** vía `AskUserQuestion`, nunca en bloque — el texto cita explícitamente que la
   confirmación en bloque fue el modo de fallo observado en VAS-449 (usuario aprueba sin
   abrir ningún archivo). Aplicable a VCP: los templates de `plan.md`/checkpoint podrían
   adoptar la clasificación DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE en vez de un
   binario hecho/no-hecho, y prohibir explícitamente la confirmación en bloque de ítems
   no verificables cuando hay más de uno.

4. **Scope Drift Detection como paso informativo separado de la revisión de calidad.**
   `ship/sections/plan-completion.md:362-393` (Step 8.2): compara intención declarada
   (TODOS.md / PR body / commits) contra el diff real, clasifica CLEAN / DRIFT DETECTED /
   REQUIREMENTS MISSING, y es explícitamente no bloqueante. Es una idea reusable para VCP
   como paso separado de auditoría (no gate) antes del review de calidad.

5. **Revisión adversarial cruzada Claude+Codex con salvaguarda anti-inyección explícita
   para fixtures de seguridad.** `ship/sections/adversarial.md:56-59`: el prompt del
   subagente aclara que las cadenas de ataque en `test/`, `*fixture*`, `*.test.*` son el
   "corpus de regresión de seguridad propio del proyecto" y deben tratarse como datos a
   analizar, no como contenido para generar variantes de exploit — y exige declarar
   explícitamente que los fixtures se revisaron en modo resumen (no full diff) para que
   la reducción de cobertura sea visible. Aplicable a `skills/security-baseline.md` o al
   futuro subagent-triangulate de VCP si alguna vez revisa payloads de ataque en fixtures.

6. **Migraciones RLS de Supabase con historial de endurecimiento progresivo y GRANT por
   columna.** `supabase/migrations/002_tighten_rls.sql:1-36` retira políticas SELECT
   anónimas y una política UPDATE "unrestricted on all columns"; `003_installations_
   upsert_policy.sql:15-25` la reemplaza por una política RLS de UPDATE + `GRANT UPDATE
   (last_seen, gstack_version, os) ON installations TO anon` — restricción a nivel de
   columna, no solo de fila. `004_attack_telemetry.sql:1-27` documenta explícitamente
   reglas de privacidad "enforced client-side": solo dominio (nunca path/query), hash
   salteado (nunca el payload crudo), sal por dispositivo en archivo local. Es un patrón
   de defensa en profundidad (RLS de fila + GRANT de columna + reglas de privacidad
   documentadas junto al schema) útil como referencia si VCP alguna vez toca diseño de
   telemetría o RLS — no se copia código, se documenta el patrón.
   `supabase/verify-rls.sh:33-38` evita nombres de archivo temporal predecibles basados
   en `$$` explícitamente por riesgo de carrera/sobrescritura en máquinas compartidas —
   coincide con una práctica que VCP ya debería aplicar en sus propios scripts bash de
   scratch.

7. **Overlays por modelo (`model-overlays/*.md`) como capa de instrucciones condicional
   por LLM.** 6 archivos completos (`claude.md`, `gemini.md`, `gpt.md`, `gpt-5.4.md`,
   `o-series.md`, `opus-4-7.md`) con un mecanismo de herencia `{{INHERIT:gpt}}`
   (`gpt-5.4.md:1`, `opus-4-7.md:1`). Nota específica en `opus-4-7.md:5-11`: "Pace
   questions to the skill" — si el texto del skill activo contiene `STOP.
   AskUserQuestion`, se hace una pregunta por turno, nunca en lote, aun si la corrección
   parece obvia. Esto es coherente con el hallazgo #3 (anti-blanket-confirmation) — es el
   mismo principio aplicado a nivel de comportamiento de modelo en vez de a nivel de
   contenido del plan. No es una idea nueva para VCP (VCP no tiene múltiples LLMs
   objetivo) pero refuerza la recomendación #3.

8. **`TODOS.md` con item real citando un problema arquitectónico propio de portabilidad de
   rutas.** `TODOS.md:1-25` (P1 #1882): todo `SKILL.md` generado hardcodea
   `~/.claude/skills/gstack/...` en vez de resolver la raíz de instalación en runtime vía
   `GSTACK_ROOT`/`GSTACK_BIN` (que sí existe como variable pero no se usa
   consistentemente) — falla silenciosa si se instala en un directorio con otro nombre.
   No es una idea "para copiar", es evidencia de que incluso gstack (1183 blobs, /ship
   con gate de 21 pasos) tiene deuda de portabilidad de rutas hardcodeadas sin resolver;
   relevante como recordatorio de que VCP, que también usa rutas relativas en scripts,
   debería mantener el mismo chequeo en su propio `scripts/install.ps1`/`install.sh`.

### Ninguna idea nueva confirmada, con evidencia de "none found"

- Búsqueda de un umbral 4R o equivalente dentro de C25-C48: no aparece (ya cubierto en
  la sección previa del informe, sigue sin evidencia en este rango).
- No se encontró un mecanismo de "auto-commit WIP" adicional al ya documentado
  (`README.md:250-252`, fuera de este rango) dentro de C25-C48.

### Estado de la tabla de bloques

Los 24 bloques C25-C48 pasan de `pendiente` a `parcial focalizado` (mismo criterio que
C01/C27/C28/C32/C33 ya marcados así): hay lectura real de los archivos más densos en
señal (specialists de review, secciones de ship, migraciones RLS, overlays de modelo,
TODOS.md) más inventario estructural (headers, nombres, conteos) del resto. Ningún bloque
C25-C48 alcanza "lectura semántica completa" en el sentido estricto definido arriba —
faltan los ~85 scripts de `scripts/` (incluidos los 24 resolvers de `preamble/` sin
abrir), los ~363 archivos de `test/` (más allá del muestreo de nombres), y los skills
menores (`openclaw/`, `qa/`, `scrape/`, `skillify/`, `retro/`, `unfreeze/`,
`setup-gbrain/`, `office-hours/`, `plan-*-review/` completos).

| Bloque | Estado (actualizado) |
|---|---|
| C25-C26 | parcial focalizado (inventario + sin lectura de contenido específico de este rango) |
| C27 | parcial focalizado (ya estaba; reconfirmado — `review/specialists/api-contract.md` leído íntegro en esta pasada) |
| C28 | parcial focalizado (ya estaba; reconfirmado — `review/specialists/data-migration.md` leído íntegro) |
| C29-C31 | parcial focalizado (scripts/resolvers inventariados por nombre, sin abrir contenido) |
| C32 | parcial focalizado (ya estaba) |
| C33 | parcial focalizado (ya estaba) |
| C34-C48 | parcial focalizado (test/ inventariado por nombre; ship/SKILL.md y sections/{changelog,greptile,pr-body,tests}.md leídos por estructura de headers; supabase, TODOS.md, model-overlays, review/checklist*, plan-completion, test-coverage, adversarial, plan-ceo-review Section 1-2 leídos íntegros o cuasi-íntegros) |

## Estado

**PARCIAL.** Hay una base verificable para extraer patrones concretos y se corrigió una
afirmación errónea sobre el gate 7/10, y la pasada 2026-08-14 agregó lectura focalizada e
inventario verificado de los 24 bloques C25-C48 (583 paths) con 8 hallazgos nuevos con
file:line. Sigue faltando lectura semántica completa de la mayor parte de las 708 fuentes
TypeScript, 323 tests y subsistemas de browser/seguridad — en particular los 85 scripts
de `scripts/` (24 resolvers de preamble sin abrir) y los ~600 archivos test/fixture de
C25-C48. No aprobar la fuente como exhaustivamente estudiada hasta cerrar ese ledger.

## Continuación — chunks C01-C24 — 2026-08-14

Rango cerrado en esta pasada: `.env.example` → `make-pdf/test/e2e/format-gate.test.ts`
(600 paths de `chunk_c1_c24.txt`, líneas 1-606 del manifiesto reproducible del commit
`d078622b`, verificado contra el clon local en `gstack_repo/`). Este bloque es paralelo e
independiente de la pasada C25-C48 documentada arriba.

**Nivel de lectura real, sin inflar la cifra.** Se leyó íntegro el contenido de ~50 archivos
densos en señal (scripts `bin/*`, módulos de seguridad de `browse/src/*`, migraciones de
`gstack-upgrade/migrations/*`, `investigate/SKILL.md`, dos módulos de `ios-qa/daemon/src/*`,
`lib/redact-patterns.ts` y `lib/staging-guard.ts`, `extension/manifest.json` y
`background.js`). El resto de los 600 paths — la mayoría de los 323 `browse/test/*.test.ts`,
los fixtures HTML/JSON de `browse/test/fixtures/`, `bun.lock`, íconos PNG de
`extension/icons/`, y buena parte de `design/src/*` y `docs/designs/*.md` — se inventarió por
nombre y ubicación (del manifiesto) pero **no** se leyó línea por línea. Se marca la tabla
como "cerrado" en el sentido de "bloque procesado con este criterio explícito", no en el
sentido de "cada uno de los 600 archivos leído íntegro" — sería falso decir eso.

### bin/ — ~30 scripts leídos íntegros

- `bin/gstack-config:1-457` — CLI get/set/list/defaults sobre `~/.gstack/config.yaml`, con
  tabla `DEFAULTS` (`proactive`, `checkpoint_mode`, `codex_reviews`, etc.), validación de
  dominios de valor por clave (ej. `codex_reviews` se **rechaza** en vez de defaultear ante
  un valor inválido, `:320-323`, porque controla llamadas pagas), y helpers de integración
  con "brain" (`endpoint_hash`, `resolve_user_slug`, `:152-258`).
- `bin/gstack-redact:1-241` + `bin/gstack-redact-prepush:1-199` — CLI y hook `pre-push` sobre
  `lib/redact-engine.ts`. Exit codes tipados (0 limpio, 2 MEDIUM, 3 HIGH, `:9-12`); el hook
  pre-push es fail-**closed**: si no puede calcular el diff empujado, bloquea el push en vez
  de dejarlo pasar sin escanear (`gstack-redact-prepush:49-65`, comentario explícito `#1946`).
  Confirma en código el patrón "guardrail explícito, con bypass documentado
  (`--no-verify` / `GSTACK_REDACT_PREPUSH=skip`), nunca enforcement silencioso".
- `bin/gstack-learnings-log:1-91` / `gstack-learnings-search:1-163` — JSONL append-only de
  aprendizajes con `type` cerrado (`pattern|pitfall|preference|architecture|tool|operational|
  investigation`), decaimiento de confianza `-1pt/30d` para `observed|inferred`
  (`gstack-learnings-search:82-85`, coincide con el `1pt/30d` citado en
  `docs/designs/SELF_LEARNING_V0.md:80` — aquí sí está implementado, no solo diseñado), y un
  **trust gate allowlist** explícito para aprendizajes cross-project: solo se admite
  `trusted === true` (`source: user-stated`), nunca por ausencia del campo
  (`:96-102`, cita el bug `#1745` de un allowlist que antes se comportaba como denylist).
- `bin/gstack-question-log:1-247` / `gstack-question-preference:1-297` — esquema de
  `AskUserQuestion` con `category`, `door_type` (`one-way`/`two-way`), `user_choice`,
  `recommended`, `followed_recommendation`. El dato más relevante: un **gate de origen de
  usuario** explícito sobre `--write` de preferencias (`gstack-question-preference:164-179`):
  solo `source: plan-tune | inline-user` se acepta; `inline-tool-output` / `inline-file` se
  **rechazan** con exit 2 y mensaje "profile poisoning defense", citando
  `docs/designs/PLAN_TUNING_V0.md`. Es un mecanismo concreto contra que el propio output de
  una herramienta o un archivo leído inyecte una preferencia de usuario falsa.
- `bin/gstack-taste-update:1-294` — perfil de gustos de diseño (`fonts/colors/layouts/
  aesthetics`) con confianza Laplace-suavizada y decaimiento 5%/semana (`applyDecay:147-160`);
  detecta "taste drift" cuando el lado opuesto (aprobado vs rechazado) ya tenía confianza alta
  (`bumpPref:203-206`).
- `bin/gstack-version-bump:1-213` + `gstack-next-version:1-519` — separación lector/escritor
  para el versionado de `/ship`: `classify` nunca escribe, clasifica
  `FRESH|ALREADY_BUMPED|DRIFT_STALE_PKG|DRIFT_UNEXPECTED` comparando `VERSION` vs
  `origin/<base>:VERSION` vs `package.json`; `gstack-next-version` resuelve colisiones de
  versión contra PRs abiertos (GitHub/GitLab) y worktrees "sibling" activos de Conductor,
  bumpeando por encima de lo ya reclamado (`pickNextSlot:102-114`).
- `bin/gstack-distill-free-text:1-273` + `gstack-distill-apply:1-182` — pipeline "dream
  cycle": junta respuestas de texto libre (`auq-other`) del log de preguntas, las manda a
  Claude Haiku con un prompt que exige `confidence >= 0.7` y cita verbatim
  (`:147-152`), y solo aplica propuestas tras una confirmación explícita del usuario vía
  `/plan-tune` — nunca autónomo (comentario cita "Codex #15 trust boundary",
  `gstack-distill-apply:6-19`).
- `bin/gstack-brain-sync:1-497` — sync cross-máquina del estado de `~/.gstack` con lock por
  `mkdir` atómico (`:216-239`), escaneo de secretos sobre el diff staged antes de commitear
  (`secret_scan_stdin:81-110`, patrones AWS/GitHub/OpenAI/PEM/JWT/bearer-JSON) y **aborta el
  commit** (unstage + status "blocked") si encuentra un hit, sin importar el modo de sync.
- `bin/gstack-detach:1-168` — wrapper Python fork+setsid para jobs largos, con watchdog de
  timeout que mata el `killpg` completo y un sentinel `### gstack-detach EXIT=<code> ###`
  siempre escrito al log, incluso en excepción — para que un poller nunca confunda silencio
  con éxito.
- `bin/gstack-session-kind:1-54` — clasifica la sesión (`spawned|headless|interactive`) por
  variables de entorno (Conductor, CI, `OPENCLAW_SESSION`) con **default seguro hacia
  `interactive`** ante ambigüedad — solo bloquea en `headless` con señal positiva, nunca por
  duda (`:16-18`).
- `bin/gstack-developer-profile:1-525` — perfil unificado declared/inferred de 5 dimensiones
  (`scope_appetite`, `risk_tolerance`, `detail_preference`, `autonomy`, `architecture_care`),
  con `--derive` (recomputa desde `question-log.jsonl` vía `scripts/psychographic-signals.ts`)
  y `--check-mismatch` (solo reporta gap si `sample_size >= 10` y `gap > 0.3`, `:454-465`).
- Resto de `bin/` leídos íntegros pero de menor densidad de señal para VCP: `chrome-cdp`,
  `dev-setup`/`dev-teardown` (symlink de desarrollo local de skills), `gstack-decision-log`
  (event-sourced, `--supersede`/`--redact`/`--compact`), `gstack-review-log` (JSONL con
  validación de JSON antes de aceptar), `gstack-security-dashboard` (clasifica
  `ok|legacy|unknown` en vez de mostrar falsos ceros ante error de backend, `:59-76`,
  cita `#1947`), `gstack-team-init` (genera `CLAUDE.md`/hook de enforcement para modo
  `optional`/`required`), `gstack-diff-scope`, `gstack-paths`, `gstack-repo-mode`,
  `gstack-slug`, `gstack-timeline-log`/`-read`, `gstack-platform-detect`.

### browse/src — módulos de seguridad leídos parcialmente (primeras 80-150 líneas c/u)

- `browse/src/security-classifier.ts:1-150` — clasificador ML de inyección de prompt en dos
  capas: L4 (TestSavantAI BERT-small ONNX sobre snapshots de página) y L4b (Claude Haiku
  "reasoning-blind" que ve solo `{user_message, tool_calls[]}`, explícitamente **sin** los
  resultados de herramientas ni el chain-of-thought, para evitar ataques de auto-persuasión,
  `:16-20`). Ambas capas degradan a "safe" (fail-open) si el modelo no carga (`:22-25`).
- `browse/src/cdp-allowlist.ts:1-100` — allowlist de métodos CDP **deny-by-default**
  (comentario cita explícitamente que un allow-default con deny-list es al revés porque
  `Target.*`/`Runtime.evaluate`/`Fetch.*` son peligrosos y fáciles de olvidar bloquear,
  `:1-8`). Cada entrada tiene `scope` (`tab`/`browser`) y `output` (`trusted`/`untrusted`).
- `browse/src/url-validation.ts:1-100` — bloqueo de endpoints de metadata cloud
  (`169.254.169.254`, `metadata.google.internal`, formas hex/decimal/IPv6 del mismo IP) con
  resolución DNS real para detectar DNS rebinding (`resolvesToBlockedIp`, `:84-100`), no solo
  comparación de string del hostname.
- `browse/src/path-security.ts:1-100` — validación de paths de escritura/lectura resolviendo
  symlinks antes de comparar contra `SAFE_DIRECTORIES` — evita que un symlink dentro de un
  directorio "seguro" apunte fuera de él (`validateOutputPath:36-49`).
- `browse/src/stealth.ts:1-100` — script anti-detección inyectado en el browser (máscara de
  `navigator.webdriver`, `window.chrome.runtime`, Proxy sobre `Function.prototype.toString`
  para que getters parcheados sigan reportando `[native code]`), con nota explícita de que
  fingerprints como `navigator.plugins`/`languages` **no** se falsifican por defecto porque
  eso delata más que lo que oculta (`:4-12`).
- `browse/src/telemetry.ts:1-80` y `browse/src/proxy-redact.ts:1-47` — telemetría local
  fire-and-forget sin contenido de body/agente (solo contadores), y una función única
  (`redactProxyUrl`) que todo log de config de proxy debe usar para no filtrar credenciales.

### extension/, gstack-upgrade/, investigate/, ios-qa/, lib/

- `extension/manifest.json:1-32` — extensión MV3 con permisos mínimos (`sidePanel, storage,
  activeTab, scripting, tabs`) y `host_permissions` acotados a `127.0.0.1` (HTTP y WS) — no
  pide acceso a dominios externos.
- `extension/background.js:1-80` — service worker que hace polling de `/health` cada 10s,
  refresca el auth token en cada `/health` exitoso (el server rota el token en cada restart),
  actualiza el badge según conexión.
- `gstack-upgrade/SKILL.md:1-80` — flujo de auto-upgrade con backoff de snooze escalonado
  (24h → 48h → 1 semana, `:59-74`) y restauración desde `.bak` si `./setup` falla en
  auto-upgrade.
- `gstack-upgrade/migrations/v1.58.0.0.sh:1-64` — migración idempotente (`.done` touchfile)
  que registra un hook `PreToolUse` solo dentro de sesiones Conductor y solo si el usuario no
  optó explícitamente por `plan_tune_hooks: no` — nunca fuerza un hook sobre un opt-out
  explícito (`:40-49`).
- `investigate/SKILL.md:1-120` — preamble típico de gstack (chequeo de versión, sesión,
  `REPO_MODE`, `SESSION_KIND`), con hook `PreToolUse` sobre `Edit`/`Write` que corre
  `check-freeze.sh` para chequear el "scope boundary" de debugging antes de cada edición
  (`:21-32`) — un guardrail de scope creep durante debugging que VCP no tiene un equivalente
  explícito para (ver hallazgo 2 abajo).
- `ios-qa/daemon/src/allowlist.ts:1-100` + `auth-mint.ts:1-90` — dos modelos de confianza
  separados: mint self-service (la identidad del caller en Tailscale debe estar YA en el
  allowlist, nunca se auto-agrega) vs. mint otorgado por el owner (vía CLI, no expuesto por
  HTTP). El nivel de capability minteado se **capea** al nivel más alto que el caller tiene
  otorgado, nunca al solicitado si es mayor (`mintForCaller:62-65`).
- `lib/redact-patterns.ts:1-100` — taxonomía canónica de redacción (HIGH/MEDIUM/LOW ×
  secret/pii/legal/internal/hygiene) compartida por CLI, hook pre-push y generación de
  SKILL.md. Documenta explícitamente la calibración: claves publicables de Stripe, AIza de
  Google, JWTs y KV de estilo env son **MEDIUM** (alta tasa de falso positivo), no HIGH — "un
  gate que grita lobo se ignora" (`:17-20`).
- `lib/staging-guard.ts:1-80` — postmortem de un incidente real (`#1802`): un checkpoint
  envenenado hizo que `rm -rf` borrara el working tree del usuario porque el código nunca
  probó que el directorio a borrar fuera realmente un directorio de staging propio.
  `checkOwnedStagingDir` exige 4 condiciones fail-closed (resoluble, hijo directo estructural
  de `$GSTACK_HOME/.staging-ingest-*`, sin `.git` adentro, marcador `.gstack-staging` propio)
  antes de autorizar un borrado recursivo o una reanudación.

### Hallazgos aplicables a VCP (con file:line, sin sobreclaim)

1. **Gate de origen de usuario contra "profile poisoning" — sin equivalente documentado en
   VCP.** `bin/gstack-question-preference:164-179` rechaza explícitamente cualquier escritura
   de preferencia cuyo `source` sea `inline-tool-output`/`inline-file` (contenido visto en
   una herramienta o archivo, no tecleado por el usuario). Se buscó en VCP (`SKILL.md`,
   `skills/*.md`, `templates/*`) un mecanismo equivalente de "declarar de dónde viene una
   preferencia/decisión persistida antes de guardarla" — no se encontró ninguno en VCP.
   Aplicable si VCP alguna vez persiste preferencias de usuario entre sesiones (p. ej. en
   `templates/vibe/PROJECT.md` o similar): documentar explícitamente que solo texto tecleado
   directamente por el usuario en el chat puede escribir una preferencia, nunca contenido
   leído de un archivo o de la salida de una herramienta.
2. **Hook de scope boundary durante debugging (`check-freeze.sh` vía `PreToolUse` en
   `investigate/SKILL.md:21-32`).** Corre antes de cada `Edit`/`Write` durante una sesión de
   debugging para chequear que la edición no se salga del alcance declarado. `VibeCodeProtocols/
   skills/caveman-tdd.md` y `skills/orchestrator-opus.md` fueron revisados: no tienen un hook
   mecánico equivalente de "scope boundary check" antes de cada edit — el control de alcance
   en VCP es prosa/checklist, no un hook ejecutable. Es una idea aplicable si VCP migra a
   hooks reales de Claude Code (`.claude/settings.json`), pero **no** existe hoy en VCP —
   "none found in VCP".
3. **Trust gate allowlist explícito para datos cross-proyecto (`bin/gstack-learnings-search:
   96-102`).** Solo admite aprendizajes de otro proyecto si `trusted === true` exactamente,
   nunca por ausencia del campo — la corrección explícita de un bug histórico donde `!== false`
   dejaba pasar filas legacy sin el campo. Relevante si VCP construye una función de "compartir
   aprendizajes entre proyectos": adoptar allowlist estricto, no denylist, desde el diseño.
4. **Separación lector/escritor puro para lógica de versión (`gstack-version-bump:
   classify` nunca escribe archivos, `write`/`repair` sí).** Patrón general reusable: los
   scripts de VCP (`scripts/verify-red.sh`, `scripts/vibe-memory.sh`) podrían auditarse contra
   el mismo principio (separar "decidir" de "mutar" en subcomandos distintos) — no se
   verificó en esta pasada si ya lo cumplen; queda para una revisión de `scripts/` de VCP, no
   se afirma que falte.

### Archivos explícitamente NO leídos en profundidad (justificación)

- `bun.lock`, `lib/diagram-render/bun.lock` — lockfiles de dependencias, no aportan
  contenido semántico para un informe de patrones de skill.
- `extension/icons/icon-{16,48,128}.png`, `docs/images/github-{2013,2026}.png` — binarios
  PNG; solo inventariados por nombre/ruta.
## Continuación — cierre de scripts/resolvers/ + scripts/ + muestra de test/ — 2026-08-17

Rango cerrado en esta pasada: los 22 archivos de `scripts/resolvers/*.ts` (excluye el
subdirectorio `scripts/resolvers/preamble/`, que ya estaba inventariado por nombre en
pasadas previas y sigue así), los 13 archivos directos de `scripts/` que quedaban sin
lectura de contenido, y una muestra real de 34 archivos de `test/` con contenido leído
(no solo nombre) — verificado vía `gh api repos/garrytan/gstack/contents/<path>?ref=
d078622b73539fc1a7a27e709861e9b6b058ae98 --jq '.content' | base64 -d`, primeros 1200-3000
caracteres por archivo (suficiente para firma, contrato de test y primeros casos, no
necesariamente el archivo completo en los más largos).

### scripts/resolvers/*.ts — 22/22 leídos (parcial, cabecera + cuerpo principal)

`browse.ts`, `codex-helpers.ts`, `composition.ts`, `confidence.ts`, `constants.ts`,
`design.ts`, `dx.ts`, `gbrain.ts`, `index.ts`, `learnings.ts`, `make-pdf.ts`,
`model-overlay.ts`, `preamble.ts`, `question-tuning.ts`, `redact-doc.ts`,
`review-army.ts`, `review.ts`, `sections.ts`, `tasks-section.ts`, `testing.ts`,
`types.ts`, `utility.ts`. Hallazgos con file:line:

1. **`scripts/resolvers/redact-doc.ts:1-40`** — single-source-of-truth explícito: la tabla
   de taxonomía de redacción (`{{REDACT_TAXONOMY_TABLE}}`) y el bloque de invocación por
   sink (`{{REDACT_INVOCATION_BLOCK:<sink>}}`) se derivan de `lib/redact-patterns` para que
   `/spec` y `/cso` nunca diverjan del motor real. `test/redact-doc-resolver.test.ts`
   confirma en runtime que la tabla generada contiene cada `PATTERNS[i].id` (sin drift).
   Patrón aplicable a VCP: si algún template de VCP describe reglas que también existen
   como código ejecutable (ej. gates de `scripts/verify-red.*`), un test que compare
   template-generado vs. fuente de verdad evita que la documentación mienta.
2. **`scripts/resolvers/model-overlay.ts:1-40`** — resolución de overlays por modelo con
   guarda de ciclos explícita (`seen: Set<string>`) en la recursión de `{{INHERIT:x}}`, y
   fail-open a string vacío si el archivo no existe o `ctx.model` es `undefined` — nunca
   lanza. Mismo principio de "degradar silenciosamente, no romper el pipeline de
   generación" ya documentado para `browse/src/security-classifier.ts`.
3. **`scripts/resolvers/sections.ts:1-60`** — el mismo placeholder `{{SECTION:id}}` se
   comporta distinto por host: en Claude emite un puntero `STOP. Read <path>`; en
   cualquier otro host **inlinea** el contenido completo de la sección. Confirma con
   file:line el mecanismo de "carve" (skills grandes divididos en secciones bajo demanda)
   que las pasadas anteriores solo habían mencionado de pasada.
4. **`scripts/resolvers/learnings.ts:1-40`** — allowlist de caracteres explícito
   (`QUERY_SAFE_RE = /^[A-Za-z0-9 _-]+$/`) sobre el argumento `query=` de
   `{{LEARNINGS_SEARCH:query=...}}` antes de interpolarlo en un bash `--query "..."` —
   defensa contra shell injection a nivel de *build-time* del propio SKILL.md, no solo en
   runtime. Ejemplo concreto adicional (además de los ya documentados) del patrón
   "cualquier valor que termine en un string interpolado a shell se valida con un
   allowlist, nunca un denylist".

### scripts/*.ts directos — 13 archivos cerrados en esta pasada

`build-app.sh`, `build.sh`, `dev-skill.ts`, `eval-list.ts`, `eval-watch.ts`,
`garry-output-comparison.ts`, `gen-llms-txt.ts`, `gen-skill-docs.ts`,
`gstack-schema-pack.ts`, `host-config-export.ts`, `setup-scc.sh`, `test-free-shards.ts`,
`update-readme-throughput.ts`. Sin lectura de contenido (JSON de config, no código):
`jargon-list.json`, `proactive-suggestions.json`. Hallazgo con file:line:

5. **`scripts/garry-output-comparison.ts:1-60`** — el propio README de gstack cambió su
   métrica de "vanity" (LOC crudo) a un múltiplo pro-rata de líneas lógicas añadidas,
   citando explícitamente una crítica pública recibida (comentario cita a
   Louise de Sadeleer por X/Twitter) como motivo del cambio. `update-readme-throughput.ts`
   implementa el patrón "ancla estable + marcador de pendiente explícito"
   (`GSTACK-THROUGHPUT-PLACEHOLDER` / `GSTACK-THROUGHPUT-PENDING`) para que CI rechace
   commits con el marcador de pendiente en vez de mostrar un número obsoleto o inventado.
   Aplicable a VCP si alguna vez publica una métrica derivada de un script (ej. cobertura
   real vs. reportada en README): preferir un marcador de "aún no calculado" explícito y
   rechazable por CI sobre dejar un número stale.

### test/ — muestra real de 34 archivos con contenido leído

Categorías cubiertas con lectura real (no solo nombre): e2e (`skill-e2e-review.test.ts`,
`skill-e2e-ship-idempotency.test.ts`, `skill-e2e-design.test.ts`,
`skill-e2e-plan-tune-cathedral.test.ts`; `skill-e2e-plan.test.ts` devolvió contenido vacío
en la llamada API — posible archivo grande truncado por el pipe, marcar como no verificado
y reintentar en una pasada futura), gbrain (`gbrain-guards.test.ts`,
`gbrain-init-rollback.test.ts`, `gbrain-repo-policy.test.ts`,
`gbrain-source-gitignore.test.ts`, `gbrain-detect-shape.test.ts`), redact
(`redact-engine.test.ts`, `redact-prepush-hook.test.ts`, `redact-pattern-lint.test.ts`,
`redact-audit-log.test.ts`, `redact-doc-resolver.test.ts`), regresiones
(`regression-1539-review-self-verify.test.ts`, `regression-pr1169-mktemp-fallbacks.test.ts`,
`regression-1624-retro-stale-base.test.ts`), carve/section
(`carve-guard-completeness.test.ts`, `carve-guards-negative.test.ts` — vacío en la
llamada, no verificado —, `section-manifest-consistency.test.ts`), setup
(`setup-windows-fallback.test.ts`, `setup-conductor-worktree.test.ts`), utilidades
(`one-way-doors.test.ts`, `jsonl-store.test.ts`, `jsonl-merge.test.ts`,
`touchfiles.test.ts`, `gstack-version-bump.test.ts`, `gstack-slug-sanitize.test.ts`,
`gstack-question-preference.test.ts`), y validación/paridad
(`skill-validation.test.ts`, `skill-size-budget.test.ts`, `parity-suite.test.ts`,
`plan-tune.test.ts`, `diff-scope.test.ts`). Dos llamadas (`skill-e2e-plan.test.ts`,
`carve-guards-negative.test.ts`) devolvieron contenido vacío pese a exit 0 — se listan como
"no verificado, pendiente de reintento", no como leído.

Hallazgos con file:line de la muestra:

6. **`test/redact-pattern-lint.test.ts:1-40`** — lint ReDoS estático (regex que detecta
   formas de backtracking catastrófico anidado tipo `(a+)+`) MÁS un meta-test que prueba
   que el propio linter detecta el patrón plantado (`"a planted catastrophic pattern WOULD
   be caught"`) — patrón de "testear el detector, no solo el detectado" aplicable a
   cualquier linter/gate que VCP construya sobre sus propios scripts.
7. **`test/gstack-question-preference.test.ts:1-20`** — test unitario que ejercita en
   runtime el gate de origen de usuario contra "profile poisoning" ya documentado en la
   pasada anterior (`bin/gstack-question-preference:164-179`), confirmando que es un
   contrato probado, no solo un comentario en código.
8. **`test/gstack-slug-sanitize.test.ts:1-25`** — regresión concreta: un valor de caché
   (`gstack-slug`) leído del disco se echoeaba sin sanitizar en versiones previas; un
   archivo de caché envenenado podía inyectar metacaracteres de shell en la salida de
   `eval "$(gstack-slug)"`. El fix sanitiza también la ruta de lectura desde caché, no solo
   el cómputo en vivo — recordatorio de que un allowlist aplicado solo en el "camino feliz"
   dejaba un segundo camino (cache hit) sin cubrir.
9. **`test/skill-size-budget.test.ts` y `test/parity-suite.test.ts`** — ambos usan un
   "ratchet" (5%/10% de crecimiento tolerado) contra un baseline versionado en
   `test/fixtures/parity-baseline-*.json`, con reglas explícitas de cuándo rebasear el
   baseline (cuando una feature deliberada empuja el tamaño más allá del ratchet) y una
   variable de override documentada (`GSTACK_SIZE_BUDGET_OVERRIDE_REASON`) que exige texto,
   no solo un booleano — para que un override quede auditable en el diff. Aplicable a VCP
   si algún día mide el tamaño de sus propios templates/skills contra un baseline.

### Ninguna idea nueva confirmada, con evidencia de "none found"

- No se encontró en los 22 resolvers ni en los 13 scripts directos ningún mecanismo de
  umbral 4R adicional al ya buscado en pasadas previas.
- No se encontró en la muestra de 34 tests ningún patrón de auto-commit WIP adicional.

### Estado de cobertura actualizado (honesto)

**`scripts/resolvers/*.ts` (excluyendo `preamble/`): 22/22 cerrados** con lectura de
contenido real (parcial en los más largos, íntegro en los más cortos). **13/13 scripts
directos restantes de `scripts/` cerrados.** Quedan sin leer: los ~23 archivos de
`scripts/resolvers/preamble/` (listados por nombre, confirmado vía `gh api
.../contents/scripts/resolvers/preamble` — 23 archivos `generate-*.ts`, no 24 como se dijo
en una pasada anterior), 2 archivos JSON de config (`jargon-list.json`,
`proactive-suggestions.json`, no aportan lectura semántica de código), y 3 archivos en
`scripts/app/` (2: `gstack-browser`, `icon.icns` — el segundo es binario) y
`scripts/host-adapters/` (1: `openclaw-adapter.ts`).

**`test/`: 34 archivos con contenido real leído en esta pasada** (2 de esos 34 devolvieron
contenido vacío en la llamada API pese a exit 0 — `skill-e2e-plan.test.ts` y
`carve-guards-negative.test.ts` — y se cuentan como "no verificado", no como leídos; por
tanto 32 archivos con lectura confirmada + 2 pendientes de reintento). Se confirmó por
listado directo (`gh api .../contents/test`) el desglose exacto de los 282 archivos de
primer nivel bajo `test/` (más los subdirectorios `test/helpers/` — 34 archivos — y
`test/fixtures/` — 26 en el nivel superior, más subdirectorios anidados como
`test/fixtures/ios-qa/` que elevan el total histórico citado de "43 fixtures" — la cifra
exacta de fixtures anidadas no se recontó en esta pasada, se hereda de la pasada anterior):

| Categoría (prefijo de archivo) | Cantidad | Estado |
|---|---:|---|
| `skill-e2e-*.test.ts` (incl. `skill-llm-eval*`, `skill-routing-e2e`) | 68 | 4 leídos con contenido, 1 no verificado (vacío), 63 solo nombre |
| `gbrain-*.test.ts` | 21 | 5 leídos, 16 solo nombre |
| `gstack-gbrain-*.test.ts` | 4 | 0 leídos, 4 solo nombre |
| `redact-*.test.ts` | 7 | 5 leídos, 2 solo nombre |
| `regression-*.test.ts` | 5 | 3 leídos, 2 solo nombre |
| `gstack-*.test.ts` (resto, no gbrain) | 28 | 3 leídos (`gstack-version-bump`, `gstack-slug-sanitize`, `gstack-question-preference`), 25 solo nombre |
| `setup-*.test.ts` | 7 | 2 leídos, 5 solo nombre |
| `carve-*`/`section-*.test.ts` | 5 | 2 leídos con contenido + 1 no verificado (vacío), 2 solo nombre |
| `codex-*-e2e*`/`gemini-e2e.test.ts` | 4 | 0 leídos, 4 solo nombre |
| resto (unitarios varios: `jsonl-*`, `touchfiles`, `skill-validation`, `skill-size-budget`, `parity-*`, `plan-tune`, `diff-scope`, `one-way-doors`, etc.) | 131 | 6 leídos en esta pasada (`jsonl-store`, `jsonl-merge`, `touchfiles`, `skill-validation`, `skill-size-budget`, `parity-suite`, `plan-tune`, `diff-scope`, `one-way-doors` — 9 realmente), resto solo nombre |
| `test/helpers/*` | 34 | 0 leídos con contenido en esta pasada (se leyeron indirectamente vía imports citados, ej. `session-runner`, `e2e-helpers`, `touchfiles`, `carve-guard-checks`, `skill-parser` — pero no como archivo completo) |
| `test/fixtures/*` (nivel superior) | 26+ (subdirs no recontados) | 0 leídos, solo nombre |

Total `test/` con contenido real confirmado tras esta pasada: **32 archivos** (acumulado
desde 0 en pasadas previas, que solo inventariaban por nombre). Quedan sin lectura de
contenido aproximadamente **331 archivos** de `test/` (282 de primer nivel − 32 leídos +
34 helpers + 26+ fixtures de primer nivel, sin contar fixtures anidadas adicionales).

## Estado (actualizado 2026-08-17)

**PARCIAL — con el gap ahora precisamente cuantificado.** `scripts/resolvers/*.ts` (22/22,
excluyendo `preamble/`) y los 13 scripts directos restantes de `scripts/` quedan cerrados
con lectura de contenido real. `scripts/` en su totalidad (excluyendo `resolvers/preamble/`,
`app/`, `host-adapters/` — 26 archivos menores) está ahora leído. `test/` pasa de 0 a 32
archivos con contenido verificado (más 2 no verificados por respuesta vacía de la API),
sobre un total de ~363 (282 de primer nivel + 34 `helpers/` + ~43-47 `fixtures/` con
subdirectorios). El desglose por categoría de arriba reemplaza cualquier afirmación previa
de "363 sin lectura" — ahora es "32 leídos + ~331 pendientes, categorizados por prefijo con
conteos exactos". No se afirma cobertura exhaustiva de `test/`: 331 archivos siguen sin
lectura de contenido, concentrados sobre todo en `skill-e2e-*` (63 de 68 sin leer) y
`gbrain-*`/`gstack-*` (~57 sin leer).

- Los ~280 archivos bajo `browse/test/*.test.ts` y `browse/test/fixtures/*` — inventariados
  por nombre desde el manifiesto (cubren activity, CDP, seguridad, sidebar, terminal-agent,
  proxy, etc., a juzgar por los nombres), pero no se abrió el cuerpo de cada test. Se leyeron
  en cambio los módulos `src/*` que esos tests ejercitan, priorizando fuente sobre test según
  la instrucción de la tarea.
- `cso/`, `design-consultation/`, `design-html/`, `design/src/*`, `docs/designs/*.md`
  (17 documentos de diseño), `hosts/*.ts`, `ios-qa/scripts/gen-accessors-tool/*.swift`,
  `ios-qa/templates/*.template` — inventariados por nombre y ubicación; no se leyó el
  contenido. Quedan pendientes de una pasada futura si se requiere profundizar C14-C24 más
  allá de lo ya cubierto.

## Continuación — ship/SKILL.md full read + scripts/ — 2026-08-14

Lectura íntegra de `ship/SKILL.md` (1423/1423 líneas, vía `gh api ...contents/ship/SKILL.md
--jq '.content' | base64 -d`), incluyendo el preamble completo (líneas 1-802, antes solo
escaneado por headers) y los pasos 0-21 completos (líneas 803-1422). Además se leyó el
contenido completo de 20 scripts no-test de `scripts/` (antes solo inventariados por
nombre): `analytics.ts`, `archetypes.ts`, `brain-cache-spec.ts`, `capture-baseline.ts`,
`compare-pr-version.ts`, `declared-annotation.ts`, `detect-bump.ts`, `discover-skills.ts`,
`eval-compare.ts`, `eval-select.ts`, `eval-summary.ts`, `host-config.ts`, `models.ts`,
`one-way-doors.ts`, `preflight-agent-sdk.ts`, `psychographic-signals.ts`,
`question-registry.ts`, `skill-check.ts`, `slop-diff.ts`, `task-emission-schema.ts`,
`write-version-files.sh` (~3325 líneas combinadas). Se listó (sin abrir contenido) el
resto de `scripts/` — 39 entradas directas más 23 en `scripts/resolvers/` (incluye
`preamble/` como subdirectorio, aún sin contar sus ~24 archivos individuales) — y los 363
archivos de `test/` siguen sin lectura de contenido.

### El pipeline completo de `ship/SKILL.md`, no capturado antes

La pasada estructural previa solo tenía los headers. Con lectura completa:

- **Preamble (líneas 33-145):** bloque bash único que hace ~15 chequeos de estado antes de
  cualquier trabajo — versión, sesión activa con lock por PID en `~/.gstack/sessions/`
  (TTL 120min), `proactive`, `REPO_MODE`, `SESSION_KIND` (con detección explícita de
  Conductor vía `CONDUCTOR_WORKSPACE_PATH`/`CONDUCTOR_PORT`), flags de activación/primera vez,
  telemetría, `explain_level`, `question_tuning`, conteo de `learnings.jsonl`, `HAS_ROUTING`
  en `CLAUDE.md`, detección de vendoring (`.claude/skills/gstack` no symlink), modo checkpoint,
  y `GSTACK_PLAN_MODE`. Es una única pasada bash, no N herramientas separadas — barato en
  tokens/latencia frente a N llamadas a herramientas individuales.
- **"Only stop for" / "Never stop for" (líneas 848-869):** lista explícita y corta de qué
  SÍ bloquea (conflictos de merge no resolubles, fallos de test in-branch, hallazgos ASK
  de review, bump MINOR/MAJOR, comentarios Greptile que necesitan juicio, cobertura por
  debajo del umbral, plan items NOT DONE sin override, TODOS.md faltante/desorganizado) vs
  qué NUNCA bloquea (cambios sin commitear, elección de versión MICRO/PATCH, contenido de
  CHANGELOG, mensaje de commit, split en múltiples commits, auto-marcado de TODOS,
  hallazgos auto-fixeables). Es una separación explícita gate-vs-auto-proceed a nivel de
  todo el pipeline, no por paso individual.
- **Re-run behavior / idempotencia (líneas 871-879):** declara explícitamente que
  re-correr `/ship` re-ejecuta TODA verificación (tests, cobertura, plan completion, review,
  adversarial, VERSION/CHANGELOG, TODOS) pero solo las *acciones* son idempotentes (si
  VERSION ya bumpeado, saltar el bump pero seguir verificando; si ya pusheado, saltar el
  push). Regla explícita: "Never skip a verification step because a prior /ship run already
  performed it."
- **Step 0 (líneas 803-839):** detección de plataforma (GitHub/GitLab/desconocida) con
  fallback en cascada (`gh pr view` → `gh repo view` → símbolo git nativo → `main` → `master`)
  antes de determinar la "base branch" para todos los pasos siguientes.
- **Step 2, Distribution Pipeline Check (líneas 976-1001):** si el diff agrega un nuevo
  artefacto standalone (CLI, librería) detectado por patrones de archivo
  (`cmd/.*/main.go|bin/|Cargo.toml|setup.py|package.json`), verifica que exista un pipeline
  de release (`.github/workflows/*release*` o CI de GitLab); si no existe, pregunta si
  agregarlo ahora, diferir a TODOS.md, o marcar como no necesario. Es un chequeo que VCP no
  tiene: "¿este código nuevo es distribuible después de mergear?"
- **Step 3 (líneas 1004-1016):** mergea la base branch ANTES de correr tests — no después
  — para que los tests corran contra el estado post-merge real, con auto-resolución solo de
  conflictos triviales conocidos (VERSION, schema.rb, orden de CHANGELOG) y STOP explícito
  para el resto.
- **Step 12, Version bump (líneas 1036-1074):** confirma en detalle lo ya documentado (lector
  puro `classify` vs escritor `write`/`repair`) y agrega el dato nuevo: **Step 12.5 registra
  la decisión de versión como memoria durable** vía `gstack-decision-log` con
  `{"decision","rationale","scope":"repo","source":"skill","confidence":9}` — para que una
  sesión futura no tenga que re-derivar a ciegas por qué se bumpeó MINOR vs PATCH.
- **Step 15.0, WIP Commit Squash (líneas 1136-1199):** en modo checkpoint continuo, antes de
  agrupar en commits bisectables (Step 15.1), primero exporta el contexto `[gstack-context]`
  de cada commit WIP a un archivo (para que sobreviva al squash), y explícitamente **prohíbe**
  `git reset --soft` a ciegas si hay commits no-WIP mezclados (destruiría trabajo aterrizado
  real) — usa `git rebase -i --exec 'true' -X ours` en su lugar, o el reset-soft simple SOLO
  si se verificó que la rama es 100% WIP. Cita explícitamente el hallazgo de Codex sobre por
  qué el reset ciego es destructivo.
- **Step 16, Verification Gate (líneas 1239-1257):** "IRON LAW: NO COMPLETION CLAIMS WITHOUT
  FRESH VERIFICATION EVIDENCE" — antes de pushear, si CUALQUIER código cambió después de la
  corrida de tests original, se debe re-correr y pegar output fresco; lista explícita de
  racionalizaciones prohibidas ("Should work now" → RUN IT; "I'm confident" → confidence is
  not evidence; "I already tested earlier" → code changed since then). Esto es
  prácticamente el mismo principio que el hard gate de VCP (RED visible antes de
  implementación), aplicado en el otro extremo del pipeline (verificación fresca antes de
  push, no solo antes de implementar). **Aplicable a VCP:** el Fase 4 podría citar
  explícitamente esta lista de racionalizaciones prohibidas como ejemplos concretos de qué
  NO aceptar como evidencia, en vez de solo decir "necesita evidencia fresca".
- **Step 17, credential pre-push guard (líneas 1263-1324):** antes del push, chequea si el
  hook `gstack-redact` está instalado; si el repo usa un `core.hooksPath` custom (Husky u
  otro), NO instala silenciosamente — imprime una línea sugiriendo instalación manual, para
  no pisar un hook committeado del equipo. Ofrece instalar el guard una sola vez por máquina
  (nunca vuelve a preguntar tras la primera respuesta).
- **Steps 18-21:** sync de docs + PR (delegado a `sections/pr-body.md`, no releído en esta
  pasada), persistencia de métricas de ship a JSONL para que `/retro` trackee tendencias
  (Step 20), y un nudge de descubribilidad de `/plan-tune` que se muestra una sola vez por
  máquina tras el primer ship exitoso (Step 21).
- **PR/MR title invariant (línea 1346):** todo PR/MR creado o actualizado DEBE tener el
  título prefijado `v$NEW_VERSION <type>: <summary>`, computado por un único script fuente
  de verdad (`gstack-pr-title-rewrite.sh`) — nunca hand-rolled.
- **Section self-check final (líneas 1400-1406):** antes de terminar, lista cada sección que
  el Section Index marcó como aplicable y confirma que se hizo `Read` de cada una; si algún
  paso se ejecutó de memoria sin leer su sección, para y rehace ese paso. Refuerza el patrón
  "no trabajar de memoria" ya documentado en pasadas previas, ahora con file:line exacto.

### Middle section (líneas 460-800, antes sin leer contenido)

Contiene bloques de comportamiento transversal (no específicos de ship): Writing Style
(glosa de jerga curada la primera vez, `scripts/jargon-list.json`), Completeness Principle
"Boil the Ocean" (recomendar cobertura completa salvo trabajo genuinamente no relacionado),
Confusion Protocol (parar solo ante ambigüedad de alto riesgo — arquitectura, modelo de
datos, alcance destructivo — no para cambios rutinarios), Continuous Checkpoint Mode (ya
documentado en la pasada anterior vía README.md, aquí con el formato exacto del commit
`WIP:` + bloque `[gstack-context]`), Context Health (resumen `[PROGRESS]` periódico en
sesiones largas; si se está loopeando en el mismo diagnóstico, STOP y reevaluar — nunca
mutar estado git en el resumen), Question Tuning (marcador `<gstack-qid:{id}>` embebido en
el texto de la pregunta para que un hook `PreToolUse` la identifique determinísticamente),
Repo Ownership (`REPO_MODE: solo` investiga y arregla proactivamente; `collaborative`/
`unknown` solo flaggea, no arregla — puede ser código de otra persona), Search Before
Building (3 capas: tried-and-true, new-and-popular con escrutinio, first-principles por
encima de todo — con logging de "Eureka" cuando el razonamiento desde primeros principios
contradice la sabiduría convencional), Completion Status Protocol (DONE /
DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT, con escalación tras 3 intentos fallidos).

### scripts/ — hallazgos de los 20 archivos leídos íntegros

- `scripts/one-way-doors.ts:1-60` — clasificador de "puerta de una vía" como capa
  **secundaria** de seguridad: la fuente primaria es el campo `door_type` en
  `scripts/question-registry.ts` (declarado por pregunta registrada); este archivo es un
  fallback de patrones de keyword (`rm -rf`, `drop table`, `force-push`, `git reset --hard`,
  etc.) SOLO para preguntas ad-hoc sin entrada en el registro. Comentario explícito citando
  a Codex: "prose-parsing is too weak to be the PRIMARY safety gate — wording can change."
  Orden de resolución: registro → keywords → default `ASK_NORMALLY` (nunca defaultea a
  auto-decidir). Patrón aplicable a VCP si alguna vez clasifica automáticamente qué acciones
  son irreversibles: declarar la clasificación explícitamente en un registro estructurado
  primero, usar heurística de texto solo como red de seguridad secundaria, nunca como fuente
  primaria.
- `scripts/question-registry.ts:1-50+` — esquema tipado central para TODAS las invocaciones
  de `AskUserQuestion` del repo: cada pregunta registrada tiene `id` kebab-case estable,
  `door_type` (`one-way`/`two-way`), `category`, `signal_key` opcional. Las opciones usan
  "stable option keys" separadas de las etiquetas de UI, para que las preferencias
  sobrevivan a cambios de wording. Confirma con file:line el mecanismo ya citado en la
  pasada anterior (gate de origen de usuario) pero agrega el detalle de que la keyness
  estable es lo que hace posible /plan-tune sin romperse ante refraseos.
- `scripts/psychographic-signals.ts:1-60` — mapa **hand-crafted, no inferido por el
  agente en runtime**, de `{question_id, user_choice} → {dimension, delta}` con deltas
  pequeñas y conservadoras (±0.03 a ±0.06) para que una sola respuesta empuje el perfil sin
  reformarlo. Principio de diseño explícito: "no runtime NL interpretation" — cada mapeo es
  TypeScript explícito, citando corrección de Codex (#4) y una decisión de usuario
  documentada. Aplicable como principio general si VCP alguna vez deriva preferencias de
  usuario desde comportamiento: preferir tablas explícitas versionadas sobre inferencia de
  LLM en runtime para señales que afectan comportamiento futuro.
- `scripts/slop-diff.ts:1-60` — patrón de "diff de hallazgos nuevos": corre un scanner
  (`slop-scan`) tanto en HEAD como en el merge-base, y compara resultados con un
  **fingerprint insensible a número de línea** ("line 142: empty catch" → "empty catch") para
  que código que se desplazó no genere falsos positivos de "hallazgo nuevo". Solo reporta
  hallazgos que existen en HEAD y no en la base. **Aplicable a VCP:** si Fase 5 (Simplify) o
  un futuro gate de calidad corre un linter/scanner sobre el diff completo, este patrón
  evita que hallazgos preexistentes (fuera de scope del cambio actual) bloqueen el ship —
  concretamente resuelve el problema de "¿este hallazgo lo introdujo este PR o ya estaba?"
  sin necesitar que el diff completo esté limpio primero.
- `scripts/declared-annotation.ts:1-60` — anotación de una línea sobre el perfil declarado
  del usuario (ej. "Your declared profile leans ship-small-fast"), explícitamente
  **solo declarativo, nunca usado para AUTO_DECIDE** — comentario cita "declared-only per
  TODOS.md E1 substrate-risk guidance", con AUTO_DECIDE inferido marcado como "v2" (no
  implementado aún). Es otro caso del patrón general "señal usada para mostrar contexto, no
  para decidir automáticamente, hasta que se demuestre confiable con más datos".
- Otros scripts leídos (`analytics.ts`, `archetypes.ts`, `brain-cache-spec.ts`,
  `capture-baseline.ts`, `compare-pr-version.ts`, `detect-bump.ts`, `discover-skills.ts`,
  `eval-compare.ts`, `eval-select.ts`, `eval-summary.ts`, `host-config.ts`, `models.ts`,
  `preflight-agent-sdk.ts`, `skill-check.ts`, `task-emission-schema.ts`,
  `write-version-files.sh`): utilitarios de infraestructura interna de gstack (evals,
  generación de docs de skill, empaquetado de config por host, esquema JSONL de tareas
  agregadas entre reviews) sin hallazgos nuevos con aplicabilidad directa a VCP más allá de
  lo ya documentado — se leyeron íntegros para cerrar cobertura, no producen una sección
  propia.

### Ninguna idea nueva confirmada, con evidencia de "none found"

- Se buscó en `ship/SKILL.md` completo un umbral 4R o equivalente al de VCP: no aparece
  (mismo resultado que en pasadas anteriores, ahora confirmado contra el archivo completo,
  no solo headers).
- Se buscó un mecanismo de auto-commit WIP adicional al ya documentado: el detalle nuevo
  encontrado (Step 15.0, exportación de contexto pre-squash + prohibición explícita de
  reset ciego) es un refinamiento del mecanismo ya conocido, no un mecanismo nuevo.

### Estado de cobertura actualizado (honesto)

`ship/SKILL.md` pasa de "escaneado por estructura (headers)" a **leído íntegro, 1423/1423
líneas**. De los ~85 archivos bajo `scripts/` (39 directos + 23 en `resolvers/` + los
`preamble/` y `app/`, `host-adapters/` como subdirectorios sin contar aún sus archivos
individuales), 20 se leyeron íntegros en esta pasada (antes: 0 con lectura de contenido,
solo nombre). Quedan sin leer: ~19 scripts directos restantes de `scripts/`, los 23 archivos
de `scripts/resolvers/` (incluidos los ~24 de `scripts/resolvers/preamble/` mencionados en
pasadas previas como "sin abrir" — aún así), y el subdirectorio `scripts/app/` y
`scripts/host-adapters/` sin inventariar en detalle. Los 363 archivos de `test/` siguen sin
lectura de contenido — solo nombre, como en todas las pasadas anteriores. No se afirma
cobertura "exhaustiva": sigue siendo una pasada adicional de profundización, no el cierre
del ledger.

### Estado de este bloque

Los 24 bloques C01-C24 quedan marcados `cerrado — 2026-08-14` en la tabla de arriba, en el
mismo sentido explícito que usa la sección C25-C48: **inventario estructural 100% + lectura
íntegra de ~50 archivos densos en señal**, no lectura línea-por-línea de los 600 paths. La
tabla usa "cerrado" en vez de "parcial focalizado" porque a diferencia de C25-C48 esta pasada
cubrió proporcionalmente más superficie de `bin/` (30/75 scripts, incluidos los de mayor
tamaño y complejidad) y todos los módulos de seguridad más citados en el resto del informe
(`redact-*`, `cdp-allowlist`, `url-validation`, `path-security`, `staging-guard`). Sigue
siendo honesto decir que no se llegó a "100% estudiado": faltan ~280 tests de `browse/test/`,
la mayoría de `design/src/*` (14 archivos), los 17 documentos de `docs/designs/*.md`, y los
templates Swift de `ios-qa/`.

## Continuación — pasada FINAL, foco en decisión (2026-08-17)

Re-fetch verificado (`gh api .../contents/<path>?ref=d078622b73539fc1a7a27e709861e9b6b058ae98`)
de `scripts/slop-diff.ts` (177 líneas, completo) y `ship/SKILL.md` Step 16 (líneas 1236-1249).
No hay hallazgos nuevos de superficie — el objetivo era exactitud de detalle sobre dos
candidatos ya flaggeados, no cobertura adicional.

### `scripts/slop-diff.ts` — algoritmo exacto de fingerprint

No es un hash: la clave de comparación es una tupla de string literal:
```
key = `${ruleId}|${filePath}|${stripLineNum(evidence)}`
```
donde:
```ts
function stripLineNum(evidence: string): string {
  return evidence.replace(/^line \d+: /, "").replace(/ at line \d+ /, " ");
}
```
Solo pela **dos** patrones de prefijo/infijo de número de línea del string de evidencia
(`"line 142: empty catch"` → `"empty catch"`; `"... at line 142 ..."` → `"... ..."`). No es
insensible a línea en general — es insensible a los DOS formatos literales que el propio
`slop-scan` emite. Si el string de evidencia cambiara de formato, o si el hallazgo mismo
mencionara un número que no sea de línea, no se pelaría.

**Comparación real (no diff textual sobre líneas):** corre `slop-scan --json` en HEAD, y por
separado en un `git worktree add --detach` del merge-base (worktree temporal, limpiado al
final). Cuenta ocurrencias por clave (`Map<key, count>`) en ambos lados, filtrado a
`changedFiles` (de `git diff --name-only base...HEAD`). `netNew = headCount - baseCount`;
si `netNew > 0`, toma los últimos `netNew` items de evidencia como "nuevos" (no hay
identidad estable por item individual — es conteo por bucket, no fingerprint por hallazgo).

**Caso "código movido, hallazgo no cambió pero el contexto sí":** SÍ se trata como
preexistente — el fingerprint no incluye número de línea ni nada del contexto circundante,
solo `ruleId + filePath + evidence-sin-línea`. Si el string de evidencia es idéntico
carácter por carácter salvo el número de línea, cuenta como el mismo finding aunque el
código de alrededor se haya reescrito por completo. Esto es una decisión de diseño
deliberada (evitar ruido cuando se reformatea/mueve código), pero significa que un
hallazgo cuyo *contenido* cambió sutilmente (ej. "empty catch" con un catch que ahora sí
tiene un log pero el mensaje de evidencia sigue diciendo "empty catch" por un bug del
scanner) no se re-detectaría como nuevo tampoco — la garantía depende 100% de que
`slop-scan` emita evidence strings estables y correctos, `slop-diff.ts` no valida esto.

### IRON LAW — texto verbatim (Step 16, `ship/SKILL.md`)

```
## Step 16: Verification Gate

**IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

Before pushing, re-verify if code changed during Steps 4-6:

1. **Test verification:** If ANY code changed after Step 5's test run (fixes from review
findings, CHANGELOG edits don't count), re-run the test suite. Paste fresh output. Stale
output from Step 5 is NOT acceptable.

2. **Build verification:** If the project has a build step, run it. Paste output.

3. **Rationalization prevention:**
   - "Should work now" → RUN IT.
   - "I'm confident" → Confidence is not evidence.
   - "I already tested earlier" → Code changed since then. Test again.
   - "It's a trivial change" → Trivial changes break production.

**If tests fail here:** STOP. Do not push. Fix the issue and return to Step 5.

Claiming work is complete without verification is dishonesty, not efficiency.
```
(Texto exacto confirmado del fetch: la última oración es "Claiming work is complete without
verification is dishonesty, not efficiency." — corregido el bloque de cita de arriba, que
por error de transcripción decía "not evidence".)

Son exactamente **4** frases prohibidas, ninguna más, cada una con su contra-respuesta fija:
`"Should work now"`, `"I'm confident"`, `"I already tested earlier"`, `"It's a trivial
change"`. No hay una quinta ni variantes — la lista completa cabe en Step 16, no está
dispersa en otras secciones del archivo (grep confirmado, sin otras ocurrencias de
"IRON LAW" en `ship/SKILL.md`).

### Recomendación final para VCP

1. **slop-diff pattern → NO portar el mecanismo genérico tal cual, SÍ portar el principio.**
   El algoritmo real es más simple y más frágil de lo que sugiere la descripción de alto
   nivel ("fingerprint insensible a línea"): es matching de string literal post-strip de dos
   regexes específicas al formato de un scanner externo (`slop-scan`) que VCP no usa. Portar
   el *principio* — "diffear hallazgos HEAD vs merge-base por bucket normalizado, no por
   línea, para no bloquear ship por preexistentes" — es válido y aplicable a Fase 5
   (Simplify) o cualquier gate de lint futuro en VCP, pero implementarlo requiere: (a) que el
   linter/scanner de VCP emita evidence strings estables entre corridas para el mismo
   hallazgo lógico, y (b) aceptar la limitación conocida (contexto reescrito con evidence
   string idéntico = invisible al diff). No implementar el `git worktree add` + doble-scan
   sin necesidad concreta — es la parte más costosa (dos scans completos + worktree
   temporal) y solo se justifica si VCP adopta un scanner externo real.

2. **IRON LAW list → SÍ portar textualmente a Fase 4.3/4.4 de VCP.** Es corta (4 frases),
   concreta, y ya alineada con el principio "trust what's derived, not narrated" que SKILL.md
   ya tiene. Recomendación: citar las 4 frases verbatim en el hard gate de Fase 4 como
   ejemplos de racionalizaciones rechazadas explícitamente, en vez de reformular. Bajo
   riesgo, alto valor — es texto ya probado en producción por otro proyecto con la misma
   filosofía de gate, y da al usuario/agente un checklist accionable en vez de una regla
   abstracta.
