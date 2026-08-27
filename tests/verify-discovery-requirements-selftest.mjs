import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const {
  BASE_REQ_IDS, EXPECTED_REQ_BY_PHASE, PHASE_ORDER, validateInventory, validatePhasePlan,
} = await import(pathToFileURL(join(repoRoot, 'scripts', 'verify-discovery-requirements.mjs')).href);

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'));
}

test('I0 selftest · el inventario y plan Discovery conservan el contrato canónico', () => {
  const inventory = readJson('contracts/discovery-requirements.json');
  const plan = readJson('contracts/discovery-phase-plan.json');
  assert.equal(BASE_REQ_IDS.length, 69);
  assert.deepEqual(PHASE_ORDER, ['I0', 'I1', 'I1.5', 'I2', 'I3']);
  assert.deepEqual(Object.fromEntries(Object.entries(EXPECTED_REQ_BY_PHASE).map(([phase, ids]) => [phase, ids.length])), {
    I0: 0, I1: 54, 'I1.5': 6, I2: 9, I3: 0,
  });
  assert.deepEqual(validateInventory(inventory), { ok: true });
  assert.deepEqual(validatePhasePlan(plan), { ok: true });
});
