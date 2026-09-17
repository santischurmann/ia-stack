// _receipt-fixture.mjs — los ayudantes que comparten las dos mitades de las pruebas del recibo.
//
// SE EXTRAJO, NO SE DUPLICO. El archivo original tardaba 116 s contra un tope de 120 -- tres por
// ciento de margen -- y con la maquina cargada la suite salia roja por contencion y no por un
// defecto. Se partio por su costura natural, la seccion que hace commits de git. Copiar estos
// ayudantes en las dos mitades habria dejado dos cosas que se desincronizan, que es exactamente el
// error que este repositorio ya pago con una guarda escrita dos veces.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { esRuntimeInstalado } from './_entorno.mjs';

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio de VCP: le preguntan a git o a un gate por ESTE checkout. Adentro del
// runtime instalado de otra persona no tienen nada que afirmar -- y ademas el instalador gitignora
// el runtime, asi que git no puede contestar. Se saltean DICIENDO por que.
export const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

export const receiptGate = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const {
  parseRawDiff, byPath, formatEntry, isWithin, safeRegularFile,
  validateAcceptanceCriterion, validateAcceptanceCriteria, validateMeasurements,
  validateNotReviewedField, validateScope, validateReview4r, validateReceiptV2,
  SIGNATURE_STATES, readSignature, judgeSignature,
} = await import(pathToFileURL(receiptGate).href);

// Las dos mitades usan estas piezas del gate, asi que se reexportan desde aca en vez de que cada
// una vuelva a importarlas: una sola lista que mantener.
export {
  parseRawDiff, byPath, formatEntry, isWithin, safeRegularFile,
  validateAcceptanceCriterion, validateAcceptanceCriteria, validateMeasurements,
  validateNotReviewedField, validateScope, validateReview4r, validateReceiptV2,
  SIGNATURE_STATES, readSignature, judgeSignature,
};

export const TEST_FILE_RELATIVE = 'test/fixture.test.mjs';
export const TEST_FILE_CONTENT = "import test from 'node:test';\nimport assert from 'node:assert';\ntest('x', () => assert.equal(1, 1));\n";
export const TEST_FILE_SHA256 = createHash('sha256').update(TEST_FILE_CONTENT).digest('hex');

export function sha256Hex(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function defaultReview4r() {
  return { risk: { level: 'bajo' }, readability: { verdict: 'fixed' }, reliability: { verdict: 'fixed' }, resilience: { verdict: 'no_findings' } };
}

export function defaultAcceptanceCriteria() {
  return [{
    ac_id: 'AC-1', scenario: 'x equals x', verdict: 'COMPLIANT',
    test_file: TEST_FILE_RELATIVE, test_hash_sha256: TEST_FILE_SHA256,
    command: 'node --test test/fixture.test.mjs', result: '1 pass',
  }];
}

export function run(command, args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `${command} could not launch: ${result.error?.message}`);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function git(root, ...args) {
  return run('git', args, root);
}

export function gitOk(root, ...args) {
  const result = git(root, ...args);
  assert.equal(result.status, 0, `git ${args.join(' ')} failed\n${result.output}`);
  return result.output.trim();
}

export function gate(root, ...args) {
  return run(process.execPath, [receiptGate, ...args], root);
}

export function fixture({ sha256 = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-receipt-gate-'));
  const init = git(root, 'init', '-q', ...(sha256 ? ['--object-format=sha256'] : []));
  if (init.status !== 0) {
    rmSync(root, { recursive: true, force: true });
    return null;
  }
  gitOk(root, 'config', 'user.email', 'vcp-tests@example.invalid');
  gitOk(root, 'config', 'user.name', 'IA Stack receipt tests');
  writeFileSync(join(root, 'tracked.txt'), 'baseline\n');
  writeFileSync(join(root, 'orig.txt'), 'rename baseline\n');
  writeFileSync(join(root, 'asset.bin'), Buffer.from([0x00, 0xff, 0x10, 0x80]));
  mkdirSync(join(root, 'test'), { recursive: true });
  writeFileSync(join(root, TEST_FILE_RELATIVE), TEST_FILE_CONTENT);
  gitOk(root, 'add', '-A');
  gitOk(root, 'commit', '-qm', 'baseline');
  return root;
}

export function writeReceipt(root, overrides = {}) {
  const {
    schema = 'ia.receipt/v3',
    evidence = ['node --test: 1 pass'],
    terminalState = 'approved',
    acceptanceCriteria = defaultAcceptanceCriteria(),
    reproduction = 'node --test test/fixture.test.mjs',
    notReviewed = 'none — reviewed the full declared scope',
    measurements = [{ metric: 'tests_verdes', measured: true, before: 0, after: 1 }],
    reviewFourR = defaultReview4r(),
    scope = { declared_paths: [TEST_FILE_RELATIVE] },
    task = 'T01',
    feature = 'receipt-fixture',
    limits = [],
    regressions = [],
    support = {
      correlation: 'cada peticion lleva X-Request-Id y sale en toda linea de log',
      actor_on_writes: 'toda escritura graba el actor_id del token verificado',
      failure_visible: 'el endpoint /health y el contador de 5xx',
      diagnostic_command: 'grep <request-id> logs/app.log | head -50',
    },
    refutation = { proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: {} },
  } = overrides;
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
  const receipt = schema === 'ia.receipt/v1'
    ? { schema, feature, risk_level: 'low', terminal_state: terminalState, git_head, tree_fingerprint, evidence }
    : {
      schema, feature, task, scope, acceptance_criteria: acceptanceCriteria, review_4r: reviewFourR,
      measurements, reproduction, not_reviewed: notReviewed, evidence, terminal_state: terminalState,
      limits, regressions, support, refutation,
      git_head, tree_fingerprint,
    };
  writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
  gitOk(root, 'add', '--', relative);
  return relative;
}

export function withFixture(callback, options) {
  const root = fixture(options);
  assert.notEqual(root, null, 'fixture Git repository could not be initialized');
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

