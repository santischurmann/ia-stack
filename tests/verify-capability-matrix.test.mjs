import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-capability-matrix.mjs');
const { SCHEMA, USAGE, main, readMatrix, validateMatrix } = await import(pathToFileURL(script).href);

function valid() {
  return {
    schema: SCHEMA,
    roles: [{ id: 'reader', phase: 'review', tools: ['Read'], reads: ['production'], writes: [], approves: [] }],
    rules: [
      { id: 'no-self-approval', description: 'separate writer and approver' },
      { id: 'read-only-no-write', description: 'read only means no write' },
    ],
  };
}

test('capability matrix real contract is valid', () => {
  const raw = readMatrix(join(repoRoot, 'contracts', 'capability-matrix.json'));
  assert.equal(raw.error, null);
  assert.deepEqual(validateMatrix(raw.document), []);
});

test('FALSIFICACIÓN · schema, top-level shape and empty arrays reject', () => {
  assert.match(validateMatrix(null)[0], /must use/);
  const matrix = valid();
  matrix.schema = 'wrong';
  assert.ok(validateMatrix(matrix).length > 0);
  const noRoles = valid(); noRoles.roles = [];
  assert.ok(validateMatrix(noRoles).some((x) => x.includes('roles')));
  const noRules = valid(); noRules.rules = [];
  assert.ok(validateMatrix(noRules).some((x) => x.includes('rules')));
});

test('FALSIFICACIÓN · duplicate ids, unknown tools, bad lists and unknown surfaces reject', () => {
  const matrix = valid();
  matrix.roles.push({ ...matrix.roles[0] });
  matrix.roles[1].tools = ['Read', 'Read', 'Unknown'];
  matrix.roles[1].reads = ['outside'];
  matrix.roles[1].writes = 'production';
  matrix.roles[1].approves = ['unknown'];
  const violations = validateMatrix(matrix);
  assert.ok(violations.some((x) => x.includes('duplicated')));
  assert.ok(violations.some((x) => x.includes('tools')));
  assert.ok(violations.some((x) => x.includes('reads')));
  assert.ok(violations.some((x) => x.includes('writes')));
  assert.ok(violations.some((x) => x.includes('approves')));
});

test('FALSIFICACIÓN · self-approval and read-only write permissions reject', () => {
  const self = valid();
  self.roles[0].writes = ['production'];
  self.roles[0].approves = ['production'];
  self.roles[0].tools = ['Read', 'Write'];
  const violations = validateMatrix(self);
  assert.ok(violations.some((x) => x.includes('cannot write and approve')));

  const readonly = valid();
  readonly.roles[0].tools = ['Read', 'Edit'];
  const readOnlyViolations = validateMatrix(readonly);
  assert.ok(readOnlyViolations.some((x) => x.includes('read-only')));

  const writer = valid();
  writer.roles[0].writes = ['production'];
  const writerViolations = validateMatrix(writer);
  assert.ok(writerViolations.some((x) => x.includes('writer must hold')));
});

test('FALSIFICACIÓN · malformed role/rule objects and missing mandatory rules reject without throwing', () => {
  const matrix = valid();
  matrix.roles = [null, { id: 'bad', phase: '', tools: [], reads: [], writes: [], approves: [] }];
  matrix.rules = [null, { id: 'no-self-approval', description: 'ok' }];
  const violations = validateMatrix(matrix);
  assert.ok(violations.length >= 4);
});

test('FALSIFICACIÓN · capability matrix exercises every closed-world validation branch', () => {
  const badShape = valid(); delete badShape.rules; assert.ok(validateMatrix(badShape).length > 0);
  const badTopLevel = valid(); badTopLevel.extra = true; assert.ok(validateMatrix(badTopLevel).length > 0);
  const sameLengthWrongKeys = { schema: SCHEMA, roles: [], unexpected: [] };
  assert.ok(validateMatrix(sameLengthWrongKeys).length > 0);

  const variants = [
    { id: '', phase: 'x', tools: ['Read'], reads: [], writes: [], approves: [] },
    { id: 'p', phase: 1, tools: null, reads: null, writes: null, approves: null },
    { id: 'q2', phase: 'x', tools: ['Read', ''], reads: ['tests', 'tests'], writes: ['production', 'production'], approves: ['release', 'release'] },
    { id: 'q', phase: 'x', tools: ['Read'], reads: ['tests'], writes: [], approves: ['release'] },
    { id: 'r', phase: 'x', tools: ['Write'], reads: ['tests'], writes: ['production'], approves: [] },
    { id: 's', phase: 'x', tools: ['Read'], reads: ['tests'], writes: ['production'], approves: [] },
  ];
  const matrix = valid(); matrix.roles = variants;
  const roleViolations = validateMatrix(matrix);
  assert.ok(roleViolations.length > 0);

  const duplicateRules = valid();
  duplicateRules.rules.push({ id: 'no-self-approval', description: 'duplicate' });
  assert.ok(validateMatrix(duplicateRules).some((x) => x.includes('rules[2].id is duplicated')));
  const missingRule = valid();
  missingRule.rules = [{ id: 'no-self-approval', description: 'only one' }];
  assert.ok(validateMatrix(missingRule).some((x) => x.includes('read-only-no-write')));

  const malformedKeyRole = valid();
  malformedKeyRole.roles = [{ id: 'x', phase: 'x', tools: ['Read'], reads: [], writes: [], wrong: [] }];
  assert.ok(validateMatrix(malformedKeyRole).some((x) => x.includes('roles[0]')));
  const malformedKeyRule = valid();
  malformedKeyRule.rules = [{ id: 'no-self-approval', description: 'x', wrong: 'x' }, { id: 'read-only-no-write', description: 'x' }];
  assert.ok(validateMatrix(malformedKeyRule).some((x) => x.includes('rules[0]')));
  const nullLists = valid(); nullLists.roles = null; nullLists.rules = null;
  assert.ok(validateMatrix(nullLists).length > 0);
});

test('CLI returns usage, controlled read errors, validation errors and pass', () => {
  const errors = [];
  assert.equal(main([], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check', 'missing.json'], { writeError: (line) => errors.push(line) }), 1);

  const output = [];
  assert.equal(main(['check', 'matrix.json'], { readFile: () => JSON.stringify(valid()), write: (line) => output.push(line) }), 0);
  assert.match(output.at(-1), /capability matrix has 1 role/);
  assert.equal(main(['check', 'matrix.json'], { readFile: () => '{', writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['check', 'matrix.json'], { readFile: () => JSON.stringify({ schema: SCHEMA, roles: [], rules: [] }), writeError: (line) => errors.push(line) }), 1);
});

test('CLI real contract passes and malformed file exits 1', () => {
  const good = spawnSync(process.execPath, [script, 'check', join(repoRoot, 'contracts', 'capability-matrix.json')], { encoding: 'utf8' });
  assert.equal(good.status, 0, good.stderr);
  const dir = mkdtempSync(join(tmpdir(), 'vcp-capability-'));
  try {
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{"schema":"wrong"}', 'utf8');
    const bad = spawnSync(process.execPath, [script, 'check', file], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /CAPABILITY_MATRIX_INVALID/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
