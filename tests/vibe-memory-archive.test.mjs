import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const memoryScript = join(repoRoot, 'scripts', 'vibe-memory.sh');

function toGitBashPath(path) {
  return path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

function runMemory(root, ...args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(gitBash, [
    '-lc',
    `cd '${toGitBashPath(root)}' && '${toGitBashPath(memoryScript)}' ${args.join(' ')}`,
  ], { encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

test('init creates the durable handoffs directory with the rest of .vibe state', { skip: !existsSync(gitBash) }, () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-memory-init-'));
  try {
    const result = runMemory(root, 'init');
    assert.equal(result.status, 0, result.output);
    assert.equal(existsSync(join(root, '.vibe', 'handoffs')), true);
    assert.match(readFileSync(join(root, '.vibe', 'SESSION.md'), 'utf8'), /\*\*Feature slug:\*\*/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('archive preserves the old feature identity and resets SESSION.md to an unassigned template', { skip: !existsSync(gitBash) }, () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-memory-archive-'));
  const vibe = join(root, '.vibe');
  mkdirSync(join(vibe, 'sessions'), { recursive: true });
  writeFileSync(join(vibe, 'SESSION.md'), '# Session — before archive\n\n**Feature slug:** auth-refactor\n**Goal:** Tighten auth\n**Status:** in progress\n');

  try {
    const result = runMemory(root, 'archive', 'auth-refactor');
    assert.equal(result.status, 0, `${result.stdout ?? ''}${result.stderr ?? ''}`);

    const archives = readdirSync(join(vibe, 'sessions'));
    assert.equal(archives.length, 1);
    assert.match(readFileSync(join(vibe, 'sessions', archives[0]), 'utf8'), /\*\*Feature slug:\*\* auth-refactor/);

    const nextSession = readFileSync(join(vibe, 'SESSION.md'), 'utf8');
    assert.match(nextSession, /^# Session — \(next\)/m);
    assert.match(nextSession, /\*\*Feature slug:\*\* \(set before first gate; lowercase kebab-case/);
    assert.match(nextSession, /\*\*Status:\*\* in progress/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
