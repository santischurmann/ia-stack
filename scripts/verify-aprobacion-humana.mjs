#!/usr/bin/env node
// verify-aprobacion-humana.mjs — LAW 10 (preview antes de construir) y LAW 11 (producción sólo con
// orden vigente), las dos leídas de un mismo registro: `.ia-stack/APROBACIONES.md`.
//
// Usage:
//   node scripts/verify-aprobacion-humana.mjs preview <APROBACIONES.md> --pieza <id> [--version <vN>]
//   node scripts/verify-aprobacion-humana.mjs tareas <tasks.json> <APROBACIONES.md> [--metricas <ruta>] [--tamano chico|medio|grande]
//   node scripts/verify-aprobacion-humana.mjs produccion <APROBACIONES.md> --sha <sha>
//
// Desde la 3.4.2 `tareas` exige `preview` en TODA tarea: la pieza aprobada o «no-aplica: <motivo>».
// Desde la 3.4.5 `tareas` exige además, por cada tarea que `clasificarTarea(description)` da como
// `alto_requisito`, la ronda de EGM convergida en la pieza `plan-<id>` (verify-egm-convergencia).
// `--metricas` por defecto: `metricas.jsonl` junto a APROBACIONES.md. `--tamano` por defecto: el de
// `ESTADO.md` de esa carpeta. Sin tareas de alto requisito no se lee ninguno de los dos.
// El registro es una tabla Markdown de 8 columnas, una fila por decisión, sólo se agregan filas:
//   | tipo | objeto | version | evidencia | mostrado | decidido | quien | estado |
// tipo pedido | research | marca | boceto | spec | preview: objeto = id de la pieza, version = vN.
// `boceto` vale como preview para el gate 3 (`preview` y `tareas`).
// tipo `produccion`: objeto = destino, version = sha completo o de 7+ hex, evidencia = qué se publica;
// el gate 5 sólo lee filas `produccion` (un sha abreviado que coincide con dos commits es ambiguo).
// mostrado/decidido van en DD-MM-AAAA HH:MM, hora argentina, 24 h. quien = la persona, nunca un agente.
// Preview: manda la última fila de la versión MAYOR de la pieza (una versión nueva vence a la vieja).
// Producción: manda la última fila del sha. Vale una vez: tras publicar, `aprobar.mjs usar --sha <sha>`.
//
// LA HERIDA: se construyeron pantallas y una landing antes de que él viera cómo
// quedaban, y hubo que rehacerlas; y un «sí» dado en otra sesión, o para otro sha, se tomó como
// permiso de publicar. Las dos reglas ya existían de palabra y se rompieron bajo presión.
//
// LÍMITE HONESTO: verifica lo REGISTRADO. No sabe si la persona vio de verdad el preview, ni si la
// fila la escribió el orquestador sin preguntar; ni si una tarea marcada «no-aplica» de verdad no
// tenía nada que mostrar. Un registro ausente, vacío o ilegible nunca aprueba por defecto.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { clasificarTarea } from './clasificar-tarea.mjs';
import { parseEstado } from './estado.mjs';
import { LECTORES_MINIMOS, checkConvergencia, leerMetricas } from './verify-egm-convergencia.mjs';

const COLUMNAS = ['tipo', 'objeto', 'version', 'evidencia', 'mostrado', 'decidido', 'quien', 'estado'];
// Fix aprobaciones: el tipo de cada fila es explícito. Sólo `produccion` lleva sha y estados revocado/usada;
// el resto (pedido, research, marca, boceto, spec, preview) lleva vN. `boceto` vale como preview (gate 3).
export const TIPOS_VERSION = ['pedido', 'research', 'marca', 'boceto', 'spec', 'preview'];
export const TIPOS = [...TIPOS_VERSION, 'produccion'];
const DECISIONES = ['aprobado', 'rechazado', 'pendiente'];
const ESTADOS = { ...Object.fromEntries(TIPOS_VERSION.map((t) => [t, DECISIONES])), produccion: [...DECISIONES, 'revocado', 'usada'] };
const COMO_PREVIEW = ['preview', 'boceto'];
export const RE_SHA = /^[0-9a-f]{7,40}$/u;
export const RE_VERSION = /^v\d+$/u;
const SELLO = /^chain:[0-9a-f]{64}$/;
const FECHA =/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/;
const NO_HUMANO = /\b(claude|codex|gpt|haiku|sonnet|opus|fable|agente|subagente|orquestador|sesi[oó]n|bot|ia|llm|modelo)\b|gpt-|^\s*$/iu;

export function esFechaValida(texto) {
  const m = FECHA.exec(texto);
  if (!m) return false;
  const [d, mes, a, h, min] = m.slice(1).map(Number);
  if (mes < 1 || mes > 12 || d < 1 || h > 23 || min > 59) return false;
  return d <= new Date(Date.UTC(a, mes, 0)).getUTCDate();
}

export function minutos(texto) {
  const [d, mes, a, h, min] = FECHA.exec(texto).slice(1).map(Number);
  return Date.UTC(a, mes - 1, d, h, min) / 60000;
}

export function esHumano(quien) {
  return !NO_HUMANO.test(quien);
}

export function leerTabla(texto) {
  const filas = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim().startsWith('|')) continue;
    const celdas = linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    // 3.4.4: `aprobar.mjs` sella cada fila con una novena celda `chain:<sha256>`; es la única que se acepta de más.
    if (celdas.length === COLUMNAS.length + 1 && SELLO.test(celdas[COLUMNAS.length])) celdas.pop();
    if (celdas.length !== COLUMNAS.length) throw new Error(`fila con ${celdas.length} columnas, el registro usa 8 columnas: ${linea.trim()}`);
    if (celdas[0] === 'tipo' || /^-+$/.test(celdas[0])) continue;
    if (!Object.hasOwn(ESTADOS, celdas[0])) throw new Error(`tipo inválido «${celdas[0]}» (${TIPOS.join(' | ')}): una fila mal escrita no se ignora`);
    filas.push(Object.fromEntries(COLUMNAS.map((c, i) => [c, celdas[i]])));
  }
  return filas;
}

function validarFila(f) {
  if (!ESTADOS[f.tipo].includes(f.estado)) return `estado inválido «${f.estado}» (${ESTADOS[f.tipo].join(' | ')})`;
  if (f.tipo !== 'produccion' && !RE_VERSION.test(f.version)) return `versión inválida «${f.version}» (v1, v2…): registrala con aprobar.mjs registrar --tipo ${f.tipo} --pieza ${f.objeto} --ref vN`;
  if (f.tipo === 'produccion' && !RE_SHA.test(f.version)) return `sha inválido «${f.version}» (7 a 40 hex): registrala con aprobar.mjs registrar --tipo produccion --ref <sha>`;
  if (f.evidencia === '') return 'falta la evidencia (qué preview o qué publicación se mostró)';
  if (!esFechaValida(f.mostrado)) return `fecha mostrado inválida «${f.mostrado}» (DD-MM-AAAA HH:MM)`;
  if (f.estado === 'pendiente') return null;
  if (!esFechaValida(f.decidido)) return `fecha decidido inválida «${f.decidido}» (DD-MM-AAAA HH:MM)`;
  if (minutos(f.decidido) < minutos(f.mostrado)) return 'se decidió antes de mostrarlo';
  if (!esHumano(f.quien)) return `«${f.quien}» no es un humano: un agente o una sesión no aprueban`;
  return null;
}

function veredicto(f, qué) {
  const error = validarFila(f);
  if (error) return { ok: false, reason: `${qué}: ${error}` };
  if (f.estado !== 'aprobado') return { ok: false, reason: `${qué}: la última decisión es «${f.estado}»` };
  return { ok: true, version: f.version, quien: f.quien, decidido: f.decidido, objeto: f.objeto };
}

const numeroDe = (v) => (RE_VERSION.test(v) ? Number(v.slice(1)) : -1);

/** Vigente = la última fila de la versión MAYOR: una aprobación de versión mayor deja vencida la anterior,
 * y re-aprobar una versión vieja después no la revive. Un boceto aprobado vale como preview. */
export function checkPreview(filas, pieza, version) {
  const propias = filas.filter((f) => COMO_PREVIEW.includes(f.tipo) && f.objeto === pieza);
  if (propias.length === 0) return { ok: false, reason: `no hay preview registrado para «${pieza}»` };
  const mayor = Math.max(...propias.map((f) => numeroDe(f.version)));
  const deMayor = propias.filter((f) => numeroDe(f.version) === mayor);
  const ultima = deMayor[deMayor.length - 1];
  const r = veredicto(ultima, `preview ${pieza} ${ultima.version}`);
  if (r.ok && version !== undefined && ultima.version !== version) {
    return { ok: false, reason: `se pidió construir ${version} y lo aprobado vigente es ${ultima.version}` };
  }
  return r;
}

export function checkProduccion(filas, sha) {
  if (!RE_SHA.test(sha)) return { ok: false, reason: `sha inválido «${sha}»` };
  const prefijos = (a, b) => a !== '' && b !== '' && (a.startsWith(b) || b.startsWith(a));
  const propias = filas.filter((f) => f.tipo === 'produccion' && prefijos(f.version, sha));
  if (propias.length === 0) return { ok: false, reason: `ninguna orden de producción registrada para ${sha}` };
  const versiones = [...new Set(propias.map((f) => f.version))];
  if (versiones.some((a) => versiones.some((b) => !prefijos(a, b)))) {
    return { ok: false, reason: `sha ${sha} ambiguo: coincide con órdenes de commits distintos (${versiones.join(', ')}); pasá el sha completo` };
  }
  return veredicto(propias[propias.length - 1], `orden de producción ${sha}`);
}

const NO_APLICA = /^no-aplica:(.*)$/su;

/** 3.4.2: TODA tarea declara su preview antes de escribir código (LAW 10): una pieza aprobada, o
 * «no-aplica: <motivo>» cuando no hay nada que mostrar. Una tarea visible nunca es «no-aplica». */
export function checkTareas(plan, filas, egm) {
  if (!Array.isArray(plan?.tasks)) return { ok: false, reason: 'el plan no tiene un arreglo tasks' };
  let conPreview = 0;
  let noAplica = 0;
  const ids = new Set();
  for (const t of plan.tasks) {
    if (typeof t?.id !== 'string' || t.id.trim() === '') return { ok: false, reason: 'tarea sin id' };
    if (ids.has(t.id)) return { ok: false, reason: `${t.id}: id repetido` };
    ids.add(t.id);
    if (typeof t.description !== 'string' || t.description.trim() === '') return { ok: false, reason: `${t.id}: tarea sin description` };
    if (typeof t.preview !== 'string' || t.preview === '') return { ok: false, reason: `${t.id}: tarea sin campo preview (pieza aprobada o «no-aplica: <motivo>»)` };
    const exento = NO_APLICA.exec(t.preview);
    if (exento) {
      if (exento[1].trim() === '') return { ok: false, reason: `${t.id}: «no-aplica» sin motivo escrito` };
      if (t.visible === true) return { ok: false, reason: `${t.id}: una tarea visible no puede ser «no-aplica»` };
      noAplica += 1;
      continue;
    }
    const r = checkPreview(filas, t.preview);
    if (!r.ok) return { ok: false, reason: `${t.id}: ${r.reason}` };
    conPreview += 1;
  }
  // 3.4.5: `egm` = { leer: () => registros, tamano }. Perezoso: sin tareas importantes no se consulta.
  const importantes = egm ? plan.tasks.filter((t) => clasificarTarea(t.description).clase === 'alto_requisito') : [];
  if (importantes.length > 0) {
    if (!egm.tamano) return { ok: false, reason: 'sin tamaño declarado: pasá --tamano' };
    const registros = egm.leer();
    for (const t of importantes) {
      const r = checkConvergencia(registros, `plan-${t.id}`, egm.tamano);
      if (!r.ok) return { ok: false, reason: `${t.id}: tarea de alto requisito sin ronda EGM convergida en plan-${t.id}: ${r.reason}` };
    }
  }
  return { ok: true, conPreview, noAplica, conRonda: importantes.length };
}

const USAGE = 'usage: verify-aprobacion-humana.mjs preview <APROBACIONES.md> --pieza <id> [--version <vN>] | tareas <tasks.json> <APROBACIONES.md> [--metricas <ruta>] [--tamano chico|medio|grande] | produccion <APROBACIONES.md> --sha <sha>';

export function parsear(argv) {
  const [cmd, ...resto] = argv;
  if (cmd === 'tareas') {
    const [plan, ledger, ...flags] = resto;
    if (!plan || !ledger || flags.length % 2 !== 0) return null;
    const args = { cmd, plan, ledger };
    for (let i = 0; i < flags.length; i += 2) {
      if (flags[i] !== '--metricas' && flags[i] !== '--tamano') return null;
      args[flags[i].slice(2)] = flags[i + 1];
    }
    return args;
  }
  if (cmd !== 'preview' && cmd !== 'produccion') return null;
  const [ledger, ...flags] = resto;
  if (!ledger || flags.length % 2 !== 0) return null;
  const permitidas = cmd === 'preview' ? ['--pieza', '--version'] : ['--sha'];
  const opciones = {};
  for (let i = 0; i < flags.length; i += 2) {
    if (!permitidas.includes(flags[i])) return null;
    opciones[flags[i].slice(2)] = flags[i + 1];
  }
  const requerida = cmd === 'preview' ? 'pieza' : 'sha';
  if (!opciones[requerida]) return null;
  return { cmd, ledger, ...opciones };
}

function leer(ruta, qué) {
  try {
    return readFileSync(ruta, 'utf8');
  } catch (error) {
    throw new Error(`no se pudo leer ${qué} ${JSON.stringify(ruta)}: ${error.message}`);
  }
}

/** Fuente de la ronda por tarea: métricas perezosas y tamaño de la bandera o de ESTADO.md. */
function egmDe(args) {
  if (args.tamano !== undefined && !(args.tamano in LECTORES_MINIMOS)) throw new Error(`tamaño inválido «${args.tamano}»`);
  const carpeta = dirname(args.ledger);
  const estado = join(carpeta, 'ESTADO.md');
  return {
    leer: () => leerMetricas(args.metricas ?? join(carpeta, 'metricas.jsonl')),
    get tamano() {
      return args.tamano ?? (existsSync(estado) ? parseEstado(readFileSync(estado, 'utf8')).tamano : null);
    },
  };
}

function main() {
  const args = parsear(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exit(2);
  }
  let r;
  try {
    const filas = leerTabla(leer(args.ledger, 'el registro'));
    if (args.cmd === 'preview') r = checkPreview(filas, args.pieza, args.version);
    else if (args.cmd === 'produccion') r = checkProduccion(filas, args.sha);
    else r = checkTareas(JSON.parse(leer(args.plan, 'el plan')), filas, egmDe(args));
  } catch (error) {
    r = { ok: false, reason: error.message };
  }
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  if (args.cmd === 'preview') console.log(`OK: preview ${args.pieza} ${r.version} aprobado por ${r.quien} el ${r.decidido}`);
  else if (args.cmd === 'produccion') console.log(`OK: orden de producción para ${args.sha} (${r.objeto}) dada por ${r.quien} el ${r.decidido}; vale una vez: tras publicar, registrá la fila «usada»`);
  else console.log(`OK: ${r.conPreview + r.noAplica} tarea(s): ${r.conPreview} con preview aprobado y ${r.noAplica} «no-aplica»${r.conRonda > 0 ? `; ${r.conRonda} con ronda EGM convergida` : ''}`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-aprobacion-humana.mjs')) main();
