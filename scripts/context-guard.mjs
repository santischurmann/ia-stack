#!/usr/bin/env node
// context-guard.mjs — hook que mide el contexto de MENSAJES de la sesión y avisa antes del tope.
//
// Usage (hook UserPromptSubmit de Claude Code; recibe por stdin el JSON con `transcript_path`):
//   node .vibe/ia-stack-runtime/scripts/context-guard.mjs --rol orquestador
//   node scripts/context-guard.mjs --transcript <transcript.jsonl> [--rol orquestador|subsesion]
//
// Los topes y el umbral salen de contracts/model-routing.json § contexto (tope_orquestador,
// tope_subsesion, aviso_desde), buscado junto al script (../contracts/): ninguna cifra vive acá.
// Con menos del umbral calla. Desde el umbral avisa con tokens y tope. En el tope ordena cerrar:
// commit del estado, resumen en .vibe/SESSION.md y compactar o handoff.
//
// SIEMPRE sale 0: un hook que falla no puede trabar la sesión. Un error (transcript ilegible,
// contrato roto, argumento inválido) va a stderr con el prefijo `context-guard:` y no avisa nada.
//
// LÍMITES HONESTOS: estima con ceil(caracteres / 4) sobre el texto de los mensajes user/assistant
// (tool_use y tool_result serializados), no con el tokenizador del modelo. No cuenta los ~80K fijos
// de la sesión (conectores, memoria, instrucciones): el tope se mide sobre mensajes. Y NO actúa solo:
// no commitea, no compacta ni corta la sesión; sólo dice qué hacer, y si el agente lo ignora, sigue.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRATO = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'model-routing.json');
const ROLES = ['orquestador', 'subsesion'];

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

/** Tokens estimados de los mensajes user/assistant de un transcript JSONL (ignora lo que no sea JSON). */
export function contarTokens(jsonl) {
  let tokens = 0;
  for (const linea of jsonl.split('\n')) {
    let obj;
    try {
      obj = JSON.parse(linea);
    } catch {
      continue;
    }
    if (obj?.type !== 'user' && obj?.type !== 'assistant') continue;
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
  return { tope_orquestador: contexto.tope_orquestador, tope_subsesion: contexto.tope_subsesion, aviso_desde: contexto.aviso_desde };
}

/** null por debajo del umbral; AVISO desde el umbral; ORDEN de cerrar desde el tope. */
export function evaluar(tokens, rol, contrato) {
  const tope = rol === 'subsesion' ? contrato.tope_subsesion : contrato.tope_orquestador;
  const ratio = tokens / tope;
  const dato = `${tokens} de ${tope} tokens de mensajes (${Math.floor(ratio * 100)} %, rol ${rol})`;
  if (ratio >= 1) {
    return `ORDEN: contexto al tope, ${dato}. Cerrá ya: 1) commit del estado; 2) resumen en .vibe/SESSION.md con decisiones, archivos clave, pendientes y cómo retomar; 3) compactar o handoff a una sesión nueva. No sigas trabajando sobre este contexto.`;
  }
  if (ratio >= contrato.aviso_desde) {
    return `AVISO: ${dato}. Cerrá la fase en curso y preparate para commitear el estado y escribir el resumen en .vibe/SESSION.md antes de llegar al tope.`;
  }
  return null;
}

export function parsearArgs(argv) {
  const args = { transcript: undefined, rol: 'orquestador' };
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
