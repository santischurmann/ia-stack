// verify-egm-convergencia — la revisión EGM de una pieza convergió antes de seguir (gate 3).
// Dos regímenes según la pieza (listas en contracts/model-routing.json, `rondas.egm`):
// - simple (`preview`): chico pasa sin registro; medio 2 lectores, grande 4; converge con 0 altos;
//   más de 2 rondas falla salvo decide_persona.
// - ronda (`spec`, `plan-<id>`, `publicar`, `protocolo`): 5 a 10 rondas contiguas, la última limpia
//   (0 hallazgos aplicados), o la décima con decide_persona.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { LECTORES_MINIMOS, checkConvergencia, leerMetricas, regimenDe } from '../scripts/verify-egm-convergencia.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-egm-convergencia.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ---- Régimen simple (pieza `preview`): el comportamiento de 3.4.4 ----
const L = (ronda, altos, extra = {}) => ({ tipo: 'egm', ts: '2026-11-10T14:35:00.000Z', pieza: 'preview', lectores: 4, ronda, altos, medios: 1, bajos: 0, ...extra });

test('lectores mínimos · chico 0, medio 2, grande 4', () => {
  assert.deepEqual(LECTORES_MINIMOS, { chico: 0, medio: 2, grande: 4 });
});

test('chico · pasa sin ningún registro', () => {
  assert.equal(checkConvergencia([], 'preview', 'chico').ok, true);
});

test('medio y grande · sin registro de la pieza no pasan', () => {
  assert.match(checkConvergencia([], 'preview', 'medio').reason, /sin rondas/);
  assert.match(checkConvergencia([L(1, 0, { pieza: 'otra' })], 'preview', 'grande').reason, /sin rondas/);
});

test('converge cuando la última ronda tiene 0 altos', () => {
  assert.equal(checkConvergencia([L(1, 2), L(2, 0)], 'preview', 'grande').ok, true);
  assert.equal(checkConvergencia([L(1, 0)], 'preview', 'grande').ok, true);
  assert.match(checkConvergencia([L(1, 2), L(2, 1)], 'preview', 'grande').reason, /altos/);
});

test('lectores · medio exige 2 y grande 4 en cada ronda', () => {
  assert.equal(checkConvergencia([L(1, 0, { lectores: 2 })], 'preview', 'medio').ok, true);
  assert.match(checkConvergencia([L(1, 0, { lectores: 1 })], 'preview', 'medio').reason, /lectores/);
  assert.match(checkConvergencia([L(1, 1, { lectores: 4 }), L(2, 0, { lectores: 3 })], 'preview', 'grande').reason, /lectores/);
});

test('más de 2 rondas falla salvo que la última traiga decide_persona: true', () => {
  const tres = [L(1, 2), L(2, 1), L(3, 0)];
  assert.match(checkConvergencia(tres, 'preview', 'grande').reason, /tope/);
  const decide = [L(1, 2), L(2, 1), L(3, 1, { decide_persona: true })];
  assert.equal(checkConvergencia(decide, 'preview', 'grande').ok, true);
  assert.match(checkConvergencia([L(1, 2, { decide_persona: true }), L(2, 1), L(3, 0)], 'preview', 'grande').reason, /tope/);
});

test('sólo cuentan las líneas egm de la pieza pedida', () => {
  const mezcla = [{ tipo: 'bloque', fase: 5 }, L(1, 3, { pieza: 'otra' }), L(1, 0)];
  assert.equal(checkConvergencia(mezcla, 'preview', 'grande').ok, true);
});

test('CLI · converge sale 0, no converge sale 1, sin archivo sale 1 salvo chico, mal uso sale 2', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-egm-'));
  try {
    mkdirSync(join(root, '.ia-stack'));
    let r = run(['check', '--pieza', 'preview', '--tamano', 'chico', '--proyecto', root]);
    assert.equal(r.status, 0, r.output);
    r = run(['check', '--pieza', 'preview', '--tamano', 'grande', '--proyecto', root]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED/);
    const jsonl = join(root, '.ia-stack', 'metricas.jsonl');
    writeFileSync(jsonl, `${[L(1, 2), L(2, 0)].map((x) => JSON.stringify(x)).join('\n')}\n`);
    r = run(['check', '--pieza', 'preview', '--tamano', 'grande', '--proyecto', root]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: preview convergió en 2 rondas/);
    writeFileSync(jsonl, `${JSON.stringify(L(1, 1))}\n`);
    assert.equal(run(['check', '--pieza', 'preview', '--tamano', 'medio', '--proyecto', root]).status, 1);
    writeFileSync(jsonl, '{\n');
    r = run(['check', '--pieza', 'preview', '--tamano', 'medio', '--proyecto', root]);
    assert.equal(r.status, 1);
    assert.match(r.output, /metricas inválidas: línea 1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  for (const args of [[], ['otro'], ['check'], ['check', '--pieza', 'a'], ['check', '--pieza', 'a', '--tamano', 'enorme']]) {
    const r = run(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.output, /usage:/i);
  }
});

// ---- Régimen ronda ----
const EGM = { minimo: 5, maximo: 10, piezas: ['spec', 'plan-*', 'publicar', 'protocolo'], piezas_simples: ['preview'] };
const R = (ronda, h = [0, 0, 0], extra = {}) => ({ tipo: 'egm', pieza: 'spec', lectores: 4, ronda, altos: h[0], medios: h[1], bajos: h[2], ...extra });
const serie = (n, ultima = [0, 0, 0], extra = {}) => Array.from({ length: n }, (_, i) => (i === n - 1 ? R(i + 1, ultima, extra) : R(i + 1, [1, 2, 3])));
const de = (pieza, filas) => filas.map((f) => ({ ...f, pieza }));

test('regimenDe · listas del contrato, comparación exacta, plan- exige id', () => {
  for (const p of ['spec', 'plan-T01', 'publicar', 'protocolo']) assert.equal(regimenDe(p, EGM), 'ronda', p);
  assert.equal(regimenDe('preview', EGM), 'simple');
  for (const p of ['Spec', 'plan_T01', 'plan-', 'plan-*', 'otra', '']) assert.equal(regimenDe(p, EGM), null, p);
});

test('ronda · pieza desconocida falla y nunca cae en el régimen simple', () => {
  for (const p of ['Spec', 'plan_T01', 'plan-']) assert.match(checkConvergencia([L(1, 0, { pieza: p })], p, 'grande').reason, /pieza desconocida/);
});

test('contrato sin listas falla nombrando lo que falta, para cualquier pieza', () => {
  assert.equal(checkConvergencia([], 'spec', 'grande', null).reason, 'contrato sin rondas.egm');
  assert.equal(checkConvergencia([], 'spec', 'grande', { ...EGM, piezas: undefined }).reason, 'contrato sin rondas.egm.piezas');
  assert.equal(checkConvergencia([], 'preview', 'grande', { ...EGM, piezas_simples: 'preview' }).reason, 'contrato sin rondas.egm.piezas_simples');
});

test('ronda · mínimo 5: 4 limpias falla, 5 con la quinta limpia pasa', () => {
  assert.match(checkConvergencia(serie(4), 'spec', 'grande').reason, /4 rondas: el mínimo es 5/);
  const r = checkConvergencia(serie(5), 'spec', 'grande');
  assert.equal(r.ok, true);
  assert.equal(r.rondas, 5);
  assert.match(checkConvergencia(de('protocolo', serie(2)), 'protocolo', 'medio').reason, /2 rondas: el mínimo es 5/);
});

test('ronda · limpia = 0 hallazgos aplicados de cualquier severidad', () => {
  assert.match(checkConvergencia(serie(5, [0, 0, 1]), 'spec', 'grande').reason, /la ronda 5 no es limpia \(0 altos, 0 medios, 1 bajos\)$/);
  assert.equal(checkConvergencia([...serie(5, [0, 0, 1]), R(6)], 'spec', 'grande').ok, true);
});

test('ronda · cada ronda exige el mínimo de lectores; chico exige 2', () => {
  const pobre = serie(5);
  pobre[2] = R(3, [1, 0, 0], { lectores: 1 });
  assert.match(checkConvergencia(pobre, 'spec', 'medio').reason, /ronda 3: 1 lectores y se exigen 2/);
  assert.match(checkConvergencia(serie(5).map((f) => ({ ...f, lectores: 2 })), 'spec', 'grande').reason, /se exigen 4/);
  const plan = (lectores) => de('plan-T01', serie(5)).map((f) => ({ ...f, lectores }));
  assert.match(checkConvergencia(plan(1), 'plan-T01', 'chico').reason, /1 lectores y se exigen 2/);
  assert.equal(checkConvergencia(plan(2), 'plan-T01', 'chico').ok, true);
  assert.match(checkConvergencia(plan(2), 'plan-T01', 'enorme').reason, /tamaño inválido/);
  assert.match(checkConvergencia([], 'spec', 'enorme').reason, /tamaño inválido/);
});

test('ronda · rondas contiguas desde 1 y campo ronda entero', () => {
  assert.match(checkConvergencia([R(1), R(2), R(4)], 'spec', 'grande').reason, /rondas no contiguas: se esperaba 3 y vino 4/);
  assert.match(checkConvergencia([R(2), R(3)], 'spec', 'grande').reason, /rondas no contiguas: se esperaba 1 y vino 2/);
  for (const mala of [0, '1', '2', 1.5, null]) {
    assert.match(checkConvergencia([R(1), R(mala)], 'spec', 'grande').reason, /registro inválido: ronda/, String(mala));
  }
});

test('ronda · máximo 10: la décima no limpia pide a la persona; 11 falla siempre', () => {
  assert.match(checkConvergencia(serie(10, [1, 0, 0]), 'spec', 'grande').reason, /la ronda 10 no es limpia \(1 altos, 0 medios, 0 bajos\): decide la persona/);
  const decide = checkConvergencia(serie(10, [1, 0, 0], { decide_persona: true }), 'spec', 'grande');
  assert.equal(decide.ok, true);
  assert.equal(decide.decide, true);
  assert.equal(checkConvergencia(serie(10, [0, 0, 0], { decide_persona: true }), 'spec', 'grande').ok, true);
  assert.match(checkConvergencia(serie(11, [0, 0, 0], { decide_persona: true }), 'spec', 'grande').reason, /11 rondas superan el máximo de 10: decide la persona/);
});

test('ronda · decide_persona sólo vale en la ronda 10', () => {
  assert.match(checkConvergencia(serie(6, [0, 1, 0], { decide_persona: true }), 'spec', 'grande').reason, /la ronda 6 no es limpia/);
  assert.equal(checkConvergencia(serie(6, [0, 0, 0], { decide_persona: true }), 'spec', 'grande').ok, true);
});

test('ronda · sólo cuenta la última serie (desde el último ronda: 1)', () => {
  assert.equal(checkConvergencia([R(1, [3, 0, 0]), R(2, [1, 0, 0]), R(3, [1, 0, 0]), ...serie(5)], 'spec', 'grande').ok, true);
  assert.match(checkConvergencia([...serie(5), R(1, [1, 0, 0])], 'spec', 'grande').reason, /1 rondas: el mínimo es 5/);
});

test('ronda · spec en chico pasa aun con registros malos; sin registros falla', () => {
  assert.equal(checkConvergencia([R(3, [9, 9, 9])], 'spec', 'chico').ok, true);
  assert.match(checkConvergencia([], 'spec', 'medio').reason, /sin rondas EGM registradas para «spec»/);
  assert.match(checkConvergencia([], 'publicar', 'chico').reason, /sin rondas EGM registradas para «publicar»/);
});

test('el contrato real trae las dos listas y el gate 3 sigue protegido', () => {
  const egm = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'model-routing.json'), 'utf8')).rondas.egm;
  assert.deepEqual(egm.piezas, ['spec', 'plan-*', 'publicar', 'protocolo']);
  assert.deepEqual(egm.piezas_simples, ['preview']);
  const g3 = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'gates.json'), 'utf8')).gates.find((g) => g.n === 3);
  assert.equal(g3.protegido, true);
  assert.match(g3.nombre, /ronda o simple/);
});

test('leerMetricas · ausente da [], saltea líneas vacías, línea rota lanza con su número', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-egm-'));
  try {
    const ruta = join(root, 'metricas.jsonl');
    assert.deepEqual(leerMetricas(ruta), []);
    writeFileSync(ruta, `${JSON.stringify(R(1))}\r\n\n  \n${JSON.stringify(R(2))}\n`);
    assert.equal(leerMetricas(ruta).length, 2);
    writeFileSync(ruta, `${JSON.stringify(R(1))}\r\n\n{rota\n`);
    assert.throws(() => leerMetricas(ruta), /metricas inválidas: línea 3/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI · régimen ronda: 5 con la quinta limpia sale 0; 4 sale 1; décima con decide sale 0; pieza desconocida sale 1', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-egm-'));
  try {
    mkdirSync(join(root, '.ia-stack'));
    const jsonl = join(root, '.ia-stack', 'metricas.jsonl');
    const escribir = (filas) => writeFileSync(jsonl, `${filas.map((x) => JSON.stringify(x)).join('\n')}\n`);
    const check = (pieza, tamano) => run(['check', '--pieza', pieza, '--tamano', tamano, '--proyecto', root]);
    escribir(serie(5).map((f) => ({ ...f, lectores: 2 })));
    let r = check('spec', 'medio');
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: spec convergió en 5 rondas/);
    escribir(serie(4));
    assert.equal(check('spec', 'medio').status, 1);
    escribir(serie(5, [0, 0, 1]));
    assert.equal(check('spec', 'medio').status, 1);
    escribir(serie(10, [1, 0, 0]));
    assert.equal(check('spec', 'medio').status, 1);
    escribir(serie(10, [1, 0, 0], { decide_persona: true }));
    r = check('spec', 'medio');
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /decide la persona/);
    escribir(serie(11, [0, 0, 0], { decide_persona: true }));
    assert.equal(check('spec', 'medio').status, 1);
    r = check('Spec', 'medio');
    assert.equal(r.status, 1);
    assert.match(r.output, /pieza desconocida «Spec»/);
    r = check('spec', 'chico');
    assert.equal(r.status, 0, r.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
