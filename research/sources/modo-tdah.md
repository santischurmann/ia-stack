# SHA reviewed
`8a6a89c09b75f1fa7375910eacdf9ac3e4797ce2` (main, commit date 2026-08-01T20:25:10Z), repo `Hainrixz/modo-tdah`. Fixed at this SHA for the whole review, no drift.

## File manifest & coverage
Full recursive tree at this SHA (**10 blobs total**):

1. `.claude-plugin/marketplace.json` — reviewed
2. `.claude-plugin/plugin.json` — reviewed
3. `.gitignore` — reviewed
4. `LICENSE` — read in full
5. `README.md` — reviewed
6. `dist/modo-tdah-en.zip` — binary archive inspected technically; its only nested text file, `modo-tdah-en/SKILL.md`, read in full
7. `dist/modo-tdah.zip` — binary archive inspected technically; its only nested text file, `modo-tdah/SKILL.md`, read in full
8. `hooks/always-on.sh` — reviewed
9. `hooks/hooks.json` — reviewed
10. `skills/modo-tdah/SKILL.md` — reviewed

Coverage: **10/10 blobs audited at the pinned SHA** — the 8 text/configuration blobs were read in full; the two ZIP blobs were inspected as ZIP archives and their sole nested `SKILL.md` files were read in full. No repository blob remains excluded.

## Closure evidence (2026-08-14)

The snapshot was cloned and detached explicitly at `8a6a89c09b75f1fa7375910eacdf9ac3e4797ce2`; `git rev-parse HEAD` returned that exact SHA. `git ls-tree -r -l HEAD` produced the 10-blob manifest above. `tar -tf` and `tar -xOf` inspected both ZIPs and read their only payloads. SHA-256 / archive results were:

- `dist/modo-tdah-en.zip` — 3,562 bytes, SHA-256 `9F2C8244F6A9F32A51549B0E45E3FA6B11BE0A8ED492C4F8A8B91E1B1FBF4707`, one `modo-tdah-en/SKILL.md` payload.
- `dist/modo-tdah.zip` — 4,385 bytes, SHA-256 `5743061D2CCEFDD03433670B17B50DA57B030BEB752EAF2A9BDC80C83F8F9047`, one `modo-tdah/SKILL.md` payload.

Verification commands, all exit 0: JSON parse of both plugin manifests; `C:\Program Files\Git\bin\bash.exe -n hooks/always-on.sh`; and the hook run without its opt-in flag in an isolated temporary `$HOME`/`$CLAUDE_CONFIG_DIR`.

## Inventory
Repo is a Claude Code **plugin** (not a general "framework") that ships exactly one skill: an output-style/formatting ruleset for ADHD-friendly responses, Spanish translation/adaptation of `ayghri/i-have-adhd`.

- **Plugin manifest**: `.claude-plugin/plugin.json` — name `modo-tdah`, v1.0.0, MIT license.
- **Marketplace manifest**: `.claude-plugin/marketplace.json` — single plugin entry, category `productivity`.
- **Skill file**: `skills/modo-tdah/SKILL.md` — frontmatter has `disable-model-invocation: true` (so it only activates via explicit `/modo-tdah` slash command in Claude Code, never auto-invoked) and `metadata.hermes.tags`. Body defines 10 output-format rules (action-first opening, numbered multi-step lists, single concrete closing action, no tangents, state-repeat per turn e.g. "step 3 of 5", concrete time estimates, visible progress, dry error tone, max-5-item lists, no preamble/recap/sign-off), a Spanish-specific banned-phrase blacklist (since banning "Great question!" doesn't stop "Buena pregunta"), 6 exception cases (explicit "explain in detail" request, destructive actions require confirmation, 3-turn debug spiral triggers a diagnostic question instead of more iteration, real ambiguity, rule-vs-task conflict, rule-vs-environment/system-prompt conflict), and a pre-send checklist (strip announcing sentences, strip "anything else?" closers, strip hedging adverbs, strip idioms).
- **Hook**: `hooks/hooks.json` registers a `SessionStart` hook (matcher `startup|resume|clear|compact`) running `hooks/always-on.sh` with a 5s timeout and a `statusMessage`.
- **Hook script**: `hooks/always-on.sh` (POSIX sh) — checks for flag file `$CLAUDE_CONFIG_DIR/.modo-tdah-always` (default `~/.claude/.modo-tdah-always`); if present, strips the YAML frontmatter off `SKILL.md` via an `awk` state-machine and injects the ruleset body as session-start context, always exits 0 so it never blocks session startup. Toggle mechanism: `touch ~/.claude/.modo-tdah-always` to enable persistent mode, `rm` to disable; in-session toggle via user saying "modo normal"/"normal mode" etc.
- **Distribution model**: two install paths — Claude Code via plugin marketplace (`claude plugin marketplace add` / `claude plugin install`), and Claude chat/Cowork via manual zip upload of `dist/*.zip` (a variant SKILL.md without `disable-model-invocation` since chat has no slash commands, so the model must self-invoke it there).

No code, no tests, no CI, no other config — this is a documentation/prompt-engineering artifact plus one shell hook, nothing else.

## VCP cross-reference

**Applied (already present in VCP, independently — not adopted from this source):**
- None found. VCP's `skills/orchestrator-opus.md`, `SKILL.md`, and `skills/vibe-memory.md` were checked (`grep -i "SessionStart|disable-model-invocation|acción primero|sin preámbulo|sin recap"` across the repo) and none of modo-tdah's concepts appear. VCP has no output-formatting/communication-style contract of this kind, no SessionStart hook, and no `disable-model-invocation` usage anywhere in the tree.

**Not applied, and why:**
- **Action-first / numbered-step / no-preamble output style (SKILL.md rules 1–10)**: not applied. VCP is a TDD process skill (RED→GREEN→TRIANGULATE→REFACTOR, receipt-gated commits) — it constrains *what* Claude does and verifies, not *how* Claude phrases prose responses. Out of scope: a response-formatting overlay is orthogonal to a build/test workflow gate and would belong in a separate output-style skill, not merged into VCP's TDD contract.
- **`SessionStart` hook injecting persistent ruleset text (`hooks/hooks.json` + `always-on.sh`)**: not applied. VCP's persistence model (`.vibe/LESSONS.md`, `.vibe/COMPANY.md`) is file-based confirm-gated memory read by the orchestrator/subagents during a run, not a shell hook injected at session boot. Different mechanism for a different purpose (process memory vs. universal style toggle); adopting a SessionStart hook wasn't warranted since VCP doesn't need every session to open in "TDD mode" globally — it's invoked per-task via the orchestrator skill.
- **`disable-model-invocation: true` frontmatter pattern**: not applicable — VCP's `SKILL.md` is meant to be discoverable/model-invocable when the task matches (per its own description-based trigger), unlike modo-tdah which deliberately requires an explicit slash command so it never surprises the user by silently changing response style.
- **Toggle-by-natural-language phrase ("modo normal" cancels mid-session)**: not applied; VCP has no analogous "cancel the protocol via magic phrase" mechanism, nor an obvious need for one given it's task-scoped rather than session-wide.

## Status

**ESTUDIADA EXHAUSTIVAMENTE EN EL SNAPSHOT FIJADO.** Los 10 blobs del árbol fueron tratados: cada texto/configuración se leyó íntegro y los dos binarios ZIP se inspeccionaron técnicamente, incluyendo su contenido textual interno. No se ejecutó instalación ni se modificó el repositorio fuente.
