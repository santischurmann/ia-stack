#!/usr/bin/env node
/* Verify the exhaustive evidence pass is 1:1 with the strict PENDING ledger.
 *
 * QUE GARANTIZA. Que la pasada automatica cubre 1:1 las entradas PENDING del ledger estricto Y QUE
 * NO PROMUEVE NINGUNA. Es un gate de contencion: su trabajo es impedir que una corrida de maquina
 * se disfrace de revision. Por eso cada fila tiene que declarar `vcp_relevance: DEFER` y
 * `confidence: 0` -- una pasada automatica que opinara seria el verde falso que esto evita.
 *
 * FORMA, y por que cambio el 2026-09-16. Era un script imperativo de nivel superior y no se podia
 * importar sin correr el gate entero contra artefactos que .gitignore deja afuera. La comparacion
 * quedo en `revisarEvidencia`, que recibe las filas y el ledger ya leidos; el corpus externo entra
 * por un lector inyectado. La logica no cambio: lo que cambio es que ahora se puede mirar.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadJsonArtifact, loadTextArtifact, reportArtifactProblem } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');

export const LEDGER_FILE = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
export const MANIFEST_FILE = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
export const EVIDENCE_FILE = path.join(researchDir, 'semantic-full-evidence-2026-08-31.ndjson');

/** Cuantos rechazos se imprimen antes de recortar. El resto se cuenta en una linea. */
export const MAX_ERRORS = 40;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * Comparar la pasada contra el ledger. Devuelve la lista de problemas, vacia si no hay ninguno.
 *
 * `io.leerBytes` existe para poder probar esto sin el corpus: son cientos de megas fuera de git, y
 * una prueba que los necesitara no se correria nunca.
 */
export function revisarEvidencia(rows, ledger, manifest, io = {}) {
  const leerBytes = io.leerBytes ?? fs.readFileSync;
  const corpusRoot = io.corpusRoot ?? process.env.VCP_EXTERNAL_RESEARCH_ROOT ?? path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
  const rootBySource = new Map((manifest.sources || []).map((source) => [source.slug, source.root_dir]));
  const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
  const expected = new Map(pending.map((entry) => [`${entry.source}|${entry.path}`, entry]));
  const errors = [];
  const seen = new Set();

  for (const row of rows) {
    const k = `${row.source}|${row.path}`;
    const entry = expected.get(k);
    // Una fila que el ledger no tiene se saltea: comparar su identidad contra nada encadena ruido.
    if (!entry) { errors.push(`${k}: not a current PENDING entry`); continue; }
    if (seen.has(k)) errors.push(`${k}: duplicate row`);
    seen.add(k);
    if (row.prior_status !== 'PENDING' || row.strict_status !== 'PENDING' || row.review_status !== 'ASSISTED_STRUCTURAL') errors.push(`${k}: unsafe status promotion`);
    if (row.commit !== entry.commit || row.sha256 !== entry.sha256 || row.line_count !== entry.line_count) errors.push(`${k}: pinned identity mismatch`);
    if (row.vcp_relevance !== 'DEFER' || row.confidence !== 0) errors.push(`${k}: automated pass must remain conservative`);
    if (!Array.isArray(row.citations) || row.citations.length === 0) errors.push(`${k}: no observable citation`);
    if (!row.bytes_read) continue;
    const rootDir = rootBySource.get(row.source);
    // Sin root_dir no hay ruta que armar. Antes se concatenaba `undefined` y el error salia como
    // «archivo ilegible», que manda a mirar el disco cuando el problema esta en el manifiesto.
    if (!rootDir) { errors.push(`${k}: bytes_read=true pero el manifiesto no declara root_dir para la fuente ${row.source}`); continue; }
    try {
      const buffer = leerBytes(path.join(corpusRoot, rootDir, row.path));
      if (sha256(buffer) !== entry.sha256 || row.observed_sha256 !== entry.sha256) errors.push(`${k}: bytes/hash mismatch`);
    } catch (error) { errors.push(`${k}: bytes_read=true but file unreadable (${error.message})`); }
  }
  for (const entry of pending) if (!seen.has(`${entry.source}|${entry.path}`)) errors.push(`${entry.source}|${entry.path}: missing row`);
  if (rows.length !== pending.length) errors.push(`row count ${rows.length} != pending count ${pending.length}`);
  return errors;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const leerJson = options.leerJson ?? ((file, comoRegenerar) => loadJsonArtifact(file, comoRegenerar, { root: repoRoot }));
  const leerTexto = options.leerTexto ?? ((file, comoRegenerar) => loadTextArtifact(file, comoRegenerar, { root: repoRoot }));

  let ledger;
  let manifest;
  let rows;
  try {
    ledger = leerJson(LEDGER_FILE, 'node research/build-semantic-ledger.mjs');
    manifest = leerJson(MANIFEST_FILE, 'node research/build-functional-inventory.mjs');
    rows = leerTexto(EVIDENCE_FILE, 'node research/build-full-evidence-pass.mjs')
      .split(String.fromCharCode(10))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    // Los tres artefactos estan fuera de git a proposito, asi que faltar es lo normal en un clon
    // limpio. Un error de otra clase se deja pasar en vez de disfrazarse de insumo ausente.
    if (!reportArtifactProblem(error, writeError)) throw error;
    return 1;
  }

  const errors = revisarEvidencia(rows, ledger, manifest, options);
  if (errors.length > 0) {
    for (const error of errors.slice(0, MAX_ERRORS)) writeError(`REJECTED: ${error}`);
    if (errors.length > MAX_ERRORS) writeError(`... and ${errors.length - MAX_ERRORS} more`);
    return 1;
  }
  write(`OK: ${rows.length} PENDING entries covered 1:1 with conservative evidence; strict ledger remains unchanged.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-full-evidence-pass.mjs')) {
  process.exitCode = main();
}
