import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readDiscoveryHistory } from '../scripts/verify-discovery-core.mjs';
import {
  USAGE,
  checkClaims,
  checkCriteria,
  declaredIdentifiers,
  literalTestTitles,
  main,
  parseArgs,
  readCriterionIds,
  REQUIRE_LINKS_FLAG,
  titleMentions,
} from '../scripts/verify-evidence-trace.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-evidence-trace.mjs');
const feature = 'trazabilidad-demo';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// El código de rechazo es contrato de salida: se fija literal acá para que el RED falle por
// aserción y no por un import que no resuelve.
const NO_INPUTS_CODE = 'EVIDENCE_TRACE_NO_INPUTS';
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

// Fixture ids are deliberately AC9x: this file lives in the very tests/ directory the repo-wide
// `criteria` run scans, so a fixture id must never collide with a real docs/spec.md criterion.
const SPEC = [
  '# Spec: demo',
  '',
  '## Acceptance Criteria',
  '',
  '**T91 — primer slice**',
  '',
  '- [ ] **AC91:** GIVEN algo WHEN corre THEN sale 0.',
  '- [x] **AC92 (error):** GIVEN otra cosa WHEN corre THEN sale 1.',
  '- [ ] **AC91:** repetido a propósito, el mismo criterio no cuenta dos veces.',
  '',
  '**Fuentes:** prosa en negrita que no declara ningún identificador.',
  '**CAIO:** tampoco, no lleva dígito.',
  '',
].join('\n');

const SPEC_WITHOUT_CRITERIA = '# Spec: demo\n\n**T91 — un slice sin criterios declarados**\n';

function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-evidence-trace-'));
  try {
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeSpec(root, source = SPEC) {
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), source, 'utf8');
}

function writeTests(root, files) {
  const dir = join(root, 'tests');
  mkdirSync(dir, { recursive: true });
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source, 'utf8');
  return dir;
}

/** Builds a minimal but real Discovery run (d001 pending -> d002 completed + packet). */
function writeDiscovery(root, claims, { completed = true } = {}) {
  const run = join(root, 'docs', 'discovery', feature, 'runs', 'run-001');
  mkdirSync(join(run, 'decisions'), { recursive: true });
  mkdirSync(join(run, 'packets'), { recursive: true });
  const base = {
    schema: 'vcp.discovery-decision/3',
    run_id: 'run-001',
    feature_slug: feature,
    decision_id: 'd001',
    evaluated_at: '2026-08-27',
    status: 'pending',
    transition_kind: 'initial',
    supersedes: null,
    predecessor_hash: null,
    previous_status: null,
    activation_result: 'discovery-result-v1',
    triggers_observed: ['scope'],
    correction_reason: null,
    skip: null,
    override: null,
    packet_ref: null,
    packet_sha256: null,
  };
  const d1 = json(base);
  writeFileSync(join(run, 'decisions', 'd001.json'), d1);
  if (!completed) return run;
  const packet = json({
    schema: 'vcp.discovery-packet/1',
    decision_id: 'd002',
    research_snapshot: { captured_at: '2026-08-27', claims },
  });
  writeFileSync(join(run, 'packets', 'd002.json'), packet);
  writeFileSync(join(run, 'decisions', 'd002.json'), json({
    ...base,
    decision_id: 'd002',
    evaluated_at: '2026-08-28',
    status: 'completed',
    transition_kind: 'activation',
    supersedes: 'd001',
    predecessor_hash: hash(d1),
    previous_status: 'pending',
    packet_ref: 'packets/d002.json',
    packet_sha256: hash(packet),
  }));
  return run;
}

function claim(overrides = {}) {
  return {
    claim_id: 'claim-001',
    source_id: 'source-001',
    locator: { kind: 'web', url: 'https://example.test/fuente' },
    retrieved_at: '2026-08-27',
    content_identity: { kind: 'sha256', value: 'a'.repeat(64), unavailable_reason: null },
    evidence_classification: 'SUPPORTED',
    evidence_summary: 'La evidencia sostiene la decisión declarada en el slice.',
    linked_requirement_id: null,
    linked_ac_id: null,
    trigger_ids: ['scope'],
    ...overrides,
  };
}

// --- Extracción de identificadores --------------------------------------------------------------

test('readCriterionIds toma los criterios declarados con checkbox, en orden de declaración y sin repetir', () => {
  assert.deepEqual(readCriterionIds(SPEC), ['AC91', 'AC92']);
  assert.deepEqual(readCriterionIds(SPEC_WITHOUT_CRITERIA), []);
  assert.deepEqual(readCriterionIds('- [ ] **AC7:** sin viñeta previa\n  * [ ] **AC8 (edge):** con asterisco\n'), ['AC7', 'AC8']);
  assert.deepEqual(readCriterionIds('**AC5:** en negrita pero sin checkbox no es un criterio declarado'), []);
});

test('declaredIdentifiers junta los ids en negrita de la spec y descarta la prosa que no es un identificador', () => {
  assert.deepEqual([...declaredIdentifiers(SPEC)].sort(), ['AC91', 'AC92', 'T91']);
  assert.deepEqual([...declaredIdentifiers('**REQ-A01 — requisito**\n**(paréntesis)**\n**minuscula1**')], ['REQ-A01']);
});

// --- Convención de mención (reusada de scripts/verify-test-bindings.mjs) -------------------------

test('literalTestTitles reusa hasLiteralTestDeclaration: sólo cuentan las llamadas reales test/it', () => {
  const source = [
    "// test('AC91 · en un comentario no cuenta', () => {});",
    "const prosa = \"test('AC92 · dentro de un string tampoco', () => {});\";",
    "test('AC91 · declaración real', () => {});",
    'it.skip("AC93 · una prueba apagada NO cubre nada", () => {});',
    'it("AC96 · con comillas dobles, sin modificador, SI cuenta", () => {});',
    'test.todo("AC95 · una prueba que nadie escribio tampoco");',
    "test('AC91 · declaración real', () => {});",
    "notest('AC94 · un identificador pegado no es test()', () => {});",
  ].join('\n');
  // `test.todo` y `test.skip` dejaron de contar el 2026-08-28: un criterio nombrado por una prueba
  // que nadie escribio -o que esta apagada- no esta cubierto, y contarlo era trazabilidad falsa.
  assert.deepEqual(literalTestTitles(source), ['AC91 · declaración real', 'AC96 · con comillas dobles, sin modificador, SI cuenta']);
  assert.deepEqual(literalTestTitles('const x = 1;\n'), []);
});

test('titleMentions acepta el id como segmento del título y rechaza la coincidencia parcial', () => {
  assert.equal(titleMentions('AC91 · el criterio arranca el título', 'AC91'), true);
  assert.equal(titleMentions('FALSIFICACIÓN · AC91 · con el prefijo obligatorio del protocolo', 'AC91'), true);
  assert.equal(titleMentions('AC91', 'AC91'), true);
  assert.equal(titleMentions('AC910 · un id más largo no es el mismo id', 'AC91'), false);
  assert.equal(titleMentions('menciona AC91 en la prosa del título', 'AC91'), false);
});

// --- Comando criteria ---------------------------------------------------------------------------

test('criteria sin docs/spec.md sale en verde: un proyecto sin spec no incumple nada', () => fixture((root) => {
  writeTests(root, { 'nada.test.mjs': 'const x = 1;\n' });
  const result = checkCriteria(root, 'docs/spec.md', 'tests');
  assert.equal(result.ok, true);
  assert.match(result.message, /docs\/spec\.md/u);
}));

test('criteria con todos los criterios nombrados por una prueba sale en verde e informa cuántos', () => fixture((root) => {
  writeSpec(root);
  writeTests(root, {
    'uno.test.mjs': "test('AC91 · cubre el primero', () => {});\n",
    'dos.test.mjs': "test('FALSIFICACIÓN · AC92 · cubre el segundo', () => {});\n",
  });
  const result = checkCriteria(root, 'docs/spec.md', 'tests');
  assert.deepEqual({ ok: result.ok, dice2: /\b2\b/u.test(result.message) }, { ok: true, dice2: true });
}));

test('FALSIFICACIÓN · criteria nombra el criterio que ninguna prueba menciona y sale en rojo', () => fixture((root) => {
  writeSpec(root);
  writeTests(root, { 'uno.test.mjs': "test('AC91 · cubre sólo el primero', () => {});\n" });
  const result = checkCriteria(root, 'docs/spec.md', 'tests');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_CRITERION_UNCOVERED');
  assert.match(result.message, /AC92/u);
  assert.equal(/AC91/u.test(result.message), false, 'el criterio cubierto no se reporta como faltante');
}));

test('FALSIFICACIÓN · criteria no acepta una mención en comentario, en prosa ni fuera de un archivo de pruebas', () => fixture((root) => {
  writeSpec(root);
  writeTests(root, {
    'uno.test.mjs': "test('AC91 · cubre el primero', () => {});\n// AC92 mencionado en un comentario\nconst nota = \"AC92 en un string\";\n",
    'dos.test.mjs': "test('la prueba habla de AC92 en su prosa sin separarlo', () => {});\n",
    'ayuda.mjs': "test('AC92 · en un archivo que no es de pruebas', () => {});\n",
  });
  const result = checkCriteria(root, 'docs/spec.md', 'tests');
  assert.deepEqual({ ok: result.ok, code: result.code }, { ok: false, code: 'EVIDENCE_TRACE_CRITERION_UNCOVERED' });
  assert.match(result.message, /AC92/u);
}));

test('criteria sobre una spec sin criterios declarados sale en verde: no hay nada que cubrir', () => fixture((root) => {
  writeSpec(root, SPEC_WITHOUT_CRITERIA);
  writeTests(root, {});
  const result = checkCriteria(root, 'docs/spec.md', 'tests');
  assert.equal(result.ok, true);
  assert.match(result.message, /AC/u, 'el verde vacío dice qué forma esperaba encontrar');
}));

test('FALSIFICACIÓN · criteria sale en rojo cuando el directorio de pruebas no se puede leer', () => fixture((root) => {
  writeSpec(root);
  const result = checkCriteria(root, 'docs/spec.md', 'tests-que-no-existen');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_TESTS_UNREADABLE');
  assert.match(result.message, /tests-que-no-existen/u);
}));

test('criteria recorre subdirectorios del árbol de pruebas', () => fixture((root) => {
  writeSpec(root);
  const dir = writeTests(root, { 'uno.test.mjs': "test('AC91 · cubre el primero', () => {});\n" });
  mkdirSync(join(dir, 'anidado'));
  writeFileSync(join(dir, 'anidado', 'dos.test.mjs'), "test('AC92 · cubre el segundo desde un subdirectorio', () => {});\n", 'utf8');
  assert.equal(checkCriteria(root, 'docs/spec.md', 'tests').ok, true);
}));

// --- Comando claims -----------------------------------------------------------------------------

test('claims sobre un feature sin Discovery sale en verde', () => fixture((root) => {
  writeSpec(root);
  const result = checkClaims(root, feature);
  assert.equal(result.ok, true);
  assert.match(result.message, new RegExp(feature, 'u'));
}));

test('claims sin docs/spec.md sale en verde: no hay identificadores contra los cuales verificar', () => fixture((root) => {
  writeDiscovery(root, [claim({ linked_ac_id: 'AC91' })]);
  const result = checkClaims(root, feature);
  assert.equal(result.ok, true);
  assert.match(result.message, /docs\/spec\.md/u);
}));

test('claims con vínculos que existen en la spec sale en verde e informa cuántos verificó', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [
    claim({ linked_ac_id: 'AC91', linked_requirement_id: 'T91' }),
    claim({ claim_id: 'claim-002', source_id: 'source-002', linked_ac_id: 'AC92' }),
  ]);
  const result = checkClaims(root, feature);
  assert.deepEqual({ ok: result.ok, dice3: /\b3\b/u.test(result.message) }, { ok: true, dice3: true });
}));

test('claims con claims sin vínculo declarado sale en verde: no declarar vínculo no es una referencia rota', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [claim()]);
  const result = checkClaims(root, feature);
  assert.deepEqual({ ok: result.ok, dice0: /\b0\b/u.test(result.message) }, { ok: true, dice0: true });
}));

test('FALSIFICACIÓN · claims --require-links rechaza un claim sin vínculo declarado', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [claim()]);
  const result = checkClaims(root, feature, undefined, readDiscoveryHistory, { requireLinks: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_CLAIM_UNLINKED');
  assert.match(result.message, /claim-001/u);
}));

test('FALSIFICACIÓN · claims --require-links identifica un claim sin claim_id', () => fixture((root) => {
  writeSpec(root);
  mkdirSync(join(root, 'docs', 'discovery', feature), { recursive: true });
  const history = () => ({ runs: [{ history: [{ decision: { decision_id: 'd-no-id' }, packet: { research_snapshot: { claims: [{ linked_requirement_id: null, linked_ac_id: null }] } } }] }] });
  const result = checkClaims(root, feature, undefined, history, { requireLinks: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_CLAIM_UNLINKED');
  assert.match(result.message, /<claim sin id>/u);
}));

test('claims --require-links acepta un claim con al menos un vínculo resoluble', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [claim({ linked_ac_id: 'AC91' })]);
  const result = checkClaims(root, feature, undefined, readDiscoveryHistory, { requireLinks: true });
  assert.equal(result.ok, true);
  assert.match(result.message, /1 vínculo/u);
}));

test('FALSIFICACIÓN · claims --require-links rechaza un packet sin claims', () => fixture((root) => {
  writeSpec(root);
  mkdirSync(join(root, 'docs', 'discovery', feature), { recursive: true });
  const emptyHistory = () => ({ runs: [{ history: [{ decision: { decision_id: 'd-empty' }, packet: { research_snapshot: { claims: [] } } }] }] });
  const result = checkClaims(root, feature, undefined, emptyHistory, { requireLinks: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_NO_CLAIMS');
}));

test('FALSIFICACIÓN · claims nombra el claim que cita un identificador que la spec no declara', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [
    claim({ linked_ac_id: 'AC91' }),
    claim({ claim_id: 'claim-roto', source_id: 'source-002', linked_ac_id: 'AC99', linked_requirement_id: 'T99' }),
  ]);
  const result = checkClaims(root, feature);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EVIDENCE_TRACE_CLAIM_REFERENCE_BROKEN');
  assert.match(result.message, /claim-roto/u);
  assert.match(result.message, /AC99/u);
  assert.match(result.message, /T99/u);
}));

test('claims sobre una decisión vigente sin packet sale en verde y dice por qué', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [], { completed: false });
  const result = checkClaims(root, feature);
  assert.equal(result.ok, true);
  assert.match(result.message, /d001/u);
}));

test('FALSIFICACIÓN · claims propaga el rechazo del verificador de historia Discovery, con y sin código', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [claim()]);
  const conCodigo = checkClaims(root, feature, undefined, () => {
    throw Object.assign(new Error('la cadena de decisiones se bifurca'), { code: 'DISCOVERY_CHAIN_NONLINEAR' });
  });
  const sinCodigo = checkClaims(root, feature, undefined, () => { throw new Error('disco ilegible'); });
  assert.deepEqual(
    [{ ok: conCodigo.ok, code: conCodigo.code }, { ok: sinCodigo.ok, code: sinCodigo.code }],
    [{ ok: false, code: 'DISCOVERY_CHAIN_NONLINEAR' }, { ok: false, code: 'EVIDENCE_TRACE_DISCOVERY_INVALID' }],
  );
}));

// --- CLI ----------------------------------------------------------------------------------------

test('parseArgs acepta exactamente las dos formas documentadas', () => {
  assert.deepEqual(parseArgs(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']), { command: 'criteria', spec: 'docs/spec.md', tests: 'tests', requireInputs: false });
  assert.deepEqual(parseArgs(['claims', '--feature', 'integridad-verificable']), { command: 'claims', feature: 'integridad-verificable', requireInputs: false });
});

test('FALSIFICACIÓN · argumentos inválidos salen 2 en los dos subcomandos, sin tocar el disco', () => {
  const invalid = [
    [],
    ['criteria'],
    ['criteria', '--spec', 'docs/spec.md'],
    ['criteria', '--specs', 'docs/spec.md', '--tests', 'tests'],
    ['criteria', '--spec', 'docs/spec.md', '--test', 'tests'],
    ['criteria', '--spec', '', '--tests', 'tests'],
    ['criteria', '--spec', 'docs/spec.md', '--tests', ''],
    ['claims'],
    ['claims', '--feature'],
    ['claims', '--feature', 'Mayúsculas'],
    ['claims', '--feature', 'integridad-verificable', 'extra'],
    ['check', '--feature', 'integridad-verificable'],
  ];
  assert.deepEqual(invalid.map(parseArgs), invalid.map(() => null));
  const errors = [];
  const codes = invalid.map((args) => main(args, '.', () => {}, (line) => errors.push(line)));
  assert.deepEqual(codes, invalid.map(() => 2));
  assert.deepEqual(new Set(errors), new Set([USAGE]));
});

test('main traduce el resultado de cada subcomando a 0 o 1 y escribe OK o REJECTED', () => {
  const written = [];
  const errors = [];
  const checks = {
    criteria: () => ({ ok: true, message: 'todo cerrado' }),
    claims: () => ({ ok: false, code: 'EVIDENCE_TRACE_CLAIM_REFERENCE_BROKEN', message: 'claim-x cita AC99' }),
  };
  const green = main(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests'], '.', (line) => written.push(line), (line) => errors.push(line), checks);
  const red = main(['claims', '--feature', 'demo'], '.', (line) => written.push(line), (line) => errors.push(line), checks);
  assert.deepEqual({ green, red }, { green: 0, red: 1 });
  assert.deepEqual(written, ['OK: todo cerrado']);
  assert.deepEqual(errors, ['REJECTED: EVIDENCE_TRACE_CLAIM_REFERENCE_BROKEN: claim-x cita AC99']);
});

test('el CLI real refleja los exit codes de la librería sobre archivos en disco', () => fixture((root) => {
  writeSpec(root);
  writeTests(root, { 'uno.test.mjs': "test('AC91 · cubre sólo el primero', () => {});\n" });
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });

  const rojo = run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']);
  assert.equal(rojo.status, 1);
  assert.match(rojo.stderr, /AC92/u);

  writeFileSync(join(root, 'tests', 'dos.test.mjs'), "test('AC92 · cubre el segundo', () => {});\n", 'utf8');
  const verde = run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']);
  assert.equal(verde.status, 0);
  assert.match(verde.stdout, /^OK: /u);

  const uso = run(['criteria']);
  assert.deepEqual({ status: uso.status, usa: uso.stderr.includes(USAGE) }, { status: 2, usa: true });

  // Sin Discovery no hay claims: sale 0, pero como VACÍO, no como OK — nada se comparó.
  const claims = run(['claims', '--feature', feature]);
  assert.deepEqual({ status: claims.status, vacio: claims.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });
}));

// --- Verde vacío: distinguir "verifiqué y pasó" de "no había nada que verificar" ----------------

test('cada camino sin entradas se marca vacuous, y los que sí comparan algo no', () => fixture((root) => {
  const vacios = [];
  const llenos = [];

  vacios.push(checkCriteria(root, 'docs/spec.md', 'tests'));
  writeSpec(root, SPEC_WITHOUT_CRITERIA);
  vacios.push(checkCriteria(root, 'docs/spec.md', 'tests'));
  vacios.push(checkClaims(root, feature));
  writeDiscovery(root, [claim()], { completed: false });
  vacios.push(checkClaims(root, feature));
  rmSync(join(root, 'docs', 'spec.md'));
  vacios.push(checkClaims(root, feature));

  writeSpec(root);
  writeTests(root, { 'uno.test.mjs': "test('AC91 · uno', () => {});\ntest('AC92 · dos', () => {});\n" });
  llenos.push(checkCriteria(root, 'docs/spec.md', 'tests'));
  rmSync(join(root, 'docs', 'discovery'), { recursive: true });
  writeDiscovery(root, [claim({ linked_ac_id: 'AC91' })]);
  llenos.push(checkClaims(root, feature));

  assert.deepEqual(vacios.map((r) => [r.ok, r.vacuous]), [[true, true], [true, true], [true, true], [true, true], [true, true]]);
  assert.deepEqual(llenos.map((r) => [r.ok, r.vacuous ?? false]), [[true, false], [true, false]]);
}));

test('main escribe VACÍO en vez de OK cuando el resultado no comparó nada', () => {
  const written = [];
  const checks = {
    criteria: () => ({ ok: true, vacuous: true, message: 'sin docs/spec.md' }),
    claims: () => ({ ok: true, message: '3 vínculo(s) resuelven' }),
  };
  const vacio = main(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests'], '.', (line) => written.push(line), () => {}, checks);
  const lleno = main(['claims', '--feature', 'demo'], '.', (line) => written.push(line), () => {}, checks);

  assert.deepEqual({ vacio, lleno }, { vacio: 0, lleno: 0 });
  assert.deepEqual(written, ['VACÍO: sin docs/spec.md', 'OK: 3 vínculo(s) resuelven']);
});

test('parseArgs acepta --require-inputs como último argumento de los dos subcomandos', () => {
  assert.deepEqual(parseArgs(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs']), { command: 'criteria', spec: 'docs/spec.md', tests: 'tests', requireInputs: true });
  assert.deepEqual(parseArgs(['claims', '--feature', 'demo', '--require-inputs']), { command: 'claims', feature: 'demo', requireInputs: true });
  assert.equal(parseArgs(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']).requireInputs, false);
  assert.equal(parseArgs(['claims', '--feature', 'demo']).requireInputs, false);
});

test('parseArgs acepta --require-links sólo en claims y lo convierte en cierre estricto', () => {
  assert.deepEqual(parseArgs(['claims', '--feature', 'demo', REQUIRE_LINKS_FLAG]), {
    command: 'claims', feature: 'demo', requireInputs: true, requireLinks: true,
  });
  assert.deepEqual(parseArgs([REQUIRE_LINKS_FLAG, 'claims', '--feature', 'demo']), {
    command: 'claims', feature: 'demo', requireInputs: true, requireLinks: true,
  });
  assert.equal(parseArgs(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests', REQUIRE_LINKS_FLAG]), null);
});

test('FALSIFICACIÓN · --require-inputs convierte el verde vacío en rechazo, y no toca al verde real', () => {
  const errors = [];
  const written = [];
  const checks = {
    criteria: () => ({ ok: true, vacuous: true, message: 'sin docs/spec.md: no hay criterios declarados que cubrir.' }),
    claims: () => ({ ok: true, message: '3 vínculo(s) resuelven' }),
  };
  const run = (args) => main(args, '.', (line) => written.push(line), (line) => errors.push(line), checks);

  assert.equal(run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs']), 1);
  assert.equal(run(['claims', '--feature', 'demo', '--require-inputs']), 0);
  assert.deepEqual(errors, [`REJECTED: ${NO_INPUTS_CODE}: sin docs/spec.md: no hay criterios declarados que cubrir.`]);
  assert.deepEqual(written, ['OK: 3 vínculo(s) resuelven']);
});

test('FALSIFICACIÓN · --require-links rechaza el claim sin vínculo en el CLI real', () => fixture((root) => {
  writeSpec(root);
  writeDiscovery(root, [claim()]);
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  const rojo = run(['claims', '--feature', feature, '--require-links']);
  assert.equal(rojo.status, 1);
  assert.match(rojo.stderr, /EVIDENCE_TRACE_CLAIM_UNLINKED/u);

  writeFileSync(join(root, 'docs', 'discovery', feature, 'runs', 'run-001', 'packets', 'd002.json'), json({
    schema: 'vcp.discovery-packet/1',
    decision_id: 'd002',
    research_snapshot: { captured_at: '2026-08-27', claims: [claim({ linked_ac_id: 'AC91' })] },
  }));
  // The packet hash is deliberately refreshed so the fixture remains a real, valid Discovery run.
  const packet = readFileSync(join(root, 'docs', 'discovery', feature, 'runs', 'run-001', 'packets', 'd002.json'));
  writeFileSync(join(root, 'docs', 'discovery', feature, 'runs', 'run-001', 'decisions', 'd002.json'), json({
    schema: 'vcp.discovery-decision/3', run_id: 'run-001', feature_slug: feature, decision_id: 'd002',
    evaluated_at: '2026-08-28', status: 'completed', transition_kind: 'activation', supersedes: 'd001',
    predecessor_hash: hash(json({
      schema: 'vcp.discovery-decision/3', run_id: 'run-001', feature_slug: feature, decision_id: 'd001',
      evaluated_at: '2026-08-27', status: 'pending', transition_kind: 'initial', supersedes: null,
      predecessor_hash: null, previous_status: null, activation_result: 'discovery-result-v1',
      triggers_observed: ['scope'], correction_reason: null, skip: null, override: null,
      packet_ref: null, packet_sha256: null,
    })), previous_status: 'pending', activation_result: 'discovery-result-v1', triggers_observed: ['scope'],
    correction_reason: null, skip: null, override: null, packet_ref: 'packets/d002.json', packet_sha256: hash(packet),
  }));
  const verde = run(['claims', '--feature', feature, '--require-links']);
  assert.equal(verde.status, 0);
  assert.match(verde.stdout, /^OK: /u);
}));

test('FALSIFICACIÓN · el CLI real rechaza el verde vacío bajo --require-inputs sobre un proyecto sin spec', () => fixture((root) => {
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });

  const permisivo = run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']);
  assert.deepEqual({ status: permisivo.status, vacio: permisivo.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });

  const estricto = run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs']);
  assert.equal(estricto.status, 1);
  assert.match(estricto.stderr, new RegExp(NO_INPUTS_CODE, 'u'));

  writeSpec(root);
  writeTests(root, { 'uno.test.mjs': "test('AC91 · uno', () => {});\ntest('AC92 · dos', () => {});\n" });
  const verde = run(['criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs']);
  assert.deepEqual({ status: verde.status, ok: verde.stdout.startsWith('OK: ') }, { status: 0, ok: true });
}));

// --- claims --spec: contra QUÉ spec resuelven los vínculos ---------------------------------------
// Un packet es inmutable y pertenece a un feature; docs/spec.md rota con el feature activo.
// Resolver siempre contra la activa hace que un vínculo correcto se rompa al rotar, y —peor— que
// un identificador que la activa reutiliza para otra cosa resuelva en verde significando otra cosa.

test('parseArgs acepta claims --spec para resolver contra la spec del propio feature', () => {
  assert.deepEqual(parseArgs(['claims', '--feature', feature, '--spec', 'docs/archivo/spec.md']), {
    command: 'claims',
    feature,
    spec: 'docs/archivo/spec.md',
    requireInputs: false,
  });
});

test('claims --spec resuelve los vínculos contra la spec indicada, no contra docs/spec.md', () => fixture((root) => {
  writeSpec(root, SPEC_WITHOUT_CRITERIA);
  mkdirSync(join(root, 'docs', 'archivo'), { recursive: true });
  writeFileSync(join(root, 'docs', 'archivo', 'spec.md'), SPEC, 'utf8');
  writeDiscovery(root, [claim({ linked_ac_id: 'AC91' })]);
  const result = checkClaims(root, feature, undefined, undefined, { spec: 'docs/archivo/spec.md' });
  assert.equal(result.ok, true);
  assert.match(result.message, /docs\/archivo\/spec\.md/u);
}));

test('FALSIFICACIÓN · el vínculo que la spec activa daba por bueno sale rojo contra la spec que de verdad le corresponde', () => fixture((root) => {
  writeSpec(root);
  mkdirSync(join(root, 'docs', 'archivo'), { recursive: true });
  writeFileSync(join(root, 'docs', 'archivo', 'spec.md'), SPEC_WITHOUT_CRITERIA, 'utf8');
  writeDiscovery(root, [claim({ linked_ac_id: 'AC91' })]);
  assert.equal(checkClaims(root, feature).ok, true);
  const result = checkClaims(root, feature, undefined, undefined, { spec: 'docs/archivo/spec.md' });
  assert.deepEqual({ ok: result.ok, code: result.code }, {
    ok: false,
    code: 'EVIDENCE_TRACE_CLAIM_REFERENCE_BROKEN',
  });
}));

test('FALSIFICACIÓN · claims con --spec vacío no resuelve contra nada: es uso inválido, no un verde', () => {
  assert.equal(parseArgs(['claims', '--feature', feature, '--spec', '']), null);
  assert.equal(parseArgs(['claims', '--feature', feature, '--spec']), null);
});

test('main reenvía --spec al chequeo de claims, y sin la bandera no inventa ninguna', () => {
  const visto = [];
  const checks = {
    criteria: () => ({ ok: true, message: 'ok' }),
    claims: (...args) => {
      visto.push(args.at(-1));
      return { ok: true, message: 'ok' };
    },
  };
  const noop = () => {};
  main(['claims', '--feature', 'demo', '--spec', 'docs/archivo/spec.md'], '.', noop, noop, checks);
  main(['claims', '--feature', 'demo'], '.', noop, noop, checks);
  assert.deepEqual(visto, [
    { requireLinks: false, spec: 'docs/archivo/spec.md' },
    { requireLinks: false },
  ]);
});

test('claims combina --spec con --require-links: el modo estricto también vale para un feature cerrado', () => {
  assert.deepEqual(parseArgs(['claims', '--feature', feature, '--spec', 'docs/archivo/spec.md', REQUIRE_LINKS_FLAG]), {
    command: 'claims',
    feature,
    spec: 'docs/archivo/spec.md',
    requireInputs: true,
    requireLinks: true,
  });
});
