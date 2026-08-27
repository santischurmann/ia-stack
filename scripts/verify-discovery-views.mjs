#!/usr/bin/env node
// Native, deterministic renderer/verifier for Discovery Markdown views. Views are derived
// convenience artifacts only: immutable JSON decisions and packets remain the source of truth.

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { assertTrustedDirectory, DiscoveryCoreError, readDiscoveryHistory } from './verify-discovery-core.mjs';

export const USAGE = 'usage: verify-discovery-views.mjs check|render --feature <feature-slug>';
const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VIEW_FILE = /^run-\d{3}\.md$/u;
const FIXED_STATUS = new Set(['pending', 'completed', 'skipped', 'overridden']);
const VIEW_FS = { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync };

export class DiscoveryViewsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function reject(code, message) {
  throw new DiscoveryViewsError(code, message);
}

function contained(root, candidate) {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

export function trustedViewsDirectory(projectRoot, featureSlug, create = false, fs = VIEW_FS) {
  const featureRoot = assertTrustedDirectory(projectRoot, ['docs', 'discovery', featureSlug], 'DISCOVERY_VIEW_SYMLINK', fs);
  const views = resolve(featureRoot, 'views');
  if (!fs.existsSync(views)) {
    if (!create) reject('DISCOVERY_VIEW_MISSING', `${featureSlug}: views directory is missing`);
    try {
      fs.mkdirSync(views);
    } catch {
      reject('DISCOVERY_VIEW_WRITE_FAILED', `${featureSlug}: cannot create views directory`);
    }
  }
  let stat;
  try {
    stat = fs.lstatSync(views);
  } catch {
    reject('DISCOVERY_VIEW_MISSING', `${featureSlug}: views directory is missing`);
  }
  if (stat.isSymbolicLink()) reject('DISCOVERY_VIEW_SYMLINK', `${featureSlug}: views directory is a symlink`);
  if (!stat.isDirectory()) reject('DISCOVERY_VIEW_PATH_INVALID', `${featureSlug}: views is not a directory`);
  let real;
  try {
    real = fs.realpathSync(views);
  } catch {
    reject('DISCOVERY_VIEW_PATH_INVALID', `${featureSlug}: cannot resolve views directory`);
  }
  if (!contained(fs.realpathSync(projectRoot), real)) reject('DISCOVERY_VIEW_PATH_INVALID', `${featureSlug}: views escapes project`);
  return real;
}

export function renderDecision(decision, packet) {
  if (!FIXED_STATUS.has(decision.status)) reject('DISCOVERY_VIEW_RENDER_INVALID', `${decision.decision_id}: unknown status`);
  const lines = [
    `### ${decision.decision_id}`,
    '',
    `- Estado: ${decision.status}`,
    `- Transición: ${decision.transition_kind}`,
  ];
  if (packet) {
    const counts = new Map();
    for (const claim of packet.research_snapshot.claims) {
      counts.set(claim.evidence_classification, (counts.get(claim.evidence_classification) ?? 0) + 1);
    }
    const classifications = [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
    lines.push(`- Claims: ${packet.research_snapshot.claims.length}`);
    lines.push(`- Clases de evidencia: ${classifications.map(([kind, count]) => `${kind} (${count})`).join(', ')}`);
  }
  return lines;
}

export function renderRunView(featureSlug, run) {
  if (!FEATURE_SLUG.test(featureSlug) || !run || !/^run-\d{3}$/u.test(run.runId) || !Array.isArray(run.history)) {
    reject('DISCOVERY_VIEW_RENDER_INVALID', 'history cannot render a canonical view');
  }
  const lines = [`# Discovery: ${featureSlug}`, '', `## ${run.runId}`, ''];
  for (const entry of run.history) lines.push(...renderDecision(entry.decision, entry.packet), '');
  return Buffer.from(`${lines.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
}

export function canonicalViewBytes(bytes) {
  return !bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))
    && !bytes.includes(0x0d)
    && bytes.length > 0
    && bytes.at(-1) === 0x0a;
}

export function listViewFiles(directory, fs = VIEW_FS) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name).sort();
  } catch {
    reject('DISCOVERY_VIEW_PATH_INVALID', 'cannot enumerate views directory');
  }
}

export function readTrustedView(projectRoot, featureSlug, file, fs = VIEW_FS) {
  if (!VIEW_FILE.test(file)) reject('DISCOVERY_VIEW_UNEXPECTED_FILE', `${file}: views only permits canonical Markdown files`);
  const directory = trustedViewsDirectory(projectRoot, featureSlug, false, fs);
  const path = resolve(directory, file);
  let stat;
  try {
    stat = fs.lstatSync(path);
  } catch {
    reject('DISCOVERY_VIEW_MISSING', `${file}: view is missing`);
  }
  if (stat.isSymbolicLink()) reject('DISCOVERY_VIEW_SYMLINK', `${file}: view is a symlink`);
  if (!stat.isFile()) reject('DISCOVERY_VIEW_PATH_INVALID', `${file}: view is not a regular file`);
  if (!contained(fs.realpathSync(projectRoot), fs.realpathSync(path))) reject('DISCOVERY_VIEW_PATH_INVALID', `${file}: view escapes project`);
  try {
    return fs.readFileSync(path);
  } catch {
    reject('DISCOVERY_VIEW_PATH_INVALID', `${file}: view is unreadable`);
  }
}

export function verifyDiscoveryViews(projectRoot, featureSlug, readHistory = readDiscoveryHistory) {
  const history = readHistory(projectRoot, featureSlug);
  const directory = trustedViewsDirectory(projectRoot, featureSlug);
  const expected = new Map(history.runs.map((run) => [`${run.runId}.md`, renderRunView(featureSlug, run)]));
  const files = listViewFiles(directory);
  if (files.length !== expected.size || files.some((file) => !expected.has(file))) {
    reject('DISCOVERY_VIEW_UNEXPECTED_FILE', `${featureSlug}: views must contain exactly one Markdown file per run`);
  }
  for (const [file, rendered] of expected) {
    const actual = readTrustedView(projectRoot, featureSlug, file);
    if (!canonicalViewBytes(actual)) reject('DISCOVERY_VIEW_FORMAT_INVALID', `${file}: expected UTF-8 without BOM, LF and final newline`);
    if (!actual.equals(rendered)) reject('DISCOVERY_VIEW_STALE', `${file}: differs from deterministic regeneration`);
  }
  return { ok: true, views: expected.size };
}

export function renderDiscoveryViews(projectRoot, featureSlug, readHistory = readDiscoveryHistory, write = writeFileSync) {
  const history = readHistory(projectRoot, featureSlug);
  const directory = trustedViewsDirectory(projectRoot, featureSlug, true);
  const expected = new Map(history.runs.map((run) => [`${run.runId}.md`, renderRunView(featureSlug, run)]));
  const existing = listViewFiles(directory);
  if (existing.some((file) => !VIEW_FILE.test(file) || !expected.has(file))) {
    reject('DISCOVERY_VIEW_UNEXPECTED_FILE', `${featureSlug}: render refuses unknown view files`);
  }
  for (const [file, bytes] of expected) {
    const target = resolve(directory, file);
    try {
      write(target, bytes);
    } catch {
      reject('DISCOVERY_VIEW_WRITE_FAILED', `${file}: cannot write deterministic view`);
    }
  }
  return { ok: true, views: expected.size };
}

export function parseArgs(args) {
  return args.length === 3 && (args[0] === 'check' || args[0] === 'render') && args[1] === '--feature' && FEATURE_SLUG.test(args[2])
    ? { command: args[0], featureSlug: args[2] }
    : null;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, verify = verifyDiscoveryViews, render = renderDiscoveryViews) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  try {
    const result = parsed.command === 'check' ? verify(cwd, parsed.featureSlug) : render(cwd, parsed.featureSlug);
    write(`OK: ${parsed.featureSlug} has ${result.views} deterministic Discovery view(s).`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.code ?? 'DISCOVERY_VIEW_RENDER_INVALID'}: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-discovery-views.mjs')) {
  process.exitCode = main();
}
