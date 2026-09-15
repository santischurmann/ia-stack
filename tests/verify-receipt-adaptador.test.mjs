// AC8 de docs/spec.md · El receipt registra CON QUÉ ADAPTADOR se obtuvo cada verde, de modo que el
// de garantía menor no se lea igual que el nativo.
//
// EL PROBLEMA. Desde que existen tres adaptadores de test rojo, dos de ellos dan una garantía
// estrictamente menor: pytest y vitest ejecutan código de configuración del proyecto con control
// sobre el reporte y sobre el código de salida, y los dos ataques están falsificados y medidos en
// entorno virgen. Si el receipt anota los tres verdes igual, **la diferencia desaparece justo en el
// documento que se archiva**, que es el único que alguien va a leer seis meses después.
//
// LA REGLA ES CONDICIONAL Y MECÁNICA, no de criterio: si el `command` de un criterio invoca un
// adaptador de test rojo, ese criterio tiene que declarar `red_adapter`, y ese nombre tiene que
// resolver contra `contracts/red-adapters.json`. La garantía **no se copia al receipt**: se resuelve
// contra el contrato en el momento de comprobar, así que no se puede declarar `fuerte` a mano sobre
// un adaptador que el contrato dice que es `menor`.
//
// Y LA SALIDA DEL GATE LO DICE. Un receipt con verdes de garantía menor no imprime el mismo `OK:`
// que uno con verdes del nativo. Si se lee igual, es igual.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const { invocaAdaptadorDeRed, validateAcceptanceCriterion } = await import(pathToFileURL(script).href);

const HASH = 'a'.repeat(64);

const CONTRATO = {
  adapters: [
    { command: 'node --test', script: 'verify-red-node.mjs', guarantee: 'fuerte' },
    { command: 'pytest', script: 'verify-red-pytest.mjs', guarantee: 'menor' },
    { command: 'vitest', script: 'verify-red-vitest.mjs', guarantee: 'menor' },
  ],
};

const criterio = (over = {}) => ({
  ac_id: 'AC1',
  scenario: 'GIVEN algo, WHEN pasa otra cosa, THEN el gate sale 1.',
  verdict: 'COMPLIANT',
  test_file: 'tests/algo.test.mjs',
  test_hash_sha256: HASH,
  command: 'node --test tests/algo.test.mjs',
  result: 'verde',
  ...over,
});

const deps = (over = {}) => ({
  readFile: () => 'contenido de la prueba',
  resolveFile: (p) => p,
  hashOf: () => HASH,
  readRedAdapters: () => CONTRATO,
  ...over,
});

test('invocaAdaptadorDeRed reconoce el despachador y los adaptadores, y sólo esos', () => {
  for (const c of [
    'node scripts/verify-red.mjs check --test a --command "pytest"',
    'node .vibe/vcp-runtime/scripts/verify-red-pytest.mjs check --test a --command "pytest"',
    'bash scripts/verify-red.sh tests/a.test.mjs "node --test"',
  ]) {
    assert.equal(invocaAdaptadorDeRed(c), true, c);
  }
  for (const c of [
    'node --test tests/algo.test.mjs',
    'node scripts/verify-stack-matrix.mjs check contracts/stack-matrix.json',
    'node --test',
  ]) {
    assert.equal(invocaAdaptadorDeRed(c), false, c);
  }
});

test('un criterio que NO invoca un adaptador no necesita declarar uno', () => {
  const r = validateAcceptanceCriterion(criterio(), repoRoot, deps());
  assert.equal(r.ok, true, r.reason);
});

test('eleccion-de-stack · AC8 · un criterio que invoca un adaptador SIN declararlo se rechaza', () => {
  const r = validateAcceptanceCriterion(
    criterio({ command: 'node scripts/verify-red.mjs check --test tests/test_a.py --command "pytest"' }),
    repoRoot,
    deps(),
  );
  assert.equal(r.ok, false);
  assert.ok(/red_adapter/u.test(r.reason), r.reason);
});

test('AC8 · el adaptador declarado tiene que existir en el contrato', () => {
  const r = validateAcceptanceCriterion(
    criterio({
      command: 'node scripts/verify-red.mjs check --test tests/test_a.py --command "pytest"',
      red_adapter: 'verify-red-inventado.mjs',
    }),
    repoRoot,
    deps(),
  );
  assert.equal(r.ok, false);
  assert.ok(/contracts\/red-adapters\.json|no est[áa] declarado/u.test(r.reason), r.reason);
});

test('AC8 · la garantía se RESUELVE contra el contrato, no se copia del receipt', () => {
  // Declarar `fuerte` a mano sobre un adaptador que el contrato dice `menor` sería la forma obvia de
  // borrar la distinción. El receipt no tiene voz acá: nombra el adaptador y el contrato decide.
  const r = validateAcceptanceCriterion(
    criterio({
      command: 'node scripts/verify-red.mjs check --test tests/test_a.py --command "pytest"',
      red_adapter: 'verify-red-pytest.mjs',
      red_guarantee: 'fuerte',
    }),
    repoRoot,
    deps(),
  );
  assert.equal(r.ok, false);
  assert.ok(/red_guarantee|no se declara|resuelve/u.test(r.reason), r.reason);
});

test('AC8 · un criterio bien declarado pasa, y devuelve la garantía que el contrato dice', () => {
  const r = validateAcceptanceCriterion(
    criterio({
      command: 'node scripts/verify-red.mjs check --test tests/test_a.py --command "pytest"',
      red_adapter: 'verify-red-pytest.mjs',
    }),
    repoRoot,
    deps(),
  );
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.guarantee, 'menor', 'el validador tiene que devolver la garantía para que el resumen la pueda contar');
});

test('AC8 · el nativo pasa y se marca fuerte', () => {
  const r = validateAcceptanceCriterion(
    criterio({
      command: 'bash scripts/verify-red.sh tests/algo.test.mjs "node --test"',
      red_adapter: 'verify-red-node.mjs',
    }),
    repoRoot,
    deps(),
  );
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.guarantee, 'fuerte');
});

test('si el contrato de adaptadores no se puede leer, rechaza en vez de dejar pasar', () => {
  const r = validateAcceptanceCriterion(
    criterio({
      command: 'node scripts/verify-red.mjs check --test tests/test_a.py --command "pytest"',
      red_adapter: 'verify-red-pytest.mjs',
    }),
    repoRoot,
    deps({ readRedAdapters: () => { throw new Error('ENOENT'); } }),
  );
  assert.equal(r.ok, false);
  assert.ok(/red-adapters/u.test(r.reason), r.reason);
});
