// La forma del recibo, sus invariantes y `check`. Cuatro archivos se reparten el recibo:
//
//   - este, la forma del recibo y las invariantes de `check`;
//   - `verify-receipt-check-v3.test.mjs`, lo que `check` EXIGE de un recibo v3 aprobado, más el
//     archivado de los formatos viejos v1 y v2;
//   - `verify-receipt-v3.test.mjs`, que es otra cosa: separar un límite de una regresión y exigir
//     soporte, las reglas que v3 agregó al formato;
//   - `verify-receipt-commit.test.mjs`, `commit`, que es la parte que hace commits de git.
//
// Se partió acá porque el divisor ya estaba escrito adentro del archivo: eran dos temas conviviendo.
// Y porque cada prueba levanta un repositorio de Git de verdad, así que el archivo entero era el más
// lento del repositorio con diferencia. Los ayudantes NO se duplican: viven en `_receipt-fixture.mjs`.

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import test from 'node:test';

import {
  byPath,
  defaultReview4r,
  fixture,
  formatEntry,
  gate,
  git,
  gitOk,
  isWithin,
  parseRawDiff,
  safeRegularFile,
  TEST_FILE_CONTENT,
  TEST_FILE_SHA256,
  withFixture,
  writeReceipt,
} from './_receipt-fixture.mjs';

// Primera mitad: forma del recibo, invariantes y `check`. La segunda, en
// `verify-receipt-commit.test.mjs`, cubre `commit` — la parte que hace commits de git.
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

test('FALSIFICACIÓN · check rejects a v3 receipt missing a required field and an unrecognized schema', () => {
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
    parsed.schema = 'ia.receipt/v9';
    writeFileSync(absolute, `${JSON.stringify(parsed, null, 2)}\n`);
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'unrecognized schema must reject');
    assert.match(result.output, /unknown schema: ia\.receipt\/v9/);
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
    // A shape-valid v3 receipt (real test file, real hash, all required fields) so the check
    // actually reaches the fingerprint comparison this test targets, instead of failing earlier
    // on schema/shape — that path is covered by its own dedicated tests elsewhere in this file.
    mkdirSync(join(root, 'test'), { recursive: true });
    writeFileSync(join(root, 'test', 'x.test.mjs'), TEST_FILE_CONTENT);
    writeFileSync(join(root, 'receipt.json'), JSON.stringify({
      schema: 'ia.receipt/v3', feature: 'x', task: 'T01',
      limits: [], regressions: [],
      support: {
        correlation: 'cada peticion lleva X-Request-Id', actor_on_writes: 'toda escritura graba actor_id',
        failure_visible: 'el endpoint /health', diagnostic_command: 'grep <request-id> logs/app.log',
      },
      refutation: { proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: {} },
      scope: { declared_paths: ['test/x.test.mjs'] },
      acceptance_criteria: [{
        ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: 'test/x.test.mjs',
        test_hash_sha256: TEST_FILE_SHA256, command: 'node --test', result: '1 pass',
      }],
      review_4r: defaultReview4r(), measurements: [{ metric: 'tests_verdes', measured: true, before: 0, after: 1 }], reproduction: 'node --test',
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
    // Mismo criterio que en ratchet: lo que se exige es el rechazo, no cuál guarda dispara primero.
    // En Linux el enlace a directorio lo agarra «is a symbolic link»; en Windows el junction llega
    // hasta «resolves outside the checkout». Las dos hablan de la frontera del checkout.
    assert.match(linked.output, /resolves outside the checkout|is a symbolic link/i, linked.output);

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
