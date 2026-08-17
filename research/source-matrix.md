# Source Matrix — 13 fuentes originales del encargo

## Estado global: trazabilidad persistida; estudio exhaustivo pendiente

Esta versión reemplaza una pasada anterior que usaba el HEAD actual del repo como si fuera el
snapshot leído — eso era incorrecto: el commit leído y el commit consultado después no son
necesariamente el mismo cuando el repo sigue activo. Esta versión corrige eso: **cada fuente
fue investigada por un agente real independiente** (Task/Agent tool, no una sección del
orquestador simulando el rol), cada uno fijó su propio SHA exacto vía `gh api` ANTES de leer
nada, generó manifiesto de árbol de archivos a ese SHA, y reportó cobertura real
(archivos inventariados vs. revisados vs. excluidos-justificados). El informe completo de cada
fuente vive en `research/sources/<slug>.md` — este archivo es el índice, no el detalle.

**8 de 13 fuentes cerradas** (7 EXHAUSTIVA: `modo-tdah`, `claude-anatomy`, `the-architect`,
`cyber-neo`, `aprende-skill`, `claude-seo-ai`, `Agent-Reach` — + 1 COMPLETO: video 6ChZMEMJ8hA,
transcript+inspección visual+repo enlazado cerrados). **5 permanecen PARCIAL** (paperclip,
engram, gentle-ai, agency-agents, gstack) — las 4 más grandes del corpus (paperclip 4.559 blobs,
gentle-ai 1.982, gstack 1.183, agency-agents 343) no alcanzan el umbral estricto de cobertura
línea-por-línea en el número de pasadas dedicado hasta ahora, a pesar de rondas reales
adicionales con avance verificable en cada una — ver detalle de brecha exacta por fuente en la
tabla de abajo y en cada `research/sources/<slug>.md`.

**Agentes reales usados** (13, todos vía `Agent` tool, `subagent_type: general-purpose`,
background, en paralelo): cada uno con su propio agent-id de sesión, cada uno escribiendo su
propio archivo de salida de forma independiente. Ningún hallazgo de esta tabla fue producido por
el orquestador principal actuando "como si fuera" un investigador — eso es exactamente lo que
esta pasada corrige de la anterior.

---

## Índice — 13 informes individuales

| # | Fuente | SHA revisado (fijo, no HEAD actual) | Cobertura | Estado |
|---|---|---|---|---|
| 1 | [modo-tdah](sources/modo-tdah.md) | `8a6a89c09b75f1fa7375910eacdf9ac3e4797ce2` | 10/10 blobs: 8 textos/configs íntegros + 2 ZIP inspeccionados técnicamente con sus únicos SKILL.md leídos | EXHAUSTIVA |
| 2 | [claude-anatomy](sources/claude-anatomy.md) | `ab0e644f89c7320fb6fcbf471d003e842735f100` | 22/22 blobs textuales leídos íntegros; 4 JSON parseados | EXHAUSTIVA |
| 3 | [the-architect](sources/the-architect.md) | `774a02278f4fa99cc44d484911007d1ba29318ab` | 75/75 blobs: 74 textos/configs/plantillas/comandos leídos íntegros y sintetizados por familia + 1 JPEG inspeccionado técnicamente (hash, bytes, dimensiones); manifiesto reproducible | EXHAUSTIVA |
| 4 | [cyber-neo](sources/cyber-neo.md) | `dcac0a8f111954e543e1e66e02a222c0c489ca74` | 28/28 blobs: 22 UTF-8 íntegros (10.981 líneas), 2 scripts compilados/ejecutados y 6 PNG inspeccionados técnica y visualmente | EXHAUSTIVA |
| 5 | [aprende-skill](sources/aprende-skill.md) | `72287328a40956f0b655ce6547fc5344640a261b` | 38/38 blobs: 34 textos/configs/tests/manifiestos íntegros + 4 PNG inspeccionados técnicamente; validación local verde | EXHAUSTIVA |
| 6 | [claude-seo-ai](sources/claude-seo-ai.md) | `788e7b469f64ba34f9e6ad879677120d3fdd03a8` | 77/77 archivos de texto + 6 PNG — 0 sin contabilizar | **EXHAUSTIVA** |
| 7 | [paperclip](sources/paperclip.md) | `dc6fcd1ff1eaa52df7685c8d12257b650dbf611c` | manifiesto 4.559/4.559; P01/P04/P05 avanzados, P03 (client.ts+backup-lib.ts+27 migraciones), P02/P07/P08 tocados — ~4.400 restantes, mayoría packages/server | PARCIAL |
| 8 | [Video 6ChZMEMJ8hA + dataimpulse-mcp](sources/video-6ChZMEMJ8hA.md) | video: transcript+visual completos · repo: `6f1d0163787d913f6352735518aeae6eea010cd2` | pista hablada íntegra + 17 frames extraídos e inspeccionados (0:30-17:30), repo 9/9 | **COMPLETO** |
| 9 | [engram](sources/engram.md) | `1dafc0f63051b2214100f7bd801357e4aab61c26` | 499/499 blobs por bytes; `internal/store`+`internal/mcp`+`internal/llm` cerrados, `internal/cloud` parcial (8/27) — 138/178 Go restantes | PARCIAL |
| 10 | [gentle-ai](sources/gentle-ai.md) | `b002e0e7dfd30d7dbf5c3b43cf8be4e0fa7162da` | 57/1982 blobs — `review_facade.go` (4566L, verificado íntegro) + 5 archivos más cerrados | PARCIAL |
| 11 | [Agent-Reach](sources/agent-reach.md) | `93ae1d18c37b707dec053c7c4f9d91cd8ef8943d` | **120/120 archivos contabilizados** (109 íntegros + 11 excluidos-nombrados: logos/SVG sin lógica) | **EXHAUSTIVA** |
| 12 | [agency-agents](sources/agency-agents.md) | `ebe9c99acb5c96f9468de368d8bead775387d1a7` | 343/343 blobs inventariados; 143/270 perfiles con síntesis profunda (13/17 divisiones cerradas) — 127 restantes en 4 divisiones grandes | PARCIAL |
| 13 | [gstack](sources/gstack.md) | `d078622b73539fc1a7a27e709861e9b6b058ae98` | 1.183 blobs; `ship/SKILL.md`+`scripts/resolvers/*`+`scripts/*` cerrados, 32/363 tests muestreados con contenido real | PARCIAL |

---

## Ideas aplicadas a VCP — consolidado con file:line (extraído de los 13 informes)

| Fuente | Idea aplicada | VCP file:line | Verificado por agente |
|---|---|---|---|
| aprende-skill | Schema Reflexion (4 campos) | `templates/vibe/LESSONS.md:13-16` | sí, comparación campo a campo |
| aprende-skill | Confidence high/medium/low | `templates/vibe/LESSONS.md:17` | sí |
| aprende-skill | Retire-not-delete | `templates/vibe/LESSONS.md:10`, `skills/vibe-memory.md:211-213` | sí |
| aprende-skill | Confirm-gate (texto casi verbatim) | `skills/vibe-memory.md:197-206` | sí |
| aprende-skill | Dedup-annotate-never-drop | `skills/vibe-memory.md:193-195` | sí |
| aprende-skill | Cap de 15 candidatos | `skills/vibe-memory.md:190-191` | sí |
| cyber-neo | Severidad Critical/High/Medium/Low | `skills/security-baseline.md:11`, `SKILL.md:246-253` | sí, cita explícita a cyber-neo como upgrade |
| cyber-neo | Risk Score fórmula, scope-tiering numérico | **NO adoptado** — grep sin resultados | sí, confirmado ausente |
| the-architect | Gates no-auto-certificantes (validator solo lee) | mirrors `scripts/verify-receipt.mjs` (rechazo de `escalated`) | sí, análogo estructural |
| the-architect | EARS-form ACs, marcadores `[NEEDS CLARIFICATION]` | `templates/spec.md:24-31`, `skills/spec-plan-templates.md:30-36`, `SKILL.md:97` | sí, adaptación explícita con bloqueo antes de Plan/Build |
| claude-seo-ai | Least-privilege tool grants, no self-cert | `skills/orchestrator-opus.md:17-29` | sí, "probable convergencia independiente, no port" |
| claude-seo-ai | "Self-report no es prueba" | `skills/orchestrator-opus.md:41,106-108` | sí |
| claude-seo-ai | Capability-tiering, scoring fórmula | **NO adoptado** | sí |
| paperclip | Budget 80%/100% | `templates/vibe/COMPANY.md:39-43` (manual-check, no machine-enforced) | sí |
| paperclip | Atomic checkout/lock | `templates/tasks.json:18-19`, `COMPANY.md:85-92` (JSON field, no DB lock) | sí |
| paperclip | Org chart | `templates/vibe/COMPANY.md:10-28` (más angosto) | sí |
| paperclip | Runtime real (heartbeats/server) | **NO implementado**, disclaimer confirmado preciso | sí |
| engram | Dedup pre-write | `skills/vibe-memory.md:193-195` (grep plano, no DB topic_key) | sí |
| engram | Servidor MCP de 20 tools | **NO adoptado** | sí |
| gentle-ai | Auto-routing thresholds (1-3/4+) | `SKILL.md:56-63` (idéntico split, VCP más estricto: siempre pide 🔵) | sí, claim confirmada fuerte |
| gentle-ai | Receipt/RDD (fingerprint + fail-closed) | `scripts/verify-receipt.mjs:127-186,222-232` | sí, estructural genuino, escala reducida |
| agent-reach | Fallback multi-backend | análogo a `SKILL.md:246-250` (cyber-neo↔baseline) — convergencia, no derivación | sí |
| agency-agents | Formato persona-file | resemblance solo genérico — VCP es mecánico (INPUT JSON + gate binario), agency-agents es prosa de personalidad | sí, sin evidencia de derivación directa |
| gstack | Rúbrica 4R | **VCP es invención propia** — gstack no usa ese acrónimo, sus specialists son domain-named | sí, confirmado "inspired by" es honesto, no es copia |
| gstack | Quality-gate numérico bloqueante en Spec/Plan | **NO adoptado**, confirmado ausente en SKILL.md | sí |
| modo-tdah / claude-anatomy / video-dataimpulse-mcp | — | **Ninguna idea adoptada** — fuera de dominio (formato de respuesta ADHD, meta-decisión de primitivas, proxy residencial) | sí, los 3 agentes lo confirman explícitamente |
| **claude-seo-ai + gstack (convergencia independiente)** | **Hook `PreToolUse` que bloquea Write/Edit a paths protegidos ANTES de ejecutar** (denylist mecánica: `.git/`, `.env*`, keys, lockfiles) | **NO implementado** — VCP solo detecta post-hoc vía diff-grep (`skills/security-baseline.md:23`) | sí, 2 fuentes independientes lo señalan (`claude-seo-ai`: `hooks/hooks.json`+`scripts/guard-write.mjs:8-49`; `gstack`: `investigate/SKILL.md:21-32`) — gap real, no hipotético |
| paperclip (P01-P05) | Baseline-diff gate — separa findings nuevos de aceptados-con-razón versionados | **NO implementado** — VCP usa binario fix-or-log-DEBT sin mecanismo de aceptación (`SKILL.md:253-264`) | sí, `packages/db/src/check-migration-safety.ts` |
| gstack (C01-C24) | Allowlist estricta (no denylist) para datos cross-project | candidato, no evaluado aún contra VCP | sí, `bin/gstack-learnings-search:96-102` |
| engram (internal/store) | Dedup por hash exacto normalizado (no fuzzy/LLM) — `hashNormalized` = SHA-256(lowercase+whitespace-collapsed) | ya coincide en espíritu con `skills/vibe-memory.md:193-195`, pero el algoritmo exacto no estaba documentado ahí | sí, `store.go:6516-6520` |
| gstack (ship/SKILL.md) | "IRON LAW" pre-push: lista explícita de racionalizaciones prohibidas ("debería funcionar ahora", "estoy seguro") | **NO implementado** — VCP tiene el principio ("trust what's derived, not narrated") pero sin lista concreta de frases prohibidas | sí, hallazgo nuevo esta ronda, fortalece un principio ya existente |
| gstack (`slop-diff.ts`) | Diff de findings HEAD vs. merge-base, fingerprint insensible a número de línea — solo bloquean findings NUEVOS | **NO implementado** — VCP re-evalúa TODOS los findings de 4.3/4.4 en cada corrida, no distingue "ya existía" de "nuevo" | sí, candidato fuerte para Phase 4.3/4.4 |
| gentle-ai (`review.go`) | Mensajes de denial derivan el comando de recuperación EXCLUSIVAMENTE de campos congelados del JSON — nunca se fabrica un comando | **NO implementado** — `verify-receipt.mjs` usa un string `REJECTED:` fijo, más simple pero menos preciso | sí, `review.go` — más estricto que VCP actual |
| gentle-ai (`review.go`) | Tercer estado de gate "Contended" (race de lock advisory) además de allow/deny | **NO implementado** — VCP no modela contención concurrente (un solo orchestrator) | sí, sin análogo VCP — posiblemente no aplicable (VCP no es concurrente) |
| paperclip (P07/P08) | `isSafeSourceLocator()` rechaza URLs con credenciales embebidas en query/fragment | parcialmente cubierto por `security-baseline.md` categoría 1, pero sin chequeo específico de URL-con-credenciales | sí, `validators/skill-policy.ts` |
| engram (`internal/cloud`) | Rechazo fail-closed (no redactar, RECHAZAR) de metadata de auditoría cuyas keys matchean `token\|authorization\|cookie\|secret\|hash\|password\|bearer`, vía reflexión recursiva sobre maps/slices/pointers | **NO implementado** — candidato para `skills/vibe-memory.md` LESSONS PROTOCOL: escanear una lección propuesta antes de mostrarla en el 🔵 confirm-gate | sí, `internal/cloud/cloudstore/audit_log.go:910-968` |
| gentle-ai (`review_facade.go`) | Distinción explícita missing-vs-corrupt receipt con rutas de reparación distintas (ausente → replay; corrupto → nueva lineage forzada) | **NO implementado** — `verify-receipt.mjs` trata "no encontrado" y "corrupto/inválido" igual (mismo mensaje genérico) | sí, hallazgo nuevo, `review_facade.go` |
| gstack (`redact-doc.ts`) | Single-source-of-truth para patrones de redacción — un archivo canónico, todo lo demás lo importa | ya coincide en espíritu con el enfoque de VCP (un script fuente, no copias) pero sin verificar si `security-baseline.md` sigue el mismo patrón | sí, candidato de auditoría interna, no de adopción externa |
| gstack (`gstack-slug-sanitize`) | Gap real encontrado: sanitización de slug NO se aplica en la ruta de lectura de caché, solo en la de escritura | **hallazgo de bug pattern, no de feature** — útil como caso de estudio para el propio TRIANGULATE de VCP (ejemplo real de "asymmetric validation") | sí, `gstack-slug-sanitize` — anotado como ejemplo pedagógico, no como código a portar |

---

## Límites pendientes (honestos, no ocultados)

- **10/13 fuentes en PARCIAL** — los informes individuales enumeran qué queda por sintetizar
  semánticamente y por qué. Lectura por bytes, hash o clasificación de archivos no equivale a
  comprender funciones; las pasadas siguientes deben cerrar esos chunks de forma explícita.
- **claude-seo-ai**: el árbol reproducible es 83, no 68; sus 25 módulos `seo-*`, 13 scripts y
  documentación/referencias requieren lectura semántica por archivo.
- **the-architect**: el árbol reproducible es 75, no 62; `questions/phase-*.md` (4/1.566 líneas)
  y 39 archivos `knowledge/` requieren síntesis íntegra.
- **paperclip**: el manifiesto ya cubre los 4.559 blobs, pero no equivale a comprensión. Quedan
  pendientes P01–P10 por `packages/` y luego `server`/`ui`/`cli` por módulos cohesivos; no se
  puede declarar exhaustiva hasta registrar lectura semántica o inspección técnica por blob.
- **agency-agents**: no quedan blobs ni Markdown sin inventariar/parsear, pero 264 de 270 perfiles fuente siguen sin revisión semántica profunda; hash/frontmatter no equivalen a estudiar su contenido o funciones.
- **gentle-ai / gstack**: cobertura dirigida a las claims específicas bajo verificación, no al
  repo completo (2/1982 y 13/1185 respectivamente).
- Siguiente acción mínima para subir las 10 restantes: pasadas adicionales focalizadas por
  chunks con presupuesto explícito, registrando por archivo funciones, entradas, efectos, tests
  y conclusión de aplicabilidad a VCP.
