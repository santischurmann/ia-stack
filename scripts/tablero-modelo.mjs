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

/** La banda de horas de cada dia, no una sola del proyecto entero.
 *
 * Se parte por dia UTC, igual que todo el resto del modelo: mezclar husos daria horas que no suman
 * con las del proyecto. Cada dia se mide con la MISMA funcion que el total -- si el criterio del
 * umbral cambia, cambia en los dos lados a la vez. */
export function bandaPorDia(marcas, umbralMinutos = UMBRAL_MINUTOS, corteMinutos = CORTE_SESION_MINUTOS) {
  const porDia = new Map();
  for (const ms of marcas) {
    const dia = new Date(ms).toISOString().slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(ms);
  }
  return [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dia, suyas]) => ({ dia, ...bandaDeHoras(suyas, umbralMinutos, corteMinutos) }));
}

/** En que fase quedo un proyecto, segun las decisiones que registro.
 *
 * `superseded` NO cuenta como cerrada: significa que esa decision se reemplazo, y contarla diria que
 * la fase esta resuelta cuando lo que hay es una decision retirada. Un registro ausente o sin forma
 * no es un error: es un proyecto que todavia no registro ninguna fase. */
export function estadoDeFases(decisiones) {
  const vacio = { ultima: null, faltan: [], completo: false, cerradas: [] };
  if (decisiones === null || typeof decisiones !== 'object' || Array.isArray(decisiones)) return vacio;
  const orden = Array.isArray(decisiones.phase_order) ? decisiones.phase_order : null;
  const lista = Array.isArray(decisiones.decisions) ? decisiones.decisions : [];
  if (orden === null || orden.length === 0) return vacio;
  const cerradas = orden.filter((f) => lista.some((d) => d?.phase_id === f && d?.status !== 'superseded'));
  const faltan = orden.filter((f) => !cerradas.includes(f));
  return { ultima: cerradas.at(-1) ?? null, faltan, completo: faltan.length === 0, cerradas };
}

/** Cuantas rondas de mejoras hay y cuales quedaron sin cerrar. Una ronda sin `cerradas` es una ronda
 * cuyas propuestas nadie atendio: es lo que el tablero tiene que hacer visible. */
export function rondasDeMejoras(rondas) {
  const sinCerrar = rondas.filter((r) => r.registro?.cerradas === undefined).map((r) => r.nombre);
  return {
    total: rondas.length,
    abiertas: sinCerrar.length,
    propuestas: rondas.reduce((a, r) => a + (Array.isArray(r.registro?.propuestas) ? r.registro.propuestas.length : 0), 0),
    sinCerrar,
  };
}

const PLACEHOLDER = /^\(/u;

/** El titular de SESSION.md: que feature y en que estado. Nada mas -- el resto del archivo es prosa
 * que este tablero no interpreta. */
export function estadoDeSesion(texto) {
  const leer = (etiqueta) => {
    // El patron se arma con `String.raw` para que las barras invertidas lleguen enteras al regex:
    // escritas dentro de un template comun, `\*` se colapsa a `*` y da "Nothing to repeat".
    const m = String(texto).match(new RegExp(String.raw`\*\*${etiqueta}:\*\*\s*(.+)`, 'u'));
    if (m === null) return null;
    const valor = m[1].trim();
    return valor === '' || PLACEHOLDER.test(valor) ? null : valor;
  };
  return { feature: leer('Feature slug'), estado: leer('Status') };
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

// Constante para el salto de linea: escribirlo literal adentro de un template lo convierte en un
// salto real al pasar por una herramienta que reescribe el archivo, y eso ya rompio este modulo.
const SALTO = String.fromCharCode(10);
const numero = (n) => new Intl.NumberFormat('es-AR').format(Math.round(n));

/** En que fase quedo, y cuales faltan. Un proyecto que no declara fases dice que no declara, en vez
 * de aparentar estar completo: el vacio y el exito no se escriben igual. */
export function estadoDeFasesHtml(fases) {
  if (fases === undefined || fases === null || fases.ultima === null) return '<span class="sin">sin fases declaradas</span>';
  if (fases.completo) return `<b>completo</b> (${fases.cerradas.length})`;
  return `hasta la <b>${escapar(fases.ultima)}</b>, faltan ${escapar(fases.faltan.join(', '))}`;
}

/** Las rondas de mejoras, y sobre todo cuantas quedaron SIN cerrar: una ronda escrita y no atendida
 * es trabajo pendiente que nadie ve. */
export function mejorasHtml(mejoras) {
  if (mejoras === undefined || mejoras === null || mejoras.total === 0) return '<span class="sin">ninguna</span>';
  const abiertas = mejoras.abiertas > 0 ? ` · <b>${mejoras.abiertas} sin cerrar</b>` : '';
  return `${numero(mejoras.total)} ronda(s), ${numero(mejoras.propuestas)} propuesta(s)${abiertas}`;
}

export function sesionHtml(sesion) {
  if (sesion === undefined || sesion === null || sesion.feature === null) return '<span class="sin">sin sesión declarada</span>';
  return `${escapar(sesion.feature)}${sesion.estado === null ? '' : ` · ${escapar(sesion.estado)}`}`;
}

/** Las horas de cada dia, que es lo que se pidio: una banda por dia y no una sola del proyecto. */
export function diasHtml(proyectos) {
  const filas = [];
  for (const p of proyectos) {
    for (const d of p.dias ?? []) {
      filas.push(`<tr><td>${escapar(d.dia)}</td><td>${escapar(p.nombre)}</td><td class="n">${d.piso}–${d.techo} h</td><td class="n">${numero(d.huecos)}</td></tr>`);
    }
  }
  if (filas.length === 0) return '';
  filas.sort();
  return [
    '<h2>Horas por día</h2>',
    '<p>La misma banda que arriba, partida por día. El piso es lo que tiene evidencia; el techo, lo más que se puede sostener.</p>',
    '<table>',
    '<thead><tr><th>Día</th><th>Proyecto</th><th>Horas (banda)</th><th>Huecos</th></tr></thead>',
    `<tbody>${SALTO}${filas.join(SALTO)}${SALTO}</tbody>`,
    '</table>',
  ].join(SALTO);
}

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
      `<td>${estadoDeFasesHtml(p.fases)}</td>`,
      `<td>${mejorasHtml(p.mejoras)}</td>`,
      `<td>${sesionHtml(p.sesion)}</td>`,
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
    '<thead><tr><th>Proyecto</th><th>Sesiones</th><th>Turnos</th><th>Tokens de salida</th><th>Horas (banda)</th><th>Costo</th><th>Fases</th><th>Mejoras</th><th>Sesión</th></tr></thead>',
    `<tbody>\n${filas}\n</tbody>`,
    '</table>',
    `<p class="total">${numero(totalTokens)} tokens en total, sobre ${proyectos.length} proyecto(s).</p>`,
    diasHtml(proyectos),
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
