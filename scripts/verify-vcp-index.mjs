#!/usr/bin/env node
// verify-vcp-index.mjs — el mapa propio del proyecto, sin depender de ninguna herramienta externa.
//
// POR QUE EXISTE. La fase 8.2 exigia correr una CLI de terceros -- `graphify` -- y cableaba un gate
// a su salida. No estaba marcada como opcional y no es una dependencia declarada del protocolo:
// quien instalara VCP sin ella no podia cerrar la fase 8, y el documento no se lo decia.
//
// QUE REEMPLAZA, Y QUE NO. Se midio antes de construir: NINGUN script del protocolo lee el CONTENIDO
// del grafo. `verify-backup-state.mjs` solo le calcula un sha256 y `verify-graphify-manifest.mjs`
// lee un manifiesto. O sea que el protocolo no necesitaba un grafo: necesitaba saber QUE ARCHIVOS
// cubre y cuales quedan afuera con motivo escrito. Eso es este indice, y son ~10 KB en vez de 375.
//
// LO QUE ESTE GATE NO PUEDE HACER, dicho de frente:
//   - No entiende los archivos. Dice que estan inventariados, no que sean correctos ni coherentes.
//   - La clase de cada entrada la escribe una persona o un agente: es una declaracion, no una
//     deduccion. Un archivo clasificado mal pasa en verde.
//   - No reemplaza al grafo para navegar: reemplaza la parte que el protocolo de verdad usaba.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const USAGE = 'usage: verify-vcp-index.mjs check [<index.json>] | verify-vcp-index.mjs record [<index.json>]';
export const SCHEMA = 'vcp.index/1';
export const DEFAULT_PATH = 'contracts/vcp-index.json';
export const EMPTY_PREFIX = 'VACÍO: ';

/** Las clases que una entrada puede declarar. Es una lista corta a proposito: si hiciera falta una
 * clase nueva, agregarla es una decision revisable y no un campo libre que nadie mira. */
export const CLASES = Object.freeze(['gate', 'contrato', 'prueba', 'documento', 'plantilla', 'skill', 'evidencia', 'otro']);

/** La clase que le corresponde a una ruta por su UBICACION, no por su nombre. Se deriva para que
 * `record` no invente nada: el que clasifica es el arbol, y una persona puede corregirlo despues. */
export function claseDe(ruta) {
  const r = ruta.replaceAll('\\', '/');
  if (r.startsWith('scripts/')) return 'gate';
  if (r.startsWith('contracts/')) return 'contrato';
  if (r.startsWith('tests/')) return 'prueba';
  if (r.startsWith('templates/')) return 'plantilla';
  if (r.startsWith('skills/')) return 'skill';
  if (r.startsWith('research/') || r.startsWith('docs/') || r.startsWith('.vibe/')) return 'evidencia';
  if (r.endsWith('.md')) return 'documento';
  return 'otro';
}

/** Las rutas que git rastrea. Es la fuente de verdad: un indice que no salga de aca es una lista
 * escrita a mano, y una lista solo encuentra lo que ya penso quien la escribio. */
export function rutasRastreadas(root, correr = execFileSync) {
  const salida = correr('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return salida.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean);
}

export function construirIndice(rutas) {
  return {
    schema: SCHEMA,
    why: 'Que archivos cubre este repositorio y cuales quedan afuera con motivo escrito. Reemplaza la parte del grafo que el protocolo de verdad usaba, sin depender de ninguna herramienta externa.',
    entries: rutas.slice().sort().map((path) => ({ path, class: claseDe(path) })),
    excluded: [],
  };
}

/** Que le falta o le sobra al indice respecto de lo que git rastrea hoy. */
export function comparar(indice, rutas) {
  const declaradas = new Set((indice.entries ?? []).map((e) => e.path));
  const excluidas = new Set((indice.excluded ?? []).map((e) => e.path));
  const reales = new Set(rutas);
  const faltantes = rutas.filter((r) => !declaradas.has(r) && !excluidas.has(r)).sort();
  const sobrantes = [...declaradas].filter((r) => !reales.has(r)).sort();
  return { faltantes, sobrantes, comparadas: declaradas.size };
}

/** Lo que hace invalido a un indice, mirando su forma y no su contenido. */
export function violaciones(indice) {
  const malas = [];
  if (indice === null || typeof indice !== 'object' || Array.isArray(indice)) return [`el índice tiene que ser un objeto con schema ${SCHEMA}`];
  if (indice.schema !== SCHEMA) malas.push(`el índice debe declarar schema ${SCHEMA}`);
  if (typeof indice.why !== 'string' || indice.why.trim().length < 20) malas.push('el índice necesita un `why` escrito: un inventario sin motivo es una lista que nadie sabe para qué existe');
  if (!Array.isArray(indice.entries) || indice.entries.length === 0) malas.push('el índice no declara ninguna entrada');
  for (const [i, e] of (indice.entries ?? []).entries()) {
    if (typeof e?.path !== 'string' || e.path === '') { malas.push(`entrada ${i + 1}: falta la ruta`); continue; }
    if (!CLASES.includes(e?.class)) malas.push(`entrada ${i + 1} (${e.path}): clase ${JSON.stringify(e?.class)} no está entre las declaradas`);
  }
  for (const [i, e] of (indice.excluded ?? []).entries()) {
    if (typeof e?.path !== 'string' || e.path === '') { malas.push(`exclusión ${i + 1}: falta la ruta`); continue; }
    if (typeof e?.why !== 'string' || e.why.trim().length < 20) malas.push(`exclusión ${i + 1} (${e.path}): una exclusión sin motivo escrito es un agujero, no una decisión`);
  }
  return malas;
}

export function parseArguments(args) {
  if (args.length === 0 || args.length > 2) return null;
  if (args[0] !== 'check' && args[0] !== 'record') return null;
  return { accion: args[0], ruta: args[1] ?? DEFAULT_PATH };
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArguments(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  const { read = (p) => readFileSync(join(cwd, p), 'utf8'), escribir = (p, t) => writeFileSync(join(cwd, p), t), correr = execFileSync } = io;

  let rutas;
  try {
    rutas = rutasRastreadas(cwd, correr);
  } catch (error) {
    writeError(`REJECTED: no se pudo preguntarle a git qué rastrea (${error.message}): sin eso no hay con qué comparar`);
    return 1;
  }
  if (rutas.length === 0) {
    write(`${EMPTY_PREFIX}git no rastrea ningún archivo acá: todavía no hay nada que inventariar`);
    return 0;
  }

  if (parsed.accion === 'record') {
    const indice = construirIndice(rutas);
    escribir(parsed.ruta, `${JSON.stringify(indice, null, 2)}\n`);
    write(`OK: ${parsed.ruta} inventaría ${indice.entries.length} archivo(s) rastreado(s).`);
    return 0;
  }

  let indice;
  try {
    indice = JSON.parse(read(parsed.ruta));
  } catch (error) {
    writeError(`REJECTED: ${parsed.ruta}: no se pudo leer el índice (${error.message}); generalo con \`record\``);
    return 1;
  }
  const malas = violaciones(indice);
  if (malas.length > 0) {
    for (const m of malas) writeError(`REJECTED: ${parsed.ruta}: ${m}`);
    return 1;
  }
  const { faltantes, sobrantes, comparadas } = comparar(indice, rutas);
  if (faltantes.length > 0 || sobrantes.length > 0) {
    if (faltantes.length > 0) writeError(`REJECTED: ${parsed.ruta}: archivos rastreados que el índice no declara ni excluye: ${faltantes.slice(0, 10).join(', ')}${faltantes.length > 10 ? ` (+${faltantes.length - 10})` : ''}`);
    if (sobrantes.length > 0) writeError(`REJECTED: ${parsed.ruta}: entradas del índice que git ya no rastrea: ${sobrantes.slice(0, 10).join(', ')}${sobrantes.length > 10 ? ` (+${sobrantes.length - 10})` : ''}`);
    return 1;
  }
  write(`OK: ${parsed.ruta} cubre ${comparadas} archivo(s) rastreado(s), con cada exclusión declarada y con motivo.`);
  write('LÍMITE: dice que están inventariados, no que sean correctos. La clase de cada entrada es una declaración, no una deducción.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-index.mjs')) {
  // `process.exitCode`, no `process.exit()`: el segundo mata el worker de pruebas que importa este
  // archivo para cubrir esta misma linea, y la prueba de bootstrap falla sin decir por que.
  process.exitCode = main();
}
