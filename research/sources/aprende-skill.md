# SHA reviewed

`72287328a40956f0b655ce6547fc5344640a261b` (branch `main`, commit date 2026-07-18T20:30:29Z).
Repo: https://github.com/Hainrixz/aprende-skill

## File manifest & coverage

Full recursive tree at pinned SHA: **38 blobs total**.

Coverage: **38/38 blobs audited at the pinned SHA.** All 34 textual/configuration/test/manifest blobs were read in full, including plugin manifests, workflow, issue/PR templates, hook-enable/disable commands, fixtures, both READMEs, the changelog, contribution guide, and the skill-stub template. The four PNG blobs were technically inspected rather than treated as silent exclusions.

### Complete audit manifest (38)

- Plugin/config: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.editorconfig`, `.gitattributes`, `.gitignore`.
- GitHub operational files: `.github/FUNDING.yml`, three `.github/ISSUE_TEMPLATE/*.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/validate.yml`.
- Root documents: `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `README.es.md`, `README.md`.
- Binary art: `assets/capture.png`, `assets/hero.png`, `assets/mascot.png`, `assets/review.png`.
- Commands: `commands/aprende-disable-hooks.md`, `commands/aprende-enable-hooks.md`, `commands/aprende.md`.
- Fixtures: `examples/README.md`, `examples/fixture-conversation-1.md`, `examples/fixture-conversation-2.md`, `examples/fixture-conversation-3.md`.
- Hooks: `hooks-handlers/capture-signal.sh`, `hooks-handlers/stop-suggest.sh`, `hooks/hooks.json`.
- Main skill: `skills/aprende/SKILL.md`, `skills/aprende/prompts/confirmation-template.md`, and `skills/aprende/references/{lesson-format,memory-format,review-workflow,signal-patterns,skill-stub-template}.md`.
- Alias: `skills/learn/SKILL.md`.

## Closure evidence (2026-08-14)

The repository was cloned to an isolated scratch directory and detached at `72287328a40956f0b655ce6547fc5344640a261b`; `git rev-parse HEAD` matched and `git ls-tree -r -l HEAD` produced the 38-blob manifest. PNG inspection recorded valid PNG signatures (`89504E470D0A1A0A`), dimensions and SHA-256:

- `capture.png` — 1,024×1,024 RGB, `5E322F21872B55488D6263B35A04F69B702E9078B9686E3FDFD2AAE94B501CF0`.
- `hero.png` — 3,168×1,344 RGB, `57D30E80184C6AA414E59D407434C4F273A3794595D4142ECFC5E4240014D7C9`.
- `mascot.png` — 306×236 ARGB, `EAFD60B592760467057C6ABEA4158365B0FDA21946377E96F4FD1A010A58D6C0`.
- `review.png` — 1,024×1,024 RGB, `FF280F139530C17C0BC2BCFA9996B75C5B79714DAC1E2210A51623BCE878ACE0`.

Without installing dependencies, a local equivalent of the repository's `validate.yml` completed with exit 0: all three JSON files parsed, both hook scripts passed Git Bash 5.3 `bash -n` and executable checks, every required frontmatter/reference check passed, the Stop hook emitted parseable JSON, and the PostToolUse hook wrote `error-from-Bash` to the correctly slugged underscore-path fixture.

## Inventory

**Reflexion lesson schema** (`skills/aprende/references/lesson-format.md`, mirrored inline in `SKILL.md` §5, lines 355–377 of raw SKILL.md):
```yaml
---
name: lesson_<short-slug>
description: <one sentence>
metadata:
  type: lesson
  confidence: high | medium | low
  status: active   # active | retired | superseded-by-<name>
  createdAt: YYYY-MM-DD
  lastValidated: YYYY-MM-DD
  originSessionId: <session-id or omit>
---
```
Body — four mandatory subheads, bilingual, in fixed order: **What happened / Qué pasó**, **Why it happened / Por qué pasó**, **How to avoid / Cómo evitar**, **Detection signal / Señal de detección**, optional `Related: [[other-name]]` footer.

**Confirm-gate wording** (`prompts/confirmation-template.md`, `SKILL.md` §4 Pass D): prints `Found N candidate learnings...`, numbered list `[category] title — rationale (confidence)`, optional `[overlaps with: <name>]` annotation, accepts `1,3,5` / ranges `1-4` / `all` / `none` / `edit N: <text>` / `skip N` / `drop low` / `drop medium`. Hard rule stated 3x in the doc: no Write/Edit/destructive Bash between printing the list and the user's reply.

**Dedup / never-delete rules** (`SKILL.md` §9 Safety, `review-workflow.md` "Retire rules"): dedup *annotates*, never silently drops or merges (Pass C). Retiring a lesson sets `status: retired` and bumps `lastValidated` — file and MEMORY.md index entry are never removed; a fully-superseding new lesson sets old one to `superseded-by-<name>`. `/aprende --review` walks lessons oldest-`lastValidated`-first, prompts `[y/n/edit/skip]` per lesson.

**Candidate cap**: hard cap of 15 candidates per run (`SKILL.md` §4 Pass B, §9 rule 6; `confirmation-template.md` formatting rule 1) — if more signals exist, keep the 15 highest-confidence and tell the user to re-run.

**Passive-capture-via-hooks split** (`hooks-handlers/capture-signal.sh`, `hooks-handlers/stop-suggest.sh`, `hooks/hooks.json`): a `PostToolUse` hook on `Bash|Edit|Write` appends one-line signal records (`error-from-<tool>`, `repeated-edit <path> (3x today)`) to a per-project scratch file `~/.claude/projects/<slug>/.aprende-signals.md`; never writes a learning (contract stated in the script header, enforced by construction — it only does `printf >> $signals_file`). A `Stop` hook reads that file read-only and emits a JSON `additionalContext` bilingual nudge if unconsumed signals exist. `capture-signal.sh` uses a `flock`-guarded counter file (`.aprende-edit-counts.tsv`) to detect the 3rd same-day edit to a file; exits 0 unconditionally (`set -u`, no `set -e`, trap-based cleanup) so it never blocks the user's tool call.

**Confidence derivation rule** (`SKILL.md` §4 Pass B): `high` = explicit user feedback OR error→fix with user explanation OR repeated correction; `medium` = inferred pattern / single comment without elaboration; `low` = guess. Confidence label is mandatory on every candidate (rule 7 of §9).

**Four categories** (not just lessons): `memory` (type: user|feedback|project|reference), `lesson`, `skill` (stub), `project-doc` (dual-write `CLAUDE.md`+`AGENTS.md` for Codex compat). aprende-skill's scope is broader than just error-lesson memory.

## VCP cross-reference

Compared field-by-field against `<home>\Desktop\Claude\VibeCodeProtocols\templates\vibe\LESSONS.md` and `skills\vibe-memory.md` § LESSONS PROTOCOL (lines 178–225).

**Adopted / matches:**
- Reflexion four-question body shape — VCP's `LESSONS.md:13-16` (`**What happened:**`, `**Why (root cause):**`, `**How to avoid:**`, `**Detection signal:**`) matches aprende's four subheads exactly in substance (VCP drops the bilingual duplication, keeps one language per project convention).
- `confidence: high|medium|low` field — VCP `LESSONS.md:17` / `vibe-memory.md:164` — direct match to aprende's `metadata.confidence`.
- `status: active` with retire-not-delete — VCP `LESSONS.md:10` (`status: active`) and `vibe-memory.md:211-213` ("Retire, never delete... change `status: active` → `status: retired (<date>, reason: <why>)` in place") — matches aprende's `review-workflow.md` retire rule and `status: active|retired|superseded-by-<name>` enum. VCP does not explicitly carry the `superseded-by-<name>` variant, only `retired (<date>, reason:...)`.
- Confirm-gate before write, worded almost identically — VCP `vibe-memory.md:197-206` (`🔵 LESSONS learned this session — confirm which to keep:` numbered list, `A) all B) none C) pick by number D) edit [n]`) mirrors aprende's `confirmation-template.md` (`Found N candidate learnings...`, numbers/ranges/all/none/edit N). VCP simplified the input grammar (no ranges, no `skip N`, no `drop low`) but kept the same gate semantics and the same guiding principle almost verbatim: VCP `vibe-memory.md:205` "A false positive locked into memory is worse than repeating a correction three times" is a near-direct paraphrase of aprende `SKILL.md:50-51` "a false positive locked into memory is worse than repeating a correction three times."
- Dedup-annotates-never-drops — VCP `vibe-memory.md:193-195` ("Match found → don't draft a new entry, instead prepare a note `[overlaps with: LESSON-<n>]`... annotate, never silently merge/drop") matches aprende `SKILL.md` §9 rule 5 and Pass C exactly, including the bracket annotation syntax `[overlaps with: ...]`.
- 15-candidate cap — VCP `vibe-memory.md:190-191` ("Cap at 15 candidate lessons — force prioritization") is a direct adoption of aprende's `SKILL.md:188-189` 15-item cap.
- Passive-capture-via-hooks split — VCP adopted the *concept* but re-implemented it as an in-band scratch buffer rather than an OS-level hook: `vibe-memory.md:185-188` ("Passive capture... append one line to a scratch buffer in `SESSION.md` (`⚠ signal: <1-line>`). This is capture only. It does not touch `LESSONS.md`.") mirrors aprende's `capture-signal.sh` contract (signals-only, never writes a learning) but VCP has the *orchestrator itself* append the signal line during Build/Test rather than a real `PostToolUse` bash hook writing to a separate file. VCP does NOT have an actual hook script or a `Stop`-hook nudge — this part is a design analog, not a literal port.
- Provenance field — VCP added `**Project/phase/run:**` (`LESSONS.md:12`, `vibe-memory.md:159`) which aprende expresses as `metadata.originSessionId` (optional, frontmatter-only). VCP's version is mandatory ("always") and richer (project-slug/phase/feature-slug), not a direct copy.
- Decay/staleness flag — VCP `vibe-memory.md:215-219` ("Decay flag, not auto-delete... >90 days old and hasn't been the Detection signal match... mark inline `[stale? — unseen 90d]`") has **no equivalent in aprende-skill**. This is a VCP-original addition, not adopted from this source — aprende's only aging mechanism is `/aprende --review`'s manual oldest-first prompt loop with no automatic time-based flag.
- Recall/detection-signal-triggered surfacing — VCP `vibe-memory.md:221-224` ("When Spec\Plan\Build touches a file:line or pattern matching an active lesson's Detection signal, surface it inline before the relevant gate") goes beyond aprende, which only reads signals passively in Pass A of `/aprende` itself; aprende has no equivalent of surfacing an existing lesson proactively during unrelated work.

**Explicitly NOT adopted by VCP:**
- The `memory` / `skill` (stub) / `project-doc` categories — aprende's `/aprende` is a four-category system; VCP only ported the `lesson` category into `LESSONS.md`. VCP has no equivalent of aprende's `memory` (user/feedback/project/reference types), no skill-stub auto-drafting, and no dual-write `CLAUDE.md`+`AGENTS.md` project-doc category (VCP already writes `PROJECT.md`/`PATTERNS.md`/`DECISIONS.md` via its own distinct mechanism, not from `/aprende`-style confirm-gated capture).
- Bilingual (EN/ES side-by-side) schema and prose duplication — aprende writes every field/section in both languages; VCP's `LESSONS.md` template is single-language.
- `--portable` mode (mirroring lessons to `./.aprende/` for Codex/`AGENTS.md` interop) — no VCP equivalent; VCP has no cross-tool (Codex) portability layer.
- Literal shell hook scripts (`capture-signal.sh`'s `flock`-guarded 3x-same-day-edit counter, `stop-suggest.sh`'s Stop-hook JSON `additionalContext` nudge) — VCP has no PostToolUse/Stop hook files; the "passive capture" idea was reimplemented as an orchestrator-driven scratch line in `SESSION.md`, not a real hook.
- `edit N: <text>` / `skip N` / `drop low` / `drop medium` / numeric ranges (`1-4`) in the confirm-gate input grammar — VCP's gate only offers `A) all B) none C) pick by number D) edit [n]`, a reduced subset.
- `originSessionId` as a frontmatter field name — VCP renamed/expanded this to the mandatory `**Project/phase/run:**` body line instead of keeping it as optional YAML frontmatter.
- Credits/inspiration chain aprende itself lists (Reflexion paper, Hermes Agent, claude-reflect, claude-mem) — VCP does not cite these; only cites aprende-skill as its own inspiration (per task framing), which itself is one hop removed from the original Reflexion paper.

## Status

**ESTUDIADA EXHAUSTIVAMENTE EN EL SNAPSHOT FIJADO.** Los 34 blobs textuales/configurables/tests/manifiestos fueron leídos en su totalidad y los 4 PNG binarios fueron inspeccionados técnicamente con evidencia reproducible. La validación local equivalente a CI terminó en verde; no se instaló nada ni se modificó el repositorio fuente.
