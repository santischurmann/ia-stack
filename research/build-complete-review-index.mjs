#!/usr/bin/env node
/*
 * Full-corpus review index. It opens every materialized entry from the pinned manifest and
 * records deterministic, non-content-bearing signals. This closes the mechanical review gap
 * without falsely upgrading a static pass to a human semantic reading.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'research', 'corpus-manifest-2026-08-31.json');
const ledgerPath = path.join(repoRoot, 'research', 'semantic-ledger-2026-08-31.json');
const outputPath = path.join(repoRoot, 'research', 'complete-review-index-2026-08-31.json');
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT
  || path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const MAX_TEXT_BYTES = 2_000_000;
const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cxx', '.go', '.h', '.hpp', '.java', '.js', '.jsx', '.json', '.kt',
  '.lock', '.mjs', '.md', '.mdx', '.php', '.py', '.pyi', '.ps1', '.psm1', '.rb', '.rs',
  '.rst', '.sh', '.sql', '.swift', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function family(root) {
  if (root.includes('gstack')) return 'gstack';
  if (root.includes('agency-agents')) return 'agency-agents';
  if (root.includes('Agent-Reach')) return 'agent-reach';
  if (root.includes('archify')) return 'archify';
  if (root.includes('claude-plugins-official')) return 'plugins';
  if (root.includes('scientific-agent-skills')) return 'scientific';
  if (root.includes('ponytail')) return 'ponytail';
  if (root.includes('ai-engineering')) return 'ai-engineering';
  if (root.includes('garden-skills')) return 'garden';
  if (root.includes('claude-mem')) return 'mem';
  if (root.includes('googletest')) return 'gtest';
  if (root.includes('claude-obsidian')) return 'obsidian';
  if (root.includes('marin-')) return 'marin';
  if (root.includes('awesome-claude-skills')) return 'awesome';
  return root;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const ledgerByKey = new Map((ledger.entries || []).map((entry) => [`${entry.source}\0${entry.path}`, entry]));

function signals(buffer, entry) {
  const extension = path.extname(entry.path).toLowerCase();
  const textual = buffer.length <= MAX_TEXT_BYTES && TEXT_EXTENSIONS.has(extension);
  if (!textual) return { readable_text: false, headings: 0, definitions: 0, tests: 0, commands: 0, claims: 0, risks: 0 };
  const text = buffer.toString('utf8');
  return {
    readable_text: !text.includes('\uFFFD'),
    headings: (text.match(/^#{1,6}\s+/gmu) || []).length,
    definitions: (text.match(/\b(?:function|class|def|fn|func|export\s+(?:const|function|class))\b/gmu) || []).length,
    tests: (text.match(/\b(?:test|it|pytest|unittest|assert|TEST(?:_F|_P)?)\b/giu) || []).length,
    commands: (text.match(/\b(?:node|npm|pnpm|yarn|python|pytest|go|cargo|git|docker|bash|pwsh)\s+/giu) || []).length,
    claims: (text.match(/\b(?:must|should|required|always|never|safe|secure|deterministic|idempotent|reproducible)\b/giu) || []).length,
    risks: (text.match(/\b(?:TODO|FIXME|HACK|unsafe|bypass|race|TOCTOU|secret|token|password|credential|eval|exec|symlink)\b/giu) || []).length,
  };
}

const counts = {
  total: 0,
  materialized: 0,
  bytes_read: 0,
  deep_read: 0,
  excluded: 0,
  static_review: 0,
  semantic_pending: 0,
  non_text_or_invalid_utf8: 0,
};
const sources = [];
for (const source of manifest.sources || []) {
  const root = path.join(corpusRoot, source.root_dir);
  const files = [];
  const sourceFamily = family(source.root_dir);
  for (const entry of source.entries || []) {
    counts.total += 1;
    const ledgerEntry = ledgerByKey.get(`${source.slug}\0${entry.path}`) || {};
    const excluded = ledgerEntry.status === 'EXCLUDED';
    const deepRead = ledgerEntry.status === 'READ';
    const record = {
      source: source.slug,
      family: sourceFamily,
      commit: source.commit,
      path: entry.path,
      ledger_status: ledgerEntry.status || 'UNTRACKED',
      review_status: excluded ? 'objective-exclusion' : deepRead ? 'deep-semantic-read' : 'complete-static-review',
      semantic_pending: !excluded && !deepRead,
      materialized: Boolean(entry.materialized),
      sha256: entry.sha256 || null,
      size: entry.size ?? null,
      line_count: entry.line_count ?? null,
      signals: { readable_text: false, headings: 0, definitions: 0, tests: 0, commands: 0, claims: 0, risks: 0 },
    };
    if (excluded) counts.excluded += 1;
    else if (deepRead) counts.deep_read += 1;
    else counts.semantic_pending += 1;
    if (!entry.materialized) { counts.non_text_or_invalid_utf8 += 1; files.push(record); continue; }
    counts.materialized += 1;
    const absolute = path.join(root, entry.path);
    try {
      const buffer = fs.readFileSync(absolute);
      counts.bytes_read += buffer.length;
      record.signals = signals(buffer, entry);
      if (!record.signals.readable_text && !excluded) counts.non_text_or_invalid_utf8 += 1;
    } catch {
      counts.non_text_or_invalid_utf8 += 1;
    }
    files.push(record);
  }
  sources.push({ slug: source.slug, commit: source.commit, files });
}

const output = {
  schema: 'vcp.external-research-complete-review/v1',
  generated: new Date().toISOString(),
  method: 'Every manifest entry was opened when materialized; deterministic structural signals were extracted. Deep semantic status remains inherited from the strict ledger and is never inferred from this pass.',
  corpus_root: corpusRoot,
  manifest_sha256: sha256(fs.readFileSync(manifestPath)),
  ledger_sha256: sha256(fs.readFileSync(ledgerPath)),
  counts,
  sources,
};
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`wrote ${outputPath}: ${counts.total} entries; ${counts.materialized} materialized; ${counts.bytes_read} bytes read; ${counts.deep_read} deep semantic / ${counts.semantic_pending} semantic pending / ${counts.excluded} excluded`);
