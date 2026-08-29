#!/usr/bin/env node
// PreToolUse guard for Write/Edit. NOT a trust anchor and NOT proof of provenance: a receipt is
// a contextual, human-reviewable record that its declared test(s) hashed to something and some
// `node --test` run exited non-zero at emit() time — nothing here cryptographically ties a
// receipt on disk to an actual invocation of emit(). Confirmed by falsification: on the same
// filesystem Bash can write, a hand-crafted receipt with correct schema, correct test hash,
// correct feature/task, and TTL math consistent with RECEIPT_TTL_MS authorizes a production
// Write with no RED ever having run (research/adversarial-productivity-audit-2026-08-23.md).
// This module still blocks that same forged receipt from being written THROUGH Write/Edit
// itself, and still requires a shape-valid, hash-matching, TTL-consistent receipt before
// authorizing any other Write/Edit — that is useful friction against accidental/careless misuse,
// not a security boundary against a deliberately adversarial agent with Bash access.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { isContainedProjectPath, isTestPath, normalizeProjectPath, verifyNodeRed } from './verify-red-node.mjs';

export const RECEIPT_DIR = '.vibe/red-receipts';
const RECEIPT_TREE = `${RECEIPT_DIR}/`;
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

// Extensiones que el hard gate RED cubre. Estaba repetida tres veces y le faltaban lenguajes
// enteros: .sh, .ps1, .c, .cpp, .h, .vue, .svelte, .tf y .html pasaban SIN receipt RED y sin decir
// nada. Reproducido el 2026-08-28: doce rutas permitidas, tres denegadas.
// LIMITE HONESTO: sigue siendo una lista, no una regla. Un lenguaje que no este aca no queda
// cubierto, y la unica senal de eso es esta constante -por eso se exporta, para poder leerla-.
export const RED_GATED_EXTENSIONS = Object.freeze([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'rb', 'php', 'cs', 'kt',
  'swift', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'c', 'cpp', 'cc', 'h', 'hpp', 'vue',
  'svelte', 'tf', 'html', 'scala', 'ex', 'exs', 'lua', 'pl', 'r', 'm', 'mm',
]);
const RED_GATED = new RegExp(`\.(?:${RED_GATED_EXTENSIONS.join('|')})$`, 'iu');

export function receiptValid(receipt, { cwd = '.', feature, now = Date.now() } = {}) {
  if (!receipt || receipt.schema !== 'vcp.red-receipt/v2') return { ok: false, reason: 'unknown or missing receipt schema' };
  if (!FEATURE.test(receipt.feature ?? '') || receipt.feature !== feature) return { ok: false, reason: 'receipt feature does not match active feature' };
  if (!TASK.test(receipt.task ?? '')) return { ok: false, reason: 'receipt task is invalid' };
  const tests = receipt.tests && typeof receipt.tests === 'object' && !Array.isArray(receipt.tests) ? Object.entries(receipt.tests) : [];
  const allowedPaths = asList(receipt.allowed_paths);
  if (tests.length === 0 || !allowedPaths || allowedPaths.some(isTestPath) || allowedPaths.some((path) => !isContainedProjectPath(path, cwd))) return { ok: false, reason: 'receipt has no valid test or production path declarations' };
  if (allowedPaths.some((path) => !RED_GATED.test(path))) {
    return { ok: false, reason: 'receipt declares a non-production allowed path' };
  }
  const emittedAt = Date.parse(receipt.emitted_at);
  const expiresAt = Date.parse(receipt.expires_at);
  // expires_at is recomputed from emitted_at, never trusted verbatim: a receipt whose two
  // timestamps are internally inconsistent with RECEIPT_TTL_MS is rejected. This narrows the
  // TTL window a forger has to hit; it does not establish who or what wrote emitted_at.
  if (!Number.isFinite(emittedAt) || !Number.isFinite(expiresAt) || expiresAt !== emittedAt + RECEIPT_TTL_MS) {
    return { ok: false, reason: 'receipt expiry does not match the fixed TTL computed from its own emission time' };
  }
  if (emittedAt > now) return { ok: false, reason: 'receipt was emitted in the future' };
  if (expiresAt <= now) return { ok: false, reason: 'receipt expired or has invalid timestamps' };
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

/** Claude Code manda `file_path` ABSOLUTO. normalizeProjectPath rechaza todo path absoluto para
 * frenar traversal, asi que sin esto el hook denegaba TODA escritura real: reproducido el
 * 2026-08-28. Se relativiza contra el proyecto primero; lo que quede fuera sigue cayendo en null
 * y despues en isContainedProjectPath, que es la comprobacion que de verdad protege. */
export function toProjectRelative(path, cwd = '.') {
  if (typeof path !== 'string') return path;
  let raiz;
  let absoluto;
  try {
    raiz = realpathSync(resolve(cwd));
    absoluto = resolve(raiz, path);
  } catch {
    return path;
  }
  const dentro = relative(raiz, absoluto);
  if (dentro === '' || dentro.startsWith('..') || isAbsolute(dentro)) return path;
  return dentro;
}

export function decide({ path, receipts, feature, cwd = '.', now = Date.now() }) {
  const normalized = normalizeProjectPath(toProjectRelative(path, cwd));
  if (!normalized) return { allow: false, reason: 'Write/Edit payload has no safe project-relative file_path' };
  if (!isContainedProjectPath(normalized, cwd)) return { allow: false, reason: 'Write/Edit payload resolves outside the project or through a dangling link' };
  // Blocking Write/Edit on the receipt tree is friction against an accidental or careless
  // in-band write, not a provenance guarantee: this hook only ever sees Write/Edit tool calls,
  // so a receipt written through Bash (or any channel other than Write/Edit) lands on disk
  // untouched by this check and is then judged by receiptValid() on shape alone — see the module
  // header comment and README.md "Gates que sí son código" for the documented, falsified limit.
  // This check still runs before the extension allowlist below, so a receipt's .json extension
  // doesn't quietly fall through as an unguarded file type for the one channel this hook does see.
  if (normalized.startsWith(RECEIPT_TREE)) return { allow: false, reason: 'writing directly to the receipt tree via Write/Edit is blocked; use pretooluse-red.mjs emit' };
  if (isTestPath(normalized) || !RED_GATED.test(normalized)) return { allow: true };
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
  if (!allowedPaths || allowedPaths.some((path) => isTestPath(path) || !isContainedProjectPath(path, cwd) || !RED_GATED.test(path))) {
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
