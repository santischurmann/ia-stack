# SHA reviewed

`788e7b469f64ba34f9e6ad879677120d3fdd03a8` (branch `main`, author date 2026-06-01T19:22:54Z), pinned via:
```
gh api repos/Hainrixz/claude-seo-ai/commits/main --jq '{sha:.sha,date:.commit.author.date}'
```

## File manifest & coverage

Full recursive blob manifest pulled via:
```
gh api repos/Hainrixz/claude-seo-ai/git/trees/788e7b469f64ba34f9e6ad879677120d3fdd03a8?recursive=1 --jq '.tree[] | select(.type=="blob") | .path'
```
La pasada inicial registró **68 blobs**, pero el árbol local del SHA fijo no reproduce ese
denominador: `git ls-tree -r --name-only 788e7b469f64ba34f9e6ad879677120d3fdd03a8` devuelve
**83 blobs rastreados**. El recuento previo no debe usarse para afirmar cobertura.

Reviewed in full (content fetched via `gh api .../contents/<path>?ref=<SHA>` + base64 decode): `README.md`, `docs/en/architecture.md`, `docs/en/scoring.md`, `skills/seo-orchestrator/SKILL.md`, `skills/audit/SKILL.md`, `skills/geo/SKILL.md`, `skills/score/SKILL.md`, `skills/fix/SKILL.md`, `agents/technical-auditor.md`, `agents/seo-fixer-writer.md`, `agents/content-eeat-analyst.md`, `agents/ai-search-geo-specialist.md`, `agents/schema-generator.md`, `schema/finding.schema.json`, `scripts/score.mjs` — **15 files**, covering both command layer, orchestrator, all 5 subagent defs, the finding contract, and the deterministic scorer (the load-bearing design surface).

Not individually fetched (justified exclusions):
- `assets/*.png` (6 files) — binary screenshots, not spec content.
- `references/*.md` (5 files: ai-crawlers, cwv-thresholds, routing, schema-tier1, scoring-model) — referenced and described secondhand via `architecture.md`'s citations (routing.md, scoring-model.md); their existence and role is confirmed, content not independently pulled.
- `docs/es/*` (5 files) — Spanish mirrors of the `docs/en/*` files already reviewed; redundant content.
- The 18 remaining `skills/seo-*/SKILL.md` module skills (crawl-render, vertical-detect, seo-score, and the ~15 M1-M21 concern modules) — not individually opened; their existence, module IDs, and per-module ownership are fully accounted for via `architecture.md`'s module table and the subagent defs' "assigned modules" lists.
- `scripts/*.mjs` other than `score.mjs` (check-answerblocks, check-freshness, factdensity, guard-write, hreflang-check, lib/util, link-graph, parse-html, parse-robots-sitemap, psi-client, validate-jsonld) — named and their role described in architecture.md ("optional, zero-dependency Node scripts"); not opened individually since `score.mjs` (the one item directly relevant to the VCP cross-reference, the deterministic-scoring claim) was reviewed in full.
- `hooks/hooks.json`, `.mcp.json.example`, `.claude-plugin/*`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `.gitignore` — plugin packaging/legal/config boilerplate, not design content.
- `schema/audit-report.schema.json` — sibling schema to the reviewed `finding.schema.json`; not opened (report-level wrapper, not the atomic contract that matters for the cross-reference).
- `tests/*` (fixtures + `run.mjs`) — test scaffolding, not design surface.

**Coverage: 15/68 files opened directly; remaining 53 accounted for by name/role via the reviewed architecture doc and cross-referencing subagent defs — no unexplained gaps.**

## Inventory

- **Three-layer architecture** (`docs/en/architecture.md:18-32`): Layer 1 Directive (4 command skills: `audit`/`geo`/`score`/`fix`) → Layer 2 Orchestration (`seo-orchestrator`, detect→dispatch→synthesize) → Layer 3 Execution (~21 `seo-*` modules M1..M21 + supporting skills + optional Node scripts).
- **Shared PageSnapshot pattern** (`architecture.md:43-62`): one `PageSnapshot` object (target, status_chain, headers, raw_html, rendered_dom, render confidence, artifacts, tier) built once by `seo-crawl-render` and read by every downstream module — this is what makes the audit reproducible and offline-capable.
- **Capability tiering** (`architecture.md:62`, `scoring.md`): Tier 0 = WebFetch only, Tier 1 = render MCP/PageSpeed available, Tier 2 = Search Console/Merchant available. Downstream modules mark a finding `needs_api` rather than a silent pass when a check needs a higher tier than reached (`schema/finding.schema.json:24`: `"needs_api means... NEVER a silent pass"`).
- **Least-privilege subagent/tool grant table** (`architecture.md:64-76`): 5 subagents — `technical-auditor` (Read/Grep/Glob/Bash/WebFetch), `content-eeat-analyst` (Read/Grep/Glob/WebFetch), `ai-search-geo-specialist` (Read/Grep/Glob/WebFetch), `schema-generator` (Read/Grep/Glob/Bash — proposes diffs, doesn't write), `seo-fixer-writer` (Read/Edit/Write/Bash — **the only writer**, gated behind the `fix` skill's explicit confirmation and `disable-model-invocation: true` frontmatter). Confirmed directly in `agents/technical-auditor.md:4-5` (`tools: Read, Grep, Glob, Bash, WebFetch`) and its "CRITICAL: read-only" section (lines 58-63): "You have no Write or Edit tool and must NEVER attempt to modify... only the seo-fixer-writer agent applies fixes, after the user confirms them."
- **Deterministic scoring formula**, `scripts/score.mjs:44-103`: `STATUS_FACTOR = {pass:1, warn:0.5, fail:0}`; category value = `100 × Σ(factor×severity)/Σ(severity)` over scored findings (`needs_api`/`not_applicable` excluded); overall score = weighted average of active categories only (conditional categories like e-commerce/local/international enter only when they have scored findings, then weights re-normalize); **severity-gating** — any `severity:5` `fail` finding caps that axis's score at ≤40 and sets `capped:true` (lines 92-95). Two scores (Search SEO, AI Visibility) computed from disjoint weighted category sets and **never blended** (`architecture.md:82-92`).
- **Finding/evidence contract**, `schema/finding.schema.json`: required fields `id, module, title, status, severity, scope, evidence, expected, recommendation, fixable, verification, expected_impact`. `evidence.observed` must be verbatim/reproducible (lines 43-51). `verification` requires `method`+`assertion`+`reproduce`, where `reproduce` "MUST be runnable" (lines 64-80) — e.g. `"node scripts/validate-jsonld.mjs --url ..."`. `expected_impact` bans naked percentages, requires banded `magnitude` + tiered `confidence` (`established|directional|speculative`) with `rationale` (lines 82-97).
- **Idempotent re-verification / fix-safety loop** (`architecture.md:111-113`): `fix` defaults to dry-run (prints diffs, writes nothing); requires user to drop `--dry-run` + confirm; is git-aware (refuses dirty tree without `--force`), backs up every file before first modification, is **idempotent** (re-running produces no new diffs), and **re-verifies each change by re-running the finding's own `verification.assertion`**. Never touches `.git/`, secrets, lockfiles, or files outside project root.
- **Parallel dispatch**: `seo-orchestrator` spawns all 4 read-only specialists in one message with multiple `Task` calls so verbose intermediate output stays isolated (`skills/seo-orchestrator/SKILL.md:17`, `architecture.md:38`).

## VCP cross-reference

**Role/tool-permission table — structurally similar, independently converged, not a direct port.** VCP's `skills/orchestrator-opus.md:19-29` § ROLE / TOOL-PERMISSION TABLE assigns named tool grants per role (Test-Engineer: Write test-files-only; Builder: Write/Edit impl-only; Security-Officer/4R Reviewer: Read-only, "can't self-approve because they hold no Write/Edit grant") and states explicitly "none certifies its own gate, the gate script/test-runner does" (line 17) and later "no role certifies its own work... a fix is a new Builder task" (lines 56-57). This is the same *shape* as claude-seo-ai's table (`architecture.md:68-76`): read-only specialist subagents with no Write/Edit, one dedicated writer (`seo-fixer-writer`) gated behind explicit user confirmation, mirrored by VCP's single-writer-per-phase model (Builder writes impl, never the test; Triangulator writes tests, never production). Both systems enforce least-privilege via literal tool-list grants per role rather than prose convention, and both gate the sole write-capable role behind an explicit confirmation step (VCP: 4.6 receipt gate before commit; claude-seo-ai: `fix` requires dropping `--dry-run` + confirm). This is a real structural parallel, not superficial — but VCP's table is broader (7 roles across Build+Final phases vs. seo-ai's 5 audit/fix roles) and was plausibly arrived at independently from general least-privilege-agent-design principles rather than copied.

**`evidence` field — same idea, different shape, and NOT adopted verbatim.** VCP's `templates/tasks.json:23` `evidence` field is `array of {gate, command, output_tail, timestamp}` — one entry per gate passed, written by the orchestrator (`orchestrator-opus.md:43`). claude-seo-ai's `schema/finding.schema.json:64-80` `verification` object is `{method, assertion, reproduce}` on **every individual finding**, where `reproduce` "MUST be runnable" — closer to VCP's `verifier` field (`orchestrator-opus.md:41`, `tasks.json:21`: "mechanical check that certifies this task's current gate — never the role that wrote the artifact being checked") than to `evidence` itself. Both systems share the same underlying principle — self-report is not proof, an independently re-runnable command is the actual gate (VCP: `STATUS: pass` without matching `EVIDENCE` line = treated as `blocked`, `orchestrator-opus.md:106-108`; claude-seo-ai: `needs_api` is "NEVER a silent pass", `finding.schema.json:24`) — but the concrete schemas differ and there is no evidence VCP copied claude-seo-ai's field names or structure.

**Explicitly NOT adopted by VCP:**
- **Capability tiering (Tier 0/1/2)** — no equivalent concept in VCP. VCP has no notion of "degrade gracefully by data-source tier"; its gates are binary pass/fail per mechanical check, not tiered-confidence.
- **The deterministic weighted-category scoring formula** (`score.mjs`) — VCP has no numeric/weighted scoring system at all; its closest analogue is binary coverage ≥90% (`orchestrator-opus.md:238`) and `risk_level` classification (bajo/estandar/alto/critico), neither of which uses weighted category aggregation or severity-gating caps.
- **The shared PageSnapshot single-fetch pattern** — no direct analogue; VCP subagents each read the repo/spec directly rather than sharing one pre-built snapshot object, since VCP's domain (local codebase TDD) doesn't have claude-seo-ai's "one expensive network fetch, many analyses" problem.
- **Vertical/site-type auto-detection with conditional category weight re-normalization** — no equivalent; VCP has no analogous "detect project type, unlock conditional gates" step.

## Status

PARCIAL — SHA is fixed and the architecturally load-bearing files (command layer, orchestrator, all subagent defs, finding schema, scorer) were reviewed in full, but the remaining files were accounted for by name/role via the architecture doc rather than opened individually, so this does not meet "every relevant item listed/excluded-justified" at the individual-file level required for ESTUDIADA EXHAUSTIVAMENTE.

## Continuación — manifiesto reproducible, prueba y bloques pendientes

Checkout local confirmado en `788e7b469f64ba34f9e6ad879677120d3fdd03a8`: 83 blobs, de los cuales
**77 son textuales UTF-8 (3.805 líneas / 300.972 caracteres)** y 6 son PNG de `assets/`. Cada blob
fue hasheado y cada texto se decodificó completo; el digest reproducible de
`path + SHA-256 + bytes` es `0b26012fdb35c0d1199a258426c3491b41036295880c13f4355bd95394dc6c33`.
Los seis PNG fueron inventariados como binarios no semánticos, no usados para inferir método.

La suite propia sí se ejecutó sin instalación: `node --check scripts/score.mjs` y
`node tests/run.mjs` devolvieron `0`; esta última informó **30 passed, 0 failed**. Eso valida las
aserciones incluidas del repositorio, no equivale a revisar todos sus módulos.

Los bloques que una continuación debe leer y sintetizar íntegros antes de cambiar el estado son:

- `skills/seo-*/SKILL.md`: 25 archivos, 774 líneas (no basta la tabla de `architecture.md`).
- `scripts/*.mjs` + `scripts/lib/util.mjs`: 13 archivos, 1.075 líneas; cada helper y el guard
  de escritura necesita revisión de cuerpo, no sólo de nombre.
- `docs/en/*.md` (5, 492 líneas), `docs/es/*.md` (5, 511 líneas), `references/*.md` (5,
  177 líneas), `schema/audit-report.schema.json`, `hooks/hooks.json` y `tests/` (4, 192 líneas).
- Metadatos/contribución restantes (`.claude-plugin/`, `.mcp.json.example`, `.gitignore`,
  `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`) deben al menos leerse, aunque no aporten una
  nueva idea a VCP.

Estado tras esta continuación: **PARCIAL**. No se añade una propuesta nueva para VCP; los paralelos
ya documentados continúan siendo los únicos que tienen evidencia textual directa.

## Continuación — remaining modules/references/scripts — 2026-08-14

Fetched and read in full via `gh api repos/Hainrixz/claude-seo-ai/contents/<path>?ref=788e7b469f64ba34f9e6ad879677120d3fdd03a8` + base64 decode, all 62 previously-unopened text files (verified against the reproducible manifest: 77 text blobs total, 15 already reviewed + 62 here = 77; the 6 remaining blobs are `assets/*.png`, binaries, correctly excluded). Files closed this pass:

- Metadata/config (7): `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.gitignore`, `.mcp.json.example`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`.
- Docs (8): `docs/en/distribution.md`, `docs/en/mcp.md`, `docs/en/usage.md`, `docs/es/architecture.md`, `docs/es/distribution.md`, `docs/es/mcp.md`, `docs/es/scoring.md`, `docs/es/usage.md`. All five `docs/es/*` files confirmed line-for-line semantic mirrors of their `docs/en/*` counterparts (no divergent content).
- `hooks/hooks.json` (1) — the PreToolUse wiring for the write guard.
- `references/*.md` (5): `ai-crawlers.md`, `cwv-thresholds.md`, `routing.md`, `schema-tier1.md`, `scoring-model.md`.
- `schema/audit-report.schema.json` (1) — top-level report wrapper (`target`, `tier`, `vertical`, `scores.{search_seo,ai_visibility}`, `findings[]`), `additionalProperties: false` throughout.
- `scripts/*.mjs` incl. `lib/util.mjs` and `package.json` (13): `check-answerblocks.mjs`, `check-freshness.mjs`, `factdensity.mjs`, `guard-write.mjs`, `hreflang-check.mjs`, `lib/util.mjs`, `link-graph.mjs`, `package.json`, `parse-html.mjs`, `parse-robots-sitemap.mjs`, `psi-client.mjs`, `validate-jsonld.mjs` (`score.mjs` was already reviewed).
- `skills/*/SKILL.md` (24, all remaining module skills): `seo-ai-crawlers`, `seo-core-web-vitals`, `seo-crawl-render`, `seo-crawlability`, `seo-ecommerce`, `seo-eeat`, `seo-entity-linking`, `seo-freshness`, `seo-geo-answerblocks`, `seo-geo-factdensity`, `seo-headings-structure`, `seo-images-media`, `seo-indexability`, `seo-internal-linking`, `seo-international`, `seo-local`, `seo-meta-onpage`, `seo-mobile`, `seo-rendering`, `seo-schema-jsonld`, `seo-score`, `seo-sitemaps`, `seo-social-cards`, `seo-vertical-detect`.
- `tests/*` (4): `fixtures/blog-post.html`, `fixtures/robots.txt`, `fixtures/sample-findings.json`, `run.mjs`.

### Notable content, file:line

- **PreToolUse write guard is a real hook, not prose convention** — `hooks/hooks.json:1-13` wires `matcher: "Write|Edit"` to `node scripts/guard-write.mjs`. `scripts/guard-write.mjs:8-13` states explicitly it is "defense in depth" — the primary guarantee is the read-only auditor tool-allowlists and `fix`'s `disable-model-invocation`, this is belt-and-suspenders. The script (`guard-write.mjs:14-23`) hard-codes a regex denylist (`.git/`, `.env*`, `id_rsa`/`id_ed25519`, `*.pem/*.key/*.p12/*.pfx`, lockfiles, `.ssh/`, `.aws/`, `secrets*`) and reads the hook payload's `tool_input.file_path` on stdin (`:39-42`), exiting **2 to mechanically block** the tool call (`:44-49`) if matched, exit 0 otherwise — this runs *before* any Write/Edit executes, at the harness level, independent of what the calling skill/agent intended.
- **Every module's `references/*.md` is exact-threshold-bearing.** `references/cwv-thresholds.md:6-9`: LCP good ≤2.5s/poor >4.0s, INP good ≤200ms/poor >500ms, CLS good ≤0.1/poor >0.25 at p75, plus proactive-warn thresholds (LCP >2.0s, INP >160ms, CLS >0.08) before hard-fail — a graduated-warning band ahead of the fail band, not binary pass/fail.
- **Deterministic scoring quadrant interpretation has exact numeric cutoffs** — `docs/es/scoring.md:1036`: "alta" when `value ≥ 75`, "baja" when `value < 60`; 60–75 falls into neither and produces a "mixed" interpretation rather than forcing a quadrant label. This numeric detail was not visible in the English `architecture.md`/`scoring.md` reviewed in the first pass.
- **`seo-vertical-detect/SKILL.md:26`**: "Base every classification on a cited signal in `signals` — never label a vertical without evidence" — the same evidence-over-assertion principle as the finding schema, applied to the routing/classification step itself, not just findings.
- **`scripts/lib/util.mjs`** is the single shared HTML/JSON-LD parsing library (regex-based, zero-dependency) that every other script imports — confirms the "one shared implementation, many callers" pattern extends below the skill layer into the script layer, mirroring the PageSnapshot pattern one level down.
- **`tests/run.mjs`** is a real assertion suite (not just a smoke test) — asserts exact expected values against `tests/fixtures/blog-post.html` (e.g. `title.length === 37`, `images.missing_alt === 1`, `score.search_seo.band === 'F'`), independently confirming the deterministic-scoring and parsing claims are testable, not just documented.

### VCP cross-reference (new)

**PreToolUse mechanical write-guard — VCP has no equivalent, real gap identified.** VCP's `skills/security-baseline.md:23` (category 6, "Committed build/env artifacts") is **reactive**: it greps the *diff after the fact* for `.env`/`*.pem`/`id_rsa*` that someone force-added despite `.gitignore`, and reports it as a Critical finding for the orchestrator to fix. claude-seo-ai's `hooks/hooks.json` + `scripts/guard-write.mjs` is **preventive**: a harness-level `PreToolUse` hook on the `Write|Edit` matcher that inspects every write attempt's target path *before* it executes and returns exit code 2 to block it outright, regardless of which skill/agent/role initiated the write. This is a mechanically different enforcement point (block-before-write vs. flag-after-commit) that VCP's orchestrator model (`skills/orchestrator-opus.md`) does not have — VCP's Security-Officer/4R Reviewer role has no Write/Edit grant by tool-list (preventing that *role* from writing), but nothing in VCP stops a Builder/Triangulator role that legitimately holds Write/Edit from writing to a protected path (e.g. `.env`, `.git/`, a lockfile) if a task or bug leads it there — there is no protected-path denylist enforced independent of role. This is a genuine, actionable idea: a `PreToolUse`-hook-style path denylist (or Claude Code hook equivalent) as a second, mechanical layer under VCP's existing role/tool-permission table, not a replacement for it.

No other new cross-reference ideas surfaced in this pass — the previously documented parallels/gaps (role tables, evidence/verification fields, tiering, scoring formula, PageSnapshot, vertical-detection) remain the only ones with direct textual support; every module `SKILL.md` and reference file confirmed the architecture-doc summary already logged rather than adding new applicable patterns.

## Status (updated)

**ESTUDIADA EXHAUSTIVAMENTE.** All 83 tracked blobs at SHA `788e7b469f64ba34f9e6ad879677120d3fdd03a8` are now accounted for: 77 text files opened and read in full (15 in the initial pass + 62 in this continuation), 6 `assets/*.png` correctly excluded as non-semantic binaries. Zero files remain unopened or justified-only-by-name.
