// verify-semantic-review-index.test.mjs — la primera prueba propia de un verificador de research/.
//
// POR QUE NO EXISTIA. Los cuatro verificadores de `research/` son scripts imperativos de nivel
// superior: leen sus insumos al importarse y terminan con `process.exit`. Importar uno desde una
// prueba corria el gate entero contra archivos que `.gitignore` deja afuera por tamano, asi que no
// habia forma de probarlos sin versionar cientos de megas de corpus. El contrato de cobertura lo
// declaraba como DEUDA, con nombre y apellido, desde el 2026-09-01.
//
// COMO SE CIERRA. La logica de comparacion se separa de la entrada/salida: `revisarIndice` es una
// funcion pura que recibe el indice y el ledger ya leidos y devuelve la lista de problemas. Eso se
// prueba con datos sinteticos de diez lineas, sin corpus y sin disco. `main` queda como el cableado
// -- leer, llamar, imprimir --, y tambien se prueba, con los lectores inyectados.
//
// LO QUE ESTAS PRUEBAS NO HACEN, y hay que decirlo: comprueban que el gate distinga un indice sano
// de uno roto. NO comprueban que el expediente real este bien -- eso lo dice el gate corriendo
// contra sus artefactos de verdad, y esos artefactos no estan en git.

import assert from 'node:assert/strict';
import test from 'node:test';

import { MISSING_ARTIFACT, ResearchArtifactError } from '../research/require-artifact.mjs';
import {
  ALLOWED_MACHINE,
  main,
  porMetodo,
  revisarIndice,
} from '../research/verify-semantic-review-index.mjs';

// --- Datos mínimos, escritos a mano para que cada campo diga por qué está ------------------------

const entrada = (over = {}) => ({
  source: 'un-repo',
  path: 'src/a.ts',
  status: 'PENDING',
  commit: 'a'.repeat(40),
  sha256: 'b'.repeat(64),
  ...over,
});

const fila = (over = {}) => ({
  source: 'un-repo',
  path: 'src/a.ts',
  commit: 'a'.repeat(40),
  sha256: 'b'.repeat(64),
  strict_status: 'PENDING',
  machine_status: 'READ_CANDIDATE',
  review_method: 'static_scan',
  shard: 'shard_1',
  evidence: ['src/a.ts:12'],
  ...over,
});

const ledger = (entries = [entrada()]) => ({ entries });
const indice = (rows = [fila()], over = {}) => ({ total_pending: rows.length, rows, ...over });

// --- El caso sano --------------------------------------------------------------------------------

test('un índice que coincide con el ledger no tiene un solo problema', () => {
  assert.deepEqual(revisarIndice(indice(), ledger()), []);
});

test('sólo se comparan las entradas PENDING: las demás no son del índice', () => {
  // El indice es la cola de revision. Una entrada ya promovida no pertenece ahi, y exigirla haria
  // que el gate rechazara justo cuando el trabajo avanza.
  const l = ledger([entrada(), entrada({ path: 'src/b.ts', status: 'PROMOTED' })]);
  assert.deepEqual(revisarIndice(indice(), l), []);
});

// --- Cada forma de estar roto --------------------------------------------------------------------

test('FALSIFICACIÓN · un total declarado que no es el que hay se rechaza', () => {
  const problemas = revisarIndice(indice([fila()], { total_pending: 9 }), ledger());
  assert.equal(problemas.length > 0, true);
  assert.match(problemas.join('\n'), /total_pending=9/u);
});

test('FALSIFICACIÓN · rows que no es una lista, o con otra cantidad, se rechaza', () => {
  assert.equal(revisarIndice({ total_pending: 1, rows: 'no es una lista' }, ledger()).length > 0, true);
  assert.equal(revisarIndice({ total_pending: 1 }, ledger()).length > 0, true, 'sin rows tampoco');
  assert.equal(revisarIndice(indice([fila(), fila({ path: 'src/b.ts' })]), ledger()).length > 0, true);
});

test('FALSIFICACIÓN · la misma fila dos veces se rechaza: dos copias no son dos revisiones', () => {
  const l = ledger([entrada(), entrada({ path: 'src/b.ts' })]);
  const problemas = revisarIndice(indice([fila(), fila()], { total_pending: 2 }), l);
  assert.match(problemas.join('\n'), /duplicate row/u);
});

test('FALSIFICACIÓN · una fila que el ledger no tiene se rechaza, y no arrastra más errores', () => {
  const problemas = revisarIndice(indice([fila({ path: 'src/inventado.ts' })]), ledger());
  assert.match(problemas.join('\n'), /row not in canonical pending ledger/u);
  // La fila que no existe se saltea: comparar su commit contra nada produciria ruido, no un hallazgo.
  assert.doesNotMatch(problemas.join('\n'), /provenance mismatch/u);
});

test('FALSIFICACIÓN · la procedencia se compara campo por campo', () => {
  for (const campo of ['commit', 'sha256']) {
    const problemas = revisarIndice(indice([fila({ [campo]: 'z'.repeat(40) })]), ledger());
    assert.match(problemas.join('\n'), new RegExp(`${campo}: (?:)?provenance mismatch|${campo} provenance mismatch`, 'u'), campo);
  }
});

test('FALSIFICACIÓN · el índice no puede promover: strict_status se queda en PENDING', () => {
  // Es la invariante entera de este gate. Si el indice pudiera cambiar el estado estricto, la cola
  // de revision se vaciaria sola sin que nadie revisara nada.
  const problemas = revisarIndice(indice([fila({ strict_status: 'PROMOTED' })]), ledger());
  assert.match(problemas.join('\n'), /strict_status must remain PENDING/u);
});

test('FALSIFICACIÓN · un machine_status que no está en la lista se rechaza', () => {
  const problemas = revisarIndice(indice([fila({ machine_status: 'INVENTADO' })]), ledger());
  assert.match(problemas.join('\n'), /invalid machine_status INVENTADO/u);
  // Y todos los permitidos pasan: una lista que rechaza lo que declara aceptar es peor que no tenerla.
  for (const ok of ALLOWED_MACHINE) {
    assert.deepEqual(revisarIndice(indice([fila({ machine_status: ok })]), ledger()), [], ok);
  }
});

test('FALSIFICACIÓN · decir que hubo revisión manual exige el lote profundo que la produce', () => {
  const problemas = revisarIndice(indice([fila({ review_method: 'manual_semantic_batch', shard: 'shard_1' })]), ledger());
  assert.match(problemas.join('\n'), /manual_semantic_batch without deep shard/u);
  assert.deepEqual(revisarIndice(indice([fila({ review_method: 'manual_semantic_batch', shard: 'deep_3' })]), ledger()), []);
});

test('FALSIFICACIÓN · una cita sin número de línea no es una cita', () => {
  for (const mala of ['src/a.ts', 'src/a.ts:', 42, null]) {
    const problemas = revisarIndice(indice([fila({ evidence: [mala] })]), ledger());
    assert.match(problemas.join('\n'), /malformed citation/u, String(mala));
  }
  // Sin campo `evidence` no se revienta: es la ausencia, no una cita rota.
  assert.deepEqual(revisarIndice(indice([fila({ evidence: undefined })]), ledger()), []);
});

test('FALSIFICACIÓN · una entrada PENDING sin fila en el índice se rechaza', () => {
  const l = ledger([entrada(), entrada({ path: 'src/b.ts' })]);
  const problemas = revisarIndice({ total_pending: 2, rows: [fila()] }, l);
  assert.match(problemas.join('\n'), /missing row/u);
});

// --- El resumen -----------------------------------------------------------------------------------

test('el resumen cuenta por método, ordenado, y no inventa métodos que no están', () => {
  const r = porMetodo([fila(), fila({ review_method: 'manual_semantic_batch', shard: 'deep_1' }), fila()]);
  assert.deepEqual(r, { manual_semantic_batch: 1, static_scan: 2 });
  assert.deepEqual(Object.keys(r), ['manual_semantic_batch', 'static_scan'], 'ordenado, para que dos corridas se puedan comparar');
  assert.deepEqual(porMetodo([]), {});
});

// --- El cableado ------------------------------------------------------------------------------------

test('main sale 0 y describe lo que verificó cuando todo cierra', () => {
  const salida = [];
  const code = main([], {
    leer: (ruta) => (String(ruta).includes('review-index') ? indice() : ledger()),
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  const dicho = JSON.parse(salida.join('\n'));
  assert.equal(dicho.ok, true);
  assert.equal(dicho.pending, 1);
  assert.equal(dicho.rows, 1);
  assert.deepEqual(dicho.methods, { static_scan: 1 });
});

test('main sale 1 y dice qué está mal, con un tope para no tapar la terminal', () => {
  const errores = [];
  const muchas = Array.from({ length: 60 }, (_, i) => fila({ path: `src/${i}.ts`, strict_status: 'PROMOTED' }));
  const entradas = muchas.map((f) => entrada({ path: f.path }));
  const code = main([], {
    leer: (ruta) => (String(ruta).includes('review-index') ? indice(muchas, { total_pending: 60 }) : ledger(entradas)),
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  const dicho = JSON.parse(errores.join('\n'));
  assert.equal(dicho.ok, false);
  assert.equal(dicho.errorCount, 60);
  assert.equal(dicho.errors.length, 50, 'se recorta la lista, y el total sigue diciendo cuántos son');
});

test('main trata un insumo que falta como insumo que falta, no como un gate roto', () => {
  // Es el arreglo del 2026-09-01 y no se puede perder en el refactor: estos artefactos NO estan en
  // git a proposito, asi que faltar es lo normal en un clon limpio. Antes salia un stack trace de
  // node:fs, que no deja distinguir «falta el insumo» de «el verificador esta roto».
  const errores = [];
  const code = main([], {
    // El error REAL que produce loadJsonArtifact cuando el archivo no esta. Un Error pelado no
    // sirve de doble: se saltearia la conversion que hace el lector de verdad, y la prueba estaria
    // midiendo el doble en vez del gate.
    leer: () => { throw new ResearchArtifactError(MISSING_ARTIFACT, 'falta el indice. Regeneralo con: node research/consolidate-semantic-review.mjs'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /consolidate-semantic-review|build-semantic-ledger|regener/iu, errores.join('\n'));
});

test('main deja pasar un error que NO es un insumo que falta, en vez de disfrazarlo', () => {
  // Un JSON invalido o un permiso denegado son otra clase de problema y se arreglan distinto.
  // Taparlos como «falta el insumo» mandaria a regenerar algo que ya esta.
  assert.throws(() => main([], {
    leer: () => { throw new RangeError('algo completamente distinto'); },
    write: () => {},
    writeError: () => {},
  }), /algo completamente distinto/u);
});

// --- El camino por defecto --------------------------------------------------------------------------

test('main sin lector inyectado va al disco y contesta, no revienta', () => {
  const dicho = [];
  const code = main([], { write: (l) => dicho.push(l), writeError: (l) => dicho.push(l) });
  assert.ok(code === 0 || code === 1, dicho.join('\n'));
  assert.ok(dicho.length > 0, 'corrió y no dijo nada');
});
