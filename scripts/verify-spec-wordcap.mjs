#!/usr/bin/env node
// verify-spec-wordcap.mjs — mechanical enforcement of templates/spec.md's own documented word
// cap ("~650 words for this document (excl. tables/code blocks)"). That cap was prose-only —
// nothing rejected a spec that ignored it. A spec nobody reads poisons every phase that follows
// (source: research/sources/protocolo-muralla.md point #8); this makes that a real gate.

import { readFileSync } from 'node:fs';

export const USAGE = 'usage: verify-spec-wordcap.mjs check <spec.md>';
export const WORD_CAP = 650;

const FENCED_CODE_BLOCK = /```[\s\S]*?```/gu;
const TABLE_LINE = /^\s*\|.*\|\s*$/gmu;

/** Strips fenced code blocks and table rows (both excluded per the documented cap), then counts
 * whitespace-separated words in what remains. Headers/prose/lists all count — only code and
 * tables are exempt, matching the template's own stated exclusion. */
export function countSpecWords(content) {
  const withoutCode = content.replace(FENCED_CODE_BLOCK, '');
  const withoutTables = withoutCode.replace(TABLE_LINE, '');
  const words = withoutTables.split(/\s+/u).filter(Boolean);
  return words.length;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const readFile = options.readFile ?? readFileSync;
  if (args.length !== 2 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const path = args[1];
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
  write(`OK: ${path} is ${count}/${WORD_CAP} words (excl. tables/code blocks).`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-spec-wordcap.mjs')) {
  process.exitCode = main();
}
