#!/usr/bin/env node
// Native, closed-world verifier for the test evidence attached to active Discovery requirements.
// It accepts only project-local test files and runs each file independently with Node TAP. It
// proves path, declaration, isolated execution and exact TAP metadata; it does not prove that a
// test's semantic assertion is sufficient for the requirement's natural-language rule.

import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const TAP_TIMEOUT_MS = 30_000;
export const USAGE = 'usage: verify-test-bindings.mjs check';

function failed(code, message = code) {
  return { ok: false, code, message };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

// The static declaration check deliberately ignores comments and quoted strings. It is not a JS
// parser; it only proves the narrow convention VCP relies on: a literal test()/it() call with the
// exact declared title, not a REQ-ID pasted in a comment or in unrelated prose.
export function hasLiteralTestDeclaration(source, testName) {
  const expected = new RegExp(`^(?:test|it)(?:\\.(?:skip|todo))?\\s*\\(\\s*(['\"])${escapeRegex(testName)}\\1`, 'u');
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      i = end === -1 ? source.length : end + 1;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
    } else if (source[i] === "'" || source[i] === '"' || source[i] === '`') {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === '\\') i += 2;
        else if (source[i++] === quote) break;
      }
    } else {
      const candidate = source.slice(i);
      if ((i === 0 || !/[A-Za-z0-9_$]/u.test(source[i - 1])) && expected.test(candidate)) return true;
      i++;
    }
  }
  return false;
}

export function validateTestReference(testRef, cwd) {
  if (typeof testRef !== 'string' || !/^tests\/[A-Za-z0-9._/-]+\.test\.mjs$/u.test(testRef) || testRef.includes('..') || testRef.includes('\\')) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref must be a canonical tests/*.test.mjs path');
  }
  try {
    const root = realpathSync(cwd);
    const file = resolve(root, testRef);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref must be a regular non-symlink file');
    realpathSync(file); // The strict lexical tests/* contract above prevents traversal; this catches broken reparse points.
    return { ok: true, file };
  } catch (error) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', `test_ref is unreadable: ${error.message}`);
  }
}

export function parseTapResults(stdout) {
  return stdout.split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^(not )?ok \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/u);
    if (!match) return [];
    return [{ name: match[2], ok: !match[1], skipped: Boolean(match[3]) }];
  });
}

export function checkTestBinding(row, cwd, { spawn = spawnSync } = {}) {
  if (!row || typeof row !== 'object' || typeof row.req_id !== 'string' || typeof row.test_name !== 'string' || !row.test_name.startsWith(`${row.req_id} · `)) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_name must start with its req_id and a middle-dot separator');
  }
  const reference = validateTestReference(row.test_ref, cwd);
  if (!reference.ok) return reference;
  const source = readFileSync(reference.file, 'utf8');
  if (!hasLiteralTestDeclaration(source, row.test_name)) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref has no literal test()/it() declaration with the exact test_name');
  }
  const result = spawn(process.execPath, ['--test', '--test-reporter=tap', row.test_ref], {
    cwd,
    encoding: 'utf8',
    timeout: TAP_TIMEOUT_MS,
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return failed('DISCOVERY_TEST_BINDING_TIMEOUT', `test_ref exceeded ${TAP_TIMEOUT_MS}ms`);
  }
  if (result.error || result.status !== 0) {
    return failed('DISCOVERY_TEST_BINDING_FAILED', `test_ref did not exit cleanly: ${result.error?.message ?? `exit ${result.status}`}`);
  }
  const matched = parseTapResults(result.stdout ?? '').filter((item) => item.name === row.test_name);
  if (matched.length === 0) return failed('DISCOVERY_TEST_BINDING_MISSING', 'exact test_name is absent from stdout TAP');
  if (matched.length > 1) return failed('DISCOVERY_TEST_BINDING_DUPLICATE_RESULT', 'exact test_name appears more than once in stdout TAP');
  if (!matched[0].ok) return failed('DISCOVERY_TEST_BINDING_FAILED', 'exact test_name did not pass in stdout TAP');
  if (matched[0].skipped) return failed('DISCOVERY_TEST_BINDING_SKIPPED', 'exact test_name is marked SKIP or TODO');
  return { ok: true };
}

export function checkActiveBindings(rows, cwd, { check = checkTestBinding } = {}) {
  if (!Array.isArray(rows)) return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'requirements must be an array');
  const active = rows.filter((row) => row?.status === 'active');
  const names = new Set();
  for (const row of active) {
    if (names.has(row.test_name)) return failed('DISCOVERY_TEST_BINDING_DUPLICATE', `test_name is shared by active requirements: ${row.test_name}`);
    names.add(row.test_name);
  }
  for (const row of active) {
    const result = check(row, cwd);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function defaultReadInventory(runtimeRoot) {
  return JSON.parse(readFileSync(resolve(runtimeRoot, 'contracts/discovery-requirements.json'), 'utf8'));
}

export function main(args = process.argv.slice(2), cwd = '.', dependencies = {}, write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  try {
    const runtimeRoot = dependencies.runtimeRoot ?? RUNTIME_ROOT;
    const inventory = (dependencies.readInventory ?? defaultReadInventory)(runtimeRoot);
    const result = checkActiveBindings(inventory.requirements, runtimeRoot, { check: dependencies.check ?? checkTestBinding });
    if (!result.ok) {
      writeError(`REJECTED: ${result.code}: ${result.message}`);
      return 1;
    }
    const activeCount = inventory.requirements.filter((row) => row.status === 'active').length;
    write(`OK: ${activeCount} active Discovery test binding(s) pass now.`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: DISCOVERY_TEST_BINDING_STATIC_INVALID: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-test-bindings.mjs')) {
  process.exitCode = main();
}
