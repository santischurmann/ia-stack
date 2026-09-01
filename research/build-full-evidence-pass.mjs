#!/usr/bin/env node
/*
 * Exhaustive, conservative evidence pass for every PENDING corpus entry.
 * It reads each materialized file and records only observable facts. It deliberately
 * never changes the strict semantic ledger to READ: interpretation still needs a
 * functional review. The large NDJSON output is local/ignored; the compact summary is
 * the shareable receipt of coverage.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
const manifest = JSON.parse(fs.readFileSync(path.join(researchDir, 'corpus-manifest-2026-08-31.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(researchDir, 'semantic-ledger-2026-08-31.json'), 'utf8'));
const inventoryPath = path.join(researchDir, 'functional-inventory-2026-08-31.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const outputPath = path.join(researchDir, 'semantic-full-evidence-2026-08-31.ndjson');
const summaryPath = path.join(researchDir, 'semantic-full-evidence-summary-2026-08-31.json');

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const key = (source, filePath) => `${source}|${filePath}`;
const rootBySource = new Map((manifest.sources || []).map((source) => [source.slug, source.root_dir]));
const inventoryByKey = new Map();
for (const source of inventory.sources || []) for (const file of source.files || []) {
  inventoryByKey.set(key(source.slug, file.path), file);
}
const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
const rows = [];
const counts = { total: pending.length, materialized: 0, unreadable: 0, textual: 0, binary_or_large: 0, evidence_rows: 0 };

function citationList(entry, info) {
  const lines = new Set([1]);
  for (const group of ['symbols', 'test_signals', 'commands', 'claims', 'risks']) {
    for (const item of info?.[group] || []) if (Number.isInteger(item.line) && item.line > 0) lines.add(item.line);
  }
  return [...lines].sort((a, b) => a - b).slice(0, 8).map((line) => `${entry.path}:${line}`);
}

for (const entry of pending) {
  const info = inventoryByKey.get(key(entry.source, entry.path)) || {};
  const rootDir = rootBySource.get(entry.source);
  const absolute = rootDir ? path.join(corpusRoot, rootDir, entry.path) : null;
  let buffer = null;
  if (absolute) {
    try { buffer = fs.readFileSync(absolute); } catch { buffer = null; }
  }
  if (buffer) counts.materialized += 1;
  else counts.unreadable += 1;
  if (info.kind === 'binary-or-large') counts.binary_or_large += 1;
  else counts.textual += 1;
  const observedHash = buffer ? sha256(buffer) : null;
  const readable = Boolean(buffer && info.kind !== 'binary-or-large');
  const semanticObservation = readable
    ? `Lectura directa de bytes; archivo ${info.kind || 'textual'}${info.language ? ` (${info.language})` : ''}, ${info.symbols?.length || 0} símbolo(s), ${info.test_signals?.length || 0} señal(es) de test y ${info.commands?.length || 0} comando(s) observables.`
    : buffer
      ? 'Lectura directa de bytes completada; archivo binario/grande o sin semántica textual segura.'
      : 'No se pudo materializar el archivo en este entorno; no se inventa una interpretación.';
  rows.push({
    source: entry.source,
    commit: entry.commit,
    path: entry.path,
    sha256: entry.sha256,
    line_count: entry.line_count,
    prior_status: 'PENDING',
    review_status: 'ASSISTED_STRUCTURAL',
    strict_status: 'PENDING',
    bytes_read: Boolean(buffer),
    observed_sha256: observedHash,
    observed_kind: info.kind || entry.classification || 'unknown',
    observed_language: info.language || null,
    observed_symbols: (info.symbols || []).slice(0, 24),
    observed_tests: (info.test_signals || []).slice(0, 16),
    observed_commands: (info.commands || []).slice(0, 16),
    observed_imports: (info.imports || []).slice(0, 16),
    observed_claims: (info.claims || []).slice(0, 16),
    observed_risks: (info.risks || []).slice(0, 16),
    semantic_observation: semanticObservation,
    citations: citationList(entry, info),
    vcp_relevance: 'DEFER',
    vcp_relevance_reason: 'La pasada exhaustiva aporta hechos observables, pero no afirma comprensión semántica ni utilidad sin revisión funcional adversarial.',
    confidence: 0,
  });
  counts.evidence_rows += 1;
}

const payload = rows.map((row) => JSON.stringify(row)).join(String.fromCharCode(10)) + String.fromCharCode(10);
fs.writeFileSync(outputPath, payload, 'utf8');
const summary = {
  schema: 'vcp.external-research-full-evidence-pass.v1',
  generated: new Date().toISOString(),
  method: 'Every PENDING entry is read and hashed when materialized; only observable structural evidence is recorded. This never promotes strict_status to READ.',
  corpus_root: corpusRoot,
  source_ledger: 'semantic-ledger-2026-08-31.json',
  output: path.basename(outputPath),
  counts,
  output_sha256: sha256(Buffer.from(payload, 'utf8')),
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
