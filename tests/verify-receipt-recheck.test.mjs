// `recheck`: recomprobar un recibo YA GUARDADO contra lo que realmente quedó en git.
//
// LA HERIDA, medida en un proyecto real el 2026-09-22: seis recibos v3 tenían diez criterios cuyo
// `test_hash_sha256` no correspondía a NINGUNA versión commiteada del test, ni en LF ni en CRLF. El
// recibo certificaba algo que nadie podía recomprobar desde git.
//
// No es un defecto de `commit`: ése re-hashea el disco en el momento de commitear y exige árbol
// limpio, y su prueba (AC9) ya lo demuestra. Entra por el OTRO camino que el protocolo publica como
// válido — `check --require-clean-worktree` y después `git commit` a mano —: si entre los dos alguien
// cambia el test y lo vuelve a stagear, el recibo queda certificando una versión que no se guardó. El
// gate no puede ver un commit que no hace.
//
// Y LO QUE FALTABA ERA ESTO: una vez commiteado, nada volvía a mirar el recibo contra el blob del
// test que quedó en el commit. Hubo que hacerlo a mano para encontrar la herida. Decidido por el
// operador el 2026-09-22 como subcomando, en vez de volver obligatorio `commit`.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { TEST_FILE_RELATIVE, gate, gitOk, withFixture, writeReceipt } from './_receipt-fixture.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const { RECHECK_LIMIT, recomprobarRecibo } = await import(pathToFileURL(script).href);

const sha = (contenido) => createHash('sha256').update(contenido).digest('hex');
const COMMIT = 'a'.repeat(40);

// --- La función, con git inyectado: los bordes que un repositorio real no deja fabricar ----------

const reciboV3 = (criterios) => Buffer.from(JSON.stringify({ schema: 'ia.receipt/v3', acceptance_criteria: criterios }));
const criterio = (over = {}) => ({ ac_id: 'AC-1', verdict: 'COMPLIANT', test_file: 't.test.mjs', test_hash_sha256: sha('LF\n'), ...over });
const conHistoria = (archivos) => ({
  run: () => `${COMMIT}\nN\n\n`,
  leer: (commit, ruta) => (Object.hasOwn(archivos, ruta) ? archivos[ruta] : null),
});

test('el test commiteado es el que el recibo certifica: OK, y nombra el commit', () => {
  const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': reciboV3([criterio()]), 't.test.mjs': Buffer.from('LF\n') }));
  assert.equal(r.estado, 'ok', r.lineas.join(' '));
  assert.match(r.lineas.join(' '), new RegExp(COMMIT.slice(0, 7), 'u'), 'dice contra qué commit comparó');
});

test('FALSIFICACIÓN · el test commiteado es otro: rechaza nombrando el criterio', () => {
  const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': reciboV3([criterio()]), 't.test.mjs': Buffer.from('OTRO\n') }));
  assert.equal(r.estado, 'rechazo');
  assert.match(r.lineas.join(' '), /AC-1/u);
});

test('FALSIFICACIÓN · el recibo certifica un test que no está en el commit', () => {
  const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': reciboV3([criterio()]) }));
  assert.equal(r.estado, 'rechazo');
  assert.match(r.lineas.join(' '), /no est/u);
});

test('los finales de línea no cuentan como cambio, igual que en check', () => {
  // Sellado sobre LF, y el blob quedó en CRLF: es el mismo test.
  const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': reciboV3([criterio()]), 't.test.mjs': Buffer.from('LF\r\n') }));
  assert.equal(r.estado, 'ok', r.lineas.join(' '));
});

test('un recibo sin commitear es VACÍO: no hay nada guardado que recomprobar', () => {
  const r = recomprobarRecibo('r.json', '.', { run: () => '', leer: () => null });
  assert.equal(r.estado, 'vacio');
});

test('un recibo cuyo último commit lo borra es VACÍO, no un rechazo', () => {
  const r = recomprobarRecibo('r.json', '.', conHistoria({}));
  assert.equal(r.estado, 'vacio');
  assert.match(r.lineas.join(' '), /borr/u);
});

test('un recibo archivístico no tiene criterios con hash: VACÍO, y dice cómo leerlo', () => {
  for (const schema of ['ia.receipt/v1', 'ia.receipt/v2', 'vcp.receipt/v2']) {
    const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': Buffer.from(JSON.stringify({ schema })) }));
    assert.equal(r.estado, 'vacio', schema);
    assert.match(r.lineas.join(' '), /inspect-legacy/u, schema);
  }
});

test('un recibo v3 sin ningún criterio con hash es VACÍO: recomprobar nada no es aprobar', () => {
  for (const criterios of [[], [criterio({ test_hash_sha256: 'corto' })], [criterio({ test_hash_sha256: undefined })], [criterio({ test_file: '' })], [null]]) {
    const r = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': reciboV3(criterios) }));
    assert.equal(r.estado, 'vacio', JSON.stringify(criterios));
  }
  const sinLista = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': Buffer.from(JSON.stringify({ schema: 'ia.receipt/v3' })) }));
  assert.equal(sinLista.estado, 'vacio', 'sin acceptance_criteria tampoco hay nada que recomprobar');
});

test('FALSIFICACIÓN · lo commiteado no es JSON, o no es un recibo conocido: rechaza', () => {
  const noJson = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': Buffer.from('{ roto') }));
  assert.equal(noJson.estado, 'rechazo');
  const otro = recomprobarRecibo('r.json', '.', conHistoria({ 'r.json': Buffer.from(JSON.stringify({ schema: 'otra.cosa/v9' })) }));
  assert.equal(otro.estado, 'rechazo');
  assert.match(otro.lineas.join(' '), /otra\.cosa\/v9/u);
});

test('el límite que imprime dice lo que recheck NO puede probar', () => {
  assert.match(RECHECK_LIMIT, /^LIMIT: /u);
  assert.match(RECHECK_LIMIT, /no vuelve a correr/iu, 'no re-ejecuta el test ni prueba que pase');
  assert.match(RECHECK_LIMIT, /[uú]ltimo commit/iu, 'y dice contra qué commit compara');
});

// --- El CLI, sobre un repositorio de Git de verdad ----------------------------------------------

test('recheck sobre un recibo commiteado con su test: OK', () => {
  withFixture((root) => {
    const recibo = writeReceipt(root);
    gitOk(root, 'commit', '-qm', 'el trabajo y su recibo');
    const r = gate(root, 'recheck', recibo);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /^OK: /mu);
    assert.match(r.output, /^LIMIT: /mu);
  });
});

test('FALSIFICACIÓN · EL CAMINO MANUAL: check, el test cambia, git commit a mano — recheck lo ve', () => {
  // La herida exacta. El recibo se valida sobre una versión del test; alguien la cambia y la
  // vuelve a stagear; el commit se hace a mano. Todo pasa. Nada lo mira después — hasta ahora.
  withFixture((root) => {
    const recibo = writeReceipt(root);
    const check = gate(root, 'check', recibo, '--require-clean-worktree');
    assert.equal(check.status, 0, `la premisa es que el recibo validó: ${check.output}`);
    writeFileSync(join(root, ...TEST_FILE_RELATIVE.split('/')), "import test from 'node:test';\ntest('otra cosa', () => {});\n");
    gitOk(root, 'add', '-A');
    gitOk(root, 'commit', '-qm', 'commit a mano, con el test cambiado');
    const r = gate(root, 'recheck', recibo);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED: RECEIPT_RECHECK: AC-1/u);
  });
});

test('FALSIFICACIÓN · un recibo que certifica un test que nunca se commiteó rechaza, en git de verdad', () => {
  withFixture((root) => {
    const recibo = writeReceipt(root, {
      acceptanceCriteria: [{
        ac_id: 'AC-9', scenario: 'un test que nunca llegó a git', verdict: 'COMPLIANT',
        test_file: 'test/nunca-commiteado.test.mjs', test_hash_sha256: 'b'.repeat(64),
        command: 'node --test test/nunca-commiteado.test.mjs', result: '1 pass',
      }],
    });
    gitOk(root, 'commit', '-qm', 'el recibo, sin el test que certifica');
    const r = gate(root, 'recheck', recibo);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /AC-9/u);
  });
});

test('recheck sobre un recibo stageado pero no commiteado: VACÍO, sale 0', () => {
  withFixture((root) => {
    const recibo = writeReceipt(root);
    const r = gate(root, 'recheck', recibo);
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /^VACIO: /mu);
  });
});

test('FALSIFICACIÓN · recheck con argumentos inválidos sale 2 y dice cómo se usa', () => {
  withFixture((root) => {
    for (const args of [['recheck'], ['recheck', 'a.json', 'b.json']]) {
      const r = gate(root, ...args);
      assert.equal(r.status, 2, `${args.join(' ')}\n${r.output}`);
      assert.match(r.output, /usage: verify-receipt\.mjs recheck/u);
    }
  });
});

test('FALSIFICACIÓN · fuera de un repositorio no puede mirar la historia, y lo dice', () => {
  const fuera = mkdtempSync(join(tmpdir(), 'vcp-receipt-recheck-'));
  try {
    const r = gate(fuera, 'recheck', 'r.json');
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /REJECTED: /u);
  } finally {
    rmSync(fuera, { recursive: true, force: true });
  }
});
