import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-security-baseline.mjs');
const { changedFiles, main, scanChangedFiles, scanFile } = await import(pathToFileURL(gate).href);

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
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-security-baseline-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'vcp-tests@example.invalid');
  git(root, 'config', 'user.name', 'VCP security tests');
  writeFileSync(join(root, 'baseline.js'), 'export const clean = true;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'baseline');
  return root;
}

function write(root, path, content) {
  const file = join(root, ...path.split('/'));
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

function check(root, ...args) {
  return run(process.execPath, [gate, 'check', ...args], root);
}

test('scanFile redacts secret values and reports artifact and injection categories', () => {
  const sample = [`const ${'to' + 'ken'} = '`, 'super' + 'secretvalue', `'; ${'ev' + 'al'}(userInput);\n`].join('');
  const findings = scanFile('src/a.js', sample);
  assert.deepEqual(findings.map((item) => item.severity), ['critical', 'high']);
  assert.equal(findings.some((item) => item.evidence.includes('supersecretvalue')), false);
  assert.equal(scanFile('.env', 'x=1\n')[0].category, 'committed-sensitive-artifact');
  assert.equal(scanFile('src/aws.js', `const key = "${'AK' + 'IA1234567890ABCDEF'}";`)[0].category, 'aws-access-key');
  assert.deepEqual(scanFile('README.md', `const ${'to' + 'ken'} = 'secretsecret';`), []);
});

test('scanFile does not flag the literal git CLI command "update-index --chmod=+x" as string-built SQL', () => {
  // Regression for a real false positive found auditing this repo's own test suite: bare
  // "update" (from "update-index", a git subcommand) followed later on the same line by an
  // unrelated "+" inside a different string literal ("--chmod=+x") matched the SQL/"+"
  // heuristic before the (?!-) lookahead fix.
  assert.deepEqual(scanFile('x.mjs', "gitOk(root, 'update-index', '--chmod=+x', 'tracked.txt');"), []);
});

test('FALSIFICACIÓN · real string-built SQL via "+" concatenation is still blocked after the CLI-subcommand fix', () => {
  // Keyword text is split with `+` (same convention as the rest of this file) so this test's own
  // source doesn't trip the live gate when it scans this very repo's changed files.
  const selectQuery = `const query = "${'SEL' + 'ECT'} * FROM users WHERE id=" + userId;`;
  const findings = scanFile('src/db.mjs', selectQuery);
  assert.deepEqual(findings.map((item) => item.category), ['injection-surface']);
  const updateQuery = `const query = "${'UPD' + 'ATE'} users SET name=" + name;`;
  const updateFindings = scanFile('src/db.mjs', updateQuery);
  assert.deepEqual(updateFindings.map((item) => item.category), ['injection-surface']);
});

test('FALSIFICACIÓN · an uncommitted secret blocks the release surface before git add', () => {
  const root = fixture();
  try {
    write(root, 'src/leak.js', `const ${'api' + 'Key'} = 'abcdefghijklmno';\n`);
    const result = check(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /CRITICAL hardcoded-secret src\/leak\.js:1/);
    assert.doesNotMatch(result.output, /abcdefghijklmno/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · staged sensitive artifacts and untracked injection are both blocking', () => {
  const root = fixture();
  try {
    write(root, '.env', ['PASS', 'WORD', '=', 'abcdefghijk\n'].join(''));
    git(root, 'add', '-f', '.env');
    const artifact = check(root);
    assert.equal(artifact.status, 1, artifact.output);
    assert.match(artifact.output, /committed-sensitive-artifact/);
    git(root, 'reset', '--quiet', '.env');
    write(root, 'src/run.js', `${'ev' + 'al'}(userInput);\n`);
    const injection = check(root);
    assert.equal(injection.status, 1, injection.output);
    assert.match(injection.output, /HIGH injection-surface/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('changedFiles unifies base, staged, unstaged and untracked changes without duplicates', () => {
  const calls = [];
  const paths = changedFiles({ gitRun: (args) => { calls.push(args); return 'a.js\0shared.js\0'; } });
  assert.deepEqual(paths, ['a.js', 'shared.js']);
  assert.equal(calls.length, 4);
});

test('scanChangedFiles skips deleted and unreadable live paths without crashing', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'directory.js'));
    const report = scanChangedFiles({ cwd: root, files: ['gone.js', 'directory.js'] });
    assert.deepEqual(report.scanned, []);
    assert.deepEqual(report.findings, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('safe changed code passes; CLI rejects bad usage and source-collection errors', () => {
  const root = fixture();
  try {
    write(root, 'src/clean.js', 'export const clean = true;\n');
    const result = check(root, '--base', 'HEAD');
    assert.equal(result.status, 0, result.output);
    const usage = run(process.execPath, [gate, 'nope'], root);
    assert.equal(usage.status, 2);
    const errors = [];
    assert.equal(main(['check'], { cwd: root, writeError: (line) => errors.push(line), write: () => {} }), 0);
    assert.equal(main(['check', '--base', 'HEAD'], { cwd: root, writeError: (line) => errors.push(line), write: () => {} }), 0);
    assert.equal(main(['check', '--base', ''], { cwd: root, writeError: (line) => errors.push(line), write: () => {} }), 2);
    assert.equal(main(['check', '--base', 'does-not-exist'], { cwd: root, writeError: (line) => errors.push(line), write: () => {} }), 1);
    assert.match(errors.at(-1), /unable to collect/i);
    write(root, 'src/finding.js', `${'ev' + 'al'}(userInput);\n`);
    assert.equal(main(['check'], { cwd: root, writeError: (line) => errors.push(line), write: () => {} }), 1);
    assert.match(errors.join('\n'), /injection-surface/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
