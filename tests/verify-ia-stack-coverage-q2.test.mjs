import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-ia-stack-coverage.mjs');
// Namespace y no import con nombre: cada prueba falla por su cuenta mientras la API no existe.
const gate = await import(pathToFileURL(script).href);

const fn = (name, ranges, isBlockCoverage = true) => ({ functionName: name, isBlockCoverage, ranges });
const rango = (startOffset, endOffset, count) => ({ startOffset, endOffset, count });
// Una funcion con una rama de la linea 3 que nadie ejecuta.
const FUENTE = ['export function f(x) {', '  if (x) return 1;', '  return 2;', '}', ''].join('\n');
const SIN_EJECUTAR = [[fn('f', [rango(0, FUENTE.length, 3), rango(FUENTE.indexOf('return 2'), FUENTE.length - 2, 0)])]];
const EJECUTADO = [[fn('f', [rango(0, FUENTE.length, 3)])]];
const fuentes = new Map([['scripts/a.mjs', FUENTE]]);

const EXENCION = Object.freeze({
  file: 'scripts/a.mjs',
  line: 3,
  owner: 'operador',
  reason: 'el camino solo corre si mv falla, y no hay forma portable de hacerlo fallar',
  evidence: 'docs/plan.md#lote-2, medido el 2026-10-05',
});

test('L2.1 · una exencion completa se acepta y una que le falta dueno, motivo o evidencia se rechaza', () => {
  assert.deepEqual(gate.validarExenciones({ exemptions: [EXENCION], critical_paths: [{ id: 'x' }] }), []);
  assert.deepEqual(gate.validarExenciones({}), [], 'un contrato sin exenciones sigue siendo valido');
  for (const falta of ['file', 'line', 'owner', 'reason', 'evidence']) {
    const incompleta = { ...EXENCION };
    delete incompleta[falta];
    assert.ok(gate.validarExenciones({ exemptions: [incompleta], critical_paths: [{ id: 'x' }] }).length > 0, `sin ${falta} no es una exencion`);
  }
  assert.ok(gate.validarExenciones({ exemptions: [{ ...EXENCION, extra: 1 }] }).length > 0);
});

test('FALSIFICACION · L2.1 · una exencion sin motivo real o con linea imposible se rechaza', () => {
  const malas = [
    { reason: '' }, { reason: 'tbd' }, { reason: 'no se pudo' }, { owner: ' ' }, { evidence: '' },
    { line: 0 }, { line: -3 }, { line: 3.5 }, { line: '3' }, { file: '' }, { file: '../fuera.mjs' }, { file: '/abs.mjs' },
  ];
  for (const cambio of malas) {
    assert.ok(gate.validarExenciones({ exemptions: [{ ...EXENCION, ...cambio }] }).length > 0, JSON.stringify(cambio));
  }
  assert.ok(gate.validarExenciones({ exemptions: 'no es lista' }).length > 0);
  assert.ok(gate.validarExenciones({ exemptions: [EXENCION, { ...EXENCION }] }).some((p) => /repetid/u.test(p)), 'la misma linea dos veces es una trampa');
});

test('FALSIFICACION · L2.1 · aflojar el 100 % exige haber declarado caminos criticos', () => {
  const problemas = gate.validarExenciones({ exemptions: [EXENCION], critical_paths: [] });
  assert.ok(problemas.some((p) => /camino/u.test(p)), 'una exencion sin ningun camino critico declarado es solo bajar la vara');
  assert.deepEqual(gate.validarExenciones({ exemptions: [EXENCION], critical_paths: [{ id: 'x' }] }), []);
});

test('L2.2 · una rama sin ejecutar y SIN exencion sigue en rojo', () => {
  const r = gate.evaluateCoverage(new Map([['scripts/a.mjs', SIN_EJECUTAR]]), fuentes, []);
  assert.equal(r.ok, false);
  assert.match(r.message, /scripts\/a\.mjs:3/u);
});

test('L2.2 · la misma rama CON exencion valida se informa y no es rojo', () => {
  const r = gate.evaluateCoverage(new Map([['scripts/a.mjs', SIN_EJECUTAR]]), fuentes, [EXENCION]);
  assert.equal(r.ok, true, r.message);
  assert.match(r.message, /1 exenta/u);
  assert.match(r.message, /scripts\/a\.mjs:3/u, 'lo exento se nombra: un verde que no dice que exime no deja ver que se eximio');
  assert.match(r.message, /operador/u);
});

test('FALSIFICACION · L2.2 · una exencion que ya no corresponde a ningun hueco es un rechazo', () => {
  const r = gate.evaluateCoverage(new Map([['scripts/a.mjs', EJECUTADO]]), fuentes, [EXENCION]);
  assert.equal(r.ok, false);
  assert.equal(r.code, gate.EXEMPTION_STALE);
  assert.match(r.message, /scripts\/a\.mjs:3/u);
  const otraLinea = gate.evaluateCoverage(new Map([['scripts/a.mjs', SIN_EJECUTAR]]), fuentes, [{ ...EXENCION, line: 9 }]);
  assert.equal(otraLinea.ok, false, 'la exencion de la linea 9 no cubre el hueco de la 3, y ademas sobra');
  const archivoAjeno = gate.evaluateCoverage(new Map([['scripts/a.mjs', EJECUTADO]]), fuentes, [{ ...EXENCION, file: 'scripts/no-esta.mjs' }]);
  assert.equal(archivoAjeno.code, gate.EXEMPTION_STALE, 'una exencion de un archivo que no se mide tambien sobra');
});

test('L2.2 · evaluateCoverage sin exenciones se comporta como antes', () => {
  assert.equal(gate.evaluateCoverage(new Map([['scripts/a.mjs', EJECUTADO]]), fuentes).ok, true);
  assert.equal(gate.evaluateCoverage(new Map([['scripts/a.mjs', SIN_EJECUTAR]]), fuentes).ok, false);
});

const CAMINO = Object.freeze({
  id: 'cadena-de-auditoria',
  boundary: 'una traza ya escrita no se edita sin que el gate lo nombre',
  script: 'scripts/a.mjs',
  test_file: 'tests/a.test.mjs',
  test_name: 'FALSIFICACION · editar una linea rompe la cadena',
  owner: 'revisor independiente',
});
const TEST_OK = "import test from 'node:test';\nimport '../scripts/a.mjs';\ntest('FALSIFICACION · editar una linea rompe la cadena', () => {});\n";
const leer = (texto) => () => texto;

test('L2.3 · un camino critico con una prueba literal que ejerce su script se acepta', () => {
  assert.deepEqual(gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], leer(TEST_OK)), []);
});

test('FALSIFICACION · L2.3 · un camino critico sin prueba que lo ejerza no pasa', () => {
  const sinDeclaracion = gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], leer("import test from 'node:test';\nimport '../scripts/a.mjs';\ntest('otra cosa', () => {});\n"));
  assert.ok(sinDeclaracion.some((p) => /no declara/u.test(p)), sinDeclaracion.join('|'));
  const sinScript = gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], leer("import test from 'node:test';\ntest('FALSIFICACION · editar una linea rompe la cadena', () => {});\n"));
  assert.ok(sinScript.some((p) => /nunca nombra/u.test(p)), 'una prueba que no toca el script no ejerce el camino');
  const salteada = gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], leer("import '../scripts/a.mjs';\ntest.skip('FALSIFICACION · editar una linea rompe la cadena', () => {});\n"));
  assert.ok(salteada.some((p) => /salte|skip|todo/u.test(p)), 'una prueba salteada no ejerce nada');
  const pendiente = gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], leer("import '../scripts/a.mjs';\ntest.todo('FALSIFICACION · editar una linea rompe la cadena');\n"));
  assert.ok(pendiente.length > 0);
});

test('FALSIFICACION · L2.3 · un camino critico mal formado se rechaza campo por campo', () => {
  const inv = ['scripts/a.mjs'];
  assert.ok(gate.validarCaminosCriticos([{ ...CAMINO, script: 'scripts/otro.mjs' }], inv, leer(TEST_OK)).some((p) => /inventario/u.test(p)));
  for (const cambio of [{ id: 'Mal Id' }, { id: '' }, { owner: ' ' }, { boundary: '' }, { test_file: '../x.test.mjs' }, { test_file: 'tests/a.mjs' }, { test_file: '/abs/a.test.mjs' }, { test_name: ' ' }]) {
    assert.ok(gate.validarCaminosCriticos([{ ...CAMINO, ...cambio }], inv, leer(TEST_OK)).length > 0, JSON.stringify(cambio));
  }
  assert.ok(gate.validarCaminosCriticos([{ ...CAMINO, extra: 1 }], inv, leer(TEST_OK)).length > 0);
  assert.ok(gate.validarCaminosCriticos([CAMINO, { ...CAMINO }], inv, leer(TEST_OK)).some((p) => /repetid/u.test(p)));
  assert.ok(gate.validarCaminosCriticos('no es lista', inv, leer(TEST_OK)).length > 0);
});

test('L2.3 · un archivo de prueba que no se puede leer se nombra, no se supone', () => {
  const problemas = gate.validarCaminosCriticos([CAMINO], ['scripts/a.mjs'], () => { throw new Error('ENOENT: no existe'); });
  assert.ok(problemas.some((p) => /tests\/a\.test\.mjs/u.test(p) && /ENOENT/u.test(p)));
});

test('L2.3 · el contrato real declara caminos criticos y cada uno verifica contra el arbol', () => {
  const contrato = JSON.parse(gateRead('contracts/coverage-scope.json'));
  assert.ok(Array.isArray(contrato.critical_paths) && contrato.critical_paths.length >= 5, 'Q2 sustituye el 100 % fijo por caminos criticos: tienen que existir');
  const inventario = gate.listMjsScripts(repoRoot);
  const leerReal = (ruta) => gateRead(ruta);
  assert.deepEqual(gate.validarCaminosCriticos(contrato.critical_paths, inventario, leerReal), []);
});

function gateRead(ruta) {
  return readFileSync(join(repoRoot, ruta), 'utf8');
}

test('L2.2 · main lee exenciones y caminos del contrato y los informa en el verde', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-q2-'));
  try {
    mkdirSync(join(raiz, 'scripts'));
    mkdirSync(join(raiz, 'tests'));
    mkdirSync(join(raiz, 'contracts'));
    writeFileSync(join(raiz, 'scripts', 'a.mjs'), FUENTE);
    writeFileSync(join(raiz, 'tests', 'a.test.mjs'), "import test from 'node:test';\nimport '../scripts/a.mjs';\ntest('FALSIFICACION · editar una linea rompe la cadena', () => {});\n");
    const contrato = {
      schema: 'ia.coverage-scope/1',
      why: 'x',
      measured: [{ directory: 'scripts', why: 'x' }],
      excluded: [],
      critical_paths: [{ ...CAMINO }],
      exemptions: [{ ...EXENCION }],
    };
    writeFileSync(join(raiz, 'contracts', 'coverage-scope.json'), JSON.stringify(contrato));
    const salida = [];
    const errores = [];
    const code = gate.main([], () => ({ status: 0, stdout: '', stderr: '' }), (l) => salida.push(l), (l) => errores.push(l), raiz, {
      mkdtemp: () => 'cov',
      rmdir: () => {},
      listCoverage: () => ['c.json'],
      readCoverage: () => JSON.stringify({ result: [{ url: pathToFileURL(join(raiz, 'scripts', 'a.mjs')).href, functions: SIN_EJECUTAR[0] }] }),
    });
    assert.equal(code, 0, errores.join(' | '));
    assert.match(salida.join('\n'), /1 exenta/u);
    assert.match(salida.join('\n'), /1 camino/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

/** Un proyecto de juguete con su contrato; `ajuste` modifica el contrato antes de escribirlo. */
function proyectoConContrato(ajuste) {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-q2-contrato-'));
  mkdirSync(join(raiz, 'scripts'));
  mkdirSync(join(raiz, 'tests'));
  mkdirSync(join(raiz, 'contracts'));
  writeFileSync(join(raiz, 'scripts', 'a.mjs'), FUENTE);
  writeFileSync(join(raiz, 'tests', 'a.test.mjs'), TEST_OK);
  const contrato = { schema: 'ia.coverage-scope/1', why: 'x', measured: [{ directory: 'scripts', why: 'x' }], excluded: [] };
  ajuste(contrato);
  writeFileSync(join(raiz, 'contracts', 'coverage-scope.json'), JSON.stringify(contrato));
  return raiz;
}

function correr(raiz, io = {}) {
  const errores = [];
  const code = gate.main([], () => assert.fail('el contrato roto se rechaza antes de correr la suite'), () => {}, (l) => errores.push(l), raiz, io);
  return { code, errores: errores.join('\n') };
}

test('FALSIFICACION · main rechaza exenciones mal formadas antes de correr la suite', () => {
  const raiz = proyectoConContrato((c) => { c.exemptions = [{ file: 'scripts/a.mjs', line: 3 }]; });
  try {
    const { code, errores } = correr(raiz);
    assert.equal(code, 1);
    assert.match(errores, /COVERAGE_EXEMPTION_INVALID.*exactamente/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · main rechaza un camino critico cuya prueba no existe antes de correr la suite', () => {
  const raiz = proyectoConContrato((c) => { c.critical_paths = [{ ...CAMINO, test_file: 'tests/no-existe.test.mjs' }]; });
  try {
    const { code, errores } = correr(raiz);
    assert.equal(code, 1);
    assert.match(errores, /COVERAGE_CRITICAL_PATH_INVALID.*no se pudo leer tests\/no-existe\.test\.mjs/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · main rechaza un contrato que se lee una vez y la segunda no', () => {
  const raiz = proyectoConContrato(() => {});
  try {
    let lecturas = 0;
    const real = JSON.stringify({ schema: 'ia.coverage-scope/1', why: 'x', measured: [{ directory: 'scripts', why: 'x' }], excluded: [] });
    const { code, errores } = correr(raiz, {
      readContract: () => {
        lecturas += 1;
        if (lecturas > 1) throw new Error('el contrato desaparecio');
        return real;
      },
    });
    assert.equal(code, 1);
    assert.match(errores, /COVERAGE_EXEMPTION_INVALID.*el contrato desaparecio/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
