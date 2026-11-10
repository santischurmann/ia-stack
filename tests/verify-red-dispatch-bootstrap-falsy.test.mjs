// Worker aislado: cubre la rama falsa del guard de ejecucion directa sin correr el gate.
//
// Importado como modulo —sin ruta de script en argv— el archivo NO tiene que hacer nada. Si el guard
// se rompiera y el gate corriera al importarse, cualquier prueba que lo importe se quedaria con un
// codigo de salida ajeno. El cuerpo lo afirma, en vez de dejarlo vacio.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-red.mjs');

const originalArgv = process.argv;
const antes = process.exitCode;

process.argv = [process.execPath];
const modulo = await import(pathToFileURL(script).href);
const despues = process.exitCode;

process.argv = originalArgv;

test('el despachador de test rojo no se ejecuta sin una ruta de script', () => {
  assert.equal(despues, antes, 'importarlo como modulo fijo un codigo de salida, asi que corrio solo');
  assert.equal(typeof modulo.main, 'function', 'el modulo tiene que exportar main aunque no se ejecute');
});
