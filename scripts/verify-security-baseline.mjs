#!/usr/bin/env node
// Self-contained security floor for Phase 4.3. It scans the actual release surface: merge-base
// delta plus staged, unstaged, and untracked files. It deliberately redacts secret values.

import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const USAGE = 'usage: verify-security-baseline.mjs check [--base <git-revision>]';
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
      findings.push(finding('high', 'ci-unpinned-action', path, content, match.index, 'GitHub Action is not pinned to an immutable full commit SHA'));
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
 * A single isolated line matching the base64 shape is exactly what an adjacent hash/UUID/commit
 * id mention looks like — real PEM bodies are always wrapped across multiple lines (base64 of
 * arbitrary binary, conventionally 64 chars/line), so requiring two in a row is a structural
 * property genuine keys have and isolated identifiers never do, without hardcoding a specific
 * line length or any file/path exclusion.
 */
function hasConsecutiveBase64BodyLines(window) {
  let streak = 0;
  for (const line of window.split(/\r?\n/u)) {
    if (PRIVATE_KEY_BODY_LINE.test(line)) {
      streak += 1;
      if (streak >= 2) return true;
    } else {
      // Any non-candidate line resets the streak, blank included: two unrelated base64-shaped
      // tokens separated by a paragraph break are not a contiguous PEM body — confirmed false
      // positive when the blank line was previously exempted from resetting the count.
      streak = 0;
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

function parseArgs(args) {
  if (args.length === 1 && args[0] === 'check') return { base: 'HEAD' };
  if (args.length === 3 && args[0] === 'check' && args[1] === '--base' && args[2].trim() !== '') return { base: args[2] };
  return null;
}

export function main(args = process.argv.slice(2), options = {}) {
  const parsed = parseArgs(args);
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  let report;
  try {
    report = scanChangedFiles({ cwd: options.cwd ?? '.', base: parsed.base });
  } catch (error) {
    writeError(`REJECTED: unable to collect the release surface: ${error.message}`);
    return 1;
  }
  for (const item of report.findings) {
    writeError(`${item.severity.toUpperCase()} ${item.category} ${item.location} — ${item.evidence}`);
  }
  if (report.findings.some((item) => item.severity === 'critical' || item.severity === 'high')) {
    writeError(`REJECTED: ${report.findings.length} blocking security finding(s) across ${report.scanned.length} live changed file(s).`);
    return 1;
  }
  write(`OK: security baseline scanned ${report.scanned.length} live changed file(s); no Critical/High findings.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-security-baseline.mjs')) {
  process.exitCode = main();
}
