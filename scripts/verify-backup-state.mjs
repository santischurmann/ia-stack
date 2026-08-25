#!/usr/bin/env node
// Records and verifies a small, ignored Graphify receipt. The heavy graph stays generated, but
// the receipt proves which committed tree it describes.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const USAGE = 'usage: verify-backup-state.mjs record --report <GRAPH_REPORT.md> --graph <graph.json> --manifest <backup.json> | check <backup.json>';

function gitHead(cwd = '.') {
  return execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

export function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function graphCommit(report) {
  return report.match(/Built from commit:\s*`([0-9a-f]+)`/iu)?.[1] ?? null;
}

function isCurrent(graphSha, head) {
  return typeof graphSha === 'string' && graphSha.length >= 7 && head.startsWith(graphSha);
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

function graphifyReportFile(cwd, path) {
  try {
    return readableProjectFile(cwd, path);
  } catch (error) {
    if (/backup file not found/u.test(error.message)) throw new Error(`Graphify report not found: ${path}`);
    throw error;
  }
}

function storedPath(cwd, path) {
  const { root, file } = projectPath(cwd, path);
  return relative(root, file).replaceAll('\\', '/');
}

function requireCurrentReport(reportPath, cwd) {
  const head = gitHead(cwd);
  const built = graphCommit(readFileSync(reportPath, 'utf8'));
  if (!isCurrent(built, head)) throw new Error(`Graphify report is stale: built ${built ?? 'missing'}, HEAD ${head}`);
  return head;
}

export function record({ reportPath, graphPath, manifestPath, cwd = '.', now = new Date().toISOString() }) {
  const reportFile = graphifyReportFile(cwd, reportPath);
  let graphFile;
  try {
    graphFile = readableProjectFile(cwd, graphPath);
  } catch (error) {
    if (/backup file not found/u.test(error.message)) throw new Error(`Graphify graph not found: ${graphPath}`);
    throw error;
  }
  const manifestFile = writableProjectFile(cwd, manifestPath);
  const head = requireCurrentReport(reportFile, cwd);
  const manifest = {
    schema: 'vcp.graphify-backup/v1', git_head: head, recorded_at: now,
    graph_report: storedPath(cwd, reportPath), graph_report_sha256: sha256(reportFile), graph: storedPath(cwd, graphPath), graph_sha256: sha256(graphFile),
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
  if (manifest.schema !== 'vcp.graphify-backup/v1') return { ok: false, reason: 'unknown backup manifest schema' };
  const required = ['git_head', 'graph_report', 'graph_report_sha256', 'graph', 'graph_sha256'];
  if (required.some((field) => typeof manifest[field] !== 'string' || manifest[field] === '')) return { ok: false, reason: 'backup manifest has missing required fields' };
  try {
    const reportFile = graphifyReportFile(cwd, manifest.graph_report);
    const graphFile = readableProjectFile(cwd, manifest.graph);
    const head = requireCurrentReport(reportFile, cwd);
    if (manifest.git_head !== head) return { ok: false, reason: `backup manifest HEAD ${manifest.git_head} is stale against ${head}` };
    if (sha256(reportFile) !== manifest.graph_report_sha256) return { ok: false, reason: 'Graphify report hash changed after backup' };
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
