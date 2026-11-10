// contraste.mjs: relación de contraste WCAG entre dos colores hex; sale 1 si no llega a 4,5:1.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { relacion, luminancia, MINIMO } from '../scripts/contraste.mjs';

const script = join(dirname(dirname(fileURLToPath(import.meta.url))), 'scripts', 'contraste.mjs');
const run = (...args) => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

test('contraste · luminancia de blanco y negro', () => {
  assert.equal(luminancia('#ffffff'), 1);
  assert.equal(luminancia('000000'), 0);
});

test('contraste · negro sobre blanco es 21:1 y el orden no importa', () => {
  assert.equal(relacion('#000000', '#ffffff'), 21);
  assert.equal(relacion('#ffffff', '#000000'), 21);
});

test('contraste · acepta la forma corta #rgb', () => {
  assert.equal(relacion('#fff', '#000'), 21);
});

test('contraste · el mínimo es 4,5', () => {
  assert.equal(MINIMO, 4.5);
});

test('contraste · CLI: gris #777 sobre blanco no llega (4,48) y sale 1', () => {
  const r = run('#777777', '#ffffff');
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /4[,.]48/u);
});

test('contraste · CLI: gris #767676 sobre blanco llega (4,54) y sale 0', () => {
  const r = run('#767676', '#ffffff');
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /4[,.]54/u);
});

test('contraste · CLI: un hex inválido o argumentos de menos salen 2', () => {
  assert.equal(run('#12345', '#ffffff').status, 2);
  assert.equal(run('#ffffff').status, 2);
  assert.equal(run('zzzzzz', '#ffffff').status, 2);
});
