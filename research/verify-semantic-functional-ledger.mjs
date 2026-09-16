#!/usr/bin/env node
/* Verify the full functional-semantic review against the pinned corpus.
 *
 * ES EL MAS ESTRICTO DE LOS CUATRO. Cada fila declara de que CLASE es -- `TEXT_FUNCTIONAL`, que leyo
 * el texto entero, o `STATIC_REVIEWED`, que solo pudo mirar metadatos de un binario -- y este gate
 * exige que la clase y lo que la fila afirma sean coherentes entre si. Las dos clases tienen que
 * declarar `semantic_claim: false`: una lectura de maquina, por completa que sea, no es un juicio
 * humano, y este gate existe para que no se pueda decir que lo es.
 *
 * LA REGLA DE LAS CITAS, que es la parte pensada. Un archivo de UNA linea tiene un solo localizador
 * verdadero: exigir dos forzaria a inventar el segundo. Por eso el minimo sube a dos solo cuando el
 * propio barrido observo dos lineas distintas o mas. Es la diferencia entre un gate que fuerza
 * evidencia y uno que fuerza a fabricarla.
 *
 * FORMA, y por que cambio el 2026-09-16. Era un script imperativo de nivel superior y no se podia
 * importar sin correr el gate entero contra artefactos fuera de git. Ahora la comprobacion vive en
 * `revisarFuncional`, los dos caminos de entrada en `entradasPendientes` y `raicesPorFuente`, y
 * `main` es el cableado. La logica no cambio: lo que cambio es que ahora se puede mirar.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { MISSING_ARTIFACT, ResearchArtifactError, reportArtifactProblem } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');

export const MANIFEST_FILE = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
export const LEDGER_FILE = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
export const INDEX_FILE = path.join(researchDir, 'semantic-functional-index-2026-09-01.json');
export const DEFAULT_EVIDENCE = path.join(researchDir, 'semantic-functional-evidence-2026-09-01.ndjson');
export const MAX_ERRORS = 60;

const RESOLUTIONS = ['FUNCTIONAL_SCAN', 'STATIC_REVIEWED'];
const CLASSES = ['TEXT_FUNCTIONAL', 'STATIC_REVIEWED'];
const RELEVANCE = ['ADOPT', 'DEFER', 'REJECT'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const key = (source, filePath) => `${source}\0${filePath}`;
const lineasDe = (buffer) => buffer.toString('utf8').split(String.fromCharCode(10)).length;

/**
 * Las entradas que faltan revisar. El ledger manda; si no esta -- es una salida regenerable del
 * corpus y puede faltar en un clon limpio -- el indice hace de ledger, y sus entradas son por
 * definicion las que faltan.
 */
export function entradasPendientes(ledger, index) {
  if (ledger) return (ledger.entries || []).filter((e) => e.status === 'PENDING');
  return (index?.entries || []).map((e) => ({ ...e, status: 'PENDING' }));
}

/** Donde vive cada fuente del corpus. Mismo respaldo: el manifiesto, y si no el propio indice. */
export function raicesPorFuente(manifest, index) {
  if (manifest) return new Map((manifest.sources || []).map((s) => [s.slug, s.root_dir]));
  return new Map((index?.entries || []).map((e) => [e.source, e.source_root]).filter(([, root]) => root));
}

/** Comprobar cada fila contra las entradas pendientes y contra los bytes del corpus. */
export function revisarFuncional(lines, pending, rootBySource, io = {}) {
  const leerBytes = io.leerBytes ?? fs.readFileSync;
  const corpusRoot = io.corpusRoot ?? process.env.VCP_EXTERNAL_RESEARCH_ROOT ?? path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
  const ledgerByKey = new Map(pending.map((e) => [key(e.source, e.path), e]));
  const errors = [];
  const fail = (message) => errors.push(message);
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    let row;
    try { row = JSON.parse(lines[i]); } catch (error) { fail(`row ${i + 1}: invalid JSON (${error.message})`); continue; }
    const k = key(row.source, row.path);
    if (seen.has(k)) fail(`${k}: duplicate row`);
    seen.add(k);
    const entry = ledgerByKey.get(k);
    if (!entry) { fail(`${k}: not a current PENDING entry`); continue; }
    if (row.prior_status !== 'PENDING') fail(`${k}: prior_status must be PENDING`);
    if (!RESOLUTIONS.includes(row.resolution_status)) fail(`${k}: invalid resolution_status`);
    if (!CLASSES.includes(row.analysis_class)) fail(`${k}: invalid analysis_class`);
    if (row.analysis_class === 'TEXT_FUNCTIONAL' && row.resolution_status !== 'FUNCTIONAL_SCAN') fail(`${k}: text row must use FUNCTIONAL_SCAN`);
    if (row.analysis_class === 'STATIC_REVIEWED' && row.resolution_status !== 'STATIC_REVIEWED') fail(`${k}: static row must use STATIC_REVIEWED`);
    // NINGUNA CLASE PUEDE RECLAMAR JUICIO HUMANO. Es la invariante entera de este gate.
    if (row.analysis_class === 'TEXT_FUNCTIONAL' && (row.semantic_depth !== 'deterministic_observation' || row.semantic_claim !== false)) fail(`${k}: text row must explicitly disclaim human semantic judgment`);
    if (row.analysis_class === 'STATIC_REVIEWED' && (row.semantic_depth !== 'metadata_only' || row.semantic_claim !== false)) fail(`${k}: static row must be metadata-only`);
    if (row.sha256 !== entry.sha256 || row.commit !== entry.commit || row.line_count !== entry.line_count) fail(`${k}: pinned identity mismatch`);
    if (row.observed_sha256 !== entry.sha256) fail(`${k}: observed sha256 mismatch with ledger`);
    if (row.bytes_read !== true || row.full_content_scanned !== true) fail(`${k}: full byte scan not declared`);
    if (typeof row.purpose !== 'string' || !row.purpose.trim()) fail(`${k}: missing purpose`);
    if (typeof row.behavior !== 'string' || !row.behavior.trim()) fail(`${k}: missing behavior`);
    if (typeof row.invariants_limits !== 'string' || !row.invariants_limits.trim()) fail(`${k}: missing limits`);
    if (typeof row.vcp_relevance !== 'string' || !RELEVANCE.includes(row.vcp_relevance)) fail(`${k}: invalid relevance`);
    // A one-line file has only one truthful locator; requiring two would force a
    // fabricated second line. Multi-line text needs at least two independent
    // anchors (the first/last or a symbol/heading plus a boundary).
    const observedLines = new Set();
    for (const group of Object.values(row.observations || {})) {
      for (const item of Array.isArray(group) ? group : []) if (Number.isInteger(item?.line)) observedLines.add(item.line);
    }
    const minimumCitations = row.analysis_class === 'TEXT_FUNCTIONAL' && observedLines.size >= 2 ? 2 : (row.analysis_class === 'TEXT_FUNCTIONAL' ? 1 : 0);
    if (!Array.isArray(row.citations) || row.citations.length < minimumCitations) fail(`${k}: insufficient citations`);
    if (row.analysis_class === 'STATIC_REVIEWED' && (typeof row.metadata_locator !== 'string' || !row.metadata_locator.startsWith(`${row.path}#bytes:0-`))) fail(`${k}: missing byte metadata locator`);
    const root = rootBySource.get(row.source);
    if (!root) { fail(`${k}: source root missing`); continue; }
    let buffer;
    try { buffer = leerBytes(path.join(corpusRoot, root, row.path)); } catch (error) { fail(`${k}: cannot read corpus file (${error.message})`); continue; }
    if (sha256(buffer) !== entry.sha256) fail(`${k}: corpus bytes differ from pinned sha256`);
    if (row.analysis_class === 'TEXT_FUNCTIONAL' && row.observed_line_count !== null && row.observed_line_count !== lineasDe(buffer)) fail(`${k}: observed line count mismatch`);
    for (const c of row.citations || []) {
      const match = String(c).match(/^(.*):(\d+)$/u);
      if (!match || match[1] !== row.path) { fail(`${k}: malformed citation ${c}`); continue; }
      const n = Number(match[2]);
      const max = row.observed_line_count ?? entry.line_count;
      if (n < 1 || (Number.isInteger(max) && n > max)) fail(`${k}: citation out of range ${c}`);
    }
  }
  for (const k of ledgerByKey.keys()) if (!seen.has(k)) fail(`${k}: missing evidence row`);
  if (seen.size !== pending.length) fail(`row count ${seen.size} != pending count ${pending.length}`);
  return errors;
}

export const leerJsonSiEsta = (file, existe = fs.existsSync, leer = fs.readFileSync) => (existe(file) ? JSON.parse(leer(file, 'utf8')) : null);

/**
 * EL INDICE: plano si esta, comprimido si no, y `null` si no hay ninguno.
 *
 * Sale de `main` a una funcion propia porque «plano si esta, comprimido si no» tiene dos caminos y
 * una maquina solo puede estar en uno. Metido adentro como expresion suelta, la otra mitad no la
 * ejecuta nadie -- y no por falta de pruebas, sino porque no habia por donde entrar. Una decision
 * que no se puede ejercer tampoco se puede corregir cuando este mal, y esta falla en la maquina de
 * otro antes que en la propia.
 */
export function leerIndiceDelDisco(io = {}) {
  const existe = io.existe ?? fs.existsSync;
  const leer = io.leerArchivo ?? fs.readFileSync;
  const plano = leerJsonSiEsta(INDEX_FILE, existe, leer);
  if (plano) return plano;
  const comprimido = `${INDEX_FILE}.gz`;
  return existe(comprimido) ? JSON.parse(zlib.gunzipSync(leer(comprimido)).toString('utf8')) : null;
}

/** La evidencia, que viaja comprimida o no segun cuanto pese. Mismo motivo para sacarla. */
export function leerEvidenciaDelDisco(file, io = {}) {
  const leer = io.leerArchivo ?? fs.readFileSync;
  return file.endsWith('.gz') ? zlib.gunzipSync(leer(file)).toString('utf8') : leer(file, 'utf8');
}

/**
 * Donde buscar la evidencia. Un argumento manda; si no hay, plana si esta y comprimida si no.
 *
 * Antes esto miraba `options.leerEvidencia || fs.existsSync(...)`, o sea mezclaba «me inyectaron un
 * lector» con «el archivo existe». Son dos preguntas distintas y una no contesta la otra.
 */
export function rutaDeEvidencia(args, io = {}) {
  if (args[0]) return path.resolve(args[0]);
  const existe = io.existe ?? fs.existsSync;
  return existe(DEFAULT_EVIDENCE) ? DEFAULT_EVIDENCE : `${DEFAULT_EVIDENCE}.gz`;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const leerLedger = options.leerLedger ?? (() => leerJsonSiEsta(LEDGER_FILE));
  const leerManifest = options.leerManifest ?? (() => leerJsonSiEsta(MANIFEST_FILE));
  const leerIndice = options.leerIndice ?? (() => leerIndiceDelDisco(options));
  const leerEvidencia = options.leerEvidencia ?? ((file) => leerEvidenciaDelDisco(file, options));

  const manifest = leerManifest();
  const ledger = leerLedger();
  const index = ledger ? null : leerIndice();
  // Ni el ledger ni el indice estan en git: son salidas regenerables del corpus. Un `throw` aca
  // salia como stack trace de node y no dejaba distinguir "falta el insumo" de "el gate esta roto".
  if (!ledger && !index) {
    reportArtifactProblem(new ResearchArtifactError(
      MISSING_ARTIFACT,
      'faltan research/semantic-ledger-2026-08-31.json y research/semantic-functional-index-2026-09-01.json(.gz). No están en git a propósito: son salidas regenerables del corpus. Regeneralo con: node research/build-semantic-ledger.mjs y node research/build-semantic-functional-ledger.mjs',
    ), writeError);
    return 1;
  }

  const pending = entradasPendientes(ledger, index);
  const rootBySource = raicesPorFuente(manifest, index);
  const evidencePath = rutaDeEvidencia(args, options);

  const errors = [];
  let lines = [];
  try {
    lines = leerEvidencia(evidencePath).split(String.fromCharCode(10)).filter(Boolean);
  } catch (error) {
    // Ilegible NO es «cero filas correctas»: la segunda saldria verde.
    errors.push(`evidence unreadable: ${error.message}`);
  }
  errors.push(...revisarFuncional(lines, pending, rootBySource, options));

  if (errors.length > 0) {
    for (const error of errors.slice(0, MAX_ERRORS)) writeError(`REJECTED: ${error}`);
    if (errors.length > MAX_ERRORS) writeError(`... and ${errors.length - MAX_ERRORS} more`);
    return 1;
  }
  const semantic = lines.filter((line) => JSON.parse(line).analysis_class === 'TEXT_FUNCTIONAL').length;
  write(`OK: ${lines.length}/${pending.length} entries verified 1:1; ${semantic} full-text functional, ${lines.length - semantic} opaque/static; hashes and citations valid.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-semantic-functional-ledger.mjs')) {
  process.exitCode = main();
}
