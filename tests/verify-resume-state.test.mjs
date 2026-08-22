import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resumeGate = join(repoRoot, 'scripts', 'verify-resume-state.mjs');
const { checkResumeIdentity, isFeatureSlug } = await import(pathToFileURL(resumeGate).href);

function runArgs(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [resumeGate, ...args], { encoding: 'utf8', env });
  assert.equal(result.error, undefined, `resume verifier could not launch: ${result.error?.message}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function run(sessionText, feature) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-resume-state-'));
  const session = join(root, 'SESSION.md');
  writeFileSync(session, sessionText);
  try {
    return runArgs(['check', '--session', session, '--feature', feature]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const authSession = `# Session — 2026-08-21\n\n**Feature slug:** auth-refactor\n**Goal:** Make authentication easier to maintain\n**Status:** in progress\n\n## 3.1 RED\nT1 RED PASS\n`;

test('resume identity accepts only the session feature currently requested', () => {
  const result = run(authSession, 'auth-refactor');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /OK:.*auth-refactor/i);
});

test('FALSIFICACIÓN · auth-refactor state cannot silently resume billing-fix', () => {
  const result = run(authSession, 'billing-fix');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /CONFLICT:.*auth-refactor.*billing-fix/is);
  assert.match(result.output, /do not resume silently/i);
});

test('FALSIFICACIÓN · legacy or malformed session identity fails closed', () => {
  const missing = run('# Session — 2026-08-21\n**Status:** in progress\n', 'billing-fix');
  assert.equal(missing.status, 1, missing.output);
  assert.match(missing.output, /UNKNOWN:.*Feature slug/i);

  const malformed = run('# Session — 2026-08-21\n**Feature slug:** Billing Fix\n', 'billing-fix');
  assert.equal(malformed.status, 1, malformed.output);
  assert.match(malformed.output, /UNKNOWN:.*valid kebab-case/i);

  const empty = run('# Session — 2026-08-21\n**Feature slug:**   \n', 'billing-fix');
  assert.equal(empty.status, 1, empty.output);
  assert.match(empty.output, /UNKNOWN:.*no Feature slug declaration/i);
});

test('FALSIFICACIÓN · duplicated feature declarations are ambiguous and must reject', () => {
  const duplicated = `${authSession}\n**Feature slug:** billing-fix\n`;
  const result = run(duplicated, 'auth-refactor');
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /UNKNOWN:.*exactly one Feature slug/i);
});

test('invalid requested feature slug is rejected as usage, before resume evaluation', () => {
  const result = run(authSession, 'Billing Fix');
  assert.equal(result.status, 2, result.output);
  assert.match(result.output, /usage:.*kebab-case/i);
});

test('FALSIFICACIÓN · CLI rejects malformed arguments and unreadable session state', () => {
  for (const args of [
    [],
    ['other-command'],
    ['check', '--unexpected', 'value'],
    ['check', '--session'],
    ['check', '--session', 'x', '--feature'],
    ['check', '--session', 'x'],
    ['check', '--feature', 'billing-fix'],
    ['check', '--session', 'x', '--session', 'y', '--feature', 'billing-fix'],
    ['check', '--session', 'x', '--feature', 'billing-fix', '--feature', 'auth-refactor'],
    ['check', '--session', join(tmpdir(), 'vcp-missing-session-does-not-exist.md'), '--feature', 'billing-fix'],
  ]) {
    const result = runArgs(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.output}`);
    assert.match(result.output, /usage:/i);
  }
});

test('direct API rejects an invalid requested feature before inspecting session text', () => {
  assert.throws(
    () => checkResumeIdentity(authSession, 'Billing Fix'),
    /Feature slug must be kebab-case/,
  );
});

test('feature-slug predicate rejects non-string values before regex evaluation', () => {
  for (const value of [undefined, null, 7, {}, []]) {
    assert.equal(isFeatureSlug(value), false, `${JSON.stringify(value)} must not be a feature slug`);
  }
  assert.equal(isFeatureSlug('valid-feature-2'), true);
});
