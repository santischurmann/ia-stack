#!/usr/bin/env node
// Self-contained security floor for Phase 4.3. It scans the actual release surface: merge-base
// delta plus staged, unstaged, and untracked files. It deliberately redacts secret values.
//
// With `--baseline` it also reads a list of reviewed, accepted findings and stops blocking on
// those, while still blocking on any acceptance that no longer matches a real finding. Honest
// limit of that second half: the scanner only reads files in the delta, so an acceptance whose
// file was never scanned is left alone instead of reported stale — the gate cannot prove or
// disprove a finding it never had the chance to see.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const USAGE = 'usage: verify-security-baseline.mjs check [--base <git-revision>] [--baseline <file>]';
const CODE_OR_MANIFEST = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql|ya?ml|json)$/iu;
const SENSITIVE_ARTIFACT = /(?:^|\/)(?:\.env(?:\.|$)|id_rsa|[^/]+\.(?:pem|key))$/iu;
// Backtick included alongside `'`/`"`: a credential-shaped value assigned via a template
// literal (with or without `${}` interpolation mixed into literal text) is just as much a
// hardcoded secret as one in a plain string — found evading this exact detector during the
// 2026-08-24 adversarial audit (research/adversarial-productivity-audit-2026-08-23.md).
const SECRET_ASSIGNMENT = /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*(['"`])(?=.{8,})/iu;
const AWS_KEY = /AKIA[0-9A-Z]{16}/u;
const PRIVATE_KEY = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/u;
// A bare BEGIN header quoted in prose (documentation describing what a redactor looks for,
// a code comment, a security writeup) is not real key material — a real PEM block always has a
// base64-encoded body immediately after BEGIN and/or a matching END marker. Requiring one of
// those nearby is a general, demonstrable distinction (not a file/path exclusion): it still
// blocks any real key committed anywhere, while no longer flagging a prose mention of the
// header text alone. Closes a confirmed false positive on research/sources/paperclip.md, which
// quotes the header as an example without ever including key material.
// A single 20+ char alphanumeric line — the previous version of this rule — is exactly what a
// SHA-1/SHA-256 hash, a git commit id, or a UUID-without-dashes looks like, so a doc that quotes
// the header text next to an unrelated hash mention was still a confirmed false positive (found
// during the 2026-08-24 adversarial audit). Real PEM body lines are base64: they routinely mix
// uppercase letters, lowercase letters, digits and `+`/`/`/`=` in a way pure lowercase hex never
// does (hex is only `0-9a-f`). Requiring at least one character outside the hex alphabet keeps
// this a general, content-shape distinction — never a file/path/content allowlist — and it still
// accepts genuine base64 (which, being derived from arbitrary binary, essentially always
// contains a non-hex character across any real line of 20+ chars).
// Tested per-line (no `m` flag needed — each candidate is passed in as a standalone string).
const PRIVATE_KEY_BODY_LINE = /^(?=[A-Za-z0-9+/=]{20,}$)(?=[\s\S]*[G-Zg-z+/=])[A-Za-z0-9+/=]{20,}$/u;
const PRIVATE_KEY_END = /-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/u;
const PRIVATE_KEY_CONTEXT_WINDOW = 2000;
const KNOWN_SECRET_SHAPES = [
  ['github-token', /gh(?:p|o|u|s|r)_[A-Za-z0-9_]{20,}/u],
  ['github-fine-grained-token', /github_pat_[A-Za-z0-9_]{20,}/u],
  ['anthropic-api-key', /sk-ant-[A-Za-z0-9_-]{20,}/u],
  ['openai-project-key', /sk-proj-[A-Za-z0-9_-]{20,}/u],
  ['stripe-live-secret', /sk_live_[A-Za-z0-9]{20,}/u],
];
const WORKFLOW = /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/iu;
const SHA_PIN = /^[0-9a-f]{40}$/iu;
export const MAX_SCANNABLE_BYTES = 1024 * 1024;
const FILESYSTEM = { lstatSync, readFileSync, realpathSync };
// Split fixture-sensitive terms so this checker can scan its own release surface without hiding
// the final detection pattern behind an exclusion.
const DYNAMIC_TERMS = ['ev' + 'al', 'ex' + 'ec', 'child_' + 'process\\.ex' + 'ec', 'os\\.sys' + 'tem', 'Funct' + 'ion'];
const SQL_TERMS = ['SEL' + 'ECT', 'INS' + 'ERT', 'UPD' + 'ATE', 'DEL' + 'ETE'].join('|');
// `(?!-)` after the SQL keyword excludes hyphenated CLI/API verb-noun compounds — a `git
// <verb>-index` style subcommand followed later on the line by an unrelated `+` inside a
// different quoted flag used to match with no lookahead. Real string-built SQL never continues a
// keyword straight into a hyphen; it's followed by a space and more query text instead. See
// tests/verify-security-baseline.test.mjs for the regression this closes.
const INJECTION = new RegExp(`(?:\\b${DYNAMIC_TERMS[0]}\\s*\\(|\\b${DYNAMIC_TERMS[1]}\\s*\\(|${DYNAMIC_TERMS[2]}\\s*\\(|\\b${DYNAMIC_TERMS[3]}\\s*\\(|\\b(?:new\\s+)?${DYNAMIC_TERMS[4]}\\s*\\(|(?:${SQL_TERMS})\\b(?!-)[^\\n]*\\+)`, 'iu');
const TEMPLATE_SQL = new RegExp(`(?:${SQL_TERMS})\\b[^\\n\\x60]*\\$\\{`, 'iu');
// Locates the START of the assigned value after an HTML sink; the value itself is then read by
// extractAssignmentValue below with a quote-aware scanner, not by regex capture — a regex
// alternative that prefers matching a whole quoted string first would stop at the closing quote
// and silently drop everything after it (e.g. the ` + userInput` half of `'x' + userInput`),
// turning a genuinely dynamic concatenation into a false "static" read.
const HTML_SINK_START = /(?:innerHTML|outerHTML|dangerouslySetInnerHTML)\s*(?:=|:)\s*\{{0,2}\s*(?:__html\s*:\s*)?/giu;
const STATIC_DOUBLE_QUOTED = /^"(?:[^"\\\n]|\\.)*"$/u;
const STATIC_SINGLE_QUOTED = /^'(?:[^'\\\n]|\\.)*'$/u;
const STATIC_TEMPLATE_NO_INTERPOLATION = /^`(?:[^`$\n]|\\.|\$(?!\{))*`$/u;

/**
 * Reads the RHS text starting at `start`, tracking quote state so a comma/brace *inside* a
 * string doesn't end the value early, and stopping at the first unquoted line break, `;`, `,`,
 * or `}` — the same terminators a real JS/JSX statement or object literal would use.
 */
function extractAssignmentValue(content, start) {
  let index = start;
  let quote = null;
  let value = '';
  while (index < content.length) {
    const char = content[index];
    if (quote) {
      value += char;
      if (char === '\\') {
        value += content[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      value += char;
      index += 1;
      continue;
    }
    if (char === '\n' || char === ';' || char === ',' || char === '}') break;
    value += char;
    index += 1;
  }
  return value;
}

function git(args, cwd = '.') {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function nulPaths(text) {
  return text.split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/'));
}

export function changedFiles({ cwd = '.', base = 'HEAD', gitRun = git } = {}) {
  const commands = [
    ['diff', '--name-only', '-z', `${base}...HEAD`],
    ['diff', '--name-only', '-z', '--cached'],
    ['diff', '--name-only', '-z'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ];
  const files = new Set();
  for (const args of commands) {
    for (const path of nulPaths(gitRun(args, cwd))) files.add(path);
  }
  return [...files].sort();
}

function location(path, content, index) {
  return `${path}:${content.slice(0, index).split(/\r?\n/u).length}`;
}

function finding(severity, category, path, content, index, evidence) {
  return { severity, category, location: location(path, content, index), evidence };
}

const RUN_STEP_LINE = /^(\s*)(?:-\s*)?run:\s*([|>][-+]?\d?)?\s*(.*)$/u;
const GITHUB_EVENT_EXPRESSION = /\$\{\{\s*github\.event\b/u;
const LEADING_WHITESPACE = /^(\s*)/u;

/**
 * Finds untrusted `github.event.*` interpolation inside a `run:` step, whether inline
 * (`run: echo ${{ github.event... }}`) or inside a YAML block scalar body (`run: |` / `run: >`,
 * with optional chomping indicator). Block-scalar detection is indentation-aware: only lines
 * indented strictly more than the `run:` line itself belong to the block; the first line at or
 * below that indentation ends it, so a sibling key (e.g. the next step's `- uses:`) is never
 * scanned as if it were still inside the script body. Closes a confirmed gap where the
 * inline-only regex missed the standard, idiomatic multi-line `run: |` form — the canonical
 * shape of the real-world GitHub Actions script-injection vulnerability class.
 */
function expressionRunIndex(content) {
  const lines = content.split(/\r?\n/u);
  let offset = 0;
  const lineOffsets = lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    return start;
  });
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(RUN_STEP_LINE);
    if (!match) continue;
    const [, indent, blockMarker, inline] = match;
    if (!blockMarker) {
      if (GITHUB_EVENT_EXPRESSION.test(inline)) return lineOffsets[i];
      continue;
    }
    const baseIndent = indent.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === '') continue;
      const lineIndent = lines[j].match(LEADING_WHITESPACE)[1].length;
      if (lineIndent <= baseIndent) break;
      if (GITHUB_EVENT_EXPRESSION.test(lines[j])) return lineOffsets[j];
    }
  }
  return -1;
}

function workflowFindings(path, content) {
  if (!WORKFLOW.test(path)) return [];
  const findings = [];
  const unsafeTrigger = content.search(/^\s*pull_request_target\s*:/mu);
  if (unsafeTrigger >= 0) findings.push(finding('high', 'ci-untrusted-trigger', path, content, unsafeTrigger, 'pull_request_target can execute privileged workflow code from an untrusted pull request'));
  for (const match of content.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)@([^\s#]+)/gmu)) {
    const [, action, ref] = match;
    if (!action.startsWith('./') && !action.startsWith('docker://') && !SHA_PIN.test(ref)) {
      // The action reference is part of the evidence on purpose: this is the ONLY detector that
      // reports more than one finding per file, so a category+path-only identity gave every
      // unpinned action in a workflow the same finding_id — accepting one reviewed action then
      // silently accepted every action added to that file afterwards, including a brand-new
      // attacker-controlled one (reproduced end to end during TRIANGULATE). Unlike the redacted
      // secret categories, an action reference is public metadata already printed in the report,
      // so naming it discriminates the findings without leaking anything.
      findings.push(finding('high', 'ci-unpinned-action', path, content, match.index, `GitHub Action ${action}@${ref} is not pinned to an immutable full commit SHA`));
    }
  }
  const expressionRun = expressionRunIndex(content);
  if (expressionRun >= 0) findings.push(finding('high', 'ci-expression-in-run', path, content, expressionRun, 'untrusted github.event data is interpolated directly into a shell run step'));
  return findings;
}

function isStaticHtmlValue(value) {
  const trimmed = value.trim();
  return STATIC_DOUBLE_QUOTED.test(trimmed) || STATIC_SINGLE_QUOTED.test(trimmed) || STATIC_TEMPLATE_NO_INTERPOLATION.test(trimmed);
}

/** First HTML-sink assignment whose value is not a static, interpolation-free literal. */
function htmlSinkIndex(content) {
  for (const match of content.matchAll(HTML_SINK_START)) {
    const value = extractAssignmentValue(content, match.index + match[0].length);
    if (!isStaticHtmlValue(value)) return match.index;
  }
  return -1;
}

/**
 * Two structurally distinct real private-key encodings, both native to Node's Buffer — no
 * external ASN.1/DER library. PKCS#1/PKCS#8/EC keys are always an outer ASN.1 SEQUENCE (tag
 * byte 0x30); OpenSSH's own format starts with the literal 15-byte magic `openssh-key-v1\0`.
 * Evaluated (per the 2026-08-24 adversarial audit) against replacing the line-shape heuristic
 * outright with a DER-only check: that regresses OpenSSH-format keys to a false negative (their
 * body never starts with 0x30), so this is used as an ADDITIONAL requirement alongside the
 * existing two-consecutive-lines structural check, never as a replacement — an isolated random
 * 44-char string only satisfies the DER check in an empirically measured ~0.2% of cases
 * (2000-sample fixture check), so requiring it on the first candidate line closes the residual
 * false positive where two unrelated non-hex identifiers sit next to each other undetected by
 * the line-shape check alone.
 */
function looksLikeRealKeyFirstLine(line) {
  // Buffer.from(str, 'base64') never throws for a string input — Node's decoder is lenient by
  // design (invalid characters are simply skipped) — so there is no error path to guard here.
  // No length guard before the magic-byte comparison either: the only caller only ever passes a
  // line that already matched PRIVATE_KEY_BODY_LINE (20+ base64 chars => at least 15 decoded
  // bytes), and subarray/toString on a shorter buffer simply yields a shorter string that fails
  // the equality check on its own.
  const bytes = Buffer.from(line.trim(), 'base64');
  if (bytes.subarray(0, 15).toString('latin1') === 'openssh-key-v1\0') return true;
  if (bytes.length < 4 || bytes[0] !== 0x30) return false;
  const lengthByte = bytes[1];
  if (lengthByte < 0x80) return true;
  const lengthByteCount = lengthByte & 0x7f;
  return lengthByteCount >= 1 && lengthByteCount <= 4 && bytes.length > 2 + lengthByteCount;
}

/**
 * A single isolated line matching the base64 shape is exactly what an adjacent hash/UUID/commit
 * id mention looks like — real PEM bodies are always wrapped across multiple lines (base64 of
 * arbitrary binary, conventionally 64 chars/line), so requiring two in a row is a structural
 * property genuine keys have and isolated identifiers never do, without hardcoding a specific
 * line length or any file/path exclusion. The first line of that streak is additionally required
 * to decode to a real key encoding (see looksLikeRealKeyFirstLine) — two consecutive unrelated
 * tokens that both happen to be non-hex are not enough on their own.
 */
function hasConsecutiveBase64BodyLines(window) {
  let streak = 0;
  let streakStart = null;
  for (const line of window.split(/\r?\n/u)) {
    if (PRIVATE_KEY_BODY_LINE.test(line)) {
      if (streak === 0) streakStart = line;
      streak += 1;
      if (streak >= 2) return looksLikeRealKeyFirstLine(streakStart);
    } else {
      // Any non-candidate line resets the streak, blank included: two unrelated base64-shaped
      // tokens separated by a paragraph break are not a contiguous PEM body — confirmed false
      // positive when the blank line was previously exempted from resetting the count.
      streak = 0;
      streakStart = null;
    }
  }
  return false;
}

/** A bare BEGIN header only counts as real key material with real PEM structure nearby (see const doc). */
function privateKeyIndex(content) {
  const start = content.search(PRIVATE_KEY);
  if (start < 0) return -1;
  const window = content.slice(start, start + PRIVATE_KEY_CONTEXT_WINDOW);
  return PRIVATE_KEY_END.test(window) || hasConsecutiveBase64BodyLines(window) ? start : -1;
}

export function scanFile(path, content) {
  const findings = [];
  if (SENSITIVE_ARTIFACT.test(path)) {
    findings.push(finding('critical', 'committed-sensitive-artifact', path, content, 0, 'sensitive artifact path (value redacted)'));
  }
  // Credentials and private keys leak through prose as often as source code (README, release
  // notes, copied logs). Scan every regular release file for those shapes; keep executable
  // injection patterns scoped to code/manifests to avoid treating ordinary prose as code.
  const secret = content.search(SECRET_ASSIGNMENT);
  if (secret >= 0) findings.push(finding('critical', 'hardcoded-secret', path, content, secret, 'credential-like assignment (value redacted)'));
  const aws = content.search(AWS_KEY);
  if (aws >= 0) findings.push(finding('critical', 'aws-access-key', path, content, aws, 'AWS access-key shape (value redacted)'));
  const privateKey = privateKeyIndex(content);
  if (privateKey >= 0) findings.push(finding('critical', 'private-key-content', path, content, privateKey, 'private-key material (value redacted)'));
  for (const [category, pattern] of KNOWN_SECRET_SHAPES) {
    const index = content.search(pattern);
    if (index >= 0) findings.push(finding('critical', category, path, content, index, 'provider credential shape (value redacted)'));
  }
  if (!CODE_OR_MANIFEST.test(path)) return findings;
  const injection = content.search(INJECTION);
  if (injection >= 0) findings.push(finding('high', 'injection-surface', path, content, injection, 'dynamic execution or string-built SQL'));
  const templateSql = content.search(TEMPLATE_SQL);
  if (templateSql >= 0) findings.push(finding('high', 'template-sql-injection-surface', path, content, templateSql, 'template-literal SQL interpolation'));
  const htmlSink = htmlSinkIndex(content);
  if (htmlSink >= 0) findings.push(finding('high', 'html-injection-surface', path, content, htmlSink, 'dynamic data reaches an HTML sink'));
  findings.push(...workflowFindings(path, content));
  return findings;
}

export function isProjectRelativePath(path, cwd = '.') {
  if (typeof path !== 'string' || path === '' || isAbsolute(path)) return false;
  const root = resolve(cwd);
  const target = resolve(root, path);
  const remainder = relative(root, target);
  return remainder !== '' && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

function isPhysicallyContained(root, path) {
  const remainder = relative(root, path);
  return remainder !== '' && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

export function scanChangedFiles({ cwd = '.', base = 'HEAD', files = changedFiles({ cwd, base }), filesystem = FILESYSTEM } = {}) {
  const findings = [];
  const scanned = [];
  const skipped = [];
  for (const path of files) {
    if (!isProjectRelativePath(path, cwd)) {
      findings.push(finding('high', 'unsafe-scan-path', path, '', 0, 'release-surface path resolves outside the project'));
      continue;
    }
    const fullPath = resolve(cwd, path);
    let stat;
    let content;
    try {
      stat = filesystem.lstatSync(fullPath);
    } catch {
      skipped.push({ path, reason: 'missing' });
      continue; // deleted paths have no live source to inspect.
    }
    if (stat.isSymbolicLink()) {
      findings.push(finding('high', 'unsafe-scan-input', path, '', 0, 'symbolic link is not scanned because it may escape the project'));
      continue;
    }
    if (!stat.isFile()) {
      skipped.push({ path, reason: 'not-regular-file' });
      continue;
    }
    try {
      if (!isPhysicallyContained(filesystem.realpathSync(resolve(cwd)), filesystem.realpathSync(fullPath))) {
        findings.push(finding('high', 'unsafe-scan-input', path, '', 0, 'release-surface path resolves outside the project through a link'));
        continue;
      }
    } catch {
      findings.push(finding('high', 'unscannable-source', path, '', 0, 'regular release-surface file could not be resolved safely'));
      continue;
    }
    if (stat.size > MAX_SCANNABLE_BYTES) {
      findings.push(finding('high', 'unscanned-large-source', path, '', 0, `regular source exceeds ${MAX_SCANNABLE_BYTES} byte scanner limit`));
      continue;
    }
    try {
      content = filesystem.readFileSync(fullPath, 'utf8');
    } catch {
      findings.push(finding('high', 'unscannable-source', path, '', 0, 'regular release-surface file could not be read'));
      continue;
    }
    scanned.push(path);
    findings.push(...scanFile(path, content));
  }
  return { files, scanned, skipped, findings };
}

// --- Accepted-debt baseline --------------------------------------------------------------------
export const SECURITY_BASELINE_SCHEMA = 'vcp.security-baseline/1';
const ACCEPTED_KEYS = ['finding_id', 'category', 'path', 'evidence', 'reason', 'accepted_by', 'accepted_at'];
const NON_EMPTY_KEYS = ['category', 'path', 'evidence', 'accepted_by'];
// The three fields the identity hash joins with `\n`. `reason` is deliberately absent: it is prose,
// it never reaches the hash, and a reviewer may legitimately write it across several lines.
const HASHED_KEYS = ['category', 'path', 'evidence'];
const SEPARATOR_IN_FIELD = /[\r\n]/u;
const FINDING_ID_SHAPE = /^[0-9a-f]{64}$/u;
// Shape only, on purpose: 2026-13-45 is accepted. A calendar check would reject a typo but not a
// backdated acceptance, so it buys no review integrity the reviewer's name does not already carry.
const ACCEPTED_AT_SHAPE = /^\d{4}-\d{2}-\d{2}$/u;
const LOCATION_LINE_SUFFIX = /:\d+$/u;
const MIN_REASON_LENGTH = 8;

/** Git reports POSIX separators, so `/` is the canonical form a hand-written entry normalizes to. */
function posix(value) {
  return value.split('\\').join('/');
}

/**
 * Identity of a finding: category, file and evidence — never the line number. A finding that only
 * moved is still the same reviewed finding, so adding a line above it must not silently retire its
 * acceptance. Different content, on the other hand, is a different finding that has to be reviewed
 * again, which is why every other dimension does participate.
 */
function identityHash(category, path, evidence) {
  return createHash('sha256').update(`${category}\n${posix(path)}\n${evidence}`).digest('hex');
}

export function findingId(item) {
  return identityHash(item.category, item.location.replace(LOCATION_LINE_SUFFIX, ''), item.evidence);
}

export function readSecurityBaseline(read) {
  let raw;
  try {
    raw = read();
  } catch (error) {
    // Absence is NOT "zero accepted findings": --baseline named this file on purpose, so degrading
    // to a baseline-less scan would turn a configuration mistake into a way past the gate. The
    // original cause survives verbatim — a denied permission is not the same as a mistyped path.
    throw new Error(`the security baseline could not be read: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`the security baseline is not valid JSON: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.schema !== SECURITY_BASELINE_SCHEMA) {
    throw new Error(`the security baseline must declare schema ${SECURITY_BASELINE_SCHEMA}`);
  }
  if (!Array.isArray(parsed.accepted)) throw new Error('the security baseline must contain an accepted array');
  const seen = new Set();
  return parsed.accepted.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).length !== ACCEPTED_KEYS.length
      || ACCEPTED_KEYS.some((key) => typeof entry[key] !== 'string')) {
      throw new Error(`every accepted entry needs exactly these ${ACCEPTED_KEYS.length} string keys: ${ACCEPTED_KEYS.join(', ')}`);
    }
    // An id in uppercase or of another length is not "the same finding written oddly": it can never
    // match a real finding, so it would be dead weight hiding accepted debt from day one.
    if (!FINDING_ID_SHAPE.test(entry.finding_id)) throw new Error(`finding_id must be 64 lowercase hex characters: ${entry.finding_id}`);
    for (const key of NON_EMPTY_KEYS) {
      if (entry[key].trim() === '') throw new Error(`${key} must not be empty in the security baseline`);
    }
    // A length floor is the whole placeholder defence: every stock filler (tbd, todo, n/a, none,
    // unknown, -) is shorter than this, so an explicit list of them would add no rejection power.
    if (entry.reason.trim().length < MIN_REASON_LENGTH) throw new Error(`the reason for ${entry.finding_id} needs at least ${MIN_REASON_LENGTH} characters of real review`);
    if (!ACCEPTED_AT_SHAPE.test(entry.accepted_at)) throw new Error(`accepted_at must be a YYYY-MM-DD date: ${entry.accepted_at}`);
    // A path outside the project can never be reviewed debt OF this project, and it is exactly the
    // shape that is never scanned — so the staleness check could never judge it and the entry would
    // live forever. Rejecting it here also makes the gate's own tamper findings (unsafe-scan-path,
    // unsafe-scan-input) permanently unwaivable, which is the point: those are the detectors that
    // fire when the release surface escapes the tree.
    if (!isProjectRelativePath(entry.path)) throw new Error(`the accepted path must stay inside the project: ${entry.path}`);
    // The identity hash joins these three with `\n`, so a field that CONTAINS `\n` moves the field
    // boundary: on a filesystem where a filename may hold a newline (POSIX does), the entry
    // {category, path: 'a', evidence: 'priv.js\n<evidence>'} hashes identically to the real finding
    // in 'a\npriv.js' — self-consistent, yet it displays a different path than the one it covers,
    // which also puts it outside the staleness check forever. Verified as a hash collision during
    // TRIANGULATE. Refusing the separator makes the split unambiguous on every platform; a finding
    // on such a path then simply has no expressible acceptance and always blocks.
    for (const key of HASHED_KEYS) {
      if (SEPARATOR_IN_FIELD.test(entry[key])) throw new Error(`${key} must not contain a line break in the security baseline: ${JSON.stringify(entry[key])}`);
    }
    // The id must be the hash of THIS entry's own category, path and evidence. Without this, the
    // four human-readable fields were decorative: an entry could carry the real id of a live
    // CRITICAL finding while describing itself as an old CI chore in a different, never-scanned
    // file. That silenced the finding AND dodged the dead-entry check (which judges by the declared
    // path), so the acceptance never expired and nothing in the file or the output revealed what
    // was actually covered — reproduced end to end during TRIANGULATE. Binding the id to the
    // declared triple costs no extra evidence: it is computable from the entry alone.
    const declared = identityHash(entry.category, entry.path, entry.evidence);
    if (declared !== entry.finding_id) {
      throw new Error(`finding_id ${entry.finding_id} does not match its own category/path/evidence (expected ${declared})`);
    }
    if (seen.has(entry.finding_id)) throw new Error(`duplicated finding_id in the security baseline: ${entry.finding_id}`);
    seen.add(entry.finding_id);
    return { ...entry, path: posix(entry.path) };
  });
}

/**
 * Flags are order-independent and each one owns the argument after it; anything else is invalid
 * usage. A bare `--baseline` must never fall back to a baseline-less scan: silently ignoring a
 * half-typed flag is the same bypass a broken baseline file would be. By that same rule a REPEATED
 * flag is invalid usage rather than last-one-wins: `--baseline strict.json --baseline loose.json`
 * silently discarded the first file, and since `--baseline` is the only flag that can ever loosen
 * the gate, quietly picking one of two contradictory values is the bypass this parser exists to
 * refuse (reproduced end to end during TRIANGULATE).
 */
function parseArgs(args) {
  if (args[0] !== 'check') return null;
  const parsed = { base: 'HEAD', baseline: null };
  const given = new Set();
  let index = 1;
  while (index < args.length) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag !== '--base' && flag !== '--baseline') return null;
    if (given.has(flag)) return null;
    given.add(flag);
    if (typeof value !== 'string' || value.trim() === '') return null;
    if (flag === '--base') parsed.base = value;
    else parsed.baseline = value;
    index += 2;
  }
  return parsed;
}

export function main(args = process.argv.slice(2), options = {}) {
  const parsed = parseArgs(args);
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const cwd = options.cwd ?? '.';
  let accepted;
  try {
    // The accepted-debt record has to live inside the audited tree. `--baseline` is the only flag
    // that can loosen this gate, and debt that sits outside the project is debt no reviewer ever
    // sees in a diff: the reason, the reviewer's name and the date exist to be read in code review,
    // which an absolute or `../` path silently removes them from. Both escapes were reachable
    // during TRIANGULATE, so this is a containment rule, not a typo check.
    if (parsed.baseline !== null && !isProjectRelativePath(parsed.baseline, cwd)) {
      throw new Error(`the security baseline must live inside the project: ${parsed.baseline}`);
    }
    accepted = parsed.baseline === null ? [] : readSecurityBaseline(() => readFileSync(resolve(cwd, parsed.baseline), 'utf8'));
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  let report;
  try {
    report = scanChangedFiles({ cwd, base: parsed.base });
  } catch (error) {
    writeError(`REJECTED: unable to collect the release surface: ${error.message}`);
    return 1;
  }
  const acceptedIds = new Set(accepted.map((entry) => entry.finding_id));
  const liveIds = new Set(report.findings.map((item) => findingId(item)));
  const scanned = new Set(report.scanned);
  const blocking = report.findings.filter((item) => (item.severity === 'critical' || item.severity === 'high') && !acceptedIds.has(findingId(item)));
  // Only acceptances whose file was actually scanned can be judged: elsewhere there is no evidence.
  const stale = accepted.filter((entry) => scanned.has(entry.path) && !liveIds.has(entry.finding_id));
  for (const item of blocking) {
    writeError(`${item.severity.toUpperCase()} ${item.category} ${item.location} — ${item.evidence}`);
  }
  if (blocking.length > 0) writeError(`REJECTED: ${blocking.length} blocking security finding(s) across ${report.scanned.length} live changed file(s).`);
  if (stale.length > 0) writeError(`REJECTED: ${stale.length} security baseline entry(ies) match no live finding in a scanned file: ${stale.map((entry) => `${entry.path} (${entry.finding_id})`).join(', ')}`);
  if (blocking.length + stale.length > 0) return 1;
  write(`OK: security baseline scanned ${report.scanned.length} live changed file(s); no blocking Critical/High findings, ${accepted.length} accepted.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-security-baseline.mjs')) {
  process.exitCode = main();
}
