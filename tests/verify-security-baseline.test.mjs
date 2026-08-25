import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-security-baseline.mjs');
const { MAX_SCANNABLE_BYTES, changedFiles, isProjectRelativePath, main, scanChangedFiles, scanFile } = await import(pathToFileURL(gate).href);

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
  assert.deepEqual(scanFile('README.md', `const ${'to' + 'ken'} = 'secretsecret';`).map((item) => item.category), ['hardcoded-secret']);
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

test('FALSIFICACIÓN · provider credential shapes and private-key content block even outside a sensitive filename', () => {
  const github = ['gh', 'p_', 'abcdefghijklmnopqrstuvwxyz0123456789AB'].join('');
  const privateKey = ['-----BEGIN', ' OPENSSH', ' PRIVATE', ' KEY-----'].join('');
  const assignment = `${'to' + 'ken'} = '${github}'`;
  const findings = scanFile('src/credentials.mjs', `const ${assignment};\n${privateKey}\n`);
  assert.deepEqual(findings.map((item) => item.category), ['hardcoded-secret', 'private-key-content', 'github-token']);
  assert.equal(findings.some((item) => item.evidence.includes(github)), false);
  const proseToken = ['gh', 'p_', '12345678901234567890'].join('');
  assert.deepEqual(scanFile('docs/README.md', `Troubleshooting token: ${proseToken}\n`).map((item) => item.category), ['github-token'], 'a real token pasted into prose must not evade the release gate');
});

test('FALSIFICACIÓN · Function, template SQL and dynamic HTML sinks are separate blocking injection classes', () => {
  const dynamicFunction = `${'Funct' + 'ion'}('return 1')();`;
  assert.deepEqual(scanFile('src/dynamic.mjs', dynamicFunction).map((item) => item.category), ['injection-surface']);
  const templateSql = [`${'SEL' + 'ECT'} * FROM users WHERE id = `, '${', 'userId', '}'].join('');
  assert.deepEqual(scanFile('src/db.mjs', templateSql).map((item) => item.category), ['template-sql-injection-surface']);
  const htmlSink = [[...'inner'].join(''), [...'HTML'].join(''), ' = prefix ', '+ userInput;'].join('');
  assert.deepEqual(scanFile('src/view.mjs', htmlSink).map((item) => item.category), ['html-injection-surface']);
});

test('FALSIFICACIÓN · GitHub workflow supply-chain hazards block while local and SHA-pinned actions pass', () => {
  const unsafe = [
    'on:', '  pull_request_target:', 'jobs:', '  release:', '    steps:',
    '      - uses: actions/checkout@main', '      - run: echo ${{ github.event.issue.title }}', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/release.yml', unsafe).map((item) => item.category), ['ci-untrusted-trigger', 'ci-unpinned-action', 'ci-expression-in-run']);
  const safe = [
    'jobs:', '  verify:', '    steps:',
    '      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567', '      - uses: ./local-action', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/safe.yaml', safe), []);
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

test('scanChangedFiles skips deleted and non-regular live paths without crashing', () => {
  const root = fixture();
  try {
    mkdirSync(join(root, 'directory.js'));
    const report = scanChangedFiles({ cwd: root, files: ['gone.js', 'directory.js'] });
    assert.deepEqual(report.scanned, []);
    assert.deepEqual(report.skipped, [{ path: 'gone.js', reason: 'missing' }, { path: 'directory.js', reason: 'not-regular-file' }]);
    assert.deepEqual(report.findings, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · paths outside the project, symlinks and oversized source fail closed instead of being read', () => {
  const root = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-security-outside-'));
  try {
    writeFileSync(join(outside, 'secret.js'), 'export const outside = true;\n');
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(join(root, 'large.js'), Buffer.alloc(MAX_SCANNABLE_BYTES + 1, 0x61));
    assert.equal(isProjectRelativePath('src/a.js', root), true);
    assert.equal(isProjectRelativePath('../outside.js', root), false);
    assert.equal(isProjectRelativePath(join(outside, 'secret.js'), root), false);
    const report = scanChangedFiles({ cwd: root, files: ['../outside.js', 'linked', 'linked/secret.js', 'large.js'] });
    assert.deepEqual(report.scanned, []);
    assert.deepEqual(report.findings.map((item) => item.category), ['unsafe-scan-path', 'unsafe-scan-input', 'unsafe-scan-input', 'unscanned-large-source']);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a source that cannot be resolved or read is a blocking finding, never an implicit skip', () => {
  const root = fixture();
  try {
    write(root, 'src/clean.js', 'export const clean = true;\n');
    const unresolved = scanChangedFiles({
      cwd: root, files: ['src/clean.js'],
      filesystem: { lstatSync, readFileSync, realpathSync: (path) => path.endsWith('clean.js') ? (() => { throw new Error('link changed'); })() : realpathSync(path) },
    });
    assert.deepEqual(unresolved.findings.map((item) => item.category), ['unscannable-source']);
    const unreadable = scanChangedFiles({
      cwd: root, files: ['src/clean.js'],
      filesystem: { lstatSync, realpathSync, readFileSync: () => { throw new Error('read denied'); } },
    });
    assert.deepEqual(unreadable.findings.map((item) => item.category), ['unscannable-source']);
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
