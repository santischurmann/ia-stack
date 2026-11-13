#!/usr/bin/env node
// arranque.mjs — fase 0: resumen de arranque en 5 líneas como máximo (IA Stack 3.4.5).
//
// Usage:
//   node scripts/arranque.mjs [--proyecto <dir>] [--ventana <pct>] [--semana <pct>] [--sesiones <json>]
//
// Lee `.ia-stack/ESTADO.md`, `plan.json` (opcional) y `LECCIONES.md` (opcional). Imprime fase y tamaño,
// tareas en curso y pendientes, cupo, avisos (ventana ≥85 % = frenar lo no crítico; causas de lecciones
// repetidas en 30 días) y sesiones huérfanas. `--sesiones` recibe `[{id, tarea}]`.
// Exit 0 ok (también sin ESTADO.md, o con la plantilla sin llenar: proyecto nuevo), 1 si ESTADO.md pasa de 60 líneas, 2 uso incorrecto.
// LÍMITE HONESTO: el cupo es el que le pasan por argumento; sin argumento dice «desconocido», nunca
// lo estima. Una sesión huérfana sólo se detecta si quien invoca la lista en `--sesiones`.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { MAX_LINEAS, parseEstado } from './estado.mjs';
import { causasRepetidas } from './leccion.mjs';

export const UMBRAL_VENTANA = 85;

const norm = (t) => String(t ?? '').trim().toLowerCase();

/** Sesiones cuya tarea está `hecha` o no figura en la cola. Las de tareas `en pausa` no lo son. */
export function huerfanas(cola, sesiones) {
  return sesiones.filter((s) => {
    const propias = cola.filter((t) => norm(t.tarea) === norm(s.tarea));
    return propias.length === 0 || propias.every((t) => t.estado === 'hecha');
  });
}

const lista = (items, max = 3) => (items.length > max ? `${items.slice(0, max).join('; ')}; +${items.length - max}` : items.join('; '));
const pct = (v) => (v === null || v === undefined ? 'desconocido' : `${v}%`);

export function resumenArranque({ estado, ventana, semana, repetidas, huerfanas: huer, plan = null }) {
  const enCurso = estado.cola.filter((t) => t.estado === 'en curso');
  const pendientes = estado.cola.filter((t) => t.estado === 'pendiente');
  const lineas = [];
  lineas.push(`Fase ${estado.fase ?? 'desconocida'} · tamaño ${estado.tamano ?? 'desconocido'}${plan ? ` · plan ${plan.hechas}/${plan.total}` : ''}`);
  lineas.push(`En curso (${enCurso.length}): ${enCurso.length ? lista(enCurso.map((t) => `${t.tarea}${t.dueno ? ` [${t.dueno}]` : ''}`)) : 'ninguna'} · pendientes (${pendientes.length}): ${pendientes.length ? lista(pendientes.map((t) => t.tarea)) : 'ninguna'}`);
  lineas.push(`Cupo: ventana ${pct(ventana)} · semana ${pct(semana)}`);
  const avisos = [];
  if (typeof ventana === 'number' && ventana >= UMBRAL_VENTANA) avisos.push(`ventana al ${ventana}%: frenar todo lo no crítico hasta el reinicio`);
  if (repetidas.length > 0) avisos.push(`lecciones repetidas: ${lista(repetidas.map((r) => `${r.causa} (${r.veces})`), 2)}`);
  if (avisos.length > 0) lineas.push(`AVISO: ${avisos.join(' · ')}`);
  if (huer.length > 0) lineas.push(`Huérfanas (${huer.length}): ${lista(huer.map((h) => `${h.id} → ${h.tarea}`))}`);
  return lineas;
}

function leerPlan(proyecto) {
  for (const ruta of [join(proyecto, '.ia-stack', 'plan.json'), join(proyecto, 'docs', 'plan.json')]) {
    if (!existsSync(ruta)) continue;
    try {
      const tareas = JSON.parse(readFileSync(ruta, 'utf8')).tasks;
      if (Array.isArray(tareas)) return { total: tareas.length, hechas: tareas.filter((t) => t.status === 'done').length };
    } catch {
      return null;
    }
  }
  return null;
}

function usage() {
  console.error('usage: arranque.mjs [--proyecto <dir>] [--ventana <pct>] [--semana <pct>] [--sesiones <json>]');
  process.exit(2);
}

function pctArg(valor) {
  if (valor === undefined) return null;
  if (!/^\d+(\.\d+)?$/u.test(valor) || Number(valor) > 100) usage();
  return Number(valor);
}

function main() {
  let v;
  try {
    ({ values: v } = parseArgs({
      args: process.argv.slice(2),
      options: { proyecto: { type: 'string' }, ventana: { type: 'string' }, semana: { type: 'string' }, sesiones: { type: 'string' } },
      strict: true,
    }));
  } catch {
    usage();
  }
  const ventana = pctArg(v.ventana);
  const semana = pctArg(v.semana);
  let sesiones = [];
  if (v.sesiones !== undefined) {
    try {
      sesiones = JSON.parse(v.sesiones);
    } catch {
      usage();
    }
    if (!Array.isArray(sesiones)) usage();
  }
  const proyecto = v.proyecto ?? process.cwd();
  const rutaEstado = join(proyecto, '.ia-stack', 'ESTADO.md');
  const textoEstado = existsSync(rutaEstado) ? readFileSync(rutaEstado, 'utf8') : null;
  // Sin ESTADO.md, o con la plantilla del instalador todavía sin llenar (conserva sus <marcadores>):
  // no hay nada que retomar.
  if (textoEstado === null || textoEstado.includes('<número y nombre de la fase en curso>')) {
    console.log('proyecto nuevo: empezá por la fase 1');
    return;
  }
  const estado = parseEstado(textoEstado);
  if (estado.lineas > MAX_LINEAS) {
    console.error(`REJECTED: ESTADO.md tiene ${estado.lineas} líneas, tope ${MAX_LINEAS}: mové lo viejo a .ia-stack/historial.md`);
    process.exit(1);
  }
  const rutaLecciones = join(proyecto, '.ia-stack', 'LECCIONES.md');
  const repetidas = existsSync(rutaLecciones) ? causasRepetidas(readFileSync(rutaLecciones, 'utf8'), { dias: 30 }) : [];
  const lineas = resumenArranque({ estado, ventana, semana, repetidas, huerfanas: huerfanas(estado.cola, sesiones), plan: leerPlan(proyecto) });
  console.log(lineas.join('\n'));
}

if (process.argv[1] && process.argv[1].endsWith('arranque.mjs')) main();
