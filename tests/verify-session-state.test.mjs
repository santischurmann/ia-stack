import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ATTEMPT_LIMIT,
  SECTION_ATTEMPTS,
  SECTION_INTERRUPTED,
  SECTION_UNVERIFIED,
  USAGE,
  checkSessionState,
  main,
  parseArgs,
  parseAttempts,
  sectionLines,
} from '../scripts/verify-session-state.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-session-state.mjs');
const SESSION = '.vibe/SESSION.md';

const HEADER = [
  '# Session — 2026-08-28',
  '',
  '**Feature slug:** estado-retomable',
  '**Goal:** cerrar los tres huecos de estado interrumpido',
  '**Status:** in progress',
  '',
  '---',
  '',
  '## Phase 0 — Bootstrap',
  '',
  '- Stack detectado: Node nativo, cero dependencias.',
  '',
].join('\n');

const PROBLEMA = 'el gate de límites honestos rechaza la frase nueva';
const INTENTOS = [
  `## ${SECTION_ATTEMPTS}`,
  '',
  `### ${PROBLEMA}`,
  '',
  '- intento 1: copiar la frase tal cual del README → cruza un salto de línea y el include literal no coincide',
  '- intento 2: recortarla a media oración → el fragmento tampoco entra entero en un renglón',
  '- intento 3: reformatear el párrafo → el renglón se vuelve a partir al guardar',
  '',
].join('\n');
const DECISION = '- decisión humana: mover la frase a la tabla de gates, donde cada fila es un solo renglón\n';

const INTERRUMPIDO = [
  `## ${SECTION_INTERRUPTED}`,
  '',
  '- Fase: 3 — Build',
  '- Tarea: T09 — gate de estado de sesión',
  '- Falta: cablear el gate en SKILL.md y volver a correr la suite completa',
  '',
].join('\n');

const NO_VERIFICADO = [
  `## ${SECTION_UNVERIFIED}`,
  '',
  '- **`git fetch origin/main`:** no verificado — timeout de red, el remoto no se pudo consultar',
  '',
].join('\n');

function session(...blocks) {
  return `${HEADER}\n${blocks.join('\n')}`;
}

function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-session-state-'));
  try {
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeSession(root, body) {
  mkdirSync(join(root, '.vibe'), { recursive: true });
  writeFileSync(join(root, '.vibe', 'SESSION.md'), body, 'utf8');
  return root;
}

const codes = (result) => result.violations.map((violation) => violation.code);
const joined = (result) => result.violations.map((violation) => violation.message).join('\n');

// --- Recorte de secciones -----------------------------------------------------------------------

test('sectionLines devuelve el cuerpo de la sección y lo corta en el próximo encabezado de nivel 1 o 2', () => {
  const source = [
    '# Session',
    `## ${SECTION_ATTEMPTS}`,
    `### ${PROBLEMA}`,
    '- intento 1: algo → falló',
    '## Phase 3',
    '- esto ya no pertenece a la sección',
    `## ${SECTION_ATTEMPTS}`,
    '- una segunda aparición del mismo título también cuenta',
    '# Otra sesión',
    '- fuera de toda sección',
  ].join('\n');
  assert.deepEqual(sectionLines(source, SECTION_ATTEMPTS), [
    `### ${PROBLEMA}`,
    '- intento 1: algo → falló',
    '- una segunda aparición del mismo título también cuenta',
  ]);
  assert.deepEqual(sectionLines(source, SECTION_UNVERIFIED), []);
});

test('sectionLines ignora lo que está comentado: un bloque HTML no es estado declarado', () => {
  const source = [
    '<!--',
    `## ${SECTION_ATTEMPTS}`,
    '- intento 1: el ejemplo de la plantilla → no es estado de nadie',
    '-->',
    `## ${SECTION_UNVERIFIED}`,
    '- esto sí es estado declarado <!-- con una nota al margen -->',
  ].join('\n');
  assert.deepEqual(sectionLines(source, SECTION_ATTEMPTS), []);
  assert.deepEqual(sectionLines(source, SECTION_UNVERIFIED), ['- esto sí es estado declarado ']);
});

test('la plantilla que copia cada proyecto nuevo pasa el gate: sus ejemplos están comentados', () => fixture((root) => {
  writeSession(root, readFileSync(join(repoRoot, 'templates', 'vibe', 'SESSION.md'), 'utf8'));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /0 problema/u);
}));

// --- Intentos fallidos --------------------------------------------------------------------------

test('parseAttempts ata cada intento a su problema y separa qué se probó de por qué falló', () => {
  const parsed = parseAttempts(sectionLines(session(INTENTOS + DECISION), SECTION_ATTEMPTS));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].problem, PROBLEMA);
  assert.deepEqual(parsed.problems[0].attempts.map((attempt) => attempt.number), [1, 2, 3]);
  assert.equal(parsed.problems[0].attempts[0].tried, 'copiar la frase tal cual del README');
  assert.equal(parsed.problems[0].attempts[0].failed, 'cruza un salto de línea y el include literal no coincide');
  assert.match(parsed.problems[0].decision, /tabla de gates/u);
});

test('FALSIFICACIÓN · parseAttempts nombra toda viñeta que no es un intento bien formado ni la decisión', () => {
  const parsed = parseAttempts([
    '- intento 1: una viñeta antes de declarar el problema → no pertenece a ningún problema',
    '### un problema real',
    '- intento 1: probar algo → sin resultado útil',
    '- intento 3: saltarse el dos → el número no sigue al anterior',
    '- intento 2: sin flecha que separe lo que se probó de por qué falló',
    '- intento 2: → falta el lado izquierdo',
    '- una viñeta que no dice nada de lo que el formato pide',
    '- decisión humana:',
  ]);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].attempts.length, 1);
  assert.equal(parsed.errors.length, 6, parsed.errors.join('\n'));
  assert.match(parsed.errors[0], /fuera de todo problema/u);
  assert.match(parsed.errors[1], /intento 2/u);
  assert.match(parsed.errors[2], /→/u);
  assert.match(parsed.errors[3], /→/u);
  assert.match(parsed.errors[4], /no dice nada/u);
  assert.match(parsed.errors[5], /decisión humana/u);
});

test('FALSIFICACIÓN · parseAttempts rechaza dos decisiones humanas sobre el mismo problema', () => {
  const parsed = parseAttempts([
    '### un problema con dos decisiones',
    '- intento 1: probar algo → falló por esto',
    '- decisión humana: frenar y preguntar',
    '- decisión humana: seguir probando igual',
  ]);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /dos veces/u);
  assert.equal(parsed.problems[0].decision, 'frenar y preguntar');
});

test(`FALSIFICACIÓN · ${ATTEMPT_LIMIT} intentos sobre el mismo problema sin decisión humana salen en rojo y los nombra a los tres`, () => fixture((root) => {
  writeSession(root, session(INTENTOS));
  const result = checkSessionState(root, SESSION);
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['SESSION_STATE_ATTEMPT_LIMIT']);
  const message = joined(result);
  assert.match(message, new RegExp(PROBLEMA, 'u'));
  assert.match(message, /copiar la frase tal cual del README/u);
  assert.match(message, /recortarla a media oración/u);
  assert.match(message, /reformatear el párrafo/u);
  assert.match(message, /el renglón se vuelve a partir al guardar/u);
}));

test(`${ATTEMPT_LIMIT} intentos con la decisión humana registrada salen en verde`, () => fixture((root) => {
  writeSession(root, session(INTENTOS + DECISION));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /1 problema/u);
}));

test('dos intentos sin decisión todavía no frenan: el tope es el tercero', () => fixture((root) => {
  const dos = INTENTOS.split('\n').filter((line) => !line.startsWith('- intento 3:')).join('\n');
  writeSession(root, session(dos));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
}));

test('un problema declarado sin ningún intento todavía no incumple nada', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_ATTEMPTS}\n\n### ${PROBLEMA}\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
}));

test('FALSIFICACIÓN · una viñeta mal formada dentro de los intentos sale en rojo con su propio código', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_ATTEMPTS}\n\n### ${PROBLEMA}\n\n- intento 1: probé algo y no anduvo\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual(codes(result), ['SESSION_STATE_ATTEMPT_MALFORMED']);
  assert.match(joined(result), /intento 1/u);
}));

// --- Interrupción -------------------------------------------------------------------------------

test('una interrupción con fase, tarea y qué falta sale en verde', () => fixture((root) => {
  writeSession(root, session(INTERRUMPIDO));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /retome/u);
}));

test('FALSIFICACIÓN · una interrupción sin punto de retome sale en rojo nombrando los campos que faltan', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_INTERRUPTED}\n\n- Fase: 3 — Build\n- Tarea:\n\nSe cortó la cuota a mitad de la tarea.\n`));
  const result = checkSessionState(root, SESSION);
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['SESSION_STATE_RESUME_POINT_INCOMPLETE']);
  const message = joined(result);
  assert.match(message, /Tarea/u);
  assert.match(message, /Falta/u);
  assert.equal(/\bFase\b/u.test(message), false, 'el campo declarado no se reporta como faltante');
}));

test('FALSIFICACIÓN · una interrupción que declara el mismo campo dos veces sale en rojo por ambigua', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_INTERRUPTED}\n\n- Fase: 3 — Build\n- Fase: 4 — Final\n- Tarea: T09\n- Falta: correr la suite\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual(codes(result), ['SESSION_STATE_RESUME_POINT_AMBIGUOUS']);
  assert.match(joined(result), /Fase/u);
}));

test('una interrupción puede llevar campos extra y viñetas sueltas sin que el gate opine sobre ellos', () => fixture((root) => {
  writeSession(root, session(`${INTERRUMPIDO}- Rama: main\n- Commit: 5c4c7f1\n- se cortó la cuota antes de escribir el receipt\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
}));

// --- Verificaciones no realizadas ---------------------------------------------------------------

test('una verificación declarada no realizada, con su motivo, sale en verde', () => fixture((root) => {
  writeSession(root, session(NO_VERIFICADO));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
  assert.match(result.summary, /1 verificación/u);
}));

test('FALSIFICACIÓN · una verificación declarada exitosa dentro de la sección de no verificadas sale en rojo', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_UNVERIFIED}\n\n- **\`git fetch origin/main\`:** verificado contra el remoto, todo al día\n`));
  const result = checkSessionState(root, SESSION);
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ['SESSION_STATE_VERIFICATION_CLAIMED']);
  assert.match(joined(result), /git fetch origin\/main/u);
}));

test('FALSIFICACIÓN · una verificación sin motivo, o sin decir cuál quedó sin hacer, sale en rojo', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_UNVERIFIED}\n\n- **\`git fetch origin/main\`:** no verificado\n- no verificado — se cayó la red\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual(codes(result), ['SESSION_STATE_VERIFICATION_UNEXPLAINED', 'SESSION_STATE_VERIFICATION_UNEXPLAINED']);
  const message = joined(result);
  assert.match(message, /motivo/u);
  assert.match(message, /qué verificación/u);
}));

test('una viñeta vacía en la sección de no verificadas no declara ninguna verificación', () => fixture((root) => {
  writeSession(root, session(`## ${SECTION_UNVERIFIED}\n\n-   \n\nNada quedó sin verificar en esta corrida.\n`));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
}));

// --- Estado del archivo -------------------------------------------------------------------------

test('sin SESSION.md el gate sale en verde: un proyecto que todavía no arrancó no incumple nada', () => fixture((root) => {
  const result = checkSessionState(root, SESSION);
  assert.equal(result.ok, true);
  assert.match(result.summary, /SESSION\.md/u);
}));

test('una sesión sin ninguna de las tres secciones opcionales es un estado normal y pasa', () => fixture((root) => {
  writeSession(root, session('## Phase 3 — T09 · DONE\n\n- RED en rojo, GREEN 21/21.\n'));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual({ ok: result.ok, violations: result.violations }, { ok: true, violations: [] });
}));

test('FALSIFICACIÓN · un SESSION.md que escapa del proyecto o no es un archivo regular sale en rojo', () => fixture((root) => {
  mkdirSync(join(root, '.vibe', 'SESSION.md'), { recursive: true });
  const directorio = checkSessionState(root, SESSION);
  const afuera = checkSessionState(root, '../SESSION.md');
  assert.deepEqual(codes(directorio), ['SESSION_STATE_UNREADABLE']);
  assert.deepEqual(codes(afuera), ['SESSION_STATE_UNREADABLE']);
  assert.match(joined(afuera), /SESSION\.md/u);
}));

test('FALSIFICACIÓN · el gate junta las tres violaciones en una sola corrida, no frena en la primera', () => fixture((root) => {
  writeSession(root, session(
    INTENTOS,
    `## ${SECTION_INTERRUPTED}\n\n- Fase: 3 — Build\n`,
    `## ${SECTION_UNVERIFIED}\n\n- **git fetch origin/main:** salió sin errores\n`,
  ));
  const result = checkSessionState(root, SESSION);
  assert.deepEqual(codes(result), [
    'SESSION_STATE_ATTEMPT_LIMIT',
    'SESSION_STATE_RESUME_POINT_INCOMPLETE',
    'SESSION_STATE_VERIFICATION_CLAIMED',
  ]);
}));

// --- CLI ----------------------------------------------------------------------------------------

test('parseArgs acepta exactamente la forma documentada', () => {
  assert.deepEqual(parseArgs(['check', '--session', SESSION]), { session: SESSION, requireInputs: false });
});

test('FALSIFICACIÓN · argumentos inválidos salen 2 sin leer el disco', () => {
  const invalid = [
    [],
    ['check'],
    ['check', '--session'],
    ['check', '--session', ''],
    ['check', '--session', '--otra-bandera'],
    ['check', '--session', SESSION, 'extra'],
    ['check', '--sesion', SESSION],
    ['verify', '--session', SESSION],
    ['--session', SESSION],
  ];
  assert.deepEqual(invalid.map(parseArgs), invalid.map(() => null));
  const errors = [];
  const exits = invalid.map((args) => main(args, '.', () => {}, (line) => errors.push(line), () => {
    throw new Error('parseArgs debe rechazar antes de tocar el disco');
  }));
  assert.deepEqual(exits, invalid.map(() => 2));
  assert.deepEqual(new Set(errors), new Set([USAGE]));
});

test('main traduce el resultado a 0 o 1 y escribe OK o una línea REJECTED por violación', () => {
  const written = [];
  const errors = [];
  const verde = main(['check', '--session', SESSION], '.', (line) => written.push(line), (line) => errors.push(line), () => ({ ok: true, violations: [], summary: 'todo retomable' }));
  const rojo = main(['check', '--session', SESSION], '.', (line) => written.push(line), (line) => errors.push(line), () => ({
    ok: false,
    summary: '',
    violations: [
      { code: 'SESSION_STATE_ATTEMPT_LIMIT', message: 'tres intentos sin decisión' },
      { code: 'SESSION_STATE_RESUME_POINT_INCOMPLETE', message: 'falta Tarea' },
    ],
  }));
  assert.deepEqual({ verde, rojo }, { verde: 0, rojo: 1 });
  assert.deepEqual(written, ['OK: todo retomable']);
  assert.deepEqual(errors, [
    'REJECTED: SESSION_STATE_ATTEMPT_LIMIT: tres intentos sin decisión',
    'REJECTED: SESSION_STATE_RESUME_POINT_INCOMPLETE: falta Tarea',
  ]);
});

test('el CLI real refleja los exit codes de la librería sobre archivos en disco', () => fixture((root) => {
  const run = () => spawnSync(process.execPath, [script, 'check', '--session', SESSION], { cwd: root, encoding: 'utf8' });

  writeSession(root, session(INTENTOS));
  const rojo = run();
  assert.equal(rojo.status, 1);
  assert.match(rojo.stderr, /REJECTED: SESSION_STATE_ATTEMPT_LIMIT/u);

  writeSession(root, session(INTENTOS + DECISION, INTERRUMPIDO, NO_VERIFICADO));
  const verde = run();
  assert.equal(verde.status, 0);
  assert.match(verde.stdout, /^OK: /u);

  const uso = spawnSync(process.execPath, [script, 'check'], { cwd: root, encoding: 'utf8' });
  assert.deepEqual({ status: uso.status, usa: uso.stderr.includes(USAGE) }, { status: 2, usa: true });
}));

// --- Verde vacío: un proyecto sin SESSION.md no verificó nada -----------------------------------

// El código de rechazo es contrato de salida: literal acá, para que el RED falle por aserción.
const SIN_ENTRADAS = 'SESSION_STATE_NO_INPUTS';

test('un proyecto sin SESSION.md sale vacuous, y uno con estado declarado no', () => fixture((root) => {
  const sin = checkSessionState(root, SESSION);
  writeSession(root, session(INTENTOS + DECISION, INTERRUMPIDO, NO_VERIFICADO));
  const con = checkSessionState(root, SESSION);

  assert.deepEqual([sin.ok, sin.vacuous], [true, true]);
  assert.deepEqual([con.ok, con.vacuous ?? false], [true, false]);
}));

test('main escribe VACÍO cuando no había estado que revisar, y OK cuando sí lo había', () => {
  const written = [];
  const vacio = main(['check', '--session', SESSION], '.', (line) => written.push(line), () => {}, () => ({ ok: true, vacuous: true, violations: [], summary: `no hay ${SESSION}` }));
  const lleno = main(['check', '--session', SESSION], '.', (line) => written.push(line), () => {}, () => ({ ok: true, violations: [], summary: 'es retomable' }));

  assert.deepEqual({ vacio, lleno }, { vacio: 0, lleno: 0 });
  assert.deepEqual(written, [`VACÍO: no hay ${SESSION}`, 'OK: es retomable']);
});

test('parseArgs acepta --require-inputs y lo informa siempre como booleano', () => {
  assert.deepEqual(parseArgs(['check', '--session', SESSION, '--require-inputs']), { session: SESSION, requireInputs: true });
  assert.deepEqual(parseArgs(['check', '--session', SESSION]), { session: SESSION, requireInputs: false });
  assert.equal(parseArgs(['check', '--require-inputs']), null);
});

test('FALSIFICACIÓN · --require-inputs rechaza el proyecto sin SESSION.md y deja pasar al que sí lo tiene', () => fixture((root) => {
  const run = (args) => spawnSync(process.execPath, [script, 'check', '--session', SESSION, ...args], { cwd: root, encoding: 'utf8' });

  const permisivo = run([]);
  assert.deepEqual({ status: permisivo.status, vacio: permisivo.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });

  const estricto = run(['--require-inputs']);
  assert.equal(estricto.status, 1);
  assert.match(estricto.stderr, new RegExp(SIN_ENTRADAS, 'u'));

  writeSession(root, session(INTENTOS + DECISION, INTERRUMPIDO, NO_VERIFICADO));
  const verde = run(['--require-inputs']);
  assert.deepEqual({ status: verde.status, ok: verde.stdout.startsWith('OK: ') }, { status: 0, ok: true });
}));


// --- Un archivo de 0 bytes no es estado declarado -----------------------------------------------

// Reproducido el 2026-08-28: `touch .vibe/SESSION.md` convertia el VACIO en "OK: es retomable",
// y --require-inputs lo daba por satisfecho. Un archivo sin una sola seccion no declara nada.
test('FALSIFICACION · un SESSION.md vacio escribe VACIO, y --require-inputs lo rechaza', () => fixture((root) => {
  writeSession(root, '');
  const permisivo = spawnSync(process.execPath, [script, 'check', '--session', SESSION], { cwd: root, encoding: 'utf8' });
  assert.deepEqual({ status: permisivo.status, vacio: permisivo.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true }, permisivo.stderr);

  const estricto = spawnSync(process.execPath, [script, 'check', '--session', SESSION, '--require-inputs'], { cwd: root, encoding: 'utf8' });
  assert.equal(estricto.status, 1);

  // Y un archivo con solo espacios tampoco es estado.
  writeSession(root, '   ' + String.fromCharCode(10) + '  ');
  const soloEspacios = spawnSync(process.execPath, [script, 'check', '--session', SESSION], { cwd: root, encoding: 'utf8' });
  assert.ok(soloEspacios.stdout.startsWith('VACÍO: '));
}));
