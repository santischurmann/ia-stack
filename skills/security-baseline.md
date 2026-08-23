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

## COMMAND (mechanical, required)

From the project root, run:

```bash
node .vibe/vcp-runtime/scripts/verify-security-baseline.mjs check --base <merge-base-or-origin/main>
```

It scans the union of the base delta, staged, unstaged and untracked non-ignored paths. A newly
written secret must block **before** `git add`; scanning only `<base>...HEAD` is not acceptable.
The script exits `1` for Critical/High and redacts values from its output.

## CATEGORIES IMPLEMENTED

1. **Hardcoded secrets** — grep changed files for patterns: `(?i)(api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}`, AWS-style `AKIA[0-9A-Z]{16}`, generic base64-looking blobs assigned to a var named `*key*`/`*secret*`. Any hit = Critical, block.
2. **Injection surface** — string-concatenated SQL (`"SELECT .* " + `/f-string with raw input into a query), `eval(`/`exec(`/`child_process.exec(`/`os.system(` fed by request/user input, unescaped template into `innerHTML`/`dangerouslySetInnerHTML`. Hit = High.
3. **Committed build/env artifacts** — `.env`, `*.pem`, `*.key`, `id_rsa*` in the live release surface = Critical, block.

Auth gaps, unsafe deserialization beyond dynamic execution, and dependency CVEs still require
`cyber-neo` or a project scanner. They are not claimed as mechanically covered here.

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
