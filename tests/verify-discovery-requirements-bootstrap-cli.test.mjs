// Isolated worker: direct usage errors must not launch a recursive I0 self-test.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'verify-discovery-requirements.mjs');
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalError = console.error;
process.argv = [process.execPath, script, 'unexpected'];
console.error = () => {};
await import(pathToFileURL(script).href);
process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
console.error = originalError;

test('Discovery inventory bootstrap propagates a direct usage failure', () => {});
