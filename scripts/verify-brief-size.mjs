#!/usr/bin/env node
// verify-brief-size.mjs — tope mecánico del brief de un subagente (IA Stack 3.4.1).
//
// Usage:
//   node scripts/verify-brief-size.mjs check <brief.md>
//
// Un brief pasa si pesa 4000 tokens o menos (subgrafo de `graphify query` pegado incluido) y declara
// 3 archivos o menos en exactamente una línea `ARCHIVOS: a, b, c` (`ARCHIVOS: ninguno` = 0).
//
// LÍMITE HONESTO: el estimador es ceil(caracteres / 4), aproximado a propósito y sin dependencias; no
// es el tokenizador del modelo. Y verifica lo DECLARADO: no sabe si el subagente abre más archivos que
// los que el brief lista. Un brief vacío, ilegible o sin la línea ARCHIVOS nunca aprueba por defecto.

import { readFileSync } from 'node:fs';

export const MAX_TOKENS = 4000;
export const MAX_FILES = 3;
const LINEA_ARCHIVOS = /^ARCHIVOS:[ \t]*(.*)$/gm;

export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function checkBrief(text) {
  if (text.trim() === '') return { ok: false, reason: 'el brief está vacío' };
  const lineas = [...text.matchAll(LINEA_ARCHIVOS)];
  if (lineas.length !== 1) {
    return { ok: false, reason: `el brief debe declarar exactamente una línea ARCHIVOS: (hay ${lineas.length})` };
  }
  const valor = lineas[0][1].trim();
  if (valor === '') return { ok: false, reason: 'la línea ARCHIVOS: está vacía; usá "ARCHIVOS: ninguno" si no hay' };
  const archivos = valor.toLowerCase() === 'ninguno' ? [] : valor.split(',').map((p) => p.trim());
  if (archivos.some((p) => p === '')) return { ok: false, reason: 'la línea ARCHIVOS: tiene una entrada vacía' };
  const tokens = estimateTokens(text);
  if (tokens > MAX_TOKENS) return { ok: false, reason: `el brief pesa ${tokens} tokens estimados, tope ${MAX_TOKENS}` };
  if (archivos.length > MAX_FILES) {
    return { ok: false, reason: `el brief declara ${archivos.length} archivos, tope ${MAX_FILES}` };
  }
  return { ok: true, tokens, archivos: archivos.length };
}

function usage(message) {
  if (message) console.error(`usage: ${message}`);
  console.error('usage: verify-brief-size.mjs check <brief.md>');
  process.exit(2);
}

function main() {
  const [, , command, briefPath, ...extra] = process.argv;
  if (command !== 'check' || !briefPath || extra.length !== 0) usage();
  let text;
  try {
    text = readFileSync(briefPath, 'utf8');
  } catch (error) {
    console.error(`REJECTED: no se pudo leer el brief ${JSON.stringify(briefPath)}: ${error.message}`);
    process.exit(1);
  }
  const result = checkBrief(text);
  if (!result.ok) {
    console.error(`REJECTED: ${result.reason}`);
    process.exit(1);
  }
  console.log(`OK: brief de ${result.tokens} tokens estimados (ceil(chars/4)) y ${result.archivos} archivos`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-brief-size.mjs')) main();
