// Worker aislado: cubre la rama falsa del guard de ejecución directa sin correr el gate.
//
// Importado como módulo —sin ruta de script en argv— el archivo NO tiene que hacer nada. Si el guard
// se rompiera y el gate corriera al importarse, cualquier prueba que lo importe pagaría un escaneo
// del repositorio entero y podría quedarse con un código de salida ajeno. El cuerpo lo afirma, en
// vez de dejarlo vacío como el resto de los pares de arranque.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-repo-clean.mjs');

const originalArgv = process.argv;
const antes = process.exitCode;

process.argv = [process.execPath];
const modulo = await import(pathToFileURL(script).href);
const despues = process.exitCode;

process.argv = originalArgv;

test('el gate de repositorio limpio no se ejecuta sin una ruta de script', () => {
  assert.equal(despues, antes, 'importarlo como módulo fijó un código de salida, así que corrió solo');
  assert.equal(typeof modulo.main, 'function', 'el módulo tiene que exportar main aunque no se ejecute');
});
