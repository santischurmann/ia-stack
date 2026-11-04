#!/usr/bin/env node
// verify-aprobacion-humana.mjs — LAW 10 (preview antes de construir) y LAW 11 (producción sólo con
// orden vigente), las dos leídas de un mismo registro: `.vibe/APROBACIONES.md`.
//
// Usage:
//   node scripts/verify-aprobacion-humana.mjs preview <APROBACIONES.md> --pieza <id> [--version <vN>]
//   node scripts/verify-aprobacion-humana.mjs tareas <tasks.json> <APROBACIONES.md>
//   node scripts/verify-aprobacion-humana.mjs produccion <APROBACIONES.md> --sha <sha>
//
// El registro es una tabla Markdown de 8 columnas, una fila por decisión, sólo se agregan filas:
//   | tipo | objeto | version | evidencia | mostrado | decidido | quien | estado |
// tipo `preview`: objeto = id de la pieza, version = vN, evidencia = ruta o URL del preview mostrado.
// tipo `produccion`: objeto = destino, version = sha completo o de 7+ hex, evidencia = qué se publica.
// mostrado/decidido van en DD-MM-AAAA HH:MM, hora argentina, 24 h. quien = la persona, nunca un agente.
// Manda la ÚLTIMA fila de cada objeto/sha: una versión nueva pendiente deja vencida la aprobación vieja.
// Una orden de producción vale una vez: tras publicar se agrega la fila `usada`.
//
// LA HERIDA (el operador, 04-11-2026): se construyeron pantallas y una landing antes de que él viera cómo
// quedaban, y hubo que rehacerlas; y un «sí» dado en otra sesión, o para otro sha, se tomó como
// permiso de publicar. Las dos reglas ya existían de palabra y se rompieron bajo presión.
//
// LÍMITE HONESTO: verifica lo REGISTRADO. No sabe si la persona vio de verdad el preview, ni si la
// fila la escribió el orquestador sin preguntar; tampoco sabe qué tarea es visible si el plan no la
// marca `visible: true`. Un registro ausente, vacío o ilegible nunca aprueba por defecto.

import { readFileSync } from 'node:fs';

const COLUMNAS = ['tipo', 'objeto', 'version', 'evidencia', 'mostrado', 'decidido', 'quien', 'estado'];
const ESTADOS = { preview: ['aprobado', 'rechazado', 'pendiente'], produccion: ['aprobado', 'rechazado', 'pendiente', 'revocado', 'usada'] };
const FECHA = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/;
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
    if (celdas.length !== COLUMNAS.length) throw new Error(`fila con ${celdas.length} columnas, el registro usa 8 columnas: ${linea.trim()}`);
    if (celdas[0] === 'tipo' || /^-+$/.test(celdas[0])) continue;
    if (!ESTADOS[celdas[0]]) throw new Error(`tipo inválido «${celdas[0]}» (preview | produccion): una fila mal escrita no se ignora`);
    filas.push(Object.fromEntries(COLUMNAS.map((c, i) => [c, celdas[i]])));
  }
  return filas;
}

function validarFila(f) {
  if (!ESTADOS[f.tipo].includes(f.estado)) return `estado inválido «${f.estado}» (${ESTADOS[f.tipo].join(' | ')})`;
  if (f.tipo === 'preview' && !/^v\d+$/.test(f.version)) return `versión inválida «${f.version}» (v1, v2…)`;
  if (f.tipo === 'produccion' && !/^[0-9a-f]{7,40}$/.test(f.version)) return `sha inválido «${f.version}» (7 a 40 hex)`;
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

export function checkPreview(filas, pieza, version) {
  const propias = filas.filter((f) => f.tipo === 'preview' && f.objeto === pieza);
  if (propias.length === 0) return { ok: false, reason: `no hay preview registrado para «${pieza}»` };
  const ultima = propias[propias.length - 1];
  const r = veredicto(ultima, `preview ${pieza} ${ultima.version}`);
  if (r.ok && version !== undefined && ultima.version !== version) {
    return { ok: false, reason: `se pidió construir ${version} y lo aprobado vigente es ${ultima.version}` };
  }
  return r;
}

export function checkProduccion(filas, sha) {
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return { ok: false, reason: `sha inválido «${sha}»` };
  const mismo = (v) => v !== '' && (v.startsWith(sha) || sha.startsWith(v));
  const propias = filas.filter((f) => f.tipo === 'produccion' && mismo(f.version));
  if (propias.length === 0) return { ok: false, reason: `ninguna orden de producción registrada para ${sha}` };
  return veredicto(propias[propias.length - 1], `orden de producción ${sha}`);
}

export function checkTareas(plan, filas) {
  if (!Array.isArray(plan?.tasks)) return { ok: false, reason: 'el plan no tiene un arreglo tasks' };
  const visibles = plan.tasks.filter((t) => t.visible === true);
  for (const t of visibles) {
    if (typeof t.preview !== 'string' || t.preview === '') return { ok: false, reason: `${t.id}: tarea visible sin campo preview` };
    const r = checkPreview(filas, t.preview);
    if (!r.ok) return { ok: false, reason: `${t.id}: ${r.reason}` };
  }
  return { ok: true, visibles: visibles.length };
}

const USAGE = 'usage: verify-aprobacion-humana.mjs preview <APROBACIONES.md> --pieza <id> [--version <vN>] | tareas <tasks.json> <APROBACIONES.md> | produccion <APROBACIONES.md> --sha <sha>';

export function parsear(argv) {
  const [cmd, ...resto] = argv;
  if (cmd === 'tareas') return resto.length === 2 ? { cmd, plan: resto[0], ledger: resto[1] } : null;
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
    else r = checkTareas(JSON.parse(leer(args.plan, 'el plan')), filas);
  } catch (error) {
    r = { ok: false, reason: error.message };
  }
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  if (args.cmd === 'preview') console.log(`OK: preview ${args.pieza} ${r.version} aprobado por ${r.quien} el ${r.decidido}`);
  else if (args.cmd === 'produccion') console.log(`OK: orden de producción para ${args.sha} (${r.objeto}) dada por ${r.quien} el ${r.decidido}; vale una vez: tras publicar, registrá la fila «usada»`);
  else console.log(`OK: ${r.visibles} tarea(s) visible(s), todas con preview aprobado`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-aprobacion-humana.mjs')) main();
