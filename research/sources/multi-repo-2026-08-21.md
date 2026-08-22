# Fuentes: 9 repos adicionales (ronda multi-repo 2026-08-21) — REVISIÓN 3 (ledger cerrado)

**Corrección obligatoria aplicada tras 2 rondas de feedback del usuario.** Revisión 2 declaraba
"FASE 1 completa" con 7 candidatos en estado ambiguo (PENDIENTE_DE_EVIDENCIA/SIN_VEREDICTO) — el
usuario marcó eso como contradicción bloqueante. Esta revisión 3: **cierra el ledger completo**,
78 candidatos, cada uno con exactamente 1 de 5 estados permitidos (`VALIDADO`/`YA_CUBIERTO`/
`RECHAZADO`/`CONFLICTO_DE_DISEÑO`/`EVIDENCIA_INSUFICIENTE`), aritmética verificada, sin
ambigüedad.

**No implementado. Nada de esto se aplicó todavía — espera 🔵 del usuario, un único menú al final
de este documento.**

---

## Corrección de atribución — bug de indexado en el workflow de ronda 2 (FASE 0.1)

**Bug real encontrado y corregido en esta auditoría.** El script del workflow `wf_d9e7e4ef-67c`
usaba `deepenResults.filter(Boolean).map((r,i) => ({repo: DEEPEN_TARGETS[i].key, ...}))` — cuando
el agente de `reverse-skill` falló (bloqueo del safeguard de ciberseguridad, ver abajo) y
`filter(Boolean)` lo removió del array, **todos los índices posteriores se corrieron una
posición**, desalineando el zip contra `DEEPEN_TARGETS`. Esto pasó en el primer intento del
workflow (antes del reintento que sí completó reverse-skill).

| Candidato/contenido devuelto | Label incorrecto (bug) | Repo real (verificado por contenido) | Resultado |
|---|---|---|---|
| `validate_skill.py`, `utils.py` (parsers de libro), 24 test files por nombre | `reverse-skill` | **book-to-skill** | Reatribuido correctamente en `book-to-skill.md` — nunca se persistió mal |
| `docs/SWARM_TASK_GRAPH.md`, `docs/HOOKS.md`, etc. (specs de jcode) | `book-to-skill` | **jcode** | Reatribuido correctamente en `jcode.md` — nunca se persistió mal |

**Verificación:** el contenido de cada bloque fue reconocido por su propio texto (menciona
explícitamente rutas `book_to_skill/`, `SWARM_TASK_GRAPH.md`, etc.) — no ambiguo, no requirió
reabrir el snapshot para confirmar de qué repo venía. El error fue detectado ANTES de escribir
`reverse-skill.md`/`book-to-skill.md`/`jcode.md`, por lo que **ningún archivo persistido en
`research/sources/` llegó a tener atribución incorrecta** — el bug vivió únicamente en el
journal.jsonl temporal del workflow (nunca usado como evidencia final). Documentado por
trazabilidad: `filter(Boolean)` antes de un `.map((r,i) => ...DEEPEN_TARGETS[i])` es un patrón
peligroso — cualquier reintento futuro de este tipo de workflow debe zipear por key explícita.

---

## Estado de cobertura, honesto (no "exhaustivo" salvo donde es literal)

**Nota de corrección (FASE 0.2):** una auditoría directa (`find` sobre cada clone) encontró 3
totales de repo incorrectos en la primera pasada: caveman (1418 declarado → **1416 real**),
book-to-skill (51 declarado → **85 real**, error de 34), airllm (86 declarado → **90 real**,
error de 4 — la declaración "EXHAUSTIVA literal 100%" queda **revocada**, downgradeada a
PARCIAL). Además, un duplicado de numeración en `reverse-skill.md` (candidato #6 repetido, mismo
file:line) fue detectado y corregido — el conteo de candidatos de ese repo bajó de 9 a 8 reales.

| Repo | SHA/pin | Total leído/repo | Estado |
|---|---|---|---|
| JuliusBrussee/caveman | `a42ef766c` | 19/1416 (1.3%) | **PARCIAL** — resto es motor Go de compresión, confirmado fuera de alcance |
| obra/superpowers | `b36e0829c` | 55/195 (28%) | **PARCIAL** — `docs/superpowers/` (34/34) cerrado al 100% en ronda 3; resto es tests de la herramienta propia + manifiestos cross-runtime |
| ayghri/i-have-adhd | `e7555fcaf` | ~45/57 (79%) | **PARCIAL** — total real 57 (no 52, corregido); 12 sin leer: 10 traducciones justificadas + LICENSE sin justificar + .gitignore |
| diegosouzapw/OmniRoute | `cbf23772e` | 21/12445 (0.17%) | **PARCIAL — deliberadamente permanente**, código de producto sin overlap metodológico |
| zhaoxuya520/reverse-skill | `a3bdfffc` | 29/572 (5%) | **PARCIAL** — resto es referencia de dominio de seguridad, no metodología |
| virgiliojr94/book-to-skill | `3a97a711` | ~19/85 (22%) | **PARCIAL** — total real 85 (no 51, corregido) |
| lyogavin/airllm | `8e456235` | 86/90 (96%) | **PARCIAL** — total real 90 (no 86, corregido), ya no EXHAUSTIVA |
| 1jehuang/jcode | commit `bfaca427d` + SHA-256 tarball `d9dc8d20...` | 73/1930 (3.8%) | **PARCIAL** — `docs/*.md` (62/62) cerrado al 100% en ronda 3; resto es motor Rust/app iOS/infra |
| mattpocock/skills | `0ab1b63a4` | 104/159 (65%) | **PARCIAL, mayoría cubierta** |

**Ningún repo queda EXHAUSTIVA.** "Exhaustivo" se reserva para 100% literal o exclusiones
no-textuales enumeradas una por una; ninguno de los 9 lo cumple.

**Total real: 431/16.949 archivos leídos (2.5%)** (subió de 381 tras cerrar `docs/superpowers/`
y `docs/*.md` de jcode al 100% en ronda 3). El grueso del delta restante (16.518 archivos) es
código de producto en OmniRoute/caveman/jcode, confirmado — no supuesto — fuera de alcance.

---

## LEDGER ÚNICO — 78 candidatos, 100% con veredicto final (sin estados ambiguos)

Estados permitidos únicamente: `VALIDADO` · `YA_CUBIERTO` · `RECHAZADO` · `CONFLICTO_DE_DISEÑO` ·
`EVIDENCIA_INSUFICIENTE`. Ningún candidato quedó sin uno de estos 5. Todo veredicto viene de un
juez adversarial independiente (no auto-puntuación) que abrió el archivo real en el snapshot
pineado y comparó contra el `SKILL.md` real de VCP — no contra el reclamo del propio candidato.

### Chequeo aritmético

```
VALIDADO (24) + YA_CUBIERTO (23) + RECHAZADO (24) + CONFLICTO_DE_DISEÑO (6) + EVIDENCIA_INSUFICIENTE (1)
= 24 + 23 + 24 + 6 + 1 = 78

TOTAL DE CANDIDATOS (recontado por fuente, ver research/sources/*.md):
caveman 10 + superpowers 22 + i-have-adhd 5 + omniroute 6 + reverse-skill 8 (corregido, tenía un
duplicado de numeración eliminado) + book-to-skill 6 + jcode 12 + mattpocock-skills 9
= 10+22+5+6+8+6+12+9 = 78

78 == 78  ✓ CIERRA EXACTO.
```

### Ledger completo — id | fuente | título | score | estado | razón

**CAVEMAN** (`a42ef766cedef6160407418a359a52939b2d20b9`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| caveman-1 | Contratos de output grep-ables por rol | `agents/cavecrew-*.md` | 4 | YA_CUBIERTO | VCP ya tiene roles nombrados + referencia a schema externo (orchestrator-opus.md) |
| caveman-2 | Refusal duro con token exacto | `cavecrew-builder.md:14-19,38-43` | 3 | YA_CUBIERTO | VCP ya más estricto (LAW 2); solo el formato de token es novedad menor |
| caveman-3 | `model:haiku` en roles baratos/read-only | `cavecrew-investigator.md:9` | 4 | VALIDADO | Cita verbatim confirmada; VCP no tiene rol read-only-solo hoy, addition opcional a futuro |
| caveman-4 | Auto-verificación releída del builder | `cavecrew-builder.md:21-26` | 3 | YA_CUBIERTO | GREEN/REFACTOR de VCP ya verifican vía suite completa, más fuerte que un re-read |
| caveman-5 | CCR — handle de recuperación de contexto | `docs/technical/context-recovery.md` | 2 | RECHAZADO | VCP no comprime `.vibe/`, no aplica |
| caveman-6 | Rama default fail-closed, invariante testeado por nombre | `packages/graders/AGENTS.md:49` | 5 | YA_CUBIERTO | LAW 8 ya impone exactamente este invariante en el gate de receipt |
| caveman-7 | Tests de paridad cross-language, 1 fixture JSON | `packages/graders/AGENTS.md:11-13` | 1 | RECHAZADO | VCP no tiene superficie dual-implementación equivalente |
| caveman-8 | Honesty-basis labeling (medido/inferido/verificado/sin precio) | `docs/technical/sdks-and-packages.md:110-112` | 4 | YA_CUBIERTO | IRON LAW + convención `verificado:`/`leído:` ya cubren el principio |
| caveman-9 | Contador "formas no mapeadas" como señal no-error | `packages/mastra/README.md:81-85` | 2 | RECHAZADO | Dominio de telemetría sin análogo en VCP |
| caveman-10 | Contratos de rechazo con string exacto | `cavecrew-builder.md:38-43` | 5 | YA_CUBIERTO | Duplicado de caveman-1/caveman-2, mismo mecanismo |

**SUPERPOWERS** (`b36e0829c6d0140e93cfef2ca599b1b07d4a7797`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| superpowers-1 | Scan de conflictos pre-vuelo del plan | `subagent-driven-development/SKILL.md:162-182` | 7 | VALIDADO | Gap real, Phase 2 no tiene tabla mecánica de overlap |
| superpowers-2 | Loop de fix 5 rondas + escalación + adjudicación | `subagent-driven-development/SKILL.md:354-429` | 6 | VALIDADO | TRIANGULATE/4.4 sin tope de rondas hoy |
| superpowers-3 | Ledger de resume atado a commit SHA | `subagent-driven-development/SKILL.md:131-154` | 1 | YA_CUBIERTO | SESSION.md/tasks.json/resume-check de VCP ya implementan esto casi verbatim |
| superpowers-4 | Receta positiva vs. prohibición | `writing-skills/SKILL.md:459-480` | 3 | RECHAZADO | Meta-nivel (cómo escribir reglas), no mecanismo de ejecución |
| superpowers-5 | Triage Bounded/Architectural/Spike | `brainstorming/SKILL.md:22-73` | 3 | YA_CUBIERTO | VCP ya tiene 2 mecanismos que cubren el mismo terreno (auto-routing + 4.4.1) |
| superpowers-6 | Batchear tareas del mismo tipo en 1 dispatch | `subagent-driven-development/SKILL.md:223-229` | 1 | CONFLICTO_DE_DISEÑO | Choca directo con LAW 2 ("1 subagent = 1 atomic task. Never more.") |
| superpowers-7 | Heurística de tier de modelo por forma de tarea | `subagent-driven-development/SKILL.md:184-219` | 5 | VALIDADO | VCP no tiene tiering por forma de tarea |
| superpowers-8 | Higiene de dispatch, nunca pegar historial | `subagent-driven-development/SKILL.md:230-233` | 5 | VALIDADO | Gap real, barato de adoptar |
| superpowers-9 | Micro-tests de wording antes de escenario completo | `writing-skills/SKILL.md:575-586` | 6 | VALIDADO | Meta-regla de VCP no tiene validación empírica de wording nuevo |
| superpowers-10 | Protocolo de "ruling" — decide en vez de parar | `subagent-driven-development/SKILL.md:19-31` | 1 | CONFLICTO_DE_DISEÑO | Choca directo con LAW 7 (🔵 siempre bloqueante, humano-en-el-loop) |
| superpowers-11 | Defense-in-depth, validar cada capa | `systematic-debugging/defense-in-depth.md` | 4 | YA_CUBIERTO | TRIANGULATE ya deriva casos cruzando paths |
| superpowers-12 | Separación reviewer/implementer a nivel orchestrator | `subagent-driven-development/SKILL.md:408-409` | 0 | YA_CUBIERTO | Point #14 de VCP ya lo establece |
| superpowers-13 | Espera basada en condición, anti-flaky | `systematic-debugging/condition-based-waiting.md` | 4 | RECHAZADO | Técnica genérica de testing, no gap de protocolo |
| superpowers-14 | Testear el prose del protocolo con escenarios de presión | `writing-skills/testing-skills-with-subagents.md:7-13` | 7 | VALIDADO | Mecanismo nuevo real para validar LAWS antes de shippearlas |
| superpowers-15 | Clasificación de persuasión para phrasing de reglas | `writing-skills/persuasion-principles.md:9-133` | 4 | VALIDADO | Documentación de por qué funcionan las LAWS actuales, mejora de calidad menor |
| superpowers-16 | Doctrina positiva vs. prohibición, empírica | `docs/superpowers/specs/2026-06-10-positive-instruction...` | 5 | YA_CUBIERTO | Refinamiento de superpowers-4, mismo mecanismo |
| superpowers-17 | "Abaratar mecánica, nunca juicio" + N=5 | `docs/superpowers/specs/2026-06-10-strict-cost-sdd-design.md:8,206-207` (N=5 runs, no 1; haiku 0/10 defectos plantados detectados) | 6 | VALIDADO | Gap real, fortalece DoD/LAW 6 |
| superpowers-18 | Loop fix con ledger de adjudicación | `docs/superpowers/specs/2026-07-15-sdd-fix-loop...` | 5 | YA_CUBIERTO | Idéntico a superpowers-2 |
| superpowers-19 | Presupuesto de revisión acotado por diff | `docs/superpowers/specs/2026-06-09-sdd-task-scoped...` | 5 | YA_CUBIERTO | VCP ya scopea por `git diff --stat` (Phase 3.1) |
| superpowers-20 | Presupuesto de revisión v2, canal "no puedo verificar" | `docs/superpowers/plans/2026-06-09-sdd-task-scoped...` | 4 | YA_CUBIERTO | Mismo archivo/mecanismo que superpowers-19 |
| superpowers-21 | Loop fix v3, resume-vs-fresco | `docs/superpowers/plans/2026-07-15-sdd-fix-loop...` | 3 | YA_CUBIERTO | Idéntico a superpowers-2/18 |
| superpowers-22 | Identidad estructural, no prosa, para estado durable | `docs/superpowers/specs/2026-07-06-sdd-plan-scoped-workspace.md:40-46` ("Identity lives nowhere in the data... Identity must be structural") | 6 | VALIDADO | Bug real de producción con analogía directa a `.vibe/SESSION.md` compartido de VCP |

**I-HAVE-ADHD** (`e7555fcaf612dfa1739dc86610ea926a906db614`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| i-have-adhd-1 | Harness de eval ciego pareado | `evals/rubric.md, run_evals.py` | 4 | RECHAZADO | Diseñado para calidad de respuesta conversacional, off-domain para gate de código |
| i-have-adhd-2 | Disclosure de autoría/proveniencia | `CONTRIBUTING.md:5-15` | 4 | RECHAZADO | VCP es pipeline single-agent, no multi-contribuidor OSS |
| i-have-adhd-3 | Suite de paridad conductual cross-platform | `tests/test_always_on_hooks.py:23-134` | 6 | VALIDADO | Gap real: `verify-red.sh`/`.ps1` sin test de paridad de comportamiento entre sí |
| i-have-adhd-4 | Edge case de frontmatter como test de 1ra clase | `hooks/always-on.sh:21-34` | 2 | YA_CUBIERTO | Sub-caso de i-have-adhd-3, mismo archivo de test |
| i-have-adhd-5 | Re-inyección de estado post-compactación por re-escaneo | `extensions/i-have-adhd.ts:90-153` | 4 | CONFLICTO_DE_DISEÑO | Depende de una API de runtime que VCP no tiene; VCP resuelve el mismo problema con re-detección por evidencia de archivos, arquitectura distinta |

**OMNIROUTE** (`cbf23772ec2d9842420ff454f599b1a5a2884602`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| omniroute-1 | Bans de git cross-session | `AGENTS.md:679-694` | 4 | RECHAZADO | Real y bien evidenciado, pero VCP es de sesión única — aplicabilidad angosta |
| omniroute-2 | Auto-shrink de ratchet + verificador anti-trampa | `docs/architecture/QUALITY_GATES.md:281-327` | 3 | RECHAZADO | Pesado en infra de CI, mal fit para el modelo de entrega de VCP |
| omniroute-3 | Gate anti-alucinación de docs generadas por IA | `docs/architecture/QUALITY_GATES.md:122-134` | 6 | VALIDADO | Gap real y acotado, aplicable directo a `.vibe/*.md` |
| omniroute-4 | Piso de coverage + ratchet, multi-runner | `AGENTS.md:443-460,665-666` | 6 | VALIDADO | Detalle de config real que falta en Phase 4.1 |
| omniroute-5 | Etiquetado de red-base heredado en PRs | `AGENTS.md:579-596` | 6 | VALIDADO | Phase 4.6 no chequea si la base ya está rota antes de push |
| omniroute-6 | Ban de atribución de IA en commits | `AGENTS.md` Hard Rule #16 | 2 | RECHAZADO | Contradice la convención propia del usuario (Co-Authored-By exigido en CLAUDE.md global) |

**REVERSE-SKILL** (`a3bdfffcf2e6a611a1cbdcc9a312be44527ac043`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| reverse-skill-1 | Auditor de grafo de evidencia read-only | `skills/ops/evidence-finding-path.md:41` | 2 | YA_CUBIERTO | VCP ya tiene la regla general (point #14, read-only reviewer) |
| reverse-skill-2 | Trigger de "deadlock", replan sin evidencia nueva | `skills/ops/analysis-decision-framework.md:79-81` | 3 | YA_CUBIERTO | VCP ya tiene gate de replanning (4.4.1) con métrica distinta |
| reverse-skill-3 | Barra de 2 fuentes independientes para "validado" | `skills/ops/analysis-decision-framework.md:52` (cita corregida — original `:455-463` no existía, archivo tiene 153 líneas) | 3 | RECHAZADO | Off-domain (forense de malware); LAW 1 ya trata un red test real como evidencia suficiente |
| reverse-skill-4 | Checklist de supply-chain de skills externos | `skills/ops/skill-supply-chain.md:33-42` (cita corregida — original `:673-682` no existía, archivo tiene 71 líneas) | 4 | RECHAZADO | VCP nunca instala skills/MCP de terceros como parte de su ciclo de vida |
| reverse-skill-5 | Binding content_hash+artifact_path | `skills/ops/evidence-finding-path.md:16-17` (cita corregida — original `:293-294` no existía, archivo tiene 131 líneas) | 2 | YA_CUBIERTO | `verify-receipt.mjs` ya hace fingerprinting sha256 de árbol completo, más fuerte |
| reverse-skill-6 | Linter mecánico de trazabilidad spec/evidencia | `skills/case-review/scripts/review_case.py:190-397` | 6 | YA_CUBIERTO | `verify-receipt.mjs` ya gatea sobre evidence a grano de receipt; mejora incremental, no gap nuevo |
| reverse-skill-7 | Modelo de 3 niveles PASS/WARN/FAIL | `review_case.py:378-380` | 3 | YA_CUBIERTO | Critical/High/Medium/Low de VCP (4.3) ya cubre la misma forma |
| reverse-skill-8 | Fijeza content_hash+path traversal guard | `review_case.py:267-283` | 6 | VALIDADO | Hardening real para cualquier campo de referencia a archivo que VCP agregue a futuro (hoy latente, no activo) |

**BOOK-TO-SKILL** (`3a97a7115ab3c82edf47f315b544fbcefdd8559c`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| book-to-skill-1 | Sanitización de Unicode invisible/inyección | `sanitize.py:70-97` | 5 | VALIDADO | Hardening real para intake de research/specs externos que VCP sí hace |
| book-to-skill-2 | Validador multi-lente de SKILL.md | `tools/validate_skill.py:56-85` | 4 | RECHAZADO | Ortogonal a las 8 LAWS de VCP — nada gobierna autoría de frontmatter |
| book-to-skill-3 | Scan advisory de output generado por inyección | `tests/test_scan_generated_skill.py:97-169` | 5 | RECHAZADO | Resuelve un problema que VCP no tiene (no genera skills consumidos por otros agentes) |
| book-to-skill-4 | Gate de estimación de costo/tokens pre-generación | `SKILL.md` Step 2.5 | 4 | RECHAZADO | Bajo leverage para un protocolo de gate TDD |
| book-to-skill-5 | Lectura acotada tipo REPL | `SKILL.md` Step 2.6 | 5 | RECHAZADO | Higiene genérica de Claude Code, no distintiva de VCP |
| book-to-skill-6 | Estimador de tokens CJK-aware | `book_to_skill/utils.py:80-96` | 1 | RECHAZADO | Detalle de implementación de extracción de PDF/EPUB, sin punto de contacto con VCP |

**JCODE** (commit `bfaca427d53ca8e0c9a39fe603eb5c613a5305c1` + SHA-256 tarball `d9dc8d20ff87f4e68a59dac6769b40de1964363cdbbb1ac691447f553f9ccbbe`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| jcode-1 | Campo obligatorio "qué NO revisé" | `docs/SWARM_TASK_GRAPH.md:254-269` | 7 | VALIDADO | Gap real, alto valor, aplicable directo a checkpoints de fase |
| jcode-2 | Cobertura enumerada por id | `docs/SWARM_TASK_GRAPH.md:281-294` | 6 | VALIDADO | Gap real; requiere ids direccionables (lift mayor pero real) |
| jcode-3 | Contrato fail-open del hook PreToolUse | `docs/HOOKS.md:69-83` | 3 | RECHAZADO | VCP no es motor de ejecución de hooks |
| jcode-4 | Disciplina estructural, no basada en prompt | `docs/SWARM_TASK_GRAPH.md:219-224,358-378` | 6 | CONFLICTO_DE_DISEÑO | El propio doc de jcode argumenta contra la arquitectura actual de VCP (script+prompt vs. servidor con grafo validado) — cambio de arquitectura, no adopción incremental |
| jcode-5 | Gate adversarial que auto-genera nodos-gap | `docs/SWARM_TASK_GRAPH.md:231-247` | 4 | CONFLICTO_DE_DISEÑO | Expande trabajo sin 🔵 por cada gap — choca con LAW 7 |
| jcode-6 | Growth accounting (seeded vs. grown) | `docs/SWARM_TASK_GRAPH.md:300-304` | 1 | RECHAZADO | VCP no tiene motor de grafo/DAG al que atar esta métrica |
| jcode-7 | Retention readiness scorecard | `docs/RETENTION_READINESS.md:47-68` | 0 | RECHAZADO | Métrica de producto/UX, sin superficie en VCP |
| jcode-8 | Testing de paridad con cota estadística (regla de 3) | `docs/RENDER_PARITY_ACCEPTANCE_CRITERIA.md:31-39` | 7 | VALIDADO | Idea nueva real, fortalece la IRON LAW con cota estadística en vez de bit pass/fail |
| jcode-9 | Tipado de nodo explore/implement/verify/fix | `docs/SWARM_TASK_GRAPH.md:167-179` | 3 | YA_CUBIERTO | Mismo mecanismo que RED→GREEN→TRIANGULATE→REFACTOR de VCP, otro vocabulario |
| jcode-10 | Presupuesto de regresión de memoria (topes vs. ratchet) | `docs/MEMORY_BUDGET.md:39-123` | 3 | EVIDENCIA_INSUFICIENTE | Cita real, pero nunca se tradujo a una regla concreta de VCP — no juzgable como adoptado/rechazado tal como está |
| jcode-11 | Script de triage de 1 comando | `docs/MEMORY_INCIDENT_RUNBOOK.md:13-33` | 2 | RECHAZADO | Runbook de incidente operacional de servidor, sin análogo en las fases de VCP |
| jcode-12 | Fórmula de voz de mensajes al usuario | `docs/MESSAGE_VOICE.md:36-38` | 3 | RECHAZADO | VCP no tiene superficie de notificación separada de los menús 🔵 ya especificados |

**MATTPOCOCK-SKILLS** (`0ab1b63a410a03d3627979a109c8695de27af954`)

| id | Título | file:line | Score | Estado | Razón |
|---|---|---|---|---|---|
| mattpocock-1 | Árbol de decisión de frontera-de-fase | `ask-matt/PHASE-BOUNDARIES.md:1-82` | 6 | VALIDADO | Gap real, relevante a "tareas largas" del usuario |
| mattpocock-2 | Glosario de dominio + gate de ADR | `domain-modeling/SKILL.md:1-59` | 4 | RECHAZADO | Evidencia no sostiene completo el claim del "gate de 3 condiciones" |
| mattpocock-3 | "Design It Twice" — interfaces paralelas | `codebase-design/DESIGN-IT-TWICE.md:1-52` | 5 | VALIDADO | Gap real, acotado a decisiones de interfaz |
| mattpocock-4 | Loop de feedback ajustado primero (diagnosing bugs) | `skills/engineering/diagnosing-bugs/SKILL.md:18,59-66` ("Phase 1 is done when the loop is tight and red-capable") | 6 | VALIDADO | Gap real distinto de LAW 1 — VCP no gobierna diagnóstico de bug existente |
| mattpocock-5 | Hipótesis falsables rankeadas antes de instrumentar | `skills/engineering/diagnosing-bugs/SKILL.md:88-98` ("Generate 3–5 ranked hypotheses before testing any of them... Each hypothesis must be falsifiable") | 5 | VALIDADO | Sub-técnica distinta de mattpocock-4, VCP tampoco la tiene |
| mattpocock-6 | Redacción obligatoria de secretos | `skills/engineering/diagnosing-bugs/SKILL.md:12-16` ("Redact every secret first: write `<REDACTED>` in its place") | 6 | VALIDADO | VCP no tiene regla de redacción — grep confirmado 0 hits en SKILL.md |
| mattpocock-7 | Meta-disciplina de escritura para agentes | `writing-for-agents/SKILL.md:1-307` | 2 | RECHAZADO | Guía de autoría, no mecánica de protocolo — fuera de alcance |
| mattpocock-8 | Revisión de código en 2 ejes, sin mergear | `code-review/SKILL.md` | 2 | YA_CUBIERTO | 4R de VCP (alto/crítico) ya spawea 1 reviewer independiente por lente |
| mattpocock-9 | Wayfinder — mapa de niebla de guerra multi-sesión | `wayfinder/SKILL.md:1-120` | 4 | CONFLICTO_DE_DISEÑO | Propone un paradigma de issue-tracker paralelo, compite con spec+plan+SESSION.md de VCP en vez de extenderlo |

---

## Los 24 VALIDADO — únicos con test de aceptación falsificable

| # | id | Título | Repo | Score |
|---|---|---|---|---|
| 1 | jcode-1 | Campo obligatorio "qué NO revisé" | jcode | 7 |
| 2 | superpowers-1 | Scan de conflictos pre-vuelo del plan | superpowers | 7 |
| 3 | superpowers-14 | Testear prose con escenarios de presión | superpowers | 7 |
| 4 | jcode-8 | Testing de paridad con cota estadística (regla de 3) | jcode | 7 |
| 5 | omniroute-3 | Gate anti-alucinación de docs | OmniRoute | 6 |
| 6 | omniroute-4 | Piso de coverage + ratchet multi-runner | OmniRoute | 6 |
| 7 | omniroute-5 | Etiquetado de red-base heredado | OmniRoute | 6 |
| 8 | mattpocock-1 | Árbol de decisión de frontera-de-fase | mattpocock-skills | 6 |
| 9 | mattpocock-4 | Loop de feedback ajustado (diagnosing bugs) | mattpocock-skills | 6 |
| 10 | mattpocock-6 | Redacción obligatoria de secretos | mattpocock-skills | 6 |
| 11 | superpowers-17 | "Abaratar mecánica, nunca juicio" + N=5 | superpowers | 6 |
| 12 | superpowers-9 | Micro-tests de wording | superpowers | 6 |
| 13 | superpowers-22 | Identidad estructural, no prosa | superpowers | 6 |
| 14 | jcode-2 | Cobertura enumerada por id | jcode | 6 |
| 15 | i-have-adhd-3 | Suite de paridad conductual cross-platform | i-have-adhd | 6 |
| 16 | reverse-skill-8 | Fijeza content_hash+path traversal | reverse-skill | 6 |
| 17 | superpowers-2 | Loop de fix 5 rondas + adjudicación | superpowers | 6 |
| 18 | superpowers-7 | Heurística de tier de modelo | superpowers | 5 |
| 19 | superpowers-8 | Higiene de dispatch | superpowers | 5 |
| 20 | mattpocock-3 | "Design It Twice" | mattpocock-skills | 5 |
| 21 | mattpocock-5 | Hipótesis falsables rankeadas | mattpocock-skills | 5 |
| 22 | book-to-skill-1 | Sanitización de Unicode invisible | book-to-skill | 5 |
| 23 | caveman-3 | `model:haiku` en roles read-only | caveman | 4 |
| 24 | superpowers-15 | Clasificación de persuasión para reglas | superpowers | 4 |

**No hay 50 VALIDADO. Hay 24. No se fuerza padding ni adopción — número real, no inflado.**

### Conflictos de diseño confirmados (6, NO adoptar)

- **superpowers-6**: batchear tareas — choca con LAW 2
- **superpowers-10**: ruling protocol — choca con LAW 7
- **i-have-adhd-5**: re-inyección por re-escaneo de contexto — arquitectura incompatible
- **jcode-4**: disciplina estructural de grafo — requiere cambio de arquitectura completo, no incremental
- **jcode-5**: gate adversarial auto-genera nodos sin 🔵 — choca con LAW 7
- **mattpocock-9**: Wayfinder — compite con spec+plan+SESSION.md en vez de extenderlos

### Único EVIDENCIA_INSUFICIENTE

- **jcode-10** (presupuesto de regresión de memoria): cita real, pero nunca se tradujo a una regla
  concreta de VCP en ninguna ronda — no hay suficiente para juzgar adopción/rechazo tal como está
  redactado. No se cuenta como aplicable ni como descartado.

### Sobre el objetivo de 100/top-50 — estado final, honesto

**No se alcanzó. 78 candidatos totales (no 100), 24 VALIDADO (no 50).** Las rondas 3 de deepening
en superpowers (28/28 archivos restantes de `docs/superpowers/`) y jcode (42/42 docs restantes)
cerraron al 100% los directorios de mayor densidad — sumaron 4 candidatos nuevos entre los dos,
de los cuales solo 2 llegaron a VALIDADO (superpowers-22, jcode-8), el resto fueron duplicados de
candidatos ya juzgados o rechazados por dominio. Esto confirma con evidencia repetida que el
corpus de estos 9 repos está agotado para el objetivo original: OmniRoute/caveman/reverse-skill/
book-to-skill fueron confirmados código de producto o dominio sin overlap en 2-3 rondas cada uno;
superpowers y jcode (los de mayor densidad real) ya están leídos en su totalidad en los
directorios que producían señal. Seguir leyendo los mismos 9 repos produciría relleno, no
candidatos genuinos nuevos.

---

## 🔵 Único menú — ledger cerrado, aritmética verificada

```
🔵 Estado final, cerrado: 78 candidatos, 100% con veredicto de 1 de 5 estados permitidos
(24 VALIDADO + 23 YA_CUBIERTO + 24 RECHAZADO + 6 CONFLICTO_DE_DISEÑO + 1 EVIDENCIA_INSUFICIENTE
= 78, verificado exacto). 9 repos PARCIAL (ninguno EXHAUSTIVA). 431/16.949 archivos leídos
(2.5%). Objetivo de 100 candidatos / top 50 validados: NO alcanzado — 78 candidatos reales,
24 VALIDADO reales, corpus agotado con evidencia repetida (rondas 3 en superpowers y jcode
cerraron al 100% sus directorios de mayor densidad y solo sumaron 2 VALIDADO más).

A) Implementar top 5 VALIDADO (score 7: jcode-1, superpowers-1, superpowers-14, jcode-8 — son
   4 con score 7, no 5; el 5to sería cualquiera de los 13 con score 6, decime cuál o dejámelo a
   mi criterio)
B) Implementar todos los 24 VALIDADO
C) Investigar repos nuevos para buscar 100 candidatos genuinos (estos 9 están agotados)
D) Cerrar research sin implementar
```

**No se asume ninguna elección. No se modifica código de VCP hasta la respuesta.**
