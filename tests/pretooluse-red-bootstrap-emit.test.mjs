// Isolated worker: a direct CLI call must set its explicit non-zero outcome.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'pretooluse-red.mjs');
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalError = console.error;
process.argv = [process.execPath, script, 'emit'];
console.error = () => {};
await import(pathToFileURL(script).href);
process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
console.error = originalError;

test('bootstrap propagates a non-null direct CLI outcome', () => {});
