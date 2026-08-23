# Plan: <feature-name>

**Date:** <YYYY-MM-DD>
**Spec:** [docs/spec.md](./spec.md)
**Status:** Draft

---

## Task Breakdown

| ID | Description | Files | Depends on |
|----|-------------|-------|------------|
| T01 | <atomic task — one function/module> | src/... | — |
| T02 | <atomic task> | src/... | T01 |

---

## Execution Order (topological)

1. **T01** — <description>
2. **T02** — <description> (requires T01)

---

## Write-conflict preflight

Before approval, run:

```bash
node .vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs check docs/tasks.json
```

`CONFLICT` blocks the plan. `SERIALIZED` means the declared dependency order must be preserved;
those tasks are never dispatched together. The complete writer set is `files_to_create`,
`files_to_modify`, and `test_files` in `docs/tasks.json`.

---

## Risk Notes

- <Risk: T02 touches shared module — run full suite after>
- <Risk: T03 needs external API — mock unit, real integration>

---

## Subagent assignments

Each task runs: RED → GREEN → TRIANGULATE → REFACTOR → (DOCS if needed)
CHORE runs once after all tasks: lint + typecheck + coverage + build
