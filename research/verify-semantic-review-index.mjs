#!/usr/bin/env node
/*
 * Verify the one-to-one research queue index. This gate checks identity and
 * provenance only; it deliberately does not claim that a summary is semantically
 * sufficient. Promotion remains a separate, human/adversarial decision.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const research = path.join(root, 'research');
const index = JSON.parse(fs.readFileSync(path.join(research, 'semantic-review-index-2026-08-31.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(research, 'semantic-ledger-2026-08-31.json'), 'utf8'));

const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
const expected = new Map(pending.map((entry) => [`${entry.source}|${entry.path}`, entry]));
const seen = new Set();
const allowedMachine = new Set(['READ_CANDIDATE', 'STATIC_ONLY', 'REVIEW_REQUIRED', 'PENDING_REVIEW', 'EXCLUDED_OBJECTIVE', 'UNREADABLE', 'UNREVIEWED']);
const errors = [];
if (index.total_pending !== pending.length) errors.push(`total_pending=${index.total_pending} expected=${pending.length}`);
if (!Array.isArray(index.rows) || index.rows.length !== pending.length) errors.push(`rows=${index.rows?.length} expected=${pending.length}`);

for (const row of index.rows ?? []) {
  const key = `${row.source}|${row.path}`;
  if (seen.has(key)) errors.push(`duplicate row ${key}`);
  seen.add(key);
  const source = expected.get(key);
  if (!source) { errors.push(`row not in canonical pending ledger ${key}`); continue; }
  for (const field of ['commit', 'sha256']) {
    if (row[field] !== source[field]) errors.push(`${key}: ${field} provenance mismatch`);
  }
  if (row.strict_status !== 'PENDING') errors.push(`${key}: strict_status must remain PENDING`);
  if (!allowedMachine.has(row.machine_status)) errors.push(`${key}: invalid machine_status ${row.machine_status}`);
  if (row.review_method === 'manual_semantic_batch' && !String(row.shard).startsWith('deep_')) {
    errors.push(`${key}: manual_semantic_batch without deep shard`);
  }
  for (const citation of row.evidence ?? []) {
    if (typeof citation !== 'string' || !/:\d+$/.test(citation)) errors.push(`${key}: malformed citation ${citation}`);
  }
}
for (const key of expected.keys()) if (!seen.has(key)) errors.push(`missing row ${key}`);

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors: errors.slice(0, 50), errorCount: errors.length }, null, 2));
  process.exit(1);
}
const methods = Object.fromEntries([...new Set(index.rows.map((row) => row.review_method))].sort().map((method) => [method, index.rows.filter((row) => row.review_method === method).length]));
console.log(JSON.stringify({ ok: true, pending: pending.length, rows: index.rows.length, unique: seen.size, methods }, null, 2));
