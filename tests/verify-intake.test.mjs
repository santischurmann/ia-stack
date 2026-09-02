// Fase de Intake: lo primero que el protocolo tiene que preguntar y hoy no pregunta. Medido el
// 2026-09-01 sobre af55a45: `grep -ci "Intake"` sobre SKILL.md y README.md devuelve 0, y las otras
// cinco capacidades que el encargo pide viven como prosa suelta en SKILL.md:226-235.
//
// El gate comprueba FORMA, nunca verdad. Que las ocho respuestas esten y sean respuestas, que los
// supuestos, riesgos y preguntas vivan separados de ellas, y que una pregunta declarada bloqueante
// detenga el ciclo. No sabe si una respuesta es correcta ni si alguien la contesto de verdad.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-intake.mjs');
const { ANSWER_KEYS, MIN_ANSWER, SCHEMA, USAGE, main, validateIntake } = await import(pathToFileURL(script).href);

const respuesta = (texto) => `${texto} — respuesta real y suficientemente larga para no ser relleno.`;
function intake(overrides = {}) {
  const answers = {};
  for (const key of ANSWER_KEYS ?? []) answers[key] = respuesta(`Contenido de ${key}`);
  return {
    schema: SCHEMA,
    feature: 'intake-de-producto',
    date: '2026-09-01',
    answers,
    supuestos: [{ id: 'S1', texto: respuesta('El usuario tiene Node instalado') }],
    riesgos: [{ id: 'R1', texto: respuesta('El intake puede volverse burocracia') }],
    preguntas_abiertas: [{ id: 'Q1', texto: respuesta('Que pasa con un cambio chico'), bloqueante: false }],
    exito: respuesta('Un ciclo que arranca con el objetivo escrito'),
    ...overrides,
  };
}
function correr(archivo, contenido) {
  const salida = [];
  const errores = [];
  const code = main(['check', archivo], {
    // El gate resuelve la ruta antes de leer; acá se inyecta la identidad porque estos casos
    // prueban CONTENIDO. La seguridad de la ruta la prueban sus tests propios y ratchet.test.mjs.
    safePath: (_root, ruta) => ruta,
    read: () => (contenido instanceof Error ? (() => { throw contenido; })() : JSON.stringify(contenido)),
    write: (line) => salida.push(line),
    writeError: (line) => errores.push(line),
  });
  return { code, salida, errores };
}

test('AC1 · un intake con las ocho respuestas completas sale en verde y dice qué registró', () => {
  const { code, salida, errores } = correr('docs/intake/x.json', intake());
  assert.equal(code, 0, errores.join(' || '));
  assert.match(salida.at(-1), /^OK: /u);
  assert.match(salida.at(-1), /8 respuesta\(s\)/u, 'el verde tiene que decir cuántas respuestas registró, no sólo OK');
  assert.match(salida.at(-1), /1 supuesto\(s\), 1 riesgo\(s\), 1 pregunta\(s\)/u);
});

test('AC2 · FALSIFICACIÓN · una respuesta ausente, vacía o de relleno se rechaza por nombre', () => {
  for (const [caso, valor] of [['ausente', undefined], ['vacía', ''], ['de relleno', 'sí']]) {
    const answers = { ...intake().answers };
    if (valor === undefined) delete answers.que_problema; else answers.que_problema = valor;
    const { code, errores } = correr('docs/intake/x.json', intake({ answers }));
    assert.equal(code, 1, `aceptó una respuesta ${caso}`);
    assert.ok(errores.join(' ').includes('que_problema'), `no nombró la respuesta ${caso}: ${errores.join(' || ')}`);
  }
});

test('AC3 · FALSIFICACIÓN · una pregunta abierta bloqueante detiene el ciclo', () => {
  const bloqueante = [{ id: 'Q1', texto: respuesta('Quien paga la infraestructura'), bloqueante: true }];
  const { code, errores } = correr('docs/intake/x.json', intake({ preguntas_abiertas: bloqueante }));
  assert.equal(code, 1, 'avanzó con una decisión obligatoria sin contestar');
  assert.ok(errores.join(' ').includes('Q1'), errores.join(' || '));
});

test('AC4 · supuestos, riesgos y preguntas viven separados de las respuestas', () => {
  // El límite que esto NO cierra: un supuesto escondido adentro del texto de una respuesta pasa
  // igual. El gate comprueba que existan las tres listas y su forma, no que el autor las use bien.
  for (const campo of ['supuestos', 'riesgos', 'preguntas_abiertas']) {
    assert.equal(correr('docs/intake/x.json', intake({ [campo]: undefined })).code, 1, `aceptó un intake sin ${campo}`);
    assert.equal(correr('docs/intake/x.json', intake({ [campo]: 'texto suelto' })).code, 1, `aceptó ${campo} que no es una lista`);
    assert.equal(correr('docs/intake/x.json', intake({ [campo]: [{ id: '', texto: '' }] })).code, 1, `aceptó una entrada vacía en ${campo}`);
  }
  const dosIguales = [{ id: 'S1', texto: respuesta('uno') }, { id: 'S1', texto: respuesta('otro') }];
  assert.equal(correr('docs/intake/x.json', intake({ supuestos: dosIguales })).code, 1, 'aceptó dos supuestos con el mismo id');
});

test('AC5 · un proyecto sin ningún intake informa VACÍO y sale 0', () => {
  const ausente = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
  const { code, salida } = correr('docs/intake/x.json', ausente);
  assert.equal(code, 0, 'un proyecto que todavía no arrancó no incumple nada');
  assert.match(salida.at(-1), /^VACÍO: /u, 'no comparar nada no se escribe como verificar');
});

test('AC6 · FALSIFICACIÓN · un esquema ajeno se rechaza antes de mirar cualquier otro campo', () => {
  const { code, errores } = correr('docs/intake/x.json', { schema: 'otra.cosa/9' });
  assert.equal(code, 1);
  assert.ok(errores.join(' ').includes(SCHEMA), 'el rechazo tiene que decir qué esquema esperaba');
  assert.equal(errores.join(' ').includes('que_problema'), false, 'miró los campos de un archivo que no es un intake');
});

test('FALSIFICACIÓN · uso inválido y JSON roto se distinguen entre sí y del contenido', () => {
  const errores = [];
  const opciones = { safePath: (_r, p) => p, read: () => '{', write: () => {}, writeError: (l) => errores.push(l) };
  assert.equal(main([], opciones), 2, 'sin argumentos es error de uso, no un veredicto');
  assert.equal(errores.at(-1), USAGE);
  assert.equal(main(['check', 'x.json', 'extra'], opciones), 2);
  assert.equal(main(['check', ''], opciones), 2);
  assert.equal(main(['check', 'x.json'], opciones), 1, 'un JSON roto es un rechazo, no un verde');
  assert.match(errores.at(-1), /no es JSON válido/u);
});

test('FALSIFICACIÓN · validateIntake devuelve las violaciones sin lanzar, incluso sobre basura', () => {
  // Sin esto, el gate podria estar salvandose por una excepcion en vez de por una comprobacion.
  for (const basura of [null, undefined, 42, 'texto', [], { answers: null }]) {
    const violaciones = validateIntake(basura);
    assert.ok(Array.isArray(violaciones) && violaciones.length > 0, `no acusó nada sobre ${JSON.stringify(basura)}`);
  }
  assert.deepEqual(validateIntake(intake()), [], 'un intake completo no puede tener violaciones');
  assert.ok(Number.isInteger(MIN_ANSWER) && MIN_ANSWER > 1, 'el mínimo de una respuesta tiene que ser un número declarado');
  assert.equal(ANSWER_KEYS.length, 8, 'el encargo pide ocho preguntas');
});

test('FALSIFICACIÓN · cada campo de cabecera se rechaza por su cuenta, con su nombre', () => {
  // Estas ramas no las ejercitaba ninguna prueba: el gate podía estar aceptando un intake sin fecha,
  // sin nombre de feature o con una pregunta de más disfrazada de respuesta. Encontradas midiendo,
  // no leyendo: verify-vcp-coverage las nombró una por una.
  const casos = [
    [{ feature: '' }, 'feature'],
    [{ feature: 42 }, 'feature'],
    [{ date: undefined }, 'date'],
    [{ date: '01-01-2026' }, 'date'],
    [{ answers: 'las ocho respuestas van acá' }, 'answers'],
    [{ answers: [] }, 'answers'],
    [{ exito: undefined }, 'exito'],
    [{ exito: 'sí' }, 'exito'],
  ];
  for (const [override, esperado] of casos) {
    const violaciones = validateIntake(intake(override));
    assert.ok(violaciones.some((v) => v.includes(esperado)),
      `no acusó ${esperado} con ${JSON.stringify(override)}: ${violaciones.join(' || ')}`);
  }
});

test('FALSIFICACIÓN · una pregunta de más en answers se acusa: las ocho son las ocho', () => {
  const answers = { ...intake().answers, presupuesto: respuesta('Cuánto sale') };
  const violaciones = validateIntake(intake({ answers }));
  assert.ok(violaciones.some((v) => v.includes('presupuesto') && v.includes('no es una de las ocho')), violaciones.join(' || '));
});

test('FALSIFICACIÓN · una entrada de lista que no es un objeto, y una pregunta sin declarar si bloquea', () => {
  assert.ok(validateIntake(intake({ riesgos: ['texto suelto en vez de un objeto'] }))
    .some((v) => v.includes('riesgos[0]') && v.includes('objeto')));
  assert.ok(validateIntake(intake({ preguntas_abiertas: [{ id: 'Q1', texto: respuesta('sin declarar') }] }))
    .some((v) => v.includes('bloqueante')), 'una pregunta que no dice si bloquea deja la decisión sin dueño');
});

test('FALSIFICACIÓN · un archivo ilegible por permisos no se confunde con uno ausente', () => {
  // Un ausente es VACÍO y sale 0; cualquier otro fallo de lectura es un rechazo. Sin la distinción,
  // un permiso mal puesto se leería como "este proyecto todavía no arrancó".
  const errores = [];
  const permiso = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const code = main(['check', 'docs/intake/x.json'], {
    safePath: (_r, p) => p,
    read: () => { throw permiso; },
    write: () => {},
    writeError: (line) => errores.push(line),
  });
  assert.equal(code, 1, 'trató un problema de permisos como un proyecto sin intake');
  assert.match(errores.at(-1), /^REJECTED: no se pudo leer/u);
  assert.doesNotMatch(errores.at(-1), /VACÍO/u);
});

test('FALSIFICACIÓN · la ruta se resuelve antes de leer: insegura rechaza, inexistente es VACÍO', () => {
  // La lectura no se reimplementa (regla #46): se usa safeProjectFile de ratchet.mjs. Estas pruebas
  // comprueban que el gate lo LLAME y distinga sus dos salidas; la mecánica del enlace y del escape
  // la prueba tests/ratchet.test.mjs con una junction.
  const errores = [];
  assert.equal(main(['check', 'docs/intake/x.json'], {
    safePath: () => { throw new Error('ratchet path escapes the project: ../fuera.json'); },
    read: () => { throw new Error('no debería leerse'); },
    write: () => {}, writeError: (l) => errores.push(l),
  }), 1, 'abrió una ruta que el helper rechazó');
  assert.match(errores.at(-1), /escapes the project/iu);
  assert.doesNotMatch(errores.at(-1), /VACÍO/u);

  const salida = [];
  assert.equal(main(['check', 'docs/intake/x.json'], {
    safePath: () => null,
    read: () => { throw new Error('no debería leerse'); },
    write: (l) => salida.push(l), writeError: () => {},
  }), 0, 'un proyecto que todavía no arrancó no incumple nada');
  assert.match(salida.at(-1), /^VACÍO: /u);
});
