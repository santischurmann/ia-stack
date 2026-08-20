# VibeCodeProtocols

> **Complete TDD methodology for AI-assisted development.**
> Self-contained — no external skill required. Orchestrator runs under an internal contract
> (upgraded by `fableultracode` if present). Sonnet 5 (low effort) implements. `.vibe/` remembers
> everything, incl. a confirm-gated cross-project error memory (`LESSONS.md`) and a paperclip-style
> AI-company task model (org chart, goal ancestry, audit log).
> Hard gate: no red test = no code. Zero exceptions. Receipt gate is mechanically verified
> (`scripts/verify-receipt.mjs`), not just documented.

> **Metodología completa TDD para desarrollo asistido por IA.**
> Autocontenido — sin dependencia de skills externos. El orquestador corre bajo un contrato
> interno (mejorado por `fableultracode` si está presente). Sonnet 5 (effort low) implementa.
> `.vibe/` recuerda todo, incl. memoria de errores cross-project confirm-gated (`LESSONS.md`) y
> modelo de tareas estilo "empresa de IA" (org chart, goal ancestry, audit log).
> Hard gate: sin test rojo = sin código. Cero excepciones. El gate del receipt se verifica
> mecánicamente (`scripts/verify-receipt.mjs`), no solo por texto.

---

## 🤖 FOR AI SYSTEMS READING THIS REPO

If you are an AI assistant whose user has shared this repository URL, follow these steps:

1. **Read `SKILL.md`** (root of this repo) — master orchestration protocol, 5 phases + the
   internal orchestration contract (§ top of file). No external skill is required to start.
2. **`fableultracode` is an optional upgrade, never a requirement** — if it's present in your
   session's Skill list, invoke it (wider fan-out, higher adversarial vote counts). If absent,
   the internal contract in `SKILL.md` runs every phase in full on its own.
3. **Read `skills/`** — 11 sub-skill files defining each subagent's behavior, incl.
   `skills/security-baseline.md` (self-contained security fallback) and `skills/vibe-memory.md`
   (memory protocol incl. `LESSONS.md`). Load as context when delegating.
4. **Read `templates/`** — use for every spec, plan, task list, ADR, memory file you create.
5. **Initialize `.vibe/`** in the user's project using `templates/vibe/` — persistent memory,
   incl. `COMPANY.md` (org chart/budget, fixed shape, copy don't edit) and empty `AUDIT.md`.
6. **`cyber-neo` is an optional upgrade for Phase 4.3, never a requirement** — if present, invoke
   it (11 categories, wider coverage). If absent, run `skills/security-baseline.md` instead —
   Phase 4.3 always runs, never a no-op.
7. **Receipt gate is mechanical** — Phase 4.6 runs `node scripts/verify-receipt.mjs check <path>`
   before commit. It rejects stale/escalated-without-override/evidence-empty receipts by exit
   code, not by the model reading prose.

**Core protocol summary for AI:**
- Orchestrator (any model) under the internal contract (`SKILL.md` § top), `fableultracode` optional upgrade. Subagents = Sonnet 5, effort low by default (config menu, Phase 3).
- Role-persona subagents, each with a narrow mandate, none certifies its own gate: **Test-Engineer** (RED, failing tests) → **Builder** (GREEN, minimum impl) → **Triangulator** (TRIANGULATE, edge/negative/contract cases derived from real ACs, test-only) → **Refactor-Engineer** (REFACTOR, cleanup) → **Docs** → **Chore**.
- Hard gate: tests must FAIL before GREEN, mechanically classified (not "any nonzero exit") — a broken runner, syntax error, "no tests found", or arbitrary exit code all reject. Pass before impl exists → blocked, report, stop.
- Coverage minimum 90%. Stack auto-detect from `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml`.
- Every phase/gate end: 1 line to `.vibe/SESSION.md` (resume ledger) + matching line to `.vibe/AUDIT.md` (accountability trail).
- Workflow: `bootstrap → [auto-routing triage] → spec → plan → build → final(verify+simplify+security+adversarial+tests+receipt-gated commit/push/merge+backups+reflect+lessons-confirm)`. Auto-routing can skip Spec/Plan only when understanding/verifying the change needs ≤3 files — never by diff size alone, and never skips the hard gates.
- Two menu types, both wait for answer: **config** (model/effort/detail, once per phase) and **content** (approve/modify/cancel, per decision).

**Compatible with:** Claude Code (native), and any AI agent with file read/write + shell capability
for the rest of the protocol (Cursor, Windsurf, Cline, Aider, Continue, OpenCode, Gemini CLI,
GitHub Copilot Workspace) — nothing in `SKILL.md`'s phase logic is Claude-Code-specific;
`fableultracode`/`cyber-neo` are optional Claude-Code-only upgrades, skipped cleanly elsewhere.

---

## What it does / Qué hace

VibeCodeProtocols enforces a strict, reproducible development workflow:

| Role | Model | Responsibilities |
|------|-------|-----------------|
| Orchestrator | any model, internal contract (+ `fableultracode` optional upgrade) | Spec, Plan, Final (verify/simplify/security/adversarial/commit/backups) |
| Test-Engineer | Sonnet 5, effort low (config'able) | Write failing tests — forbidden to implement |
| Builder | Sonnet 5, effort low (config'able) | Minimum implementation to pass tests |
| Triangulator | Sonnet 5, effort low (config'able) | Derive edge/negative/contract/boundary test cases from real ACs — test files only, never production code; failing case hands off to Builder |
| Refactor-Engineer | Sonnet 5, effort low (config'able) | Cleanup — Boy Scout Rule, no new features |
| Docs | Sonnet 5 | README, CHANGELOG, ADRs, `.vibe/` updates |
| Chore | Sonnet 5 | Lint, typecheck, CI, build, distributable zip |
| Security-Officer | `skills/security-baseline.md` (self-contained), or Skill `cyber-neo` if present (upgrade) | Baseline: 6-category grep/pattern scan. cyber-neo: 11-category scan, OWASP 2025 + CWE Top 25, 5 parallel subagents |
| 4R Reviewer (1-5x) | Sonnet 5, read-only | Risk/Readability/Reliability/Resilience adversarial review — count scales with `risk_level` (bajo→1 compact, estandar→2, alto→4, critico→4+independent repro), never 0 |

**Persistent memory:** `.vibe/` folder in your project — plain Markdown/JSON, no database, no
cloud, no dependencies. Commit it. Includes `LESSONS.md` (confirm-gated cross-project error
memory) and `COMPANY.md` (org chart, budget policy — the AI-company task model; see
`skills/orchestrator-opus.md` § MINIMAL AI-COMPANY TASK MODEL for what's actually implemented
vs. roadmap).

---

## Install in 30 seconds / Instalar en 30 segundos

### macOS / Linux / WSL

```bash
git clone https://github.com/santischurmann/VibeCodeProtocols
cd VibeCodeProtocols
chmod +x scripts/install.sh
./scripts/install.sh
```

### Windows (PowerShell)

```powershell
git clone https://github.com/santischurmann/VibeCodeProtocols
cd VibeCodeProtocols
.\scripts\install.ps1
```

The installer copies `SKILL.md` → `~/.claude/skills/VibeCodeProtocols.md`, all sub-skills →
`~/.claude/skills/vcp-skills/`, and scripts (incl. `verify-receipt.mjs`, `verify-red.sh`/`.ps1`)
→ `~/.claude/vcp-scripts/`. Then restart Claude Code. **Nothing else to install** — no external
skill is required for any phase to run.

**Optional upgrades** (never required, install only if you want the wider version of a phase):
```bash
cd ~/.claude/skills && git clone https://github.com/Hainrixz/cyber-neo.git   # Phase 4.3 upgrade
```
`fableultracode` isn't a public repo — Phase 0/4 upgrade if you have a local copy; SKILL.md's
internal contract runs those phases fully without it.

---

## Usage / Uso

```
/VibeCodeProtocols
```

Tell Claude what you want to build. It will:
1. Activate the internal orchestration contract (upgrade to `/fableultracode` if present), load `.vibe/` memory (or create it, incl. `COMPANY.md`/`LESSONS.md`/`AUDIT.md`)
2. Detect your stack automatically
3. Offer auto-routing triage (trivial change → skip to Direct Build) or continue to full pipeline
4. Ask a **config** menu (model/effort/detail) + a **content** menu (approve/modify) before each phase
5. Run `spec → plan → build → final` — final phase closes with security scan, adversarial review, mechanically-gated commit, backups, reflect, and confirm-gated lesson capture

---

## Workflow / Flujo de trabajo

```
PHASE 0  BOOTSTRAP   Internal contract active (+fableultracode upgrade if present). Load .vibe/
                     memory (incl. LESSONS.md, COMPANY.md). Detect stack. Auto-routing triage.
                     Resume check.
PHASE 1  SPEC        Config menu (detail level). docs/spec.md, Gherkin ACs. User approves.
PHASE 2  PLAN        Config menu (granularity, parallel). docs/plan.md + tasks.json (role/
                     evidence/approval_criteria/rollback/handoff fields). User approves.
PHASE 3  BUILD       Config menu (model/effort, default sonnet low). Per task, role-persona
                     subagents: Test-Engineer (RED) → gate → Builder (GREEN) → Triangulator
                     (TRIANGULATE, edge cases from real ACs) → Refactor-Engineer (REFACTOR).
PHASE 4  FINAL       Orchestrated close-out (+fableultracode upgrade if present):
  4.1 Verify           Full suite. Coverage ≥90%. Lint 0. Typecheck 0.
  4.2 Simplify         Risk-classified (bajo/estandar/alto/critico). Dead code removal. Boy Scout Rule. Tests stay green.
  4.3 Security         security-baseline.md (built-in) or cyber-neo if present — never a no-op.
  4.4 Adversarial      4R (Risk/Readability/Reliability/Resilience). Reviewer count scales with
                       risk_level (1/2/4/4+repro) — never 0. Fixes crossing scope threshold pause for 🔵 replanning confirm.
  4.5 Tests (final)    Full suite re-run post-fix. Must be green. Receipt written w/ tree fingerprint (tracked+untracked).
  4.6 Commit/push/merge  `verify-receipt.mjs check` gates commit mechanically — only `approved` + fresh fingerprint passes. Push/merge = user confirms first, always.
  4.7 Backups          Obsidian note (if project has one) + graphify update (if graph exists).
  4.8 Reflect           RETRO.md entry, always. LESSONS.md confirm-gated proposal, on user answer.
```

---

## Hard Gate — TDD Caveman Protocol

```
Caveman say: test fail first. Then make pass. Then prove edges. Then make clean.
```

| Gate | Rule | On violation |
|------|------|-------------|
| RED gate | Tests must FAIL before GREEN runs — mechanically classified (broken runner/syntax error/no-tests-found/arbitrary exit all reject, not just "any nonzero exit") | Blocked — report and stop |
| TRIANGULATE gate | Edge/negative/contract/boundary cases derived from real ACs, all green, before REFACTOR | Failing case → Builder fixes, TRIANGULATE re-runs; decorative case with no justification → rejected |
| Coverage gate | ≥ 90% lines + branches | Phase 4 blocked until fixed |
| Security gate | security-baseline.md or cyber-neo: no open Critical/High | Fix + re-scan before continuing |
| Adversarial gate (4R) | No surviving finding across Risk/Readability/Reliability/Resilience, reviewer count scales with risk (never 0) | Fix + re-verify that lens |
| Replanning gate | Fix >200 lines / 3+ prod-config files / contract-API-dep-schema expansion → pause | Document scope+cause+risk+rollback, 🔵 confirm before continuing |
| Receipt gate | `verify-receipt.mjs check` exit 0 — **only** `terminal_state: approved` + fresh fingerprint (tracked+untracked) + non-empty evidence. `escalated` always blocks, `override_note` never bypasses this gate | Blocked mechanically — no commit |
| DoD gate | lint 0 + typecheck 0 + docs + .vibe/ updated | Phase not complete |

---

## Regression checks for the mechanical gates

No package installation is required for the verifier regression suite. With Node, PowerShell and
Git Bash available, run:

```powershell
node --test tests/*.test.mjs
```

(explicit file glob required — `node --test tests/` treats the directory as a module and dies
before running anything.) It verifies both shell implementations against a real Node test runner:
a valid unfinished-SUT RED and local missing-module RED pass; a test-code `ReferenceError`, bare
missing npm package, already-green test and runner/config failure reject.
`tests/verify-receipt-gate.test.mjs` also proves fresh/stale receipts, staged versus unstaged
state, `git add` without byte changes, binary/untracked/sibling receipt/mode changes, rename
destinations, empty/escalated receipts and SHA-256 Git repositories. `tests/ratchet.test.mjs` and
`tests/pretooluse-red.test.mjs` cover the optional gates below the same way. Tests prefixed
`FALSIFICACIÓN ·` prove a gate goes red when it must — `grep FALSIFICACIÓN tests/*.test.mjs`
answers "is this gate actually adversarially tested" in one command (convention adopted from
`research/sources/protocolo-muralla.md` point #50). Coverage: `node --experimental-test-coverage
--test tests/*.test.mjs` — currently 100% line/branch/function on every `.mjs` gate. See
`research/protocol-e2e-2026-08-14.md` for the complete disposable-project evidence.

---

## Optional hardening — PreToolUse enforcement and a debt ratchet

Both opt-in, same "never required, degrades cleanly" pattern as `fableultracode`/`cyber-neo`.
Adopted from `research/sources/protocolo-muralla.md` after adversarial analysis of that repo
(52 points examined, see the file for the full breakdown of what was and wasn't ported).

**PreToolUse gate** (`scripts/pretooluse-red.mjs`) — `verify-red.sh`/`.ps1` correctly classify a
genuine RED, but nothing forces the orchestrator to actually call them before writing production
code; a LAW in `SKILL.md` is a request the model can decline, even by accident. Wiring this
script as a `PreToolUse` hook makes it a harness-level block instead:
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node scripts/pretooluse-red.mjs" }] }
    ]
  }
}
```
in `.claude/settings.json`. Once wired, Phase 3.1 calls `node scripts/pretooluse-red.mjs emit
--tests <files>` right after a confirmed RED — see `SKILL.md` Phase 3.1.

**Debt ratchet** (`scripts/ratchet.mjs`) — freezes today's count of a declared pattern (stray
hex colors, `TODO`s, whatever a project wants to watch) and fails only if it grows. Copy
`templates/vibe/COUNTERS.json` to `.vibe/counters.json`, declare counters, then
`node scripts/ratchet.mjs --freeze` once. A gate that demands zero debt never turns on — freezing
today's number and forbidding it from rising is what actually holds.

---

## Persistent Memory / Memoria persistente

```
.vibe/
├── PROJECT.md      ← project identity, stack, goals
├── DECISIONS.md    ← architectural decisions + reasoning (append-only)
├── PATTERNS.md     ← how things are done in this project
├── SESSION.md      ← current session log + gate ledger (resume checkpoint)
├── DEBT.md         ← deferred technical debt (incl. security-baseline/cyber-neo Medium/Low findings)
├── RETRO.md        ← reflection log per shipped feature, Phase 4.8 (append-only)
├── LESSONS.md      ← cross-project error memory, Reflexion-schema, confirm-gated, retire-not-delete
├── COMPANY.md      ← org chart, budget policy — AI-company task model (fixed shape, copy don't edit)
├── AUDIT.md        ← append-only accountability trail: role, action, evidence, phase/task ref
├── receipts/       ← Phase 4.5 receipts (risk/evidence/tree-fingerprint), verified by scripts/verify-receipt.mjs
└── sessions/       ← archived session snapshots
```

Memory survives session restarts, model changes, and team handoffs. It's just Markdown.

```bash
./scripts/vibe-memory.sh read                        # dump all memory
./scripts/vibe-memory.sh save decision "used JWT"    # log a decision
./scripts/vibe-memory.sh archive auth-feature        # archive session
./scripts/vibe-memory.sh init                        # init .vibe/ in project
```

---

## Stack support / Stacks soportados

Stack-agnostic — auto-detected from project manifest:

| Manifest | Stack | Test runner | Linter | Typecheck |
|----------|-------|-------------|--------|-----------|
| `package.json` + `tsconfig.json` | TypeScript / Node | vitest / jest | eslint | tsc |
| `pyproject.toml` / `setup.py` | Python | pytest | ruff | mypy |
| `go.mod` | Go | go test | golangci-lint | go vet |
| `Cargo.toml` | Rust | cargo test | clippy | cargo check |
| `pom.xml` | Java | mvn test | checkstyle | javac |

---

## File structure / Estructura de archivos

```
VibeCodeProtocols/
├── SKILL.md                        ← master skill (invoke with /VibeCodeProtocols)
├── skills/
│   ├── orchestrator-opus.md        ← delegation protocol + DoD checklist + role/permission table + AI-company task model
│   ├── subagent-red.md             ← RED tester instructions
│   ├── subagent-green.md           ← GREEN builder instructions
│   ├── subagent-triangulate.md     ← TRIANGULATE edge-case-prover instructions
│   ├── subagent-refactor.md        ← REFACTOR cleaner instructions
│   ├── subagent-docs.md            ← DOCS writer instructions
│   ├── subagent-chore.md           ← CHORE: lint/typecheck/build/zip
│   ├── vibe-memory.md              ← .vibe/ memory protocol incl. LESSONS PROTOCOL
│   ├── security-baseline.md        ← self-contained security fallback (no cyber-neo needed)
│   ├── caveman-tdd.md              ← hard gate rules + verify scripts
│   ├── spec-plan-templates.md      ← embedded templates + config menus
│   └── deploy-zip.md               ← optional artifact sub-step (Phase 4.7)
├── templates/
│   ├── spec.md                     ← feature spec template
│   ├── plan.md                     ← plan template
│   ├── tasks.json                  ← task list template (role/evidence/approval_criteria/rollback/handoff fields)
│   ├── adr.md                      ← Architecture Decision Record template
│   └── vibe/                       ← .vibe/ initialization templates, incl. COMPANY.md, LESSONS.md
├── scripts/
│   ├── install.sh                  ← macOS/Linux/WSL installer
│   ├── install.ps1                 ← Windows PowerShell installer
│   ├── verify-red.sh               ← RED gate verifier (bash)
│   ├── verify-red.ps1              ← RED gate verifier (PowerShell, same exit-code contract)
│   ├── verify-receipt.mjs          ← mechanical receipt validator (Node, cross-platform)
│   ├── pretooluse-red.mjs          ← optional PreToolUse hook — RED-before-write, harness-enforced
│   ├── ratchet.mjs                 ← optional debt ratchet gate
│   ├── build-zip.sh                ← distributable package builder
│   └── vibe-memory.sh             ← memory CLI helper
└── examples/example-feature/       ← JWT auth spec + plan as reference
```

---

## What this repo intentionally doesn't have

Said here so nobody discovers it the hard way (convention borrowed from
`research/sources/protocolo-muralla.md` point #51 — that repo does the same for itself):

- **No canonical, delta-merged system spec.** `docs/spec.md` is per-feature; there's no single
  `specs/{domain}/spec.md` that always describes "what the system does today" without reading the
  code. Evaluated (point #9), deferred — real structural change, bigger than a text edit.
- **No visual-design phase.** VCP is TDD for logic/backend, not UI/UX — SAFE/RISK design
  proposals, anti-convergence rules, etc. are out of scope by design, not an oversight.
- **The debt ratchet counts with regex, not an AST.** It counts what a pattern can detect; it
  doesn't understand code. For debt that requires understanding intent, it doesn't help — same
  limitation the source repo confesses about its own version.
- **`PreToolUse` enforcement is opt-in, not default.** A fresh `git clone` of this repo has zero
  hooks wired — the harness-level block only exists once a project's own
  `.claude/settings.json` wires it (see "Optional hardening" above). Without that wiring, VCP's
  RED-before-write discipline is still a LAW the orchestrator follows, not a mechanical block.

---

## Key principles / Principios clave

- **No test rojo → no implementación.** Hard gate. No override. No exceptions.
- **Un subagente = una tarea atómica.** Subagents never make architectural decisions.
- **Orchestrator no codea features.** Only spec / plan / final (verify/simplify/security/adversarial/deploy).
- **Memoria después de cada gate.** `.vibe/SESSION.md` updated at every gate — killed sessions resume from evidence, not memory.
- **Config + content menus.** Config (model/effort/detail) once per phase; content (approve/modify) per decision. Both wait for the user.
- **Security and adversarial review are gates, not suggestions.** Phase 4 doesn't close with an open Critical/High finding or a surviving adversarial refute.

---

## License / Licencia

MIT — free to use, fork, and distribute.
