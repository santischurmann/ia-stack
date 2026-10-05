// verify-plan-conflicts comparaba rutas como TEXTO. Mayusculas y `./` ya estaban resueltos, pero dos
// cosas que son el mismo archivo para el sistema operativo seguian siendo dos para el gate:
//
//   - un enlace (symlink o junction) hace que `link/x` y `real/x` sean un solo archivo;
//   - un directorio declarado como escrito contiene a todo lo que hay debajo, y una tarea que
//     escribe `scripts/` y otra que escribe `scripts/x.mjs` se pisan aunque no compartan una cadena.
//
// Un lock sobre el texto de la ruta no es un lock sobre el archivo (seccion 26 del prompt maestro:
// "el lock es sobre el objeto fisico"). Se usan junctions y no symlinks de archivo porque los
// segundos exigen privilegio en Windows y los primeros andan sin el, y tambien en Linux.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-plan-conflicts.mjs');

function task(id, { modify = [], create = [], dependsOn = [] } = {}) {
  return { id, files_to_create: create, files_to_modify: modify, test_files: [], depends_on: dependsOn };
}

/** Un proyecto de juguete: el gate resuelve las rutas contra su cwd, asi que se corre ahi. */
function enProyecto(tareas, preparar, callback) {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-conflictos-'));
  const afuera = mkdtempSync(join(tmpdir(), 'ia-conflictos-afuera-'));
  try {
    mkdirSync(join(raiz, 'real'));
    mkdirSync(join(raiz, 'scripts'));
    preparar({ raiz, afuera });
    writeFileSync(join(raiz, 'tasks.json'), JSON.stringify({ feature: 'x', tasks: tareas }));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [gate, 'check', 'tasks.json'], { cwd: raiz, encoding: 'utf8', env });
    callback({ status: r.status, salida: `${r.stdout}${r.stderr}` });
  } finally {
    rmSync(raiz, { recursive: true, force: true });
    rmSync(afuera, { recursive: true, force: true });
  }
}

const sinEnlace = () => {};
const conEnlace = ({ raiz }) => symlinkSync(join(raiz, 'real'), join(raiz, 'link'), 'junction');

test('FALSIFICACION · L3.1 · dos rutas que llegan al mismo archivo por un enlace son el mismo lock', () => {
  enProyecto([task('T01', { modify: ['real/x.mjs'] }), task('T02', { modify: ['link/x.mjs'] })], conEnlace, ({ status, salida }) => {
    assert.equal(status, 1, salida);
    assert.match(salida, /CONFLICT: T01.*T02.*real\/x\.mjs/u, 'el conflicto se nombra por el archivo fisico');
  });
});

test('L3.1 · el mismo alias, pero con orden de dependencia, queda serializado y no es conflicto', () => {
  enProyecto([task('T01', { modify: ['real/x.mjs'] }), task('T02', { modify: ['link/x.mjs'], dependsOn: ['T01'] })], conEnlace, ({ status, salida }) => {
    assert.equal(status, 0, salida);
    assert.match(salida, /SERIALIZED: T01 and T02/u);
  });
});

test('FALSIFICACION · L3.1 · un enlace que sale del proyecto no es una ruta del proyecto', () => {
  const salir = ({ raiz, afuera }) => symlinkSync(afuera, join(raiz, 'escape'), 'junction');
  enProyecto([task('T01', { modify: ['escape/secreto.txt'] })], salir, ({ status, salida }) => {
    assert.equal(status, 1, salida);
    assert.match(salida, /REJECTED:.*T01\.files_to_modify.*non-project path/u);
  });
});

test('FALSIFICACION · L3.1 · un enlace colgado se rechaza: no se sabe adonde escribe', () => {
  const colgado = ({ raiz }) => symlinkSync(join(raiz, 'no-existe'), join(raiz, 'colgado'), 'junction');
  enProyecto([task('T01', { modify: ['colgado/x.mjs'] })], colgado, ({ status, salida }) => {
    assert.equal(status, 1, salida);
    assert.match(salida, /REJECTED:.*colgado\/x\.mjs.*no se puede resolver/u);
  });
});

test('FALSIFICACION · L3.1 · un directorio declarado como escrito contiene a lo que hay debajo', () => {
  enProyecto([task('T01', { modify: ['scripts/'] }), task('T02', { modify: ['scripts/x.mjs'] })], sinEnlace, ({ status, salida }) => {
    assert.equal(status, 1, salida);
    assert.match(salida, /CONFLICT: T01.*T02.*scripts/u);
  });
});

test('L3.1 · un directorio que existe se toma como directorio aunque se declare sin la barra final', () => {
  enProyecto([task('T01', { modify: ['scripts'] }), task('T02', { modify: ['scripts/x.mjs'] })], sinEnlace, ({ status, salida }) => {
    assert.equal(status, 1, salida);
    assert.match(salida, /CONFLICT: T01.*T02/u);
  });
});

test('L3.1 · el directorio contenedor, con orden de dependencia, queda serializado', () => {
  enProyecto([task('T01', { modify: ['scripts/'] }), task('T02', { modify: ['scripts/x.mjs'], dependsOn: ['T01'] })], sinEnlace, ({ status, salida }) => {
    assert.equal(status, 0, salida);
    assert.match(salida, /SERIALIZED: T01 and T02/u);
  });
});

test('L3.1 · rutas hermanas con un prefijo de texto en comun no se confunden con contencion', () => {
  enProyecto([task('T01', { modify: ['scripts/'] }), task('T02', { modify: ['scripts-viejos/x.mjs'] })], sinEnlace, ({ status, salida }) => {
    assert.equal(status, 0, salida);
  });
});

test('L3.1 · sin enlaces ni directorios, un plan disjunto sigue pasando y una colision exacta sigue rechazando', () => {
  enProyecto([task('T01', { modify: ['a.mjs'] }), task('T02', { modify: ['b.mjs'] })], sinEnlace, ({ status }) => assert.equal(status, 0));
  enProyecto([task('T01', { modify: ['a.mjs'] }), task('T02', { modify: ['A.MJS'] })], sinEnlace, ({ status }) => assert.equal(status, 1));
});
