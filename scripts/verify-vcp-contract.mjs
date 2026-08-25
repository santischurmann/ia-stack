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
  ['SECURITY.md', /dato no confiable/u, 'external-artifact trust boundary'],
  ['SECURITY.md', /no hace taint analysis/u, 'honest native-security limit'],
  ['SECURITY.md', /configuraciones peligrosas de GitHub Actions/u, 'documented GitHub Actions detection scope'],
  ['SECURITY.md', /no una frontera de confianza/u, 'PreToolUse hook honest limit'],
  ['SECURITY.md', /no autentica a quien/u, 'ZIP checksum honest limit'],
  ['SKILL.md', /Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC/u, 'receipt v2: all-AC-COMPLIANT requirement'],
  ['SKILL.md', /nunca re-ejecuta el comando ni prueba criptográficamente/u, 'receipt v2: command/result is reviewable evidence, not cryptographic proof'],
  ['SKILL.md', /no lo llames "el scope\s*\nreal del plan"/u, 'receipt v2: scope.declared_paths honest limit'],
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
  const violations = contractViolations((path) => readFileSync(join(cwd, path), 'utf8'));
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${violation}`);
    return 1;
  }
  write(`OK: ${REQUIREMENTS.length + FORBIDDEN_PHRASES.length} user-visible protocol contract checks pass.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-contract.mjs')) {
  process.exitCode = main();
}
