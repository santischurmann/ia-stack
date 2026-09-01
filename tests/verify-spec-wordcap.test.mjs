import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-spec-wordcap.mjs');
const { QUALITY_FLAG, USAGE, WORD_CAP, checkSpecQuality, countSpecWords, main } = await import(pathToFileURL(script).href);

const VALID_SPEC = `# Spec: billing\n\n## Problem / Problema\nEl cobro falla.\n\n## Discovery / Investigación previa\nSe revisó la evidencia.\n\n## Target Users / Usuarios\nOperadores.\n\n## Acceptance Criteria / Criterios de aceptación\n- [ ] **AC1:** GIVEN un pago pendiente, WHEN se reintenta, THEN se registra un resultado.\n- [ ] **AC2:** THE SYSTEM SHALL conservar el recibo.\n\n## Constraints / Restricciones\n- No dependencias nuevas.\n\n## Non-Goals / No-Goals\n- No se cambia la facturación.\n\n## Stack & Dependencies\n- Node nativo.\n\n## Definition of Done (DoD)\n- [ ] tests verdes\n`;

test('countSpecWords excludes fenced code blocks and table rows, counts everything else', () => {
  assert.equal(countSpecWords('one two three'), 3);
  assert.equal(countSpecWords('a\n```\ncode word here does not count\n```\nb'), 2);
  assert.equal(countSpecWords('prose\n| a | b |\n|---|---|\n| c | d |\nmore'), 2);
  assert.equal(countSpecWords('  \n\n  '), 0, 'pure whitespace counts as zero words');
  assert.equal(countSpecWords(''), 0);
});

test('FALSIFICACIÓN · a spec under the cap passes, one word over the cap rejects', () => {
  const output = [];
  const errors = [];
  const atCap = { readFile: () => Array.from({ length: WORD_CAP }, () => 'x').join(' ') };
  assert.equal(main(['check', 'spec.md'], { ...atCap, write: (l) => output.push(l), writeError: (l) => errors.push(l) }), 0);
  assert.match(output.at(-1), new RegExp(`${WORD_CAP}/${WORD_CAP} words`));

  const overCap = { readFile: () => Array.from({ length: WORD_CAP + 1 }, () => 'x').join(' ') };
  const overOutput = [];
  const overErrors = [];
  assert.equal(main(['check', 'spec.md'], { ...overCap, write: (l) => overOutput.push(l), writeError: (l) => overErrors.push(l) }), 1);
  assert.match(overErrors.at(-1), /over the 650-word cap/);
  assert.deepEqual(overOutput, []);
});

test('FALSIFICACIÓN · usage on bad args, unreadable file, and the real templates/spec.md fixture', () => {
  const errors = [];
  assert.equal(main([], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check'], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(main(['check', 'a.md', 'extra'], { writeError: (l) => errors.push(l) }), 2);

  const missingErrors = [];
  assert.equal(main(['check', 'does-not-exist.md'], { writeError: (l) => missingErrors.push(l) }), 1);
  assert.match(missingErrors.at(-1), /unable to read/);

  const output = [];
  assert.equal(main(['check', join(repoRoot, 'templates', 'spec.md')], { write: (l) => output.push(l) }), 0, 'the real template must be under its own documented cap');
  assert.match(output.at(-1), /\/650 words/);
});

test('CLI exit codes match the library behavior for a real over-cap file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-wordcap-'));
  const tmp = join(dir, 'spec.md');
  writeFileSync(tmp, Array.from({ length: WORD_CAP + 5 }, () => 'x').join(' '));
  try {
    const result = spawnSync(process.execPath, [script, 'check', tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /over the 650-word cap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSpecQuality accepts a complete spec with event and invariant AC grammar', () => {
  assert.deepEqual(checkSpecQuality(VALID_SPEC), []);
  const output = [];
  assert.equal(main(['check', 'spec.md', QUALITY_FLAG], { readFile: () => VALID_SPEC, write: (line) => output.push(line) }), 0);
  assert.match(output.at(-1), /quality shape valid/);
});

test('FALSIFICACIÓN · quality rejects empty, missing sections, placeholders and unresolved questions', () => {
  assert.ok(checkSpecQuality('').some((item) => item.includes('empty')));
  const incomplete = VALID_SPEC.replace('## Constraints / Restricciones', '## Limits');
  assert.ok(checkSpecQuality(incomplete).some((item) => item.includes('missing required section')));
  const placeholder = VALID_SPEC.replace('Operadores.', '<role>');
  assert.ok(checkSpecQuality(placeholder).some((item) => item.includes('placeholder')));
  const unresolved = VALID_SPEC.replace('Se revisó la evidencia.', '[NEEDS CLARIFICATION: qué evidencia]');
  assert.ok(checkSpecQuality(unresolved).some((item) => item.includes('unresolved')));
});

test('FALSIFICACIÓN · quality rejects duplicate, malformed and absent acceptance criteria', () => {
  const duplicate = VALID_SPEC.replace('**AC2:**', '**AC1:**');
  assert.ok(checkSpecQuality(duplicate).some((item) => item.includes('duplicate')));
  const malformed = VALID_SPEC.replace('GIVEN un pago pendiente, WHEN se reintenta, THEN se registra un resultado.', 'the payment is handled');
  assert.ok(checkSpecQuality(malformed).some((item) => item.includes('AC1') && item.includes('GIVEN')));
  const noAc = VALID_SPEC.replace(/- \[ \] \*\*AC1:[^\n]+\n/gu, '').replace(/- \[ \] \*\*AC2:[^\n]+\n/gu, '');
  assert.ok(checkSpecQuality(noAc).some((item) => item.includes('no acceptance criterion')));
});

test('quality ignores placeholders and AC-like text inside fenced code', () => {
  const withCode = `${VALID_SPEC}\n\`\`\`text\n<placeholder>\n- [ ] **AC99:** not a real criterion\n\`\`\``;
  assert.deepEqual(checkSpecQuality(withCode), []);
});

test('quality CLI handles invalid usage, unreadable input and over-cap before quality', () => {
  const errors = [];
  assert.equal(main(['check', 'spec.md', '--unknown'], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(main(['check', 'missing.md', QUALITY_FLAG], { writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['check', 'spec.md', QUALITY_FLAG], { readFile: () => Array.from({ length: WORD_CAP + 1 }, () => 'x').join(' '), writeError: (line) => errors.push(line) }), 1);
  assert.ok(errors.length >= 3);
});

test('FALSIFICACIÓN · con --quality, una spec bajo el tope pero mal formada se rechaza por la CLI', () => {
  // El camino de rechazo por calidad dentro de `main` no lo ejercitaba ninguna prueba: sólo se
  // probaba `checkSpecQuality` por separado. Un gate cuyo camino de rechazo nunca se ejecutó es un
  // gate del que no se sabe si rechaza. Medido el 2026-09-01: verify-spec-wordcap.mjs:99 no la
  // ejecutaba ningún proceso de la suite.
  const errors = [];
  const rota = VALID_SPEC.replace('## Constraints / Restricciones', '## Restricciones que no son la sección pedida');
  const code = main(['check', 'docs/spec.md', QUALITY_FLAG], {
    readFile: () => rota,
    write: () => {},
    writeError: (line) => errors.push(line),
  });
  assert.equal(code, 1, 'aceptó una spec sin una sección obligatoria');
  assert.ok(errors.some((line) => line.includes('quality: missing required section: Constraints / Restricciones')), errors.join(' || '));
  // Y la contraprueba: la misma spec sin tocar, con la misma bandera, sale en verde.
  const salida = [];
  assert.equal(main(['check', 'docs/spec.md', QUALITY_FLAG], { readFile: () => VALID_SPEC, write: (l) => salida.push(l), writeError: (l) => errors.push(l) }), 0, errors.join(' || '));
  assert.ok(salida.at(-1).includes('quality shape valid'));
});
