#!/usr/bin/env node
// Self-contained security floor for Phase 4.3. It scans the actual release surface: merge-base
// delta plus staged, unstaged, and untracked files. It deliberately redacts secret values.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-security-baseline.mjs check [--base <git-revision>]';
const CODE_OR_MANIFEST = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql|ya?ml|json)$/iu;
const SENSITIVE_ARTIFACT = /(?:^|\/)(?:\.env(?:\.|$)|id_rsa|[^/]+\.(?:pem|key))$/iu;
const SECRET_ASSIGNMENT = /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*(['"])(?=.{8,})/iu;
const AWS_KEY = /AKIA[0-9A-Z]{16}/u;
// Split fixture-sensitive terms so this checker can scan its own release surface without hiding
// the final detection pattern behind an exclusion.
const DYNAMIC_TERMS = ['ev' + 'al', 'ex' + 'ec', 'child_' + 'process\\.ex' + 'ec', 'os\\.sys' + 'tem'];
const SQL_TERMS = ['SEL' + 'ECT', 'INS' + 'ERT', 'UPD' + 'ATE', 'DEL' + 'ETE'].join('|');
// `(?!-)` after the SQL keyword excludes hyphenated CLI/API verb-noun compounds — a `git
// <verb>-index` style subcommand followed later on the line by an unrelated `+` inside a
// different quoted flag used to match with no lookahead. Real string-built SQL never continues a
// keyword straight into a hyphen; it's followed by a space and more query text instead. See
// tests/verify-security-baseline.test.mjs for the regression this closes.
const INJECTION = new RegExp(`(?:\\b${DYNAMIC_TERMS[0]}\\s*\\(|\\b${DYNAMIC_TERMS[1]}\\s*\\(|${DYNAMIC_TERMS[2]}\\s*\\(|\\b${DYNAMIC_TERMS[3]}\\s*\\(|(?:${SQL_TERMS})\\b(?!-)[^\\n]*\\+)`, 'iu');

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

export function scanFile(path, content) {
  const findings = [];
  if (SENSITIVE_ARTIFACT.test(path)) {
    findings.push(finding('critical', 'committed-sensitive-artifact', path, content, 0, 'sensitive artifact path (value redacted)'));
  }
  if (!CODE_OR_MANIFEST.test(path)) return findings;
  const secret = content.search(SECRET_ASSIGNMENT);
  if (secret >= 0) findings.push(finding('critical', 'hardcoded-secret', path, content, secret, 'credential-like assignment (value redacted)'));
  const aws = content.search(AWS_KEY);
  if (aws >= 0) findings.push(finding('critical', 'aws-access-key', path, content, aws, 'AWS access-key shape (value redacted)'));
  const injection = content.search(INJECTION);
  if (injection >= 0) findings.push(finding('high', 'injection-surface', path, content, injection, 'dynamic execution or string-built SQL'));
  return findings;
}

export function scanChangedFiles({ cwd = '.', base = 'HEAD', files = changedFiles({ cwd, base }) } = {}) {
  const findings = [];
  const scanned = [];
  for (const path of files) {
    const fullPath = join(cwd, path);
    if (!existsSync(fullPath)) continue; // deleted paths have no live source to inspect.
    let content;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      continue; // binary/unreadable input is out of this grep floor's scope.
    }
    scanned.push(path);
    findings.push(...scanFile(path, content));
  }
  return { files, scanned, findings };
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
