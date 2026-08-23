#!/usr/bin/env node
// Records and verifies a small, ignored Graphify receipt. The heavy graph stays generated, but
// the receipt proves which committed tree it describes.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';

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

function fullPath(cwd, path) {
  return isAbsolute(path) ? path : join(cwd, path);
}

function storedPath(cwd, path) {
  return isAbsolute(path) ? relative(cwd, path).replaceAll('\\', '/') : path.replaceAll('\\', '/');
}

function requireCurrentReport(reportPath, cwd) {
  if (!existsSync(reportPath)) throw new Error(`Graphify report not found: ${reportPath}`);
  const head = gitHead(cwd);
  const built = graphCommit(readFileSync(reportPath, 'utf8'));
  if (!isCurrent(built, head)) throw new Error(`Graphify report is stale: built ${built ?? 'missing'}, HEAD ${head}`);
  return head;
}

export function record({ reportPath, graphPath, manifestPath, cwd = '.', now = new Date().toISOString() }) {
  const reportFile = fullPath(cwd, reportPath);
  const graphFile = fullPath(cwd, graphPath);
  const manifestFile = fullPath(cwd, manifestPath);
  if (!existsSync(graphFile)) throw new Error(`Graphify graph not found: ${graphPath}`);
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
  const manifestFile = fullPath(cwd, manifestPath);
  if (!existsSync(manifestFile)) return { ok: false, reason: `backup manifest not found: ${manifestPath}` };
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
    const reportFile = fullPath(cwd, manifest.graph_report);
    const graphFile = fullPath(cwd, manifest.graph);
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
