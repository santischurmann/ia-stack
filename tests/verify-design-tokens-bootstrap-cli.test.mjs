// Worker aislado: un error de uso por ejecución directa tiene que dejar un código no cero.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-design-tokens.mjs');
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalError = console.error;
process.argv = [process.execPath, script, 'inesperado'];
console.error = () => {};
await import(pathToFileURL(script).href);
process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
console.error = originalError;

test('el gate de diseño propaga el fallo de uso en ejecución directa', () => {});
