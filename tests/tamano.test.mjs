import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { clasificarTamano, fasesDe, excede } from '../scripts/tamano.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'tamano.mjs');

function run(args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

test('tamano · reglas: chico, medio, grande', () => {
  assert.equal(clasificarTamano({ archivos: 3 }), 'chico');
  assert.equal(clasificarTamano({ archivos: 1 }), 'chico');
  assert.equal(clasificarTamano({ archivos: 4 }), 'medio');
  assert.equal(clasificarTamano({ archivos: 2, pantallaNueva: true }), 'medio');
  assert.equal(clasificarTamano({ archivos: 1, proyectoNuevo: true }), 'grande');
});

test('tamano · cualquier riesgo nunca es chico', () => {
  for (const riesgo of ['plata', 'seguridad', 'auth', 'migracion']) {
    assert.equal(clasificarTamano({ archivos: 1, riesgo }), 'medio');
  }
});

test('tamano · dato faltante o inválido es el mayor', () => {
  assert.equal(clasificarTamano({}), 'grande');
  assert.equal(clasificarTamano({ archivos: Number.NaN }), 'grande');
  assert.equal(clasificarTamano({ archivos: -1 }), 'grande');
});

test('tamano · fases del recorrido', () => {
  assert.deepEqual(fasesDe('chico'), [0, 1, 7, 8, 9]);
  assert.deepEqual(fasesDe('medio'), [0, 1, 3, 5, 6, 7, 8, 9]);
  assert.deepEqual(fasesDe('grande'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.throws(() => fasesDe('enorme'));
});

test('tamano · excede', () => {
  assert.equal(excede('chico', 'medio'), true);
  assert.equal(excede('medio', 'medio'), false);
  assert.equal(excede('grande', 'chico'), false);
});

test('tamano · CLI imprime tamaño y fases', () => {
  const r = run(['--archivos', '2']);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /^chico\r?\nfases: 0 1 7 8 9\r?\n$/);
  const g = run(['--archivos', '2', '--proyecto-nuevo']);
  assert.match(g.out, /^grande\r?\nfases: 0 1 2 3 4 5 6 7 8 9\r?\n$/);
  const m = run(['--archivos', '2', '--riesgo', 'auth']);
  assert.match(m.out, /^medio\r?\n/);
});

test('tamano · CLI sin --archivos da grande y uso incorrecto da 2', () => {
  assert.match(run([]).out, /^grande\r?\n/);
  assert.equal(run(['--riesgo', 'nada', '--archivos', '1']).status, 2);
  assert.equal(run(['--archivos', 'x']).status, 2);
  assert.equal(run(['--zzz']).status, 2);
});

test('tamano · --diff compara el diff real con el tamaño declarado', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-tamano-'));
  try {
    git(root, 'init', '-q', '-b', 'main');
    writeFileSync(join(root, 'a.txt'), 'a');
    git(root, 'add', 'a.txt');
    git(root, 'commit', '-q', '-m', 'base');
    mkdirSync(join(root, '.ia-stack'));
    const estado = (t) => writeFileSync(join(root, '.ia-stack', 'ESTADO.md'), `## Fase\n5\n\n## Tamaño\n${t}\n\n## Cola\n\n## Cómo retomar\nx\n`);
    for (const n of ['b', 'c', 'd', 'e']) writeFileSync(join(root, `${n}.txt`), n);
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'cuatro');
    estado('chico');
    const malo = run(['--diff', 'HEAD~1', '--proyecto', root]);
    assert.equal(malo.status, 1, malo.out);
    assert.match(malo.out, /chico/);
    estado('medio');
    assert.equal(run(['--diff', 'HEAD~1', '--proyecto', root]).status, 0);
    assert.equal(run(['--diff', 'refinexistente', '--proyecto', root]).status, 1);
    rmSync(join(root, '.ia-stack', 'ESTADO.md'));
    assert.equal(run(['--diff', 'HEAD~1', '--proyecto', root]).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
