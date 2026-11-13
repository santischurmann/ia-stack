#!/usr/bin/env node
// ventana.mjs — deja la ventana de contexto y los dos hooks de relevo en el proyecto, sin tocar nada a mano.
//
// Usage:
//   node scripts/ventana.mjs check   [--proyecto <dir>]   # 0 = está todo · 1 = falta algo o archivo inválido · 2 = uso
//   node scripts/ventana.mjs aplicar [--proyecto <dir>]   # 0 = quedó aplicado (o ya estaba) · 1 · 2
//
// Escribe `<dir>/.claude/settings.local.json` (el local, no el compartido) con tres cosas:
//   1. env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = contexto.ventana_max del contrato: el host compacta ahí;
//   2. hook UserPromptSubmit que corre context-guard.mjs (avisa el relevo y ordena el handoff);
//   3. hook SessionStart con matcher `compact` que corre `handoff.mjs mostrar` (devuelve el handoff
//      al contexto justo después de compactar).
// Los hooks se registran sólo si el runtime está instalado en el proyecto: nunca apuntan a un
// archivo que no está. Una variable válida y menor que la ventana se respeta (gasta menos); los
// hooks ajenos, las demás claves, su orden y el fin de línea del archivo se conservan.
//
// LÍMITES HONESTOS: no comprueba que el host lea el archivo ni que compacte. Un settings.local.json
// con comentarios no es JSON estricto: se informa y no se toca. No escribe en `settings.json`
// compartido ni en la configuración global: eso impondría la ventana a otras personas o proyectos.
// Los comandos de los hooks dependen de que el host los corra con bash (también en Windows).

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRATO = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'model-routing.json');
export const VARIABLE = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';
export const CMD_CONTEXTO = 'node "$CLAUDE_PROJECT_DIR/.ia-stack/runtime/scripts/context-guard.mjs"';
export const CMD_HANDOFF = 'node "$CLAUDE_PROJECT_DIR/.ia-stack/runtime/scripts/handoff.mjs" mostrar --proyecto "$CLAUDE_PROJECT_DIR"';
const MINIMO_DEL_HOST = 100000;
const INTENTOS = 3;
const INVALIDO = Object.freeze({ accion: 'invalido', texto: null, faltan: [] });

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const tiene = (entrada, comando) => esObjeto(entrada) && Array.isArray(entrada.hooks) && entrada.hooks.some((h) => h?.command === comando);
const entrada = (comando, matcher) => ({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: comando }] });

/**
 * Decide qué hacer con el settings.local.json. `texto` es su contenido o null; `conRuntime` dice si
 * los hooks aplican. Devuelve { accion: 'crear'|'fijar'|'respetar'|'invalido', texto, faltan }.
 */
export function planear(texto, ventana, conRuntime) {
  let o = {};
  if (texto !== null) {
    try {
      o = JSON.parse(texto.replace(/^﻿/u, ''));
    } catch {
      return INVALIDO;
    }
    if (!esObjeto(o) || (o.env !== undefined && !esObjeto(o.env)) || (o.hooks !== undefined && !esObjeto(o.hooks))) return INVALIDO;
    for (const evento of ['UserPromptSubmit', 'SessionStart']) if (o.hooks?.[evento] !== undefined && !Array.isArray(o.hooks[evento])) return INVALIDO;
  }
  const faltan = [];
  const valor = o.env?.[VARIABLE];
  if (!(typeof valor === 'string' && /^[1-9]\d*$/u.test(valor) && Number(valor) >= MINIMO_DEL_HOST && Number(valor) <= ventana)) faltan.push('ventana');
  if (conRuntime) {
    if (!(o.hooks?.UserPromptSubmit ?? []).some((e) => tiene(e, CMD_CONTEXTO))) faltan.push('hook-contexto');
    if (!(o.hooks?.SessionStart ?? []).some((e) => e?.matcher === 'compact' && tiene(e, CMD_HANDOFF))) faltan.push('hook-handoff');
  }
  if (texto !== null && faltan.length === 0) return { accion: 'respetar', texto, faltan };
  if (faltan.includes('ventana')) o.env = { ...o.env, [VARIABLE]: String(ventana) };
  if (faltan.some((f) => f.startsWith('hook-'))) o.hooks = { ...o.hooks };
  if (faltan.includes('hook-contexto')) o.hooks.UserPromptSubmit = [...(o.hooks.UserPromptSubmit ?? []), entrada(CMD_CONTEXTO)];
  if (faltan.includes('hook-handoff')) o.hooks.SessionStart = [...(o.hooks.SessionStart ?? []), entrada(CMD_HANDOFF, 'compact')];
  const lf = `${JSON.stringify(o, null, 2)}\n`;
  const nuevo = texto !== null && texto.includes('\r\n') ? lf.replaceAll('\n', '\r\n') : lf;
  return { accion: texto === null ? 'crear' : 'fijar', texto: nuevo, faltan };
}

const esperar50 = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);

/** Escribe por temporal + renombrado, 3 intentos en total (en Windows el renombrado puede fallar un instante). Lanza si no pudo. */
export function escribirAtomico(ruta, texto, { rename = renameSync, esperar = esperar50 } = {}) {
  const temporal = `${ruta}.${process.pid}.tmp`;
  try {
    writeFileSync(temporal, texto);
    for (let intento = 1; ; intento += 1) {
      try {
        rename(temporal, ruta);
        return;
      } catch (error) {
        if (intento === INTENTOS) throw error;
        esperar();
      }
    }
  } finally {
    rmSync(temporal, { force: true });
  }
}

export const rutaSettings = (proyecto) => join(proyecto, '.claude', 'settings.local.json');
export const hayRuntime = (proyecto) => ['context-guard.mjs', 'handoff.mjs'].every((f) => existsSync(join(proyecto, '.ia-stack', 'runtime', 'scripts', f)));

function leerVentana(ruta = CONTRATO) {
  const v = JSON.parse(readFileSync(ruta, 'utf8')).contexto?.ventana_max;
  if (!Number.isInteger(v) || v < MINIMO_DEL_HOST) throw new Error('contrato sin contexto.ventana_max');
  return v;
}

/** Plan para un proyecto en disco: lo usan el CLI y arranque.mjs. */
export function planDeProyecto(proyecto) {
  const ruta = rutaSettings(proyecto);
  return planear(existsSync(ruta) ? readFileSync(ruta, 'utf8') : null, leerVentana(), hayRuntime(proyecto));
}

function esProyecto(dir) {
  let real;
  let casa;
  try {
    real = realpathSync.native(dir);
    casa = realpathSync.native(homedir());
  } catch {
    return false;
  }
  const igual = process.platform === 'win32' ? real.toLowerCase() === casa.toLowerCase() : real === casa;
  return !igual && (existsSync(join(real, '.git')) || existsSync(join(real, '.ia-stack')));
}

function parsearArgs(argv) {
  const [comando, ...resto] = argv;
  if (comando !== 'check' && comando !== 'aplicar') throw new Error('uso: ventana.mjs check|aplicar [--proyecto <dir>]');
  let proyecto = process.cwd();
  for (let i = 0; i < resto.length; i += 1) {
    if (resto[i] !== '--proyecto') throw new Error(`argumento desconocido: ${resto[i]}`);
    proyecto = resto[(i += 1)];
    if (proyecto === undefined || proyecto === '') throw new Error('falta el valor de --proyecto');
  }
  proyecto = resolve(proyecto);
  if (!esProyecto(proyecto)) throw new Error('--proyecto no es un proyecto');
  return { comando, proyecto };
}

function main(argv) {
  let args;
  try {
    args = parsearArgs(argv);
  } catch (error) {
    console.error(`ventana: ${error.message}`);
    return 2;
  }
  let plan;
  try {
    plan = planDeProyecto(args.proyecto);
  } catch (error) {
    console.error(`REJECTED: ${error.message}`);
    return 1;
  }
  if (plan.accion === 'invalido') {
    console.error('REJECTED: settings.local.json inválido: no se toca');
    return 1;
  }
  const sinRuntime = hayRuntime(args.proyecto) ? '' : '\nhooks: sin runtime instalado, no se registran';
  if (plan.accion === 'respetar') {
    console.log(`OK: ventana y hooks en su lugar (.claude/settings.local.json)${sinRuntime}`);
    return 0;
  }
  if (args.comando === 'check') {
    console.error(`REJECTED: falta ${plan.faltan.join(', ')} (node scripts/ventana.mjs aplicar)`);
    return 1;
  }
  const ruta = rutaSettings(args.proyecto);
  try {
    mkdirSync(dirname(ruta), { recursive: true });
    escribirAtomico(ruta, plan.texto);
  } catch {
    console.error('REJECTED: no se pudo escribir settings.local.json');
    return 1;
  }
  console.log(`OK: aplicado ${plan.faltan.join(', ')} en .claude/settings.local.json${sinRuntime}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('ventana.mjs')) process.exitCode = main(process.argv.slice(2));
