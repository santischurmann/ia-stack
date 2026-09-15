// AC7 de docs/spec.md · El adaptador de pytest clasifica sobre el reporte estructurado, y cuando la
// línea señalada no contiene una aserción, rechaza.
//
// TODO LO QUE ESTE ARCHIVO AFIRMA ESTÁ MEDIDO, dos veces: primero con el intérprete del sistema y
// después en un entorno virgen con `pytest==9.1.1` y **cero** complementos instalados. Las dos
// corridas coinciden en todo. La tabla está en `research/sources/adaptadores-red-2026-09-14.md`.
//
// POR QUÉ SE CLASIFICA SOBRE EL XML Y NO SOBRE stdout. La salida capturada de la prueba se reimprime
// textual y sin escapar bajo `Captured stdout call`, así que un `print()` adentro de una prueba puede
// dibujar lo que quiera. El JUnit XML al menos tiene estructura: `failures` contra `errors` son
// contadores separados, y esa separación es el discriminador que stdout no puede dar.
//
// LA DISTINCIÓN QUE LA REMEDICIÓN PRECISÓ. Un error de fixture produce una última línea con la MISMA
// FORMA que un fallo de aserción —`<archivo>:<línea>: <Excepción>`—, así que apoyarse en la línea
// sola sería ambiguo. El discriminador tiene que ser el par `errors`/`failures`.
//
// LO QUE ESTE ADAPTADOR NO PUEDE HACER, y por eso su garantía está declarada MENOR: pytest ejecuta
// `conftest.py` del proyecto como plugin, con acceso a `session.config.option.xmlpath` y a
// `session.exitstatus`. Falsificado: un hookwrapper de `pytest_sessionfinish` reescribe el XML
// después de que `LogXML` lo escribió y fuerza el código de salida, con una única prueba que PASA.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-red-pytest.mjs');
const {
  USAGE, clasificarXml, entornoPytest, main, ultimaLineaDelCuerpo,
} = await import(pathToFileURL(script).href);

/** Un JUnit XML de pytest con la forma real medida. */
function xml({ tests = 1, errors = 0, failures = 0, classname = 'test_x', elemento = 'failure', cuerpo = 'test_x.py:2: AssertionError', message = 'assert (1 + 1) == 3' } = {}) {
  const caso = elemento === null
    ? ''
    : `<testcase classname="${classname}" name="test_suma" time="0.001"><${elemento} message="${message}">${cuerpo}</${elemento}></testcase>`;
  return `<?xml version="1.0" encoding="utf-8"?><testsuites name="pytest tests">`
    + `<testsuite name="pytest" errors="${errors}" failures="${failures}" skipped="0" tests="${tests}" time="0.1">`
    + `${caso}</testsuite></testsuites>`;
}

const FUENTE_CON_ASSERT = 'def test_suma():\n    assert 1 + 1 == 3\n';

function correr(args = ['check', '--test', 'test_x.py', '--command', 'pytest'], over = {}) {
  const salida = [];
  const errores = [];
  const escrituras = [];
  const code = main(args, {
    cwd: join('C:', 'proyecto'),
    existe: () => true,
    contenida: (r) => !String(r).startsWith('/afuera') && !/^[A-Za-z]:/u.test(String(r)),
    sonda: () => ({ status: 0, stdout: '', stderr: '' }),
    run: () => ({ status: 1, stdout: '1 failed in 0.04s', stderr: '' }),
    read: () => FUENTE_CON_ASSERT,
    leerXml: () => xml({ failures: 1 }),
    limpiar: (r) => escrituras.push(r),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...over,
  });
  return { code, salida, errores, escrituras };
}

test('un uso inválido sale 2 y no se confunde con un rechazo', () => {
  for (const args of [[], ['check'], ['check', '--test', 'test_x.py'], ['otra', '--test', 'a', '--command', 'pytest']]) {
    const { code, errores } = correr(args);
    assert.equal(code, 2, JSON.stringify(args));
    assert.ok(errores.some((l) => l === USAGE), errores.join('\n'));
  }
});

test('sólo acepta el comando exacto que tiene declarado, aunque el despachador ya lo filtre', () => {
  // Defensa en profundidad: este adaptador también se puede invocar directo.
  const { code, errores } = correr(['check', '--test', 'test_x.py', '--command', 'pytest -q']);
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /pytest/u.test(l) && /exact/u.test(l)), errores.join('\n'));
});

test('un rojo genuino aprueba: failures=1, errors=0, AssertionError, y la línea tiene un assert', () => {
  const { code, salida, errores } = correr();
  assert.equal(code, 0, errores.join('\n'));
  assert.ok(salida.some((l) => /^OK: /u.test(l)), salida.join('\n'));
  assert.ok(salida.some((l) => /LIMITE|LÍMITE/u.test(l)), 'tiene que declarar qué NO puede comprobar');
});

test('AC7 · si la línea señalada NO contiene una aserción, rechaza', () => {
  const { code, errores } = correr(undefined, { read: () => 'def test_suma():\n    return 3\n' });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /assert/u.test(l) && /l[íi]nea/u.test(l)), errores.join('\n'));
});

test('AC7 · el límite honesto dice que un reporte forjado CON la aserción pasa igual', () => {
  const { salida } = correr();
  const limite = salida.find((l) => /^LIMITE|^LÍMITE/u.test(l));
  assert.ok(limite, salida.join('\n'));
  assert.ok(/conftest/u.test(limite), `el límite tiene que nombrar el vector real: ${limite}`);
  assert.ok(/no prueba que|NO prueba que/u.test(limite), `el límite tiene que decir qué NO prueba: ${limite}`);
});

test('un error de fixture rechaza, y NO se lee como un fallo de aserción', () => {
  // La remedición en entorno virgen mostró que la última línea tiene la misma FORMA que un assert
  // fallido, así que el discriminador tiene que ser el par errors/failures, nunca la línea sola.
  const { code, errores } = correr(undefined, {
    leerXml: () => xml({ errors: 1, failures: 0, elemento: 'error', cuerpo: 'conftest.py:5: RuntimeError', message: 'failed on setup' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /error/iu.test(l)), errores.join('\n'));
});

test('un error de recolección rechaza, y se distingue por el XML y no por el exit code', () => {
  // Medido: sale 2, que la documentación describe como «interrumpido por el usuario». El exit code
  // mezcla dos cosas, así que el rechazo se ancla en los contadores del XML.
  const { code, errores } = correr(undefined, {
    run: () => ({ status: 2, stdout: 'ERROR test_x.py', stderr: '' }),
    leerXml: () => xml({ errors: 1, failures: 0, classname: '', elemento: 'error', cuerpo: 'ModuleNotFoundError', message: 'collection failure' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.length > 0);
});

test('`pytest.fail()` produce Failed y NO alcanza: el default coherente con el nativo es rechazarlo', () => {
  const { code, errores } = correr(undefined, {
    leerXml: () => xml({ failures: 1, cuerpo: 'test_x.py:4: Failed', message: 'fallo declarado' }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /Failed/u.test(l) || /AssertionError/u.test(l)), errores.join('\n'));
});

test('cero pruebas recolectadas rechaza, en vez de aprobar por ausencia', () => {
  const { code, errores } = correr(undefined, {
    run: () => ({ status: 5, stdout: 'no tests ran', stderr: '' }),
    leerXml: () => xml({ tests: 0, elemento: null }),
  });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /ning[uú]n|cero|0/u.test(l)), errores.join('\n'));
});

test('si el XML no se escribió, rechaza diciendo eso y no inventa un veredicto', () => {
  const { code, errores } = correr(undefined, { leerXml: () => null });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /XML/u.test(l)), errores.join('\n'));
  assert.ok(errores.some((l) => /addopts/u.test(l)), 'tiene que nombrar la causa medida: un ini del proyecto puede apagar el XML');
});

test('sin pytest disponible informa que no pudo correr, y eso NO es un veredicto', () => {
  const { code, errores } = correr(undefined, { sonda: () => ({ status: 1, stdout: '', stderr: 'No module named pytest' }) });
  assert.equal(code, 1);
  assert.ok(errores.some((l) => /no se pudo|no est[áa] disponible/u.test(l)), errores.join('\n'));
  assert.ok(!errores.some((l) => /no hubo rojo/u.test(l)), 'confundió «no pude medir» con «medí y no había rojo»');
});

test('el archivo de prueba tiene que existir y quedar adentro del proyecto', () => {
  assert.equal(correr(undefined, { existe: () => false }).code, 1);
  assert.equal(correr(['check', '--test', '../afuera/test_x.py', '--command', 'pytest']).code, 1);
  assert.equal(correr(['check', '--test', join('C:', 'otro', 'test_x.py'), '--command', 'pytest']).code, 1);
});

test('el comando lleva las dos piezas que la medición mostró obligatorias', () => {
  const corridas = [];
  correr(undefined, { run: (bin, args, o) => { corridas.push({ bin, args, o }); return { status: 1, stdout: '', stderr: '' }; } });

  const args = corridas[0].args;
  assert.ok(args.includes('-o') && args.includes('addopts='),
    `sin -o addopts= un pytest.ini del proyecto puede apagar el XML: ${JSON.stringify(args)}`);
  assert.ok(args.some((a) => a.startsWith('--junit-xml=')), JSON.stringify(args));
  assert.ok(args.includes('-p') && args.includes('no:cacheprovider'), JSON.stringify(args));
});

test('la variable de entorno que inyecta opciones se limpia, porque se midió que inyecta', () => {
  const limpio = entornoPytest({ PYTEST_ADDOPTS: '--co', PATH: '/usr/bin', OTRA: '1' });
  assert.ok(!('PYTEST_ADDOPTS' in limpio), 'PYTEST_ADDOPTS sobrevivió: con --co inyectado pytest sólo recolecta y el reporte queda en cero');
  assert.equal(limpio.PATH, '/usr/bin', 'se llevó puesto el PATH');
  assert.equal(limpio.OTRA, '1');
});

test('el XML temporal se limpia, y NUNCA se escribe adentro del proyecto', () => {
  const corridas = [];
  const { escrituras } = correr(undefined, { run: (b, a) => { corridas.push(a); return { status: 1, stdout: '', stderr: '' }; } });

  const destino = corridas[0].find((a) => a.startsWith('--junit-xml=')).slice('--junit-xml='.length);
  assert.ok(!destino.startsWith(join('C:', 'proyecto')), `el reporte se escribió adentro del proyecto: ${destino}`);
  assert.deepEqual(escrituras, [destino], 'no limpió el temporal que creó');
});

test('clasificarXml separa los casos por contadores, no por prosa', () => {
  assert.equal(clasificarXml(xml({ failures: 1 })).clase, 'fallo');
  assert.equal(clasificarXml(xml({ errors: 1, failures: 0, elemento: 'error' })).clase, 'error');
  assert.equal(clasificarXml(xml({ tests: 0, elemento: null })).clase, 'sin-pruebas');
  assert.equal(clasificarXml('no es xml').clase, 'ilegible');
  assert.equal(clasificarXml(null).clase, 'ausente');
});

test('ultimaLineaDelCuerpo devuelve la última línea NO vacía, que es donde vive el discriminador', () => {
  assert.equal(ultimaLineaDelCuerpo('bla\n\ntest_x.py:2: AssertionError\n\n'), 'test_x.py:2: AssertionError');
  assert.equal(ultimaLineaDelCuerpo('   '), null);
  assert.equal(ultimaLineaDelCuerpo(''), null);
});
