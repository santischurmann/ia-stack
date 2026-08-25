import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-backup-state.mjs');
const { graphCommit, isWithin, main, projectPath, readableProjectFile, record, sha256, verify, writableProjectFile } = await import(pathToFileURL(script).href);

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
    assert.equal(record({
      reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json',
      manifestPath: '.vibe/backup.json', cwd: root, now: '2026-08-23T00:01:00.000Z',
    }).recorded_at, '2026-08-23T00:01:00.000Z', 'an existing regular manifest is the only overwrite allowed');

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

test('FALSIFICACIÓN · backup evidence never reads, writes or follows a path outside the project', () => {
  const { root } = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-backup-outside-'));
  try {
    writeFileSync(join(outside, 'GRAPH_REPORT.md'), '- Built from commit: `deadbeef`\n');
    writeFileSync(join(outside, 'graph.json'), '{}\n');
    assert.throws(() => record({
      reportPath: join(outside, 'GRAPH_REPORT.md'), graphPath: join(outside, 'graph.json'),
      manifestPath: '.vibe/backup.json', cwd: root,
    }), /escapes the project/i, 'absolute external input must reject before it is read');
    assert.throws(() => record({
      reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json',
      manifestPath: join(outside, 'backup.json'), cwd: root,
    }), /escapes the project/i, 'manifest output must stay inside the checkout');

    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => record({
      reportPath: 'linked/GRAPH_REPORT.md', graphPath: 'linked/graph.json',
      manifestPath: '.vibe/backup.json', cwd: root,
    }), /resolves outside the project/i, 'junction/symlink input must reject before it is read');

    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'backup.json'), JSON.stringify({
      schema: 'vcp.graphify-backup/v1', git_head: 'x', graph_report: '../outside.md', graph_report_sha256: 'x', graph: '../outside.json', graph_sha256: 'x',
    }));
    assert.match(verify('.vibe/backup.json', root).reason, /escapes the project/i, 'manifest fields cannot redirect verification outside the checkout');
    assert.match(verify(join(outside, 'missing.json'), root).reason, /escapes the project/i, 'check itself rejects an external manifest path');
    mkdirSync(join(root, '.vibe', 'not-a-file'), { recursive: true });
    assert.throws(() => record({
      reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json',
      manifestPath: '.vibe/not-a-file', cwd: root,
    }), /not a regular project file/i, 'a directory can never become a manifest output');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · backup path helpers only resolve regular files within a real checkout', () => {
  const { root } = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-backup-helper-outside-'));
  try {
    writeFileSync(join(outside, 'outside.json'), '{}\n');
    mkdirSync(join(root, 'directory.json'));
    symlinkSync(outside, join(root, 'linked.json'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(join(root, 'directory.json'), join(root, 'inside-link.json'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(isWithin(root, root), false);
    assert.equal(isWithin(root, dirname(root)), false);
    assert.equal(isWithin(root, 'Z:\\outside'), false);
    assert.equal(isWithin(root, join(root, 'tracked.txt')), true);
    assert.equal(isAbsolute(projectPath(root, 'missing/deep/backup.json').file), true, 'missing output still resolves below the checkout');
    assert.equal(readableProjectFile(root, 'tracked.txt').endsWith('tracked.txt'), true);
    assert.equal(writableProjectFile(root, 'new/backup.json').endsWith('backup.json'), true);
    assert.throws(() => projectPath(root, ''), /missing/i);
    assert.throws(() => projectPath(root, join(outside, 'outside.json')), /escapes the project/i);
    assert.throws(() => readableProjectFile(root, 'directory.json'), /not a regular project file/i);
    assert.throws(() => readableProjectFile(root, 'linked.json'), /resolves outside the project/i);
    assert.throws(() => readableProjectFile(root, 'inside-link.json'), /not a regular project file/i);
    assert.throws(() => writableProjectFile(root, 'directory.json'), /not a regular project file/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
