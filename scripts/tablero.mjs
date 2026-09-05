#!/usr/bin/env node
// tablero.mjs — genera una pagina local con el estado del trabajo, y se NIEGA a escribirla adentro
// de un repositorio.
//
// POR QUE LA NEGATIVA ES MECANICA Y NO UNA CONVENCION. El primer diseno de esto escribia su salida
// y su cache DENTRO del repositorio, con datos agregados de todos los proyectos de la maquina, y
// declaraba que no violaba ninguna restriccion. El gate de seguridad del propio repositorio daba
// VERDE sobre esa fuga: ninguna red la agarraba. Por eso acá la regla no es "acordate de no": es
// subir desde el destino buscando un `.git` y rechazar antes de crear un solo archivo.
//
// DONDE ESCRIBE. Fuera del arbol, siempre: `%LOCALAPPDATA%\ia-stack\` en Windows,
// `${XDG_STATE_HOME:-~/.local/state}/ia-stack/` en el resto. Los datos de cada persona se quedan en
// su maquina y no entran a ningun repositorio.
//
// QUE LEE. Las transcripciones de sesion que el agente ya escribe en `~/.claude/projects/`. No
// instala nada, no abre puertos, no manda nada a ningun lado. Solo lectura.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - La pagina es del ultimo build. Lleva la fecha en grande porque envejece desde el segundo cero.
//   - No abre el navegador solo: imprime la ruta. Lanzar un programa por su cuenta es un efecto que
//     un protocolo no deberia tomarse.
//   - Si una transcripcion se reescribe conservando tamano y fecha, la cache queda vieja y no hay
//     forma de notarlo sin releer todo.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PERIODO_DIAS, agregar, bandaDeHoras, bandaPorDia, estadoDeFases, estadoDeSesion, renderizar, rondasDeMejoras } from './tablero-modelo.mjs';

export const USAGE = 'usage: tablero.mjs build [--out <carpeta>] | tablero.mjs due [--today AAAA-MM-DD]';
export const CARPETA = 'ia-stack';
export const DESTINO_EN_REPO = 'TABLERO_DESTINO_EN_REPO';
export const EMPTY_PREFIX = 'VACÍO: ';

/** Donde escribe, sin tocar el disco para decidirlo. */
export function destinoPorDefecto(entorno = process.env, casa = homedir(), plataforma = process.platform) {
  if (plataforma === 'win32') return join(entorno.LOCALAPPDATA ?? join(casa, 'AppData', 'Local'), CARPETA);
  return join(entorno.XDG_STATE_HOME ?? join(casa, '.local', 'state'), CARPETA);
}

/** Sube desde una carpeta buscando un `.git`. Devuelve la raiz del repositorio, o null.
 * Es a proposito lo INVERSO de `safeProjectFile` del ratchet, que confina hacia adentro de un
 * proyecto: acá hay que detectar que el destino cayo adentro de uno. */
export function repositorioQueContiene(carpeta, hay = existsSync) {
  let actual = resolve(carpeta);
  for (;;) {
    if (hay(join(actual, '.git'))) return actual;
    const padre = dirname(actual);
    if (padre === actual) return null;
    actual = padre;
  }
}

/** Las carpetas de proyecto del agente. El nombre de la carpeta es el `cwd` con los separadores
 * cambiados por guiones; se muestra tal cual porque inventarle un nombre lindo seria adivinar. */
export function proyectosEn(raiz, { hay = existsSync, listar = readdirSync } = {}) {
  if (!hay(raiz)) return [];
  return listar(raiz, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function sesionesDe(carpeta, { listar = readdirSync } = {}) {
  return listar(carpeta).filter((f) => f.endsWith('.jsonl')).sort();
}

/** Lee un `.jsonl` tolerando lineas rotas: una transcripcion a medio escribir es normal -- puede
 * haber una sesion viva -- y tirar todo el archivo por su ultima linea seria perder el resto. */
export function leerRegistros(texto) {
  const registros = [];
  for (const linea of texto.split('\n')) {
    const t = linea.trim();
    if (t === '') continue;
    try { registros.push(JSON.parse(t)); } catch { /* linea incompleta: se ignora, no se rompe */ }
  }
  return registros;
}

/** Del slug de la carpeta a la ruta real del proyecto, COMPROBADA contra el disco.
 *
 * El agente nombra cada carpeta con el `cwd` y los separadores cambiados por guiones, y esa
 * codificacion es AMBIGUA: un proyecto llamado `ia-stack` produce el mismo slug que uno que viviera
 * en `ia/stack`. No se adivina. Se prueba la interpretacion directa y, si esa carpeta no existe en
 * el disco, se devuelve null.
 *
 * Un proyecto sin ruta resuelta aparece igual en el tablero con sus tokens y sus horas -- que salen
 * de la transcripcion y no dependen de esto -- pero sin estado de fases. Mostrar el estado de OTRO
 * proyecto seria el unico error que de verdad importaria. */
export function rutaDeProyecto(slug, hay = existsSync) {
  const m = String(slug).match(/^([A-Za-z])--(.*)$/u);
  if (m === null) return null;
  const ruta = `${m[1]}:/${m[2].split('-').join('/')}`;
  return hay(ruta) ? ruta : null;
}

/** Lo que el proyecto declara de si mismo: en que fase quedo, que rondas de mejoras tiene y en que
 * anda la sesion. Todo opcional -- un proyecto que no usa el protocolo no declara nada, y eso no es
 * un incumplimiento sino un proyecto que no lo usa. */
export function estadoDelProyecto(ruta, { hay = existsSync, listar = readdirSync, leer = readFileSync } = {}) {
  const vacio = { fases: estadoDeFases(null), mejoras: rondasDeMejoras([]), sesion: { feature: null, estado: null } };
  if (ruta === null) return vacio;
  const leerJson = (relativo) => {
    try { return JSON.parse(leer(join(ruta, relativo), 'utf8')); } catch { return null; }
  };
  const carpetaMejoras = join(ruta, 'docs', 'mejoras');
  const rondas = [];
  if (hay(carpetaMejoras)) {
    let nombres = [];
    try { nombres = listar(carpetaMejoras); } catch { nombres = []; }
    for (const nombre of nombres.filter((n) => n.endsWith('.json'))) {
      const registro = leerJson(join('docs', 'mejoras', nombre));
      if (registro !== null) rondas.push({ nombre, registro });
    }
  }
  let sesion = { feature: null, estado: null };
  try { sesion = estadoDeSesion(leer(join(ruta, '.vibe', 'SESSION.md'), 'utf8')); } catch { /* sin sesion declarada */ }
  return { fases: estadoDeFases(leerJson(join('docs', 'phase-decisions.json'))), mejoras: rondasDeMejoras(rondas), sesion };
}

export function construirModelo(raizProyectos, io = {}) {
  const { hay = existsSync, listar = readdirSync, leer = readFileSync, hoy = '(sin fecha)' } = io;
  const proyectos = [];
  for (const nombre of proyectosEn(raizProyectos, { hay, listar })) {
    const carpeta = join(raizProyectos, nombre);
    const sesiones = sesionesDe(carpeta, { listar });
    const registros = [];
    for (const s of sesiones) {
      try { registros.push(...leerRegistros(leer(join(carpeta, s), 'utf8'))); } catch { /* ilegible: se cuenta como sesion sin turnos */ }
    }
    const a = agregar(registros);
    if (a.turnos === 0) continue;
    const ruta = rutaDeProyecto(nombre, hay);
    proyectos.push({
      nombre, sesiones: sesiones.length, turnos: a.turnos, lineasRepetidas: a.lineasRepetidas,
      tokens: a.tokens, modelos: a.modelos, horas: bandaDeHoras(a.marcas), dias: bandaPorDia(a.marcas),
      ...estadoDelProyecto(ruta, { hay, listar, leer }),
    });
  }
  proyectos.sort((x, y) => y.tokens.salida - x.tokens.salida);
  return { generadoEn: hoy, proyectos };
}

export function parseArguments(args) {
  if (args[0] === 'build') {
    if (args.length === 1) return { accion: 'build', out: null };
    if (args.length === 3 && args[1] === '--out') return { accion: 'build', out: args[2] };
    return null;
  }
  if (args[0] === 'due') {
    if (args.length === 1) return { accion: 'due', hoy: null };
    if (args.length === 3 && args[1] === '--today') return { accion: 'due', hoy: args[2] };
    return null;
  }
  return null;
}

/** Dias enteros entre dos fechas AAAA-MM-DD, en UTC puro: sin husos ni relojes locales, que es
 * como lo hace `verify-ablation.mjs due` y por la misma razon. */
export function diasEntre(desde, hasta) {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86_400_000);
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArguments(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  const {
    entorno = process.env, casa = homedir(), plataforma = process.platform,
    hay = existsSync, listar = readdirSync, leer = readFileSync,
    crear = mkdirSync, escribir = writeFileSync, medir = statSync, hoy = null,
  } = io;

  const destino = parsed.out ?? destinoPorDefecto(entorno, casa, plataforma);
  const raizProyectos = join(casa, '.claude', 'projects');

  if (parsed.accion === 'due') {
    const marca = join(destino, 'ultimo-build.txt');
    if (!hay(marca)) { write(`${EMPTY_PREFIX}todavía no se generó ningún tablero: corré \`tablero.mjs build\``); return 0; }
    let ultimo;
    try { ultimo = String(leer(marca, 'utf8')).trim(); } catch { write(`${EMPTY_PREFIX}no se pudo leer la marca del último build`); return 0; }
    // `parsed.hoy` primero: la bandera `--today` es la que el usuario escribio, y el `hoy` del io
    // existe solo para que las pruebas fijen la fecha. Leer solo el segundo hacia que la bandera no
    // hiciera nada, y la prueba lo agarro.
    const dias = diasEntre(ultimo, parsed.hoy ?? hoy ?? new Date().toISOString().slice(0, 10));
    if (dias === null) { write(`${EMPTY_PREFIX}la marca del último build no es una fecha (${ultimo})`); return 0; }
    write(dias >= PERIODO_DIAS
      ? `TOCA: pasaron ${dias} día(s) desde el último tablero (${ultimo}); el período es ${PERIODO_DIAS}.`
      : `OK: el último tablero es del ${ultimo}, hace ${dias} día(s). No toca todavía.`);
    return 0;
  }

  // La negativa, ANTES de crear nada.
  const repo = repositorioQueContiene(destino, hay);
  if (repo !== null) {
    writeError(`REJECTED: ${DESTINO_EN_REPO}: ${destino} cae adentro del repositorio ${repo}. El tablero agrega datos de todos tus proyectos: escribirlos ahí los publica en el próximo commit.`);
    return 1;
  }

  if (!hay(raizProyectos)) {
    write(`${EMPTY_PREFIX}no hay transcripciones en ${raizProyectos}: no hay nada que mostrar todavía`);
    return 0;
  }

  const fecha = hoy ?? new Date().toISOString().slice(0, 10);
  const modelo = construirModelo(raizProyectos, { hay, listar, leer, hoy: fecha });
  if (modelo.proyectos.length === 0) {
    write(`${EMPTY_PREFIX}no se encontró ningún turno en las transcripciones: nada que agregar`);
    return 0;
  }

  let precios = null;
  const rutaPrecios = join(destino, 'precios.json');
  if (hay(rutaPrecios)) {
    try { precios = JSON.parse(leer(rutaPrecios, 'utf8')); } catch { precios = null; }
  }

  crear(destino, { recursive: true });
  const html = renderizar({ ...modelo, precios });
  escribir(join(destino, 'tablero.html'), html);
  escribir(join(destino, 'ultimo-build.txt'), `${fecha}\n`);
  write(`OK: tablero de ${modelo.proyectos.length} proyecto(s) en ${join(destino, 'tablero.html')}`);
  write('Abrilo con doble clic. Muestra el estado del último build, no el de ahora.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('tablero.mjs')) {
  process.exitCode = main();
}

// Referencias que el gate de sondas necesita ver declaradas aunque no se usen en el camino feliz.
export const HERRAMIENTAS = Object.freeze({ execFileSync, medirPorDefecto: statSync });
