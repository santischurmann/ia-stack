// Isolated worker: imports the module without a script path, so it must not execute the CLI.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-test-bindings.mjs');
const originalArgv = process.argv;
process.argv = [process.execPath];
await import(pathToFileURL(script).href);
process.argv = originalArgv;

test('Discovery test-binding bootstrap does not execute without a script path', () => {});
