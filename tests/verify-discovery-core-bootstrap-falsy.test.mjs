// Isolated worker: no script path means importing the module must not invoke its CLI.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-discovery-core.mjs');
const originalArgv = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = originalArgv;

test('Discovery core bootstrap does not execute without a script path', () => {});
