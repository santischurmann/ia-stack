// verify-test-duration.test.mjs — medir duración desde adentro de la suite no mide duración.
//
// POR QUÉ ESTO ES UN GATE Y NO UNA PRUEBA. Era una prueba más, adentro de `verify-test-bindings`.
// Medía cuánto tarda el archivo más lento y lo comparaba contra el tope de TAP, porque vincular un
// requisito a un archivo más lento lo marcaría TIMEOUT por lento y no por roto.
//
// El problema es que corría rodeada de noventa archivos compitiendo por la CPU. Medido el
// 2026-09-17, sobre `install-runtime.test.mjs`: **96 s solo** y **224 s** desde adentro de la suite.
// Factor de contención 2,3x contra un tope de 120 — con eso, cualquier archivo que pase de unos
// 52 s solo revienta el tope sin estar roto.
//
// Partir los archivos ayudó y no alcanzó: el problema no es el tamaño, es dónde se mide. Como gate
// propio corre solo, sin nada al lado, y mide lo que dice medir. El tope no se aflojó ni se saltea
// nada: sigue siendo el límite real de TAP.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import { esRuntimeInstalado } from './_entorno.mjs';
import { LIMITS_TEXT, MARGEN_MINIMO, RECONCILIAR, TOLERANCIA, TOPE_MS, USAGE, main, medir, veredicto } from '../scripts/verify-test-duration.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

const DECLARADO = {
  schema: 'ia.slowest-test/1',
  why: 'un motivo escrito de largo suficiente para el contrato del archivo más lento del repositorio',
  archivo: 'install-runtime.test.mjs',
  medido: '2026-09-16',
  segundos: 96,
  why_ese: 'instala el runtime completo en varios proyectos temporales, y cada instalación copia el árbol entero',
};

// --- El veredicto, que es lo único que tiene reglas -----------------------------------------------

test('con margen de sobra, aprueba y dice cuánto', () => {
  const r = veredicto('x.test.mjs', 0, TOPE_MS / MARGEN_MINIMO / 2);
  assert.equal(r.rechaza, false);
  assert.match(r.mensaje, new RegExp(`${TOPE_MS / 1000} s`, 'u'), 'el tope se publica, no se supone');
});

test('FALSIFICACIÓN · pasado el tope, rechaza y explica qué significa', () => {
  const r = veredicto('x.test.mjs', 0, TOPE_MS + 10_000);
  assert.equal(r.rechaza, true);
  assert.match(r.mensaje, /TIMEOUT/u, 'tiene que decir POR QUÉ importa, no sólo que se pasó');
});

test('FALSIFICACIÓN · si el archivo no pasa, lo que se midió no es su duración', () => {
  // Un archivo que falla puede terminar antes o después por motivos que no son su duración. Medir
  // eso y publicarlo como margen sería un número inventado.
  const r = veredicto('x.test.mjs', 1, 10_000);
  assert.equal(r.rechaza, true);
  assert.match(r.mensaje, /no es su duración|tiene que pasar/u);
});

// --- LA REGLA DEL TOPE, que es lo que se rompió en silencio ----------------------------------------
//
// `TAP_TIMEOUT_MS` no es un número elegido: se escribió con su regla al lado —«más del triple de
// margen sobre el más lento medido»— y los datos del 2026-09-05, cuando el más lento tardaba 40 s.
// Nadie comprobaba la regla, sólo el número. El 2026-09-17 ese mismo archivo mide 101 s contra un
// tope de 120: por debajo del tope, y con la regla rota por un factor de 2,5.
//
// «Por debajo del tope» y «lejos del tope» son cosas distintas, y ésta es la distinción que faltaba.

test('FALSIFICACIÓN · por debajo del tope pero sin el triple de margen, rechaza', () => {
  const apenas = Math.ceil(TOPE_MS / MARGEN_MINIMO) + 1000;
  assert.ok(apenas < TOPE_MS, 'la premisa de esta prueba es que está POR DEBAJO del tope');
  const r = veredicto('x.test.mjs', 0, apenas);
  assert.equal(r.rechaza, true, 'un margen que una máquina cargada se come no es margen');
  assert.doesNotMatch(r.mensaje, /TIMEOUT/u, 'todavía no da TIMEOUT: el defecto es el margen, y se dice distinto');
  assert.match(r.mensaje, new RegExp(`${MARGEN_MINIMO}`, 'u'), 'tiene que publicar la regla que aplica');
});

test('la frontera es la regla, no el tope', () => {
  assert.equal(veredicto('x.test.mjs', 0, TOPE_MS / MARGEN_MINIMO).rechaza, false, 'justo el triple entra');
  assert.equal(veredicto('x.test.mjs', 0, TOPE_MS / MARGEN_MINIMO + 1).rechaza, true, 'un milisegundo menos de triple, no');
});

test('el tope deja el triple sobre lo que el repositorio DECLARA como su archivo más lento', SOLO_FUENTE, () => {
  // La otra mitad de la misma regla, y la barata: no mide nada, lee el contrato. Atrapa el caso que
  // de verdad pasó — se declara un archivo más lento y el tope se queda donde estaba. El gate atrapa
  // la otra mitad, que es que la declaración haya quedado vieja contra la máquina.
  const declarado = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'slowest-test.json'), 'utf8'));
  const necesario = declarado.segundos * MARGEN_MINIMO * 1000;
  assert.ok(
    TOPE_MS >= necesario,
    `el contrato declara ${declarado.segundos} s el ${declarado.medido}, así que el tope tiene que ser al menos ${necesario / 1000} s y es ${TOPE_MS / 1000}`,
  );
});

test('el margen mínimo es al menos el triple: menos que eso no cubre lo que varía una máquina', () => {
  // Medido en esta máquina entre el 2026-09-16 y el 2026-09-17: los mismos archivos dieron 56 y 89 s,
  // y 33 y 53 s. Factor 1,6 entre días, sin que cambiara una línea. Un margen de 2x no lo cubre.
  assert.ok(MARGEN_MINIMO >= 3, `el margen declarado es ${MARGEN_MINIMO}`);
});

// --- EL TERCER ESTADO: cuando la máquina no deja medir -------------------------------------------
//
// El 2026-09-17, en una sola tarde y sin que cambiara una línea, el mismo archivo dio 89, 101, 116 y
// 247 s. La causa estaba medida, no supuesta: la CPU al 100% con procesos ajenos al repositorio.
//
// Las dos salidas posibles son destructivas. Aprobar tapa una regresión de verdad. Rechazar pone en
// rojo un gate por la carga de la máquina y no por el código — que es exactamente el rojo que no
// dice nada y que enseña a ignorar los rojos. Así que hay un tercer estado, igual que
// vivo/muerto/reconciliar: «medí esto y no me lo creo».

test('FALSIFICACIÓN · una medición muy por encima de lo declarado no aprueba NI rechaza', () => {
  const declaradoMs = 100_000;
  const r = veredicto('x.test.mjs', 0, declaradoMs * TOLERANCIA + 1000, declaradoMs);
  assert.equal(r.rechaza, false, 'un rojo por carga de máquina enseña a ignorar los rojos');
  assert.equal(r.reconciliar, true, 'y un verde taparía una regresión de verdad');
  assert.match(r.mensaje, /cargada|carga/u, 'tiene que nombrar las DOS causas posibles');
  assert.match(r.mensaje, /lent/u);
});

test('dentro de la tolerancia se juzga normal, que es lo que pasa en un runner quieto', () => {
  const declaradoMs = 100_000;
  const r = veredicto('x.test.mjs', 0, declaradoMs * TOLERANCIA - 1000, declaradoMs);
  assert.equal(r.reconciliar ?? false, false);
});

test('sin declaración que comparar no hay tercer estado: se juzga contra el tope y nada más', () => {
  const r = veredicto('x.test.mjs', 0, TOPE_MS / MARGEN_MINIMO / 2);
  assert.equal(r.reconciliar ?? false, false);
  assert.equal(r.rechaza, false);
});

test('pasarse del tope se rechaza igual, por cargada que esté la máquina', () => {
  // Acá no hay ambigüedad que reconciliar: el requisito vinculado da TIMEOUT de verdad, lo haya
  // causado el archivo o la máquina. Un tope de 600 s no se pasa por tener el navegador abierto.
  const r = veredicto('x.test.mjs', 0, TOPE_MS + 1000, 1000);
  assert.equal(r.rechaza, true);
  assert.equal(r.reconciliar ?? false, false);
});

test('main escribe RECONCILIAR y sale 0: no es una aprobación y no es un rechazo', () => {
  const salida = [];
  const code = main([], {
    cwd: repoRoot,
    leer: () => JSON.stringify({ ...DECLARADO, segundos: 10 }),
    spawn: () => ({ status: 0 }),
    ahora: (() => { let n = 0; return () => (n += 60_000); })(),
    write: (l) => salida.push(l),
    writeError: (l) => salida.push(l),
  });
  assert.equal(code, 0);
  assert.ok(salida.some((l) => l.startsWith(`${RECONCILIAR}: `)), salida.join(' · '));
  assert.ok(!salida.some((l) => l.startsWith('OK: ')), 'no puede leerse como aprobado');
});

test('una declaración de cero no habilita el tercer estado: no hay contra qué comparar', () => {
  // `main` no deja pasar un cero, pero `veredicto` es una función pública y comparar contra cero
  // daría infinito: toda medición reconciliaría, y el gate no diría nunca nada.
  for (const declarado of [0, -1, Number.NaN]) {
    const r = veredicto('x.test.mjs', 0, TOPE_MS / MARGEN_MINIMO / 2, declarado);
    assert.equal(r.reconciliar ?? false, false, `declarado ${declarado}`);
    assert.equal(r.rechaza, false);
  }
});

test('la tolerancia deja pasar el ruido normal de una máquina, no una regresión', () => {
  assert.ok(TOLERANCIA > 1, 'sin margen, cualquier medición reconciliaría');
  assert.ok(TOLERANCIA <= 2, 'con demasiado margen, una regresión de verdad se esconde adentro');
});

// --- La medición ------------------------------------------------------------------------------------

test('medir corre el archivo declarado, solo, y devuelve cuánto tardó', () => {
  const vistos = [];
  const r = medir('install-runtime.test.mjs', repoRoot, {
    spawn: (cmd, args) => { vistos.push(args.join(' ')); return { status: 0 }; },
    ahora: (() => { let n = 0; return () => (n += 1000); })(),
  });
  assert.match(vistos.join(' '), /install-runtime\.test\.mjs/u);
  assert.match(vistos.join(' '), /--test/u);
  assert.equal(r.status, 0);
  assert.equal(typeof r.ms, 'number');
});

test('medir NO le pasa al hijo la instrumentación de cobertura', () => {
  // El tope gobierna la corrida normal. Medir el hijo instrumentado compararía dos cosas distintas
  // — bajo cobertura el mismo archivo tarda unas tres veces más.
  let env = null;
  medir('x.test.mjs', repoRoot, { spawn: (c, a, o) => { env = o.env; return { status: 0 }; }, ahora: () => 0 });
  assert.equal(env.NODE_V8_COVERAGE, undefined);
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
});

// --- El cableado --------------------------------------------------------------------------------------

test('main sale 0 sobre el contrato real cuando el archivo entra en el tope', SOLO_FUENTE, () => {
  const salida = [];
  const code = main([], {
    cwd: repoRoot,
    leer: () => JSON.stringify(DECLARADO),
    spawn: () => ({ status: 0 }),
    ahora: (() => { let n = 0; return () => (n += TOPE_MS / MARGEN_MINIMO / 2); })(),
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0, salida.join('\n'));
  assert.match(salida.join('\n'), /^OK: /mu);
  assert.match(salida.join('\n'), /LÍMITE: /mu);
});

test('FALSIFICACIÓN · main sale 1 cuando el archivo se pasa del tope', () => {
  const errores = [];
  const code = main([], {
    cwd: repoRoot,
    leer: () => JSON.stringify(DECLARADO),
    spawn: () => ({ status: 0 }),
    ahora: (() => { let n = 0; return () => (n += TOPE_MS + 10_000); })(),
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: /u);
});

test('sin contrato dice VACÍO: no hay archivo declarado que medir', () => {
  const salida = [];
  const code = main([], {
    cwd: '/no/existe',
    leer: () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    write: (l) => salida.push(l),
    writeError: () => {},
  });
  assert.equal(code, 0);
  assert.match(salida.join('\n'), /^VACÍO: /u);
});

test('FALSIFICACIÓN · un contrato ilegible, o que declara mal, es un defecto', () => {
  for (const leer of [
    () => { throw new SyntaxError('Unexpected token }'); },
    () => JSON.stringify({ ...DECLARADO, archivo: 'no-es-una-prueba.mjs' }),
    () => JSON.stringify({ ...DECLARADO, segundos: 'noventa' }),
  ]) {
    const errores = [];
    assert.equal(main([], { cwd: repoRoot, leer, write: () => {}, writeError: (l) => errores.push(l) }), 1);
    assert.match(errores.join('\n'), /REJECTED: /u);
  }
});

test('FALSIFICACIÓN · un uso inválido sale 2 y dice cómo se usa', () => {
  const errores = [];
  assert.equal(main(['de-mas'], { write: () => {}, writeError: (l) => errores.push(l) }), 2);
  assert.match(errores.join('\n'), new RegExp(USAGE.slice(0, 18).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('el texto del límite dice lo que este gate NO puede saber', () => {
  assert.match(LIMITS_TEXT, /^LÍMITE: /u);
  assert.match(LIMITS_TEXT, /declara/iu, 'mide el archivo DECLARADO, no descubre cuál es el más lento');
});

test('medir sin inyecciones usa el spawn y el reloj de verdad', () => {
  // El camino que corre en el CI: nadie le inyecta nada. Se mide un archivo que no existe para que
  // termine enseguida — lo que se ejercita es que use las piezas reales, no cuánto tarda.
  const r = medir('no-existe-jamas.test.mjs', repoRoot);
  assert.equal(typeof r.ms, 'number');
  assert.ok(r.ms >= 0);
  assert.notEqual(r.status, 0, 'un archivo que no existe no puede pasar');
});

test('lo que se tira sin ser un Error igual se reporta, no sale «undefined»', () => {
  const errores = [];
  const code = main([], {
    cwd: repoRoot,
    leer: () => { throw 'el disco dijo que no'; },
    write: () => {},
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.doesNotMatch(errores.join('\n'), /undefined/u);
  assert.match(errores.join('\n'), /el disco dijo que no/u);
});

