#!/usr/bin/env node
// metricas.mjs — métricas del protocolo en `.ia-stack/metricas.jsonl`, una línea JSON por llamada (IA Stack 3.4.5).
//
// Usage:
//   node scripts/metricas.mjs bloque --fase <n> --modelo <m> [--ventana <pct>] [--semana <pct>]
//   node scripts/metricas.mjs egm --pieza <nombre> --lectores <n> --ronda <n> --altos <n> --medios <n> --bajos <n> [--decide-persona]
//   node scripts/metricas.mjs cierre --retrabajos <n> --escaladas <n>
//   node scripts/metricas.mjs resumen
//   (todos aceptan [--proyecto <dir>])
//
// `ts` va en ISO 8601 (JSON). Un cupo que no se conoce se guarda como `null`, nunca estimado.
// Exit 0 ok, 1 valor inválido o archivo ilegible, 2 uso incorrecto.
// LÍMITE HONESTO: registra lo que la sesión declara; no mide tokens ni cupo por sí mismo.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const entero = (v) => (typeof v === 'string' && /^\d+$/u.test(v) ? Number(v) : null);
const pct = (v) => (typeof v === 'string' && /^\d+(\.\d+)?$/u.test(v) && Number(v) <= 100 ? Number(v) : null);

export function construirRegistro(tipo, v, ahora = new Date()) {
  const ts = ahora.toISOString();
  const falla = (campo) => ({ ok: false, reason: `valor inválido o ausente: --${campo}` });
  if (tipo === 'bloque') {
    const fase = entero(v.fase);
    if (fase === null) return falla('fase');
    if (typeof v.modelo !== 'string' || v.modelo.trim() === '') return falla('modelo');
    const cupo = {};
    for (const campo of ['ventana', 'semana']) {
      cupo[campo] = v[campo] === undefined ? null : pct(v[campo]);
      if (v[campo] !== undefined && cupo[campo] === null) return falla(campo);
    }
    return { ok: true, registro: { tipo, ts, fase, modelo: v.modelo.trim(), ventana: cupo.ventana, semana: cupo.semana } };
  }
  if (tipo === 'egm') {
    const campos = {};
    if (typeof v.pieza !== 'string' || v.pieza.trim() === '') return falla('pieza');
    for (const campo of ['lectores', 'ronda', 'altos', 'medios', 'bajos']) {
      campos[campo] = entero(v[campo]);
      if (campos[campo] === null) return falla(campo);
    }
    return { ok: true, registro: { tipo, ts, pieza: v.pieza.trim(), ...campos, ...(v['decide-persona'] ? { decide_persona: true } : {}) } };
  }
  if (tipo === 'cierre') {
    const retrabajos = entero(v.retrabajos);
    if (retrabajos === null) return falla('retrabajos');
    const escaladas = entero(v.escaladas);
    if (escaladas === null) return falla('escaladas');
    return { ok: true, registro: { tipo, ts, retrabajos, escaladas } };
  }
  return { ok: false, reason: `tipo desconocido «${tipo}»` };
}

export function resumir(registros) {
  const bloques = registros.filter((r) => r.tipo === 'bloque');
  const egm = registros.filter((r) => r.tipo === 'egm');
  const cierres = registros.filter((r) => r.tipo === 'cierre');
  const porModelo = {};
  const porFase = {};
  for (const b of bloques) {
    porModelo[b.modelo] = (porModelo[b.modelo] ?? 0) + 1;
    porFase[b.fase] = (porFase[b.fase] ?? 0) + 1;
  }
  const ventanas = bloques.map((b) => b.ventana).filter((x) => typeof x === 'number');
  const { tipo, ts, ...ultima } = egm.at(-1) ?? {};
  return {
    bloques: bloques.length,
    porModelo,
    porFase,
    ventanaMax: ventanas.length > 0 ? Math.max(...ventanas) : null,
    egm: { rondas: egm.length, ultima: egm.length > 0 ? ultima : null },
    cierres: {
      cierres: cierres.length,
      retrabajos: cierres.reduce((s, c) => s + c.retrabajos, 0),
      escaladas: cierres.reduce((s, c) => s + c.escaladas, 0),
    },
  };
}

const lista = (o) => Object.entries(o).map(([k, n]) => `${k} ${n}`).join(', ') || 'ninguno';

function usage() {
  console.error('usage: metricas.mjs bloque --fase <n> --modelo <m> [--ventana <pct>] [--semana <pct>] | egm --pieza <nombre> --lectores <n> --ronda <n> --altos <n> --medios <n> --bajos <n> [--decide-persona] | cierre --retrabajos <n> --escaladas <n> | resumen  (con [--proyecto <dir>])');
  process.exit(2);
}

function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  if (!['bloque', 'egm', 'cierre', 'resumen'].includes(cmd)) usage();
  let v;
  try {
    ({ values: v } = parseArgs({
      args: resto,
      options: {
        fase: { type: 'string' }, modelo: { type: 'string' }, ventana: { type: 'string' }, semana: { type: 'string' },
        pieza: { type: 'string' }, lectores: { type: 'string' }, 'decide-persona': { type: 'boolean' }, ronda: { type: 'string' }, altos: { type: 'string' }, medios: { type: 'string' }, bajos: { type: 'string' },
        retrabajos: { type: 'string' }, escaladas: { type: 'string' }, proyecto: { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    usage();
  }
  const ruta = join(v.proyecto ?? process.cwd(), '.ia-stack', 'metricas.jsonl');
  if (cmd === 'resumen') {
    if (!existsSync(ruta)) {
      console.log('sin métricas registradas');
      return;
    }
    const registros = [];
    let ilegibles = 0;
    for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/u).filter((x) => x.trim() !== '')) {
      try {
        registros.push(JSON.parse(l));
      } catch {
        ilegibles += 1;
      }
    }
    if (ilegibles > 0) {
      console.error(`REJECTED: ${ilegibles} línea(s) ilegible(s) en ${ruta}`);
      process.exit(1);
    }
    const r = resumir(registros);
    console.log([
      `bloques: ${r.bloques} (por fase: ${lista(r.porFase)}; por modelo: ${lista(r.porModelo)})`,
      `ventana máx: ${r.ventanaMax === null ? 'desconocida' : `${r.ventanaMax}%`}`,
      `egm: ${r.egm.rondas} ronda${r.egm.rondas === 1 ? '' : 's'}${r.egm.ultima ? ` (última: ${r.egm.ultima.altos} altos, ${r.egm.ultima.medios} medios, ${r.egm.ultima.bajos} bajos)` : ''}`,
      `cierres: ${r.cierres.cierres} (retrabajos ${r.cierres.retrabajos}, escaladas ${r.cierres.escaladas})`,
    ].join('\n'));
    return;
  }
  const r = construirRegistro(cmd, v);
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  mkdirSync(dirname(ruta), { recursive: true });
  appendFileSync(ruta, `${JSON.stringify(r.registro)}\n`);
  console.log(`OK: ${cmd} registrado`);
}

if (process.argv[1] && process.argv[1].endsWith('metricas.mjs')) main();
