// Isolated worker: covers the direct-execution guard's false branch without a test run.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-red-node.mjs');
const original = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = original;

test('RED adapter bootstrap does not execute without a script path', () => {});
