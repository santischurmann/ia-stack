import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('research/corpus-manifest-2026-08-31.json');
const outputPath = resolve('research/semantic-ledger-2026-08-31.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// READ means that Codex inspected the file's function/contract semantics directly.
// A structural scan, a hash, or a filename is never enough for this set.
const READ = new Set([
  'gstack|README.md', 'gstack|AGENTS.md', 'gstack|ARCHITECTURE.md', 'gstack|package.json',
  'gstack|autoplan/SKILL.md.tmpl', 'gstack|context-save/SKILL.md',
  'gstack|context-restore/SKILL.md', 'gstack|learn/SKILL.md',
  'gstack|ship/sections/review-army.md',
  'gstack|bin/gstack-evidence', 'gstack|bin/gstack-wtree',
  'agency-agents|README.md', 'agency-agents|CONTRIBUTING.md',
  'agency-agents|scripts/check-divisions.sh', 'agency-agents|scripts/check-tools.sh',
  'agency-agents|engineering/engineering-multi-agent-systems-architect.md',
  'agency-agents|testing/testing-reality-checker.md',
  'agency-agents|strategy/coordination/handoff-templates.md',
  'agency-agents|scripts/check-agent-originality.sh', 'agency-agents|scripts/check-hermes-plugin.py',
  'agent-reach|README.md', 'agent-reach|CLAUDE.md', 'agent-reach|pyproject.toml',
  'agent-reach|agent_reach/core.py', 'agent-reach|agent_reach/doctor.py',
  'agent-reach|agent_reach/channels/twitter.py', 'agent-reach|agent_reach/channels/youtube.py',
  'agent-reach|agent_reach/skill/SKILL.md', 'agent-reach|config/mcporter.json',
  'archify|README.md', 'archify|DESIGN.md', 'archify|PRODUCT.md',
  'archify|archify/SKILL.md', 'archify|archify/brand-marks/README.md',
  'archify|archify/bin/archify.mjs', 'archify|archify/delta/architecture-delta.mjs',
  'archify|archify/scripts/check-render-output.mjs',
  'plugins|README.md', 'plugins|external_plugins/context7/.claude-plugin/plugin.json',
  'plugins|external_plugins/github/.claude-plugin/plugin.json',
  'scientific|README.md', 'scientific|AGENTS.md', 'scientific|CONTRIBUTING.md',
  'scientific|plugin.json', 'scientific|pyproject.toml',
  'scientific|skills/autoskill/SKILL.md', 'scientific|skills/experimental-design/SKILL.md',
  'ponytail|README.md', 'ponytail|AGENTS.md', 'ponytail|package.json',
  'ponytail|benchmarks/agentic/README.md', 'ponytail|benchmarks/agentic/complete.py',
  'ponytail|benchmarks/agentic/judge.py',
  'ai-engineering|README.md', 'ai-engineering|AGENTS.md', 'ai-engineering|CHANGELOG.md',
  'ai-engineering|book/README.md', 'ai-engineering|scripts/build_book.py',
  'garden|README.md', 'garden|skills/kb-retriever/SKILL.md',
  'garden|skills/beautiful-article/SKILL.md', 'garden|skills/web-video-presentation/SKILL.md',
  'mem|README.md', 'mem|CLAUDE.md', 'mem|package.json',
  'mem|cowork/README.md', 'mem|plugin/skills/mem-search/SKILL.md',
  'mem|plugin/.claude-plugin/plugin.json',
  'gtest|README.md', 'gtest|CMakeLists.txt', 'gtest|MODULE.bazel',
  'obsidian|README.md', 'obsidian|AGENTS.md', 'obsidian|skills/save/SKILL.md',
  'obsidian|skills/wiki-ingest/SKILL.md',
  'obsidian|claude_obsidian/gates.py',
  'marin|README.md', 'marin|AGENTS.md', 'marin|pyproject.toml',
  'marin|.github/workflows/README.md', 'marin|.agents/skills/background-research/SKILL.md',
  'marin|.agents/skills/commit/SKILL.md', 'marin|.agents/skills/debug/SKILL.md',
  'awesome|README.md', 'awesome|skill-creator/SKILL.md',
  'awesome|content-research-writer/SKILL.md', 'awesome|mcp-builder/SKILL.md',
  'awesome|connect-apps-plugin/README.md',
  'awesome|mcp-builder/scripts/connections.py',
  'garden|scripts/release/lib/skills.mjs',
]);

function family(slug) {
  if (slug.includes('gstack')) return 'gstack';
  if (slug.includes('agency-agents')) return 'agency-agents';
  if (slug.includes('Agent-Reach')) return 'agent-reach';
  if (slug.includes('archify')) return 'archify';
  if (slug.includes('claude-plugins-official')) return 'plugins';
  if (slug.includes('scientific-agent-skills')) return 'scientific';
  if (slug.includes('ponytail')) return 'ponytail';
  if (slug.includes('ai-engineering')) return 'ai-engineering';
  if (slug.includes('garden-skills')) return 'garden';
  if (slug.includes('claude-mem')) return 'mem';
  if (slug.includes('googletest')) return 'gtest';
  if (slug.includes('claude-obsidian')) return 'obsidian';
  if (slug.includes('marin-')) return 'marin';
  if (slug.includes('awesome-claude-skills')) return 'awesome';
  return slug;
}

function exclusionReason(entry) {
  if (!entry.materialized) return 'symlink or archive entry not materialized on Windows; target recorded separately';
  if (entry.classification === 'binary') return 'binary asset; no text semantics available to read safely';
  if (entry.classification === 'empty') return 'empty file; no behavior or prose to interpret';
  if (entry.classification === 'lockfile') return 'generated dependency lockfile; excluded from methodology semantics';
  if (entry.classification === 'vendored') return 'vendored/generated dependency content; excluded from project methodology';
  return null;
}

const entries = [];
for (const source of manifest.sources) {
  const f = family(source.root_dir);
  for (const entry of source.entries) {
    const key = `${f}|${entry.path}`;
    const excluded = exclusionReason(entry);
    const status = excluded ? 'EXCLUDED' : (READ.has(key) ? 'READ' : 'PENDING');
    entries.push({
      source: source.slug,
      commit: source.commit,
      path: entry.path,
      status,
      reason: excluded ?? (status === 'READ'
        ? 'Codex functional read of the file and its role/contract'
        : 'materialized file only structurally scanned; semantic read still pending'),
      sha256: entry.sha256 ?? null,
      line_count: entry.line_count ?? null,
      classification: entry.classification ?? null,
    });
  }
}

const counts = Object.fromEntries(['READ', 'EXCLUDED', 'PENDING'].map((s) => [s, entries.filter((e) => e.status === s).length]));
const out = {
  schema: 'vcp.external-research-semantic-ledger.v1',
  generated: '2026-08-31',
  method: 'Strict per-file accounting. READ requires direct semantic inspection; EXCLUDED requires an objective non-semantic reason; all other materialized files remain PENDING.',
  total_entries: entries.length,
  counts,
  sources: [...new Set(entries.map((e) => e.source))].sort(),
  entries,
};
writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`wrote ${outputPath}: ${entries.length} entries (${counts.READ} READ, ${counts.EXCLUDED} EXCLUDED, ${counts.PENDING} PENDING)`);
