#!/usr/bin/env node
/*
 * Verify deep semantic evidence without promoting the canonical ledger.
 * Every row must point to a current PENDING entry, preserve its pinned commit/hash,
 * and cite real lines in the materialized external corpus.
 *
 * EN QUE SE DIFERENCIA DEL HERMANO. `verify-full-evidence-pass` comprueba que la pasada AUTOMATICA
 * no promueva nada. Este comprueba lo contrario: que una fila que SI dice haber leido el archivo lo
 * haya leido. Es el unico de los cuatro que abre los bytes del corpus y exige que cada cita apunte a
 * una linea que existe dentro del archivo pineado -- un resumen inventado con citas plausibles pasa
 * cualquier otro gate del expediente y muere aca.
 *
 * FORMA, y por que cambio el 2026-09-16. Era un script imperativo de nivel superior y no se podia
 * importar sin correr el gate entero contra artefactos fuera de git. La comprobacion quedo en
 * `revisarProfunda`, que recibe las lineas y los dos artefactos ya leidos y va a buscar los bytes
 * por un lector inyectado. La logica no cambio: lo que cambio es que ahora se puede mirar.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ResearchArtifactError, loadJsonArtifact, loadTextArtifact, reportArtifactProblem } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');

export const MANIFEST_FILE = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
export const LEDGER_FILE = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
export const DEFAULT_EVIDENCE = path.join(researchDir, 'semantic-deep-evidence-2026-08-31.ndjson');

/** Lo que una revision profunda tiene que contestar. Ninguno es opcional: el que falte es el que costaba. */
export const REQUIRED_FIELDS = ['purpose', 'behavior', 'outputs', 'invariants_limits', 'tests', 'risks', 'vcp_relevance_reason'];
export const VALID_RELEVANCE = new Set(['ADOPT', 'DEFER', 'REJECT']);
export const MAX_ERRORS = 40;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const lineCount = (buffer) => buffer.toString('utf8').split(String.fromCharCode(10)).length;

/**
 * Comprobar cada fila profunda contra el ledger pineado y contra los bytes del corpus.
 *
 * `io.leerBytes` se inyecta para poder probar esto sin el corpus: son cientos de megas fuera de git.
 */
export function revisarProfunda(lines, ledger, manifest, io = {}) {
  const leerBytes = io.leerBytes ?? fs.readFileSync;
  const corpusRoot = io.corpusRoot ?? process.env.VCP_EXTERNAL_RESEARCH_ROOT ?? path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
  const ledgerByKey = new Map((ledger?.entries || []).map((entry) => [`${entry.source}|${entry.path}`, entry]));
  const rootBySource = new Map((manifest?.sources || []).map((source) => [source.slug, source.root_dir]));
  const errors = [];
  const fail = (message) => errors.push(message);
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    let row;
    try { row = JSON.parse(lines[index]); }
    catch (error) { fail(`row ${index + 1}: invalid JSON (${error.message})`); continue; }
    const key = `${row.source}|${row.path}`;
    const ledgerEntry = ledgerByKey.get(key);
    if (seen.has(key)) fail(`${key}: duplicate row`);
    seen.add(key);
    if (!ledgerEntry) { fail(`${key}: not present in ledger`); continue; }
    if (ledgerEntry.status !== 'PENDING') fail(`${key}: prior ledger status is ${ledgerEntry.status}, expected PENDING`);
    if (row.prior_status !== 'PENDING' || row.status !== 'READ') fail(`${key}: status transition must be PENDING -> READ`);
    if (row.commit !== ledgerEntry.commit || row.sha256 !== ledgerEntry.sha256 || row.line_count !== ledgerEntry.line_count) {
      fail(`${key}: commit/hash/line_count does not match the pinned ledger`);
    }
    for (const field of REQUIRED_FIELDS) if (typeof row[field] !== 'string' || row[field].trim() === '') fail(`${key}: missing ${field}`);
    if (!(typeof row.interfaces === 'string' || typeof row.inputs === 'string')) fail(`${key}: missing interfaces or inputs`);
    if (!VALID_RELEVANCE.has(row.vcp_relevance)) fail(`${key}: invalid vcp_relevance`);
    if (typeof row.confidence !== 'number' || row.confidence < 0 || row.confidence > 1) fail(`${key}: invalid confidence`);
    // DOS CITAS Y NO UNA. Una sola se consigue mirando el nombre del archivo; dos obligan a entrar.
    if (!Array.isArray(row.citations) || row.citations.length < 2) fail(`${key}: fewer than two citations`);

    const rootDir = rootBySource.get(row.source);
    if (!rootDir) { fail(`${key}: source root missing from manifest`); continue; }
    let buffer;
    try { buffer = leerBytes(path.join(corpusRoot, rootDir, row.path)); }
    catch (error) { fail(`${key}: materialized file unreadable (${error.message})`); continue; }
    if (sha256(buffer) !== ledgerEntry.sha256) fail(`${key}: source bytes do not match ledger sha256`);
    // `null` significa «no se conto», nunca cero: tratarlo como cero rechazaria toda cita.
    if (ledgerEntry.line_count !== null && lineCount(buffer) !== ledgerEntry.line_count) fail(`${key}: source line_count mismatch`);
    for (const citation of row.citations || []) {
      const match = String(citation).match(/^(.*):(\d+)$/u);
      if (!match || match[1] !== row.path) { fail(`${key}: invalid citation ${citation}`); continue; }
      const citedLine = Number(match[2]);
      if (citedLine < 1 || (ledgerEntry.line_count !== null && citedLine > ledgerEntry.line_count)) {
        fail(`${key}: citation out of range ${citation}`);
      }
    }
  }
  return errors;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const leerJson = options.leerJson ?? ((file, comoRegenerar) => loadJsonArtifact(file, comoRegenerar, { root: repoRoot }));
  const leerTexto = options.leerTexto ?? ((file, comoRegenerar) => loadTextArtifact(file, comoRegenerar, { root: repoRoot }));
  const evidencePath = path.resolve(args[0] || DEFAULT_EVIDENCE);

  let manifest;
  let ledger;
  let lines;
  try {
    manifest = leerJson(MANIFEST_FILE, 'node research/build-functional-inventory.mjs');
    ledger = leerJson(LEDGER_FILE, 'node research/build-semantic-ledger.mjs');
    lines = leerTexto(evidencePath, 'node research/build-full-evidence-pass.mjs').split(String.fromCharCode(10)).filter(Boolean);
  } catch (error) {
    // Los tres estan fuera de git a proposito. Un archivo ausente no es un JSON invalido ni un gate
    // roto: son problemas distintos y se arreglan distinto. Lo que no es ninguno de esos pasa.
    if (!(error instanceof ResearchArtifactError)) throw error;
    reportArtifactProblem(error, writeError);
    return 1;
  }

  const errors = revisarProfunda(lines, ledger, manifest, options);
  if (errors.length > 0) {
    for (const error of errors.slice(0, MAX_ERRORS)) writeError(`REJECTED: ${error}`);
    if (errors.length > MAX_ERRORS) writeError(`... and ${errors.length - MAX_ERRORS} more`);
    return 1;
  }
  write(`OK: ${lines.length} deep evidence row(s), unique and hash/citation verified against the pinned corpus.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-semantic-deep-evidence.mjs')) {
  process.exitCode = main();
}
