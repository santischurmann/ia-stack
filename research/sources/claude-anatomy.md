# SHA reviewed

`ab0e644f89c7320fb6fcbf471d003e842735f100` (main, author date 2026-08-13T03:59:06Z). Repo: https://github.com/Hainrixz/claude-anatomy. Fixed at this SHA for the whole review — no drift.

## File manifest & coverage

Total files in manifest (git trees API, recursive, blobs only): **22**.

```
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
CITAS.md
LICENSE
README.md
skills/anatomia-cc/SKILL.md
skills/anatomia-cc/assets/arbol-de-decision.md
skills/anatomia-cc/assets/esqueleto-app-sdk.md
skills/anatomia-cc/assets/esqueleto-artefacto.md
skills/anatomia-cc/assets/esqueleto-hook.md
skills/anatomia-cc/assets/esqueleto-mcp.md
skills/anatomia-cc/assets/esqueleto-plugin.md
skills/anatomia-cc/assets/esqueleto-rutina.md
skills/anatomia-cc/assets/esqueleto-skill.md
skills/anatomia-cc/assets/esqueleto-subagente.md
skills/anatomia-cc/evals/decisiones.json
skills/anatomia-cc/evals/evals.json
skills/anatomia-cc/references/afuera-de-la-sesion.md
skills/anatomia-cc/references/anti-patrones.md
skills/anatomia-cc/references/como-se-carga-el-contexto.md
skills/anatomia-cc/references/mcp-o-skill.md
skills/anatomia-cc/references/modos-de-skill.md
```

Coverage: **22/22 blobs read in full.** This closure reread the former partial/sampled set: `como-se-carga-el-contexto.md` in full; all nine assets (decision tree plus eight skeletons); both eval JSON files; `CITAS.md`; and `LICENSE`, as well as the already-covered manifests, README, SKILL.md and references. There are no binaries, generated artifacts, or exclusions in this snapshot.

## Closure evidence (2026-08-14)

The repository was cloned into an isolated scratch directory and detached at `ab0e644f89c7320fb6fcbf471d003e842735f100`; `git rev-parse HEAD` matched the pinned SHA and `git ls-tree -r -l HEAD` returned 22 blobs. Every file listed in the manifest was read in full from that checkout. `ConvertFrom-Json` parsed `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `skills/anatomia-cc/evals/decisiones.json`, and `skills/anatomia-cc/evals/evals.json` successfully (exit 0). The project contains no executable implementation or runnable local test harness; its own evals are declared fixtures, not executed tests.

No files excluded — nothing vendored, binary, or generated in this repo; it's a single skill package (22 files, all text/markdown/json).

## Inventory

This repo is a single Claude Code **skill** (`skills/anatomia-cc/`), not a runnable tool/framework — its "functionality" is a decision-tree prompt plus reference docs. Concrete inventory:

- **Decision tree** (`SKILL.md`, README.md `## El árbol de decisión`): 4-step gate — Step 0 "does this need building at all" (CLAUDE.md line / install existing / output-style / script) → Step 1 "inside vs outside a session" (artifact / Agent SDK app / cloud routine) → Step 2 "which piece" (hook / MCP server / subagent / skill) → Step 3 "package as plugin?" (2+ co-shipped pieces or cross-machine).
- **Skill frontmatter contract table** (`references/modos-de-skill.md`): documents all Claude-Code-specific SKILL.md frontmatter fields (`disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `background`, `paths`, `allowed-tools`, `disallowed-tools`, `effort`, `hooks`, `argument-hint`, `arguments`, `shell`, `compatibility`) vs. the **6-field open Agent Skills standard** (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) that claude.ai/Skills-API/Cowork enforce — extra fields hard-fail upload there.
- **11 named anti-patterns** (`references/anti-patrones.md`): slash-command-for-new-thing, subagent-only-for-context-isolation, 40-tool MCP "just in case", API key embedded in skill prompt, single-skill plugin, hook that needs judgment, "important rule" in CLAUDE.md instead of a hook, 800-line CLAUDE.md, 3000-word SKILL.md with 6 cases inside, `context: fork` on a knowledge-only skill, artifact requested when an app (with backend) was needed. Each has a before/after pair.
- **Context-cost table** (`references/como-se-carga-el-contexto.md`): turn-zero load order (system prompt → MEMORY.md first 200 lines/25KB → env → MCP tool *names* only → one description line per installed skill → user CLAUDE.md → project CLAUDE.md) and the "loaded skill stays loaded all session" cost trap.
- **MCP-vs-skill heuristic** (`references/mcp-o-skill.md`): "if writing the SKILL.md surfaces a credential/token, it's an MCP server, not a skill" — with a worked before/after (support-ticket triage: MCP does `listar_tickets_abiertos()`, skill carries no credential, only judgment).
- **8 file-skeleton templates** (`assets/esqueleto-*.md`) for skill, subagent, hook, MCP server, plugin, artifact, Agent-SDK app, cloud routine.
- **Eval suites** (`evals/evals.json` — 10+10 trigger tests, `evals/decisiones.json` — 12 decision-correctness tests): written but explicitly **not executed** (README states this plainly, distinguishing it from the `validar_artefacto.py` structural gate that did run and pass).
- **Marketplace/plugin manifests** (`.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`): standard plugin packaging, version 0.3.1, MIT license.
- **Naming-collision note** (README "Por qué la skill se llama..."): Anthropic-hosted surfaces (claude.ai upload, Cowork, Skills API) reject any `name` containing "claude" or "anthropic" — a trademark reservation not caught by the official `quick_validate.py`.

## VCP cross-reference

Ideas found and checked against VibeCodeProtocols (<home>\Desktop\Claude\VibeCodeProtocols):

- **Frontmatter `disable-model-invocation` / `context: fork` / `user-invocable` modes**: NOT applied in VCP. Grepped `context: fork|disable-model-invocation|user-invocable` across the repo — the only hits are in `research/sources/modo-tdah.md` (a different source-study file, not VCP's own skills) noting VCP does *not* use `disable-model-invocation` anywhere. VCP's `SKILL.md` and `skills/*.md` (e.g. `skills/orchestrator-opus.md:2-3`, `skills/subagent-red.md:2-3`) only set `name`/`description` frontmatter — no `context`, `disable-model-invocation`, or `user-invocable` fields present in any of the 8 skill files. This is a real gap: VCP's subagent skills (`skills/subagent-red.md`, `subagent-green.md`, `subagent-refactor.md`, `subagent-triangulate.md`, `subagent-chore.md`, `subagent-docs.md`) are dispatched manually via the orchestrator's Task/Agent tool calls rather than via `context: fork` on a skill — claude-anatomy's point that "isolation is now a frontmatter field, not a separate subagent file" is not reflected in how VCP's subagent skills declare themselves.
- **"Six fields for portability, all fields if staying in Claude Code" distinction** (`references/modos-de-skill.md`): NOT applied — VCP's `SKILL.md` frontmatter (lines 2-3) uses only `name`/`description`, so it happens to already be portable, but there's no explicit statement anywhere in VCP docs of *why* (i.e., no acknowledgment of the open Agent Skills standard's 6-field cap). Not cited/adopted as a documented principle.
- **MCP-vs-skill credential heuristic**: not directly applicable — VCP is a TDD workflow skill with no MCP servers of its own, so this pattern has no surface to land on in this repo.
- **Anti-pattern catalog as a documentation pattern**: VCP does not have an equivalent "anti-patterns" reference file (checked `skills/` dir listing — no `anti-pattern*.md` or similar). This is a structural idea (a dedicated before/after anti-pattern doc) VCP could adopt but currently does not.
- **Eval suites "written but not executed" transparency framing**: VCP has no eval-suite equivalent for its own skill-trigger correctness (its `scripts/verify-receipt.mjs` and `scripts/verify-red.sh`/`.ps1` verify build-time TDD gates, not skill-invocation triggering) — different concern, not comparable.
- **4-step "does this need building at all" decision gate**: VCP is itself a single-purpose TDD skill (not a meta-skill for choosing among Claude Code primitives), so this decision-tree pattern is out of scope for what VCP does — no cross-reference expected or found.

Overall: claude-anatomy is a meta/advisory skill about *which Claude Code primitive to build*, largely orthogonal to VCP's TDD-execution domain. The one concrete, actionable gap surfaced is VCP's non-use of `context: fork`/`disable-model-invocation` on its subagent-role skills, which is a legitimate architectural question for VCP maintainers to consider (whether `subagent-red.md` etc. should declare `context: fork` explicitly rather than relying entirely on manual Task-tool dispatch from the orchestrator) — flagged here as an observation, not implemented.

## Status

**ESTUDIADA EXHAUSTIVAMENTE EN EL SNAPSHOT FIJADO.** Los 22 blobs textuales/configurables fueron leídos íntegros y sus cuatro JSON parsearon. No queda contenido de este árbol pendiente de lectura; las evaluaciones siguen siendo artefactos escritos-no-ejecutados por decisión del propio proyecto, no una omisión de cobertura.
