#!/usr/bin/env node
// verify-handoff-report.mjs — mechanical disclosure gate for VCP task handoffs.
//
// Usage:
//   node scripts/verify-handoff-report.mjs check <handoff-report.md>
//
// Every VCP handoff must explicitly say what its author did not review. This makes a bounded
// review visible to the next role instead of letting an evidence-backed pass be mistaken for a
// complete review. The script verifies declaration shape only; it cannot certify the declaration
// is truthful, so the orchestrator and adversarial reviewer still assess its substance.

import { readFileSync } from 'node:fs';

const DECLARATION = /^NOT_REVIEWED:[ \t]*(.*)$/gm;
export const MAX_LINES = 40;
const PLACEHOLDERS = new Set(['n/a', 'unknown', 'nothing']);

// Un salto de línea final no cuenta como línea. El detalle de más de 40 líneas va a .vibe/handoffs/detalle/ (carpeta aparte: no es un informe de gate).
export function validateLength(reportText) {
  const lines = reportText.replace(/\r?\n$/, '').split(/\r?\n/).length;
  if (lines > MAX_LINES) {
    return { ok: false, reason: `el reporte tiene ${lines} líneas, tope ${MAX_LINES}: el detalle va a .vibe/handoffs/detalle/ y el reporte lleva sólo la conclusión` };
  }
  return { ok: true };
}

export function validateNotReviewed(reportText) {
  const declarations = [...reportText.matchAll(DECLARATION)];
  if (declarations.length === 0) {
    return { ok: false, reason: 'missing required NOT_REVIEWED declaration' };
  }
  if (declarations.length !== 1) {
    return { ok: false, reason: 'report must contain exactly one NOT_REVIEWED declaration' };
  }

  const declaration = declarations[0][1].trim();
  if (!declaration) {
    return { ok: false, reason: 'NOT_REVIEWED declaration is blank' };
  }

  const normalized = declaration.toLowerCase();
  if (PLACEHOLDERS.has(normalized)) {
    return { ok: false, reason: `NOT_REVIEWED placeholder ${JSON.stringify(declaration)} hides review limits` };
  }

  if (normalized === 'none') {
    return { ok: false, reason: 'NOT_REVIEWED cannot be bare "none"; state the reviewed scope after "none —"' };
  }

  const noOmissions = declaration.match(/^none\s*(?:—|-)\s*(\S.*)$/i);
  if (normalized.startsWith('none') && !noOmissions) {
    return { ok: false, reason: 'NOT_REVIEWED uses "none" without a reviewed-scope basis' };
  }

  return { ok: true, declaration };
}

function usage(message) {
  if (message) console.error(`usage: ${message}`);
  console.error('usage: verify-handoff-report.mjs check <handoff-report.md>');
  process.exit(2);
}

function main() {
  const [, , command, reportPath, ...extra] = process.argv;
  if (command !== 'check' || !reportPath || extra.length !== 0) usage();

  let reportText;
  try {
    reportText = readFileSync(reportPath, 'utf8');
  } catch (error) {
    console.error(`REJECTED: no se pudo leer el reporte ${JSON.stringify(reportPath)}: ${error.message}`);
    process.exit(1);
  }

  const length = validateLength(reportText);
  const result = length.ok ? validateNotReviewed(reportText) : length;
  if (!result.ok) {
    console.error(`REJECTED: ${result.reason}`);
    process.exit(1);
  }
  console.log(`OK: NOT_REVIEWED declared — ${result.declaration}`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-handoff-report.mjs')) main();
