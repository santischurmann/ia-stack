// verify-semantic-functional-ledger.test.mjs — la revisión funcional, probada sin el corpus.
//
// QUE GARANTIZA ESTE GATE, y es el más estricto de los cuatro. Cada fila declara de qué CLASE es
// —`TEXT_FUNCTIONAL`, que leyó el texto entero, o `STATIC_REVIEWED`, que sólo pudo mirar metadatos
// de un binario— y el gate exige que la clase y lo que la fila afirma sean coherentes entre sí.
// Las dos clases tienen que declarar `semantic_claim: false`: una lectura de máquina, por completa
// que sea, no es un juicio humano, y este gate existe para que no se pueda decir que lo es.
//
// LA REGLA DE LAS CITAS, que es la parte pensada. Un archivo de UNA línea tiene un solo localizador
// verdadero: exigir dos forzaría a inventar el segundo. Por eso el mínimo es dos sólo cuando el
// propio barrido observó dos líneas distintas o más. Es la diferencia entre un gate que fuerza
// evidencia y uno que fuerza a fabricarla.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

import {
  DEFAULT_EVIDENCE,
  INDEX_FILE,
  entradasPendientes,
  leerEvidenciaDelDisco,
  leerIndiceDelDisco,
  leerJsonSiEsta,
  main,
  raicesPorFuente,
  revisarFuncional,
  rutaDeEvidencia,
} from '../research/verify-semantic-functional-ledger.mjs';

const BYTES = Buffer.from('uno\ndos\ntres\n');
const SHA = createHash('sha256').update(BYTES).digest('hex');
const LINEAS = BYTES.toString('utf8').split('\n').length; // 4
const COMMIT = 'c'.repeat(40);

const entrada = (over = {}) => ({ source: 'repo-x', path: 'src/a.ts', status: 'PENDING', commit: COMMIT, sha256: SHA, line_count: LINEAS, ...over });

const texto = (over = {}) => ({
  source: 'repo-x',
  path: 'src/a.ts',
  prior_status: 'PENDING',
  resolution_status: 'FUNCTIONAL_SCAN',
  analysis_class: 'TEXT_FUNCTIONAL',
  semantic_depth: 'deterministic_observation',
  semantic_claim: false,
  sha256: SHA,
  observed_sha256: SHA,
  commit: COMMIT,
  line_count: LINEAS,
  observed_line_count: LINEAS,
  bytes_read: true,
  full_content_scanned: true,
  purpose: 'para qué existe',
  behavior: 'qué hace',
  invariants_limits: 'qué promete y qué no',
  vcp_relevance: 'DEFER',
  observations: { anchors: [{ line: 1 }, { line: 3 }] },
  citations: ['src/a.ts:1', 'src/a.ts:3'],
  ...over,
});

const estatico = (over = {}) => ({
  ...texto(),
  resolution_status: 'STATIC_REVIEWED',
  analysis_class: 'STATIC_REVIEWED',
  semantic_depth: 'metadata_only',
  observed_line_count: null,
  observations: {},
  citations: [],
  metadata_locator: 'src/a.ts#bytes:0-13',
  ...over,
});

const pendientes = (entries = [entrada()]) => entries;
const raices = () => new Map([['repo-x', 'repo-x']]);
const lineas = (filas = [texto()]) => filas.map((f) => JSON.stringify(f));
const io = (over = {}) => ({ corpusRoot: '/corpus', leerBytes: () => BYTES, ...over });

// --- El caso sano ---------------------------------------------------------------------------------

test('una fila de texto completa no tiene problemas', () => {
  assert.deepEqual(revisarFuncional(lineas(), pendientes(), raices(), io()), []);
});

test('una fila estática de un binario tampoco', () => {
  assert.deepEqual(revisarFuncional(lineas([estatico()]), pendientes(), raices(), io()), []);
});

// --- Las dos clases, y su coherencia interna -------------------------------------------------------

test('FALSIFICACIÓN · una clase o una resolución fuera de la lista se rechazan', () => {
  assert.match(revisarFuncional(lineas([texto({ resolution_status: 'INVENTADO' })]), pendientes(), raices(), io()).join('\n'), /invalid resolution_status/u);
  assert.match(revisarFuncional(lineas([texto({ analysis_class: 'INVENTADO' })]), pendientes(), raices(), io()).join('\n'), /invalid analysis_class/u);
});

test('FALSIFICACIÓN · la clase y la resolución tienen que decir lo mismo', () => {
  // Mezclarlas es como se cuela una fila que dice haber leído el texto y sólo miró metadatos.
  assert.match(revisarFuncional(lineas([texto({ resolution_status: 'STATIC_REVIEWED' })]), pendientes(), raices(), io()).join('\n'), /text row must use FUNCTIONAL_SCAN/u);
  assert.match(revisarFuncional(lineas([estatico({ resolution_status: 'FUNCTIONAL_SCAN' })]), pendientes(), raices(), io()).join('\n'), /static row must use STATIC_REVIEWED/u);
});

test('FALSIFICACIÓN · ninguna clase puede reclamar juicio semántico humano', () => {
  // Es la invariante entera de este gate: una lectura de máquina, por completa que sea, no es un
  // juicio humano. Si `semantic_claim: true` pasara, el expediente diría que alguien revisó.
  for (const roto of [{ semantic_claim: true }, { semantic_depth: 'human_review' }]) {
    assert.match(revisarFuncional(lineas([texto(roto)]), pendientes(), raices(), io()).join('\n'), /disclaim human semantic judgment/u, JSON.stringify(roto));
    assert.match(revisarFuncional(lineas([estatico(roto)]), pendientes(), raices(), io()).join('\n'), /metadata-only/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · una fila estática sin su localizador de bytes se rechaza', () => {
  for (const roto of [{ metadata_locator: undefined }, { metadata_locator: 'otro/archivo#bytes:0-13' }]) {
    assert.match(revisarFuncional(lineas([estatico(roto)]), pendientes(), raices(), io()).join('\n'), /missing byte metadata locator/u, JSON.stringify(roto));
  }
});

// --- Identidad ---------------------------------------------------------------------------------------

test('FALSIFICACIÓN · prior_status que no sea PENDING se rechaza', () => {
  assert.match(revisarFuncional(lineas([texto({ prior_status: 'READ' })]), pendientes(), raices(), io()).join('\n'), /prior_status must be PENDING/u);
});

test('FALSIFICACIÓN · la identidad pineada se compara entera, y el hash observado aparte', () => {
  for (const roto of [{ sha256: 'z'.repeat(64) }, { commit: 'z'.repeat(40) }, { line_count: 99 }]) {
    assert.match(revisarFuncional(lineas([texto(roto)]), pendientes(), raices(), io()).join('\n'), /pinned identity mismatch/u, JSON.stringify(roto));
  }
  assert.match(revisarFuncional(lineas([texto({ observed_sha256: 'z'.repeat(64) })]), pendientes(), raices(), io()).join('\n'), /observed sha256 mismatch/u);
});

test('FALSIFICACIÓN · decir que se leyeron los bytes es obligatorio, y en los dos campos', () => {
  for (const roto of [{ bytes_read: false }, { full_content_scanned: false }]) {
    assert.match(revisarFuncional(lineas([texto(roto)]), pendientes(), raices(), io()).join('\n'), /full byte scan not declared/u, JSON.stringify(roto));
  }
});

test('FALSIFICACIÓN · falta cualquiera de los tres textos obligatorios, o la relevancia', () => {
  assert.match(revisarFuncional(lineas([texto({ purpose: '  ' })]), pendientes(), raices(), io()).join('\n'), /missing purpose/u);
  assert.match(revisarFuncional(lineas([texto({ behavior: undefined })]), pendientes(), raices(), io()).join('\n'), /missing behavior/u);
  assert.match(revisarFuncional(lineas([texto({ invariants_limits: '' })]), pendientes(), raices(), io()).join('\n'), /missing limits/u);
  assert.match(revisarFuncional(lineas([texto({ vcp_relevance: 'QUIZAS' })]), pendientes(), raices(), io()).join('\n'), /invalid relevance/u);
  assert.match(revisarFuncional(lineas([texto({ vcp_relevance: 42 })]), pendientes(), raices(), io()).join('\n'), /invalid relevance/u);
});

// --- La regla de las citas, que es la parte pensada -------------------------------------------------

test('un archivo de una sola línea observada exige UNA cita, no dos', () => {
  // Exigir dos sobre un archivo de una línea forzaría a inventar la segunda. Un gate que fuerza a
  // fabricar evidencia es peor que uno que no exige nada.
  const f = texto({ observations: { anchors: [{ line: 1 }] }, citations: ['src/a.ts:1'] });
  assert.deepEqual(revisarFuncional(lineas([f]), pendientes(), raices(), io()), []);
});

test('FALSIFICACIÓN · con dos o más líneas observadas, una sola cita no alcanza', () => {
  const f = texto({ citations: ['src/a.ts:1'] });
  assert.match(revisarFuncional(lineas([f]), pendientes(), raices(), io()).join('\n'), /insufficient citations/u);
});

test('una fila estática no necesita citas: no hay líneas que citar en un binario', () => {
  assert.deepEqual(revisarFuncional(lineas([estatico({ citations: [] })]), pendientes(), raices(), io()), []);
});

test('observations que no son listas, o sin línea entera, no cuentan como líneas observadas', () => {
  // Cuentan las lineas que el barrido vio de verdad. Un `observations` con basura adentro no puede
  // subir el minimo de citas: eso convertiria un dato roto en una exigencia mas dura.
  const f = texto({ observations: { a: 'no es una lista', b: [{ line: 'dos' }, { sin: 'line' }] }, citations: ['src/a.ts:1'] });
  assert.deepEqual(revisarFuncional(lineas([f]), pendientes(), raices(), io()), []);
});

test('FALSIFICACIÓN · una cita a otro archivo, sin número, o fuera de rango', () => {
  for (const mala of ['otro.ts:1', 'src/a.ts', 'src/a.ts:0', `src/a.ts:${LINEAS + 1}`]) {
    const f = texto({ citations: ['src/a.ts:1', mala] });
    assert.match(revisarFuncional(lineas([f]), pendientes(), raices(), io()).join('\n'), /malformed citation|citation out of range/u, mala);
  }
});

test('sin observed_line_count el tope de las citas sale del ledger', () => {
  const f = texto({ observed_line_count: null, citations: ['src/a.ts:1', `src/a.ts:${LINEAS + 5}`] });
  assert.match(revisarFuncional(lineas([f]), pendientes(), raices(), io()).join('\n'), /citation out of range/u);
});

// --- Contra los bytes ---------------------------------------------------------------------------------

test('FALSIFICACIÓN · sin raíz en el manifiesto, con el archivo ilegible, o con bytes que no dan', () => {
  assert.match(revisarFuncional(lineas(), pendientes(), new Map(), io()).join('\n'), /source root missing/u);
  assert.match(revisarFuncional(lineas(), pendientes(), raices(), io({ leerBytes: () => { throw new Error('ENOENT'); } })).join('\n'), /cannot read corpus file/u);
  assert.match(revisarFuncional(lineas(), pendientes(), raices(), io({ leerBytes: () => Buffer.from('otra cosa') })).join('\n'), /corpus bytes differ/u);
});

test('FALSIFICACIÓN · una cantidad de líneas observada que no es la del archivo', () => {
  const f = texto({ observed_line_count: 99, citations: ['src/a.ts:1', 'src/a.ts:3'] });
  assert.match(revisarFuncional(lineas([f]), pendientes(), raices(), io()).join('\n'), /observed line count mismatch/u);
});

// --- Cobertura 1:1 --------------------------------------------------------------------------------------

test('FALSIFICACIÓN · líneas rotas, duplicadas, ajenas o faltantes', () => {
  assert.match(revisarFuncional(['{no json'], pendientes(), raices(), io()).join('\n'), /row 1: invalid JSON/u);
  assert.match(revisarFuncional(lineas([texto(), texto()]), pendientes(), raices(), io()).join('\n'), /duplicate row/u);
  assert.match(revisarFuncional(lineas([texto({ path: 'src/otro.ts' })]), pendientes(), raices(), io()).join('\n'), /not a current PENDING entry/u);
  const dos = pendientes([entrada(), entrada({ path: 'src/b.ts' })]);
  const faltante = revisarFuncional(lineas(), dos, raices(), io()).join('\n');
  assert.match(faltante, /missing evidence row/u);
  assert.match(faltante, /row count 1 != pending count 2/u);
});

// --- Los dos caminos de entrada ---------------------------------------------------------------------------

test('las entradas pendientes salen del ledger cuando hay ledger', () => {
  const l = { entries: [entrada(), entrada({ path: 'src/b.ts', status: 'PROMOTED' })] };
  assert.deepEqual(entradasPendientes(l, null).map((e) => e.path), ['src/a.ts']);
});

test('sin ledger, el índice hace de ledger y todas sus entradas cuentan como PENDING', () => {
  // El ledger es una salida regenerable que puede no estar. El índice comprimido es el respaldo, y
  // sus entradas son por definición las que faltan revisar.
  const i = { entries: [{ source: 'repo-x', path: 'src/a.ts' }] };
  const p = entradasPendientes(null, i);
  assert.equal(p.length, 1);
  assert.equal(p[0].status, 'PENDING');
});

test('las raíces salen del manifiesto, y si no hay manifiesto del propio índice', () => {
  assert.deepEqual([...raicesPorFuente({ sources: [{ slug: 'a', root_dir: 'ra' }] }, null)], [['a', 'ra']]);
  const i = { entries: [{ source: 'b', source_root: 'rb' }, { source: 'c' }] };
  assert.deepEqual([...raicesPorFuente(null, i)], [['b', 'rb']], 'una entrada sin raíz no aporta una raíz vacía');
});

// --- El cableado -------------------------------------------------------------------------------------------

test('main sale 0 y cuenta cuántas de cada clase verificó', () => {
  const salida = [];
  const code = main([], {
    leerLedger: () => ({ entries: [entrada(), entrada({ path: 'src/b.ts' })] }),
    leerManifest: () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] }),
    leerIndice: () => null,
    leerEvidencia: () => lineas([texto(), estatico({ path: 'src/b.ts', metadata_locator: 'src/b.ts#bytes:0-13' })]).join('\n'),
    write: (l) => salida.push(l),
    writeError: () => {},
    ...io(),
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /OK: 2\/2 entries verified 1:1; 1 full-text functional, 1 opaque\/static/u);
});

test('main sale 1, imprime hasta el tope y dice cuántos quedaron afuera', () => {
  const errores = [];
  const muchas = Array.from({ length: 65 }, (_, i) => texto({ path: `src/${i}.ts`, prior_status: 'READ', citations: [`src/${i}.ts:1`, `src/${i}.ts:3`] }));
  const code = main([], {
    leerLedger: () => ({ entries: muchas.map((f) => entrada({ path: f.path })) }),
    leerManifest: () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] }),
    leerIndice: () => null,
    leerEvidencia: () => muchas.map((f) => JSON.stringify(f)).join('\n'),
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.equal(errores.filter((l) => l.startsWith('REJECTED:')).length, 60);
  assert.match(errores.join('\n'), /and 5 more/u);
});

test('sin ledger y sin índice no se inventa un veredicto: se dice qué falta y cómo regenerarlo', () => {
  // Los dos están fuera de git a propósito. Antes esto salía como stack trace de node:fs, que no
  // deja distinguir «falta el insumo» de «el verificador está roto».
  const errores = [];
  const code = main([], {
    leerLedger: () => null,
    leerManifest: () => null,
    leerIndice: () => null,
    leerEvidencia: () => '',
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /build-semantic-ledger|build-semantic-functional-ledger/u, errores.join('\n'));
});

test('una evidencia ilegible se reporta como tal, no como cero filas correctas', () => {
  // Es la diferencia entre «no había nada que revisar» y «no se pudo leer». La primera sale verde.
  const errores = [];
  const code = main([], {
    leerLedger: () => ({ entries: [entrada()] }),
    leerManifest: () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] }),
    leerIndice: () => null,
    leerEvidencia: () => { throw new Error('EACCES: permission denied'); },
    write: () => {},
    writeError: (l) => errores.push(l),
    ...io(),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /evidence unreadable/u);
});

// --- Los caminos por defecto y los bordes de los dos respaldos ------------------------------------

test('sin ledger ni índice, las listas salen vacías en vez de reventar', () => {
  // Los dos son opcionales y los dos pueden faltar. `null` y un objeto sin `entries` son dos formas
  // distintas de no traer nada, y ninguna puede tirar.
  assert.deepEqual(entradasPendientes(null, null), []);
  assert.deepEqual(entradasPendientes(null, {}), []);
  assert.deepEqual(entradasPendientes({}, null), []);
  assert.deepEqual([...raicesPorFuente(null, null)], []);
  assert.deepEqual([...raicesPorFuente(null, {})], []);
  assert.deepEqual([...raicesPorFuente({}, null)], []);
});

test('una fila sin observations ni citations no revienta: son ausencias, no datos rotos', () => {
  const f = texto({ observations: undefined, citations: undefined });
  const problemas = revisarFuncional(lineas([f]), pendientes(), raices(), io());
  assert.match(problemas.join('\n'), /insufficient citations/u);
});

test('sin lector inyectado va al disco, y el corpus ausente sale como archivo ilegible', () => {
  assert.match(revisarFuncional(lineas(), pendientes(), raices(), { corpusRoot: '/no/existe/en/ningun/lado' }).join('\n'), /cannot read corpus file/u);
});

test('sin corpusRoot toma el del entorno, y si no hay, el de al lado del repositorio', () => {
  const antes = process.env.VCP_EXTERNAL_RESEARCH_ROOT;
  try {
    process.env.VCP_EXTERNAL_RESEARCH_ROOT = '/desde/el/entorno';
    assert.match(revisarFuncional(lineas(), pendientes(), raices(), {}).join('\n'), /cannot read corpus file/u);
    delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    assert.match(revisarFuncional(lineas(), pendientes(), raices(), {}).join('\n'), /cannot read corpus file/u);
  } finally {
    if (antes === undefined) delete process.env.VCP_EXTERNAL_RESEARCH_ROOT;
    else process.env.VCP_EXTERNAL_RESEARCH_ROOT = antes;
  }
});

test('main sin lectores inyectados contesta, no revienta', () => {
  const dicho = [];
  const code = main([], { write: (l) => dicho.push(l), writeError: (l) => dicho.push(l) });
  assert.ok(code === 0 || code === 1, dicho.join('\n'));
  assert.ok(dicho.length > 0, 'corrió y no dijo nada');
});

test('main acepta la ruta de la evidencia por argumento, comprimida o no', () => {
  const vistas = [];
  main(['/otra/evidencia.ndjson'], {
    leerLedger: () => ({ entries: [entrada()] }),
    leerManifest: () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] }),
    leerIndice: () => null,
    leerEvidencia: (ruta) => { vistas.push(ruta); return lineas().join('\n'); },
    write: () => {},
    writeError: () => {},
    ...io(),
  });
  assert.match(vistas.join('\n'), /otra[\\/]evidencia\.ndjson/u, vistas.join('\n'));
});

test('leerJsonSiEsta devuelve null en vez de tirar cuando el archivo no está', () => {
  // Estos artefactos NO estan en git a proposito, asi que ausente es el caso normal y no un error.
  assert.equal(leerJsonSiEsta(join(repoRoot, 'no-existe-en-ningun-lado.json')), null);
  // Y cuando esta, lo lee.
  assert.equal(typeof leerJsonSiEsta(join(repoRoot, 'package.json')), 'object');
});

test('sin ledger, el índice se busca solo: plano primero y comprimido después', () => {
  // El camino por defecto que corre en la maquina de una persona. El veredicto depende de que haya
  // en el disco; lo que se comprueba es que conteste en vez de reventar.
  const dicho = [];
  const code = main([], {
    leerLedger: () => null,
    write: (l) => dicho.push(l),
    writeError: (l) => dicho.push(l),
  });
  assert.ok(code === 0 || code === 1, dicho.join('\n'));
});

test('una evidencia comprimida se descomprime, y una que no existe se reporta', () => {
  // Las dos ramas del lector por defecto: `.gz` pasa por gunzip y el resto se lee derecho.
  for (const ruta of [`${DEFAULT_EVIDENCE}.no-existe.gz`, `${DEFAULT_EVIDENCE}.no-existe`]) {
    const dicho = [];
    const code = main([ruta], {
      leerLedger: () => ({ entries: [entrada()] }),
      leerManifest: () => ({ sources: [{ slug: 'repo-x', root_dir: 'repo-x' }] }),
      leerIndice: () => null,
      write: (l) => dicho.push(l),
      writeError: (l) => dicho.push(l),
      ...io(),
    });
    assert.equal(code, 1, dicho.join('\n'));
    assert.match(dicho.join('\n'), /evidence unreadable/u, ruta);
  }
});

test('sin argumento, la ruta de la evidencia sale del disco: plano si está, comprimido si no', () => {
  const dicho = [];
  const code = main([], {
    leerLedger: () => ({ entries: [] }),
    leerManifest: () => ({ sources: [] }),
    leerIndice: () => null,
    write: (l) => dicho.push(l),
    writeError: (l) => dicho.push(l),
  });
  assert.ok(code === 0 || code === 1, dicho.join('\n'));
});

// --- «Plano si está, comprimido si no»: los dos caminos, no el de esta máquina --------------------

test('el índice sale del plano cuando está, sin mirar el comprimido', () => {
  const vistos = [];
  const indice = leerIndiceDelDisco({
    existe: (f) => { vistos.push(f); return f === INDEX_FILE; },
    leerArchivo: () => JSON.stringify({ entries: [{ source: 'a', path: 'b' }] }),
  });
  assert.deepEqual(indice.entries.length, 1);
  assert.equal(vistos.includes(`${INDEX_FILE}.gz`), false, 'con el plano a mano no hay por qué mirar el comprimido');
});

test('sin el plano, el índice sale del comprimido', () => {
  const indice = leerIndiceDelDisco({
    existe: (f) => f === `${INDEX_FILE}.gz`,
    leerArchivo: () => gzipSync(Buffer.from(JSON.stringify({ entries: [{ source: 'a', path: 'b' }] }))),
  });
  assert.equal(indice.entries.length, 1);
});

test('sin ninguno de los dos, el índice es null y no una excepción', () => {
  assert.equal(leerIndiceDelDisco({ existe: () => false, leerArchivo: () => { throw new Error('no debería leerse'); } }), null);
});

test('la evidencia se descomprime cuando viene comprimida, y se lee derecho cuando no', () => {
  assert.equal(leerEvidenciaDelDisco('/x/e.ndjson.gz', { leerArchivo: () => gzipSync(Buffer.from('una línea')) }), 'una línea');
  assert.equal(leerEvidenciaDelDisco('/x/e.ndjson', { leerArchivo: () => 'una línea' }), 'una línea');
});

test('la ruta de la evidencia: el argumento manda, y si no, plana si está y comprimida si no', () => {
  assert.match(rutaDeEvidencia(['/otra/e.ndjson'], { existe: () => false }), /otra[\\/]e\.ndjson/u);
  assert.equal(rutaDeEvidencia([], { existe: () => true }), DEFAULT_EVIDENCE);
  assert.equal(rutaDeEvidencia([], { existe: () => false }), `${DEFAULT_EVIDENCE}.gz`);
});

