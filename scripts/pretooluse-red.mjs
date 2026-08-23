#!/usr/bin/env node
// PreToolUse RED enforcement. A receipt is not a project-wide permission: it is bound to one
// feature, one task and the exact production paths declared for that task.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isContainedProjectPath, isTestPath, normalizeProjectPath, verifyNodeRed } from './verify-red-node.mjs';

export const RECEIPT_DIR = '.vibe/red-receipts';
export const SESSION_PATH = '.vibe/SESSION.md';
export const RECEIPT_TTL_MS = 30 * 60 * 1000;
const FEATURE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TASK = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

function asList(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const normalized = [...new Set(value.map(normalizeProjectPath))];
  return normalized.includes(null) ? null : normalized;
}

function receiptPath(feature, task, cwd = '.') {
  return join(cwd, RECEIPT_DIR, feature, `${task}.json`);
}

function activeFeature(cwd = '.') {
  const session = join(cwd, SESSION_PATH);
  if (!existsSync(session)) return null;
  const match = readFileSync(session, 'utf8').match(/^\*\*Feature slug:\*\*\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/imu);
  return match?.[1] ?? null;
}

function receiptFiles(feature, cwd = '.') {
  const directory = join(cwd, RECEIPT_DIR, feature);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(directory, entry.name));
}

export function receiptValid(receipt, { cwd = '.', feature, now = Date.now() } = {}) {
  if (!receipt || receipt.schema !== 'vcp.red-receipt/v2') return { ok: false, reason: 'unknown or missing receipt schema' };
  if (!FEATURE.test(receipt.feature ?? '') || receipt.feature !== feature) return { ok: false, reason: 'receipt feature does not match active feature' };
  if (!TASK.test(receipt.task ?? '')) return { ok: false, reason: 'receipt task is invalid' };
  const tests = receipt.tests && typeof receipt.tests === 'object' && !Array.isArray(receipt.tests) ? Object.entries(receipt.tests) : [];
  const allowedPaths = asList(receipt.allowed_paths);
  if (tests.length === 0 || !allowedPaths || allowedPaths.some(isTestPath) || allowedPaths.some((path) => !isContainedProjectPath(path, cwd))) return { ok: false, reason: 'receipt has no valid test or production path declarations' };
  if (allowedPaths.some((path) => !/\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql)$/iu.test(path))) {
    return { ok: false, reason: 'receipt declares a non-production allowed path' };
  }
  if (!Number.isFinite(Date.parse(receipt.emitted_at)) || !Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= now) {
    return { ok: false, reason: 'receipt expired or has invalid timestamps' };
  }
  if (!Array.isArray(receipt.red_proofs) || receipt.red_proofs.length !== tests.length || receipt.red_proofs.some((proof) => proof?.command !== 'node --test' || proof?.exit_code === 0 || !/^[0-9a-f]{64}$/u.test(proof?.output_sha256 ?? ''))) {
    return { ok: false, reason: 'receipt has no verified Node-native RED proof for every test' };
  }
  for (const [testPath, expected] of tests) {
    const normalized = normalizeProjectPath(testPath);
    if (!normalized || !isTestPath(normalized) || !isContainedProjectPath(normalized, cwd) || typeof expected !== 'string' || !/^[0-9a-f]{64}$/u.test(expected)) {
      return { ok: false, reason: 'receipt has an invalid test declaration' };
    }
    const file = join(cwd, normalized);
    if (!existsSync(file)) return { ok: false, reason: `test file ${normalized} no longer exists` };
    if (hash(readFileSync(file)) !== expected) return { ok: false, reason: `${normalized} changed since the RED` };
  }
  return { ok: true, allowedPaths };
}

export function decide({ path, receipts, feature, cwd = '.', now = Date.now() }) {
  const normalized = normalizeProjectPath(path);
  if (!normalized) return { allow: false, reason: 'Write/Edit payload has no safe project-relative file_path' };
  if (!isContainedProjectPath(normalized, cwd)) return { allow: false, reason: 'Write/Edit payload resolves outside the project or through a dangling link' };
  if (isTestPath(normalized) || !/\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql)$/iu.test(normalized)) return { allow: true };
  if (!feature) return { allow: false, reason: 'no active feature in .vibe/SESSION.md; cannot select a scoped RED receipt' };
  for (const receipt of receipts) {
    const validation = receiptValid(receipt, { cwd, feature, now });
    if (validation.ok && validation.allowedPaths.includes(normalized)) return { allow: true };
  }
  return { allow: false, reason: `no live scoped RED receipt authorizes ${normalized} for active feature ${feature}` };
}

function readReceipts(feature, cwd = '.') {
  return receiptFiles(feature, cwd).flatMap((file) => {
    try {
      return [JSON.parse(readFileSync(file, 'utf8'))];
    } catch {
      return [];
    }
  });
}

/** Allow unrelated hook events; deny malformed payloads and every unsafe Write/Edit. */
export function asHook(input, cwd = '.', now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.tool_name !== 'string') {
    return deny('malformed PreToolUse payload; fail closed because the target write cannot be identified');
  }
  if (!['Write', 'Edit'].includes(input.tool_name)) return {};
  const feature = activeFeature(cwd);
  const decision = decide({ path: input.tool_input?.file_path, receipts: feature ? readReceipts(feature, cwd) : [], feature, cwd, now });
  return decision.allow ? {} : deny(decision.reason);
}

export function emit({ feature, task, tests, files, command, cwd = '.', now = Date.now(), verify = verifyNodeRed }) {
  if (!FEATURE.test(feature ?? '')) return { ok: false, reason: 'feature must be lowercase-kebab-case' };
  if (!TASK.test(task ?? '')) return { ok: false, reason: 'task must be a safe task identifier' };
  const testPaths = asList(tests);
  const allowedPaths = asList(files);
  if (!testPaths || testPaths.some((path) => !isTestPath(path) || !isContainedProjectPath(path, cwd))) return { ok: false, reason: 'tests must be non-empty project-contained test files' };
  if (!allowedPaths || allowedPaths.some((path) => isTestPath(path) || !isContainedProjectPath(path, cwd) || !/\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql)$/iu.test(path))) {
    return { ok: false, reason: 'files must be non-empty project-relative production-code paths' };
  }
  const sessionFeature = activeFeature(cwd);
  if (sessionFeature !== feature) return { ok: false, reason: 'active .vibe/SESSION.md feature does not match receipt feature' };
  const entries = {};
  const redProofs = [];
  for (const testPath of testPaths) {
    const result = verify({ testPath, command, cwd });
    if (!result.ok) return { ok: false, reason: `RED proof rejected for ${testPath}: ${result.reason}` };
    entries[testPath] = hash(readFileSync(join(cwd, testPath)));
    redProofs.push({ test_path: testPath, command, exit_code: 1, output_sha256: hash(result.output) });
  }
  const emittedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + RECEIPT_TTL_MS).toISOString();
  const receipt = {
    schema: 'vcp.red-receipt/v2', feature, task, emitted_at: emittedAt, expires_at: expiresAt,
    tests: entries, allowed_paths: allowedPaths, red_proofs: redProofs,
  };
  const dest = receiptPath(feature, task, cwd);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify(receipt, null, 2)}\n`);
  return { ok: true, receipt, path: dest };
}

function parseEmitArgs(args) {
  if (args.length !== 11 || args[0] !== 'emit') return null;
  const values = {};
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--feature', '--task', '--tests', '--files', '--command'].includes(flag) || values[flag]) return null;
    values[flag] = args[index + 1];
  }
  return {
    feature: values['--feature'], task: values['--task'],
    tests: values['--tests'].split(',').map((item) => item.trim()).filter(Boolean),
    files: values['--files'].split(',').map((item) => item.trim()).filter(Boolean), command: values['--command'],
  };
}

export function main(args = process.argv.slice(2), cwd = '.') {
  const parsed = parseEmitArgs(args);
  if (parsed) {
    const result = emit({ ...parsed, cwd });
    if (!result.ok) {
      console.error(`REJECTED: ${result.reason}`);
      return 1;
    }
    console.log(`OK: scoped RED receipt written for ${result.receipt.feature}/${result.receipt.task}; expires ${result.receipt.expires_at}.`);
    return 0;
  }
  if (args.length !== 0) {
    console.error('usage: pretooluse-red.mjs emit --feature <slug> --task <id> --tests <a,b> --files <src/a.js,src/b.js> --command "node --test" | <PreToolUse JSON on stdin>');
    return 2;
  }
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    let input = null;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      // The hook still emits a deny object below; malformed payloads never become an allow.
    }
    process.stdout.write(JSON.stringify(asHook(input, cwd)));
  });
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('pretooluse-red.mjs')) {
  const exitCode = main();
  if (exitCode !== null) process.exitCode = exitCode;
}
