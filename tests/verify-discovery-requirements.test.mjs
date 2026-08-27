import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-discovery-requirements.mjs');
const {
  BASE_68_REQ_IDS, EXPECTED_PHASE_PLAN, EXPECTED_REQ_BY_PHASE, PHASE_ORDER,
  assertPhaseClosed, assertReplacementTopology, createCheckRegistry, createPreviousPhasesChecker, main, parseArgs,
  readPreviousInventory, resolveRequirement, runSelfTest, docsContract, validateInventory, validateLifecycle, validatePhasePlan,
} = await import(pathToFileURL(script).href);

const inventoryPath = join(repoRoot, 'contracts', 'discovery-requirements.json');
const planPath = join(repoRoot, 'contracts', 'discovery-phase-plan.json');

function readInventory() {
  return JSON.parse(readFileSync(inventoryPath, 'utf8'));
}

// I0 is a historical, self-contained contract: its tests must keep proving the
// original all-planned baseline after later phases legitimately activate rows.
// Never derive that baseline from the mutable current inventory state.
function plannedInventory() {
  const inventory = readInventory();
  inventory.requirements = inventory.requirements.map((row) => ({
    ...row,
    status: 'planned',
    implemented_phase: null,
    superseded_by: null,
    test_ref: null,
    test_name: null,
  }));
  return inventory;
}

function readPlan() {
  return JSON.parse(readFileSync(planPath, 'utf8'));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`);
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
}

function binding(row) {
  return row.status === 'active' ? { ok: true } : { ok: false, code: 'DISCOVERY_TEST_BINDING_MISSING' };
}

function registry(ok = true) {
  return Object.fromEntries(Object.values(EXPECTED_PHASE_PLAN)
    .flatMap((checks) => Object.values(checks))
    .map((id) => [id, () => ok]));
}

function active(row) {
  return {
    ...row,
    status: 'active',
    implemented_phase: row.target_phase,
    test_ref: 'tests/placeholder.test.mjs',
    test_name: `${row.req_id} · evidencia verde`,
  };
}

function nonBase(id, phase = 'I1') {
  return {
    req_id: id, status: 'planned', target_phase: phase, implemented_phase: null,
    decision_ref: `decision/${id}`, superseded_by: null, test_ref: null, test_name: null, rule: 'future requirement',
  };
}

test('I0 baseline and el inventario actual preservan los 68 requisitos base y el plan canónico', () => {
  const inventory = plannedInventory();
  assert.equal(BASE_68_REQ_IDS.length, 68);
  assert.deepEqual(Object.fromEntries(Object.entries(EXPECTED_REQ_BY_PHASE).map(([phase, ids]) => [phase, ids.length])), {
    I0: 0, I1: 53, 'I1.5': 6, I2: 9, I3: 0,
  });
  assert.deepEqual(PHASE_ORDER, ['I0', 'I1', 'I1.5', 'I2', 'I3']);
  assert.deepEqual(validateInventory(inventory), { ok: true });
  assert.deepEqual(validateInventory(readInventory()), { ok: true });
  assert.deepEqual(validatePhasePlan(readPlan()), { ok: true });
});

test('FALSIFICACIÓN · inventory rejects duplicate/missing/misphased/base-rejected and malformed planned rows', () => {
  const inventory = plannedInventory();
  const duplicate = copy(inventory);
  duplicate.requirements.push(copy(duplicate.requirements[0]));
  expectCode(() => validateInventory(duplicate), 'DISCOVERY_REQUIREMENT_ID_DUPLICATE');

  const missing = copy(inventory);
  missing.requirements = missing.requirements.slice(1);
  expectCode(() => validateInventory(missing), 'DISCOVERY_REQUIREMENT_ID_MISSING');

  const wrongPhase = copy(inventory);
  wrongPhase.requirements.find((row) => row.req_id === 'REQ-A01').target_phase = 'I0';
  expectCode(() => validateInventory(wrongPhase), 'DISCOVERY_PHASE_ASSIGNMENT_INVALID');

  const extraBaseShape = copy(inventory);
  extraBaseShape.requirements.push({ ...nonBase('REQ-A99'), target_phase: 'I1' });
  expectCode(() => validateInventory(extraBaseShape), 'DISCOVERY_PHASE_COUNT_MISMATCH');

  const rejectedBase = copy(inventory);
  rejectedBase.requirements[0].status = 'rejected';
  expectCode(() => validateInventory(rejectedBase), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');

  const malformed = copy(inventory);
  malformed.requirements[0].test_ref = 'tests/not-allowed-yet.test.mjs';
  expectCode(() => validateInventory(malformed), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');

  const unknownField = copy(inventory);
  unknownField.requirements[0].unreviewed_claim = 'not part of the schema';
  expectCode(() => validateInventory(unknownField), 'DISCOVERY_REQUIREMENT_SCHEMA_INVALID');

  const omittedField = copy(inventory);
  delete omittedField.requirements[0].test_ref;
  expectCode(() => validateInventory(omittedField), 'DISCOVERY_REQUIREMENT_SCHEMA_INVALID');

  const malformedActive = copy(inventory);
  malformedActive.requirements[0].status = 'active';
  malformedActive.requirements[0].implemented_phase = 'I1';
  expectCode(() => validateInventory(malformedActive), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
});

test('FALSIFICACIÓN · phase plan is exact, ordered and closed over the registry ids', () => {
  const plan = readPlan();
  const missing = copy(plan);
  missing.phases.pop();
  expectCode(() => validatePhasePlan(missing), 'DISCOVERY_PHASE_PLAN_MISMATCH');

  const duplicate = copy(plan);
  duplicate.phases.splice(1, 0, copy(duplicate.phases[0]));
  expectCode(() => validatePhasePlan(duplicate), 'DISCOVERY_PHASE_PLAN_MISMATCH');

  const missingPrereq = copy(plan);
  missingPrereq.phases[0].prerequisites.pop();
  expectCode(() => validatePhasePlan(missingPrereq), 'DISCOVERY_PHASE_PREREQ_MISSING');

  const unknown = copy(plan);
  unknown.phases[0].prerequisites[0].check_id = 'run_shell_command';
  expectCode(() => validatePhasePlan(unknown), 'DISCOVERY_PHASE_CHECK_UNKNOWN');
});

test('I0 closes only when its live prereqs pass; I1 remains incomplete while its 53 base requirements are planned', () => {
  const context = { inventory: plannedInventory(), plan: readPlan(), registry: registry(), checkBinding: binding };
  assert.deepEqual(assertPhaseClosed('I0', context), { ok: true });
  expectCode(() => assertPhaseClosed('I1', context), 'DISCOVERY_PHASE_INCOMPLETE');
  expectCode(() => assertPhaseClosed('unknown', context), 'DISCOVERY_PHASE_UNKNOWN');
  expectCode(() => assertPhaseClosed('I0', { ...context, registry: registry(false) }), 'DISCOVERY_PHASE_PREREQ_FAILED');
});

test('FALSIFICACIÓN · lifecycle permits only staged, phase-safe transitions and detects replacement topology loss', () => {
  const previous = plannedInventory();
  const plannedToActive = copy(previous);
  const target = plannedToActive.requirements.find((row) => row.req_id === 'REQ-A01');
  target.status = 'active';
  target.implemented_phase = 'I1';
  target.test_ref = 'tests/placeholder.test.mjs';
  target.test_name = 'REQ-A01 · verde';
  expectCode(() => validateLifecycle(previous, plannedToActive, { assertPreviousPhases: () => false, checkBinding: binding }), 'DISCOVERY_REQUIREMENT_ACTIVATED_TOO_EARLY');
  assert.deepEqual(validateLifecycle(previous, plannedToActive, { assertPreviousPhases: () => true, checkBinding: binding }), { ok: true });

  const directActive = copy(previous);
  directActive.requirements.push({ ...copy(previous.requirements[0]), req_id: 'R-001', status: 'active', implemented_phase: 'I1', test_ref: 'tests/x.mjs', test_name: 'R-001 · no permitido' });
  expectCode(() => validateLifecycle(previous, directActive, { assertPreviousPhases: () => true, checkBinding: binding }), 'DISCOVERY_REQUIREMENT_INITIAL_STATUS_INVALID');

  const baseToBase = copy(previous);
  baseToBase.requirements[0] = { ...baseToBase.requirements[0], status: 'replaced', implemented_phase: 'I1', superseded_by: 'REQ-B01', test_ref: 'tests/x.mjs', test_name: 'REQ-A01 · viejo' };
  expectCode(() => validateInventory(baseToBase), 'DISCOVERY_REQUIREMENT_REPLACEMENT_BASE_TARGET');

  const merge = copy(previous);
  for (const id of ['REQ-A01', 'REQ-A02']) {
    const row = merge.requirements.find((candidate) => candidate.req_id === id);
    Object.assign(row, { status: 'replaced', implemented_phase: 'I1', superseded_by: 'R-001', test_ref: 'tests/x.mjs', test_name: `${id} · viejo` });
  }
  merge.requirements.push({ req_id: 'R-001', status: 'active', target_phase: 'I1', implemented_phase: 'I1', decision_ref: 'decision/R-001', superseded_by: null, test_ref: 'tests/x.mjs', test_name: 'R-001 · verde', rule: 'successor' });
  expectCode(() => validateInventory(merge), 'DISCOVERY_REQUIREMENT_REPLACEMENT_MERGE');
});

test('createPreviousPhasesChecker ejecuta un prerequisito por fase una sola vez y memoriza éxito o fallo', () => {
  let calls = 0;
  const checker = createPreviousPhasesChecker({}, () => { calls += 1; });
  assert.equal(checker('I0'), true);
  assert.equal(checker('I1'), true);
  assert.equal(checker('I1'), true);
  assert.equal(calls, 1);
  const failing = createPreviousPhasesChecker({}, () => { throw new Error('red'); });
  assert.equal(failing('I1'), false);
  assert.equal(failing('I1'), false);
});

test('resolveRequirement detects missing/cyclic/unresolved replacements and accepts a linear active successor', () => {
  const active = { req_id: 'R-002', status: 'active', target_phase: 'I1', implemented_phase: 'I1', decision_ref: 'd', superseded_by: null, test_ref: 'tests/x.mjs', test_name: 'R-002 · green', rule: 'rule' };
  const replaced = { ...active, req_id: 'R-001', status: 'replaced', superseded_by: 'R-002' };
  assert.equal(resolveRequirement('R-001', new Map([['R-001', replaced], ['R-002', active]]), { checkBinding: binding }).req_id, 'R-002');
  expectCode(() => resolveRequirement('missing', new Map(), { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_REPLACEMENT_MISSING');
  expectCode(() => resolveRequirement('R-001', new Map([['R-001', { ...replaced, superseded_by: 'R-001' }]]), { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_REPLACEMENT_CYCLE');
  expectCode(() => resolveRequirement('R-001', new Map([['R-001', { ...replaced, superseded_by: 'R-002' }], ['R-002', { ...active, status: 'planned', implemented_phase: null, test_ref: null, test_name: null }]]), { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_REPLACEMENT_UNRESOLVED');
});

test('FALSIFICACIÓN · schema and row-shape validators reject unknown statuses, paths and replacement references', () => {
  expectCode(() => validateInventory(null), 'DISCOVERY_REQUIREMENT_SCHEMA_INVALID');
  const malformedId = plannedInventory();
  malformedId.requirements[0] = null;
  expectCode(() => validateInventory(malformedId), 'DISCOVERY_REQUIREMENT_ID_INVALID');

  const unknownStatus = plannedInventory();
  unknownStatus.requirements[0].status = 'done';
  expectCode(() => validateInventory(unknownStatus), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');

  const missingPhase = plannedInventory();
  missingPhase.requirements[0].target_phase = '';
  expectCode(() => validateInventory(missingPhase), 'DISCOVERY_PHASE_ASSIGNMENT_MISSING');

  const unknownPhase = plannedInventory();
  unknownPhase.requirements[0].target_phase = 'I9';
  expectCode(() => validateInventory(unknownPhase), 'DISCOVERY_PHASE_ASSIGNMENT_INVALID');

  const missingMetadata = plannedInventory();
  missingMetadata.requirements[0].rule = '';
  expectCode(() => validateInventory(missingMetadata), 'DISCOVERY_REQUIREMENT_SCHEMA_INVALID');

  const missingSuccessor = plannedInventory();
  Object.assign(missingSuccessor.requirements[0], active(missingSuccessor.requirements[0]), { status: 'replaced', superseded_by: 'R-missing' });
  expectCode(() => validateInventory(missingSuccessor), 'DISCOVERY_REQUIREMENT_REPLACEMENT_MISSING');
});

test('FALSIFICACIÓN · phase plan rejects malformed, unknown, duplicate and shifted prerequisite structure', () => {
  expectCode(() => validatePhasePlan({}), 'DISCOVERY_PHASE_PLAN_SCHEMA_INVALID');
  const malformed = copy(readPlan());
  malformed.phases[0].prerequisites = [{}];
  expectCode(() => validatePhasePlan(malformed), 'DISCOVERY_PHASE_PLAN_SCHEMA_INVALID');
  const malformedPhase = copy(readPlan());
  malformedPhase.phases[0] = null;
  expectCode(() => validatePhasePlan(malformedPhase), 'DISCOVERY_PHASE_PLAN_SCHEMA_INVALID');
  const unknownPhase = copy(readPlan());
  unknownPhase.phases[0].phase_id = 'I9';
  expectCode(() => validatePhasePlan(unknownPhase), 'DISCOVERY_PHASE_UNKNOWN');
  const duplicatePrereq = copy(readPlan());
  duplicatePrereq.phases[0].prerequisites.push(copy(duplicatePrereq.phases[0].prerequisites[0]));
  expectCode(() => validatePhasePlan(duplicatePrereq), 'DISCOVERY_PHASE_PREREQ_DUPLICATE');
  const wrongCheck = copy(readPlan());
  wrongCheck.phases[0].prerequisites[0].check_id = 'test_bindings_selftest';
  expectCode(() => validatePhasePlan(wrongCheck), 'DISCOVERY_PHASE_PLAN_MISMATCH');
  const extra = copy(readPlan());
  extra.phases[1].prerequisites.push({ prereq_id: 'INF-I1-99', check_id: 'discovery_core_contract' });
  expectCode(() => validatePhasePlan(extra), 'DISCOVERY_PHASE_PLAN_MISMATCH');
});

test('all phases close only with all active requirements, live bindings and a complete closed registry', () => {
  const inventory = plannedInventory();
  inventory.requirements = inventory.requirements.map(active);
  const context = { inventory, plan: readPlan(), registry: registry(), checkBinding: binding };
  assert.deepEqual(assertPhaseClosed('I2', context), { ok: true });
  expectCode(() => assertPhaseClosed('I0', { ...context, registry: {} }), 'DISCOVERY_PHASE_CHECK_UNKNOWN');
  expectCode(() => assertPhaseClosed('I0', { ...context, registry: { ...registry(), inventory_verifier_selftest: () => { throw new Error('boom'); } } }), 'DISCOVERY_PHASE_PREREQ_FAILED');
  expectCode(() => assertPhaseClosed('I1', { ...context, checkBinding: () => ({ ok: false, code: 'DISCOVERY_TEST_BINDING_FAILED', message: 'red' }) }), 'DISCOVERY_TEST_BINDING_FAILED');
});

test('FALSIFICACIÓN · lifecycle rejects removals, terminal edits, unsafe active mutations and invalid status edges', () => {
  const baseline = plannedInventory();
  const removed = copy(baseline);
  removed.requirements.pop();
  expectCode(() => validateLifecycle(baseline, removed), 'DISCOVERY_REQUIREMENT_REMOVED');

  const priorActive = copy(baseline);
  priorActive.requirements[0] = active(priorActive.requirements[0]);
  const phaseChanged = copy(priorActive);
  phaseChanged.requirements[0].target_phase = 'I2';
  phaseChanged.requirements[0].implemented_phase = 'I2';
  expectCode(() => validateLifecycle(priorActive, phaseChanged, { checkBinding: binding }), 'DISCOVERY_PHASE_ASSIGNMENT_INVALID');
  const changedWithoutDecision = copy(priorActive);
  changedWithoutDecision.requirements[0].rule = 'changed';
  expectCode(() => validateLifecycle(priorActive, changedWithoutDecision, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_ACTIVE_MUTATED');
  const changedWithDecision = copy(priorActive);
  changedWithDecision.requirements[0].rule = 'changed';
  changedWithDecision.requirements[0].decision_ref = 'decision/new';
  assert.deepEqual(validateLifecycle(priorActive, changedWithDecision, { checkBinding: binding }), { ok: true });

  const terminalPrior = copy(baseline);
  terminalPrior.requirements.push({ ...active(nonBase('R-001')), status: 'replaced', superseded_by: 'R-002' });
  terminalPrior.requirements.push(active(nonBase('R-002')));
  const terminalChanged = copy(terminalPrior);
  terminalChanged.requirements.find((row) => row.req_id === 'R-001').rule = 'mutated';
  expectCode(() => validateLifecycle(terminalPrior, terminalChanged, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
  assert.deepEqual(validateLifecycle(terminalPrior, copy(terminalPrior), { checkBinding: binding }), { ok: true });

  const activeNonBase = copy(baseline);
  activeNonBase.requirements.push(active(nonBase('R-009')));
  const changedActiveNonBase = copy(activeNonBase);
  changedActiveNonBase.requirements.at(-1).target_phase = 'I2';
  changedActiveNonBase.requirements.at(-1).implemented_phase = 'I2';
  expectCode(() => validateLifecycle(activeNonBase, changedActiveNonBase, { checkBinding: binding }), 'DISCOVERY_PHASE_ASSIGNMENT_INVALID');

  const directReplacement = copy(baseline);
  directReplacement.requirements.push({ ...active(nonBase('R-001')), status: 'replaced', superseded_by: 'R-002' }, active(nonBase('R-002')));
  expectCode(() => validateLifecycle({ ...baseline, requirements: [...baseline.requirements, nonBase('R-001'), active(nonBase('R-002'))] }, directReplacement, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
  assert.deepEqual(validateLifecycle(null, baseline, { checkBinding: binding }), { ok: true });
});

test('lifecycle accepts three-stage replacement and non-base rejection, but rejects regressing/replacing across phases', () => {
  const baseline = plannedInventory();
  const activeBaseline = copy(baseline);
  activeBaseline.requirements[0] = active(activeBaseline.requirements[0]);
  const stageOne = copy(activeBaseline);
  stageOne.requirements.push(nonBase('R-001'));
  assert.deepEqual(validateLifecycle(activeBaseline, stageOne, { assertPreviousPhases: () => true, checkBinding: binding }), { ok: true });
  const stageTwo = copy(stageOne);
  stageTwo.requirements.find((row) => row.req_id === 'R-001');
  stageTwo.requirements[stageTwo.requirements.length - 1] = active(stageTwo.requirements.at(-1));
  assert.deepEqual(validateLifecycle(stageOne, stageTwo, { assertPreviousPhases: () => true, checkBinding: binding }), { ok: true });
  const stageThree = copy(stageTwo);
  const base = stageThree.requirements.find((row) => row.req_id === 'REQ-A01');
  Object.assign(base, active(base), { status: 'replaced', superseded_by: 'R-001' });
  assert.deepEqual(validateLifecycle(stageTwo, stageThree, { assertPreviousPhases: () => true, checkBinding: binding }), { ok: true });

  const nonbaseBefore = copy(baseline);
  nonbaseBefore.requirements.push(nonBase('R-001'));
  const rejected = copy(nonbaseBefore);
  Object.assign(rejected.requirements.at(-1), { status: 'rejected', decision_ref: 'decision/rejected' });
  assert.deepEqual(validateLifecycle(nonbaseBefore, rejected, { checkBinding: binding }), { ok: true });
  const plannedRejectWithoutDecision = copy(nonbaseBefore);
  Object.assign(plannedRejectWithoutDecision.requirements.at(-1), { status: 'rejected' });
  expectCode(() => validateLifecycle(nonbaseBefore, plannedRejectWithoutDecision, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
  const activeNonbase = copy(nonbaseBefore);
  activeNonbase.requirements[activeNonbase.requirements.length - 1] = active(activeNonbase.requirements.at(-1));
  const regress = copy(activeNonbase);
  Object.assign(regress.requirements.at(-1), nonBase('R-001'));
  expectCode(() => validateLifecycle(activeNonbase, regress, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_REGRESSION');

  const rejectActive = copy(activeNonbase);
  Object.assign(rejectActive.requirements.at(-1), { status: 'rejected', decision_ref: 'decision/active-rejected' });
  assert.deepEqual(validateLifecycle(activeNonbase, rejectActive, { checkBinding: binding }), { ok: true });
  const rejectWithoutDecision = copy(activeNonbase);
  Object.assign(rejectWithoutDecision.requirements.at(-1), { status: 'rejected' });
  expectCode(() => validateLifecycle(activeNonbase, rejectWithoutDecision, { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');

  const mismatch = copy(stageThree);
  mismatch.requirements.find((row) => row.req_id === 'R-001').target_phase = 'I2';
  mismatch.requirements.find((row) => row.req_id === 'R-001').implemented_phase = 'I2';
  expectCode(() => validateInventory(mismatch), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
});

test('CLI parser, main and registry use only fixed checks and reject Git ref failures', () => {
  assert.deepEqual(parseArgs(['check']), { completedPhase: null, diffAgainst: null });
  assert.deepEqual(parseArgs(['check', '--completed-phase', 'I0', '--diff-against', 'HEAD']), { completedPhase: 'I0', diffAgainst: 'HEAD' });
  assert.deepEqual(parseArgs(['check', '--diff-against', 'HEAD']), { completedPhase: null, diffAgainst: 'HEAD' });
  assert.equal(parseArgs(['wrong']), null);
  assert.equal(parseArgs(['check', '--unknown', 'value']), null);
  assert.equal(parseArgs(['check', '--completed-phase']), null);
  assert.equal(parseArgs(['check', '--completed-phase', 'I0', '--completed-phase', 'I1']), null);
  assert.equal(parseArgs(['check', '--diff-against', 'HEAD', '--diff-against', 'HEAD']), null);
  const errors = [];
  assert.equal(main([], repoRoot, {}, () => {}, (line) => errors.push(line)), 2);
  assert.equal(main(['check'], repoRoot, {}, () => {}, (line) => errors.push(line)), 0);
  assert.equal(main(['check', '--completed-phase', 'I0'], repoRoot, { registry: registry(), checkBinding: binding }, () => {}, (line) => errors.push(line)), 0);
  assert.equal(main(['check', '--diff-against', 'not-a-ref'], repoRoot, {}, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /DISCOVERY_DIFF_REF_INVALID/u);
  const activeI1 = plannedInventory();
  activeI1.requirements = activeI1.requirements.map((row) => row.target_phase === 'I1' ? active(row) : row);
  assert.equal(main(['check', '--completed-phase', 'I1'], repoRoot, {
    readInventory: () => activeI1,
    readPlan,
    checkBinding: binding,
  }, () => {}, (line) => errors.push(line)), 0);
  const copiedRuntimeProject = mkdtempSync(join(tmpdir(), 'vcp-discovery-runtime-diff-'));
  try {
    assert.equal(main(['check', '--diff-against', 'HEAD'], copiedRuntimeProject, { runtimeRoot: repoRoot }, () => {}, (line) => errors.push(line)), 1);
    assert.match(errors.at(-1), /DISCOVERY_DIFF_RUNTIME_UNTRACKED/u);
    expectCode(() => readPreviousInventory(repoRoot, 'HEAD', join(copiedRuntimeProject, 'missing-runtime')), 'DISCOVERY_DIFF_RUNTIME_UNTRACKED');
  } finally {
    rmSync(copiedRuntimeProject, { recursive: true, force: true });
  }
  const sourceWithoutInventory = mkdtempSync(join(tmpdir(), 'vcp-discovery-empty-history-'));
  try {
    git(sourceWithoutInventory, ['init', '--quiet']);
    git(sourceWithoutInventory, ['config', 'user.email', 'tests@example.test']);
    git(sourceWithoutInventory, ['config', 'user.name', 'VCP tests']);
    writeFileSync(join(sourceWithoutInventory, 'README.md'), 'no inventory in this historical commit\n');
    git(sourceWithoutInventory, ['add', 'README.md']);
    git(sourceWithoutInventory, ['commit', '--quiet', '-m', 'fixture']);
    assert.deepEqual(readPreviousInventory(sourceWithoutInventory, 'HEAD', sourceWithoutInventory), {
      schema: 'vcp.discovery-requirements/1', requirements: [],
    });
  } finally {
    rmSync(sourceWithoutInventory, { recursive: true, force: true });
  }
  const closed = createCheckRegistry(repoRoot, readInventory());
  assert.equal(typeof closed.inventory_verifier_selftest, 'function');
  assert.equal(closed.discovery_core_contract(), true);
  assert.equal(closed.discovery_views_contract(), true);
  const selfTests = [];
  const injectedRegistry = createCheckRegistry(repoRoot, readInventory(), {
    selfTest: (testRef) => { selfTests.push(testRef); return true; },
    docsCheck: () => true,
    bindingsCheck: () => ({ ok: true }),
  });
  assert.equal(injectedRegistry.inventory_verifier_selftest(), true);
  assert.equal(injectedRegistry.test_bindings_selftest(), true);
  assert.equal(injectedRegistry.discovery_docs_contract(), true);
  assert.deepEqual(selfTests, ['tests/verify-discovery-requirements-selftest.mjs', 'tests/verify-test-bindings.test.mjs']);
  const inventoryWithActiveCore = copy(readInventory());
  inventoryWithActiveCore.requirements[0] = active(inventoryWithActiveCore.requirements[0]);
  const coreRows = [];
  const coreRegistry = createCheckRegistry(repoRoot, inventoryWithActiveCore, {
    bindingsCheck: (rows) => { coreRows.push(...rows); return { ok: true }; },
  });
  assert.equal(coreRegistry.discovery_core_contract(), true);
  assert.deepEqual(coreRows.map((row) => row.req_id), EXPECTED_REQ_BY_PHASE.I1);

  const activation = plannedInventory();
  activation.requirements[0] = active(activation.requirements[0]);
  assert.equal(main(['check', '--diff-against', 'HEAD'], repoRoot, {
    readInventory: () => activation,
    readPlan,
    readPreviousInventory: readInventory,
    registry: { ...registry(), inventory_verifier_selftest: () => false },
    checkBinding: binding,
  }, () => {}, () => {}), 1);
  assert.equal(main(['check'], repoRoot, { readInventory: () => { throw new Error('untyped failure'); } }, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /DISCOVERY_REQUIREMENT_SCHEMA_INVALID/u);

  const i0Previous = plannedInventory();
  i0Previous.requirements.push(nonBase('R-I0', 'I0'));
  const i0Current = copy(i0Previous);
  i0Current.requirements[i0Current.requirements.length - 1] = active(i0Current.requirements.at(-1));
  assert.equal(main(['check', '--diff-against', 'HEAD'], repoRoot, {
    readInventory: () => i0Current,
    readPlan,
    readPreviousInventory: () => i0Previous,
    registry: registry(),
    checkBinding: binding,
  }, () => {}, () => {}), 0);
});

test('FALSIFICACIÓN · replacement resolution rejects phase drift, failed bindings and malformed terminal states', () => {
  const activeRow = active(nonBase('R-002'));
  const replacedRow = { ...active(nonBase('R-001')), status: 'replaced', superseded_by: 'R-002' };
  expectCode(() => resolveRequirement('R-001', new Map([['R-001', replacedRow], ['R-002', { ...activeRow, target_phase: 'I2', implemented_phase: 'I2' }]]), { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
  expectCode(() => resolveRequirement('R-002', new Map([['R-002', activeRow]]), { checkBinding: () => ({ ok: false, code: 'DISCOVERY_TEST_BINDING_FAILED', message: 'red' }) }), 'DISCOVERY_TEST_BINDING_FAILED');
  expectCode(() => resolveRequirement('R-002', new Map([['R-002', activeRow]]), { checkBinding: () => ({}) }), 'DISCOVERY_TEST_BINDING_FAILED');
  expectCode(() => resolveRequirement('R-002', new Map([['R-002', activeRow]]), {}), 'DISCOVERY_TEST_BINDING_STATIC_INVALID');
  expectCode(() => resolveRequirement('R-001', new Map([['R-001', { ...replacedRow, superseded_by: '' }]]), { checkBinding: binding }), 'DISCOVERY_REQUIREMENT_REPLACEMENT_UNRESOLVED');
  const invalidReplaced = plannedInventory();
  invalidReplaced.requirements.push({ ...nonBase('R-001'), status: 'replaced' });
  expectCode(() => validateInventory(invalidReplaced), 'DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID');
  const invalidRejected = plannedInventory();
  invalidRejected.requirements.push({ ...nonBase('R-001'), status: 'rejected', implemented_phase: 'I0' });
  expectCode(() => validateInventory(invalidRejected), 'DISCOVERY_PHASE_ASSIGNMENT_INVALID');
  assert.doesNotThrow(() => assertReplacementTopology(plannedInventory().requirements));
});

test('phase registry exercises selftests, docs contract and live diff activation using only injected fixed checks', () => {
  const real = createCheckRegistry(repoRoot, readInventory());
  assert.equal(runSelfTest('tests/verify-test-bindings.test.mjs', repoRoot), true);
  assert.equal(typeof real.inventory_verifier_selftest, 'function');
  assert.equal(typeof real.test_bindings_selftest, 'function');
  assert.equal(real.discovery_docs_contract(), true);

  const docsRoot = mkdtempSync(join(tmpdir(), 'vcp-discovery-docs-'));
  try {
    mkdirSync(join(docsRoot, 'templates'));
    writeFileSync(join(docsRoot, 'SKILL.md'), 'verify-discovery-requirements.mjs\n');
    writeFileSync(join(docsRoot, 'README.md'), 'Discovery\n');
    writeFileSync(join(docsRoot, 'templates', 'spec.md'), 'Discovery\n');
    assert.equal(docsContract(docsRoot), true);
  } finally {
    rmSync(docsRoot, { recursive: true, force: true });
  }
  // Use an injected registry for the diff activation; it stays closed over code-defined check IDs.
  const inventory = plannedInventory();
  const previous = copy(inventory);
  inventory.requirements[0] = active(inventory.requirements[0]);
  const messages = [];
  assert.equal(main(['check', '--diff-against', 'HEAD'], repoRoot, {
    readInventory: () => inventory,
    readPlan,
    readPreviousInventory: () => previous,
    registry: registry(),
    checkBinding: binding,
  }, (line) => messages.push(line), () => {}), 0);
  assert.match(messages.at(-1), /against HEAD/u);
  // The distributable runtime intentionally carries this self-test without a Git checkout. The
  // production source repository still exercises the real Git fallback; installed runtimes use
  // the injected-diff case above because no project history belongs to their copied contracts.
  if (existsSync(join(repoRoot, '.git'))) {
    assert.equal(main(['check', '--diff-against', 'HEAD'], repoRoot, {}, () => {}, () => {}), 0);
  }
});
