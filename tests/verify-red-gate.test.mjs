import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const psGate = join(repoRoot, 'scripts', 'verify-red.ps1');
const shGate = join(repoRoot, 'scripts', 'verify-red.sh');
const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
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
  write(root, 'test/sut-runtime.test.js', [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { unfinished } from '../src/unfinished.js';",
    "test('reaches an unfinished SUT', () => assert.equal(unfinished(), 'ok'));",
    '',
  ].join('\n'));
  write(root, 'test/test-bug.test.js', [
    "import test from 'node:test';",
    "test('ReferenceError is a test bug', () => missingTestHelper());",
    '',
  ].join('\n'));
  write(root, 'test/bare-package.test.cjs', "require('vcp-missing-third-party-package');\n");
  write(root, 'test/local-module.test.js', "import './missing-local-sut.js';\n");
  write(root, 'test/green.test.js', [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('already green', () => assert.equal(1, 1));",
    '',
  ].join('\n'));
  write(root, 'test/config-runner.mjs', "console.error('Error: config missing'); process.exit(42);\n");
  return root;
}

const runners = [
  ['PowerShell', psStatus, isWindows],
  ['Git Bash', bashStatus, isWindows && existsSync(gitBash)],
];

for (const [label, run, available] of runners) {
  test(`${label}: classifies genuine RED evidence and known false positives`, { skip: !available }, () => {
    const root = fixture();
    try {
      for (const [pattern, command, expected, label] of [
        ['test/sut-runtime.test.js', 'node --test', 0, 'SUT runtime RED must pass'],
        ['test/local-module.test.js', 'node --test', 0, 'local missing module must pass'],
        ['test/test-bug.test.js', 'node --test', 1, 'ReferenceError in test must reject'],
        ['test/bare-package.test.cjs', 'node --test', 1, 'bare npm package must reject'],
        ['test/green.test.js', 'node --test', 1, 'green test must reject'],
        ['ignored', 'node test/config-runner.mjs', 1, 'runner/config failure must reject'],
      ]) {
        const result = run(pattern, command, root);
        assert.equal(result.status, expected, `${label}\n${result.output}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
