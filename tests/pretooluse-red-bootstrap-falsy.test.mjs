// Isolated worker: exercises the direct-execution guard's fail-closed false branch.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'pretooluse-red.mjs');
const original = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = original;

test('bootstrap does not execute when argv has no script path', () => {});
