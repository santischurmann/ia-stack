#!/usr/bin/env node
/* Verify the full functional-semantic review against the pinned corpus. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { MISSING_ARTIFACT, ResearchArtifactError, reportArtifactProblem } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
const manifestPath = path.join(researchDir, 'corpus-manifest-2026-08-31.json');
const ledgerPath = path.join(researchDir, 'semantic-ledger-2026-08-31.json');
const indexPath = path.join(researchDir, 'semantic-functional-index-2026-09-01.json');
const compressedIndexPath = `${indexPath}.gz`;
const defaultEvidence = path.join(researchDir, 'semantic-functional-evidence-2026-09-01.ndjson');
const defaultCompressed = `${defaultEvidence}.gz`;
const requestedEvidence = process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(defaultEvidence) ? defaultEvidence : defaultCompressed);
const evidencePath = requestedEvidence;
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const key = (source, filePath) => `${source}\0${filePath}`;
const errors = [];
const fail = (message) => errors.push(message);

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : null;
let index = null;
if (!ledger && fs.existsSync(indexPath)) index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
if (!ledger && !index && fs.existsSync(compressedIndexPath)) index = JSON.parse(zlib.gunzipSync(fs.readFileSync(compressedIndexPath)).toString('utf8'));
// Ni el ledger ni el índice están en git: son salidas regenerables del corpus. Un `throw` acá
// salía como stack trace de node y no dejaba distinguir "falta el insumo" de "el gate está roto".
if (!ledger && !index) {
  reportArtifactProblem(new ResearchArtifactError(
    MISSING_ARTIFACT,
    'faltan research/semantic-ledger-2026-08-31.json y research/semantic-functional-index-2026-09-01.json(.gz). No están en git a propósito: son salidas regenerables del corpus. Regeneralo con: node research/build-semantic-ledger.mjs y node research/build-semantic-functional-ledger.mjs',
  ), console.error);
  process.exit(1);
}
const pending = ledger ? (ledger.entries || []).filter((e) => e.status === 'PENDING') : (index.entries || []).map((e) => ({ ...e, status: 'PENDING' }));
const ledgerByKey = new Map(pending.map((e) => [key(e.source, e.path), e]));
const rootBySource = new Map(manifest
  ? (manifest.sources || []).map((s) => [s.slug, s.root_dir])
  : (index.entries || []).map((e) => [e.source, e.source_root]).filter(([, root]) => root));
let lines;
try {
  const raw = evidencePath.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(evidencePath)).toString('utf8') : fs.readFileSync(evidencePath, 'utf8');
  lines = raw.split(String.fromCharCode(10)).filter(Boolean);
}
catch (error) { fail(`evidence unreadable: ${error.message}`); lines = []; }

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
  if (!['FUNCTIONAL_SCAN', 'STATIC_REVIEWED'].includes(row.resolution_status)) fail(`${k}: invalid resolution_status`);
  if (!['TEXT_FUNCTIONAL', 'STATIC_REVIEWED'].includes(row.analysis_class)) fail(`${k}: invalid analysis_class`);
  if (row.analysis_class === 'TEXT_FUNCTIONAL' && row.resolution_status !== 'FUNCTIONAL_SCAN') fail(`${k}: text row must use FUNCTIONAL_SCAN`);
  if (row.analysis_class === 'STATIC_REVIEWED' && row.resolution_status !== 'STATIC_REVIEWED') fail(`${k}: static row must use STATIC_REVIEWED`);
  if (row.analysis_class === 'TEXT_FUNCTIONAL' && (row.semantic_depth !== 'deterministic_observation' || row.semantic_claim !== false)) fail(`${k}: text row must explicitly disclaim human semantic judgment`);
  if (row.analysis_class === 'STATIC_REVIEWED' && (row.semantic_depth !== 'metadata_only' || row.semantic_claim !== false)) fail(`${k}: static row must be metadata-only`);
  if (row.sha256 !== entry.sha256 || row.commit !== entry.commit || row.line_count !== entry.line_count) fail(`${k}: pinned identity mismatch`);
  if (row.observed_sha256 !== entry.sha256) fail(`${k}: observed sha256 mismatch with ledger`);
  if (row.bytes_read !== true || row.full_content_scanned !== true) fail(`${k}: full byte scan not declared`);
  if (typeof row.purpose !== 'string' || !row.purpose.trim()) fail(`${k}: missing purpose`);
  if (typeof row.behavior !== 'string' || !row.behavior.trim()) fail(`${k}: missing behavior`);
  if (typeof row.invariants_limits !== 'string' || !row.invariants_limits.trim()) fail(`${k}: missing limits`);
  if (typeof row.vcp_relevance !== 'string' || !['ADOPT', 'DEFER', 'REJECT'].includes(row.vcp_relevance)) fail(`${k}: invalid relevance`);
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
  const absolute = path.join(corpusRoot, root, row.path);
  let buffer;
  try { buffer = fs.readFileSync(absolute); } catch (error) { fail(`${k}: cannot read corpus file (${error.message})`); continue; }
  if (sha256(buffer) !== entry.sha256) fail(`${k}: corpus bytes differ from pinned sha256`);
  if (row.analysis_class === 'TEXT_FUNCTIONAL' && row.observed_line_count !== null && row.observed_line_count !== buffer.toString('utf8').split(String.fromCharCode(10)).length) fail(`${k}: observed line count mismatch`);
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

if (errors.length) {
  for (const error of errors.slice(0, 60)) console.error(`REJECTED: ${error}`);
  if (errors.length > 60) console.error(`... and ${errors.length - 60} more`);
  process.exitCode = 1;
} else {
  const semantic = lines.filter((line) => JSON.parse(line).analysis_class === 'TEXT_FUNCTIONAL').length;
  const staticReviewed = lines.length - semantic;
  console.log(`OK: ${lines.length}/${pending.length} entries verified 1:1; ${semantic} full-text functional, ${staticReviewed} opaque/static; hashes and citations valid.`);
}
