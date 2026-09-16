// El adaptador de vitest clasifica sobre el reporte JSON, y su garantía está declarada MENOR.
//
// MEDIDO DOS VECES, la segunda en un proyecto nuevo con `vitest@5.0.0` como única dependencia y sin
// configuración previa. Las dos corridas coinciden. La tabla está en
// `research/sources/adaptadores-red-2026-09-14.md`.
//
// EL DISCRIMINADOR ES ESTRUCTURAL, y hay que subrayar por qué: el JSON de vitest **no tiene** la
// separación `failures` contra `errors` que sí tiene el JUnit de pytest. Lo que sí tiene es que un
// error de carga deja `assertionResults` VACÍO y llena `testResults[].message`, mientras que en un
// fallo genuino `message` es exactamente la cadena vacía. Esa es toda la estructura disponible.
//
// POR QUÉ NO SE USA EL REPORTER `junit` DE VITEST, que traería un atributo `type` más limpio que el
// prefijo del string: para un error de import y para un archivo vacío **sintetiza un `<testcase>`
// falso con `tests="1"`**, o sea miente sobre cuántas pruebas corrieron. Un reporte que miente en el
// conteo no sirve de fuente primaria.
//
// Y POR QUÉ SIEMPRE `--outputFile`: desde v4 el reporter `json` ya no escribe a la salida estándar.
// Se puede forzar con la opción `stdout: true` del reporter, y **no hay que hacerlo**: en la misma
// corrida se comprobó que un `process.stdout.write()` desde adentro de una prueba llega crudo a
// stdout, así que mezclar el JSON con stdout reabre la falsificación por intercalado.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-red-vitest.mjs');
const { USAGE, clasificarReporte, main } = await import(pathToFileURL(script).href);

function reporte({ total = 1, fallados = 1, mensajeDeArchivo = '', aserciones = [{ status: 'failed', failureMessages: ['AssertionError: expected 1 to be 3 // Object.is equality\n    at a.test.js:2:34'] }] } = {}) {
  return JSON.stringify({
    numTotalTestSuites: 1,
    numTotalTests: total,
    numPassedTests: total - fallados,
    numFailedTests: fallados,
    success: fallados === 0,
    testResults: [{ name: 'a.test.js', status: 'failed', message: mensajeDeArchivo, assertionResults: aserciones }],
  });
}

const FUENTE = "import {test,expect} from 'vitest';\ntest('suma', () => { expect(1+1).toBe(3); });\n";

function correr(args = ['check', '--test', 'a.test.js', '--command', 'vitest'], over = {}) {
  const salida = [];
  const errores = [];
  const escrituras = [];
  const code = main(args, {
    cwd: join('C:', 'proyecto'),
    existe: () => true,
    contenida: (r) => !String(r).startsWith('/afuera') && !/^[A-Za-z]:/u.test(String(r)),
    run: () => ({ status: 1, stdout: 'JSON report written to /tmp/x.json', stderr: '' }),
    read: () => FUENTE,
    leerReporte: () => reporte(),
    limpiar: (r) => escrituras.push(r),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...over,
  });
  return { code, salida, errores, escrituras };
}

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['check'], ['check', '--test', 'a.test.js'], ['otra', '--test', 'a', '--command', 'vitest']]) {
    const { code, errores } = correr(args);
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('sólo acepta el comando exacto declarado', () => {
  const { code, errores } = correr(['check', '--test', 'a.test.js', '--command', 'vitest run']);
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /exact/u.test(l)), errores.join('\n'));
});

test('un rojo genuino aprueba, y el verde viene con su garantía menor escrita', () => {
  const { code, salida, errores } = correr();
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
  assert.ok(salida.some((l) => /GARANTIA MENOR|GARANTÍA MENOR/u.test(l)), salida.join('\n'));
  const limite = salida.find((l) => /^LIMITE|^LÍMITE/u.test(l));
  assert.ok(limite && /globalSetup/u.test(limite), `el límite tiene que nombrar el vector real: ${limite}`);
  assert.ok(/name/u.test(limite), 'el límite tiene que decir que el nombre del error es escribible');
});

test('un error de carga rechaza, y se distingue por la estructura y no por el texto', () => {
  for (const mensaje of ['Cannot find module ./no-existe.js', 'No test suite found in file a.test.js']) {
    const { code, errores } = correr(undefined, {
      leerReporte: () => reporte({ total: 0, fallados: 0, mensajeDeArchivo: mensaje, aserciones: [] }),
    });
    assert.equal(code, 1, mensaje);
    assert.ok(errores.some((l) => /carga|import|suite/iu.test(l)), `${mensaje}: ${errores.join('\n')}`);
  }
});

test('cero pruebas rechaza, porque vitest no tiene el exit 5 de pytest y sale 1 igual', () => {
  const { code, errores } = correr(undefined, {
    leerReporte: () => JSON.stringify({ numTotalTests: 0, numFailedTests: 0, success: false, testResults: [] }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /ning[uú]n|cero/u.test(l)), errores.join('\n'));
});

test('ninguna aserción fallada rechaza: sin rojo visible no hay implementación', () => {
  const { code, errores } = correr(undefined, {
    leerReporte: () => reporte({ fallados: 0, aserciones: [{ status: 'passed', failureMessages: [] }] }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /LAW 1|ninguna/u.test(l)), errores.join('\n'));
});

test('un error que no es de aserción rechaza, y el prefijo es lo único que los separa', () => {
  // El JSON no distingue un error de hook de un fallo de aserción: los dos quedan como un
  // assertionResult con status failed. Sólo el prefijo del string los separa, y está declarado.
  for (const prefijo of ['TypeError: no es una asercion', 'Error: hook roto']) {
    const { code, errores } = correr(undefined, {
      leerReporte: () => reporte({ aserciones: [{ status: 'failed', failureMessages: [`${prefijo}\n    at a.test.js:2:1`] }] }),
    });
    assert.equal(code, 1, prefijo);
    assert.ok(errores.some((l) => /AssertionError/u.test(l)), `${prefijo}: ${errores.join('\n')}`);
  }
});

test('si la línea señalada no contiene una aserción, rechaza', () => {
  const { code, errores } = correr(undefined, { read: () => "import {test} from 'vitest';\ntest('x', () => { return 1; });\n" });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /l[íi]nea/u.test(l)), errores.join('\n'));
});

test('si el reporte no se escribió, rechaza diciendo eso', () => {
  const { code, errores } = correr(undefined, { leerReporte: () => null });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /reporte/iu.test(l)), errores.join('\n'));
});

test('sin vitest instalado informa que no pudo medir, y eso no es un veredicto', () => {
  const { code, errores } = correr(undefined, { existe: (r) => !String(r).includes('vitest') });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /vitest/u.test(l) && /no/u.test(l)), errores.join('\n'));
  assert.ok(!errores.some((l) => /ninguna aserción/u.test(l)), 'confundió «no pude medir» con «medí y no había rojo»');
});

test('el comando lleva run y outputFile, las dos piezas que la medición mostró obligatorias', () => {
  const corridas = [];
  correr(undefined, { run: (b, a) => { corridas.push(a); return { status: 1, stdout: '', stderr: '' }; } });
  const args = corridas[0];

  assert.ok(args.includes('run'), `sin \`run\` entra en modo watch y no termina nunca: ${JSON.stringify(args)}`);
  assert.ok(args.some((a) => a.startsWith('--outputFile=')), JSON.stringify(args));
  assert.ok(args.includes('--reporter=json'), JSON.stringify(args));
});

test('el reporte temporal se escribe fuera del proyecto y se limpia', () => {
  const corridas = [];
  const { escrituras } = correr(undefined, { run: (b, a) => { corridas.push(a); return { status: 1, stdout: '', stderr: '' }; } });
  const destino = corridas[0].find((a) => a.startsWith('--outputFile=')).slice('--outputFile='.length);
  assert.ok(!destino.startsWith(join('C:', 'proyecto')), `el reporte quedó adentro del proyecto: ${destino}`);
  assert.deepEqual(escrituras, [destino]);
});

// LA MEDICION CONTRA VITEST REAL ENCONTRO ESTO, y la bateria no lo veia.
//
// pytest informa la ruta del fallo RELATIVA al rootdir; vitest la informa ABSOLUTA. Los fixtures de
// arriba se escribieron desde la ficha de research, que cita rutas cortas, asi que todas las pruebas
// pasaban con rutas relativas — y el caso genuino contra vitest de verdad salia RECHAZADO, porque la
// comprobacion contra el fuente no aceptaba una ruta absoluta. Un falso negativo: el adaptador
// rechazaba justo el rojo que tenia que aprobar.
test('el reporte puede señalar una ruta ABSOLUTA, y si cae adentro del proyecto vale igual', () => {
  // UNA RUTA ABSOLUTA DE ESTA PLATAFORMA, no una que sólo lo es en Windows. `join('C:', 'proyecto')`
  // da `C:/proyecto` —absoluta allá— y `C:/proyecto` —RELATIVA— en Linux, así que la prueba medía
  // otra cosa. Lo encontró la primera corrida de la matriz, el 2026-09-16.
  const proyecto = process.platform === 'win32' ? join('C:', 'proyecto') : join('/tmp', 'proyecto');
  const absoluta = join(proyecto, 'a.test.js').replaceAll('\\', '/');
  const { code, salida, errores } = correr(undefined, {
    leerReporte: () => reporte({
      aserciones: [{ status: 'failed', failureMessages: [`AssertionError: expected 1 to be 3\n    at ${absoluta}:2:34`] }],
    }),
  });

  assert.equal(code, 0, errores.join('\n'));
  // Y el mensaje habla en rutas del proyecto, no en rutas de la máquina de quien corrió: una ruta
  // absoluta impresa lleva adentro el nombre de usuario, y eso termina en los registros de CI.
  const ok = salida.find((l) => /^OK: /u.test(l));
  assert.ok(/a\.test\.js:2/u.test(ok), ok);
  assert.ok(!ok.includes(proyecto), `el mensaje reimprimió la ruta absoluta de la máquina: ${ok}`);
});

test('una ruta absoluta que cae FUERA del proyecto se sigue rechazando', () => {
  const { code, errores } = correr(undefined, {
    leerReporte: () => reporte({
      aserciones: [{ status: 'failed', failureMessages: ['AssertionError: x\n    at C:/otro-proyecto/a.test.js:2:34'] }],
    }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /contenida en el proyecto/u.test(l)), errores.join('\n'));
});

test('clasificarReporte separa por estructura, y nombra cada estado', () => {
  assert.equal(clasificarReporte(reporte()).clase, 'fallo');
  assert.equal(clasificarReporte(reporte({ total: 0, fallados: 0, mensajeDeArchivo: 'Cannot find module', aserciones: [] })).clase, 'error-de-carga');
  assert.equal(clasificarReporte(JSON.stringify({ numTotalTests: 0, testResults: [] })).clase, 'sin-pruebas');
  assert.equal(clasificarReporte('no es json').clase, 'ilegible');
  assert.equal(clasificarReporte(null).clase, 'ausente');
  assert.equal(clasificarReporte(reporte({ fallados: 0, aserciones: [{ status: 'passed', failureMessages: [] }] })).clase, 'sin-fallo');
});
