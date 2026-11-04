// verify-egm-convergencia — la revisión goldfish (EGM) de un documento convergió antes de construir.
//
// POR QUÉ EXISTE (04-11-2026): el plan de la landing de Grobit pasó por una revisión con subagentes
// sin contexto que encontró huecos que la sesión que lo escribió no veía. Esa revisión sólo vale si
// los revisores fueron agentes NUEVOS, todos corrieron, y no quedó Blocker ni Major sin asentar.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PANELES, checkConvergencia, panelRequerido, rondaLimpia } from '../scripts/verify-egm-convergencia.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-egm-convergencia.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Los nombres de los revisores son los del plugin instalado `egm@egm` 0.1.0 (frontmatter `name` de
// .claude-plugin/agents/*.md; en Claude Code el tipo de Agent es `egm:<nombre>`), y el panel de diseño
// es el de las cinco etapas de /egm:egm-review: zoom-out, comprehension, design + structural + style,
// zoom-out, implementation-readiness + codebase-details + style.
const DISENO = ['egm-zoom-out', 'egm-comprehension', 'egm-design', 'egm-structural', 'egm-style', 'egm-implementation-readiness', 'egm-codebase-details'];
const revisores = (panel, extra = {}) => panel.map((nombre) => ({ nombre, agente_nuevo: true, estado: 'completed', ...extra[nombre] }));
const ronda = (n, hallazgos = [], panel = DISENO, extra) => ({ n, revisores: revisores(panel, extra), hallazgos });
const base = (rondas, cambios = {}) => ({
  schema: 'ia.egm-rondas/1', pieza: 'spec-fichaje', documento: 'docs/spec.md', tipo: 'diseno', riesgo: 'alto',
  panel: DISENO, rondas, ...cambios,
});
const H = (id, severidad, resolucion) => ({ id, severidad, resolucion });

test('paneles · diseño = los 7 de /egm:egm-review con sus nombres reales; público = los 5 más el panel de audiencia', () => {
  assert.deepEqual(PANELES.diseno, DISENO);
  assert.deepEqual(PANELES.publico, [...DISENO, 'scroller', 'esceptico', 'primerizo', 'comprador']);
});

test('ronda limpia · sin Blocker/Major abiertos o arreglados; los asentados y los Nits no ensucian', () => {
  assert.equal(rondaLimpia(ronda(1), DISENO).limpia, true);
  assert.equal(rondaLimpia(ronda(1, [H('a', 'Nit', 'abierto'), H('b', 'Major', 'contest'), H('c', 'Blocker', 'riesgo-aceptado')]), DISENO).limpia, true);
  assert.match(rondaLimpia(ronda(1, [H('a', 'Major', 'fixed')]), DISENO).motivo, /a/, 'un arreglo no asienta: lo confirma la ronda siguiente');
  assert.match(rondaLimpia(ronda(1, [H('a', 'Blocker', 'abierto')]), DISENO).motivo, /Blocker/);
});

test('ronda limpia · un revisor que no corrió, que no era nuevo o que falta, ensucia la ronda', () => {
  assert.match(rondaLimpia(ronda(1, [], DISENO, { 'egm-structural': { estado: 'not run' } }), DISENO).motivo, /egm-structural.*not run/);
  assert.match(rondaLimpia(ronda(1, [], DISENO, { 'egm-zoom-out': { agente_nuevo: false } }), DISENO).motivo, /egm-zoom-out.*nuevo/);
  assert.match(rondaLimpia(ronda(1, [], DISENO.slice(1)), DISENO).motivo, /egm-zoom-out.*falta/);
});

test('convergencia · riesgo alto pide 2 rondas limpias seguidas; bajo o medio se conforma con 1 con motivo', () => {
  assert.equal(checkConvergencia(base([ronda(1, [H('x', 'Major', 'fixed')]), ronda(2), ronda(3)])).ok, true);
  assert.match(checkConvergencia(base([ronda(1, [H('x', 'Major', 'fixed')]), ronda(2)])).reason, /2 rondas limpias/);
  assert.match(checkConvergencia(base([ronda(1)])).reason, /2 rondas limpias seguidas y hay 1/);
  const medio = { riesgo: 'medio', rondas_limpias_requeridas: 1, motivo_una_ronda: 'cambio de copy en un mail interno' };
  assert.equal(checkConvergencia(base([ronda(1)], medio)).ok, true);
  assert.match(checkConvergencia(base([ronda(1)], { ...medio, motivo_una_ronda: '' })).reason, /motivo_una_ronda/);
  assert.match(checkConvergencia(base([ronda(1)], { ...medio, riesgo: 'critico' })).reason, /alto o critico/);
  assert.match(checkConvergencia(base([ronda(1)], { riesgo: 'raro' })).reason, /riesgo/);
});

test('convergencia · una pieza pública exige el panel de audiencia', () => {
  const publico = { tipo: 'publico', panel: PANELES.publico };
  assert.equal(checkConvergencia(base([ronda(1, [], PANELES.publico), ronda(2, [], PANELES.publico)], publico)).ok, true);
  assert.match(checkConvergencia(base([ronda(1), ronda(2)], { tipo: 'publico' })).reason, /scroller/);
  assert.match(checkConvergencia(base([ronda(1)], { tipo: 'otro' })).reason, /tipo/);
});

test('decisión del operador 04-11-2026 · pieza pública de riesgo bajo o medio: panel de 6 (audiencia + egm-design + egm-implementation-readiness)', () => {
  const seis = ['egm-design', 'egm-implementation-readiness', 'scroller', 'esceptico', 'primerizo', 'comprador'];
  assert.deepEqual(PANELES.publico_medio, seis);
  assert.deepEqual(panelRequerido('publico', 'medio'), seis);
  assert.deepEqual(panelRequerido('publico', 'bajo'), seis);
  assert.deepEqual(panelRequerido('publico', 'alto'), PANELES.publico);
  assert.deepEqual(panelRequerido('diseno', 'medio'), DISENO);
  const medio = { tipo: 'publico', riesgo: 'medio', panel: seis };
  assert.equal(checkConvergencia(base([ronda(1, [], seis), ronda(2, [], seis)], medio)).ok, true);
  assert.match(checkConvergencia(base([ronda(1, [], seis.slice(1)), ronda(2, [], seis)], medio)).reason, /egm-design.*falta/);
});

test('decisión del operador 04-11-2026 · una pieza pública siempre pide 2 rondas limpias, aun con riesgo medio', () => {
  const seis = PANELES.publico_medio;
  const una = { tipo: 'publico', riesgo: 'medio', panel: seis, rondas_limpias_requeridas: 1, motivo_una_ronda: 'copy chico' };
  assert.match(checkConvergencia(base([ronda(1, [], seis)], una)).reason, /pública/);
});

test('convergencia · tope de 5 rondas: la sexta sólo con decisión humana registrada', () => {
  const seis = [1, 2, 3, 4].map((n) => ronda(n, [H(`m${n}`, 'Major', 'fixed')])).concat([ronda(5), ronda(6)]);
  assert.match(checkConvergencia(base(seis)).reason, /tope de 5/);
  assert.equal(checkConvergencia(base(seis, { decision_humana_tope: '04-11-2026 15:10 Ana: seguir una ronda más' })).ok, true);
});

test('convergencia · forma: schema, rondas en orden, ids únicos, severidad y resolución válidas', () => {
  assert.match(checkConvergencia({}).reason, /schema/);
  assert.match(checkConvergencia(base([])).reason, /ninguna ronda/);
  assert.match(checkConvergencia(base([ronda(2)])).reason, /orden/);
  assert.match(checkConvergencia(base([ronda(1, [H('a', 'Nit', 'decline'), H('a', 'Nit', 'decline')])])).reason, /repetido/);
  assert.match(checkConvergencia(base([ronda(1, [H('a', 'Grave', 'abierto')])])).reason, /severidad/);
  assert.match(checkConvergencia(base([ronda(1, [H('a', 'Nit', 'olvidado')])])).reason, /resolución/);
  assert.match(checkConvergencia(base([ronda(1, [H('a', 'Major', 'decline')])])).reason, /decline.*Nit/);
  assert.match(checkConvergencia(base([{ n: 1 }])).reason, /revisores/);
  assert.match(checkConvergencia(base([ronda(1)], { panel: ['egm-zoom-out'] })).reason, /egm-comprehension/);
  assert.match(checkConvergencia(base([ronda(1)], { panel: undefined })).reason, /exige egm-zoom-out/);
});

test('CLI · converge sale 0, no converge sale 1, ilegible sale 1, mal uso sale 2', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-egm-'));
  try {
    const ok = join(root, 'ok.json');
    writeFileSync(ok, JSON.stringify(base([ronda(1), ronda(2)])));
    let r = run(['check', ok]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK: spec-fichaje convergió: 2 rondas limpias seguidas de 2 rondas/);
    const no = join(root, 'no.json');
    writeFileSync(no, JSON.stringify(base([ronda(1, [H('b', 'Blocker', 'abierto')])])));
    r = run(['check', no]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED/);
    const roto = join(root, 'roto.json');
    writeFileSync(roto, '{');
    assert.equal(run(['check', roto]).status, 1);
    r = run(['check', join(root, 'no-existe.json')]);
    assert.equal(r.status, 1);
    assert.match(r.output, /REJECTED:.*leer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  for (const args of [[], ['otro', 'a'], ['check'], ['check', 'a', 'b']]) {
    const r = run(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.output, /usage:/i);
  }
});
