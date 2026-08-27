---
name: vcp-caveman-tdd
description: |
  ES: Reglas hard gate de TDD Caveman. Sin test rojo visible, no hay implementación. Sin excepciones.
  EN: Caveman TDD hard gate rules. No visible red test, no implementation. Zero exceptions.
allowed-tools: Read, Bash
---

# VCP Caveman TDD — Hard Gate Rules

**Caveman say: test fail first. Then make pass. Then make clean. In that order. Always.**

---

## THE FOUR LAWS

1. **RED before GREEN.** No implementation without a failing test. Ever.
2. **GREEN before TRIANGULATE.** No edge-case proving on unimplemented code.
3. **TRIANGULATE before REFACTOR.** No cleanup on code that only proves the happy path.
4. **REFACTOR before DOCS.** Document the clean version.

**Hard gate #5, same rank: coverage 100% de cada métrica medible before SIMPLIFY/DEPLOY** (commands in COVERAGE GATE below).

**Precedence:** these gates override any speed/convenience heuristic. Definitions elsewhere: `SKILL.md` (phases, Phase 4 Final, full DoD), `skills/subagent-{red,green,triangulate,refactor,docs}.md` (executors), `skills/deploy-zip.md` (optional artifact sub-step of 4.7). Gate wording conflicts → this file wins.

---

## HARD GATE VERIFICATION PROTOCOL

Before every GREEN subagent spawn, the orchestrator MUST run this check:

```bash
.vibe/vcp-runtime/scripts/verify-red.sh "<literal-test-file>" "node --test"     # bash
.vibe/vcp-runtime/scripts/verify-red.ps1 -TestPattern "<literal-test-file>" -TestCmd "node --test"   # PowerShell
```

Script on disk = single source of truth — do NOT re-embed copies (they drift). The gate is
mechanical, not "any nonzero exit passes": it executes only the literal Node-native command
`node --test <file>`. It rejects unsupported runners, tests-passed (exit 0), broken/missing
runner, syntax/parse/collection errors, "no tests found", and output without real RED evidence.
A real assertion failure, local missing-module error, or non-test local SUT stack frame from an
assertion-bearing test is a valid RED PASS. Another stack needs its own tested adapter; never
relax this one into a generic output regex.

**Checkpoint (long tasks):** after every gate result, append one line to `.vibe/SESSION.md`
(`T<id> RED gate PASS` / `GREEN ✅` / `TRIANGULATE N cases green` / `REFACTOR green` /
`coverage NN%`). Killed session must never skip a gate or blindly re-run a passed one.

---

## RESUME AFTER COMPACTION / RESTART

1. Establish the requested lowercase-kebab-case feature slug, then run `node .vibe/vcp-runtime/scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <feature-slug>`. Exit `0` is required before reading the ledger; exit `1` means show the Phase 0 🔵 conflict/legacy menu in `SKILL.md` and wait — never resume silently.
2. Re-read, in order: this file → `.vibe/SESSION.md` → `docs/tasks.json`.
3. Re-detect phase (never trust memory): run current task's tests. FAIL = pre-GREEN (RED done). PASS = post-GREEN.
4. `git diff` test files. Changed since RED = violation → stop, report.

---

## RED/GREEN/TRIANGULATE/REFACTOR CHECKLIST

### RED Phase ✓
- [ ] Test file created at correct path
- [ ] Tests import the module under test (file may not exist yet — that's fine)
- [ ] Exactly one test per explicit AC in `docs/spec.md` — named/commented with the AC id, statically countable (`grep -c`) and cross-checked against the spec's AC count
- [ ] Integration tests: one per flow, if the task's `test_types` calls for integration
- [ ] E2E tests: one per user scenario, if the task's `test_types` calls for e2e
- [ ] Tests run and FAIL (not error-out due to syntax — fail due to missing impl)
- [ ] Failure output captured and visible
- [ ] Failure SHAPE correctly identified and reported: (a) file-level module-missing failure (runner collapses all tests into 1 failing unit — report static AC-test count separately, never claim "N tests failed") vs (b) real per-test assertion failures (runner's fail-count is a true per-test claim) — see `skills/subagent-red.md` § Step 3

### GREEN Phase ✓
- [ ] Implementation file created at correct path
- [ ] Implementation uses exact function/class names tests import
- [ ] All targeted tests PASS
- [ ] No previously-passing tests now fail (no regressions)
- [ ] No extra code beyond what tests require

### TRIANGULATE Phase ✓
- [ ] Baseline (GREEN's tests) pass BEFORE deriving any new case
- [ ] RED's test file read first — every AC it already tests 1:1 is off-limits for re-derivation (no duplicate coverage disguised as edge-case analysis)
- [ ] Candidate cases written down with `derived from: <AC-id/risk_reason/contract/boundary>` BEFORE any test is written — no case without a stated reason
- [ ] AC RED skipped (if any) reported as a RED defect, never silently backfilled here
- [ ] Compact mode used only for genuinely trivial tasks, and stated explicitly (never silent skip)
- [ ] New cases added as tests only — zero production-file edits
- [ ] Failing case → handoff to Builder for minimal fix, loop back to re-run TRIANGULATE (not fixed by Triangulator itself)
- [ ] All derived cases green with evidence recorded before handoff to REFACTOR

### REFACTOR Phase ✓
- [ ] Baseline tests pass BEFORE any refactor edit
- [ ] Tests run after EACH edit — still green
- [ ] No new functionality added
- [ ] No test files modified
- [ ] Code is cleaner than before (naming, structure, duplication)
- [ ] Full suite passes at end

---

## COMMON VIOLATIONS AND HOW TO DETECT THEM

| Violation | Symptom | Detection |
|---|---|---|
| GREEN skips RED | Tests pass without implementation | RED gate script exits 0 |
| RED writes passing test | Gate fails at wrong place | Gate output shows 0 failures |
| GREEN over-engineers | Adds features not in tests | `verify-scope-diff.mjs check` vs task JSON writers and the real Git delta |
| TRIANGULATE skipped/decorative | REFACTOR runs on happy-path-only coverage, or cases exist with no `derived from` | Check task report for Step 1 case list — no list or no justification = violation |
| Triangulator edits production code | Edge case "fixed" without Builder handoff | `git diff` on non-test files during TRIANGULATE step |
| REFACTOR adds feature | New code not covered by tests | Coverage drops on new lines — run COVERAGE GATE cmd |
| Subagent modifies tests | Tests change between RED and GREEN | `git diff` on test files |

---

## ANTI-RATIONALIZATIONS

These are common excuses to skip RED gate. All rejected.

| Excuse | Rebuttal |
|---|---|
| "The test structure is obvious" | Write it. Run it. Confirm it fails. 2 minutes. |
| "We're in a hurry" | Skipping RED creates bugs. Bugs take longer. |
| "The feature is simple" | Simple features are where most TDD violations happen. |
| "I'll write tests after" | That's not TDD. That's documentation. |
| "The test will obviously fail" | Run it anyway. Gate must confirm. |

---

## COVERAGE GATE

Required: **100% of every metric the runner can measure** (lines + branches + functions when available). A tool that cannot expose a metric must name that limitation in the evidence; it never becomes an assumed pass.

```bash
# Node/TS — vitest (don't hide stderr — failures stay visible)
npx vitest run --coverage --coverage.reporter=json-summary
node -e "
  const d = JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json','utf8'));
  const metrics = ['lines', 'branches', 'functions'];
  const failures = metrics.filter((name) => d.total[name] && d.total[name].pct !== 100);
  console.log('Coverage:', Object.fromEntries(metrics.map((name) => [name, d.total[name]?.pct ?? 'not-measured'])));
  process.exit(failures.length === 0 ? 0 : 1);
"

# Python — pytest-cov
pytest --cov --cov-branch --cov-fail-under=100 2>&1 | tail -5

# Go
go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | grep total
```

If any measurable coverage metric < 100%: do NOT proceed to Phase 4 (Final: simplify/security/adversarial/deploy). Spawn RED/GREEN cycle for uncovered paths.

Coverage gate ≠ done. Full DoD (SKILL.md Phase 4): suite green + lint 0 + typecheck 0 + native security gate clean (`security-baseline.md`) + adversarial pass.
