#!/usr/bin/env node
/* Turn the per-file functional evidence into a small, reviewable capability map. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(repoRoot, 'research');
const inputPath = path.join(researchDir, 'semantic-functional-evidence-2026-09-01.ndjson');
const outputJson = path.join(researchDir, 'semantic-functional-synthesis-2026-09-01.json');
const outputMd = path.join(researchDir, 'semantic-functional-synthesis-2026-09-01.md');
const verifierPath = path.join(researchDir, 'verify-semantic-functional-ledger.mjs');
const verification = spawnSync(process.execPath, [verifierPath, inputPath], {
  cwd: repoRoot, encoding: 'utf8', windowsHide: true,
});
if (verification.status !== 0) {
  process.stderr.write(`No se genera síntesis: la evidencia no pasó verify-semantic-functional-ledger.mjs.\n${verification.stderr || verification.stdout || ''}`);
  process.exit(1);
}
const rows = fs.readFileSync(inputPath, 'utf8').split(String.fromCharCode(10)).filter(Boolean).map((line) => JSON.parse(line));
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const groups = {
  'gates-and-evidence': /\b(?:gate|receipt|evidence|verif|assert|contract|proof|audit|trace)\w*/iu,
  'orchestration-and-agents': /\b(?:agent|orchestrat|workflow|router|handoff|role|subagent|DAG|checkpoint)\w*/iu,
  'research-and-citations': /\b(?:research|citation|source|paper|literature|claim|provenance|reference)\w*/iu,
  'testing-and-quality': /\b(?:test|fixture|coverage|benchmark|quality|regression|pytest|googletest)\w*/iu,
  'memory-and-learning': /\b(?:memory|learn|lesson|reflect|retrospect|knowledge|retrieve|context)\w*/iu,
  'security-and-boundaries': /\b(?:security|secret|token|credential|sandbox|permission|trust|bypass|injection|symlink)\w*/iu,
  'graph-and-backup': /\b(?:graph|graphify|obsidian|manifest|export|backup|snapshot|hash)\w*/iu,
  'product-and-communication': /\b(?:PRD|product|requirement|UX|design|README|communication|adoption|customer)\w*/iu,
};
const groupPathTerms = {
  'gates-and-evidence': /(?:gate|verify|receipt|evidence|audit|contract|trace|proof)/iu,
  'orchestration-and-agents': /(?:agent|orchestrat|workflow|router|handoff|role|subagent|checkpoint|dag)/iu,
  'research-and-citations': /(?:research|citation|source|paper|literature|provenance|reference)/iu,
  'testing-and-quality': /(?:test|fixture|coverage|benchmark|quality|regression|eval)/iu,
  'memory-and-learning': /(?:memory|learn|lesson|reflect|retro|knowledge|retrieve|context)/iu,
  'security-and-boundaries': /(?:security|secret|token|credential|sandbox|permission|trust|bypass|inject)/iu,
  'graph-and-backup': /(?:graph|obsidian|manifest|export|backup|snapshot|hash)/iu,
  'product-and-communication': /(?:prd|product|requirement|ux|design|readme|communication|adoption|customer)/iu,
};
const noisePath = /(?:^|\/)(?:tests?|fixtures?|vendor|vendors|dist|build|node_modules|site\/data|docs\/images)(?:\/|$)|(?:\.lock$|\.min\.)/iu;

const sourceStats = new Map();
const flags = {};
const candidates = Object.fromEntries(Object.keys(groups).map((key) => [key, []]));
const topSymbols = [];
for (const row of rows) {
  const stats = sourceStats.get(row.source) || { total: 0, functional_scan: 0, static_reviewed: 0, lexical_adopt_signal: 0, defer: 0, encoding_warning: 0 };
  stats.total += 1;
  if (row.analysis_class === 'TEXT_FUNCTIONAL') stats.functional_scan += 1; else stats.static_reviewed += 1;
  if (row.vcp_relevance === 'ADOPT') stats.lexical_adopt_signal += 1; else stats.defer += 1;
  if (row.encoding_warning) stats.encoding_warning += 1;
  sourceStats.set(row.source, stats);
  for (const flag of row.adversarial_flags || []) flags[flag] = (flags[flag] || 0) + 1;
  const signalText = `${row.path}\n${row.purpose}\n${row.behavior}\n${JSON.stringify(row.observations || {})}`;
  for (const [group, re] of Object.entries(groups)) {
    if (row.analysis_class !== 'TEXT_FUNCTIONAL') continue;
    const pathHit = groupPathTerms[group].test(row.path);
    const contentHit = re.test(signalText);
    const noise = noisePath.test(row.path);
    if (noise && group !== 'testing-and-quality') continue;
    // A path hit is stronger than a word buried in a large implementation or
    // test fixture. Noise is retained in the full ledger but not promoted to
    // the compact capability shortlist.
    const score = (pathHit ? 6 : 0) + (contentHit ? 2 : 0)
      + Math.min(noise ? 4 : 12, row.observations?.symbols?.length || 0)
      + Math.min(2, row.observations?.tests?.length || 0)
      - (noise ? 7 : 0);
    if (score < 4) continue;
    candidates[group].push({ source: row.source, path: row.path, score, relevance_signal: row.vcp_relevance, citations: (row.citations || []).slice(0, 4), adversarial_flags: row.adversarial_flags || [] });
  }
  if (row.analysis_class === 'TEXT_FUNCTIONAL' && (row.observations?.symbols?.length || 0) > 0) {
    topSymbols.push({ source: row.source, path: row.path, symbols: row.observations.symbols.length, tests: row.observations.tests?.length || 0, citations: (row.citations || []).slice(0, 4) });
  }
}
for (const group of Object.keys(candidates)) {
  candidates[group].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  candidates[group] = candidates[group].slice(0, 12);
}
topSymbols.sort((a, b) => b.symbols - a.symbols || b.tests - a.tests);

const sourceCounts = Object.fromEntries([...sourceStats.entries()].sort((a, b) => a[0].localeCompare(b[0])));
const summary = {
  schema: 'vcp.external-research-semantic-functional-synthesis.v1',
  generated: new Date().toISOString(),
  input: path.basename(inputPath),
  input_sha256: sha256(fs.readFileSync(inputPath)),
  rows: rows.length,
  method: 'Aggregates only cited observations after an independent verification pass. Group membership is a lexical signal for prioritization, not a semantic adoption decision.',
  source_counts: sourceCounts,
  adversarial_flags: flags,
  capability_signals: candidates,
  top_symbol_files: topSymbols.slice(0, 100),
  policy: {
    adopt: 'No capability is auto-adopted. A signal enters a separate SPEC→PLAN→RED→BUILD→VERIFY decision cycle.',
    defer: 'External side effects, vendor integrations, and ambiguous claims remain deferred until a human selects them.',
    static: 'Binary/opaque files are closed as STATIC_REVIEWED with byte metadata only; no textual semantics are claimed.',
  },
};
fs.writeFileSync(outputJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

const total = rows.length;
const semantic = rows.filter((r) => r.analysis_class === 'TEXT_FUNCTIONAL').length;
const staticRows = total - semantic;
const md = [
  '# Síntesis funcional del corpus externo — 2026-09-01', '',
  `Este informe resume **${total.toLocaleString('es-AR')}** entradas PENDING verificadas 1:1: **${semantic.toLocaleString('es-AR')}** procesadas con escaneo funcional determinista y **${staticRows.toLocaleString('es-AR')}** cerradas como artefactos opacos/estáticos.`, '',
  '> Importante: los grupos y “señales de adopción” son filtros lexicales respaldados por citas. No son una aprobación semántica automática ni una orden de copiar código externo.', '',
  '## Cobertura por fuente', '',
  '| Fuente | Entradas | Escaneo funcional | Estático | Señal lexical | DEFER |', '|---|---:|---:|---:|---:|---:|',
  ...Object.entries(sourceCounts).map(([source, s]) => `| ${source} | ${s.total} | ${s.functional_scan} | ${s.static_reviewed} | ${s.lexical_adopt_signal} | ${s.defer} |`), '',
  '## Señales adversariales agregadas', '',
  ...Object.entries(flags).sort((a, b) => b[1] - a[1]).map(([flag, count]) => `- **${flag}**: ${count}`), '',
  '## Capacidades que merecen priorización humana', '',
  ...Object.entries(candidates).map(([group, list]) => {
    const items = list.slice(0, 5).map((item) => '- `' + item.source + '` — `' + item.path + '` (score lexical ' + item.score + '; citas: ' + (item.citations.join(', ') || 'ninguna') + ')').join('\n') || '- Sin señal textual suficiente.';
    return `### ${group}\n${items}`;
  }), '',
  '## Regla de uso', '',
  'Cada candidato útil debe entrar en un ciclo VCP propio: SPEC → PLAN → 🔵 elección → RED → BUILD → TRIANGULATE → VERIFY → seguridad → receipt → 🔵 publicación. El presente informe no salta ningún gate.', '',
  `Huella del insumo: \`${summary.input_sha256}\`.`, '',
].join('\n');
fs.writeFileSync(outputMd, `${md}\n`, 'utf8');
console.log(JSON.stringify({ outputJson, outputMd, rows: total, semantic, static: staticRows, flags }, null, 2));
