#!/usr/bin/env node
// context-guard.mjs — hook que mide el contexto de MENSAJES de la sesión y avisa antes del tope.
//
// Usage (hook UserPromptSubmit de Claude Code; recibe por stdin el JSON con `transcript_path`):
//   node .ia-stack/runtime/scripts/context-guard.mjs --rol orquestador
//   IA_STACK_ROL=subsesion node .ia-stack/runtime/scripts/context-guard.mjs
//   node scripts/context-guard.mjs --transcript <transcript.jsonl> [--rol orquestador|subsesion]
//
// Los topes y el umbral salen de contracts/model-routing.json § contexto (tope_orquestador,
// tope_subsesion, aviso_desde), buscado junto al script (../contracts/): ninguna cifra vive acá.
// Con la ventana (ventana_max) llena ordena compactar ya, en cualquier rol. Antes, a
// handoff.antes_de_compactar × ventana_max, ordena escribir el handoff (contexto.handoff.archivo):
// es la última oportunidad de la sesión que pasó de largo el relevo. Un solo mensaje, el del umbral
// más alto alcanzado: ventana llena > handoff inminente > tope de relevo > aviso.
// Con menos del umbral calla. Desde el umbral avisa con tokens y tope. En el tope ordena cerrar:
// commit del estado, resumen en .ia-stack/ESTADO.md y compactar o handoff.
//
// SIEMPRE sale 0: un hook que falla no puede trabar la sesión. Un error (transcript ilegible,
// contrato roto, argumento inválido) va a stderr con el prefijo `context-guard:` y no avisa nada.
//
// LÍMITES HONESTOS: estima con ceil(caracteres / 4) sobre el texto de los mensajes user/assistant
// (tool_use y tool_result serializados), no con el tokenizador del modelo. No cuenta los ~80K fijos
// de la sesión (conectores, memoria, instrucciones): el tope se mide sobre mensajes. Un hook
// UserPromptSubmit sólo corre en sesiones con prompt de usuario: los subagentes (Agent) NO lo disparan,
// así que el tope de 60K en subagentes lo controla el brief, no este hook. El rol de una subsesión se
// fija con la variable de entorno IA_STACK_ROL=subsesion (o --rol). Y NO actúa solo:
// no commitea, no compacta ni corta la sesión; sólo dice qué hacer, y si el agente lo ignora, sigue.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRATO = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'model-routing.json');
const ROLES = ['orquestador', 'subsesion'];
const PLANTILLA = 'templates/estado/HANDOFF.md';

function charsDeContenido(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  let chars = 0;
  for (const bloque of content) {
    const texto = typeof bloque === 'string' ? bloque : bloque?.type === 'text' ? String(bloque.text) : JSON.stringify(bloque);
    chars += texto.length;
  }
  return chars;
}

/**
 * Tokens estimados de los mensajes user/assistant de un transcript JSONL (ignora lo que no sea JSON).
 * Reinicia el conteo en cada `compact_boundary` / `isCompactSummary` (lo anterior ya no está en el
 * contexto) y saltea las líneas `isSidechain` (subagentes: no son contexto del orquestador).
 */
export function contarTokens(jsonl) {
  let tokens = 0;
  for (const linea of jsonl.split('\n')) {
    let obj;
    try {
      obj = JSON.parse(linea);
    } catch {
      continue;
    }
    if (obj?.subtype === 'compact_boundary' || obj?.isCompactSummary === true) tokens = 0;
    if (obj?.type !== 'user' && obj?.type !== 'assistant') continue;
    if (obj.isSidechain === true) continue;
    tokens += Math.ceil(charsDeContenido(obj.message?.content) / 4);
  }
  return tokens;
}

/** Lee y valida contracts/model-routing.json § contexto. Lanza un Error con el motivo. */
export function leerContrato(ruta = CONTRATO) {
  let contexto;
  try {
    contexto = JSON.parse(readFileSync(ruta, 'utf8')).contexto;
  } catch (error) {
    throw new Error(`no se pudo leer el contrato ${ruta}: ${error.message}`);
  }
  if (!contexto || typeof contexto !== 'object') throw new Error(`el contrato ${ruta} no trae la sección contexto`);
  for (const campo of ['tope_orquestador', 'tope_subsesion']) {
    if (!Number.isFinite(contexto[campo]) || contexto[campo] <= 0) throw new Error(`contexto.${campo} del contrato debe ser un número positivo`);
  }
  if (!(contexto.aviso_desde > 0 && contexto.aviso_desde <= 1)) throw new Error('contexto.aviso_desde del contrato debe estar en (0, 1]');
  const ventana = contexto.ventana_max;
  if (ventana !== undefined && !(Number.isFinite(ventana) && ventana >= contexto.tope_orquestador && ventana >= contexto.tope_subsesion)) {
    throw new Error('contexto.ventana_max del contrato debe ser un número no menor que los topes');
  }
  // Misma validación que handoff.mjs leerTopes, repetida a propósito: este hook no importa otros scripts,
  // así un runtime a medio copiar no lo rompe.
  const h = contexto.handoff;
  const entero = (v) => Number.isInteger(v) && v > 0;
  if (!(h !== null && typeof h === 'object' && typeof h.archivo === 'string' && h.archivo !== '' && entero(h.max_lineas) && entero(h.max_caracteres) && entero(h.max_horas) && h.antes_de_compactar > 0 && h.antes_de_compactar <= 1)) {
    throw new Error('contrato sin contexto.handoff');
  }
  const handoff = { archivo: h.archivo, max_lineas: h.max_lineas, max_caracteres: h.max_caracteres, max_horas: h.max_horas, antes_de_compactar: h.antes_de_compactar };
  return { tope_orquestador: contexto.tope_orquestador, tope_subsesion: contexto.tope_subsesion, aviso_desde: contexto.aviso_desde, ventana_max: ventana, handoff };
}

/** null por debajo del umbral; AVISO de handoff desde el umbral (70 %); ORDEN de cerrar desde el tope. */
export function evaluar(tokens, rol, contrato) {
  const tope = rol === 'subsesion' ? contrato.tope_subsesion : contrato.tope_orquestador;
  const ratio = tokens / tope;
  const dato = `${tokens} de ${tope} tokens de mensajes (${Math.floor(ratio * 100)} %, rol ${rol})`;
  const { archivo, antes_de_compactar: antes } = contrato.handoff;
  const resumen = `el handoff en ${archivo} (plantilla ${PLANTILLA}: objetivo, decisiones, archivos clave, pendientes, cómo retomar)`;
  if (contrato.ventana_max !== undefined && tokens >= contrato.ventana_max) {
    return `ORDEN: ventana de ${contrato.ventana_max} tokens llena, ${dato}. Guardá el estado en .ia-stack/ESTADO.md y compactá ya (/compact): ninguna sesión trabaja con más contexto que la ventana.`;
  }
  if (contrato.ventana_max !== undefined && tokens >= antes * contrato.ventana_max) {
    return `ORDEN: escribí el handoff en ${archivo} ahora: la compactación es inminente, ${dato}. Plantilla: ${PLANTILLA}. Después de compactar el host te lo vuelve a mostrar; lo que no quede ahí se puede perder.`;
  }
  if (ratio >= 1) {
    return `ORDEN: contexto al tope, ${dato}. Cerrá ya: 1) commit del estado; 2) resumen en .ia-stack/ESTADO.md y ${resumen}; 3) compactar o handoff a una sesión nueva. No sigas trabajando sobre este contexto.`;
  }
  if (ratio >= contrato.aviso_desde) {
    return `AVISO: ${dato}. Umbral de handoff: cerrá la tarea en curso, commiteá el estado, actualizá .ia-stack/ESTADO.md, escribí ${resumen} y hacé el handoff o compactá ahora, no en el tope.`;
  }
  return null;
}

/** Rol: `--rol` gana; si no, la variable IA_STACK_ROL (los subagentes/subsesiones la heredan); si no, orquestador. */
export function parsearArgs(argv, env = process.env) {
  const args = { transcript: undefined, rol: 'orquestador' };
  if (env.IA_STACK_ROL !== undefined && env.IA_STACK_ROL !== '') {
    if (!ROLES.includes(env.IA_STACK_ROL)) throw new Error(`IA_STACK_ROL inválido (${ROLES.join('|')}): ${env.IA_STACK_ROL}`);
    args.rol = env.IA_STACK_ROL;
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--transcript') {
      args.transcript = argv[(i += 1)];
      if (args.transcript === undefined) throw new Error('falta el valor de --transcript');
    } else if (argv[i] === '--rol') {
      args.rol = argv[(i += 1)];
      if (!ROLES.includes(args.rol)) throw new Error(`--rol inválido (${ROLES.join('|')}): ${args.rol}`);
    } else {
      throw new Error(`argumento desconocido: ${argv[i]}`);
    }
  }
  return args;
}

/** Corre el guard sin tocar el proceso: devuelve lo que hay que escribir en stdout y en stderr. */
export function ejecutar(argv, leerStdin) {
  try {
    const args = parsearArgs(argv);
    const contrato = leerContrato();
    let ruta = args.transcript;
    if (ruta === undefined) {
      ruta = JSON.parse(leerStdin())?.transcript_path;
      if (typeof ruta !== 'string' || ruta === '') throw new Error('el JSON de stdin no trae transcript_path');
    }
    let texto;
    try {
      texto = readFileSync(ruta, 'utf8');
    } catch (error) {
      throw new Error(`no se pudo leer el transcript ${ruta}: ${error.message}`);
    }
    const mensaje = evaluar(contarTokens(texto), args.rol, contrato);
    return { stdout: mensaje === null ? '' : `${mensaje}\n`, stderr: '' };
  } catch (error) {
    return { stdout: '', stderr: `context-guard: ${error.message}\n` };
  }
}

if (process.argv[1] && process.argv[1].endsWith('context-guard.mjs')) {
  const { stdout, stderr } = ejecutar(process.argv.slice(2), () => readFileSync(0, 'utf8'));
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = 0;
}
