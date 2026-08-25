import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('../scripts/verify-red-node.mjs', import.meta.url));
const { USAGE, classifyNodeRed, isContainedProjectPath, isTestPath, main, normalizeProjectPath, realDiagnosticBlocks, redTestEnvironment, verifyNodeRed } = await import(pathToFileURL(scriptPath).href);

function failed(stdout) {
  return { status: 1, stdout, stderr: '' };
}

function failedSplit(stdout, stderr) {
  return { status: 1, stdout, stderr };
}

// Synthetic TAP fixtures matching the exact structural shape Node's own `--test-reporter=tap`
// produces (verified empirically against real `node --test` runs before writing this file — see
// research/adversarial-productivity-audit-2026-08-23.md and the P0 fix it drove). Used only to
// exercise classifyNodeRed's branches directly; end-to-end acceptance/rejection is additionally
// proven against a REAL spawned `node --test` process further down in this file.
function tapAssertionFailure() {
  return [
    'TAP version 13', '# Subtest: x', 'not ok 1 - x',
    '  ---', "  duration_ms: 1", "  type: 'test'", "  failureType: 'testCodeFailure'",
    "  error: 'boom'", "  code: 'ERR_ASSERTION'", "  name: 'AssertionError'",
    '  ...', '1..1', '# tests 1', '# suites 0', '# pass 0', '# fail 1',
    '# cancelled 0', '# skipped 0', '# todo 0', '# duration_ms 1', '',
  ].join('\n');
}

function tapTestCodeFailure() {
  return [
    'TAP version 13', '# Subtest: x', 'not ok 1 - x',
    '  ---', "  duration_ms: 1", "  type: 'test'", "  failureType: 'testCodeFailure'",
    '  exitCode: 1', "  error: 'test failed'", "  code: 'ERR_TEST_FAILURE'",
    '  ...', '1..1', '# tests 1', '# suites 0', '# pass 0', '# fail 1',
    '# cancelled 0', '# skipped 0', '# todo 0', '# duration_ms 1', '',
  ].join('\n');
}

function tapHeaderNoFooter() {
  return ['TAP version 13', '# Subtest: x', 'not ok 1 - x', '  ---', "  code: 'ERR_ASSERTION'", '  ...'].join('\n');
}

// A structurally valid-looking block that is NOT immediately preceded by its own `not ok N - `
// line — e.g. separated by a blank line or attached to an unrelated line — must not be treated
// as evidence, even though the block's own delimiters and content are byte-identical to a real one.
function tapUnassociatedBlock() {
  return [
    'TAP version 13', '# Subtest: x', 'not ok 1 - x',
    '  ---', "  duration_ms: 1", "  code: 'ERR_TEST_FAILURE'", '  ...',
    'some unrelated line',
    '  ---', "  code: 'ERR_ASSERTION'", '  ...',
    '1..1', '# tests 1', '# suites 0', '# pass 0', '# fail 1',
    '# cancelled 0', '# skipped 0', '# todo 0', '# duration_ms 1', '',
  ].join('\n');
}

test('normalizes only safe project-relative paths and recognizes literal test paths', () => {
  assert.equal(normalizeProjectPath('./test/a.test.mjs'), 'test/a.test.mjs');
  assert.equal(normalizeProjectPath('src\\a.mjs'), 'src/a.mjs');
  for (const path of ['', '   ', '../outside.mjs', 'src/./safe.mjs', 'src/../../outside.mjs', 'test/../test/a.test.mjs', 'test/../../outside.test.mjs', '/root/a.mjs', 'C:/root/a.mjs', '..', 42]) assert.equal(normalizeProjectPath(path), null);
  assert.equal(isTestPath('test/a.test.mjs'), true);
  assert.equal(isTestPath('src/a.mjs'), false);
});

test('FALSIFICACIÓN · RED runner strips ambient secrets and Node injection variables unless an operator allowlists a safe name', () => {
  const source = { PATH: '/safe/bin', HOME: '/sensitive/home', NODE_OPTIONS: '--require attacker' };
  source['APP_' + 'TOKEN'] = 'explicit-value';
  source.VCP_RED_ENV_ALLOW = ['APP_' + 'TOKEN', 'NODE_OPTIONS', 'lowercase', 'MISSING', ''].join(',');
  const environment = redTestEnvironment(source);
  const expected = { PATH: '/safe/bin' };
  expected['APP_' + 'TOKEN'] = 'explicit-value';
  assert.deepEqual(environment, expected);
  assert.deepEqual(redTestEnvironment({}), {});
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
    const result = verifyNodeRed({ testPath: 'test/external/outside.test.mjs', command: 'node --test', cwd: root, run: () => { escapedRunnerCalled = true; return failed(tapAssertionFailure()); } });
    assert.equal(result.ok, false);
    assert.equal(escapedRunnerCalled, false);
    rmSync(outside, { recursive: true, force: true });
    assert.equal(isContainedProjectPath('test/dangling/outside.test.mjs', root), false, 'a dangling link must fail closed');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('realDiagnosticBlocks extracts only the harness-delimited YAML block, never text printed by the file under test', () => {
  assert.deepEqual(realDiagnosticBlocks(tapAssertionFailure()).at(0)?.includes("  code: 'ERR_ASSERTION'"), true);
  assert.deepEqual(realDiagnosticBlocks('no blocks here'), []);
  assert.deepEqual(realDiagnosticBlocks('  ---\nunterminated'), [], 'an unterminated block (no closing "  ..." line) is not extracted');
});

test('classifyNodeRed accepts only a genuine structural AssertionError block from a real TAP run', () => {
  assert.equal(classifyNodeRed(failed(tapAssertionFailure())).ok, true);
});

test('FALSIFICACIÓN · classification rejects launch failure, pass, missing TAP header, syntax errors, missing footer, and non-assertion structural failures', () => {
  const cases = [
    { status: 1, stdout: '', stderr: '', error: new Error('missing node') },
    { status: 1 },
    { status: 0, stdout: tapAssertionFailure(), stderr: '' },
    failed('no TAP header at all, just crash text'),
    failed('TAP version 13\nSyntaxError: Unexpected token\n' + tapAssertionFailure()),
    failed(tapHeaderNoFooter()),
    failed(tapTestCodeFailure()),
    // Forged text that prints TAP-shaped lines is always re-emitted as `#`-prefixed comments by
    // Node's own harness — it can never land inside a real "  ---".."  ..." block or replace the
    // real footer, so it is indistinguishable from any other non-assertion failure here.
    failed(`TAP version 13\n#   ---\n#   code: 'ERR_ASSERTION'\n#   ...\n${tapTestCodeFailure()}`),
  ];
  for (const candidate of cases) assert.equal(classifyNodeRed(candidate).ok, false);
});

test('FALSIFICACIÓN · a diagnostic block not immediately preceded by its own not-ok line is not accepted, even with byte-identical content', () => {
  assert.equal(classifyNodeRed(failed(tapUnassociatedBlock())).ok, false);
});

test('FALSIFICACIÓN · a real-looking TAP diagnostic block placed on stderr is never accepted — only stdout decides RED', () => {
  // stdout alone reports a genuine, but non-assertion, test-code failure (ERR_TEST_FAILURE);
  // stderr separately carries a byte-identical copy of a real ERR_ASSERTION block. If this gate
  // decided from merged stdout+stderr, that stderr block would smuggle acceptance through.
  const result = classifyNodeRed(failedSplit(tapTestCodeFailure(), tapAssertionFailure()));
  assert.equal(result.ok, false);
  assert.match(result.reason, /on stdout/);
});

test('verifyNodeRed rejects unknown runners and test paths before it can run arbitrary commands, then accepts a real RED', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-node-'));
  try {
    writeFileSync(join(root, 'a.test.mjs'), '');
    assert.equal(verifyNodeRed({ testPath: '../a.test.mjs', command: 'node --test', cwd: root }).ok, false);
    let escapedRunnerCalled = false;
    assert.equal(verifyNodeRed({ testPath: 'test/../../outside.test.mjs', command: 'node --test', cwd: root, run: () => { escapedRunnerCalled = true; return failed(tapAssertionFailure()); } }).ok, false);
    assert.equal(escapedRunnerCalled, false, 'unsafe test path must reject before invoking Node');
    assert.equal(verifyNodeRed({ testPath: 'a.test.mjs', command: 'node -e "fake"', cwd: root }).ok, false);
    assert.equal(verifyNodeRed({ testPath: 'test/missing.test.mjs', command: 'node --test', cwd: root }).ok, false);
    mkdirSync(join(root, 'test', 'directory.test.mjs'), { recursive: true });
    assert.equal(verifyNodeRed({ testPath: 'test/directory.test.mjs', command: 'node --test', cwd: root }).ok, false);
    writeFileSync(join(root, 'test', 'runner.test.mjs'), [
      "import test from 'node:test';", "import assert from 'node:assert/strict';", "test('red', () => assert.equal(1, 2));", '',
    ].join('\n'));
    const proof = verifyNodeRed({ testPath: 'test/runner.test.mjs', command: 'node --test', cwd: root });
    assert.equal(proof.ok, true, proof.reason);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifyNodeRed passes only the reduced environment into the spawned test runner', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-node-env-'));
  try {
    mkdirSync(join(root, 'test'));
    writeFileSync(join(root, 'test', 'runner.test.mjs'), 'export {}\n');
    let options;
    const environment = { PATH: '/safe/bin', DATABASE_URL: 'do-not-forward', EXPLICIT: 'yes' };
    environment.VCP_RED_ENV_ALLOW = 'EXPLICIT';
    const result = verifyNodeRed({
      testPath: 'test/runner.test.mjs', command: 'node --test', cwd: root,
      environment,
      run: (_command, _args, received) => { options = received; return failed(tapAssertionFailure()); },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(options.env, { PATH: '/safe/bin', EXPLICIT: 'yes' });
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

test('FALSIFICACIÓN · a real process cannot forge RED by printing text instead of registering a real failing assertion', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-node-forge-'));
  try {
    mkdirSync(join(root, 'test'));
    // Caso (b) from the adversarial audit: no node:test import at all, just matching text + exit(1).
    writeFileSync(join(root, 'test', 'forged_print.test.mjs'), 'console.log("tests 1");\nconsole.log("assert.ok");\nprocess.exit(1);\n');
    // Caso 3: printed text shaped like the real TAP diagnostic block.
    writeFileSync(join(root, 'test', 'forged_block.test.mjs'), [
      "console.log('  ---');", "console.log(\"  code: 'ERR_ASSERTION'\");", "console.log('  ...');", 'process.exit(1);', '',
    ].join('\n'));
    // Caso 4: top-level exit with no test() registration at all.
    writeFileSync(join(root, 'test', 'forged_exit.test.mjs'), 'process.exit(1);\n');
    // Fase 0-b, caso 1: the same forged block written directly to stderr instead of stdout.
    writeFileSync(join(root, 'test', 'forged_stderr.test.mjs'), [
      'process.stderr.write("  ---\\n");', 'process.stderr.write("  code: \'ERR_ASSERTION\'\\n");',
      'process.stderr.write("  ...\\n");', 'process.exit(1);', '',
    ].join('\n'));
    // Fase 0-b, caso 4: a child process spawned with stdio:'inherit' (after clearing
    // NODE_TEST_CONTEXT to defeat Node's own test-recursion guard) piping a REAL, genuine TAP
    // assertion failure from an unrelated dummy test straight to this process's own stdout.
    writeFileSync(join(root, 'test', 'dummy_unrelated.mjs'), [
      "import test from 'node:test';", "import assert from 'node:assert';",
      "test('dummy', () => assert.equal(1, 2));", '',
    ].join('\n'));
    writeFileSync(join(root, 'test', 'forged_inherit_spawn.test.mjs'), [
      "import { spawnSync } from 'node:child_process';",
      'const env = { ...process.env };', 'delete env.NODE_TEST_CONTEXT;',
      "spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/dummy_unrelated.mjs'], { stdio: 'inherit', env });",
      'process.exit(1);', '',
    ].join('\n'));
    for (const file of [
      'test/forged_print.test.mjs', 'test/forged_block.test.mjs', 'test/forged_exit.test.mjs',
      'test/forged_stderr.test.mjs', 'test/forged_inherit_spawn.test.mjs',
    ]) {
      const result = verifyNodeRed({ testPath: file, command: 'node --test', cwd: root });
      assert.equal(result.ok, false, `${file} must not pass as RED`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
