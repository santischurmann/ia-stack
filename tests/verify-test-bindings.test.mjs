import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-test-bindings.mjs');
const {
  TAP_TIMEOUT_MS, checkActiveBindings, checkTestBinding, hasLiteralTestDeclaration, main, parseTapResults, validateTestReference,
} = await import(pathToFileURL(script).href);

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-discovery-bindings-'));
  mkdirSync(join(root, 'tests'));
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeTest(root, name, source) {
  const relative = `tests/${name}`;
  writeFileSync(join(root, relative), source);
  return relative;
}

function row(overrides = {}) {
  return {
    req_id: 'REQ-I01',
    status: 'active',
    target_phase: 'I2',
    implemented_phase: 'I2',
    test_ref: 'tests/binding.test.mjs',
    test_name: 'REQ-I01 · binding verde aislado',
    ...overrides,
  };
}

test('checkTestBinding accepts an isolated, exact and green Node TAP test', () => {
  withFixture((root) => {
    const testRef = writeTest(root, 'binding.test.mjs', [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => assert.equal(1, 1));",
      '',
    ].join('\n'));
    assert.deepEqual(checkTestBinding(row({ test_ref: testRef }), root), { ok: true });
    assert.equal(TAP_TIMEOUT_MS > 0, true);
  });
});

test('FALSIFICACIÓN · binding rejects unsafe/static/missing/failed/skipped/duplicate TAP evidence', () => {
  withFixture((root) => {
    const valid = writeTest(root, 'binding.test.mjs', [
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));
    const noDeclaration = writeTest(root, 'no-declaration.test.mjs', "// test('REQ-I01 · binding verde aislado')\n");
    const failed = writeTest(root, 'failed.test.mjs', [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => assert.equal(1, 2));",
      '',
    ].join('\n'));
    const skipped = writeTest(root, 'skipped.test.mjs', [
      "import test from 'node:test';",
      "test.skip('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));

    assert.equal(validateTestReference('../outside.test.mjs', root).ok, false);
    assert.equal(checkTestBinding(row({ test_ref: noDeclaration }), root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: failed }), root).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkTestBinding(row({ test_ref: skipped }), root).code, 'DISCOVERY_TEST_BINDING_SKIPPED');
    assert.equal(checkTestBinding(row({ test_ref: valid }), root, {
      spawn: () => ({ status: 0, stdout: [
        'TAP version 13',
        '# Subtest: REQ-I01 · binding verde aislado',
        'ok 1 - REQ-I01 · binding verde aislado',
        'ok 2 - REQ-I01 · binding verde aislado',
        '1..2',
        '',
      ].join('\n'), stderr: '' }),
    }).code, 'DISCOVERY_TEST_BINDING_DUPLICATE_RESULT');
    assert.equal(checkTestBinding(row({ test_ref: valid }), root, {
      spawn: () => ({ status: null, error: { code: 'ETIMEDOUT', message: 'timed out' }, stdout: '', stderr: '' }),
    }).code, 'DISCOVERY_TEST_BINDING_TIMEOUT');
  });
});

test('parseTapResults uses stdout-only exact TAP result lines', () => {
  assert.deepEqual(parseTapResults([
    'ok 1 - REQ-I01 · exact',
    'not ok 2 - REQ-I01 · broken',
    'ok 3 - REQ-I01 · skipped # SKIP reason',
    'ok 4 - REQ-I01 · todo # TODO later',
    '',
  ].join('\n')), [
    { name: 'REQ-I01 · exact', ok: true, skipped: false },
    { name: 'REQ-I01 · broken', ok: false, skipped: false },
    { name: 'REQ-I01 · skipped', ok: true, skipped: true },
    { name: 'REQ-I01 · todo', ok: true, skipped: true },
  ]);
});

test('checkActiveBindings rejects duplicate names and main reports usage, failures and passes', () => {
  const rows = [row(), row({ req_id: 'REQ-I02' })];
  assert.equal(checkActiveBindings(rows, '.', { check: () => ({ ok: true }) }).code, 'DISCOVERY_TEST_BINDING_DUPLICATE');
  const messages = [];
  assert.equal(main([], '.', {}, () => {}, (line) => messages.push(line)), 2);
  assert.match(messages.at(-1), /usage:/iu);
  assert.equal(main(['check'], '.', { readInventory: () => ({ requirements: rows }), check: () => ({ ok: true }) }, () => {}, (line) => messages.push(line)), 1);
  assert.match(messages.at(-1), /DUPLICATE/u);
  assert.equal(main(['check'], '.', { readInventory: () => ({ requirements: [row({ status: 'planned' })] }), check: () => ({ ok: true }) }, () => {}, () => {}), 0);
});

test('static declaration scanning ignores comments and strings, while safe references reject missing files, directories and symlinks', () => {
  const name = 'REQ-I01 · literal seguro';
  assert.equal(hasLiteralTestDeclaration(`// test('${name}', () => {})\n/* test('${name}', () => {}) */\nconst note = "test('${name}', () => {})";\ntest('${name}', () => {});`, name), true);
  assert.equal(hasLiteralTestDeclaration(`/* test('${name}', () => {})`, name), false);
  assert.equal(hasLiteralTestDeclaration(`// test('${name}', () => {})`, name), false);
  assert.equal(hasLiteralTestDeclaration(`const nested = \`test('${name}', () => {})\`;`, name), false);
  assert.equal(hasLiteralTestDeclaration(`const escaped = "quote: \\"";\ntest('${name}', () => {});`, name), true);
  withFixture((root) => {
    assert.equal(validateTestReference('tests/missing.test.mjs', root).ok, false);
    mkdirSync(join(root, 'tests', 'directory.test.mjs'));
    assert.equal(validateTestReference('tests/directory.test.mjs', root).ok, false);
    writeFileSync(join(root, 'outside.test.mjs'), '');
    try {
      symlinkSync(join(root, 'outside.test.mjs'), join(root, 'tests', 'linked.test.mjs'));
      assert.equal(validateTestReference('tests/linked.test.mjs', root).ok, false);
    } catch (error) {
      assert.match(error.code, /EPERM|EACCES/u);
    }
  });
});

test('FALSIFICACIÓN · binding reports malformed rows, missing TAP and runner errors without trusting stderr', () => {
  withFixture((root) => {
    const testRef = writeTest(root, 'binding.test.mjs', [
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));
    assert.equal(checkTestBinding(null, root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: 'tests/missing.test.mjs' }), root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: '', stderr: 'ok 1 - REQ-I01 · binding verde aislado' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: null, stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: 'not ok 1 - REQ-I01 · binding verde aislado\n', stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: null, error: new Error('launch failed'), stdout: '', stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkActiveBindings([row({ test_ref: testRef })], root, { check: () => ({ ok: false, code: 'DISCOVERY_TEST_BINDING_MISSING', message: 'missing' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkActiveBindings(null, root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
  });
});

test('binding CLI reads the real inventory by default and catches unreadable injected input', () => {
  assert.equal(main(['check'], repoRoot, {}, () => {}, () => {}), 0);
  const errors = [];
  assert.equal(main(['check'], repoRoot, { readInventory: () => { throw new Error('broken JSON'); } }, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /broken JSON/u);
});
