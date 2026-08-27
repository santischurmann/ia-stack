#!/usr/bin/env node
// Canonical lifecycle gate for the VCP Discovery requirement inventory. The JSON data declares
// requirements but never commands: all executable prereqs are selected from CHECK_REGISTRY below.
// This makes the gate reviewable and closed-world. It verifies structure, transitions and live
// test bindings; it cannot establish semantic equivalence between a replaced rule and successor.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkActiveBindings, checkTestBinding, createCachedBindingCheck } from './verify-test-bindings.mjs';

const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const PHASE_ORDER = Object.freeze(['I0', 'I1', 'I1.5', 'I2', 'I3']);
export const EXPECTED_PHASE_PLAN = Object.freeze({
  I0: Object.freeze({ 'INF-I0-01': 'inventory_verifier_selftest', 'INF-I0-02': 'test_bindings_selftest' }),
  I1: Object.freeze({ 'INF-I1-01': 'discovery_core_contract' }),
  'I1.5': Object.freeze({ 'INF-I15-01': 'discovery_views_contract' }),
  I2: Object.freeze({ 'INF-I2-01': 'discovery_docs_contract' }),
  I3: Object.freeze({}),
});

function range(prefix, end) {
  return Array.from({ length: end }, (_, index) => `REQ-${prefix}${String(index + 1).padStart(2, '0')}`);
}

export const EXPECTED_REQ_BY_PHASE = Object.freeze({
  I0: Object.freeze([]),
  I1: Object.freeze([...range('A', 16), ...range('B', 4), ...range('C', 4), ...range('D', 12), ...range('E', 6), ...range('G', 11)]),
  'I1.5': Object.freeze([...range('F', 3), ...range('H', 3)]),
  I2: Object.freeze(range('I', 9)),
  I3: Object.freeze([]),
});
export const BASE_68_REQ_IDS = Object.freeze(PHASE_ORDER.flatMap((phase) => EXPECTED_REQ_BY_PHASE[phase]));
const BASE_REQUIREMENT_IDS = new Set(BASE_68_REQ_IDS);
const VALID_STATUSES = new Set(['planned', 'active', 'replaced', 'rejected']);
const KNOWN_CHECK_IDS = new Set(Object.values(EXPECTED_PHASE_PLAN).flatMap((checks) => Object.values(checks)));
const INVENTORY_SCHEMA = 'vcp.discovery-requirements/1';
const PHASE_PLAN_SCHEMA = 'vcp.discovery-phase-plan/2';
const INVENTORY_KEYS = new Set(['schema', 'requirements']);
const REQUIREMENT_KEYS = new Set(['req_id', 'status', 'target_phase', 'implemented_phase', 'decision_ref', 'superseded_by', 'test_ref', 'test_name', 'rule']);
const PHASE_PLAN_KEYS = new Set(['schema', 'phases']);
const PHASE_KEYS = new Set(['phase_id', 'prerequisites']);
const PREREQUISITE_KEYS = new Set(['prereq_id', 'check_id']);
export const USAGE = 'usage: verify-discovery-requirements.mjs check [--completed-phase I0|I1|I1.5|I2|I3] [--diff-against <git-ref>]';

export class DiscoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function reject(code, message) {
  throw new DiscoveryError(code, message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasExactKeys(value, allowed) {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function requirementsOf(inventory) {
  if (!isObject(inventory) || !hasOnlyKeys(inventory, INVENTORY_KEYS) || inventory.schema !== INVENTORY_SCHEMA || !Array.isArray(inventory.requirements)) {
    reject('DISCOVERY_REQUIREMENT_SCHEMA_INVALID', `inventory must use ${INVENTORY_SCHEMA} with a requirements array`);
  }
  return inventory.requirements;
}

function indexRequirements(inventory) {
  const index = new Map();
  for (const row of requirementsOf(inventory)) {
    if (!isObject(row) || !nonEmpty(row.req_id)) reject('DISCOVERY_REQUIREMENT_ID_INVALID', 'every requirement needs a non-empty req_id');
    if (index.has(row.req_id)) reject('DISCOVERY_REQUIREMENT_ID_DUPLICATE', `duplicate req_id: ${row.req_id}`);
    index.set(row.req_id, row);
  }
  return index;
}

function expectedPhaseFor(reqId) {
  return PHASE_ORDER.find((phase) => EXPECTED_REQ_BY_PHASE[phase].includes(reqId)) ?? null;
}

function stableJson(row) {
  return JSON.stringify(Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]])));
}

function assertRowShape(row) {
  if (!hasExactKeys(row, REQUIREMENT_KEYS)) reject('DISCOVERY_REQUIREMENT_SCHEMA_INVALID', `${row.req_id}: requirement fields are incomplete or unknown`);
  if (!VALID_STATUSES.has(row.status)) reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: invalid status`);
  if (!nonEmpty(row.target_phase)) reject('DISCOVERY_PHASE_ASSIGNMENT_MISSING', `${row.req_id}: target_phase is required`);
  if (!PHASE_ORDER.includes(row.target_phase)) reject('DISCOVERY_PHASE_ASSIGNMENT_INVALID', `${row.req_id}: unknown target_phase ${row.target_phase}`);
  if (!nonEmpty(row.decision_ref) || !nonEmpty(row.rule)) reject('DISCOVERY_REQUIREMENT_SCHEMA_INVALID', `${row.req_id}: decision_ref and rule are required`);
  if (row.status === 'planned') {
    if (row.implemented_phase !== null || row.superseded_by !== null || row.test_ref !== null || row.test_name !== null) {
      reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: planned rows cannot declare implementation, replacement or test evidence`);
    }
  }
  if (row.status === 'active') {
    if (row.implemented_phase !== row.target_phase || !nonEmpty(row.test_ref) || !nonEmpty(row.test_name) || row.superseded_by !== null) {
      reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: active rows require matching phase, test binding and no successor`);
    }
  }
  if (row.status === 'replaced') {
    if (row.implemented_phase !== row.target_phase || !nonEmpty(row.test_ref) || !nonEmpty(row.test_name) || !nonEmpty(row.superseded_by)) {
      reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: replaced rows preserve active evidence and require a successor`);
    }
  }
  if (row.status === 'rejected') {
    if (BASE_REQUIREMENT_IDS.has(row.req_id)) reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: a base requirement cannot be rejected`);
    if (row.implemented_phase !== null && row.implemented_phase !== row.target_phase) {
      reject('DISCOVERY_PHASE_ASSIGNMENT_INVALID', `${row.req_id}: rejected implemented_phase must be null or target_phase`);
    }
  }
}

export function assertReplacementTopology(rows, index = new Map(rows.map((row) => [row.req_id, row]))) {
  const inDegree = new Map();
  for (const row of rows) {
    if (row.status !== 'replaced') continue;
    if (BASE_REQUIREMENT_IDS.has(row.req_id) && BASE_REQUIREMENT_IDS.has(row.superseded_by)) {
      reject('DISCOVERY_REQUIREMENT_REPLACEMENT_BASE_TARGET', `${row.req_id}: a base successor must be a non-base requirement`);
    }
    const successor = index.get(row.superseded_by);
    if (!successor) {
      reject('DISCOVERY_REQUIREMENT_REPLACEMENT_MISSING', `${row.req_id}: successor does not exist: ${row.superseded_by}`);
    }
    if (successor.target_phase !== row.target_phase) {
      reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${row.req_id}: successor changes target_phase`);
    }
    const nextDegree = (inDegree.get(row.superseded_by) ?? 0) + 1;
    if (nextDegree > 1) reject('DISCOVERY_REQUIREMENT_REPLACEMENT_MERGE', `more than one replacement points to ${row.superseded_by}`);
    inDegree.set(row.superseded_by, nextDegree);
  }
}

export function validateInventory(inventory) {
  const rows = requirementsOf(inventory);
  const index = indexRequirements(inventory);
  for (const row of rows) {
    assertRowShape(row);
    const expectedPhase = expectedPhaseFor(row.req_id);
    if (expectedPhase && row.target_phase !== expectedPhase) {
      reject('DISCOVERY_PHASE_ASSIGNMENT_INVALID', `${row.req_id}: expected ${expectedPhase}, got ${row.target_phase}`);
    }
  }
  for (const id of BASE_68_REQ_IDS) {
    if (!index.has(id)) reject('DISCOVERY_REQUIREMENT_ID_MISSING', `missing base requirement ${id}`);
  }
  for (const phase of PHASE_ORDER) {
    const expected = EXPECTED_REQ_BY_PHASE[phase];
    // The REQ-A..REQ-I namespace is reserved for the fixed base inventory. A future requirement
    // uses a non-base id (for example R-001), so an extra base-shaped row cannot silently inflate
    // a phase while the known 68 ids still happen to be present.
    const actual = rows.filter((row) => /^REQ-[A-I]\d{2}$/u.test(row.req_id) && row.target_phase === phase);
    if (actual.length !== expected.length) reject('DISCOVERY_PHASE_COUNT_MISMATCH', `${phase}: expected ${expected.length}, got ${actual.length}`);
  }
  assertReplacementTopology(rows, index);
  return { ok: true };
}

export function validatePhasePlan(plan) {
  if (!isObject(plan) || !hasOnlyKeys(plan, PHASE_PLAN_KEYS) || plan.schema !== PHASE_PLAN_SCHEMA || !Array.isArray(plan.phases)) {
    reject('DISCOVERY_PHASE_PLAN_SCHEMA_INVALID', `phase plan must use ${PHASE_PLAN_SCHEMA}`);
  }
  const seenPhases = new Set();
  for (const phase of plan.phases) {
    if (!isObject(phase) || !hasOnlyKeys(phase, PHASE_KEYS) || !nonEmpty(phase.phase_id) || !Array.isArray(phase.prerequisites)) {
      reject('DISCOVERY_PHASE_PLAN_SCHEMA_INVALID', 'each phase needs phase_id and prerequisites');
    }
    if (!PHASE_ORDER.includes(phase.phase_id)) reject('DISCOVERY_PHASE_UNKNOWN', `unknown phase ${phase.phase_id}`);
    if (seenPhases.has(phase.phase_id)) reject('DISCOVERY_PHASE_PLAN_MISMATCH', `duplicate phase ${phase.phase_id}`);
    seenPhases.add(phase.phase_id);
    const prerequisiteIds = new Set();
    for (const prerequisite of phase.prerequisites) {
      if (!isObject(prerequisite) || !hasOnlyKeys(prerequisite, PREREQUISITE_KEYS) || !nonEmpty(prerequisite.prereq_id) || !nonEmpty(prerequisite.check_id)) {
        reject('DISCOVERY_PHASE_PLAN_SCHEMA_INVALID', `${phase.phase_id}: invalid prerequisite`);
      }
      if (prerequisiteIds.has(prerequisite.prereq_id)) reject('DISCOVERY_PHASE_PREREQ_DUPLICATE', `${phase.phase_id}: duplicate ${prerequisite.prereq_id}`);
      prerequisiteIds.add(prerequisite.prereq_id);
      if (!KNOWN_CHECK_IDS.has(prerequisite.check_id)) reject('DISCOVERY_PHASE_CHECK_UNKNOWN', `${phase.phase_id}: unknown ${prerequisite.check_id}`);
    }
  }
  if (plan.phases.length !== PHASE_ORDER.length || plan.phases.some((phase, index) => phase.phase_id !== PHASE_ORDER[index])) {
    reject('DISCOVERY_PHASE_PLAN_MISMATCH', 'phase order or count is not canonical');
  }
  for (const phase of plan.phases) {
    const expected = EXPECTED_PHASE_PLAN[phase.phase_id];
    const actual = new Map(phase.prerequisites.map((item) => [item.prereq_id, item.check_id]));
    for (const [prereqId, checkId] of Object.entries(expected)) {
      if (!actual.has(prereqId)) reject('DISCOVERY_PHASE_PREREQ_MISSING', `${phase.phase_id}: missing ${prereqId}`);
      if (actual.get(prereqId) !== checkId) reject('DISCOVERY_PHASE_PLAN_MISMATCH', `${phase.phase_id}: ${prereqId} has wrong check_id`);
    }
    if (actual.size !== Object.keys(expected).length) reject('DISCOVERY_PHASE_PLAN_MISMATCH', `${phase.phase_id}: unexpected prerequisite`);
  }
  return { ok: true };
}

function asBindingResult(row, context) {
  const result = (context.checkBinding ?? checkTestBinding)(row, context.cwd ?? '.');
  if (!result?.ok) reject(result?.code ?? 'DISCOVERY_TEST_BINDING_FAILED', result?.message ?? `${row.req_id}: binding failed`);
}

export function resolveRequirement(reqId, index, context = {}, visited = new Set(), expectedPhase = null) {
  if (visited.has(reqId)) reject('DISCOVERY_REQUIREMENT_REPLACEMENT_CYCLE', `replacement cycle at ${reqId}`);
  const row = index.get(reqId);
  if (!row) reject('DISCOVERY_REQUIREMENT_REPLACEMENT_MISSING', `missing replacement ${reqId}`);
  if (expectedPhase !== null && row.target_phase !== expectedPhase) {
    reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${reqId}: replacement changes target_phase`);
  }
  if (row.status === 'active') {
    asBindingResult(row, context);
    return row;
  }
  if (row.status !== 'replaced') reject('DISCOVERY_REQUIREMENT_REPLACEMENT_UNRESOLVED', `${reqId}: replacement chain ends in ${row.status}`);
  if (!nonEmpty(row.superseded_by)) reject('DISCOVERY_REQUIREMENT_REPLACEMENT_UNRESOLVED', `${reqId}: replacement has no successor`);
  visited.add(reqId);
  return resolveRequirement(row.superseded_by, index, context, visited, expectedPhase ?? row.target_phase);
}

function executePrerequisites(phase, context) {
  const expected = EXPECTED_PHASE_PLAN[phase];
  for (const [prereqId, checkId] of Object.entries(expected)) {
    const check = context.registry?.[checkId];
    if (typeof check !== 'function') reject('DISCOVERY_PHASE_CHECK_UNKNOWN', `${phase}: no registry entry for ${checkId}`);
    let result;
    try {
      result = check(context);
    } catch (error) {
      reject('DISCOVERY_PHASE_PREREQ_FAILED', `${phase}/${prereqId}: ${error.message}`);
    }
    if (!(result === true || result?.ok === true)) reject('DISCOVERY_PHASE_PREREQ_FAILED', `${phase}/${prereqId} failed now`);
  }
}

export function assertPhaseClosed(phase, context) {
  if (!PHASE_ORDER.includes(phase)) reject('DISCOVERY_PHASE_UNKNOWN', `unknown completed phase ${phase}`);
  validateInventory(context.inventory);
  validatePhasePlan(context.plan);
  const phaseIndex = PHASE_ORDER.indexOf(phase);
  if (phaseIndex > 0) assertPhaseClosed(PHASE_ORDER[phaseIndex - 1], context);
  executePrerequisites(phase, context);
  const index = indexRequirements(context.inventory);
  for (const reqId of EXPECTED_REQ_BY_PHASE[phase]) {
    const row = index.get(reqId);
    if (!row || row.status === 'planned' || row.status === 'rejected') {
      reject('DISCOVERY_PHASE_INCOMPLETE', `${phase}: ${reqId} is not resolved to active`);
    }
    resolveRequirement(reqId, index, context, new Set(), row.target_phase);
  }
  return { ok: true };
}

function decisionChanged(previous, current) {
  return previous.decision_ref !== current.decision_ref && nonEmpty(current.decision_ref);
}

export function validateLifecycle(previousInventory, currentInventory, context = {}) {
  requirementsOf(currentInventory);
  const previous = previousInventory ? indexRequirements(previousInventory) : new Map();
  const current = indexRequirements(currentInventory);
  for (const reqId of previous.keys()) {
    if (!current.has(reqId)) reject('DISCOVERY_REQUIREMENT_REMOVED', `requirement disappeared: ${reqId}`);
  }
  validateInventory(currentInventory);
  for (const [reqId, row] of current) {
    const before = previous.get(reqId);
    if (!before) {
      if (row.status !== 'planned') reject('DISCOVERY_REQUIREMENT_INITIAL_STATUS_INVALID', `${reqId}: new requirements must start planned`);
      continue;
    }
    if (before.status === 'replaced' || before.status === 'rejected') {
      if (stableJson(before) !== stableJson(row)) reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${reqId}: terminal requirement was mutated`);
      continue;
    }
    if (before.status === row.status) {
      if (before.status === 'active') {
        if (before.target_phase !== row.target_phase || before.implemented_phase !== row.implemented_phase) {
          reject('DISCOVERY_PHASE_ASSIGNMENT_INVALID', `${reqId}: active phase assignment is immutable`);
        }
        if (before.test_ref !== row.test_ref || before.test_name !== row.test_name || before.rule !== row.rule) {
          if (!decisionChanged(before, row)) reject('DISCOVERY_REQUIREMENT_ACTIVE_MUTATED', `${reqId}: active binding/rule changed without a new decision_ref`);
          asBindingResult(row, context);
        }
      }
      continue;
    }
    if (before.status === 'planned' && row.status === 'active') {
      const ready = context.assertPreviousPhases?.(row.target_phase);
      if (ready !== true) reject('DISCOVERY_REQUIREMENT_ACTIVATED_TOO_EARLY', `${reqId}: earlier phases are not closed`);
      asBindingResult(row, context);
      continue;
    }
    if (before.status === 'planned' && row.status === 'rejected') {
      if (!decisionChanged(before, row)) reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${reqId}: rejection needs a new decision_ref`);
      continue;
    }
    if (before.status === 'active' && row.status === 'replaced') {
      resolveRequirement(row.superseded_by, current, context, new Set(), row.target_phase);
      continue;
    }
    if (before.status === 'active' && row.status === 'rejected') {
      if (!decisionChanged(before, row)) reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${reqId}: rejection needs a new decision_ref`);
      continue;
    }
    if (before.status === 'active' && row.status === 'planned') reject('DISCOVERY_REQUIREMENT_REGRESSION', `${reqId}: active cannot return to planned`);
    reject('DISCOVERY_REQUIREMENT_LIFECYCLE_INVALID', `${reqId}: invalid ${before.status} -> ${row.status}`);
  }
  return { ok: true };
}

// A lifecycle diff can activate many requirements in one phase. Prior phases
// are immutable for that validation run, so execute their live closure once
// per target phase instead of repeating the same test subprocesses per row.
export function createPreviousPhasesChecker(context, close = assertPhaseClosed) {
  const results = new Map();
  return (targetPhase) => {
    if (results.has(targetPhase)) return results.get(targetPhase);
    const index = PHASE_ORDER.indexOf(targetPhase);
    if (index <= 0) {
      results.set(targetPhase, true);
      return true;
    }
    let result = false;
    try {
      close(PHASE_ORDER[index - 1], context);
      result = true;
    } catch {
      result = false;
    }
    results.set(targetPhase, result);
    return result;
  };
}

export function runSelfTest(testRef, cwd) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', testRef], { cwd, encoding: 'utf8', timeout: 30_000 });
  return !result.error && result.status === 0;
}

export function docsContract(cwd) {
  const required = [
    ['SKILL.md', /verify-discovery-requirements\.mjs/u],
    ['README.md', /Discovery/u],
    ['templates/spec.md', /Discovery/u],
  ];
  return required.every(([path, pattern]) => existsSync(resolve(cwd, path)) && pattern.test(readFileSync(resolve(cwd, path), 'utf8')));
}

export function createCheckRegistry(cwd, inventory, { selfTest = runSelfTest, docsCheck = docsContract, bindingsCheck = checkActiveBindings } = {}) {
  const activeGroupsPass = (groups) => bindingsCheck(requirementsOf(inventory)
    .filter((row) => row.status === 'active' && groups.includes(row.req_id.slice(4, 5))), cwd).ok;
  return {
    // Keep the I0 proof non-recursive. The broader unit suite deliberately
    // exercises `main(... --completed-phase I0)`, so using it as the runtime
    // self-test would recursively start the same phase gate.
    inventory_verifier_selftest: () => selfTest('tests/verify-discovery-requirements-selftest.mjs', cwd),
    test_bindings_selftest: () => selfTest('tests/verify-test-bindings.test.mjs', cwd),
    discovery_core_contract: () => activeGroupsPass(['A', 'B', 'C', 'D', 'E', 'G']),
    discovery_views_contract: () => activeGroupsPass(['F', 'H']),
    discovery_docs_contract: () => docsCheck(cwd),
  };
}

function readJson(cwd, relativePath) {
  return JSON.parse(readFileSync(resolve(cwd, relativePath), 'utf8'));
}

export function readPreviousInventory(cwd, ref, runtimeRoot = RUNTIME_ROOT) {
  try {
    if (realpathSync(cwd) !== realpathSync(runtimeRoot)) {
      reject('DISCOVERY_DIFF_RUNTIME_UNTRACKED', '--diff-against is only valid from the VCP source repository that tracks its canonical contracts');
    }
  } catch (error) {
    if (error instanceof DiscoveryError) throw error;
    reject('DISCOVERY_DIFF_RUNTIME_UNTRACKED', '--diff-against requires a readable VCP source repository root');
  }
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    reject('DISCOVERY_DIFF_REF_INVALID', `cannot resolve Git ref ${ref}`);
  }
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:contracts/discovery-requirements.json`], { cwd, encoding: 'utf8', stdio: 'pipe' }));
  } catch {
    return { schema: INVENTORY_SCHEMA, requirements: [] };
  }
}

export function parseArgs(args) {
  if (args[0] !== 'check') return null;
  const parsed = { completedPhase: null, diffAgainst: null };
  for (let index = 1; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!value || (option !== '--completed-phase' && option !== '--diff-against')) return null;
    if (option === '--completed-phase' && parsed.completedPhase !== null) return null;
    if (option === '--diff-against' && parsed.diffAgainst !== null) return null;
    if (option === '--completed-phase') parsed.completedPhase = value;
    if (option === '--diff-against') parsed.diffAgainst = value;
  }
  return parsed;
}

export function main(args = process.argv.slice(2), cwd = '.', dependencies = {}, write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  try {
    const runtimeRoot = dependencies.runtimeRoot ?? RUNTIME_ROOT;
    const inventory = (dependencies.readInventory ?? ((root) => readJson(root, 'contracts/discovery-requirements.json')))(runtimeRoot);
    const plan = (dependencies.readPlan ?? ((root) => readJson(root, 'contracts/discovery-phase-plan.json')))(runtimeRoot);
    validateInventory(inventory);
    validatePhasePlan(plan);
    const rawCheckBinding = dependencies.checkBinding ?? checkTestBinding;
    const checkBinding = dependencies.checkBinding ?? createCachedBindingCheck(rawCheckBinding);
    const registry = dependencies.registry ?? createCheckRegistry(runtimeRoot, inventory, {
      bindingsCheck: (rows, root) => checkActiveBindings(rows, root, { check: checkBinding }),
    });
    const context = { cwd: runtimeRoot, inventory, plan, registry, checkBinding };
    if (parsed.diffAgainst !== null) {
      const previous = (dependencies.readPreviousInventory ?? readPreviousInventory)(cwd, parsed.diffAgainst, runtimeRoot);
      const assertPreviousPhases = createPreviousPhasesChecker(context);
      validateLifecycle(previous, inventory, {
        ...context,
        assertPreviousPhases,
      });
    }
    if (parsed.completedPhase !== null) assertPhaseClosed(parsed.completedPhase, context);
    write(`OK: Discovery inventory is valid${parsed.completedPhase ? ` through ${parsed.completedPhase}` : ''}${parsed.diffAgainst ? ` against ${parsed.diffAgainst}` : ''}.`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.code ?? 'DISCOVERY_REQUIREMENT_SCHEMA_INVALID'}: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-discovery-requirements.mjs')) {
  process.exitCode = main();
}
