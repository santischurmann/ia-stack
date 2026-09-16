// Worker aislado: la ejecucion directa tiene que salir distinto de cero cuando faltan los insumos,
// y decir cual falta. Los artefactos de research/ no estan en git a proposito -- son cientos de
// megas de corpus regenerable --, asi que en un clon limpio ESTE es el camino normal.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'research', 'verify-semantic-deep-evidence.mjs');
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalError = console.error;
const originalLog = console.log;
const dicho = [];
process.argv = [process.execPath, script];
console.error = (linea) => dicho.push(String(linea));
console.log = (linea) => dicho.push(String(linea));
await import(pathToFileURL(script).href);
const code = process.exitCode;
process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
console.error = originalError;
console.log = originalLog;

test('el verificador de la evidencia profunda contesta en ejecución directa, no revienta', () => {
  // O los artefactos estan en esta maquina y el gate contesta, o no estan y lo dice: las dos son
  // respuestas. Lo que no puede pasar es una excepcion sin manejar, que es como salia antes.
  assert.ok(code === 0 || code === 1, `salio ${code}: ${dicho.join(' | ')}`);
  assert.ok(dicho.length > 0, 'corrio y no dijo nada');
});
