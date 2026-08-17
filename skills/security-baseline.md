---
name: vcp-security-baseline
description: |
  ES: Chequeo de seguridad interno, self-contained — fallback cuando cyber-neo no está instalado.
  EN: Self-contained internal security check — fallback when cyber-neo isn't installed.
allowed-tools: Read, Grep, Bash
---

# VCP Security Baseline (fallback, no external skill)

Runs read-only, same severity model as cyber-neo (Critical/High/Medium/Low), narrower category
set. This is a floor, not a replacement for a real SAST/SCA tool — if `cyber-neo` (or any
project-installed scanner) is present, prefer it; this exists so Phase 4.3 never has zero
security gate when nothing else is installed.

## CATEGORIES (run all, on the changeset diff only — `git diff --name-only <base>...HEAD`)

1. **Hardcoded secrets** — grep changed files for patterns: `(?i)(api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}`, AWS-style `AKIA[0-9A-Z]{16}`, generic base64-looking blobs assigned to a var named `*key*`/`*secret*`. Any hit = Critical, block.
2. **Injection surface** — string-concatenated SQL (`"SELECT .* " + `/f-string with raw input into a query), `eval(`/`exec(`/`child_process.exec(`/`os.system(` fed by request/user input, unescaped template into `innerHTML`/`dangerouslySetInnerHTML`. Hit = High.
3. **Auth/authorization gaps** — new route/endpoint/handler added in the diff with no visible auth check (grep for the project's existing auth-decorator/middleware pattern near other routes; absent on the new one = flag) — Medium, human call (framework conventions vary too much for a mechanical Critical here).
4. **Insecure deserialization / unsafe file ops** — `pickle.loads` on external input, `yaml.load` without `Loader=SafeLoader`, `JSON.parse` fine (safe by default) but `eval(`-based parsing is not, path-join with unsanitized user input (`../` traversal risk). Hit = High.
5. **Dependency additions** — new entries in `package.json`/`requirements.txt`/`go.mod`/`Cargo.toml` in this diff: no live CVE lookup (no network call assumed) — flag as `needs_manual_check: <package>@<version>` at Medium, don't fabricate a CVE that wasn't actually looked up.
6. **Committed build/env artifacts** — diff adds `.env`, `*.pem`, `*.key`, `id_rsa*`, or anything matching the repo's own `.gitignore` patterns despite the ignore rule (means someone force-added it) = Critical, block.

## OUTPUT

Same finding schema as `orchestrator-opus.md` § SUBAGENT OUTPUT SCHEMA, plus per-finding:
```
SEVERITY: critical | high | medium | low
CATEGORY: <1-6 above>
LOCATION: file:line
EVIDENCE: <exact matched string/pattern, redacted if it's the secret itself — never echo a real secret value into a report>
```
Critical/High → orchestrator fixes before continuing, re-run this checklist on the fix. Medium/Low → `.vibe/DEBT.md` per `skills/vibe-memory.md` § WHEN TO WRITE WHAT.

## LIMITS (say this to the user once per Phase 4.3 run using this fallback)

This is grep/pattern-based, not a real SAST engine — no taint analysis, no cross-file data flow,
no dependency CVE database. It catches the obvious/common cases (secrets, string-built queries,
missing auth pattern, unsafe deserialization, artifact leaks) and nothing subtler. If the
project needs real security coverage, install `cyber-neo` or an equivalent scanner — this
baseline is what keeps Phase 4.3 from being a no-op, not a substitute for one.
