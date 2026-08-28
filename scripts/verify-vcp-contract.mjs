#!/usr/bin/env node
// Guards the small set of user-visible protocol promises that previously drifted across docs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-vcp-contract.mjs check';
export const REQUIREMENTS = [
  ['README.md', /VCP ayuda a una IA/u, 'simple purpose statement'],
  ['README.md', /\.vibe\/vcp-runtime\/scripts\//u, 'project-local runtime command path'],
  ['INSTALL.md', /--project\b/u, 'explicit Bash project installation'],
  ['INSTALL.md', /-ProjectDir\b/u, 'explicit PowerShell project installation'],
  ['SKILL.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'runtime plan gate'],
  ['SKILL.md', /verify-security-baseline\.mjs/u, 'mechanical security baseline'],
  ['SKILL.md', /verify-backup-state\.mjs/u, 'verified Graphify backup'],
  ['README.md', /verify-backup-state\.mjs/u, 'verified Graphify backup'],
  ['README.md', /Modelo de seguridad y límites/u, 'native security-model link'],
  ['README.md', /Discovery: investigar antes de especificar/u, 'Discovery-first user workflow'],
  ['README.md', /verify-scope-diff\.mjs check/u, 'mechanical scope-vs-diff gate'],
  ['README.md', /verify-graphify-manifest\.mjs check/u, 'mechanical Graphify coverage gate'],
  ['README.md', /verify-audit-chain\.mjs/u, 'mechanical audit-chain gate'],
  ['SKILL.md', /--baseline <archivo>/u, 'security baseline for reviewed debt'],
  ['SKILL.md', /verify-receipt\.mjs commit/u, 'validate-and-write in one run'],
  ['SKILL.md', /contracts\/honest-limits\.json/u, 'honest limits declared as reviewable data'],
  ['README.md', /contracts\/honest-limits\.json/u, 'honest limits declared as reviewable data'],
  ['SKILL.md', /nunca reescribe historial por su cuenta/u, 'sealed commit never rewrites history'],
  ['SKILL.md', /Lo que no cubre/u, 'security baseline honest limit'],
  ['SKILL.md', /verify-audit-chain\.mjs append/u, 'audit lines are sealed, never hand-written'],
  ['skills/vibe-memory.md', /verify-audit-chain\.mjs append/u, 'audit lines are sealed, never hand-written'],
  ['skills/vibe-memory.md', /Lo que el gate no detecta/u, 'audit-chain honest limit'],
  ['SKILL.md', /verify-graphify-manifest\.mjs check/u, 'mechanical Graphify coverage gate'],
  ['SKILL.md', /El gate prueba contabilidad, no comprensión/u, 'Graphify coverage honest limit'],
  ['SECURITY.md', /dato no confiable/u, 'external-artifact trust boundary'],
  ['SECURITY.md', /no hace taint analysis/u, 'honest native-security limit'],
  ['SECURITY.md', /configuraciones peligrosas de GitHub Actions/u, 'documented GitHub Actions detection scope'],
  ['SECURITY.md', /no una frontera de confianza/u, 'PreToolUse hook honest limit'],
  ['SECURITY.md', /no autentica a quien/u, 'ZIP checksum honest limit'],
  ['SKILL.md', /Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC/u, 'receipt v2: all-AC-COMPLIANT requirement'],
  ['SKILL.md', /nunca re-ejecuta el comando ni prueba criptográficamente/u, 'receipt v2: command/result is reviewable evidence, not cryptographic proof'],
  ['SKILL.md', /`?scope\.declared_paths`? sigue siendo un writer set[\s\S]*verify-scope-diff\.mjs/u, 'receipt v2: scope declaration and separate diff gate'],
  ['SKILL.md', /\.vibe\/vcp-runtime\/scripts\/verify-spec-wordcap\.mjs/u, 'mechanical spec word-cap gate'],
  ['SKILL.md', /PHASE 0\.5 — DISCOVERY/u, 'Discovery-first protocol phase'],
  ['SKILL.md', /verify-discovery-core\.mjs/u, 'immutable Discovery history gate'],
  ['SKILL.md', /verify-scope-diff\.mjs check/u, 'mechanical scope-vs-diff gate'],
  ['templates/spec.md', /## Discovery \/ Investigación previa/u, 'Discovery evidence section in canonical spec'],
  ['templates/plan.md', /## Write-conflict preflight/u, 'canonical plan preflight section'],
  ['templates/plan.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'canonical plan gate command'],
  ['skills/spec-plan-templates.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'embedded plan gate command'],
];

// Narrow, phrase-level bans — never a bare word ban — so legitimate uses of "genuine" elsewhere
// (e.g. "a receipt produced by a genuine emit() run", "genuinely the same work") stay untouched.
// Each entry targets the exact collocation that overclaims what the PreToolUse RED gate proves;
// see scripts/pretooluse-red.mjs's own header comment for the honest claim these must match.
export const FORBIDDEN_PHRASES = [
  ['SKILL.md', /confirms a genuine RED/iu, 'overclaims RED as genuine instead of accepted/evidence-based'],
  ['SKILL.md', /\bgenuine RED\b/iu, 'overclaims RED as genuine instead of accepted/evidence-based'],
  ['SKILL.md', /if Skill `cyber-neo` is present/iu, 'depends on an external security skill'],
  ['skills/security-baseline.md', /fallback when cyber-neo/i, 'describes the native gate as an external-skill fallback'],
  ['SKILL.md', /fableultracode|cyber-neo/iu, 'depends on a named external skill in the live protocol'],
  ['skills/caveman-tdd.md', /cyber-neo/iu, 'depends on a named external security skill in a live checklist'],
  ['skills/orchestrator-opus.md', /fableultracode|cyber-neo/iu, 'depends on a named external skill in the orchestrator contract'],
  ['skills/vibe-memory.md', /cyber-neo/iu, 'depends on a named external security skill in the memory protocol'],
];

// --- Honest limits declared as reviewable data -------------------------------------------------
// The REQUIREMENTS above pin phrases without saying WHY each one matters, so an edit that
// "improves the wording" can weaken a limit and nobody learns which guarantee was lost. This half
// moves the limits into a data file where each one carries the reason it exists.
export const HONEST_LIMITS_FILE = 'contracts/honest-limits.json';
export const HONEST_LIMITS_SCHEMA = 'vcp.honest-limits/1';
const LIMIT_FIELDS = ['limit_id', 'file', 'phrase', 'why'];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const WINDOWS_DRIVE = /^[a-z]:/iu;
const MIN_WHY_LENGTH = 20;
// Padded filler defeats a length floor on its own ('placeholder placeholder' clears 20 characters),
// so the test is "the whole reason is nothing but filler tokens" rather than an anchored blocklist:
// at this floor an anchored list could only ever match strings the floor already rejected.
const FILLER_REASONS = new Set([
  'todo', 'tbd', 'tbc', 'na', 'n/a', 'none', 'null', 'nil', 'ninguno', 'ninguna', 'pendiente',
  'placeholder', 'relleno', 'lorem', 'ipsum', 'xxx', 'yyy', 'zzz', 'foo', 'bar', 'fixme', 'wip',
  'unknown', 'desconocido', 'porque', 'because', 'reason', 'motivo', 'razon', 'why', 'etc',
]);

function isWellFormedLimit(limit) {
  if (limit === null || typeof limit !== 'object') return false;
  return Object.keys(limit).length === LIMIT_FIELDS.length
    && LIMIT_FIELDS.every((field) => typeof limit[field] === 'string');
}

function escapesProject(file) {
  const normalized = file.trim().replaceAll('\\', '/');
  return normalized === ''
    || normalized.startsWith('/')
    || WINDOWS_DRIVE.test(normalized)
    || normalized.split('/').includes('..');
}

function isPlaceholderReason(why) {
  const tokens = why.toLowerCase().split(/\s+/u)
    .map((token) => token.replace(/^\W+|\W+$/gu, ''))
    .filter((token) => token !== '');
  return tokens.every((token) => FILLER_REASONS.has(token));
}

export function readHonestLimits(read) {
  let raw;
  try {
    raw = read(HONEST_LIMITS_FILE);
  } catch (error) {
    // A missing contract is a configuration error, never "zero limits to verify": degrading here
    // would make deleting one file the way to delete every guarantee it protects.
    throw new Error(`${HONEST_LIMITS_FILE}: cannot read (${error.message})`);
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${HONEST_LIMITS_FILE} is not valid JSON: ${error.message}`);
  }
  if (document?.schema !== HONEST_LIMITS_SCHEMA) {
    throw new Error(`${HONEST_LIMITS_FILE} must declare schema ${HONEST_LIMITS_SCHEMA}`);
  }
  if (!Array.isArray(document.limits)) throw new Error(`${HONEST_LIMITS_FILE} must contain a limits array`);
  if (document.limits.length === 0) throw new Error(`${HONEST_LIMITS_FILE} must declare at least one honest limit`);
  const seen = new Set();
  for (const limit of document.limits) {
    if (!isWellFormedLimit(limit)) {
      throw new Error(`every honest limit needs exactly a limit_id, file, phrase and why: ${JSON.stringify(limit)}`);
    }
    if (!KEBAB_CASE.test(limit.limit_id)) throw new Error(`limit_id must be kebab-case: ${limit.limit_id}`);
    if (limit.phrase.trim() === '') throw new Error(`phrase must not be empty: ${limit.limit_id}`);
    if (escapesProject(limit.file)) throw new Error(`the guarded file must stay inside the project: ${limit.file}`);
    if (limit.why.trim().length < MIN_WHY_LENGTH || isPlaceholderReason(limit.why)) {
      throw new Error(`${limit.limit_id} needs a real reason, not a placeholder`);
    }
    // Two entries under one id cannot both be reviewed as "the" reason for that limit, and the
    // second silently shadows the first in every report that keys by limit_id.
    if (seen.has(limit.limit_id)) throw new Error(`duplicate honest limit: ${limit.limit_id}`);
    seen.add(limit.limit_id);
  }
  return document.limits;
}

export function honestLimitViolations(read, limits) {
  const violations = [];
  for (const limit of limits) {
    let content;
    try {
      content = read(limit.file);
    } catch (error) {
      violations.push(`${limit.file}: honest limit ${limit.limit_id} cannot read (${error.message})`);
      continue;
    }
    // Literal containment, never a regex: an honest limit must not rest on a pattern somebody can
    // loosen. The reason travels with the violation because whoever broke the phrase needs to know
    // which guarantee was lost, not just that a test turned red.
    if (!content.includes(limit.phrase)) {
      violations.push(`${limit.file}: honest limit ${limit.limit_id} is no longer stated — ${limit.why}`);
    }
  }
  return violations;
}

export function contractViolations(read) {
  const violations = [];
  for (const [path, required, label] of REQUIREMENTS) {
    let content;
    try {
      content = read(path);
    } catch (error) {
      violations.push(`${path}: cannot read (${error.message})`);
      continue;
    }
    if (!required.test(content)) violations.push(`${path}: missing ${label}`);
    if (/at least 90%/iu.test(content)) violations.push(`${path}: stale 90% coverage policy`);
  }
  for (const [path, forbidden, label] of FORBIDDEN_PHRASES) {
    let content;
    try {
      content = read(path);
    } catch (error) {
      violations.push(`${path}: cannot read (${error.message})`);
      continue;
    }
    if (forbidden.test(content)) violations.push(`${path}: ${label}`);
  }
  return violations;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  // The declared limits are wired here and never inside contractViolations: that helper is called
  // with readers that answer prose for every path, so making it read the JSON contract would turn
  // its own callers into parse failures.
  const read = (path) => readFileSync(join(cwd, path), 'utf8');
  const violations = contractViolations(read);
  let limits = [];
  try {
    limits = readHonestLimits(read);
    violations.push(...honestLimitViolations(read, limits));
  } catch (error) {
    violations.push(error.message);
  }
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${violation}`);
    return 1;
  }
  write(`OK: ${REQUIREMENTS.length + FORBIDDEN_PHRASES.length} user-visible protocol contract checks pass; ${limits.length} honest limit${limits.length === 1 ? '' : 's'} verified.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-contract.mjs')) {
  process.exitCode = main();
}
