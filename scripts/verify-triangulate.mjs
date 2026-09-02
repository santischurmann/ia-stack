#!/usr/bin/env node
// verify-triangulate.mjs — los vectores que hay que buscar a proposito antes de refactorizar,
// declarados uno por uno en vez de recordados.
//
// EL PROBLEMA QUE RESUELVE. TRIANGULATE existia en el protocolo como prosa adentro del bucle de
// Build. Quien refactorizaba decidia solo que vectores buscó, y nadie podia leer despues cuales
// miró y cuales no. Sin una lista fija se revisa lo que uno ya sabe buscar, que es exactamente lo
// que no encuentra nada nuevo: medido en este proyecto, la lista de gates con verde vacio se armo
// tres veces leyendo codigo y quedo corta las tres.
//
// COMO. La lista de vectores vive en contracts/triangulate-vectors.json, no adentro de este
// archivo: cambiarla no exige tocar codigo. El expediente de una funcionalidad declara CADA vector
// con uno de tres estados. `covered` nombra la prueba que lo cubre. `not_applicable` y `pending`
// traen motivo escrito. Un vector que falta, o uno que el contrato no declara, rechaza: el punto
// entero es que el silencio no pase por revision.
//
// LIMITE HONESTO. Comprueba FORMA. NO abre la prueba que un vector dice tener, ni comprueba que
// esa prueba ejercite ese vector: un `covered` que nombra un archivo cualquiera pasa igual. Tampoco
// juzga si el motivo de un `not_applicable` es bueno, ni descubre vectores nuevos -- la lista es
// fija y su completitud es una decision humana, no un resultado del gate.
import { readFileSync } from 'node:fs';
import { safeProjectFile } from './ratchet.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const SCHEMA = 'vcp.triangulate/1';
export const VECTORS_SCHEMA = 'vcp.triangulate-vectors/1';
export const VECTORS_PATH = join(repoRoot, 'contracts', 'triangulate-vectors.json');
export const COMPLETE_FLAG = '--require-complete';
export const USAGE = `usage: verify-triangulate.mjs check <triangulate.json> [${COMPLETE_FLAG}]`;
export const EMPTY = 'VACÍO';

/** Lo que cada etiqueta obliga a cargar. Un cubierto sin prueba es una afirmacion sin respaldo. */
const STATE_KEYS = Object.freeze({
  covered: ['state', 'test'],
  not_applicable: ['state', 'reason'],
  pending: ['state', 'reason'],
});
export const STATES = new Set(Object.keys(STATE_KEYS));
const MIN_REASON = 20;

/**
 * Un BOM al principio rompe JSON.parse, y el archivo puede estar perfecto: reportarlo como JSON
 * invalido manda a buscar el error donde no esta. Se saca antes de parsear, que es lo que hacen
 * las herramientas que aceptan UTF-8 con marca.
 */
const stripBom = (text) => (typeof text === 'string' && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const longEnough = (v) => typeof v === 'string' && v.trim().length >= MIN_REASON;
const exactKeys = (v, keys) => isObject(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));

/** Los ids del contrato, sin lanzar nunca: un contrato roto se informa como contrato roto. */
export function loadVectors(contract) {
  if (!isObject(contract) || contract.schema !== VECTORS_SCHEMA) {
    return { ids: [], violations: [`el contrato de vectores debe declarar ${VECTORS_SCHEMA}`] };
  }
  if (!Array.isArray(contract.vectors) || contract.vectors.length === 0) {
    return { ids: [], violations: ['el contrato de vectores debe traer al menos un vector'] };
  }
  const violations = [];
  const ids = [];
  const seen = new Set();
  for (const [index, vector] of contract.vectors.entries()) {
    if (!exactKeys(vector, ['vector_id', 'name', 'why'])) {
      violations.push(`el contrato de vectores: vectors[${index}] debe declarar vector_id, name y why`);
      continue;
    }
    if (typeof vector.vector_id !== 'string' || vector.vector_id.trim() === '') {
      violations.push(`el contrato de vectores: vectors[${index}] no declara un vector_id`);
      continue;
    }
    if (seen.has(vector.vector_id)) violations.push(`el contrato de vectores repite ${vector.vector_id}`);
    seen.add(vector.vector_id);
    if (!longEnough(vector.why)) violations.push(`el contrato de vectores: ${vector.vector_id} no dice por qué importa`);
    ids.push(vector.vector_id);
  }
  return { ids, violations };
}

/** Todas las violaciones del expediente, sin lanzar nunca. */
export function validateTriangulate(document, ids) {
  if (!isObject(document)) return [`el expediente debe ser un objeto JSON que declare ${SCHEMA}`];
  if (document.schema !== SCHEMA) return [`el expediente debe declarar ${SCHEMA}, no ${JSON.stringify(document.schema)}`];
  const violations = [];
  if (typeof document.feature !== 'string' || document.feature.trim() === '') violations.push('feature debe nombrar la funcionalidad');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(document.date ?? '')) violations.push('date debe ser una fecha AAAA-MM-DD');
  if (!isObject(document.vectors)) {
    violations.push('vectors debe ser un objeto con un estado por cada vector del contrato');
    return violations;
  }
  for (const id of ids) {
    if (!Object.hasOwn(document.vectors, id)) {
      violations.push(`falta el vector ${id}: no mirarlo y no decirlo son la misma cosa para quien lea esto después`);
    }
  }
  for (const [id, entry] of Object.entries(document.vectors)) {
    if (!ids.includes(id)) {
      violations.push(`${id} no es un vector del contrato`);
      continue;
    }
    if (!isObject(entry) || !STATES.has(entry.state)) {
      violations.push(`${id}.state debe ser una de: ${[...STATES].join(', ')}`);
      continue;
    }
    if (!exactKeys(entry, STATE_KEYS[entry.state])) {
      violations.push(`${id} de estado ${entry.state} debe declarar exactamente ${STATE_KEYS[entry.state].join(', ')}`);
      continue;
    }
    if (entry.state === 'covered' && (typeof entry.test !== 'string' || entry.test.trim() === '')) {
      violations.push(`${id} se declara cubierto sin nombrar la prueba que lo cubre`);
    }
    if (entry.state !== 'covered' && !longEnough(entry.reason)) {
      violations.push(`${id} se declara ${entry.state} sin un motivo escrito: descartarlo sin razón es no haberlo mirado`);
    }
  }
  return violations;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const read = options.read ?? readFileSync;
  const flags = args.slice(2);
  if (args.length < 2 || args[0] !== 'check' || args[1] === '' || flags.some((f) => f !== COMPLETE_FLAG)) {
    writeError(USAGE);
    return 2;
  }
  const requireComplete = flags.includes(COMPLETE_FLAG);
  const path = args[1];

  let contract;
  try {
    contract = JSON.parse(stripBom(read(VECTORS_PATH, 'utf8')));
  } catch (error) {
    writeError(`REJECTED: no se pudo leer el contrato de vectores: ${error.message}`);
    return 1;
  }
  const { ids, violations: contractViolations } = loadVectors(contract);
  if (contractViolations.length > 0) {
    for (const violation of contractViolations) writeError(`REJECTED: ${violation}`);
    return 1;
  }

  // La ruta se resuelve ANTES de abrirla: un enlace o un `..` no llegan al lector. La lectura no
  // se reimplementa (regla #46): safeProjectFile de ratchet.mjs ya fija el criterio del repo, y
  // devuelve null cuando el archivo no existe -- que acá es el verde de un proyecto que no arrancó.
  const resolverRuta = options.safePath ?? safeProjectFile;
  let archivo;
  try {
    archivo = resolverRuta(options.root ?? process.cwd(), path);
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  if (archivo === null) {
    write(`${EMPTY}: no hay ningún expediente de triangulación en ${path}. Esto no verificó nada.`);
    return 0;
  }
  let document;
  try {
    document = JSON.parse(stripBom(read(archivo, 'utf8')));
  } catch (error) {
    // Un expediente ausente es un proyecto que todavia no triangulo, no un incumplimiento. Se dice
    // VACIO y no OK: no comparar nada no se escribe igual que verificar algo.
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ningún expediente de triangulación en ${path}. Esto no verificó nada.`);
      return 0;
    }
    writeError(`REJECTED: ${path} no es JSON válido ni se pudo leer: ${error.message}`);
    return 1;
  }

  const violations = validateTriangulate(document, ids);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    return 1;
  }

  const estados = Object.values(document.vectors).map((entry) => entry.state);
  const cubiertos = estados.filter((s) => s === 'covered').length;
  const noAplican = estados.filter((s) => s === 'not_applicable').length;
  const pendientes = Object.entries(document.vectors).filter(([, e]) => e.state === 'pending').map(([id]) => id);

  if (requireComplete && pendientes.length > 0) {
    writeError(`REJECTED: ${path}: ${pendientes.length} vector(es) siguen pendientes y ${COMPLETE_FLAG} no los deja pasar: ${pendientes.join(', ')}`);
    return 1;
  }
  write(`OK: ${path} declara los ${ids.length} vectores: ${cubiertos} cubierto(s), ${noAplican} no aplica(n), ${pendientes.length} pendiente(s). Verifica que cada vector esté declarado, nunca que la prueba nombrada lo ejercite.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-triangulate.mjs')) {
  process.exitCode = main();
}
