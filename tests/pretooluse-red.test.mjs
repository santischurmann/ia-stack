import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = fileURLToPath(new URL('../scripts/pretooluse-red.mjs', import.meta.url));
const { RECEIPT_DIR, RECEIPT_TTL_MS, asHook, decide, emit, main, receiptValid, toProjectRelative } = await import(pathToFileURL(scriptPath).href);
const ZERO_SHA = '0'.repeat(64);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const NOW = Date.parse('2026-08-23T12:00:00.000Z');

function fixture() {
  return mkdtempSync(join(tmpdir(), 'vcp-pretooluse-red-'));
}

function write(root, relative, content) {
  const file = join(root, ...relative.split('/'));
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

function session(root, feature = 'billing-fix') {
  write(root, '.vibe/SESSION.md', `# Session\n\n**Feature slug:** ${feature}\n`);
}

function validReceipt(overrides = {}) {
  const testContent = 'import test from \'node:test\'; import assert from \'node:assert/strict\'; test(\'x\', () => assert.equal(1, 2));\n';
  return {
    schema: 'vcp.red-receipt/v2', feature: 'billing-fix', task: 'T01',
    emitted_at: new Date(NOW).toISOString(), expires_at: new Date(NOW + RECEIPT_TTL_MS).toISOString(),
    tests: { 'test/billing.test.mjs': sha(testContent) }, allowed_paths: ['src/billing.mjs'],
    red_proofs: [{ test_path: 'test/billing.test.mjs', command: 'node --test', exit_code: 1, output_sha256: 'a'.repeat(64) }],
    ...overrides,
  };
}

function seedValidState(root, feature = 'billing-fix') {
  const testContent = 'import test from \'node:test\'; import assert from \'node:assert/strict\'; test(\'x\', () => assert.equal(1, 2));\n';
  session(root, feature);
  write(root, 'test/billing.test.mjs', testContent);
  return testContent;
}

function run(root, args = [], stdin) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [scriptPath, ...args], { cwd: root, encoding: 'utf8', env, input: stdin });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

test('receiptValid accepts a complete fresh scoped receipt and detects test mutation', () => {
  const root = fixture();
  try {
    seedValidState(root);
    const receipt = validReceipt();
    assert.equal(receiptValid(receipt, { cwd: root, feature: 'billing-fix', now: NOW }).ok, true);
    write(root, 'test/billing.test.mjs', 'changed\n');
    const result = receiptValid(receipt, { cwd: root, feature: 'billing-fix', now: NOW });
    assert.equal(result.ok, false);
    assert.match(result.reason, /changed since the RED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('default arguments and malformed session state fail closed instead of creating an implicit scope', () => {
  const root = fixture();
  try {
    write(root, '.vibe/SESSION.md', '**Feature slug:** INVALID FEATURE\n');
    assert.equal(asHook({ tool_name: 'Write', tool_input: { file_path: 'src/a.mjs' } }, root, NOW).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(receiptValid(validReceipt()).ok, false);
    assert.equal(decide({ path: 'src/a.mjs', receipts: [], feature: null }).allow, false);
    assert.equal(emit({ feature: 'BAD', task: 'T01', tests: [], files: [], command: 'node --test' }).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · receipt validation fails closed for corrupt schema, feature, targets, proofs and expiry', () => {
  const root = fixture();
  try {
    seedValidState(root);
    const invalid = [
      null, validReceipt({ schema: 'other' }), validReceipt({ feature: null }), validReceipt({ feature: 'BAD' }), validReceipt({ feature: 'auth-fix' }), validReceipt({ task: null }), validReceipt({ task: '../T01' }),
      validReceipt({ tests: null }), validReceipt({ tests: [] }), validReceipt({ tests: {} }), validReceipt({ allowed_paths: [] }), validReceipt({ allowed_paths: ['../a.mjs'] }), validReceipt({ allowed_paths: ['src/../../outside.mjs'] }), validReceipt({ allowed_paths: ['test/billing.test.mjs'] }), validReceipt({ tests: { 'test/../../outside.test.mjs': 'a'.repeat(64) } }),
      validReceipt({ red_proofs: [] }), validReceipt({ red_proofs: [{ command: 'node -e nope', exit_code: 1, output_sha256: 'a'.repeat(64) }] }), validReceipt({ red_proofs: [{ command: 'node --test', exit_code: 0, output_sha256: 'a'.repeat(64) }] }), validReceipt({ red_proofs: [{ command: 'node --test', exit_code: 1 }]}), validReceipt({ red_proofs: [{ command: 'node --test', exit_code: 1, output_sha256: 'short' }] }),
      validReceipt({ red_proofs: [null] }),
      validReceipt({ emitted_at: 'invalid' }), validReceipt({ expires_at: 'invalid' }), validReceipt({ expires_at: new Date(NOW - 1).toISOString() }),
      // TTL math is internally consistent (emitted_at + RECEIPT_TTL_MS === expires_at) but the
      // window has genuinely elapsed relative to `now` — must still reject on the expiry check.
      validReceipt({ emitted_at: new Date(NOW - RECEIPT_TTL_MS - 1000).toISOString(), expires_at: new Date(NOW - 1000).toISOString() }),
      // P0 regression: a hand-written receipt with a self-declared long-lived window (never
      // produced by emit()'s own now+RECEIPT_TTL_MS computation) must be rejected even when every
      // other field is well-formed and the referenced test file genuinely hashes to what it claims.
      validReceipt({ emitted_at: new Date(NOW - 60 * 60 * 1000).toISOString(), expires_at: new Date(NOW + 365 * 24 * 60 * 60 * 1000).toISOString() }),
      validReceipt({ emitted_at: new Date(NOW + 60 * 60 * 1000).toISOString(), expires_at: new Date(NOW + 60 * 60 * 1000 + RECEIPT_TTL_MS).toISOString() }),
      validReceipt({ tests: { 'README.md': 'a'.repeat(64) } }), validReceipt({ tests: { 'test/billing.test.mjs': 42 } }), validReceipt({ tests: { 'test/ghost.test.mjs': 'a'.repeat(64) } }), validReceipt({ allowed_paths: ['README.md'] }),
    ];
    for (const receipt of invalid) assert.equal(receiptValid(receipt, { cwd: root, feature: 'billing-fix', now: NOW }).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('decide allows tests and docs but only the exact declared production target', () => {
  const root = fixture();
  try {
    seedValidState(root);
    const receipts = [validReceipt()];
    assert.equal(decide({ path: 'test/new.test.mjs', receipts, feature: 'billing-fix', cwd: root, now: NOW }).allow, true);
    assert.equal(decide({ path: 'README.md', receipts, feature: 'billing-fix', cwd: root, now: NOW }).allow, true);
    assert.equal(decide({ path: 'src/billing.mjs', receipts, feature: 'billing-fix', cwd: root, now: NOW }).allow, true);
    const foreign = decide({ path: 'src/auth.mjs', receipts, feature: 'billing-fix', cwd: root, now: NOW });
    assert.equal(foreign.allow, false);
    assert.match(foreign.reason, /no live scoped RED receipt/);
    assert.equal(decide({ path: '../outside.mjs', receipts, feature: 'billing-fix', cwd: root, now: NOW }).allow, false);
    assert.equal(decide({ path: 'src/../../outside.mjs', receipts, feature: 'billing-fix', cwd: root, now: NOW }).allow, false);
    assert.equal(decide({ path: 'src/billing.mjs', receipts, feature: null, cwd: root, now: NOW }).allow, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · hook fails closed for malformed Write/Edit payloads yet ignores a known unrelated tool', () => {
  const root = fixture();
  try {
    for (const input of [null, {}, [], { tool_name: 'Write' }, { tool_name: 'Edit', tool_input: { file_path: '../escape.js' } }, { tool_name: 'Edit', tool_input: { file_path: 'src/../../outside.js' } }, { tool_name: 'Write', tool_input: { file_path: 'src/a.mjs' } }]) {
      assert.equal(asHook(input, root, NOW).hookSpecificOutput.permissionDecision, 'deny');
    }
    session(root);
    assert.equal(asHook({ tool_name: 'Write', tool_input: { file_path: 'src/a.mjs' } }, root, NOW).hookSpecificOutput.permissionDecision, 'deny');
    write(root, '.vibe/red-receipts/billing-fix/not-json.txt', 'ignored');
    mkdirSync(join(root, '.vibe/red-receipts/billing-fix/folder.json'));
    assert.equal(asHook({ tool_name: 'Edit', tool_input: { file_path: 'src/a.mjs' } }, root, NOW).hookSpecificOutput.permissionDecision, 'deny');
    assert.deepEqual(asHook({ tool_name: 'Read', tool_input: {} }, root, NOW), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('emit runs the strict RED adapter, writes one task receipt, and the hook refuses another task path', () => {
  const root = fixture();
  try {
    seedValidState(root);
    const result = emit({ feature: 'billing-fix', task: 'T01', tests: ['test/billing.test.mjs'], files: ['src/billing.mjs'], command: 'node --test', cwd: root, now: NOW });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.path, join(root, RECEIPT_DIR, 'billing-fix', 'T01.json'));
    const persisted = JSON.parse(readFileSync(result.path, 'utf8'));
    assert.equal(persisted.red_proofs[0].output_sha256.length, 64);
    const allowed = asHook({ tool_name: 'Write', tool_input: { file_path: 'src/billing.mjs' } }, root, NOW);
    assert.deepEqual(allowed, {});
    const denied = asHook({ tool_name: 'Write', tool_input: { file_path: 'src/other.mjs' } }, root, NOW);
    assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
    const escaped = asHook({ tool_name: 'Write', tool_input: { file_path: 'src/../../outside.mjs' } }, root, NOW);
    assert.equal(escaped.hookSpecificOutput.permissionDecision, 'deny');
    write(root, '.vibe/red-receipts/billing-fix/corrupt.json', '{ nope');
    assert.deepEqual(asHook({ tool_name: 'Edit', tool_input: { file_path: 'src/billing.mjs' } }, root, NOW), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a receipt cannot authorize a production symlink that leaves the project', () => {
  const root = fixture();
  const outside = fixture();
  try {
    seedValidState(root);
    mkdirSync(join(root, 'src'));
    writeFileSync(join(outside, 'outside.mjs'), 'export const outside = true;\n');
    symlinkSync(outside, join(root, 'src', 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    const receipt = validReceipt({ allowed_paths: ['src/external/outside.mjs'] });
    assert.equal(receiptValid(receipt, { cwd: root, feature: 'billing-fix', now: NOW }).ok, false);
    write(root, '.vibe/red-receipts/billing-fix/T01.json', JSON.stringify(receipt));
    const decision = asHook({ tool_name: 'Write', tool_input: { file_path: 'src/external/outside.mjs' } }, root, NOW);
    assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · emit rejects invalid scope, session mismatch, missing tests and unsupported runner without writing a receipt', () => {
  const root = fixture();
  try {
    seedValidState(root, 'auth-fix');
    const cases = [
      { feature: null, task: 'T01', tests: ['test/billing.test.mjs'], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'Billing Fix', task: 'T01', tests: ['test/billing.test.mjs'], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: null, tests: ['test/billing.test.mjs'], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: '../T01', tests: ['test/billing.test.mjs'], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: 'T01', tests: [], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: 'T01', tests: ['test/../../outside.test.mjs'], files: ['src/a.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: 'T01', tests: ['test/billing.test.mjs'], files: ['src/../../outside.mjs'], command: 'node --test' },
      { feature: 'billing-fix', task: 'T01', tests: ['test/billing.test.mjs'], files: ['src/a.mjs'], command: 'node -e fake' },
    ];
    for (const candidate of cases) assert.equal(emit({ ...candidate, cwd: root, now: NOW }).ok, false);
    seedValidState(root);
    assert.equal(emit({ feature: 'billing-fix', task: 'T01', tests: ['test/billing.test.mjs'], files: ['README.md'], command: 'node --test', cwd: root, now: NOW }).ok, false);
    assert.equal(emit({ feature: 'billing-fix', task: 'T01', tests: ['README.md'], files: ['src/a.mjs'], command: 'node --test', cwd: root, now: NOW }).ok, false);
    write(root, 'test/billing.test.mjs', 'changed\n');
    assert.equal(receiptValid(validReceipt(), { cwd: root, feature: 'billing-fix', now: NOW }).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('DOCUMENTED LIMIT (advisory model, not a bypass to fix) · a receipt written outside Write/Edit — e.g. via Bash — with plausible shape, matching test hash, and TTL math consistent with RECEIPT_TTL_MS authorizes a production write with no RED ever run', () => {
  const root = fixture();
  try {
    const testContent = seedValidState(root);
    const forgedNow = Date.now();
    const forged = {
      schema: 'vcp.red-receipt/v2', feature: 'billing-fix', task: 'T01',
      emitted_at: new Date(forgedNow).toISOString(), expires_at: new Date(forgedNow + RECEIPT_TTL_MS).toISOString(),
      tests: { 'test/billing.test.mjs': sha(testContent) }, allowed_paths: ['src/billing.mjs'],
      red_proofs: [{ test_path: 'test/billing.test.mjs', command: 'node --test', exit_code: 1, output_sha256: ZERO_SHA }],
    };
    // This bypasses asHook/decide entirely on purpose: it is the fs-level equivalent of a Bash
    // heredoc, the exact channel this hook cannot see (only Write/Edit tool calls reach it).
    write(root, '.vibe/red-receipts/billing-fix/T01.json', JSON.stringify(forged));
    const decision = asHook({ tool_name: 'Write', tool_input: { file_path: 'src/billing.mjs' } }, root, forgedNow);
    // ALLOW is the expected, documented outcome here — not a bug. receiptValid() checks shape,
    // hash, and TTL math, none of which prove this file was ever produced by emit(). See the
    // module header comment, README.md "Gates que sí son código", and
    // research/adversarial-productivity-audit-2026-08-23.md for why this is an accepted limit of
    // an advisory-model guard, not a security boundary — Fase 1 decision C.
    assert.deepEqual(decision, {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('direct Write/Edit to the receipt tree is denied — friction against the one channel this hook can see, not a provenance guarantee (Bash is untouched, see the limit documented above)', () => {
  const root = fixture();
  try {
    seedValidState(root);
    for (const tool of ['Write', 'Edit']) {
      const decision = asHook({ tool_name: tool, tool_input: { file_path: '.vibe/red-receipts/billing-fix/T99.json' } }, root, NOW);
      assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
      assert.match(decision.hookSpecificOutput.permissionDecisionReason, /blocked; use pretooluse-red\.mjs emit/);
    }
    // The guard fires before any feature/session lookup — no active feature required to deny it.
    rmSync(join(root, '.vibe', 'SESSION.md'), { force: true });
    const noSession = asHook({ tool_name: 'Write', tool_input: { file_path: '.vibe/red-receipts/any-feature/T01.json' } }, root, NOW);
    assert.equal(noSession.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(decide({ path: '.vibe/red-receipts/x/y.json', receipts: [], feature: 'billing-fix', cwd: root, now: NOW }).allow, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI emits a scoped receipt and malformed stdin is a deny decision, never an implicit allow', () => {
  const root = fixture();
  try {
    seedValidState(root);
    const emitted = run(root, ['emit', '--feature', 'billing-fix', '--task', 'T01', '--tests', 'test/billing.test.mjs', '--files', 'src/billing.mjs', '--command', 'node --test']);
    assert.equal(emitted.status, 0, emitted.output);
    assert.match(emitted.output, /scoped RED receipt written/);
    const malformed = run(root, [], 'not json');
    assert.equal(malformed.status, 0);
    assert.equal(JSON.parse(malformed.output).hookSpecificOutput.permissionDecision, 'deny');
    const usage = run(root, ['emit', '--feature', 'billing-fix']);
    assert.equal(usage.status, 2);
    const rejected = run(root, ['emit', '--feature', 'billing-fix', '--task', 'T02', '--tests', 'test/billing.test.mjs', '--files', 'src/billing.mjs', '--command', 'node -e fake']);
    assert.equal(rejected.status, 1);
    const oldError = console.error;
    console.error = () => {};
    try {
      assert.equal(main(['emit', '--feature', 'billing-fix'], root), 2);
      assert.equal(main(['emit', '--feature', 'billing-fix', '--task', 'T03', '--tests', 'test/billing.test.mjs', '--files', 'src/billing.mjs', '--command', 'node -e fake'], root), 1);
      assert.equal(main(['emit', '--feature', 'billing-fix', '--feature', 'billing-fix', '--tests', 'test/billing.test.mjs', '--files', 'src/billing.mjs', '--command', 'node --test'], root), 2);
    } finally {
      console.error = oldError;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


// --- El hook tiene que aceptar la forma real en que Claude Code manda el path --------------------

// Reproducido el 2026-08-28: Claude Code manda `file_path` ABSOLUTO y normalizeProjectPath rechaza
// todo path absoluto (por diseno, para frenar traversal), asi que el hook denegaba TODA escritura
// real. Se relativiza contra el proyecto antes de normalizar; lo que quede afuera sigue denegado.
test('toProjectRelative acepta lo de adentro y deja intacto lo de afuera', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-relativo-'));
  try {
    mkdirSync(join(raiz, 'docs'), { recursive: true });
    assert.equal(toProjectRelative(join(raiz, 'docs', 'notas.md'), raiz), join('docs', 'notas.md'));
    // Un relativo tambien se resuelve contra la raiz: da lo mismo, con el separador del sistema.
    assert.equal(toProjectRelative('docs/notas.md', raiz), join('docs', 'notas.md'));
    // Lo de afuera vuelve ABSOLUTO, que es lo que hace falta: normalizeProjectPath rechaza todo
    // path absoluto, asi que sigue denegado.
    assert.ok(isAbsolute(toProjectRelative(join(raiz, '..', 'fuera.txt'), raiz)));
    // La raiz misma tampoco es un archivo del proyecto.
    assert.equal(toProjectRelative(raiz, raiz), raiz);
    // Un valor que no es texto pasa igual, para que la validacion de mas abajo lo rechace.
    assert.equal(toProjectRelative(42, raiz), 42);
    // Un cwd que no existe no puede tumbar el hook.
    assert.equal(toProjectRelative('docs/x.md', join(raiz, 'no-existe')), 'docs/x.md');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · el hook permite el absoluto de adentro y sigue denegando el de afuera', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-hook-abs-'));
  try {
    mkdirSync(join(raiz, 'docs'), { recursive: true });
    const pedir = (filePath) => asHook({ tool_name: 'Write', tool_input: { file_path: filePath } }, raiz);

    assert.deepEqual(pedir(join(raiz, 'docs', 'notas.md')), {}, 'el absoluto de adentro es la forma real y tiene que pasar');
    assert.deepEqual(pedir('docs/notas.md'), {});

    for (const afuera of ['C:/Windows/system32/evil.txt', join(raiz, '..', 'fuera.txt')]) {
      const r = pedir(afuera);
      assert.equal(r.hookSpecificOutput?.permissionDecision, 'deny', `${afuera} tiene que seguir denegado`);
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
