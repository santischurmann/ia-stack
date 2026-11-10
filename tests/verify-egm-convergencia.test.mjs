// verify-egm-convergencia — la revisión EGM de una pieza convergió antes de seguir (gate 3, tamaño grande).
// Lee las líneas `egm` de `.ia-stack/metricas.jsonl`: chico pasa sin registro; medio exige 2 lectores,
// grande 4; converge si la última ronda tiene 0 altos; más de 2 rondas falla salvo decide_persona.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { LECTORES_MINIMOS, checkConvergencia } from '../scripts/verify-egm-convergencia.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-egm-convergencia.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const L = (ronda, altos, extra = {}) => ({ tipo: 'egm', ts: '2026-11-10T14:35:00.000Z', pieza: 'spec', lectores: 4, ronda, altos, medios: 1, bajos: 0, ...extra });

test('lectores mínimos · chico 0, medio 2, grande 4', () => {
  assert.deepEqual(LECTORES_MINIMOS, { chico: 0, medio: 2, grande: 4 });
});

test('chico · pasa sin ningún registro', () => {
  assert.equal(checkConvergencia([], 'spec', 'chico').ok, true);
});

test('medio y grande · sin registro de la pieza no pasan', () => {
  assert.match(checkConvergencia([], 'spec', 'medio').reason, /sin rondas/);
  assert.match(checkConvergencia([L(1, 0, { pieza: 'otra' })], 'spec', 'grande').reason, /sin rondas/);
});

test('converge cuando la última ronda tiene 0 altos', () => {
  assert.equal(checkConvergencia([L(1, 2), L(2, 0)], 'spec', 'grande').ok, true);
  assert.equal(checkConvergencia([L(1, 0)], 'spec', 'grande').ok, true);
  assert.match(checkConvergencia([L(1, 2), L(2, 1)], 'spec', 'grande').reason, /altos/);
});

test('lectores · medio exige 2 y grande 4 en cada ronda', () => {
  assert.equal(checkConvergencia([L(1, 0, { lectores: 2 })], 'spec', 'medio').ok, true);
  assert.match(checkConvergencia([L(1, 0, { lectores: 1 })], 'spec', 'medio').reason, /lectores/);
  assert.match(checkConvergencia([L(1, 1, { lectores: 4 }), L(2, 0, { lectores: 3 })], 'spec', 'grande').reason, /lectores/);
});

test('más de 2 rondas falla salvo que la última traiga decide_persona: true', () => {
  const tres = [L(1, 2), L(2, 1), L(3, 0)];
  assert.match(checkConvergencia(tres, 'spec', 'grande').reason, /tope/);
  const decide = [L(1, 2), L(2, 1), L(3, 1, { decide_persona: true })];
  assert.equal(checkConvergencia(decide, 'spec', 'grande').ok, true);
  assert.match(checkConvergencia([L(1, 2, { decide_persona: true }), L(2, 1), L(3, 0)], 'spec', 'grande').reason, /tope/);
});

test('sólo cuentan las líneas egm de la pieza pedida', () => {
  const mezcla = [{ tipo: 'bloque', fase: 5 }, L(1, 3, { pieza: 'otra' }), L(1, 0)];
  assert.equal(checkConvergencia(mezcla, 'spec', 'grande').ok, true);
});

test('CLI · converge sale 0, no converge sale 1, sin archivo sale 1 salvo chico, mal uso sale 2', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-egm-'));
  try {
    mkdirSync(join(root, '.ia-stack'));
    let r = run(['check', '--pieza', 'spec', '--tamano', 'chico', '--proyecto', root]);
    assert.equal(r.status, 0, r.output);
    r = run(['check', '--pieza', 'spec', '--tamano', 'grande', '--proyecto', root]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED/);
    const jsonl = join(root, '.ia-stack', 'metricas.jsonl');
    writeFileSync(jsonl, `${[L(1, 2), L(2, 0)].map((x) => JSON.stringify(x)).join('\n')}\n`);
    r = run(['check', '--pieza', 'spec', '--tamano', 'grande', '--proyecto', root]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: spec convergió en 2 rondas/);
    writeFileSync(jsonl, `${JSON.stringify(L(1, 1))}\n`);
    assert.equal(run(['check', '--pieza', 'spec', '--tamano', 'medio', '--proyecto', root]).status, 1);
    writeFileSync(jsonl, '{\n');
    r = run(['check', '--pieza', 'spec', '--tamano', 'medio', '--proyecto', root]);
    assert.equal(r.status, 1);
    assert.match(r.output, /ilegible/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  for (const args of [[], ['otro'], ['check'], ['check', '--pieza', 'a'], ['check', '--pieza', 'a', '--tamano', 'enorme']]) {
    const r = run(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.output, /usage:/i);
  }
});
