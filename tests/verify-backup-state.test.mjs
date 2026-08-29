import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-backup-state.mjs');
const { graphInventoryFile, isWithin, main, projectPath, readableProjectFile, record, sha256, verify, writableProjectFile } = await import(pathToFileURL(script).href);

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

// `commit: false` builds a checkout that git init created and nobody committed to yet: `git
// rev-parse HEAD` fails there, which is the only state where the receipt has no commit to bind to.
function fixture({ commit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-backup-state-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'vcp-tests@example.invalid');
  git(root, 'config', 'user.name', 'VCP backup tests');
  writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
  let head = null;
  if (commit) {
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'baseline');
    head = git(root, 'rev-parse', 'HEAD');
  }
  mkdirSync(join(root, 'graphify-out'));
  writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), `# Graph\n\n- Built from commit: \`${(head ?? 'deadbeef').slice(0, 8)}\`\n`);
  writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":1}\n');
  return { root, head };
}

// Commits a file WITHOUT touching graphify-out/: this is the docs-only commit that Graphify never
// reacts to, so the report keeps naming an ancestor while the graph content stays correct.
function commitOutsideTheGraph(root, name) {
  writeFileSync(join(root, name), `${name}\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', `add ${name}`);
  return git(root, 'rev-parse', 'HEAD');
}

const RECORD_ARGS = { reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json', manifestPath: '.vibe/backup.json' };

test('records and verifies an exact current Graphify backup receipt', () => {
  const { root, head } = fixture();
  try {
    const manifestPath = join(root, '.vibe', 'backups', 'graphify.json');
    const manifest = record({ reportPath: join(root, 'graphify-out', 'GRAPH_REPORT.md'), graphPath: join(root, 'graphify-out', 'graph.json'), manifestPath, cwd: root, now: '2026-08-23T00:00:00.000Z' });
    assert.equal(manifest.git_head, head);
    assert.equal(manifest.graph_sha256, sha256(join(root, 'graphify-out', 'graph.json')));
    assert.equal(verify(manifestPath, root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a missing graph, corrupt and missing manifests reject', () => {
  const { root } = fixture();
  try {
    const manifestPath = join(root, '.vibe', 'backup.json');
    assert.throws(() => record({ reportPath: join(root, 'graphify-out', 'GRAPH_REPORT.md'), graphPath: join(root, 'graphify-out', 'missing.json'), manifestPath, cwd: root }), /graph not found/i);
    assert.equal(verify(manifestPath, root).ok, false, 'a record that threw leaves no manifest behind');
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

    // A report carrying no commit metadata at all is still recordable — the seal never came from
    // its text — but its bytes stay bound, so editing it after the fact is still a rejection.
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '# Graph without a commit\n');
    const sealed = record({ reportPath: 'graphify-out/GRAPH_REPORT.md', graphPath: 'graphify-out/graph.json', manifestPath: '.vibe/again.json', cwd: root, now: '2026-08-23T00:02:00.000Z' });
    assert.equal(sealed.git_head, head);
    assert.equal(verify('.vibe/again.json', root).ok, true);
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '# Graph without a commit, edited\n');
    assert.match(verify('.vibe/again.json', root).reason, /report hash changed/iu);
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

test('the receipt binds the HEAD the protocol reads, not the commit the Graphify report names', () => {
  const { root, head: ancestor } = fixture();
  try {
    const head = commitOutsideTheGraph(root, 'docs.md');
    const report = readFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), 'utf8');
    assert.equal(report.includes(ancestor.slice(0, 8)), true, 'the report still names the ancestor commit');
    assert.equal(report.includes(head.slice(0, 8)), false, 'and Graphify never rewrote it for the docs-only commit');

    const manifest = record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:00:00.000Z' });
    assert.equal(manifest.git_head, head, 'record seals the real HEAD, never the seal printed in the report');
    assert.equal(verify('.vibe/backup.json', root).ok, true);
    const checked = run(process.execPath, [script, 'check', '.vibe/backup.json'], root);
    assert.equal(checked.status, 0, checked.output);
    assert.match(checked.output, new RegExp(head, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a moved HEAD, a mutated graph, a rewritten report and a hand-shortened seal all reject', () => {
  const { root, head } = fixture();
  try {
    const manifestPath = join(root, '.vibe', 'backup.json');
    const manifest = record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:00:00.000Z' });
    assert.equal(verify('.vibe/backup.json', root).ok, true);

    // A prefix passed under the old `head.startsWith(seal)` rule; the protocol-owned seal is exact.
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, git_head: head.slice(0, 7) }));
    assert.match(verify('.vibe/backup.json', root).reason, /HEAD.*stale/iu);

    writeFileSync(manifestPath, JSON.stringify(manifest));
    const moved = commitOutsideTheGraph(root, 'docs.md');
    assert.match(verify('.vibe/backup.json', root).reason, new RegExp(`${manifest.git_head}[^]*${moved}`, 'u'), 'a receipt left behind by a new commit is still rejected');

    record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:01:00.000Z' });
    writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":99}\n');
    assert.match(verify('.vibe/backup.json', root).reason, /graph hash changed/iu, 'a graph edited after recording must never pass');
    assert.equal(run(process.execPath, [script, 'check', '.vibe/backup.json'], root).status, 1);

    record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:02:00.000Z' });
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '# Graph rewritten after the fact\n');
    assert.match(verify('.vibe/backup.json', root).reason, /report hash changed/iu, 'a report edited after recording must never pass');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a checkout with no commit yet cannot be sealed and cannot be checked', () => {
  const { root, head } = fixture({ commit: false });
  try {
    assert.equal(head, null);
    assert.throws(() => record({ ...RECORD_ARGS, cwd: root }), /git HEAD/iu, 'there is no commit to bind the receipt to');
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'backup.json'), JSON.stringify({
      schema: 'vcp.graphify-backup/v1', git_head: 'deadbeef', recorded_at: '2026-08-28T00:00:00.000Z',
      graph_report: 'graphify-out/GRAPH_REPORT.md', graph_report_sha256: sha256(join(root, 'graphify-out', 'GRAPH_REPORT.md')),
      graph: 'graphify-out/graph.json', graph_sha256: sha256(join(root, 'graphify-out', 'graph.json')),
    }));
    assert.match(verify('.vibe/backup.json', root).reason, /git HEAD/iu, 'matching hashes never stand in for a missing commit');
    assert.equal(run(process.execPath, [script, 'check', '.vibe/backup.json'], root).status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Every assertion here checks the FILE, not just the exit code: the whole point is that the bytes
// survive. A gate whose job is protecting evidence must never destroy evidence on a mistyped flag.
test('FALSIFICACIÓN · a manifest aimed at the report or the graph is refused and both files survive byte for byte', () => {
  const { root } = fixture();
  try {
    const reportFile = join(root, 'graphify-out', 'GRAPH_REPORT.md');
    const graphFile = join(root, 'graphify-out', 'graph.json');
    const reportHash = sha256(reportFile);
    const graphHash = sha256(graphFile);

    assert.throws(() => record({ ...RECORD_ARGS, manifestPath: 'graphify-out/graph.json', cwd: root }), /overwrite the Graphify graph/iu);
    assert.equal(sha256(graphFile), graphHash, 'the graph must be untouched, not merely reported as an error');

    assert.throws(() => record({ ...RECORD_ARGS, manifestPath: 'graphify-out/GRAPH_REPORT.md', cwd: root }), /overwrite the Graphify report/iu);
    assert.equal(sha256(reportFile), reportHash, 'the report must be untouched too');

    // Raw string comparison would let this spelling through; the paths are compared resolved.
    assert.throws(() => record({ ...RECORD_ARGS, manifestPath: './graphify-out/graph.json', cwd: root }), /overwrite the Graphify graph/iu);
    assert.equal(sha256(graphFile), graphHash);

    const cli = run(process.execPath, [script, 'record', '--report', 'graphify-out/GRAPH_REPORT.md', '--graph', 'graphify-out/graph.json', '--manifest', 'graphify-out/graph.json'], root);
    assert.equal(cli.status, 1, cli.output);
    assert.match(cli.output, /REJECTED/u, 'the CLI must never answer OK after refusing to write');
    assert.equal(sha256(graphFile), graphHash, 'the graph survives the CLI attempt as well');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a manifest aimed at any other project file is refused and that file survives', () => {
  const { root } = fixture();
  try {
    const notes = join(root, 'NOTES.md');
    writeFileSync(notes, '# notas del proyecto\nsegunda linea\n');
    const notesHash = sha256(notes);
    assert.throws(() => record({ ...RECORD_ARGS, manifestPath: 'NOTES.md', cwd: root }), /not a backup manifest/iu);
    assert.equal(sha256(notes), notesHash, 'an unrelated project file is never a valid output target');

    // Valid JSON is not enough: the file has to be a receipt this tool wrote.
    const foreign = join(root, 'foreign.json');
    writeFileSync(foreign, '{"schema":"otra-cosa/v1"}\n');
    const foreignHash = sha256(foreign);
    assert.throws(() => record({ ...RECORD_ARGS, manifestPath: 'foreign.json', cwd: root }), /not a backup manifest/iu);
    assert.equal(sha256(foreign), foreignHash);

    // The one overwrite that stays allowed: re-recording over a receipt this tool wrote.
    const first = record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:00:00.000Z' });
    const second = record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:01:00.000Z' });
    assert.equal(second.recorded_at, '2026-08-28T00:01:00.000Z');
    assert.equal(second.git_head, first.git_head);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · an empty report or an empty graph is not evidence and is never recorded', () => {
  const { root } = fixture();
  try {
    const reportFile = join(root, 'graphify-out', 'GRAPH_REPORT.md');
    writeFileSync(reportFile, '');
    assert.throws(() => record({ ...RECORD_ARGS, cwd: root }), /report is empty/iu);
    const cli = run(process.execPath, [script, 'record', '--report', 'graphify-out/GRAPH_REPORT.md', '--graph', 'graphify-out/graph.json', '--manifest', '.vibe/backup.json'], root);
    assert.equal(cli.status, 1, cli.output);

    writeFileSync(reportFile, '# back\n');
    writeFileSync(join(root, 'graphify-out', 'graph.json'), '');
    assert.throws(() => record({ ...RECORD_ARGS, cwd: root }), /graph is empty/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The guarantee this gate deliberately does NOT give, pinned so nobody reads a green check as
// "the graph describes this commit". `verify-graphify-manifest.mjs` is the gate that covers that
// half; here a graph whose content has nothing to do with the tree records and checks clean.
test('FALSIFICACIÓN · the receipt binds content to a commit, it never proves the graph describes it', () => {
  const { root } = fixture();
  try {
    writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":0,"about":"a different project entirely"}\n');
    const manifest = record({ ...RECORD_ARGS, cwd: root, now: '2026-08-28T00:00:00.000Z' });
    assert.equal(manifest.graph_sha256, sha256(join(root, 'graphify-out', 'graph.json')));
    assert.equal(verify('.vibe/backup.json', root).ok, true, 'documented limit: construction is not verified, only immutability since record');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


// --- El sello cubre tambien el inventario del grafo ---------------------------------------------

// Reproducido el 2026-08-28: el recibo sellaba el reporte y el grafo pero NO el manifest.json, que
// es justo el archivo que dice QUE archivos cubre el grafo. Alterar la cobertura despues de sellar
// dejaba este gate y el del manifiesto en verde a la vez, sobre un grafo que ya no correspondia.
test('FALSIFICACION · alterar el inventario despues de sellar rechaza', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-inventario-'));
  try {
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '.');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    mkdirSync(join(root, 'graphify-out'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'graphify-out/' + String.fromCharCode(10), 'utf8');
    writeFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), '# reporte' + String.fromCharCode(10), 'utf8');
    writeFileSync(join(root, 'graphify-out', 'graph.json'), '{"nodes":[]}' + String.fromCharCode(10), 'utf8');
    writeFileSync(join(root, 'graphify-out', 'manifest.json'), JSON.stringify({ '.gitignore': {} }), 'utf8');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');

    const grabar = spawnSync(process.execPath, [script, 'record', '--report', 'graphify-out/GRAPH_REPORT.md', '--graph', 'graphify-out/graph.json', '--manifest', 'graphify-out/backup-state.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(grabar.status, 0, grabar.stderr);
    const recibo = JSON.parse(readFileSync(join(root, 'graphify-out', 'backup-state.json'), 'utf8'));
    assert.match(recibo.graph_inventory_sha256, /^[0-9a-f]{64}$/u, 'el inventario tiene que quedar sellado');

    const antes = spawnSync(process.execPath, [script, 'check', 'graphify-out/backup-state.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(antes.status, 0, antes.stderr);

    writeFileSync(join(root, 'graphify-out', 'manifest.json'), JSON.stringify({ '.gitignore': {}, 'inventado.md': {} }), 'utf8');
    const despues = spawnSync(process.execPath, [script, 'check', 'graphify-out/backup-state.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(despues.status, 1, despues.stdout);
    assert.match(despues.stderr, /inventory/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('graphInventoryFile devuelve null cuando no hay inventario, y sella igual', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-sin-inventario-'));
  try {
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '.');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    mkdirSync(join(root, 'g'), { recursive: true });
    writeFileSync(join(root, 'g', 'r.md'), '# r' + String.fromCharCode(10), 'utf8');
    writeFileSync(join(root, 'g', 'graph.json'), '{}' + String.fromCharCode(10), 'utf8');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');

    // Un proyecto sin manifest.json no puede quedar bloqueado por un archivo que no le toca crear.
    assert.equal(graphInventoryFile(root, 'g/graph.json'), null);
    // Y una ruta que se escapa del proyecto tampoco tumba el gate.
    assert.equal(graphInventoryFile(root, '../fuera/graph.json'), null);

    const grabar = spawnSync(process.execPath, [script, 'record', '--report', 'g/r.md', '--graph', 'g/graph.json', '--manifest', 'g/backup.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(grabar.status, 0, grabar.stderr);
    const verificar = spawnSync(process.execPath, [script, 'check', 'g/backup.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(verificar.status, 0, verificar.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un recibo viejo sin el sello del inventario sigue verificando si no hay inventario', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-recibo-viejo-'));
  try {
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '.');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    mkdirSync(join(root, 'g'), { recursive: true });
    writeFileSync(join(root, 'g', 'r.md'), '# r' + String.fromCharCode(10), 'utf8');
    writeFileSync(join(root, 'g', 'graph.json'), '{}' + String.fromCharCode(10), 'utf8');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');

    spawnSync(process.execPath, [script, 'record', '--report', 'g/r.md', '--graph', 'g/graph.json', '--manifest', 'g/backup.json'], { cwd: root, encoding: 'utf8' });
    // Un recibo escrito antes de que existiera este campo: se lee como "no habia inventario".
    const recibo = JSON.parse(readFileSync(join(root, 'g', 'backup.json'), 'utf8'));
    delete recibo.graph_inventory_sha256;
    writeFileSync(join(root, 'g', 'backup.json'), JSON.stringify(recibo, null, 2) + String.fromCharCode(10), 'utf8');

    const r = spawnSync(process.execPath, [script, 'check', 'g/backup.json'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
