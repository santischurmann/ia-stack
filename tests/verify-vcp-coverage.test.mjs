import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const coverageGate = join(repoRoot, 'scripts', 'verify-vcp-coverage.mjs');
const { evaluateCoverageRun, fingerprintScripts, listMjsScripts, main, parseScriptCoverage, runCoverage } = await import(pathToFileURL(coverageGate).href);

const perfectCoverage = `
ℹ start of coverage report
ℹ  verify-example.mjs | 100.00 | 100.00 | 100.00 |
ℹ  another-script.mjs | 100.00 | 100.00 | 100.00 |
ℹ end of coverage report
`;

function fakeResult({ status = 0, stdout = perfectCoverage, stderr = '', error } = {}) {
  return { status, stdout, stderr, error };
}

function currentPerfectCoverage(overrides = {}) {
  // node agrupa por directorio: una cabecera con el nombre de la carpeta y las columnas vacias, y
  // debajo cada archivo con el nombre a secas. El fixture tiene que tener esa forma o no es la
  // salida que el gate lee.
  return ['ℹ start of coverage report', 'ℹ scripts              |        |          |         | ']
    .concat(listMjsScripts(repoRoot).map((file) => `ℹ  ${file.replace('scripts/', '')} | ${overrides[file] ?? '100.00'} | 100.00 | 100.00 |`))
    .concat(['ℹ end of coverage report'])
    .join(String.fromCharCode(10));
}

test('parses every script row from Node native coverage output', () => {
  assert.deepEqual(parseScriptCoverage(`header\n${perfectCoverage}\nall files | 100.00 | 100.00 | 100.00 |`), [
    { file: 'verify-example.mjs', lines: 100, branches: 100, functions: 100 },
    { file: 'another-script.mjs', lines: 100, branches: 100, functions: 100 },
  ]);
});

test('FALSIFICACIÓN · rejects any script metric below 100%', () => {
  const result = evaluateCoverageRun(fakeResult({ stdout: [
    'ℹ start of coverage report',
    'ℹ  lines-low.mjs | 99.99 | 100.00 | 100.00 |',
    'ℹ  branches-low.mjs | 100.00 | 99.99 | 100.00 |',
    'ℹ  functions-low.mjs | 100.00 | 100.00 | 99.99 |',
    'ℹ end of coverage report',
  ].join('\n') }));
  assert.equal(result.ok, false);
  assert.match(result.message, /lines-low\.mjs.*lines 99\.99/i);
  assert.match(result.message, /branches-low\.mjs.*branches 99\.99/i);
  assert.match(result.message, /functions-low\.mjs.*functions 99\.99/i);
});

test('FALSIFICACIÓN · rejects missing coverage rows and a failed coverage command', () => {
  const missingRows = evaluateCoverageRun(fakeResult({ stdout: 'no coverage table was emitted' }));
  assert.equal(missingRows.ok, false);
  assert.match(missingRows.message, /no script coverage rows/i);

  const absentStreams = evaluateCoverageRun({ status: 0 });
  assert.equal(absentStreams.ok, false);
  assert.match(absentStreams.message, /no script coverage rows/i);

  const failedCommand = evaluateCoverageRun(fakeResult({ status: 1, stderr: 'one test failed' }));
  assert.equal(failedCommand.ok, false);
  assert.match(failedCommand.message, /exited 1/i);
  assert.match(failedCommand.output, /one test failed/i);

  const launchFailure = evaluateCoverageRun(fakeResult({ error: new Error('spawn failed') }));
  assert.equal(launchFailure.ok, false);
  assert.match(launchFailure.message, /could not launch/i);
});

test('FALSIFICACIÓN · rejects a new or omitted Node script even when every reported row is 100%', () => {
  const result = evaluateCoverageRun(fakeResult({ stdout: ['ℹ start of coverage report', 'ℹ  verified.mjs | 100.00 | 100.00 | 100.00 |', 'ℹ end of coverage report'].join(String.fromCharCode(10)) }), ['verified.mjs', 'new-uncovered.mjs']);
  assert.equal(result.ok, false);
  assert.match(result.message, /new-uncovered\.mjs/);
});

test('accepts a complete report even when no explicit inventory was supplied', () => {
  const result = evaluateCoverageRun(fakeResult());
  assert.equal(result.ok, true);
  assert.match(result.message, /2 expected Node script/u);
});

test('runCoverage invokes Node native coverage from the supplied project root', () => {
  let received;
  const result = runCoverage((node, args, options) => {
    received = { node, args, options };
    return fakeResult();
  }, 'C:/fixture/vcp');

  assert.equal(result.status, 0);
  assert.equal(received.node, process.execPath);
  assert.deepEqual(received.args, ['--experimental-test-coverage', '--test', '--test-concurrency=32']);
  assert.equal(received.options.cwd, 'C:/fixture/vcp');
  assert.equal(received.options.encoding, 'utf8');
});

test('listMjsScripts includes only executable Node files from its explicit inventory', () => {
  const entries = [
    { name: 'good.mjs', isFile: () => true }, { name: 'skip.js', isFile: () => true }, { name: 'folder.mjs', isFile: () => false },
  ];
  // Rutas, no nombres sueltos: un ayudante de pruebas homonimo cubria a un script sin tener una
  // sola prueba, porque el inventario y el reporte se comparaban por nombre. Reproducido el 2026-08-28.
  assert.deepEqual(listMjsScripts('C:/fixture', () => entries), ['scripts/good.mjs']);
});

test('main reports both the pass result and a failure without trusting narration', () => {
  const output = [];
  const errors = [];
  const pass = main([], () => fakeResult({ stdout: currentPerfectCoverage() }), (line) => output.push(line), (line) => errors.push(line));
  assert.equal(pass, 0);
  assert.match(output.join('\n'), /OK:.*100%/i);
  assert.deepEqual(errors, []);

  const lowFile = listMjsScripts(repoRoot)[0];
  const fail = main([], () => fakeResult({ stdout: currentPerfectCoverage({ [lowFile]: '99.00' }) }), (line) => output.push(line), (line) => errors.push(line));
  assert.equal(fail, 1);
  assert.match(errors.join('\n'), new RegExp(`${lowFile.replace('.', '\\.')}: lines 99\\.00`, 'i'));

  const usage = main(['unexpected'], () => fakeResult({ stdout: currentPerfectCoverage() }), (line) => output.push(line), (line) => errors.push(line));
  assert.equal(usage, 2);
  assert.match(errors.join('\n'), /usage:/i);

  const silentFailure = main([], () => fakeResult({ status: 1, stdout: '', stderr: '' }), (line) => output.push(line), (line) => errors.push(line));
  assert.equal(silentFailure, 1);
  assert.match(errors.join('\n'), /exited 1/i);

  const inventoryFailure = main([], () => fakeResult({ stdout: currentPerfectCoverage() }), (line) => output.push(line), (line) => errors.push(line), join(repoRoot, 'missing-root'));
  assert.equal(inventoryFailure, 1);
  assert.match(errors.at(-1), /Unable to inventory/);
});

test('CLI usage is fast and rejects arguments without launching the coverage suite', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [coverageGate, 'unexpected'], { encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}${result.stderr}`, /usage:/i);
});

// --- Una medición sobre código que cambió mientras corría no es una medición -------------------

// Reproducido el 2026-08-28: ocho corridas seguidas del gate: las tres que ocurrieron mientras se
// editaba un script reportaron ramas sin cubrir que no existían; las cinco con el árbol quieto
// salieron limpias. La medición no es robusta a que la fuente cambie debajo, así que el gate deja
// de reportar un número cuando eso pasa y lo dice.
const HUELLA_CAMBIO = 'COVERAGE_SOURCE_CHANGED';

test('fingerprintScripts cambia cuando cambia el contenido de un script', () => {
  const uno = fingerprintScripts(() => ['a.mjs', 'b.mjs'], (f) => `contenido de ${f}`);
  const igual = fingerprintScripts(() => ['a.mjs', 'b.mjs'], (f) => `contenido de ${f}`);
  const distinto = fingerprintScripts(() => ['a.mjs', 'b.mjs'], (f) => (f === 'a.mjs' ? 'otra cosa' : `contenido de ${f}`));
  const menos = fingerprintScripts(() => ['a.mjs'], (f) => `contenido de ${f}`);

  assert.equal(uno, igual, 'el mismo contenido da la misma huella');
  assert.notEqual(uno, distinto, 'un byte distinto cambia la huella');
  assert.notEqual(uno, menos, 'un archivo menos cambia la huella');
  assert.match(uno, /^[0-9a-f]{64}$/u);
});

test('FALSIFICACIÓN · si los scripts cambian durante la corrida, el gate rechaza en vez de informar un porcentaje', () => {
  const errors = [];
  let vuelta = 0;
  // Cada llamada devuelve un contenido distinto: simula el archivo editado mientras corría.
  const cambiante = () => `version ${(vuelta += 1)}`;
  const status = main([], () => fakeResult({ stdout: currentPerfectCoverage() }), () => {}, (l) => errors.push(l), repoRoot, {
    list: () => ['x.mjs'],
    read: cambiante,
  });

  assert.equal(status, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(HUELLA_CAMBIO, 'u'));
  assert.doesNotMatch(errors[0], /100%/u, 'no puede publicar un porcentaje que no vale');
});

test('con el árbol quieto el gate informa el resultado normal', () => {
  const written = [];
  const status = main([], () => fakeResult({ stdout: currentPerfectCoverage() }), (l) => written.push(l), () => {}, repoRoot, {
    list: () => ['x.mjs'],
    read: () => 'contenido estable',
  });

  assert.equal(status, 0);
  assert.match(written.join(String.fromCharCode(10)), /^OK: /u);
});


// --- El parser no puede creerle a cualquier linea de la salida ----------------------------------

// Reproducido el 2026-08-28 atacando este gate: parseScriptCoverage leia TODA la salida, asi que
// una prueba que imprimiera una linea con la forma de una fila fabricaba una entrada de cobertura.
// El gate que vigila la cobertura de todos los demas se creia cualquier cosa que alguien imprimiera.
const INICIO = 'ℹ start of coverage report';
const FIN = 'ℹ end of coverage report';

test('FALSIFICACION · una linea impresa por una prueba no puede fabricar una fila de cobertura', () => {
  const impostora = 'ℹ  inventado.mjs | 100.00 | 100.00 | 100.00 |';
  assert.deepEqual(parseScriptCoverage(impostora), [], 'fuera del bloque del reporte no hay filas que leer');

  const conBloque = [
    impostora,
    INICIO,
    'ℹ  real.mjs | 100.00 | 100.00 | 100.00 |',
    FIN,
    impostora,
  ].join(String.fromCharCode(10));
  assert.deepEqual(parseScriptCoverage(conBloque).map((f) => f.file), ['real.mjs'], 'solo cuentan las filas de adentro del bloque');
});

test('parseScriptCoverage devuelve vacio si el reporte no abrio o no cerro', () => {
  const sinFin = [INICIO, 'ℹ  x.mjs | 100.00 | 100.00 | 100.00 |'].join(String.fromCharCode(10));
  assert.deepEqual(parseScriptCoverage(sinFin), [], 'un reporte truncado no es un reporte');
  assert.deepEqual(parseScriptCoverage(''), []);
});


// --- El inventario compara rutas, no nombres sueltos ---------------------------------------------

// Reproducido el 2026-08-28: node agrupa el reporte por directorio y el parser tiraba la cabecera,
// asi que un ayudante de pruebas homonimo cubria a un script sin tener una sola prueba.
test('FALSIFICACION · una fila de tests/ no puede cubrir a un script de scripts/', () => {
  const NL = String.fromCharCode(10);
  const conCabecera = (dir, archivo) => [
    'ℹ start of coverage report',
    `ℹ ${dir} |  |  |  | `,
    `ℹ  ${archivo} | 100.00 | 100.00 | 100.00 |`,
    'ℹ end of coverage report',
  ].join(NL);

  const impostora = evaluateCoverageRun({ status: 0, stdout: conCabecera('tests', 'huerfano.mjs'), stderr: '' }, ['scripts/huerfano.mjs']);
  assert.equal(impostora.ok, false, 'el mismo nombre en otra carpeta no es el mismo archivo');
  assert.match(impostora.message, /scripts\/huerfano\.mjs/u);

  const legitima = evaluateCoverageRun({ status: 0, stdout: conCabecera('scripts', 'huerfano.mjs'), stderr: '' }, ['scripts/huerfano.mjs']);
  assert.equal(legitima.ok, true, legitima.message);
});

test('parseScriptCoverage califica cada fila con su carpeta, y respeta la que ya viene con ruta', () => {
  const NL = String.fromCharCode(10);
  const salida = [
    'ℹ start of coverage report',
    // node intercala separadores y una fila de encabezados de columna: ninguna es fila ni carpeta.
    'ℹ ------------------------------------------------',
    'ℹ file                 | line % | branch % | funcs % | uncovered lines',
    'ℹ scripts |  |  |  | ',
    'ℹ  uno.mjs | 100.00 | 100.00 | 100.00 |',
    'ℹ tests |  |  |  | ',
    'ℹ  dos.mjs | 100.00 | 100.00 | 100.00 |',
    'ℹ  ya/con/ruta.mjs | 100.00 | 100.00 | 100.00 |',
    'ℹ end of coverage report',
  ].join(NL);
  assert.deepEqual(parseScriptCoverage(salida).map((f) => f.file), ['scripts/uno.mjs', 'tests/dos.mjs', 'ya/con/ruta.mjs']);

  // Sin cabecera de carpeta, el nombre queda tal cual: no se inventa un directorio.
  const suelta = ['ℹ start of coverage report', 'ℹ  suelto.mjs | 100.00 | 100.00 | 100.00 |', 'ℹ end of coverage report'].join(NL);
  assert.deepEqual(parseScriptCoverage(suelta).map((f) => f.file), ['suelto.mjs']);
});
