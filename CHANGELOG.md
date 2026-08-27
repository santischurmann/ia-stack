# Changelog

All notable changes to VibeCodeProtocols are documented here.
Format: [Keep a Changelog](https://keepachangelog.com) — Semantic Versioning.

---

## [Unreleased]

- Reconciliación documental del hardening round 5: T01–T05 pasan de estado pendiente a
  implementado con referencias verificables a `98d2058`; el spec y la propuesta ya no describen
  un estado histórico falso. El backlog restante conserva estado explícito y no se promociona a
  completado sin un ciclo independiente de VCP.
- Nuevo gate `verify-scope-diff.mjs`: después de GREEN compara exactamente los writers declarados
  de una tarea con el delta real de Git, incluidos archivos untracked. Las excepciones operativas
  deben listarse con `--ignore` de forma explícita; no se agrega una exclusión global de `.vibe/`.

### Discovery workflow (2026-08-27, evidence before specification)
- **Discovery now precedes Spec for non-trivial work.** The protocol requires traceable research,
  a CAIO diagnosis, current→target loop map, PRD, implementation/adoption/recurrence plan before
  a product spec is approved. The new section distinguishes supported evidence from hypotheses and
  makes a human decision, rather than a prose report, the boundary into Phase 1.
- **Immutable decision history is native and executable.**
  `verify-discovery-core.mjs` validates append-only run chains, hashes, transition/state payloads,
  packet snapshots, claim/trigger coverage and filesystem boundaries. It does not treat mutable
  research ledgers as historical evidence.
- **Derived Discovery views are reproducible.** `verify-discovery-views.mjs` renders only
  deterministic Markdown views from the immutable JSON history and rejects stale, malformed,
  unexpected or unsafe view artifacts. VCP ships the runtime and tests with both installers.
- **Phase closure is no longer slow or recursive.** Binding evidence now runs each shared Node TAP
  file once while still checking every exact requirement title. I0 self-validation uses a dedicated
  non-recursive selftest, and prerequisite phase closure is memoized per static validation run.

### Hardening pass 11 (2026-08-24, native security boundaries)
- **Phase 4.3 is now fully native to VCP.** The live protocol no longer requires or invokes
  external skills. Its security gate blocks known provider-token/private-key shapes, sensitive
  artifacts, dynamic execution, SQL/template/HTML injection patterns, unsafe GitHub Actions
  configuration, unsafe scanner inputs and unscannable release files.
- **Executable inputs now fail closed at the filesystem boundary.** Receipts, Graphify backup
  manifests and ratchet counters reject external paths, symbolic links/junctions and non-regular
  files rather than reading or writing outside a checkout. RED test execution strips inherited
  secrets and Node control variables unless an operator explicitly allowlists a name.
- **Distribution is allowlisted.** The ZIP builder packages only VCP runtime/docs/templates,
  validates version input, emits a per-archive checksum and excludes local `.env`, `.vibe`,
  Graphify/Obsidian and research state by construction. Its checksum detects accidental
  corruption; it is not publisher authentication.
- **Security claims are bounded and tested.** `SECURITY.md` explains the external-artifact
  trust rule and the remaining limits: no native SAST/SCA/CVE database, no sandbox, and no
  cryptographic receipt provenance. The suite includes falsifications for these native gates and
  retains 100% lines/branches/functions over every Node script.

### Hardening pass 10 (2026-08-22, full measurable coverage gate)
- **VCP now requires 100% for every coverage metric a stack can actually report.** Lines,
  branches, and functions must each be full where the runner exposes them; a missing metric is a
  documented runner limitation, never an assumed pass. The same standard is now carried through
  Phase 4, the task templates, the Chore role, examples, and the TDD protocol.
- **The VCP repository enforces its own standard mechanically.**
  `verify-vcp-coverage.mjs` runs Node's native coverage suite and rejects any `scripts/*.mjs`
  row below 100% in lines, branches, or functions. Its executable falsifications cover malformed
  reports, command failures, missing metrics, and each individual metric below threshold.

### Hardening pass 9 (2026-08-21, mechanical plan write-conflict preflight)
- **Parallel work now proves its write sets are safe before build.**
  `verify-plan-conflicts.mjs` reads `files_to_create`, `files_to_modify`, and `test_files` from
  `docs/tasks.json`; two distinct tasks claiming the same normalized project path fail closed
  unless direct or transitive `depends_on` ordering serializes them. Duplicate ids, unknown or
  cyclic dependencies, malformed writer declarations, and out-of-project paths also block Plan.
- **The parallel contract distinguishes authority from file safety.** Atomic task checkout still
  prevents two owners from claiming one task, while the new preflight prevents two independent
  tasks from racing on the same file. Executable falsification covers production and test-file
  conflicts, direct/transitive serialization, separator normalization, duplicate/unknown/cyclic
  dependencies, malformed fields, and CLI misuse.

### Hardening pass 8 (2026-08-21, explicit handoff review boundaries)
- **Every advancing handoff declares its review limit.** `verify-handoff-report.mjs` requires
  exactly one non-placeholder `NOT_REVIEWED` declaration, including a concrete basis when no
  area was omitted. The exact report is retained in `.vibe/handoffs/` and only a passing gate can
  add its `{gate, declaration, report_path}` record to `tasks.json.not_reviewed`.
- **The contract is carried by every role template.** RED, GREEN, TRIANGULATE, REFACTOR, DOCS,
  CHORE, phase-level handoffs, bootstrap memory, and the task schema now expose the same
  boundary, so a narrow review cannot be mistaken for an exhaustive one.

### Hardening pass 7 (2026-08-21, feature identity for session resume)
- **Resume state is feature-bound mechanically.** `scripts/verify-resume-state.mjs` accepts a
  resume only when `SESSION.md` declares the exact requested lowercase-kebab-case feature slug.
  Mismatched, legacy, and malformed state fails closed; Phase 0 presents user-owned archive,
  continue, retag, or inspect choices rather than silently reusing another feature's gate state.
- **Fresh and archived session templates carry the identity field.** The template, bootstrap
  instructions, and `vibe-memory.sh archive` preserve the old snapshot and reset the next session
  to an explicitly unassigned feature identity.
- **Executable regressions cover the actual failure.** The suite proves `auth-refactor` cannot
  resume as `billing-fix`, rejects missing/malformed identity and invalid requested slugs, and
  exercises the Git-Bash archive path.

### Hardening pass 6 (2026-08-17, research-derived low-risk gates)
Sourced from a 13-source real multi-agent research pass (`research/source-matrix.md`,
`research/vcp-improvement-proposal.md`), 5 candidates adopted after adversarial refutation —
full spec in `research/vcp-implementation-spec.md`.
- **IRON LAW — no completion claims without fresh evidence.** `SKILL.md` now lists 4 forbidden
  rationalizations ("should work now", "I'm confident", "already tested earlier", "trivial
  change") verbatim next to the existing "trust what's derived, not narrated" principle. Source:
  gstack `ship/SKILL.md` Step 16.
- **LESSONS dedup now specifies normalization.** `skills/vibe-memory.md` § LESSONS PROTOCOL
  requires lowercase + collapsed-whitespace comparison before matching a candidate lesson
  against `LESSONS.md`, closing a gap where trivially-reformatted duplicates could slip through.
  Source: engram `hashNormalized`.
- **LESSONS confirm-gate now flags possible sensitive content.** A pre-check greps candidate
  lesson text for `token|authorization|cookie|secret|hash|password|bearer` and marks matches
  with a visible ⚠ warning before the 🔵 confirm-gate is shown (warns, doesn't block — VCP
  already has human confirmation). Source: engram's fail-closed audit-metadata rejector, adapted.
- **Receipt rejection messages documented as 2 categories.** `SKILL.md` §4.6 clarifies that
  `verify-receipt.mjs`'s 3 existing error messages split into "ausente" (reparable by
  regenerating) and "corrupto/stale" (always requires a brand-new receipt, never patch
  in-place) — documentation only, `scripts/verify-receipt.mjs` untouched. Source: gentle-ai
  `review_facade.go:58-87`.
- **DEBT.md entries carry a short id.** Entry format in `skills/vibe-memory.md` and
  `templates/vibe/DEBT.md` adds `` `id:<hash6>` `` (hash of category+location+rule) for quick
  reference — not a uniqueness key, collisions still resolved by date+location. Source:
  paperclip `migration-safety-baseline.ts` schema (format only, no SQL engine adopted).

### Hardening pass 5 (2026-08-14, reproducible gates + spec ambiguity)
- **Valid unfinished-SUT RED no longer rejects falsely.** Both RED verifiers now accept a runtime
  failure only when three independent facts prove it: a real test-runner summary, an assertion
  marker in the named test file, and a local non-test SUT stack frame. This admits a legitimate
  `throw new Error("not implemented")` before its assertion executes while preserving rejection
  of bare runner/config errors, bare npm packages and test-code
  `ReferenceError`/`NameError`/`is not a function` failures.
- **Gate proofs are now versioned tests, not scratchpad narration.** Added dependency-free Node
  regression suites for both PowerShell/Git-Bash RED classification and receipt fingerprints:
  staged/unstaged transitions, `git add` without byte change, binaries, modes, untracked and
  sibling receipts, renamed destinations, empty/escalated receipts and SHA-256 Git all have
  executable assertions. `README.md` documents the one command to run them.
- **Spec ambiguity cannot silently enter Build.** `templates/spec.md`,
  `skills/spec-plan-templates.md` and `SKILL.md` now require observable GIVEN/WHEN/THEN or
  `THE SYSTEM SHALL` criteria and treat `[NEEDS CLARIFICATION: …]` as a hard gate before Plan
  or Build.
- **Auto-routing now counts required context, not touched paths.** Direct Build is allowed only
  when understanding and verifying the change needs 1–3 files (including tests, direct callers,
  callees, config or contract), recorded in `SESSION.md`; a one-file diff with a broad dependency
  surface now correctly receives the full pipeline.
- **Research status corrected to evidence, not labels.** `research/source-matrix.md` records
  fixed SHAs and only marks a source exhaustive after every textual/config/test blob was read
  and binary treatment was documented. Large sources remain explicitly partial with atomic
  semantic-review chunks.

### Hardening pass 4 (2026-08-14, E2E-driven protocol fixes)
- **RED vs TRIANGULATE contradiction resolved.** `skills/subagent-red.md` said "one test per
  criterion minimum" (all ACs) while `skills/subagent-triangulate.md` existed to derive edge
  cases RED didn't cover — direct overlap. Fixed: RED now writes exactly one test per explicit
  AC (hard requirement, statically countable); TRIANGULATE reads RED's file first and never
  re-derives an AC RED already covers 1:1 (`subagent-red.md`, `subagent-triangulate.md`,
  `SKILL.md` §3.1/3.3, `skills/caveman-tdd.md` checklist). Also fixed a false-claim risk found
  live: when the SUT doesn't exist yet, Node's test runner collapses ALL tests in a file into
  ONE file-level failure (verified: 6 `test()` calls, missing import → `tests 1, fail 1`, not
  6) — RED's report template now requires stating the static AC-test count and the
  missing-module classification as two separate facts, never "N tests failed".
- **Lint/typecheck gate: 3 mechanical outcomes, no more silent skip.** `SKILL.md` §4.1: (1)
  declared+tool-runs → real gate, exit 0 required; (2) declared but tool missing/fails →
  **BLOCKS**, never N/A; (3) nothing declared, no typed-language marker → N/A, backed by the
  actual detection commands' output. Tested both fixtures for real: no-config repo → N/A with
  evidence; `.eslintrc.json`+`"lint"` script but eslint not installed → `npx eslint .` exit 1 → BLOCK.
- **Receipt lifecycle documented explicitly** (`SKILL.md` §4.5): exact order — `git add -A`
  BEFORE fingerprint, fingerprint computed against the receipt's own future path (self-exclusion
  only, never the whole directory), receipt written, `git add -A` AGAIN to stage the receipt
  itself for commit, then `verify-receipt.mjs check` at 4.6. Also fixed stale doc text that still
  described the superseded `git diff HEAD`-text fingerprint approach (script itself already used
  the correct `--raw -z` model from hardening pass 3 — only the prose was out of date).
- **`research/source-matrix.md`** (new) — versioned, per-source URL/commit/date/method/content/
  applied-ideas/target-file/limitation for all 13 original sources. No source claims "estudiado"
  without a persisted commit hash + real content capture in this file.
- **Video 6ChZMEMJ8hA transcript recovered** (`research/video-6ChZMEMJ8hA.md`, new) — prior
  BLOCKED status was premature: `yt-dlp` (already locally installed, no new install) fetched
  real `es-orig` auto-captions. Content: Gentleman Programming demo of an MCP wrapping
  DataImpulse residential proxies for agent web access. Linked repo
  `Gentleman-Programming/dataimpulse-mcp` found and read (README, commit `6f1d016378`). No VCP
  application (out of domain) — documented for completeness only.
- **Real-vs-simulated agent execution mode made explicit** (`skills/orchestrator-opus.md` §
  MINIMAL AI-COMPANY TASK MODEL) — the AI-company role table was never a claim that each role
  runs as an isolated process. Added: detect `Agent`/`Task` tool availability once per session;
  real dispatch vs. single-session role simulation are different claims and must be reported as
  such, never conflated. "Blocked" is reserved for environments where `Agent`/`Task` are
  genuinely unavailable — "available but not exercised this run" is the honest status otherwise.
- E2E validation (disposable Node project, scratchpad, no commit) re-run against the fixed RED/
  TRIANGULATE split: 6 ACs → 6 tests written in RED (static count verified), TRIANGULATE derived
  exactly 3 new cases (none duplicating AC1-6, verified by grep) — 9/9 green, 0 duplicates.

### Hardening pass 3 (2026-08-13, three blockers fixed on review)
- **RED gate: generic `Error:` no longer counts as evidence.** Hardening pass 2's evidence regex
  still matched bare `Error:`/`error`/`failed` — a stub printing `Error: config missing` and
  exiting 42 passed the gate. Fixed in both `verify-red.sh`/`.ps1`: now requires EITHER (a) a
  framework-executed signal (test count/pass-fail summary) co-occurring with an assertion
  marker, OR (b) a missing-module error attributable to the SUT — a bare generic error string is
  never sufficient alone. Tested for real: fake `Error: config missing`/exit-42 stub rejects,
  `node --this-flag-does-not-exist` (real runner/config error) rejects, real assertion failure
  and real missing-module both still pass — on both bash and PowerShell.
- **Receipt fingerprint: binary-safe, not `git diff` text.** `git diff` prints a fixed "Binary
  files a/x and b/x differ" message for ANY binary change — hashing that text meant two
  different binary modifications produced the identical fingerprint (a receipt from
  modification #1 would incorrectly still validate against modification #2). Rewrote
  `verify-receipt.mjs` to get the CHANGED-PATH LIST from `git diff --name-only HEAD` but hash
  each changed file's actual on-disk BYTES (binary-safe, content-addressed) rather than diff
  text — covers staged and unstaged since both are reflected in the working-tree file. Tested
  for real: committed a binary, modified its bytes, wrote a receipt, modified the bytes AGAIN
  (different content) — `check` correctly rejects; confirmed via `git diff HEAD -- asset.bin`
  that the old approach would have shown identical diff text for both modifications.
- **Receipt exclusion narrowed to the exact receipt path, not the whole `.vibe/receipts/`
  directory.** `currentFingerprint()` now takes an optional `excludePath` (the receipt's own
  path) and excludes only that exact path from tracked/untracked enumeration — any sibling file
  in the same directory (another receipt, a stray file) is a normal entry and DOES invalidate.
  Tested for real: fresh self-consistent receipt passes; adding a stray untracked file inside
  `.vibe/receipts/` rejects; adding a second, unrelated receipt file in the same directory also
  rejects the first one's check.
- `SKILL.md` § 4.5 receipt schema doc updated to describe the byte-safe fingerprint and the
  precise (not directory-wide) exclusion rule; `fingerprint` command usage updated to pass the
  target receipt path.
- All fixes re-tested against the full original case sets (6 receipt cases, 7 RED cases across
  both shells) — zero regressions.

### Hardening pass 2 (2026-08-13, mechanical gates + TRIANGULATE + 4R)
- **Receipt fingerprint now covers untracked files.** `verify-receipt.mjs`'s `tree_fingerprint`
  was `sha256('git diff HEAD')` — blind to untracked files. Rewrote to hash `HEAD` + tracked
  diff (staged+unstaged) + sorted `path\0content-sha256` for every untracked-not-ignored file
  (`.vibe/receipts/` itself excluded — a receipt can't self-invalidate at write time). Add/
  delete/rename/modify of any untracked file now invalidates the receipt. Found and fixed a
  real self-invalidation bug during testing (see readiness report).
  **Superseded by Hardening pass 3 above**: the tracked-diff half of this was still hashing
  `git diff` TEXT, which is not content-addressed for binaries (bug found on review); and the
  untracked exclusion was directory-wide instead of exact-path. Both fixed in pass 3.
- **`escalated` receipts always block, unconditionally.** Removed the `escalated`+`override_note`
  passable branch from `verify-receipt.mjs` entirely — the script now rejects every `escalated`
  receipt, no exceptions. The only path to `approved` is a brand-new receipt written after
  explicit 🔵 user sign-off. `SKILL.md` LAW 8, § 4.5/4.6 wording aligned — no remaining text
  treats `escalated + override_note` as gate-passable.
- **RED gate rejects garbage exit codes.** `verify-red.sh`/`.ps1` no longer treat "any nonzero
  exit" as PASS. Both now mechanically classify output and reject: tests-passed (exit 0),
  broken/missing runner, syntax/parse/collection errors, "no tests found", and nonzero exits
  with no recognizable test-failure evidence (e.g. `exit 42` from a stub). Only a real assertion
  failure or a missing-module/import error attributable to not-yet-implemented code passes.
- **TRIANGULATE inserted between GREEN and REFACTOR.** New role (Triangulator) and skill
  `skills/subagent-triangulate.md`: derives edge/negative/contract/boundary cases from real ACs
  (never decorative), test-files-only, hands failing cases back to Builder and loops. Lifecycle
  is now `pending→red→green→triangulate→refactor→done` everywhere: `SKILL.md`, `orchestrator-opus.md`,
  `caveman-tdd.md`, `spec-plan-templates.md`, `templates/tasks.json`, `templates/plan.md`, `README.md`.
- **4R adversarial rubric replaces generic lenses.** Phase 4.4 now reviews
  Risk/Readability/Reliability/Resilience, each finding carrying lens/evidence/reproduction/
  impact/severity/verdict. Intensity scales with a new 4th risk tier (`critico`, added to 4.2's
  mechanical classification): bajo=1 compact pass, estandar=2 independent passes, alto=4
  independent reviewers (1/lens), critico=4 reviewers + independent reproduction of survivors.
  **Never 0 reviewers** at any tier — the old "bajo skips the adversarial pass" behavior is gone.
- **Replanning escalation gate (4.4.1), not a hard line cap.** A finding-fix crossing >200 lines
  modified / 3+ production-config files / contract-API-dependency-schema expansion beyond task
  scope now pauses (not blocks the fix) for documented scope+cause+risk+rollback and explicit
  🔵 user confirm before continuing.
- **Fixed lingering hard-dependency language** in `orchestrator-opus.md` (`runs under
  /fableultracode contract` was unconditional) — now reads as internal-contract-primary,
  fableultracode-optional-upgrade, consistent with `SKILL.md`.
- Tested (all real, temp/disposable repos, no changes to this repo's git history): receipt gate
  6/6 required cases; RED gate 7/7 cases (green-reject, broken-runner-reject, no-tests-reject,
  syntax-error-reject, arbitrary-exit-reject, assertion-pass, missing-module-pass) on **both**
  bash and PowerShell; `node --check` on all modified `.mjs` files.

### Hardening pass 1 (2026-08-13, controlled-test readiness)
- **Self-contained, no blocking external skills.** `fableultracode` and `cyber-neo` are now optional upgrades, never requirements — `SKILL.md` § INTERNAL ORCHESTRATION CONTRACT (fallback for fableultracode) and `skills/security-baseline.md` (fallback for cyber-neo, 6-category grep/pattern SAST-lite, same severity model). Removed every unconditional "Invoke Skill X" line from `SKILL.md`, `caveman-tdd.md`, `spec-plan-templates.md`. README/INSTALL/SKILL.md now describe the same (optional-upgrade) behavior.
- **Mechanical receipt gate.** Receipt schema gains `git_head` + `tree_fingerprint`. New `scripts/verify-receipt.mjs` (Node, cross-platform) rejects stale/empty-evidence receipts by exit code — Phase 4.6 runs it before commit, not a prose-only gate anymore. (Superseded by Hardening pass 2 above — fingerprint now covers untracked files, escalated always blocks.)
- **Windows/PowerShell parity.** New `scripts/verify-red.ps1`, same exit-code contract as `verify-red.sh` — executed both branches (RED pass, RED fail) for real on PowerShell 5.1, correct results both times.
- **Minimal operable AI-company task model.** `templates/tasks.json` gains `role`, `verifier` (mechanical, never the role being checked), `approval_criteria` (spec AC-id), `evidence` (array, append-only), `handoff` (mechanical next step), `blocked_reason`, `rollback` (per-task `git revert`). Documented in `orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL, incl. explicit "who verifies whom" and a **Roadmap** disclaimer: Paperclip-level runtime (heartbeats, server, live multi-agent budget auto-pause) is NOT implemented — this is the task-model/bookkeeping layer only.
- **Install/memory alignment.** `scripts/vibe-memory.sh` `init`/`read` now include `RETRO.md`/`LESSONS.md`/`COMPANY.md`/`AUDIT.md`; `save lesson` explicitly refused (confirm-gate can't be scripted around) with `save audit` added instead. `install.sh`/`install.ps1` create `.vibe/receipts/`, seed empty `AUDIT.md`, and copy `verify-receipt.mjs`/`verify-red.ps1` alongside the `.sh` scripts. Ran `install.ps1` against a throwaway target dir — real execution, confirmed all files land correctly (see readiness report for the `$HOME` scoping caveat found during this test).
- **Source re-verification** (per non-negotiable traceability rule): re-fetched the-architect, Agent-Reach, agency-agents via `gh api`/`curl` (previous pass returned placeholder junk for 2 of these) — real README content now in the readiness-report source matrix. YouTube video `6ChZMEMJ8hA` attempted twice (WebFetch, two different prompts) — still returns only page chrome, no transcript. Declared **BLOCKED**, not substituted with Paperclip content.

### Added
- **`.vibe/LESSONS.md`** (nuevo, cross-project error memory): schema Reflexion (what/why-root-cause/how-to-avoid/detection-signal/confidence + provenance project/phase/run), confirm-gated (nunca escribe sin 🔵), dedup contra entradas existentes antes de proponer, retire-not-delete (`status: retired`, nunca se borra), decay flag a 90 días sin match (`[stale?]`, nunca auto-borrado). Protocolo completo: `skills/vibe-memory.md` § LESSONS PROTOCOL. `templates/vibe/LESSONS.md` nuevo. Fuente: aprende-skill (Reflexion schema + confirm-gate), engram (dedup/provenance), gstack (decay).
- **Phase 0 step 9 — Auto-routing triage**: cambios ≤3 archivos sin ambigüedad ofrecen 🔵 skip a Direct Build (RED→GREEN→TRIANGULATE→REFACTOR sin Spec/Plan formal, hard-gate de red test intacto); 4+ archivos o ambigüedad → full pipeline sin excepción. Nunca decide en silencio. Fuente: gentle-ai (routing thresholds), gstack (`/autoplan`).
- **Role-persona labels** en subagentes de Phase 3/4 (Test-Engineer/Builder/Refactor-Engineer/Security-Officer/Skeptic) + tabla de permisos por rol en `orchestrator-opus.md` § ROLE / TOOL-PERMISSION TABLE — ninguno certifica su propio gate. Fuente: gstack (org-chart-as-skills), claude-seo-ai (least-privilege table), paperclip (named roles).
- **Subagent Output Schema** estructurado (`STATUS/EVIDENCE/CONFIDENCE/NOTES`) en `orchestrator-opus.md` — `STATUS: pass` sin `EVIDENCE` real se trata como `blocked`, nunca se acepta autoreporte sin prueba. Fuente: cyber-neo, claude-seo-ai (structured finding schema), gentle-ai ("trust what's derived, not narrated").
- **AI Company layer** (paperclip-style, self-contained — sin server/dependencia nueva): `.vibe/COMPANY.md` (nuevo, org chart Board→CEO→roles + budget policy), `.vibe/AUDIT.md` (nuevo, trail append-only role/action/evidence/ref), goal ancestry (`tasks.json` campo `goal`: mission→spec-AC→plan-item, inyectado en cada prompt de subagente), atomic task checkout (`tasks.json` campos `owner`/`locked`, previene doble-trabajo en Build paralelo), budget policy liviana (3 respawns sin gate pasado = hard stop, nunca reintento silencioso). `templates/vibe/COMPANY.md` nuevo. `orchestrator-opus.md` § AI COMPANY LAYER. Fuente: paperclip (org chart, goal ancestry, atomic checkout, budget-as-governance, audit log).
- **Phase 0 step 4 — Engram recall** (opcional, best-effort): si el MCP `mem_*` está presente, recall de contexto antes del resume-check; nunca lo reemplaza. Mirror opcional de gate-state en `MEMORY UPDATES` (`topic_key: vcp/<project>/<feature-slug>/gate-state`).
- **Phase 1 — Forcing Questions**: 6 preguntas obligatorias pre-spec (necesidad/status-quo/slice mínimo/evidencia/non-goal/reversibilidad), escape hatch objetivo y contable, no por "impaciencia". DoD de spec.md ahora exige `6/6` o `skipped(N)`.
- **Phase 4.2 → Risk classification + Simplify**: `risk_level` (bajo/estandar/alto) mecánico por evidencia (`simplify_ignore_touch`, `sensitive_path`, `large_change` — nunca sola —, `debt_reopened`). Fail-safe: repo con `.mq5` y `Risk-sensitive paths` vacío en `PROJECT.md` cuenta como `sensitive_path`.
- **Phase 4.4 modulada por riesgo**: bajo salta el pase adversarial, estándar corre 1 skeptic, alto sin cambios (3-5 skeptics).
- **Phase 4.5 emite receipt** (`.vibe/receipts/<feature-slug>-<fecha>.json`, schema `vcp.receipt/v1`) con `risk_level`, `evidence`, `terminal_state`.
- **LAW 8**: sin receipt `terminal_state: approved` para el HEAD actual, no hay push/merge (4.6). `escalated` requiere `override_note` + timestamp explícito del usuario para pasar a `approved`.
- **Phase 4.8 — Reflect**: 5 líneas a `.vibe/RETRO.md` al final de cada feature, siempre corre, no es gate. Releído en Phase 0 Bootstrap.
- `templates/vibe/RETRO.md` (nuevo) y `.vibe/receipts/` (nueva carpeta en el bootstrap de `.vibe/`).
- `PROJECT.md` template: sección `Risk-sensitive paths` para el clasificador de 4.2.

### Changed
- `PHASE 0` paso 3 ahora también lee `RETRO.md` (últimas 2 entradas) si existe.
- `MEMORY UPDATES`: nuevas filas para el mirror opcional de Engram y para `RETRO.md`.

---

## [1.1.0] — 2026-07-07

### Changed
- **Orchestration model**: orchestrator now runs under the `fableultracode` skill contract (invoked Phase 0, session-long) instead of a bare Opus persona — autonomy, lead-with-outcome comms, evidence-gated actions, code discipline.
- **Phase count 7→5**: Bootstrap, Spec, Plan, Build, Final. Old TEST/SIMPLIFY/DEPLOY collapsed into one `Phase 4 — Final`, fableultracode-orchestrated.
- **Build model**: Sonnet 5, effort `low` by default (config menu, overridable per-task).
- **Config menus**: new phase-start config menu (model/effort/detail/granularity) added alongside the existing per-decision content menu.
- Rewrote `SKILL.md`, `skills/orchestrator-opus.md`, `skills/spec-plan-templates.md` for the new phase structure; net -227 lines (caveman-compressed, zero information loss).
- `skills/deploy-zip.md` scoped down to an optional Phase 4.7 artifact sub-step (build/zip/checksums/changelog/tag only — verify and commit moved to 4.1/4.6, no longer duplicated).

### Added
- **Phase 4.3 Security**: `cyber-neo` skill invocation — OWASP 2025 Top 10 + CWE Top 25, 11 categories, 5 parallel subagents. Critical/High blocks the phase; Medium/Low logs to `.vibe/DEBT.md`.
- **Phase 4.4 Adversarial review**: 3-5 independent skeptics per finding/file (correctness/security/reproduces lenses), refute-majority kills survivors — fableultracode pattern.
- **Phase 4.6 Commit/push/merge**: commit is automatic (reversible); push/merge always shown as an explicit command with user confirmation, never `--force`, never skip hooks.
- **Phase 4.7 Backups**: Obsidian `07_Backups_Log/` note (if the project has one) + `graphify update .` (if `graphify-out/` exists).
- `model_effort` field on `docs/tasks.json` tasks — carries the Phase 3 config choice per task.

---

## [1.0.0] — 2026-06-19

### Added
- Master skill `VibeCodeProtocols` — Opus orchestrator with full TDD workflow
- 5 Sonnet subagents: RED, GREEN, REFACTOR, DOCS, CHORE
- `.vibe/` memory system — plain Markdown, zero dependencies
- Hard gate: test failure verification before any implementation
- Coverage gate: 90% minimum (lines + branches)
- Stack auto-detection: TypeScript, Python, Go, Rust
- `install.sh` (bash) + `install.ps1` (PowerShell) installers
- `vibe-memory.sh` helper CLI
- `verify-red.sh` standalone RED gate verifier
- `build-zip.sh` distributable package builder
- Templates: spec.md, plan.md, tasks.json, adr.md, .vibe/* 
- Example feature: JWT authentication (spec + plan)
- Bilingüe: Spanish + English in all user-facing content
- Multiple-choice protocol: user confirms every significant decision
