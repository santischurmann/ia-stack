import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TAP_TIMEOUT_MS, checkActiveBindings, checkTestBinding, hasLiteralTestDeclaration, parseTapResults, validateTestReference } from '../scripts/verify-test-bindings.mjs';

function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-discovery-bindings-contract-'));
  mkdirSync(join(root, 'tests'));
  try { action(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function row(overrides = {}) {
  return { req_id: 'REQ-I01', status: 'active', test_ref: 'tests/binding.test.mjs', test_name: 'REQ-I01 · binding', ...overrides };
}
function writeGreen(root, title = 'REQ-I01 · binding') {
  const ref = 'tests/binding.test.mjs';
  writeFileSync(join(root, ref), `import test from 'node:test';\ntest('${title}', () => {});\n`);
  return ref;
}

test('REQ-I01 · test_name aparece en una llamada real test o it del test_ref', () => {
  assert.equal(hasLiteralTestDeclaration("test('REQ-I01 · literal', () => {});", 'REQ-I01 · literal'), true);
  assert.equal(hasLiteralTestDeclaration("// test('REQ-I01 · literal', () => {});", 'REQ-I01 · literal'), false);
});

test('REQ-I02 · El test referenciado finaliza con exit 0', () => fixture((root) => {
  const ref = writeGreen(root);
  assert.deepEqual(checkTestBinding(row({ test_ref: ref }), root), { ok: true });
}));

test('REQ-I03 · TAP informa un resultado ok con el nombre exacto', () => {
  assert.deepEqual(parseTapResults('ok 1 - REQ-I03 · exacto\n'), [{ name: 'REQ-I03 · exacto', ok: true, skipped: false }]);
});

test('REQ-I04 · Todo requisito active tiene un test ejecutado', () => fixture((root) => {
  const ref = writeGreen(root, 'REQ-I04 · ejecutado');
  assert.deepEqual(checkActiveBindings([row({ req_id: 'REQ-I04', test_ref: ref, test_name: 'REQ-I04 · ejecutado' })], root), { ok: true });
}));

test('REQ-I05 · test_name es único entre requisitos active', () => {
  const duplicate = [row({ req_id: 'REQ-I05', test_name: 'REQ-I05 · único' }), row({ req_id: 'REQ-I06', test_name: 'REQ-I05 · único' })];
  assert.equal(checkActiveBindings(duplicate, '.', { check: () => ({ ok: true }) }).code, 'DISCOVERY_TEST_BINDING_DUPLICATE');
});

test('REQ-I06 · El resultado TAP válido no está skipped, todo ni cancelled', () => {
  assert.deepEqual(parseTapResults('ok 1 - REQ-I06 · omitido # SKIP later\n'), [{ name: 'REQ-I06 · omitido', ok: true, skipped: true }]);
});

test('REQ-I07 · TAP informa exactamente un resultado por test_name', () => fixture((root) => {
  const ref = writeGreen(root, 'REQ-I07 · una vez');
  const result = checkTestBinding(row({ req_id: 'REQ-I07', test_ref: ref, test_name: 'REQ-I07 · una vez' }), root, {
    spawn: () => ({ status: 0, stdout: 'ok 1 - REQ-I07 · una vez\nok 2 - REQ-I07 · una vez\n' }),
  });
  assert.equal(result.code, 'DISCOVERY_TEST_BINDING_DUPLICATE_RESULT');
}));

test('REQ-I08 · El binding usa timeout explícito', () => fixture((root) => {
  const ref = writeGreen(root, 'REQ-I08 · timeout');
  assert.equal(TAP_TIMEOUT_MS, 30_000);
  const result = checkTestBinding(row({ req_id: 'REQ-I08', test_ref: ref, test_name: 'REQ-I08 · timeout' }), root, {
    spawn: () => ({ status: null, error: { code: 'ETIMEDOUT' }, stdout: '' }),
  });
  assert.equal(result.code, 'DISCOVERY_TEST_BINDING_TIMEOUT');
}));

test('REQ-I09 · test_ref se ejecuta de forma aislada', () => fixture((root) => {
  const ref = writeGreen(root, 'REQ-I09 · aislado');
  const reference = validateTestReference(ref, root);
  assert.equal(reference.ok, true);
  assert.deepEqual(checkTestBinding(row({ req_id: 'REQ-I09', test_ref: ref, test_name: 'REQ-I09 · aislado' }), root), { ok: true });
}));
