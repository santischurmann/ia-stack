# Protocol E2E — 2026-08-14

## Scope and isolation

This is a real, disposable Node project under
`<home>\AppData\Local\Temp\vcp-e2e-ee08ad4fc9b44872ae5b94715138ae54`, not the VCP
repository. It was initialized with the current `templates/vibe/` and uses no package
dependencies or global installation. Its baseline commit exists only because the receipt gate
requires a Git `HEAD`; no VCP file was committed or pushed.

Feature: `normalizeEmail(value)`.

## Acceptance criteria and real results

| Phase | Evidence | Exit |
|---|---|---:|
| RED | Five explicit AC tests failed against `throw new Error("not implemented")`. `verify-red.ps1` initially rejected that valid case; after the SUT-stack proof fix it accepted it. | `0` gate / `1` runner |
| GREEN | Minimal implementation made AC-1…AC-5 green. | `0` (5 pass, 0 fail) |
| TRIANGULATE first run | Three new tests derived from AC-1/3/4. `TRI-3` exposed acceptance of `@example.com` and `ada@`. | `1` (7 pass, 1 fail) |
| Builder handoff + TRIANGULATE rerun | Builder added non-empty local/domain validation; all 8 tests then passed. | `0` (8 pass, 0 fail) |
| REFACTOR verification | No cleanup change was needed; the full suite including all TRI cases stayed green. | `0` (8 pass, 0 fail) |
| Receipt fresh | `verify-receipt.mjs check .vibe/receipts/email-normalizer-2026-08-14.json`. | `0` |
| Receipt stale proof | A one-line post-receipt source mutation was rejected. | `1` |
| Receipt restored | Mutation removed; the same receipt passed again. | `0` |

## New defect found and corrected

The previous RED classifier accepted assertion output or local missing-module output only. A
valid assertion test whose unfinished SUT throws `Error: not implemented` emits neither an
`AssertionError` nor a module failure, even though Node's runner reports a real test execution.
The original classifier therefore returned exit 1 incorrectly.

Both `scripts/verify-red.sh` and `scripts/verify-red.ps1` now accept that third proof path only
when all three independent facts hold: the framework printed a test summary, the named test file
contains an assertion marker, and the failure stack includes a local non-test SUT frame. The
existing fail-closed treatment of runner errors, bare third-party packages, test `ReferenceError`/
`NameError`/`is not a function`, syntax errors and no-tests remains in place.

The regression proofs now live in `tests/verify-red-gate.test.mjs` and
`tests/verify-receipt-gate.test.mjs`; both are dependency-free Node tests rather than a
one-session claim.

## Limits

- PowerShell execution was verified on this machine.
- Bash parity was then verified with the installed Git Bash
  (`C:\Program Files\Git\bin\bash.exe`): syntax check exit 0; valid local-module and SUT-runtime
  RED cases exit 0; ReferenceError, bare third-party package, green test and config-runner cases
  exit 1. The Windows WSL launcher is broken because its configured VHDX is missing, but that
  does not affect the Git Bash verification.
- This run exercised genuine gate sequencing and a builder handoff but not separately spawned
  role agents; it must not be presented as proof that external agent-runtime delegation works.
