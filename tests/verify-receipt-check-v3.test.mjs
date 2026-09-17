// Lo que `check` EXIGE de un recibo ia.receipt/v3 aprobado, y el archivado de los viejos v1 y v2.
//
// Salió de `verify-receipt-gate.test.mjs`, donde ya vivía detrás de su propio divisor de sección: la
// forma del recibo y lo que `check` exige de un v3 son dos temas distintos. Los ayudantes NO se
// duplican: viven en `_receipt-fixture.mjs`, que es lo que mantiene a los cuatro archivos del recibo
// midiendo el mismo recibo.
//
// NO CONFUNDIR CON `verify-receipt-v3.test.mjs`, que ya existía y cubre otra cosa: separar un LÍMITE
// de una REGRESIÓN por el campo `before`, y exigir soporte. Éste valida criterios de aceptación,
// hashes, symlinks, mediciones y `not_reviewed`; aquél, las reglas que v3 agregó al formato.

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  defaultAcceptanceCriteria,
  defaultReview4r,
  fixture,
  gate,
  gitOk,
  safeRegularFile,
  sha256Hex,
  TEST_FILE_CONTENT,
  TEST_FILE_RELATIVE,
  TEST_FILE_SHA256,
  validateAcceptanceCriteria,
  validateAcceptanceCriterion,
  validateMeasurements,
  validateNotReviewedField,
  validateReceiptV2,
  validateReview4r,
  validateScope,
  withFixture,
  writeReceipt,
} from './_receipt-fixture.mjs';

// -------------------------------------------------------------------------------------------
// ia.receipt/v3 (y las invariantes de v2 que compone) — invariants, 9 required scenarios plus pure-function unit coverage.
// -------------------------------------------------------------------------------------------

test('FALSIFICACIÓN · v3 approved with any AC UNTESTED/PARTIAL/FAILING is rejected by check', () => {
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

test('FALSIFICACIÓN · v3 rejects duplicate AC ids, an AC test outside declared scope, and blank evidence entries', () => {
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

test('FALSIFICACIÓN · v3 approved with an AC test_hash_sha256 that does not match the real file is rejected', () => {
  withFixture((root) => {
    const ac = { ...defaultAcceptanceCriteria()[0], test_hash_sha256: '0'.repeat(64) };
    const receipt = writeReceipt(root, { acceptanceCriteria: [ac] });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1);
    assert.match(result.output, /test_hash_sha256 does not match/);
  });
});

test('FALSIFICACIÓN · v3 approved with an AC test_file outside the checkout or through a symlink is rejected', () => {
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

test('FALSIFICACIÓN · a ia.receipt/v1 receipt always fails check, regardless of content, and points to inspect-legacy', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { schema: 'ia.receipt/v1' });
    const result = gate(root, 'check', receipt);
    assert.equal(result.status, 1, 'v1 must never pass check');
    assert.match(result.output, /archival-only and cannot pass check/);
    assert.match(result.output, /inspect-legacy/);
  });
});

test('inspect-legacy reports archival status for v1 and v2 read-only and never modifies the receipt or the repository', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { schema: 'ia.receipt/v1' });
    const absolute = join(root, ...receipt.split('/'));
    const before = readFileSync(absolute, 'utf8');
    const statusBefore = gitOk(root, 'status', '--porcelain');
    const result = gate(root, 'inspect-legacy', receipt);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /ARCHIVAL: ia\.receipt\/v1/);
    assert.match(result.output, /does not authorize any commit, publish, or gate decision/);
    assert.equal(readFileSync(absolute, 'utf8'), before, 'inspect-legacy must not modify the receipt file');
    assert.equal(gitOk(root, 'status', '--porcelain'), statusBefore, 'inspect-legacy must not change repository state');

    // v2 tambien es archivistico desde el bump a v3: se lee, nunca aprueba.
    const archivoV2 = writeReceipt(root, { schema: 'ia.receipt/v2' });
    const v2Result = gate(root, 'inspect-legacy', archivoV2);
    assert.equal(v2Result.status, 0, v2Result.output);
    assert.match(v2Result.output, /ARCHIVAL: ia\.receipt\/v2/);

    // Y el schema VIGENTE nunca pasa por aca: para eso esta `check`.
    const vigente = writeReceipt(root);
    const vigenteResult = gate(root, 'inspect-legacy', vigente);
    assert.equal(vigenteResult.status, 1);
    assert.match(vigenteResult.output, /use check for ia\.receipt\/v3/);
  });
});

test('a fully consistent v3 receipt (real AC, real 4R, real measurements, real not_reviewed) passes check', () => {
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
    // El array vacio paso a ser invalido: un recibo sin una sola medicion no mide nada. La
    // falsificacion que lo fija esta al final de este archivo.
    assert.equal(validateMeasurements([]).ok, false);

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
      measurements: [{ metric: 'x', measured: true, before: 0, after: 1 }], reproduction: 'x', not_reviewed: 'none — x', evidence: ['x'],
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
    assert.equal(validateReceiptV2({ ...base, measurements: [] }, root).ok, false, 'un recibo sin ninguna medición no mide nada y tiene que rechazar');
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
    writeFileSync(absolute, JSON.stringify({ schema: 'ia.receipt/v1' }));
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
