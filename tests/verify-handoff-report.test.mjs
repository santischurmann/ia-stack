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

test('revision-n3 · BAJA · un reporte que no se puede leer sale 1 con REJECTED (alineado con verify-brief-size), no 2', () => {
  const result = run(['check', join(tmpdir(), 'ia-stack-handoff-report-does-not-exist.md')]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /REJECTED:.*(leer|read)/i);
});

test('CLI rejects missing report arguments as usage (exit 2)', () => {
  for (const args of [[], ['other'], ['check']]) {
    const result = run(args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.output}`);
    assert.match(result.output, /usage:/i);
  }
});

// IA Stack 3.4.1 · AC7: el reporte de un subagente tiene 40 líneas o menos; el detalle va a .vibe/handoffs/.
function reporteDeLineas(n) {
  const base = ['STATUS: pass', 'NOT_REVIEWED: Manual browser testing was outside the declared unit-test scope.'];
  const relleno = Array.from({ length: n - base.length }, (_, i) => `linea ${i + 1}`);
  return [...base, ...relleno].join('\n');
}

test('ia-stack-3-4-1-tokens · AC7 · acepta un reporte de 40 líneas, con o sin salto de línea final', () => {
  withReport(reporteDeLineas(40), (report) => {
    const result = run(['check', report]);
    assert.equal(result.status, 0, result.output);
  });
  withReport(`${reporteDeLineas(40)}\n`, (report) => {
    const result = run(['check', report]);
    assert.equal(result.status, 0, `el salto final no cuenta como línea\n${result.output}`);
  });
});

test('ia-stack-3-4-1-tokens · AC7 · rechaza un reporte de 41 líneas y manda el detalle a .vibe/handoffs/', () => {
  for (const texto of [reporteDeLineas(41), `${reporteDeLineas(41)}\n`]) {
    withReport(texto, (report) => {
      const result = run(['check', report]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /REJECTED:.*41 líneas.*40/);
      assert.match(result.output, /\.vibe\/handoffs\/detalle\//);
    });
  }
});

test('revision-n3 · MEDIA 4 · phases/06-build.md manda el detalle a .vibe/handoffs/detalle/, no a la carpeta de los reportes de gate', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const texto = readFileSync(fileURLToPath(new URL('../phases/06-build.md', import.meta.url)), 'utf8');
  assert.match(texto, /el detalle va a\s+`\.vibe\/handoffs\/detalle\//);
  assert.doesNotMatch(texto, /el detalle va a\s+`\.vibe\/handoffs\/`/);
});
