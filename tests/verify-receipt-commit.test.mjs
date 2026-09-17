import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, chmodSync, symlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  SIGNATURE_STATES,
  byPath,
  formatEntry,
  isWithin,
  judgeSignature,
  parseRawDiff,
  readSignature,
  safeRegularFile,
  validateAcceptanceCriteria,
  validateAcceptanceCriterion,
  validateMeasurements,
  validateNotReviewedField,
  validateReceiptV2,
  validateReview4r,
  validateScope,
  SOLO_FUENTE,
  TEST_FILE_CONTENT,
  TEST_FILE_RELATIVE,
  TEST_FILE_SHA256,
  defaultAcceptanceCriteria,
  defaultReview4r,
  fixture,
  gate,
  git,
  gitOk,
  receiptGate,
  repoRoot,
  run,
  sha256Hex,
  withFixture,
  writeReceipt,
} from './_receipt-fixture.mjs';

// Segunda mitad de las pruebas del recibo: el subcomando `commit`, que es la parte que hace
// commits de git y se llevaba el grueso de los 116 segundos. La primera, en
// `verify-receipt-gate.test.mjs`.
// -------------------------------------------------------------------------------------------
// T03 — `commit <receipt.json> --message "<msg>"`: revalidate and commit in one invocation, then
// confirm after the fact that what landed is what the receipt attested. AC8 (docs/spec.md) is the
// happy path, AC9 the abort path.
//
// Every abort case below asserts the resulting HISTORY, not just the exit code. An exit 1 that
// still wrote a commit is the worst possible outcome of this subcommand and it is invisible to
// any assertion that only reads the exit code — so "did not commit" is checked against `git log`.
// -------------------------------------------------------------------------------------------

const COMMIT_MESSAGE = 'feat(receipts): commitear con receipt revalidado';

/** HEAD plus every subject, newest first. Comparing one string before/after catches both a new
 * commit and a rewritten history, which is what the two decisions on this subcommand hinge on. */
function history(root) {
  return `${gitOk(root, 'rev-parse', 'HEAD')}\n${gitOk(root, 'log', '--pretty=%s')}`;
}

test('AC8 · commit revalida y commitea en una sola invocación', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 0, 'un receipt aprobado sobre un árbol sin cambios debe validar y commitear');
    assert.equal(gitOk(root, 'log', '-1', '--pretty=%s'), COMMIT_MESSAGE, 'el commit debe llevar exactamente el mensaje pedido');
    assert.equal(Number(gitOk(root, 'rev-list', '--count', 'HEAD')), 2, 'debe agregar un solo commit sobre el baseline');
    assert.match(
      gitOk(root, 'show', '--name-only', '--pretty=format:', 'HEAD'),
      /\.vibe\/receipts\/fixture\.json/u,
      'lo que estaba staged y validado es lo que tiene que haber quedado commiteado',
    );
  });
});

test('FALSIFICACIÓN · AC9 · commit con el árbol cambiado tras el receipt aborta y no deja commit', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    writeFileSync(join(root, 'tracked.txt'), 'escritura posterior al receipt\n');
    const before = history(root);
    const beforeStatus = gitOk(root, 'status', '--porcelain');

    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'un árbol que cambió tras el receipt no autoriza el commit');
    assert.match(result.output, /stale receipt: tree_fingerprint does not match/u, 'debe explicar qué cambió, no fallar mudo');
    assert.equal(history(root), before, 'abortar significa NO commitear: el historial tiene que quedar idéntico');
    assert.equal(gitOk(root, 'status', '--porcelain'), beforeStatus, 'un abort tampoco toca el índice ni el árbol de trabajo');
  });
});

test('FALSIFICACIÓN · commit rechaza un receipt escalated y uno con un AC no COMPLIANT, sin commitear', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { terminalState: 'escalated' });
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'terminal_state escalated nunca autoriza un commit');
    assert.match(result.output, /terminal_state is escalated/u);
    assert.equal(history(root), before, 'un receipt escalated no puede dejar commit');
  });
  withFixture((root) => {
    const failing = { ...defaultAcceptanceCriteria()[0], verdict: 'FAILING' };
    const receipt = writeReceipt(root, { acceptanceCriteria: [failing] });
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'un AC no COMPLIANT nunca autoriza un commit');
    assert.match(result.output, /verdict is FAILING, not COMPLIANT/u);
    assert.equal(history(root), before, 'un AC no COMPLIANT no puede dejar commit');
  });
});

test('FALSIFICACIÓN · commit rechaza ia.receipt/v1 sin commitear, igual que check', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root, { schema: 'ia.receipt/v1' });
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'v1 es archival: no autoriza ningún commit, igual que en check');
    assert.match(result.output, /archival-only/u);
    assert.equal(history(root), before, 'un receipt v1 no puede dejar commit');
  });
});

test('FALSIFICACIÓN · commit hereda la exigencia de árbol limpio: unstaged y untracked abortan sin commitear', () => {
  withFixture((root) => {
    // El receipt se escribe DESPUÉS del cambio, así el fingerprint coincide y lo único que puede
    // rechazar es la exigencia de árbol limpio — no una deriva, que ya tiene su propia prueba.
    writeFileSync(join(root, 'tracked.txt'), 'deriva sin stagear\n');
    const receipt = writeReceipt(root);
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'lo revisado y lo commiteado tienen que ser el mismo árbol');
    assert.match(result.output, /1 unstaged/u);
    assert.equal(history(root), before, 'un unstaged pendiente no puede dejar commit');
  });
  withFixture((root) => {
    writeFileSync(join(root, 'stray.txt'), 'sobra sin trackear\n');
    const receipt = writeReceipt(root);
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'un untracked pendiente no es un árbol releasable');
    assert.match(result.output, /1 untracked/u);
    assert.equal(history(root), before, 'un untracked pendiente no puede dejar commit');
  });
});

test('FALSIFICACIÓN · commit sin un mensaje utilizable sale 2 y no commitea', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const before = history(root);
    const invocations = [
      ['commit'],
      ['commit', receipt],
      ['commit', receipt, '--message'],
      ['commit', receipt, '--message', ''],
      ['commit', receipt, '--message', '   '],
      ['commit', receipt, '--message', COMMIT_MESSAGE, '--unknown-flag'],
    ];
    for (const args of invocations) {
      const label = JSON.stringify(args);
      const result = gate(root, ...args);
      assert.equal(result.status, 2, `argumentos inválidos deben salir 2: ${label}`);
      assert.match(result.output, /usage: verify-receipt\.mjs commit/u, `debe imprimir el uso: ${label}`);
    }
    assert.equal(history(root), before, 'ninguna invocación mal formada puede dejar commit');
  });
});

test('FALSIFICACIÓN · commit no fabrica un commit vacío ni reporta éxito cuando el git commit falla', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    // El receipt está excluido de su propio fingerprint en las tres secciones (staged, unstaged y
    // untracked), así que sacarlo del índice deja intacto el estado atestiguado y la exigencia de
    // árbol limpio, y deja el índice sin nada que commitear.
    gitOk(root, 'reset', '-q', '--', receipt);
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'sin nada staged no hay commit que autorizar');
    assert.equal(history(root), before, 'no puede inventar un commit vacío');
  });
  withFixture((root) => {
    const receipt = writeReceipt(root);
    // Identidad vacía: la validación pasa y es el propio git quien rechaza el commit después.
    gitOk(root, 'config', 'user.name', '');
    const before = history(root);
    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'un git commit que falla por su cuenta debe salir 1, no 0');
    assert.equal(history(root), before, 'un git commit fallido no deja commit');
  });
});

test('FALSIFICACIÓN · una confirmación posterior fallida informa, deja el commit hecho y no reescribe el historial', (t) => {
  const root = fixture();
  assert.notEqual(root, null, 'fixture Git repository could not be initialized');
  try {
    const hook = join(root, '.git', 'hooks', 'pre-commit');
    const marker = join(root, '.git', 'HOOK_RAN');
    // Sonda independiente del sistema bajo prueba: si este Git no ejecuta hooks, el escenario no
    // es montable y no hay nada que afirmar. Se decide con un commit propio, nunca con el CLI.
    writeFileSync(hook, '#!/bin/sh\nprintf ran > .git/HOOK_RAN\nexit 0\n');
    chmodSync(hook, 0o755);
    writeFileSync(join(root, 'probe.txt'), 'sonda de hooks\n');
    gitOk(root, 'add', '--', 'probe.txt');
    gitOk(root, 'commit', '-qm', 'sonda: verifica que este Git ejecuta hooks');
    if (!existsSync(marker)) {
      t.diagnostic('Este Git no ejecuta hooks pre-commit; el escenario de confirmación posterior no es montable.');
      return;
    }

    // Un hook que reescribe y re-stagea corre DESPUÉS de que la validación pasó: el árbol que
    // termina commiteado deja de ser el que el receipt atestiguaba. Es el único vector que produce
    // ese desvío de forma determinista, e implica que `commit` no puede pasar `--no-verify`.
    writeFileSync(hook, '#!/bin/sh\nprintf "reescrito por el hook\\n" > tracked.txt\ngit add -- tracked.txt\nexit 0\n');
    chmodSync(hook, 0o755);
    const receipt = writeReceipt(root);
    const before = Number(gitOk(root, 'rev-list', '--count', 'HEAD'));

    const result = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(result.status, 1, 'si lo commiteado no es lo revisado, la invocación falla');
    assert.match(
      result.output,
      /(?:commit|tree|árbol)[\s\S]*(?:no coincide|does not match|mismatch)/iu,
      'la confirmación posterior debe reportar qué no coincide',
    );
    // Decisión del usuario: el sistema informa y deja el commit hecho; nunca lo deshace por su
    // cuenta ni corre nada que altere el historial. Que el commit siga existiendo ES la prueba.
    assert.equal(
      Number(gitOk(root, 'rev-list', '--count', 'HEAD')), before + 1,
      'el commit tiene que seguir existiendo: el sistema no puede deshacerlo por su cuenta',
    );
    assert.equal(gitOk(root, 'log', '-1', '--pretty=%s'), COMMIT_MESSAGE, 'el commit que quedó es el que se pidió');
    assert.match(result.output, /git\s+(?:reset|revert)/u, 'debe imprimir el comando para que el humano decida deshacerlo');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el subcomando se llama commit y su salida declara que la ventana se angosta, no se cierra', () => {
  withFixture((root) => {
    const usage = gate(root, 'commit');
    assert.equal(usage.status, 2, 'una invocación sin argumentos debe reportar el uso');
    assert.match(usage.output, /usage: verify-receipt\.mjs commit <receipt\.json> --message/u, 'la firma nombra al subcomando `commit`');
    // Decisión del usuario: el nombre no promete atomicidad. La línea de uso es una firma, no el
    // lugar de una declaración de límites, así que ahí la palabra no puede aparecer ni negada.
    assert.doesNotMatch(usage.output, /at[oó]mic/iu, 'la firma del subcomando no puede prometer atomicidad');

    const receipt = writeReceipt(root);
    const ok = gate(root, 'commit', receipt, '--message', COMMIT_MESSAGE);
    assert.equal(ok.status, 0, 'hace falta el caso feliz para poder leer su declaración de límite');
    // El límite honesto va en la salida, no sólo en un comentario del código: la ventana entre
    // validar y escribir se angosta de minutos a milisegundos, pero otro proceso todavía puede
    // escribir en ese instante. Satisfacen estas tres: "window"/"ventana", "narrow"/"angosta" y
    // "not closed"/"sin cerrarla".
    assert.match(ok.output, /\b(?:window|ventana)\b/iu, 'debe nombrar la ventana entre validar y escribir');
    assert.match(ok.output, /(?:narrow|angost)/iu, 'debe decir que la angosta');
    assert.match(ok.output, /(?:not clos|does not clos|sin cerrar|no la cierra|no se cierra)/iu, 'debe decir que no la cierra');
  });
});


// --- Custodia: quien firmo el commit que lleva este recibo --------------------------------------

// El limite declarado decia "nadie firma un recibo". Cierto, y el protocolo no puede crear claves.
// Lo que si puede es DECIR si alguien firmo: git ya trae firma de commits, y su estado es un dato
// que el gate puede leer y reportar. Convierte "nadie firma" en "el protocolo te dice si alguien
// firmo, con que clave, y que prueba eso exactamente".
const NL = String.fromCharCode(10);

/** Falsea la salida de git para cada campo del formato de firma. */
const gitFirma = (estado, firmante, clave, commit) => () => [commit, estado, firmante, clave].join(NL);

test('SIGNATURE_STATES cubre todos los codigos que git puede devolver', () => {
  assert.deepEqual(Object.keys(SIGNATURE_STATES).sort(), ['B', 'E', 'G', 'N', 'R', 'U', 'X', 'Y']);
  for (const [codigo, info] of Object.entries(SIGNATURE_STATES)) {
    assert.equal(typeof info.texto, 'string', `${codigo} necesita texto legible`);
    assert.equal(typeof info.confiable, 'boolean');
    assert.equal(typeof info.rechaza, 'boolean');
  }
  assert.equal(SIGNATURE_STATES.G.confiable, true);
  assert.equal(SIGNATURE_STATES.N.confiable, false);
  assert.equal(SIGNATURE_STATES.B.rechaza, true, 'una firma MALA es peor que ninguna: siempre rechaza');
  assert.equal(SIGNATURE_STATES.N.rechaza, false, 'no firmar es lo normal, no una violacion');
});

test('readSignature lee el commit que lleva el recibo y su estado de firma', () => {
  const s = readSignature('receipt.json', '.', gitFirma('G', 'Firmante Inventado <f@ejemplo.invalid>', 'ABC123', 'deadbee'));
  assert.deepEqual(s, { commit: 'deadbee', estado: 'G', firmante: 'Firmante Inventado <f@ejemplo.invalid>', clave: 'ABC123' });
});

test('readSignature devuelve null cuando el recibo todavia no esta commiteado', () => {
  assert.equal(readSignature('receipt.json', '.', () => ''), null);
  assert.equal(readSignature('receipt.json', '.', () => NL + NL + NL), null);
});

test('readSignature distingue el repo sin commits de correr fuera de un repo', () => {
  // Sin commits: git log falla, pero rev-parse --git-dir responde. Es el caso vacio.
  const sinCommits = readSignature('r.json', '.', (args) => {
    if (args.includes('log')) throw new Error('does not have any commits yet');
    return '.git';
  });
  assert.equal(sinCommits, null);

  // Fuera de un repo: fallan las dos. Eso NO es vacio, es no poder mirar, y tiene que verse.
  assert.throws(() => readSignature('r.json', '.', () => { throw new Error('not a git repository'); }), /not a git repository/u);
});

test('readSignature tolera que git devuelva menos campos de los pedidos', () => {
  const parcial = readSignature('r.json', '.', () => 'abc1234');
  assert.deepEqual(parcial, { commit: 'abc1234', estado: '', firmante: '', clave: '' });
});

test('readSignature no confunde un estado desconocido con una firma buena', () => {
  const s = readSignature('receipt.json', '.', gitFirma('?', '', '', 'abc'));
  assert.equal(s.estado, '?');
  assert.equal(judgeSignature(s, false).ok, false, 'un codigo que git no documenta no puede pasar por bueno');
});

test('judgeSignature reporta sin bloquear por defecto, y bloquea con --require-signature', () => {
  const sinFirma = { commit: 'abc1234', estado: 'N', firmante: '', clave: '' };
  assert.equal(judgeSignature(sinFirma, false).ok, true, 'sin el flag, no firmar se informa y pasa');
  assert.match(judgeSignature(sinFirma, false).mensaje, /sin firma/iu);
  assert.equal(judgeSignature(sinFirma, true).ok, false, 'con el flag, no firmar es rechazo');

  const buena = { commit: 'abc1234', estado: 'G', firmante: 'Firmante Inventado <f@ejemplo.invalid>', clave: 'K1' };
  assert.equal(judgeSignature(buena, true).ok, true);
  assert.match(judgeSignature(buena, true).mensaje, /Firmante Inventado/u, 'el mensaje nombra a quien firmo');
});

test('FALSIFICACION · una firma MALA rechaza aunque no se pida firma', () => {
  const mala = { commit: 'abc1234', estado: 'B', firmante: 'alguien', clave: 'K9' };
  assert.equal(judgeSignature(mala, false).ok, false, 'una firma que no valida es peor que ninguna');
  assert.equal(judgeSignature(mala, true).ok, false);
  assert.match(judgeSignature(mala, false).mensaje, /no valida/iu);
});

test('FALSIFICACION · el CLI real informa la custodia del recibo de este repo', SOLO_FUENTE, () => {
  const run = spawnSync(process.execPath, [receiptGate, 'custody', 'contracts/honest-limits.json'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^(OK|VAC)/u);
  // El limite tiene que estar impreso en la salida, no escondido en la documentacion.
  assert.match(run.stdout + run.stderr, /firma como vos/iu);
});

test('FALSIFICACION · custody sin recibo sale 2, y un recibo sin commitear sale VACIO', SOLO_FUENTE, () => {
  const sinArg = spawnSync(process.execPath, [receiptGate, 'custody'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(sinArg.status, 2);

  // Una bandera desconocida es error de quien llama, no un veredicto sobre la firma: exit 2.
  const flagMala = spawnSync(process.execPath, [receiptGate, 'custody', 'contracts/honest-limits.json', '--firmalo-igual'], { cwd: repoRoot, encoding: 'utf8' });
  assert.deepEqual({ status: flagMala.status, nombra: flagMala.stderr.includes('--firmalo-igual') }, { status: 2, nombra: true });

  // Y la forma estricta, sobre un commit real sin firma: rechaza y lo dice.
  const estricto = spawnSync(process.execPath, [receiptGate, 'custody', 'contracts/honest-limits.json', '--require-signature'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(estricto.status, 1);
  assert.match(estricto.stderr, /RECEIPT_CUSTODY/u);

  const dir = mkdtempSync(join(tmpdir(), 'vcp-custodia-'));
  try {
    spawnSync('git', ['init', '-q', '.'], { cwd: dir, encoding: 'utf8' });
    writeFileSync(join(dir, 'r.json'), '{}', 'utf8');
    const run = spawnSync(process.execPath, [receiptGate, 'custody', 'r.json'], { cwd: dir, encoding: 'utf8' });
    assert.deepEqual({ status: run.status, vacio: run.stdout.startsWith('VAC') }, { status: 0, vacio: true }, run.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FALSIFICACION · judgeSignature nombra la custodia cuando git no devuelve firmante ni clave', () => {
  // Los caminos que faltaban no eran los `if`, sino los respaldos: `firma.firmante || ...` y los
  // ternarios de `clave` y `confiable`. Toda prueba anterior pasaba un firmante con nombre, asi que
  // el texto que se muestra cuando git NO lo devuelve no lo habia leido nadie. Medido el
  // 2026-09-01 sobre verify-receipt.mjs:204 y :209.
  // Importa porque es justo el caso de un repositorio ajeno: si el mensaje saliera `undefined` o
  // vacio, el gate informaria custodia sobre un commit del que no sabe nada.
  const sinNombre = { commit: 'abc1234def', estado: 'B', firmante: '', clave: '' };
  const roto = judgeSignature(sinNombre, false);
  assert.equal(roto.ok, false);
  assert.match(roto.mensaje, /firmante desconocido/u, 'una firma rota sin firmante tiene que decirlo, no dejar un hueco');

  const buenaSinNombre = { commit: 'abc1234def', estado: 'G', firmante: '', clave: '' };
  const anonima = judgeSignature(buenaSinNombre, true);
  assert.equal(anonima.ok, true);
  assert.match(anonima.mensaje, /firmante sin nombre/u);
  assert.doesNotMatch(anonima.mensaje, /clave/u, 'sin clave no se inventa un parentesis vacio');

  const conClave = judgeSignature({ commit: 'abc1234def', estado: 'G', firmante: 'Firmante Inventado', clave: 'K1' }, true);
  assert.match(conClave.mensaje, /\(clave K1\)/u);

  // `E` es el unico estado que no rechaza y tampoco es confiable: sin pedir firma pasa, y el
  // mensaje no puede atribuirle la firma a nadie.
  const sinClaveParaVerificar = judgeSignature({ commit: 'abc1234def', estado: 'E', firmante: 'X', clave: '' }, false);
  assert.equal(sinClaveParaVerificar.ok, true);
  assert.doesNotMatch(sinClaveParaVerificar.mensaje, / por /u, 'no se puede decir "por X" sobre una firma que no se pudo verificar');
  assert.equal(judgeSignature({ commit: 'abc1234def', estado: 'E', firmante: 'X', clave: '' }, true).ok, false, 'con --require-signature, no poder verificar es rechazo');
});

// --- Los dos huecos de `measurements`, uno de los cuales contradice a SKILL.md por escrito -------
//
// `SKILL.md:1125` promete: «`-1` sólo es válido junto con `measured: false` y un motivo no vacío —
// un `-1` sin `measured: false` explícito, o sin `reason`, es rechazado». El código no lo hacía: la
// rama `measured === true` sólo pedía que `before`/`after` fueran números, y `-1` es un número.
// Medido el 2026-09-04: dos mediciones reales de `.vibe/receipts/` pasaban en verde declarando
// `measured: true` con `before: -1`, que es la forma exacta de «no lo medí» disfrazada de medición.
//
// El segundo hueco: `measurements` figuraba entre los campos requeridos, pero sólo se comprobaba
// que la clave existiera y fuera un array. Un recibo con `measurements: []` pasaba — a diferencia de
// `evidence`, que sí se exige no vacío. Medido sobre el corpus: 15 recibos, 107 mediciones, ninguno
// con el array vacío, así que exigirlo no rompe un solo recibo real.

test('FALSIFICACIÓN · un -1 declarado como medido se rechaza: es «no lo medí» disfrazado de medición', () => {
  const r = validateMeasurements([{ metric: 'citas rotas', measured: true, before: -1, after: 0 }]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /-1/u);
  // Y la forma honesta de decir lo mismo sigue pasando.
  assert.equal(validateMeasurements([{ metric: 'citas rotas', measured: false, before: -1, after: -1, reason: 'no había línea de base' }]).ok, true);
  // Una medición de verdad con un cero no se confunde con el centinela.
  assert.equal(validateMeasurements([{ metric: 'x', measured: true, before: 0, after: 42 }]).ok, true);
  // El centinela en cualquiera de los dos extremos.
  assert.equal(validateMeasurements([{ metric: 'x', measured: true, before: 3, after: -1 }]).ok, false);
});

test('FALSIFICACIÓN · un recibo sin ninguna medición se rechaza, igual que uno sin evidencia', () => {
  assert.equal(validateMeasurements([]).ok, false);
  assert.match(validateMeasurements([]).reason, /al menos una|at least one/iu);
});

// --- ia.receipt/v3: los cuatro campos que el DoD paso a exigir ---------------------------------
//
// DOS fixtures para todos los casos, no once. La primera version abria un repositorio de git por
// caso y este archivo -- que ya era el mas lento de la suite y el que define el margen del tope de
// tiempo de verify-test-bindings -- paso de 40 s a 70 s. El fingerprint excluye el path del propio
// receipt, asi que reescribirlo en su lugar sobre un mismo arbol es valido y cuesta cero.

test('FALSIFICACIÓN · v3 rechaza cada campo nuevo mal formado, sobre un solo arbol', () => {
  withFixture((root) => {
    const receipt = writeReceipt(root);
    const absolute = join(root, ...receipt.split('/'));
    const base = JSON.parse(readFileSync(absolute, 'utf8'));
    const escribir = (cambio) => {
      const copia = JSON.parse(JSON.stringify(base));
      cambio(copia);
      writeFileSync(absolute, `${JSON.stringify(copia, null, 2)}\n`);
      return gate(root, 'check', receipt);
    };

    const conBefore = escribir((r) => {
      r.limits = [{ id: 'L1', what: 'el rol auditor ya no ve reportes', why_acceptable: 'esta documentado en el docstring', owner: 'santi', before: 'el rol auditor veia la pantalla' }];
    });
    assert.equal(conBefore.status, 1, 'un limite con estado anterior tiene que rechazar');
    assert.match(conBefore.output, /regressions\[\]/);

    const aceptada = { id: 'R1', what: 'x', before: 'andaba', after: 'no anda', evidence: 'node --test -> 1 failing', resolution: 'accepted_by_user' };

    const sinRef = escribir((r) => { r.regressions = [aceptada]; });
    assert.equal(sinRef.status, 1);
    assert.match(sinRef.output, /user_decision_ref/);

    const refInventada = escribir((r) => { r.regressions = [{ ...aceptada, user_decision_ref: 'c'.repeat(64) }]; });
    assert.equal(refInventada.status, 1);
    assert.match(refInventada.output, /phase-decisions/);

    const sinCampo = escribir((r) => { delete r.support.diagnostic_command; });
    assert.equal(sinCampo.status, 1);
    assert.match(sinCampo.output, /diagnostic_command/);

    const noCierra = escribir((r) => { r.refutation = { proposed: 60, survived: 18, refuted: 39, inconclusive: 2, by_lens: {} }; });
    assert.equal(noCierra.status, 1);
    assert.match(noCierra.output, /refutation does not add up/);

    for (const campo of ['limits', 'regressions', 'support', 'refutation']) {
      const falta = escribir((r) => { delete r[campo]; });
      assert.equal(falta.status, 1, `faltando ${campo} tiene que rechazar`);
      assert.match(falta.output, new RegExp(`missing required field: ${campo}`));
    }
  });
});

test('v3 acepta una regresion cuando la decision humana existe, y frena si el registro es ilegible', () => {
  withFixture((root) => {
    const sello = 'd'.repeat(64);
    mkdirSync(join(root, 'docs'), { recursive: true });
    const decisiones = join(root, 'docs', 'phase-decisions.json');
    const registro = { schema: 'ia.phase-decisions/1', phase_order: ['6'], decisions: [{ phase_id: '6', status: 'decided', current_hash: sello }] };
    writeFileSync(decisiones, `${JSON.stringify(registro, null, 2)}\n`);
    gitOk(root, 'add', '-A');
    const receipt = writeReceipt(root, {
      regressions: [{ id: 'R1', what: 'x', before: 'andaba', after: 'no anda', evidence: 'node --test -> 1 failing', resolution: 'accepted_by_user', user_decision_ref: sello }],
    });
    assert.equal(gate(root, 'check', receipt).status, 0, 'con la decision vigente tiene que pasar');

    // Mismo arbol, registro roto. Reescribirlo mueve el fingerprint, asi que se regenera el receipt
    // sobre el estado nuevo: lo que se mide es el rechazo del registro, no un receipt stale.
    writeFileSync(decisiones, '{ roto');
    gitOk(root, 'add', '-A');
    const receipt2 = writeReceipt(root, {
      regressions: [{ id: 'R1', what: 'x', before: 'andaba', after: 'no anda', evidence: 'cmd', resolution: 'fixed' }],
    });
    const roto = gate(root, 'check', receipt2);
    assert.equal(roto.status, 1);
    assert.match(roto.output, /phase-decisions\.json is unreadable/);
  });
});
