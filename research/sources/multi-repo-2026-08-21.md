# Fuentes: 9 repos adicionales (ronda multi-repo 2026-08-21)

Investigación real vía Workflow multi-agente (8 repos) + 2 agentes individuales (jcode, mattpocock/
skills — el workflow original falló en `skills` por error de schema, reintentado aparte). Cada
repo tuvo 1 agente dedicado con lectura real de archivos, manifest files_read/files_total, y
exclusion_reasoning explícita cuando el repo era demasiado grande para 100%. Fase de síntesis
adversarial (2 jueces, batches de 20) sobre los 34 candidatos del workflow principal; jcode y
skills fueron auto-puntuados por su propio agente con la misma rúbrica 0-10 (8-10 gap real de
alto valor / 5-7 real pero moderado / 2-4 marginal o parcialmente cubierto / 0-1 ya cubierto o no
aplica), por consistencia con el resto.

**protocolo (nahuelangeles) queda fuera de este archivo** — ya tiene su propio análisis exhaustivo
en `research/sources/protocolo-muralla.md`, con las 27 mejoras ya aplicadas (ver CHANGELOG v1.3.0).

**No implementado. Nada de esto se aplicó todavía — espera 🔵 del usuario.**

---

## Manifiestos por repo (SHA pineado, files_read/files_total, exclusión razonada)

| Repo | SHA/ref | Leídos/Total | Nota |
|---|---|---|---|
| JuliusBrussee/caveman | `a42ef766c` | 10/1418 | Monorepo enorme de compresión de tokens (motor Go); acotado a la capa de delegación de subagentes (`cavecrew`) |
| obra/superpowers | `b36e0829c` | 18/195 | Framework de skills real para Claude Code — el más denso en candidatos (13) |
| ayghri/i-have-adhd | `e7555fcaf` | 10/52 | Chico, leído casi completo |
| diegosouzapw/OmniRoute | `cbf23772e` | 6/12445 | App de producción (router LLM) — acotado a `AGENTS.md`/`CLAUDE.md`/quality-gates, no al código del producto |
| zhaoxuya520/reverse-skill | `a3bdfffc` | 24/572 | Skill de pentest — acotado a la capa de proceso (`skills/ops/*`), no al contenido de dominio de seguridad |
| virgiliojr94/book-to-skill | `3a97a711` | 15/51 | Chico, dominio distinto (parsing de libros) — pocos candidatos honestos |
| lyogavin/airllm | `8e456235` | 86/86 | **100% leído** — librería de inferencia ML, confirmado 0 overlap real de metodología |
| 1jehuang/jcode | tarball master, sin SHA git (clone por protocolo falló, bajado vía codeload) | 11/1930 | Producto Rust de agente de código — acotado a `.jcode/skills/`, docs de gates/hooks/swarm |
| mattpocock/skills | `0ab1b63a4` | 104/159 | Colección curada de skills prompt-only — el más grande de los 3 "densos" en candidatos junto a superpowers |

**Total: 302 archivos leídos de 16.930 en los 9 repos.** El resto excluido con razón explícita por
cada agente (código de producto/motor, no metodología) — ver `exclusion_reasoning` completo en el
journal del workflow (`w2vct3vgs`) para caveman/superpowers/i-have-adhd/OmniRoute/reverse-skill/
book-to-skill/airllm, y los reportes individuales de jcode/skills arriba.

---

## Candidatos rankeados (47 total, score 0-10, descendente)

### Tier alto (7-8) — gap real, aplicable directo

| # | Título | Repo | Score | Por qué |
|---|---|---|---|---|
| 1 | Bans de git cross-session (no stash, no tocar otros worktrees) | OmniRoute | 8 | VCP soporta builds paralelos (config B=Y) sin regla de seguridad git para worktrees concurrentes |
| 2 | Scan de conflictos pre-vuelo sobre todo el plan antes de Task 1 | superpowers | 7 | Phase 2 no tiene tabla mecánica de overlap archivo/interfaz entre tasks antes de Build |
| 3 | Loop de fix con tope de 5 rondas + escalación + adjudicación obligatoria al tope | superpowers | 7 | TRIANGULATE/4.4 no tienen tope de rondas ni adjudicación terminal — riesgo de loop infinito |
| 4 | Auto-shrink del ratchet con verificador anti-trampa | OmniRoute | 7 | `scripts/ratchet.mjs` solo congela manual, sin auto-reducción + verificador que aborte un "achique" falso |
| 5 | "Qué NO revisé" como campo obligatorio del artefacto de handoff | jcode | 7 | Ningún gate de VCP (RED/GREEN/TRIANGULATE/4R) exige declarar explícitamente qué quedó sin explorar |

### Tier medio (5-6) — real pero más acotado

| # | Título | Repo | Score |
|---|---|---|---|
| 6 | Contratos de output grep-ables por rol de subagente | caveman | 6 |
| 7 | Ledger de resume atado a rango de commit SHA, no solo estado | superpowers | 6 |
| 8 | Guía "receta positiva vs. lista de prohibiciones" según tipo de falla, con evidencia A/B | superpowers | 6 |
| 9 | Triage Bounded/Architectural/Spike con ratchet de una sola dirección + gate de aprobación universal | superpowers | 6 |
| 10 | Gate anti-alucinación de docs (grep de paths/comandos citados contra el árbol real) | OmniRoute | 6 |
| 11 | Auditor de grafo de evidencia de solo lectura (integridad referencial AC↔test↔task) | reverse-skill | 6 |
| 12 | Trigger de "deadlock" — replan obligatorio tras N acciones sin evidencia nueva | reverse-skill | 6 |
| 13 | Cobertura enumerada por id — auditoría no puede decir "todo bien" sin tocar cada item | jcode | 6 |
| 14 | Contrato fail-open documentado para el hook PreToolUse, con razón explícita | jcode | 6 |
| 15 | Árbol de decisión de frontera-de-fase (seguir/clear/handoff/subagente/compact) | mattpocock/skills | 6 |
| 16 | Glosario de dominio vivo + gate de 3 condiciones simultáneas para ameritar ADR | mattpocock/skills | 6 |
| 17 | "Design It Twice" — generación paralela de interfaces radicalmente distintas antes de comprometerse | mattpocock/skills | 6 |
| 18 | Refusal duro por cantidad de archivos en la propia definición del rol (con token de rechazo exacto) | caveman | 5 |
| 19 | Batchear tareas mecánicas del mismo tipo en un solo dispatch | superpowers | 5 |
| 20 | Heurística de tier de modelo por forma de tarea, con anti-patrón explícito | superpowers | 5 |
| 21 | Higiene de dispatch — nunca pegar historial de sesión acumulado en el prompt de un subagente | superpowers | 5 |
| 22 | Harness de eval ciego pareado con rúbrica pesada y gate numérico de release | i-have-adhd | 5 |
| 23 | Distinción piso/ratchet de coverage + exigencia de todos los runners, no solo uno | OmniRoute | 5 |
| 24 | Disciplina "loop de feedback ajustado primero" para diagnosticar bugs, con barra de completitud | mattpocock/skills | 5 |
| 25 | Redacción obligatoria de secretos en evidencia mostrada/committeada | mattpocock/skills | 5 |
| 26 | Meta-disciplina de escritura para agentes (jerarquía de info, poda de no-ops) — aplicable al propio SKILL.md | mattpocock/skills | 5 |

### Tier bajo (2-4) — marginal, parcialmente cubierto, o de ajuste dudoso

27-42: pin de modelo barato por rol (4), micro-tests de wording antes de escenario completo (4),
etiquetado de "red-base heredado" en PRs (4), sanitización de unicode invisible/inyección en texto
externo (4), hipótesis falsables rankeadas mostradas antes de instrumentar (4), wayfinder para
esfuerzos multi-sesión foggy (4), protocolo de "ruling" autónomo — **tensiona con LAW 7, rechazar**
(3), defense-in-depth genérico (3), disclosure de autoría explícito (3), barra de 2 fuentes
independientes para "validado" (3), checklist de supply-chain de skills externos (3), gate de
estimación de costo/tokens pre-generación (3), revisión de código en 2 ejes sin mergear —
subsumido por 4R (2), auto-verificación releída del builder — subsumido por GREEN/REFACTOR (2),
separación reviewer/implementer a nivel orchestrator — extensión trivial de #14 ya aplicado (2),
espera basada en condición para tests anti-flaky (2), lectura acotada tipo REPL para archivos
grandes — ya es práctica estándar (2).

### Tier cero (0-1) — ya cubierto o no aplica

43-47: ban de atribución de IA en commits (1, política organizacional no metodológica), binding de
hash por archivo en evidencia — subsumido por `verify-receipt.mjs` (1), handle de recuperación de
contexto comprimido — VCP no comprime `.vibe/` (0), y 2 más de solapamiento total con mecanismos ya
existentes (grep-search de "read-only separation" ya aplicado en la ronda anterior).

---

## Nota de rechazo explícito — tensión filosófica

El único candidato con **conflicto real de diseño**, no solo bajo valor: "protocolo de ruling"
(superpowers) — el subagente toma decisiones vinculantes en vez de frenar y preguntar, logueadas
para auditoría humana posterior. Esto choca directo con LAW 7 de VCP (🔵 siempre bloqueante para
decisiones de protocolo). Recomendación: **no adoptar la autonomía**, pero la lista acotada de
"stop-conditions" (los 4 casos donde SÍ para y pregunta) podría ser un insumo útil para afinar
cuáles decisiones de VCP ya son 🔵-obligatorias vs. cuáles podrían ser mecánicas sin pregunta —
evaluado, no incluido en la lista de arriba por ser meta-análisis, no un candidato en sí.

---

## Total real: 47 candidatos (no 50 — número honesto, no relleno)

27 puntúan ≥5 (genuinamente aplicables), 20 puntúan <5 (marginales/rechazados/ya cubiertos). Todo
trazable a file:line real de cada repo, vía el journal del workflow y los reportes de los 2
agentes individuales.
