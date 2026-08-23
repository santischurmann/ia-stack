---
name: VibeCodeProtocols
description: "TDD methodology for Claude Code: orchestrator runs under fableultracode contract, Sonnet 5 (low effort default) implements via 5 role-persona subagents (Test-Engineer/Builder/Refactor-Engineer/DOCS/CHORE — none certifies its own gate). Paperclip-style AI-company layer: org chart (.vibe/COMPANY.md), goal ancestry per task, atomic task checkout for parallel builds, append-only audit log (.vibe/AUDIT.md), lightweight budget policy w/ 3-retry hard stop. Auto-routing triage skips full pipeline for trivial changes. .vibe/ persists memory incl. LESSONS.md (Reflexion-schema, confirm-gated, deduped, retire-not-delete cross-project error memory) + optional Engram mirror. Final phase = fableultracode-orchestrated verify+risk-tiered simplify+security(cyber-neo)+risk-modulated adversarial+tests+receipt-gated commit/push/merge+backups+reflect+lessons-confirm. Hard gate: no red test = no code."
---

# VibeCodeProtocols — caveman edition

**Orchestrator runs under the INTERNAL ORCHESTRATION CONTRACT below, whole session (upgraded to
`/fableultracode` if that skill is present — never required). Sonnet 5 build tasks. Hard gate:
red test first, always.**

Model split: orchestrator = you, running the contract below (autonomy + rigor + comms, session-long).
Build tasks = Sonnet 5, effort **low** default (config below).

## INTERNAL ORCHESTRATION CONTRACT (self-contained, always active)

No external skill required for this. If `fableultracode` is present in this session's Skill
list, invoking it is a strict upgrade (wider multi-agent fan-out, higher adversarial vote
counts) — but its absence never blocks a single phase. The floor, always active:
- **Autonomous execution**: don't stop to narrate every step; act, report outcome.
- **Evidence-gated state changes**: no phase/gate marked done without a command's real output
  backing it (§ SUBAGENT OUTPUT SCHEMA, `orchestrator-opus.md`) — "should work now" is not evidence.
- **Lead-with-outcome comms**: report what happened first, mechanism second.
- **Code discipline**: no comments narrating what code does; only non-obvious why.
If `fableultracode` *is* invoked, its contract is a superset of this one — never a replacement
that skips the hard gates below (LAWS, receipt, role permissions still apply verbatim).

---

## LAWS — non-negotiable

1. No red test seen → no impl. Zero exceptions.
2. 1 subagent = 1 atomic task. Never more.
3. Subagents don't decide architecture.
4. Orchestrator codes zero features — spec/plan/verify/simplify/security/deploy only.
5. Every gate → 1 line to `.vibe/SESSION.md` (resume ledger) + matching 1 line to `.vibe/AUDIT.md` (accountability trail). **Solo el orchestrator escribe el ledger — nunca el subagente que hizo el trabajo** (source: `research/sources/protocolo-muralla.md` point #17): si el mismo agente que codeó/revisó también redacta su propia línea de estado, esa línea está contaminada por el sesgo de quien la escribe. Subagentes reportan al orchestrator; el orchestrator decide qué línea entra.
6. DoD: coverage **100% de cada métrica que el stack mida** (líneas, ramas y funciones cuando existan) + lint 0 + typecheck 0 + docs + .vibe updated + security clean + adversarial pass. Si el runner no mide una métrica, registrar la limitación real; nunca declararla cubierta por inferencia.
7. Config menus (model/effort/detail) at phase start. Content menus (approve/modify) at decisions. Both wait for answer. **Siempre multiple choice 🔵, nunca pregunta abierta de texto libre para una decisión de protocolo — ni "¿está bien así?" ni free-form, siempre A/B/C/D con recomendación explícita.** Fase por fase: nunca combinar el cierre de 2+ fases en un mismo mensaje ni adelantar contenido de la fase siguiente antes de que el usuario responda el 🔵 de la actual — 1 fase, 1 cierre, 1 respuesta, después la próxima. Confianza en la respuesta obvia no exime del 🔵: ni "es trivial" ni "seguro qué vas a elegir A" saltean el menú.
8. No receipt `terminal_state: approved` para el estado evaluado actual → no push/merge (4.6). Un receipt `escalated` **bloquea siempre** — el gate mecánico (`verify-receipt.mjs`) lo rechaza sin excepción, `override_note` incluido. Único camino: 🔵 OK explícito del usuario → orchestrator regenera un receipt NUEVO con `terminal_state: "approved"` (con `override_note` + timestamp como metadata de auditoría) → ese receipt nuevo es el que se evalúa. No existe una vía donde `escalated` + un campo lo vuelva pasable.

**IRON LAW — sin claims de completitud sin evidencia fresca.** Refuerzo textual de "trust what's
derived, not narrated" (fuente: gstack `ship/SKILL.md`, verbatim confirmado en investigación).
Ninguna de estas 4 frases es una razón válida para saltar verificación real:
- "Debería funcionar ahora" → CORRELO. Confianza no es evidencia.
- "Estoy seguro" → la confianza no reemplaza el output de un comando real.
- "Ya lo probé antes" → el código cambió desde entonces, re-verificar.
- "Es un cambio trivial" → los cambios triviales también rompen producción.
Declarar trabajo terminado sin verificación no es eficiencia, es deshonestidad.

**Al evolucionar este propio protocolo** (source: `research/sources/protocolo-muralla.md` points
#22/#23) — dos reglas meta que aplican a cualquier LAW/regla nueva que se agregue a `SKILL.md`/
`skills/*.md` en el futuro:
1. **Toda regla nueva trae su detector.** No "evitá el over-engineering" sino "over-engineering →
   `git diff --stat` contra los archivos declarados en la tarea". Una regla sin método de
   verificación es decorativa — se olvida en la primera sesión bajo presión de contexto.
2. **El comentario de un gate cuenta la herida, con el número de veces que pasó.** Un gate que
   nace de una buena práctica genérica se borra con el tiempo; uno que nace de un bug real
   documentado se respeta — ver los comentarios de origen en `scripts/verify-receipt.mjs`,
   `scripts/ratchet.mjs`, `scripts/pretooluse-red.mjs`.

---

## PHASE 0 — BOOTSTRAP

1. **Orchestration contract active** (§ INTERNAL ORCHESTRATION CONTRACT above, always). If Skill
   `fableultracode` is present in this session's tool/skill list → invoke it as an upgrade
   (wider fan-out, higher adversarial vote counts). Not present → proceed on the internal
   contract alone, note it in the Phase 0 report (step 7), never block or degrade a gate.
2. Detect stack: `ls package.json pyproject.toml go.mod Cargo.toml pom.xml 2>/dev/null`.
3. Read `.vibe/PROJECT.md` + `SESSION.md` + `DECISIONS.md` + `RETRO.md` (últimas 2 entradas) + `LESSONS.md` (entradas `status: active`) if exist. Full lesson protocol (confirm-gate, dedup, retire, decay, recall-on-touch): `skills/vibe-memory.md` § LESSONS PROTOCOL.
4. **Engram recall (opcional, best-effort, nunca bloqueante)** — buscá `mem_context`/`mem_search` en tu tool list (directas o diferidas). Si aparecen: `ToolSearch` para cargarlas, `mem_context` con el proyecto actual, ojeá 1-2 hits de `mem_search("vcp/<project>/<feature-slug>/gate-state")`. Si no aparecen: seguir sin más, sin reintento — pero SÍ mencionarlo en el paso 7. Esto es color adicional, **nunca** reemplaza el re-detect por evidencia del paso 5.
5. **Resume identity + evidence check** — `SESSION.md` shows unfinished gate or `tasks.json` has non-`done` task → do NOT restart at SPEC. Before reading the checkpoint, establish the requested `<feature-slug>`: a short lowercase kebab-case name for the feature actually requested. If the request covers multiple plausible features, do not invent one; ask the user to name it.

   Run the mechanical identity gate first:
   ```bash
   node .vibe/vcp-runtime/scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <feature-slug>
   ```
   Exit `0` is the only identity result that may resume: then re-detect phase with evidence (run that task's tests: FAIL=pre-GREEN, PASS=post-GREEN; `git diff` test files, changed-since-RED=violation stop). Never trust memory. Exit `1` means **never resume silently**; show exactly the matching 🔵 choice below, wait for the user, make only the approved change, then re-run the gate before any resume:
   ```
   🔵 SESSION.md belongs to another feature
   A) Archive the existing session, start a clean session for <requested-feature-slug> (recommended)
   B) Continue the declared feature instead; keep its slug and scope
   C) Retag only if it is genuinely the same work under a renamed feature; record the explicit reason in DECISIONS.md
   D) Stop and inspect the state
   ```
   ```
   🔵 SESSION.md has no valid feature identity (legacy or malformed state)
   A) Inspect it, explicitly assign its real feature slug, then re-run the gate
   B) Archive it and start a clean session for <requested-feature-slug>
   C) Stop and inspect the state
   ```
   Do not archive, retag, or choose an option on the user's behalf. If there is no resumable state, write `**Feature slug:** <feature-slug>` in `SESSION.md` before the first gate. Full evidence protocol: `skills/caveman-tdd.md` § RESUME.
6. No `.vibe/` → create from `templates/vibe/` (incl. `COMPANY.md` org-chart/budget copy — fixed shape, not a scratch file — and empty `AUDIT.md`). AI-company layer detail: `skills/orchestrator-opus.md` § AI COMPANY LAYER.
7. Report 1 line: memory loaded / new project / Engram no detectado (nunca omitir esta rama en silencio).
7b. **Nivel de rigor del proyecto** (source: `research/sources/protocolo-muralla.md` point #24) —
   una sola vez por proyecto, no por cambio, si `.vibe/PROJECT.md` todavía no lo tiene declarado.
   Complementa a `risk_level` (que es por-cambio, Phase 4.2) — este es el piso general:
   ```
   🔵 Nivel del proyecto (una vez, se guarda en PROJECT.md):
   A) Vidriera — si algo falla se ve feo un rato, nadie pierde nada real
   B) Herramienta — alguien toma una decisión con un número mal si esto falla
   C) Producto con plata — alguien pierde dinero o confianza real si esto falla
   ```
   La rigurosidad se paga y solo se paga cuando hay algo que perder — un nivel `A` no debería
   terminar arrastrando el aparato completo de un `C` salvo que un cambio puntual lo dispare por
   `risk_level` propio (Phase 4.2, ortogonal a esto).
8. 🔵 confirm detected stack (A approve / B correct).
9. **Auto-routing triage** — mecánico, nunca a criterio del modelo: primero enumerá los archivos
   que hay que **entender o verificar** para decidir con seguridad (archivo a cambiar + sus tests,
   callers/callees/config o contrato directo; no sólo el tamaño del diff) y registralos en
   `SESSION.md`. Sólo 1-3 archivos de contexto requerido Y sin ambigüedad de requirements → 🔵
   ofrecer skip a Direct Build (RED→GREEN→TRIANGULATE→REFACTOR de Phase 3 directo, sin Spec/Plan
   formales, igual hard-gate de red test). 4+ archivos de contexto, o cualquier ambigüedad, o
   pide artefacto durable (spec/plan que otro vaya a leer después) → full pipeline, sin excepción.
   Nunca auto-decide silenciosamente — el 🔵 siempre pregunta, el usuario elige:
   ```
   🔵 Cambio chico (≤3 archivos necesarios para entender/verificar, sin ambigüedad) — ¿pipeline completo o directo a Build?
   A) Direct Build — salta Spec/Plan, RED→GREEN→TRIANGULATE→REFACTOR igual
   B) Full pipeline — Spec→Plan→Build→Final
   ```

---

## PHASE 1 — SPEC

🔵 **FORCING QUESTIONS** (una por vez, esperar respuesta antes de la siguiente):
```
1. Necesidad — ¿qué se rompe, cuesta tiempo o bloquea HOY sin esto? (no "estaría bueno")
2. Status quo — ¿cuál es el workaround actual y qué cuesta (tiempo/errores/horas)?
3. Slice mínimo — ¿cuál es el AC más chico que prueba que esto funciona, antes del scope completo?
4. Evidencia vs. supuesto — ¿esto sale de un bug/falla observada, o es una suposición?
5. Non-goal — ¿qué NO vas a construir en esta vuelta, a propósito?
6. Reversibilidad — si sale mal, ¿cuánto cuesta deshacerlo?
```
Respuesta vaga/genérica en 1, 3 o 4 → repreguntar UNA vez pidiendo specifics. Escape hatch
objetivo (contable, nunca "se siente impaciente"): 2 preguntas distintas quedan sin respuesta
sustantiva tras su respectiva repregunta → cortar ahí, generar spec con lo que hay, anotar
`Forcing Questions: N/6 (resto: skipped(count))` en `.vibe/SESSION.md`. Respuestas a 5 y 6
alimentan directo las secciones Non-Goals/Constraints del spec — no las repreguntes ahí.

🔵 **CONFIG** (ask once):
```
A) Detail: minimal (ACs only) / standard (+ constraints+non-goals) / exhaustive (+ risk notes)
B) Include non-goals section? Y/N
```

Generate `docs/spec.md` — template: `skills/spec-plan-templates.md`.

Before offering CONTENT review, grep the draft for `[NEEDS CLARIFICATION:`. Any hit blocks
approval and transition to Plan/Build: present each exact question to the user, resolve it in the
spec, then re-check. Do not silently translate ambiguity into a guessed acceptance criterion.

🔵 **CONTENT** review:
```
A) Approved — proceed to Plan
B) Modify: [specify]
C) Cancel
```

`.vibe/SESSION.md` += what/why specced + resumen de Forcing Questions.

---

## PHASE 2 — PLAN

🔵 **CONFIG** (ask once):
```
A) Task granularity: coarse (module-level) / atomic (1 fn/module, default) / hyper-atomic (split further)
B) Parallel build allowed for independent tasks? Y/N (default Y — see orchestrator-opus.md § PARALLEL)
```

Generate `docs/plan.md` + `docs/tasks.json` — template: `skills/spec-plan-templates.md`. Status lifecycle per task: `pending→red→green→triangulate→refactor→done`.

**Preflight de conflictos (gate mecánico, antes de pedir aprobación):**
```bash
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
```
El gate usa como writers los tres campos declarados por tarea: `files_to_create`,
`files_to_modify` y `test_files`. Dos tareas que declaran el mismo path sólo pasan si existe
una ruta `depends_on` directa o transitiva entre ellas; el output las marca `SERIALIZED`, por lo
que no se pueden despachar en paralelo. Cualquier overlap sin orden, id duplicado, dependencia
desconocida/cíclica, campo no-array o path fuera del proyecto devuelve exit 1: corregí el plan
(serializá o dividí las tareas) y re-ejecutá el gate. No reemplaces este chequeo con la afirmación
del orchestrator de que las tareas “parecen independientes”.

🔵 **CONTENT** review:
```
A) Approved — start Build
B) Add/remove tasks: [specify]
C) Change order
D) Cancel
```

---

## PHASE 3 — BUILD (Sonnet 5 subagents, per task)

🔵 **CONFIG** (ask once before first task):
```
A) Model/effort: sonnet low (default, fast+cheap) / sonnet standard / sonnet high (complex logic)
B) Override per-task later if a task looks harder than expected? Y/N
```

Per task, topological order — full delegation pattern: `skills/orchestrator-opus.md`. Si Phase 2
permitió paralelo, sólo se despachan simultáneamente tareas que el preflight ya dejó sin conflicto
de escritura no serializado; un `SERIALIZED` conserva su orden topológico.

Role-persona per subagent (named mandate, not a generic sub-agent — hardens the "who's allowed
to certify what" boundary): **Test-Engineer** writes failing tests only, never touches impl.
**Builder** writes impl only, never edits the test it must satisfy. **Triangulator** derives
edge/negative/contract/boundary test cases from real ACs and writes tests only, never touches
production code. **Refactor-Engineer** touches neither's contract, only structure. None of the
four certifies its own gate — `.vibe/vcp-runtime/scripts/verify-red.sh`/`.ps1` and the test runner do, mechanically
(§ "trust what's derived, not narrated" — never accept a subagent's self-report of pass/fail as
the gate).

**3.1 RED** (role: Test-Engineer) — `skills/subagent-red.md`. Spawn `model: sonnet, effort: <config>`.
Writes exactly one test per explicit AC in `docs/spec.md` (not "minimum" — every AC gets its own
test, statically countable). Gate: `.vibe/vcp-runtime/scripts/verify-red.sh` (bash) or
`.vibe/vcp-runtime/scripts/verify-red.ps1` (PowerShell), with a literal test file and the exact
command `node --test`. The shipped adapter executes that exact Node-native invocation itself;
it rejects every other runner command instead of guessing from arbitrary output. A real assertion
failure, a local missing-module error, or a local SUT stack frame from an assertion-bearing test
passes. A generic runner/config error and all unsupported runners fail closed. Add another stack
only by adding a dedicated, falsified adapter — never by broadening a regex.
Rejected → 🚫 blocked, report to user. **Reporting note**: when the SUT doesn't exist yet, the
runner collapses ALL tests in the file into one file-level failure (verified: 6 `test()` calls,
top-level import missing → runner reports `tests 1, fail 1`, not 6) — report the static
AC-test count and the missing-module classification as two separate facts, never as "N tests
failed" (that claim is only true when tests actually ran and failed on their own assertions).

**Banned assertion patterns** (source: `research/sources/protocolo-muralla.md` point #6 —
verify-red.sh/.ps1 only prove the RED is real, not that the test is a good test): tautologies
(`expect(true).toBe(true)`), `toBeDefined()`/`assert x is not None` as the only assertion, an
assertion inside a loop that can iterate zero times (passes without having tested anything if the
input is empty), "renders without crashing"/"doesn't throw" as the entire test, assertions on
CSS classes or other implementation details instead of behavior. None of these fail
`verify-red.sh`/`.ps1` mechanically — Test-Engineer avoids them by rule, TRIANGULATE/4R Reviewer
flag them if they slip through.

**Mock-count discipline** (point #6): up to 3 mocks in one test is healthy. 4-6 → extract a pure
function. **7 or more → stop, you're testing at the wrong layer** — that many mocks to cover a
few lines of logic means those lines want to be a pure function tested with zero mocks.

**Pre-existing-test baseline** (point #18) — before touching any EXISTING file (not a brand-new
one), run its current tests first and note the baseline ("N tests green"). If something already
fails, **stop and report it as a pre-existing failure** — never fix it inline inside this task's
diff. A fix that rides along inside another task's changes is a fix nobody reviewed as its own
change.

**Scope check after GREEN** (point #19): `git diff --stat` against the files declared for this
task. Anything outside that list is scope creep — report it, don't silently keep it.

**Optional: PreToolUse enforcement** (point #1, `scripts/pretooluse-red.mjs`) — if
`.claude/settings.json` wires this script as a `PreToolUse` hook (see `README.md` § Optional
hardening), immediately after `verify-red.sh`/`.ps1` confirms a genuine RED, run:
```bash
node .vibe/vcp-runtime/scripts/pretooluse-red.mjs emit --feature <feature-slug> --task <task-id> --tests <red-test-file-1,red-test-file-2> --files <declared-production-path-1,declared-production-path-2> --command "node --test"
```
This is optional and degrades cleanly when absent — same pattern as `fableultracode`/`cyber-neo`
— but when present it makes RED-before-write a harness-level block, not something the model has
to remember to check. The receipt is feature/task/path-scoped, expires after 30 minutes, includes
the verified Node RED proof, and self-invalidates if a listed test changes. A RED for `T01` never
authorizes a write declared only by `T02`. Paths are both lexical and physical: `..`, an external
symlink, or a dangling symlink is rejected before Node runs or the hook authorizes a write.

**3.2 GREEN** (role: Builder) — `skills/subagent-green.md`. Verify PASS, no regressions.

**3.3 TRIANGULATE** (role: Triangulator) — `skills/subagent-triangulate.md`. Runs after GREEN,
before REFACTOR — never skipped, compact version allowed for trivial tasks but the edge-case
analysis must be stated explicitly, not silently omitted. Reads RED's test file first — every AC
RED already tests 1:1 is off-limits for re-derivation. Derives only NEW edge/negative/contract/
boundary cases from `approval_criteria` + spec ACs + implementation contract — never decorative
coverage, never a duplicate of an AC RED covered, every case traces to a real reason. An AC RED
skipped is a RED defect, reported back, never silently backfilled by TRIANGULATE. Case fails →
hands off to Builder for minimal fix, loops back to re-run TRIANGULATE (does not touch production
code itself, does not proceed to REFACTOR until all derived cases are green with evidence recorded).

**3.4 REFACTOR** (role: Refactor-Engineer) — `skills/subagent-refactor.md`. Verify still green
(full suite, including TRIANGULATE's derived cases — not just the original happy-path test).

**Handoff disclosure gate (every role and phase transition)** — a report that recommends the
next role or phase is an artifact, not disposable chat. Persist its exact text at
`.vibe/handoffs/<feature-slug>-<task-id>-<gate>.md` (or
`.vibe/handoffs/<feature-slug>-PHASE-<n>.md` for a phase-level handoff), then run:
```bash
node .vibe/vcp-runtime/scripts/verify-handoff-report.mjs check .vibe/handoffs/<feature-slug>-<task-id>-<gate>.md
```
The report must declare exactly one `NOT_REVIEWED:` line: either a concrete omitted surface, or
`none — <specific reviewed scope>`. Missing, blank, duplicate, or placeholder declarations fail
closed. On exit `0`, append `{gate, declaration, report_path}` to
`tasks.json[task].not_reviewed`; on exit `1`, do not transition. This exposes the boundary of
every evidence claim without letting a role self-certify its substance — the next role and 4R
review still assess whether the declared boundary is acceptable.

Checkpoint after each gate: 1 line `.vibe/SESSION.md` (`T<id> RED PASS` / `GREEN ✅` / `TRIANGULATE N cases green` / `REFACTOR green`) including the `NOT_REVIEWED` summary and report path, then `tasks.json` status bump. The final Phase 4 handoff follows the same disclosure gate before it offers a commit/push decision.

Parallel: tasks with no `depends_on` overlap → spawn simultaneously (if config B=Y).

---

## PHASE 4 — FINAL (orchestrated close-out)

Re-affirm the orchestration contract (§ top of file) — this phase leans hardest on it:
multi-agent fan-out + adversarial verify, not solo pass. If `fableultracode` was invoked in
Phase 0, this is where its wider fan-out actually pays off; if not, the internal contract still
runs 4.1-4.8 in full, just with the default (not upgraded) vote counts in 4.4.

**4.1 Verify** — full suite + coverage + lint + typecheck:
```bash
<test_command_with_coverage>
```
Gate: coverage 100% de cada métrica medible (líneas/ramas/funciones), unit/integration/e2e all pass. Any fail → spawn `subagent-chore.md`, re-run. El porcentaje no reemplaza ACs ni revisión adversarial: mide ejecución, no intención.

**Lint/typecheck gate — mechanical detection, three outcomes, never a silent skip:**

1. **Detect** — run these (or the language-equivalent) and log the real output as evidence,
   never assumed:
   ```bash
   # lint: config file present, or a package.json "lint" script declared
   ls .eslintrc* eslint.config.* 2>/dev/null
   grep -q '"lint"' package.json 2>/dev/null && echo "lint script declared"
   ls .flake8 2>/dev/null; grep -lE "ruff|flake8" pyproject.toml setup.cfg 2>/dev/null
   ls .golangci.yml .golangci.yaml 2>/dev/null

   # typecheck: tsconfig.json, a package.json "typecheck" script, mypy config, or a typed
   # language with a builtin checker (go vet/cargo check — "available" whenever go.mod/Cargo.toml exists)
   ls tsconfig.json 2>/dev/null
   grep -q '"typecheck"' package.json 2>/dev/null && echo "typecheck script declared"
   ls mypy.ini 2>/dev/null; grep -l "mypy" pyproject.toml setup.cfg 2>/dev/null
   ls go.mod Cargo.toml 2>/dev/null
   ```
2. **Three outcomes, mechanical, no judgment call:**
   - **Declared/typed AND the tool runs** → real gate: exit code must be 0. Fail → spawn
     `subagent-chore.md`, re-run.
   - **Declared/typed but the tool is missing or fails to launch** (command-not-found, not a
     lint/type FINDING) → **gate BLOCKS** — this is never N/A. Report to the user: tool
     declared in config/script but not installed/runnable, needs fixing before Phase 4 can close.
   - **Nothing declared, no typed-language marker found** → **N/A**, logged with the exact
     detection commands run above and their (negative) output as evidence in `.vibe/SESSION.md`
     — "N/A" is a conclusion backed by commands, never an unstated assumption.

**Gate falsification ritual** (source: `research/sources/protocolo-muralla.md` point #21) — if
the target project has its own CI/lint/typecheck gate you didn't write this session, it counts as
*verified* only after it's been broken on purpose and confirmed to actually go red. A green gate
you've never watched fail is written, not verified — the exact failure mode that motivated the
hardening of this repo's own `verify-red.sh`/`.ps1`/`verify-receipt.mjs`/`ratchet.mjs`/
`pretooluse-red.mjs` (all 4 ship with `FALSIFICACIÓN ·`-prefixed tests, `grep FALSIFICACIÓN
tests/` answers "is this actually adversarially tested" in one command). Applying the same
discipline to a target project's own gates is optional (costs time you may not have on every
project) but if you skip it, say so explicitly instead of reporting the gate as verified.

**4.2 Risk classification + Simplify** — antes de tocar un solo archivo, clasificá el
changeset. Mecánico, basado en evidencia — nunca "se ve grande":

```
risk_reasons:
- simplify_ignore_touch — alguna línea cambiada cae dentro de un bloque `simplify-ignore`
  existente (grep del marcador, comparar el rango contra `git diff -U0`)
- sensitive_path        — el diff toca un path listado en `.vibe/PROJECT.md` § Risk-sensitive
  paths. Si el repo contiene algún `.mq5` y esa sección está VACÍA → tratar como
  `sensitive_path` igual (fail-safe: vacío no es "sin riesgo", es "sin configurar")
- large_change          — >400 líneas cambiadas. NUNCA promueve a `alto` por sí sola —
  solo cuenta si coincide con otra reason (evita penalizar un refactor mecánico grande
  igual que un cambio chico en license.py)
- debt_reopened         — el diff toca un file:line ya logueado en `.vibe/DEBT.md`

risk_level:
- critico:  sensitive_path junto con otra reason cualquiera (2+ reasons donde una es
            sensitive_path) — OR 4.3 encontró un finding Critical que requirió fix.
- alto:     simplify_ignore_touch OR sensitive_path (solas) OR 2+ reasons sin sensitive_path.
- estandar: exactamente 1 reason no-`large_change` (incluye large_change solo si acompaña otra).
- bajo:     0 reasons.
```

Boy Scout (dead code, dup, premature abstraction, no new features) corre como antes — excepto:
las líneas dentro de un `simplify_ignore_touch` son de solo lectura, nunca se tocan. Tests
green after each file. Diff summary + `risk_level` + `risk_reasons` → `.vibe/SESSION.md`.

**4.3 Security** (role: Security-Officer) — if Skill `cyber-neo` is present, invoke it on the
changeset (11 categories, OWASP 2025 + CWE Top 25, 5 parallel subagents) — strict upgrade over
the baseline below. If absent, run `skills/security-baseline.md` instead (self-contained,
smaller category set, same Critical/High/Medium/Low severity model and same gate behavior —
never skipped, only narrower). Run `node .vibe/vcp-runtime/scripts/verify-security-baseline.mjs
check --base <merge-base-or-origin/main>`; it scans base delta plus staged, unstaged and untracked
files, not only committed history. Either way: Critical/High finding → fix before continuing,
re-scan. A fixed Critical finding retroactively bumps `risk_level` to `critico` for 4.4 if it
wasn't already (evidence-based, not optional). Medium/Low → log to `.vibe/DEBT.md`, ask user
severity call.

**4.4 Adversarial review — 4R rubric** (Risk / Readability / Reliability / Resilience,
replaces the old generic correctness/security/reproduce lenses):

- **Risk** — security, data exposure, permissions/authz, side effects on shared state.
- **Readability** — clarity, ownership boundaries, maintainability, whether the code documents
  its own non-obvious decisions.
- **Reliability** — determinism, error handling, integration points, regression risk.
- **Resilience** — invalid/malformed input, boundary values, partial failure, recovery path.

Every finding a reviewer raises records: `lens` (which R), `evidence` (exact command/output or
concrete code reference), `reproduction` (a runnable repro, or — if genuinely not reproducible —
explicit verifiable reasoning, never "seems off"), `impact`, `severity`, `verdict`
(confirmed/refuted). A finding with no `reproduction` field, empty or hand-waved, doesn't count
— refuted by default.

Intensity by `risk_level` (adaptive, but **never 0 reviewers** — a compact pass is the floor,
not a skip):
- `bajo`: **1 compact review** covering all 4R in one pass (one reviewer, four lenses, one report).
- `estandar`: **2 independent reviews**, each covering all 4R — independent means no shared
  context between the two beyond the diff itself; findings compared, disagreements surfaced to user.
- `alto`: **1 independent reviewer per R** — 4 reviewers total, each scoped to exactly one lens,
  deeper per-lens coverage than the compact pass.
- `critico`: **4R completo** (4 independent reviewers, one per lens, same as `alto`) **+ una
  reproducción independiente** de cada finding que sobrevive la primera pasada — a 5th reviewer
  (or the orchestrator itself) actually re-runs/re-derives each surviving finding's
  `reproduction` field from scratch, blind to the original reviewer's conclusion, before it's
  allowed into the receipt. A finding whose independent reproduction fails to confirm it gets
  demoted to refuted, not silently kept.

**Precision rule** (source: `research/sources/protocolo-muralla.md` point #13) — report a finding
only if it's a real defect that would actually hit a user, and you'd defend it with concrete
evidence. **When in doubt, stay silent.** Style/preference findings are prohibited unless they
hide a real defect — noise here costs more triage time than the bug it might catch.

**Read-only separation** (point #14) — every 4R Reviewer is read-only: it reports, it never
edits. The role that can veto (block a finding as unresolved) is never the same role that can fix
it — if the same agent both finds and patches, the patch has no adversarial check left on it.

**Refutador** (point #12) — for `alto`/`critico` tiers, the reproduction step above IS the
refutador: an agent blind to the original reviewer's conclusion, biased toward refuting, that
re-derives the finding's `reproduction` independently and returns `corroborado | refutado | no
concluyente`. Only `corroborado` gets fixed. For `bajo`/`estandar` this role is implicit in the
reviewer's own `verdict` field — no separate agent, cheaper tiers don't carry the extra pass.

**Finding id** (point #15) — every finding in the 4R report gets a short id (same
`id:<hash6>` convention as `.vibe/DEBT.md`, see `skills/vibe-memory.md`), so a finding can be
tracked across review rounds instead of silently reappearing under different wording.

**Strengths registry** (point #16) — the 4R report also names what's explicitly fine (and
therefore NOT a finding), so the next round doesn't re-litigate or regress something already
judged correct.

Findings surviving their tier's review → fix, re-verify, re-run that lens. Nunca saltear el pase
adversarial completo para ahorrar tokens — degradar cobertura dentro de un tier (menos detalle
por lente) antes que soltar el mecanismo, y nunca por debajo de 1 revisor real.

**4.4.1 Replanning escalation gate** (umbral, no tope rígido de líneas) — al corregir un finding
de 4.4, si la corrección real (medida, no estimada — `git diff --stat` sobre los cambios de este
fix específico) cruza cualquiera de estos umbrales:
```
- >200 líneas modificadas en este fix, O
- toca 3+ archivos de producción/configuración, O
- amplía contrato/API pública, dependencias, o esquema de datos MÁS ALLÁ del scope original de
  la tarea (no estaba en approval_criteria ni en docs/spec.md)
```
→ el orchestrator PAUSA antes de aplicar/continuar el fix (no bloquea la corrección en sí —
bloquea seguir sin replanificar):
1. Documentar en `.vibe/SESSION.md`: alcance real del fix, causa raíz de por qué escaló más
   allá de lo esperado, riesgo de aplicarlo vs. de no aplicarlo, y plan de rollback concreto
   (`git revert <sha>` una vez commiteado, o "no hay commit aún, descartar diff").
2. Actualizar `docs/plan.md`/`tasks.json` (nueva entrada o ampliación de `approval_criteria`) y,
   si corresponde, `.vibe/DECISIONS.md` con la decisión de ampliar scope.
3. 🔵 pedir confirmación explícita del usuario antes de aplicar el fix o seguir:
```
🔵 El fix para "<finding>" excede el scope original — <razón concreta: N líneas / M archivos /
   qué contrato/API/dependencia se amplía>.
A) Aplicar igual — scope ampliado, ya documentado arriba
B) Recortar el fix a lo mínimo que cierra el finding sin ampliar scope
C) Tratar como tarea nueva — vuelve a Plan (Phase 2)
```
Esto no reemplaza el criterio del reviewer — un finding real sigue siendo un finding real. Lo
que este gate frena es seguir corrigiendo en silencio cuando la corrección deja de ser "el fix
de este finding" y pasa a ser un cambio de scope no planeado.

**4.5 Tests (final)** — re-run full suite post-fixes from 4.3/4.4. Must be green — this is
the last check before commit. Después, escribí el receipt (el propio orchestrator lo lee/
escribe con Read/Write — sin script de shell, sin dependencia de `jq`):

```
.vibe/receipts/<feature-slug>-<fecha>.json
{
  "schema": "vcp.receipt/v1",
  "feature": "<de docs/spec.md>",
  "risk_level": "bajo|estandar|alto|critico",
  "risk_reasons": ["<code>: <path:lineas>", "..."],
  "simplify_ignore_respected": true,
  "adversarial_reviewers": "<N real usado — 1 (bajo) | 2 (estandar) | 4 (alto) | 4+repro (critico) — nunca 0>",
  "adversarial_findings": ["<lens>: <finding> — verdict: fixed|refuted, evidence: <...>", "..."],
  "evidence": ["<comando real corrido en 4.4/4.5, ej. 'pytest -q -> 47 passed'>"],
  "spec_coverage": ["<AC-id>: <archivo-de-test> — COMPLIANT|FAILING|UNTESTED|PARTIAL"],
  "coverage_pct": <numero>,
  "git_head": "<git rev-parse HEAD>",
  "tree_fingerprint": "<sha256 sobre HEAD + bytes-en-disco de cada path tracked cambiado (staged+unstaged) + path/contenido de cada untracked no ignorado, ver scripts/verify-receipt.mjs>",
  "terminal_state": "approved"
}
```

**`spec_coverage` — un veredicto por AC, `UNTESTED` incluido** (source: `research/sources/
protocolo-muralla.md` points #11/#47) — cada AC de `docs/spec.md` aparece una vez: `COMPLIANT`
(test pasa y prueba exactamente ese AC), `FAILING` (test existe, falla), `UNTESTED` (ningún test
cubre este AC — el caso que atrapa un gate que dice verificar algo sin verificarlo), `PARTIAL`
(cubierto parcialmente). Un receipt con cualquier `UNTESTED` no es motivo de bloqueo mecánico
(eso sigue siendo `terminal_state`), pero es una señal que el usuario tiene que ver antes de 🔵
aprobar push — nunca queda implícito.

**Cada string de `evidence`/`adversarial_findings` se marca `verificado:` o `leído:`** (point
#20) — "verificado: pytest -q -> 47 passed" (un comando real corrió) vs "leído: revisé
`auth.py:40-60`, la lógica se ve correcta" (inspección sin ejecución). Mezclarlos sin distinguir
es cómo nace un falso verde — una inspección leída no es lo mismo que una corrida verificada, y
el receipt no debe dejar que parezcan lo mismo.

**LIFECYCLE DEL RECEIPT — orden exacto, no ambiguo:**

1. **`git add -A` ANTES de generar el fingerprint** — todo lo que va a formar parte del commit
   (incl. los archivos `.vibe/*.md` que este mismo Phase 4 fue actualizando: SESSION.md, AUDIT.md,
   DEBT.md, etc.) queda staged primero. El receipt evalúa el estado que efectivamente se va a
   commitear, no un estado intermedio a medio stagear — de lo contrario un `git add` posterior
   sin cambio de bytes invalidaría el receipt sin razón real de negocio (ver más abajo por qué
   eso SÍ debe invalidar cuando ocurre *después* del receipt).
2. **Fingerprint se genera DESPUÉS del `git add -A`**, pasándole el path exacto del receipt que
   se va a escribir (aunque ese archivo todavía no exista en disco — el flag solo importa para
   la exclusión, no requiere que el archivo ya esté ahí):
   ```bash
   node .vibe/vcp-runtime/scripts/verify-receipt.mjs fingerprint .vibe/receipts/<feature-slug>-<fecha>.json
   ```
3. **El receipt se escribe con ese `git_head`+`tree_fingerprint` exactos**, inmediatamente — no
   hay paso intermedio entre calcular el fingerprint y escribir el JSON que lo contiene.
4. **`git add -A` de nuevo, ahora incluyendo el receipt recién escrito** — el receipt mismo debe
   quedar staged para el commit de 4.6 (`git add -A && git commit`, el receipt es parte de lo que
   se commitea, es evidencia permanente en el repo).
5. **`node .vibe/vcp-runtime/scripts/verify-receipt.mjs check <receipt>` (4.6)** — vuelve a calcular el fingerprint
   del estado actual (excluyendo el mismo path del receipt) y lo compara. Si nada cambió entre
   el paso 2 y este paso, matchea → exit 0.

**Por qué el receipt se excluye SOLO de su propio fingerprint, no de todo `.vibe/receipts/`:**
el archivo que se está escribiendo/chequeando no puede incluirse en el cálculo de su propio
`tree_fingerprint` — sería una referencia circular (el hash tendría que conocerse a sí mismo
antes de existir). Esa es la ÚNICA razón de la exclusión, y por eso es una exclusión de un path
exacto, no de la carpeta entera: cualquier OTRO archivo en `.vibe/receipts/` (otro receipt de
otra feature, un archivo suelto) no tiene ese problema circular y SÍ debe invalidar el
fingerprint si aparece o cambia — de lo contrario alguien podría colar un archivo extra en esa
carpeta sin que el gate lo note.

**Modelo de hash real** (implementado en `scripts/verify-receipt.mjs`, no texto decorativo):
tres estados separados — HEAD→INDEX (staged, vía `git diff --raw --cached --no-abbrev -z`,
ambos lados son blobs reales), INDEX→WORKTREE (unstaged, mismo comando sin `--cached`; el lado
worktree usa `git hash-object` sobre los bytes reales en disco, no el placeholder de ceros que
git deja ahí), y UNTRACKED no ignorado (path + sha256 de bytes). Nunca se hashea texto de
`git diff` plano — ese texto no es content-addressed para binarios (ver hardening pass 2/3 en
CHANGELOG.md). `-z` + parsing NUL-safe maneja renames/copies (registros `R`/`C` con dos paths,
se hashea el destino). Compatible SHA-1/SHA-256 (largo de hash nunca hardcodeado).

`terminal_state` es `escalated` (no `approved`) si algún finding de 4.3/4.4 sigue sin fix que el
usuario haya aceptado explícitamente. **`escalated` bloquea siempre, sin excepción — ni
`override_note` ni ningún campo lo vuelve pasable por el gate mecánico de 4.6.** La única salida
es: 🔵 el usuario aprueba explícitamente, el orchestrator regenera un receipt **nuevo** con
`terminal_state: "approved"` (guardando `override_note` + `override_timestamp` como metadata de
auditoría en ESE receipt nuevo), y es ese receipt nuevo el que se re-evalúa en 4.6 — nunca el
`escalated` original con un campo agregado (ver LAW 8). El campo `evidence` existe para que una
relectura humana pueda chequear que 4.4 realmente corrió — es disciplina procedural auditable,
no una garantía criptográfica. Escrito inmediatamente antes de 4.6, en el mismo aliento — si el
estado evaluado cambia entre esta escritura y el commit, `tree_fingerprint` queda stale y el
validador de 4.6 lo rechaza mecánicamente (no hace falta acordarse de regenerarlo a mano).

**4.6 Commit/push/merge** — gate previo, mecánico, no de lectura:
```bash
node .vibe/vcp-runtime/scripts/verify-receipt.mjs check .vibe/receipts/<feature-slug>-<fecha>.json
```
Exit 0 **únicamente** si `terminal_state: approved` Y el fingerprint matchea el estado evaluado
actual Y `evidence` no vacío → proceder. Exit 1 en cualquier otro caso (receipt ausente, stale,
evidence vacío, o `terminal_state: escalated` — **siempre**, tenga o no `override_note`, el
script nunca lo trata como pasable) → frenar acá, reportar al usuario, no commitear (LAW 8). El
script imprime la razón exacta del rechazo.

**Qué NO se declara cerrado** (source: `research/sources/protocolo-muralla.md` point #45) —
ninguno de estos permite un 🔵 de cierre, aunque el receipt mecánico pase:
- Una ronda de fixes cuya última tanda no se volvió a revisar (4.4 corrió antes del último fix,
  no después).
- Un gate propio del target-project (no de VCP) escrito pero nunca falsificado a propósito
  (ver el ritual en Phase 4.1 arriba).
- Cualquier AC en `spec_coverage` con veredicto `UNTESTED`.
Decirlo en el reporte de cierre cuesta menos que el usuario descubriéndolo después.

**El mensaje de commit cuenta qué cambió y por qué, con los números medidos** (point #44) — no
"arreglé el bug", sino la evidencia del receipt: "antes: X, después: Y" cuando hay una métrica
real; si algo quedó abierto, va nombrado en el cuerpo del commit, no solo en `DEBT.md`.

**Ausente vs corrupto — 2 categorías, no cambia el script, solo aclara qué hacer con cada
mensaje:**
- **Ausente (reparable regenerando):** "receipt no encontrado" / archivo no existe todavía →
  volver al final de 4.5, generar el receipt real (no hubo error, solo faltó el paso).
- **Corrupto/stale (siempre requiere receipt NUEVO, nunca editar el viejo):** fingerprint no
  matchea el estado actual, `terminal_state` no es `approved`, `evidence` vacío, o
  `terminal_state: escalated` → el estado evaluado cambió o nunca fue aprobado. Nunca parchear el
  receipt existente a mano — regenerar desde cero (pasos 4.5 de nuevo) sobre el estado real
  actual.
```bash
git add -A && git commit -m "<type>(<scope>): <what+why>"
```
Commit = reversible, do it. **Push/merge = show the exact command, ask 🔵 confirm first** — never automatic, never `--force`, never skip hooks.
```
🔵 A) git push origin <branch>
B) git push + open PR
C) Hold — don't push yet
```

**4.7 Backups**:
- Obsidian: if `Obsidian/07_Backups_Log/` exists → note with path, sha256, size (see any project's log for format).
- Graphify/Obsidian: after the commit, run `graphify update .` and `graphify export obsidian --dir graphify-out/obsidian`.
  Bind that generated backup to the committed tree — it is stale if HEAD, the report, or the graph
  changes:
  ```bash
  node .vibe/vcp-runtime/scripts/verify-backup-state.mjs record \
    --report graphify-out/GRAPH_REPORT.md --graph graphify-out/graph.json \
    --manifest graphify-out/backup-state.json
  node .vibe/vcp-runtime/scripts/verify-backup-state.mjs check graphify-out/backup-state.json
  ```
- `.vibe/SESSION.md` archived to `.vibe/sessions/YYYY-MM-DD-<topic>.md`, reset for next session.
- Optional distributable artifact (dist.zip+checksums): `skills/deploy-zip.md`, only if project ships one.

**4.8 Reflect** — 5 líneas, siempre corre, NO es gate (no bloquea nada, sin menú approve/modify).
Append a `.vibe/RETRO.md` (crear desde `templates/vibe/RETRO.md` si no existe). Inmediatamente
después, correr el LESSONS PROTOCOL completo (`skills/vibe-memory.md` § LESSONS PROTOCOL): draft
candidates desde los `⚠ signal` de `SESSION.md`, dedup contra `LESSONS.md` existente, 🔵 confirm
gate, escribir solo lo confirmado. Esto sí requiere respuesta del usuario — a diferencia del
resto de 4.8, no es "corre siempre sin preguntar".

```
## [YYYY-MM-DD] <feature-name>
**Shipped:** <1 línea, qué salió>
**Plan vs actual:** est. <N sesiones de docs/plan.md> → actual <M — contar .vibe/sessions/
  archivadas; si 4.7 no archivó ninguna, "N/A (sessions no archivadas)", nunca "0">
**Friction:** <1-2 cosas que costaron más de lo esperado>
**Keep:** <1 patrón que vale repetir — si es nuevo, también a PATTERNS.md>
**Change:** <1 cosa a hacer distinto la próxima>
```

Se relee en Phase 0 Bootstrap junto con SESSION.md/DECISIONS.md (últimas 2 entradas).

---

## CONFIG MENU PROTOCOL

Once per phase, before content decisions:
```
🔵 [PHASE] CONFIG
A) [option] — [default marked]
B) [option]
Waiting for answer before continuing.
```

## CONTENT DECISION PROTOCOL (unchanged)

```
🔵 [DECISION TOPIC]
[Context: why this matters]
A) [Option] — [trade-off]
B) [Option] — [trade-off]
Esperando tu respuesta antes de continuar.
```

---

## MEMORY UPDATES

| File | When | What |
|---|---|---|
| `SESSION.md` | every phase + every gate | 1 line per gate — resume ledger |
| Engram `mem_save` (si el tool está presente) | mismos momentos que la fila de arriba | duplicado opcional, `topic_key: vcp/<project>/<feature-slug>/gate-state` (upsert — nunca acumula), `type: config` |
| `DECISIONS.md` | choosing between approaches | decision + reasoning |
| `PATTERNS.md` | discovering a project convention | pattern + example + when |
| `DEBT.md` | deferring cleanup, or 4.3 medium/low findings | what, where, severity, why deferred |
| `RETRO.md` | end of Phase 4 (4.8), always | 5-line entry: shipped/plan vs actual/friction/keep/change |
| `LESSONS.md` | end of Phase 4 (4.8), after RETRO, confirm-gated | Reflexion-schema entry: what/why/how-to-avoid/detection-signal, only after 🔵 confirm |
| `AUDIT.md` | every gate, same moment as `SESSION.md` | 1 line: role/action/evidence/phase-task-ref — accountability trail, append-only |
| `COMPANY.md` | only when user sets a session budget | update the single `**Session budget:**` line — org chart itself never changes mid-session |
