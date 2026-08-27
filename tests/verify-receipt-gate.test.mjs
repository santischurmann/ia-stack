import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const receiptGate = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const {
  parseRawDiff, byPath, formatEntry, isWithin, safeRegularFile,
  validateAcceptanceCriterion, validateAcceptanceCriteria, validateMeasurements,
  validateNotReviewedField, validateScope, validateReview4r, validateReceiptV2,
} = await import(pathToFileURL(receiptGate).href);

const TEST_FILE_RELATIVE = 'test/fixture.test.mjs';
const TEST_FILE_CONTENT = "import test from 'node:test';\nimport assert from 'node:assert';\ntest('x', () => assert.equal(1, 1));\n";
const TEST_FILE_SHA256 = createHash('sha256').update(TEST_FILE_CONTENT).digest('hex');

function sha256Hex(content) {
  return createHash('sha256').update(content).digest('hex');
}

function defaultReview4r() {
  return { risk: { level: 'bajo' }, readability: { verdict: 'fixed' }, reliability: { verdict: 'fixed' }, resilience: { verdict: 'no_findings' } };
}

function defaultAcceptanceCriteria() {
  return [{
    ac_id: 'AC-1', scenario: 'x equals x', verdict: 'COMPLIANT',
    test_file: TEST_FILE_RELATIVE, test_hash_sha256: TEST_FILE_SHA256,
    command: 'node --test test/fixture.test.mjs', result: '1 pass',
  }];
}

function run(command, args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `${command} could not launch: ${result.error?.message}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function git(root, ...args) {
  return run('git', args, root);
}

function gitOk(root, ...args) {
  const result = git(root, ...args);
  assert.equal(result.status, 0, `git ${args.join(' ')} failed\n${result.output}`);
  return result.output.trim();
}

function gate(root, ...args) {
  return run(process.execPath, [receiptGate, ...args], root);
}

function fixture({ sha256 = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-receipt-gate-'));
  const init = git(root, 'init', '-q', ...(sha256 ? ['--object-format=sha256'] : []));
  if (init.status !== 0) {
    rmSync(root, { recursive: true, force: true });
    return null;
  }
  gitOk(root, 'config', 'user.email', 'vcp-tests@example.invalid');
  gitOk(root, 'config', 'user.name', 'VCP receipt tests');
  writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
  writeFileSync(join(root, 'orig.txt'), 'rename baseline\n');
  writeFileSync(join(root, 'asset.bin'), Buffer.from([0x00, 0xff, 0x10, 0x80]));
  mkdirSync(join(root, 'test'), { recursive: true });
  writeFileSync(join(root, TEST_FILE_RELATIVE), TEST_FILE_CONTENT);
  gitOk(root, 'add', '-A');
  gitOk(root, 'commit', '-qm', 'baseline');
  return root;
}

function writeReceipt(root, overrides = {}) {
  const {
    schema = 'vcp.receipt/v2',
    evidence = ['node --test: 1 pass'],
    terminalState = 'approved',
    acceptanceCriteria = defaultAcceptanceCriteria(),
    reproduction = 'node --test test/fixture.test.mjs',
    notReviewed = 'none — reviewed the full declared scope',
    measurements = [],
    reviewFourR = defaultReview4r(),
    scope = { declared_paths: [TEST_FILE_RELATIVE] },
    task = 'T01',
    feature = 'receipt-fixture',
  } = overrides;
  const relative = '.vibe/receipts/fixture.json';
  const absolute = join(root, ...relative.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  const fingerprint = gate(root, 'fingerprint', relative);
  assert.equal(fingerprint.status, 0, fingerprint.output);
  // Git may emit CRLF-conversion warnings around the JSON; extract the verifier's object rather
  // than treating a Git warning as part of its machine-readable payload.
  const json = fingerprint.output.match(/\{\s*"git_head"[\s\S]*?\n\}/)?.[0];
  assert.notEqual(json, undefined, `fingerprint emitted no JSON object\n${fingerprint.output}`);
  const { git_head, tree_fingerprint } = JSON.parse(json);
  const receipt = schema === 'vcp.receipt/v1'
    ? { schema, feature, risk_level: 'low', terminal_state: terminalState, git_head, tree_fingerprint, evidence }
    : {
      schema, feature, task, scope, acceptance_criteria: acceptanceCriteria, review_4r: reviewFourR,
      measurements, reproduction, not_reviewed: notReviewed, evidence, terminal_state: terminalState,
      git_head, tree_fingerprint,
    };
  writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
  gitOk(root, 'add', '--', relative);
  return relative;
}

function withFixture(callback, options) {
  const root = fixture(options);
  assert.notEqual(root, null, 'fixture Git repository could not be initialized');
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('receipt accepts only the exact evaluated state', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'fresh receipt must pass');

    writeFileSync(join(root, 'tracked.txt'), 'staged change\n');
    gitOk(root, 'add', '--', 'tracked.txt');
    assert.equal(gate(root, 'check', receipt).status, 1, 'staged-only change must invalidate');
  });
});

test('FALSIFICACIÓN · receipt sees unstaged, binary, untracked, sibling-receipt and mode changes', () => {
  withFixture((root) => {
    let receipt = writeReceipt(root);
    writeFileSync(join(root, 'tracked.txt'), 'unstaged change\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'unstaged change must invalidate');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, 'asset.bin'), Buffer.from([0x01, 0xee, 0x10, 0x80]));
    assert.equal(gate(root, 'check', receipt).status, 1, 'binary change must invalidate');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, 'new.txt'), 'untracked\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'untracked addition must invalidate');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, '.vibe', 'receipts', 'sibling.json'), '{}\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'only the receipt itself may be excluded');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    // Git's index records executable mode even on Windows filesystems with core.filemode=false.
    chmodSync(join(root, 'tracked.txt'), 0o755);
    gitOk(root, 'update-index', '--chmod=+x', 'tracked.txt');
    assert.equal(gate(root, 'check', receipt).status, 1, 'mode-only change must invalidate');
  });
});

test('FALSIFICACIÓN · git add after a receipt invalidates the staged/unstaged state split', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'tracked.txt'), 'same bytes, initially unstaged\n');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'receipt over an unstaged state must pass');
    gitOk(root, 'add', '--', 'tracked.txt');
    assert.equal(gate(root, 'check', receipt).status, 1, 'git add without byte changes must invalidate');
  });
});

test('FALSIFICACIÓN · receipt rejects empty evidence and escalated state', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { evidence: [] });
    assert.equal(gate(root, 'check', receipt).status, 1, 'empty evidence must reject');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root, { terminalState: 'escalated' });
    assert.equal(gate(root, 'check', receipt).status, 1, 'escalated receipt must reject');
  });
});

test('FALSIFICACIÓN · check rejects malformed input before touching Git state', () => {
  withFixture((root) => {
    const relative = '.vibe/receipts/bad.json';
    const absolute = join(root, ...relative.split('/'));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, '{ not valid json');
    const result = gate(root, 'check', relative);
    assert.equal(result.status, 1, 'invalid JSON must reject');
    assert.match(result.output, /not valid JSON/);
  });
  withFixture((root) => {
    const receipt = writeReceipt(root, { terminalState: 'pending' });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'unknown terminal_state must reject');
    assert.match(result.output, /terminal_state must be approved\|escalated/);
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, 'tracked.txt'), 'new commit content\n');
    gitOk(root, 'add', '--', 'tracked.txt');
    gitOk(root, 'commit', '-qm', 'moves HEAD past the receipt');
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'stale git_head must reject');
    assert.match(result.output, /stale receipt: git_head is/);
  });
});

test('FALSIFICACIÓN · check rejects a v2 receipt missing a required field and an unrecognized schema', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const absolute = join(root, ...receipt.split('/'));
    const parsed = JSON.parse(readFileSync(absolute, 'utf8'));
    delete parsed.reproduction;
    writeFileSync(absolute, `${JSON.stringify(parsed, null, 2)}\n`);
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'missing reproduction must reject');
    assert.match(result.output, /missing required field: reproduction/);
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const absolute = join(root, ...receipt.split('/'));
    const parsed = JSON.parse(readFileSync(absolute, 'utf8'));
    parsed.schema = 'vcp.receipt/v3';
    writeFileSync(absolute, `${JSON.stringify(parsed, null, 2)}\n`);
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'unrecognized schema must reject');
    assert.match(result.output, /unknown schema: vcp\.receipt\/v3/);
  });
});

test('fingerprint sees a deleted-but-unstaged file without hashing it', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    // Deleting a tracked file leaves an unstaged `D` record whose destination path no longer
    // exists on disk — realNewSha must keep the zero placeholder (status === 'D' short-circuits
    // the gitHashObject/existsSync branch) instead of trying to hash a path that's gone.
    rmSync(join(root, 'tracked.txt'));
    assert.equal(gate(root, 'check', receipt).status, 1, 'an unstaged delete must invalidate');
  });
});

test('fingerprint sorts multiple staged and unstaged entries deterministically', () => {
  // Array.prototype.sort() never invokes its comparator on a 0- or 1-element array — this needs
  // 2+ changed paths in the SAME section (staged, then separately unstaged) to actually exercise
  // the `(a, b) => a.path < b.path ? -1 : 1` comparators instead of just trusting they're right.
  withFixture((root) => {
    writeFileSync(join(root, 'tracked.txt'), 'staged A\n');
    writeFileSync(join(root, 'orig.txt'), 'staged B\n');
    gitOk(root, 'add', '--', 'tracked.txt', 'orig.txt');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'receipt over 2 staged files must pass');
    writeFileSync(join(root, 'tracked.txt'), 'staged A changed\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'must still detect a change among many');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, 'tracked.txt'), 'unstaged A\n');
    writeFileSync(join(root, 'orig.txt'), 'unstaged B\n');
    assert.equal(gate(root, 'check', receipt).status, 1, '2 unstaged files must both be seen');
  });
});

test('fingerprint works with no exclude-path argument at all', () => {
  withFixture((root) => {
    const result = gate(root, 'fingerprint');
    assert.equal(result.status, 0, 'fingerprint with no exclude arg must still succeed');
    assert.match(result.output, /"tree_fingerprint"/);
  });
});

test('FALSIFICACIÓN · check with no receipt argument and check on a receipt that does not exist', () => {
  withFixture((root) => {
    const result = gate(root, 'check');
    assert.equal(result.status, 1, 'check with no arg must reject');
    assert.match(result.output, /usage: verify-receipt\.mjs check/);
  });
  withFixture((root) => {
    const result = gate(root, 'check', '.vibe/receipts/does-not-exist.json');
    assert.equal(result.status, 1, 'check on a nonexistent receipt path must reject');
    assert.match(result.output, /receipt not found/);
  });
});

test('sort comparator is exercised in both directions on 3+ entries', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'zzz.txt'), 'z\n');
    writeFileSync(join(root, 'aaa.txt'), 'a\n');
    gitOk(root, 'add', '--', 'tracked.txt', 'orig.txt', 'zzz.txt', 'aaa.txt');
    gitOk(root, 'commit', '-qm', 'add zzz/aaa for sort coverage');
    writeFileSync(join(root, 'zzz.txt'), 'z changed\n');
    writeFileSync(join(root, 'aaa.txt'), 'a changed\n');
    writeFileSync(join(root, 'tracked.txt'), 'tracked changed\n');
    gitOk(root, 'add', '--', 'zzz.txt', 'aaa.txt', 'tracked.txt');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, '3+ staged entries in mixed name order must still fingerprint consistently');
    writeFileSync(join(root, 'zzz.txt'), 'z changed again\n');
    writeFileSync(join(root, 'aaa.txt'), 'a changed again\n');
    assert.equal(gate(root, 'check', receipt).status, 1, '3+ unstaged entries in mixed name order must still detect a change');
  });
});

test('byPath comparator sorts both directions', () => {
  assert.equal(byPath({ path: 'a.txt' }, { path: 'b.txt' }), -1, 'a before b must return -1');
  assert.equal(byPath({ path: 'b.txt' }, { path: 'a.txt' }), 1, 'b before a must return 1');
});

test('formatEntry includes renamed-from only when the record is a rename/copy', () => {
  const plain = { path: 'x.txt', oldMode: '100644', newMode: '100644', oldSha: 'aaa', newSha: 'bbb', status: 'M', renamedFrom: null };
  assert.equal(formatEntry(plain).includes('renamed-from'), false, 'a plain edit must not carry renamed-from');
  // Real `git diff --raw` (unstaged, no -M flag) never emits an R/C record for an unstaged
  // rename — this branch is unreachable through the CLI today, so it's tested directly.
  const renamed = { path: 'new.txt', oldMode: '100644', newMode: '100644', oldSha: 'aaa', newSha: 'aaa', status: 'R', renamedFrom: 'old.txt' };
  assert.match(formatEntry(renamed), /renamed-from:old\.txt/);
});

test('parseRawDiff skips a malformed token defensively instead of misparsing it as a path', () => {
  // Real `git diff --raw -z` never emits a header that fails RAW_HEADER — this exercises the
  // defensive branch directly since we can't make git produce garbage on demand.
  const garbage = 'not-a-valid-raw-header\0';
  const wellFormed = ':100644 100644 aaaaaaa bbbbbbb M\0tracked.txt\0';
  const records = parseRawDiff(garbage + wellFormed);
  assert.deepEqual(records, [
    { oldMode: '100644', newMode: '100644', oldSha: 'aaaaaaa', newSha: 'bbbbbbb', status: 'M', path: 'tracked.txt', renamedFrom: null },
  ], 'the malformed leading token must be skipped, not misparsed as a path');
});

test('FALSIFICACIÓN · CLI with no recognized command prints usage and exits 2', () => {
  withFixture((root) => {
    const result = gate(root);
    assert.equal(result.status, 2, 'no args must exit 2');
    assert.match(result.output, /usage: verify-receipt\.mjs/);
  });
});

test('FALSIFICACIÓN · a repository with zero commits fails closed with a controlled REJECTED message, not an uncaught stack trace', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-receipt-nohead-'));
  try {
    const init = git(root, 'init', '-q');
    assert.equal(init.status, 0, init.output);
    const fingerprint = gate(root, 'fingerprint');
    assert.equal(fingerprint.status, 1);
    assert.match(fingerprint.output, /REJECTED: unable to evaluate the current repository state/);
    // A shape-valid v2 receipt (real test file, real hash, all required fields) so the check
    // actually reaches the fingerprint comparison this test targets, instead of failing earlier
    // on schema/shape — that path is covered by its own dedicated tests elsewhere in this file.
    mkdirSync(join(root, 'test'), { recursive: true });
    writeFileSync(join(root, 'test', 'x.test.mjs'), TEST_FILE_CONTENT);
    writeFileSync(join(root, 'receipt.json'), JSON.stringify({
      schema: 'vcp.receipt/v2', feature: 'x', task: 'T01',
      scope: { declared_paths: ['test/x.test.mjs'] },
      acceptance_criteria: [{
        ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: 'test/x.test.mjs',
        test_hash_sha256: TEST_FILE_SHA256, command: 'node --test', result: '1 pass',
      }],
      review_4r: defaultReview4r(), measurements: [], reproduction: 'node --test',
      not_reviewed: 'none — reviewed everything', evidence: ['x'],
      git_head: 'deadbeef', tree_fingerprint: 'x', terminal_state: 'approved',
    }));
    const check = gate(root, 'check', 'receipt.json');
    assert.equal(check.status, 1);
    assert.match(check.output, /REJECTED: unable to evaluate the current repository state/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('receipt tracks a staged rename destination and supports SHA-256 repositories when Git does', (t) => {
  withFixture((root) => {
    gitOk(root, 'mv', 'orig.txt', 'renamed.txt');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'receipt after staged rename must pass');
    writeFileSync(join(root, 'renamed.txt'), 'edited rename destination\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'post-receipt destination edit must invalidate');
  });

  const shaRoot = fixture({ sha256: true });
  if (shaRoot === null) {
    t.diagnostic('Git lacks --object-format=sha256; SHA-256 subcase skipped.');
    return;
  }
  try {
    assert.equal(gitOk(shaRoot, 'rev-parse', 'HEAD').length, 64, 'SHA-256 HEAD must be 64 hex chars');
    writeFileSync(join(shaRoot, 'tracked.txt'), 'sha256 unstaged\n');
    const receipt = writeReceipt(shaRoot);
    assert.equal(gate(shaRoot, 'check', receipt).status, 0, 'fresh SHA-256 receipt must pass');
    gitOk(shaRoot, 'add', '--', 'tracked.txt');
    assert.equal(gate(shaRoot, 'check', receipt).status, 1, 'SHA-256 git add must invalidate');
  } finally {
    rmSync(shaRoot, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · receipts neither hash external links nor accept an external receipt path', () => {
  const root = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-receipt-outside-'));
  try {
    writeFileSync(join(outside, 'secret.js'), 'export const secret = true;\n');
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const linked = gate(root, 'fingerprint');
    assert.equal(linked.status, 1, 'an untracked junction/symlink must fail closed, not hash outside bytes');
    assert.match(linked.output, /resolves outside the checkout/i);

    const externalReceipt = join(outside, 'receipt.json');
    writeFileSync(externalReceipt, '{}\n');
    const external = gate(root, 'check', externalReceipt);
    assert.equal(external.status, 1, 'an external receipt must never influence the local approval gate');
    assert.match(external.output, /receipt path is unsafe/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a Git filename beginning with a dash is data, never a hash-object option', () => {
  withFixture((root) => {
    writeFileSync(join(root, '-receipt-probe.txt'), 'baseline\n');
    gitOk(root, 'add', '--', '-receipt-probe.txt');
    gitOk(root, 'commit', '-qm', 'adds dash-prefixed filename');
    writeFileSync(join(root, '-receipt-probe.txt'), 'first edit\n');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'hash-object must safely hash a dash-prefixed filename');
    writeFileSync(join(root, '-receipt-probe.txt'), 'second edit\n');
    assert.equal(gate(root, 'check', receipt).status, 1, 'a later dash-prefixed filename edit must invalidate');
  });
});

test('FALSIFICACIÓN · receipt file hashing accepts only regular files physically inside its checkout', () => {
  const root = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'vcp-receipt-safe-file-'));
  try {
    mkdirSync(join(root, 'directory'));
    writeFileSync(join(outside, 'outside.txt'), 'outside\n');
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(isWithin(root, root), false, 'the checkout root itself is never a file candidate');
    assert.equal(isWithin(root, join(root, 'tracked.txt')), true);
    assert.equal(isAbsolute(safeRegularFile('tracked.txt', root)), true);
    assert.throws(() => safeRegularFile('', root), /unsafe repository path/i);
    assert.throws(() => safeRegularFile(join(outside, 'outside.txt'), root), /unsafe repository path/i);
    assert.throws(() => safeRegularFile('../outside.txt', root), /escapes the checkout/i);
    assert.throws(() => safeRegularFile('directory', root), /not a regular file/i);
    assert.throws(() => safeRegularFile('linked', root), /symbolic link/i);
    assert.throws(() => safeRegularFile('linked/outside.txt', root), /resolves outside the checkout/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------------------------------------
// vcp.receipt/v2 — invariants, 9 required scenarios plus pure-function unit coverage.
// -------------------------------------------------------------------------------------------

test('FALSIFICACIÓN · v2 approved with any AC UNTESTED/PARTIAL/FAILING is rejected by check', () => {
  withFixture((root) => {
    for (const verdict of ['UNTESTED', 'PARTIAL', 'FAILING']) {
      const ac = { ...defaultAcceptanceCriteria()[0], verdict };
      delete ac.test_file;
      delete ac.test_hash_sha256;
      delete ac.command;
      delete ac.result;
      const receipt = writeReceipt(root, { acceptanceCriteria: [ac] });
      const result = gate(root, 'check', receipt);
      assert.equal(result.status, 1, `${verdict} must reject check`);
      assert.match(result.output, new RegExp(`verdict is ${verdict}, not COMPLIANT`));
    }
  });
});

test('FALSIFICACIÓN · v2 rejects duplicate AC ids, an AC test outside declared scope, and blank evidence entries', () => {
  withFixture((root) => {
    const duplicate = writeReceipt(root, {
      acceptanceCriteria: [
        ...defaultAcceptanceCriteria(),
        { ...defaultAcceptanceCriteria()[0], scenario: 'same id must not be ambiguous' },
      ],
    });
    const duplicateResult = gate(root, 'check', duplicate);
    assert.equal(duplicateResult.status, 1, 'duplicate ac_id must reject');
    assert.match(duplicateResult.output, /duplicate ac_id/);

    const outsideScope = writeReceipt(root, { scope: { declared_paths: ['tracked.txt'] } });
    const outsideScopeResult = gate(root, 'check', outsideScope);
    assert.equal(outsideScopeResult.status, 1, 'a COMPLIANT AC test_file must be declared in scope');
    assert.match(outsideScopeResult.output, /test_file is not declared in scope/);

    const blankEvidence = writeReceipt(root, { evidence: ['   '] });
    const blankEvidenceResult = gate(root, 'check', blankEvidence);
    assert.equal(blankEvidenceResult.status, 1, 'blank evidence must reject');
    assert.match(blankEvidenceResult.output, /evidence entries must be non-empty strings/);
  });
});

test('FALSIFICACIÓN · v2 approved with an AC test_hash_sha256 that does not match the real file is rejected', () => {
  withFixture((root) => {
    const ac = { ...defaultAcceptanceCriteria()[0], test_hash_sha256: '0'.repeat(64) };
    const receipt = writeReceipt(root, { acceptanceCriteria: [ac] });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1);
    assert.match(result.output, /test_hash_sha256 does not match/);
  });
});

test('FALSIFICACIÓN · v2 approved with an AC test_file outside the checkout or through a symlink is rejected', () => {
  const root = fixture();
  const outside = fixture();
  assert.notEqual(root, null);
  assert.notEqual(outside, null);
  try {
    const traversal = writeReceipt(root, { acceptanceCriteria: [{ ...defaultAcceptanceCriteria()[0], test_file: '../outside.txt' }] });
    const traversalResult = gate(root, 'check', traversal);
    assert.equal(traversalResult.status, 1, 'traversal test_file must reject');
    assert.match(traversalResult.output, /test_file is unsafe/);

    writeFileSync(join(outside, 'external.test.mjs'), TEST_FILE_CONTENT);
    symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    gitOk(root, 'add', '-A');
    const symlinked = writeReceipt(root, { acceptanceCriteria: [{ ...defaultAcceptanceCriteria()[0], test_file: 'linked/external.test.mjs', test_hash_sha256: sha256Hex(TEST_FILE_CONTENT) }] });
    const symlinkedResult = gate(root, 'check', symlinked);
    assert.equal(symlinkedResult.status, 1, 'symlinked test_file must reject');
    assert.match(symlinkedResult.output, /test_file is unsafe/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · a measurement with measured=false and no reason is rejected, "-1" alone is not sufficient', () => {
  withFixture((root) => {
    const noReason = writeReceipt(root, { measurements: [{ metric: 'coverage_pct', measured: false, before: -1, after: -1 }] });
    const noReasonResult = gate(root, 'check', noReason);
    assert.equal(noReasonResult.status, 1);
    assert.match(noReasonResult.output, /measured=false requires a non-empty reason/);

    const wrongValue = writeReceipt(root, { measurements: [{ metric: 'coverage_pct', measured: false, before: 0, after: -1, reason: 'not instrumented' }] });
    const wrongValueResult = gate(root, 'check', wrongValue);
    assert.equal(wrongValueResult.status, 1);
    assert.match(wrongValueResult.output, /measured=false requires before and after to both be -1/);

    const valid = writeReceipt(root, { measurements: [{ metric: 'coverage_pct', measured: false, before: -1, after: -1, reason: 'not instrumented in this stack' }] });
    assert.equal(gate(root, 'check', valid).status, 0, 'a properly-reasoned -1 measurement must pass');
  });
});

test('FALSIFICACIÓN · not_reviewed placeholders ("n/a", blank, bare "none") are rejected; a reasoned "none —" passes', () => {
  withFixture((root) => {
    for (const bad of ['n/a', 'unknown', 'nothing', '', 'none', '   ']) {
      const receipt = writeReceipt(root, { notReviewed: bad });
      const result = gate(root, 'check', receipt);
      assert.equal(result.status, 1, `not_reviewed=${JSON.stringify(bad)} must reject`);
    }
    const reasoned = writeReceipt(root, { notReviewed: 'none — reviewed the full declared scope' });
    assert.equal(gate(root, 'check', reasoned).status, 0);
  });
});

test('FALSIFICACIÓN · a vcp.receipt/v1 receipt always fails check, regardless of content, and points to inspect-legacy', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { schema: 'vcp.receipt/v1' });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'v1 must never pass check');
    assert.match(result.output, /archival-only and cannot pass check/);
    assert.match(result.output, /inspect-legacy/);
  });
});

test('v1 inspect-legacy reports archival status read-only and never modifies the receipt or the repository', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { schema: 'vcp.receipt/v1' });
    const absolute = join(root, ...receipt.split('/'));
    const before = readFileSync(absolute, 'utf8');
    const statusBefore = gitOk(root, 'status', '--porcelain');
    const result = gate(root, 'inspect-legacy', receipt);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /ARCHIVAL: vcp\.receipt\/v1/);
    assert.match(result.output, /does not authorize any commit, publish, or gate decision/);
    assert.equal(readFileSync(absolute, 'utf8'), before, 'inspect-legacy must not modify the receipt file');
    assert.equal(gitOk(root, 'status', '--porcelain'), statusBefore, 'inspect-legacy must not change repository state');

    // inspect-legacy is v1-only — a v2 receipt must be rejected, pointed at `check` instead.
    const v2 = writeReceipt(root);
    const v2Result = gate(root, 'inspect-legacy', v2);
    assert.equal(v2Result.status, 1);
    assert.match(v2Result.output, /inspect-legacy is for schema vcp\.receipt\/v1 only/);
  });
});

test('a fully consistent v2 receipt (real AC, real 4R, real measurements, real not_reviewed) passes check', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, {
      measurements: [
        { metric: 'test_count', measured: true, before: 46, after: 47 },
        { metric: 'coverage_pct', measured: false, before: -1, after: -1, reason: 'not instrumented in this stack' },
      ],
    });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /OK: receipt valid for receipt-fixture\/T01/);
  });
});

test('FALSIFICACIÓN · modifying the AC test file after the receipt was written invalidates it (same hash-pinning as RED)', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'fresh receipt must pass first');
    writeFileSync(join(root, TEST_FILE_RELATIVE), `${TEST_FILE_CONTENT}// tampered\n`);
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'a receipt whose AC test file changed on disk must invalidate');
  });
});

test('validateAcceptanceCriterion/validateMeasurements/validateNotReviewedField/validateScope/validateReview4r reject malformed shapes directly', () => {
  withFixture((root) => {
    assert.equal(validateAcceptanceCriterion(null, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: '', scenario: 'x', verdict: 'COMPLIANT' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: '', verdict: 'COMPLIANT' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'MAYBE' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: '' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: TEST_FILE_RELATIVE, test_hash_sha256: 'short' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: TEST_FILE_RELATIVE }, root).ok, false, 'missing test_hash_sha256 entirely must reject');
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: TEST_FILE_RELATIVE, test_hash_sha256: TEST_FILE_SHA256, command: '' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: TEST_FILE_RELATIVE, test_hash_sha256: TEST_FILE_SHA256, command: 'x', result: '' }, root).ok, false);
    assert.equal(validateAcceptanceCriterion({ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: 'missing.test.mjs', test_hash_sha256: TEST_FILE_SHA256, command: 'x', result: 'x' }, root).ok, false, 'a non-existent test_file must reject via safeRegularFile');

    assert.equal(validateAcceptanceCriteria([], root).ok, false);
    assert.equal(validateAcceptanceCriteria('not-an-array', root).ok, false);

    assert.equal(validateMeasurements('not-an-array').ok, false);
    assert.equal(validateMeasurements([{ metric: '' }]).ok, false);
    assert.equal(validateMeasurements([{ metric: 'x', measured: 'yes' }]).ok, false);
    assert.equal(validateMeasurements([{ metric: 'x', measured: true, before: 'n/a', after: 1 }]).ok, false);
    assert.equal(validateMeasurements([{ metric: 'x', measured: true, before: 1, after: 2 }]).ok, true);
    assert.equal(validateMeasurements([]).ok, true);

    assert.equal(validateNotReviewedField(42).ok, false);
    assert.equal(validateNotReviewedField('N/A').ok, false);
    assert.equal(validateNotReviewedField('none, mostly').ok, false);
    assert.equal(validateNotReviewedField('none — reviewed everything').ok, true);
    assert.equal(validateNotReviewedField('listed 3 real limits below').ok, true);

    assert.equal(validateScope(null, root).ok, false);
    assert.equal(validateScope({ declared_paths: [] }, root).ok, false);
    assert.equal(validateScope({ declared_paths: [''] }, root).ok, false);
    assert.equal(validateScope({ declared_paths: ['../outside.txt'] }, root).ok, false);
    assert.equal(validateScope({ declared_paths: [TEST_FILE_RELATIVE] }, root).ok, true);

    assert.equal(validateReview4r(null).ok, false);
    assert.equal(validateReview4r({ risk: {} }).ok, false);
    assert.equal(validateReview4r({ risk: {}, readability: {}, reliability: {}, resilience: 'x' }).ok, false);
    assert.equal(validateReview4r(defaultReview4r()).ok, true);

    assert.equal(validateReceiptV2(null, root).ok, false);
    assert.equal(validateReceiptV2({ feature: 'x' }, root).ok, false, 'missing most required fields must reject');

    const base = {
      feature: 'x', task: 'T01', scope: { declared_paths: [TEST_FILE_RELATIVE] },
      acceptance_criteria: defaultAcceptanceCriteria(), review_4r: defaultReview4r(),
      measurements: [], reproduction: 'x', not_reviewed: 'none — x', evidence: ['x'],
      git_head: 'x', tree_fingerprint: 'x', terminal_state: 'approved',
    };
    assert.equal(validateReceiptV2({ ...base, feature: '' }, root).ok, false, 'empty feature must reject');
    assert.equal(validateReceiptV2({ ...base, task: '' }, root).ok, false, 'empty task must reject');
    assert.equal(validateReceiptV2({ ...base, evidence: [] }, root).ok, false, 'empty evidence must reject');
    assert.equal(validateReceiptV2({ ...base, evidence: 'not-an-array' }, root).ok, false, 'non-array evidence must reject');
    assert.equal(validateReceiptV2({ ...base, reproduction: '' }, root).ok, false, 'empty reproduction must reject');
    assert.equal(validateReceiptV2({ ...base, terminal_state: 'pending' }, root).ok, false, 'invalid terminal_state must reject');
    assert.equal(validateReceiptV2({ ...base, terminal_state: 'escalated' }, root).ok, false, 'escalated must always reject');
    assert.equal(validateReceiptV2({ ...base, scope: null }, root).ok, false, 'invalid scope must reject via validateReceiptV2');
    assert.equal(validateReceiptV2({ ...base, acceptance_criteria: [] }, root).ok, false, 'invalid AC list must reject via validateReceiptV2');
    assert.equal(validateReceiptV2({ ...base, review_4r: null }, root).ok, false, 'invalid review_4r must reject via validateReceiptV2');
    assert.equal(validateReceiptV2({ ...base, measurements: 'not-an-array' }, root).ok, false, 'invalid measurements must reject via validateReceiptV2');
    assert.equal(validateReceiptV2({ ...base, not_reviewed: 'n/a' }, root).ok, false, 'invalid not_reviewed must reject via validateReceiptV2');
    assert.equal(validateReceiptV2(base, root).ok, true, 'a fully valid v2 object passes shape validation');
  });
});

test('inspect-legacy rejects a missing argument and reports "(missing)" for a v1 receipt with absent feature/terminal_state', () => {
  withFixture((root) => {
    const usage = gate(root, 'inspect-legacy');
    assert.equal(usage.status, 1);
    assert.match(usage.output, /usage: verify-receipt\.mjs inspect-legacy/);

    const relative = '.vibe/receipts/bare-v1.json';
    const absolute = join(root, ...relative.split('/'));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, JSON.stringify({ schema: 'vcp.receipt/v1' }));
    const result = gate(root, 'inspect-legacy', relative);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /feature="\(missing\)"/);
    assert.match(result.output, /terminal_state="\(missing\)"/);
  });
});

test('--require-clean-worktree exige que lo atestiguado sea exactamente lo que se va a commitear', () => {
  withFixture((root) => {
    // A receipt written over a clean-but-staged tree is valid evidence, yet a release gate needs
    // more: nothing unstaged and nothing untracked may remain, or the commit can differ from
    // what a human reviewed. The default `check` keeps attesting the evaluated state as-is.
    const receipt = writeReceipt(root);
    const clean = gate(root, 'check', receipt, '--require-clean-worktree');
    assert.equal(clean.status, 0, clean.output);
    assert.match(clean.output, /clean worktree/);

    writeFileSync(join(root, 'tracked.txt'), 'unstaged drift\n');
    const drifted = writeReceipt(root);
    assert.equal(gate(root, 'check', drifted).status, 0, 'plain check still attests the evaluated state');
    const rejected = gate(root, 'check', drifted, '--require-clean-worktree');
    assert.equal(rejected.status, 1, rejected.output);
    assert.match(rejected.output, /1 unstaged/);

    gitOk(root, 'add', '--', 'tracked.txt');
    const stagedOnly = writeReceipt(root);
    assert.equal(gate(root, 'stagedOnly-placeholder', stagedOnly).status, 2, 'unknown command still reports usage');
    assert.equal(gate(root, 'check', stagedOnly, '--require-clean-worktree').status, 0, 'staged-only work is releasable');

    writeFileSync(join(root, 'stray.txt'), 'untracked leftover\n');
    const withStray = writeReceipt(root);
    const strayRejected = gate(root, 'check', withStray, '--require-clean-worktree');
    assert.equal(strayRejected.status, 1, strayRejected.output);
    assert.match(strayRejected.output, /1 untracked/);

    assert.equal(gate(root, 'check', withStray, '--unknown-flag').status, 1, 'unknown flags must not be ignored');
  });
});
