import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const receiptGate = join(repoRoot, 'scripts', 'verify-receipt.mjs');

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

test('receipt sees unstaged, binary, untracked, sibling-receipt and mode changes', () => {
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

test('git add after a receipt invalidates the staged/unstaged state split', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'tracked.txt'), 'same bytes, initially unstaged\n');
    const receipt = writeReceipt(root);
    assert.equal(gate(root, 'check', receipt).status, 0, 'receipt over an unstaged state must pass');
    gitOk(root, 'add', '--', 'tracked.txt');
    assert.equal(gate(root, 'check', receipt).status, 1, 'git add without byte changes must invalidate');
  });
});

test('receipt rejects empty evidence and escalated state', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { evidence: [] });
    assert.equal(gate(root, 'check', receipt).status, 1, 'empty evidence must reject');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root, { terminalState: 'escalated' });
    assert.equal(gate(root, 'check', receipt).status, 1, 'escalated receipt must reject');
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
