import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-backup-state.mjs');
const { graphCommit, main, record, sha256, verify } = await import(pathToFileURL(script).href);

function run(command, args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function git(root, ...args) {
  const result = run('git', args, root);
  assert.equal(result.status, 0, result.output);
  return result.output.trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-backup-state-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'vcp-tests@example.invalid');
  git(root, 'config', 'user.name', 'VCP backup tests');
  writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'baseline');
  const head = git(root, 'rev-parse', 'HEAD');
  mkdirSync(join(root, 'graphify-out'));
  writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), `# Graph\n\n- Built from commit: \`${head.slice(0, 8)}\`\n`);
  writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":1}\n');
  return { root, head };
}

test('records and verifies an exact current Graphify backup receipt', () => {
  const { root, head } = fixture();
  try {
    const manifestPath = join(root, '.vibe', 'backups', 'graphify.json');
    const manifest = record({ reportPath: join(root, 'graphify-out', 'GRAPH_REPORT.md'), graphPath: join(root, 'graphify-out', 'graph.json'), manifestPath, cwd: root, now: '2026-08-23T00:00:00.000Z' });
    assert.equal(manifest.git_head, head);
    assert.equal(manifest.graph_sha256, sha256(join(root, 'graphify-out', 'graph.json')));
    assert.equal(verify(manifestPath, root).ok, true);
    assert.equal(graphCommit(readFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), 'utf8')), head.slice(0, 8));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · stale report, changed graph, corrupt and missing manifests reject', () => {
  const { root } = fixture();
  try {
    const manifestPath = join(root, '.vibe', 'backup.json');
    assert.throws(() => record({ reportPath: join(root, 'graphify-out', 'GRAPH_REPORT.md'), graphPath: join(root, 'graphify-out', 'missing.json'), manifestPath, cwd: root }), /graph not found/i);
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '- Built from commit: `deadbeef`\n');
    assert.throws(() => record({ reportPath: join(root, 'graphify-out', 'GRAPH_REPORT.md'), graphPath: join(root, 'graphify-out', 'graph.json'), manifestPath, cwd: root }), /stale/i);
    assert.equal(verify(manifestPath, root).ok, false);
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(manifestPath, '{ bad');
    assert.equal(verify(manifestPath, root).ok, false);

    writeFileSync(manifestPath, JSON.stringify({ schema: 'wrong' }));
    assert.match(verify(manifestPath, root).reason, /unknown backup manifest schema/i);
    writeFileSync(manifestPath, JSON.stringify({ schema: 'vcp.graphify-backup/v1' }));
    assert.match(verify(manifestPath, root).reason, /missing required fields/i);
    writeFileSync(manifestPath, JSON.stringify({
      schema: 'vcp.graphify-backup/v1', git_head: 'x', graph_report: 'x', graph_report_sha256: 'x', graph: '', graph_sha256: 'x',
    }));
    assert.match(verify(manifestPath, root).reason, /missing required fields/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI records/checks and fails after a graph mutation or bad syntax', () => {
  const { root } = fixture();
  try {
    const manifest = '.vibe/backup.json';
    const recordResult = run(process.execPath, [script, 'record', '--report', 'graphify-out/GRAPH_REPORT.md', '--graph', 'graphify-out/graph.json', '--manifest', manifest], root);
    assert.equal(recordResult.status, 0, recordResult.output);
    assert.equal(run(process.execPath, [script, 'check', manifest], root).status, 0);
    writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":2}\n');
    assert.equal(run(process.execPath, [script, 'check', manifest], root).status, 1);
    const errors = [];
    assert.equal(main(['bad'], root, () => {}, (line) => errors.push(line)), 2);
    assert.match(errors.at(-1), /usage:/i);
    assert.equal(main(['wrong', 'path'], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['wrong', '--report', 'a', '--graph', 'b', '--manifest', 'c'], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['record', '--report', 'a', '--report', 'b', '--manifest', 'c'], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['record', '--report', 'a', '--graph', 'b', '--manifest'], root, () => {}, (line) => errors.push(line)), 2);
    assert.equal(main(['check', '.vibe/does-not-exist.json'], root, () => {}, (line) => errors.push(line)), 1);
    assert.match(errors.at(-1), /backup manifest not found/i);
    assert.equal(main(['record', '--report', 'graphify-out/GRAPH_REPORT.md', '--graph', 'missing.json', '--manifest', manifest], root, () => {}, (line) => errors.push(line)), 1);
    assert.match(errors.at(-1), /graph not found/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · relative paths and every mutable backup input are bound', () => {
  const { root, head } = fixture();
  try {
    const manifest = record({
      reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json',
      manifestPath: '.vibe/backup.json', cwd: root, now: '2026-08-23T00:00:00.000Z',
    });
    assert.equal(manifest.graph_report, 'graphify-out/GRAPH_REPORT.md');
    assert.equal(manifest.graph, 'graphify-out/graph.json');
    assert.equal(verify('.vibe/backup.json', root).ok, true);

    const manifestPath = join(root, '.vibe', 'backup.json');
    const changedHead = { ...manifest, git_head: `${head[0] === '0' ? '1' : '0'}${head.slice(1)}` };
    writeFileSync(manifestPath, JSON.stringify(changedHead));
    assert.match(verify('.vibe/backup.json', root).reason, /HEAD.*stale/i);
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, graph_report_sha256: '0' }));
    assert.match(verify('.vibe/backup.json', root).reason, /report hash changed/i);
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, graph_sha256: '0' }));
    assert.match(verify('.vibe/backup.json', root).reason, /graph hash changed/i);
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, graph_report: 'missing.md' }));
    assert.match(verify('.vibe/backup.json', root).reason, /report not found/i);

    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '# Graph without a commit\n');
    assert.throws(() => record({ reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json', manifestPath: '.vibe/again.json', cwd: root }), /stale/i);
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '- Built from commit: `abc`\n');
    assert.throws(() => record({ reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json', manifestPath: '.vibe/again.json', cwd: root }), /stale/i);
    assert.equal(graphCommit('no Graphify metadata'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
