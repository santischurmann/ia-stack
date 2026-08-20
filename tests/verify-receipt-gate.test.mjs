import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const receiptGate = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const { parseRawDiff, byPath, formatEntry } = await import(pathToFileURL(receiptGate).href);

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
  gitOk(root, 'add', '-A');
  gitOk(root, 'commit', '-qm', 'baseline');
  return root;
}

function writeReceipt(root, { evidence = ['node --test: 1 pass'], terminalState = 'approved' } = {}) {
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
  writeFileSync(absolute, `${JSON.stringify({
    schema: 'vcp.receipt/v1',
    feature: 'receipt-fixture',
    risk_level: 'low',
    terminal_state: terminalState,
    git_head,
    tree_fingerprint,
    evidence,
  }, null, 2)}\n`);
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

test('FALSIFICACIÓN · check rejects a missing required field and an unrecognized schema', () => {
  withFixture((root) => {
    const relative = '.vibe/receipts/incomplete.json';
    const absolute = join(root, ...relative.split('/'));
    mkdirSync(dirname(absolute), { recursive: true });
    const fingerprint = gate(root, 'fingerprint', relative);
    const json = fingerprint.output.match(/\{\s*"git_head"[\s\S]*?\n\}/)?.[0];
    const { git_head, tree_fingerprint } = JSON.parse(json);
    // schema, risk_level and evidence are all present; git_head/tree_fingerprint too — only
    // `terminal_state` is missing, so this must fail at the "missing required field" check.
    writeFileSync(absolute, `${JSON.stringify({
      schema: 'vcp.receipt/v1', feature: 'x', risk_level: 'low', evidence: ['ok'], git_head, tree_fingerprint,
    }, null, 2)}\n`);
    const result = gate(root, 'check', relative);
    assert.equal(result.status, 1, 'missing terminal_state must reject');
    assert.match(result.output, /missing required field: terminal_state/);
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const absolute = join(root, ...receipt.split('/'));
    const parsed = JSON.parse(readFileSync(absolute, 'utf8'));
    parsed.schema = 'vcp.receipt/v2';
    writeFileSync(absolute, `${JSON.stringify(parsed, null, 2)}\n`);
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'unrecognized schema must reject');
    assert.match(result.output, /unknown schema: vcp\.receipt\/v2/);
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
