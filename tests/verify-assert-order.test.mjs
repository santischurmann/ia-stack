// La aserción sobre el CONTENIDO de una respuesta que pasa porque la respuesta no existe.
//
// LA HERIDA, medida sobre un proyecto real en septiembre de 2026: un test afirmaba que ningún
// campo prohibido salía por un endpoint, y pasaba en verde porque el endpoint devolvía 404 y el
// cuerpo de un 404 tampoco trae esos campos. La prueba no probó nada y nadie se enteró.
//
// No es un defecto nuevo: es el sexto miembro de la lista de «formas de aserción prohibidas» que
// SKILL.md ya tenía, junto a la aserción adentro de un bucle que puede dar cero vueltas. La lista
// entera era honor system —«ninguna de estas falla mecánicamente»— y ésta es la primera que trae
// detector, que es lo que SKILL.md exige de toda regla nueva.
//
// POR QUE NACE EN MODO AVISO Y NO BLOQUEANDO. Este repositorio ya midió qué pasa cuando un
// detector se shipea sin medir su tasa de falsos: cinco diseños dieron 43, 26, 6, 5 y 3 hallazgos,
// TODOS falsos, sin un solo verdadero positivo en 210 archivos ni en 191 commits
// (docs/mejoras/2026-09-04.json). Un gate que grita en falso se ignora, y un gate ignorado no
// detecta nada. Sale 0 siempre hasta que la medición lo justifique.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVISO_PREFIX, CARPETA, EMPTY_PREFIX, SOBRE_CONTENIDO, SOBRE_ESTADO, SENAL_DE_PETICION, USAGE,
  bloquesDePrueba, hallazgos, main, sinCadenasNiComentarios,
} from '../scripts/verify-assert-order.mjs';

// --- El caso real que motivó todo -----------------------------------------------------------

const EL_404 = [
  '',
  "test('el endpoint no devuelve la contraseña', async () => {",
  "  const res = await fetch('http://127.0.0.1:3000/usuarios/1');",
  '  const cuerpo = await res.json();',
  '  assert.equal(cuerpo.password, undefined);',
  '});',
  '',
].join('\n');

const EL_404_ARREGLADO = [
  '',
  "test('el endpoint no devuelve la contraseña', async () => {",
  "  const res = await fetch('http://127.0.0.1:3000/usuarios/1');",
  '  assert.equal(res.status, 200);',
  '  const cuerpo = await res.json();',
  '  assert.equal(cuerpo.password, undefined);',
  '});',
  '',
].join('\n');

test('el caso del 404: una aserción sobre el cuerpo sin una previa sobre el estado se marca', () => {
  const h = hallazgos('api.test.mjs', EL_404);
  assert.equal(h.length, 1);
  assert.equal(h[0].archivo, 'api.test.mjs');
  assert.match(h[0].titulo, /no devuelve la contraseña/u);
  assert.match(h[0].evidencia, /cuerpo\.password/u);
  assert.equal(h[0].linea, 5);
});

test('con la aserción de estado delante, no hay hallazgo', () => {
  assert.deepEqual(hallazgos('api.test.mjs', EL_404_ARREGLADO), []);
});

// --- La guarda que evita el mar de falsos positivos ------------------------------------------

test('sin señal de petición no se marca nada: un test de una función pura usa «data» sin culpa', () => {
  const texto = [
    '',
    "test('normaliza los datos', () => {",
    '  const data = normalizar([1, 2]);',
    '  assert.deepEqual(data, [1, 2]);',
    '});',
    '',
  ].join('\n');
  assert.deepEqual(hallazgos('puro.test.mjs', texto), []);
});

test('la señal de petición reconoce las formas usuales y no cualquier llamada', () => {
  for (const forma of ['fetch(url)', 'request(app)', 'supertest(app)', 'axios.get(u)', 'got(u)', 'http.get(u)', 'undici.request(u)']) {
    assert.ok(SENAL_DE_PETICION.test(forma), forma);
  }
  assert.ok(!SENAL_DE_PETICION.test('normalizar(entrada)'));
});

test('el estado se reconoce por status, statusCode y .ok; el contenido por body, json, text, payload y data', () => {
  assert.ok(SOBRE_ESTADO.test('res.status'));
  assert.ok(SOBRE_ESTADO.test('r.statusCode'));
  assert.ok(SOBRE_ESTADO.test('res.ok'));
  assert.ok(!SOBRE_ESTADO.test('assert.ok(x)'));
  for (const c of ['res.body', 'await r.json()', 'r.text()', 'p.payload', 'd.data']) assert.ok(SOBRE_CONTENIDO.test(c), c);
  assert.ok(!SOBRE_CONTENIDO.test('assert.equal(a, b)'));
});

// --- Recorte de bloques ----------------------------------------------------------------------

test('bloquesDePrueba encuentra test() e it(), con llaves anidadas adentro', () => {
  const texto = [
    '',
    "test('uno', () => {",
    '  if (x) { y(); }',
    '});',
    "it('dos', async () => {",
    '  const o = { a: 1 };',
    '});',
    '',
  ].join('\n');
  const bloques = bloquesDePrueba(texto);
  assert.deepEqual(bloques.map((b) => b.titulo), ['uno', 'dos']);
  assert.match(bloques[0].cuerpo, /if \(x\)/u);
  assert.doesNotMatch(bloques[0].cuerpo, /const o/u);
  assert.equal(bloques[0].linea, 2);
  assert.equal(bloques[1].linea, 5);
});

test('una llave dentro de una cadena no desalinea el bloque', () => {
  const texto = [
    '',
    "test('con llave en texto', async () => {",
    "  const res = await fetch('/x');",
    "  const cierre = '}';",
    '  assert.equal(res.body.a, cierre);',
    '});',
    '',
  ].join('\n');
  assert.equal(hallazgos('x.test.mjs', texto).length, 1, 'el bloque se cerró antes de tiempo por una llave dentro de una cadena');
});

test('un test sin cuerpo entre llaves se ignora en vez de romper el barrido', () => {
  assert.deepEqual(bloquesDePrueba("test('sin cuerpo', fn);"), []);
});

test('un bloque sin llave de cierre se descarta: un archivo a medio escribir no inventa un bloque', () => {
  assert.deepEqual(bloquesDePrueba("test('abierto', () => {\n  assert.ok(1);"), []);
});

// --- El tokenizador --------------------------------------------------------------------------

test('sinCadenasNiComentarios borra el contenido y conserva el largo, para no mover ninguna posición', () => {
  const casos = [
    "a = 'x}y';",
    'a = "x}y";',
    'a = `x}y`;',
    'a = 1; // comentario con }',
    'a = 1; /* bloque con } */ b = 2;',
    "a = 'con \\' escapada}';",
  ];
  for (const caso of casos) {
    const limpio = sinCadenasNiComentarios(caso);
    assert.equal(limpio.length, caso.length, caso);
    assert.ok(!limpio.slice(4).includes('}'), `quedó una llave viva en: ${caso}`);
  }
});

test('sinCadenasNiComentarios conserva los saltos de línea, para que el número de línea siga siendo el real', () => {
  const limpio = sinCadenasNiComentarios('a = `uno\ndos`;\nb = 1;');
  assert.equal(limpio.split('\n').length, 3);
});

test('una cadena sin cerrar no cuelga el barrido: se consume hasta el final', () => {
  const abierta = "a = 'sin cerrar";
  assert.equal(sinCadenasNiComentarios(abierta).length, abierta.length);
});

test('un comentario de bloque sin cerrar tampoco cuelga', () => {
  const abierto = 'a = 1; /* sin cerrar';
  assert.equal(sinCadenasNiComentarios(abierto).length, abierto.length);
});

test('una división no se confunde con un comentario', () => {
  assert.equal(sinCadenasNiComentarios('a = b / c;'), 'a = b / c;');
});

// --- El CLI ----------------------------------------------------------------------------------

function io(archivos, existe = true) {
  return {
    hay: () => existe,
    listar: () => Object.keys(archivos),
    leer: (ruta) => archivos[ruta.replaceAll('\\', '/').split('/').pop()],
  };
}

test('sin carpeta de pruebas escribe VACÍO y sale 0: no había nada que comparar', () => {
  const dichos = [];
  assert.equal(main(['check'], (m) => dichos.push(m), () => {}, io({}, false)), 0);
  assert.ok(dichos[0].startsWith(EMPTY_PREFIX));
});

test('una carpeta sin archivos de prueba también escribe VACÍO', () => {
  const dichos = [];
  assert.equal(main(['check'], (m) => dichos.push(m), () => {}, io({ 'leeme.md': 'x' })), 0);
  assert.ok(dichos[0].startsWith(EMPTY_PREFIX));
});

test('con pruebas limpias escribe OK y su límite viaja con la línea de éxito', () => {
  const dichos = [];
  assert.equal(main(['check'], (m) => dichos.push(m), () => {}, io({ 'a.test.mjs': EL_404_ARREGLADO })), 0);
  assert.ok(dichos[0].startsWith('OK: '));
  assert.ok(dichos.some((d) => /barrer no es leer/iu.test(d)));
});

test('MODO AVISO: con hallazgos avisa, los nombra con archivo y línea, y SALE 0', () => {
  const dichos = [];
  const errores = [];
  const salida = main(['check'], (m) => dichos.push(m), (m) => errores.push(m), io({ 'a.test.mjs': EL_404 }));
  assert.equal(salida, 0, 'el modo aviso no frena la suite hasta que la medición lo justifique');
  assert.ok(errores.some((e) => e.startsWith(AVISO_PREFIX)));
  assert.ok(errores.some((e) => /a\.test\.mjs:5/u.test(e)));
});

test('un archivo ilegible se avisa, no se saltea en silencio', () => {
  const errores = [];
  const roto = { hay: () => true, listar: () => ['a.test.mjs'], leer: () => { throw new Error('EACCES'); } };
  assert.equal(main(['check'], () => {}, (m) => errores.push(m), roto), 0);
  assert.ok(errores.some((e) => /EACCES/u.test(e)));
});

test('la carpeta se puede pasar por argumento, y por defecto es la declarada', () => {
  assert.equal(CARPETA, 'tests');
  const vistas = [];
  main(['check', 'otra'], () => {}, () => {}, { hay: (c) => { vistas.push(c); return false; }, listar: () => [], leer: () => '' });
  assert.deepEqual(vistas, ['otra']);
});

test('un uso incorrecto sale 2 y escribe el uso', () => {
  const errores = [];
  assert.equal(main(['inesperado'], () => {}, (m) => errores.push(m)), 2);
  assert.deepEqual(errores, [USAGE]);
  assert.equal(main(['check', 'a', 'b'], () => {}, () => {}), 2);
});

// --- Falsificación ---------------------------------------------------------------------------

test('FALSIFICACIÓN · el detector no se conforma con que la aserción de estado exista: tiene que ir ANTES', () => {
  const tarde = [
    '',
    "test('estado tarde', async () => {",
    "  const res = await fetch('/x');",
    '  assert.equal(res.body.password, undefined);',
    '  assert.equal(res.status, 200);',
    '});',
    '',
  ].join('\n');
  assert.equal(hallazgos('t.test.mjs', tarde).length, 1, 'una aserción de estado posterior no rescata a la que ya pasó vacía');
});

test('FALSIFICACIÓN · sólo se marca la PRIMERA aserción de contenido del bloque, no todas', () => {
  const dos = [
    '',
    "test('dos cuerpos', async () => {",
    "  const res = await fetch('/x');",
    '  assert.equal(res.body.a, 1);',
    '  assert.equal(res.body.b, 2);',
    '});',
    '',
  ].join('\n');
  assert.equal(hallazgos('t.test.mjs', dos).length, 1, 'un hallazgo por bloque: el defecto es del bloque, no de cada línea');
});

test('FALSIFICACIÓN · una línea que menciona el cuerpo sin aserción no cuenta', () => {
  const texto = [
    '',
    "test('sin aserción', async () => {",
    "  const res = await fetch('/x');",
    '  const cuerpo = await res.json();',
    '  console.log(cuerpo.password);',
    '  assert.equal(res.status, 200);',
    '});',
    '',
  ].join('\n');
  assert.deepEqual(hallazgos('t.test.mjs', texto), [], 'leer el cuerpo no es afirmar algo sobre él');
});

test('un test cuyo primer argumento no es una cadena queda sin título en vez de romper el barrido', () => {
  const bloques = bloquesDePrueba('test(nombre, () => { assert.ok(1); });');
  assert.equal(bloques.length, 1);
  assert.equal(bloques[0].titulo, '');
});

test('una llave que abre y nunca cierra descarta el bloque aunque el paréntesis sí cierre', () => {
  assert.deepEqual(bloquesDePrueba('test(a, () => { );'), []);
});

test('el cuerpo se rastrea por la variable, no por su nombre en inglés: el caso real usaba castellano', () => {
  const texto = [
    '',
    "test('rastrea la variable', async () => {",
    "  const res = await fetch('/x');",
    '  const u = await res.json();',
    '  assert.equal(u.password, undefined);',
    '});',
    '',
  ].join('\n');
  assert.equal(hallazgos('t.test.mjs', texto).length, 1);
});

test('FALSIFICACIÓN · assert.ok no se cuenta como comprobación de estado', () => {
  const texto = [
    '',
    "test('assert.ok no rescata', async () => {",
    "  const res = await fetch('/x');",
    '  assert.ok(res.body);',
    '});',
    '',
  ].join('\n');
  assert.equal(hallazgos('t.test.mjs', texto).length, 1, 'assert.ok es la aserción, no el estado');
});

test('un test sin cuerpo no se roba el cuerpo del que viene después', () => {
  const bloques = bloquesDePrueba("test('sin cuerpo', fn);\ntest('con cuerpo', () => { assert.ok(1); });");
  assert.deepEqual(bloques.map((b) => b.titulo), ['con cuerpo']);
});

test('sin io inyectado usa el sistema de archivos real', () => {
  const dichos = [];
  assert.equal(main(['check', 'carpeta-que-no-existe-en-este-repositorio'], (m) => dichos.push(m), () => {}), 0);
  assert.ok(dichos[0].startsWith(EMPTY_PREFIX));
});

test('un comentario de bloque multilínea conserva sus saltos: si no, toda línea posterior se corre', () => {
  const limpio = sinCadenasNiComentarios('a = 1; /* uno\ndos */ b = 2;\nc = 3;');
  assert.equal(limpio.split('\n').length, 3);
  assert.match(limpio.split('\n')[2], /c = 3;/u);
});
