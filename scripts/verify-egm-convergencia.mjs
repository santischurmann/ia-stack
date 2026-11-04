#!/usr/bin/env node
// verify-egm-convergencia.mjs — la revisión goldfish (Elephant-Goldfish Model) de una spec, un plan o
// una pieza pública convergió antes de construir (PHASE 3.5 — REVISIÓN GOLDFISH).
//
// Usage:
//   node scripts/verify-egm-convergencia.mjs check <docs/egm/<pieza>.json>
//
// El registro (schema ia.egm-rondas/1) lo escribe el orquestador (el Elefante) después de cada ronda:
// tipo `diseno` | `publico`, riesgo, panel y, por ronda, cada revisor con `agente_nuevo` y su estado
// (`completed` | `not run`) y cada hallazgo con severidad (Blocker | Major | Nit) y resolución
// (fixed | contest | riesgo-aceptado | decline | abierto).
//
// Reglas, las de EGM (`egm-review-loop`) con un ajuste por costo:
// - Ronda limpia = todo el panel corrió con un agente NUEVO y no queda Blocker ni Major sin asentar.
//   Asentado = `contest` (refutado con evidencia legible) o `riesgo-aceptado` (lo decidió la persona).
//   `fixed` NO asienta: el arreglo lo confirma la ronda siguiente. `decline` sólo vale para un Nit.
// - Convergido = las últimas K rondas limpias seguidas. EGM pide K = 2. Se acepta K = 1 sólo con
//   riesgo bajo o medio y `motivo_una_ronda` escrito; alto o critico (plata, auth, migraciones,
//   seguridad) y toda pieza pública, siempre 2 (decisión del operador, 04-11-2026).
// - Panel obligatorio: diseño = los 7 de EGM; pieza pública de riesgo alto = los 7 + audiencia (11);
//   pieza pública de riesgo bajo o medio = audiencia + egm-design + egm-implementation-readiness (6).
// - Tope de 5 rondas: más sólo con `decision_humana_tope` registrada.
//
// LA HERIDA (04-11-2026): en Grobit se aprobó un plan de landing que la sesión que lo escribió veía
// completo; siete revisores sin contexto encontraron Blockers (testimonios inventados, funciones que
// el producto no tiene sin marcar «Próximamente»). Una revisión hecha en el mismo contexto no los veía.
//
// LÍMITE HONESTO: verifica el REGISTRO de las rondas, no que los revisores hayan sido de verdad
// subagentes sin contexto ni que hayan leído el documento; `agente_nuevo: true` lo declara el
// orquestador. Un registro ausente o ilegible nunca aprueba.

import { readFileSync } from 'node:fs';

// Nombres reales del plugin `egm@egm` 0.1.0 (frontmatter `name` de .claude-plugin/agents/*.md; en Claude
// Code el tipo de Agent es `egm:<nombre>`). El panel de diseño son los revisores de las cinco etapas
// de /egm:egm-review: zoom-out, comprehension, design + structural + style, zoom-out (otra vez),
// implementation-readiness + codebase-details + style.
const DISENO = ['egm-zoom-out', 'egm-comprehension', 'egm-design', 'egm-structural', 'egm-style', 'egm-implementation-readiness', 'egm-codebase-details'];
const AUDIENCIA = ['scroller', 'esceptico', 'primerizo', 'comprador'];
export const PANELES = Object.freeze({
  diseno: DISENO,
  publico: [...DISENO, ...AUDIENCIA],
  publico_medio: ['egm-design', 'egm-implementation-readiness', ...AUDIENCIA],
});

/** Decisión del operador (04-11-2026): una pieza pública de riesgo bajo o medio corre 6 revisores por ronda, no 9. */
export function panelRequerido(tipo, riesgo) {
  if (tipo === 'publico' && (riesgo === 'bajo' || riesgo === 'medio')) return PANELES.publico_medio;
  return PANELES[tipo];
}
const SEVERIDADES = ['Blocker', 'Major', 'Nit'];
const RESOLUCIONES = ['fixed', 'contest', 'riesgo-aceptado', 'decline', 'abierto'];
const ASENTADAS = ['contest', 'riesgo-aceptado'];
const RIESGOS = ['bajo', 'medio', 'alto', 'critico'];
const TOPE_RONDAS = 5;

export function rondaLimpia(ronda, panel) {
  for (const nombre of panel) {
    const r = ronda.revisores.find((x) => x.nombre === nombre);
    if (!r) return { limpia: false, motivo: `${nombre} falta en la ronda` };
    if (r.estado !== 'completed') return { limpia: false, motivo: `${nombre} quedó «${r.estado}» (not run ensucia la ronda)` };
    if (r.agente_nuevo !== true) return { limpia: false, motivo: `${nombre} no fue un agente nuevo` };
  }
  const sucio = ronda.hallazgos.find((h) => h.severidad !== 'Nit' && !ASENTADAS.includes(h.resolucion));
  if (sucio) return { limpia: false, motivo: `${sucio.severidad} ${sucio.id} sigue «${sucio.resolucion}»` };
  return { limpia: true };
}

function validar(reg) {
  if (reg?.schema !== 'ia.egm-rondas/1') return 'schema distinto de ia.egm-rondas/1';
  if (reg.tipo !== 'diseno' && reg.tipo !== 'publico') return `tipo inválido «${reg.tipo}» (diseno | publico)`;
  if (!RIESGOS.includes(reg.riesgo)) return `riesgo inválido «${reg.riesgo}» (${RIESGOS.join(' | ')})`;
  const requerido = panelRequerido(reg.tipo, reg.riesgo);
  const faltan = requerido.filter((n) => !(reg.panel ?? []).includes(n));
  if (faltan.length) return `el panel ${reg.tipo} exige ${faltan.join(', ')}`;
  if (!Array.isArray(reg.rondas) || reg.rondas.length === 0) return 'no hay ninguna ronda registrada';
  const ids = new Set();
  for (const [i, ronda] of reg.rondas.entries()) {
    if (ronda.n !== i + 1) return `las rondas no están en orden (posición ${i + 1} dice n=${ronda.n})`;
    if (!Array.isArray(ronda.revisores) || !Array.isArray(ronda.hallazgos)) return `ronda ${ronda.n}: faltan revisores o hallazgos`;
    for (const h of ronda.hallazgos) {
      if (ids.has(h.id)) return `hallazgo ${h.id} repetido`;
      ids.add(h.id);
      if (!SEVERIDADES.includes(h.severidad)) return `${h.id}: severidad inválida «${h.severidad}»`;
      if (!RESOLUCIONES.includes(h.resolucion)) return `${h.id}: resolución inválida «${h.resolucion}»`;
      if (h.resolucion === 'decline' && h.severidad !== 'Nit') return `${h.id}: decline sólo vale para un Nit`;
    }
  }
  return null;
}

export function checkConvergencia(reg) {
  const error = validar(reg);
  if (error) return { ok: false, reason: error };
  const k = reg.rondas_limpias_requeridas ?? 2;
  if (k === 1) {
    if (reg.riesgo === 'alto' || reg.riesgo === 'critico') return { ok: false, reason: 'una sola ronda limpia no alcanza con riesgo alto o critico' };
    if (reg.tipo === 'publico') return { ok: false, reason: 'una pieza pública siempre pide 2 rondas limpias (decisión del operador, 04-11-2026)' };
    if (typeof reg.motivo_una_ronda !== 'string' || reg.motivo_una_ronda.trim() === '') return { ok: false, reason: 'K = 1 exige motivo_una_ronda escrito' };
  }
  if (reg.rondas.length > TOPE_RONDAS && !reg.decision_humana_tope) {
    return { ok: false, reason: 'se pasó el tope de 5 rondas sin decision_humana_tope registrada' };
  }
  const falta = `hacen falta ${k} rondas limpias seguidas`;
  if (reg.rondas.length < k) return { ok: false, reason: `${falta} y hay ${reg.rondas.length} ronda(s)` };
  for (const ronda of reg.rondas.slice(-k)) {
    const r = rondaLimpia(ronda, reg.panel);
    if (!r.limpia) return { ok: false, reason: `${falta}: ronda ${ronda.n} no limpia: ${r.motivo}` };
  }
  return { ok: true, k, total: reg.rondas.length };
}

function main() {
  const [, , cmd, ruta, ...extra] = process.argv;
  if (cmd !== 'check' || !ruta || extra.length) {
    console.error('usage: verify-egm-convergencia.mjs check <registro.json>');
    process.exit(2);
  }
  let r;
  try {
    r = checkConvergencia(JSON.parse(readFileSync(ruta, 'utf8')));
  } catch (error) {
    r = { ok: false, reason: `no se pudo leer ${JSON.stringify(ruta)}: ${error.message}` };
  }
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  const reg = JSON.parse(readFileSync(ruta, 'utf8'));
  console.log(`OK: ${reg.pieza} convergió: ${r.k} rondas limpias seguidas de ${r.total} rondas`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-egm-convergencia.mjs')) main();
