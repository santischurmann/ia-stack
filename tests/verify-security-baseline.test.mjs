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
  // A bare BEGIN header with no real PEM structure nearby is prose describing a key shape, not
  // a real leaked key (see privateKeyIndex) — this fixture includes two consecutive base64-shaped
  // body lines so it still represents a genuinely leaked key, not the isolated-hash-mention false
  // positive that check now avoids (real PEM bodies always wrap across multiple lines).
  const privateKey = [
    ['-----BEGIN', ' OPENSSH', ' PRIVATE', ' KEY-----'].join(''),
    'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW',
    'QyNTUxOQAAACBAK7lPGmhO8IldsRUyq9Pm3iM3EudNQhwFsA0O0iL4dQAAAJhwZXJzaXN0',
  ].join('\n');
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

test('FALSIFICACIÓN · a secret hidden in a template literal (backtick), with or without interpolation, blocks like plain-quoted secrets already did', () => {
  const bare = `${'to' + 'ken'} = \`sk_test_ABCDEFGH12345678901234\`;`;
  assert.deepEqual(scanFile('src/a.js', bare).map((item) => item.category), ['hardcoded-secret']);
  const interpolated = `${'to' + 'ken'} = \`Bearer \${prefix}ABCDEFGH12345678901234\`;`;
  assert.deepEqual(scanFile('src/a.js', interpolated).map((item) => item.category), ['hardcoded-secret']);
  // Parity with the pre-existing quote behavior: a short backtick value below the 8-char
  // lookahead is not flagged, same as a short single/double-quoted value never was.
  const short = `${'to' + 'ken'} = \`short\`;`;
  assert.deepEqual(scanFile('src/a.js', short), []);
});

test('FALSIFICACIÓN · a direct/bare HTML-sink assignment blocks, while a static literal with no dynamic data does not', () => {
  assert.deepEqual(scanFile('src/view.mjs', `${[...'inner'].join('')}${[...'HTML'].join('')} = userInput;`).map((item) => item.category), ['html-injection-surface']);
  assert.deepEqual(scanFile('src/view.mjs', `${[...'outer'].join('')}${[...'HTML'].join('')} = data;`).map((item) => item.category), ['html-injection-surface']);
  const jsxSink = `${'dangerously' + 'SetInnerHTML'}={{__html: userInput}}`;
  assert.deepEqual(scanFile('src/App.jsx', jsxSink).map((item) => item.category), ['html-injection-surface']);
  // Static literals — no dynamic data reaches the sink — must not block.
  assert.deepEqual(scanFile('src/view.mjs', `${[...'inner'].join('')}${[...'HTML'].join('')} = "<b>static</b>";`), []);
  assert.deepEqual(scanFile('src/view.mjs', `${[...'inner'].join('')}${[...'HTML'].join('')} = "a, b, c";`), [], 'a comma inside a static string must not truncate the value and misclassify it as dynamic');
  assert.deepEqual(scanFile('src/view.mjs', `${[...'inner'].join('')}${[...'HTML'].join('')} = \`<b>static</b>\`;`), []);
  const jsxStatic = `${'dangerously' + 'SetInnerHTML'}={{__html: "<b>static</b>"}}`;
  assert.deepEqual(scanFile('src/App.jsx', jsxStatic), []);
  // Concatenation (already covered before this fix) must still block, and must still capture
  // the FULL dynamic expression rather than stopping at the first quoted segment.
  const concatSink = `${[...'inner'].join('')}${[...'HTML'].join('')} = 'x' + userInput;`;
  assert.deepEqual(scanFile('src/view.mjs', concatSink).map((item) => item.category), ['html-injection-surface']);
});

test('FALSIFICACIÓN · github.event interpolation inside a YAML block-scalar run: | or run: > body blocks, indentation-scoped to that step only', () => {
  const pipeBlock = [
    'on:', '  pull_request_target:', 'jobs:', '  x:', '    steps:',
    '      - run: |', '          echo "${{ github.event.issue.title }}"', '      - run: echo done', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/pipe.yml', pipeBlock).map((item) => item.category), ['ci-untrusted-trigger', 'ci-expression-in-run']);
  const foldBlock = [
    'on:', '  pull_request_target:', 'jobs:', '  x:', '    steps:',
    '      - run: >', '          echo "${{ github.event.pull_request.title }}"', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/fold.yml', foldBlock).map((item) => item.category), ['ci-untrusted-trigger', 'ci-expression-in-run']);
  // Indentation-scoped: the expression sits in the NEXT step's inline run, not inside the first
  // step's block body — it must still be found (block ends at the sibling `- run:` line), and
  // its own location must be its own line, not swallowed into the prior block's scan.
  const nextStepOnly = [
    'jobs:', '  x:', '    steps:',
    '      - run: |', '          echo safe', '      - run: echo ${{ github.event.issue.title }}', '',
  ].join('\n');
  const nextStepFindings = scanFile('.github/workflows/next.yml', nextStepOnly);
  assert.deepEqual(nextStepFindings.map((item) => item.category), ['ci-expression-in-run']);
  assert.equal(nextStepFindings[0].location, '.github/workflows/next.yml:6');
  // A block body with no github.event reference must not block.
  const safeBlock = ['jobs:', '  x:', '    steps:', '      - run: |', '          echo hello', '          echo world', ''].join('\n');
  assert.deepEqual(scanFile('.github/workflows/safe-block.yml', safeBlock), []);
  // A plain inline run: with no github.event at all (exercises the inline non-matching branch).
  const plainInline = ['jobs:', '  x:', '    steps:', '      - run: echo hello', ''].join('\n');
  assert.deepEqual(scanFile('.github/workflows/plain.yml', plainInline), []);
});

test('extractAssignmentValue handles an escaped quote inside an HTML-sink string literal without ending the value early', () => {
  const escaped = `${[...'inner'].join('')}${[...'HTML'].join('')} = "a\\"b, still one string";`;
  assert.deepEqual(scanFile('src/view.mjs', escaped), [], 'an escaped quote must not be treated as the string terminator');
  // A trailing backslash with no following character (content ends mid-escape) must not throw.
  const truncated = `${[...'inner'].join('')}${[...'HTML'].join('')} = "a\\`;
  assert.doesNotThrow(() => scanFile('src/view.mjs', truncated));
});

test('FALSIFICACIÓN · a bare PEM header quoted in documentation prose does not block, but the same header with real key material still does', () => {
  // Fragmented with `+`, same convention as the rest of this file (see DYNAMIC_TERMS/SQL_TERMS
  // in verify-security-baseline.mjs), so this test file's own literal source text never contains
  // the contiguous BEGIN/PRIVATE-KEY-with-body shape the live gate scans for.
  const header = '-----BEGIN' + ' PRIVATE KEY-----';
  const body1 = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj';
  const body2 = 'Q2VydFRlc3RTZWNyZXRLZXlNYXRlcmlhbEZvclZDUFRlc3RGaXh0dXJlWFlaMTIz';
  const footer = '-----END' + ' PRIVATE KEY-----';

  const prose = `Our redactor masks PEM blocks like \`${header}\` before logging errors.\n`;
  assert.deepEqual(scanFile('docs/notes.md', prose), []);

  const realKey = [header, body1, body2, footer, ''].join('\n');
  assert.deepEqual(scanFile('leaked/key.txt', realKey).map((item) => item.category), ['private-key-content']);

  // A header immediately followed by two consecutive base64-shaped body lines, even without an
  // END marker in the scanned window, still counts as real key material (real PEM bodies always
  // wrap across multiple lines).
  const bodyOnly = [header, body1, body2, ''].join('\n');
  assert.deepEqual(scanFile('leaked/key2.txt', bodyOnly).map((item) => item.category), ['private-key-content']);
});

test('FALSIFICACIÓN · an isolated hash/id line next to a documented PEM header does not block, but multi-line body or a footer still does', () => {
  const header = '-----BEGIN' + ' PRIVATE KEY-----';
  const footer = '-----END' + ' PRIVATE KEY-----';
  const body1 = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj';
  const body2 = 'Q2VydFRlc3RTZWNyZXRLZXlNYXRlcmlhbEZvclZDUFRlc3RGaXh0dXJlWFlaMTIz';

  // 1. header + nearby SHA-1 hash (40 lowercase hex chars) — allowed.
  const sha1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  assert.deepEqual(scanFile('docs/a.md', [`See \`${header}\` (commit`, sha1, ')'].join('\n')), []);

  // 2. header + nearby SHA-256 hash (64 lowercase hex chars) — allowed.
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'.slice(0, 64);
  assert.deepEqual(scanFile('docs/b.md', [`See \`${header}\` (digest`, sha256, ')'].join('\n')), []);

  // 3. header + one isolated alphanumeric identifier line — allowed.
  const isolatedId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  assert.deepEqual(scanFile('docs/c.md', [`\`${header}\` id:`, isolatedId, ''].join('\n')), []);

  // 4. header + real multi-line PEM body (no footer) — blocked.
  assert.deepEqual(scanFile('leaked/d.txt', [header, body1, body2, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // 5. header + real footer — blocked, even with only a single body line in between.
  assert.deepEqual(scanFile('leaked/e.txt', [header, body1, footer, ''].join('\n')).map((item) => item.category), ['private-key-content']);
  assert.deepEqual(scanFile('leaked/f.txt', [header, footer, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // 6. the exact research/sources/paperclip.md false positive shape (header quoted in prose,
  // describing what a redactor looks for, no body/footer nearby) — still allowed.
  const paperclipShape = [
    '  pasa el error por `redact()` (`:93-98`, que además detecta y enmascara bloques PEM',
    `  \`${header}\`) antes de devolverlo al modelo — un secreto que se cuela en`,
    '  un mensaje de error nunca llega al transcript.',
    '',
  ].join('\n');
  assert.deepEqual(scanFile('research/sources/paperclip.md', paperclipShape), []);

  // 7. secrets, SQL, dynamic HTML and dangerous GitHub Actions already covered elsewhere in this
  // file keep blocking — spot-checked here since this test targets the same detector module.
  assert.deepEqual(scanFile('a.js', `const apiKey = \`${'sk_test_' + 'ABCDEFGH12345678901234'}\`;`).map((item) => item.category), ['hardcoded-secret']);
  assert.deepEqual(scanFile('db.mjs', `const q = "${'SEL' + 'ECT'} * FROM users WHERE id=" + userId;`).map((item) => item.category), ['injection-surface']);
  assert.deepEqual(scanFile('a.js', `el.${[...'inner'].join('')}${[...'HTML'].join('')} = userInput;`).map((item) => item.category), ['html-injection-surface']);
  const unsafeWorkflow = [
    'on:', '  pull_request_target:', 'jobs:', '  x:', '    steps:',
    '      - run: |', '          echo "${{ github.event.issue.title }}"', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/x.yml', unsafeWorkflow).map((item) => item.category), ['ci-untrusted-trigger', 'ci-expression-in-run']);
});

test('FALSIFICACIÓN · a blank line breaks the consecutive-base64-line streak, so two unrelated tokens near a documented PEM header do not block', () => {
  const header = '-----BEGIN' + ' PRIVATE KEY-----';
  const footer = '-----END' + ' PRIVATE KEY-----';
  const body1 = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj';
  const body2 = 'Q2VydFRlc3RTZWNyZXRLZXlNYXRlcmlhbEZvclZDUFRlc3RGaXh0dXJlWFlaMTIz';

  // 1. two REAL, physically consecutive base64 body lines — blocks.
  assert.deepEqual(scanFile('leaked/a.txt', [header, body1, body2, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // 2. two unrelated base64-shaped tokens separated by a blank line — no longer blocks (the
  // confirmed false positive this fix closes: a blank paragraph break means they are not a
  // contiguous PEM body).
  const unrelatedToken1 = 'CommitAbcDefGhiJklMnoPqrStuVwxYz01234';
  const unrelatedToken2 = 'AnotherUnrelatedIdentifierValueHereABC';
  assert.deepEqual(scanFile('docs/g.md', [header, unrelatedToken1, '', unrelatedToken2, ''].join('\n')), []);

  // 3. header + footer alone — still blocks.
  assert.deepEqual(scanFile('leaked/b.txt', [header, footer, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // 4. the real paperclip.md false-positive shape — still allowed.
  const paperclipShape = [
    '  pasa el error por `redact()` (`:93-98`, que además detecta y enmascara bloques PEM',
    `  \`${header}\`) antes de devolverlo al modelo — un secreto que se cuela en`,
    '  un mensaje de error nunca llega al transcript.',
    '',
  ].join('\n');
  assert.deepEqual(scanFile('research/sources/paperclip.md', paperclipShape), []);

  // 5. secret in backtick, dynamic HTML, and multi-line GitHub Actions still block.
  assert.deepEqual(scanFile('a.js', `const apiKey = \`${'sk_test_' + 'ABCDEFGH12345678901234'}\`;`).map((item) => item.category), ['hardcoded-secret']);
  assert.deepEqual(scanFile('a.js', `el.${[...'inner'].join('')}${[...'HTML'].join('')} = userInput;`).map((item) => item.category), ['html-injection-surface']);
  const unsafeWorkflow2 = [
    'on:', '  pull_request_target:', 'jobs:', '  x:', '    steps:',
    '      - run: >', '          echo "${{ github.event.pull_request.title }}"', '',
  ].join('\n');
  assert.deepEqual(scanFile('.github/workflows/y.yml', unsafeWorkflow2).map((item) => item.category), ['ci-untrusted-trigger', 'ci-expression-in-run']);
});

test('FALSIFICACIÓN · two physically consecutive but unrelated non-hex tokens no longer block — the first candidate line must decode to a real key encoding (DER SEQUENCE or OpenSSH magic)', () => {
  const header = '-----BEGIN' + ' PRIVATE KEY-----';
  const opensshHeader = ['-----BEGIN', ' OPENSSH', ' PRIVATE', ' KEY-----'].join('');
  const derBody1 = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj';
  const derBody2 = 'Q2VydFRlc3RTZWNyZXRLZXlNYXRlcmlhbEZvclZDUFRlc3RGaXh0dXJlWFlaMTIz';
  const opensshBody1 = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW';
  const opensshBody2 = 'QyNTUxOQAAACBAK7lPGmhO8IldsRUyq9Pm3iM3EudNQhwFsA0O0iL4dQAAAJhwZXJzaXN0';

  // No longer blocks: two consecutive, unrelated, non-hex 20+ char tokens whose decoded bytes
  // are NOT a real key encoding (this is the L01 residual — physically consecutive, no blank
  // line between them, previously enough to trigger on line-shape alone).
  const unrelated1 = 'CommitAbcDefGhiJklMnoPqrStuVwxYz01234';
  const unrelated2 = 'AnotherUnrelatedIdentifierValueHereABC';
  assert.deepEqual(scanFile('docs/h.md', [header, unrelated1, unrelated2, ''].join('\n')), []);

  // Still blocks: a real DER-encoded key (PKCS#8/PKCS#1/EC — outer ASN.1 SEQUENCE, tag 0x30).
  assert.deepEqual(scanFile('leaked/c.txt', [header, derBody1, derBody2, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // Still blocks: a real OpenSSH-format key (`openssh-key-v1\0` magic bytes) — this format is
  // NOT ASN.1/DER, so a DER-only replacement would have missed it; kept as an additional
  // accepted encoding precisely to avoid that false negative.
  assert.deepEqual(scanFile('leaked/d.txt', [opensshHeader, opensshBody1, opensshBody2, ''].join('\n')).map((item) => item.category), ['private-key-content']);

  // Still blocks: a DER SEQUENCE using the SHORT-form length encoding (length byte < 0x80),
  // not just the long-form encoding the other fixtures above happen to use.
  const shortFormDer = 'MA0BAgMEBQYHCAkKCwwN'; // 0x30 0x0d ... — SEQUENCE, length 13, short form
  assert.deepEqual(scanFile('leaked/e.txt', [header, shortFormDer, derBody2, ''].join('\n')).map((item) => item.category), ['private-key-content']);
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
