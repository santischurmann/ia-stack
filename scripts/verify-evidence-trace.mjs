#!/usr/bin/env node
// Two references that the protocol asked for in prose and nobody could check: a criterion of
// docs/spec.md whose test nobody ever wrote, and a Discovery claim that cites a criterion or
// requirement the spec does not declare. Both survived a real run because a person happened to do
// them by hand; nothing obliged the next session.
//
// HONEST LIMIT: `criteria` proves that a literal test()/it() declaration NAMES the criterion, not
// that the test actually checks it — traceability, never sufficiency. `claims` proves that a
// declared link resolves to an identifier the spec declares, not that the claim supports it. And
// both degrade to exit 0 where there is nothing to compare against (no spec, no Discovery, a spec
// with no criteria, a claim with no declared link): absence of a spec is not a violation, so a
// project that deletes its spec buys silence from this gate, not a rejection.
//
// The mention convention is NOT invented here. It is the one already fixed by
// scripts/verify-test-bindings.mjs: an id counts only inside a real test()/it() call — never in a
// comment or in prose — and it binds to its title through the middle dot that
// `test_name.startsWith(`${req_id} · `)` already requires there. The only widening is positional:
// the id may be any middle-dot segment, because this protocol also mandates the `FALSIFICACIÓN · `
// prefix, which a literal startsWith would forbid.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readDiscoveryHistory } from './verify-discovery-core.mjs';
import { hasLiteralTestDeclaration } from './verify-test-bindings.mjs';

export const USAGE = 'usage: verify-evidence-trace.mjs criteria --spec <spec-file> --tests <tests-dir> | verify-evidence-trace.mjs claims --feature <feature-slug>';
export const SPEC_PATH = 'docs/spec.md';
export const CRITERION_SHAPE = '- [ ] **AC<n>:**';
export const MENTION_SEPARATOR = '·';
export const LINK_FIELDS = ['linked_requirement_id', 'linked_ac_id'];

const CRITERION_LINE = /^[ \t]*[-*+][ \t]+\[[ xX]?\][ \t]*\*\*(AC\d+)\b[^*]*:\*\*/gmu;
const BOLD_RUN = /\*\*([^*]+)\*\*/gu;
const LEADING_TOKEN = /^[A-Za-z0-9-]*/u;
const IDENTIFIER = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/u;
const HAS_DIGIT = /\d/u;
// Proposes candidates only; hasLiteralTestDeclaration is the authority on whether each one is a
// real declaration, so this pattern may over-match comments and strings without loosening anything.
const CANDIDATE_TITLE = /(?:^|[^\w$])(?:test|it)(?:\.(?:skip|todo))?\s*\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/gu;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DEFAULT_IO = { exists: existsSync, read: readFileSync, list: readdirSync };

export function readCriterionIds(source) {
  return [...new Set([...source.matchAll(CRITERION_LINE)].map((match) => match[1]))];
}

/** Every identifier the spec DECLARES in bold: `**AC1:**`, `**T01 — ...**`, `**REQ-A01 ...**`. */
export function declaredIdentifiers(source) {
  const identifiers = new Set();
  for (const [, run] of source.matchAll(BOLD_RUN)) {
    const [token] = run.trim().match(LEADING_TOKEN);
    if (IDENTIFIER.test(token) && HAS_DIGIT.test(token)) identifiers.add(token);
  }
  return identifiers;
}

export function literalTestTitles(source) {
  const titles = [];
  for (const match of source.matchAll(CANDIDATE_TITLE)) {
    const title = match[1] ?? match[2];
    if (!titles.includes(title) && hasLiteralTestDeclaration(source, title)) titles.push(title);
  }
  return titles;
}

export function titleMentions(title, criterionId) {
  return title.split(MENTION_SEPARATOR).some((segment) => segment.trim() === criterionId);
}

function readTestSources(testsDir, io) {
  return io.list(testsDir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && TEST_FILE.test(entry.name))
    .map((entry) => io.read(join(entry.parentPath, entry.name), 'utf8'));
}

export function checkCriteria(projectRoot, specPath, testsDir, io = DEFAULT_IO) {
  const specFile = resolve(projectRoot, specPath);
  if (!io.exists(specFile)) {
    return { ok: true, message: `sin ${specPath}: no hay criterios declarados que cubrir.` };
  }
  const criteria = readCriterionIds(io.read(specFile, 'utf8'));
  if (criteria.length === 0) {
    return { ok: true, message: `${specPath} no declara ningún criterio con la forma "${CRITERION_SHAPE}".` };
  }
  let sources;
  try {
    sources = readTestSources(resolve(projectRoot, testsDir), io);
  } catch (error) {
    return { ok: false, code: 'EVIDENCE_TRACE_TESTS_UNREADABLE', message: `no se pueden listar las pruebas de ${testsDir}: ${error.message}` };
  }
  const mentioned = new Set();
  for (const source of sources) {
    for (const title of literalTestTitles(source)) {
      for (const criterionId of criteria) {
        if (titleMentions(title, criterionId)) mentioned.add(criterionId);
      }
    }
  }
  const uncovered = criteria.filter((criterionId) => !mentioned.has(criterionId));
  if (uncovered.length > 0) {
    return {
      ok: false,
      code: 'EVIDENCE_TRACE_CRITERION_UNCOVERED',
      message: `${uncovered.length} criterio(s) de ${specPath} sin ninguna prueba de ${testsDir} que los nombre: ${uncovered.join(', ')}`,
    };
  }
  return { ok: true, message: `${criteria.length} criterio(s) de ${specPath} nombrados por al menos una prueba de ${testsDir}.` };
}

export function checkClaims(projectRoot, featureSlug, io = DEFAULT_IO, readHistory = readDiscoveryHistory) {
  if (!io.exists(resolve(projectRoot, 'docs', 'discovery', featureSlug))) {
    return { ok: true, message: `${featureSlug} no tiene Discovery en docs/discovery/: no hay claims que verificar.` };
  }
  const specFile = resolve(projectRoot, SPEC_PATH);
  if (!io.exists(specFile)) {
    return { ok: true, message: `sin ${SPEC_PATH}: no hay identificadores declarados contra los cuales resolver los vínculos de ${featureSlug}.` };
  }
  let history;
  try {
    history = readHistory(projectRoot, featureSlug);
  } catch (error) {
    return { ok: false, code: error.code ?? 'EVIDENCE_TRACE_DISCOVERY_INVALID', message: `${featureSlug}: ${error.message}` };
  }
  // The decision in force is the leaf of the last run: a superseded packet documents a decision
  // that no longer holds, so a broken link inside it is history, not a live dangling reference.
  const current = history.runs.at(-1).history.at(-1);
  if (!current.packet) {
    return { ok: true, message: `la decisión vigente ${current.decision.decision_id} de ${featureSlug} está ${current.decision.status} y no lleva packet: no hay claims que verificar.` };
  }
  const declared = declaredIdentifiers(io.read(specFile, 'utf8'));
  const broken = [];
  let linked = 0;
  for (const claim of current.packet.research_snapshot.claims) {
    for (const field of LINK_FIELDS) {
      if ([null, undefined].includes(claim[field])) continue;
      linked += 1;
      if (!declared.has(claim[field])) broken.push(`${claim.claim_id}.${field} cita ${claim[field]}`);
    }
  }
  if (broken.length > 0) {
    return {
      ok: false,
      code: 'EVIDENCE_TRACE_CLAIM_REFERENCE_BROKEN',
      message: `${broken.length} vínculo(s) de la decisión vigente ${current.decision.decision_id} apuntan a un identificador que ${SPEC_PATH} no declara: ${broken.join('; ')}`,
    };
  }
  return { ok: true, message: `${linked} vínculo(s) de claims de la decisión vigente ${current.decision.decision_id} de ${featureSlug} resuelven contra ${SPEC_PATH}.` };
}

export function parseArgs(args) {
  if (args.length === 5 && args[0] === 'criteria' && args[1] === '--spec' && args[3] === '--tests' && args[2] !== '' && args[4] !== '') {
    return { command: 'criteria', spec: args[2], tests: args[4] };
  }
  if (args.length === 3 && args[0] === 'claims' && args[1] === '--feature' && FEATURE_SLUG.test(args[2])) {
    return { command: 'claims', feature: args[2] };
  }
  return null;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, checks = { criteria: checkCriteria, claims: checkClaims }) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const result = parsed.command === 'criteria'
    ? checks.criteria(cwd, parsed.spec, parsed.tests)
    : checks.claims(cwd, parsed.feature);
  if (!result.ok) {
    writeError(`REJECTED: ${result.code}: ${result.message}`);
    return 1;
  }
  write(`OK: ${result.message}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-evidence-trace.mjs')) {
  process.exitCode = main();
}
