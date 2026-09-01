import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  GUARD_OWN_FILES,
  INTENTIONAL_BUDGET_LITERALS,
  MEASURED_WORST_CASE_MS,
  REAL_SPAWN_TIMEOUT_MS,
  guardedTestFiles,
  literalBudgetViolations,
} from './spawn-budget.mjs';

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(testsDir);

test('el presupuesto de spawn real supera con margen la latencia peor medida bajo carga', () => {
  // Sin margen no hay guardia: la latencia medida es el peor caso de 30 muestras, no un techo.
  assert.ok(
    REAL_SPAWN_TIMEOUT_MS >= MEASURED_WORST_CASE_MS * 2,
    `${REAL_SPAWN_TIMEOUT_MS}ms no duplica el peor caso medido de ${MEASURED_WORST_CASE_MS}ms`,
  );
});

test('ningún archivo de pruebas escribe un presupuesto de spawn como número a ojo', () => {
  const files = guardedTestFiles();
  // Un barrido que no encontró archivos no es un verde: es una guardia que no miró nada.
  assert.ok(files.length >= 60, `el barrido sólo encontró ${files.length} archivo(s) de prueba`);
  const offenders = files.flatMap((file) =>
    literalBudgetViolations(readFileSync(file, 'utf8'))
      .map((violation) => `${relative(repoRoot, file)}:${violation.line} → ${violation.value}`));
  assert.deepEqual(offenders, [], `presupuesto literal fuera de la lista intencional; usá REAL_SPAWN_TIMEOUT_MS:\n${offenders.join('\n')}`);
});

test('el barrido se descubre solo y deja afuera únicamente los dos archivos de la guardia', () => {
  const nombres = guardedTestFiles().map((file) => relative(testsDir, file));
  for (const propio of GUARD_OWN_FILES) assert.ok(!nombres.includes(propio), `${propio} no debería barrerse a sí mismo`);
  assert.ok(nombres.includes('verify-evidence-runner.test.mjs'), 'falta el archivo donde apareció el defecto');
  assert.ok(nombres.includes('protocolo-e2e.test.mjs'), 'falta el segundo archivo afectado');
  assert.ok(nombres.every((name) => name.endsWith('.mjs')), 'el barrido levantó algo que no es un módulo');
});

test('FALSIFICACIÓN · el barrido no depende del disco: lee el directorio que le pasen', () => {
  const listado = () => ['a.test.mjs', 'spawn-budget.mjs', 'spawn-budget.test.mjs', 'notas.md', 'b.test.mjs'];
  assert.deepEqual(
    guardedTestFiles('D', listado).map((file) => relative('D', file)),
    ['a.test.mjs', 'b.test.mjs'],
  );
  // Un directorio de pruebas vacío devuelve cero archivos, y la prueba de arriba lo convierte en
  // rechazo: la guardia no puede pasar por no haber mirado.
  assert.deepEqual(guardedTestFiles('D', () => []), []);
});

test('FALSIFICACIÓN · la guardia acusa un presupuesto a ojo y no confunde los intencionales', () => {
  const source = [
    'const a = { timeout_ms: 1000 };',
    'const b = { timeout_ms: 0 };',
    'const c = { timeout_ms: 1 };',
    'const d = { timeout_ms: 30_000 };',
    'const e = { timeout_ms: REAL_SPAWN_TIMEOUT_MS };',
  ].join('\n');
  assert.deepEqual(literalBudgetViolations(source), [{ line: 1, value: 1000 }, { line: 4, value: 30000 }]);
  assert.deepEqual(literalBudgetViolations('const f = { timeout_ms: REAL_SPAWN_TIMEOUT_MS };'), []);
});

test('FALSIFICACIÓN · sin lista de intencionales, hasta 0 y 1 son presupuestos acusables', () => {
  // Prueba que la lista es la que decide, no un caso especial escondido en el escáner.
  assert.deepEqual(
    literalBudgetViolations('x = { timeout_ms: 0 }; y = { timeout_ms: 1 };', []),
    [{ line: 1, value: 0 }, { line: 1, value: 1 }],
  );
  assert.deepEqual(INTENTIONAL_BUDGET_LITERALS, [0, 1]);
});

test('FALSIFICACIÓN · un archivo sin presupuestos no inventa violaciones', () => {
  assert.deepEqual(literalBudgetViolations('export const nada = true;\n'), []);
});
