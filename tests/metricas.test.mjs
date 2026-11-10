import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { construirRegistro, resumir } from '../scripts/metricas.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'metricas.mjs');
const AHORA = new Date('2026-11-10T14:35:00Z');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function conProyecto(callback) {
  const root = mkdtempSync(join(tmpdir(), 'ia-metricas-'));
  mkdirSync(join(root, '.ia-stack'));
  try {
    callback(root, join(root, '.ia-stack', 'metricas.jsonl'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('metricas · construirRegistro: bloque, egm y cierre con ts ISO', () => {
  assert.deepEqual(construirRegistro('bloque', { fase: '5', modelo: 'sonnet-5.5', ventana: '40' }, AHORA), {
    ok: true, registro: { tipo: 'bloque', ts: '2026-11-10T14:35:00.000Z', fase: 5, modelo: 'sonnet-5.5', ventana: 40, semana: null },
  });
  assert.deepEqual(construirRegistro('egm', { pieza: 'spec', lectores: '2', ronda: '2', altos: '1', medios: '3', bajos: '0' }, AHORA).registro, {
    tipo: 'egm', ts: '2026-11-10T14:35:00.000Z', pieza: 'spec', lectores: 2, ronda: 2, altos: 1, medios: 3, bajos: 0,
  });
  assert.deepEqual(construirRegistro('cierre', { retrabajos: '1', escaladas: '0' }, AHORA).registro, {
    tipo: 'cierre', ts: '2026-11-10T14:35:00.000Z', retrabajos: 1, escaladas: 0,
  });
});

test('metricas · campos de cupo ausentes quedan null; inválidos se rechazan', () => {
  const r = construirRegistro('bloque', { fase: '1', modelo: 'm' }, AHORA).registro;
  assert.equal(r.ventana, null);
  assert.equal(r.semana, null);
  assert.equal(construirRegistro('bloque', { fase: '1', modelo: 'm', semana: '12.5' }, AHORA).registro.semana, 12.5);
  for (const mal of [
    ['bloque', { fase: 'x', modelo: 'm' }], ['bloque', { fase: '1' }], ['bloque', { fase: '1', modelo: 'm', ventana: '101' }],
    ['egm', { ronda: '1', altos: '1', medios: '1' }], ['egm', { ronda: '1', altos: '-1', medios: '1', bajos: '1' }],
    ['egm', { pieza: 'spec', ronda: '1', altos: '1', medios: '1', bajos: '1' }], ['egm', { lectores: '2', ronda: '1', altos: '1', medios: '1', bajos: '1' }],
    ['cierre', { retrabajos: '1' }], ['otro', {}],
  ]) {
    assert.equal(construirRegistro(mal[0], mal[1], AHORA).ok, false, JSON.stringify(mal));
  }
});

test('metricas · resumir totaliza', () => {
  const regs = [
    { tipo: 'bloque', fase: 3, modelo: 'a', ventana: 40, semana: null },
    { tipo: 'bloque', fase: 3, modelo: 'b', ventana: 70, semana: 10 },
    { tipo: 'bloque', fase: 5, modelo: 'a', ventana: null, semana: null },
    { tipo: 'egm', ronda: 1, altos: 2, medios: 1, bajos: 0 },
    { tipo: 'egm', ronda: 2, altos: 0, medios: 1, bajos: 1 },
    { tipo: 'cierre', retrabajos: 2, escaladas: 1 },
    { tipo: 'cierre', retrabajos: 1, escaladas: 0 },
  ];
  const r = resumir(regs);
  assert.equal(r.bloques, 3);
  assert.deepEqual(r.porModelo, { a: 2, b: 1 });
  assert.equal(r.ventanaMax, 70);
  assert.equal(r.egm.rondas, 2);
  assert.deepEqual(r.egm.ultima, { ronda: 2, altos: 0, medios: 1, bajos: 1 });
  assert.deepEqual(r.cierres, { cierres: 2, retrabajos: 3, escaladas: 1 });
  assert.equal(resumir([]).bloques, 0);
  assert.equal(resumir([]).ventanaMax, null);
});

test('metricas · CLI agrega una línea JSON por llamada y resumen imprime totales', () => {
  conProyecto((root, archivo) => {
    assert.equal(run(['bloque', '--fase', '5', '--modelo', 'sonnet-5.5', '--ventana', '40', '--proyecto', root]).status, 0);
    assert.equal(run(['egm', '--pieza', 'spec', '--lectores', '2', '--ronda', '1', '--altos', '0', '--medios', '2', '--bajos', '1', '--proyecto', root]).status, 0);
    assert.equal(run(['cierre', '--retrabajos', '1', '--escaladas', '0', '--proyecto', root]).status, 0);
    const lineas = readFileSync(archivo, 'utf8').trim().split('\n');
    assert.equal(lineas.length, 3);
    const primera = JSON.parse(lineas[0]);
    assert.equal(primera.tipo, 'bloque');
    assert.equal(primera.semana, null);
    assert.match(primera.ts, /^\d{4}-\d{2}-\d{2}T/);
    const r = run(['resumen', '--proyecto', root]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /bloques: 1/);
    assert.match(r.out, /egm: 1 ronda/);
    assert.match(r.out, /retrabajos 1/);
  });
});

test('metricas · resumen sin archivo dice sin métricas; con línea corrupta sale 1', () => {
  conProyecto((root, archivo) => {
    const vacio = run(['resumen', '--proyecto', root]);
    assert.equal(vacio.status, 0);
    assert.match(vacio.out, /sin métricas/);
    writeFileSync(archivo, '{"tipo":"cierre","retrabajos":1,"escaladas":0}\nno es json\n');
    const r = run(['resumen', '--proyecto', root]);
    assert.equal(r.status, 1);
    assert.match(r.out, /ilegible/);
  });
});

test('metricas · uso incorrecto sale 2 y valores inválidos 1', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(['zzz']).status, 2);
  assert.equal(run(['bloque', '--zzz', '1']).status, 2);
  conProyecto((root) => {
    assert.equal(run(['bloque', '--fase', 'x', '--modelo', 'm', '--proyecto', root]).status, 1);
  });
});

test('metricas · egm acepta --decide-persona y lo guarda como decide_persona: true', () => {
  const r = construirRegistro('egm', { pieza: 'spec', lectores: '4', ronda: '3', altos: '1', medios: '0', bajos: '0', 'decide-persona': true }, AHORA);
  assert.equal(r.registro.decide_persona, true);
  assert.equal(construirRegistro('egm', { pieza: 'spec', lectores: '4', ronda: '3', altos: '0', medios: '0', bajos: '0' }, AHORA).registro.decide_persona, undefined);
});
