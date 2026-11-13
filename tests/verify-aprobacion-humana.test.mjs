// verify-aprobacion-humana — preview aprobado antes de construir y orden de producción atada al sha.
//
// POR QUÉ EXISTE: «SIEMPRE tenés que darle previews al usuario para que apruebe
// antes de empezar a construir», y «nada se sube a producción sin orden explícita y vigente». Las dos
// cosas ya se pedían de palabra y se rompían bajo presión: un «sí» de una sesión se tomó como permiso
// de otra, y un OK dado para un sha se usó para otro.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

test('3.4.2 · tareas · TODA tarea declara su preview antes de escribir código: pieza aprobada o «no-aplica: <motivo>»', () => {
  const tareas = (lista) => ({ tasks: lista });
  const filas = leerTabla(ledger(PREV_OK));
  const r = checkTareas(tareas([{ id: 'T1', description: 'ajuste de ejemplo', preview: 'no-aplica: renombra una variable interna' }, { id: 'T2', description: 'ajuste de ejemplo', visible: true, preview: 'landing-home' }, { id: 'T5', description: 'ajuste de ejemplo', preview: 'landing-home' }]), filas);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.conPreview, 2);
  assert.equal(r.noAplica, 1);
  assert.match(checkTareas(tareas([{ id: 'T1', description: 'ajuste de ejemplo' }]), []).reason, /T1.*sin campo preview/, 'una tarea sin preview ya no pasa en silencio');
  assert.match(checkTareas(tareas([{ id: 'T4', description: 'ajuste de ejemplo', preview: '' }]), []).reason, /T4.*sin campo preview/);
  assert.match(checkTareas(tareas([{ id: 'T6', description: 'ajuste de ejemplo', preview: 'no-aplica:   ' }]), []).reason, /T6.*motivo/);
  assert.match(checkTareas(tareas([{ id: 'T7', description: 'ajuste de ejemplo', visible: true, preview: 'no-aplica: es chiquito' }]), []).reason, /T7.*visible/);
  assert.match(checkTareas(tareas([{ id: 'T3', description: 'ajuste de ejemplo', preview: 'otra' }]), filas).reason, /T3/);
  assert.match(checkTareas({}, []).reason, /tasks/);
  assert.match(checkTareas(null, []).reason, /tasks/, 'un plan JSON null no aprueba');
});

test('CLI · preview, produccion y tareas salen 0 en verde y 1 en rojo', () => {
  const plan = JSON.stringify({ tasks: [{ id: 'T2', description: 'ajuste de ejemplo', visible: true, preview: 'landing-home' }, { id: 'T1', description: 'ajuste de ejemplo', preview: 'no-aplica: chore' }] });
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
    assert.match(r.output, /2 tarea\(s\): 1 con preview aprobado y 1 «no-aplica»/);
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

test('fix aprobaciones · leerTabla acepta los 7 tipos; un tipo distinto de produccion exige vN y no usa estado «usada»', () => {
  const tipos = ['pedido', 'research', 'marca', 'boceto', 'spec', 'preview', 'produccion'];
  const filas = leerTabla(ledger(...tipos.map((t) => { const f = [...PREV_OK]; f[0] = t; f[1] = t; return f; })));
  assert.deepEqual(filas.map((f) => f.tipo), tipos);
  const marcaConSha = [...PREV_OK]; marcaConSha[0] = 'marca'; marcaConSha[1] = 'landing-home'; marcaConSha[2] = SHA;
  assert.match(checkPreview(leerTabla(ledger(marcaConSha)), 'landing-home').reason, /no hay preview/);
  const usadaEnPreview = [...PREV_OK]; usadaEnPreview[7] = 'usada';
  assert.match(checkPreview(leerTabla(ledger(usadaEnPreview)), 'landing-home').reason, /estado/);
});

test('fix aprobaciones · defecto 1: una fila pedido/research/marca/spec con un sha nunca es orden de producción', () => {
  for (const tipo of ['pedido', 'research', 'marca', 'boceto', 'spec', 'preview']) {
    const f = [...PROD_OK]; f[0] = tipo;
    assert.match(checkProduccion(leerTabla(ledger(f)), SHA).reason, /ninguna orden/, tipo);
  }
});

test('fix aprobaciones · defecto 2: el error de versión dice cómo registrarla bien', () => {
  const f = [...PREV_OK]; f[2] = SHA;
  assert.match(checkPreview(leerTabla(ledger(f)), 'landing-home').reason, /aprobar\.mjs registrar --tipo preview --pieza landing-home --ref vN/);
});

test('fix aprobaciones · defecto 5: un boceto aprobado vale como preview (gate 3 y tareas); un pedido no', () => {
  const boceto = [...PREV_OK]; boceto[0] = 'boceto'; boceto[1] = 'tarjeta'; boceto[2] = 'v1';
  const pedido = [...PREV_OK]; pedido[0] = 'pedido'; pedido[1] = 'otra';
  const filas = leerTabla(ledger(PREV_OK, boceto, pedido));
  assert.equal(checkPreview(filas, 'tarjeta').ok, true);
  assert.equal(checkPreview(filas, 'tarjeta', 'v1').ok, true);
  assert.match(checkPreview(filas, 'otra').reason, /no hay preview/);
  const r = checkTareas({ tasks: [{ id: 'T1', description: 'ajuste de ejemplo', visible: true, preview: 'tarjeta' }, { id: 'T2', description: 'ajuste de ejemplo', visible: true, preview: 'landing-home' }, { id: 'T3', description: 'ajuste de ejemplo', preview: 'no-aplica: interno' }] }, filas);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.conPreview, 2);
  assert.match(checkTareas({ tasks: [{ id: 'T4', description: 'ajuste de ejemplo', visible: true, preview: 'otra' }] }, filas).reason, /T4/);
  assert.match(checkTareas({ tasks: [{ id: 'T5', description: 'ajuste de ejemplo', visible: true, preview: 'no-aplica: chico' }] }, filas).reason, /T5.*visible/);
});

test('fix aprobaciones · templates/tasks.json trae el campo preview y pasa el gate de tareas', () => {
  const plantilla = JSON.parse(readFileSync(join(repoRoot, 'templates', 'tasks.json'), 'utf8'));
  for (const t of plantilla.tasks) assert.equal(typeof t.preview, 'string', t.id);
  assert.equal(checkTareas(plantilla, []).ok, true);
});

test('fix aprobaciones · defecto 6: una aprobación de versión mayor deja vencida la anterior, aunque se re-apruebe la vieja después', () => {
  const v3 = [...PREV_OK]; v3[2] = 'v3';
  const reV2 = [...PREV_OK]; reV2[4] = '05-11-2026 10:00'; reV2[5] = '05-11-2026 10:05';
  const filas = leerTabla(ledger(PREV_OK, v3, reV2));
  assert.equal(checkPreview(filas, 'landing-home').version, 'v3');
  assert.match(checkPreview(filas, 'landing-home', 'v2').reason, /vigente es v3/);
  const v10 = [...PREV_OK]; v10[2] = 'v10';
  assert.equal(checkPreview(leerTabla(ledger(v10, v3)), 'landing-home').version, 'v10', 'compara números, no texto');
});

test('fix aprobaciones · produccion: un sha abreviado que coincide con dos órdenes distintas es ambiguo', () => {
  const otra = [...PROD_OK]; otra[2] = `a1b2c3d4ff${'0'.repeat(30)}`;
  const filas = leerTabla(ledger(PROD_OK, otra));
  assert.match(checkProduccion(filas, 'a1b2c3d4').reason, /ambiguo/);
  assert.equal(checkProduccion(filas, SHA).ok, true);
  const corta = [...PROD_OK]; corta[2] = SHA.slice(0, 7);
  assert.equal(checkProduccion(leerTabla(ledger(corta, PROD_OK)), SHA).ok, true, 'el mismo commit abreviado y completo no es ambiguo');
});

test('3.4.4 · leerTabla · acepta el sello encadenado de aprobar.mjs como novena celda, y sólo ese', () => {
  const sello = `chain:${'ab'.repeat(32)}`;
  const sellada = `| ${PROD_OK.join(' | ')} | ${sello}`;
  const filas = leerTabla([...CABECERA, sellada, ''].join('\n'));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].estado, 'aprobado');
  assert.throws(() => leerTabla(`| ${PROD_OK.join(' | ')} | chain:corto`), /9 columnas|columnas/);
  assert.throws(() => leerTabla(`| ${PROD_OK.join(' | ')} | extra`), /columnas/);
});

// ---- 3.4.5 · ronda de EGM por tarea de alto requisito (pieza plan-<id>) ----
const RONDA = (pieza, ronda, lectores, hallazgos = 0) => ({ tipo: 'egm', pieza, lectores, ronda, altos: 0, medios: 0, bajos: hallazgos });
const cincoRondas = (pieza, lectores) => [1, 2, 3, 4, 5].map((n) => RONDA(pieza, n, lectores, n === 5 ? 0 : 1));
const jsonl = (filas) => `${filas.map((x) => JSON.stringify(x)).join('\n')}\n`;
const T_RIESGO = { id: 'T01', description: 'migración de la tabla de pagos', preview: 'no-aplica: sin pantalla' };
const T_SIMPLE = { id: 'T02', description: 'corregir un texto', preview: 'no-aplica: sin pantalla' };
const ESTADO = (tamano) => `# Estado\n\n## Fase\n7\n\n## Tamaño\n${tamano}\n\n## Cola\n`;

test('3.4.5 · tareas · toda tarea trae id único y description', () => {
  const base = { preview: 'no-aplica: chore' };
  assert.match(checkTareas({ tasks: [{ ...base, description: 'x' }] }, []).reason, /tarea sin id/);
  assert.match(checkTareas({ tasks: [{ ...base, id: 'T1' }] }, []).reason, /T1: tarea sin description/);
  assert.match(checkTareas({ tasks: [{ ...base, id: 'T1', description: 'a' }, { ...base, id: 'T1', description: 'b' }] }, []).reason, /T1: id repetido/);
});

test('3.4.5 · tareas · una tarea de alto requisito exige su ronda EGM convergida en plan-<id>', () => {
  const egm = (registros, tamano) => ({ leer: () => registros, tamano });
  assert.match(checkTareas({ tasks: [T_RIESGO] }, [], egm([], 'medio')).reason, /T01: tarea de alto requisito sin ronda EGM convergida en plan-T01: sin rondas EGM/);
  const r = checkTareas({ tasks: [T_RIESGO, T_SIMPLE] }, [], egm(cincoRondas('plan-T01', 2), 'medio'));
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.conRonda, 1);
  assert.match(checkTareas({ tasks: [T_RIESGO] }, [], egm(cincoRondas('plan-T01', 2), 'grande')).reason, /2 lectores y se exigen 4/);
  assert.match(checkTareas({ tasks: [T_RIESGO] }, [], egm(cincoRondas('plan-T01', 2), null)).reason, /sin tamaño declarado: pasá --tamano/);
  let leyo = false;
  const perezoso = { leer: () => { leyo = true; return []; }, tamano: null };
  assert.equal(checkTareas({ tasks: [T_SIMPLE] }, [], perezoso).ok, true);
  assert.equal(leyo, false, 'sin tareas importantes no se leen las métricas ni se pide tamaño');
});

test('3.4.5 · CLI tareas · --metricas y --tamano, con defaults junto a APROBACIONES.md', () => {
  const plan = (...t) => JSON.stringify({ tasks: t });
  conArchivos({ 'A.md': ledger(PREV_OK), 'riesgo.json': plan(T_RIESGO), 'simple.json': plan(T_SIMPLE), 'otras.jsonl': jsonl(cincoRondas('plan-T01', 2)) }, (p) => {
    const dir = dirname(p['A.md']);
    const metricas = join(dir, 'metricas.jsonl');
    const estado = join(dir, 'ESTADO.md');
    // sin registros
    let r = run(['tareas', p['riesgo.json'], p['A.md'], '--tamano', 'medio']);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /T01: tarea de alto requisito sin ronda EGM convergida en plan-T01/);
    // --metricas explícito
    r = run(['tareas', p['riesgo.json'], p['A.md'], '--tamano', 'medio', '--metricas', p['otras.jsonl']]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /1 con ronda EGM convergida/);
    // default: metricas.jsonl junto a APROBACIONES.md
    writeFileSync(metricas, jsonl(cincoRondas('plan-T01', 2)));
    assert.equal(run(['tareas', p['riesgo.json'], p['A.md'], '--tamano', 'medio']).status, 0);
    assert.equal(run(['tareas', p['riesgo.json'], p['A.md'], '--tamano', 'grande']).status, 1);
    // sin bandera ni ESTADO.md
    r = run(['tareas', p['riesgo.json'], p['A.md']]);
    assert.equal(r.status, 1);
    assert.match(r.output, /sin tamaño declarado: pasá --tamano/);
    // tamaño desde ESTADO.md
    writeFileSync(estado, ESTADO('grande'));
    r = run(['tareas', p['riesgo.json'], p['A.md']]);
    assert.equal(r.status, 1);
    assert.match(r.output, /se exigen 4/);
    writeFileSync(estado, ESTADO('medio'));
    assert.equal(run(['tareas', p['riesgo.json'], p['A.md']]).status, 0);
    writeFileSync(estado, ESTADO('enorme'));
    assert.match(run(['tareas', p['riesgo.json'], p['A.md']]).output, /sin tamaño declarado/);
    // bandera inválida: siempre, aun sin tareas importantes
    for (const plan_ of ['riesgo.json', 'simple.json']) {
      r = run(['tareas', p[plan_], p['A.md'], '--tamano', 'enorme']);
      assert.equal(r.status, 1, plan_);
      assert.match(r.output, /tamaño inválido «enorme»/);
    }
    // métricas rotas: fallan con tarea importante, no sin ella
    writeFileSync(metricas, '{rota\n');
    r = run(['tareas', p['riesgo.json'], p['A.md'], '--tamano', 'medio']);
    assert.equal(r.status, 1);
    assert.match(r.output, /metricas inválidas: línea 1/);
    r = run(['tareas', p['simple.json'], p['A.md']]);
    assert.equal(r.status, 0, r.output);
  });
  for (const args of [['tareas', 'a.json', 'a.md', '--raro', 'x'], ['tareas', 'a.json', 'a.md', '--tamano']]) {
    assert.equal(run(args).status, 2, args.join(' '));
  }
});

test('3.4.5 · fase 7 nombra la pieza plan-<id> y que el gate la exige', () => {
  const t = readFileSync(join(repoRoot, 'phases', '07-build.md'), 'utf8');
  assert.ok(t.includes('--pieza plan-<id>'));
  assert.match(t, /no se recorta/u);
});
