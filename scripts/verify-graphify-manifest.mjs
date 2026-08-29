#!/usr/bin/env node
// Keeps the Graphify claim of repository coverage honest. The graph manifest lists the files that
// were actually indexed; this gate proves every tracked file is either in that manifest or carries
// a declared, reviewable exclusion — and that the manifest holds no entry Git no longer tracks.
//
// It deliberately proves bookkeeping, not comprehension: a file present in the manifest may still
// have produced a shallow or empty node. "Covered" here means "accounted for", never "understood".

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-graphify-manifest.mjs check';
export const EXCLUSIONS_SCHEMA = 'vcp.graphify-exclusions/1';
export const EXCLUSIONS_PATH = join('contracts', 'graphify-exclusions.json');
export const MANIFEST_PATH = join('graphify-out', 'manifest.json');

const EXCLUSION_KEYS = new Set(['path', 'reason']);
const PLACEHOLDER_REASON = /^(?:tbd|todo|n\/a|na|none|unknown|placeholder|-)$/iu;
const MIN_REASON_LENGTH = 8;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Git reports POSIX separators; normalize anyway so a Windows manifest compares cleanly. */
function normalize(value) {
  return value.split('\\').join('/');
}

export function readTrackedFiles(cwd, runGit = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' })) {
  let output;
  try {
    // -z: sin esto git escapa los nombres no ASCII entre comillas y con octales
    // ("docs/decisi\303\263n.md"), asi que un solo archivo con acento dejaba el gate en rojo
    // permanente y con el nombre destrozado en el mensaje. Reproducido el 2026-08-28.
    output = runGit(cwd, ['ls-files', '-z']);
  } catch (error) {
    throw new Error(`unable to list tracked files: ${error.message}`);
  }
  // Con -z el separador es NUL. Se acepta tambien el salto de linea para no romper a quien inyecte
  // una salida de prueba con el formato viejo.
  return String(output).split(/[\0\n]/u).map((line) => normalize(line.trim())).filter(Boolean);
}

/** Una entrada que Graphify escribio trae datos: al menos una propiedad con valor. Una entrada
 * vacia es la firma de que alguien la puso a mano para comprar cobertura -el manifiesto no esta
 * versionado, asi que no queda rastro revisable de eso-. No prueba que Graphify la haya escrito;
 * sube el precio de falsificarla de "una llave vacia" a "inventar datos que parezcan reales".
 * Reproducido el 2026-08-28 atacando este gate.
 */
export function hasRealContent(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
  return Object.values(entry).some((value) => value !== null && value !== undefined && value !== '');
}

export function readManifestPaths(cwd, read = readFileSync) {
  const path = join(cwd, MANIFEST_PATH);
  let parsed;
  try {
    parsed = JSON.parse(read(path, 'utf8'));
  } catch (error) {
    throw new Error(`unable to read the Graphify manifest at ${MANIFEST_PATH}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`the Graphify manifest at ${MANIFEST_PATH} must be a path-keyed object`);
  }
  // Solo cuentan las entradas con datos reales: una llave vacia escrita a mano compraba cobertura,
  // y el manifiesto no esta versionado, asi que no quedaba rastro revisable de eso.
  return Object.entries(parsed).filter(([, entry]) => hasRealContent(entry)).map(([path]) => normalize(path));
}

export function readExclusions(read) {
  let parsed;
  try {
    parsed = JSON.parse(read(EXCLUSIONS_PATH, 'utf8'));
  } catch (error) {
    // A project that never declared exclusions simply has none: every tracked file must then be
    // indexed. Only a missing file is benign — an unreadable or malformed one still fails loudly.
    if (error.code === 'ENOENT') return [];
    throw new Error(`${EXCLUSIONS_PATH} is not valid JSON: ${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || parsed.schema !== EXCLUSIONS_SCHEMA) {
    throw new Error(`${EXCLUSIONS_PATH} must declare schema ${EXCLUSIONS_SCHEMA}`);
  }
  if (!Array.isArray(parsed.exclusions)) throw new Error(`${EXCLUSIONS_PATH} must contain an exclusions array`);
  const seen = new Set();
  return parsed.exclusions.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).length !== EXCLUSION_KEYS.size
      || !Object.keys(entry).every((key) => EXCLUSION_KEYS.has(key))
      || !nonEmpty(entry.path) || !nonEmpty(entry.reason)) {
      throw new Error('every exclusion needs exactly a path and a reason');
    }
    const trimmed = entry.reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH || PLACEHOLDER_REASON.test(trimmed)) {
      throw new Error(`exclusion ${entry.path} needs a real reason, not a placeholder`);
    }
    const path = normalize(entry.path.trim());
    if (seen.has(path)) throw new Error(`duplicate exclusion: ${path}`);
    seen.add(path);
    return { path, reason: trimmed };
  });
}

/** Pure set comparison: every disagreement between Git, the graph and the declared exclusions. */
export function compareCoverage({ tracked, manifest, exclusions }) {
  const trackedSet = new Set(tracked);
  const manifestSet = new Set(manifest);
  const excludedSet = new Set(exclusions.map((entry) => entry.path));
  const missing = tracked.filter((path) => !manifestSet.has(path) && !excludedSet.has(path)).sort();
  const ghosts = manifest.filter((path) => !trackedSet.has(path)).sort();
  const dead = [...excludedSet].filter((path) => !trackedSet.has(path)).sort();
  const contradictions = [...excludedSet].filter((path) => manifestSet.has(path)).sort();
  return { ok: missing.length === 0 && ghosts.length === 0 && dead.length === 0 && contradictions.length === 0, missing, ghosts, dead, contradictions };
}

export function main(args = process.argv.slice(2), cwd = '.', options = {}, write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const readTracked = options.readTracked ?? (() => readTrackedFiles(cwd));
  const readManifest = options.readManifestPaths ?? (() => readManifestPaths(cwd));
  const readExclusionList = options.readExclusionList ?? (() => readExclusions((path, encoding) => readFileSync(join(cwd, path), encoding)));
  let result;
  let tracked;
  let exclusions;
  try {
    tracked = readTracked();
    exclusions = readExclusionList();
    result = compareCoverage({ tracked, manifest: readManifest(), exclusions });
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  if (!result.ok) {
    if (result.missing.length > 0) writeError(`REJECTED: tracked files absent from the Graphify manifest and undeclared: ${result.missing.join(', ')}`);
    if (result.ghosts.length > 0) writeError(`REJECTED: Graphify manifest entries Git no longer tracks: ${result.ghosts.join(', ')}`);
    if (result.dead.length > 0) writeError(`REJECTED: declared exclusions for files that do not exist: ${result.dead.join(', ')}`);
    if (result.contradictions.length > 0) writeError(`REJECTED: files declared excluded yet present in the manifest: ${result.contradictions.join(', ')}`);
    return 1;
  }
  // A passing run has no dead exclusions, so every declared exclusion names a real tracked file.
  const indexed = tracked.length - exclusions.length;
  write(`OK: Graphify manifest covers ${indexed} tracked file(s) with every exclusion declared and justified.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-graphify-manifest.mjs')) process.exitCode = main();
