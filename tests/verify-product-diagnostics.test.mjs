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
// Las cuatro clases que el encargo separa. Cada una carga lo que su etiqueta exige: un observado
// no vale sin evidencia, una inferencia sin decir de que se infiere es una hipotesis con mejor
// nombre, y un dato faltante que no dice como conseguirlo es un encogimiento de hombros.
export const DIMENSIONS = Object.freeze(['broken_process', 'information_loss', 'repeated_work', 'open_loops', 'ownerless_decisions', 'unmeasured_states', 'broken_handoffs', 'recurring_errors', 'absent_learning', 'hidden_costs', 'security_risks', 'conversational_memory_dependency']);

const finding = (id, status = 'observed', extra = {}) => {
  const base = {
    id,
    status,
    description: 'hallazgo suficientemente descrito para revisión',
    evidence: status === 'observed' ? [ev()] : [],
    reason: status === 'hypothesis' || status === 'inference' ? 'falta medir esto antes de convertirlo en hecho' : '',
  };
  if (status === 'inference') return { ...base, derived_from: ['BP1'], ...extra };
  if (status === 'missing_data') return { ...base, what_is_missing: 'cuántas veces se repitió el mes pasado', how_to_get_it: 'contar los receipts de .vibe/receipts del último mes', ...extra };
  return { ...base, ...extra };
};

function caio() {
  const findings = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, []]));
  findings.broken_process = [finding('BP1')];
  findings.information_loss = [finding('IL1', 'hypothesis')];
  findings.repeated_work = [finding('RW1', 'inference')];
  findings.open_loops = [finding('OL1', 'missing_data')];
  // Una dimensión sin hallazgos tiene que decir si se miró y no había nada, o si no se miró y por
  // qué. Sin eso, ocho silencios se leen igual que ocho dimensiones sanas.
  const coverage = Object.fromEntries(DIMENSIONS
    .filter((dimension) => findings[dimension].length === 0)
    .map((dimension) => [dimension, { state: 'examined_clean', reason: 'se revisaron los tres últimos ciclos y no apareció nada en esta dimensión' }]));
  return {
    schema: SCHEMAS.caio, feature: 'demo-feature', date: '2026-09-01',
    process: { name: 'Proceso de prueba', owner: 'Owner de prueba', scope: 'Entrada a salida del proceso' },
    findings,
    coverage,
  };
}
// Los trece campos que el encargo pide por bucle. `decision` es qué se decide; `decision_owner`,
// quién decide. Son dos cosas distintas y un bucle sin las dos no se puede auditar.
export const LOOP_FIELDS = Object.freeze(['input', 'transformation', 'actor', 'decision', 'decision_owner', 'action', 'measure', 'control', 'evidence', 'learning', 'next_iteration', 'exit_condition', 'block_condition']);

const loopStage = (prefijo) => Object.fromEntries(LOOP_FIELDS.map((campo) => [campo, `${prefijo}: ${campo} declarado con texto suficiente`]));

function loopMap() {
  const current = loopStage('hoy');
  const target = loopStage('hoy');
  // Sólo dos campos cambian, así que el delta tiene que traer exactamente esos dos: ni uno que no
  // cambió, ni faltar uno que sí. Es lo único del mapa que se puede verificar contra el documento.
  target.measure = 'objetivo: measure declarado con texto suficiente';
  target.control = 'objetivo: control declarado con texto suficiente';
  const delta = [
    { field: 'measure', from: current.measure, to: target.measure, why: 'hoy no se mide el tiempo entre entrada y decisión' },
    { field: 'control', from: current.control, to: target.control, why: 'el control actual no frena nada, sólo informa' },
  ];
  return {
    schema: SCHEMAS['loop-map'], feature: 'demo-feature', date: '2026-09-01',
    current, delta, target,
    first_loop: {
      id: 'loop-01', owner: 'owner', metric: 'métrica', cadence: 'semanal',
      success_threshold: 'umbral', next_candidate: 'siguiente proceso',
      rollback: 'volver a la cadencia anterior y avisar al dueño en el mismo día',
      failure_signals: ['el bucle se saltea dos revisiones seguidas', 'la métrica deja de moverse tres cadencias'],
    },
  };
}
// Un criterio de aceptacion con evento, precondicion, accion, resultado observable, test y
// evidencia esperada se puede comprobar. Un statement en prosa, no: dice que alguien penso algo.
const criterio = (id, extra = {}) => ({
  id,
  event: 'el operador cierra la fase',
  precondition: 'existe un intake completo y el research ya cerro',
  action: 'corre el gate de diagnosticos sobre el feature',
  observable_result: 'el gate sale 0 y nombra los seis artefactos validados',
  test: 'tests/verify-product-diagnostics.test.mjs',
  expected_evidence: 'la linea OK con el conteo, guardada en el receipt de la fase',
  ...extra,
});

function prd() {
  return {
    schema: SCHEMAS.prd, feature: 'demo-feature', date: '2026-09-01',
    problem: 'problema observable',
    users: [{ role: 'operador', context: 'cuando ejecuta el proceso' }],
    jobs_to_be_done: ['cerrar una fase sin releer todo el expediente'],
    outcome: 'resultado operativo observable',
    non_goals: ['no reemplaza la revision humana del diagnostico'],
    in_scope: ['capacidad'],
    out_scope: ['servicio externo'],
    capabilities: [{ id: 'CAP1', description: 'capacidad principal', priority: 'must' }],
    non_functional_requirements: [{ id: 'NFR1', description: 'el gate cierra en menos de un segundo sobre un feature', measure: 'tiempo de pared medido en la suite' }],
    security: 'no lee rutas fuera del proyecto ni sale a la red',
    privacy: 'no registra datos de personas: el expediente es sobre el proceso',
    observability: 'cada rechazo nombra el artefacto y el campo que lo causo',
    integrations: ['ninguna: Node nativo'],
    data: 'seis archivos JSON por feature, versionados con el repositorio',
    architecture: 'un verificador puro por artefacto y un CLI que los orquesta',
    technology: { stack: 'Node nativo', dependencies: ['ninguna'], access: ['repositorio'] },
    acceptance_criteria: [criterio('AC1')],
    metrics: [{ id: 'M1', name: 'fases cerradas con los seis artefactos validos', baseline: '0 de 3 en agosto', target: '3 de 3 en septiembre' }],
    risks: [{ id: 'R1', description: 'riesgo', mitigation: 'mitigacion' }],
    rollout: 'se exige primero en features nuevas, y recien despues en las que ya estaban abiertas',
    rollback: 'se vuelve a exigir solo los cuatro artefactos anteriores, sin tocar los ya escritos',
  };
}
function implementation() {
  return { schema: SCHEMAS.implementation, feature: 'demo-feature', date: '2026-09-01', order: [{ id: 'STEP1', action: 'construir base', depends_on: [], validation: 'node --test', access_needed: ['repo'] }, { id: 'STEP2', action: 'validar integración', depends_on: ['STEP1'], validation: 'gate E2E', access_needed: ['repo'] }], rollback: 'revertir el commit del lote', release_gate: 'suite y seguridad verdes' };
}

function adoption() {
  return { schema: SCHEMAS.adoption, feature: 'demo-feature', date: '2026-09-01',
    owner: 'responsable interno que sostiene el cambio',
    operational_owner: 'quien lo ejecuta todos los días, que no es el mismo que lo sostiene',
    stakeholders: ['equipo'], workflow_change: 'se agrega un paso explícito',
    training: 'guía y sesión breve', success_signal: 'uso medido semanal',
    adoption_checklist: [{ id: 'CHK1', item: 'el equipo corrió el flujo nuevo una vez con acompañamiento' }],
    adoption_metric: { name: 'ciclos cerrados con el flujo nuevo', baseline: '0 de 4 en agosto', target: '3 de 4 en septiembre' },
    review_cadence: 'semanal', fallback: 'volver al flujo anterior y registrar causa',
    rollout_steps: [{ id: 'ROLLOUT1', when: 'piloto listo', action: 'activar con un equipo', exit_criteria: 'señal estable dos semanas' }] };
}

function recurrence() {
  return { schema: SCHEMAS.recurrence, feature: 'demo-feature', date: '2026-09-01', first_loop_id: 'loop-01',
    maintenance: 'revisión y actualización', metric: 'métrica de éxito', cadence: 'semanal',
    review_owner: 'owner', escalation: 'abrir diagnóstico si cae',
    promotion_criteria: 'qué tiene que pasar para que esta mejora se exija en todos los ciclos',
    retirement_criteria: 'qué tiene que pasar para sacarla, y quién lo decide',
    next_process: 'siguiente proceso', trigger: 'señal por debajo del umbral' };
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
  const malformedItem = caio(); malformedItem.findings.broken_process = [{}]; assert.ok(validateCaio(malformedItem).some((x) => x.includes('status debe ser una de')), 'un hallazgo sin clase no se puede juzgar: la clase decide qué campos exige');
  const incompleteItem = caio(); incompleteItem.findings.broken_process = [{ status: 'observed' }]; assert.ok(validateCaio(incompleteItem).some((x) => x.includes('id, status')), 'con la clase declarada, el gate nombra las claves que faltan');
  const badId = caio(); badId.findings.broken_process[0].id = 'bad id'; assert.ok(validateCaio(badId).some((x) => x.includes('identificador')));
  const badProcess = caio(); badProcess.process = {}; assert.ok(validateCaio(badProcess).some((x) => x.includes('process debe')));
  const badFindings = caio(); badFindings.findings = { broken_process: [] }; assert.ok(validateCaio(badFindings).some((x) => x.includes('findings debe')));
  const item = caio(); item.findings.broken_process[0].evidence = [{ source: '', locator: '', observation: '' }]; assert.ok(validateCaio(item).some((x) => x.includes('source')));
  const badEvidenceShape = caio(); badEvidenceShape.findings.broken_process[0].evidence = [{}]; assert.ok(validateCaio(badEvidenceShape).some((x) => x.includes('source')));
  const hyp = caio(); hyp.findings.information_loss[0].evidence = 'not-list'; hyp.findings.information_loss[0].reason = ''; assert.ok(validateCaio(hyp).some((x) => x.includes('evidence')));
  const empty = caio(); empty.findings = Object.fromEntries(DIMENSIONS.map((d) => [d, []])); empty.coverage = Object.fromEntries(DIMENSIONS.map((d) => [d, { state: 'not_examined', reason: 'no se examinó ninguna dimensión en esta corrida de prueba' }])); assert.ok(validateCaio(empty).some((x) => x.includes('al menos un hallazgo')));
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

test('CAIO exige las doce dimensiones del diagnóstico, no cuatro', () => {
  // El encargo lista doce cosas que hay que mirar. Con cuatro campos, las otras ocho son invisibles:
  // no se distingue "lo miré y no había nada" de "no lo miré".
  assert.deepEqual(validateCaio(caio()), []);
  assert.equal(DIMENSIONS.length, 12);
  for (const dimension of DIMENSIONS) {
    const sinUna = caio();
    delete sinUna.findings[dimension];
    delete sinUna.coverage[dimension];
    assert.ok(validateCaio(sinUna).length > 0, `aceptó un CAIO sin la dimensión ${dimension}`);
  }
  const conExtra = caio();
  conExtra.findings.dimension_inventada = [];
  assert.ok(validateCaio(conExtra).length > 0, 'aceptó una dimensión que el diagnóstico no declara');
});

test('CAIO separa las cuatro clases que el encargo pide', () => {
  const clases = ['observed', 'hypothesis', 'inference', 'missing_data'];
  for (const status of clases) {
    const documento = caio();
    documento.findings.security_risks = [finding('SR1', status)];
    delete documento.coverage.security_risks;
    assert.deepEqual(validateCaio(documento), [], `rechazó un hallazgo válido de clase ${status}`);
  }
  const inventada = caio();
  inventada.findings.hidden_costs = [finding('HC1', 'sospecha')];
  delete inventada.coverage.hidden_costs;
  assert.ok(validateCaio(inventada).some((v) => v.includes('status')), 'aceptó una clase que no existe');
});

test('FALSIFICACIÓN · una inferencia que no dice de qué se infiere es una hipótesis con mejor nombre', () => {
  const sinOrigen = caio();
  sinOrigen.findings.repeated_work = [finding('RW1', 'inference', { derived_from: [] })];
  assert.ok(validateCaio(sinOrigen).some((v) => v.includes('derived_from')), 'aceptó una inferencia sin origen');
  const origenFantasma = caio();
  origenFantasma.findings.repeated_work = [finding('RW1', 'inference', { derived_from: ['NO_EXISTE'] })];
  assert.ok(validateCaio(origenFantasma).some((v) => v.includes('NO_EXISTE')),
    'aceptó una inferencia derivada de un hallazgo que no está en el documento');
});

test('FALSIFICACIÓN · un dato faltante que no dice cómo conseguirlo es un encogimiento de hombros', () => {
  for (const campo of ['what_is_missing', 'how_to_get_it']) {
    const documento = caio();
    documento.findings.open_loops = [finding('OL1', 'missing_data', { [campo]: '' })];
    assert.ok(validateCaio(documento).some((v) => v.includes(campo)), `aceptó un dato faltante sin ${campo}`);
  }
});

test('FALSIFICACIÓN · una dimensión vacía sin cobertura declarada pasa desapercibida', () => {
  const sinDeclarar = caio();
  delete sinDeclarar.coverage.hidden_costs;
  assert.ok(validateCaio(sinDeclarar).some((v) => v.includes('hidden_costs')),
    'ocho dimensiones vacías sin declarar se leen igual que ocho dimensiones sanas');

  const contradictoria = caio();
  contradictoria.coverage.broken_process = { state: 'examined_clean', reason: 'no encontré nada acá' };
  assert.ok(validateCaio(contradictoria).some((v) => v.includes('broken_process')),
    'declaró limpia una dimensión que sí trae hallazgos');

  const estadoInventado = caio();
  estadoInventado.coverage.hidden_costs = { state: 'quizas', reason: 'un motivo suficientemente largo' };
  assert.ok(validateCaio(estadoInventado).some((v) => v.includes('state')), 'aceptó un estado de cobertura que no existe');

  const sinMotivo = caio();
  sinMotivo.coverage.hidden_costs = { state: 'not_examined', reason: '' };
  assert.ok(validateCaio(sinMotivo).some((v) => v.includes('reason')), 'no examinar sin decir por qué es un silencio');
});

test('FALSIFICACIÓN · los rechazos de evidencia y de cobertura mal formada también se ejercitan', () => {
  // Encontradas midiendo, no leyendo: verify-vcp-coverage nombró estas cuatro ramas una por una.
  // Un camino de rechazo que ningún proceso ejecutó es un camino del que no se sabe si rechaza.
  const sinEvidencia = caio();
  sinEvidencia.findings.broken_process[0].evidence = [];
  assert.ok(validateCaio(sinEvidencia).some((v) => v.includes('al menos una evidencia')),
    'un observado con la lista de evidencia vacía no es un hecho');

  const evidenciaNoLista = caio();
  evidenciaNoLista.findings.broken_process[0].evidence = 'una cita suelta';
  assert.ok(validateCaio(evidenciaNoLista).some((v) => v.includes('al menos una evidencia')));

  const coberturaNoObjeto = caio();
  coberturaNoObjeto.coverage = ['hidden_costs'];
  assert.ok(validateCaio(coberturaNoObjeto).some((v) => v.includes('coverage debe ser un objeto')));

  const dimensionInventada = caio();
  dimensionInventada.coverage.karma_del_equipo = { state: 'not_examined', reason: 'motivo suficientemente largo para pasar' };
  assert.ok(validateCaio(dimensionInventada).some((v) => v.includes('karma_del_equipo')),
    'aceptó cobertura sobre una dimensión que el diagnóstico no tiene');

  const entradaMalFormada = caio();
  entradaMalFormada.coverage.hidden_costs = { estado: 'not_examined' };
  assert.ok(validateCaio(entradaMalFormada).some((v) => v.includes('state y reason')));
});

test('el mapa de bucle declara los trece campos que el encargo pide, en los dos flujos', () => {
  assert.deepEqual(validateLoopMap(loopMap()), []);
  assert.equal(LOOP_FIELDS.length, 13);
  for (const campo of LOOP_FIELDS) {
    for (const flujo of ['current', 'target']) {
      const documento = loopMap();
      delete documento[flujo][campo];
      documento.delta = documento.delta.filter((cambio) => cambio.field !== campo);
      assert.ok(validateLoopMap(documento).length > 0, `aceptó ${flujo} sin ${campo}`);
    }
  }
});

test('FALSIFICACIÓN · el delta tiene que decir la verdad sobre current y target', () => {
  // Esto es lo único del mapa que el gate puede verificar de verdad: los otros campos son prosa.
  // Un delta que miente sobre lo que cambió es peor que no tenerlo, porque parece auditado.
  const inventado = loopMap();
  inventado.delta.push({ field: 'actor', from: inventado.current.actor, to: inventado.target.actor, why: 'declaro un cambio que no existe' });
  assert.ok(validateLoopMap(inventado).some((v) => v.includes('actor')),
    'aceptó un delta sobre un campo idéntico entre current y target');

  const omitido = loopMap();
  omitido.delta = omitido.delta.filter((cambio) => cambio.field !== 'control');
  assert.ok(validateLoopMap(omitido).some((v) => v.includes('control')),
    'aceptó un delta que omite un campo que sí cambió');

  const origenFalso = loopMap();
  origenFalso.delta[0].from = 'algo que current nunca dijo';
  assert.ok(validateLoopMap(origenFalso).some((v) => v.includes('from')),
    'aceptó un delta cuyo from no es lo que dice current');

  const destinoFalso = loopMap();
  destinoFalso.delta[0].to = 'algo que target nunca dijo';
  assert.ok(validateLoopMap(destinoFalso).some((v) => v.includes('to')),
    'aceptó un delta cuyo to no es lo que dice target');

  const campoInventado = loopMap();
  campoInventado.delta.push({ field: 'karma', from: 'a', to: 'b', why: 'un campo que el bucle no tiene' });
  assert.ok(validateLoopMap(campoInventado).some((v) => v.includes('karma')));

  const sinMotivo = loopMap();
  sinMotivo.delta[0].why = '';
  assert.ok(validateLoopMap(sinMotivo).some((v) => v.includes('why')), 'un cambio sin motivo no es un delta, es una diferencia');

  const deltaVacio = loopMap();
  deltaVacio.delta = [];
  assert.ok(validateLoopMap(deltaVacio).length > 0, 'target difiere de current: el delta no puede estar vacío');
});

test('FALSIFICACIÓN · el primer bucle declara cómo se deshace y cómo se sabe que falló', () => {
  // Un bucle sin rollback es un cambio de una sola dirección, y uno sin señales de fallo se abandona
  // en silencio: nadie puede decir cuándo dejó de servir.
  const sinRollback = loopMap();
  sinRollback.first_loop.rollback = '';
  assert.ok(validateLoopMap(sinRollback).some((v) => v.includes('rollback')));

  for (const valor of [[], 'una señal suelta', ['']]) {
    const documento = loopMap();
    documento.first_loop.failure_signals = valor;
    assert.ok(validateLoopMap(documento).length > 0, `aceptó failure_signals = ${JSON.stringify(valor)}`);
  }
});

test('FALSIFICACIÓN · el delta rechaza no ser lista, traer claves ajenas y repetir un campo', () => {
  // Encontradas midiendo: verify-vcp-coverage nombró estas tres ramas de validateDelta con línea.
  const noEsLista = loopMap();
  noEsLista.delta = 'measure y control cambiaron';
  assert.ok(validateLoopMap(noEsLista).some((v) => v.includes('delta debe ser una lista')));

  const clavesAjenas = loopMap();
  clavesAjenas.delta[0] = { field: 'measure', antes: 'x', despues: 'y' };
  assert.ok(validateLoopMap(clavesAjenas).some((v) => v.includes('field, from, to y why')));

  const repetido = loopMap();
  repetido.delta.push({ ...repetido.delta[0] });
  assert.ok(validateLoopMap(repetido).some((v) => v.includes('dos veces')),
    'declarar dos veces el mismo cambio deja un delta que no se corresponde uno a uno con las diferencias');
});

test('el PRD declara las secciones que el protocolo pide, no un subconjunto', () => {
  assert.deepEqual(validatePrd(prd()), []);
  const secciones = [
    'problem', 'users', 'jobs_to_be_done', 'outcome', 'non_goals', 'in_scope', 'out_scope',
    'capabilities', 'non_functional_requirements', 'security', 'privacy', 'observability',
    'integrations', 'data', 'architecture', 'technology', 'acceptance_criteria', 'metrics',
    'risks', 'rollout', 'rollback',
  ];
  assert.equal(secciones.length, 21, 'el PRD tiene veintiún secciones de contenido más schema, feature y date');
  for (const seccion of secciones) {
    const documento = prd();
    delete documento[seccion];
    assert.ok(validatePrd(documento).length > 0, `aceptó un PRD sin ${seccion}`);
  }
  const conExtra = prd();
  conExtra.seccion_inventada = 'algo';
  assert.ok(validatePrd(conExtra).length > 0, 'aceptó una sección que el PRD no declara');
});

test('FALSIFICACIÓN · un criterio de aceptación en prosa ya no alcanza', () => {
  // Antes exigía {id, statement}: un texto libre que dice que alguien pensó algo. Con evento,
  // precondición, acción, resultado observable, test y evidencia esperada, el criterio se puede
  // comprobar — y sobre todo, se puede ver cuál de las seis partes falta.
  const enProsa = prd();
  enProsa.acceptance_criteria = [{ id: 'AC1', statement: 'el gate tiene que andar bien' }];
  assert.ok(validatePrd(enProsa).length > 0, 'aceptó un criterio en prosa');

  for (const campo of ['event', 'precondition', 'action', 'observable_result', 'test', 'expected_evidence']) {
    const documento = prd();
    documento.acceptance_criteria = [criterio('AC1', { [campo]: '' })];
    assert.ok(validatePrd(documento).some((v) => v.includes(campo)), `aceptó un criterio sin ${campo}`);
  }

  const repetido = prd();
  repetido.acceptance_criteria = [criterio('AC1'), criterio('AC1')];
  assert.ok(validatePrd(repetido).some((v) => v.includes('AC1')), 'dos criterios con el mismo id no se distinguen después');

  const vacio = prd();
  vacio.acceptance_criteria = [];
  assert.ok(validatePrd(vacio).length > 0, 'un PRD sin un solo criterio no se puede aceptar ni rechazar');
});

test('FALSIFICACIÓN · las métricas y los requisitos no funcionales traen con qué medirse', () => {
  // Una métrica sin línea de base no dice si mejoró, y un requisito no funcional sin medida es un
  // deseo: "rápido" no se puede comprobar.
  for (const campo of ['id', 'name', 'baseline', 'target']) {
    const documento = prd();
    documento.metrics = [{ id: 'M1', name: 'n', baseline: 'b', target: 't', [campo]: '' }];
    assert.ok(validatePrd(documento).length > 0, `aceptó una métrica sin ${campo}`);
  }
  const sinMetricas = prd();
  sinMetricas.metrics = [];
  assert.ok(validatePrd(sinMetricas).length > 0, 'un PRD sin métricas no declara cómo se va a saber si sirvió');

  for (const campo of ['id', 'description', 'measure']) {
    const documento = prd();
    documento.non_functional_requirements = [{ id: 'NFR1', description: 'd', measure: 'm', [campo]: '' }];
    assert.ok(validatePrd(documento).length > 0, `aceptó un requisito no funcional sin ${campo}`);
  }
});

test('FALSIFICACIÓN · las secciones de texto y de lista rechazan el vacío por separado', () => {
  for (const campo of ['security', 'privacy', 'observability', 'data', 'architecture', 'rollout', 'rollback']) {
    const documento = prd();
    documento[campo] = '';
    assert.ok(validatePrd(documento).some((v) => v.includes(campo)), `aceptó ${campo} vacío`);
  }
  for (const campo of ['jobs_to_be_done', 'non_goals', 'integrations']) {
    const vacia = prd();
    vacia[campo] = [];
    assert.ok(validatePrd(vacia).some((v) => v.includes(campo)), `aceptó ${campo} sin una sola entrada`);
    const noEsLista = prd();
    noEsLista[campo] = 'una sola cosa suelta';
    assert.ok(validatePrd(noEsLista).some((v) => v.includes(campo)), `aceptó ${campo} que no es una lista`);
  }
});

test('FALSIFICACIÓN · métricas y requisitos no funcionales rechazan claves ajenas e ids repetidos', () => {
  // Las nombró la cobertura: verify-product-diagnostics.mjs:349 y :351, las dos en la lista
  // identificada que comparten metrics y non_functional_requirements.
  const clavesAjenas = prd();
  clavesAjenas.metrics = [{ id: 'M1', nombre: 'con la clave en castellano', baseline: 'b', target: 't' }];
  assert.ok(validatePrd(clavesAjenas).some((v) => v.includes('id, name, baseline, target')));

  const idRepetido = prd();
  idRepetido.metrics = [
    { id: 'M1', name: 'una', baseline: 'b', target: 't' },
    { id: 'M1', name: 'otra', baseline: 'b', target: 't' },
  ];
  assert.ok(validatePrd(idRepetido).some((v) => v.includes('repite el id M1')),
    'dos métricas con el mismo id no se pueden seguir por separado');

  const idInvalido = prd();
  idInvalido.non_functional_requirements = [{ id: 'no vale', description: 'd', measure: 'm' }];
  assert.ok(validatePrd(idInvalido).some((v) => v.includes('no es válido')));

  const clavesAjenasNfr = prd();
  clavesAjenasNfr.non_functional_requirements = [{ id: 'NFR1', description: 'd', medida: 'm' }];
  assert.ok(validatePrd(clavesAjenasNfr).some((v) => v.includes('id, description, measure')));
});

test('la adopción declara quién lo sostiene, quién lo ejecuta, con qué se mide y qué hay que hacer', () => {
  assert.deepEqual(validateAdoption(adoption()), []);
  // El encargo pide owner interno Y responsable operativo: son dos personas distintas y confundirlas
  // es cómo un cambio queda sin nadie que lo haga todos los días.
  for (const campo of ['owner', 'operational_owner', 'workflow_change', 'training', 'success_signal', 'review_cadence', 'fallback']) {
    const documento = adoption();
    documento[campo] = '';
    assert.ok(validateAdoption(documento).some((v) => v.includes(campo)), `aceptó ${campo} vacío`);
    const sin = adoption();
    delete sin[campo];
    assert.ok(validateAdoption(sin).length > 0, `aceptó un plan de adopción sin ${campo}`);
  }
});

test('FALSIFICACIÓN · el checklist de adopción y su métrica rechazan el vacío y la forma', () => {
  // Una señal de uso es cualitativa: dice que se usa. La métrica dice cuánto, desde dónde y hasta
  // dónde. Sin línea de base no se puede afirmar que la adopción mejoró.
  const sinChecklist = adoption();
  sinChecklist.adoption_checklist = [];
  assert.ok(validateAdoption(sinChecklist).some((v) => v.includes('adoption_checklist')));

  const clavesAjenas = adoption();
  clavesAjenas.adoption_checklist = [{ id: 'CHK1', tarea: 'en castellano' }];
  assert.ok(validateAdoption(clavesAjenas).some((v) => v.includes('id, item')));

  const repetido = adoption();
  repetido.adoption_checklist = [{ id: 'CHK1', item: 'una' }, { id: 'CHK1', item: 'otra' }];
  assert.ok(validateAdoption(repetido).some((v) => v.includes('repite el id CHK1')));

  for (const campo of ['name', 'baseline', 'target']) {
    const documento = adoption();
    documento.adoption_metric = { name: 'n', baseline: 'b', target: 't', [campo]: '' };
    assert.ok(validateAdoption(documento).some((v) => v.includes(campo)), `aceptó una métrica de adopción sin ${campo}`);
  }
  const metricaAjena = adoption();
  metricaAjena.adoption_metric = { name: 'n', baseline: 'b' };
  assert.ok(validateAdoption(metricaAjena).some((v) => v.includes('name, baseline y target')));
});

test('FALSIFICACIÓN · la recurrencia declara cuándo se promueve una mejora y cuándo se retira', () => {
  // Sin criterio de retiro, una mejora que dejó de servir se sostiene por inercia: nadie tiene con
  // qué argumentar que hay que sacarla.
  assert.deepEqual(validateRecurrence(recurrence()), []);
  for (const campo of ['promotion_criteria', 'retirement_criteria']) {
    const vacio = recurrence();
    vacio[campo] = '';
    assert.ok(validateRecurrence(vacio).some((v) => v.includes(campo)), `aceptó ${campo} vacío`);
    const sin = recurrence();
    delete sin[campo];
    assert.ok(validateRecurrence(sin).length > 0, `aceptó una recurrencia sin ${campo}`);
  }
});
