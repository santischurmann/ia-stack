import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('../scripts/verify-red-node.mjs', import.meta.url));
const { USAGE, classifyNodeRed, isContainedProjectPath, isTestPath, main, normalizeProjectPath, verifyNodeRed } = await import(pathToFileURL(scriptPath).href);

function failed(stdout) {
  return { status: 1, stdout, stderr: '' };
}

test('normalizes only safe project-relative paths and recognizes literal test paths', () => {
  assert.equal(normalizeProjectPath('./test/a.test.mjs'), 'test/a.test.mjs');
  assert.equal(normalizeProjectPath('src\\a.mjs'), 'src/a.mjs');
  for (const path of ['', '   ', '../outside.mjs', 'src/./safe.mjs', 'src/../../outside.mjs', 'test/../test/a.test.mjs', 'test/../../outside.test.mjs', '/root/a.mjs', 'C:/root/a.mjs', '..', 42]) assert.equal(normalizeProjectPath(path), null);
  assert.equal(isTestPath('test/a.test.mjs'), true);
  assert.equal(isTestPath('src/a.mjs'), false);
});

test('FALSIFICACIÓN · physical links cannot escape the project, while an internal link remains usable', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-link-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'vcp-red-link-outside-'));
  try {
    mkdirSync(join(root, 'test'));
    mkdirSync(join(root, 'internal'));
    writeFileSync(join(root, 'internal', 'safe.test.mjs'), '');
    writeFileSync(join(outside, 'outside.test.mjs'), '');
    symlinkSync(outside, join(root, 'test', 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(outside, join(root, 'test', 'dangling'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(join(root, 'internal'), join(root, 'test', 'internal'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(root, join(root, 'test', 'self'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(dirname(root), join(root, 'test', 'parent'), process.platform === 'win32' ? 'junction' : 'dir');
    if (process.platform === 'win32') symlinkSync('D:\\', join(root, 'test', 'other-volume'), 'junction');
    assert.equal(isContainedProjectPath('test/external/outside.test.mjs', root), false);
    assert.equal(isContainedProjectPath('test/internal/safe.test.mjs', root), true);
    assert.equal(isContainedProjectPath('test/new.test.mjs', root), true);
    assert.equal(isContainedProjectPath('test/self', root), true);
    assert.equal(isContainedProjectPath('test/parent', root), false);
    if (process.platform === 'win32') assert.equal(isContainedProjectPath('test/other-volume', root), false);
    assert.equal(isContainedProjectPath('../outside.test.mjs', root), false);
    assert.equal(isContainedProjectPath('test/new.test.mjs', join(root, 'missing-root')), false);
    let escapedRunnerCalled = false;
    const result = verifyNodeRed({ testPath: 'test/external/outside.test.mjs', command: 'node --test', cwd: root, run: () => { escapedRunnerCalled = true; return failed('AssertionError\nℹ tests 1\nℹ fail 1'); } });
    assert.equal(result.ok, false);
    assert.equal(escapedRunnerCalled, false);
    rmSync(outside, { recursive: true, force: true });
    assert.equal(isContainedProjectPath('test/dangling/outside.test.mjs', root), false, 'a dangling link must fail closed');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('classifyNodeRed accepts only collected assertion, local-module, or SUT-runtime RED evidence', () => {
  const assertion = classifyNodeRed({ testPath: 'test/a.test.mjs', testSource: 'assert.equal(x, y)', result: failed('AssertionError\nℹ tests 1\nℹ fail 1') });
  assert.equal(assertion.ok, true);
  const localModule = classifyNodeRed({ testPath: 'test/a.test.mjs', testSource: 'import x', result: failed("Cannot find module './missing.mjs'\nℹ tests 1\nℹ fail 1") });
  assert.equal(localModule.ok, true);
  const runtime = classifyNodeRed({ testPath: 'test/a.test.mjs', testSource: 'assert.equal(x, y)', result: failed('Error: unfinished\n    at f (file:///tmp/src/a.mjs:1:1)\nℹ tests 1\nℹ fail 1') });
  assert.equal(runtime.ok, true);
});

test('FALSIFICACIÓN · classification rejects passed, parser, empty, generic, runner and test-code failures', () => {
  const cases = [
    { result: { status: 0, stdout: '', stderr: '' }, source: 'assert.equal(x, y)' },
    { result: failed('SyntaxError\nℹ tests 1\nℹ fail 1'), source: 'assert.equal(x, y)' },
    { result: failed('0 tests found'), source: 'assert.equal(x, y)' },
    { result: failed('AssertionError'), source: 'assert.equal(x, y)' },
    { result: failed('ReferenceError\nℹ tests 1\nℹ fail 1'), source: 'test(\'x\', () => nope())' },
    { result: failed("Cannot find module 'missing-package'\nℹ tests 1\nℹ fail 1"), source: 'test(\'x\', () => {})' },
    { result: failed("Cannot find package 'package'\nℹ tests 1\nℹ fail 1"), source: 'test(\'x\', () => {})' },
    { result: failed("Cannot find module './missing.mjs'\nnode_modules\nℹ tests 1\nℹ fail 1"), source: 'test(\'x\', () => {})' },
    { result: failed('Error\n    at f (node:internal/x:1:1)\nℹ tests 1\nℹ fail 1'), source: 'assert.equal(x, y)' },
    { result: { status: 1, stdout: '', stderr: '', error: new Error('missing node') }, source: 'assert.equal(x, y)' },
    { result: { status: 1 }, source: 'assert.equal(x, y)' },
  ];
  for (const candidate of cases) assert.equal(classifyNodeRed({ testPath: 'test/a.test.mjs', testSource: candidate.source, result: candidate.result }).ok, false);
});

test('verifyNodeRed rejects unknown runners and test paths before it can run arbitrary commands', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-node-'));
  try {
    writeFileSync(join(root, 'a.test.mjs'), '');
    assert.equal(verifyNodeRed({ testPath: '../a.test.mjs', command: 'node --test', cwd: root }).ok, false);
    let escapedRunnerCalled = false;
    assert.equal(verifyNodeRed({ testPath: 'test/../../outside.test.mjs', command: 'node --test', cwd: root, run: () => { escapedRunnerCalled = true; return failed('AssertionError\nℹ tests 1\nℹ fail 1'); } }).ok, false);
    assert.equal(escapedRunnerCalled, false, 'unsafe test path must reject before invoking Node');
    assert.equal(verifyNodeRed({ testPath: 'a.test.mjs', command: 'node -e "fake"', cwd: root }).ok, false);
    assert.equal(verifyNodeRed({ testPath: 'test/missing.test.mjs', command: 'node --test', cwd: root }).ok, false);
    mkdirSync(join(root, 'test', 'directory.test.mjs'), { recursive: true });
    assert.equal(verifyNodeRed({ testPath: 'test/directory.test.mjs', command: 'node --test', cwd: root }).ok, false);
    writeFileSync(join(root, 'test', 'runner.test.mjs'), 'assert.equal(1, 2);\n');
    const proof = verifyNodeRed({ testPath: 'test/runner.test.mjs', command: 'node --test', cwd: root, run: () => failed('AssertionError\nℹ tests 1\nℹ fail 1') });
    assert.equal(proof.ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('main returns an explicit status and never runs an argument-shaped fake command', () => {
  const output = [];
  const errors = [];
  assert.equal(main([], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check', '--test', 'test/a.test.mjs', '--command', 'node -e fake'], { write: (line) => output.push(line), writeError: (line) => errors.push(line) }), 1);
  assert.match(errors.at(-1), /unsupported runner/i);
  assert.deepEqual(output, []);
});

test('main reports the strict adapter pass only after a real requested test file runs RED', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-node-main-'));
  try {
    mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'test', 'main.test.mjs'), [
      "import test from 'node:test';", "import assert from 'node:assert/strict';", "test('red', () => assert.equal(1, 2));", '',
    ].join('\n'));
    const output = [];
    const errors = [];
    assert.equal(main(['check', '--test', 'test/main.test.mjs', '--command', 'node --test'], { cwd: root, write: (line) => output.push(line), writeError: (line) => errors.push(line) }), 0);
    assert.match(output.at(-1), /RED gate passed/);
    assert.deepEqual(errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
