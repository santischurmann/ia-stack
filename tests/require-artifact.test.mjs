// Los verificadores de research leen expedientes que .gitignore deja afuera a propósito. Medido el
// 2026-09-01 sobre un clon limpio de af55a45: tres de los cuatro que el protocolo manda correr en su
// fase de verificación reventaban con un stack trace de `node:fs` en vez de rechazar. Estas pruebas
// fijan la diferencia — un rechazo dice qué falta y cómo regenerarlo; un stack trace no dice nada.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio: leen archivos de la raiz del checkout que el instalador NO copia al
// proyecto de otra persona. Alla no aplican y ademas fallarian. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

// El import va CONDICIONADO, no suelto. `research/` no se copia al proyecto de otra persona, y un
// import de nivel de modulo corre antes de que exista una prueba que saltear: el archivo no fallaba,
// no arrancaba, con un stack trace de ERR_MODULE_NOT_FOUND. Es el peor modo de fallo posible, y
// justo el que el encabezado de este archivo dice haber venido a eliminar. La guarda por prueba no
// alcanza para esto: hay que no importar.
const helper = join(repoRoot, 'research', 'require-artifact.mjs');
const {
  MISSING_ARTIFACT, UNREADABLE_ARTIFACT, ResearchArtifactError,
  loadJsonArtifact, loadTextArtifact, reportArtifactProblem,
} = esRuntimeInstalado(repoRoot) ? {} : await import(pathToFileURL(helper).href);

/** assert.throws no devuelve el error, y acá el mensaje ES lo que se prueba. */
function capturar(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return assert.fail('se esperaba un rechazo y no hubo ninguno');
}

const ausente = () => { const error = new Error('ENOENT: no such file or directory'); error.code = 'ENOENT'; throw error; };
const ruta = join(repoRoot, 'research', 'semantic-ledger-2026-08-31.json');
const COMO = 'node research/build-semantic-ledger.mjs';

test('un expediente presente se devuelve tal cual, en texto y en JSON', SOLO_FUENTE, () => {
  assert.equal(loadTextArtifact(ruta, COMO, { read: () => 'contenido', root: repoRoot }), 'contenido');
  assert.deepEqual(loadJsonArtifact(ruta, COMO, { read: () => '{"a":1}', root: repoRoot }), { a: 1 });
});

test('FALSIFICACIÓN · un expediente ausente rechaza nombrando el archivo y el comando que lo regenera', SOLO_FUENTE, () => {
  const error = capturar(() => loadTextArtifact(ruta, COMO, { read: ausente, root: repoRoot }));
  assert.ok(error instanceof ResearchArtifactError, `no es un rechazo de expediente: ${error}`);
  assert.equal(error.code, MISSING_ARTIFACT);
  assert.match(error.message, /research\/semantic-ledger-2026-08-31\.json/u, 'el mensaje tiene que nombrar el archivo, con barras normales');
  assert.match(error.message, /No está en git a propósito/u, 'un ausente esperado no puede leerse como un gate roto');
  assert.ok(error.message.includes(COMO), 'sin el comando de regeneración, el rechazo no es accionable');
});

test('FALSIFICACIÓN · un archivo ilegible por otro motivo no se confunde con uno ausente', SOLO_FUENTE, () => {
  const permiso = () => { const error = new Error('EACCES: permission denied'); error.code = 'EACCES'; throw error; };
  const error = capturar(() => loadTextArtifact(ruta, COMO, { read: permiso, root: repoRoot }));
  assert.ok(error instanceof ResearchArtifactError, `no es un rechazo de expediente: ${error}`);
  assert.equal(error.code, UNREADABLE_ARTIFACT);
  assert.doesNotMatch(error.message, /Regeneralo/u, 'regenerar no arregla un problema de permisos');
});

test('FALSIFICACIÓN · un JSON roto se nombra con su archivo, no con un offset suelto', SOLO_FUENTE, () => {
  const error = capturar(() => loadJsonArtifact(ruta, COMO, { read: () => '{', root: repoRoot }));
  assert.ok(error instanceof ResearchArtifactError, `no es un rechazo de expediente: ${error}`);
  assert.equal(error.code, UNREADABLE_ARTIFACT);
  assert.match(error.message, /semantic-ledger-2026-08-31\.json no es JSON válido/u);
});

test('FALSIFICACIÓN · reportArtifactProblem deja pasar un error que no es suyo', SOLO_FUENTE, () => {
  // Tragarse un error desconocido es peor que el crash: esconde un defecto real detrás de un
  // rechazo que dice otra cosa.
  const escritas = [];
  assert.equal(reportArtifactProblem(new TypeError('otra cosa'), (l) => escritas.push(l)), false);
  assert.deepEqual(escritas, []);
  assert.equal(reportArtifactProblem(new ResearchArtifactError(MISSING_ARTIFACT, 'falta x'), (l) => escritas.push(l)), true);
  assert.deepEqual(escritas, [`REJECTED: ${MISSING_ARTIFACT}: falta x`]);
});
