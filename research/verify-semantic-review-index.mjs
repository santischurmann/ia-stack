#!/usr/bin/env node
/*
 * Verify the one-to-one research queue index. This gate checks identity and
 * provenance only; it deliberately does not claim that a summary is semantically
 * sufficient. Promotion remains a separate, human/adversarial decision.
 *
 * FORMA, y por que cambio el 2026-09-16. Esto era un script imperativo de nivel superior: leia sus
 * dos insumos al importarse y terminaba en `process.exit`. Importarlo desde una prueba corria el
 * gate entero contra archivos que .gitignore deja afuera por tamano, asi que no habia forma de
 * probarlo sin versionar cientos de megas de corpus -- y por eso el contrato de cobertura lo
 * declaraba como DEUDA con nombre y apellido desde el 2026-09-01.
 *
 * Ahora la comparacion es una funcion pura -- `revisarIndice(indice, ledger)` -- que se prueba con
 * datos sinteticos de diez lineas, y `main` es el cableado: leer, llamar, imprimir. La logica no
 * cambio; lo que cambio es que ahora se puede mirar.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadJsonArtifact, reportArtifactProblem } from './require-artifact.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const research = path.join(root, 'research');

export const INDEX_FILE = path.join(research, 'semantic-review-index-2026-08-31.json');
export const LEDGER_FILE = path.join(research, 'semantic-ledger-2026-08-31.json');

/**
 * Los estados que la maquina puede declarar sobre una fila. Es una lista cerrada a proposito: un
 * estado inventado se lee como una revision que paso por algun lado, y no paso por ninguno.
 */
export const ALLOWED_MACHINE = new Set(['READ_CANDIDATE', 'STATIC_ONLY', 'REVIEW_REQUIRED', 'PENDING_REVIEW', 'EXCLUDED_OBJECTIVE', 'UNREADABLE', 'UNREVIEWED']);

/** Cuantos errores se imprimen antes de recortar. El total se sigue diciendo entero. */
export const MAX_ERRORS = 50;

/**
 * Comparar el indice contra el ledger. Devuelve la lista de problemas, vacia si no hay ninguno.
 *
 * NO PROMUEVE NADA, y esa es la invariante entera: si el indice pudiera cambiar el estado estricto
 * de una entrada, la cola de revision se vaciaria sola sin que nadie revisara nada.
 */
export function revisarIndice(index, ledger) {
  const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
  const expected = new Map(pending.map((entry) => [`${entry.source}|${entry.path}`, entry]));
  const seen = new Set();
  const errors = [];

  if (index.total_pending !== pending.length) errors.push(`total_pending=${index.total_pending} expected=${pending.length}`);
  if (!Array.isArray(index.rows) || index.rows.length !== pending.length) errors.push(`rows=${index.rows?.length} expected=${pending.length}`);

  for (const row of index.rows ?? []) {
    const key = `${row.source}|${row.path}`;
    if (seen.has(key)) errors.push(`duplicate row ${key}`);
    seen.add(key);
    const source = expected.get(key);
    // Una fila que el ledger no tiene se saltea: comparar su procedencia contra nada produciria
    // ruido encadenado, no hallazgos.
    if (!source) { errors.push(`row not in canonical pending ledger ${key}`); continue; }
    for (const field of ['commit', 'sha256']) {
      if (row[field] !== source[field]) errors.push(`${key}: ${field} provenance mismatch`);
    }
    if (row.strict_status !== 'PENDING') errors.push(`${key}: strict_status must remain PENDING`);
    if (!ALLOWED_MACHINE.has(row.machine_status)) errors.push(`${key}: invalid machine_status ${row.machine_status}`);
    // Decir que hubo revision manual exige el lote profundo que la produce: sin el, la etiqueta
    // afirma un trabajo del que no queda rastro.
    if (row.review_method === 'manual_semantic_batch' && !String(row.shard).startsWith('deep_')) {
      errors.push(`${key}: manual_semantic_batch without deep shard`);
    }
    for (const citation of row.evidence ?? []) {
      if (typeof citation !== 'string' || !/:\d+$/u.test(citation)) errors.push(`${key}: malformed citation ${citation}`);
    }
  }
  for (const key of expected.keys()) if (!seen.has(key)) errors.push(`missing row ${key}`);
  return errors;
}

/** Cuantas filas por metodo de revision, ordenado para que dos corridas se puedan comparar. */
export function porMetodo(rows) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row.review_method))].sort().map((method) => [method, rows.filter((row) => row.review_method === method).length]),
  );
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const leer = options.leer ?? ((file, comoRegenerar) => loadJsonArtifact(file, comoRegenerar, { root }));

  let index;
  let ledger;
  try {
    index = leer(INDEX_FILE, 'node research/consolidate-semantic-review.mjs');
    ledger = leer(LEDGER_FILE, 'node research/build-semantic-ledger.mjs');
  } catch (error) {
    // Estos artefactos NO estan en git a proposito -- son salidas regenerables del corpus --, asi
    // que faltar es lo normal en un clon limpio. Un error de OTRA clase (JSON invalido, permiso
    // denegado) se deja pasar: taparlo como «falta el insumo» mandaria a regenerar algo que ya esta.
    if (!reportArtifactProblem(error, writeError)) throw error;
    return 1;
  }

  const errors = revisarIndice(index, ledger);
  if (errors.length > 0) {
    writeError(JSON.stringify({ ok: false, errors: errors.slice(0, MAX_ERRORS), errorCount: errors.length }, null, 2));
    return 1;
  }
  const pending = ledger.entries.filter((entry) => entry.status === 'PENDING').length;
  write(JSON.stringify({ ok: true, pending, rows: index.rows.length, unique: new Set(index.rows.map((r) => `${r.source}|${r.path}`)).size, methods: porMetodo(index.rows) }, null, 2));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-semantic-review-index.mjs')) {
  process.exitCode = main();
}
