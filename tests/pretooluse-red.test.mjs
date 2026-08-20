import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('../scripts/pretooluse-red.mjs', import.meta.url));
const { isUnderGate, hash16, receiptValid, decide, asHook, emit } = await import(pathToFileURL(scriptPath).href);

function run(cwd, args, stdin) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd, encoding: 'utf8', env, input: stdin });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function fixture() {
  return mkdtempSync(join(tmpdir(), 'vcp-pretooluse-red-'));
}

// ── isUnderGate ─────────────────────────────────────────────────────────────────────────────

test('isUnderGate covers multiple stacks, not just JS/TS', () => {
  assert.equal(isUnderGate('src/foo.py'), true);
  assert.equal(isUnderGate('src/foo.go'), true);
  assert.equal(isUnderGate('src/Foo.java'), true);
  assert.equal(isUnderGate('src/foo.rs'), true);
  assert.equal(isUnderGate('src/foo.ts'), true);
});

test('FALSIFICACIÓN · test files themselves are never under the gate — writing a test is the prior step', () => {
  assert.equal(isUnderGate('src/foo.test.js'), false);
  assert.equal(isUnderGate('tests/foo.py'), false);
  assert.equal(isUnderGate('src/test_foo.py'), false);
  assert.equal(isUnderGate('src/foo_test.go'), false);
  assert.equal(isUnderGate('src/FooTest.java'), false);
  assert.equal(isUnderGate('__tests__/foo.js'), false);
});

test('FALSIFICACIÓN · generated/vendored/dependency paths are never under the gate', () => {
  assert.equal(isUnderGate('node_modules/pkg/index.js'), false);
  assert.equal(isUnderGate('dist/bundle.js'), false);
  assert.equal(isUnderGate('vendor/lib.go'), false);
  assert.equal(isUnderGate('.venv/lib/site-packages/x.py'), false);
});

test('docs and non-code files are never under the gate', () => {
  assert.equal(isUnderGate('README.md'), false);
  assert.equal(isUnderGate('package.json'), false);
});

// ── receiptValid / decide (pure) ────────────────────────────────────────────────────────────

test('FALSIFICACIÓN · no receipt at all denies writing a production file', () => {
  const result = decide({ path: 'src/foo.py', receipt: null, read: undefined });
  assert.equal(result.allow, false);
  assert.match(result.reason, /No RED receipt/);
});

test('a receipt with no declared test files is invalid', () => {
  const v = receiptValid({ tests: {} });
  assert.equal(v.ok, false);
  assert.match(v.reason, /declares no test files/);
});

test('FALSIFICACIÓN · a receipt is invalidated the moment its test file content changes', () => {
  const receipt = { tests: { 'test/foo.test.py': hash16('original content') } };
  const read = (p) => (p === 'test/foo.test.py' ? 'CHANGED — assertion loosened' : (() => { throw new Error('unexpected'); })());
  const v = receiptValid(receipt, read);
  assert.equal(v.ok, false, 'a changed test file must invalidate the receipt');
  assert.match(v.reason, /changed since the RED/);
});

test('FALSIFICACIÓN · a receipt is invalidated if its test file was deleted', () => {
  const receipt = { tests: { 'test/foo.test.py': hash16('x') } };
  const read = () => { throw new Error('ENOENT'); };
  const v = receiptValid(receipt, read);
  assert.equal(v.ok, false);
  assert.match(v.reason, /no longer exists/);
});

test('an intact receipt over an unchanged test file remains valid', () => {
  const content = 'def test_x(): assert False';
  const receipt = { tests: { 'test/foo.test.py': hash16(content) } };
  const v = receiptValid(receipt, () => content);
  assert.equal(v.ok, true);
});

test('FALSIFICACIÓN · decide() denies through the receiptValid path, not just the no-receipt path', () => {
  const receipt = { tests: { 'test/foo.test.py': hash16('original') } };
  const read = () => 'DIFFERENT — assertion was loosened after the RED';
  const result = decide({ path: 'src/foo.py', receipt, read });
  assert.equal(result.allow, false);
  assert.match(result.reason, /Stale RED receipt/);
});

test('decide() allows writing a test file even with no receipt — writing the RED test is the prior step', () => {
  const result = decide({ path: 'src/foo.test.js', receipt: null, read: undefined });
  assert.equal(result.allow, true);
});

// ── CLI: emit ───────────────────────────────────────────────────────────────────────────────

test('emit writes a receipt pinned to the given test files current content', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'test'), { recursive: true });
    writeFileSync(join(root, 'test', 'foo.test.py'), 'def test_x(): assert False\n');
    const result = run(root, ['emit', '--tests', 'test/foo.test.py']);
    assert.equal(result.status, 0, result.output);
    const receipt = JSON.parse(readFileSync(join(root, '.vibe', 'red-receipt.json'), 'utf8'));
    assert.equal(Object.keys(receipt.tests).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · emit rejects a test file that does not exist', () => {
  const root = fixture();
  try {
    const result = run(root, ['emit', '--tests', 'test/ghost.test.py']);
    assert.equal(result.status, 1);
    assert.match(result.output, /does not exist/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · emit with no --tests files rejects instead of writing an empty receipt', () => {
  const root = fixture();
  try {
    const result = run(root, ['emit', '--tests', '']);
    assert.equal(result.status, 1);
    assert.match(result.output, /no test files given/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── CLI: hook mode (stdin JSON in, decision JSON out) ──────────────────────────────────────

test('FALSIFICACIÓN · hook mode denies a Write to production code with no receipt on disk', () => {
  const root = fixture();
  try {
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/foo.py' } });
    const result = run(root, [], payload);
    assert.equal(result.status, 0, 'the hook process itself exits 0 even when it denies — the JSON carries the decision');
    const decision = JSON.parse(result.output);
    assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hook mode allows a Write once a valid receipt exists for the file', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'test'), { recursive: true });
    writeFileSync(join(root, 'test', 'foo.test.py'), 'def test_x(): assert False\n');
    assert.equal(run(root, ['emit', '--tests', 'test/foo.test.py']).status, 0);
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/foo.py' } });
    const result = run(root, [], payload);
    const decision = JSON.parse(result.output);
    assert.deepEqual(decision, {}, 'an empty object means allow — no hookSpecificOutput at all');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hook mode allows a Write to a test file even with no receipt', () => {
  const root = fixture();
  try {
    const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'test/new.test.py' } });
    const result = run(root, [], payload);
    assert.deepEqual(JSON.parse(result.output), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hook mode with invalid stdin lets the write through rather than crashing the tool call', () => {
  const root = fixture();
  try {
    const result = run(root, [], 'not json');
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.output), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hook mode with completely empty stdin also lets the write through', () => {
  const root = fixture();
  try {
    const result = run(root, [], '');
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.output), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('asHook() with a corrupt on-disk receipt treats it as absent, not a crash', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'red-receipt.json'), '{ not valid json');
    const decision = asHook({ tool_input: { file_path: 'src/foo.py' } }, root);
    assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI with an unrecognized subcommand prints usage and exits 2', () => {
  const root = fixture();
  try {
    const result = run(root, ['bogus']);
    assert.equal(result.status, 2);
    assert.match(result.output, /usage: pretooluse-red\.mjs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
