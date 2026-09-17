import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { resolveBash, soloEnWindows } from './_entorno.mjs';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const psGate = join(repoRoot, 'scripts', 'verify-red.ps1');
const shGate = join(repoRoot, 'scripts', 'verify-red.sh');
// `resolveBash` y no la ruta de Git Bash a mano: en Linux `existsSync` de una ruta de Windows da
// false, asi que la variante de shell del gate de LAW 1 -- la regla mas dura del protocolo -- no
// corria ahi. `verify-red.sh` es el gate de shell: Linux es su plataforma, no su excepcion.
const gitBash = resolveBash();
const isWindows = process.platform === 'win32';

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  const parent = path.slice(0, Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')));
  if (parent) {
    // `recursive` creation belongs to the test fixture; it never writes the repository.
    mkdirSync(parent, { recursive: true });
  }
  writeFileSync(path, content);
}

function shellStatus(command, args, cwd) {
  const env = { ...process.env };
  // Node marks child processes spawned by `node --test`; remove that marker so the fixture's
  // own `node --test` command is a real independent runner, not a recursively skipped suite.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `${command} could not launch: ${result.error?.message}`);
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function psStatus(pattern, command, cwd) {
  return shellStatus('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psGate,
    '-TestPattern', pattern, '-TestCmd', command,
  ], cwd);
}

function toGitBashPath(path) {
  return path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

function bashStatus(pattern, command, cwd) {
  const cwdForBash = toGitBashPath(cwd);
  const gateForBash = toGitBashPath(shGate);
  return shellStatus(gitBash, ['-lc', `cd '${cwdForBash}' && '${gateForBash}' '${pattern}' '${command}'`], cwd);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-red-gate-'));
  write(root, 'package.json', '{"type":"module"}\n');
  write(root, 'src/unfinished.js', "export function unfinished() { throw new Error('not implemented'); }\n");
  // A bare uncaught SUT throw is deliberately NOT accepted as RED any more (removed after the
  // 2026-08-24 adversarial audit showed that acceptance path was forgeable by printed text alone
  // — see verify-red-node.mjs's classifyNodeRed doc comment). Wrapping the expected failure in a
  // real `assert.doesNotThrow` is exactly the documented way to keep this a valid RED.
  write(root, 'test/sut-runtime.test.js', [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { unfinished } from '../src/unfinished.js';",
    "test('reaches an unfinished SUT', () => assert.doesNotThrow(() => unfinished()));",
    '',
  ].join('\n'));
  write(root, 'test/test-bug.test.js', [
    "import test from 'node:test';",
    "test('ReferenceError is a test bug', () => missingTestHelper());",
    '',
  ].join('\n'));
  write(root, 'test/bare-package.test.cjs', "require('vcp-missing-third-party-package');\n");
  // Same reasoning as sut-runtime.test.js above: a bare failing import is no longer accepted;
  // assert.doesNotReject turns the same missing-module failure into a genuine assertion RED.
  write(root, 'test/local-module.test.js', [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('missing local module', () => assert.doesNotReject(() => import('./missing-local-sut.js')));",
    '',
  ].join('\n'));
  write(root, 'test/green.test.js', [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('already green', () => assert.equal(1, 1));",
    '',
  ].join('\n'));
  write(root, 'test/config-runner.mjs', "console.error('Error: config missing'); process.exit(42);\n");
  return root;
}

// Cada variante trae SUS opciones de salteo, no un booleano, porque los dos salteos no son la misma
// cosa. El de PowerShell es de plataforma y va DECLARADO en `contracts/platform-scope.json`: en el
// runner de Ubuntu `powershell.exe` no existe —PowerShell Core se llama `pwsh` y no acepta los
// mismos parámetros—. El de Git Bash es de host: en Linux bash está siempre, y sólo se saltea en un
// Windows sin Git Bash instalado, que es una máquina concreta y no una plataforma.
//
// Y EL NOMBRE VA ENTERO Y LITERAL, no armado con `${label}`: `verify-platform-scope` comprueba que
// el título declarado exista en el archivo, y un nombre interpolado no está escrito en ningún lado.
// Una declaración que no se puede confrontar contra el árbol es una declaración que nadie revisa.
const runners = [
  ['PowerShell: classifies genuine RED evidence and known false positives', psStatus, soloEnWindows('la variante PowerShell del gate de LAW 1 no se comprueba: verify-red.ps1 queda sin correr, y con ella la rama que clasifica la evidencia ROJA para quien trabaja en Windows')],
  ['Git Bash: classifies genuine RED evidence and known false positives', bashStatus, isWindows && !existsSync(gitBash) ? { skip: 'este host de Windows no tiene Git Bash instalado' } : {}],
];

for (const [nombre, run, opciones] of runners) {
  test(nombre, opciones, () => {
    const root = fixture();
    try {
      for (const [pattern, command, expected, label] of [
        ['test/sut-runtime.test.js', 'node --test', 0, 'SUT runtime RED must pass'],
        ['test/local-module.test.js', 'node --test', 0, 'local missing module must pass'],
        ['test/test-bug.test.js', 'node --test', 1, 'FALSIFICACIÓN · ReferenceError in test must reject'],
        ['test/bare-package.test.cjs', 'node --test', 1, 'FALSIFICACIÓN · bare npm package must reject'],
        ['test/green.test.js', 'node --test', 1, 'FALSIFICACIÓN · green test must reject'],
        ['ignored', 'node test/config-runner.mjs', 1, 'FALSIFICACIÓN · runner/config failure must reject'],
      ]) {
        const result = run(pattern, command, root);
        assert.equal(result.status, expected, `${label}\n${result.output}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
