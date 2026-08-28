# Company — org chart, budget, governance

Paperclip-style "AI company" layer, self-contained (plain Markdown/JSON, no external server,
no new dependency). This is orchestration bookkeeping, not roleplay — it exists to make
delegation, budget, and audit trail explicit instead of implicit in the orchestrator's head.
Full protocol: `skills/orchestrator-opus.md` § AI COMPANY LAYER.

---

## ORG CHART

```
Board (human, you)              — sets goals, approves push/merge (LAW 8), final call on escalated
  └─ CEO (orchestrator)         — decomposes goal → spec → plan → tasks. Writes zero feature code.
       ├─ Spec-Writer           — Phase 3, produces docs/spec.md
       ├─ Planner               — Phase 4, produces docs/plan.md + tasks.json
       ├─ Test-Engineer         — Phase 5.1 RED, writes failing tests only
       ├─ Builder               — Phase 5.2 GREEN, writes impl only
       ├─ Triangulator          — Phase 5.3 TRIANGULATE, derives edge/negative/contract/boundary
       │                          cases from real ACs, test files only, never production code
       ├─ Refactor-Engineer     — Phase 5.4 REFACTOR, structure only
       ├─ Docs                  — Phase 5.5, .vibe/ + doc updates
       ├─ Chore                 — Phase 6.1, lint/typecheck/coverage fixes
       ├─ Security-Officer      — Phase 6.2, native security-baseline.md (read-only)
       ├─ 4R Reviewer (1-5x)    — Phase 6.3, Risk/Readability/Reliability/Resilience adversarial
       │                          review (read-only), count scales with risk_level, never 0
       └─ Release-Engineer      — Phase 8.1-8.2, commit/push-ask/backups
```

Same permission boundaries as `orchestrator-opus.md` § ROLE / TOOL-PERMISSION TABLE — this doc
is the org-chart view of that table, not a duplicate source of truth for tool grants.

---

## BUDGET POLICY (token/turn governance, lightweight)

No hard infra — this is a manual-check convention the orchestrator applies at phase boundaries.

| Scope | Warning (80%) | Hard stop (100%) |
|---|---|---|
| Per task (Phase 5, one RED→GREEN→TRIANGULATE→REFACTOR cycle) | note in `SESSION.md`, continue | pause, ask user: split task or extend budget |
| Per phase (Spec/Plan/Build/Final) | note in `SESSION.md` | pause at phase boundary, 🔵 confirm before continuing |
| Retry loops (RED/GREEN respawned on failure) | — | 3 respawns on the same task without a passing gate = hard stop, escalate to user, never silent infinite retry |

Default budget = none set (unbounded, current behavior). If the user sets one (`+Nk` directive
or explicit ask), record it here once as `**Session budget:** <N>` and check against it at each
phase boundary — never mid-task, that's what causes half-finished implementations.

---

## GOAL ANCESTRY

Every task in `docs/tasks.json` carries a `goal` field: `<project mission> → <spec.md AC it
serves> → <plan.md item>`. This is what lets a respawned/parallel subagent understand *why* a
task exists without re-reading the full spec — inject the ancestry chain into its prompt, not
just the task description.

---

## AUDIT LOG

Append-only, one line per gate/decision, `.vibe/AUDIT.md`. Not a duplicate of `SESSION.md`
(that's the resume ledger) — this is the accountability trail: who (role) did what, when,
verified how. Format:

```
[YYYY-MM-DD HH:MM] <role> | <action> | <evidence or decision> | <phase/task ref>
```

Written at the same checkpoints as `SESSION.md` (§ MEMORY UPDATES in `skills/vibe-memory.md`),
same line, different file — cheap to append, no extra gate.

---

## ROADMAP (not implemented — do not describe as running)

Paperclip-level runtime — scheduled heartbeats, a persistent multi-tenant server, live
auto-pause budget enforcement across concurrently-running agents, a board-approval UI — is out
of scope for a single-session Claude Code skill. This file and `AUDIT.md` are the task-model and
bookkeeping layer such a runtime would consume, not the runtime itself. Full disclaimer:
`skills/orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL.

---

## ATOMIC TASK CHECKOUT

Parallel Build (Phase 5, config B=Y): before spawning a subagent on task `T0N`, set
`tasks.json[T0N].owner = "<role>-<timestamp>"` and `locked: true`. No second subagent spawns
against a task that's already `locked: true` — prevents two Builders double-working the same
file. Unlock (`locked: false`) on gate pass or explicit abort, never left dangling — if a
subagent dies mid-task, the RESUME protocol (Phase 1) clears stale locks by re-detecting via
evidence, not by trusting the lock flag.
