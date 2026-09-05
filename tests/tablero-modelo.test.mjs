// La mitad pura del tablero: cuentas y render, sin tocar el disco.
//
// Todas las pruebas le pasan registros escritos a mano. Ninguna necesita que exista una
// transcripción en la máquina, y ninguna toca `~/.claude`.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

import {
  CORTE_SESION_MINUTOS,
  UMBRAL_MINUTOS,
  USAGE,
  agregar,
  bandaDeHoras,
  bandaPorDia,
  estadoDeFases,
  estadoDeFasesHtml,
  mejorasHtml,
  sesionHtml,
  estadoDeSesion,
  rondasDeMejoras,
  costoDe,
  escapar,
  esTurnoDeAsistente,
  hayPrecios,
  renderizar,
  tokensDe,
} from '../scripts/tablero-modelo.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
// Self-check: barre los HTML versionados de ESTE checkout.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

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

// --- Lo que faltaba del pedido original ---------------------------------------------------------
//
// El tablero mostraba proyectos, sesiones, turnos, tokens y una banda de horas por proyecto. El
// pedido incluía cuatro cosas más que no estaban: horas POR DÍA, el estado de cada fase del plan,
// un escaneo de protocolos que quedaron a medias, y qué mejoras se hicieron.
//
// Todo lo de acá es PURO: recibe contenido y devuelve datos. Leer el disco es del CLI.

test('bandaPorDia parte las marcas por día y da una banda de cada uno', () => {
  const d = (iso) => Date.parse(iso);
  const marcas = [
    d('2026-09-01T10:00:00Z'), d('2026-09-01T10:02:00Z'), d('2026-09-01T10:03:00Z'),
    d('2026-09-03T14:00:00Z'), d('2026-09-03T14:01:00Z'),
  ];
  const dias = bandaPorDia(marcas);
  assert.deepEqual(dias.map((x) => x.dia), ['2026-09-01', '2026-09-03']);
  assert.ok(dias[0].piso > 0, 'tres marcas seguidas dan piso mayor que cero');
  assert.equal(dias.every((x) => x.piso <= x.techo), true, 'el piso nunca puede pasar al techo');
  // El corte es por día UTC, igual que todo el resto del modelo: mezclar husos daría horas que no
  // suman con las del proyecto.
  assert.deepEqual(bandaPorDia([]), []);
  assert.deepEqual(bandaPorDia([d('2026-09-01T10:00:00Z')]).map((x) => x.dia), ['2026-09-01']);
});

test('estadoDeFases lee las decisiones registradas y dice cuál fue la última', () => {
  const decisiones = { schema: 'x', phase_order: ['1', '2', '3'], decisions: [
    { phase_id: '1', phase_name: 'BOOTSTRAP', status: 'decided' },
    { phase_id: '2', phase_name: 'RESEARCH', status: 'decided' },
  ] };
  const e = estadoDeFases(decisiones);
  assert.equal(e.ultima, '2');
  assert.deepEqual(e.faltan, ['3']);
  assert.equal(e.completo, false);

  const cerrado = estadoDeFases({ phase_order: ['1'], decisions: [{ phase_id: '1', status: 'decided' }] });
  assert.equal(cerrado.completo, true);
  assert.deepEqual(cerrado.faltan, []);
});

test('FALSIFICACIÓN · una decisión reemplazada no cuenta como fase cerrada', () => {
  // `superseded` significa que esa decisión se reemplazó: contarla como cerrada diría que la fase
  // está resuelta cuando lo que hay es una decisión retirada.
  const e = estadoDeFases({ phase_order: ['1', '2'], decisions: [
    { phase_id: '1', status: 'decided' },
    { phase_id: '2', status: 'superseded' },
  ] });
  assert.deepEqual(e.faltan, ['2']);
  assert.equal(e.completo, false);
});

test('estadoDeFases tolera un registro ausente o sin forma', () => {
  for (const malo of [null, undefined, 'texto', [], {}, { phase_order: 'no es lista' }]) {
    const e = estadoDeFases(malo);
    assert.equal(e.completo, false);
    assert.equal(e.ultima, null);
    assert.deepEqual(e.faltan, []);
  }
});

test('rondasDeMejoras separa las cerradas de las abiertas', () => {
  const r = rondasDeMejoras([
    { nombre: '2026-09-04.json', registro: { propuestas: [1, 2], cerradas: { '2026-09-04': 'se hizo' } } },
    { nombre: '2026-09-05.json', registro: { propuestas: [1] } },
  ]);
  assert.equal(r.total, 2);
  assert.equal(r.abiertas, 1);
  assert.equal(r.propuestas, 3);
  assert.deepEqual(r.sinCerrar, ['2026-09-05.json']);
  assert.deepEqual(rondasDeMejoras([]), { total: 0, abiertas: 0, propuestas: 0, sinCerrar: [] });
});

test('estadoDeSesion saca el titular de SESSION.md sin inventar', () => {
  const s = estadoDeSesion('# Session — 2026-09-05\n\n**Feature slug:** mi-feature\n**Status:** en progreso\n\ntexto');
  assert.deepEqual(s, { feature: 'mi-feature', estado: 'en progreso' });
  assert.deepEqual(estadoDeSesion('sin nada'), { feature: null, estado: null });
  assert.deepEqual(estadoDeSesion(''), { feature: null, estado: null });
  // El placeholder de la plantilla no es una feature declarada.
  assert.equal(estadoDeSesion('**Feature slug:** (set before first gate)').feature, null);
});

test('el HTML de cada columna distingue lo vacío de lo completo, y lo dice distinto', () => {
  // Las tres columnas nuevas tienen un caso "no hay nada" que NO se escribe como éxito: un proyecto
  // que no usa el protocolo no puede parecer uno que lo completó.
  assert.match(estadoDeFasesHtml(undefined), /sin fases/u);
  assert.match(estadoDeFasesHtml(null), /sin fases/u);
  assert.match(estadoDeFasesHtml({ ultima: null, faltan: [], completo: false, cerradas: [] }), /sin fases/u);
  assert.match(estadoDeFasesHtml({ ultima: '3', faltan: [], completo: true, cerradas: ['1', '2', '3'] }), /completo.*3/su);
  assert.match(estadoDeFasesHtml({ ultima: '2', faltan: ['3'], completo: false, cerradas: ['1', '2'] }), /hasta la.*faltan 3/su);

  assert.match(mejorasHtml(undefined), /ninguna/u);
  assert.match(mejorasHtml({ total: 0, abiertas: 0, propuestas: 0, sinCerrar: [] }), /ninguna/u);
  assert.match(mejorasHtml({ total: 2, abiertas: 0, propuestas: 7, sinCerrar: [] }), /2 ronda\(s\), 7 propuesta/u);
  assert.doesNotMatch(mejorasHtml({ total: 2, abiertas: 0, propuestas: 7, sinCerrar: [] }), /sin cerrar/u);
  assert.match(mejorasHtml({ total: 2, abiertas: 1, propuestas: 7, sinCerrar: ['x'] }), /1 sin cerrar/u);

  assert.match(sesionHtml(undefined), /sin sesión/u);
  assert.match(sesionHtml({ feature: null, estado: null }), /sin sesión/u);
  assert.equal(sesionHtml({ feature: 'mi-feature', estado: null }), 'mi-feature');
  assert.match(sesionHtml({ feature: 'mi-feature', estado: 'en progreso' }), /mi-feature · en progreso/u);
  // Y escapa: el nombre de una feature entra al HTML sin que nadie lo revise.
  assert.match(sesionHtml({ feature: '<script>', estado: null }), /&lt;script&gt;/u);
});

test('bandaPorDia ordena los días de más viejo a más nuevo', () => {
  const d = (iso) => Date.parse(iso);
  // Se pasan desordenados a propósito: el orden lo tiene que poner la función, no la entrada.
  const dias = bandaPorDia([d('2026-09-03T10:00:00Z'), d('2026-09-01T10:00:00Z'), d('2026-09-02T10:00:00Z')]);
  assert.deepEqual(dias.map((x) => x.dia), ['2026-09-01', '2026-09-02', '2026-09-03']);
});

test('rondasDeMejoras tolera una ronda sin lista de propuestas', () => {
  // Un registro que se escribió a medias no puede tumbar el tablero entero.
  const r = rondasDeMejoras([{ nombre: 'x.json', registro: { cerradas: { '2026-09-05': 'ok' } } }]);
  assert.equal(r.propuestas, 0);
  assert.equal(r.total, 1);
  assert.equal(r.abiertas, 0);
});

test('estadoDeFases con phase_order pero ninguna decisión no dice que haya una última', () => {
  const e = estadoDeFases({ phase_order: ['1', '2'], decisions: [] });
  assert.equal(e.ultima, null);
  assert.deepEqual(e.faltan, ['1', '2']);
});

// --- La página tiene que verse ------------------------------------------------------------------
//
// El render usaba cinco clases —`n`, `sello`, `total`, `aviso`, `sin`— y NINGUNA estaba definida:
// ni el archivo que escribe `build` ni lo que sirve `serve` traían una sola regla de estilo. Nadie
// lo vio hasta que se abrió el tablero en un navegador. Es el defecto que sólo aparece cuando mirás
// el producto en vez de correr su suite.
//
// Los estilos van EMBEBIDOS: la página es autocontenida y no pide nada a la red, que es la misma
// razón por la que no tiene scripts ni fuentes externas.

test('la página trae sus estilos, y define todas las clases que usa', () => {
  const html = renderizar({ generadoEn: '2026-09-05', proyectos: [] });
  assert.match(html, /<style>/u, 'sin hoja de estilos la tabla se ve como texto plano');
  const usadas = [...new Set([...html.matchAll(/class="([a-z]+)"/gu)].map((m) => m[1]))];
  const definidas = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  for (const clase of usadas) {
    // `String.raw`: en un template común, `\b` es el carácter backspace y no el límite de palabra
    // del regex, así que el patrón buscaba algo que ningún CSS contiene. Error ya cometido antes.
    assert.match(definidas, new RegExp(String.raw`\.${clase}\b`, 'u'), `la clase "${clase}" se usa y no está definida`);
  }
});

test('la página no pide nada a la red: sin scripts, sin fuentes ni hojas externas', () => {
  // Un tablero con datos de todos tus proyectos que llame a un servidor ajeno le contaría a ese
  // servidor cuándo lo abrís. Autocontenido no es una preferencia estética.
  const html = renderizar({ generadoEn: '2026-09-05', proyectos: [] });
  assert.doesNotMatch(html, /<script/u);
  assert.doesNotMatch(html, /https?:\/\//u);
  assert.doesNotMatch(html, /<link/u);
  assert.doesNotMatch(html, /@import/u);
});

test('la tabla puede desbordar sin romper la página', () => {
  // Con nueve columnas, en una ventana angosta el ancho se va. Que la tabla scrollee sola es lo que
  // evita que las últimas columnas queden invisibles, que es como se vio la primera vez.
  const html = renderizar({ generadoEn: '2026-09-05', proyectos: [] });
  assert.match(html, /overflow-x:\s*auto/u);
});

test('FALSIFICACIÓN · el HTML cierra todos los contenedores que abre', () => {
  // Un `<div>` sin cerrar deja el resto de la página adentro de un contenedor con scroll, y en
  // pantalla aparece como un hueco vacío de una pantalla entera. Se vio abriéndolo, no en la suite:
  // el HTML era "válido" para cualquier parser tolerante y la página estaba rota igual.
  const html = renderizar({
    generadoEn: '2026-09-05',
    proyectos: [{
      nombre: 'x', sesiones: 1, turnos: 1, lineasRepetidas: 0,
      tokens: { entrada: 1, salida: 1, cacheLeido: 0, cacheEscrito: 0 }, modelos: [],
      horas: { piso: 1, techo: 2, descartado: 0, umbralMinutos: 5, corteMinutos: 120, huecos: 1 },
      dias: [{ dia: '2026-09-05', piso: 1, techo: 2, descartado: 0, umbralMinutos: 5, corteMinutos: 120, huecos: 1 }],
      fases: { ultima: null, faltan: [], completo: false, cerradas: [] },
      mejoras: { total: 0, abiertas: 0, propuestas: 0, sinCerrar: [] },
      sesion: { feature: null, estado: null },
    }],
  });
  for (const etiqueta of ['div', 'table', 'tbody', 'thead', 'ul']) {
    const abre = (html.match(new RegExp(String.raw`<${etiqueta}[\s>]`, 'gu')) ?? []).length;
    const cierra = (html.match(new RegExp(`</${etiqueta}>`, 'gu')) ?? []).length;
    assert.equal(abre, cierra, `<${etiqueta}>: ${abre} abiertos y ${cierra} cerrados`);
  }
});

test('todo HTML que el repositorio publica cierra lo que abre', SOLO_FUENTE, () => {
  // La regla nació mirando el tablero, donde un `<div>` sin cerrar dejó el resto de la página
  // adentro de un contenedor con scroll y en pantalla apareció como un hueco vacío. El repositorio
  // versiona otro HTML —`docs/mapa-del-protocolo.html`, con 77 divs y 5 secciones— y nadie
  // comprobaba que cerrara nada. Se busca por forma: cualquier `.html` versionado entra solo.
  const publicados = execFileSync('git', ['ls-files', '*.html'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(publicados.length > 0, 'el barrido tiene que encontrar HTML, o no prueba nada');
  const rotos = [];
  for (const ruta of publicados) {
    const html = readFileSync(join(repoRoot, ruta), 'utf8');
    for (const etiqueta of ['div', 'table', 'tbody', 'thead', 'ul', 'section', 'main']) {
      const abre = (html.match(new RegExp(String.raw`<${etiqueta}[\s>]`, 'gu')) ?? []).length;
      const cierra = (html.match(new RegExp(`</${etiqueta}>`, 'gu')) ?? []).length;
      if (abre !== cierra) rotos.push(`${ruta} · <${etiqueta}>: ${abre} abiertos y ${cierra} cerrados`);
    }
  }
  assert.deepEqual(rotos, [], 'un contenedor sin cerrar deja el resto de la página adentro de él');
});
