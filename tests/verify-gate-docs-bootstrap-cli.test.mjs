// Worker aislado: un error de uso por ejecucion directa tiene que dejar un codigo no cero.
//
// El cuerpo afirma lo que el archivo dice verificar, en vez de quedar vacio como el par de arranque
// del resto de los gates: si el guard dejara de fijar el codigo, una prueba de cuerpo vacio seguiria
// en verde y el gate quedaria inerte cuando alguien lo corre a mano.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-gate-docs.mjs');

const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalError = console.error;
const escrito = [];

process.argv = [process.execPath, script, 'inesperado'];
console.error = (l) => escrito.push(String(l));
await import(pathToFileURL(script).href);
const codigoObservado = process.exitCode;

process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
console.error = originalError;

test('el gate de alcance de los gates propaga el fallo de uso en ejecucion directa', () => {
  assert.equal(codigoObservado, 2, 'un subcomando inexistente tiene que salir 2, no 0 ni 1');
  assert.ok(escrito.some((l) => /^usage: /u.test(l)), `tenia que escribir el uso: ${escrito.join('\n')}`);
});
