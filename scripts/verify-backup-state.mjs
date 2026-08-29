#!/usr/bin/env node
// Records and verifies a small, ignored Graphify receipt. The heavy graph stays generated, but
// the receipt proves which committed tree it was recorded against.
//
// The seal belongs to the protocol, not to Graphify. This used to read the `Built from commit:`
// line of GRAPH_REPORT.md and compare it with HEAD, which broke on 2026-08-28 in this very
// repository: Graphify only rewrites that report when code TOPOLOGY changes, so a docs-only commit
// left the seal naming an ancestor forever while the graph content was perfectly current, and
// `check` rejected a healthy backup with no way to regenerate the line (GRAPHIFY_FORCE=1 does
// nothing without topology changes; `graphify label` needs an API key). Now `record` reads the real
// HEAD with git and `check` compares against the real HEAD again.
//
// Honest limit of the trade: this proves the recorded files have not changed since they were
// recorded at that commit — NOT that the graph was BUILT at it, nor that it describes it. Coverage
// of the current tree is a different gate: verify-graphify-manifest.mjs, which compares the index
// against `git ls-files`.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const USAGE = 'usage: verify-backup-state.mjs record --report <GRAPH_REPORT.md> --graph <graph.json> --manifest <backup.json> | check <backup.json>';
export const MANIFEST_SCHEMA = 'vcp.graphify-backup/v1';

function gitHead(cwd) {
  try {
    // stderr is piped, not inherited: git's own "ambiguous argument 'HEAD'" noise would otherwise
    // reach the operator ahead of the REJECTED line that explains what to do about it.
    return execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error('cannot read git HEAD: a backup receipt needs a commit to bind to');
  }
}

export function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function isWithin(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder !== '' && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

function isWithinOrRoot(root, candidate) {
  return candidate === root || isWithin(root, candidate);
}

// Graphify artifacts and their receipt are local evidence. Never read or create them outside the
// checkout through an absolute path, `..`, symlink or Windows junction: otherwise a manifest
// could attest to arbitrary host files rather than to this project's backup.
export function projectPath(cwd, path) {
  if (typeof path !== 'string' || path === '') throw new Error('backup path is missing');
  const root = realpathSync(cwd);
  const file = resolve(root, path);
  if (!isWithin(root, file)) throw new Error(`backup path escapes the project: ${path}`);
  let ancestor = file;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    ancestor = parent;
  }
  if (!isWithinOrRoot(root, realpathSync(ancestor))) throw new Error(`backup path resolves outside the project: ${path}`);
  return { root, file };
}

export function readableProjectFile(cwd, path) {
  const { root, file } = projectPath(cwd, path);
  if (!existsSync(file)) throw new Error(`backup file not found: ${path}`);
  const stat = lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`backup file is not a regular project file: ${path}`);
  return file;
}

export function writableProjectFile(cwd, path) {
  const { root, file } = projectPath(cwd, path);
  if (existsSync(file)) {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`backup manifest is not a regular project file: ${path}`);
  }
  return file;
}

// One resolver for both Graphify inputs, so the report and the graph can never drift into different
// rules. The emptiness floor does NOT claim the file is a Graphify artifact — this gate deliberately
// stopped inspecting the report's contents — it only refuses to seal a receipt over zero bytes,
// which is a mistyped flag rather than evidence.
function graphifyInputFile(cwd, path, label) {
  let file;
  try {
    file = readableProjectFile(cwd, path);
  } catch (error) {
    if (/backup file not found/u.test(error.message)) throw new Error(`Graphify ${label} not found: ${path}`);
    throw error;
  }
  if (lstatSync(file).size === 0) throw new Error(`Graphify ${label} is empty: ${path}`);
  return file;
}

// Compared resolved and through realpath, never as raw strings: `./graphify-out/graph.json` and
// `graphify-out/graph.json` name the same bytes, and so do two spellings that differ only in case
// on Windows.
function isSameFile(one, other) {
  return realpathSync(one) === realpathSync(other);
}

function isBackupManifest(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).schema === MANIFEST_SCHEMA;
  } catch {
    // Unparseable, or parsed to something with no fields to read: either way it is not a receipt
    // this tool wrote, so it is not ours to overwrite.
    return false;
  }
}

// `record` writes, so its output path is the one place this tool can destroy a project file. The
// only overwrite that was ever intended is re-recording over a previous receipt; everything else —
// the graph, the report, or any unrelated file reached by a mistyped --manifest — is refused BEFORE
// a single byte is written. This ran silently for real: `--manifest graphify-out/graph.json`
// replaced the graph with the receipt and answered `OK` with exit 0.
function manifestOutputFile(cwd, manifestPath, reportFile, graphFile) {
  const manifestFile = writableProjectFile(cwd, manifestPath);
  if (existsSync(manifestFile)) {
    if (isSameFile(manifestFile, reportFile)) throw new Error(`refusing to overwrite the Graphify report with the manifest: ${manifestPath}`);
    if (isSameFile(manifestFile, graphFile)) throw new Error(`refusing to overwrite the Graphify graph with the manifest: ${manifestPath}`);
    if (!isBackupManifest(manifestFile)) throw new Error(`refusing to overwrite a file that is not a backup manifest: ${manifestPath}`);
  }
  return manifestFile;
}

function storedPath(cwd, path) {
  const { root, file } = projectPath(cwd, path);
  return relative(root, file).replaceAll('\\', '/');
}

/** El manifest.json que Graphify escribe junto al grafo: no es un argumento del gate, se deduce de
 * la ruta del grafo. Devuelve null si no existe, para que un proyecto sin inventario siga pudiendo
 * sellar su backup en vez de quedar bloqueado por un archivo que no le corresponde crear. */
export function graphInventoryFile(cwd, graphPath) {
  const candidato = join(dirname(graphPath), 'manifest.json');
  try {
    // readableProjectFile ya rechaza lo que no existe, lo que no es archivo regular y lo que se
    // escapa del proyecto: un ternario extra aca seria una rama que ninguna prueba puede alcanzar.
    return readableProjectFile(cwd, candidato);
  } catch {
    return null;
  }
}

export function record({ reportPath, graphPath, manifestPath, cwd = '.', now = new Date().toISOString() }) {
  const reportFile = graphifyInputFile(cwd, reportPath, 'report');
  const graphFile = graphifyInputFile(cwd, graphPath, 'graph');
  const manifestFile = manifestOutputFile(cwd, manifestPath, reportFile, graphFile);
  const head = gitHead(cwd);
  // El inventario de Graphify vive junto al grafo y es el que declara QUE archivos cubre. Sin
  // sellarlo, alterar la cobertura despues del backup dejaba este gate y el del manifiesto en verde
  // a la vez, sobre un grafo que ya no correspondia. Reproducido el 2026-08-28.
  const inventory = graphInventoryFile(cwd, graphPath);
  const manifest = {
    schema: MANIFEST_SCHEMA, git_head: head, recorded_at: now,
    graph_report: storedPath(cwd, reportPath), graph_report_sha256: sha256(reportFile), graph: storedPath(cwd, graphPath), graph_sha256: sha256(graphFile),
    graph_inventory_sha256: inventory === null ? '' : sha256(inventory),
  };
  mkdirSync(dirname(manifestFile), { recursive: true });
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function verify(manifestPath, cwd = '.') {
  let manifestFile;
  try {
    const { file } = projectPath(cwd, manifestPath);
    if (!existsSync(file)) return { ok: false, reason: `backup manifest not found: ${manifestPath}` };
    manifestFile = readableProjectFile(cwd, manifestPath);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch (error) {
    return { ok: false, reason: `backup manifest is not valid JSON: ${error.message}` };
  }
  if (manifest.schema !== MANIFEST_SCHEMA) return { ok: false, reason: 'unknown backup manifest schema' };
  const required = ['git_head', 'graph_report', 'graph_report_sha256', 'graph', 'graph_sha256'];
  if (required.some((field) => typeof manifest[field] !== 'string' || manifest[field] === '')) return { ok: false, reason: 'backup manifest has missing required fields' };
  try {
    const reportFile = graphifyInputFile(cwd, manifest.graph_report, 'report');
    const graphFile = graphifyInputFile(cwd, manifest.graph, 'graph');
    const head = gitHead(cwd);
    // Exact equality, never a prefix: the seal is written by this script from `git rev-parse`, so a
    // shortened or hand-edited value is a rewritten receipt, not a legitimate abbreviation.
    if (manifest.git_head !== head) return { ok: false, reason: `backup manifest HEAD ${manifest.git_head} is stale against ${head}` };
    if (sha256(reportFile) !== manifest.graph_report_sha256) return { ok: false, reason: 'Graphify report hash changed after backup' };
    // El inventario tambien: es el que dice que archivos cubre el grafo, y sin el un cambio de
    // cobertura pasaba invisible entre este gate y el del manifiesto.
    const inventoryFile = graphInventoryFile(cwd, manifest.graph);
    const inventoryNow = inventoryFile === null ? '' : sha256(inventoryFile);
    const inventoryThen = manifest.graph_inventory_sha256 ?? '';
    if (inventoryNow !== inventoryThen) return { ok: false, reason: 'Graphify inventory (manifest.json) changed after backup: the graph no longer covers what the receipt sealed' };
    if (sha256(graphFile) !== manifest.graph_sha256) return { ok: false, reason: 'Graphify graph hash changed after backup' };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, manifest };
}

function parseArgs(args) {
  if (args.length === 2 && args[0] === 'check') return { command: 'check', manifestPath: args[1] };
  if (args.length !== 7 || args[0] !== 'record') return null;
  const values = {};
  for (let index = 1; index < args.length; index += 2) {
    if (!['--report', '--graph', '--manifest'].includes(args[index]) || values[args[index]] || !args[index + 1]) return null;
    values[args[index]] = args[index + 1];
  }
  return { command: 'record', reportPath: values['--report'], graphPath: values['--graph'], manifestPath: values['--manifest'] };
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  try {
    if (parsed.command === 'record') {
      const manifest = record({ ...parsed, cwd });
      write(`OK: Graphify backup recorded for ${manifest.git_head}.`);
      return 0;
    }
    const result = verify(parsed.manifestPath, cwd);
    if (!result.ok) {
      writeError(`REJECTED: ${result.reason}`);
      return 1;
    }
    write(`OK: Graphify backup matches ${result.manifest.git_head}.`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-backup-state.mjs')) {
  process.exitCode = main();
}
