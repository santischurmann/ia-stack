#!/usr/bin/env node
// Gate de integración del menú por fase. `verify-phase-decisions.mjs` valida que un registro sea
// coherente, pero su phase_order es autodeclarado. Este wrapper agrega la autoridad local de
// `docs/phase-plan.json`: una fase no puede desaparecer ni inventarse reordenando el propio registro.
// LÍMITE HONESTO: prueba forma, orden declarado y hashes; no prueba que una persona haya elegido
// realmente la opción ni que el plan sea el producto correcto.

import { readFileSync } from 'node:fs';
import { checkDecisions } from './verify-phase-decisions.mjs';

export const USAGE = 'usage: verify-phase-menu.mjs check <decisions.json> --plan <phase-plan.json>';
export const SCHEMA = 'vcp.phase-plan/1';
export const PLAN_MISMATCH = 'PHASE_MENU_PLAN_MISMATCH';

function violation(code, message) { return { code, message }; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function nonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }

export function checkPlan(plan) {
  if (!isObject(plan) || Object.keys(plan).some((key) => !['schema', 'feature', 'phase_order'].includes(key))
    || Object.keys(plan).length !== 3) {
    return [violation('PHASE_PLAN_SCHEMA_INVALID', 'el plan debe declarar exactamente schema, feature y phase_order')];
  }
  if (plan.schema !== SCHEMA) return [violation('PHASE_PLAN_SCHEMA_INVALID', `el plan debe declarar schema ${SCHEMA}`)];
  if (!nonEmpty(plan.feature)) return [violation('PHASE_PLAN_SCHEMA_INVALID', 'feature debe ser un identificador no vacío')];
  if (!Array.isArray(plan.phase_order) || plan.phase_order.length === 0 || !plan.phase_order.every(nonEmpty)
    || new Set(plan.phase_order).size !== plan.phase_order.length) {
    return [violation('PHASE_PLAN_SCHEMA_INVALID', 'phase_order debe ser una lista no vacía de fases únicas')];
  }
  return [];
}

export function checkPhaseMenu(decisions, plan) {
  const planErrors = checkPlan(plan);
  if (planErrors.length > 0) return { ok: false, violations: planErrors, summary: '' };
  const result = checkDecisions(decisions, { requireComplete: true });
  if (!result.ok) return result;
  if (JSON.stringify(decisions.phase_order) !== JSON.stringify(plan.phase_order)) {
    return {
      ok: false,
      violations: [violation(PLAN_MISMATCH, `phase_order del registro (${JSON.stringify(decisions.phase_order)}) no coincide exactamente con el plan canónico (${JSON.stringify(plan.phase_order)})`)],
      summary: '',
    };
  }
  return { ok: true, violations: [], summary: `menú completo verificado contra el plan ${plan.feature}: ${plan.phase_order.length} fase(s)` };
}

function readJson(path) {
  try { return { value: JSON.parse(readFileSync(path, 'utf8')), error: null, missing: false }; }
  catch (error) {
    if (error.code === 'ENOENT') return { value: null, error: null, missing: true };
    return { value: null, error: `no se puede leer ${path}: ${error.message}`, missing: false };
  }
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error) {
  if (args.length !== 4 || args[0] !== 'check' || args[2] !== '--plan') { writeError(USAGE); return 2; }
  const decisionsPath = args[1]; const planPath = args[3];
  const decisionsRaw = readJson(decisionsPath); const planRaw = readJson(planPath);
  if (decisionsRaw.error) { writeError(`REJECTED: PHASE_MENU_UNREADABLE: ${decisionsRaw.error}`); return 1; }
  if (planRaw.error) { writeError(`REJECTED: PHASE_MENU_UNREADABLE: ${planRaw.error}`); return 1; }
  if (decisionsRaw.missing || planRaw.missing) {
    writeError(`REJECTED: PHASE_MENU_NO_INPUTS: faltan ${decisionsRaw.missing ? decisionsPath : ''}${decisionsRaw.missing && planRaw.missing ? ' y ' : ''}${planRaw.missing ? planPath : ''}`); return 1;
  }
  const result = checkPhaseMenu(decisionsRaw.value, planRaw.value);
  if (!result.ok) { for (const item of result.violations) writeError(`REJECTED: ${item.code}: ${item.message}`); return 1; }
  write(`OK: ${decisionsPath} ${result.summary}`); return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-phase-menu.mjs')) process.exitCode = main();
