#!/usr/bin/env node
// verify-spec-wordcap.mjs — mechanical enforcement of templates/spec.md's own documented word
// cap ("~650 words for this document (excl. tables/code blocks)"). That cap was prose-only —
// nothing rejected a spec that ignored it. A spec nobody reads poisons every phase that follows
// (source: research/sources/protocolo-muralla.md point #8); this makes that a real gate.

import { readFileSync } from 'node:fs';

export const USAGE = 'usage: verify-spec-wordcap.mjs check <spec.md> [--quality]';
export const WORD_CAP = 650;
export const QUALITY_FLAG = '--quality';

const FENCED_CODE_BLOCK = /```[\s\S]*?```/gu;
const TABLE_LINE = /^\s*\|.*\|\s*$/gmu;
const REQUIRED_SECTIONS = [
  'Problem / Problema',
  'Discovery / Investigación previa',
  'Target Users / Usuarios',
  'Acceptance Criteria / Criterios de aceptación',
  'Constraints / Restricciones',
  'Non-Goals / No-Goals',
  'Stack & Dependencies',
  'Definition of Done (DoD)',
];
const ACCEPTANCE_LINE = /^\s*-\s*\[[ xX]\]\s*\*\*(AC\d+)(?:\s*\([^)]*\))?:\*\*.*$/gmu;
const UNRESOLVED = /\[NEEDS CLARIFICATION:/iu;
const PLACEHOLDER = /<[^>\n]+>/u;

/** Strips fenced code blocks and table rows (both excluded per the documented cap), then counts
 * whitespace-separated words in what remains. Headers/prose/lists all count — only code and
 * tables are exempt, matching the template's own stated exclusion. */
export function countSpecWords(content) {
  const withoutCode = content.replace(FENCED_CODE_BLOCK, '');
  const withoutTables = withoutCode.replace(TABLE_LINE, '');
  const words = withoutTables.split(/\s+/u).filter(Boolean);
  return words.length;
}

/**
 * Strict quality pass for an approved spec. It checks only reviewable shape: required sections,
 * non-placeholder prose, one or more unique AC ids and the documented GIVEN/WHEN/THEN (or
 * invariant) grammar. It cannot judge whether the product decision is good or whether an AC is
 * sufficient; those remain human/adversarial review.
 */
export function checkSpecQuality(content) {
  const violations = [];
  if (typeof content !== 'string' || content.trim() === '') return ['spec is empty'];
  const withoutCode = content.replace(FENCED_CODE_BLOCK, '');
  for (const section of REQUIRED_SECTIONS) {
    const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (!new RegExp(`^##\\s+${escapedSection}\\s*$`, 'mu').test(withoutCode)) {
      violations.push(`missing required section: ${section}`);
    }
  }
  if (UNRESOLVED.test(withoutCode)) violations.push('unresolved [NEEDS CLARIFICATION: ...] marker remains');
  if (PLACEHOLDER.test(withoutCode)) violations.push('placeholder angle-bracket text remains outside code blocks');
  const matches = [...withoutCode.matchAll(ACCEPTANCE_LINE)];
  if (matches.length === 0) {
    violations.push('no acceptance criterion with an AC id was found');
  }
  const seen = new Set();
  for (const match of matches) {
    const id = match[1];
    if (seen.has(id)) violations.push(`duplicate acceptance criterion id: ${id}`);
    seen.add(id);
    const line = match[0];
    if (!(/\bGIVEN\b[\s\S]*\bWHEN\b[\s\S]*\bTHEN\b/iu.test(line) || /\bTHE SYSTEM SHALL\b/iu.test(line))) {
      violations.push(`${id} must use GIVEN/WHEN/THEN or THE SYSTEM SHALL grammar`);
    }
  }
  return violations;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const readFile = options.readFile ?? readFileSync;
  const quality = args.includes(QUALITY_FLAG);
  const rest = args.filter((arg) => arg !== QUALITY_FLAG);
  if (rest.length !== 2 || rest[0] !== 'check' || rest[1] === '') {
    writeError(USAGE);
    return 2;
  }
  const path = rest[1];
  let content;
  try {
    content = readFile(path, 'utf8');
  } catch (error) {
    writeError(`REJECTED: unable to read ${path}: ${error.message}`);
    return 1;
  }
  const count = countSpecWords(content);
  if (count > WORD_CAP) {
    writeError(`REJECTED: ${path} is ${count} words (excl. tables/code blocks), over the ${WORD_CAP}-word cap — trim narration, a spec nobody reads poisons every phase that follows.`);
    return 1;
  }
  if (quality) {
    const violations = checkSpecQuality(content);
    if (violations.length > 0) {
      for (const item of violations) writeError(`REJECTED: ${path} quality: ${item}`);
      return 1;
    }
  }
  write(`OK: ${path} is ${count}/${WORD_CAP} words (excl. tables/code blocks)${quality ? '; quality shape valid' : ''}.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-spec-wordcap.mjs')) {
  process.exitCode = main();
}
