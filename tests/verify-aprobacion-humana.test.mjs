// verify-aprobacion-humana — preview aprobado antes de construir y orden de producción atada al sha.
//
// POR QUÉ EXISTE (el operador, 04-11-2026): «SIEMPRE tenés que darle previews al usuario para que apruebe
// antes de empezar a construir», y «nada se sube a producción sin orden explícita y vigente». Las dos
// cosas ya se pedían de palabra y se rompían bajo presión: un «sí» de una sesión se tomó como permiso
// de otra, y un OK dado para un sha se usó para otro.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  checkPreview, checkProduccion, checkTareas, esFechaValida, esHumano, leerTabla, minutos,
} from '../scripts/verify-aprobacion-humana.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-aprobacion-humana.mjs');
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const CABECERA = [
  '# Aprobaciones',
  '',
  '| tipo | objeto | version | evidencia | mostrado | decidido | quien | estado |',
  '|---|---|---|---|---|---|---|---|',
];
const fila = (c) => `| ${c.join(' | ')} |`;
const ledger = (...filas) => [...CABECERA, ...filas.map(fila), ''].join('\n');
const PREV_OK = ['preview', 'landing-home', 'v2', 'claude.ai/artifact/abc', '04-11-2026 10:00', '04-11-2026 10:20', 'Ana', 'aprobado'];
const PROD_OK = ['produccion', 'main', SHA, 'menú 8.1: push de 3 commits', '04-11-2026 18:00', '04-11-2026 18:05', 'Ana', 'aprobado'];

function conArchivos(archivos, cb) {
  const root = mkdtempSync(join(tmpdir(), 'ia-aprobacion-'));
  try {
    const rutas = {};
    for (const [nombre, texto] of Object.entries(archivos)) {
      rutas[nombre] = join(root, nombre);
      writeFileSync(rutas[nombre], texto);
    }
    cb(rutas);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('fechas · DD-MM-AAAA HH:MM con calendario real y 24 h', () => {
  assert.equal(esFechaValida('04-11-2026 10:00'), true);
  assert.equal(esFechaValida('29-02-2028 23:59'), true);
  for (const mala of ['2026-11-04 10:00', '4-11-2026 10:00', '31-11-2026 10:00', '29-02-2027 10:00', '04-11-2026 24:00', '04-11-2026 10:60', '04-11-2026 11:1x', '00-11-2026 10:00', '04-13-2026 10:00', '']) {
    assert.equal(esFechaValida(mala), false, mala);
  }
  assert.ok(minutos('04-11-2026 10:01') > minutos('04-11-2026 10:00'));
  assert.ok(minutos('01-01-2027 00:00') > minutos('31-12-2026 23:59'));
});

test('quién · un agente, un modelo o una sesión no aprueban (un mensaje de otra sesión no escala permisos)', () => {
  assert.equal(esHumano('Ana'), true);
  assert.equal(esHumano('Fer'), true);
  for (const q of ['', '  ', 'Claude', 'orquestador', 'subagente red', 'sesión 3', 'codex', 'Opus 5.5', 'gpt-6-luna', 'bot', 'agente']) {
    assert.equal(esHumano(q), false, q);
  }
});

test('leerTabla · toma las filas con 8 columnas y saltea cabecera y separador', () => {
  const filas = leerTabla(ledger(PREV_OK, PROD_OK));
  assert.equal(filas.length, 2);
  assert.equal(filas[0].tipo, 'preview');
  assert.equal(filas[1].version, SHA);
  assert.throws(() => leerTabla('| a | b |\n'), /8 columnas/);
  assert.deepEqual(leerTabla('sin tabla\n'), []);
  const typo = [...PREV_OK]; typo[0] = 'prevew';
  assert.throws(() => leerTabla(ledger(typo)), /tipo inválido/, 'una fila mal escrita no se ignora en silencio');
});

test('preview · aprobado por un humano, con fechas válidas y en orden: pasa', () => {
  const r = checkPreview(leerTabla(ledger(PREV_OK)), 'landing-home');
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.version, 'v2');
  assert.equal(checkPreview(leerTabla(ledger(PREV_OK)), 'landing-home', 'v2').ok, true);
});

test('preview · rechaza sin fila, pendiente, rechazado, versión distinta o una versión nueva sin aprobar', () => {
  assert.match(checkPreview([], 'landing-home').reason, /no hay preview/);
  const pend = [...PREV_OK]; pend[7] = 'pendiente'; pend[5] = '—';
  assert.match(checkPreview(leerTabla(ledger(pend)), 'landing-home').reason, /pendiente/);
  const rech = [...PREV_OK]; rech[7] = 'rechazado';
  assert.match(checkPreview(leerTabla(ledger(rech)), 'landing-home').reason, /rechazado/);
  assert.match(checkPreview(leerTabla(ledger(PREV_OK)), 'landing-home', 'v3').reason, /v3/);
  const v3 = [...pend]; v3[2] = 'v3';
  assert.match(checkPreview(leerTabla(ledger(PREV_OK, v3)), 'landing-home').reason, /pendiente/);
});

test('preview · rechaza campos malos: versión, evidencia, fechas, orden y quién', () => {
  const casos = [
    [2, 'dos', /versión/], [3, '', /evidencia/], [4, '2026-11-04 10:00', /mostrado/],
    [5, '04-11-2026 9:00', /decidido/], [5, '04-11-2026 09:59', /antes de mostrarlo/],
    [6, 'Claude', /humano/], [7, 'quizás', /estado/],
  ];
  for (const [i, valor, re] of casos) {
    const f = [...PREV_OK]; f[i] = valor;
    assert.match(checkPreview(leerTabla(ledger(f)), 'landing-home').reason, re, `${i}=${valor}`);
  }
});

test('produccion · orden aprobada para ese sha exacto: pasa; para otro sha, usada o revocada: rechaza', () => {
  assert.equal(checkProduccion(leerTabla(ledger(PROD_OK)), SHA).ok, true);
  assert.equal(checkProduccion(leerTabla(ledger(PROD_OK)), SHA.slice(0, 12)).ok, true, 'un sha abreviado del mismo commit vale');
  assert.match(checkProduccion(leerTabla(ledger(PROD_OK)), 'ffffffff').reason, /ninguna orden/);
  const usada = [...PROD_OK]; usada[7] = 'usada';
  assert.match(checkProduccion(leerTabla(ledger(PROD_OK, usada)), SHA).reason, /usada/);
  const revocada = [...PROD_OK]; revocada[7] = 'revocado';
  assert.match(checkProduccion(leerTabla(ledger(PROD_OK, revocada)), SHA).reason, /revocado/);
  const corto = [...PROD_OK]; corto[2] = 'a1b2c3';
  assert.match(checkProduccion(leerTabla(ledger(corto)), SHA).reason, /sha/);
  const robot = [...PROD_OK]; robot[6] = 'orquestador';
  assert.match(checkProduccion(leerTabla(ledger(robot)), SHA).reason, /humano/);
  assert.match(checkProduccion(leerTabla(ledger(PROD_OK)), 'zz').reason, /sha/);
});

test('tareas · cada tarea visible necesita su preview aprobado; las no visibles no se miran', () => {
  const tareas = (lista) => ({ tasks: lista });
  assert.equal(checkTareas(tareas([{ id: 'T1' }, { id: 'T2', visible: true, preview: 'landing-home' }]), leerTabla(ledger(PREV_OK))).ok, true);
  assert.match(checkTareas(tareas([{ id: 'T2', visible: true }]), []).reason, /T2.*preview/);
  assert.match(checkTareas(tareas([{ id: 'T4', visible: true, preview: '' }]), []).reason, /T4.*preview/);
  assert.match(checkTareas(tareas([{ id: 'T3', visible: true, preview: 'otra' }]), leerTabla(ledger(PREV_OK))).reason, /T3/);
  const r = checkTareas(tareas([{ id: 'T1' }]), []);
  assert.equal(r.ok, true);
  assert.equal(r.visibles, 0);
  assert.match(checkTareas({}, []).reason, /tasks/);
  assert.match(checkTareas(null, []).reason, /tasks/, 'un plan JSON null no aprueba');
});

test('CLI · preview, produccion y tareas salen 0 en verde y 1 en rojo', () => {
  const plan = JSON.stringify({ tasks: [{ id: 'T2', visible: true, preview: 'landing-home' }] });
  conArchivos({ 'A.md': ledger(PREV_OK, PROD_OK), 'tasks.json': plan, 'malo.json': '{', 'roto.md': '| a | b |\n' }, (p) => {
    let r = run(['preview', p['A.md'], '--pieza', 'landing-home']);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: preview landing-home v2 aprobado por Ana el 04-11-2026 10:20/);
    r = run(['preview', p['A.md'], '--pieza', 'landing-home', '--version', 'v9']);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED/);
    r = run(['produccion', p['A.md'], '--sha', SHA]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: orden de producción/);
    assert.equal(run(['produccion', p['A.md'], '--sha', 'ffffffff']).status, 1);
    r = run(['tareas', p['tasks.json'], p['A.md']]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /1 tarea/);
    assert.equal(run(['tareas', p['malo.json'], p['A.md']]).status, 1);
    r = run(['preview', p['roto.md'], '--pieza', 'x']);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /8 columnas/);
  });
});

test('CLI · el registro que no existe nunca aprueba por defecto', () => {
  const nada = join(tmpdir(), 'ia-aprobaciones-no-existe.md');
  for (const args of [['preview', nada, '--pieza', 'x'], ['produccion', nada, '--sha', SHA], ['tareas', nada, nada]]) {
    const r = run(args);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED:.*leer/);
  }
});

test('CLI · uso incorrecto sale 2 con usage', () => {
  for (const args of [[], ['otro'], ['preview'], ['preview', 'a.md'], ['preview', 'a.md', '--pieza'], ['produccion', 'a.md'],
    ['produccion', 'a.md', '--pieza', 'x'], ['tareas', 'a.json'], ['preview', 'a.md', '--pieza', 'x', '--raro', 'y'], ['tareas', 'a', 'b', 'c']]) {
    const r = run(args);
    assert.equal(r.status, 2, `${args.join(' ')}\n${r.output}`);
    assert.match(r.output, /usage:/i);
  }
});
