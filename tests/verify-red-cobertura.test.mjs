// Cobertura de las ramas que las pruebas de comportamiento no tocan: los valores por defecto y los
// caminos defensivos de los tres gates de test rojo.
//
// POR QUÉ HACE FALTA UN ARCHIVO APARTE. Las pruebas de comportamiento inyectan `run`, `read` y
// compañía para poder afirmar sobre casos concretos sin lanzar procesos. Eso deja **sin ejecutar el
// lado por defecto de cada inyección**, que es justamente el que corre en producción: si un default
// estuviera roto, la batería seguiría en verde y el gate fallaría recién en la máquina de alguien.
// Acá se corre contra el disco de verdad, en carpetas descartables.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cargar = (n) => import(pathToFileURL(join(repoRoot, 'scripts', n)).href);

const despachador = await cargar('verify-red.mjs');
const pytest = await cargar('verify-red-pytest.mjs');
const vitest = await cargar('verify-red-vitest.mjs');
const receipt = await cargar('verify-receipt.mjs');

const silencio = { write: () => {}, writeError: () => {} };

// Las carpetas de estas pruebas son ficticias a proposito, asi que la contencion real —que resuelve
// con realpath contra el disco— diria que no a todo. Se inyecta una equivalente en forma: rechaza lo
// que empieza con una unidad de disco o con /afuera, que es lo que los casos usan para «esta afuera».
const CONTENIDA = (r) => !String(r).startsWith('/afuera') && !/^[A-Za-z]:/u.test(String(r));

function carpeta(archivos = {}) {
  const d = mkdtempSync(join(tmpdir(), 'vcp-red-cob-'));
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const destino = join(d, nombre);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido, 'utf8');
  }
  return d;
}

// ---------------------------------------------------------------- despachador

test('el despachador corre con TODOS sus valores por defecto, contra el disco real', () => {
  // Sin inyectar nada: lee el contrato real del runtime, resuelve el adaptador real y lo lanza de
  // verdad con spawnSync. El archivo de prueba no existe, así que el adaptador rechaza — y el
  // camino completo por defecto queda ejecutado, que es lo que esta prueba compra.
  const d = carpeta();
  try {
    const code = despachador.main(['check', '--test', 'tests/no-existe.test.mjs', '--command', 'node --test'], { cwd: d, ...silencio });
    assert.equal(code, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('el despachador sin write inyectado no explota: usa la consola', () => {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  try {
    assert.equal(despachador.main([]), 2);
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
});

test('FALSIFICACIÓN · el contrato de adaptadores rechaza cada forma inválida de raíz', () => {
  const { validarContrato } = despachador;
  for (const basura of [null, 'una cadena', 42, ['lista']]) {
    assert.ok(validarContrato(basura).some((v) => /objeto/u.test(v)), JSON.stringify(basura));
  }
  assert.ok(validarContrato({ schema: despachador.SCHEMA, why: 'x', adapters: [] }).some((v) => /why/u.test(v)));
  assert.ok(validarContrato({ schema: despachador.SCHEMA, why: 'un motivo largo y explicativo de verdad', adapters: [{ command: 'x' }] })
    .some((v) => /exactamente/u.test(v)));
});

test('un contrato ilegible rechaza diciendo que no se pudo leer', () => {
  const code = despachador.main(['check', '--test', 'a.test.mjs', '--command', 'node --test'], {
    readContract: () => { throw new Error('ENOENT: el contrato no está'); },
    ...silencio,
  });
  assert.equal(code, 1);
});

test('el despachador propaga un error de uso del adaptador como 2, no como rechazo', () => {
  const errores = [];
  const code = despachador.main(['check', '--test', 'a.test.mjs', '--command', 'node --test'], {
    readContract: () => ({
      schema: despachador.SCHEMA,
      why: 'un motivo suficientemente largo para no ser relleno del todo',
      adapters: [{
        command: 'node --test',
        script: 'verify-red-node.mjs',
        guarantee: 'fuerte',
        why: 'un motivo suficientemente largo para no ser relleno del todo',
        limit: 'un limite suficientemente largo para no ser relleno del todo',
      }],
    }),
    run: () => ({ status: 2, stdout: '', stderr: 'usage: ...' }),
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 2, 'un error de uso del adaptador no es un veredicto sobre el test rojo');
});

// ---------------------------------------------------------------- pytest

test('el adaptador de pytest corre con sus valores por defecto contra el disco real', () => {
  const d = carpeta({ 'test_x.py': 'def test_suma():\n    assert 1 + 1 == 3\n' });
  try {
    // Intérprete inexistente a propósito: la sonda por defecto corre de verdad y falla de verdad,
    // así que el camino «no pude medir» queda ejecutado sin depender de que la máquina tenga Python.
    const code = pytest.main(['check', '--test', 'test_x.py', '--command', 'pytest'], {
      cwd: d, python: 'python-que-no-existe-en-ninguna-parte', ...silencio,
    });
    assert.equal(code, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('el adaptador de pytest lee, limpia y clasifica con los defaults cuando pytest sí corre', () => {
  const d = carpeta({ 'test_x.py': 'def test_suma():\n    assert 1 + 1 == 3\n' });
  try {
    // `run` inyectado escribe el XML él mismo en el destino por defecto, así que `leerXml` y
    // `limpiar` por defecto trabajan sobre un archivo de verdad.
    const code = pytest.main(['check', '--test', 'test_x.py', '--command', 'pytest'], {
      cwd: d,
      sonda: () => ({ status: 0, stdout: '', stderr: '' }),
      run: (bin, args) => {
        const destino = args.find((a) => a.startsWith('--junit-xml=')).slice('--junit-xml='.length);
        writeFileSync(destino, '<?xml version="1.0"?><testsuites><testsuite name="pytest" errors="0" failures="1" skipped="0" tests="1">'
          + '<testcase classname="test_x" name="test_suma"><failure message="assert">test_x.py:2: AssertionError</failure></testcase>'
          + '</testsuite></testsuites>', 'utf8');
        return { status: 1, stdout: '', stderr: '' };
      },
      ...silencio,
    });
    assert.equal(code, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('pytest sin write inyectado usa la consola', () => {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  try {
    assert.equal(pytest.main([]), 2);
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
});

test('clasificarXml cubre cada forma degradada', () => {
  const { clasificarXml } = pytest;
  assert.equal(clasificarXml(undefined).clase, 'ausente');
  assert.equal(clasificarXml('<html>nada</html>').clase, 'ilegible');
  assert.equal(clasificarXml('<testsuite tests="x" errors="0" failures="0"></testsuite>').clase, 'ilegible');
  assert.equal(clasificarXml('<testsuite tests="1" errors="0" failures="0"></testsuite>').clase, 'sin-fallo');
  assert.equal(clasificarXml('<testsuite tests="1" errors="0" failures="1"></testsuite>').clase, 'ilegible');
  const conError = clasificarXml('<testsuite tests="1" errors="1" failures="0"><testcase classname="x"><error>a\nb</error></testcase></testsuite>');
  assert.equal(conError.clase, 'error');
  assert.equal(conError.ultima, 'b');
  const sinCaso = clasificarXml('<testsuite tests="1" errors="1" failures="0"></testsuite>');
  assert.equal(sinCaso.classname, null);
  assert.equal(sinCaso.ultima, null);
});

test('ultimaLineaDelCuerpo y las rutas degradadas', () => {
  assert.equal(pytest.ultimaLineaDelCuerpo(null), null);
  assert.equal(pytest.ultimaLineaDelCuerpo(undefined), null);
});

test('pytest rechaza cada forma de ruta que no es del proyecto', () => {
  for (const mala of ['', '   ']) {
    assert.equal(pytest.main(['check', '--test', mala, '--command', 'pytest'], silencio), 2, JSON.stringify(mala));
  }
  assert.equal(pytest.main(['check', '--test', 'a/../../b.py', '--command', 'pytest'], { cwd: '.', ...silencio }), 1);
});

test('pytest distingue el fallo de lanzamiento, la línea inexistente y el fuente ilegible', () => {
  const base = {
    cwd: join('C:', 'p'),
    existe: () => true, contenida: CONTENIDA,
    sonda: () => ({ status: 0, stdout: '', stderr: '' }),
    limpiar: () => {},
    ...silencio,
  };
  const XML = (cuerpo) => `<testsuite tests="1" errors="0" failures="1"><testcase classname="t"><failure>${cuerpo}</failure></testcase></testsuite>`;

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, run: () => ({ error: new Error('spawn ENOENT') }), leerXml: () => null,
  }), 1);

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, run: () => ({ status: 1 }), leerXml: () => XML('sin la forma esperada'),
  }), 1, 'una última línea sin forma tiene que rechazar');

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, run: () => ({ status: 1 }), leerXml: () => XML('/afuera/t.py:2: AssertionError'),
  }), 1, 'una ruta fuera del proyecto tiene que rechazar');

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, run: () => ({ status: 1 }), leerXml: () => XML('t.py:2: AssertionError'),
    read: () => { throw new Error('EACCES'); },
  }), 1, 'un fuente ilegible tiene que rechazar');

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, run: () => ({ status: 1 }), leerXml: () => XML('t.py:99: AssertionError'),
    read: () => 'una sola linea\n',
  }), 1, 'una línea que no existe tiene que rechazar');
});

// ---------------------------------------------------------------- vitest

test('el adaptador de vitest corre con sus valores por defecto contra el disco real', () => {
  const d = carpeta({ 'a.test.js': "import {test,expect} from 'vitest';\ntest('x', () => { expect(1).toBe(2); });\n" });
  try {
    // Sin `node_modules/vitest`: el camino «no pude medir» corre con `existsSync` de verdad.
    const code = vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], { cwd: d, ...silencio });
    assert.equal(code, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('vitest lee, limpia y clasifica con los defaults cuando el reporte existe', () => {
  const d = carpeta({
    'a.test.js': "import {test,expect} from 'vitest';\ntest('x', () => { expect(1).toBe(2); });\n",
    'node_modules/vitest/vitest.mjs': '// presente para la sonda\n',
  });
  try {
    const code = vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
      cwd: d,
      run: (bin, args) => {
        const destino = args.find((a) => a.startsWith('--outputFile=')).slice('--outputFile='.length);
        writeFileSync(destino, JSON.stringify({
          numTotalTests: 1,
          testResults: [{ name: 'a.test.js', message: '', assertionResults: [{ status: 'failed', failureMessages: ['AssertionError: x\n    at a.test.js:2:20'] }] }],
        }), 'utf8');
        return { status: 1, stdout: '', stderr: '' };
      },
      ...silencio,
    });
    assert.equal(code, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('vitest sin write inyectado usa la consola', () => {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  try {
    assert.equal(vitest.main([]), 2);
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
});

test('clasificarReporte cubre cada forma degradada', () => {
  const { clasificarReporte } = vitest;
  assert.equal(clasificarReporte(undefined).clase, 'ausente');
  assert.equal(clasificarReporte('null').clase, 'ilegible');
  assert.equal(clasificarReporte('[]').clase, 'sin-pruebas');
  assert.equal(clasificarReporte(JSON.stringify({ testResults: [{ name: 'a', message: '', assertionResults: [] }] })).clase, 'sin-pruebas');
  assert.equal(clasificarReporte(JSON.stringify({ testResults: [{ name: 'a', assertionResults: [{ status: 'failed' }] }] })).nombreDelError, '');
});

test('ubicacionDelStack y ubicacionADentroDelProyecto cubren sus caminos vacíos', () => {
  assert.equal(vitest.ubicacionDelStack(null), null);
  assert.equal(vitest.ubicacionDelStack('sin ninguna ubicacion'), null);
  assert.equal(vitest.ubicacionADentroDelProyecto('', '.'), null);
  assert.equal(vitest.ubicacionADentroDelProyecto(null, '.'), null);
  assert.equal(vitest.ubicacionADentroDelProyecto('a/../../b.js', '.'), null);
  assert.equal(vitest.ubicacionADentroDelProyecto(join('C:', 'p'), join('C:', 'p')), null, 'la raíz misma no es un archivo');
});

test('vitest distingue el fallo de lanzamiento, la ubicación ausente y el fuente ilegible', () => {
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, ...silencio };
  const REP = (mensajes) => JSON.stringify({
    numTotalTests: 1,
    testResults: [{ name: 'a.test.js', message: '', assertionResults: [{ status: 'failed', failureMessages: mensajes }] }],
  });

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ error: new Error('spawn ENOENT') }), leerReporte: () => null,
  }), 1);

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => REP(['AssertionError: sin ubicacion']),
  }), 1, 'sin ubicación en el stack tiene que rechazar');

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => REP(['AssertionError: x\n    at /afuera/a.test.js:2:1']),
  }), 1, 'una ruta fuera del proyecto tiene que rechazar');

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => REP(['AssertionError: x\n    at a.test.js:2:1']),
    read: () => { throw new Error('EACCES'); },
  }), 1, 'un fuente ilegible tiene que rechazar');

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => REP(['AssertionError: x\n    at a.test.js:99:1']),
    read: () => 'una sola linea\n',
  }), 1, 'una línea que no existe tiene que rechazar');

  assert.equal(vitest.main(['check', '--test', '', '--command', 'vitest'], base), 2);
  assert.equal(vitest.main(['check', '--test', 'a/../../b.js', '--command', 'vitest'], base), 1);
});

// ---------------------------------------------------------------- receipt

test('invocaAdaptadorDeRed tolera lo que no es una cadena', () => {
  assert.equal(receipt.invocaAdaptadorDeRed(null), false);
  assert.equal(receipt.invocaAdaptadorDeRed(undefined), false);
  assert.equal(receipt.invocaAdaptadorDeRed(42), false);
});

test('el lector por defecto del contrato de adaptadores resuelve contra el repositorio real', () => {
  // Sin inyectar `readRedAdapters`: lee `contracts/red-adapters.json` del checkout, que existe.
  const r = receipt.validateAcceptanceCriterion({
    ac_id: 'AC1',
    scenario: 'GIVEN algo, WHEN otra cosa, THEN sale 1.',
    verdict: 'COMPLIANT',
    test_file: 'tests/verify-red-cobertura.test.mjs',
    test_hash_sha256: 'b'.repeat(64),
    command: 'node scripts/verify-red.mjs check --test tests/x --command "pytest"',
    result: 'verde',
    red_adapter: 'verify-red-pytest.mjs',
  }, repoRoot, { readFile: () => 'x', resolveFile: (p) => p, hashOf: () => 'b'.repeat(64) });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.guarantee, 'menor');
});

test('declarar red_adapter sin invocar ningún adaptador también se rechaza', () => {
  const r = receipt.validateAcceptanceCriterion({
    ac_id: 'AC1',
    scenario: 'GIVEN algo, WHEN otra cosa, THEN sale 1.',
    verdict: 'COMPLIANT',
    test_file: 'x',
    test_hash_sha256: 'b'.repeat(64),
    command: 'node --test tests/x.test.mjs',
    result: 'verde',
    red_adapter: 'verify-red-pytest.mjs',
  }, repoRoot, { readFile: () => 'x', resolveFile: (p) => p, hashOf: () => 'b'.repeat(64) });
  assert.equal(r.ok, false);
  assert.ok(/no invoca/u.test(r.reason), r.reason);
});

test('un contrato sin lista de adaptadores nombra que no hay ninguno declarado', () => {
  const r = receipt.validateAcceptanceCriterion({
    ac_id: 'AC1',
    scenario: 'GIVEN algo, WHEN otra cosa, THEN sale 1.',
    verdict: 'COMPLIANT',
    test_file: 'x',
    test_hash_sha256: 'b'.repeat(64),
    command: 'node scripts/verify-red.mjs check --test x --command "pytest"',
    result: 'verde',
    red_adapter: 'verify-red-pytest.mjs',
  }, repoRoot, {
    readFile: () => 'x', resolveFile: (p) => p, hashOf: () => 'b'.repeat(64), readRedAdapters: () => ({}),
  });
  assert.equal(r.ok, false);
  assert.ok(/ninguno/u.test(r.reason), r.reason);
});

// ---------------------------------------------------------------- lo que faltaba de cada rama

test('el resumen del receipt cambia cuando hubo verdes de garantía menor', () => {
  const base = { feature: 'f', task: 't' };
  const nativo = { ac_id: 'AC1', command: 'bash scripts/verify-red.sh a "node --test"', red_adapter: 'verify-red-node.mjs' };
  const debil = { ac_id: 'AC2', command: 'node scripts/verify-red.mjs check --test a --command "pytest"', red_adapter: 'verify-red-pytest.mjs' };
  const comun = { ac_id: 'AC3', command: 'node --test tests/a.test.mjs' };

  const soloFuertes = receipt.validatedSummary({ ...base, acceptance_criteria: [nativo, comun] }, 'OK');
  assert.ok(!/GARANTIA MENOR/u.test(soloFuertes), soloFuertes);

  const conDebil = receipt.validatedSummary({ ...base, acceptance_criteria: [nativo, debil, comun] }, 'OK');
  assert.ok(/GARANTIA MENOR/u.test(conDebil), conDebil);
  assert.ok(/AC2 via verify-red-pytest\.mjs/u.test(conDebil), conDebil);
  assert.ok(!/AC1/u.test(conDebil), 'nombró el verde fuerte como si fuera débil');
});

test('el despachador rechaza un script que no tiene forma de adaptador', () => {
  const { validarContrato, SCHEMA } = despachador;
  const fila = (script) => ({
    command: 'x', script, guarantee: 'fuerte',
    why: 'un motivo suficientemente largo para no ser relleno',
    limit: 'un limite suficientemente largo para no ser relleno',
  });
  const con = (script) => validarContrato({ schema: SCHEMA, why: 'un motivo suficientemente largo para no ser relleno', adapters: [fila(script)] });
  for (const malo of ['otra-cosa.mjs', '../verify-red-x.mjs', 'verify-red-X.mjs', undefined, 42]) {
    assert.ok(con(malo).some((v) => /script/u.test(v)), JSON.stringify(malo));
  }
});

test('el despachador rechaza argumentos vacíos y un contrato mal formado', () => {
  assert.equal(despachador.main(['check', '--test', '   ', '--command', 'node --test'], silencio), 2);
  assert.equal(despachador.main(['check', '--test', 'a', '--command', '  '], silencio), 2);

  const code = despachador.main(['check', '--test', 'a', '--command', 'node --test'], {
    readContract: () => ({ schema: despachador.SCHEMA, why: 'corto', adapters: [] }),
    ...silencio,
  });
  assert.equal(code, 1);
});

test('el despachador imprime lo que el adaptador dijo, incluso cuando rechaza', () => {
  const salida = [];
  const errores = [];
  const contrato = {
    schema: despachador.SCHEMA,
    why: 'un motivo suficientemente largo para no ser relleno del todo',
    adapters: [{
      command: 'node --test', script: 'verify-red-node.mjs', guarantee: 'fuerte',
      why: 'un motivo suficientemente largo para no ser relleno del todo',
      limit: 'un limite suficientemente largo para no ser relleno del todo',
    }],
  };
  const code = despachador.main(['check', '--test', 'a', '--command', 'node --test'], {
    readContract: () => contrato,
    run: () => ({ status: 1, stdout: 'algo por la salida', stderr: 'algo por el error' }),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.ok(salida.includes('algo por la salida'), salida.join('\n'));
  assert.ok(errores.includes('algo por el error'), errores.join('\n'));

  // Y el caso mudo: sin stdout ni stderr, no imprime lineas vacias.
  const s2 = [];
  const e2 = [];
  despachador.main(['check', '--test', 'a', '--command', 'node --test'], {
    readContract: () => contrato,
    run: () => ({ status: 1 }),
    write: (l) => s2.push(l),
    writeError: (l) => e2.push(l),
  });
  assert.ok(!s2.includes(''), s2.join('|'));
  assert.ok(e2.every((l) => l.length > 0), e2.join('|'));
});

test('pytest: las ramas de ruta, de sonda y de clasificación que faltaban', () => {
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, ...silencio };
  const XML = (cuerpo) => `<testsuite tests="1" errors="0" failures="1"><testcase classname="t"><failure>${cuerpo}</failure></testcase></testsuite>`;
  const okSonda = { sonda: () => ({ status: 0, stdout: '', stderr: '' }) };

  // ruta absoluta y ruta con .. en la comprobacion del fuente
  assert.equal(pytest.main(['check', '--test', join('C:', 'x.py'), '--command', 'pytest'], base), 1);
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, ...okSonda, run: () => ({ status: 1 }), leerXml: () => XML(join('C:', 'afuera', 't.py') + ':2: AssertionError'),
  }), 1, 'una ruta absoluta en el reporte tiene que rechazar');

  // la sonda que devuelve un error de lanzamiento, no un status
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, sonda: () => ({ error: new Error('spawn ENOENT') }),
  }), 1);

  // XML ilegible, sin fallo, y ultima linea nula
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, ...okSonda, run: () => ({ status: 1 }), leerXml: () => '<html>no es un reporte</html>',
  }), 1, 'un XML ilegible tiene que rechazar');
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, ...okSonda, run: () => ({ status: 0 }), leerXml: () => '<testsuite tests="1" errors="0" failures="0"></testsuite>',
  }), 1, 'sin fallo tiene que rechazar');
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, ...okSonda, run: () => ({ status: 1 }), leerXml: () => XML(''),
  }), 1, 'un cuerpo vacio tiene que rechazar');

  // un error de recoleccion sin classname
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, ...okSonda, run: () => ({ status: 2 }),
    leerXml: () => '<testsuite tests="1" errors="1" failures="0"><testcase><error>ModuleNotFoundError</error></testcase></testsuite>',
  }), 1);
});

test('pytest: el lanzador por defecto se ejecuta cuando la sonda pasa', () => {
  const d = carpeta({ 'test_x.py': 'def test_suma():\n    assert 1 + 1 == 3\n' });
  try {
    // `sonda` inyectada dice que si, y `run`/`leerXml`/`limpiar` quedan en su valor por defecto: el
    // binario no existe, asi que spawnSync devuelve un error y el camino real queda ejecutado.
    const code = pytest.main(['check', '--test', 'test_x.py', '--command', 'pytest'], {
      cwd: d,
      python: 'python-que-no-existe-en-ninguna-parte',
      sonda: () => ({ status: 0, stdout: '', stderr: '' }),
      ...silencio,
    });
    assert.equal(code, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('pytest: atributo devuelve null cuando el atributo no está', () => {
  const r = pytest.clasificarXml('<testsuite tests="1" errors="1" failures="0"><testcase name="x"><error>E</error></testcase></testsuite>');
  assert.equal(r.classname, null, 'un testcase sin classname tiene que dar null, no romper');
});

test('vitest: las ramas de ruta, de clasificación y de lanzamiento que faltaban', () => {
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, ...silencio };

  assert.equal(vitest.main(['check', '--test', join('C:', 'a.test.js'), '--command', 'vitest'], base), 1);

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => 'no es json',
  }), 1, 'un reporte ilegible tiene que rechazar');

  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base,
    run: () => ({ status: 1 }),
    leerReporte: () => JSON.stringify({ numTotalTests: 0, testResults: [{ message: 'Cannot find module', assertionResults: [] }] }),
  }), 1, 'un error de carga sin nombre de archivo tiene que rechazar igual');

  // assertionResults ausente del todo, no vacio
  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    ...base, run: () => ({ status: 1 }), leerReporte: () => JSON.stringify({ numTotalTests: 1, testResults: [{ name: 'a' }] }),
  }), 1);
});

test('vitest: el lanzador por defecto se ejecuta cuando el binario está declarado presente', () => {
  const d = carpeta({
    'a.test.js': "import {test,expect} from 'vitest';\ntest('x', () => { expect(1).toBe(2); });\n",
    'node_modules/vitest/vitest.mjs': '// presente\n',
  });
  try {
    // `run`, `leerReporte` y `limpiar` por defecto: vitest.mjs es un archivo vacio, asi que la
    // corrida real no escribe ningun reporte y el camino «no se escribio» queda ejecutado.
    const code = vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], { cwd: d, ...silencio });
    assert.equal(code, 1);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('vitest: rutaDeProyecto rechaza lo absoluto y lo que sale del árbol', () => {
  assert.equal(vitest.ubicacionADentroDelProyecto('   ', '.'), null);
  assert.equal(vitest.ubicacionADentroDelProyecto(join('C:', 'otro', 'x.js'), join('C:', 'p')), null);
});

test('una ruta en OTRA unidad de disco queda fuera del proyecto, en los dos adaptadores', () => {
  // `relative('C:\\p', 'D:\\q')` devuelve una ruta ABSOLUTA, no una con `..`, asi que la guarda de
  // contencion necesita las dos mitades. Es el caso que solo aparece en Windows con dos unidades.
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, ...silencio };
  const XML = (c) => `<testsuite tests="1" errors="0" failures="1"><testcase classname="t"><failure>${c}</failure></testcase></testsuite>`;

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base,
    sonda: () => ({ status: 0 }),
    run: () => ({ status: 1 }),
    leerXml: () => XML('D:/otra-unidad/t.py:2: AssertionError'),
  }), 1);

  assert.equal(vitest.ubicacionADentroDelProyecto('D:/otra-unidad/a.test.js', join('C:', 'p')), null);
});

test('una sonda que falla sin stderr, y un error de recolección sin última línea', () => {
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, ...silencio };

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base, sonda: () => ({ status: 1 }),
  }), 1, 'sin stderr tiene que informar igual, no romper');

  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base,
    sonda: () => ({ status: 0 }),
    run: () => ({ status: 2 }),
    leerXml: () => '<testsuite tests="1" errors="1" failures="0"><testcase classname="t"></testcase></testsuite>',
  }), 1, 'un error sin cuerpo tiene que rechazar con un detalle legible');
});

test('lanzar algo que NO es un Error deja un mensaje legible, no «undefined»', () => {
  // Un getter roto o una biblioteca de terceros pueden tirar cualquier cosa. Un rechazo que dice
  // «undefined» no es un diagnostico, es una pared.
  const base = { cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {}, sonda: () => ({ status: 0 }) };

  const ePy = [];
  assert.equal(pytest.main(['check', '--test', 't.py', '--command', 'pytest'], {
    ...base,
    run: () => ({ status: 1 }),
    leerXml: () => '<testsuite tests="1" errors="0" failures="1"><testcase classname="t"><failure>t.py:2: AssertionError</failure></testcase></testsuite>',
    read: () => { throw 'el fuente se rompio de una forma rara'; },
    write: () => {}, writeError: (l) => ePy.push(l),
  }), 1);
  assert.ok(ePy.some((l) => /forma rara/u.test(l)), ePy.join(' | '));

  const eVt = [];
  assert.equal(vitest.main(['check', '--test', 'a.test.js', '--command', 'vitest'], {
    cwd: join('C:', 'p'), existe: () => true, contenida: CONTENIDA, limpiar: () => {},
    run: () => ({ status: 1 }),
    leerReporte: () => JSON.stringify({
      numTotalTests: 1,
      testResults: [{ name: 'a', message: '', assertionResults: [{ status: 'failed', failureMessages: ['AssertionError: x\n    at a.test.js:2:1'] }] }],
    }),
    read: () => { throw 'el fuente se rompio de una forma rara'; },
    write: () => {}, writeError: (l) => eVt.push(l),
  }), 1);
  assert.ok(eVt.some((l) => /forma rara/u.test(l)), eVt.join(' | '));

  const eDe = [];
  assert.equal(despachador.main(['check', '--test', 'a', '--command', 'node --test'], {
    readContract: () => { throw 'el contrato se rompio de una forma rara'; },
    write: () => {}, writeError: (l) => eDe.push(l),
  }), 1);
  assert.ok(eDe.some((l) => /forma rara/u.test(l)), eDe.join(' | '));
});

test('una ruta relativa que la contención rechaza NO se acepta: es el caso del enlace simbólico', () => {
  // Una ruta relativa, sin `..`, y aun asi fuera del proyecto: es lo que pasa cuando una carpeta del
  // arbol es un enlace simbolico que apunta afuera. Textualmente parece contenida; `realpath` dice
  // que no. Esa es exactamente la diferencia entre la contencion del protocolo y una comparacion de
  // cadenas, y es la razon por la que estos adaptadores usan la primera.
  const afuera = { contenida: () => false, existe: () => true, limpiar: () => {}, ...silencio };

  assert.equal(pytest.main(['check', '--test', 'tests/enlace/test_x.py', '--command', 'pytest'], {
    cwd: join('C:', 'p'), ...afuera,
  }), 1);

  assert.equal(vitest.main(['check', '--test', 'tests/enlace/a.test.js', '--command', 'vitest'], {
    cwd: join('C:', 'p'), ...afuera,
  }), 1);

  assert.equal(vitest.ubicacionADentroDelProyecto('tests/enlace/a.test.js', join('C:', 'p'), () => false), null);
});
