// Worker aislado: un error de uso por ejecución directa tiene que dejar un código no cero.
//
// El par de arranque del resto de los gates deja el cuerpo de la prueba vacío y se apoya sólo en el
// efecto del import. Eso cubre la rama y **no comprueba nada**: si el guard dejara de fijar el
// código, la prueba seguiría en verde. Acá el cuerpo afirma lo que el archivo dice verificar.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-repo-clean.mjs');

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

test('el gate de repositorio limpio propaga el fallo de uso en ejecución directa', () => {
  assert.equal(codigoObservado, 2, 'un subcomando inexistente tiene que salir 2, no 0 ni 1');
  assert.ok(escrito.some((l) => /^usage: /u.test(l)), `tenía que escribir el uso: ${escrito.join('\n')}`);
});
