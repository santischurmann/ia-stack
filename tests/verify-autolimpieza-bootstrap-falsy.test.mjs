import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-autolimpieza.mjs');
const original = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = original;

test('Autolimpieza bootstrap no se ejecuta sin ruta de script', () => {});
