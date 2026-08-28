---
name: vcp-spec-plan-templates
description: |
  ES: Templates embebidos para spec.md, plan.md, tasks.json y ADRs. Config menus en SKILL.md Phase 3/2.
  EN: Embedded templates for spec.md, plan.md, tasks.json, ADRs. Config menus live in SKILL.md Phase 3/2.
allowed-tools: Read, Write, Edit
---

# VCP Templates

Use verbatim. Replace `<placeholders>`. Config menu (Phase 3 SPEC / Phase 4 PLAN, `SKILL.md`) picks detail level + granularity before you fill these — minimal spec skips Non-Goals+Risk Notes, exhaustive keeps everything.

---

## TEMPLATE: docs/spec.md

```markdown
# Spec: <feature-name>

**Date:** <YYYY-MM-DD> | **Status:** Draft | Approved

## Problem
<1-3 sentences.>

## Target Users
<Who, role, context, frequency.>

## Acceptance Criteria
Each criterion must be testable and use one of these forms:
- Event/flow: `GIVEN <state>, WHEN <action>, THEN <observable result>`
- Invariant: `THE SYSTEM SHALL <observable invariant>`
- [ ] **AC1:** GIVEN <state>, WHEN <action>, THEN <result>
- [ ] **AC2 (edge case):** ...
- [ ] **AC3 (error):** GIVEN <invalid input>, THEN <error type + message>

Draft-only ambiguity marker: `[NEEDS CLARIFICATION: <specific question>]`. A marker is a hard
spec gate: resolve it with the user or remove its affected scope before Status becomes Approved;
Plan and Build never proceed with one present.

## Constraints
- <library/API constraint, perf budget, security constraint>

## Non-Goals
<skip if CONFIG=minimal> — explicit exclusions.

## Stack & Dependencies
- Runtime: <detected> · Test runner: <vitest|pytest|go test|...> · New deps: <none|pkg@ver — why>

## Definition of Done
- [ ] Forcing Questions: 6/6 (o skipped, con conteo)
- [ ] All ACs pass (unit+integration+e2e)
- [ ] Coverage 100% for every metric the runner measures (lines/branches/functions), lint 0, typecheck 0
- [ ] Native security gate clean (`security-baseline.md`, Phase 6.2) + adversarial pass (Phase 6.3)
- [ ] README/CHANGELOG/.vibe updated
```

---

## TEMPLATE: docs/plan.md

```markdown
# Plan: <feature-name>

**Date:** <YYYY-MM-DD> | **Spec:** [docs/spec.md](./spec.md) | **Status:** Draft | Approved

## Task Breakdown
| ID | Description | Files | Subagents | Depends on |
|----|---|---|---|---|
| T01 | <atomic task> | <files> | RED,GREEN,TRIANGULATE,REFACTOR | — |
| T02 | <atomic task> | <files> | RED,GREEN,TRIANGULATE,REFACTOR | T01 |

## Execution Order (topological)
1. T01 — <description>
2. T02 — <description> (needs T01)

## Write-conflict preflight
Run `node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json` before approval.

| Result | Task pair | Shared path | Action |
|---|---|---|---|
| CLEAR | — | — | eligible for configured parallel dispatch |
| SERIALIZED | T01 → T02 | `src/example.ts` | keep topological order; do not dispatch together |

`CONFLICT` is a hard Plan block: two tasks share a declared writer path without a dependency
route. Split the writes or add the real dependency, then rerun the command. The verifier includes
`files_to_create`, `files_to_modify`, and `test_files`; declaring a path twice inside the same
task is not a conflict with itself.

After each task reaches GREEN, verify that the declaration matches the real checkout, including
untracked files:

```bash
node .vibe/vcp-runtime/scripts/verify-scope-diff.mjs check \
  --tasks docs/tasks.json --task <task-id> --base <git-ref>
```

Every operational exception must be an explicit `--ignore <project-relative-file>`. Never use a
directory-wide ignore to hide undeclared writers.

## Risk Notes
<skip if CONFIG=coarse> — shared-module touches, external API mocks, etc.

## Estimated sessions
<N> tasks × ~[est each] = ~[total] (rough)
```

---

## TEMPLATE: docs/tasks.json

```json
{
  "feature": "<feature-name>",
  "spec": "docs/spec.md",
  "created": "YYYY-MM-DD",
  "tasks": [
    {
      "id": "T01",
      "description": "One atomic action",
      "files_to_create": ["src/feature/module.ts"],
      "files_to_modify": [],
      "test_files": ["src/__tests__/module.test.ts"],
      "test_types": ["unit", "integration", "e2e"],
      "subagents": ["red", "green", "triangulate", "refactor"],
      "model_effort": "low",
      "depends_on": [],
      "status": "pending",
      "goal": "<project mission> → <spec.md AC this serves> → <plan.md item>",
      "owner": null,
      "locked": false,
      "role": "Test-Engineer",
      "verifier": ".vibe/vcp-runtime/scripts/verify-red.sh|.ps1 (Node-native mechanical adapter, not a persona)",
      "approval_criteria": "<spec.md AC-id this task closes, verbatim>",
      "evidence": [],
      "not_reviewed": [],
      "rollback": "git revert <commit-sha, filled after this task's commit lands>",
      "handoff": "RED pass -> Builder (GREEN) -> Triangulator (TRIANGULATE) -> Refactor-Engineer (REFACTOR)",
      "blocked_reason": null
    }
  ]
}
```

`model_effort` — from Phase 5 CONFIG (`low` default; bump per-task if orchestrator/user flags it harder mid-build). Status lifecycle: `pending→red→green→triangulate→refactor→done` — this is the resume ledger's cross-check; a killed session recovers from here. `files_to_create`, `files_to_modify`, and `test_files` are the complete declared write set for `verify-plan-conflicts.mjs` and `verify-scope-diff.mjs`; list every file the task may edit, because undeclared writers cannot be made safe by either gate. `not_reviewed` is an append-only array of `{gate, declaration, report_path}` from handoffs that passed `verify-handoff-report.mjs`; an empty array means no handoff has passed yet, not "nothing was omitted". Full field reference: `skills/orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL.

---

## TEMPLATE: docs/adr/<NNNN>-<title>.md

```markdown
# ADR <NNNN>: <title>

**Date:** <YYYY-MM-DD> | **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context
<What forced this decision?>

## Decision
<What was decided, active voice.>

## Options Considered
**A — <name>** Pros/Cons
**B — <name>** Pros/Cons

**Chosen:** A · **Reason:** <why>

## Consequences
<Easier/harder going forward?>
```
