import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  ARTIFACTS,
  SCHEMAS,
  validateAdoption,
  validateArtifact,
  validateCaio,
  validateDiagnostics,
  validateImplementation,
  validateLoopMap,
  validatePrd,
  validateRecurrence,
  main,
} from '../scripts/verify-product-diagnostics.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const ev = () => ({ source: 'test', locator: 'fixture:1', observation: 'observación medida en un fixture real' });
const finding = (id, status = 'observed') => ({ id, status, description: 'hallazgo suficientemente descrito para revisión', evidence: status === 'observed' ? [ev()] : [], reason: status === 'hypothesis' ? 'falta medir esta hipótesis antes de convertirla en hecho' : '' });

function caio() {
  return {
    schema: SCHEMAS.caio, feature: 'demo-feature', date: '2026-09-01',
    process: { name: 'Proceso de prueba', owner: 'Owner de prueba', scope: 'Entrada a salida del proceso' },
    findings: { broken_process: [finding('BP1')], information_loss: [finding('IL1', 'hypothesis')], repeated_work: [finding('RW1', 'hypothesis')], open_loops: [finding('OL1')] },
  };
}

function loopMap() {
  const stage = { input: 'entrada observable', measure: 'métrica actual', decision_owner: 'responsable', action: 'acción concreta', control: 'control verificable', learning: 'cómo se aprende' };
  return { schema: SCHEMAS['loop-map'], feature: 'demo-feature', date: '2026-09-01', current: stage, target: clone(stage), first_loop: { id: 'loop-01', owner: 'owner', metric: 'métrica', cadence: 'semanal', success_threshold: 'umbral', next_candidate: 'siguiente proceso' } };
}

function prd() {
  return {
    schema: SCHEMAS.prd, feature: 'demo-feature', date: '2026-09-01', problem: 'problema observable', users: [{ role: 'operador', context: 'cuando ejecuta el proceso' }], outcome: 'resultado operativo observable', in_scope: ['capacidad'], out_scope: ['servicio externo'], capabilities: [{ id: 'CAP1', description: 'capacidad principal', priority: 'must' }], technology: { stack: 'Node nativo', dependencies: ['ninguna'], access: ['repositorio'] }, acceptance_criteria: [{ id: 'AC1', statement: 'GIVEN estado WHEN acción THEN resultado' }], risks: [{ id: 'R1', description: 'riesgo', mitigation: 'mitigación' }],
  };
}

function implementation() {
  return { schema: SCHEMAS.implementation, feature: 'demo-feature', date: '2026-09-01', order: [{ id: 'STEP1', action: 'construir base', depends_on: [], validation: 'node --test', access_needed: ['repo'] }, { id: 'STEP2', action: 'validar integración', depends_on: ['STEP1'], validation: 'gate E2E', access_needed: ['repo'] }], rollback: 'revertir el commit del lote', release_gate: 'suite y seguridad verdes' };
}

function adoption() {
  return { schema: SCHEMAS.adoption, feature: 'demo-feature', date: '2026-09-01', owner: 'responsable interno', stakeholders: ['equipo'], workflow_change: 'se agrega un paso explícito', training: 'guía y sesión breve', success_signal: 'uso medido semanal', review_cadence: 'semanal', fallback: 'volver al flujo anterior y registrar causa', rollout_steps: [{ id: 'ROLLOUT1', when: 'piloto listo', action: 'activar con un equipo', exit_criteria: 'señal estable dos semanas' }] };
}

function recurrence() {
  return { schema: SCHEMAS.recurrence, feature: 'demo-feature', date: '2026-09-01', first_loop_id: 'loop-01', maintenance: 'revisión y actualización', metric: 'métrica de éxito', cadence: 'semanal', review_owner: 'owner', escalation: 'abrir diagnóstico si cae', next_process: 'siguiente proceso', trigger: 'señal por debajo del umbral' };
}

function allDocs() { return { caio: caio(), 'loop-map': loopMap(), prd: prd(), implementation: implementation(), adoption: adoption(), recurrence: recurrence() }; }

test('validates the six complete product-discovery artefacts', () => {
  const result = validateDiagnostics(allDocs());
  assert.equal(result.ok, true);
  assert.match(result.summary, /6\/6/);
  assert.deepEqual(validateArtifact('caio', caio()), []);
  assert.deepEqual(validateArtifact('loop-map', loopMap()), []);
  assert.deepEqual(validateArtifact('prd', prd()), []);
  assert.deepEqual(validateArtifact('implementation', implementation()), []);
  assert.deepEqual(validateArtifact('adoption', adoption()), []);
  assert.deepEqual(validateArtifact('recurrence', recurrence()), []);
});

test('CAIO rejects shape, duplicate ids, bad evidence and unsupported statuses', () => {
  assert.match(validateCaio({}).join('\n'), /exactamente/);
  const bad = caio(); bad.schema = 'wrong'; bad.feature = 'Bad'; bad.date = 'tomorrow'; bad.process.owner = ''; bad.findings.broken_process.push(finding('BP1')); bad.findings.information_loss[0].status = 'made-up'; bad.findings.open_loops[0].evidence = []; assert.ok(validateCaio(bad).length >= 6);
  const malformed = caio(); malformed.findings.repeated_work = 'no'; assert.ok(validateCaio(malformed).some((x) => x.includes('lista')));
  const malformedItem = caio(); malformedItem.findings.broken_process = [{}]; assert.ok(validateCaio(malformedItem).some((x) => x.includes('id, status')));
  const badId = caio(); badId.findings.broken_process[0].id = 'bad id'; assert.ok(validateCaio(badId).some((x) => x.includes('identificador')));
  const badProcess = caio(); badProcess.process = {}; assert.ok(validateCaio(badProcess).some((x) => x.includes('process debe')));
  const badFindings = caio(); badFindings.findings = { broken_process: [] }; assert.ok(validateCaio(badFindings).some((x) => x.includes('findings debe')));
  const item = caio(); item.findings.broken_process[0].evidence = [{ source: '', locator: '', observation: '' }]; assert.ok(validateCaio(item).some((x) => x.includes('source')));
  const badEvidenceShape = caio(); badEvidenceShape.findings.broken_process[0].evidence = [{}]; assert.ok(validateCaio(badEvidenceShape).some((x) => x.includes('source')));
  const hyp = caio(); hyp.findings.information_loss[0].evidence = 'not-list'; hyp.findings.information_loss[0].reason = ''; assert.ok(validateCaio(hyp).some((x) => x.includes('evidence')));
  const empty = caio(); empty.findings = { broken_process: [], information_loss: [], repeated_work: [], open_loops: [] }; assert.ok(validateCaio(empty).some((x) => x.includes('al menos un hallazgo')));
  assert.ok(validateArtifact('unknown', caio()).some((x) => x.includes('desconocido')));
  assert.ok(validateArtifact('caio', null).length > 0);
  const nullFeature = caio(); nullFeature.feature = null; assert.ok(validateCaio(nullFeature).some((x) => x.includes('slug')));
});

test('loop map requires both flows and a measurable first loop', () => {
  assert.ok(validateLoopMap({}).length > 0);
  const bad = loopMap(); bad.current.input = ''; bad.target = { input: 'x' }; bad.first_loop.metric = ''; assert.ok(validateLoopMap(bad).length >= 3);
  const badStage = loopMap(); badStage.current = null; assert.ok(validateLoopMap(badStage).some((x) => x.includes('current')));
  const badLoop = loopMap(); badLoop.first_loop = {}; assert.ok(validateLoopMap(badLoop).some((x) => x.includes('first_loop')));
});

test('PRD validates users, scope, capabilities, technology, ACs and risks', () => {
  assert.ok(validatePrd({}).length > 0);
  const bad = prd(); bad.problem = ''; bad.users = []; bad.in_scope = []; bad.out_scope = 'x'; bad.capabilities[0].priority = 'later'; bad.capabilities.push(clone(bad.capabilities[0])); bad.technology = {}; bad.acceptance_criteria = []; bad.risks = []; assert.ok(validatePrd(bad).length >= 8);
  const malformed = prd(); malformed.users = [{ role: '', context: '' }]; malformed.capabilities = [{ id: 'bad id', description: '', priority: 'must' }]; malformed.technology.dependencies = ['']; malformed.acceptance_criteria = [{ id: 'AC1', statement: '' }]; malformed.risks = [{ id: 'bad id', description: '', mitigation: '' }]; assert.ok(validatePrd(malformed).length >= 6);
  const malformedItems = prd(); malformedItems.users = [{}]; malformedItems.capabilities = [{}]; malformedItems.acceptance_criteria = [{}]; malformedItems.risks = [{}]; assert.ok(validatePrd(malformedItems).length >= 4);
  const emptyLists = prd(); emptyLists.capabilities = []; assert.ok(validatePrd(emptyLists).some((x) => x.includes('capabilities')));
  const duplicate = prd(); duplicate.acceptance_criteria.push(clone(duplicate.acceptance_criteria[0])); assert.ok(validatePrd(duplicate).some((x) => x.includes('repite')));
  const badAcId = prd(); badAcId.acceptance_criteria[0].id = 'bad id'; assert.ok(validatePrd(badAcId).some((x) => x.includes('no es válido')));
});

test('implementation plan enforces a topological order and rollback', () => {
  assert.ok(validateImplementation({}).length > 0);
  const bad = implementation(); bad.order[0].depends_on = ['STEP2']; bad.order[1].depends_on.push('MISSING'); bad.order.push(clone(bad.order[1])); bad.rollback = ''; bad.release_gate = ''; assert.ok(validateImplementation(bad).length >= 4);
  const malformed = implementation(); malformed.order = 'x'; assert.ok(validateImplementation(malformed).some((x) => x.includes('order')));
  const malformedStep = implementation(); malformedStep.order = [{ id: 'bad id' }]; assert.ok(validateImplementation(malformedStep).some((x) => x.includes('order[0] debe')));
  const badStepId = implementation(); badStepId.order[0].id = 'bad id'; assert.ok(validateImplementation(badStepId).some((x) => x.includes('no es válido')));
  const duplicateStep = implementation(); duplicateStep.order.push(clone(duplicateStep.order[0])); assert.ok(validateImplementation(duplicateStep).some((x) => x.includes('repite')));
});

test('adoption and recurrence require ownership, rollout and escalation', () => {
  assert.ok(validateAdoption({}).length > 0); assert.ok(validateRecurrence({}).length > 0);
  const a = adoption(); a.owner = ''; a.stakeholders = []; a.workflow_change = ''; a.rollout_steps[0].id = ''; a.rollout_steps.push(clone(a.rollout_steps[0])); assert.ok(validateAdoption(a).length >= 4);
  const a2 = adoption(); a2.rollout_steps = [{ id: 'x', when: '', action: '', exit_criteria: '' }]; assert.ok(validateAdoption(a2).length >= 3);
  const emptyRollout = adoption(); emptyRollout.rollout_steps = []; assert.ok(validateAdoption(emptyRollout).some((x) => x.includes('rollout_steps')));
  const malformedRollout = adoption(); malformedRollout.rollout_steps = [{}]; assert.ok(validateAdoption(malformedRollout).some((x) => x.includes('rollout_steps[0]')));
  const duplicateRollout = adoption(); duplicateRollout.rollout_steps.push(clone(duplicateRollout.rollout_steps[0])); assert.ok(validateAdoption(duplicateRollout).some((x) => x.includes('repite')));
  const r = recurrence(); r.metric = ''; r.trigger = ''; assert.ok(validateRecurrence(r).length >= 2);
});

test('validateDiagnostics reports malformed artefacts instead of only the first one', () => {
  const bad = allDocs(); bad.caio = {}; bad.prd = {}; const result = validateDiagnostics(bad);
  assert.equal(result.ok, false); assert.ok(result.violations.some((x) => x.startsWith('caio:'))); assert.ok(result.violations.some((x) => x.startsWith('prd:')));
});

test('CLI reports empty, missing, malformed, partial and valid directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-diagnostics-')); const out = []; const err = [];
  try {
    assert.equal(main(['bad'], root, {}, out.push.bind(out), err.push.bind(err)), 2);
    assert.equal(main(['check', 'demo-feature'], root, {}, out.push.bind(out), err.push.bind(err)), 0); assert.match(out.at(-1), /^VACÍO:/u);
    assert.equal(main(['check', 'demo-feature', '--require-inputs'], root, {}, out.push.bind(out), err.push.bind(err)), 1);
    const dir = join(root, 'docs', 'discovery', 'demo-feature', 'diagnostics'); mkdirSync(dir, { recursive: true });
    assert.equal(main(['check', 'demo-feature'], root, {}, out.push.bind(out), err.push.bind(err)), 1);
    writeFileSync(join(dir, 'caio.json'), '{bad');
    assert.equal(main(['check', 'demo-feature'], root, {}, out.push.bind(out), err.push.bind(err)), 1);
    for (const kind of ARTIFACTS) writeFileSync(join(dir, `${kind}.json`), JSON.stringify(allDocs()[kind]));
    assert.equal(main(['check', 'demo-feature'], root, {}, out.push.bind(out), err.push.bind(err)), 0); assert.match(out.at(-1), /6\/6/);
    rmSync(join(dir, 'caio.json')); assert.equal(main(['check', 'demo-feature'], root, {}, out.push.bind(out), err.push.bind(err)), 1);
    const invalidDir = join(root, 'docs', 'discovery', 'other', 'diagnostics'); mkdirSync(join(root, 'docs', 'discovery', 'other'), { recursive: true }); writeFileSync(invalidDir, 'file'); assert.equal(main(['check', 'other'], root, {}, out.push.bind(out), err.push.bind(err)), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI reports injected read errors without throwing', () => {
  const errors = []; const cwd = mkdtempSync(join(tmpdir(), 'vcp-diagnostics-read-'));
  try {
    const stat = () => ({ isDirectory: () => true });
    const read = () => { throw new Error('read denied'); };
    assert.equal(main(['check', 'demo-feature'], cwd, { stat, read }, () => {}, errors.push.bind(errors)), 1);
    assert.match(errors.join('\n'), /read denied/u);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('CLI rejects unsupported flags and accepts empty diagnostics without strict input', () => {
  const errors = []; const output = [];
  assert.equal(main(['check', 'demo-feature', '--unexpected'], '.', {}, output.push.bind(output), errors.push.bind(errors)), 2);
  assert.equal(main(['check', 'demo-feature'], '.', { stat: () => undefined }, output.push.bind(output), errors.push.bind(errors)), 0);
});
