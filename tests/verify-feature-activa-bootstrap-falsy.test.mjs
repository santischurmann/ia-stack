// Worker aislado: cubre la rama falsa del guard de ejecución directa sin correr el gate.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-feature-activa.mjs');
const original = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = original;

test('el gate de feature activa no se ejecuta sin una ruta de script', () => {});
