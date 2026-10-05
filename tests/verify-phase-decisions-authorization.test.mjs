import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-phase-decisions.mjs');
// Namespace y no import con nombre: así cada prueba falla por su cuenta cuando la API no existe,
// en vez de que un export ausente tumbe el archivo entero antes de correr nada.
const gate = await import(pathToFileURL(script).href);

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const PLAN_TEXT = '# Plan\n\nlotes 1 a 4\n';
const PLAN_SHA = sha(PLAN_TEXT);
const PHASES = ['5', '6', '7'];

const AUTH = Object.freeze({
  plan_path: 'docs/plan.md',
  plan_sha256: PLAN_SHA,
  approved_at: '2026-10-05T12:00:00Z',
  approval_ref: 'mensaje directo del operador en su sesion, 2026-10-05',
  phases: ['5', '6'],
  paths: ['scripts/', 'tests/'],
  change_classes: ['codigo', 'pruebas', 'documentacion'],
  deliverables: ['modo continuo'],
  reserved: ['push', 'merge', 'deploy', 'payment', 'global-install', 'license', 'trading'],
});

function authorized(auth, overrides = {}) {
  return {
    phase_id: '5',
    phase_name: 'Build',
    status: 'authorized',
    authorized_by: gate.authorizationDigest(auth),
    evidence: 'verify-phase-decisions OK, suite 2213/2211, recibo .vibe/receipts/lote-1.json',
    timestamp: '2026-10-05T13:00:00Z',
    ...overrides,
  };
}

function seal(rows, phaseOrder = PHASES) {
  let previous = '';
  return rows.map((base) => {
    const row = { ...base, previous_hash: previous, current_hash: '' };
    row.current_hash = gate.hashDecision(previous, row, phaseOrder);
    previous = row.current_hash;
    return row;
  });
}

function document(auth, rows, extra = {}) {
  return { schema: gate.SCHEMA, phase_order: PHASES, authorization: auth, decisions: seal(rows), ...extra };
}

const codes = (result) => result.violations.map((v) => v.code);

test('L1.1 · una autorizacion completa se acepta y una que le falta una pieza se rechaza', () => {
  assert.deepEqual(gate.validateAuthorization(AUTH), []);
  for (const falta of ['plan_path', 'plan_sha256', 'approved_at', 'approval_ref', 'phases', 'paths', 'change_classes', 'deliverables', 'reserved']) {
    const incompleta = { ...AUTH };
    delete incompleta[falta];
    assert.ok(gate.validateAuthorization(incompleta).length > 0, `sin ${falta} no puede ser una aprobacion`);
  }
  assert.ok(gate.validateAuthorization({ ...AUTH, extra: 1 }).length > 0, 'una clave de mas tampoco');
  assert.ok(gate.validateAuthorization(null).length > 0);
});

test('FALSIFICACION · L1.1 · una autorizacion que incluye una accion reservada se rechaza', () => {
  for (const reservada of ['push', 'merge', 'deploy', 'payment', 'global-install', 'license', 'trading']) {
    const problemas = gate.validateAuthorization({ ...AUTH, change_classes: ['codigo', reservada] });
    assert.ok(problemas.some((p) => p.code === 'PHASE_DECISION_AUTH_RESERVED_INCLUDED'), `${reservada} no puede venir adentro del alcance`);
  }
  const sinDeclarar = gate.validateAuthorization({ ...AUTH, reserved: ['push'] });
  assert.ok(sinDeclarar.some((p) => p.code === 'PHASE_DECISION_AUTH_RESERVED_MISSING'), 'la aprobacion tiene que decir explicitamente que deja afuera cada accion reservada');
});

test('L1.1 · los campos mal formados se nombran uno por uno', () => {
  const malos = {
    plan_path: ['', '/etc/plan.md', '../plan.md', 'docs\\plan.md', 42],
    plan_sha256: ['', 'abc', 'G'.repeat(64)],
    approved_at: ['ayer', '', '2026-13-45T00:00:00Z'],
    approval_ref: ['', '   '],
    phases: [[], [''], ['5', '5'], 'x'],
    paths: [[], ['']],
    change_classes: [[], ['']],
    deliverables: [[], ['']],
  };
  for (const [campo, valores] of Object.entries(malos)) {
    for (const valor of valores) {
      assert.ok(gate.validateAuthorization({ ...AUTH, [campo]: valor }).length > 0, `${campo}=${JSON.stringify(valor)} debia rechazarse`);
    }
  }
});

test('L1.1 · el digest de la autorizacion no depende del orden de las claves y si de su contenido', () => {
  const reordenada = Object.fromEntries(Object.entries(AUTH).reverse());
  assert.equal(gate.authorizationDigest(reordenada), gate.authorizationDigest(AUTH));
  assert.notEqual(gate.authorizationDigest({ ...AUTH, phases: ['5', '6', '7'] }), gate.authorizationDigest(AUTH));
  assert.match(gate.authorizationDigest(AUTH), /^[0-9a-f]{64}$/u);
});

test('L1.2 · una fase incluida en un plan aprobado cierra con la referencia a la autorizacion, sin menu inventado', () => {
  const result = gate.checkDecisions(document(AUTH, [authorized(AUTH)]), { planSha256: PLAN_SHA });
  assert.deepEqual(codes(result), []);
  assert.equal(result.ok, true);
  assert.match(result.summary, /autorizada/u, 'el resumen dice cuantas se cerraron por autorizacion');
});

test('L1.2 · dos fases autorizadas seguidas y la completitud exigida cuentan como cerradas', () => {
  const rows = [authorized(AUTH), authorized(AUTH, { phase_id: '6', phase_name: 'Triangulate', timestamp: '2026-10-05T14:00:00Z' })];
  const auth = { ...AUTH, phases: ['5', '6', '7'] };
  const doc = { schema: gate.SCHEMA, phase_order: ['5', '6'], authorization: auth, decisions: seal(rows.map((r) => ({ ...r, authorized_by: gate.authorizationDigest(auth) })), ['5', '6']) };
  const result = gate.checkDecisions(doc, { planSha256: PLAN_SHA, requireComplete: true });
  assert.deepEqual(codes(result), []);
});

test('FALSIFICACION · L1.3 · una fase fuera del alcance aprobado no hereda la aprobacion', () => {
  const fuera = authorized(AUTH, { phase_id: '7', phase_name: 'Deploy' });
  const result = gate.checkDecisions(document(AUTH, [authorized(AUTH), authorized(AUTH, { phase_id: '6', phase_name: 'Triangulate', timestamp: '2026-10-05T14:00:00Z' }), fuera]), { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_OUT_OF_SCOPE'), codes(result).join(','));
});

test('FALSIFICACION · L1.3 · un plan editado despues de aprobado no hereda la aprobacion', () => {
  const result = gate.checkDecisions(document(AUTH, [authorized(AUTH)]), { planSha256: sha(`${PLAN_TEXT}un lote nuevo\n`) });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_STALE'));
  const sinPlan = gate.checkDecisions(document(AUTH, [authorized(AUTH)]), { planSha256: null });
  assert.ok(codes(sinPlan).includes('PHASE_DECISION_AUTH_PLAN_MISSING'));
  const sinVerificar = gate.checkDecisions(document(AUTH, [authorized(AUTH)]));
  assert.ok(codes(sinVerificar).includes('PHASE_DECISION_AUTH_PLAN_UNVERIFIED'), 'no se puede dejar pasar un verde sin haber mirado el plan');
});

test('FALSIFICACION · L1.3 · editar el alcance despues de sellar las filas rompe la referencia', () => {
  const doc = document(AUTH, [authorized(AUTH)]);
  doc.authorization = { ...AUTH, phases: ['5', '6', '7'] };
  const result = gate.checkDecisions(doc, { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_REF_MISMATCH'));
});

test('FALSIFICACION · L1.3 · una fila autorizada sin autorizacion en el documento se rechaza', () => {
  const doc = { schema: gate.SCHEMA, phase_order: PHASES, decisions: seal([authorized(AUTH)]) };
  const result = gate.checkDecisions(doc, { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_MISSING'));
});

test('FALSIFICACION · L1.3 · una autorizacion invalida en el documento se rechaza aunque no haya filas autorizadas', () => {
  const doc = document({ ...AUTH, change_classes: ['push'] }, []);
  const result = gate.checkDecisions(doc, { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_RESERVED_INCLUDED'));
});

test('FALSIFICACION · L1.3 · una fila autorizada anterior a la aprobacion es imposible', () => {
  const result = gate.checkDecisions(document(AUTH, [authorized(AUTH, { timestamp: '2026-10-05T11:00:00Z' })]), { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_AUTH_BEFORE_APPROVAL'));
});

test('FALSIFICACION · L1.3 · una fila autorizada sin evidencia es una afirmacion vacia', () => {
  for (const evidence of ['', '   ', 7]) {
    const result = gate.checkDecisions(document(AUTH, [authorized(AUTH, { evidence })]), { planSha256: PLAN_SHA });
    assert.ok(codes(result).includes('PHASE_DECISION_FIELD_INVALID'), `evidence=${JSON.stringify(evidence)}`);
  }
  const extra = gate.checkDecisions(document(AUTH, [authorized(AUTH, { options: ['A', 'B'] })]), { planSha256: PLAN_SHA });
  assert.ok(codes(extra).includes('PHASE_DECISION_SCHEMA_INVALID'), 'una fila autorizada con menu es justo la eleccion fabricada que se prohibe');
});

test('FALSIFICACION · L1.4 · una eleccion humana dentro de una fase que el plan ya incluye es una eleccion fabricada', () => {
  const eleccion = {
    phase_id: '5',
    phase_name: 'Build',
    options: ['A) seguir', 'B) frenar'],
    recommendation: 'A) seguir',
    selected_option: 'A) seguir',
    reason: 'parece razonable',
    shown_at: '2026-10-05T12:59:00Z',
    timestamp: '2026-10-05T13:00:00Z',
    input_hash: sha('x'),
    status: 'decided',
  };
  const doc = { schema: gate.SCHEMA, phase_order: PHASES, authorization: AUTH, decisions: [] };
  doc.decisions = [{ ...eleccion, previous_hash: '', current_hash: gate.hashDecision('', eleccion, PHASES) }];
  const result = gate.checkDecisions(doc, { planSha256: PLAN_SHA });
  assert.ok(codes(result).includes('PHASE_DECISION_FABRICATED_CHOICE'), codes(result).join(','));
  // Y la misma eleccion en una fase que el plan NO incluye sigue siendo legitima: es una decision nueva.
  const fuera = { ...eleccion, phase_id: '7', phase_name: 'Deploy' };
  const legit = { schema: gate.SCHEMA, phase_order: PHASES, authorization: AUTH, decisions: [{ ...fuera, previous_hash: '', current_hash: gate.hashDecision('', fuera, PHASES) }] };
  assert.equal(gate.checkDecisions(legit, { planSha256: PLAN_SHA }).ok, false, 'faltan las fases 5 y 6 antes: esta prueba mira solo que no sea FABRICATED');
  assert.ok(!codes(gate.checkDecisions(legit, { planSha256: PLAN_SHA })).includes('PHASE_DECISION_FABRICATED_CHOICE'));
});

test('L1.4 · un documento sin autorizacion se comporta exactamente como antes', () => {
  const eleccion = {
    phase_id: '5',
    phase_name: 'Build',
    options: ['A) seguir', 'B) frenar'],
    recommendation: 'A) seguir',
    selected_option: 'A) seguir',
    reason: 'parece razonable',
    shown_at: '2026-10-05T12:59:00Z',
    timestamp: '2026-10-05T13:00:00Z',
    input_hash: sha('x'),
    status: 'decided',
  };
  const doc = { schema: gate.SCHEMA, phase_order: ['5'], decisions: [{ ...eleccion, previous_hash: '', current_hash: gate.hashDecision('', eleccion, ['5']) }] };
  assert.equal(gate.checkDecisions(doc).ok, true);
});

test('CLI · main lee el plan que la autorizacion declara y lo compara por contenido', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-auth-'));
  try {
    mkdirSync(join(raiz, 'docs'));
    writeFileSync(join(raiz, 'docs', 'plan.md'), PLAN_TEXT);
    writeFileSync(join(raiz, 'docs', 'phase-decisions.json'), JSON.stringify(document(AUTH, [authorized(AUTH)])));
    const ok = spawnSync(process.execPath, [script, 'check', 'docs/phase-decisions.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /autorizada/u);

    writeFileSync(join(raiz, 'docs', 'plan.md'), `${PLAN_TEXT}editado despues\n`);
    const stale = spawnSync(process.execPath, [script, 'check', 'docs/phase-decisions.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /PHASE_DECISION_AUTH_STALE/u);

    rmSync(join(raiz, 'docs', 'plan.md'));
    const faltante = spawnSync(process.execPath, [script, 'check', 'docs/phase-decisions.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(faltante.status, 1);
    assert.match(faltante.stderr, /PHASE_DECISION_AUTH_PLAN_MISSING/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('CLI · los finales de linea del plan no cambian su identidad', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-auth-crlf-'));
  try {
    mkdirSync(join(raiz, 'docs'));
    writeFileSync(join(raiz, 'docs', 'plan.md'), PLAN_TEXT.replaceAll('\n', '\r\n'));
    writeFileSync(join(raiz, 'docs', 'phase-decisions.json'), JSON.stringify(document(AUTH, [authorized(AUTH)])));
    const run = spawnSync(process.execPath, [script, 'check', 'docs/phase-decisions.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(run.status, 0, `el mismo plan con CRLF es el mismo plan: ${run.stdout}${run.stderr}`);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · una fila autorizada con campos rotos nombra cada uno', () => {
  const rota = (cambio) => gate.checkDecisions({
    schema: gate.SCHEMA,
    phase_order: PHASES,
    authorization: AUTH,
    decisions: [{ ...authorized(AUTH), ...cambio, previous_hash: cambio.previous_hash ?? '', current_hash: cambio.current_hash ?? sha('x') }],
  }, { planSha256: PLAN_SHA });
  assert.ok(codes(rota({ phase_id: '' })).includes('PHASE_DECISION_FIELD_INVALID'));
  assert.ok(codes(rota({ phase_name: ' ' })).includes('PHASE_DECISION_FIELD_INVALID'));
  assert.ok(codes(rota({ phase_id: '99' })).includes('PHASE_DECISION_PHASE_UNKNOWN'));
  assert.ok(codes(rota({ authorized_by: 'abc' })).includes('PHASE_DECISION_FIELD_INVALID'));
  assert.ok(codes(rota({ timestamp: 'ayer' })).includes('PHASE_DECISION_FIELD_INVALID'));
  assert.ok(codes(rota({ previous_hash: 'zzz' })).includes('PHASE_DECISION_FIELD_INVALID'));
  assert.ok(codes(rota({ current_hash: 'zzz' })).includes('PHASE_DECISION_FIELD_INVALID'));
});

test('L1.1 · reserved que no es una lista se rechaza nombrando todo lo que falta', () => {
  const problemas = gate.validateAuthorization({ ...AUTH, reserved: 'push' });
  assert.ok(problemas.some((p) => p.code === 'PHASE_DECISION_AUTH_RESERVED_MISSING' && /merge/u.test(p.message)));
});

test('FALSIFICACION · una ruta de plan que se sale del proyecto no se abre', () => {
  const leidos = [];
  const doc = document({ ...AUTH, plan_path: '../fuera.md' }, [authorized({ ...AUTH, plan_path: '../fuera.md' })]);
  const errores = [];
  const code = gate.main(['check', 'docs/phase-decisions.json'], {
    readFile: (path) => {
      leidos.push(path);
      return JSON.stringify(doc);
    },
  }, () => {}, (line) => errores.push(line));
  assert.equal(code, 1);
  assert.deepEqual(leidos, ['docs/phase-decisions.json'], 'solo se abre el registro: la ruta insegura nunca llega a leerse');
  assert.match(errores.join('\n'), /PHASE_DECISION_AUTH_INVALID/u);
});

test('FALSIFICACION · un plan que existe pero no se puede leer es un rechazo, no un plan ausente', () => {
  const doc = document(AUTH, [authorized(AUTH)]);
  const errores = [];
  const code = gate.main(['check', 'docs/phase-decisions.json'], {
    readFile: (path) => {
      if (path.endsWith('plan.md')) throw Object.assign(new Error('permiso denegado'), { code: 'EACCES' });
      return JSON.stringify(doc);
    },
  }, () => {}, (line) => errores.push(line));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /PHASE_DECISION_AUTH_PLAN_UNREADABLE.*permiso denegado/u);
});

test('L1.2 · verify-phase-menu cierra una fase autorizada y rechaza un plan cambiado', () => {
  const menu = join(repoRoot, 'scripts', 'verify-phase-menu.mjs');
  const raiz = mkdtempSync(join(tmpdir(), 'ia-auth-menu-'));
  try {
    mkdirSync(join(raiz, 'docs'));
    writeFileSync(join(raiz, 'docs', 'plan.md'), PLAN_TEXT);
    const doc = { schema: gate.SCHEMA, phase_order: ['5', '6'], authorization: AUTH, decisions: seal([authorized(AUTH), authorized(AUTH, { phase_id: '6', phase_name: 'Triangulate', timestamp: '2026-10-05T14:00:00Z' })], ['5', '6']) };
    writeFileSync(join(raiz, 'docs', 'phase-decisions.json'), JSON.stringify(doc));
    writeFileSync(join(raiz, 'docs', 'phase-plan.json'), JSON.stringify({ schema: 'ia.phase-plan/1', feature: 'modo-continuo', phase_order: ['5', '6'] }));
    const ok = spawnSync(process.execPath, [menu, 'check', 'docs/phase-decisions.json', '--plan', 'docs/phase-plan.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);

    writeFileSync(join(raiz, 'docs', 'plan.md'), `${PLAN_TEXT}cambiado\n`);
    const stale = spawnSync(process.execPath, [menu, 'check', 'docs/phase-decisions.json', '--plan', 'docs/phase-plan.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /PHASE_DECISION_AUTH_STALE/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · verify-phase-menu rechaza un plan aprobado que existe pero no se puede leer', () => {
  const menu = join(repoRoot, 'scripts', 'verify-phase-menu.mjs');
  const raiz = mkdtempSync(join(tmpdir(), 'ia-auth-menu-ilegible-'));
  try {
    mkdirSync(join(raiz, 'docs'));
    // La ruta del plan apunta a un directorio: existe, pero leerla falla con algo que no es ENOENT.
    const auth = { ...AUTH, plan_path: 'docs' };
    const doc = { schema: gate.SCHEMA, phase_order: ['5'], authorization: auth, decisions: seal([authorized(auth)], ['5']) };
    writeFileSync(join(raiz, 'docs', 'phase-decisions.json'), JSON.stringify(doc));
    writeFileSync(join(raiz, 'docs', 'phase-plan.json'), JSON.stringify({ schema: 'ia.phase-plan/1', feature: 'modo-continuo', phase_order: ['5'] }));
    const run = spawnSync(process.execPath, [menu, 'check', 'docs/phase-decisions.json', '--plan', 'docs/phase-plan.json'], { cwd: raiz, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /PHASE_DECISION_AUTH_PLAN_UNREADABLE/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
