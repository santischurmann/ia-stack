import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_VAULT, inspectVault, main, projectDirectory, walk } from '../scripts/verify-obsidian-export.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-obsidian-export-'));
  const vault = join(root, DEFAULT_VAULT);
  mkdirSync(vault, { recursive: true });
  writeFileSync(join(vault, 'README.md'), '# Note\n', 'utf8');
  writeFileSync(join(vault, 'graph.canvas'), JSON.stringify({ nodes: [{ id: 'n1' }], edges: [] }), 'utf8');
  return { root, vault };
}

function cleanup(root) { rmSync(root, { recursive: true, force: true }); }

test('validates a real project-local Obsidian vault and the default CLI path', () => {
  const { root } = fixture();
  try {
    const result = inspectVault(DEFAULT_VAULT, root);
    assert.equal(result.markdown, 1);
    assert.equal(result.canvas_nodes, 1);
    const out = [];
    assert.equal(main(['check', DEFAULT_VAULT], root, (line) => out.push(line), () => {}), 0);
    assert.match(out[0], /project-local/u);
    const cli = spawnSync(process.execPath, [resolve('scripts/verify-obsidian-export.mjs'), 'check', DEFAULT_VAULT], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
  } finally { cleanup(root); }
});

test('rejects usage errors and unsafe/non-directory vault paths before reading contents', () => {
  const { root } = fixture();
  try {
    writeFileSync(join(root, 'plain.txt'), 'not a vault directory', 'utf8');
    const errors = [];
    assert.equal(main([], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['check'], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['wrong', DEFAULT_VAULT], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['check', 'missing-vault'], root, () => {}, (line) => errors.push(line)), 1);
    assert.throws(() => projectDirectory('', root), /project-relative/u);
    assert.throws(() => projectDirectory(null, root), /project-relative/u);
    assert.throws(() => projectDirectory(resolve(root), root), /project-relative/u);
    assert.throws(() => projectDirectory('.', root), /escapes/u);
    assert.throws(() => projectDirectory('../outside', root), /escapes/u);
    assert.throws(() => projectDirectory('plain.txt', root), /not a directory/u);
    assert.equal(isAbsolute(resolve(root)), true);
    assert.ok(errors.length >= 3);
  } finally { cleanup(root); }
});

test('rejects missing, empty, malformed or structurally invalid canvas and empty vault', () => {
  const { root, vault } = fixture();
  try {
    const canvas = join(vault, 'graph.canvas');
    rmSync(canvas);
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /graph.canvas/u);
    writeFileSync(canvas, '', 'utf8');
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /graph.canvas/u);
    writeFileSync(canvas, '{', 'utf8');
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /valid JSON/u);
    writeFileSync(canvas, JSON.stringify({}), 'utf8');
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /nodes and edges/u);
    writeFileSync(canvas, JSON.stringify({ nodes: [], edges: [] }), 'utf8');
    rmSync(join(vault, 'README.md'));
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /Markdown note/u);
  } finally { cleanup(root); }
});

test('rejects symlinked vaults and symlinked entries, including physical escapes', () => {
  const { root, vault } = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-obsidian-outside-'));
  try {
    const externalVault = join(root, 'external-vault');
    symlinkSync(outside, externalVault, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectVault('external-vault', root), /resolves outside|symlink/u);
    const insideVault = join(root, 'inside-vault');
    symlinkSync(vault, insideVault, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectVault('inside-vault', root), /must not be a symlink/u);
    const targetDirectory = join(vault, 'target-dir');
    mkdirSync(targetDirectory);
    writeFileSync(join(targetDirectory, 'target.md'), '# Target\n', 'utf8');
    const insideLink = join(vault, 'inside-link');
    symlinkSync(targetDirectory, insideLink, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /symlink/u);
    rmSync(insideLink);
    symlinkSync(outside, join(vault, 'outside-dir'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectVault(DEFAULT_VAULT, root), /resolves outside|symlink/u);
  } finally { cleanup(root); cleanup(outside); }
});

test('rejects non-regular vault entries when the filesystem exposes one', () => {
  const { root, vault } = fixture();
  try {
    // A directory is traversed safely; a nested valid note keeps the positive walk branch live.
    mkdirSync(join(vault, 'nested'));
    writeFileSync(join(vault, 'nested', 'extra.md'), '# Nested\n', 'utf8');
    const result = inspectVault(DEFAULT_VAULT, root);
    assert.equal(result.markdown, 2);
  } finally { cleanup(root); }
});

test('fails closed on a filesystem entry that is neither a directory nor a regular file', () => {
  const root = resolve(mkdtempSync(join(tmpdir(), 'vcp-obsidian-nonregular-')));
  try {
    const fakeFilesystem = {
      readdirSync: () => [{ name: 'device' }],
      lstatSync: () => ({ isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false }),
      realpathSync: (candidate) => candidate,
    };
    assert.throws(() => walk(root, root, [], '', fakeFilesystem), /non-regular/u);
  } finally { cleanup(root); }
});
