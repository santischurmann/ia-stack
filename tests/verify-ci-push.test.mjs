import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { analizarWorkflow } from '../scripts/verify-ci-push.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-ci-push.mjs');

function run(args, cwd = repoRoot) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const wf = (on) => `name: X\n${on}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hola\n`;
const ok = (on) => assert.deepEqual(analizarWorkflow(wf(on)).problemas, [], on);
const mal = (on, patron) => {
  const { problemas } = analizarWorkflow(wf(on));
  assert.ok(problemas.length > 0, `debía fallar: ${on}`);
  if (patron) assert.match(problemas.join('\n'), patron);
};

test('ci-push · acepta push a main/master, pull_request, workflow_dispatch y tags', () => {
  ok('on:\n  push:\n    branches: [main]\n  pull_request:\n  workflow_dispatch:');
  ok('on:\n  push:\n    branches:\n      - master\n  pull_request:');
  ok("on:\n  push:\n    tags:\n      - 'v*'");
  ok('on:\n  push:\n    branches: [ "main" ]\n    tags: [ "v*" ]');
  ok('on: [pull_request, workflow_dispatch]');
  ok('on: pull_request');
  ok('on:\n  - pull_request\n  - workflow_dispatch');
  ok('"on":\n  workflow_dispatch:');
  ok('on: { push: { branches: [main] }, pull_request: {} }');
  ok('on:\n  push: # comentario\n    branches: [main] # otro\n');
});

test('ci-push · rechaza push a cualquier rama', () => {
  mal('on: push', /push/);
  mal('on: [push, pull_request]', /push/);
  mal('on:\n  push:', /todas las ramas/);
  mal('on:\n  push:\n    paths:\n      - "src/**"', /todas las ramas/);
  mal("on:\n  push:\n    branches: ['**']", /\*\*/);
  mal('on:\n  push:\n    branches:\n      - main\n      - "feat/*"', /feat/);
  mal('on:\n  push:\n    branches-ignore:\n      - main', /branches-ignore/);
  mal('on:\n  push:\n    branches: [develop]', /develop/);
  mal('on: { push: { branches: [dev] } }', /dev/);
  mal('on:\n  - push', /push/);
});

test('ci-push · rechaza schedule', () => {
  mal('on:\n  schedule:\n    - cron: "0 3 * * *"', /schedule/);
  mal('on:\n  pull_request:\n  schedule:\n    - cron: "0 3 * * *"', /schedule/);
  mal('on: [schedule]', /schedule/);
});

test('ci-push · rama principal configurable', () => {
  const { problemas } = analizarWorkflow(wf('on:\n  push:\n    branches: [trunk]'), { principales: ['trunk'] });
  assert.deepEqual(problemas, []);
});

test('ci-push · un workflow sin on: no pasa en silencio', () => {
  const { problemas } = analizarWorkflow('name: X\njobs: {}\n');
  assert.ok(problemas.length > 0);
});

test('ci-push · CLI: verde sobre los workflows de este repo', () => {
  const r = run(['check']);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /OK/);
});

test('ci-push · CLI con fixtures: rojo, verde, carpeta ausente y uso', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-ci-push-'));
  try {
    const dir = join(root, 'flujos');
    mkdirSync(dir);
    writeFileSync(join(dir, 'bien.yml'), wf('on:\n  push:\n    branches: [main]'));
    assert.equal(run(['check', '--workflows', dir]).status, 0);
    writeFileSync(join(dir, 'mal.yaml'), wf('on:\n  schedule:\n    - cron: "0 3 * * *"'));
    const r = run(['check', '--workflows', dir]);
    assert.equal(r.status, 1);
    assert.match(r.out, /mal\.yaml/);
    const vacio = run(['check', '--workflows', join(root, 'noexiste')]);
    assert.equal(vacio.status, 0);
    assert.match(vacio.out, /VAC/);
    assert.equal(run([]).status, 2);
    assert.equal(run(['zzz']).status, 2);
    assert.equal(run(['check', '--zzz']).status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
