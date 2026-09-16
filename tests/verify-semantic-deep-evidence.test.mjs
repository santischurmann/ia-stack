// verify-semantic-deep-evidence.test.mjs — la revisión profunda, probada sin el corpus externo.
//
// QUE GARANTIZA ESTE GATE, y en qué se diferencia del hermano. `verify-full-evidence-pass` comprueba
// que la pasada AUTOMÁTICA no promueva nada. Éste comprueba lo contrario: que una fila que SÍ dice
// haber leído el archivo lo haya leído de verdad. Por eso es el único de los cuatro que exige que
// cada cita apunte a una línea que existe dentro del archivo pineado — un resumen inventado con
// citas plausibles pasa cualquier otro gate y muere acá.
//
// POR QUE SE PUEDE PROBAR AHORA. La comprobación quedó en `revisarProfunda`, que recibe las líneas
// y los dos artefactos ya leídos, y va a buscar los bytes por un lector inyectado. El corpus real
// son cientos de megas fuera de git: una prueba que lo necesitara no se correría nunca.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { MISSING_ARTIFACT, ResearchArtifactError } from '../research/require-artifact.mjs';
import { REQUIRED_FIELDS, VALID_RELEVANCE, main, revisarProfunda } from '../research/verify-semantic-deep-evidence.mjs';

const BYTES = Buffer.from('uno\ndos\ntres\n');
const SHA = createHash('sha256').update(BYTES).digest('hex');
const LINEAS = BYTES.toString('utf8').split('\n').length; // 4: la última línea vacía cuenta
const COMMIT = 'c'.repeat(40);

const entrada = (over = {}) => ({ source: 'repo-x', path: 'src/a.ts', status: 'PENDING', commit: COMMIT, sha256: SHA, line_count: LINEAS, ...over });

const fila = (over = {}) => ({
  source: 'repo-x',
  path: 'src/a.ts',
  prior_status: 'PENDING',
  status: 'READ',
  commit: COMMIT,
  sha256: SHA,
  line_count: LINEAS,
  purpose: 'para qué existe',
  behavior: 'qué hace cuando corre',
  outputs: 'qué devuelve',
  invariants_limits: 'qué promete y qué no',
  tests: 'con qué se prueba',
  risks: 'qué puede salir mal',
  vcp_relevance_reason: 'por qué le importa a este protocolo',
  interfaces: 'qué expone',
  vcp_relevance: 'DEFER',
  confidence: 0.5,
  citations: ['src/a.ts:1', 'src/a.ts:2'],
  ...over,
});

const ledger = (entries = [entrada()]) => ({ entries });
const manifest = () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] });
const lineas = (filas = [fila()]) => filas.map((f) => JSON.stringify(f));
const io = (over = {}) => ({ corpusRoot: '/corpus', leerBytes: () => BYTES, ...over });

// --- El caso sano --------------------------------------------------------------------------------

test('una fila profunda completa y con citas dentro del archivo no tiene problemas', () => {
  assert.deepEqual(revisarProfunda(lineas(), ledger(), manifest(), io()), []);
});

test('inputs sirve igual que interfaces: son dos formas de decir lo mismo', () => {
  const f = fila({ interfaces: undefined, inputs: 'qué recibe' });
  assert.deepEqual(revisarProfunda(lineas([f]), ledger(), manifest(), io()), []);
});

// --- La forma de la fila --------------------------------------------------------------------------

test('FALSIFICACIÓN · una línea que no es JSON se rechaza por número de línea', () => {
  const problemas = revisarProfunda(['{no es json'], ledger(), manifest(), io());
  assert.match(problemas.join('\n'), /row 1: invalid JSON/u);
});

test('FALSIFICACIÓN · falta cualquiera de los campos obligatorios y se dice cuál', () => {
  // Uno por uno: si alcanzara con que estuvieran «casi todos», un resumen podría omitir justo el
  // que cuesta escribir —los riesgos, los límites— y pasar igual.
  for (const campo of REQUIRED_FIELDS) {
    const problemas = revisarProfunda(lineas([fila({ [campo]: '   ' })]), ledger(), manifest(), io());
    assert.match(problemas.join('\n'), new RegExp(`missing ${campo}`, 'u'), campo);
  }
});

test('FALSIFICACIÓN · sin interfaces ni inputs se rechaza', () => {
  const problemas = revisarProfunda(lineas([fila({ interfaces: undefined })]), ledger(), manifest(), io());
  assert.match(problemas.join('\n'), /missing interfaces or inputs/u);
});

test('FALSIFICACIÓN · un veredicto de relevancia fuera de la lista se rechaza', () => {
  assert.match(revisarProfunda(lineas([fila({ vcp_relevance: 'QUIZAS' })]), ledger(), manifest(), io()).join('\n'), /invalid vcp_relevance/u);
  for (const ok of VALID_RELEVANCE) {
    assert.deepEqual(revisarProfunda(lineas([fila({ vcp_relevance: ok })]), ledger(), manifest(), io()), [], ok);
  }
});

test('FALSIFICACIÓN · una confianza que no es un número entre 0 y 1 se rechaza', () => {
  for (const mala of ['alta', -0.1, 1.1, undefined]) {
    assert.match(revisarProfunda(lineas([fila({ confidence: mala })]), ledger(), manifest(), io()).join('\n'), /invalid confidence/u, String(mala));
  }
  for (const buena of [0, 1]) {
    assert.deepEqual(revisarProfunda(lineas([fila({ confidence: buena })]), ledger(), manifest(), io()), [], String(buena));
  }
});

test('FALSIFICACIÓN · menos de dos citas no es una revisión profunda', () => {
  // Una sola cita se consigue mirando el nombre del archivo. Dos obligan a haber entrado.
  for (const pocas of [[], ['src/a.ts:1'], undefined, 'no es una lista']) {
    assert.match(revisarProfunda(lineas([fila({ citations: pocas })]), ledger(), manifest(), io()).join('\n'), /fewer than two citations/u, JSON.stringify(pocas));
  }
});

// --- Identidad y transición -----------------------------------------------------------------------

test('FALSIFICACIÓN · la transición tiene que ser PENDING -> READ, y nada más', () => {
  for (const roto of [{ prior_status: 'READ' }, { status: 'PROMOTED' }]) {
    assert.match(revisarProfunda(lineas([fila(roto)]), ledger(), manifest(), io()).join('\n'), /status transition must be PENDING -> READ/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una entrada que el ledger ya no tiene en PENDING se rechaza', () => {
  const problemas = revisarProfunda(lineas(), ledger([entrada({ status: 'PROMOTED' })]), manifest(), io());
  assert.match(problemas.join('\n'), /prior ledger status is PROMOTED/u);
});

test('FALSIFICACIÓN · una fila que el ledger no conoce se rechaza y corta ahí', () => {
  const problemas = revisarProfunda(lineas([fila({ path: 'src/inventado.ts' })]), ledger(), manifest(), io());
  assert.match(problemas.join('\n'), /not present in ledger/u);
  assert.doesNotMatch(problemas.join('\n'), /missing purpose/u);
});

test('FALSIFICACIÓN · la misma fila dos veces se rechaza', () => {
  assert.match(revisarProfunda(lineas([fila(), fila()]), ledger(), manifest(), io()).join('\n'), /duplicate row/u);
});

test('FALSIFICACIÓN · commit, hash o cantidad de líneas que no coinciden con el ledger', () => {
  for (const roto of [{ commit: 'z'.repeat(40) }, { sha256: 'z'.repeat(64) }, { line_count: 99 }]) {
    assert.match(revisarProfunda(lineas([fila(roto)]), ledger(), manifest(), io()).join('\n'), /does not match the pinned ledger/u, JSON.stringify(roto));
  }
});

// --- Contra los bytes de verdad ---------------------------------------------------------------------

test('FALSIFICACIÓN · una fuente que el manifiesto no declara se rechaza', () => {
  assert.match(revisarProfunda(lineas(), ledger(), { sources: [] }, io()).join('\n'), /source root missing from manifest/u);
});

test('FALSIFICACIÓN · un archivo del corpus que no se puede abrir se rechaza', () => {
  const problemas = revisarProfunda(lineas(), ledger(), manifest(), io({ leerBytes: () => { throw new Error('ENOENT'); } }));
  assert.match(problemas.join('\n'), /materialized file unreadable/u);
});

test('FALSIFICACIÓN · bytes que no dan el hash del ledger se rechazan', () => {
  const problemas = revisarProfunda(lineas(), ledger(), manifest(), io({ leerBytes: () => Buffer.from('otra cosa') }));
  assert.match(problemas.join('\n'), /source bytes do not match ledger sha256/u);
});

test('FALSIFICACIÓN · una cantidad de líneas distinta de la pineada se rechaza', () => {
  const otros = Buffer.from('uno\ndos\n');
  const sha = createHash('sha256').update(otros).digest('hex');
  const e = ledger([entrada({ sha256: sha, line_count: 99 })]);
  const f = fila({ sha256: sha, line_count: 99, citations: ['src/a.ts:1', 'src/a.ts:2'] });
  assert.match(revisarProfunda(lineas([f]), e, manifest(), io({ leerBytes: () => otros })).join('\n'), /source line_count mismatch/u);
});

test('un ledger sin line_count no exige la cantidad de líneas, y tampoco acota las citas', () => {
  // `null` significa «no se contó», no «cero». Tratarlo como cero rechazaría toda cita.
  const e = ledger([entrada({ line_count: null })]);
  const f = fila({ line_count: null, citations: ['src/a.ts:1', 'src/a.ts:99999'] });
  assert.deepEqual(revisarProfunda(lineas([f]), e, manifest(), io()), []);
});

// --- Las citas, que es lo que este gate hace y los otros no ------------------------------------------

test('FALSIFICACIÓN · una cita a otro archivo, o sin número, no es una cita de esta fila', () => {
  for (const mala of ['otro/archivo.ts:3', 'src/a.ts', 'sin-nada']) {
    const problemas = revisarProfunda(lineas([fila({ citations: ['src/a.ts:1', mala] })]), ledger(), manifest(), io());
    assert.match(problemas.join('\n'), /invalid citation/u, mala);
  }
});

test('FALSIFICACIÓN · una cita a una línea que el archivo no tiene se rechaza', () => {
  // Es el hallazgo que ningún otro gate del expediente puede hacer: un resumen inventado con citas
  // plausibles pasa todos los demás y muere acá.
  for (const fuera of ['src/a.ts:0', `src/a.ts:${LINEAS + 1}`]) {
    const problemas = revisarProfunda(lineas([fila({ citations: ['src/a.ts:1', fuera] })]), ledger(), manifest(), io());
    assert.match(problemas.join('\n'), /citation out of range/u, fuera);
  }
});

// --- El cableado ---------------------------------------------------------------------------------------

test('main sale 0 y dice cuántas filas verificó', () => {
  const salida = [];
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger()),
    leerTexto: () => lineas().join('\n'),
    write: (l) => salida.push(l),
    writeError: () => {},
    ...io(),
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /OK: 1 deep evidence row/u);
});

test('main sale 1, imprime hasta el tope y dice cuántos quedaron afuera', () => {
  const errores = [];
  const muchas = Array.from({ length: 45 }, (_, i) => fila({ path: `src/${i}.ts`, status: 'PROMOTED', citations: [`src/${i}.ts:1`, `src/${i}.ts:2`] }));
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger(muchas.map((f) => entrada({ path: f.path })))),
    leerTexto: () => muchas.map((f) => JSON.stringify(f)).join('\n'),
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.equal(errores.filter((l) => l.startsWith('REJECTED:')).length, 40);
  assert.match(errores.join('\n'), /and 5 more/u);
});

test('main con un insumo ausente lo dice y no revienta', () => {
  const errores = [];
  const code = main([], {
    leerJson: () => { throw new ResearchArtifactError(MISSING_ARTIFACT, 'falta el ledger. Regeneralo con: node research/build-semantic-ledger.mjs'); },
    leerTexto: () => lineas().join('\n'),
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /build-semantic-ledger/u);
});

test('main con la evidencia ausente también lo dice: son dos lecturas distintas', () => {
  const errores = [];
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger()),
    leerTexto: () => { throw new ResearchArtifactError(MISSING_ARTIFACT, 'falta la evidencia. Regeneralo con: node research/build-full-evidence-pass.mjs'); },
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /build-full-evidence-pass/u);
});

test('main deja pasar un error que NO es un insumo ausente', () => {
  assert.throws(() => main([], {
    leerJson: () => { throw new RangeError('otra cosa entera'); },
    leerTexto: () => '',
    write: () => {},
    writeError: () => {},
    ...io(),
  }), /otra cosa entera/u);
});

test('main acepta la ruta de la evidencia por argumento', () => {
  // El script se invoca con un archivo distinto cuando se revisa una tanda suelta.
  const vistas = [];
  main(['/otra/evidencia.ndjson'], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger()),
    leerTexto: (ruta) => { vistas.push(ruta); return lineas().join('\n'); },
    write: () => {},
    writeError: () => {},
    ...io(),
  });
  assert.match(vistas.join('\n'), /otra[\\/]evidencia\.ndjson/u, vistas.join('\n'));
});

// --- Los caminos por defecto ------------------------------------------------------------------------

test('sin lector inyectado va al disco, y el corpus ausente sale como archivo ilegible', () => {
  const problemas = revisarProfunda(lineas(), ledger(), manifest(), { corpusRoot: '/no/existe/en/ningun/lado' });
  assert.match(problemas.join('\n'), /materialized file unreadable/u);
});

test('sin corpusRoot toma el del entorno, y si no hay, el de al lado del repositorio', () => {
  const antes = process.env.VCP_EXTERNAL_RESEARCH_ROOT;
  try {
    process.env.VCP_EXTERNAL_RESEARCH_ROOT = '/desde/el/entorno';
    assert.match(revisarProfunda(lineas(), ledger(), manifest(), {}).join('\n'), /unreadable/u);
    delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    assert.match(revisarProfunda(lineas(), ledger(), manifest(), {}).join('\n'), /unreadable/u);
  } finally {
    if (antes === undefined) delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    else process.env.VCP_EXTERNAL_RESEARCH_ROOT = antes;
  }
});

test('main sin lectores inyectados contesta, no revienta', () => {
  const errores = [];
  const code = main([], { write: () => {}, writeError: (l) => errores.push(l) });
  assert.ok(code === 0 || code === 1, errores.join('\n'));
});

test('un ledger o un manifiesto nulos, o sin sus listas, no revientan', () => {
  // Las cuatro formas de no traer nada. Ninguna puede tirar: son el estado normal cuando el paso
  // anterior no corrio, y el mensaje tiene que hablar de eso y no de una excepcion.
  assert.match(revisarProfunda(lineas(), null, manifest(), io()).join('\n'), /not present in ledger/u);
  assert.match(revisarProfunda(lineas(), {}, manifest(), io()).join('\n'), /not present in ledger/u);
  assert.match(revisarProfunda(lineas(), ledger(), null, io()).join('\n'), /source root missing from manifest/u);
  assert.match(revisarProfunda(lineas(), ledger(), {}, io()).join('\n'), /source root missing from manifest/u);
});

