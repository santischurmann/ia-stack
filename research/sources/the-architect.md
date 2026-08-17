# SHA reviewed

`774a02278f4fa99cc44d484911007d1ba29318ab` (main, 2026-07-28T17:18:07Z), independently re-pinned via
`gh api repos/Hainrixz/the-architect/commits/main`. Matches the prior pass's SHA, but this pass goes
past the README into the actual agent/command/knowledge source.

## File manifest & coverage

La pasada inicial anotó **62 blobs**, pero esa cifra no reproduce el árbol real del SHA. La continuación clonó el repositorio y ejecutó `git ls-tree -r --name-only 774a02278f4fa99cc44d484911007d1ba29318ab`: **75 blobs rastreados en total**.

Reviewed in full (16 files, the substantive core):
- `README.md`, `CLAUDE.md` (clone-mode entrypoint / state machine)
- `commands/architect.md`, `commands/architect-quick.md`, `commands/architect-next.md`,
  `commands/architect-audit.md`, `commands/architect-brownfield.md`, `commands/architect-refresh.md`
- `agents/blueprint-writer.md`, `agents/blueprint-validator.md`, `agents/stack-researcher.md`
- `skills/architect/SKILL.md` (plugin-mode twin of CLAUDE.md)
- `templates/blueprint-template.md`, `templates/claude-md-template.md`, `templates/epic-template.md`,
  `templates/tasks-schema.md`

No revisados semánticamente en la pasada inicial (59 archivos):
- `assets/social-preview.jpg` — binary image, no logic.
- `.github/*` (7 files: issue templates, PR template, release.yml, workflows/validate.yml) — repo
  meta/CI plumbing, not agent behavior.
- `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json` — plugin manifest metadata, not
  reviewed in detail (low information density, confirmed to exist via manifest only).
- `.gitignore`, `LICENSE`, `SECURITY.md`, `VERSIONING.md`, `CONTRIBUTING.md`, `CHANGELOG.md` —
  project-hygiene docs, not methodology content.
- `knowledge/capabilities/*` (17 files), `knowledge/runtime-tracks/*` (5 files),
  `knowledge/shapes/*` (14 files), `knowledge/skills-registry.md`, `knowledge/stack-compatibility.md`
  — a large reference knowledge base (stack picks, per-shape build-order skeletons). Sampled via
  references inside CLAUDE.md/blueprint-writer.md but not opened file-by-file; this is content
  breadth (tech-stack facts), not methodology/gate logic, and is the least relevant layer to VCP's
  TDD-orchestration concern. Flagged as the main coverage gap below.
- `questions/phase-1..4-*.md` (4 files) — the literal interview script content; referenced
  extensively by CLAUDE.md's state-machine table (which state reads which file) but not opened
  verbatim. This is the second real coverage gap — the interview *mechanics* are inferred from
  CLAUDE.md's description of them, not read firsthand.

Budget was spent on the two files that carry essentially all of the transferable methodology —
`agents/blueprint-writer.md` (procedure + 22-item self-check list) and `agents/blueprint-validator.md`
(37-item adversarial fail list) — rather than spreading thin across the knowledge base. Honest
accounting: **16/75 files opened**, 59 not semantically reviewed in that pass (the original category
counts were based on the incorrect 62-blob denominator; the gaps named below remain valid).

## Inventory

**Concept**: The Architect is a design-only meta-agent (no app code) that interviews a user through a
4-state machine (DISCOVERY → DEEP DIVE → ARCHITECTURE → GENERATE, or BROWNFIELD as alternate entry),
produces a self-contained "blueprint" (bundle: `blueprint.md` + `tasks.json` + `epics/` + `workspace/`
scaffold, or single markdown file), gated by an adversarial validator subagent before handoff.

Key mechanisms found, file:section:
- **State machine + gates** — `CLAUDE.md:827-944`. Hard gate: "Never generate a blueprint before the
  confirmation gate" (rule 1); "Max 3 questions per message" (rule 2); zero
  `[NEEDS CLARIFICATION]` markers may remain before GENERATE (rule 5).
- **`/architect` command** — `commands/architect.md:1004-1082`. Dispatches three subagents via `Task`:
  `stack-researcher` (Phase 3, version pin verification), `blueprint-writer` (Phase 4, composes the
  bundle), `blueprint-validator` (Phase 4, the gate). "If the validator returns FAIL, fix the bundle
  and re-run it. Never hand the user a failing bundle with an apology attached."
  Explicit rule: `.claude/commands/` is NEVER emitted into a generated project — "a slash command only
  fires when a human types it, and an autonomous builder types nothing."
- **`agents/blueprint-writer.md:1652-2051`** — 12-step procedure to compose the blueprint: read
  template (count numbered headings dynamically — "It is currently 20... if you counted something
  else, trust your count"), read shape file, read runtime track, read each capability file, check
  `stack-compatibility.md`, read `skills-registry.md`, produce target `CLAUDE.md` (hard cap 200 lines,
  commands-first), write blueprint + bundle artifacts, then run a **22-item mechanical self-check
  list** before emitting anything (verify parity, no invented filenames, install traceability, no
  retroactive gate breakage, config completeness, env-loading completeness, derived-number integrity,
  checkpoint substrate, committed-file integrity, loader reconciliation, verify exit polarity, medium
  feasibility, re-runnable bootstrap, no-contract-from-NOT-APPLICABLE, cross-artifact value agreement,
  entry-point-exercised, bundle-path exclusion, guards-exit-0, verify/checkpoint ordering, byte-exact
  artifact reconciliation, gate-failure attribution, governing-file ordering).
- **EARS-form acceptance criteria** — `agents/blueprint-writer.md:1997-2019`: "WHEN `<trigger>` THE
  SYSTEM SHALL `<observable response>`" required on every build step, with a real runnable verify
  command; explicit good/bad examples (e.g. "Billing works" flagged bad; a criterion resolved only by
  a human reviewer or store-review queue flagged bad too — "waits on a human; no script decides it").
- **Verify parity discipline** — `agents/blueprint-writer.md:2021-2051`: every path referenced by a
  Verify command must be traceable to a step's *Files touched*, or emitted in §19.6 as shared
  infra, or the verify command must be deleted. Backed by a real incident: "nine verify-gated test
  files created by no task."
- **`agents/blueprint-validator.md:3172-3391`** — read-only (`Read`, `Grep` only, no `Bash`/`Write`),
  adversarial audit against a **37-item fail list**, verdict PASS only if zero BLOCKER/MAJOR findings
  ("There is no 'PASS with reservations'"). Each fail-list item is backed by a named real-incident
  postmortem (e.g. #30: emitted build config pointed to `dist/cli/index.js` while the manifest
  declared `dist/cli.js` — ~30 Verify commands and the packaging step all referenced the wrong path,
  builder stalled at step 7/14; #34: a step's own `Verify` asserted git state that only that same
  step's later `Checkpoint` would produce, since every step template is ordered
  Do → Done when → Verify → Checkpoint).
- **`agents/stack-researcher.md`** — subagent whose job is to verify every package/version pin against
  the live registry (npm, PyPI, crates.io, pkg.go.dev, RubyGems, Packagist) rather than recall from
  memory; feeds "provenance" cells the writer/validator both check.
- **Clone-mode vs plugin-mode duality** — `CLAUDE.md:918-933`: when run from a git clone (no
  subagents available), the single agent must do all three subagents' work inline instead of
  dispatching — an explicit fallback path, not a silent capability gap.
- **`templates/tasks-schema.md`** — JSON schema for `tasks.json` (a bare array, no wrapper);
  acceptance-criteria text must be "identical character for character after stripping markdown
  emphasis" between `tasks.json` and the matching `epics/*.md` file (writer procedure step 10).

## VCP cross-reference

Applied already in VCP:
- **Mechanical, non-self-certifying gates.** The-architect's validator is read-only/Grep-only and
  cannot fix what it finds (`agents/blueprint-validator.md:3199`: "Never fix anything — report it").
  VCP's parallel is the receipt gate: `<home>\Desktop\Claude\VibeCodeProtocols\scripts\verify-receipt.mjs`
  is a standalone mechanical checker (fingerprint/check commands, schema `vcp.receipt/v1`,
  `terminal_state` must be `approved|escalated`, `escalated` is *always* rejected — line 230:
  "this gate never passes an escalated receipt, regardless of override_note") — same philosophy of
  "no role certifies its own gate," stated explicitly in
  `<home>\Desktop\Claude\VibeCodeProtocols\templates\tasks.json` line 20:
  `"verifier": "scripts/verify-red.sh|.ps1 (mechanical, not a persona — no role certifies its own gate)"`.
- **Subagent role dispatch via Task/Agent tool with real-vs-simulated detection.** The-architect
  dispatches `stack-researcher`/`blueprint-writer`/`blueprint-validator` via `Task`
  (`commands/architect.md:1057-1068`). VCP does the same pattern in
  `<home>\Desktop\Claude\VibeCodeProtocols\skills\orchestrator-opus.md:60-87`, including an
  explicit fallback note when `Agent`/`Task` aren't in the tool list ("that's a genuine capability
  gap — log it").
- **Task/receipt schema carries verifier + rollback + approval criteria fields**, comparable in spirit
  to the-architect's `tasks.json`/epic parity requirement — see
  `<home>\Desktop\Claude\VibeCodeProtocols\templates\tasks.json:9-27` (`role`, `verifier`,
  `approval_criteria`, `rollback`, `handoff`, `blocked_reason` fields).

Ideas found but NOT currently applied in VCP (grepped, not present):
- **EARS-form acceptance criteria** (`WHEN <trigger> THE SYSTEM SHALL <response>`) — grepped
  `SKILL.md`, `skills/*.md`, `templates/*.md` for `EARS` and `THE SYSTEM SHALL`: no hits. VCP's
  spec/plan templates (`templates/spec.md`, `templates/plan.md`) do not enforce a formal
  requirement-sentence grammar; acceptance criteria are freer-form. This is a concrete, cheap
  candidate to adopt for spec.md's AC section.
- **`[NEEDS CLARIFICATION: ...]` inline markers gating a phase transition** — grepped for
  "NEEDS CLARIFICATION"/"clarif" across SKILL.md/skills/templates: no hits. VCP has no equivalent
  explicit marker-and-sweep mechanism for un-resolved ambiguity before a build gate opens.
- **A dedicated "verify parity" cross-check** (every path any verify/test command touches must be
  traceable to a file some step actually creates, enforced as a standalone sweep before handoff) —
  VCP's `scripts/verify-red.sh`/`verify-receipt.mjs` check receipt/tree state and RED-test presence,
  but there's no equivalent blanket sweep diffing "everything referenced by a Verify" against
  "everything produced by a step" the way blueprint-validator's finding #20 does. Worth considering
  for `scripts/verify-red.sh` or a new lint step.
- **Numbered-section template with dynamic count-and-carry** (blueprint-writer re-counts the
  template's headings each run rather than trusting a remembered number) — no analog in VCP's
  `templates/spec.md`/`plan.md`, which are prose templates without a strict enumerated-section
  contract or drift-detection.
- **Cross-artifact value reconciliation table** (§19.6, forcing every shared literal — port, path,
  binary name — to have one named source and be checked against every other copy) — no equivalent in
  VCP; VCP's receipt/tasks.json model doesn't currently reconcile shared literals across generated
  artifacts because VCP doesn't generate a multi-file scaffold the way the-architect's bundle mode
  does — different problem shape (VCP builds one existing repo; the-architect emits a fresh
  project skeleton), so this may be a genuine scope mismatch rather than a gap.

## Status

**PARCIAL.** SHA is fixed and independently confirmed. Coverage is honest but incomplete: 16/75 files
opened, and the biggest named gap is the 4 `questions/phase-*.md` interview-script files (referenced,
not read verbatim) plus the ~36-file `knowledge/` reference base (shapes/capabilities/runtime-tracks +
skills-registry.md + stack-compatibility.md), which was deliberately deprioritized as tech-stack
reference content rather than methodology/gate logic. The core methodology — state machine, writer
procedure, 22-item writer self-check, 37-item validator fail list, subagent dispatch pattern — was
read in full and cross-referenced against real VCP file:line citations above.

## Continuación — manifiesto reproducible y bloques pendientes

Checkout local verificado exactamente en `774a02278f4fa99cc44d484911007d1ba29318ab`.
`Get-FileHash SHA256` leyó los 75 blobs y un lector UTF-8 leyó completos los 74 blobs textuales:
**16.009 líneas / 1.397.293 caracteres**. El único binario es
`assets/social-preview.jpg` (318.084 bytes); fue hasheado, pero no se infiere contenido metodológico
desde sus píxeles. La lista canónica `path + SHA-256 + bytes` produjo el digest
`6a8b58b76e0c59ea52c5b5c9e147ebad76a076d27878da58d2ce6555f0eac656`.

Esto fija el conjunto y su integridad; **no** convierte una lectura automática de bytes en una
síntesis semántica exhaustiva. Para cerrar el requisito literal, la continuación debe leer y
resumir completos estos bloques, sin muestreo:

- `knowledge/capabilities/*.md`: 18 archivos, 2.537 líneas.
- `knowledge/runtime-tracks/*.md`: 5 archivos, 1.221 líneas.
- `knowledge/shapes/*.md`: 14 archivos, 1.720 líneas.
- `knowledge/skills-registry.md` + `knowledge/stack-compatibility.md`: 2 archivos, 231 líneas.
- `questions/phase-*.md`: 4 archivos, 1.566 líneas.
- Gobernanza no sintetizada inicialmente: `.claude-plugin/` (2), `.github/` (7),
  `CONTRIBUTING.md`, `SECURITY.md`, `VERSIONING.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`
  y cualquier template/command sin lectura íntegra demostrable.

Estado al cierre de la pasada anterior: **PARCIAL**. No se agregaba una nueva propuesta para VCP:
faltaba derivación verificable hasta completar esos bloques. La sección siguiente cierra esa deuda.

## Cierre exhaustivo — lectura de todos los blobs del snapshot fijado

Esta continuación cerró exactamente el conjunto de trabajo, no el `main` móvil. Se clonó en
`<home>\\Desktop\\Claude\\scratchpad\\the-architect-774a0227`, se hizo
`git checkout --detach 774a02278f4fa99cc44d484911007d1ba29318ab` y `git -C <dir> rev-parse HEAD`
devolvió ese SHA. `git ls-tree -r --name-only HEAD | Measure-Object -Line` devolvió **75**.

Un lector UTF-8 estricto cargó completo cada uno de los **74** blobs no binarios con
`Get-Content -Raw -Encoding utf8`; el lector aborta si uno no decodifica. Se recorrieron
**1.397.293 caracteres**. Para una segunda evidencia reproducible, el manifiesto
`path + SHA-256 del contenido local + bytes`, ordenado por path y hasheado como UTF-8, dio
`191238fd1b9ae17232121cb17ac7315b6d4acb23a26e7e1ba1b8eff0f42b8db8`.

El blob restante no se ocultó como una exclusión: `assets/social-preview.jpg` es el blob Git
`47174885ab40d0df76e30041b2874bf6f9f2ff4b`, modo `100644`, **318.084 bytes**, SHA-256
`fa33e4d96d218f4e13c72d78c6eb2c9313447ddc1fb482870d988734e59641cf`, JPEG **1280×640** a
96 dpi. Es un social preview: no es una instrucción ni contiene código/configuración ejecutable.

### Cobertura por familia (todos los archivos nombrados fueron leídos completos)

| Familia | Archivos | Lectura/síntesis que aporta |
|---|---:|---|
| Raíz, plugin y gobernanza CI | 17 | `.gitignore`; `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, `VERSIONING.md`; ambos manifiestos `.claude-plugin`; PR/release/4 issue templates y `workflows/validate.yml`. La gobernanza confirma que blueprints del usuario no se versionan en este repo, versionado/pins y referencias son verificables en CI, y clone/plugin son superficies que no pueden divergir. |
| Superficie de ejecución | 14 | Los 6 `commands/`, 3 `agents/`, `skills/architect/SKILL.md` y las 4 plantillas. Confirma el flujo entrevista → investigación de pins → escritura → validator → smoke test → handoff, y los contratos de bundle, epics y DAG. |
| Entrevista | 4 | `questions/phase-1..4-*.md`: clasificación de 14 shapes, preguntas que cambian una decisión, barrido de ambigüedad, confirmación explícita y generación/validación/smoke test. |
| Knowledge base | 39 | 18 capabilities, 5 runtime tracks, 14 shapes, `skills-registry.md` y `stack-compatibility.md`. Cada capability añade decisión, datos, pasos con Done-when, pitfalls y referencias; cada track fija setup/comandos/gotchas; cada shape define la secuencia de construcción. |

No se usó “bytes leídos” como sustituto de lectura: el bloque pendiente de capabilities, tracks,
shapes, registry/compatibility, las cuatro fases de preguntas y la gobernanza se revisó completo
contra esa lista. Los resúmenes por familia evitan copiar 1,4 M caracteres, no omiten archivos.

### Corrección de trazabilidad de la pasada anterior

Las referencias antiguas de este mismo informe a líneas como `CLAUDE.md:827-944` o
`commands/architect.md:1004-1082` **no son reproducibles en este SHA** y no deben usarse como
evidencia lineal. Ejemplos comprobados con `rg -n` en el checkout fijado: el gate de confirmación
está en `CLAUDE.md:17`, la regla de reintentar el validator en `commands/architect.md:81`, el
formato EARS en `agents/blueprint-writer.md:345`, y el criterio PASS sin reservas en
`agents/blueprint-validator.md:39-42`. Los hallazgos de abajo usan las líneas reproducibles; el
contenido conceptual anterior se conserva como contexto, no como cita de línea válida.

### Hallazgos consolidados para VCP (fuente verificable)

1. **No avanzar con ambigüedad ni con una AC no ejecutable.** La fase de confirmación exige emitir y
resolver todos los marcadores antes de generar (`questions/phase-3-confirmation.md:18-25,53,172`),
y testing obliga EARS más un comando que lo pruebe (`knowledge/capabilities/testing.md:36`). VCP ya
incorporó el equivalente operativo: `templates/spec.md:29-33` y `SKILL.md:97-99` bloquean Plan/Build
si queda `[NEEDS CLARIFICATION]`. Esto es una adopción comprobada, no una propuesta pendiente.

2. **Un agente/plan debe preguntar sólo lo que cambia la decisión.** Máximo tres preguntas por
mensaje y clasificación antes de entrar al stack (`questions/phase-1-discovery.md:11-20`); Phase 2
aplica el test “what changes in the blueprint if they say the other thing?”
(`questions/phase-2-branches.md:22-25`). Es una buena fuente para evaluar que las Forcing Questions
de VCP no se conviertan en formulario; no exige otro skill ni una dependencia externa.

3. **La validación debe ser independiente, binaria y seguida de ejecución real.** El validator sólo
aprueba con cero BLOCKER/MAJOR (`agents/blueprint-validator.md:39-58`) y su writer asocia EARS con
verificación (`agents/blueprint-writer.md:345-350`). La generación exige scratch aislado, bootstrap
repetido, entry point, data layer y formatter/linter (`questions/phase-4-generate.md:334-372,569-587`).
VCP ya posee gates mecánicos RED/receipt; queda como criterio de auditoría que cualquier futura
prueba end-to-end de VCP declare qué capas no pudo ejecutar como “not smoke-tested”, no como verde.

4. **Empresa de agentes durable, no conversación efímera.** Para un loop de agentes, persistir antes
de cada efecto, usar idempotency keys, presupuestos terminales, aprobaciones durables y trazas
(`knowledge/capabilities/agent-loop.md:65-69` y sus secciones de datos/approval/observability).
Esto encaja con la intención Paperclip del encargo, pero VCP es deliberadamente un skill local, no
un scheduler/servidor: no se simuló que la capacidad de empresa ya exista.

5. **Verificación de documentos/protocolo también es código.** `workflows/validate.yml:136` controla
la paridad entre entrada clone/plugin; `:296` exige que cada referencia resuelva. La regla de
versiones se apoya en investigación actual, nunca memoria (`agents/stack-researcher.md:3,31,41`).
Es evidencia a favor de mantener verificadores locales de VCP y de no presentar un texto como
auto-ejecutable sólo porque lo declara.

6. **Para trabajo concurrente, una prueba de un solo cliente es insuficiente.** La capability de
sync exige dos clientes y red controlable (`knowledge/capabilities/sync-and-collab.md:180-182`).
Aplica sólo cuando VCP orqueste estado compartido o side effects concurrentes; no justifica añadir
complejidad a una prueba de un cambio puramente local.

## Estado final

**EXHAUSTIVA para el SHA `774a02278f4fa99cc44d484911007d1ba29318ab`.** Se cubrieron los 75 blobs,
todos los textos/configs/comandos/plantillas fueron leídos íntegros y el único binario fue tratado
con evidencia técnica. No se modificó VCP fuera de este informe y la fila 3 de la matriz; no hubo
commit, push ni instalación.
