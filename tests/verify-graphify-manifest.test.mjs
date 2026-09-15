import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio: leen archivos de la raiz del checkout que el instalador NO copia al
// proyecto de otra persona. Alla no aplican y ademas fallarian. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const script = join(repoRoot, 'scripts', 'verify-graphify-manifest.mjs');
const {
  EXCLUSIONS_SCHEMA,
  USAGE,
  compareCoverage,
  hasRealContent,
  readExclusions,
  readManifestPaths,
  readTrackedFiles,
  MANIFEST_PATH,
  main,
} = await import(`file://${script.replaceAll('\\', '/')}`);

function expectError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

const reason = 'Configuration only: no semantic content to index.';

test('compareCoverage acepta un manifiesto que cubre todo lo rastreado', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'b.md', '.gitignore'],
    manifest: ['a.mjs', 'b.md'],
    exclusions: [{ path: '.gitignore', reason }],
  });
  assert.deepEqual(result, { ok: true, missing: [], stale: [], ghosts: [], dead: [], contradictions: [] });
});

test('FALSIFICACIÓN · un archivo rastreado sin nodo ni exclusión declarada se reporta', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'scripts/new-gate.mjs'],
    manifest: ['a.mjs'],
    exclusions: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['scripts/new-gate.mjs']);
});

test('FALSIFICACIÓN · una entrada del manifiesto que ya no existe en Git es un fantasma', () => {
  const result = compareCoverage({
    tracked: ['templates/vibe/counters.json'],
    manifest: ['templates/vibe/counters.json', 'templates/vibe/COUNTERS.json'],
    exclusions: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.ghosts, ['templates/vibe/COUNTERS.json']);
});

test('FALSIFICACIÓN · una exclusión sin archivo real y una contradictoria se rechazan', () => {
  const dead = compareCoverage({ tracked: ['a.mjs'], manifest: ['a.mjs'], exclusions: [{ path: 'gone.md', reason }] });
  assert.equal(dead.ok, false);
  assert.deepEqual(dead.dead, ['gone.md']);

  const contradictory = compareCoverage({
    tracked: ['a.mjs', 'b.md'],
    manifest: ['a.mjs', 'b.md'],
    exclusions: [{ path: 'b.md', reason }],
  });
  assert.equal(contradictory.ok, false);
  assert.deepEqual(contradictory.contradictions, ['b.md']);
});

// LA HERIDA, con su número de veces: UNA, y estructural. Archivar un expediente cerrado —mover
// `docs/phase-decisions.json` a `docs/cycles/<ciclo>/`— dejó este gate en rojo, porque los dos
// archivos movidos no estaban en un manifiesto generado tres días antes. Archivar un ciclo es una
// operación RECURRENTE del protocolo, así que con exclusiones de ruta exacta cada archivado futuro
// exigiría o reindexar una herramienta externa que el propio protocolo declara opcional, o agregar
// dos entradas más a mano. Una exclusión por prefijo lo resuelve de una vez.
//
// POR QUÉ EL PREFIJO NO HEREDA LA REGLA DE CONTRADICCIÓN. Una exclusión de ruta exacta afirma «este
// archivo no merece un nodo»; que el grafo lo haya indexado igual contradice esa afirmación y se
// rechaza. Un prefijo afirma algo distinto: «lo que viva acá abajo no obliga a regenerar el grafo».
// Esa afirmación sigue siendo cierta cuando el reindexado los toma igual — y de hecho los va a
// tomar, porque Graphify indexa lo rastreado. Heredar la regla dejaría el gate en rojo en el
// próximo reindexado, que es exactamente el defecto que este cambio viene a cerrar.
//
// LO QUE NO CAMBIA: un prefijo sin ningún archivo rastreado abajo sigue siendo una exclusión
// muerta y se rechaza. Declarar carpetas que no existen no compra verde.
test('una exclusión por prefijo cubre todo lo que vive bajo esa carpeta', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'docs/cycles/c1/phase-decisions.json', 'docs/cycles/c1/phase-plan.json'],
    manifest: ['a.mjs'],
    exclusions: [{ path: 'docs/cycles/', reason }],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.dead, []);
});

test('FALSIFICACIÓN · el prefijo no tapa lo que está al lado, ni sobrevive sin archivos abajo', () => {
  const vecino = compareCoverage({
    tracked: ['docs/cycles/c1/x.json', 'docs/cyclesX.json'],
    manifest: [],
    exclusions: [{ path: 'docs/cycles/', reason }],
  });
  assert.equal(vecino.ok, false);
  assert.deepEqual(vecino.missing, ['docs/cyclesX.json']);

  const vacio = compareCoverage({
    tracked: ['a.mjs'],
    manifest: ['a.mjs'],
    exclusions: [{ path: 'docs/cycles/', reason }],
  });
  assert.equal(vacio.ok, false);
  assert.deepEqual(vacio.dead, ['docs/cycles/']);
});

test('FALSIFICACIÓN · un prefijo ya indexado no contradice, una ruta exacta sí', () => {
  const prefijo = compareCoverage({
    tracked: ['docs/cycles/c1/x.json'],
    manifest: ['docs/cycles/c1/x.json'],
    exclusions: [{ path: 'docs/cycles/', reason }],
  });
  assert.equal(prefijo.ok, true, JSON.stringify(prefijo));
  assert.deepEqual(prefijo.contradictions, []);

  const exacta = compareCoverage({
    tracked: ['docs/cycles/c1/x.json'],
    manifest: ['docs/cycles/c1/x.json'],
    exclusions: [{ path: 'docs/cycles/c1/x.json', reason }],
  });
  assert.equal(exacta.ok, false);
  assert.deepEqual(exacta.contradictions, ['docs/cycles/c1/x.json']);
});

test('un proyecto sin contrato de exclusiones no falla: no declara ninguna', () => {
  const absent = () => { const error = new Error('ENOENT: no such file'); error.code = 'ENOENT'; throw error; };
  assert.deepEqual(readExclusions(absent), []);
  // Any other read failure is real and must surface instead of silently hiding coverage.
  const denied = () => { const error = new Error('EACCES: permission denied'); error.code = 'EACCES'; throw error; };
  expectError(() => readExclusions(denied), /not valid JSON/u);
});

test('FALSIFICACIÓN · readExclusions rechaza schema, forma, duplicados y razones vacías', () => {
  assert.deepEqual(readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason }] })), [{ path: 'x', reason }]);
  expectError(() => readExclusions(() => '{'), /not valid JSON/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: 'other', exclusions: [] })), /schema/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA })), /exclusions array/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x' }] })), /path and a reason/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason: 'tbd' }] })), /placeholder/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason, extra: 1 }] })), /path and a reason/u);
  const duplicated = { schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason }, { path: 'x', reason }] };
  expectError(() => readExclusions(() => JSON.stringify(duplicated)), /duplicate exclusion/u);
});

// Reproducido el 2026-08-28 atacando este gate: una llave vacía escrita a mano contaba como
// archivo indexado, y el manifiesto no está versionado, así que no quedaba rastro revisable de
// haberla puesto. Sube el precio de falsificar de "una llave vacía" a "inventar datos creíbles".
test('FALSIFICACIÓN · hasRealContent distingue una entrada con datos de una llave vacía', () => {
  assert.equal(hasRealContent({ nodes: 3 }), true);
  assert.equal(hasRealContent({ nodes: 0 }), true, 'un cero es un dato, no un hueco');
  assert.equal(hasRealContent({ indexed: false }), true, 'un false también es un dato');
  assert.equal(hasRealContent({}), false);
  assert.equal(hasRealContent({ nodes: null, kind: undefined, label: '' }), false, 'sólo huecos no es contenido');
  for (const noEsEntrada of [null, undefined, 'texto', 42, [{ nodes: 1 }]]) {
    assert.equal(hasRealContent(noEsEntrada), false, `${JSON.stringify(noEsEntrada)} no es una entrada del manifiesto`);
  }
});

test('FALSIFICACIÓN · readManifestPaths exige un objeto indexado por path y normaliza separadores', () => {
  const conDatos = { 'a.mjs': { nodes: 3 }, 'dir\\b.md': { nodes: 1 } };
  assert.deepEqual(readManifestPaths('.', () => JSON.stringify(conDatos)), ['a.mjs', 'dir/b.md']);
  // Sólo cuentan las entradas con datos: la vacía no compra cobertura.
  const mezcla = { 'vacia.mjs': {}, 'real.md': { nodes: 1 } };
  assert.deepEqual(readManifestPaths('.', () => JSON.stringify(mezcla)), ['real.md']);
  expectError(() => readManifestPaths('.', () => '{'), /unable to read the Graphify manifest/u);
  expectError(() => readManifestPaths('.', () => { throw new Error('ENOENT'); }), /unable to read the Graphify manifest/u);
  for (const shape of ['[]', 'null', '"text"']) {
    expectError(() => readManifestPaths('.', () => shape), /path-keyed object/u);
  }
});

test('readTrackedFiles normaliza la salida de Git y propaga un fallo real', () => {
  assert.deepEqual(readTrackedFiles('.', () => 'a.mjs\nb.md\n'), ['a.mjs', 'b.md']);
  assert.deepEqual(readTrackedFiles('.', () => ''), []);
  expectError(() => readTrackedFiles('.', () => { throw new Error('not a repository'); }), /unable to list tracked files/u);
});

// `graphify-out/` está en .gitignore, así que un clon recién hecho no tiene manifiesto y esta
// prueba no se puede correr ahí. Se declara SALTEADA con el motivo a la vista, nunca en verde: un
// pase por ausencia de entrada se leería como "la cobertura del grafo está bien", y no se miró.
test('el repositorio real declara cobertura Graphify honesta', SOLO_FUENTE, (t) => {
  if (!existsSync(join(repoRoot, 'graphify-out', 'manifest.json'))) {
    return t.skip('sin graphify-out/manifest.json: corré `graphify update .` antes. No es un verde, es una prueba que no corrió.');
  }
  const tracked = readTrackedFiles(repoRoot, (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }));
  assert.ok(tracked.includes('SKILL.md'), 'the fixture must read the real tracked set');
  const result = spawnSync(process.execPath, [script, 'check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  // Un grafo más viejo que un archivo rastreado no es una cobertura mentida: es el estado esperado
  // a mitad de ciclo, porque el reindexado va al publicar. Se declara SALTEADA con los archivos a la
  // vista, nunca en verde — mismo criterio que el salteo de más arriba: un pase acá se leería como
  // "la cobertura del grafo está bien", y en este estado no se pudo mirar.
  if (/^DESACTUALIZADO: /u.test(result.stdout)) {
    return t.skip(result.stdout.trim());
  }
  assert.match(result.stdout, /Graphify manifest covers/u);
});

test('CLI rechaza uso inválido y reporta cada clase de divergencia', () => {
  const errors = [];
  assert.equal(main([], repoRoot, {}, () => {}, (line) => errors.push(line)), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check', 'extra'], repoRoot, {}, () => {}, () => {}), 2);

  const injected = {
    readTracked: () => ['a.mjs', 'orphan.md'],
    readManifestPaths: () => ['a.mjs', 'ghost.md'],
    readExclusionList: () => [{ path: 'gone.md', reason }],
  };
  const failures = [];
  assert.equal(main(['check'], repoRoot, injected, () => {}, (line) => failures.push(line)), 1);
  const joined = failures.join('\n');
  assert.match(joined, /orphan\.md/u);
  assert.match(joined, /ghost\.md/u);
  assert.match(joined, /gone\.md/u);

  const output = [];
  assert.equal(main(['check'], repoRoot, {
    readTracked: () => ['a.mjs', '.gitignore'],
    readManifestPaths: () => ['a.mjs'],
    readExclusionList: () => [{ path: '.gitignore', reason }],
  }, (line) => output.push(line), () => {}), 0);
  assert.match(output.at(-1), /Graphify manifest covers 1 tracked file/u);

  const broken = [];
  assert.equal(main(['check'], repoRoot, { readManifestPaths: () => { throw new Error('manifest is unreadable'); } }, () => {}, (line) => broken.push(line)), 1);
  assert.match(broken.at(-1), /manifest is unreadable/u);
});

test('FALSIFICACIÓN · main nombra el archivo declarado excluido que igual está en el manifiesto', () => {
  // La rama de contradicciones dentro de `main` no la ejercitaba ningún proceso de la suite: se
  // probaba `compareCoverage` por separado, pero el camino que escribe el rechazo no. Medido el
  // 2026-09-01 sobre verify-graphify-manifest.mjs:141.
  // Una contradicción no es cosmética: dice que alguien declaró que un archivo NO se indexa y el
  // grafo lo indexó igual, así que una de las dos afirmaciones es mentira y el gate no puede elegir.
  const errores = [];
  const code = main(['check'], repoRoot, {
    readTracked: () => ['docs/secreto.md', 'scripts/a.mjs'],
    readManifestPaths: () => ['docs/secreto.md', 'scripts/a.mjs'],
    readExclusionList: () => [{ path: 'docs/secreto.md', reason: 'no se publica: lleva datos del cliente' }],
  }, () => {}, (line) => errores.push(line));
  assert.equal(code, 1, 'aceptó un archivo declarado excluido que el manifiesto igual indexa');
  assert.ok(errores.some((line) => line.includes('files declared excluded yet present in the manifest: docs/secreto.md')), errores.join(' || '));

  // Contraprueba: sacando el archivo del manifiesto, la misma entrada sale en verde.
  const salida = [];
  assert.equal(main(['check'], repoRoot, {
    readTracked: () => ['docs/secreto.md', 'scripts/a.mjs'],
    readManifestPaths: () => ['scripts/a.mjs'],
    readExclusionList: () => [{ path: 'docs/secreto.md', reason: 'no se publica: lleva datos del cliente' }],
  }, (line) => salida.push(line), (line) => errores.push(line)), 0, errores.join(' || '));
  assert.match(salida.at(-1), /^OK: /u);
});

// VIEJO NO ES LO MISMO QUE DESHONESTO, y el gate los confundía.
//
// LA HERIDA, con su número de veces: DOS en la misma sesión, y la segunda destapó que la primera
// sólo había tapado la mitad. Archivar un expediente lo puso en rojo; archivar una sesión, de nuevo;
// escribir el archivo de Intake, una tercera vez. Las tres eran el mismo malentendido: un archivo
// rastreado que el grafo no tiene puede significar DOS cosas opuestas, y el gate sólo sabía leer
// una. Si el archivo ya existía cuando el grafo se construyó y no está, la declaración de cobertura
// es falsa y hay que rechazarla. Si el archivo nació DESPUÉS, el grafo no miente: está viejo.
//
// Y estar viejo a mitad de ciclo es el estado ESPERADO, no un defecto: `skills/integracion-graphify.md`
// fija el orden commit → graphify → record → check, o sea que el reindexado va al publicar. El ciclo
// anterior nunca lo destapó porque cerró con un reindexado y no agregó archivos después.
//
// LÍMITE HONESTO: la edad se lee de la fecha de modificación del archivo contra la del manifiesto.
// Un `git checkout` o un clon reescriben esas fechas, así que la clasificación puede correrse hacia
// «desactualizado» después de una operación de git que toque el árbol. Se acepta porque el error cae
// del lado seguro —reportar de más, nunca aprobar una cobertura mentida— y porque sin manifiesto la
// prueba ya se declara salteada en vez de verde.

test('un archivo más nuevo que el manifiesto está desactualizado, no ausente', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'nuevo.json'],
    manifest: ['a.mjs'],
    exclusions: [],
    builtAt: 1000,
    mtimeOf: (path) => (path === 'nuevo.json' ? 2000 : 500),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.stale, ['nuevo.json']);
});

test('FALSIFICACIÓN · un archivo que ya existía cuando el grafo se construyó sigue rechazándose', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'viejo.json'],
    manifest: ['a.mjs'],
    exclusions: [],
    builtAt: 1000,
    mtimeOf: (path) => (path === 'viejo.json' ? 500 : 500),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['viejo.json']);
  assert.deepEqual(result.stale, []);
});

test('FALSIFICACIÓN · sin fecha de construcción no se adivina: todo lo ausente rechaza', () => {
  const result = compareCoverage({ tracked: ['a.mjs', 'x.json'], manifest: ['a.mjs'], exclusions: [] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['x.json']);
  assert.deepEqual(result.stale, []);

  const sinReloj = compareCoverage({ tracked: ['a.mjs', 'x.json'], manifest: ['a.mjs'], exclusions: [], builtAt: 1000 });
  assert.equal(sinReloj.ok, false, 'builtAt sin mtimeOf no alcanza para clasificar');
  assert.deepEqual(sinReloj.missing, ['x.json']);
});

test('main dice DESACTUALIZADO, nombra los archivos y sale 0 sin declararlos cubiertos', () => {
  const salida = [];
  const errores = [];
  const code = main(['check'], '.', {
    readTracked: () => ['a.mjs', 'nuevo.json'],
    readManifestPaths: () => ['a.mjs'],
    readExclusionList: () => [],
    manifestBuiltAt: () => 1000,
    mtimeOf: (path) => (path === 'nuevo.json' ? 2000 : 500),
  }, (l) => salida.push(l), (l) => errores.push(l));
  assert.equal(code, 0, errores.join('\n'));
  assert.deepEqual(errores, []);
  assert.ok(salida.some((l) => /^DESACTUALIZADO: /u.test(l)), salida.join('\n'));
  assert.ok(salida.some((l) => l.includes('nuevo.json')), 'tiene que nombrar el archivo, no sólo contarlo');
  assert.ok(!salida.some((l) => /^OK: /u.test(l)), 'un grafo viejo no compra un OK de cobertura');
});

test('sin manifiesto en disco no se inventa una fecha: vuelve al rechazo estricto', () => {
  // No se inyecta `manifestBuiltAt`: corre el lector real contra un directorio que no tiene
  // manifiesto, que es el caso de un clon recién hecho. Devolver `null` ahí es lo que impide que un
  // repositorio sin grafo apruebe cobertura por no poder fechar nada.
  const errores = [];
  const code = main(['check'], join(repoRoot, 'tests'), {
    readTracked: () => ['a.mjs', 'x.json'],
    readManifestPaths: () => ['a.mjs'],
    readExclusionList: () => [],
  }, () => {}, (l) => errores.push(l));
  assert.equal(code, 1, 'sin fecha de construcción, un archivo ausente sigue siendo cobertura mentida');
  assert.ok(errores.some((l) => l.includes('x.json')), errores.join('\n'));
  assert.ok(!errores.some((l) => /DESACTUALIZADO/u.test(l)), 'no puede reportar desactualización sin haber podido fechar');
});

// LA COBERTURA DE ESTE GATE VALIA SOLO EN LA MAQUINA DEL AUTOR.
//
// Encontrado el 2026-09-14 clonando el propio repositorio en limpio: `graphify-out/` esta en
// .gitignore, asi que un clon recien hecho no tiene manifiesto, y las dos funciones que fechan el
// grafo —`manifestBuiltAt` y `mtimeOf`, los valores por defecto de main— no se ejecutaban nunca.
// Resultado: `verify-ia-stack-coverage.mjs` REJECTABA en cualquier maquina que no fuera la del autor, y
// la afirmacion «cobertura 100%» escrita en los mensajes de commit era local.
//
// Un verde que depende de un directorio IGNORADO no es un verde del repositorio: es un verde de una
// carpeta. Estas dos pruebas ejercitan esos valores por defecto contra carpetas descartables, con
// manifiesto y sin el, asi que la cobertura pasa a valer para cualquiera que clone.
test('el fechador del manifiesto devuelve null cuando no hay manifiesto, y un número cuando lo hay', () => {
  const d = mkdtempSync(join(tmpdir(), 'vcp-graphify-cob-'));
  try {
    const salida = [];
    const errores = [];

    // Sin manifiesto: el fechador por defecto tiene que devolver null y el gate volver al modo
    // estricto, NUNCA inventar una fecha.
    main(['check'], d, {
      readTracked: () => ['a.md'],
      readManifestPaths: () => [],
      readExclusionList: () => [],
    }, (l) => salida.push(l), (l) => errores.push(l));
    assert.ok(errores.length > 0 || salida.length > 0, 'el gate tiene que decir algo');

    // Con manifiesto en disco: el mismo fechador por defecto ahora devuelve su mtime, y el de cada
    // archivo tambien. Las dos ramas quedan ejecutadas sin depender de que exista graphify-out/.
    mkdirSync(join(d, 'graphify-out'), { recursive: true });
    writeFileSync(join(d, MANIFEST_PATH), JSON.stringify({ 'a.md': { mtime: 1 } }), 'utf8');
    writeFileSync(join(d, 'a.md'), 'contenido', 'utf8');
    // `reciente.md` EXISTE en disco y NO esta en el manifiesto: es el lado del fechador que devuelve
    // un mtime de verdad. `nuevo.md` no existe: es el lado que devuelve 0. Hacen falta los dos.
    writeFileSync(join(d, 'reciente.md'), 'nacio despues del grafo', 'utf8');
    const s2 = [];
    const e2 = [];
    main(['check'], d, {
      readTracked: () => ['a.md', 'nuevo.md', 'reciente.md'],
      readManifestPaths: () => ['a.md'],
      readExclusionList: () => [],
    }, (l) => s2.push(l), (l) => e2.push(l));
    assert.ok([...s2, ...e2].length > 0, 'el gate tiene que decir algo');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
