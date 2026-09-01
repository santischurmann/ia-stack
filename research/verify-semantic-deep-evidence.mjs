#!/usr/bin/env node
/*
 * Verify deep semantic evidence without promoting the canonical ledger.
 * Every row must point to a current PENDING entry, preserve its pinned commit/hash,
 * and cite real lines in the materialized external corpus.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ResearchArtifactError, loadJsonArtifact, loadTextArtifact } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
const manifestPath = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
const ledgerPath = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
const evidencePath = path.resolve(process.argv[2] || path.join(researchDir, 'semantic-deep-evidence-2026-08-31.ndjson'));
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT
  || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');

const required = ['purpose', 'behavior', 'outputs', 'invariants_limits', 'tests', 'risks', 'vcp_relevance_reason'];
const validRelevance = new Set(['ADOPT', 'DEFER', 'REJECT']);
const errors = [];
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const lineCount = (buffer) => buffer.toString('utf8').split(String.fromCharCode(10)).length;
const fail = (message) => errors.push(message);

// Un archivo ausente no es un JSON inválido: son dos problemas distintos y se arreglan distinto.
// Antes los dos salían como "invalid JSON" y con la ruta absoluta de la máquina.
function loadJson(file, comoRegenerar) {
  try {
    return loadJsonArtifact(file, comoRegenerar, { root: repoRoot });
  } catch (error) {
    if (error instanceof ResearchArtifactError) {
      fail(`${error.code}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

const manifest = loadJson(manifestPath, 'node research/build-functional-inventory.mjs');
const ledger = loadJson(ledgerPath, 'node research/build-semantic-ledger.mjs');
const ledgerByKey = new Map((ledger?.entries || []).map((entry) => [`${entry.source}|${entry.path}`, entry]));
const rootBySource = new Map((manifest?.sources || []).map((source) => [source.slug, source.root_dir]));
let lines = [];
try {
  lines = loadTextArtifact(evidencePath, 'node research/build-full-evidence-pass.mjs', { root: repoRoot }).split(String.fromCharCode(10)).filter(Boolean);
} catch (error) {
  if (!(error instanceof ResearchArtifactError)) throw error;
  fail(`${error.code}: ${error.message}`);
}

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
  for (const field of required) if (typeof row[field] !== 'string' || row[field].trim() === '') fail(`${key}: missing ${field}`);
  if (!(typeof row.interfaces === 'string' || typeof row.inputs === 'string')) fail(`${key}: missing interfaces or inputs`);
  if (!validRelevance.has(row.vcp_relevance)) fail(`${key}: invalid vcp_relevance`);
  if (typeof row.confidence !== 'number' || row.confidence < 0 || row.confidence > 1) fail(`${key}: invalid confidence`);
  if (!Array.isArray(row.citations) || row.citations.length < 2) fail(`${key}: fewer than two citations`);

  const rootDir = rootBySource.get(row.source);
  if (!rootDir) { fail(`${key}: source root missing from manifest`); continue; }
  const absolute = path.join(corpusRoot, rootDir, row.path);
  let buffer;
  try { buffer = fs.readFileSync(absolute); }
  catch (error) { fail(`${key}: materialized file unreadable (${error.message})`); continue; }
  if (sha256(buffer) !== ledgerEntry.sha256) fail(`${key}: source bytes do not match ledger sha256`);
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

if (errors.length) {
  for (const error of errors.slice(0, 40)) console.error(`REJECTED: ${error}`);
  if (errors.length > 40) console.error(`... and ${errors.length - 40} more`);
  process.exitCode = 1;
} else {
  console.log(`OK: ${lines.length} deep evidence row(s), unique and hash/citation verified against the pinned corpus.`);
}
