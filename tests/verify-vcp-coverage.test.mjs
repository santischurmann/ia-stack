import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const coverageGate = join(repoRoot, 'scripts', 'verify-vcp-coverage.mjs');
const {
  DEFAULT_TEST_CONCURRENCY,
  NO_COVERAGE_DATA,
  NO_INPUTS_SOURCE_CHANGED,
  UNREADABLE_COVERAGE,
  collectScriptCoverage,
  evaluateCoverage,
  fingerprintScripts,
  innermostCount,
  lineAt,
  listMjsScripts,
  main,
  resolveTestConcurrency,
  runCoverage,
  totalCount,
  uncoveredRanges,
} = await import(pathToFileURL(coverageGate).href);

/** Un proceso de V8: la lista de funciones con sus rangos, tal como sale de NODE_V8_COVERAGE. */
function proceso(...funciones) {
  return funciones;
}

function fn(name, ranges, isBlockCoverage = true) {
  return { functionName: name, isBlockCoverage, ranges };
}

function rango(startOffset, endOffset, count) {
  return { startOffset, endOffset, count };
}

// Un archivo chico con una rama en la línea 3, para que los offsets tengan un lugar real.
const FUENTE = ['export function f(x) {', '  if (x) return 1;', '  return 2;', '}', ''].join('\n');

test('innermostCount atribuye el offset al rango más chico que lo contiene', () => {
  const funciones = proceso(fn('f', [rango(0, 100, 7), rango(20, 40, 3), rango(25, 30, 1)]));
  assert.equal(innermostCount(funciones, 27), 1, 'el rango más interno manda');
  assert.equal(innermostCount(funciones, 35), 3);
  assert.equal(innermostCount(funciones, 50), 7, 'un bloque sin rango propio hereda el de afuera');
  assert.equal(innermostCount(funciones, 200), null, 'fuera de todo rango no hay nada que decir');
  assert.equal(innermostCount(proceso(), 0), null);
});

test('FALSIFICACIÓN · un proceso que no ejecutó el código no puede tapar al que sí lo ejecutó', () => {
  // Este es exactamente el dato que hacía inestable al gate: V8 sólo emite un sub-rango cuando su
  // cuenta difiere de la del bloque de afuera, así que el proceso que SÍ ejecutó la rama no reporta
  // rango alguno sobre ella, y el que apenas importó el módulo reporta un cero. Sumar heredando la
  // cuenta del rango que envuelve es lo que impide que ese cero gane.
  const ejecuta = proceso(fn('f', [rango(0, 100, 4)]));
  const sóloImporta = proceso(fn('f', [rango(0, 100, 0), rango(20, 40, 0)]));
  assert.equal(totalCount([ejecuta, sóloImporta], 30), 4);
  assert.equal(totalCount([sóloImporta], 30), 0);
  assert.equal(totalCount([], 30), 0);
});

test('lineAt nombra la línea 1-based del offset, incluso más allá del final', () => {
  assert.equal(lineAt(FUENTE, 0), 1);
  assert.equal(lineAt(FUENTE, FUENTE.indexOf('return 2')), 3);
  assert.equal(lineAt(FUENTE, FUENTE.length + 500), 5, 'un offset pasado de largo no cuelga ni miente de más');
});

test('uncoveredRanges nombra cada función y cada rama que ningún proceso ejecutó', () => {
  const inicioSi = FUENTE.indexOf('if (x)');
  const inicioMuerta = FUENTE.indexOf('return 2');
  const procesos = [
    proceso(
      fn('f', [rango(0, FUENTE.length, 5), rango(inicioSi, inicioSi + 16, 5), rango(inicioMuerta, inicioMuerta + 9, 0)]),
      fn('jamás', [rango(FUENTE.length - 2, FUENTE.length, 0)]),
    ),
  ];
  const huecos = uncoveredRanges(procesos, FUENTE);
  assert.deepEqual(huecos.map((hueco) => `${hueco.kind}:${hueco.line}:${hueco.name}`), ['rama:3:f', 'función:4:jamás']);
});

test('uncoveredRanges ignora funciones sin rangos y sub-rangos sin cobertura de bloque', () => {
  const procesos = [proceso(
    fn('vacía', []),
    fn('sinBloques', [rango(0, 10, 1), rango(2, 4, 0)], false),
  )];
  assert.deepEqual(uncoveredRanges(procesos, FUENTE), [], 'sin isBlockCoverage los sub-rangos no son ramas medibles');
});

test('el veredicto de cada rango no depende del orden en que se lean los procesos', () => {
  // La razón de ser del arreglo: antes el número lo producía un merge sensible al orden de lectura
  // de ~600 archivos de cobertura cuyos nombres llevan pid y timestamp. Reproducido el 2026-08-29:
  // tres corridas seguidas sobre un árbol quieto dieron OK / FALLA / OK.
  const a = proceso(fn('f', [rango(0, 100, 1), rango(10, 20, 0)]));
  const b = proceso(fn('f', [rango(0, 100, 1), rango(10, 20, 3)]));
  const c = proceso(fn('f', [rango(0, 100, 0), rango(10, 20, 0)]));
  const ordenes = [[a, b, c], [c, b, a], [b, c, a], [a, c, b]];
  const resultados = ordenes.map((procesos) => JSON.stringify(uncoveredRanges(procesos, FUENTE)));
  assert.equal(new Set(resultados).size, 1, 'cuatro órdenes, un solo resultado');
  assert.equal(JSON.parse(resultados[0]).length, 0);
});

test('uncoveredRanges cuenta una sola vez el mismo rango reportado por varios procesos', () => {
  const uno = proceso(fn('f', [rango(0, 100, 0), rango(10, 20, 0)]));
  const otro = proceso(fn('f', [rango(0, 100, 0), rango(10, 20, 0)]));
  const huecos = uncoveredRanges([uno, otro], FUENTE);
  assert.deepEqual(huecos.map((hueco) => hueco.kind), ['función', 'rama']);
});

test('collectScriptCoverage indexa por la URL exacta del archivo del proyecto', () => {
  const directorio = mkdtempSync(join(tmpdir(), 'vcp-cov-test-'));
  try {
    const url = pathToFileURL(join(repoRoot, 'scripts', 'demo.mjs')).href;
    writeFileSync(join(directorio, 'coverage-1.json'), JSON.stringify({
      result: [{ url, functions: [fn('f', [rango(0, 10, 1)])] }],
    }));
    writeFileSync(join(directorio, 'coverage-2.json'), JSON.stringify({
      result: [
        { url: 'file:///C:/Temp/vcp-e2e-XXXX/.vibe/vcp-runtime/scripts/demo.mjs', functions: [fn('f', [rango(0, 10, 0)])] },
        { url },
      ],
    }));
    writeFileSync(join(directorio, 'coverage-3.json'), JSON.stringify({ sin: 'result' }));
    const { byScript, unreadable } = collectScriptCoverage(directorio, ['scripts/demo.mjs'], repoRoot);
    assert.deepEqual(unreadable, []);
    const procesos = byScript.get('scripts/demo.mjs');
    assert.equal(procesos.length, 2, 'la copia en un directorio temporal es otro archivo y no cuenta');
    assert.deepEqual(procesos[1], [], 'una entrada sin funciones aporta una lista vacía, no undefined');
  } finally {
    rmSync(directorio, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un archivo de cobertura ilegible se informa, nunca se saltea en silencio', () => {
  const { unreadable, byScript } = collectScriptCoverage('/cov', ['scripts/demo.mjs'], repoRoot, {
    list: () => ['roto.json', 'bueno.json'],
    read: (file) => (file.endsWith('roto.json') ? '{ esto no es json' : JSON.stringify({ result: [] })),
  });
  assert.equal(unreadable.length, 1);
  assert.match(unreadable[0], /^roto\.json: /u);
  assert.deepEqual(byScript.get('scripts/demo.mjs'), []);
});

test('evaluateCoverage separa el hueco real del script que nadie midió', () => {
  const fuentes = new Map([['scripts/a.mjs', FUENTE]]);
  const sinDatos = evaluateCoverage(new Map([['scripts/a.mjs', []]]), fuentes);
  assert.equal(sinDatos.ok, false);
  assert.equal(sinDatos.code, NO_COVERAGE_DATA);
  assert.match(sinDatos.message, /está sin medir/u);

  const conHueco = evaluateCoverage(new Map([['scripts/a.mjs', [proceso(fn('', [rango(0, 20, 0)]))]]]), new Map());
  assert.equal(conHueco.ok, false);
  assert.equal(conHueco.code, null);
  assert.match(conHueco.message, /scripts\/a\.mjs:1 \(función\)/u, 'una función anónima se nombra sin inventarle nombre');

  const limpio = evaluateCoverage(new Map([['scripts/a.mjs', [proceso(fn('f', [rango(0, 20, 2)]))]]]), fuentes);
  assert.equal(limpio.ok, true);
  assert.match(limpio.message, /1 script\(s\)/u);
});

test('runCoverage corre la suite con NODE_V8_COVERAGE apuntando al directorio que le dan', () => {
  const llamadas = [];
  runCoverage((command, args, options) => {
    llamadas.push({ command, args, options });
    return { status: 0 };
  }, '/proyecto', '/cobertura');
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].command, process.execPath);
  assert.deepEqual(llamadas[0].args, ['--test', '--test-concurrency=32']);
  assert.equal(llamadas[0].options.cwd, '/proyecto');
  assert.equal(llamadas[0].options.env.NODE_V8_COVERAGE, '/cobertura');
});

test('listMjsScripts includes only executable Node files from its explicit inventory', () => {
  const entries = [
    { name: 'verify-one.mjs', isFile: () => true },
    { name: 'notes.md', isFile: () => true },
    { name: 'nested', isFile: () => false },
  ];
  assert.deepEqual(listMjsScripts('/project', () => entries), ['scripts/verify-one.mjs']);
  assert.ok(listMjsScripts(repoRoot).includes('scripts/verify-vcp-coverage.mjs'));
});

test('fingerprintScripts cambia cuando cambia el contenido de un script', () => {
  const list = () => ['scripts/uno.mjs', 'scripts/dos.mjs'];
  const antes = fingerprintScripts(list, (name) => (name.includes('uno') ? 'a' : 'b'));
  assert.equal(fingerprintScripts(() => ['scripts/dos.mjs', 'scripts/uno.mjs'], (name) => (name.includes('uno') ? 'a' : 'b')), antes, 'el orden del inventario no cambia la huella');
  assert.notEqual(fingerprintScripts(list, (name) => (name.includes('uno') ? 'a!' : 'b')), antes);
});

test('FALSIFICACIÓN · un script no puede hacerse pasar por dos escribiendo el separador adentro', () => {
  // Con un separador imprimible las dos huellas de abajo salen idénticas: el contenido del primero
  // reconstruye letra por letra al segundo. El separador es NUL justamente porque es el único byte
  // que no puede aparecer ni en un nombre de archivo ni en el texto de un script.
  const dosScripts = fingerprintScripts(() => ['scripts/a.mjs', 'scripts/b.mjs'], (name) => (name.includes('a.mjs') ? 'x' : 'y'));
  const unoDisfrazado = fingerprintScripts(() => ['scripts/a.mjs'], () => `x scripts/b.mjs${String.fromCharCode(10)}y`);
  assert.notEqual(unoDisfrazado, dosScripts);
});

/** main con todo inyectado: nunca lanza la suite de verdad. */
function correrMain(overrides = {}) {
  const salida = [];
  const errores = [];
  const io = {
    mkdtemp: () => '/cov',
    rmdir: () => {},
    readScriptsDir: () => [{ name: 'demo.mjs', isFile: () => true }],
    list: () => ['scripts/demo.mjs'],
    read: () => FUENTE,
    listCoverage: () => ['coverage-1.json'],
    readCoverage: () => JSON.stringify({ result: [] }),
    ...overrides.io,
  };
  const code = main(
    overrides.args ?? [],
    overrides.run ?? (() => ({ status: 0, stdout: '', stderr: '' })),
    (line) => salida.push(line),
    (line) => errores.push(line),
    overrides.cwd ?? repoRoot,
    io,
  );
  return { code, salida, errores };
}

test('main rechaza argumentos sin lanzar la suite', () => {
  const { code, errores } = correrMain({ args: ['extra'], run: () => assert.fail('no se puede lanzar la suite') });
  assert.equal(code, 2);
  assert.match(errores.at(-1), /^usage: /u);
});

test('main informa un inventario ilegible en vez de medir cero scripts', () => {
  const salida = [];
  const errores = [];
  const code = main([], () => assert.fail('no se puede lanzar la suite'), (line) => salida.push(line), (line) => errores.push(line), '/no-existe');
  assert.equal(code, 1);
  assert.match(errores.at(-1), /Unable to inventory scripts/u);
});

test('FALSIFICACIÓN · main rechaza cuando la suite no arranca o termina en rojo', () => {
  const noArranca = correrMain({ run: () => ({ error: new Error('spawn ENOENT') }) });
  assert.equal(noArranca.code, 1);
  assert.match(noArranca.errores.at(-1), /could not launch: spawn ENOENT/u);

  const enRojo = correrMain({ run: () => ({ status: 1, stdout: 'fallaron 3 pruebas', stderr: '' }) });
  assert.equal(enRojo.code, 1);
  assert.equal(enRojo.errores.at(-2), 'fallaron 3 pruebas');
  assert.match(enRojo.errores.at(-1), /exited 1/u);

  const enRojoSinSalida = correrMain({ run: () => ({ status: 7 }) });
  assert.equal(enRojoSinSalida.code, 1);
  assert.match(enRojoSinSalida.errores.at(-1), /exited 7/u);
});

test('FALSIFICACIÓN · si los scripts cambian durante la corrida, el gate rechaza en vez de informar un número', () => {
  let lecturas = 0;
  const { code, errores } = correrMain({ io: { read: () => `contenido ${(lecturas += 1)}` } });
  assert.equal(code, 1);
  assert.match(errores.at(-1), new RegExp(NO_INPUTS_SOURCE_CHANGED, 'u'));
});

test('FALSIFICACIÓN · una medición incompleta se rechaza, no se completa con ceros', () => {
  const { code, errores } = correrMain({ io: { readCoverage: () => 'no json' } });
  assert.equal(code, 1);
  assert.match(errores.at(-1), new RegExp(UNREADABLE_COVERAGE, 'u'));
});

test('main nombra el archivo y la línea de cada rama que nadie ejecutó', () => {
  const url = pathToFileURL(join(repoRoot, 'scripts', 'demo.mjs')).href;
  const { code, errores } = correrMain({
    io: {
      readCoverage: () => JSON.stringify({
        result: [{ url, functions: [fn('f', [rango(0, FUENTE.length, 3), rango(FUENTE.indexOf('return 2'), FUENTE.length - 2, 0)])] }],
      }),
    },
  });
  assert.equal(code, 1);
  assert.match(errores.at(-1), /scripts\/demo\.mjs:3 \(rama f\)/u);
});

test('main rechaza un script del que la suite no dejó ningún dato', () => {
  const { code, errores } = correrMain();
  assert.equal(code, 1);
  assert.match(errores.at(-1), new RegExp(NO_COVERAGE_DATA, 'u'));
});

test('main informa el resultado normal cuando todo se ejecutó', () => {
  const url = pathToFileURL(join(repoRoot, 'scripts', 'demo.mjs')).href;
  const { code, salida } = correrMain({
    io: { readCoverage: () => JSON.stringify({ result: [{ url, functions: [fn('f', [rango(0, FUENTE.length, 3)])] }] }) },
  });
  assert.equal(code, 0);
  assert.match(salida.at(-1), /^OK: los 1 script\(s\)/u);
});

test('main crea y borra su propio directorio de cobertura cuando nadie se lo inyecta', () => {
  const salida = [];
  const errores = [];
  let visto = null;
  const code = main([], (spawn, cwd, directorio) => {
    visto = directorio;
    return { status: 3 };
  }, (line) => salida.push(line), (line) => errores.push(line), repoRoot, {
    readScriptsDir: () => [{ name: 'demo.mjs', isFile: () => true }],
    // La huella se toma sobre el inventario inyectado, asi que la lectura tambien se inyecta: sin
    // esto el fixture medía el repo real por atras y la prueba no hablaba del proyecto que declara.
    read: () => 'contenido de demo',
    listCoverage: () => [],
    readCoverage: () => '{}',
  });
  assert.equal(code, 1);
  assert.ok(visto.includes('vcp-coverage-'), 'el directorio sale de mkdtemp, no de una ruta fija');
  assert.throws(() => readdirSync(visto), { code: 'ENOENT' }, 'y se borra aunque la corrida haya fallado');
});


test('FALSIFICACIÓN · un script ilegible al tomar la huella se rechaza antes de crear nada', () => {
  // Sin esto el gate salía por una excepción sin manejar, y además dejaba el directorio temporal
  // huérfano en el disco: la huella se tomaba DESPUÉS de crearlo.
  const errores = [];
  let creoDirectorio = false;
  let lanzoLaSuite = false;
  const code = main([], () => { lanzoLaSuite = true; return { status: 0 }; }, () => {}, (line) => errores.push(line), repoRoot, {
    readScriptsDir: () => [{ name: 'fantasma.mjs', isFile: () => true }],
    read: () => { throw new Error('ENOENT: no such file or directory'); },
    mkdtemp: () => { creoDirectorio = true; return 'no-deberia-crearse'; },
  });
  assert.equal(code, 1);
  assert.match(errores.at(-1), /COVERAGE_SOURCE_CHANGED/u);
  assert.equal(creoDirectorio, false, 'rechazó pero igual creó un directorio temporal que nadie borra');
  assert.equal(lanzoLaSuite, false, 'lanzó la suite entera sabiendo que la huella no se podía tomar');
});

test('FALSIFICACIÓN · un script que desaparece durante la medición se rechaza como árbol movido', () => {
  const errores = [];
  let lecturas = 0;
  const code = main([], () => ({ status: 0, stdout: '', stderr: '' }), () => {}, (line) => errores.push(line), repoRoot, {
    readScriptsDir: () => [{ name: 'demo.mjs', isFile: () => true }],
    read: () => {
      lecturas += 1;
      if (lecturas > 1) throw new Error('ENOENT: el script se borró a mitad de la corrida');
      return 'contenido de demo';
    },
    listCoverage: () => [],
    readCoverage: () => '{}',
  });
  assert.equal(code, 1);
  assert.match(errores.at(-1), /COVERAGE_SOURCE_CHANGED/u);
});

test('resolveTestConcurrency usa 32 por defecto y sólo acepta un override entero positivo', () => {
  // El default volvió a 32 cuando se cerró el defecto que obligaba a serializar: serializar tapaba
  // una suite inestable en vez de arreglarla. El override existe para una máquina con menos
  // núcleos, no para volver a esconder un rojo, así que sólo acepta un entero positivo.
  assert.equal(DEFAULT_TEST_CONCURRENCY, '32');
  assert.equal(resolveTestConcurrency({}), '32');
  assert.equal(resolveTestConcurrency({ VCP_TEST_CONCURRENCY: '4' }), '4');
  for (const malo of ['0', '-1', '2.5', '', ' 4', 'ocho', '04x']) {
    assert.equal(resolveTestConcurrency({ VCP_TEST_CONCURRENCY: malo }), '32', `aceptó ${JSON.stringify(malo)} como concurrencia`);
  }
  assert.equal(resolveTestConcurrency({ VCP_TEST_CONCURRENCY: 4 }), '32', 'un número no es un string de entorno');
});

test('fingerprintScripts sin inyecciones lee el inventario y el contenido reales del proyecto', () => {
  // Sus lectores por defecto son los que corren en producción: si sólo se los ejercita inyectados,
  // el camino que de verdad se usa nunca se ejecuta y el gate no lo sabe.
  const huella = fingerprintScripts();
  assert.match(huella, /^[0-9a-f]{64}$/u);
  assert.equal(huella, fingerprintScripts(), 'la huella del mismo árbol quieto tiene que repetirse');
  const inventario = listMjsScripts();
  assert.ok(inventario.includes('scripts/verify-vcp-coverage.mjs'), 'el inventario por defecto no se leyó del proyecto');
});
test('CLI usage is fast and rejects arguments without launching the coverage suite', () => {
  const started = Date.now();
  const usage = spawnSync(process.execPath, [coverageGate, 'unexpected'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /^usage: /u);
  assert.ok(Date.now() - started < 30_000, 'un error de uso no puede lanzar la suite entera');
});

test('el gate mide contra un proyecto real de punta a punta', () => {
  // Un proyecto de juguete con un script y su prueba: prueba que las piezas se enchufan entre sí
  // -- correr la suite, leer NODE_V8_COVERAGE, decidir -- y no sólo que cada una anda por separado.
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-cov-e2e-'));
  try {
    mkdirSync(join(raiz, 'scripts'));
    mkdirSync(join(raiz, 'tests'));
    writeFileSync(join(raiz, 'scripts', 'demo.mjs'), 'export function demo(x) {\n  if (x) return 1;\n  return 2;\n}\n');
    writeFileSync(join(raiz, 'tests', 'demo.test.mjs'), [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "import { demo } from '../scripts/demo.mjs';",
      "test('ambas ramas', () => { assert.equal(demo(1), 1); assert.equal(demo(0), 2); });",
      '',
    ].join('\n'));
    const salida = [];
    const rechazos = [];
    assert.equal(main([], runCoverage, (line) => salida.push(line), (line) => rechazos.push(line), raiz), 0, rechazos.join(' || '));
    assert.match(salida.at(-1), /^OK: /u);

    // Y la mitad que importa: con una rama sin ejecutar, el mismo gate la nombra.
    writeFileSync(join(raiz, 'tests', 'demo.test.mjs'), [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "import { demo } from '../scripts/demo.mjs';",
      "test('una sola rama', () => { assert.equal(demo(1), 1); });",
      '',
    ].join('\n'));
    const errores = [];
    assert.equal(main([], runCoverage, () => {}, (line) => errores.push(line), raiz), 1);
    // V8 llama a esa rama por donde empieza el bloque implícito, la línea del `if`, no la del
    // `return` que quedó sin correr. El gate reporta la línea que V8 nombra, sin reinterpretarla.
    assert.match(errores.at(-1), /scripts\/demo\.mjs:2 \(rama demo\)/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
