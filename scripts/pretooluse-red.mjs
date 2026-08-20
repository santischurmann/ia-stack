#!/usr/bin/env node
// pretooluse-red.mjs — blocks writing production code without a live RED receipt, enforced by
// the harness (PreToolUse hook), not by the orchestrator choosing to run a check.
//
// WHY THIS EXISTS ON TOP OF verify-red.sh/.ps1. Those two scripts correctly classify whether a
// test run is a genuine RED (see SKILL.md Phase 3.1) — that classification logic stays there,
// this file does not re-derive it. But nothing forces the orchestrator to actually CALL them
// before writing a Write/Edit to a production file: a model under context pressure, or one that
// mis-reads an instruction, can just skip the call and write code straight through. A markdown
// LAW is not enforcement — it's a request the model can decline, even unintentionally. This file
// closes that gap by running as a `PreToolUse` hook: Claude Code invokes it BEFORE a Write/Edit
// tool call is allowed to execute, and if it denies, the write never happens, independent of
// what the model intended to do next.
//
// SOURCE: adopted from nahuelangeles/protocolo `hooks/rojo.mjs` (research/sources/
// protocolo-muralla.md, point #1) — same shape (a receipt keyed to test-file content hashes,
// invalidated the moment those files change), reimplemented stack-agnostic instead of JS/TS-only
// since VCP targets any stack `package.json`/`pyproject.toml`/`go.mod`/`Cargo.toml` can detect.
//
// SCOPE — deliberately narrow, same discipline as verify-receipt.mjs's own comments: this file
// answers exactly one question — "is there a still-valid RED receipt for this write?" — and
// nothing else. It does not run tests, does not classify RED-vs-noise (verify-red.sh/.ps1 do
// that), and does not touch the Phase 4.6 commit gate (verify-receipt.mjs does that).
//
// USAGE:
//   node pretooluse-red.mjs emit --tests <a,b,c>
//       Call this immediately after verify-red.sh/.ps1 has confirmed a genuine RED for the test
//       files listed. Writes .vibe/red-receipt.json pinned to each file's current content hash.
//   echo '<PreToolUse JSON>' | node pretooluse-red.mjs
//       Hook mode — reads the PreToolUse payload from stdin, prints the hook decision to stdout.
//       Wire it in .claude/settings.json (see README.md "Optional: PreToolUse enforcement").

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

export const RECEIPT_PATH = '.vibe/red-receipt.json';

// ── Decision 1: is this path production code under the gate? ──────────────────────────────────

const TEST_PATTERNS = [
  /(\.|\/)(test|spec)\.[a-z]+$/i, // foo.test.js, foo.spec.py
  /(^|\/)(test|tests|__tests__|spec|specs)\//i, // tests/foo.py, __tests__/foo.js
  /(^|\/)test_[^/]+\.[a-z]+$/i, // test_foo.py
  /_test\.[a-z]+$/i, // foo_test.go
  /Test\.[a-z]+$/, // FooTest.java
];
const NEVER_GATED = /(^|\/)(node_modules|dist|build|\.next|\.expo|vendor|target|\.venv|venv|__pycache__|\.vibe)\//;
const PRODUCTION_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|sql)$/i;

/** A path is under the gate if it's executable code and NOT itself a test file. */
export function isUnderGate(path) {
  const p = path.replace(/\\/g, '/');
  if (NEVER_GATED.test(p)) return false;
  if (TEST_PATTERNS.some((re) => re.test(p))) return false;
  return PRODUCTION_EXT.test(p);
}

// ── Decision 2: is the receipt still valid? ────────────────────────────────────────────────────

export function hash16(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * The receipt is valid only while every declared test file still hashes to what was recorded
 * when it was emitted. If a test changed since the RED was confirmed (the classic agent-TDD
 * failure mode: loosen the assertion so the implementation passes it), we don't know if it still
 * proves the same thing — the correct answer is a fresh RED, not trusting the stale one.
 */
export function receiptValid(receipt, read = (p) => readFileSync(p, 'utf8')) {
  if (!receipt || !receipt.tests || Object.keys(receipt.tests).length === 0) {
    return { ok: false, reason: 'receipt declares no test files' };
  }
  for (const [path, expected] of Object.entries(receipt.tests)) {
    let actual;
    try {
      actual = hash16(read(path));
    } catch {
      return { ok: false, reason: `test file ${path} no longer exists` };
    }
    if (actual !== expected) {
      return { ok: false, reason: `${path} changed since the RED — emit a fresh receipt` };
    }
  }
  return { ok: true };
}

/** The full, pure, testable decision — no I/O beyond what's passed in. */
export function decide({ path, receipt, read }) {
  if (!isUnderGate(path)) return { allow: true };
  if (!receipt) {
    return {
      allow: false,
      reason: `No RED receipt for ${path}. Run verify-red.sh/.ps1, confirm a genuine RED, then:\n  node scripts/pretooluse-red.mjs emit --tests <test-file-1,test-file-2>`,
    };
  }
  const v = receiptValid(receipt, read);
  if (!v.ok) return { allow: false, reason: `Stale RED receipt: ${v.reason}` };
  return { allow: true };
}

// ── Entry points ────────────────────────────────────────────────────────────────────────────

function readReceipt(cwd = '.') {
  const path = `${cwd}/${RECEIPT_PATH}`;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** PreToolUse hook contract: stdin has {tool_input:{file_path}}, stdout is the deny/allow JSON. */
export function asHook(input, cwd = '.') {
  const path = input?.tool_input?.file_path ?? '';
  const { allow, reason } = decide({ path, receipt: readReceipt(cwd), read: undefined });
  if (allow) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

export function emit({ tests, cwd = '.' }) {
  if (!tests || tests.length === 0) {
    return { ok: false, reason: 'no test files given — usage: emit --tests <a,b,c>' };
  }
  const entries = {};
  for (const t of tests) {
    const full = `${cwd}/${t}`;
    if (!existsSync(full)) return { ok: false, reason: `test file does not exist: ${t}` };
    entries[t] = hash16(readFileSync(full, 'utf8'));
  }
  const receipt = { emitted_note: 'run only after verify-red.sh/.ps1 confirmed a genuine RED for these files', tests: entries };
  const dest = `${cwd}/${RECEIPT_PATH}`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(receipt, null, 2) + '\n');
  return { ok: true, receipt };
}

if (process.argv[1] && process.argv[1].endsWith('pretooluse-red.mjs')) {
  const [, , cmd, flag, arg] = process.argv;

  if (cmd === 'emit' && flag === '--tests') {
    const result = emit({ tests: arg ? arg.split(',').map((s) => s.trim()).filter(Boolean) : [] });
    if (!result.ok) {
      console.error(`REJECTED: ${result.reason}`);
      process.exit(1);
    }
    console.log(`OK: red receipt written for ${Object.keys(result.receipt.tests).length} test file(s).`);
    process.exit(0);
  }

  if (!cmd) {
    // Hook mode: read the PreToolUse JSON payload from stdin.
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      let input = {};
      try {
        input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      } catch {
        /* empty or invalid stdin: nothing to decide against, let it through */
      }
      process.stdout.write(JSON.stringify(asHook(input)));
    });
  } else {
    console.error('usage: pretooluse-red.mjs emit --tests <a,b,c>  |  <PreToolUse JSON on stdin>');
    process.exit(2);
  }
}
