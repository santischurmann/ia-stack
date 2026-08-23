---
name: vcp-orchestrator-opus
description: |
  ES: Referencia técnica del orquestador — protocolo de delegación, DoD, flujo de subagentes, contrato interno de orquestación (fableultracode como upgrade opcional).
  EN: Orchestrator technical reference — delegation protocol, DoD, subagent flow, internal orchestration contract (fableultracode as optional upgrade).
allowed-tools: Read, Write, Edit, Bash, Task, Agent, Glob, Grep, TodoWrite, Skill
---

# VCP Orchestrator Reference

Orchestrator = single responsible agent, runs under the internal orchestration contract (`SKILL.md` § INTERNAL ORCHESTRATION CONTRACT, Phase 0 → session-long): autonomy, lead-with-outcome comms, evidence-gated actions. `fableultracode` is a strict upgrade if present in the session's Skill list — never required. Subagents (Sonnet 5, effort per Phase 3 config) execute atomic tasks — no orchestrator-level contract wrapper on them, they just build.

---

## ROLE / TOOL-PERMISSION TABLE

Named mandate per role — none certifies its own gate, the gate script/test-runner does:

| Role | Phase | Tools | Certifies own gate? |
|---|---|---|---|
| Test-Engineer | 3.1 RED | Write (test files only) | No — `verify-red.sh`/`.ps1` does |
| Builder | 3.2 GREEN | Write/Edit (impl only, never the test) | No — test runner does |
| Triangulator | 3.3 TRIANGULATE | Write (test files only, never production) | No — test runner does; failing case hands off to Builder, not self-fixed |
| Refactor-Engineer | 3.4 REFACTOR | Edit (structure only) | No — test runner (must stay green, incl. TRIANGULATE's cases) |
| Docs | 3.5 (post-task) | Write (`.vibe/`, docs) | N/A, no gate |
| Chore | 4.1 fixes | Edit (lint/typecheck fixes) | No — linter/tsc does |
| Security-Officer | 4.3 | Read/Grep only (security-baseline.md/cyber-neo subagents are read-only) | No — finding severity is mechanical (CWE/OWASP mapped) |
| 4R Reviewer (adversarial) | 4.4 | Read only | No — reproduction-gated verdict, not self-report; count scales with `risk_level`, never 0 |
| Orchestrator | all | Read/Write/Edit/Bash/Task — but writes zero feature code | Issues final `terminal_state`, itself gated by receipt evidence (4.5) |

## MINIMAL AI-COMPANY TASK MODEL (operable, not just labels)

Every `tasks.json` task carries these fields — this is the actual operable model, not a role
name pasted on top of the old schema:

| Field | What it is | Who writes it |
|---|---|---|
| `role` | current owning persona (Test-Engineer/Builder/Triangulator/Refactor-Engineer) | orchestrator, on handoff |
| `owner` / `locked` | atomic checkout (§ AI COMPANY LAYER above) | orchestrator, before spawn / on gate resolve |
| `status` | `pending→red→green→triangulate→refactor→done` (or `blocked`) | orchestrator, on gate result |
| `verifier` | the mechanical check that certifies this task's current gate — **never** the role that wrote the artifact being checked | fixed per task type (script/test-runner), never a persona self-certifying |
| `approval_criteria` | the spec.md AC-id this task closes, verbatim | Planner, at Phase 2 plan generation |
| `evidence` | array of `{gate, command, output_tail, timestamp}`, one entry per gate passed | orchestrator, appended on each `STATUS: pass` with real `EVIDENCE` (§ below) |
| `not_reviewed` | array of `{gate, declaration, report_path}`, one explicit review boundary per accepted handoff | orchestrator, only after `verify-handoff-report.mjs check` exits 0 |
| `handoff` | mechanical next step on gate pass — which role spawns next, doing what | fixed per task type, read not improvised |
| `blocked_reason` | `null`, or why (failed gate 3x, budget hit, ambiguity) | orchestrator, on hard-stop (§ AI COMPANY LAYER budget policy) |
| `rollback` | `git revert <sha>` once this task's commit lands — how to undo *this task specifically* if it needs reverting later | orchestrator, filled after 4.6 commit, per-task not per-feature |

**Who verifies whom, concretely**: Test-Engineer's RED claim is checked by `verify-red.sh`/`.ps1`
(script, not a persona — mechanically classifies output, doesn't just trust a nonzero exit).
Builder's GREEN claim is checked by the test runner's exit code, not by Builder's own report.
Triangulator's derived cases are checked by the same test runner; a failing case is never fixed
by Triangulator itself — it hands off to Builder, and TRIANGULATE re-runs after the fix, so the
prover and the fixer are never the same role. Refactor-Engineer's claim is checked by re-running
the full suite, including TRIANGULATE's cases, not just the original happy-path test.
Security-Officer and 4R Reviewers are read-only — they can't self-approve because they hold no
Write/Edit grant (§ ROLE / TOOL-PERMISSION TABLE above) to fix what they find; a fix is a new
Builder task. This is what "no role certifies its own work" means mechanically, not just as a
sentence in a doc.

**Real subagents vs. simulated roles — say which one actually ran.** This skill's role table
(Test-Engineer/Builder/Triangulator/.../4R Reviewer) describes a permission/verification model,
not a claim that each role runs as an isolated process. Two distinct execution modes exist and
must never be reported interchangeably:

- **Real dispatch**: the orchestrator spawns each role via the `Agent`/`Task` tool as a separate
  invocation with its own context — the role genuinely can't see what the orchestrator was
  thinking, only what's in its prompt. Detect availability once per session: if `Agent`/`Task`
  appear in the current tool list (they're in this skill's own `allowed-tools`), real dispatch
  is available. This is the mode the "no role certifies its own gate" claim is strongest under.
- **Simulated roles, single session**: the orchestrator itself performs each role's actions
  inline, in character, without a separate `Agent` invocation — same permission discipline in
  spirit (an orchestrator "acting as Builder" still shouldn't self-certify a gate the test
  runner should certify instead), but it is **not** multi-agent execution, and reports/logs
  must say so plainly (`.vibe/AUDIT.md` role field can still say "Builder", but the session
  record should note "simulated, single session" at least once, not imply independent agents).

**Never claim "real agents"/"empresa de agentes real" for a run that used simulated roles.** If
the environment doesn't expose `Agent`/`Task` at all, that's a genuine capability gap — log it
as **roadmap blocked, environment-dependent** (not "not implemented", since the code/protocol
side is ready; only the runtime capability is missing). If `Agent`/`Task` ARE available but a
given run didn't use them (chose simulation for speed, e.g. a small validation pass), that's
**available but not exercised this run** — a different, more honest status than "blocked".

**Roadmap, explicitly not implemented**: Paperclip-level runtime (scheduled heartbeats, a
persistent multi-tenant server, live budget auto-pause across a fleet of concurrently-running
agents, board-approval UI) is out of scope for a single-session Claude Code skill — this repo
has no server, no scheduler, no multi-agent runtime outside what `Agent`/`Task` tool calls give
you inside one session. What's implemented above is the *task-model and bookkeeping* layer
(fields, permissions, audit trail, budget-as-a-manual-check) that such a runtime would consume —
not the runtime itself. Don't describe this skill as running heartbeats or a live org — it doesn't.

---

## SUBAGENT OUTPUT SCHEMA (structured, not prose)

Every subagent report ends with this block — orchestrator parses it to gate the phase
transition programmatically instead of reading free text:

```
STATUS: pass | fail | blocked
EVIDENCE: <exact command run + exact output tail, e.g. "pytest -q -> 3 failed, 0 passed">
NOT_REVIEWED: <specific omitted surface, or "none — <specific reviewed scope>">
CONFIDENCE: high | medium | low   # only for adversarial/security roles, omit otherwise
NOTES: <1-2 lines, only if STATUS != pass>
```

`STATUS: pass` without a matching `EVIDENCE` line (an actual command output, not "tests should
pass now") is treated as `STATUS: blocked` by the orchestrator — self-reported success without
proof doesn't gate anything (see "trust what's derived, not narrated" — SKILL.md § LAWS). A
handoff missing a valid `NOT_REVIEWED` declaration is also blocked: persist the exact report as
`.vibe/handoffs/<feature-slug>-<task-id>-<gate>.md`, run
`node .vibe/vcp-runtime/scripts/verify-handoff-report.mjs check <report>`, and append its
declaration plus path to `tasks.json[task].not_reviewed` only after exit `0`.

---

## AI COMPANY LAYER (paperclip-style, self-contained)

Org chart, budget policy, goal ancestry, atomic checkout, audit log — see `.vibe/COMPANY.md`
(copied from `templates/vibe/COMPANY.md` at Bootstrap, org chart is fixed shape) and
`.vibe/AUDIT.md` (append-only trail, format: `skills/vibe-memory.md` § AUDIT.md entry). This is
bookkeeping to make delegation/budget/accountability explicit, not a new dependency — plain
files, read/written by the same orchestrator with the same tools.

- **Goal ancestry**: every `tasks.json` task carries `goal` (mission → spec AC → plan item).
  Inject that string into every subagent prompt (§ DELEGATION PATTERN below) so a subagent
  understands *why*, not just *what*, without re-reading the full spec.
- **Budget**: check `.vibe/COMPANY.md` § BUDGET POLICY at each phase boundary. 3 respawns on
  one task without a passing gate = hard stop, escalate to user — never a silent 4th retry.
- **Atomic checkout**: before spawning against `T0N`, set `tasks.json[T0N].owner` +
  `locked: true`; unlock on gate pass or explicit abort. Never spawn a second subagent against
  a task already `locked: true` — this is what makes Phase 3 parallel dispatch (below) safe.
- **Audit log**: every `SESSION.md` gate line gets a matching `AUDIT.md` line, same checkpoint,
  same event — `<role> | <action> | <evidence> | <phase/task ref>`.

---

## DELEGATION PATTERN

For each task in `docs/tasks.json`, read the subagent skill file, spawn with full context:

```python
# Pseudocode — actual delegation via Agent tool
task = load_task("T01")
red_instructions = read_file("skills/subagent-red.md")

Agent(
  subagent_type="claude",
  model="sonnet",           # alias, always latest Sonnet
  effort=config.effort,     # from Phase 3 CONFIG menu — default "low"
  prompt=f"""
{red_instructions}
---
## TASK CONTEXT
Task: {task.id} — {task.description}
Goal ancestry: {task.goal}
Test files to write: {task.test_files}
Test types required: {task.test_types}
Implementation files (do NOT create yet): {task.files_to_create}
Spec: [read docs/spec.md]

## OUTPUT FORMAT (end your report with this block)
STATUS: pass | fail | blocked
EVIDENCE: <exact command + exact output tail>
NOT_REVIEWED: <specific omitted surface, or "none — <specific reviewed scope>">
NOTES: <only if STATUS != pass>
"""
)
```

Before spawning: `tasks.json[task.id].owner = "<role>-<timestamp>"`, `locked = true`
(atomic checkout, § AI COMPANY LAYER). On gate pass/abort: `locked = false`.

If a task looks harder mid-build and config allowed override (Phase 3 CONFIG, option B) → bump that task's effort, note why in `.vibe/SESSION.md`.

---

## SUBAGENT SEQUENCING PER TASK

```
Task T01:
  1. Spawn RED → wait → verify failure output
  2. Run verify-red.sh / verify-red.ps1 (hard gate, mechanical classification)
  3. Gate pass → spawn GREEN → wait → verify pass
  4. GREEN pass → spawn TRIANGULATE → wait → verify derived cases
     4a. Case fails → handoff to Builder for minimal fix → re-run TRIANGULATE (loop until all green)
  5. TRIANGULATE pass (all derived cases green) → spawn REFACTOR → wait → verify still pass (full suite)
  6. Persist the terminal report to .vibe/handoffs/<feature-slug>-T01-<gate>.md → verify-handoff-report exit 0 → append `{gate,declaration,report_path}` to `not_reviewed`
  7. Spawn DOCS → wait → confirm .vibe/ updated
  8. .vibe/SESSION.md += 1 line per gate (resume ledger, including NOT_REVIEWED summary/path); .vibe/AUDIT.md += matching line (role|action|evidence|ref)
  9. tasks.json: T01 status → done (pending→red→green→triangulate→refactor→done), owner cleared, locked → false
```

---

## PARALLEL vs SEQUENTIAL

**Sequential, always:** RED → GREEN → TRIANGULATE (incl. its Builder-fix loop) → REFACTOR within one task.

**Parallel, if Phase 2 CONFIG allowed it:** run `node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json` first. Only tasks with no unresolved write conflict may be dispatched at once. The verifier derives writers from `files_to_create`, `files_to_modify`, and `test_files`: an exact shared path with a direct/transitive `depends_on` route is reported `SERIALIZED` and stays topological; a shared path without such order exits 1 and blocks dispatch until the plan is split or serialized. Atomic checkout (§ AI COMPANY LAYER) protects one task from duplicate owners; it does **not** prove two different tasks write disjoint files.

**CHORE:** after all tasks done (lint, typecheck, coverage) — also reusable inside Phase 4.1/4.3 for fixes.

---

## FAILURE ESCALATION

| Failure | Action |
|---|---|
| RED gate fails (tests pass, broken runner, syntax error, no tests found, or arbitrary exit w/ no evidence) | Ask user: fix test file/command or impl first? (A/B) |
| GREEN fails (still red) | Read error. Orchestrator can fix → respawn GREEN w/ diagnosis. Can't → ask user. |
| TRIANGULATE finds a failing derived case | Not a failure of TRIANGULATE — expected. Handoff to Builder for minimal fix, re-run TRIANGULATE (full case set, regression check). |
| TRIANGULATE case has no `derived from` justification | Reject the case, do not write it — decorative coverage is forbidden. |
| Any measurable coverage metric < 100% (Phase 4.1) | Identify uncovered ACs, new tasks, RED/GREEN/TRIANGULATE cycle. |
| Lint/typecheck errors | Spawn CHORE-A/B. Can't fix → show user. |
| security-baseline.md/cyber-neo finds Critical/High (Phase 4.3) | Fix before continuing, re-scan. Never defer critical/high. Retroactively bumps `risk_level` to `critico` for 4.4. |
| 4R adversarial finding survives its tier's review (Phase 4.4) | Fix, re-verify, re-run that lens. If the fix crosses the 4.4.1 replanning threshold (>200 lines / 3+ prod-config files / contract-API-dep-schema expansion) → pause, document, 🔵 confirm before continuing (never silently expand scope). |
| Session killed / compacted mid-task | RESUME protocol below. Never re-run a passed gate blind, never skip a pending one. Clear stale `locked: true` by re-detecting via evidence, never by trusting the flag. |
| 3 respawns on same task, no passing gate | Hard stop (§ AI COMPANY LAYER budget policy) — escalate to user, never a silent 4th retry. |
| Session/phase budget hits 100% (if user set one) | Pause at phase boundary, 🔵 confirm before continuing (§ COMPANY.md budget policy). |
| Receipt gate rejects (`verify-receipt.mjs check` exit 1) | Never treat as passable via any field — regenerate a fresh receipt against current evaluated state, or (if `escalated`) get explicit 🔵 user approval first and write a NEW `approved` receipt. |

---

## RESUME AFTER RESTART / COMPACTION

1. Establish the requested lowercase-kebab-case feature slug and run `node .vibe/vcp-runtime/scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <feature-slug>`. Only exit `0` permits a resume. On exit `1`, present the Phase 0 🔵 conflict/legacy menu in `SKILL.md`, wait for the user, apply only that decision, then re-run the gate.
2. Re-read: `.vibe/SESSION.md` (gate ledger) → `docs/tasks.json` (status).
3. First task not `done` = current. Re-detect phase with evidence: run its tests (FAIL=pre-GREEN, PASS=post-GREEN). Never trust memory.
4. `git diff` its test files — changed since RED = violation, stop, report.
5. Continue sequencing from detected step. Gate rules: `skills/caveman-tdd.md`.
6. If restart lands inside Phase 4 (Final) — re-check which of 4.1-4.8 last completed via `SESSION.md`, resume from next.

---

## DEFINITION OF DONE (DoD) CHECKLIST

### Phase 3 BUILD — per task:
- [ ] RED report: failure shown, mechanically classified as valid (script, not eyeball)
- [ ] GREEN report: pass shown
- [ ] TRIANGULATE report: derived cases listed with `derived from`, all green, evidence recorded
- [ ] REFACTOR report: still green (full suite incl. TRIANGULATE cases)
- [ ] Every accepted handoff passed `verify-handoff-report.mjs`; its concrete review boundary is in `tasks.json.not_reviewed`
- [ ] No regressions full suite

### Phase 4 FINAL:
- [ ] 4.1 coverage 100% for every metric the runner measures (lines/branches/functions); any unavailable metric is named as a runner limitation, never silently skipped. Lint/typecheck resolved to one of 3 mechanical outcomes (real gate exit 0 / BLOCK if declared-but-missing / N/A with detection-command evidence) — never a silent skip
- [ ] 4.2 risk_level classified (bajo/estandar/alto/critico, evidence-based, not "looks big") + tests green after simplify
- [ ] 4.3 security-baseline.md/cyber-neo clean (no open Critical/High)
- [ ] 4.4 4R adversarial review at the risk-appropriate intensity (never 0 reviewers): no surviving finding; any fix crossing the 4.4.1 replanning threshold got 🔵 confirm before continuing
- [ ] 4.5 full suite green (post-fix) + receipt written with `git_head`+`tree_fingerprint` (`.vibe/receipts/`)
- [ ] 4.6 `verify-receipt.mjs check` exit 0 (terminal_state approved, fingerprint matches, evidence non-empty) BEFORE committing; push/merge only after user 🔵 confirm
- [ ] 4.7 Obsidian note (if applicable) + graphify updated (if applicable) + SESSION.md archived
- [ ] 4.8 RETRO.md entry written (always runs, not a gate); LESSONS.md confirm-gated proposal

---

## MULTIPLE CHOICE TEMPLATES

**Config (phase-start, once):**
```
🔵 [PHASE] CONFIG
A) [option, default marked]
B) [option]
Waiting for answer before continuing.
```

**Content decision:**
```
🔵 DECISION: <topic>
Context: <why this matters>
A) <option> — Pro/Con
B) <option> — Pro/Con
Esperando tu respuesta antes de continuar.
```

---

## TODO TRACKING

```
Phase 0 Bootstrap (internal contract, +fableultracode upgrade if present) → [x]
Phase 1 SPEC                        → [ ]
Phase 2 PLAN                        → [ ]
Phase 3 BUILD T01..TNN (RED→GREEN→TRIANGULATE→REFACTOR per task) → [ ]
Phase 4 FINAL
  4.1 Verify   → [ ]
  4.2 Risk classification (bajo/estandar/alto/critico) + Simplify → [ ]
  4.3 Security (security-baseline.md/cyber-neo) → [ ]
  4.4 Adversarial review (4R: Risk/Readability/Reliability/Resilience) → [ ]
  4.5 Tests (final) + receipt w/ fingerprint → [ ]
  4.6 Commit/push/merge (verify-receipt.mjs mechanical gate) → [ ]
  4.7 Backups              → [ ]
  4.8 Reflect + Lessons    → [ ]
```
