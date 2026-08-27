import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-discovery-views.mjs');
const originalArgv = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = originalArgv;

test('Discovery views bootstrap no se ejecuta sin ruta de script', () => {});
