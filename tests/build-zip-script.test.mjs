import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'build-zip.sh');
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';

function run(args) {
  const result = spawnSync(bash, args, { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function runAt(args, cwd, env = process.env) {
  const result = spawnSync(bash, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

test('build-zip shell script parses and rejects traversal-shaped version input before it can remove or create output', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const syntax = run(['-n', script]);
  assert.equal(syntax.status, 0, syntax.output);
  const invalid = run([script, '../outside']);
  assert.equal(invalid.status, 2, invalid.output);
  assert.match(invalid.output, /version must be/i);
});

test('FALSIFICACIÓN · package builder gives zip only the native allowlist, never local state or the full tree', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-'));
  try {
    const packageDir = join(root, 'VCP');
    const scriptsDir = join(packageDir, 'scripts');
    const binDir = join(root, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(packageDir, '.env'), 'must-not-ship\n');
    mkdirSync(join(packageDir, '.vibe'));
    mkdirSync(join(packageDir, 'graphify-out'));
    const fixtureScript = join(scriptsDir, 'build-zip.sh');
    writeFileSync(fixtureScript, readFileSync(script, 'utf8'));
    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$VCP_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([fixtureScript, 'security-test'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, VCP_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    const archiveArgs = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u);
    assert.deepEqual(archiveArgs.slice(0, 2), ['-r', 'vibecodeprotocols-security-test.zip']);
    assert.deepEqual(archiveArgs.slice(2).sort(), [
      'VCP/CHANGELOG.md', 'VCP/INSTALL.md', 'VCP/LICENSE', 'VCP/README.md', 'VCP/SECURITY.md', 'VCP/SKILL.md',
      'VCP/contracts', 'VCP/examples', 'VCP/scripts', 'VCP/skills', 'VCP/templates', 'VCP/tests',
    ].sort());
    assert.equal(archiveArgs.some((item) => item.includes('.env') || item.includes('.vibe') || item.includes('graphify-out') || item === 'VCP'), false);
    assert.equal(existsSync(join(root, 'vibecodeprotocols-security-test.zip')), true);
    assert.equal(existsSync(join(root, 'vibecodeprotocols-security-test.sha256')), true);
    // FALSIFICACIÓN: the printed recipient instructions must `cd` into the package's REAL
    // directory case ("VCP" here — mixed case on purpose), never a hardcoded lowercase literal
    // that breaks the instructions verbatim on a case-sensitive filesystem (the primary target,
    // since scripts/install.sh is the Linux/macOS installer).
    assert.match(result.output, /cd VCP && \.\/scripts\/install\.sh/u);
    assert.equal(result.output.includes('cd vibecodeprotocols'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
