#!/usr/bin/env node
// verify-egm-convergencia.mjs — la revisión EGM (lectores sin contexto) de una pieza convergió.
//
// Usage:
//   node scripts/verify-egm-convergencia.mjs check --pieza <nombre> --tamano chico|medio|grande [--proyecto <dir>]
//
// Lee las líneas `egm` de `.ia-stack/metricas.jsonl` (las escribe `scripts/metricas.mjs egm`).
// Reglas:
// - chico: pasa sin registro.
// - medio exige al menos 2 lectores por ronda; grande, al menos 4.
// - Converge si la última ronda tiene 0 altos.
// - Más de 2 rondas falla, salvo que la última línea traiga `decide_persona: true`.
// Exit 0 converge, 1 no converge o archivo ilegible, 2 uso incorrecto.
// LÍMITE HONESTO: verifica el REGISTRO de las rondas, no que los lectores hayan leído el documento.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const LECTORES_MINIMOS = Object.freeze({ chico: 0, medio: 2, grande: 4 });
const TOPE_RONDAS = 2;

/** `lineas`: objetos ya parseados de metricas.jsonl. */
export function checkConvergencia(lineas, pieza, tamano) {
  if (!(tamano in LECTORES_MINIMOS)) return { ok: false, reason: `tamaño inválido «${tamano}»` };
  if (tamano === 'chico') return { ok: true, rondas: 0 };
  const rondas = lineas.filter((l) => l?.tipo === 'egm' && l.pieza === pieza);
  if (rondas.length === 0) return { ok: false, reason: `sin rondas EGM registradas para «${pieza}»` };
  const minimo = LECTORES_MINIMOS[tamano];
  const pobre = rondas.find((r) => !(r.lectores >= minimo));
  if (pobre) return { ok: false, reason: `ronda ${pobre.ronda}: ${pobre.lectores} lectores y tamaño ${tamano} exige ${minimo}` };
  const ultima = rondas.at(-1);
  if (ultima.decide_persona === true) return { ok: true, rondas: rondas.length, decide: true };
  if (rondas.length > TOPE_RONDAS) return { ok: false, reason: `${rondas.length} rondas: el tope es ${TOPE_RONDAS} y la última no trae decide_persona` };
  if (ultima.altos > 0) return { ok: false, reason: `la última ronda deja ${ultima.altos} altos` };
  return { ok: true, rondas: rondas.length };
}

function usage() {
  console.error('usage: verify-egm-convergencia.mjs check --pieza <nombre> --tamano chico|medio|grande [--proyecto <dir>]');
  process.exit(2);
}

function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  if (cmd !== 'check') usage();
  let v;
  try {
    ({ values: v } = parseArgs({ args: resto, options: { pieza: { type: 'string' }, tamano: { type: 'string' }, proyecto: { type: 'string' } }, strict: true }));
  } catch {
    usage();
  }
  if (!v.pieza || !(v.tamano in LECTORES_MINIMOS)) usage();
  const ruta = join(v.proyecto ?? process.cwd(), '.ia-stack', 'metricas.jsonl');
  const lineas = [];
  if (existsSync(ruta)) {
    for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/u).filter((x) => x.trim() !== '')) {
      try {
        lineas.push(JSON.parse(l));
      } catch {
        console.error(`REJECTED: línea ilegible en ${ruta}`);
        process.exit(1);
      }
    }
  }
  const r = checkConvergencia(lineas, v.pieza, v.tamano);
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  console.log(v.tamano === 'chico' ? `OK: ${v.pieza} (chico) no corre EGM` : `OK: ${v.pieza} convergió en ${r.rondas} rondas${r.decide ? ' (decide la persona)' : ''}`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-egm-convergencia.mjs')) main();
