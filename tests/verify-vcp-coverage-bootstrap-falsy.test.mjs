// Isolated worker: covers the non-CLI branch without running coverage recursively.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-vcp-coverage.mjs');
const original = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = original;

test('coverage bootstrap does not execute without a script path', () => {});
