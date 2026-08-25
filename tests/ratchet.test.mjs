import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ratchetScript = join(repoRoot, 'scripts', 'ratchet.mjs');
const { Counter, count, compare, isWithin, main, matches, safeProjectFile } = await import(pathToFileURL(ratchetScript).href);

function run(cwd, ...args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [ratchetScript, ...args], { cwd, encoding: 'utf8', env });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function gitFixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ratchet-'));
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 'vcp-tests@example.invalid'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'VCP ratchet tests'], { cwd: root });
  return root;
}

function commitAll(root, message) {
  spawnSync('git', ['add', '-A'], { cwd: root });
  spawnSync('git', ['commit', '-qm', message], { cwd: root });
}

test('count() sums pattern occurrences over included, non-excluded files', () => {
  const files = [
    { path: 'src/a.js', content: 'const x = "#ff0000"; // TODO fix\n' },
    { path: 'src/tokens.js', content: '#ff0000 #00ff00' },
    { path: 'src/a.test.js', content: '#ff0000' },
  ];
  const counters = [
    new Counter({ name: 'hex', pattern: '#[0-9a-f]{6}', include: ['src/**'], exclude: ['**/*.test.js', 'src/tokens.js'] }),
  ];
  assert.deepEqual(count(files, counters), { hex: 1 }, 'only src/a.js counts — tokens.js and *.test.js excluded');
});

test('matches() handles ** and single-segment * globs', () => {
  assert.equal(matches('src/deep/nested/file.js', 'src/**'), true);
  assert.equal(matches('src/file.js', 'src/*.js'), true);
  assert.equal(matches('src/deep/file.js', 'src/*.js'), false);
});

test('FALSIFICACIÓN · project containment rejects the checkout root, its direct parent and another volume', () => {
  const root = 'C:\\vcp\\project';
  assert.equal(isWithin(root, root), false);
  assert.equal(isWithin(root, dirname(root)), false);
  assert.equal(isWithin(root, 'Z:\\outside'), false);
  assert.equal(isWithin(root, join(root, 'src', 'safe.js')), true);
});

test('FALSIFICACIÓN · ratchet file paths reject lexical and physical escapes before they can be counted', () => {
  const root = gitFixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-ratchet-path-outside-'));
  try {
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(safeProjectFile(root, 'missing.txt'), null);
    assert.equal(safeProjectFile(root, 'missing/deep/file.txt', { allowMissing: true }).endsWith('file.txt'), true);
    assert.throws(() => safeProjectFile(root, '../outside.txt'), /escapes the project/i);
    assert.throws(() => safeProjectFile(root, 'linked/missing.txt', { allowMissing: true }), /resolves outside the project/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · matches() must match a root-level file against **/*.ext', () => {
  // Real bug this test caught: a naive split('**').join('.*') builds a regex requiring a
  // literal '/' wherever '**/' appeared, silently excluding every root-level file.
  assert.equal(matches('a.js', '**/*.js'), true, 'a root-level file must match **/*.js');
  assert.equal(matches('src/deep/a.js', '**/*.js'), true, 'a nested file must also match');
  assert.equal(matches('a.ts', '**/*.js'), false, 'wrong extension must not match');
});

test('FALSIFICACIÓN · compare() flags a counter that grew', () => {
  const { ok, grew } = compare({ hex: 5 }, { hex: 3 });
  assert.equal(ok, false);
  assert.deepEqual(grew, [{ name: 'hex', baseline: 3, current: 5 }]);
});

test('FALSIFICACIÓN · compare() flags a new counter with no baseline as a failure', () => {
  const { ok, newCounters } = compare({ hex: 0, mocks: 2 }, { hex: 0 });
  assert.equal(ok, false);
  assert.deepEqual(newCounters, [{ name: 'mocks', value: 2 }]);
});

test('compare() reports a shrunk counter without failing', () => {
  const { ok, shrank } = compare({ hex: 1 }, { hex: 3 });
  assert.equal(ok, true, 'a counter going down must not fail the gate');
  assert.deepEqual(shrank, [{ name: 'hex', baseline: 3, current: 1 }]);
});

test('a counter that did not change passes', () => {
  const { ok, grew, shrank, newCounters } = compare({ hex: 3 }, { hex: 3 });
  assert.equal(ok, true);
  assert.deepEqual(grew, []);
  assert.deepEqual(shrank, []);
  assert.deepEqual(newCounters, []);
});

test('CLI without .vibe/counters.json exits 2 — the gate is opt-in, not default-on', () => {
  const root = gitFixture();
  try {
    const result = run(root);
    assert.equal(result.status, 2);
    assert.match(result.output, /No counters declared/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI without a frozen baseline exits 2 and tells you the exact command to freeze', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    commitAll(root, 'declare counters');
    const result = run(root);
    assert.equal(result.status, 2);
    assert.match(result.output, /ratchet\.mjs --freeze/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · CLI fails when a frozen counter grows after new code lands', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), '// TODO one\n');
    commitAll(root, 'baseline');
    const freeze = run(root, '--freeze');
    assert.equal(freeze.status, 0, freeze.output);

    writeFileSync(join(root, 'b.js'), '// TODO two\n// TODO three\n');
    commitAll(root, 'adds new TODOs — the ratchet must catch this');
    const result = run(root);
    assert.equal(result.status, 1, 'a grown counter must fail the gate');
    assert.match(result.output, /todo: 1 → 3/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · CLI fails before git add when an untracked source file grows a counter', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), 'export const clean = true;\n');
    commitAll(root, 'baseline without debt');
    assert.equal(run(root, '--freeze').status, 0);

    writeFileSync(join(root, 'new-untracked.js'), '// TODO must be seen before git add\n');
    const result = run(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /todo: 0 → 1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI reports a shrunk counter and passes', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), '// TODO one\n// TODO two\n');
    commitAll(root, 'baseline with 2 TODOs');
    assert.equal(run(root, '--freeze').status, 0);

    writeFileSync(join(root, 'a.js'), '// TODO one\n');
    commitAll(root, 'fixed one TODO');
    const result = run(root);
    assert.equal(result.status, 0, 'a shrunk counter must still pass');
    assert.match(result.output, /↓ todo: 2 → 1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · CLI fails when a new counter is declared with no baseline entry for it', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), '// TODO one\n');
    commitAll(root, 'baseline');
    assert.equal(run(root, '--freeze').status, 0);

    // Declare a second counter without re-freezing — its baseline entry doesn't exist yet.
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [
        { name: 'todo', pattern: 'TODO', include: ['**/*.js'] },
        { name: 'fixme', pattern: 'FIXME', include: ['**/*.js'] },
      ],
    }));
    commitAll(root, 'add a second counter without freezing it');
    const result = run(root);
    assert.equal(result.status, 1, 'a counter with no baseline must fail, not silently pass as 0');
    assert.match(result.output, /fixme: new counter/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('repoFiles() skips a tracked path that is unreadable on disk instead of crashing', () => {
  // git ls-files lists tracked paths regardless of current disk state — a file deleted from
  // disk without `git rm` (or a broken symlink target) is exactly this case: tracked, but
  // readFileSync throws ENOENT. Must be skipped, not crash the whole gate.
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), '// TODO one\n');
    commitAll(root, 'baseline');
    rmSync(join(root, 'a.js')); // gone from disk, still tracked in the index/HEAD
    const result = run(root, '--freeze');
    assert.equal(result.status, 0, `a missing-on-disk tracked file must not crash the ratchet\n${result.output}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · ratchet fails closed instead of following an untracked junction outside the project', () => {
  const root = gitFixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-ratchet-outside-'));
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    commitAll(root, 'declares counter');
    writeFileSync(join(outside, 'outside.js'), '// TODO must not be read outside the checkout\n');
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = run(root, '--freeze');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /REJECTED: unable to read.*safely/i);
    assert.match(result.output, /resolves outside the project/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · ratchet reports state, write and baseline-read failures instead of continuing', () => {
  const root = gitFixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-ratchet-state-outside-'));
  try {
    mkdirSync(join(outside, '.vibe'), { recursive: true });
    writeFileSync(join(outside, '.vibe', 'counters.json'), JSON.stringify({ counters: [] }));
    symlinkSync(join(outside, '.vibe'), join(root, '.vibe'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(main([], root), 1, 'linked .vibe state must fail before its config is read');
    rmSync(join(root, '.vibe'), { recursive: true, force: true });
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({ counters: [] }));
    assert.equal(main(['--freeze'], root, { readFile: readFileSync, writeFile: () => { throw new Error('disk full'); } }), 1, 'baseline write failure must be explicit');
    writeFileSync(join(root, '.vibe', 'counters-baseline.json'), '{}\n');
    assert.equal(main([], root, {
      readFile: (path, encoding) => path.endsWith('counters-baseline.json') ? (() => { throw new Error('read denied'); })() : readFileSync(path, encoding),
      writeFile: writeFileSync,
    }), 1, 'baseline read failure must be explicit');

    writeFileSync(join(root, '.vibe', 'counters.json'), '{ bad');
    assert.equal(main([], root), 1, 'malformed counter config must be explicit, not an empty baseline');
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({ counters: [] }));
    rmSync(join(root, '.vibe', 'counters.json'));
    mkdirSync(join(root, '.vibe', 'counters.json'));
    assert.equal(main([], root), 1, 'a directory can never be the counter config');
    rmSync(join(root, '.vibe', 'counters.json'), { recursive: true, force: true });
    symlinkSync(outside, join(root, '.vibe', 'counters.json'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(main([], root), 1, 'a direct linked counter config must be rejected before reading it');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('CLI passes when the frozen counter does not grow, even with unrelated new files', () => {
  const root = gitFixture();
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, '.vibe', 'counters.json'), JSON.stringify({
      counters: [{ name: 'todo', pattern: 'TODO', include: ['**/*.js'] }],
    }));
    writeFileSync(join(root, 'a.js'), '// TODO one\n');
    commitAll(root, 'baseline');
    assert.equal(run(root, '--freeze').status, 0);

    writeFileSync(join(root, 'clean.js'), 'export const clean = true;\n');
    commitAll(root, 'unrelated clean file');
    const result = run(root);
    assert.equal(result.status, 0, result.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
