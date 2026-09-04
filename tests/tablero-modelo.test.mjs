// La mitad pura del tablero: cuentas y render, sin tocar el disco.
//
// Todas las pruebas le pasan registros escritos a mano. Ninguna necesita que exista una
// transcripción en la máquina, y ninguna toca `~/.claude`.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORTE_SESION_MINUTOS,
  UMBRAL_MINUTOS,
  USAGE,
  agregar,
  bandaDeHoras,
  costoDe,
  escapar,
  esTurnoDeAsistente,
  hayPrecios,
  renderizar,
  tokensDe,
} from '../scripts/tablero-modelo.mjs';

const turno = (id, salida, ts, extra = {}) => ({
  type: 'assistant',
  timestamp: ts,
  message: { id, model: extra.model ?? 'modelo-x', usage: { output_tokens: salida, input_tokens: extra.entrada ?? 0, cache_read_input_tokens: extra.cacheLeido ?? 0, cache_creation_input_tokens: extra.cacheEscrito ?? 0 } },
});

test('sólo cuentan los turnos del asistente, y se reconocen por lista blanca', () => {
  assert.equal(esTurnoDeAsistente({ type: 'assistant' }), true);
  for (const t of ['user', 'custom-title', 'mode', 'queue-operation', 'attachment', 'system']) {
    assert.equal(esTurnoDeAsistente({ type: t }), false, `${t} no es un turno del asistente`);
  }
  // Lista BLANCA: un tipo que nadie previó tampoco cuenta, en vez de colarse.
  assert.equal(esTurnoDeAsistente({ type: 'inventado-manana' }), false);
  assert.equal(esTurnoDeAsistente(null), false);
  assert.equal(esTurnoDeAsistente('assistant'), false);
});

test('tokensDe tolera que falte cualquier campo, y nunca devuelve NaN', () => {
  assert.deepEqual(tokensDe(null), { entrada: 0, salida: 0, cacheLeido: 0, cacheEscrito: 0 });
  assert.deepEqual(tokensDe({}), { entrada: 0, salida: 0, cacheLeido: 0, cacheEscrito: 0 });
  assert.deepEqual(tokensDe({ output_tokens: 'muchos' }), { entrada: 0, salida: 0, cacheLeido: 0, cacheEscrito: 0 });
  assert.deepEqual(tokensDe({ output_tokens: Infinity }).salida, 0);
  assert.deepEqual(tokensDe({ input_tokens: 3, output_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 9 }),
    { entrada: 3, salida: 5, cacheLeido: 7, cacheEscrito: 9 });
});

test('EL DEFECTO CENTRAL · los tokens se deduplican por identificador de mensaje', () => {
  // Una respuesta ocupa VARIAS líneas — pensamiento, texto, herramienta — y el objeto de uso es
  // idéntico en todas. Medido en tres transcripciones reales: sumar líneas infla entre 1,70x y
  // 2,67x. Sin esta deduplicación el tablero miente por casi el doble.
  const registros = [
    turno('msg-1', 100, '2026-09-01T10:00:00.000Z'),
    turno('msg-1', 100, '2026-09-01T10:00:01.000Z'),
    turno('msg-1', 100, '2026-09-01T10:00:02.000Z'),
    turno('msg-2', 50, '2026-09-01T10:01:00.000Z'),
  ];
  const a = agregar(registros);
  assert.equal(a.turnos, 2, 'cuatro líneas son dos turnos');
  assert.equal(a.tokens.salida, 150, 'sumar líneas daría 350');
  assert.equal(a.lineasRepetidas, 2, 'el número de repetidas es la prueba de que dedujo algo');
});

test('un turno sin identificador se cuenta igual: perderlo sería peor que contarlo', () => {
  const a = agregar([{ type: 'assistant', timestamp: '2026-09-01T10:00:00.000Z', message: { usage: { output_tokens: 7 } } }]);
  assert.equal(a.tokens.salida, 7);
  assert.equal(a.turnos, 0, 'sin id no entra al conteo de turnos únicos, y eso queda dicho');
});

test('agregar reparte por modelo y ordena por turnos', () => {
  const a = agregar([
    turno('a', 1, '2026-09-01T10:00:00.000Z', { model: 'chico' }),
    turno('b', 1, '2026-09-01T10:01:00.000Z', { model: 'grande' }),
    turno('c', 1, '2026-09-01T10:02:00.000Z', { model: 'grande' }),
    { type: 'assistant', message: { id: 'd', usage: {} }, timestamp: 'no-es-fecha' },
  ]);
  // 'grande' tiene dos turnos; los otros uno cada uno y quedan en el orden en que aparecieron.
  assert.deepEqual(a.modelos.map((m) => m.modelo), ['grande', 'chico', 'desconocido']);
  assert.equal(a.marcas.length, 3, 'una marca de tiempo ilegible no entra');
});

test('LA BANDA DE HORAS · devuelve piso y techo, nunca un número solo', () => {
  const base = Date.parse('2026-09-01T10:00:00.000Z');
  const min = (n) => base + n * 60000;
  // Dos huecos cortos (3 y 4 min), uno medio (30 min) y uno larguísimo (10 h).
  const marcas = [min(0), min(3), min(7), min(37), min(637)];
  const b = bandaDeHoras(marcas);
  assert.equal(b.piso, 0.1, '7 minutos de huecos cortos');
  assert.equal(b.techo, 0.6, '7 + 30 = 37 min');
  assert.equal(b.descartado, 10, 'el hueco de 10 h se descarta entero');
  assert.equal(b.umbralMinutos, UMBRAL_MINUTOS);
  assert.equal(b.corteMinutos, CORTE_SESION_MINUTOS);
  assert.equal(b.huecos, 4);
});

test('con menos de dos marcas no hay banda que calcular, y no se inventa una', () => {
  assert.deepEqual(bandaDeHoras([]).piso, 0);
  assert.deepEqual(bandaDeHoras([1]).techo, 0);
  assert.equal(bandaDeHoras([]).huecos, 0);
});

test('la banda no depende del orden en que lleguen las marcas', () => {
  const base = Date.parse('2026-09-01T10:00:00.000Z');
  const desordenadas = [base + 180000, base, base + 60000];
  assert.deepEqual(bandaDeHoras(desordenadas), bandaDeHoras(desordenadas.slice().sort((a, b) => a - b)));
});

test('SIN TABLA DE PRECIOS NO HAY DINERO · costoDe devuelve null y no estima', () => {
  const tokens = { entrada: 1_000_000, salida: 1_000_000, cacheLeido: 0, cacheEscrito: 0 };
  assert.equal(costoDe(tokens, null), null);
  assert.equal(costoDe(tokens, {}), null);
  assert.equal(costoDe(tokens, 'no-es-tabla'), null);
});

test('con tabla de precios calcula, y dice qué tarifas le faltaron', () => {
  const tokens = { entrada: 2_000_000, salida: 1_000_000, cacheLeido: 500_000, cacheEscrito: 0 };
  const r = costoDe(tokens, { entrada: 3, salida: 15 });
  assert.equal(r.total, 21, '2M a 3 + 1M a 15');
  assert.deepEqual(r.faltan, ['cacheLeido'], 'una tarifa ausente con tokens reales se nombra, no se asume cero');
  // Sin tokens de esa clase no hace falta la tarifa: no se acusa de más.
  assert.deepEqual(costoDe({ entrada: 1_000_000, salida: 0, cacheLeido: 0, cacheEscrito: 0 }, { entrada: 3 }).faltan, []);
});

test('EL ESCAPE SE PRUEBA SOLO · el gate de seguridad no lo mira', () => {
  // El baseline detecta sinks por `innerHTML` y compañía. Un generador que arma HTML con plantillas
  // del lado de Node no dispara nada: estar verde ahí no dice absolutamente nada sobre esto.
  assert.equal(escapar('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapar('a & b'), 'a &amp; b');
  assert.equal(escapar('"comillas" y \'simples\''), '&quot;comillas&quot; y &#39;simples&#39;');
  assert.equal(escapar(42), '42');
  assert.equal(escapar(null), 'null');
});

const proyecto = (nombre, over = {}) => ({
  nombre, sesiones: 2, turnos: 10,
  tokens: { entrada: 100, salida: 900, cacheLeido: 0, cacheEscrito: 0 },
  horas: { piso: 1.5, techo: 4.2, descartado: 20, umbralMinutos: 5, corteMinutos: 120, huecos: 9 },
  ...over,
});

test('el render sale sin dinero y diciendo por qué, cuando no hay precios', () => {
  const html = renderizar({ generadoEn: '2026-09-04', proyectos: [proyecto('mi-proyecto')], precios: null });
  assert.match(html, /No se muestra dinero/u);
  assert.equal(html.includes('$'), false, 'sin tabla de precios no puede aparecer un signo de peso');
  assert.match(html, /1\.5–4\.2 h/u, 'las horas van como banda');
  assert.match(html, /2026-09-04/u, 'la fecha del build va a la vista');
  assert.match(html, /Lo que este tablero no puede decirte/u);
});

test('con precios aparece la columna de costo y desaparece el aviso', () => {
  const html = renderizar({ generadoEn: '2026-09-04', proyectos: [proyecto('p')], precios: { entrada: 3, salida: 15 } });
  assert.equal(html.includes('No se muestra dinero'), false);
  assert.match(html, /\$/u);
});

test('FALSIFICACIÓN · un nombre de proyecto hostil sale escapado, no ejecutado', () => {
  const html = renderizar({ generadoEn: 'x', proyectos: [proyecto('<img src=x onerror=alert(1)>')], precios: null });
  assert.equal(html.includes('<img'), false);
  assert.match(html, /&lt;img/u);
});

test('el render aguanta un modelo vacío sin romperse', () => {
  const html = renderizar({});
  assert.match(html, /sin fecha/u);
  assert.match(html, /0 tokens en total, sobre 0 proyecto/u);
});

test('el módulo puro no se ejecuta como CLI: no tiene nada que hacer solo', () => {
  assert.match(USAGE, /tablero-modelo/u);
});

test('un turno sin marca de tiempo no rompe ni inventa una', () => {
  // La rama del `??` en `Date.parse(r.timestamp ?? '')`: falta el campo entero.
  const a = agregar([{ type: 'assistant', message: { id: 'x', usage: { output_tokens: 3 } } }]);
  assert.equal(a.tokens.salida, 3);
  assert.deepEqual(a.marcas, []);
});

test('el aviso de dinero también aparece cuando la tabla de precios llega indefinida', () => {
  // Las dos ramas del aviso: `null` y ausente. Un `undefined` no puede colarse como "hay precios".
  const html = renderizar({ generadoEn: 'x', proyectos: [], precios: undefined });
  assert.match(html, /No se muestra dinero/u);
});

test('una tabla de precios VACÍA es lo mismo que no tenerla, y lo dice igual', () => {
  // Tres estados distintos y las tres ramas: nula, ausente y vacía. Un `{}` es lo que queda cuando
  // alguien crea el archivo y no escribe ninguna tarifa: no puede leerse como «hay precios».
  const html = renderizar({ generadoEn: 'x', proyectos: [], precios: {} });
  assert.match(html, /No se muestra dinero/u);
  assert.equal(html.includes('$'), false);
});

test('hayPrecios trata igual a la nula, la ausente y la vacía', () => {
  assert.equal(hayPrecios(null), false);
  assert.equal(hayPrecios(undefined), false);
  assert.equal(hayPrecios({}), false);
  assert.equal(hayPrecios('no es tabla'), false);
  assert.equal(hayPrecios({ salida: 15 }), true);
});
