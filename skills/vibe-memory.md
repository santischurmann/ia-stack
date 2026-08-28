---
name: vcp-memory
description: |
  ES: Protocolo de memoria persistente en .vibe/ — qué guardar, cuándo, en qué archivo.
  EN: Persistent memory protocol in .vibe/ — what to save, when, in which file.
allowed-tools: Read, Write, Edit, Bash
---

# VCP Memory Protocol — .vibe/

Zero dependencies. All memory is plain Markdown files versioned with the project.
Engram (external MCP memory, if the tool is present in session) is an optional mirror for
gate-state recall across compaction/restart — never a replacement for the files below.

## FOLDER STRUCTURE

```
.vibe/
├── PROJECT.md      # Project identity, stack, goals (stable)
├── DECISIONS.md    # Architectural decisions + reasoning (append-only)
├── PATTERNS.md     # How things are done in this project (living doc)
├── SESSION.md      # Current session log + declared feature identity (reset each session)
├── DEBT.md         # Technical debt backlog (managed)
├── RETRO.md        # Reflection log per shipped feature, Phase 8.3 (append-only)
├── LESSONS.md      # Cross-project error memory — Reflexion-schema, confirm-gated, retire not delete
├── COMPANY.md      # Org chart, budget policy, goal ancestry note — paperclip-style AI company layer
├── AUDIT.md        # Append-only accountability trail: role, action, evidence, phase/task ref
├── handoffs/
│   └── <feature-slug>-<task-id>-<gate>.md   # Exact report + review boundary, no cross-feature overwrite
├── receipts/
│   └── <feature-slug>-<fecha>.json   # Phase 6.4 risk/adversarial/coverage receipt
└── sessions/
    └── YYYY-MM-DD-<topic>.md   # Archived session snapshots
```

---

## BOOTSTRAP (Phase 1)

### If .vibe/ does not exist:

```bash
mkdir -p .vibe/sessions .vibe/receipts .vibe/handoffs
cat > .vibe/PROJECT.md << 'EOF'
# Project Memory
**Name:** (fill in)
**Stack:** (auto-detected: fill in)
**Goals:** (fill in)
**Started:** YYYY-MM-DD
**Owner:** (fill in)
EOF

touch .vibe/DECISIONS.md .vibe/PATTERNS.md .vibe/SESSION.md .vibe/DEBT.md .vibe/RETRO.md .vibe/LESSONS.md .vibe/AUDIT.md
cp templates/vibe/COMPANY.md .vibe/COMPANY.md   # org chart is fixed shape, not a scratch file — copy, don't touch

cat > .vibe/SESSION.md << 'EOF'
# Session — YYYY-MM-DD
**Feature slug:** (set before first gate; lowercase kebab-case, e.g. `billing-fix`)
**Goal:**
**Status:** in progress
EOF
```

### If .vibe/ exists:

```bash
# Read all memory files — always at session start
cat .vibe/PROJECT.md
cat .vibe/DECISIONS.md
cat .vibe/PATTERNS.md
cat .vibe/DEBT.md
cat .vibe/RETRO.md
cat .vibe/LESSONS.md
cat .vibe/COMPANY.md    # budget policy line + org chart, read once, not re-echoed every phase
cat .vibe/SESSION.md
```

Show user a 3-5 line summary of what the memory contains.

---

## WHEN TO WRITE WHAT

| Trigger | File | What to write |
|---|---|---|
| Choosing between two approaches | `DECISIONS.md` | Decision + reasoning + tradeoffs considered |
| Discovering how the project does X | `PATTERNS.md` | Pattern name + example + when to apply |
| Completing a phase | `SESSION.md` | Phase, what was done, output, issues |
| Starting a feature (before its first gate) | `SESSION.md` | Set the single `**Feature slug:** <lowercase-kebab-case>` declaration |
| Role/phase handoff that recommends advancing | `handoffs/<feature-slug>-<task-id>-<gate>.md` | Exact report with one `NOT_REVIEWED:` declaration; run `verify-handoff-report.mjs` before transition |
| Passing/failing a gate (RED/GREEN/coverage) | `SESSION.md` | One line: `T<id> <gate> <result>` — resume checkpoint |
| Passing/failing a gate — duplicado opcional | Engram `mem_save` si el tool está presente | mismo contenido que la fila de arriba; `topic_key: vcp/<project>/<feature-slug>/gate-state` |
| Finding debt but deferring | `DEBT.md` | What, where, severity, why deferred |
| native security gate Medium/Low finding (Phase 6.2) | `DEBT.md` | Finding + category + severity + why not fixed now |
| Session end | `sessions/` | Archive SESSION.md with date prefix |
| End of Phase 8 (8.3), always | `RETRO.md` | 5-line entry: shipped/plan vs actual/friction/keep/change |
| RED took 2+ attempts / adversarial finding fixed / user correction | `SESSION.md` (scratch) | `⚠ signal: <1-line>` — passive capture only, not a LESSONS.md write |
| End of Phase 8 (8.3), always | `LESSONS.md` | draft candidates from this session's `⚠ signal` lines → 🔵 confirm gate → write only confirmed (see LESSONS PROTOCOL) |
| Every gate/decision (same moments as `SESSION.md`) | `AUDIT.md` | one line: `[timestamp] <role> \| <action> \| <evidence/decision> \| <phase/task ref>` — accountability trail, append-only, never edited/deleted |
| Session budget set by user (`+Nk` or explicit ask) | `COMPANY.md` | update the one `**Session budget:**` line under § BUDGET POLICY — this is the only field in COMPANY.md that changes per session, org chart itself is fixed |

---

## WRITE FORMATS

### DECISIONS.md entry:
```markdown
## [YYYY-MM-DD] Decision: <title>
**Context:** why this decision was needed
**Options considered:**
- Option A: [pros/cons]
- Option B: [pros/cons]
**Decision:** Option A
**Reason:** [why]
**Consequences:** [what this implies going forward]
---
```

### PATTERNS.md entry:
```markdown
## Pattern: <name>
**When:** [when to apply this]
**How:** [the pattern, with example]
**Example:**
```code
<code example>
```
---
```

### SESSION.md entry (append per phase):
```markdown
## Phase [N] — [Phase name] — [HH:MM]
**Tasks completed:** [list]
**Output:** [what was created/changed]
**Issues:** [any blockers or surprises]
**Next:** [what comes next]
```

### DEBT.md entry:
```markdown
## [YYYY-MM-DD] Debt: <title> `id:<hash6>`
**Location:** file:line
**Severity:** low | medium | high
**Description:** [what needs to be done]
**Why deferred:** [reason]
---
```
`id` = short hash (6 hex) of `category+location+rule` (e.g. category "security-baseline",
location "auth.js:42", rule "no-hardcoded-secret" → hash those 3 joined). Purpose: quick
reference in conversation/commits ("fixed debt id:a3f9c1") without re-typing the full title. Not
the only uniqueness key — two findings CAN collide on `id` by hash coincidence, tell them apart
by date+location same as before, `id` is a convenience, not a database key.

### RETRO.md entry (Phase 8.3, always, not a gate):
```markdown
## [YYYY-MM-DD] <feature-name>
**Shipped:** <1 línea, qué salió>
**Plan vs actual:** est. <N sesiones de docs/plan.md> → actual <M sesiones — o "N/A (sessions no archivadas)">
**Friction:** <1-2 cosas que costaron más de lo esperado>
**Keep:** <1 patrón que vale repetir — si es nuevo, también a PATTERNS.md>
**Change:** <1 cosa a hacer distinto la próxima>
---
```

### LESSONS.md entry (Reflexion-schema, cross-project error memory):
```markdown
## [YYYY-MM-DD] LESSON-<n> <title> — status: active
**Project/phase/run:** <project-slug>/<phase>/<feature-slug or session date>   # provenance, always
**What happened:** [observed failure/correction, factual]
**Why (root cause):** [not the symptom — the actual cause]
**How to avoid:** [concrete rule, checkable]
**Detection signal:** [what would flag this recurring — grep pattern, test name, error string]
**Confidence:** high | medium | low
---
```

### AUDIT.md entry (append-only, one line per gate/decision):
```
[YYYY-MM-DD HH:MM] <role> | <action> | <evidence or decision> | <phase/task ref>
```
Example: `[2026-08-13 14:02] Builder | GREEN gate | pytest -q -> 12 passed | T03`. Written at
the exact same checkpoints as `SESSION.md` gate lines (§ WHEN TO WRITE WHAT) — same event, two
files: `SESSION.md` is the resume ledger (what to do next), `AUDIT.md` is the accountability
trail (who did what, never edited once written). Full org-chart/budget/checkout context:
`skills/orchestrator-opus.md` § AI COMPANY LAYER.

**"Append-only" dejó de ser una convención y pasó a ser verificable.** Escribí cada línea con el
sellador, nunca a mano — así el escritor y el verificador comparten la misma función de hash y no
pueden divergir:
```bash
node .vibe/vcp-runtime/scripts/verify-audit-chain.mjs append .vibe/AUDIT.md "[fecha] Rol | acción | evidencia | ref"
node .vibe/vcp-runtime/scripts/verify-audit-chain.mjs check .vibe/AUDIT.md
```
Cada línea sellada lleva el hash de la anterior, así editar una línea vieja rompe la cadena y el
gate nombra la línea exacta. `append` se niega a sellar sobre una traza ya rota: un sello nuevo
encima de historia manipulada sólo certificaría la manipulación.

Las líneas heredadas sin sello se aceptan (un proyecto que ya tenía traza no se rompe), pero un
sufijo `chain:` mal formado es manipulación, no una línea vieja. **Lo que el gate no detecta**:
borrar los sufijos enteros de toda la traza, recortar sus últimas líneas, o recalcular la cadena
completa sobre contenido falso. Los tres exigen un ancla fuera del archivo; están declarados, no
resueltos.

## LESSONS PROTOCOL — confirm-gated, deduped, never silently deleted

Source of the "learn from own errors across projects" goal. Runs at Phase 8.3 (Reflect) and on
demand (`/vibe-lessons` or user asks "qué aprendimos"). Applies equally when VCP is reused on a
different project — `LESSONS.md` in the *global* `.vibe/` equivalent (or a project-local copy
promoted manually) is what makes an error learned once stop repeating on the next project.

**1. Passive capture (during Build/Test, not a write yet).** When a RED→GREEN cycle needed 2+
attempts, a security/adversarial finding needed a real fix, or the user issued an explicit
correction — append one line to a scratch buffer in `SESSION.md` (`⚠ signal: <1-line>`). This is
capture only. It does **not** touch `LESSONS.md`.

**2. Draft candidates (Phase 8.3).** From this session's `⚠ signal` lines, draft 0-15 candidate
lessons using the schema above. Cap at 15 — force prioritization over dumping everything.

**3. Dedup before proposing.** Grep `LESSONS.md` for overlapping `Detection signal` or title
keywords. **Normalize first** (lowercase both the candidate and existing entries, collapse
repeated whitespace) before comparing — a duplicate with trivial formatting differences (extra
space, different case) must still match (source: engram's `hashNormalized`, verified portable —
no DB/index needed, VCP compares against a human-sized file). Match found → don't draft a new
entry, instead prepare a note `[overlaps with: LESSON-<n>]` for the confirm step (annotate,
never silently merge/drop).

**Sensitive-content pre-check.** Before showing a candidate in the confirm gate, grep its text
for `token|authorization|cookie|secret|hash|password|bearer` (source: engram's fail-closed
audit-metadata rejector, adapted — VCP has human confirmation already, so this warns instead of
auto-rejecting, since a keyword match alone can't prove something is genuinely sensitive). A
match doesn't block the candidate, it flags it: `⚠ possible sensitive content`.

**4. Confirm gate — hard rule, no exceptions.** Never write a candidate straight to
`LESSONS.md`. Present the numbered list (title + confidence, sensitive-content warning if any)
to the user:
```
🔵 LESSONS learned this session — confirm which to keep:
1) [title] (confidence: high) — <1-line>
2) [title] (confidence: medium) [overlaps with: LESSON-3] — <1-line>
3) [title] (confidence: high) [⚠ possible sensitive content] — <1-line>
A) all  B) none  C) pick by number  D) edit [n]
```
A false positive locked into memory is worse than repeating a correction three times — bias
toward under-writing. Nothing is appended without this answer.

**5. Write (only confirmed).** Append full entries to `LESSONS.md` with today's date, next
`LESSON-<n>`, provenance line filled in.

**6. Retire, never delete.** A lesson later found wrong/obsolete: change `status: active` →
`status: retired (<date>, reason: <why>)` in place. Never remove the entry — keeps the audit
trail and stops the same wrong lesson from being re-proposed as "new" later.

**7. Decay flag, not auto-delete.** At Bootstrap, when re-reading `LESSONS.md`: a lesson whose
provenance run is >90 days old and hasn't been the `Detection signal` match for any gate since →
mark inline `[stale? — unseen 90d]` next time the file is rewritten (during a confirm-gate pass,
never as a silent background edit). Surface stale-flagged lessons to the user during Reflect as
"still relevant?" — user call, not automatic removal.

**8. Recall.** Phase 1 Bootstrap reads `LESSONS.md` alongside the others (already wired above).
When Spec/Plan/Build touches a file:line or pattern matching an active lesson's `Detection
signal`, surface it inline before the relevant gate — this is the actual "don't repeat the
mistake" payoff, not just accumulation.

---

## ENGRAM GUARDRAIL (si el MCP de Engram está presente)

NUNCA pegar código `.mq5`, lógica de licencia, tokens o passwords dentro de un `content` de
`mem_save` — la DB de Engram (`~/.engram/engram.db`) es SQLite local sin cifrado confirmado, y
`engram sync` no filtra por scope (`personal` también se exporta). Describí el comportamiento o
la decisión en prosa; nunca el código fuente ni la lógica de licencia.

---

## RESUME (killed session / compacted context)

Si `mem_context`/`mem_search` de Engram están disponibles, llamalos primero como señal
adicional — nunca como reemplazo del re-detect por evidencia de abajo.

`SESSION.md` is the checkpoint ledger, but it is usable only for the feature it declares. If it
contains unfinished work or `docs/tasks.json` has a non-`done` task, establish the requested
lowercase-kebab-case feature slug and run:

```bash
node .vibe/vcp-runtime/scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <feature-slug>
```

Only exit `0` permits reading the ledger bottom-up. Exit `1` is a fail-closed identity conflict:
never resume it silently. Present the Phase 1 🔵 menu in `SKILL.md` (archive cleanly, continue its
declared feature, explicitly retag with a recorded user reason, or inspect). A legacy/malformed
session has `UNKNOWN` identity and gets its own assign/archive/inspect menu. After the user
chooses, re-run this command; do not proceed until it exits `0`.

On a fresh session, write `**Feature slug:** <feature-slug>` before the first gate. Then read the
last gate line, cross-check `docs/tasks.json` status fields, and re-detect the current phase with
evidence (run the task's tests) — never from memory. Full evidence protocol:
`skills/caveman-tdd.md` → RESUME AFTER COMPACTION / RESTART.

---

## SESSION ARCHIVAL (end of session)

```bash
SESSION_FILE=".vibe/sessions/$(date +%Y-%m-%d)-$(echo "$TOPIC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md"
cp .vibe/SESSION.md "$SESSION_FILE"
echo "Archived session to $SESSION_FILE"
# Reset SESSION.md for next time (the placeholder is not a valid identity)
cat > .vibe/SESSION.md << 'EOF'
# Session — (next session date)
**Feature slug:** (set before first gate; lowercase kebab-case, e.g. `billing-fix`)
**Goal:**
**Status:** in progress
EOF
```

---

## GITIGNORE NOTE

`.vibe/` should be committed — it's project memory, not personal config.
Add to `.gitignore` only the sessions archive if too noisy:
```
# Optional: ignore verbose session history
# .vibe/sessions/
```
