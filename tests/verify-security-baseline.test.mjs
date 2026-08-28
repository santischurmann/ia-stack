import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-security-baseline.mjs');
const {
  MAX_SCANNABLE_BYTES, SECURITY_BASELINE_SCHEMA, USAGE,
  changedFiles, findingId, isProjectRelativePath, main, readSecurityBaseline, scanChangedFiles, scanFile,
} = await import(pathToFileURL(gate).href);

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

// Title reworded ("errors" -> "failures") only to dodge a detector collision, not to change what
// this test proves: SYNTAX_SIGNAL in scripts/verify-red-node.mjs matches the literal text
// "collection error" anywhere in the raw TAP output, and a test TITLE lands in that output — so
// the old title made every legitimate RED on this file report as a parse/load failure. Same repo
// convention as the fragmented literals above, which keep the security scanner from matching its
// own fixtures. Assertions below are untouched.
test('safe changed code passes; CLI rejects bad usage and source-collection failures', () => {
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

// --- T02 · baseline de deuda aceptada (AC5-AC7) ------------------------------------------------
// Fixture literals stay fragmented with `+` (same convention as the rest of this file and as
// DYNAMIC_TERMS in the gate itself) so this test file never trips the live scanner on its own text.

const BASELINE_PATH = 'contracts/security-baseline.json';
const EVAL_SOURCE = `${'ev' + 'al'}(userInput);\n`;
const SECRET_SOURCE = `const ${'api' + 'Key'} = 'abcdefghijklmno';\n`;
const CLEAN_SOURCE = 'export const clean = true;\n';
const REVIEWED_REASON = 'Deuda revisada el 2026-08-27, el valor es un literal interno del gate y nunca entrada externa.';

/**
 * Oracle for the finding_id contract, hashed straight from node:crypto. Expectations are NEVER
 * built by calling findingId(): a test that generated and verified with the same function would be
 * self-consistent even if that function were wrong, and would prove nothing.
 */
function sha256Id(category, path, evidence) {
  return createHash('sha256').update(`${category}\n${path}\n${evidence}`).digest('hex');
}

/** The real finding the scanner produces, so no test hardcodes the evidence wording. */
function onlyFinding(path, content) {
  const findings = scanFile(path, content);
  assert.equal(findings.length, 1, `the fixture must produce exactly one finding: ${JSON.stringify(findings)}`);
  return findings[0];
}

/**
 * A well-formed entry. The finding_id is DERIVED from this entry's own category/path/evidence with
 * the local oracle, because the gate now requires the two to agree: an id that does not hash its
 * own declared fields is a record that lies about what it covers (see the self-consistency test
 * below). An explicit `finding_id` override still wins, so the malformed-id cases stay expressible.
 */
function acceptedEntry(overrides = {}) {
  const entry = {
    category: 'injection-surface',
    path: 'src/run.js',
    evidence: 'dynamic execution or string-built SQL',
    reason: REVIEWED_REASON,
    accepted_by: 'santischurmann',
    accepted_at: '2026-08-27',
    ...overrides,
  };
  return { finding_id: sha256Id(entry.category, entry.path, entry.evidence), ...entry };
}

/** A baseline entry that really identifies the single finding `content` produces at `path`. */
function acceptedFinding(path, content) {
  const item = onlyFinding(path, content);
  return acceptedEntry({ finding_id: sha256Id(item.category, path, item.evidence), category: item.category, path, evidence: item.evidence });
}

function writeBaseline(root, accepted) {
  write(root, BASELINE_PATH, `${JSON.stringify({ schema: SECURITY_BASELINE_SCHEMA, accepted }, null, 2)}\n`);
  return BASELINE_PATH;
}

function readerFor(accepted, schema = SECURITY_BASELINE_SCHEMA) {
  return () => JSON.stringify({ schema, accepted });
}

function expectError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

test('findingId identifica un hallazgo por categoría, path y evidencia — el número de línea no participa', () => {
  const item = onlyFinding('src/run.js', EVAL_SOURCE);
  const expected = sha256Id(item.category, 'src/run.js', item.evidence);
  assert.equal(findingId(item), expected);
  assert.match(findingId(item), /^[0-9a-f]{64}$/u);
  // Insertar líneas arriba mueve el hallazgo sin cambiarlo: si la línea formara parte del
  // identificador, cualquier edición inocente invalidaría el baseline entero.
  const moved = onlyFinding('src/run.js', `${'// padding\n'.repeat(40)}${EVAL_SOURCE}`);
  assert.equal(item.location, 'src/run.js:1');
  assert.equal(moved.location, 'src/run.js:41');
  assert.equal(findingId(moved), expected);
});

test('FALSIFICACIÓN · otra categoría, otro archivo u otra evidencia dan otro finding_id: el baseline no absorbe un hallazgo mutado', () => {
  const base = { severity: 'high', category: 'injection-surface', location: 'src/run.js:12', evidence: 'dynamic execution or string-built SQL' };
  assert.equal(findingId(base), sha256Id(base.category, 'src/run.js', base.evidence));
  assert.equal(findingId({ ...base, category: 'template-sql-injection-surface' }), sha256Id('template-sql-injection-surface', 'src/run.js', base.evidence));
  assert.equal(findingId({ ...base, location: 'src/other.js:12' }), sha256Id(base.category, 'src/other.js', base.evidence));
  assert.equal(findingId({ ...base, evidence: 'template-literal SQL interpolation' }), sha256Id(base.category, 'src/run.js', 'template-literal SQL interpolation'));
  const distinct = new Set([base, { ...base, category: 'otra' }, { ...base, location: 'src/otro.js:12' }, { ...base, evidence: 'otra' }].map((item) => findingId(item)));
  assert.equal(distinct.size, 4, 'cada dimensión de la identidad tiene que cambiar el hash');
});

test('readSecurityBaseline acepta un documento bien formado y devuelve las entradas revisadas', () => {
  assert.equal(SECURITY_BASELINE_SCHEMA, 'vcp.security-baseline/1');
  const entries = [acceptedEntry(), acceptedEntry({ path: 'scripts/otro.mjs' })];
  assert.deepEqual(readSecurityBaseline(readerFor(entries)), entries);
  assert.deepEqual(readSecurityBaseline(readerFor([])), []);
});

test('FALSIFICACIÓN · readSecurityBaseline rechaza un baseline ilegible, sin schema o sin lista: un archivo roto nunca es "sin baseline"', () => {
  // A diferencia de readExclusions, la ausencia NO es "cero entradas aceptadas": --baseline lo pidió
  // explícitamente, así que degradar en silencio convertiría un error de configuración en un bypass.
  // La causa original tiene que sobrevivir: un permiso denegado no es lo mismo que un path mal escrito.
  const failing = (code) => () => readSecurityBaseline(() => { throw Object.assign(new Error(`${code}: lectura fallida`), { code }); });
  expectError(failing('ENOENT'), /ENOENT/u);
  expectError(failing('EACCES'), /EACCES/u);
  expectError(() => readSecurityBaseline(() => '{'), /JSON/iu);
  for (const shape of ['[]', 'null', '"texto"', '12']) {
    expectError(() => readSecurityBaseline(() => shape), /schema/iu);
  }
  expectError(() => readSecurityBaseline(readerFor([], 'vcp.security-baseline/2')), /schema/iu);
  expectError(() => readSecurityBaseline(() => JSON.stringify({ schema: SECURITY_BASELINE_SCHEMA })), /accepted/iu);
  expectError(() => readSecurityBaseline(() => JSON.stringify({ schema: SECURITY_BASELINE_SCHEMA, accepted: {} })), /accepted/iu);
});

test('FALSIFICACIÓN · readSecurityBaseline exige las siete claves exactas y un finding_id de 64 hex minúscula', () => {
  const one = (entry) => () => readSecurityBaseline(readerFor([entry]));
  expectError(one({ ...acceptedEntry(), extra: 1 }), /exactly/iu);
  const withoutDate = Object.fromEntries(Object.entries(acceptedEntry()).filter(([key]) => key !== 'accepted_at'));
  expectError(one(withoutDate), /exactly/iu);
  for (const shape of ['texto', null, [], 7]) {
    expectError(one(shape), /exactly/iu);
  }
  // Un id en mayúscula o de largo distinto no es "el mismo hallazgo escrito raro": es una entrada
  // que nunca va a coincidir con un hallazgo real y quedaría muerta desde el día uno.
  for (const malformed of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(63)}g`]) {
    expectError(one(acceptedEntry({ finding_id: malformed })), /finding_id/u);
  }
});

test('FALSIFICACIÓN · readSecurityBaseline exige razón real, responsable, fecha YYYY-MM-DD y ningún finding_id repetido', () => {
  const one = (entry) => () => readSecurityBaseline(readerFor([entry]));
  for (const reason of ['tbd', 'todo', 'n/a', 'none', 'unknown', '-', 'corto']) {
    expectError(one(acceptedEntry({ reason })), /reason/iu);
  }
  for (const date of ['2026-8-27', '27-08-2026', '2026-08-27T00:00:00Z', '2026/08/27']) {
    expectError(one(acceptedEntry({ accepted_at: date })), /accepted_at/u);
  }
  for (const field of ['category', 'path', 'evidence', 'accepted_by']) {
    expectError(one(acceptedEntry({ [field]: '' })), new RegExp(`exactly|${field}`, 'iu'));
  }
  const twice = [acceptedEntry(), acceptedEntry({ accepted_by: 'otra persona' })];
  expectError(() => readSecurityBaseline(readerFor(twice)), /duplicat/iu);
});

test('FALSIFICACIÓN · AC5 · un hallazgo Critical/High aceptado en el baseline no bloquea, y sin --baseline el gate bloquea exactamente como antes', () => {
  const root = fixture();
  try {
    write(root, 'src/run.js', EVAL_SOURCE);
    // Restricción del spec: ningún gate cambia el default de otro. Sin --baseline nada cambia.
    const withoutBaseline = check(root);
    assert.equal(withoutBaseline.status, 1, withoutBaseline.output);
    assert.match(withoutBaseline.output, /HIGH injection-surface src\/run\.js:1/u);

    const path = writeBaseline(root, [acceptedFinding('src/run.js', EVAL_SOURCE)]);
    const accepted = check(root, '--baseline', path);
    assert.equal(accepted.status, 0, accepted.output);
    // El OK tiene que decir cuánta deuda tapó: un baseline silencioso esconde su propio tamaño.
    assert.match(accepted.output, /\b1 accepted\b/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · AC6 · un hallazgo Critical/High ausente del baseline bloquea aunque otro hallazgo del mismo escaneo esté aceptado', () => {
  const root = fixture();
  try {
    write(root, 'src/run.js', EVAL_SOURCE);
    write(root, 'src/leak.js', SECRET_SOURCE);
    const path = writeBaseline(root, [acceptedFinding('src/run.js', EVAL_SOURCE)]);
    const result = check(root, '--baseline', path);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /CRITICAL hardcoded-secret src\/leak\.js:1/u);
    // El conteo cuenta lo que bloquea, no lo aceptado: si dijera 2, el baseline no filtró nada.
    assert.match(result.output, /REJECTED: 1 blocking security finding/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · AC7 · una entrada del baseline sin hallazgo real en un archivo escaneado bloquea: la deuda muerta esconde cuánto se está tapando', () => {
  const root = fixture();
  try {
    write(root, 'src/clean.js', CLEAN_SOURCE);
    // Entrada internamente consistente (su id es el hash de sus propios campos) pero sin hallazgo
    // vivo detrás: src/clean.js sí se escanea y nunca produce ese id.
    const dead = acceptedEntry({ path: 'src/clean.js', finding_id: sha256Id('injection-surface', 'src/clean.js', 'dynamic execution or string-built SQL') });
    const result = check(root, '--baseline', writeBaseline(root, [dead]));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /src\/clean\.js/u);
    assert.match(result.output, /REJECTED[^\n]*baseline/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · AC7 · una entrada del baseline cuyo archivo quedó fuera del escaneo no se reporta muerta: sin escanearlo no hay evidencia para juzgarla', () => {
  const root = fixture();
  try {
    // legacy/old.js queda commiteado y limpio: no aparece en el delta contra la base, así que el
    // escáner nunca lo mira y no puede saber si su hallazgo sigue vivo.
    write(root, 'legacy/old.js', EVAL_SOURCE);
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'deuda heredada');
    write(root, 'src/clean.js', CLEAN_SOURCE);
    const result = check(root, '--baseline', writeBaseline(root, [acceptedFinding('legacy/old.js', EVAL_SOURCE)]));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /^OK:/mu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un --baseline inexistente o mal formado bloquea: nunca degrada en silencio a un escaneo sin baseline', () => {
  const root = fixture();
  try {
    write(root, 'src/clean.js', CLEAN_SOURCE);
    // El mismo árbol pasa sin la bandera: lo único que cambia es el archivo de baseline roto.
    assert.equal(check(root).status, 0);
    const missing = check(root, '--baseline', BASELINE_PATH);
    assert.equal(missing.status, 1, missing.output);
    assert.doesNotMatch(missing.output, /^OK:/mu);
    write(root, BASELINE_PATH, '{\n');
    const malformed = check(root, '--baseline', BASELINE_PATH);
    assert.equal(malformed.status, 1, malformed.output);
    assert.doesNotMatch(malformed.output, /^OK:/mu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · --baseline exige su archivo: las formas incompletas son uso inválido, no un escaneo sin baseline', () => {
  const root = fixture();
  try {
    write(root, 'src/clean.js', CLEAN_SOURCE);
    const path = writeBaseline(root, []);
    const cli = (args) => main(args, { cwd: root, write: () => {}, writeError: () => {} });
    assert.match(USAGE, /--baseline/u, 'el usage tiene que documentar la bandera nueva');
    assert.equal(cli(['check', '--baseline']), 2);
    assert.equal(cli(['check', '--baseline', '']), 2);
    assert.equal(cli(['check', '--baseline', path, 'extra']), 2);
    assert.equal(cli(['check', '--baseline', path]), 0);
    assert.equal(cli(['check', '--base', 'HEAD', '--baseline', path]), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- T02 · TRIANGULATE: bordes, negativos y contratos del baseline -----------------------------
// Cada bloque de abajo salió de un agujero o de un borde REPRODUCIDO primero con el CLI real sobre
// un repo Git temporal, no de leer el código. Los ids esperados se arman siempre con sha256Id (el
// oráculo local); nunca llamando a findingId, que es justamente la función bajo prueba.

const SECRET_EVIDENCE = 'credential-like assignment (value redacted)';
const OTHER_SECRET_SOURCE = `const ${'pass' + 'word'} = 'produccion-real-123';\n`;
const WORKFLOW_PATH = '.github/workflows/release.yml';

function workflowWith(...actions) {
  return ['jobs:', '  x:', '    steps:', ...actions.map((action) => `      - uses: ${action}`), ''].join('\n');
}

/** The entry that truthfully accepts one specific finding object produced by the scanner. */
function entryFor(item) {
  const path = item.location.replace(/:\d+$/u, '');
  return acceptedEntry({ finding_id: sha256Id(item.category, path, item.evidence), category: item.category, path, evidence: item.evidence });
}

test('FALSIFICACIÓN · el finding_id tiene que hashear su propia entrada: un id real con categoría, path y evidencia inventados ya no silencia el hallazgo ni esquiva la caducidad', () => {
  // AGUJERO REPRODUCIDO. Antes de este chequeo los cuatro campos legibles eran decorativos: una
  // entrada podía llevar el id real de un CRITICAL vivo y describirse como una tarea vieja de CI en
  // otro archivo que nunca se escanea. Eso tapaba el hallazgo (exit 0) Y esquivaba AC7 para siempre,
  // porque la deuda muerta se juzga por el path DECLARADO. Nada en el archivo ni en la salida decía
  // qué se estaba tapando en realidad.
  const one = (entry) => () => readSecurityBaseline(readerFor([entry]));
  expectError(one(acceptedEntry({ finding_id: 'a'.repeat(64) })), /does not match its own/iu);
  expectError(one(acceptedEntry({ finding_id: sha256Id('otra-categoria', 'src/run.js', 'dynamic execution or string-built SQL') })), /does not match/iu);
  // El path canónico es el POSIX: un id hasheado desde la escritura con barra invertida no coincide.
  expectError(one(acceptedEntry({ path: 'src\\run.js', finding_id: sha256Id('injection-surface', 'src\\run.js', 'dynamic execution or string-built SQL') })), /does not match/iu);
  // La entrada honesta sigue pasando. Y el path se canonicaliza a "/" ANTES de hashear, así que la
  // escritura con barra invertida es la misma entrada siempre que su id sea el del path canónico.
  assert.equal(readSecurityBaseline(readerFor([acceptedEntry()]))[0].path, 'src/run.js');
  const windowsSpelling = acceptedEntry({
    path: 'src\\run.js',
    finding_id: sha256Id('injection-surface', 'src/run.js', 'dynamic execution or string-built SQL'),
  });
  assert.equal(readSecurityBaseline(readerFor([windowsSpelling]))[0].path, 'src/run.js');

  const root = fixture();
  try {
    // legacy/old.js queda commiteado y limpio: es el archivo fuera del escaneo con el que la
    // entrada mentirosa se volvía inmortal.
    write(root, 'legacy/old.js', CLEAN_SOURCE);
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'legacy');
    write(root, 'src/prod.js', SECRET_SOURCE);
    const live = onlyFinding('src/prod.js', SECRET_SOURCE);
    assert.equal(live.severity, 'critical');

    const lying = acceptedEntry({
      finding_id: sha256Id(live.category, 'src/prod.js', live.evidence), // el id REAL del hallazgo vivo
      category: 'ci-unpinned-action',                                    // mentira
      path: 'legacy/old.js',                                             // mentira, y nunca escaneado
      evidence: 'accion de CI sin pinear, revisada hace anios',          // mentira
    });
    const covered = check(root, '--baseline', writeBaseline(root, [lying]));
    assert.equal(covered.status, 1, covered.output);
    assert.match(covered.output, /does not match its own/iu);
    assert.doesNotMatch(covered.output, /^OK:/mu);

    // La misma entrada honesta sí tapa el hallazgo: lo que se rechaza es la mentira, no la deuda.
    const honest = check(root, '--baseline', writeBaseline(root, [entryFor(live)]));
    assert.equal(honest.status, 0, honest.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un salto de línea dentro de category, path o evidence corre la frontera entre campos: dos identidades distintas colisionaban en el mismo hash', () => {
  // AGUJERO REPRODUCIDO (colisión de hash, verificada con el oráculo). La identidad une los tres
  // campos con "\n", así que un campo que CONTIENE "\n" mueve la frontera. En un filesystem donde un
  // nombre de archivo puede tener un salto de línea (POSIX sí), la entrada de abajo es
  // autoconsistente y aun así MUESTRA un path distinto del que tapa — y ese path mostrado nunca se
  // escanea, o sea que tampoco podía caducar. Se cierra prohibiendo el separador en los tres campos
  // hasheados; `reason` queda libre porque es prosa y no entra al hash.
  const evidence = 'credential-like assignment (value redacted)';
  const real = sha256Id('hardcoded-secret', 'a\npriv.js', evidence);
  const shifted = sha256Id('hardcoded-secret', 'a', `priv.js\n${evidence}`);
  assert.equal(real, shifted, 'la colisión es el agujero: mismo hash, frontera de campos corrida');

  const one = (entry) => () => readSecurityBaseline(readerFor([entry]));
  expectError(one(acceptedEntry({ category: 'hardcoded-secret', path: 'a', evidence: `priv.js\n${evidence}` })), /line break/iu);
  expectError(one(acceptedEntry({ category: 'hardcoded-secret', path: 'a\npriv.js', evidence })), /line break/iu);
  expectError(one(acceptedEntry({ category: 'inject\nion-surface' })), /line break/iu);
  expectError(one(acceptedEntry({ evidence: 'algo\r\nmas' })), /line break/iu);
  // `reason` multilínea sigue siendo válida: no participa de la identidad.
  const multiline = acceptedEntry({ reason: `${REVIEWED_REASON}\nSegunda línea del análisis del revisor.` });
  assert.equal(readSecurityBaseline(readerFor([multiline]))[0].reason, multiline.reason);
});

test('FALSIFICACIÓN · dos acciones sin pinear en el mismo workflow son dos hallazgos distintos: aceptar la revisada no acepta la que se agregue después', () => {
  // AGUJERO REPRODUCIDO. ci-unpinned-action es el único detector que emite más de un hallazgo por
  // archivo, y su evidencia era una constante: categoría + path + evidencia daban el MISMO id para
  // todas. Aceptar actions/checkout@main aceptaba en silencio cualquier acción agregada después a
  // ese workflow. La referencia de la acción es metadato público (ya se imprime en el reporte), así
  // que nombrarla distingue los hallazgos sin filtrar nada.
  const both = scanFile(WORKFLOW_PATH, workflowWith('actions/checkout@main', 'attacker-org/exfiltrate@main'));
  assert.deepEqual(both.map((item) => item.category), ['ci-unpinned-action', 'ci-unpinned-action']);
  assert.notEqual(findingId(both[0]), findingId(both[1]), 'dos acciones distintas no pueden compartir identidad');
  assert.equal(findingId(both[0]), sha256Id('ci-unpinned-action', WORKFLOW_PATH, both[0].evidence));
  assert.match(both[0].evidence, /actions\/checkout@main/u);
  assert.match(both[1].evidence, /attacker-org\/exfiltrate@main/u);

  const root = fixture();
  try {
    write(root, WORKFLOW_PATH, workflowWith('actions/checkout@main'));
    const reviewed = onlyFinding(WORKFLOW_PATH, workflowWith('actions/checkout@main'));
    const path = writeBaseline(root, [entryFor(reviewed)]);
    const accepted = check(root, '--baseline', path);
    assert.equal(accepted.status, 0, accepted.output);

    // Se agrega una segunda acción sin pinear que nadie revisó nunca.
    write(root, WORKFLOW_PATH, workflowWith('actions/checkout@main', 'attacker-org/exfiltrate@main'));
    const regression = check(root, '--baseline', path);
    assert.equal(regression.status, 1, regression.output);
    assert.match(regression.output, /attacker-org\/exfiltrate@main/u);
    assert.doesNotMatch(regression.output, /checkout@main is not pinned/u, 'la acción revisada tiene que seguir aceptada');
    assert.match(regression.output, /REJECTED: 1 blocking security finding/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · el baseline vive dentro del proyecto: una ruta absoluta, un ../ o una entrada que apunta afuera son rechazo, no deuda aceptada', () => {
  // AGUJERO REPRODUCIDO. --baseline es la ÚNICA bandera que puede aflojar el gate, y se resolvía
  // contra el cwd sin exigir contención: la deuda aceptada podía vivir fuera del árbol auditado,
  // donde ningún revisor ve el motivo, el responsable ni la fecha en un diff. Y una entrada cuyo
  // path apunta afuera nunca se escanea, así que jamás podía caducar.
  const root = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-security-outside-baseline-'));
  try {
    write(root, 'src/prod.js', SECRET_SOURCE);
    const live = onlyFinding('src/prod.js', SECRET_SOURCE);
    const document = `${JSON.stringify({ schema: SECURITY_BASELINE_SCHEMA, accepted: [entryFor(live)] })}\n`;
    writeFileSync(join(outside, 'hidden.json'), document);

    for (const flag of [join(outside, 'hidden.json'), '../hidden.json']) {
      const escaped = check(root, '--baseline', flag);
      assert.equal(escaped.status, 1, escaped.output);
      assert.match(escaped.output, /must live inside the project/iu);
      assert.doesNotMatch(escaped.output, /^OK:/mu);
    }
    // El mismo documento adentro del proyecto sí acepta la deuda: lo que se rechaza es la ubicación.
    write(root, BASELINE_PATH, document);
    assert.equal(check(root, '--baseline', BASELINE_PATH).status, 0);

    // Una entrada autoconsistente cuyo path escapa del proyecto también se rechaza: es la forma que
    // nunca se escanea, así que la caducidad no podría juzgarla jamás.
    const evidence = 'release-surface path resolves outside the project';
    const escaping = acceptedEntry({ category: 'unsafe-scan-path', path: '../outside.js', evidence });
    expectError(() => readSecurityBaseline(readerFor([escaping])), /inside the project/iu);
    expectError(() => readSecurityBaseline(readerFor([acceptedEntry({ path: join(outside, 'x.js') })])), /inside the project/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · una bandera repetida es uso inválido: --baseline dos veces no puede elegir en silencio cuál gana', () => {
  // AGUJERO REPRODUCIDO. `--baseline empty.json --baseline good.json` descartaba el primero sin
  // decir nada y devolvía exit 0. El parser ya rechaza un `--baseline` a medio tipear con este mismo
  // argumento; dos valores contradictorios para la bandera que afloja el gate son el mismo bypass.
  const root = fixture();
  try {
    write(root, 'src/run.js', EVAL_SOURCE);
    const good = writeBaseline(root, [acceptedFinding('src/run.js', EVAL_SOURCE)]);
    write(root, 'vacio.json', `${JSON.stringify({ schema: SECURITY_BASELINE_SCHEMA, accepted: [] })}\n`);
    const cli = (args) => main(args, { cwd: root, write: () => {}, writeError: () => {} });
    assert.equal(cli(['check', '--baseline', 'vacio.json', '--baseline', good]), 2);
    assert.equal(cli(['check', '--baseline', good, '--baseline', 'vacio.json']), 2);
    assert.equal(cli(['check', '--base', 'HEAD', '--base', 'HEAD']), 2);
    // Una sola vez cada una sigue siendo uso válido, en cualquier orden.
    assert.equal(cli(['check', '--baseline', good]), 0);
    assert.equal(cli(['check', '--baseline', good, '--base', 'HEAD']), 0);
    const repeated = check(root, '--baseline', 'vacio.json', '--baseline', good);
    assert.equal(repeated.status, 2, repeated.output);
    assert.match(repeated.output, /usage:/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un baseline con accepted vacío no tapa nada y una lista larga de deuda muerta se reporta entera', () => {
  const root = fixture();
  try {
    write(root, 'src/run.js', EVAL_SOURCE);
    // accepted: [] es un baseline válido que acepta cero deuda — no es "sin baseline" ni un pase.
    const empty = check(root, '--baseline', writeBaseline(root, []));
    assert.equal(empty.status, 1, empty.output);
    assert.match(empty.output, /HIGH injection-surface src\/run\.js:1/u);

    // Muchas entradas para un mismo archivo escaneado: la viva no bloquea, y TODAS las muertas se
    // nombran. Un reporte que resumiera "hay deuda muerta" escondería cuánta.
    const live = acceptedFinding('src/run.js', EVAL_SOURCE);
    const dead = [];
    for (let i = 0; i < 250; i += 1) {
      dead.push(acceptedEntry({ path: 'src/run.js', evidence: `deuda inventada numero ${i}` }));
    }
    const result = check(root, '--baseline', writeBaseline(root, [live, ...dead]));
    assert.equal(result.status, 1, result.output.slice(0, 400));
    assert.match(result.output, /REJECTED: 250 security baseline entry\(ies\)/u);
    assert.doesNotMatch(result.output, /blocking security finding/u, 'la entrada viva sigue tapando su hallazgo');
    for (const entry of [dead[0], dead[124], dead[249]]) {
      assert.match(result.output, new RegExp(entry.finding_id, 'u'), `falta la entrada muerta ${entry.finding_id}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('la aceptación de una categoría redactada cubre el archivo entero, no un valor concreto — límite declarado del identificador', () => {
  // LÍMITE DECLARADO, no un agujero cerrado. La evidencia de las categorías de secreto está
  // redactada a propósito, así que la identidad de un hallazgo es (categoría, archivo) y nada más.
  // Consecuencia REPRODUCIDA con el CLI: aceptar un secreto de fixture en src/config.js hace que
  // cualquier OTRO secreto que aparezca después en ese mismo archivo herede la aceptación.
  // No se cierra porque el único discriminante disponible sería el propio valor del secreto, y
  // publicarlo (aunque fuera truncado y hasheado) en un archivo commiteado es peor que el límite.
  // Mitigación real: aceptar de a un archivo chico, nunca un archivo donde luego se agregan valores.
  const first = onlyFinding('src/config.js', SECRET_SOURCE);
  const second = onlyFinding('src/config.js', OTHER_SECRET_SOURCE);
  assert.notEqual(SECRET_SOURCE, OTHER_SECRET_SOURCE);
  assert.equal(first.evidence, SECRET_EVIDENCE);
  assert.equal(second.evidence, SECRET_EVIDENCE, 'la evidencia redactada no depende del valor');
  assert.equal(findingId(first), findingId(second), 'límite declarado: dos secretos distintos del mismo archivo comparten identidad');

  const root = fixture();
  try {
    write(root, 'src/config.js', SECRET_SOURCE);
    const path = writeBaseline(root, [entryFor(first)]);
    assert.equal(check(root, '--baseline', path).status, 0);
    write(root, 'src/config.js', OTHER_SECRET_SOURCE);
    const inherited = check(root, '--baseline', path);
    assert.equal(inherited.status, 0, inherited.output);
    // Control: sin baseline el segundo secreto sí es un hallazgo CRITICAL vivo — lo que lo tapa es
    // la aceptación heredada, no que el escáner haya dejado de verlo.
    const control = check(root);
    assert.equal(control.status, 1, control.output);
    assert.match(control.output, /CRITICAL hardcoded-secret src\/config\.js:1/u);
    // Y en OTRO archivo el mismo secreto no está aceptado: el límite es por archivo, no global.
    write(root, 'src/otro.js', OTHER_SECRET_SOURCE);
    const otherFile = check(root, '--baseline', path);
    assert.equal(otherFile.status, 1, otherFile.output);
    assert.match(otherFile.output, /src\/otro\.js/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el --base por defecto sólo mira el árbol vivo: lo ya commiteado sale del escaneo — límite declarado del delta', () => {
  // LÍMITE DECLARADO, no un agujero cerrado. `--base HEAD` compara HEAD...HEAD (vacío) más staged,
  // unstaged y untracked: commitear un secreto lo saca del escaneo y el gate devuelve exit 0 SIN
  // baseline de por medio. Es el diseño del delta y skills/security-baseline.md ya manda pasar
  // `--base <merge-base-or-origin/main>`, que es donde el commit sí entra. Se fija acá para que el
  // día que alguien corra el gate con el default en CI, este test diga exactamente qué se pierde.
  const root = fixture();
  try {
    write(root, 'src/prod.js', SECRET_SOURCE);
    const uncommitted = check(root);
    assert.equal(uncommitted.status, 1, uncommitted.output);
    assert.match(uncommitted.output, /CRITICAL hardcoded-secret src\/prod\.js:1/u);

    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'ship it');
    const committed = check(root);
    assert.equal(committed.status, 0, committed.output);
    assert.match(committed.output, /scanned 0 live changed file\(s\)/u);

    // Con el merge-base correcto el mismo commit vuelve a bloquear.
    const againstBase = check(root, '--base', 'HEAD~1');
    assert.equal(againstBase.status, 1, againstBase.output);
    assert.match(againstBase.output, /CRITICAL hardcoded-secret src\/prod\.js:1/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('changedFiles convierte una barra invertida del nombre en "/" y ese archivo queda sin escanear — límite declarado, sólo alcanzable fuera de Windows', () => {
  // LÍMITE DECLARADO, no reproducible de punta a punta en esta plataforma: Windows no puede crear un
  // archivo cuyo nombre contenga "\" (ENOENT verificado), así que sólo se demuestra el mecanismo con
  // la función exportada. En POSIX "evil\config.js" es un nombre legal; nulPaths lo reescribe a
  // "evil/config.js", el gate resuelve OTRA ruta, no la encuentra y la saltea EN SILENCIO — sin
  // hallazgo y sin baseline de por medio. Verificado aparte: git emite "/" en todas las plataformas
  // (git 2.55 en Windows), así que esa normalización nunca hace falta para entrada real de git.
  // Se deja declarada en vez de cerrada porque el exploit no se puede probar acá; cerrarla es sacar
  // el replaceAll de nulPaths, y ese cambio pide correrse en POSIX antes de darlo por bueno.
  assert.deepEqual(changedFiles({ gitRun: () => 'evil\\config.js\0' }), ['evil/config.js']);
  const root = fixture();
  try {
    // Lo que cuesta el colapso: en la ruta colapsada no hay nada que leer, así que ni se escanea ni
    // se reporta; en la ruta real el MISMO contenido sí es un CRITICAL.
    const collapsed = scanChangedFiles({ cwd: root, files: ['evil/config.js'] });
    assert.deepEqual(collapsed.scanned, []);
    assert.deepEqual(collapsed.skipped, [{ path: 'evil/config.js', reason: 'missing' }]);
    assert.deepEqual(collapsed.findings, []);

    write(root, 'evil/config.js', SECRET_SOURCE);
    const real = scanChangedFiles({ cwd: root, files: ['evil/config.js'] });
    assert.deepEqual(real.scanned, ['evil/config.js']);
    assert.deepEqual(real.findings.map((item) => item.severity), ['critical']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
