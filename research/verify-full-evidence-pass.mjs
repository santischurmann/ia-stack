#!/usr/bin/env node
/* Verify the exhaustive evidence pass is 1:1 with the strict PENDING ledger. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadJsonArtifact, loadTextArtifact, reportArtifactProblem } from './require-artifact.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
let ledger;
let manifest;
try {
  ledger = loadJsonArtifact(path.join(researchDir, 'semantic-ledger-2026-08-31.json'), 'node research/build-semantic-ledger.mjs', { root: repoRoot });
  manifest = loadJsonArtifact(path.join(researchDir, 'corpus-manifest-2026-08-31.json'), 'node research/build-functional-inventory.mjs', { root: repoRoot });
} catch (error) {
  if (!reportArtifactProblem(error, console.error)) throw error;
  process.exit(1);
}
const evidencePath = path.join(researchDir, 'semantic-full-evidence-2026-08-31.ndjson');
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const rootBySource = new Map((manifest.sources || []).map((source) => [source.slug, source.root_dir]));
const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
const expected = new Map(pending.map((entry) => [`${entry.source}|${entry.path}`, entry]));
let rows;
try {
  rows = loadTextArtifact(evidencePath, 'node research/build-full-evidence-pass.mjs', { root: repoRoot }).split(String.fromCharCode(10)).filter(Boolean).map((line) => JSON.parse(line));
} catch (error) {
  if (!reportArtifactProblem(error, console.error)) throw error;
  process.exit(1);
}
const errors = [];
const seen = new Set();
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

for (const row of rows) {
  const k = `${row.source}|${row.path}`;
  const entry = expected.get(k);
  if (!entry) { errors.push(`${k}: not a current PENDING entry`); continue; }
  if (seen.has(k)) errors.push(`${k}: duplicate row`);
  seen.add(k);
  if (row.prior_status !== 'PENDING' || row.strict_status !== 'PENDING' || row.review_status !== 'ASSISTED_STRUCTURAL') errors.push(`${k}: unsafe status promotion`);
  if (row.commit !== entry.commit || row.sha256 !== entry.sha256 || row.line_count !== entry.line_count) errors.push(`${k}: pinned identity mismatch`);
  if (row.vcp_relevance !== 'DEFER' || row.confidence !== 0) errors.push(`${k}: automated pass must remain conservative`);
  if (!Array.isArray(row.citations) || row.citations.length === 0) errors.push(`${k}: no observable citation`);
  const rootDir = rootBySource.get(row.source);
  const absolute = rootDir && path.join(corpusRoot, rootDir, row.path);
  if (row.bytes_read) {
    try {
      const buffer = fs.readFileSync(absolute);
      if (sha256(buffer) !== entry.sha256 || row.observed_sha256 !== entry.sha256) errors.push(`${k}: bytes/hash mismatch`);
    } catch (error) { errors.push(`${k}: bytes_read=true but file unreadable (${error.message})`); }
  }
}
for (const entry of pending) if (!seen.has(`${entry.source}|${entry.path}`)) errors.push(`${entry.source}|${entry.path}: missing row`);
if (rows.length !== pending.length) errors.push(`row count ${rows.length} != pending count ${pending.length}`);

if (errors.length) {
  for (const error of errors.slice(0, 40)) console.error(`REJECTED: ${error}`);
  if (errors.length > 40) console.error(`... and ${errors.length - 40} more`);
  process.exitCode = 1;
} else {
  console.log(`OK: ${rows.length} PENDING entries covered 1:1 with conservative evidence; strict ledger remains unchanged.`);
}
