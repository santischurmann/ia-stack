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
/**
 * Las doce dimensiones del diagnostico. Estan todas o no esta el diagnostico: con cuatro campos,
 * las otras ocho son invisibles y no se distingue "lo mire y no habia nada" de "no lo mire".
 */
export const CAIO_DIMENSIONS = Object.freeze(['broken_process', 'information_loss', 'repeated_work', 'open_loops', 'ownerless_decisions', 'unmeasured_states', 'broken_handoffs', 'recurring_errors', 'absent_learning', 'hidden_costs', 'security_risks', 'conversational_memory_dependency']);

/**
 * Las cuatro clases que el encargo separa, y lo que cada etiqueta obliga a cargar. Un observado sin
 * evidencia no es un hecho; una inferencia que no dice de que se infiere es una hipotesis con mejor
 * nombre; un dato faltante que no dice como conseguirlo es un encogimiento de hombros.
 */
const FINDING_KEYS = Object.freeze({
  observed: ['id', 'status', 'description', 'evidence', 'reason'],
  hypothesis: ['id', 'status', 'description', 'evidence', 'reason'],
  inference: ['id', 'status', 'description', 'evidence', 'reason', 'derived_from'],
  missing_data: ['id', 'status', 'description', 'evidence', 'reason', 'what_is_missing', 'how_to_get_it'],
});
const STATUSES = new Set(Object.keys(FINDING_KEYS));

/** Una dimension sin hallazgos tiene que decir cual de las dos cosas es. */
const COVERAGE_STATES = new Set(['examined_clean', 'not_examined']);
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

function validateFindingList(value, at, violations, knownIds = null) {
  if (!Array.isArray(value)) {
    add(violations, `${at} debe ser una lista de hallazgos`);
    return;
  }
  const ids = new Set();
  value.forEach((item, index) => {
    const itemAt = `${at}[${index}]`;
    if (!isObject(item) || !STATUSES.has(item.status)) {
      add(violations, `${itemAt}.status debe ser una de: ${[...STATUSES].join(", ")}`);
      return;
    }
    if (!exactKeys(item, FINDING_KEYS[item.status])) {
      add(violations, `${itemAt} de clase ${item.status} debe declarar exactamente ${FINDING_KEYS[item.status].join(", ")}`);
      return;
    }
    if (!isId(item.id)) add(violations, `${itemAt}.id debe ser un identificador simple`);
    else if (ids.has(item.id)) add(violations, `${at} repite el id ${item.id}`);
    else ids.add(item.id);
    requireText(item.description, `${itemAt}.description`, violations);
    if (item.status === 'observed') validateEvidenceList(item.evidence, `${itemAt}.evidence`, violations);
    else if (!Array.isArray(item.evidence)) add(violations, `${itemAt}.evidence debe ser una lista, aunque la clase no exija evidencia`);
    if (item.status === 'hypothesis' || item.status === 'inference') requireText(item.reason, `${itemAt}.reason`, violations);
    if (item.status === 'inference') {
      requireStringArray(item.derived_from, `${itemAt}.derived_from`, violations, { nonEmptyList: true });
      // Una inferencia tiene que apoyarse en algo que este en el documento. Sin resolver la
      // referencia, derived_from es una lista de nombres y la inferencia sigue sin origen.
      if (knownIds !== null && Array.isArray(item.derived_from)) {
        for (const origen of item.derived_from) {
          if (typeof origen === "string" && !knownIds.has(origen)) {
            add(violations, `${itemAt}.derived_from apunta a ${origen}, que no es un hallazgo de este diagnóstico`);
          }
        }
      }
    }
    if (item.status === 'missing_data') {
      requireText(item.what_is_missing, `${itemAt}.what_is_missing`, violations);
      requireText(item.how_to_get_it, `${itemAt}.how_to_get_it`, violations);
    }
  });
}
function validateHeader(document, kind, violations) {
  if (document.schema !== SCHEMAS[kind]) add(violations, `schema debe ser ${SCHEMAS[kind]}`);
  if (!FEATURE_SLUG.test(document.feature ?? '')) add(violations, 'feature debe ser un slug en kebab-case');
  if (!isDate(document.date)) add(violations, 'date debe ser una fecha AAAA-MM-DD válida');
}

export function validateCaio(document) {
  const violations = [];
  if (!exactKeys(document, ['schema', 'feature', 'date', 'process', 'findings', 'coverage'])) {
    return ['caio debe declarar exactamente schema, feature, date, process, findings y coverage'];
  }
  validateHeader(document, 'caio', violations);
  if (!exactKeys(document.process, ['name', 'owner', 'scope'])) add(violations, 'process debe declarar name, owner y scope');
  else ['name', 'owner', 'scope'].forEach((key) => requireText(document.process[key], `process.${key}`, violations));

  if (!exactKeys(document.findings, CAIO_DIMENSIONS)) {
    add(violations, `findings debe declarar exactamente las ${CAIO_DIMENSIONS.length} dimensiones del diagnóstico: ${CAIO_DIMENSIONS.join(", ")}`);
    return violations;
  }

  // Los ids se juntan antes de validar para que una inferencia pueda apoyarse en un hallazgo de
  // otra dimensión: el diagnóstico es uno solo, no doce listas sueltas.
  const knownIds = new Set();
  for (const dimension of CAIO_DIMENSIONS) {
    const list = document.findings[dimension];
    if (!Array.isArray(list)) continue;
    for (const item of list) if (isObject(item) && isId(item.id)) knownIds.add(item.id);
  }
  for (const dimension of CAIO_DIMENSIONS) {
    validateFindingList(document.findings[dimension], `findings.${dimension}`, violations, knownIds);
  }
  if (CAIO_DIMENSIONS.every((dimension) => Array.isArray(document.findings[dimension]) && document.findings[dimension].length === 0)) {
    add(violations, 'findings debe registrar al menos un hallazgo');
  }

  validateCoverage(document, violations);
  return violations;
}

/**
 * Una dimension sin hallazgos tiene que decir cual de las dos cosas es: se examino y no habia nada,
 * o no se examino y por que. Sin esto, ocho silencios se leen igual que ocho dimensiones sanas, que
 * es exactamente el modo en que un diagnostico parcial se vende como completo.
 */
function validateCoverage(document, violations) {
  const coverage = document.coverage;
  if (!isObject(coverage)) {
    add(violations, 'coverage debe ser un objeto que declare cada dimensión sin hallazgos');
    return;
  }
  const vacias = CAIO_DIMENSIONS.filter((dimension) => Array.isArray(document.findings[dimension]) && document.findings[dimension].length === 0);
  for (const dimension of vacias) {
    if (!Object.hasOwn(coverage, dimension)) {
      add(violations, `coverage debe declarar ${dimension}: no tiene hallazgos, y un silencio sin motivo se lee igual que una dimensión sana`);
    }
  }
  for (const dimension of Object.keys(coverage)) {
    if (!CAIO_DIMENSIONS.includes(dimension)) {
      add(violations, `coverage declara ${dimension}, que no es una dimensión del diagnóstico`);
      continue;
    }
    if (!vacias.includes(dimension)) {
      add(violations, `coverage declara ${dimension} como sin hallazgos, pero findings.${dimension} sí los trae`);
      continue;
    }
    const entry = coverage[dimension];
    if (!exactKeys(entry, ['state', 'reason'])) {
      add(violations, `coverage.${dimension} debe declarar exactamente state y reason`);
      continue;
    }
    if (!COVERAGE_STATES.has(entry.state)) add(violations, `coverage.${dimension}.state debe ser una de: ${[...COVERAGE_STATES].join(", ")}`);
    requireText(entry.reason, `coverage.${dimension}.reason`, violations);
  }
}
/**
 * Los trece campos que describen un bucle. `decision` es QUE se decide y `decision_owner` es QUIEN
 * decide: son dos cosas distintas, y un bucle al que le falta una de las dos no se puede auditar --
 * o no se sabe que se resolvio, o no se sabe a quien preguntarle.
 */
export const LOOP_FIELDS = Object.freeze(['input', 'transformation', 'actor', 'decision', 'decision_owner', 'action', 'measure', 'control', 'evidence', 'learning', 'next_iteration', 'exit_condition', 'block_condition']);

function validateLoopStage(stage, at, violations) {
  if (!exactKeys(stage, LOOP_FIELDS)) {
    add(violations, `${at} debe declarar exactamente los ${LOOP_FIELDS.length} campos del bucle: ${LOOP_FIELDS.join(", ")}`);
    return false;
  }
  LOOP_FIELDS.forEach((key) => requireText(stage[key], `${at}.${key}`, violations));
  return true;
}

/**
 * El delta es lo unico del mapa que se puede verificar contra el propio documento: los demas campos
 * son prosa que el gate no puede juzgar. Asi que se lo exige exacto -- cada cambio declarado tiene
 * que corresponderse con una diferencia real entre current y target, y cada diferencia real tiene
 * que estar declarada. Un delta que miente sobre lo que cambio es peor que no tenerlo: parece
 * auditado.
 */
function validateDelta(document, violations) {
  const delta = document.delta;
  if (!Array.isArray(delta)) {
    add(violations, 'delta debe ser una lista de cambios entre current y target');
    return;
  }
  const declarados = new Set();
  delta.forEach((cambio, index) => {
    const at = `delta[${index}]`;
    if (!exactKeys(cambio, ['field', 'from', 'to', 'why'])) {
      add(violations, `${at} debe declarar exactamente field, from, to y why`);
      return;
    }
    if (!LOOP_FIELDS.includes(cambio.field)) {
      add(violations, `${at}.field nombra ${cambio.field}, que no es un campo del bucle`);
      return;
    }
    if (declarados.has(cambio.field)) add(violations, `delta declara ${cambio.field} dos veces`);
    declarados.add(cambio.field);
    requireText(cambio.why, `${at}.why`, violations);
    if (document.current[cambio.field] === document.target[cambio.field]) {
      add(violations, `${at} declara un cambio en ${cambio.field}, pero current y target dicen lo mismo`);
      return;
    }
    if (cambio.from !== document.current[cambio.field]) add(violations, `${at}.from no es lo que current dice de ${cambio.field}`);
    if (cambio.to !== document.target[cambio.field]) add(violations, `${at}.to no es lo que target dice de ${cambio.field}`);
  });
  for (const field of LOOP_FIELDS) {
    if (document.current[field] !== document.target[field] && !declarados.has(field)) {
      add(violations, `delta no declara el cambio en ${field}, que current y target sí traen distinto`);
    }
  }
}

export function validateLoopMap(document) {
  const violations = [];
  if (!exactKeys(document, ['schema', 'feature', 'date', 'current', 'delta', 'target', 'first_loop'])) {
    return ['loop-map debe declarar exactamente schema, feature, date, current, delta, target y first_loop'];
  }
  validateHeader(document, 'loop-map', violations);
  const currentOk = validateLoopStage(document.current, 'current', violations);
  const targetOk = validateLoopStage(document.target, 'target', violations);
  // El delta se compara campo a campo, asi que sin los dos flujos completos no hay nada que comparar.
  if (currentOk && targetOk) validateDelta(document, violations);

  const FIRST_LOOP_KEYS = ['id', 'owner', 'metric', 'cadence', 'success_threshold', 'next_candidate', 'rollback', 'failure_signals'];
  if (!exactKeys(document.first_loop, FIRST_LOOP_KEYS)) {
    add(violations, `first_loop debe declarar ${FIRST_LOOP_KEYS.join(", ")}`);
    return violations;
  }
  // Un bucle sin rollback es un cambio de una sola direccion, y uno sin señales de fallo se abandona
  // en silencio: nadie puede decir cuando dejo de servir.
  FIRST_LOOP_KEYS.filter((key) => key !== 'failure_signals')
    .forEach((key) => requireText(document.first_loop[key], `first_loop.${key}`, violations));
  requireStringArray(document.first_loop.failure_signals, 'first_loop.failure_signals', violations, { nonEmptyList: true });
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
