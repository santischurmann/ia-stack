#!/usr/bin/env node
// Keeps the Graphify claim of repository coverage honest. The graph manifest lists the files that
// were actually indexed; this gate proves every tracked file is either in that manifest or carries
// a declared, reviewable exclusion — and that the manifest holds no entry Git no longer tracks.
//
// It deliberately proves bookkeeping, not comprehension: a file present in the manifest may still
// have produced a shallow or empty node. "Covered" here means "accounted for", never "understood".

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
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

/** Una exclusión que termina en `/` es una carpeta, no un archivo: cubre todo lo que viva abajo.
 *
 * Existe porque archivar un expediente cerrado es una operación recurrente del protocolo, y con
 * rutas exactas cada archivado dejaba el gate en rojo hasta reindexar una herramienta externa que
 * el protocolo declara opcional. Pasó una vez, con `docs/cycles/`. */
function esPrefijo(path) {
  return path.endsWith('/');
}

function cubre(exclusionPath, path) {
  return esPrefijo(exclusionPath) ? path.startsWith(exclusionPath) : path === exclusionPath;
}

/** Pure set comparison: every disagreement between Git, the graph and the declared exclusions.
 *
 * `builtAt` (ms) y `mtimeOf` separan DOS cosas que el gate confundia. Un archivo rastreado que el
 * manifiesto no tiene significa una de dos cosas opuestas: si ya existia cuando el grafo se
 * construyo, la declaracion de cobertura es FALSA y se rechaza; si nacio despues, el grafo no
 * miente, esta VIEJO. Y estar viejo a mitad de ciclo es el estado esperado, porque
 * `skills/integracion-graphify.md` fija el orden commit -> graphify -> record -> check: el
 * reindexado va al publicar, no en cada archivo que se agrega.
 *
 * Sin los dos datos no se adivina: todo lo ausente rechaza, que es el comportamiento anterior. */
export function compareCoverage({ tracked, manifest, exclusions, builtAt = null, mtimeOf = null }) {
  const trackedSet = new Set(tracked);
  const manifestSet = new Set(manifest);
  const excluded = exclusions.map((entry) => entry.path);
  const estaExcluido = (path) => excluded.some((exclusion) => cubre(exclusion, path));
  const ausentes = tracked.filter((path) => !manifestSet.has(path) && !estaExcluido(path));
  const puedeFechar = typeof builtAt === 'number' && typeof mtimeOf === 'function';
  const stale = (puedeFechar ? ausentes.filter((path) => mtimeOf(path) > builtAt) : []).sort();
  const staleSet = new Set(stale);
  const missing = ausentes.filter((path) => !staleSet.has(path)).sort();
  const ghosts = manifest.filter((path) => !trackedSet.has(path)).sort();
  const dead = excluded.filter((exclusion) => !tracked.some((path) => cubre(exclusion, path))).sort();
  // Sólo la ruta exacta contradice. Un prefijo no afirma «esto no merece un nodo» sino «lo que viva
  // acá abajo no obliga a regenerar el grafo», y eso sigue siendo cierto cuando el reindexado los
  // toma igual — que es lo que va a pasar, porque Graphify indexa lo rastreado.
  const contradictions = excluded.filter((exclusion) => !esPrefijo(exclusion) && manifestSet.has(exclusion)).sort();
  // `stale` NO entra en `ok`: un grafo viejo no es una cobertura mentida. Pero tampoco compra un
  // OK -- main lo reporta aparte, con los nombres, para que nadie lea el verde como "esta al dia".
  return { ok: missing.length === 0 && ghosts.length === 0 && dead.length === 0 && contradictions.length === 0, missing, stale, ghosts, dead, contradictions };
}

export function main(args = process.argv.slice(2), cwd = '.', options = {}, write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const readTracked = options.readTracked ?? (() => readTrackedFiles(cwd));
  const readManifest = options.readManifestPaths ?? (() => readManifestPaths(cwd));
  const readExclusionList = options.readExclusionList ?? (() => readExclusions((path, encoding) => readFileSync(join(cwd, path), encoding)));
  // Cuando no se puede fechar -- sin manifiesto en disco, o un archivo que no se deja mirar -- se
  // devuelve null y compareCoverage vuelve al comportamiento estricto. Nunca se inventa una fecha.
  const manifestBuiltAt = options.manifestBuiltAt ?? (() => {
    const info = statSync(join(cwd, MANIFEST_PATH), { throwIfNoEntry: false });
    return info === undefined ? null : info.mtimeMs;
  });
  const mtimeOf = options.mtimeOf ?? ((path) => {
    const info = statSync(join(cwd, path), { throwIfNoEntry: false });
    return info === undefined ? 0 : info.mtimeMs;
  });
  let result;
  let tracked;
  let exclusions;
  try {
    tracked = readTracked();
    exclusions = readExclusionList();
    result = compareCoverage({ tracked, manifest: readManifest(), exclusions, builtAt: manifestBuiltAt(), mtimeOf });
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
  if (result.stale.length > 0) {
    write(`DESACTUALIZADO: el grafo se construyó antes que ${result.stale.length} archivo(s) rastreado(s), así que todavía no los cubre: ${result.stale.join(', ')}. No es una cobertura mentida —los archivos nacieron después— y el reindexado va al publicar, no acá. Hasta entonces esto NO dice que la cobertura del grafo esté bien: dice que no se pudo mirar.`);
    return 0;
  }
  // A passing run has no dead exclusions, so every declared exclusion names a real tracked file.
  const indexed = tracked.length - exclusions.length;
  write(`OK: Graphify manifest covers ${indexed} tracked file(s) with every exclusion declared and justified.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-graphify-manifest.mjs')) process.exitCode = main();
