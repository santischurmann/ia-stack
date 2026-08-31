#!/usr/bin/env node
/*
 * Build a deterministic, repository-local inventory for every materialized file
 * in the pinned external corpus. This is deliberately mechanical: it records
 * observable structure and never upgrades a file to semantically READ.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/+/, ''));
const repoRoot = path.resolve(here, '..');
const corpusRoot = process.env.VCP_EXTERNAL_RESEARCH_ROOT ||
  path.resolve(repoRoot, '..', '_vcp_external_research_2026-08-31');
const manifestPath = path.join(repoRoot, 'research', 'corpus-manifest-2026-08-31.json');
const ledgerPath = path.join(repoRoot, 'research', 'semantic-ledger-2026-08-31.json');
const outputPath = path.join(repoRoot, 'research', 'functional-inventory-2026-08-31.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const statusByKey = new Map();
for (const entry of ledger.entries || []) {
  statusByKey.set(`${entry.source}\0${entry.path}`, entry.status);
}

const CODE_EXT = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'],
  ['.ts', 'typescript'], ['.tsx', 'typescript'], ['.jsx', 'javascript'],
  ['.py', 'python'], ['.pyi', 'python'], ['.sh', 'shell'], ['.bash', 'shell'],
  ['.ps1', 'powershell'], ['.psm1', 'powershell'], ['.go', 'go'],
  ['.rs', 'rust'], ['.java', 'java'], ['.kt', 'kotlin'], ['.rb', 'ruby'],
  ['.php', 'php'], ['.c', 'c'], ['.h', 'c'], ['.cc', 'cpp'], ['.cpp', 'cpp'],
  ['.cxx', 'cpp'], ['.hpp', 'cpp'], ['.swift', 'swift'], ['.sql', 'sql'],
]);
const DOC_EXT = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc']);
const CONFIG_EXT = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.xml', '.lock']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.tgz', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mov', '.svg']);
const MAX_TEXT_BYTES = 2_000_000;
const MAX_ARRAY = 400;

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function lineNumberAt(text, index) { return text.slice(0, index).split('\n').length; }
function add(out, value) { if (value && !out.includes(value) && out.length < MAX_ARRAY) out.push(value); }
function classify(ext, size) {
  if (BINARY_EXT.has(ext) || size > MAX_TEXT_BYTES) return 'binary-or-large';
  if (CODE_EXT.has(ext)) return 'code';
  if (DOC_EXT.has(ext)) return 'documentation';
  if (CONFIG_EXT.has(ext)) return 'configuration';
  return 'other-text';
}
function languageFor(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'make';
  return CODE_EXT.get(path.extname(filePath).toLowerCase()) || null;
}
function extract(text, lang) {
  const symbols = [], testSignals = [], commands = [], imports = [], claims = [], risks = [];
  const addMatch = (arr, name, index) => add(arr, { name, line: lineNumberAt(text, index) });
  const patterns = {
    javascript: [
      /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      /\b(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      /\bclass\s+([A-Za-z_$][\w$]*)/g,
      /\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    ],
    typescript: [
      /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      /\b(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      /\bclass\s+([A-Za-z_$][\w$]*)/g,
      /\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    ],
    python: [/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/gm, /^\s*class\s+([A-Za-z_]\w*)/gm],
    shell: [/^\s*([A-Za-z_]\w*)\s*\(\)\s*\{/gm],
    powershell: [/\bfunction\s+([\w-]+)/gi, /\bclass\s+([\w-]+)/gi],
    go: [/\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/g, /\btype\s+([A-Za-z_]\w*)\s+struct/g],
    rust: [/\bfn\s+([A-Za-z_]\w*)/g, /\bstruct\s+([A-Za-z_]\w*)/g],
    // Keep the Java matcher deliberately line-local; a greedy modifier/type
    // expression becomes pathological on generated/vendor files.
    java: [/^\s*(?:public|private|protected|static|final|native|synchronized|abstract|\s)*[\w<>\[\], ?]+\s+([A-Za-z_]\w*)\s*\([^;{}\n)]*\)\s*\{/gm, /\bclass\s+([A-Za-z_]\w*)/g],
    kotlin: [/\bfun\s+([A-Za-z_]\w*)/g, /\bclass\s+([A-Za-z_]\w*)/g],
    ruby: [/^\s*def\s+([\w!?=]+)/gm, /^\s*class\s+([A-Za-z_]\w*)/gm],
    php: [/\bfunction\s+([A-Za-z_]\w*)/g, /\bclass\s+([A-Za-z_]\w*)/g],
    c: [/\b(?:int|void|bool|char|float|double|size_t|auto|static|inline)\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g, /\b(?:struct|class)\s+([A-Za-z_]\w*)/g],
    cpp: [/\b(?:int|void|bool|char|float|double|size_t|auto|static|inline)\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g, /\b(?:struct|class)\s+([A-Za-z_]\w*)/g],
    swift: [/\bfunc\s+([A-Za-z_]\w*)/g, /\bclass\s+([A-Za-z_]\w*)/g],
  };
  for (const re of patterns[lang] || []) {
    for (const m of text.matchAll(re)) addMatch(symbols, m[1], m.index ?? 0);
  }
  const testRegex = /\b(?:test|it|specify|describe|pytest|unittest|assert|assertThat|TEST|TEST_F|TEST_P|test_case)\s*[.(]?\s*["'`]?([^"'`),\n}]*)/gi;
  for (const m of text.matchAll(testRegex)) addMatch(testSignals, m[1].trim().slice(0, 180), m.index ?? 0);
  const importRegex = /(?:^|\n)\s*(?:import\s+[^\n;]+?\s+from\s+|import\s+|export\s+[^\n;]+?\s+from\s+|from\s+|require\s*\(|#include\s*[<"]|use\s+|load\s+["'])([A-Za-z0-9_@./:-]+)/g;
  for (const m of text.matchAll(importRegex)) add(imports, m[1]);
  const commandRegex = /\b(?:node|npm|pnpm|yarn|bun|python(?:3)?|pytest|go|cargo|make|cmake|bazel|git|docker|bash|pwsh|powershell)\s+[^\n;&|]{1,220}/gi;
  for (const m of text.matchAll(commandRegex)) add(commands, { command: m[0].trim(), line: lineNumberAt(text, m.index ?? 0) });
  const claimRegex = /^.*\b(?:must|should|required|guarantee|guarantees|always|never|safe|secure|deterministic|idempotent|reproducible|MUST|SHOULD|REQUIRED)\b.*$/gim;
  for (const m of text.matchAll(claimRegex)) add(claims, { text: m[0].trim().slice(0, 300), line: lineNumberAt(text, m.index ?? 0) });
  const riskRegex = /\b(?:TODO|FIXME|HACK|XXX|unsafe|bypass|race|TOCTOU|secret|token|password|credential|shell injection|eval\s*\(|exec\s*\(|innerHTML|child_process|subprocess|symlink)\b/gi;
  for (const m of text.matchAll(riskRegex)) add(risks, { term: m[0], line: lineNumberAt(text, m.index ?? 0) });
  return { symbols, test_signals: testSignals, commands, imports, claims, risks };
}

const sources = [];
let total = 0;
for (const source of manifest.sources || []) {
  const files = [];
  const sourceRoot = path.join(corpusRoot, source.root_dir);
  for (const item of source.entries || []) {
    total += 1;
    const key = `${source.slug}\0${item.path}`;
    const record = {
      path: item.path,
      ledger_status: statusByKey.get(key) || 'UNTRACKED',
      materialized: Boolean(item.materialized),
      classification: item.classification,
      size: item.size,
      sha256: item.sha256,
      line_count: item.line_count,
      kind: 'missing',
      language: null,
      symbols: [], test_signals: [], commands: [], imports: [], claims: [], risks: [],
      analysis: 'not-readable',
    };
    if (!item.materialized) { files.push(record); continue; }
    const absolute = path.join(sourceRoot, item.path);
    let stat;
    try { stat = fs.statSync(absolute); } catch { files.push(record); continue; }
    record.mode = stat.mode & 0o7777;
    if (stat.size > MAX_TEXT_BYTES || BINARY_EXT.has(path.extname(item.path).toLowerCase())) {
      record.kind = 'binary-or-large';
      record.analysis = 'mechanically-indexed';
      files.push(record); continue;
    }
    let buffer;
    try { buffer = fs.readFileSync(absolute); } catch { files.push(record); continue; }
    const text = buffer.toString('utf8');
    const ext = path.extname(item.path).toLowerCase();
    const kind = classify(ext, stat.size);
    const lang = languageFor(item.path);
    const extracted = extract(text, lang);
    record.kind = kind;
    record.language = lang;
    Object.assign(record, extracted);
    record.analysis = 'mechanically-indexed';
    files.push(record);
  }
  sources.push({ slug: source.slug, commit: source.commit, root_dir: source.root_dir, files });
}

const counts = { files: 0, materialized: 0, mechanically_indexed: 0, binary_or_large: 0, missing: 0, READ: 0, EXCLUDED: 0, PENDING: 0 };
for (const source of sources) for (const file of source.files) {
  counts.files += 1;
  if (file.materialized) counts.materialized += 1;
  counts[file.analysis === 'mechanically-indexed' ? 'mechanically_indexed' : 'missing'] += 1;
  if (file.kind === 'binary-or-large') counts.binary_or_large += 1;
  if (file.ledger_status in counts) counts[file.ledger_status] += 1;
}
const output = {
  schema: 'vcp.external-research-functional-inventory.v1',
  generated: new Date().toISOString(),
  method: 'read every manifest entry; hash and extract observable symbols/tests/commands/imports/claims/risks; never infer semantic comprehension',
  corpus_root: corpusRoot,
  manifest_sha256: sha256(fs.readFileSync(manifestPath)),
  ledger_sha256: sha256(fs.readFileSync(ledgerPath)),
  counts,
  sources,
};
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(`wrote ${outputPath}: ${counts.files} entries; ${counts.mechanically_indexed} mechanically indexed; ledger ${counts.READ} READ/${counts.EXCLUDED} EXCLUDED/${counts.PENDING} PENDING`);
