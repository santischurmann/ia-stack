import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const installSh = join(repoRoot, 'scripts', 'install.sh');
const installPs = join(repoRoot, 'scripts', 'install.ps1');

function run(command, args, options = {}) {
  const env = { ...process.env, ...options.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function toBash(path) {
  return path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-install-runtime-'));
  const project = join(root, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{}\n');
  return { root, project, target: join(root, 'skills'), runtime: join(root, 'runtime') };
}

function assertRuntime(project, target, runtime) {
  assert.equal(existsSync(join(target, 'VibeCodeProtocols.md')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-red-node.mjs')), true);
  assert.equal(existsSync(join(project, '.vibe', 'vcp-runtime', 'scripts', 'pretooluse-red.mjs')), true);
  assert.equal(existsSync(join(project, '.vibe', 'vcp-runtime', 'templates', 'vibe', 'COMPANY.md')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'scripts')), false, 'runtime must not nest scripts on reinstall');
  assert.equal(existsSync(join(project, '.vibe', 'vcp-runtime', 'scripts', 'scripts')), false, 'project runtime must not nest scripts on reinstall');
  const check = run(process.execPath, ['.vibe/vcp-runtime/scripts/verify-red-node.mjs'], { cwd: project });
  assert.equal(check.status, 2, check.output);
}

test('fresh Bash installation produces a project-local runtime whose gate command resolves', { skip: !existsSync(gitBash) }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /project runtime/);
    const repeat = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(repeat.status, 0, repeat.output);
    assertRuntime(project, target, runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fresh PowerShell installation produces the same project-local runtime', () => {
  const { root, project, target, runtime } = fixture();
  try {
    const result = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', project]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /project runtime/);
    const repeat = run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installPs, '-TargetDir', target, '-RuntimeDir', runtime, '-ProjectDir', project]);
    assert.equal(repeat.status, 0, repeat.output);
    assertRuntime(project, target, runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
