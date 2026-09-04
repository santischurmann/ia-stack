#!/usr/bin/env node
// tablero-modelo.mjs — la mitad PURA del tablero: cuentas y render, sin tocar el disco.
//
// Vive separada del CLI a proposito. Todo lo que decide un numero se prueba pasandole registros
// escritos a mano, sin necesitar que exista ninguna transcripcion en la maquina donde corren las
// pruebas. Este archivo no importa `node:fs`, `node:os` ni `node:child_process`.
//
// LOS DOS ERRORES QUE ESTE MODULO EXISTE PARA NO COMETER, los dos medidos antes de escribirlo:
//
// 1. LOS TOKENS SE CUENTAN DOBLE si se suman las lineas. Una respuesta del asistente ocupa VARIAS
//    lineas del registro -- una por bloque de pensamiento, texto o herramienta -- y el objeto de uso
//    es IDENTICO en todas. Medido en tres transcripciones reales: sumar lineas infla entre 1,70x y
//    1,91x. Hay que deduplicar por `message.id`.
//
// 2. NO EXISTE UN NUMERO HONESTO DE HORAS. El reloj de pared incluye ratos en que no habia nadie:
//    para este proyecto, 447,9 h de span contra 36,1 h con evidencia. Y no hay valle en la
//    distribucion de huecos que justifique un umbral de 5, 15 o 30 minutos -- la densidad cae
//    monotona. El error por ELEGIR el umbral es siete veces el error estadistico. Por eso el modelo
//    devuelve una BANDA con su umbral a la vista, nunca un numero solo.

export const USAGE = 'usage: tablero-modelo.mjs check';

/** Umbral por defecto, en minutos, para cortar un hueco entre turnos. No sale de un valle en los
 * datos porque no hay ninguno: sale de ser el mas robusto a si mismo -- entre 2 y 5 minutos la
 * estimacion se mueve 1,4 h por duplicacion, y entre 15 y 30 se mueve 6,0. */
export const UMBRAL_MINUTOS = 5;

/** Un hueco mas largo que esto no es una pausa: es otro dia. Es el unico minimo empirico que la
 * distribucion muestra, entre 60 y 128 minutos. */
export const CORTE_SESION_MINUTOS = 120;

export const PERIODO_DIAS = 7;

/** Los turnos que cuentan. LISTA BLANCA, no negra: el registro trae mas tipos de los que uno
 * recuerda -- custom-title, mode, queue-operation, attachment, system -- y una lista negra solo
 * excluye lo que ya penso quien la escribio. */
export function esTurnoDeAsistente(registro) {
  return registro !== null && typeof registro === 'object' && registro.type === 'assistant';
}

/** Suma de tokens de un turno, tolerando que falte cualquier campo. */
export function tokensDe(uso) {
  if (uso === null || typeof uso !== 'object') return { entrada: 0, salida: 0, cacheLeido: 0, cacheEscrito: 0 };
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    entrada: n(uso.input_tokens),
    salida: n(uso.output_tokens),
    cacheLeido: n(uso.cache_read_input_tokens),
    cacheEscrito: n(uso.cache_creation_input_tokens),
  };
}

/** Agrega una lista de registros a totales, DEDUPLICANDO por `message.id`.
 * Devuelve tambien cuantas lineas se ignoraron por repetidas: ese numero es la prueba de que la
 * deduplicacion hizo algo, y se muestra. */
export function agregar(registros) {
  const vistos = new Set();
  const marcas = [];
  const porModelo = new Map();
  let repetidas = 0;
  const total = { entrada: 0, salida: 0, cacheLeido: 0, cacheEscrito: 0 };

  for (const r of registros) {
    if (!esTurnoDeAsistente(r)) continue;
    const id = r.message?.id;
    if (typeof id === 'string' && id !== '') {
      if (vistos.has(id)) { repetidas += 1; continue; }
      vistos.add(id);
    }
    const t = tokensDe(r.message?.usage);
    total.entrada += t.entrada;
    total.salida += t.salida;
    total.cacheLeido += t.cacheLeido;
    total.cacheEscrito += t.cacheEscrito;
    const modelo = typeof r.message?.model === 'string' ? r.message.model : 'desconocido';
    const previo = porModelo.get(modelo) ?? { turnos: 0, salida: 0 };
    porModelo.set(modelo, { turnos: previo.turnos + 1, salida: previo.salida + t.salida });
    const ms = Date.parse(r.timestamp ?? '');
    if (Number.isFinite(ms)) marcas.push(ms);
  }

  return {
    turnos: vistos.size,
    lineasRepetidas: repetidas,
    tokens: total,
    modelos: [...porModelo.entries()].map(([modelo, v]) => ({ modelo, ...v })).sort((a, b) => b.turnos - a.turnos),
    marcas: marcas.sort((a, b) => a - b),
  };
}

/** Horas como BANDA, nunca como numero.
 *  - piso: suma de huecos cortos. Es lo que tiene evidencia y no depende de ningun umbral discutible.
 *  - techo: suma de huecos hasta el corte de sesion. Es lo mas que se puede sostener.
 *  - descartado: lo que queda afuera, que es la diferencia con el reloj de pared. */
export function bandaDeHoras(marcas, umbralMinutos = UMBRAL_MINUTOS, corteMinutos = CORTE_SESION_MINUTOS) {
  if (marcas.length < 2) return { piso: 0, techo: 0, descartado: 0, umbralMinutos, corteMinutos, huecos: 0 };
  const orden = marcas.slice().sort((a, b) => a - b);
  let piso = 0;
  let techo = 0;
  let descartado = 0;
  for (let i = 1; i < orden.length; i += 1) {
    const min = (orden[i] - orden[i - 1]) / 60000;
    if (min <= umbralMinutos) { piso += min; techo += min; continue; }
    if (min <= corteMinutos) { techo += min; continue; }
    descartado += min;
  }
  const h = (m) => Math.round((m / 60) * 10) / 10;
  return { piso: h(piso), techo: h(techo), descartado: h(descartado), umbralMinutos, corteMinutos, huecos: orden.length - 1 };
}

/** Convierte tokens a dinero SOLO si hay una tabla de precios. Sin tabla no estima: devuelve null,
 * y el tablero dice por que. Nunca se trae una tarifa de ningun lado. */
export function costoDe(tokens, precios) {
  if (precios === null || typeof precios !== 'object' || Object.keys(precios).length === 0) return null;
  const porMillon = (clave) => (typeof precios[clave] === 'number' ? precios[clave] : null);
  const partes = [['entrada', tokens.entrada], ['salida', tokens.salida], ['cacheLeido', tokens.cacheLeido], ['cacheEscrito', tokens.cacheEscrito]];
  let total = 0;
  let faltan = [];
  for (const [clave, cantidad] of partes) {
    const precio = porMillon(clave);
    if (precio === null) { if (cantidad > 0) faltan.push(clave); continue; }
    total += (cantidad / 1_000_000) * precio;
  }
  return { total: Math.round(total * 100) / 100, faltan };
}

const ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

/** Escapa para HTML. Se prueba aparte y a proposito: el gate de seguridad del repositorio detecta
 * sinks por `innerHTML` y compania, asi que un generador que arma HTML con plantillas del lado de
 * Node NO dispara nada. Estar verde ahi no dice nada sobre este escape. */
export function escapar(valor) {
  return String(valor).replace(/[&<>"']/gu, (c) => ESCAPES[c]);
}

/** Hay tabla de precios? Nula, ausente y vacia valen lo mismo: no hay. */
export function hayPrecios(precios) {
  if (precios === null || precios === undefined) return false;
  if (typeof precios !== 'object') return false;
  return Object.keys(precios).length > 0;
}

const numero = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

/** El HTML entero, autocontenido: sin red, sin fuentes externas, sin scripts. */
export function renderizar(modelo) {
  const { proyectos = [], generadoEn = '(sin fecha)', precios = null } = modelo;
  const totalTokens = proyectos.reduce((a, p) => a + p.tokens.salida + p.tokens.entrada, 0);
  const filas = proyectos.map((p) => {
    const b = p.horas;
    const costo = costoDe(p.tokens, precios);
    return [
      '<tr>',
      `<td>${escapar(p.nombre)}</td>`,
      `<td class="n">${numero(p.sesiones)}</td>`,
      `<td class="n">${numero(p.turnos)}</td>`,
      `<td class="n">${numero(p.tokens.salida)}</td>`,
      `<td class="n">${b.piso}–${b.techo} h</td>`,
      `<td class="n">${costo === null ? '—' : `$${costo.total}`}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');

  // Tres estados que valen lo mismo -- nula, ausente y vacia -- escritos como una sola pregunta.
  // Antes era una expresion con `||` y `??` encadenados, y no habia forma de saber que rama faltaba
  // cuando la cobertura la marcaba: la funcion con nombre hace visible el caso que no se probo.
  const avisoDinero = !hayPrecios(precios)
    ? '<p class="aviso"><b>No se muestra dinero.</b> No hay tabla de precios: las transcripciones traen tokens y el nombre del modelo, nunca una tarifa. Traer una de internet seria afirmar un numero que este tablero no midio. Escribi la tuya en <code>precios.json</code> y aparece la columna.</p>'
    : '';

  return [
    '<h1>Tablero de ia-stack</h1>',
    `<p class="sello">Generado el ${escapar(generadoEn)}. Muestra el estado de ese momento, no el de ahora.</p>`,
    '<table>',
    '<thead><tr><th>Proyecto</th><th>Sesiones</th><th>Turnos</th><th>Tokens de salida</th><th>Horas (banda)</th><th>Costo</th></tr></thead>',
    `<tbody>\n${filas}\n</tbody>`,
    '</table>',
    `<p class="total">${numero(totalTokens)} tokens en total, sobre ${proyectos.length} proyecto(s).</p>`,
    avisoDinero,
    '<h2>Lo que este tablero no puede decirte</h2>',
    '<ul>',
    `<li><b>Las horas son una banda, no un numero.</b> El piso son los huecos de hasta ${UMBRAL_MINUTOS} min, que es lo unico con evidencia; el techo llega hasta ${CORTE_SESION_MINUTOS} min. No hay valle en la distribucion que justifique un umbral: elegirlo mueve el resultado mas que cualquier error de medicion.</li>`,
    '<li><b>Los tokens estan deduplicados por identificador de mensaje.</b> Sumar lineas los infla casi al doble, porque una respuesta ocupa varias.</li>',
    '<li><b>No sabe si el trabajo sirvio.</b> Cuenta actividad, no valor.</li>',
    '</ul>',
  ].join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('tablero-modelo.mjs')) {
  console.error(USAGE);
  process.exitCode = 2;
}
