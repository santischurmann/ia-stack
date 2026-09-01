#!/usr/bin/env node
/*
 * Consolidate agent-assisted semantic-review shards without promoting them to the strict ledger.
 * A shard may contain useful citations, but only a direct functional inspection can change the
 * canonical READ/PENDING status. This index is therefore a second, explicitly labelled evidence
 * surface for queue management and adversarial review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const research = path.join(root, 'research');
const ledger = JSON.parse(fs.readFileSync(path.join(research, 'semantic-ledger-2026-08-31.json'), 'utf8'));
const pending = ledger.entries.filter((entry) => entry.status === 'PENDING');
const pendingKeys = new Set(pending.map((entry) => `${entry.source}|${entry.path}`));
const scratch = path.join(research, '.scratch-semantic');
const preferred = [
  // Small manually inspected batches take precedence over structural shards. They still
  // remain strict_status=PENDING; the separate machine status records their provenance.
  'deep_marin_50.ndjson',
  'deep_marin_100_2.ndjson',
  'deep_marin_100_3.ndjson',
  'deep_awesome_50.ndjson',
  'deep_awesome_100_2.ndjson',
  'deep_awesome_100_3.ndjson',
  'deep_gstack_50.ndjson',
  'deep_gstack_100_2.ndjson',
  'deep_gstack_100_3.ndjson',
  'deep_scientific_50.ndjson',
  'deep_claude_mem_50.ndjson',
  'semantic_core_v2.ndjson',
  'semantic_platform_strict.ndjson',
  'semantic_platform.ndjson',
  'semantic_research-partition-v2.ndjson',
  'semantic_research-obsidian-core.ndjson',
  'semantic_research-googletest-core.ndjson',
  'semantic_research-marin-core.ndjson',
  'semantic_research-awesome-core.ndjson',
];

function key(record) { return `${record.source}|${record.path}`; }
function readShard(file) {
  const full = path.join(scratch, file);
  if (!fs.existsSync(full)) return [];
  return fs.readFileSync(full, 'utf8').split(String.fromCharCode(10)).filter(Boolean).flatMap((line) => {
    const record = { ...JSON.parse(line), shard: file };
    // Deep batches are allowed to claim manual semantic reading only when their
    // required fields are actually present and typed. A malformed shard falls
    // through to the structural evidence instead of being silently promoted.
    if (file.startsWith('deep_')) {
      const interfaceText = typeof record.interfaces === 'string' || typeof record.inputs === 'string';
      const valid = typeof record.purpose === 'string' && interfaceText
        && typeof record.behavior === 'string' && typeof record.outputs === 'string'
        && typeof record.invariants_limits === 'string' && typeof record.tests === 'string'
        && typeof record.risks === 'string' && ['ADOPT', 'DEFER', 'REJECT'].includes(record.vcp_relevance)
        && typeof record.vcp_relevance_reason === 'string' && typeof record.confidence === 'number'
        && Array.isArray(record.citations) && record.citations.length >= 2;
      if (!valid) return [];
    }
    return [record];
  });
}
function toMachineStatus(record) {
  if (record.status === 'READ') return 'READ_CANDIDATE';
  if (record.status === 'STATIC_ONLY') return 'STATIC_ONLY';
  if (record.status === 'INVALID_REVIEW') return 'REVIEW_REQUIRED';
  if (record.status === 'EXCLUDED_OBJECTIVE') return 'EXCLUDED_OBJECTIVE';
  if (record.status === 'UNREADABLE') return 'UNREADABLE';
  return 'PENDING_REVIEW';
}

const selected = new Map();
const duplicateKeys = [];
for (const shard of preferred) {
  for (const record of readShard(shard)) {
    const k = key(record);
    if (!pendingKeys.has(k)) continue;
    if (selected.has(k)) { duplicateKeys.push(k); continue; }
    selected.set(k, {
      source: record.source,
      commit: record.commit ?? null,
      path: record.path,
      sha256: record.sha256 ?? null,
      strict_status: 'PENDING',
      machine_status: toMachineStatus(record),
      review_method: shard.startsWith('deep_') ? 'manual_semantic_batch' : 'agent_assisted_structural_triage',
      shard,
      evidence: Array.isArray(record.citations) ? record.citations.slice(0, 8) : [],
      reason: record.reason ?? record.read_reason ?? null,
      confidence: record.confidence ?? null,
      vcp_relevance: record.vcp_relevance?.decision ?? record.vcp_relevance ?? 'DEFER',
    });
  }
}

const rows = pending.map((entry) => selected.get(key(entry)) ?? {
  source: entry.source,
  commit: entry.commit,
  path: entry.path,
  sha256: entry.sha256 ?? null,
  strict_status: 'PENDING',
  machine_status: 'UNREVIEWED',
  shard: null,
  review_method: 'not_reviewed',
  evidence: [],
  reason: 'No shard record; no semantic claim made.',
  confidence: null,
  vcp_relevance: 'DEFER',
});

const counts = Object.fromEntries([...new Set(rows.map((row) => row.machine_status))].sort().map((status) => [status, rows.filter((row) => row.machine_status === status).length]));
const output = {
  schema: 'vcp.external-research-agent-assisted-review/v1',
  generated: new Date().toISOString(),
  method: 'Agent-assisted shard consolidation. Every row remains strict_status=PENDING; machine_status is queue evidence only and never promotes the canonical semantic ledger.',
  source_ledger: 'semantic-ledger-2026-08-31.json',
  total_pending: pending.length,
  counts,
  duplicate_shard_records: duplicateKeys.length,
  rows,
};
const jsonPath = path.join(research, 'semantic-review-index-2026-08-31.json');
fs.writeFileSync(jsonPath, `${JSON.stringify(output)}\n`, 'utf8');

const bySource = [...new Set(rows.map((row) => row.source))].sort().map((source) => {
  const subset = rows.filter((row) => row.source === source);
  return `| ${source} | ${subset.length} | ${subset.filter((row) => row.machine_status === 'READ_CANDIDATE').length} | ${subset.filter((row) => row.machine_status === 'STATIC_ONLY').length} | ${subset.filter((row) => row.machine_status === 'REVIEW_REQUIRED').length} | ${subset.filter((row) => row.machine_status === 'PENDING_REVIEW').length} | ${subset.filter((row) => row.machine_status === 'UNREVIEWED').length} |`;
});
const md = [
  '# Consolidado de lectura asistida — 2026-08-31', '',
  'Este archivo consolida shards generados por agentes para administrar la cola. No reemplaza el ledger semántico estricto: todas las filas conservan `strict_status: PENDING` porque una heurística o resumen asistido no demuestra comprensión funcional completa.', '',
  `- Entradas PENDING del ledger: **${pending.length}**.`,
  `- Registros consolidados: **${rows.length}**.`,
  `- Duplicados descartados al elegir el shard preferido: **${duplicateKeys.length}**.`,
  `- Filas sin shard: **${rows.filter((row) => row.machine_status === 'UNREVIEWED').length}**.`, '',
  `- Lectura semántica manual profunda (lotes revisados con citas): **${rows.filter((row) => row.review_method === 'manual_semantic_batch').length}**; el resto es triage asistido y no se promueve.`, '',
  '| Fuente | Total | READ_CANDIDATE | STATIC_ONLY | REVIEW_REQUIRED | PENDING_REVIEW | UNREVIEWED |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...bySource, '',
  '## Semántica de estados', '',
  '- `READ_CANDIDATE`: el shard aporta un resumen y citas, pero requiere revisión adversarial antes de promoción.',
  '- `STATIC_ONLY`: configuración, catálogo, metadata o contenido sin conducta aislable; no se inventan interfaces.',
  '- `REVIEW_REQUIRED`: evidencia insuficiente o contradictoria; no cuenta como lectura completa.',
  '- `PENDING_REVIEW`/`UNREVIEWED`: no se afirma lectura semántica.', '',
  'El índice JSON conserva hash, commit, path, shard y citas para reproducibilidad. Las citas no prueban por sí solas que la interpretación sea suficiente; el gate canónico sigue siendo `semantic-ledger-2026-08-31.json`.', '',
].join('\n');
// `md` already ends with the single newline supplied by its final empty element.
fs.writeFileSync(path.join(research, 'semantic-review-consolidation-2026-08-31.md'), md, 'utf8');
console.log(JSON.stringify({ jsonPath, rows: rows.length, counts, duplicateShardRecords: duplicateKeys.length }, null, 2));
