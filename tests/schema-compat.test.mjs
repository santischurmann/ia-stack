// Los schemas de los artefactos: prefijo `ia.`, igualdad exacta, sin compatibilidades viejas.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'schema-compat.mjs');
const modulo = await import(pathToFileURL(script).href);
const { PREFIJO, mismoSchema } = modulo;

test('el prefijo es el que el protocolo declara, y no se adivina', () => {
  assert.equal(PREFIJO, 'ia.');
});

test('el módulo no exporta nada de compatibilidades viejas', () => {
  assert.deepEqual(Object.keys(modulo).sort(), ['PREFIJO', 'mismoSchema']);
});

test('el schema esperado vale, con la misma familia y la misma versión', () => {
  assert.equal(mismoSchema('ia.receipt/v3', 'ia.receipt/v3'), true);
  assert.equal(mismoSchema('ia.index/1', 'ia.index/1'), true);
});

test('la versión y la familia tienen que coincidir', () => {
  assert.equal(mismoSchema('ia.receipt/v2', 'ia.receipt/v3'), false);
  assert.equal(mismoSchema('ia.index/1', 'ia.intake/1'), false);
});

test('FALSIFICACIÓN · cualquier otro prefijo se rechaza', () => {
  for (const impostor of ['xx.receipt/v3', 'ia-stack.receipt/v3', 'IA Stack.receipt/v3', 'IA.receipt/v3', 'iax.receipt/v3', 'receipt/v3']) {
    assert.equal(mismoSchema(impostor, 'ia.receipt/v3'), false, impostor);
  }
});

test('FALSIFICACIÓN · un esperado sin el prefijo no se compara contra nada', () => {
  assert.equal(mismoSchema('xx.receipt/v3', 'xx.receipt/v3'), false);
  assert.equal(mismoSchema('receipt/v3', 'receipt/v3'), false);
});

test('FALSIFICACIÓN · lo que no es una cadena no es un schema', () => {
  for (const malo of [undefined, null, '', 0, 42, {}, [], ['ia.receipt/v3']]) {
    assert.equal(mismoSchema(malo, 'ia.receipt/v3'), false, String(malo));
    assert.equal(mismoSchema('ia.receipt/v3', malo), false, String(malo));
  }
});

test('TODOS los schemas literales de los gates usan el prefijo `ia.`', () => {
  const ajenos = [];
  for (const nombre of readdirSync(join(repoRoot, 'scripts')).filter((n) => n.endsWith('.mjs'))) {
    const fuente = readFileSync(join(repoRoot, 'scripts', nombre), 'utf8');
    for (const [, literal] of fuente.matchAll(/'((?!ia\.)[a-z][a-z0-9-]*\.[a-z0-9-]+\/(?:v)?[0-9]+)'/gu)) {
      if (/^(?:\d+\.)/u.test(literal)) continue;
      ajenos.push(`${nombre}: ${literal}`);
    }
  }
  assert.deepEqual(ajenos, []);
});
