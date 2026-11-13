#!/usr/bin/env node
// handoff.mjs — valida y muestra el handoff que la sesión escribe antes de compactar.
//
// Usage:
//   node scripts/handoff.mjs check   [--proyecto <dir>]   # 0 = válido · 1 = REJECTED: <motivo> · 2 = uso
//   node scripts/handoff.mjs mostrar [--proyecto <dir>]   # imprime el handoff; SIEMPRE sale 0 (es un hook)
//
// Compactar pierde datos. Antes de llegar a la ventana la sesión escribe un resumen corto en el
// archivo de `contexto.handoff.archivo` del contrato (plantilla: templates/estado/HANDOFF.md), y
// después de compactar el host corre `mostrar` (hook SessionStart con matcher `compact`): lo que
// imprime vuelve al contexto. La ruta y los topes salen de contracts/model-routing.json §
// contexto.handoff, buscado junto al script: ninguna cifra vive acá.
//
// LÍMITES HONESTOS: comprueba la forma (cinco encabezados en orden, ninguno vacío, topes de líneas
// y caracteres), no que el contenido sea cierto ni que alcance para retomar. No escribe el handoff:
// eso lo hace la sesión cuando context-guard.mjs se lo ordena, y si lo ignora se compacta sin él.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRATO = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'model-routing.json');
export const ENCABEZADOS = ['## Objetivo', '## Decisiones', '## Archivos clave', '## Pendientes', '## Cómo retomar'];
const SIN_BLOQUE = 'contrato sin contexto.handoff';

/** Lee y valida contracts/model-routing.json § contexto.handoff. Lanza `contrato sin contexto.handoff`. */
export function leerTopes(ruta = CONTRATO) {
  let h;
  try {
    h = JSON.parse(readFileSync(ruta, 'utf8')).contexto?.handoff;
  } catch {
    throw new Error(SIN_BLOQUE);
  }
  const entero = (v) => Number.isInteger(v) && v > 0;
  const ok = h !== null && typeof h === 'object' && typeof h.archivo === 'string' && h.archivo !== ''
    && entero(h.max_lineas) && entero(h.max_caracteres) && entero(h.max_horas)
    && h.antes_de_compactar > 0 && h.antes_de_compactar <= 1;
  if (!ok) throw new Error(SIN_BLOQUE);
  return { archivo: h.archivo, max_lineas: h.max_lineas, max_caracteres: h.max_caracteres, max_horas: h.max_horas, antes_de_compactar: h.antes_de_compactar };
}

/** `texto` es el contenido del handoff, o null si no existe. Devuelve { ok } o { ok: false, reason }. */
export function checkHandoff(texto, topes) {
  const no = (reason) => ({ ok: false, reason });
  if (texto === null || texto === undefined) return no('sin handoff');
  const lineas = texto.split(/\r?\n/u);
  if (lineas.at(-1) === '') lineas.pop();
  const titulos = lineas.map((l, i) => ({ t: l.trimEnd(), i })).filter(({ t }) => t.startsWith('## '));
  for (const e of ENCABEZADOS) if (!titulos.some(({ t }) => t === e)) return no(`falta ${e}`);
  const vistos = new Set();
  for (const { t } of titulos) {
    if (!ENCABEZADOS.includes(t) || vistos.has(t)) return no(`encabezado de más: ${t}`);
    vistos.add(t);
  }
  for (const [k, { t }] of titulos.entries()) if (t !== ENCABEZADOS[k]) return no(`encabezado fuera de orden: ${t}`);
  for (const [k, { t, i }] of titulos.entries()) {
    const fin = titulos[k + 1]?.i ?? lineas.length;
    if (!lineas.slice(i + 1, fin).some((l) => l.trim() !== '')) return no(`sección vacía: ${t}`);
  }
  if (lineas.length > topes.max_lineas) return no(`${lineas.length} líneas: el máximo es ${topes.max_lineas}`);
  const caracteres = [...texto.replaceAll('\r', '')].length;
  if (caracteres > topes.max_caracteres) return no(`${caracteres} caracteres: el máximo es ${topes.max_caracteres}`);
  return { ok: true };
}

function parsearArgs(argv) {
  const [comando, ...resto] = argv;
  if (comando !== 'check' && comando !== 'mostrar') throw new Error('uso: handoff.mjs check|mostrar [--proyecto <dir>]');
  let proyecto = process.cwd();
  for (let i = 0; i < resto.length; i += 1) {
    if (resto[i] !== '--proyecto') throw new Error(`argumento desconocido: ${resto[i]}`);
    proyecto = resto[(i += 1)];
    if (proyecto === undefined || proyecto === '') throw new Error('falta el valor de --proyecto');
  }
  return { comando, proyecto: resolve(proyecto) };
}

function leerHandoff(ruta) {
  try {
    return { texto: readFileSync(ruta, 'utf8'), horas: (Date.now() - statSync(ruta).mtimeMs) / 3600000 };
  } catch {
    return { texto: null, horas: 0 };
  }
}

/** Corre el CLI sin tocar el proceso: devuelve { status, stdout, stderr }. */
export function ejecutar(argv) {
  const esHook = argv[0] === 'mostrar';
  try {
    let args;
    try {
      args = parsearArgs(argv);
    } catch (error) {
      if (esHook) throw error;
      return { status: 2, stdout: '', stderr: `handoff: ${error.message}\n` };
    }
    const topes = leerTopes();
    const { texto, horas } = leerHandoff(join(args.proyecto, topes.archivo));
    const r = checkHandoff(texto, topes);
    if (args.comando === 'check') {
      return r.ok ? { status: 0, stdout: `OK: handoff válido (${topes.archivo})\n`, stderr: '' } : { status: 1, stdout: '', stderr: `REJECTED: ${r.reason}\n` };
    }
    const viejo = horas > topes.max_horas ? `handoff viejo (${Math.floor(horas)} h): verificalo antes de usarlo\n` : '';
    const cuerpo = r.ok ? (texto.endsWith('\n') ? texto : `${texto}\n`) : `handoff: ${r.reason}\n`;
    return { status: 0, stdout: `${viejo}${cuerpo}`, stderr: '' };
  } catch (error) {
    return esHook ? { status: 0, stdout: `handoff: ${error.message}\n`, stderr: '' } : { status: 1, stdout: '', stderr: `REJECTED: ${error.message}\n` };
  }
}

if (process.argv[1] && process.argv[1].endsWith('handoff.mjs')) {
  const { status, stdout, stderr } = ejecutar(process.argv.slice(2));
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = status;
}
