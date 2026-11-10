// Isolated worker: hook mode returns null and writes a deny response for empty input.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, 'scripts', 'pretooluse-red.mjs');
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalWrite = process.stdout.write;
process.argv = [process.execPath, script];
process.stdout.write = () => true;
await import(pathToFileURL(script).href);
process.stdin.emit('end');
process.stdin.removeAllListeners('data');
process.stdin.removeAllListeners('end');
process.stdin.pause();
process.argv = originalArgv;
process.exitCode = originalExitCode ?? 0;
process.stdout.write = originalWrite;

test('bootstrap keeps hook mode open for its stdin response', () => {});
