#!/usr/bin/env node
// verify-egm-convergencia.mjs — la revisión EGM (lectores sin contexto) de una pieza convergió.
//
// Usage:
//   node scripts/verify-egm-convergencia.mjs check --pieza <nombre> --tamano chico|medio|grande [--proyecto <dir>]
//
// Lee las líneas `egm` de `.ia-stack/metricas.jsonl` (las escribe `scripts/metricas.mjs egm`).
// La pieza decide el régimen; las listas viven en `contracts/model-routing.json`, `rondas.egm`.
// Una pieza fuera de las dos listas falla: un nombre mal escrito nunca cae en el régimen simple.
//
// RÉGIMEN RONDA (`piezas`: spec, plan-<id>, publicar, protocolo). Mira sólo la última serie: los
// registros desde el último con `ronda: 1`.
// - `spec` en chico pasa (en chico no hay spec).
// - Rondas 1, 2, …, n contiguas; cada una con el mínimo de lectores (chico 2, medio 2, grande 4).
// - Entre `minimo` (5) y `maximo` (10) rondas.
// - Converge si la última es limpia: 0 hallazgos aplicados de cualquier severidad.
// - La décima no limpia pasa sólo con `decide_persona: true`; más de 10 falla siempre.
//
// RÉGIMEN SIMPLE (`piezas_simples`: preview), igual que en 3.4.4.
// - chico: pasa sin registro. Medio exige 2 lectores por ronda; grande, 4.
// - Converge si la última ronda tiene 0 altos.
// - Más de 2 rondas falla, salvo que la última línea traiga `decide_persona: true`.
//
// Exit 0 converge, 1 no converge o archivo ilegible, 2 uso incorrecto.
// LÍMITE HONESTO: verifica el REGISTRO de las rondas, no que los lectores hayan leído el documento
// ni qué modelo eran.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const contrato = JSON.parse(readFileSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'contracts', 'model-routing.json'), 'utf8'));

export const LECTORES_MINIMOS = Object.freeze({ chico: 0, medio: 2, grande: 4 });
const LECTORES_RONDA = Object.freeze({ chico: 2, medio: 2, grande: 4 });
const TOPE_RONDAS = 2;

/** Objetos de un `metricas.jsonl`. Ausente → []. Saltea líneas vacías; una línea rota lanza con su número. */
export function leerMetricas(ruta) {
  if (!existsSync(ruta)) return [];
  const lineas = [];
  readFileSync(ruta, 'utf8').split(/\r?\n/u).forEach((l, i) => {
    if (l.trim() === '') return;
    try {
      lineas.push(JSON.parse(l));
    } catch {
      throw new Error(`metricas inválidas: línea ${i + 1}`);
    }
  });
  return lineas;
}

const coincide = (patron, pieza) => (patron.endsWith('-*') ? pieza.startsWith(patron.slice(0, -1)) && pieza.length > patron.length - 1 : patron === pieza);

/** `'ronda'`, `'simple'` o `null` (pieza desconocida). Comparación exacta; `plan-*` exige un id. */
export function regimenDe(pieza, egm) {
  if (typeof pieza !== 'string' || pieza.includes('*')) return null;
  if (egm.piezas.some((p) => coincide(p, pieza))) return 'ronda';
  if (egm.piezas_simples.some((p) => coincide(p, pieza))) return 'simple';
  return null;
}

function checkSimple(rondas, pieza, tamano) {
  if (tamano === 'chico') return { ok: true, rondas: 0 };
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

function checkRonda(todas, pieza, tamano, egm) {
  if (pieza === 'spec' && tamano === 'chico') return { ok: true, rondas: 0 };
  if (todas.length === 0) return { ok: false, reason: `sin rondas EGM registradas para «${pieza}»` };
  const serie = todas.slice(Math.max(0, todas.findLastIndex((r) => r.ronda === 1)));
  const minimo = LECTORES_RONDA[tamano];
  for (const [i, r] of serie.entries()) {
    if (!Number.isInteger(r.ronda) || r.ronda < 1) return { ok: false, reason: `registro inválido: ronda «${r.ronda}»` };
    if (r.ronda !== i + 1) return { ok: false, reason: `rondas no contiguas: se esperaba ${i + 1} y vino ${r.ronda}` };
  }
  const pobre = serie.find((r) => !(r.lectores >= minimo));
  if (pobre) return { ok: false, reason: `ronda ${pobre.ronda}: ${pobre.lectores} lectores y se exigen ${minimo}` };
  const n = serie.length;
  if (n > egm.maximo) return { ok: false, reason: `${n} rondas superan el máximo de ${egm.maximo}: decide la persona` };
  if (n < egm.minimo) return { ok: false, reason: `${n} rondas: el mínimo es ${egm.minimo}` };
  const u = serie.at(-1);
  const [a, m, b] = [u.altos, u.medios, u.bajos].map((x) => (Number.isFinite(x) ? x : 1));
  if (a + m + b === 0) return { ok: true, rondas: n };
  if (n === egm.maximo && u.decide_persona === true) return { ok: true, rondas: n, decide: true };
  return { ok: false, reason: `la ronda ${n} no es limpia (${a} altos, ${m} medios, ${b} bajos)${n === egm.maximo ? ': decide la persona' : ''}` };
}

/** `lineas`: objetos ya parseados de metricas.jsonl. `egm` existe para probar un contrato roto. */
export function checkConvergencia(lineas, pieza, tamano, egm = contrato.rondas?.egm) {
  if (!(tamano in LECTORES_MINIMOS)) return { ok: false, reason: `tamaño inválido «${tamano}»` };
  if (!egm || typeof egm !== 'object') return { ok: false, reason: 'contrato sin rondas.egm' };
  for (const lista of ['piezas', 'piezas_simples']) {
    if (!Array.isArray(egm[lista])) return { ok: false, reason: `contrato sin rondas.egm.${lista}` };
  }
  const regimen = regimenDe(pieza, egm);
  if (regimen === null) return { ok: false, reason: `pieza desconocida «${pieza}»` };
  const rondas = lineas.filter((l) => l?.tipo === 'egm' && l.pieza === pieza);
  return regimen === 'ronda' ? checkRonda(rondas, pieza, tamano, egm) : checkSimple(rondas, pieza, tamano);
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
  let r;
  try {
    r = checkConvergencia(leerMetricas(join(v.proyecto ?? process.cwd(), '.ia-stack', 'metricas.jsonl')), v.pieza, v.tamano);
  } catch (error) {
    r = { ok: false, reason: error.message };
  }
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  console.log(r.rondas === 0 ? `OK: ${v.pieza} (chico) no corre EGM` : `OK: ${v.pieza} convergió en ${r.rondas} rondas${r.decide ? ' (decide la persona)' : ''}`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-egm-convergencia.mjs')) main();
