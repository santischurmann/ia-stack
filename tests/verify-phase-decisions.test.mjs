import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chainHashFor } from '../scripts/verify-audit-chain.mjs';
import {
  MIN_OPTIONS,
  SCHEMA,
  STATUSES,
  USAGE,
  checkDecisions,
  decisionPayload,
  hashDecision,
  main,
} from '../scripts/verify-phase-decisions.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-phase-decisions.mjs');
const TEMPLATE = 'templates/phase-decisions.json';
const PHASES = ['0', '1', '2', '3', '4'];

// El encadenado NO se reimplementa acá: se importa `chainHashFor` de verify-audit-chain.mjs, que ya
// fija el criterio del repo. Así la prueba comprueba, además del gate, que ambos gates sellan con la
// misma fórmula — si verify-phase-decisions.mjs inventara la suya, todos estos fixtures saldrían mal.
const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const CONTENT_FIELDS = ['phase_id', 'phase_name', 'options', 'recommendation', 'selected_option', 'reason', 'timestamp', 'input_hash', 'status'];

function payloadOf(decision) {
  return JSON.stringify(CONTENT_FIELDS.map((field) => [field, decision[field]]));
}

function seal(rows) {
  let previous = '';
  return rows.map((base) => {
    const decision = { ...base, previous_hash: previous, current_hash: '' };
    decision.current_hash = chainHashFor(previous, payloadOf(decision));
    previous = decision.current_hash;
    return decision;
  });
}

function reseal(decision) {
  return { ...decision, current_hash: chainHashFor(decision.previous_hash, payloadOf(decision)) };
}

const BOOTSTRAP = {
  phase_id: '0',
  phase_name: 'Bootstrap',
  options: ['A) Node nativo, cero dependencias', 'B) sumar una dependencia de testing'],
  recommendation: 'A) Node nativo, cero dependencias',
  selected_option: 'A) Node nativo, cero dependencias',
  reason: 'el repo prohíbe dependencias externas y la suite nativa ya cubre el caso',
  timestamp: '2026-08-28T10:00:00Z',
  input_hash: digest('stack detectado en la fase 0'),
  status: 'decided',
};

const SPEC = {
  phase_id: '1',
  phase_name: 'Spec',
  options: ['A) un solo criterio por fase', 'B) criterios agrupados por artefacto'],
  recommendation: 'A) un solo criterio por fase',
  selected_option: 'B) criterios agrupados por artefacto',
  reason: 'agrupar por artefacto deja cada AC atado a un archivo verificable',
  timestamp: '2026-08-28T12:00:00Z',
  input_hash: digest('borrador de spec revisado'),
  status: 'decided',
};

const PLAN = {
  phase_id: '2',
  phase_name: 'Plan',
  options: ['A) una tarea por gate', 'B) una tarea por archivo'],
  recommendation: 'A) una tarea por gate',
  selected_option: 'A) una tarea por gate',
  reason: 'una tarea por gate mantiene el writer set disjunto entre tareas',
  timestamp: '2026-08-28T13:00:00Z',
  input_hash: digest('conflictos de escritura del plan'),
  status: 'decided',
};

function documentOf(rows, phaseOrder = PHASES) {
  return { schema: SCHEMA, phase_order: [...phaseOrder], decisions: seal(rows) };
}

const codes = (result) => result.violations.map((violation) => violation.code);
const joined = (result) => result.violations.map((violation) => violation.message).join('\n');

function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-phase-decisions-'));
  try {
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeDecisions(root, document) {
  mkdirSync(join(root, 'docs'), { recursive: true });
  const path = join(root, 'docs', 'phase-decisions.json');
  writeFileSync(path, typeof document === 'string' ? document : JSON.stringify(document, null, 2), 'utf8');
  return 'docs/phase-decisions.json';
}

function runCli(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

// --- La forma del sello --------------------------------------------------------------------------

test('la carga canónica cubre todo el contenido de la decisión y deja fuera sólo los dos hashes', () => {
  const [decision] = seal([BOOTSTRAP]);
  assert.equal(decisionPayload(decision), payloadOf(decision));
  const payload = decisionPayload(decision);
  assert.equal(payload.includes(decision.current_hash), false, 'current_hash no puede entrar en su propia preimagen');
  assert.equal(payload.includes('previous_hash'), false, 'previous_hash entra como semilla del encadenado, no como campo');
  for (const field of CONTENT_FIELDS) {
    assert.equal(payload.includes(JSON.stringify(field)), true, `${field} tiene que quedar protegido por el hash`);
  }
  assert.equal(payload.includes(JSON.stringify(BOOTSTRAP.options[1])), true, 'el menú completo entra al hash, no sólo la opción elegida');
});

test('hashDecision es exactamente el encadenado de verify-audit-chain.mjs sobre la carga canónica', () => {
  const [decision] = seal([BOOTSTRAP]);
  assert.equal(hashDecision(decision.previous_hash, decision), chainHashFor(decision.previous_hash, decisionPayload(decision)));
  assert.equal(hashDecision('', BOOTSTRAP), '91a476d1f48294fa73265d60bea669ef94b7c7de1feffb399c52613da3bf2f4f');
  assert.notEqual(hashDecision(digest('otra cabeza de cadena'), BOOTSTRAP), hashDecision('', BOOTSTRAP));
});

test(`el menú necesita al menos ${MIN_OPTIONS} opciones y el status vive entre ${STATUSES.join(' y ')}`, () => {
  assert.equal(MIN_OPTIONS, 2);
  assert.deepEqual([...STATUSES], ['decided', 'superseded']);
});

// --- Verde ---------------------------------------------------------------------------------------

test('una cadena de decisiones con menú, recomendación, elección y justificación sale en verde', () => {
  const result = checkDecisions(documentOf([BOOTSTRAP, SPEC, PLAN]));
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /3 decisi/u);
});

test('una decisión reemplazada se marca superseded y la nueva se registra: la fase cierra igual', () => {
  const reemplazada = { ...SPEC, status: 'superseded', selected_option: 'A) un solo criterio por fase', reason: 'primera lectura de la spec' };
  const result = checkDecisions(documentOf([BOOTSTRAP, reemplazada, SPEC, PLAN]));
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /4 decisi/u);
});

test('un proyecto que declaró sus fases y todavía no cerró ninguna no incumple nada', () => {
  const result = checkDecisions({ schema: SCHEMA, phase_order: PHASES, decisions: [] });
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
});

test('la plantilla que copia cada proyecto pasa el gate real por CLI', () => {
  const run = runCli(repoRoot, 'check', TEMPLATE);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^OK: /u);
});

test('sin archivo de decisiones el gate sale 0: no arrancar una fase no incumple nada', () => fixture((root) => {
  const run = runCli(root, 'check', 'docs/phase-decisions.json');
  assert.equal(run.status, 0);
  assert.match(run.stdout, /docs\/phase-decisions\.json/u);
}));

// --- Falsificación: el menú y la elección --------------------------------------------------------

test('FALSIFICACIÓN · una elección que no está en el menú que se mostró sale en rojo', () => {
  const document = documentOf([BOOTSTRAP, SPEC]);
  document.decisions[1] = reseal({ ...document.decisions[1], selected_option: 'C) una opción que nunca se ofreció' });
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_OPTION_UNKNOWN']);
  assert.match(joined(result), /C\) una opción que nunca se ofreció/u);
});

test('FALSIFICACIÓN · una fase que cierra sin elección sale en rojo', () => {
  const document = documentOf([BOOTSTRAP, { ...SPEC, selected_option: '' }]);
  assert.deepEqual(codes(checkDecisions(document)), ['PHASE_DECISION_NOT_CLOSED']);
});

test('FALSIFICACIÓN · una fase cuya última decisión quedó superseded no cerró', () => {
  const document = documentOf([BOOTSTRAP, { ...SPEC, status: 'superseded' }]);
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_NOT_CLOSED']);
  assert.match(joined(result), /Spec/u);
});

test('FALSIFICACIÓN · sin recomendación, o con una recomendación fuera del menú, sale en rojo', () => {
  const vacia = checkDecisions(documentOf([{ ...BOOTSTRAP, recommendation: '   ' }]));
  const inventada = checkDecisions(documentOf([{ ...BOOTSTRAP, recommendation: 'C) lo que se le ocurrió al agente' }]));
  assert.deepEqual(codes(vacia), ['PHASE_DECISION_RECOMMENDATION_MISSING']);
  assert.deepEqual(codes(inventada), ['PHASE_DECISION_RECOMMENDATION_MISSING']);
});

test('FALSIFICACIÓN · sin justificación la decisión no queda registrada', () => {
  assert.deepEqual(codes(checkDecisions(documentOf([{ ...BOOTSTRAP, reason: '' }]))), ['PHASE_DECISION_REASON_MISSING']);
});

test('FALSIFICACIÓN · un menú que no es menú sale en rojo antes de mirar la elección', () => {
  const casos = [
    { ...BOOTSTRAP, options: 'A) una opción suelta' },
    { ...BOOTSTRAP, options: [BOOTSTRAP.options[0]] },
    { ...BOOTSTRAP, options: [BOOTSTRAP.options[0], '   '] },
    { ...BOOTSTRAP, options: [BOOTSTRAP.options[0], BOOTSTRAP.options[0]] },
    // Encontrado atacando el gate con el CLI real: dos opciones que sólo difieren en espacios
    // satisfacían el mínimo siendo una sola opción para quien la lee.
    { ...BOOTSTRAP, options: [BOOTSTRAP.options[0], `${BOOTSTRAP.options[0]} `] },
  ];
  const resultados = casos.map((row) => codes(checkDecisions(documentOf([row]))));
  assert.deepEqual(resultados, casos.map(() => ['PHASE_DECISION_MENU_INVALID']));
});

// --- Falsificación: la cadena de hashes ----------------------------------------------------------

test('FALSIFICACIÓN · agregar una opción al menú después de elegir rompe el hash de esa decisión', () => {
  const document = documentOf([BOOTSTRAP, SPEC, PLAN]);
  // El ataque principal: alguien edita el menú de una decisión pasada para que la opción elegida
  // parezca haber estado ahí desde el principio. Sin `options` dentro del hash, esto pasaba en verde.
  document.decisions[1].options = [...document.decisions[1].options, 'C) la opción que se agregó después'];
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_HASH_MISMATCH']);
  assert.match(joined(result), /#2/u);
});

test('FALSIFICACIÓN · cambiar la opción elegida y recalcular su propio hash rompe la cadena hacia adelante', () => {
  const document = documentOf([BOOTSTRAP, SPEC, PLAN]);
  document.decisions[1] = reseal({ ...document.decisions[1], selected_option: 'A) un solo criterio por fase' });
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_CHAIN_BROKEN']);
  assert.match(joined(result), /#3/u);
});

test('FALSIFICACIÓN · reordenar el archivo lo rechazan tres detectores independientes, la cadena entre ellos', () => {
  const document = documentOf([BOOTSTRAP, SPEC, PLAN]);
  const [primera, segunda, tercera] = document.decisions;
  document.decisions = [primera, tercera, segunda];
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_OUT_OF_ORDER', 'PHASE_DECISION_OUT_OF_ORDER', 'PHASE_DECISION_CHAIN_BROKEN']);
  assert.match(joined(result), /#2/u);
});

test('FALSIFICACIÓN · borrar la primera decisión deja una cadena sin génesis y una fase omitida', () => {
  const document = documentOf([BOOTSTRAP, SPEC, PLAN]);
  document.decisions = document.decisions.slice(1);
  const result = checkDecisions(document);
  assert.deepEqual(codes(result), ['PHASE_DECISION_PHASE_SKIPPED', 'PHASE_DECISION_CHAIN_BROKEN']);
  assert.match(joined(result), /#1/u);
});

test('FALSIFICACIÓN · un previous_hash que no es el current_hash de la anterior sale en rojo', () => {
  const document = documentOf([BOOTSTRAP, SPEC]);
  document.decisions[1] = reseal({ ...document.decisions[1], previous_hash: digest('una cabeza de cadena inventada') });
  assert.deepEqual(codes(checkDecisions(document)), ['PHASE_DECISION_CHAIN_BROKEN']);
});

test('FALSIFICACIÓN · editar la justificación de una decisión vieja rompe su hash', () => {
  const document = documentOf([BOOTSTRAP, SPEC]);
  document.decisions[0].reason = 'una razón reescrita después de los hechos';
  assert.deepEqual(codes(checkDecisions(document)), ['PHASE_DECISION_HASH_MISMATCH']);
});

// --- Falsificación: el orden de las fases --------------------------------------------------------

test('FALSIFICACIÓN · una fase omitida entre dos fases cerradas sale en rojo', () => {
  const result = checkDecisions(documentOf([BOOTSTRAP, PLAN], ['0', '0.5', '1', '2']));
  assert.deepEqual(codes(result), ['PHASE_DECISION_PHASE_SKIPPED', 'PHASE_DECISION_PHASE_SKIPPED']);
  const message = joined(result);
  assert.match(message, /\b0\.5\b/u);
  assert.match(message, /\b1\b/u);
});

test('FALSIFICACIÓN · cerrar una fase anterior después de haber pasado a la siguiente sale en rojo', () => {
  const result = checkDecisions(documentOf([SPEC, { ...BOOTSTRAP, timestamp: '2026-08-28T14:00:00Z' }]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_OUT_OF_ORDER']);
  assert.match(joined(result), /Bootstrap/u);
});

test('FALSIFICACIÓN · volver a abrir una fase ya cerrada después de otra fase sale en rojo', () => {
  const result = checkDecisions(documentOf([BOOTSTRAP, SPEC, { ...BOOTSTRAP, timestamp: '2026-08-28T14:00:00Z' }]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_OUT_OF_ORDER', 'PHASE_DECISION_DUPLICATE']);
});

test('FALSIFICACIÓN · dos decisiones vigentes sobre la misma fase son una elección duplicada', () => {
  const otra = { ...SPEC, selected_option: 'A) un solo criterio por fase', timestamp: '2026-08-28T12:30:00Z' };
  const result = checkDecisions(documentOf([BOOTSTRAP, SPEC, otra]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_DUPLICATE']);
  assert.match(joined(result), /superseded/u);
});

test('FALSIFICACIÓN · una fase que no está declarada en phase_order sale en rojo', () => {
  const result = checkDecisions(documentOf([BOOTSTRAP, { ...SPEC, phase_id: '7' }]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_PHASE_UNKNOWN']);
  assert.match(joined(result), /phase_order/u);
});

test('FALSIFICACIÓN · la misma fase con dos nombres distintos sale en rojo', () => {
  const renombrada = { ...SPEC, phase_name: 'Especificación', status: 'superseded' };
  assert.deepEqual(codes(checkDecisions(documentOf([BOOTSTRAP, renombrada, SPEC]))), ['PHASE_DECISION_PHASE_NAME_INCONSISTENT']);
});

test('FALSIFICACIÓN · un timestamp que retrocede sale en rojo', () => {
  const result = checkDecisions(documentOf([BOOTSTRAP, { ...SPEC, timestamp: '2026-08-28T09:00:00Z' }]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_OUT_OF_ORDER']);
  assert.match(joined(result), /timestamp/u);
});

// --- Falsificación: la forma del archivo ---------------------------------------------------------

test('FALSIFICACIÓN · un documento que no declara exactamente schema, phase_order y decisions sale en rojo', () => {
  const base = documentOf([BOOTSTRAP]);
  const casos = [
    null,
    [],
    { schema: SCHEMA, phase_order: PHASES },
    { ...base, extra: true },
    { ...base, schema: 'vcp.phase-decisions/999' },
    { ...base, phase_order: '0,1' },
    { ...base, phase_order: [] },
    { ...base, phase_order: ['0', ''] },
    { ...base, phase_order: ['0', '0'] },
    { ...base, decisions: {} },
  ];
  const resultados = casos.map((document) => codes(checkDecisions(document)));
  assert.deepEqual(resultados, casos.map(() => ['PHASE_DECISION_SCHEMA_INVALID']));
});

test('FALSIFICACIÓN · una decisión con campos de más, de menos, o que no es un objeto sale en rojo', () => {
  const [valida] = seal([BOOTSTRAP]);
  const sinCampo = { ...valida };
  delete sinCampo.input_hash;
  const casos = [
    'una decisión escrita como texto',
    sinCampo,
    { ...valida, extra: 'un campo que nadie verifica' },
  ];
  const resultados = casos.map((decision) => codes(checkDecisions({ schema: SCHEMA, phase_order: PHASES, decisions: [decision] })));
  assert.deepEqual(resultados, casos.map(() => ['PHASE_DECISION_SCHEMA_INVALID']));
});

test('FALSIFICACIÓN · cada campo escalar mal formado sale en rojo con su propio código', () => {
  const casos = [
    [{ ...BOOTSTRAP, phase_id: '' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, phase_name: '  ' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, phase_id: 0 }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, status: 'aprobada' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, timestamp: 20260828 }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, timestamp: '28 de agosto' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, timestamp: '2026-13-45T99:99:99Z' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, input_hash: 'no es un sha256' }, 'PHASE_DECISION_FIELD_INVALID'],
    [{ ...BOOTSTRAP, input_hash: null }, 'PHASE_DECISION_FIELD_INVALID'],
  ];
  const resultados = casos.map(([row]) => codes(checkDecisions(documentOf([row]))));
  assert.deepEqual(resultados, casos.map(([, code]) => [code]));
});

test('FALSIFICACIÓN · un hash de la cadena que no es sha256 sale en rojo antes de verificar el encadenado', () => {
  const [valida] = seal([BOOTSTRAP]);
  const casos = [
    { ...valida, previous_hash: 'cadena' },
    { ...valida, previous_hash: null },
    { ...valida, current_hash: '' },
    { ...valida, current_hash: 42 },
  ];
  const resultados = casos.map((decision) => codes(checkDecisions({ schema: SCHEMA, phase_order: PHASES, decisions: [decision] })));
  assert.deepEqual(resultados, casos.map(() => ['PHASE_DECISION_FIELD_INVALID']));
});

test('FALSIFICACIÓN · el gate junta las violaciones de todas las decisiones, no frena en la primera', () => {
  const result = checkDecisions(documentOf([{ ...BOOTSTRAP, reason: '' }, { ...SPEC, recommendation: '' }]));
  assert.deepEqual(codes(result), ['PHASE_DECISION_REASON_MISSING', 'PHASE_DECISION_RECOMMENDATION_MISSING']);
});

// --- Los límites, reproducidos ---------------------------------------------------------------------

test('los ataques que este gate NO detecta quedan reproducidos, no escondidos', () => {
  const truncado = documentOf([BOOTSTRAP, SPEC, PLAN]);
  truncado.decisions = truncado.decisions.slice(0, -1);
  assert.equal(checkDecisions(truncado).ok, true, 'recortar el final deja una cadena más corta que verifica igual');

  // La última decisión es la cabeza de la cadena: nada la sigue, así que resellarla pasa en verde.
  // Es la decisión de la fase vigente, o sea la que un agente tendría más motivo para retocar.
  const cabeza = documentOf([BOOTSTRAP, SPEC]);
  const editada = { ...cabeza.decisions[1], options: [...SPEC.options, 'C) agregada después de elegir'], selected_option: 'C) agregada después de elegir' };
  cabeza.decisions[1] = reseal(editada);
  assert.equal(checkDecisions(cabeza).ok, true, 'la cabeza de la cadena se puede reescribir y volver a sellar');

  // El límite de fondo: nadie tomó esta decisión. El gate sella la forma del registro, no el acto.
  const inventada = documentOf([BOOTSTRAP, SPEC, { ...PLAN, reason: 'nadie tomó esta decisión: la escribió el agente solo' }]);
  assert.equal(checkDecisions(inventada).ok, true, 'una decisión inventada de punta a punta es indistinguible de una real');

  const futura = documentOf([BOOTSTRAP, SPEC]);
  futura.phase_order = [...PHASES, '5'];
  assert.equal(checkDecisions(futura).ok, true, 'phase_order no está encadenado: agregar una fase futura al final es legítimo');
});

// --- CLI -----------------------------------------------------------------------------------------

test('FALSIFICACIÓN · argumentos inválidos salen 2 sin leer el disco', () => {
  const invalid = [[], ['check'], ['check', 'a', 'b'], ['verify', 'a'], ['--check', 'a']];
  const errors = [];
  const exits = invalid.map((args) => main(args, {
    readFile: () => {
      throw new Error('el uso se rechaza antes de tocar el disco');
    },
  }, () => {}, (line) => errors.push(line)));
  assert.deepEqual(exits, invalid.map(() => 2));
  assert.deepEqual(new Set(errors), new Set([USAGE]));
});

test('FALSIFICACIÓN · un archivo ilegible por cualquier motivo que no sea ausencia sale en rojo', () => {
  const errors = [];
  const exit = main(['check', 'docs/phase-decisions.json'], {
    readFile: () => {
      const failure = new Error('EACCES: permission denied');
      failure.code = 'EACCES';
      throw failure;
    },
  }, () => {}, (line) => errors.push(line));
  assert.equal(exit, 1);
  assert.deepEqual(errors.map((line) => line.split(':')[1].trim()), ['PHASE_DECISION_UNREADABLE']);
});

test('FALSIFICACIÓN · un archivo que no es JSON sale en rojo, no en verde por ausencia', () => fixture((root) => {
  const path = writeDecisions(root, '{ esto no es json }');
  const run = runCli(root, 'check', path);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /REJECTED: PHASE_DECISION_SCHEMA_INVALID/u);
}));

test('el CLI real refleja los exit codes de la librería sobre archivos en disco', () => fixture((root) => {
  const path = writeDecisions(root, documentOf([BOOTSTRAP, SPEC, PLAN]));
  const verde = runCli(root, 'check', path);
  assert.equal(verde.status, 0, `${verde.stdout}${verde.stderr}`);
  assert.match(verde.stdout, /^OK: docs\/phase-decisions\.json/u);

  const roto = documentOf([BOOTSTRAP, SPEC, PLAN]);
  roto.decisions[0].options = [...roto.decisions[0].options, 'C) agregada después de elegir'];
  writeDecisions(root, roto);
  const rojo = runCli(root, 'check', path);
  assert.equal(rojo.status, 1);
  assert.match(rojo.stderr, /REJECTED: PHASE_DECISION_HASH_MISMATCH/u);

  const uso = runCli(root, 'check');
  assert.deepEqual({ status: uso.status, usa: uso.stderr.includes(USAGE) }, { status: 2, usa: true });
}));
