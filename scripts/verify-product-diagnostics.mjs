#!/usr/bin/env node
// Validates the six product-discovery artefacts that feed a VCP specification.
//
// The protocol used to mention CAIO, a loop map, PRD, implementation, adoption and recurrence
// only as prose. That made it possible to jump from a vague research paragraph to a build plan
// without a durable, reviewable description of the business process. This gate checks the shape
// and cross-field invariants of the artefacts. It deliberately does not decide whether a diagnosis
// is true or whether a proposed product is wise: those remain human/adversarial judgements.
//
// HONEST LIMIT: this is a structural gate. Non-empty text, a locator, an owner or a metric can all
// be invented. A green result means the six documents are complete and internally shaped; it never
// proves the observations, forecasts or semantic quality of the documents.

import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const SCHEMAS = Object.freeze({
  caio: 'vcp.caio/1',
  'loop-map': 'vcp.loop-map/1',
  prd: 'vcp.prd/1',
  implementation: 'vcp.implementation-plan/1',
  adoption: 'vcp.adoption/1',
  recurrence: 'vcp.recurrence/1',
});
export const ARTIFACTS = Object.freeze(Object.keys(SCHEMAS));
export const USAGE = 'usage: verify-product-diagnostics.mjs check <feature-slug> [--require-inputs]';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const EMPTY_PREFIX = 'VACÍO: ';

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const STATUSES = new Set(['observed', 'hypothesis']);
const PRIORITIES = new Set(['must', 'should', 'could']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const isDate = (value) => typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isId = (value) => typeof value === 'string' && IDENTIFIER.test(value) && value.trim() !== '';

function exactKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function add(violations, message) {
  violations.push(message);
}

function requireText(value, at, violations) {
  if (!nonEmpty(value)) add(violations, `${at} debe ser un texto no vacío`);
}

function requireStringArray(value, at, violations, { nonEmptyList = false } = {}) {
  if (!Array.isArray(value)) {
    add(violations, `${at} debe ser una lista de textos`);
    return;
  }
  if (nonEmptyList && value.length === 0) add(violations, `${at} no puede estar vacía`);
  value.forEach((item, index) => requireText(item, `${at}[${index}]`, violations));
}

function validateEvidenceList(value, at, violations) {
  if (!Array.isArray(value) || value.length === 0) {
    add(violations, `${at} debe tener al menos una evidencia`);
    return;
  }
  value.forEach((item, index) => {
    const itemAt = `${at}[${index}]`;
    if (!exactKeys(item, ['source', 'locator', 'observation'])) {
      add(violations, `${itemAt} debe declarar exactamente source, locator y observation`);
      return;
    }
    requireText(item.source, `${itemAt}.source`, violations);
    requireText(item.locator, `${itemAt}.locator`, violations);
    requireText(item.observation, `${itemAt}.observation`, violations);
  });
}

function validateFindingList(value, at, violations) {
  if (!Array.isArray(value)) {
    add(violations, `${at} debe ser una lista de hallazgos`);
    return;
  }
  const ids = new Set();
  value.forEach((item, index) => {
    const itemAt = `${at}[${index}]`;
    if (!exactKeys(item, ['id', 'status', 'description', 'evidence', 'reason'])) {
      add(violations, `${itemAt} debe declarar id, status, description, evidence y reason`);
      return;
    }
    if (!isId(item.id)) add(violations, `${itemAt}.id debe ser un identificador simple`);
    else if (ids.has(item.id)) add(violations, `${at} repite el id ${item.id}`);
    else ids.add(item.id);
    if (!STATUSES.has(item.status)) add(violations, `${itemAt}.status debe ser observed o hypothesis`);
    requireText(item.description, `${itemAt}.description`, violations);
    if (item.status === 'observed') validateEvidenceList(item.evidence, `${itemAt}.evidence`, violations);
    else if (!Array.isArray(item.evidence)) add(violations, `${itemAt}.evidence debe ser una lista, aunque la hipótesis no tenga evidencia`);
    if (item.status === 'hypothesis') requireText(item.reason, `${itemAt}.reason`, violations);
  });
}

function validateHeader(document, kind, violations) {
  if (document.schema !== SCHEMAS[kind]) add(violations, `schema debe ser ${SCHEMAS[kind]}`);
  if (!FEATURE_SLUG.test(document.feature ?? '')) add(violations, 'feature debe ser un slug en kebab-case');
  if (!isDate(document.date)) add(violations, 'date debe ser una fecha AAAA-MM-DD válida');
}

export function validateCaio(document) {
  const violations = [];
  if (!exactKeys(document, ['schema', 'feature', 'date', 'process', 'findings'])) return ['caio debe declarar exactamente schema, feature, date, process y findings'];
  validateHeader(document, 'caio', violations);
  if (!exactKeys(document.process, ['name', 'owner', 'scope'])) add(violations, 'process debe declarar name, owner y scope');
  else ['name', 'owner', 'scope'].forEach((key) => requireText(document.process[key], `process.${key}`, violations));
  if (!exactKeys(document.findings, ['broken_process', 'information_loss', 'repeated_work', 'open_loops'])) {
    add(violations, 'findings debe declarar broken_process, information_loss, repeated_work y open_loops');
  } else {
    const all = Object.entries(document.findings);
    all.forEach(([key, value]) => validateFindingList(value, `findings.${key}`, violations));
    if (all.every(([, value]) => Array.isArray(value) && value.length === 0)) add(violations, 'findings debe registrar al menos un hallazgo');
  }
  return violations;
}

function validateLoopStage(stage, at, violations) {
  if (!exactKeys(stage, ['input', 'measure', 'decision_owner', 'action', 'control', 'learning'])) {
    add(violations, `${at} debe declarar input, measure, decision_owner, action, control y learning`);
    return;
  }
  Object.keys(stage).forEach((key) => requireText(stage[key], `${at}.${key}`, violations));
}

export function validateLoopMap(document) {
  const violations = [];
  if (!exactKeys(document, ['schema', 'feature', 'date', 'current', 'target', 'first_loop'])) return ['loop-map debe declarar exactamente schema, feature, date, current, target y first_loop'];
  validateHeader(document, 'loop-map', violations);
  validateLoopStage(document.current, 'current', violations);
  validateLoopStage(document.target, 'target', violations);
  if (!exactKeys(document.first_loop, ['id', 'owner', 'metric', 'cadence', 'success_threshold', 'next_candidate'])) add(violations, 'first_loop debe declarar id, owner, metric, cadence, success_threshold y next_candidate');
  else Object.keys(document.first_loop).forEach((key) => requireText(document.first_loop[key], `first_loop.${key}`, violations));
  return violations;
}

function validateUsers(value, violations) {
  if (!Array.isArray(value) || value.length === 0) {
    add(violations, 'users debe tener al menos un usuario');
    return;
  }
  value.forEach((item, index) => {
    if (!exactKeys(item, ['role', 'context'])) add(violations, `users[${index}] debe declarar role y context`);
    else { requireText(item.role, `users[${index}].role`, violations); requireText(item.context, `users[${index}].context`, violations); }
  });
}

function validateCapabilities(value, violations) {
  if (!Array.isArray(value) || value.length === 0) { add(violations, 'capabilities debe tener al menos una capacidad'); return; }
  const ids = new Set();
  value.forEach((item, index) => {
    if (!exactKeys(item, ['id', 'description', 'priority'])) { add(violations, `capabilities[${index}] debe declarar id, description y priority`); return; }
    if (!isId(item.id)) add(violations, `capabilities[${index}].id no es válido`);
    else if (ids.has(item.id)) add(violations, `capabilities repite el id ${item.id}`);
    else ids.add(item.id);
    requireText(item.description, `capabilities[${index}].description`, violations);
    if (!PRIORITIES.has(item.priority)) add(violations, `capabilities[${index}].priority debe ser must, should o could`);
  });
}

function validateAcceptanceCriteria(value, violations) {
  if (!Array.isArray(value) || value.length === 0) { add(violations, 'acceptance_criteria debe tener al menos un criterio'); return; }
  const ids = new Set();
  value.forEach((item, index) => {
    if (!exactKeys(item, ['id', 'statement'])) { add(violations, `acceptance_criteria[${index}] debe declarar id y statement`); return; }
    if (!isId(item.id)) add(violations, `acceptance_criteria[${index}].id no es válido`);
    else if (ids.has(item.id)) add(violations, `acceptance_criteria repite el id ${item.id}`);
    else ids.add(item.id);
    requireText(item.statement, `acceptance_criteria[${index}].statement`, violations);
  });
}

function validateRisks(value, violations) {
  if (!Array.isArray(value) || value.length === 0) { add(violations, 'risks debe tener al menos un riesgo'); return; }
  value.forEach((item, index) => {
    if (!exactKeys(item, ['id', 'description', 'mitigation'])) add(violations, `risks[${index}] debe declarar id, description y mitigation`);
    else { if (!isId(item.id)) add(violations, `risks[${index}].id no es válido`); requireText(item.description, `risks[${index}].description`, violations); requireText(item.mitigation, `risks[${index}].mitigation`, violations); }
  });
}

export function validatePrd(document) {
  const violations = [];
  const keys = ['schema', 'feature', 'date', 'problem', 'users', 'outcome', 'in_scope', 'out_scope', 'capabilities', 'technology', 'acceptance_criteria', 'risks'];
  if (!exactKeys(document, keys)) return [`prd debe declarar exactamente ${keys.join(', ')}`];
  validateHeader(document, 'prd', violations);
  requireText(document.problem, 'problem', violations); requireText(document.outcome, 'outcome', violations);
  validateUsers(document.users, violations); requireStringArray(document.in_scope, 'in_scope', violations, { nonEmptyList: true }); requireStringArray(document.out_scope, 'out_scope', violations, { nonEmptyList: true });
  validateCapabilities(document.capabilities, violations);
  if (!exactKeys(document.technology, ['stack', 'dependencies', 'access'])) add(violations, 'technology debe declarar stack, dependencies y access');
  else { requireText(document.technology.stack, 'technology.stack', violations); requireStringArray(document.technology.dependencies, 'technology.dependencies', violations); requireStringArray(document.technology.access, 'technology.access', violations); }
  validateAcceptanceCriteria(document.acceptance_criteria, violations); validateRisks(document.risks, violations);
  return violations;
}

function validatePlanSteps(value, violations) {
  if (!Array.isArray(value) || value.length === 0) { add(violations, 'order debe tener al menos un paso'); return; }
  const ids = new Set();
  value.forEach((item, index) => {
    const at = `order[${index}]`;
    if (!exactKeys(item, ['id', 'action', 'depends_on', 'validation', 'access_needed'])) { add(violations, `${at} debe declarar id, action, depends_on, validation y access_needed`); return; }
    if (!isId(item.id)) add(violations, `${at}.id no es válido`);
    else if (ids.has(item.id)) add(violations, `order repite el id ${item.id}`);
    else ids.add(item.id);
    requireText(item.action, `${at}.action`, violations); requireText(item.validation, `${at}.validation`, violations);
    requireStringArray(item.depends_on, `${at}.depends_on`, violations);
    requireStringArray(item.access_needed, `${at}.access_needed`, violations);
    if (Array.isArray(item.depends_on)) item.depends_on.forEach((dependency) => { if (!ids.has(dependency)) add(violations, `${at}.depends_on referencia ${dependency} que no aparece antes en el orden`); });
  });
}

export function validateImplementation(document) {
  const violations = [];
  const keys = ['schema', 'feature', 'date', 'order', 'rollback', 'release_gate'];
  if (!exactKeys(document, keys)) return [`implementation debe declarar exactamente ${keys.join(', ')}`];
  validateHeader(document, 'implementation', violations); validatePlanSteps(document.order, violations); requireText(document.rollback, 'rollback', violations); requireText(document.release_gate, 'release_gate', violations);
  return violations;
}

function validateRollout(value, violations) {
  if (!Array.isArray(value) || value.length === 0) { add(violations, 'rollout_steps debe tener al menos un paso'); return; }
  const ids = new Set();
  value.forEach((item, index) => {
    const at = `rollout_steps[${index}]`;
    if (!exactKeys(item, ['id', 'when', 'action', 'exit_criteria'])) { add(violations, `${at} debe declarar id, when, action y exit_criteria`); return; }
    if (!isId(item.id)) add(violations, `${at}.id no es válido`); else if (ids.has(item.id)) add(violations, `rollout_steps repite el id ${item.id}`); else ids.add(item.id);
    ['when', 'action', 'exit_criteria'].forEach((key) => requireText(item[key], `${at}.${key}`, violations));
  });
}

export function validateAdoption(document) {
  const violations = [];
  const keys = ['schema', 'feature', 'date', 'owner', 'stakeholders', 'workflow_change', 'training', 'success_signal', 'review_cadence', 'fallback', 'rollout_steps'];
  if (!exactKeys(document, keys)) return [`adoption debe declarar exactamente ${keys.join(', ')}`];
  validateHeader(document, 'adoption', violations); ['owner', 'workflow_change', 'training', 'success_signal', 'review_cadence', 'fallback'].forEach((key) => requireText(document[key], key, violations)); requireStringArray(document.stakeholders, 'stakeholders', violations, { nonEmptyList: true }); validateRollout(document.rollout_steps, violations);
  return violations;
}

export function validateRecurrence(document) {
  const violations = [];
  const keys = ['schema', 'feature', 'date', 'first_loop_id', 'maintenance', 'metric', 'cadence', 'review_owner', 'escalation', 'next_process', 'trigger'];
  if (!exactKeys(document, keys)) return [`recurrence debe declarar exactamente ${keys.join(', ')}`];
  validateHeader(document, 'recurrence', violations); keys.slice(3).forEach((key) => requireText(document[key], key, violations));
  return violations;
}

export function validateArtifact(kind, document) {
  if (!ARTIFACTS.includes(kind)) return [`artefacto desconocido: ${kind}`];
  if (!isObject(document)) return [`${kind} debe ser un objeto JSON`];
  switch (kind) {
    case 'caio': return validateCaio(document);
    case 'loop-map': return validateLoopMap(document);
    case 'prd': return validatePrd(document);
    case 'implementation': return validateImplementation(document);
    case 'adoption': return validateAdoption(document);
    case 'recurrence': return validateRecurrence(document);
  }
}

export function validateDiagnostics(documents) {
  const violations = [];
  for (const kind of ARTIFACTS) {
    const result = validateArtifact(kind, documents[kind]);
    result.forEach((message) => violations.push(`${kind}: ${message}`));
  }
  return { ok: violations.length === 0, violations, summary: `${ARTIFACTS.length}/${ARTIFACTS.length} artefactos CAIO, loop-map, PRD, implementation, adoption y recurrence válidos` };
}

function parseArgs(args) {
  if (args.length >= 2 && args[0] === 'check' && FEATURE_SLUG.test(args[1])) {
    const flags = args.slice(2);
    if (flags.some((flag) => flag !== REQUIRE_INPUTS_FLAG)) return null;
    return { feature: args[1], requireInputs: flags.includes(REQUIRE_INPUTS_FLAG) };
  }
  return null;
}

function readJson(path, read) {
  try { return { value: JSON.parse(read(path, 'utf8')), error: null }; }
  catch (error) { return { value: null, error: `${path}: no se puede leer como JSON (${error.message})` }; }
}

export function main(args = process.argv.slice(2), cwd = '.', io = {}, write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) { writeError(USAGE); return 2; }
  const stat = io.stat ?? statSync; const read = io.read ?? readFileSync;
  const directory = resolve(cwd, 'docs', 'discovery', parsed.feature, 'diagnostics');
  let directoryInfo;
  try { directoryInfo = stat(directory); } catch (error) { directoryInfo = undefined; }
  if (directoryInfo === undefined) {
    const message = `no existe ${directory}: todavía no hay diagnóstico de producto para ${parsed.feature}`;
    if (parsed.requireInputs) { writeError(`REJECTED: PRODUCT_DIAGNOSTICS_NO_INPUTS: ${message}`); return 1; }
    write(`${EMPTY_PREFIX}${message}`); return 0;
  }
  if (!directoryInfo.isDirectory()) { writeError(`REJECTED: PRODUCT_DIAGNOSTICS_PATH_INVALID: ${directory} no es un directorio`); return 1; }
  const documents = {};
  const violations = [];
  for (const kind of ARTIFACTS) {
    const path = join(directory, `${kind}.json`); const result = readJson(path, read);
    if (result.error !== null) { violations.push(result.error); continue; }
    documents[kind] = result.value;
  }
  if (violations.length === 0) violations.push(...validateDiagnostics(documents).violations);
  if (violations.length > 0) { violations.forEach((message) => writeError(`REJECTED: ${message}`)); return 1; }
  write(`OK: ${parsed.feature}: ${validateDiagnostics(documents).summary}. Límite: verifica forma e invariantes, nunca verdad semántica.`); return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-product-diagnostics.mjs')) process.exitCode = main();
