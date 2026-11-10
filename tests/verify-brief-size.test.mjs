import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkBrief, estimateTokens, MAX_FILES, MAX_TOKENS } from '../scripts/verify-brief-size.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = join(repoRoot, 'scripts', 'verify-brief-size.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [gate, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function withBrief(text, callback) {
  const root = mkdtempSync(join(tmpdir(), 'ia-brief-size-'));
  const file = join(root, 'brief.md');
  writeFileSync(file, text);
  try {
    callback(file);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// Relleno que mide exactamente `tokens` tokens (ceil(chars/4)) incluida la línea ARCHIVOS.
function briefDeTokens(tokens, archivos = 'ARCHIVOS: a.mjs, b.mjs') {
  const cabecera = `${archivos}\n`;
  const chars = tokens * 4;
  return cabecera + 'x'.repeat(chars - cabecera.length);
}

test('ia-stack-3-4-1-tokens · AC2 · constantes: 4000 tokens y 3 archivos, estimador ceil(chars/4)', () => {
  assert.equal(MAX_TOKENS, 4000);
  assert.equal(MAX_FILES, 3);
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('ia-stack-3-4-1-tokens · AC2 · acepta un brief de 4000 tokens y 3 archivos (límite exacto)', () => {
  withBrief(briefDeTokens(4000, 'ARCHIVOS: a.mjs, b.mjs, c.mjs'), (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /OK:.*4000 tokens.*3 archivos/);
  });
});

test('ia-stack-3-4-1-tokens · AC2 · rechaza 4001 tokens', () => {
  withBrief(briefDeTokens(4001), (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED:.*4001.*4000/);
  });
});

test('ia-stack-3-4-1-tokens · AC2 · rechaza 4 archivos', () => {
  withBrief('ARCHIVOS: a, b, c, d\nhacé algo\n', (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED:.*4 archivos.*3/);
  });
});

test('ia-stack-3-4-1-tokens · AC2 · ARCHIVOS: ninguno cuenta cero y el subgrafo pegado cuenta en los tokens', () => {
  withBrief('ARCHIVOS: ninguno\ntarea corta\n', (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /0 archivos/);
  });
  const subgrafo = '\n```graphify\n' + 'nodo -> nodo\n'.repeat(1400) + '```\n';
  withBrief(`ARCHIVOS: a.mjs\ntarea${subgrafo}`, (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED:.*tokens/);
  });
});

test('ia-stack-3-4-1-tokens · AC9 · falta, se repite o está vacía la línea ARCHIVOS: rechaza', () => {
  for (const texto of [
    'sin declaración\n',
    'ARCHIVOS: a\nARCHIVOS: b\n',
    'ARCHIVOS:   \n',
    'ARCHIVOS: a,, b\n',
  ]) {
    withBrief(texto, (f) => {
      const r = run(['check', f]);
      assert.equal(r.status, 1, `${texto}\n${r.output}`);
      assert.match(r.output, /REJECTED:.*ARCHIVOS/);
    });
  }
});

test('ia-stack-3-4-1-tokens · AC9 · brief vacío o ilegible nunca aprueba', () => {
  withBrief('', (f) => {
    const r = run(['check', f]);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED:.*vac/i);
  });
  withBrief('  \n\n', (f) => {
    assert.equal(run(['check', f]).status, 1);
  });
  const r = run(['check', join(tmpdir(), 'ia-stack-brief-size-no-existe.md')]);
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /REJECTED:.*leer/i);
});

test('ia-stack-3-4-1-tokens · AC9 · uso incorrecto sale 2 con usage', () => {
  for (const args of [[], ['otro'], ['check'], ['check', 'a', 'b']]) {
    const r = run(args);
    assert.equal(r.status, 2, `${args.join(' ')}\n${r.output}`);
    assert.match(r.output, /usage:/i);
  }
});

test('ia-stack-3-4-1-tokens · AC2 · checkBrief devuelve motivo estructurado', () => {
  assert.equal(checkBrief('ARCHIVOS: ninguno\nx').ok, true);
  assert.equal(checkBrief('').ok, false);
});
