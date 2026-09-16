// verify-full-evidence-pass.test.mjs — la pasada exhaustiva, probada sin el corpus.
//
// QUE GARANTIZA ESTE GATE. Que la pasada automatica cubre 1:1 las entradas PENDING del ledger
// estricto Y QUE NO PROMUEVE NINGUNA. Es un gate de contencion: su trabajo es que una corrida
// automatica no se disfrace de revision. Por eso exige `vcp_relevance: DEFER` y `confidence: 0`
// en cada fila -- una pasada de maquina que declarara una opinion seria exactamente el verde falso
// que esto viene a impedir.
//
// POR QUE SE PUEDE PROBAR AHORA. La comparacion quedo en `revisarEvidencia`, que recibe las filas y
// el ledger ya leidos. El corpus externo -- cientos de megas, fuera de git -- entra por un lector
// inyectado, asi que las pruebas de bytes se hacen con tres bytes de mentira.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { MISSING_ARTIFACT, ResearchArtifactError } from '../research/require-artifact.mjs';
import { main, revisarEvidencia } from '../research/verify-full-evidence-pass.mjs';

const SHA_A = 'a'.repeat(64);
const COMMIT = 'c'.repeat(40);

const entrada = (over = {}) => ({ source: 'repo-x', path: 'src/a.ts', status: 'PENDING', commit: COMMIT, sha256: SHA_A, line_count: 10, ...over });
const fila = (over = {}) => ({
  source: 'repo-x',
  path: 'src/a.ts',
  prior_status: 'PENDING',
  strict_status: 'PENDING',
  review_status: 'ASSISTED_STRUCTURAL',
  commit: COMMIT,
  sha256: SHA_A,
  line_count: 10,
  vcp_relevance: 'DEFER',
  confidence: 0,
  citations: ['src/a.ts:3'],
  bytes_read: false,
  ...over,
});
const ledger = (entries = [entrada()]) => ({ entries });
const manifest = () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] });
const io = (over = {}) => ({ corpusRoot: '/corpus', leerBytes: () => Buffer.from('hola'), ...over });

// --- El caso sano --------------------------------------------------------------------------------

test('una pasada que cubre 1:1 las entradas PENDING no tiene problemas', () => {
  assert.deepEqual(revisarEvidencia([fila()], ledger(), manifest(), io()), []);
});

test('las entradas que ya no están PENDING no se exigen', () => {
  const l = ledger([entrada(), entrada({ path: 'src/b.ts', status: 'PROMOTED' })]);
  assert.deepEqual(revisarEvidencia([fila()], l, manifest(), io()), []);
});

// --- Contención: la pasada automática no puede promover ------------------------------------------

test('FALSIFICACIÓN · cualquier promoción de estado se rechaza', () => {
  // Los tres campos, uno por uno: si alcanzara con que UNO estuviera bien, una fila podria promover
  // por los otros dos y pasar.
  for (const roto of [{ prior_status: 'PROMOTED' }, { strict_status: 'PROMOTED' }, { review_status: 'HUMAN_SEMANTIC' }]) {
    const problemas = revisarEvidencia([fila(roto)], ledger(), manifest(), io());
    assert.match(problemas.join('\n'), /unsafe status promotion/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una pasada de máquina que declara una opinión se rechaza', () => {
  // `DEFER` y confianza cero son la contencion entera: una corrida automatica no opina. Si pudiera,
  // el expediente quedaria lleno de veredictos que nadie tomo.
  for (const roto of [{ vcp_relevance: 'ADOPT' }, { confidence: 0.8 }]) {
    const problemas = revisarEvidencia([fila(roto)], ledger(), manifest(), io());
    assert.match(problemas.join('\n'), /must remain conservative/u, JSON.stringify(roto));
  }
});

// --- Identidad y procedencia ----------------------------------------------------------------------

test('FALSIFICACIÓN · la identidad pineada se compara entera', () => {
  for (const roto of [{ commit: 'z'.repeat(40) }, { sha256: 'z'.repeat(64) }, { line_count: 11 }]) {
    const problemas = revisarEvidencia([fila(roto)], ledger(), manifest(), io());
    assert.match(problemas.join('\n'), /pinned identity mismatch/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una fila que el ledger no tiene se rechaza y no arrastra más ruido', () => {
  const problemas = revisarEvidencia([fila({ path: 'src/inventado.ts' })], ledger(), manifest(), io());
  assert.match(problemas.join('\n'), /not a current PENDING entry/u);
  assert.doesNotMatch(problemas.join('\n'), /pinned identity/u);
});

test('FALSIFICACIÓN · la misma fila dos veces se rechaza', () => {
  const l = ledger([entrada(), entrada({ path: 'src/b.ts' })]);
  assert.match(revisarEvidencia([fila(), fila()], l, manifest(), io()).join('\n'), /duplicate row/u);
});

test('FALSIFICACIÓN · una fila sin una sola cita observable se rechaza', () => {
  for (const roto of [{ citations: [] }, { citations: undefined }, { citations: 'no es una lista' }]) {
    assert.match(revisarEvidencia([fila(roto)], ledger(), manifest(), io()).join('\n'), /no observable citation/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una entrada PENDING sin fila, y una cuenta que no cierra, se rechazan', () => {
  const l = ledger([entrada(), entrada({ path: 'src/b.ts' })]);
  const problemas = revisarEvidencia([fila()], l, manifest(), io());
  assert.match(problemas.join('\n'), /missing row/u);
  assert.match(problemas.join('\n'), /row count 1 != pending count 2/u);
});

// --- Los bytes ------------------------------------------------------------------------------------

test('decir que se leyeron los bytes obliga a que el hash del archivo coincida', () => {
  // Es la unica afirmacion de esta pasada que se puede comprobar contra el mundo, asi que se
  // comprueba: `bytes_read: true` con un hash que no da es una lectura que no ocurrio.
  const bytes = Buffer.from('contenido');
  const real = createHash('sha256').update(bytes).digest('hex');
  const e = ledger([entrada({ sha256: real })]);
  const f = fila({ sha256: real, bytes_read: true, observed_sha256: real });
  assert.deepEqual(revisarEvidencia([f], e, manifest(), io({ leerBytes: () => bytes })), []);

  const mal = revisarEvidencia([fila({ sha256: real, bytes_read: true, observed_sha256: 'z'.repeat(64) })], e, manifest(), io({ leerBytes: () => bytes }));
  assert.match(mal.join('\n'), /bytes\/hash mismatch/u);
});

test('FALSIFICACIÓN · bytes_read en true sobre un archivo que no se puede abrir se rechaza', () => {
  const problemas = revisarEvidencia([fila({ bytes_read: true })], ledger(), manifest(), io({ leerBytes: () => { throw new Error('ENOENT: no such file'); } }));
  assert.match(problemas.join('\n'), /bytes_read=true but file unreadable/u);
});

test('una fuente que el manifiesto no declara no puede armar la ruta, y eso se dice', () => {
  // Sin `root_dir` no hay forma de ir a buscar el archivo. Antes se armaba una ruta con `undefined`
  // adentro y el error salia como «archivo ilegible», que manda a mirar el disco en vez del manifiesto.
  const problemas = revisarEvidencia([fila({ bytes_read: true })], ledger(), { sources: [] }, io());
  assert.equal(problemas.length > 0, true);
  assert.match(problemas.join('\n'), /manifiesto|manifest|root_dir/iu, problemas.join('\n'));
});

// --- El cableado ------------------------------------------------------------------------------------

test('main sale 0 y dice cuántas entradas cubrió', () => {
  const salida = [];
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger()),
    leerTexto: () => JSON.stringify(fila()),
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /OK: 1 PENDING entries covered 1:1/u);
});

test('main sale 1, lista los problemas y recorta con una línea que dice cuántos faltan', () => {
  const errores = [];
  const muchas = Array.from({ length: 45 }, (_, i) => fila({ path: `src/${i}.ts`, strict_status: 'PROMOTED' }));
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger(muchas.map((f) => entrada({ path: f.path })))),
    leerTexto: () => muchas.map((f) => JSON.stringify(f)).join('\n'),
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.equal(errores.filter((l) => l.startsWith('REJECTED:')).length, 40, 'se imprimen 40 y no más');
  assert.match(errores.join('\n'), /and 5 more/u);
});

test('main trata un insumo que falta como insumo que falta', () => {
  const errores = [];
  const code = main([], {
    leerJson: () => { throw new ResearchArtifactError(MISSING_ARTIFACT, 'falta el ledger. Regeneralo con: node research/build-semantic-ledger.mjs'); },
    leerTexto: () => '',
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /regener/iu);
});

test('main trata una evidencia ausente igual que un ledger ausente', () => {
  // Son dos lecturas distintas y las dos pueden faltar. Si sólo una estuviera cubierta, la otra
  // saldría como stack trace, que es el modo de falla que este archivo ya arregló una vez.
  const errores = [];
  const code = main([], {
    leerJson: (ruta) => (String(ruta).includes('manifest') ? manifest() : ledger()),
    leerTexto: () => { throw new ResearchArtifactError(MISSING_ARTIFACT, 'falta la evidencia. Regeneralo con: node research/build-full-evidence-pass.mjs'); },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /build-full-evidence-pass/u);
});

test('main deja pasar un error que NO es un insumo que falta', () => {
  assert.throws(() => main([], {
    leerJson: () => { throw new RangeError('otra cosa entera'); },
    leerTexto: () => '',
    write: () => {},
    writeError: () => {},
  }), /otra cosa entera/u);
});

// --- Los caminos por defecto: lo que corre cuando nadie inyecta nada ------------------------------

test('sin lector inyectado va al disco de verdad, y un archivo que no está no revienta', () => {
  // `bytes_read: true` con el corpus ausente es el caso normal de un clon limpio: tiene que salir
  // como «archivo ilegible», nunca como excepción sin manejar.
  const problemas = revisarEvidencia([fila({ bytes_read: true })], ledger(), manifest(), { corpusRoot: '/no/existe/en/ningun/lado' });
  assert.match(problemas.join('\n'), /bytes_read=true but file unreadable/u);
});

test('sin corpusRoot toma el del entorno, y si no hay, el de al lado del repositorio', () => {
  const antes = process.env.VCP_EXTERNAL_RESEARCH_ROOT;
  try {
    process.env.VCP_EXTERNAL_RESEARCH_ROOT = '/desde/el/entorno';
    assert.match(revisarEvidencia([fila({ bytes_read: true })], ledger(), manifest(), {}).join('\n'), /unreadable/u);
    delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    assert.match(revisarEvidencia([fila({ bytes_read: true })], ledger(), manifest(), {}).join('\n'), /unreadable/u);
  } finally {
    if (antes === undefined) delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    else process.env.VCP_EXTERNAL_RESEARCH_ROOT = antes;
  }
});

test('main sin lectores inyectados contesta que faltan los insumos, no revienta', () => {
  const errores = [];
  const code = main([], { write: () => {}, writeError: (l) => errores.push(l) });
  assert.ok(code === 0 || code === 1, errores.join('\n'));
});

test('un manifiesto sin `sources` no revienta: es una ausencia, no un dato roto', () => {
  // Aparece cuando el paso anterior fallo. Reventar aca daria un mensaje que habla de otra cosa.
  assert.match(revisarEvidencia([fila({ bytes_read: true })], ledger(), {}, io()).join('\n'), /root_dir/u);
});

