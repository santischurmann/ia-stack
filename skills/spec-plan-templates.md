---
name: vcp-spec-plan-templates
description: |
  ES: Templates embebidos para spec.md, plan.md, tasks.json y ADRs. Config menus en SKILL.md Phase 1/2.
  EN: Embedded templates for spec.md, plan.md, tasks.json, ADRs. Config menus live in SKILL.md Phase 1/2.
allowed-tools: Read, Write, Edit
---

# VCP Templates

Use verbatim. Replace `<placeholders>`. Config menu (Phase 1 SPEC / Phase 2 PLAN, `SKILL.md`) picks detail level + granularity before you fill these — minimal spec skips Non-Goals+Risk Notes, exhaustive keeps everything.

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
- [ ] Coverage ≥90%, lint 0, typecheck 0
- [ ] Security clean (security-baseline.md or cyber-neo, Phase 4.3) + adversarial pass (Phase 4.4)
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
      "verifier": "scripts/verify-red.sh|.ps1 (mechanical, not a persona)",
      "approval_criteria": "<spec.md AC-id this task closes, verbatim>",
      "evidence": [],
      "rollback": "git revert <commit-sha, filled after this task's commit lands>",
      "handoff": "RED pass -> Builder (GREEN) -> Triangulator (TRIANGULATE) -> Refactor-Engineer (REFACTOR)",
      "blocked_reason": null
    }
  ]
}
```

`model_effort` — from Phase 3 CONFIG (`low` default; bump per-task if orchestrator/user flags it harder mid-build). Status lifecycle: `pending→red→green→triangulate→refactor→done` — this is the resume ledger's cross-check; a killed session recovers from here. Full field reference (role/verifier/approval_criteria/evidence/handoff/blocked_reason/rollback): `skills/orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL.

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
