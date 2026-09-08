// `vcp.receipt/v3`: separar un LIMITE de una REGRESION, y exigir soporte y refutación.
//
// LA HERIDA, medida sobre un proyecto real en septiembre de 2026. Un constructor puso un permiso
// correcto, midió que eso dejaba a un rol sin una pantalla, lo escribió con precisión en el
// docstring —archivo, rango y permiso— y entregó la tarea como hecha. La declaración era honesta y
// detallada, **y eso es justamente lo que la hace fácil de aceptar sin mirarla**. Un límite se
// declara; una regresión se resuelve o se revierte. El campo `not_reviewed` del receipt no los
// separaba: es un solo string, y lo único que valida es que no sea un relleno.
//
// EL DISCRIMINADOR ES MECANICO, NO DE CRITERIO: el campo `before`. Un límite no lo tiene, porque
// nunca anduvo. Una regresión sí, porque había un estado anterior medible. Una entrada con `before`
// no puede vivir en `limits[]`, y el gate lo dice con esas palabras.
//
// Y EL DOD NO PREGUNTABA POR EL SOPORTE. Exigía cobertura, lint, typecheck, documentación y
// seguridad limpia, y nunca «si alguien dice que no le anda, ¿con qué se lo diagnostica?». En el
// proyecto real ése resultó ser el hueco más grande —sin identificador de petición, sin autor en
// las operaciones— y ningún gate lo veía, porque la cobertura estaba en 100%. La cobertura mide
// ejecución del código; el soporte mide observabilidad del producto. Son ejes distintos.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REGRESSION_RESOLUTIONS, SUPPORT_FIELDS, V3_SCHEMA,
  readDecisionSeals, validateDeclaredField, validateLimits, validateRefutation,
  validateRegressions, validateSupport,
} from '../scripts/verify-receipt.mjs';

const SELLO_A = 'a'.repeat(64);
const SELLO_B = 'b'.repeat(64);

// --- Límite vs regresión ---------------------------------------------------------------------

const LIMITE = { id: 'L1', what: 'No cubre el import masivo desde CSV', why_acceptable: 'Nunca existió y nadie lo pidió en esta vuelta', owner: 'santi' };
const REGRESION = {
  id: 'R1',
  what: 'El rol auditor pierde la pantalla de reportes',
  before: 'el rol auditor veía la pantalla de reportes',
  after: 'recibe 403 al abrirla',
  evidence: 'tests/authz.test.mjs · AC7 → 1 failing',
  resolution: 'fixed',
};

test('un límite bien formado pasa, y una lista vacía también: no todo cambio deja límites', () => {
  assert.deepEqual(validateLimits([LIMITE]), { ok: true });
  assert.deepEqual(validateLimits([]), { ok: true });
});

test('EL DISCRIMINADOR · una entrada con `before` no puede ser un límite: tuvo un estado anterior', () => {
  const r = validateLimits([{ ...LIMITE, before: 'el rol auditor veía la pantalla' }]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /before/u);
  assert.match(r.reason, /regressions/u);
});

test('a un límite le faltan campos y el rechazo nombra cuál', () => {
  for (const campo of ['id', 'what', 'why_acceptable', 'owner']) {
    const roto = { ...LIMITE };
    delete roto[campo];
    const r = validateLimits([roto]);
    assert.equal(r.ok, false, campo);
    assert.match(r.reason, new RegExp(campo, 'u'));
  }
});

test('una regresión resuelta o revertida pasa sin pedir decisión humana', () => {
  assert.deepEqual(validateRegressions([REGRESION], new Set()), { ok: true });
  assert.deepEqual(validateRegressions([{ ...REGRESION, resolution: 'reverted' }], new Set()), { ok: true });
  assert.deepEqual(validateRegressions([], new Set()), { ok: true });
});

test('una regresión sin `before` no es una regresión: sin estado anterior no hay nada que comparar', () => {
  const sin = { ...REGRESION };
  delete sin.before;
  const r = validateRegressions([sin], new Set());
  assert.equal(r.ok, false);
  assert.match(r.reason, /before/u);
});

test('la resolución tiene que ser una de las tres, y el rechazo las nombra', () => {
  const r = validateRegressions([{ ...REGRESION, resolution: 'documentada' }], new Set());
  assert.equal(r.ok, false);
  for (const v of REGRESSION_RESOLUTIONS) assert.match(r.reason, new RegExp(v, 'u'));
});

test('LA REGLA DURA · aceptar una regresión exige una decisión humana registrada que resuelva de verdad', () => {
  const aceptada = { ...REGRESION, resolution: 'accepted_by_user' };

  const sinRef = validateRegressions([aceptada], new Set([SELLO_A]));
  assert.equal(sinRef.ok, false);
  assert.match(sinRef.reason, /user_decision_ref/u);

  const refInventada = validateRegressions([{ ...aceptada, user_decision_ref: SELLO_B }], new Set([SELLO_A]));
  assert.equal(refInventada.ok, false);
  assert.match(refInventada.reason, /phase-decisions/u);

  assert.deepEqual(validateRegressions([{ ...aceptada, user_decision_ref: SELLO_A }], new Set([SELLO_A])), { ok: true });
});

test('los sellos salen de las decisiones VIGENTES: una reemplazada ya no autoriza nada', () => {
  const doc = {
    decisions: [
      { status: 'decided', current_hash: SELLO_A },
      { status: 'superseded', current_hash: SELLO_B },
    ],
  };
  assert.deepEqual([...readDecisionSeals(doc)], [SELLO_A]);
  assert.deepEqual([...readDecisionSeals(null)], []);
  assert.deepEqual([...readDecisionSeals({ decisions: 'no es lista' })], []);
});

// --- Soporte ---------------------------------------------------------------------------------

const SOPORTE = {
  correlation: 'cada petición lleva X-Request-Id y sale en toda línea de log',
  actor_on_writes: 'toda escritura graba actor_id del token verificado',
  failure_visible: 'el endpoint /health y el contador de 5xx en el panel',
  diagnostic_command: 'grep <request-id> logs/app.log | head -50',
};

test('el soporte declarado pasa, y sus cuatro campos son los que el DoD exige', () => {
  assert.deepEqual(SUPPORT_FIELDS, ['correlation', 'actor_on_writes', 'failure_visible', 'diagnostic_command']);
  assert.deepEqual(validateSupport(SOPORTE), { ok: true });
});

test('un campo de soporte ausente rechaza, y el rechazo lo nombra', () => {
  for (const campo of SUPPORT_FIELDS) {
    const roto = { ...SOPORTE };
    delete roto[campo];
    const r = validateSupport(roto);
    assert.equal(r.ok, false, campo);
    assert.match(r.reason, new RegExp(campo, 'u'));
  }
});

test('«no hay» se admite CON motivo: un producto sin correlación puede ser honesto, callarlo no', () => {
  assert.deepEqual(validateSupport({ ...SOPORTE, correlation: 'ninguno — es un CLI de una sola corrida, no hay peticiones que correlacionar' }), { ok: true });
  assert.deepEqual(validateSupport({ ...SOPORTE, correlation: 'none — single-shot CLI, there are no requests' }), { ok: true });
});

test('«ninguno» pelado rechaza en los dos idiomas: es el relleno que se lee como respuesta', () => {
  for (const relleno of ['ninguno', 'none', 'nada', 'n/a', 'unknown', '  ', 'ninguno —']) {
    const r = validateSupport({ ...SOPORTE, correlation: relleno });
    assert.equal(r.ok, false, `«${relleno}» tendría que rechazar`);
  }
});

test('validateDeclaredField nombra el campo que falla, para que sirva a cualquier campo', () => {
  assert.deepEqual(validateDeclaredField('algo real y suficientemente largo', 'mi_campo'), { ok: true });
  const r = validateDeclaredField('none', 'mi_campo');
  assert.equal(r.ok, false);
  assert.match(r.reason, /mi_campo/u);
});

// --- Refutación ------------------------------------------------------------------------------

const REFUTACION = { proposed: 60, survived: 18, refuted: 40, inconclusive: 2, by_lens: { risk: 8, readability: 3, reliability: 4, resilience: 3 } };

test('el conteo de refutación pasa cuando cierra', () => {
  assert.deepEqual(validateRefutation(REFUTACION), { ok: true });
});

test('un conteo que no suma se rechaza: refutar es un hecho contable, no una impresión', () => {
  const r = validateRefutation({ ...REFUTACION, refuted: 39 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /propuest|proposed/iu);
});

test('sin ningún hallazgo propuesto el bloque sigue siendo válido: no todo cambio levanta hallazgos', () => {
  assert.deepEqual(validateRefutation({ proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: {} }), { ok: true });
});

test('los conteos tienen que ser enteros no negativos', () => {
  for (const malo of [-1, 1.5, '3', null]) {
    assert.equal(validateRefutation({ ...REFUTACION, inconclusive: malo }).ok, false, String(malo));
  }
});

test('el esquema v3 es el que se declara', () => {
  assert.equal(V3_SCHEMA, 'vcp.receipt/v3');
});

// --- Basura por la puerta: ninguna de estas funciones lanza nunca ------------------------------

test('las tres listas rechazan lo que no es una lista, y una entrada que no es objeto', () => {
  assert.equal(validateLimits('no es lista').ok, false);
  assert.equal(validateLimits([null]).ok, false);
  assert.equal(validateLimits(['texto suelto']).ok, false);
  assert.equal(validateRegressions('no es lista', new Set()).ok, false);
  assert.equal(validateRegressions([null], new Set()).ok, false);
});

test('una entrada sin id se nombra «(sin id)» en vez de romper el mensaje', () => {
  assert.match(validateLimits([{ before: 'algo' }]).reason, /\(sin id\)/u);
  assert.match(validateLimits([{}]).reason, /\(sin id\)/u);
  assert.match(validateRegressions([{}], new Set()).reason, /\(sin id\)/u);
});

test('una regresión sin resolución se rechaza nombrando que no hay ninguna', () => {
  const sinResolucion = { id: 'R9', what: 'x', before: 'a', after: 'b', evidence: 'cmd' };
  const r = validateRegressions([sinResolucion], new Set());
  assert.equal(r.ok, false);
  assert.match(r.reason, /null/u);
});

test('el soporte rechaza lo que no es un objeto', () => {
  for (const basura of [null, 'texto', [], 7]) assert.equal(validateSupport(basura).ok, false, String(basura));
});

test('la refutación rechaza basura sin lanzar', () => {
  assert.equal(validateRefutation(null).ok, false);
  assert.equal(validateRefutation([]).ok, false);
  assert.equal(validateRefutation({ proposed: 0, survived: 0, refuted: 0, inconclusive: 0 }).ok, false);
  assert.equal(validateRefutation({ proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: 'x' }).ok, false);
  assert.equal(validateRefutation({ proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: { risk: -2 } }).ok, false);
  assert.match(validateRefutation({ survived: 0, refuted: 0, inconclusive: 0, by_lens: {} }).reason, /proposed/u);
});

test('un sello de decisión mal formado no entra al conjunto', () => {
  assert.deepEqual([...readDecisionSeals({ decisions: [null, 'texto', { status: 'decided' }, { status: 'decided', current_hash: '' }] })], []);
});

// --- v3 compone v2, y sin sellos inyectados no autoriza una regresion aceptada -----------------

test('validateReceiptV3 sin sellos inyectados trata el conjunto como vacío, nunca como permisivo', async () => {
  const { createHash } = await import('node:crypto');
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { validateReceiptV3 } = await import('../scripts/verify-receipt.mjs');

  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const archivo = 'LICENSE';
  const hash = createHash('sha256').update(readFileSync(join(repoRoot, archivo))).digest('hex');

  const receipt = {
    schema: V3_SCHEMA, feature: 'f', task: 'T01',
    scope: { declared_paths: [archivo] },
    acceptance_criteria: [{ ac_id: 'AC-1', scenario: 'x', verdict: 'COMPLIANT', test_file: archivo, test_hash_sha256: hash, command: 'node --test', result: '1 pass' }],
    review_4r: { risk: {}, readability: {}, reliability: {}, resilience: {} },
    measurements: [{ metric: 'm', measured: true, before: 0, after: 1 }],
    reproduction: 'node --test', not_reviewed: 'none — todo el alcance declarado',
    evidence: ['node --test -> 1 pass'], git_head: 'x', tree_fingerprint: 'y',
    terminal_state: 'approved',
    limits: [], support: SOPORTE, refutation: { proposed: 0, survived: 0, refuted: 0, inconclusive: 0, by_lens: {} },
    regressions: [{ id: 'R1', what: 'x', before: 'andaba', after: 'no anda', evidence: 'cmd', resolution: 'accepted_by_user', user_decision_ref: SELLO_A }],
  };

  // Sin `options`, el conjunto de sellos es vacío: una aceptación que nadie registró no pasa.
  const sinSellos = validateReceiptV3(receipt, repoRoot);
  assert.equal(sinSellos.ok, false);
  assert.match(sinSellos.reason, /phase-decisions/u);

  // Con el sello inyectado, la misma aceptación resuelve.
  assert.deepEqual(validateReceiptV3(receipt, repoRoot, { decisionSeals: new Set([SELLO_A]) }), { ok: true });
});
