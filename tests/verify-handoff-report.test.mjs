import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const handoffGate = join(repoRoot, 'scripts', 'verify-handoff-report.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [handoffGate, ...args], { encoding: 'utf8', env });
  assert.equal(result.error, undefined, `handoff verifier could not launch: ${result.error?.message}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function withReport(text, callback) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-handoff-report-'));
  const report = join(root, 'handoff.md');
  writeFileSync(report, text);
  try {
    callback(report);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const requiredBase = 'STATUS: pass\nEVIDENCE: node --test → 59 pass\n';

test('handoff accepts a concrete declared review limit', () => {
  withReport(`${requiredBase}NOT_REVIEWED: Manual browser testing was outside the declared unit-test scope.\n`, (report) => {
    const result = run(['check', report]);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /OK:.*NOT_REVIEWED/i);
  });
});

test('handoff accepts none only with its reviewed-scope basis', () => {
  withReport(`${requiredBase}NOT_REVIEWED: none — every file declared in T01 and the full suite were reviewed.\n`, (report) => {
    assert.equal(run(['check', report]).status, 0);
  });
});

test('FALSIFICACIÓN · missing, blank and duplicate NOT_REVIEWED fields reject', () => {
  for (const reportText of [
    requiredBase,
    `${requiredBase}NOT_REVIEWED:   \n`,
    `${requiredBase}NOT_REVIEWED: deployment was not exercised\nNOT_REVIEWED: none — all task files reviewed\n`,
  ]) {
    withReport(reportText, (report) => {
      const result = run(['check', report]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /REJECTED:.*NOT_REVIEWED/i);
    });
  }
});

test('FALSIFICACIÓN · placeholders and malformed none claims cannot hide what was not reviewed', () => {
  for (const declaration of ['none', 'N/A', 'unknown', 'nothing', 'none beyond the declared scope']) {
    withReport(`${requiredBase}NOT_REVIEWED: ${declaration}\n`, (report) => {
      const result = run(['check', report]);
      assert.equal(result.status, 1, `${declaration}\n${result.output}`);
      assert.match(result.output, /REJECTED:.*NOT_REVIEWED/i);
    });
  }
});

test('CLI rejects missing or unreadable report arguments as usage', () => {
  for (const args of [[], ['other'], ['check'], ['check', join(tmpdir(), 'vcp-handoff-report-does-not-exist.md')]]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.output}`);
    assert.match(result.output, /usage:/i);
  }
});
