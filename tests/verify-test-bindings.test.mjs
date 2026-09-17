import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

import { esRuntimeInstalado } from './_entorno.mjs';

// Self-check: mide la duracion de una prueba de ESTE checkout contra el tope del gate.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};
const script = join(repoRoot, 'scripts', 'verify-test-bindings.mjs');
const {
  TAP_TIMEOUT_MS, checkActiveBindings, checkTestBinding, createCachedBindingCheck, hasLiteralTestDeclaration, main, parseTapResults, validateTestReference,
} = await import(pathToFileURL(script).href);

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-discovery-bindings-'));
  mkdirSync(join(root, 'tests'));
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeTest(root, name, source) {
  const relative = `tests/${name}`;
  writeFileSync(join(root, relative), source);
  return relative;
}

function row(overrides = {}) {
  return {
    req_id: 'REQ-I01',
    status: 'active',
    target_phase: 'I2',
    implemented_phase: 'I2',
    test_ref: 'tests/binding.test.mjs',
    test_name: 'REQ-I01 · binding verde aislado',
    ...overrides,
  };
}


/** La declaracion del archivo mas lento, leida del contrato. */
export function declaracionDelMasLento(raiz, leer = readFileSync) {
  const d = JSON.parse(leer(join(raiz, 'contracts', 'slowest-test.json'), 'utf8'));
  return validarDeclaracion(d, (a) => existsSync(join(raiz, 'tests', a)));
}

/** Lo que una declaracion tiene que traer para que la medicion signifique algo. */
export function validarDeclaracion(d, existe) {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) throw new Error('la declaración del archivo más lento tiene que ser un objeto');
  if (typeof d.archivo !== 'string' || !/\.test\.mjs$/u.test(d.archivo)) throw new Error(`archivo inválido: ${JSON.stringify(d.archivo)}`);
  if (!existe(d.archivo)) throw new Error(`${d.archivo} no existe: la declaración quedó vieja y la prueba estaría midiendo otra cosa`);
  // `2026-13-45` pasa el patron y revienta al convertirla: `new Date` la rueda o la vuelve invalida,
  // y `toISOString` tira un RangeError que no dice nada de la declaracion. Se comprueba antes.
  const comoFecha = typeof d.medido === 'string' ? new Date(`${d.medido}T00:00:00Z`) : null;
  if (comoFecha === null || !/^\d{4}-\d{2}-\d{2}$/u.test(d.medido) || Number.isNaN(comoFecha.getTime()) || comoFecha.toISOString().slice(0, 10) !== d.medido) {
    throw new Error(`fecha inválida: ${JSON.stringify(d.medido)}. Sin fecha no se sabe desde cuándo no se remide`);
  }
  if (!Number.isFinite(d.segundos) || d.segundos <= 0) throw new Error(`segundos inválido: ${JSON.stringify(d.segundos)}`);
  if (typeof d.why_ese !== 'string' || d.why_ese.trim().length < 40) throw new Error('falta el motivo de por qué ESE archivo define el margen');
  return { archivo: d.archivo, medido: d.medido, segundos: d.segundos, why: d.why_ese };
}

/** Cuantos dias pasaron desde que se midio. No rechaza por vieja: publica el numero. */
export function diasDesde(fecha, hoy) {
  return Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000);
}

test('checkTestBinding accepts an isolated, exact and green Node TAP test', () => {
  withFixture((root) => {
    const testRef = writeTest(root, 'binding.test.mjs', [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => assert.equal(1, 1));",
      '',
    ].join('\n'));
    assert.deepEqual(checkTestBinding(row({ test_ref: testRef }), root), { ok: true });
    assert.equal(TAP_TIMEOUT_MS > 0, true);
  });
});

test('FALSIFICACIÓN · binding rejects unsafe/static/missing/failed/skipped/duplicate TAP evidence', () => {
  withFixture((root) => {
    const valid = writeTest(root, 'binding.test.mjs', [
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));
    const noDeclaration = writeTest(root, 'no-declaration.test.mjs', "// test('REQ-I01 · binding verde aislado')\n");
    const failed = writeTest(root, 'failed.test.mjs', [
      "import assert from 'node:assert/strict';",
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => assert.equal(1, 2));",
      '',
    ].join('\n'));
    const skipped = writeTest(root, 'skipped.test.mjs', [
      "import test from 'node:test';",
      "test.skip('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));

    assert.equal(validateTestReference('../outside.test.mjs', root).ok, false);
    assert.equal(checkTestBinding(row({ test_ref: noDeclaration }), root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: failed }), root).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkTestBinding(row({ test_ref: skipped }), root).code, 'DISCOVERY_TEST_BINDING_SKIPPED');
    assert.equal(checkTestBinding(row({ test_ref: valid }), root, {
      spawn: () => ({ status: 0, stdout: [
        'TAP version 13',
        '# Subtest: REQ-I01 · binding verde aislado',
        'ok 1 - REQ-I01 · binding verde aislado',
        'ok 2 - REQ-I01 · binding verde aislado',
        '1..2',
        '',
      ].join('\n'), stderr: '' }),
    }).code, 'DISCOVERY_TEST_BINDING_DUPLICATE_RESULT');
    assert.equal(checkTestBinding(row({ test_ref: valid }), root, {
      spawn: () => ({ status: null, error: { code: 'ETIMEDOUT', message: 'timed out' }, stdout: '', stderr: '' }),
    }).code, 'DISCOVERY_TEST_BINDING_TIMEOUT');
  });
});

test('parseTapResults uses stdout-only exact TAP result lines', () => {
  assert.deepEqual(parseTapResults([
    'ok 1 - REQ-I01 · exact',
    'not ok 2 - REQ-I01 · broken',
    'ok 3 - REQ-I01 · skipped # SKIP reason',
    'ok 4 - REQ-I01 · todo # TODO later',
    '',
  ].join('\n')), [
    { name: 'REQ-I01 · exact', ok: true, skipped: false },
    { name: 'REQ-I01 · broken', ok: false, skipped: false },
    { name: 'REQ-I01 · skipped', ok: true, skipped: true },
    { name: 'REQ-I01 · todo', ok: true, skipped: true },
  ]);
});

test('checkActiveBindings rejects duplicate names and main reports usage, failures and passes', () => {
  const rows = [row(), row({ req_id: 'REQ-I02' })];
  assert.equal(checkActiveBindings(rows, '.', { check: () => ({ ok: true }) }).code, 'DISCOVERY_TEST_BINDING_DUPLICATE');
  const messages = [];
  assert.equal(main([], '.', {}, () => {}, (line) => messages.push(line)), 2);
  assert.match(messages.at(-1), /usage:/iu);
  assert.equal(main(['check'], '.', { readInventory: () => ({ requirements: rows }), check: () => ({ ok: true }) }, () => {}, (line) => messages.push(line)), 1);
  assert.match(messages.at(-1), /DUPLICATE/u);
  assert.equal(main(['check'], '.', { readInventory: () => ({ requirements: [row({ status: 'planned' })] }), check: () => ({ ok: true }) }, () => {}, () => {}), 0);
});

test('checkActiveBindings executes a shared test_ref exactly once while checking every exact TAP name', () => {
  withFixture((root) => {
    const testRef = writeTest(root, 'shared.test.mjs', [
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => {});",
      "test('REQ-I02 · segundo binding verde', () => {});",
      '',
    ].join('\n'));
    let launches = 0;
    const result = checkActiveBindings([
      row({ test_ref: testRef }),
      row({ req_id: 'REQ-I02', test_ref: testRef, test_name: 'REQ-I02 · segundo binding verde' }),
    ], root, {
      spawn: () => {
        launches += 1;
        return { status: 0, stdout: 'ok 1 - REQ-I01 · binding verde aislado\nok 2 - REQ-I02 · segundo binding verde\n', stderr: '' };
      },
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(launches, 1);
  });
});

test('createCachedBindingCheck reutiliza TAP por cwd/test_ref sin omitir la verificación exacta de cada nombre', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-binding-cache-'));
  try {
    mkdirSync(join(root, 'tests'));
    writeFileSync(join(root, 'tests', 'shared.test.mjs'), "import test from 'node:test';\ntest('REQ-A01 · uno', () => {});\ntest('REQ-A02 · dos', () => {});\n");
    let launches = 0;
    const check = createCachedBindingCheck(checkTestBinding, () => {
      launches += 1;
      return { status: 0, stdout: "ok 1 - REQ-A01 · uno\nok 2 - REQ-A02 · dos\n" };
    });
    assert.deepEqual(check(row({ req_id: 'REQ-A01', test_name: 'REQ-A01 · uno', test_ref: 'tests/shared.test.mjs' }), root), { ok: true });
    assert.deepEqual(check(row({ req_id: 'REQ-A02', test_name: 'REQ-A02 · dos', test_ref: 'tests/shared.test.mjs' }), root), { ok: true });
    assert.equal(launches, 1);
    assert.equal(createCachedBindingCheck(() => ({ ok: true }))(row(), root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('static declaration scanning ignores comments and strings, while safe references reject missing files, directories and symlinks', () => {
  const name = 'REQ-I01 · literal seguro';
  assert.equal(hasLiteralTestDeclaration(`// test('${name}', () => {})\n/* test('${name}', () => {}) */\nconst note = "test('${name}', () => {})";\ntest('${name}', () => {});`, name), true);
  assert.equal(hasLiteralTestDeclaration(`/* test('${name}', () => {})`, name), false);
  assert.equal(hasLiteralTestDeclaration(`// test('${name}', () => {})`, name), false);
  assert.equal(hasLiteralTestDeclaration(`const nested = \`test('${name}', () => {})\`;`, name), false);
  assert.equal(hasLiteralTestDeclaration(`const escaped = "quote: \\"";\ntest('${name}', () => {});`, name), true);
  withFixture((root) => {
    assert.equal(validateTestReference('tests/missing.test.mjs', root).ok, false);
    mkdirSync(join(root, 'tests', 'directory.test.mjs'));
    assert.equal(validateTestReference('tests/directory.test.mjs', root).ok, false);
    writeFileSync(join(root, 'outside.test.mjs'), '');
    try {
      symlinkSync(join(root, 'outside.test.mjs'), join(root, 'tests', 'linked.test.mjs'));
      assert.equal(validateTestReference('tests/linked.test.mjs', root).ok, false);
    } catch (error) {
      assert.match(error.code, /EPERM|EACCES/u);
    }
  });
});

test('FALSIFICACIÓN · binding reports malformed rows, missing TAP and runner errors without trusting stderr', () => {
  withFixture((root) => {
    const testRef = writeTest(root, 'binding.test.mjs', [
      "import test from 'node:test';",
      "test('REQ-I01 · binding verde aislado', () => {});",
      '',
    ].join('\n'));
    assert.equal(checkTestBinding(null, root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: 'tests/missing.test.mjs' }), root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: '', stderr: 'ok 1 - REQ-I01 · binding verde aislado' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: null, stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: 0, stdout: 'not ok 1 - REQ-I01 · binding verde aislado\n', stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkTestBinding(row({ test_ref: testRef }), root, { spawn: () => ({ status: null, error: new Error('launch failed'), stdout: '', stderr: '' }) }).code, 'DISCOVERY_TEST_BINDING_FAILED');
    assert.equal(checkActiveBindings([row({ test_ref: testRef })], root, { check: () => ({ ok: false, code: 'DISCOVERY_TEST_BINDING_MISSING', message: 'missing' }) }).code, 'DISCOVERY_TEST_BINDING_MISSING');
    assert.equal(checkActiveBindings(null, root).code, 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
  });
});

test('binding CLI reads the real inventory by default and catches unreadable injected input', () => {
  assert.equal(main(['check'], repoRoot, {}, () => {}, () => {}), 0);
  const errors = [];
  assert.equal(main(['check'], repoRoot, { readInventory: () => { throw new Error('broken JSON'); } }, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /broken JSON/u);
});

// --- El tope de tiempo, contra la medición ------------------------------------------------------
//
// El gate corre cada `test_ref` con un tope, y ese número estaba por DEBAJO del archivo de prueba
// más lento del repositorio. Medido el 2026-09-05, sin instrumentación:
// `verify-receipt-gate.test.mjs` 39,7 s y `protocolo-e2e.test.mjs` 28,8 s, contra un tope de 30 s.
//
// Ninguno de los dos está hoy en el inventario, así que no estaba roto — era una bomba con la mecha
// medida: el día que alguien vincule un requisito a uno de esos archivos, el gate lo marca TIMEOUT
// y el fallo no habla del test sino de su duración. Bajo la instrumentación de cobertura, que
// multiplica los tiempos, ya explotó una vez ese mismo día.
//
// Esta prueba no fija un número: fija la RELACIÓN. Si mañana una prueba legítima se vuelve más lenta
// que el tope, se pone roja y obliga a mirar cuál de las dos cosas hay que cambiar.

test('el tope de tiempo del gate deja margen sobre la prueba más lenta que el propio repositorio corre', SOLO_FUENTE, (t) => {
  // NO VALE MEDIR DURACION MIENTRAS LA SUITE ENTERA CORRE EN PARALELO. El gate de cobertura lanza
  // todos los archivos a la vez, y este mide cuanto tarda uno: con noventa procesos compitiendo por
  // la CPU se mide contencion, no el archivo. Medido el 2026-09-15: 121 y 126 s bajo cobertura
  // contra 111 s en una corrida normal, con el tope en 120. Se saltea diciendolo, porque un pase
  // silencioso se leeria como «el tope tiene margen» y lo cierto es que no se pudo medir.
  if (process.env.NODE_V8_COVERAGE !== undefined) {
    t.skip('bajo la corrida de cobertura la suite entera compite por la CPU: medir duración acá mide contención, no el archivo');
    return;
  }
  const archivos = readdirSync(join(repoRoot, 'tests')).filter((n) => n.endsWith('.test.mjs'));
  assert.ok(archivos.length > 50, 'el barrido tiene que ver la suite entera');
  // No se corren los 90 archivos —eso duplicaría la suite—: se mide el que la medición del
  // 2026-09-05 señaló como el más lento, que es el que define el margen.
  // EL NOMBRE SALE DEL CONTRATO, no de una constante escrita aca. Estaba escrita a mano y quedo
  // vieja: apuntaba a un archivo ya partido en dos mientras otro reventaba el tope sin que nadie lo
  // mirara. Sigue siendo una declaracion -- correr los 90 archivos duplicaria la suite -- pero es
  // una declaracion VISIBLE, con la fecha en que se midio.
  const declarado = declaracionDelMasLento(repoRoot);
  const masLento = declarado.archivo;
  assert.ok(archivos.includes(masLento), `${masLento} tiene que existir, o esta prueba mide otra cosa`);
  const inicio = Date.now();
  const r = spawnSync(process.execPath, ['--test', join('tests', masLento)], {
    cwd: repoRoot, encoding: 'utf8', timeout: TAP_TIMEOUT_MS * 3,
    // NODE_V8_COVERAGE se saca porque el tope gobierna la corrida NORMAL, asi que medir el hijo
    // instrumentado compararia dos cosas distintas. NO era la causa del rojo que aparecio el
    // 2026-09-15 -- se saco y siguio fallando, asi que esa hipotesis se descarto midiendo --, pero
    // se queda porque la comparacion correcta es contra la corrida que el tope gobierna.
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_V8_COVERAGE: undefined },
  });
  const tardo = Date.now() - inicio;
  assert.equal(r.status, 0, `${masLento} tiene que pasar, o lo que se mide no es su duración`);
  assert.ok(tardo < TAP_TIMEOUT_MS, `${masLento} tarda ${Math.round(tardo / 1000)} s y el tope es ${TAP_TIMEOUT_MS / 1000} s: vincular un requisito a ese archivo lo marcaría TIMEOUT por lento, no por roto`);
});

// --- El lexer estaba ciego a los literales de expresion regular ---------------------------------
//
// LA HERIDA, medida el 2026-09-08 sobre tests/*.test.mjs: una comilla adentro de un regex metia al
// escaner en modo cadena y se tragaba todo hasta la siguiente comilla suelta. Doce declaraciones
// test() REALES quedaban invisibles en siete archivos -- el tramo mayor, 3.702 bytes en
// tests/home-intacto.test.mjs --, y sobre scripts/ llegaba a 15.643 bytes.
//
// La consecuencia no era cosmetica: vincular un requisito a cualquiera de esas doce pruebas daba
// DISCOVERY_TEST_BINDING_STATIC_INVALID sobre una prueba que esta a la vista y pasa en verde. Un
// falso positivo BLOQUEANTE, ya publicado.

test('FALSIFICACIÓN · una comilla adentro de un regex no se traga la declaración que sigue', () => {
  const fuente = [
    "const RE = /^:root:not\(\[data-theme=[\"']?light[\"']?\]\)$/u;",
    "test('la declaración que viene después del regex tiene que verse', () => {});",
  ].join('\n');
  assert.equal(hasLiteralTestDeclaration(fuente, 'la declaración que viene después del regex tiene que verse'), true);
});

test('FALSIFICACIÓN · una división no se confunde con un regex, y un regex con llaves tampoco', () => {
  const division = [
    'const mitad = total / 2;',
    "test('después de una división', () => {});",
  ].join('\n');
  assert.equal(hasLiteralTestDeclaration(division, 'después de una división'), true);

  const claseYEscape = [
    "const RE = /[/'\"]\\//gu;",
    "test('después de una clase con barra y comillas', () => {});",
  ].join('\n');
  assert.equal(hasLiteralTestDeclaration(claseYEscape, 'después de una clase con barra y comillas'), true);
});

test('una declaración con backtick se ve, y una interpolada no se puede casar', () => {
  assert.equal(hasLiteralTestDeclaration('test(`con backtick`, () => {});', 'con backtick'), true);
  // Un nombre interpolado no tiene forma literal: no se adivina, se declara como límite.
  assert.equal(hasLiteralTestDeclaration('test(`AC1 · tope ${MAX}`, () => {});', 'AC1 · tope 5'), false);
});

test('EL DETECTOR DEL DETECTOR · toda declaración real de tests/ la ve el escáner', SOLO_FUENTE, () => {
  // El lexer no puede ser su propio detector. Se usa un segundo implementador con modo de falla
  // distinto: un regex anclado a linea, sin estado, sobre los archivos reales del repositorio. Es
  // el metodo con el que se encontro el defecto, y agarra la regresion cuando alguien escriba el
  // proximo regex con comillas adentro.
  const DECLARACION = /^\s*(?:test|it)(?:\.(?:skip|todo))?\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/gmu;
  const invisibles = [];
  for (const archivo of readdirSync(join(repoRoot, 'tests')).filter((n) => n.endsWith('.test.mjs'))) {
    const fuente = readFileSync(join(repoRoot, 'tests', archivo), 'utf8');
    for (const [, comilla, nombre] of fuente.matchAll(DECLARACION)) {
      // Un nombre interpolado no tiene forma literal: queda fuera por declaración, no por descuido.
      if (comilla === '`' && nombre.includes('${')) continue;
      const literal = nombre.replace(/\\(.)/gu, '$1');
      if (!hasLiteralTestDeclaration(fuente, literal)) invisibles.push(`${archivo}: ${literal}`);
    }
  }
  assert.deepEqual(invisibles, [], `${invisibles.length} declaración(es) reales que el escáner no ve`);
});

// --- Cual es el archivo mas lento, y desde cuando se sabe ----------------------------------------

test('el archivo mas lento se declara en un contrato, no se escribe adentro de la prueba', SOLO_FUENTE, () => {
  // Estaba escrito a mano y quedó viejo: el 2026-09-16 apuntaba a un archivo que ya se había
  // partido en dos, mientras el que de verdad reventaba el tope pasaba sin que nada lo mirara.
  const d = declaracionDelMasLento(repoRoot);
  assert.match(d.archivo, /\.test\.mjs$/u);
  assert.equal(existsSync(join(repoRoot, 'tests', d.archivo)), true, `${d.archivo} tiene que existir, o la prueba mide otra cosa`);
  assert.match(d.medido, /^\d{4}-\d{2}-\d{2}$/u, 'la medición lleva fecha: sin eso no se sabe desde cuándo no se remide');
  assert.equal(Number.isFinite(d.segundos) && d.segundos > 0, true);
  assert.ok(d.why.length >= 40, 'por qué ESE archivo define el margen');
});

test('FALSIFICACIÓN · una declaración que apunta a un archivo que ya no existe se rechaza', () => {
  assert.throws(
    () => validarDeclaracion({ archivo: 'se-borro.test.mjs', medido: '2026-09-16', segundos: 90, why: 'un motivo escrito de largo suficiente para pasar' }, () => false),
    /no existe/iu,
  );
});

test('FALSIFICACIÓN · una declaración mal formada se rechaza en vez de medir cualquier cosa', () => {
  const ok = { archivo: 'x.test.mjs', medido: '2026-09-16', segundos: 90, why: 'un motivo escrito de largo suficiente para pasar' };
  for (const roto of [
    { ...ok, archivo: 'x.mjs' },
    { ...ok, medido: 'ayer' },
    { ...ok, medido: '2026-13-45' },
    { ...ok, segundos: 0 },
    { ...ok, segundos: 'noventa' },
    { ...ok, why: 'corto' },
    null,
  ]) {
    assert.throws(() => validarDeclaracion(roto, () => true), /archivo|fecha|segundos|motivo|declaración/iu, JSON.stringify(roto));
  }
});

test('la declaración dice cuántos días pasaron desde que se midió', SOLO_FUENTE, () => {
  // No rechaza por vieja — remedir cuesta minutos y no siempre hay —, pero el número se publica:
  // una declaración de hace tres meses tiene que verse, no esconderse.
  const d = declaracionDelMasLento(repoRoot);
  assert.equal(Number.isInteger(diasDesde(d.medido, '2099-01-01')), true);
  assert.ok(diasDesde(d.medido, d.medido) === 0);
});
