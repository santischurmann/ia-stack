#!/usr/bin/env node
// limpiar-temporales.mjs — las carpetas que una corrida interrumpida deja tiradas.
//
// EL PROBLEMA, medido el 2026-09-15: 198 carpetas `vcp-discovery-core-*` en el temporal del sistema,
// todas del mismo día, más 280 en total sobre 105 prefijos distintos. **No falta ningún `rmSync`** —
// se revisó archivo por archivo: los 50 que usan `mkdtempSync` tienen al menos uno por cada uno, y
// el delta de una suite COMPLETA es cero. Salen de corridas matadas: un proceso que muere nunca
// ejecuta su `finally`, y este repositorio corre su suite en segundo plano todo el tiempo. El
// `finally` no puede cubrir ese caso por construcción; lo que faltaba es lo de después.
//
// POR QUÉ LISTA POR DEFECTO Y SÓLO BORRA SI SE LO PIDEN. Esta es la única herramienta del protocolo
// que borra, y borrar de más en el temporal del sistema es borrar el trabajo de otro programa. La
// regla de este repositorio para limpiar es explícita: listar primero, y sacar sólo lo nombrado. Así
// que el modo por defecto es listar, y `--borrar` es una decisión que alguien toma mirando la lista.
//
// LAS TRES DEFENSAS, cada una contra un modo de falla distinto:
//
//   1. Los prefijos SE DERIVAN de `tests/`, leyendo cada `mkdtempSync`. Una lista escrita a mano se
//      desactualiza y deja afuera lo que se agregue después — la misma lección que ya costó cara en
//      el gate de alcance, que filtraba por prefijos y dejaba seis scripts sin contar.
//   2. El nombre tiene que ser prefijo + los SEIS caracteres exactos que `mkdtempSync` agrega. Sin
//      comodines: `vcp-` a secas barrería la carpeta de trabajo de cualquier otra cosa.
//   3. Una carpeta con un fuente del usuario adentro NO se toca y se nombra. Es la regla dura, y acá
//      se aplica aunque el nombre coincida: un fuente que el repositorio no versiona no tiene
//      backup ni papelera, asi que borrarlo es perdida total e irreversible. Que cuenta como fuente
//      irreemplazable sale de contracts/irreplaceable-sources.json, no de una lista escrita aca.
//
// Y UNA CUARTA, que es la que evita el desastre: si no se puede derivar un solo prefijo, **no barre
// nada** y rechaza. Una lista vacía con un comodín de respaldo borraría el temporal entero.
//
// LÍMITE HONESTO. Sabe qué prefijos usan las pruebas de ESTE árbol y cuántas horas tiene cada
// carpeta. **No sabe si una carpeta es de una corrida muerta o de una viva**: usa la antigüedad como
// aproximación, y una corrida que lleve más horas que el umbral se vería como basura. Tampoco sabe
// si el contenido importa — mira nombres de archivo, no lo que dicen.

import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: limpiar-temporales.mjs listar [--temp <carpeta>] [--tests <raiz>] [--borrar]';
export const EMPTY = 'VACÍO';

/** Lo que `mkdtempSync` agrega al prefijo: seis caracteres, siempre. */
export const SUFIJO_MKDTEMP = 6;

/** Una corrida en curso no se toca. El umbral es la única defensa contra eso. */
export const HORAS_MINIMAS = 6;

/** Donde se declara lo que jamas se borra. El publico trae los universales; el local, los del proyecto. */
/** La raiz del protocolo: donde vive este script, no donde se lo corre. */
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

export const CONTRATO_INTOCABLES = 'contracts/irreplaceable-sources.json';
export const OVERLAY_INTOCABLES = '.claude/irreplaceable-sources.local.json';

const SCHEMA_INTOCABLES = 'ia.irreplaceable-sources/1';
/** Una extension de verdad: punto y letras o digitos. Ni comodines ni espacios ni puntos de mas. */
const FORMA_EXTENSION = /^\.[A-Za-z0-9]+$/u;
const MIN_MOTIVO_INTOCABLE = 20;

/**
 * LO QUE JAMAS SE BORRA, leido del contrato y no escrito aca adentro.
 *
 * Vivia como una constante con extensiones de un stack concreto adentro. Protegia igual -- un fuente
 * versiona no tiene backup ni papelera -- y de paso contaba a que se dedica quien escribio el
 * protocolo, en un repositorio publico que tiene que servirle a cualquiera. Los universales viajan
 * con el protocolo; cada proyecto declara los suyos en `.claude/`, que no se versiona.
 *
 * FALLA CERRADO. Sin contrato legible, o sin un solo universal, NO se devuelve una lista vacia: se
 * rechaza. Una lista vacia convertiria al limpiador en un barrido sin frenos, que es exactamente el
 * desastre que las otras tres guardas evitan.
 */
export function intocablesDe(contrato, overlay = null) {
  if (typeof contrato !== 'object' || contrato === null || Array.isArray(contrato)) {
    throw new Error(`${CONTRATO_INTOCABLES}: el contrato tiene que ser un objeto, y sin el no se puede saber qué no se borra`);
  }
  if (contrato.schema !== SCHEMA_INTOCABLES) {
    throw new Error(`${CONTRATO_INTOCABLES}: el schema tiene que ser ${SCHEMA_INTOCABLES}`);
  }
  if (!Array.isArray(contrato.universales) || contrato.universales.length === 0) {
    throw new Error(`${CONTRATO_INTOCABLES}: no declara un solo universal. Una lista vacía dejaría al limpiador sin frenos`);
  }
  const declaradas = [
    ...contrato.universales,
    ...(Array.isArray(contrato.del_proyecto) ? contrato.del_proyecto : []),
    ...(overlay !== null && Array.isArray(overlay?.del_proyecto) ? overlay.del_proyecto : []),
  ];
  const extensiones = [];
  for (const entrada of declaradas) {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
      throw new Error(`${CONTRATO_INTOCABLES}: cada entrada tiene que ser un objeto con extensión y why`);
    }
    if (typeof entrada.extension !== 'string' || !FORMA_EXTENSION.test(entrada.extension)) {
      throw new Error(`${CONTRATO_INTOCABLES}: ${JSON.stringify(entrada.extension)} no es una extensión válida (punto y letras o dígitos, sin comodines)`);
    }
    if (typeof entrada.why !== 'string' || entrada.why.trim().length < MIN_MOTIVO_INTOCABLE) {
      throw new Error(`${CONTRATO_INTOCABLES}: ${entrada.extension} se declara intocable sin un motivo escrito. Declarar algo intocable es una decisión y va con su porqué`);
    }
    extensiones.push(entrada.extension.slice(1).toLowerCase());
  }
  // Un nombre que EMPIEZA con punto -- `.env` -- es un archivo entero, no una extension: se ancla al
  // separador para que `notas.env.txt` no cuente y `sub/.env` si.
  const alternativa = [...new Set(extensiones)].join('|');
  return new RegExp(`\\.(?:${alternativa})$|(?:^|[\\\\/])\\.(?:${alternativa})$`, 'iu');
}

/**
 * El contrato y su overlay local, leidos del disco.
 *
 * EL CONTRATO VIAJA CON EL SCRIPT, no con el directorio que se limpia. Los universales son del
 * protocolo: buscarlos en el cwd hacia que correr esto parado en cualquier otra carpeta reventara
 * con un stack trace de node:fs en vez de funcionar. El OVERLAY si es del proyecto, y por eso sale
 * del cwd -- y es opcional: no tenerlo es lo normal.
 */
export function leerIntocables(cwd, leer = readFileSync, raizDelProtocolo = RAIZ) {
  let contrato;
  try {
    contrato = JSON.parse(leer(join(raizDelProtocolo, CONTRATO_INTOCABLES), 'utf8'));
  } catch (error) {
    // Un contrato ausente o ilegible se dice: es distinto de un contrato que declara mal, y se
    // arregla distinto. Lo que no puede pasar es salir por una excepcion sin manejar.
    throw new Error(`no se pudo leer ${CONTRATO_INTOCABLES} desde ${raizDelProtocolo}: ${error?.message ?? error}. Sin esa lista no se sabe que no se borra, y no se barre nada`);
  }
  let overlay = null;
  try { overlay = JSON.parse(leer(join(cwd, OVERLAY_INTOCABLES), 'utf8')); } catch { overlay = null; }
  return intocablesDe(contrato, overlay);
}

const MKDTEMP = /mkdtempSync\(\s*join\(\s*tmpdir\(\)\s*,\s*'([^']+)'/gu;
const FORMA_PREFIJO = /^[A-Za-z0-9][A-Za-z0-9-]*-$/u;

/**
 * Los prefijos que las pruebas de este árbol usan de verdad, leídos de cada `mkdtempSync`. Un
 * prefijo que no tiene forma de prefijo se descarta: la primera versión de este barrido, escrita a
 * mano en PowerShell, capturó un fragmento de expresión regular y una guarda tuvo que frenarlo.
 */
export function prefijosDe(raiz, io = {}) {
  const listar = io.listar ?? readdirSync;
  const leer = io.leer ?? readFileSync;
  const encontrados = new Set();
  let nombres;
  try {
    nombres = listar(join(raiz, 'tests')).filter((n) => n.endsWith('.mjs'));
  } catch {
    return [];
  }
  for (const nombre of nombres) {
    let fuente;
    try {
      fuente = leer(join(raiz, 'tests', nombre), 'utf8');
    } catch {
      continue;
    }
    for (const [, prefijo] of String(fuente).matchAll(MKDTEMP)) {
      if (FORMA_PREFIJO.test(prefijo)) encontrados.add(prefijo);
    }
  }
  return [...encontrados].sort();
}

const tieneIntocable = (dir, listar, intocables) => {
  const pendientes = [dir];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    let entradas;
    try {
      entradas = listar(actual, { withFileTypes: true });
    } catch {
      // Ilegible es una razón para NO tocarla: lo que no se puede mirar no se puede descartar.
      return '(no se puede leer adentro)';
    }
    for (const e of entradas) {
      const nombre = typeof e === 'string' ? e : e.name;
      const ruta = join(actual, nombre);
      if (typeof e === 'object' && typeof e.isDirectory === 'function' && e.isDirectory()) {
        pendientes.push(ruta);
        continue;
      }
      if (intocables.test(nombre)) return nombre;
    }
  }
  return null;
};

/** Las carpetas del temporal que coinciden EXACTO con un prefijo de prueba y ya están frías. */
export function candidatas(temp, prefijos, io = {}, intocables = undefined) {
  const listar = io.listar ?? readdirSync;
  const stat = io.stat ?? statSync;
  const ahora = io.ahora ?? Date.now();
  // La lista de lo intocable sale del contrato. Si nadie la pasa se lee del disco: falla cerrado, y
  // un contrato ilegible revienta ACA, antes de mirar una sola carpeta.
  const noSeTocan = intocables ?? leerIntocables(io.raiz ?? ".", io.leerContrato);
  if (prefijos.length === 0) return [];

  let entradas;
  try {
    entradas = listar(temp, { withFileTypes: true });
  } catch {
    return [];
  }

  const salida = [];
  for (const e of entradas) {
    const nombre = typeof e === 'string' ? e : e.name;
    const esDir = typeof e === 'object' && typeof e.isDirectory === 'function' ? e.isDirectory() : true;
    if (!esDir) continue;
    // PREFIJO + SEIS EXACTOS. Un `startsWith` a secas barrería cualquier cosa que empiece igual.
    if (!prefijos.some((p) => nombre.startsWith(p) && nombre.length === p.length + SUFIJO_MKDTEMP)) continue;

    const ruta = join(temp, nombre);
    let horas;
    try {
      horas = (ahora - stat(ruta).mtimeMs) / 3600_000;
    } catch {
      continue;
    }
    if (horas < HORAS_MINIMAS) continue;

    const intocable = tieneIntocable(ruta, listar, noSeTocan);
    salida.push({
      nombre,
      ruta,
      horas: Math.round(horas),
      intocable: intocable !== null,
      motivo: intocable === null ? null : `tiene ${intocable} adentro: un fuente del usuario no está en git, así que borrarlo es pérdida total`,
    });
  }
  return salida.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function parseArgs(args) {
  if (args[0] !== 'listar') return null;
  const opciones = { temp: null, tests: null, borrar: false };
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === '--borrar') opciones.borrar = true;
    else if (args[i] === '--temp' && args[i + 1] !== undefined) { opciones.temp = args[i + 1]; i += 1; }
    else if (args[i] === '--tests' && args[i + 1] !== undefined) { opciones.tests = args[i + 1]; i += 1; }
    else return null;
  }
  return opciones;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  const parsed = parseArgs(args);
  if (parsed === null) {
    writeError(USAGE);
    return 2;
  }

  const raiz = parsed.tests ?? resolve(fileURLToPath(new URL('..', import.meta.url)));
  const temp = parsed.temp ?? (process.env.TMPDIR ?? process.env.TEMP ?? '/tmp');

  // SIN PREFIJOS NO SE BARRE NADA. Es la defensa que evita el desastre: una lista vacía con un
  // comodín de respaldo borraría el temporal del sistema entero.
  const prefijos = prefijosDe(raiz, options);
  if (prefijos.length === 0) {
    writeError(`REJECTED: no se pudo derivar un solo prefijo de ${join(raiz, 'tests')}. No se tocó nada: barrer sin saber qué nombres buscar sería barrer el temporal del sistema.`);
    return 1;
  }

  // La lista de lo intocable se inyecta igual que el resto de los insumos. En produccion nadie la
  // pasa y sale del contrato; en una prueba se declara la del caso, como la declararia un proyecto.
  const encontradas = candidatas(temp, prefijos, options, options.intocables);
  if (encontradas.length === 0) {
    write(`${EMPTY}: no hay carpetas de prueba viejas en ${temp} (se buscaron ${prefijos.length} prefijo(s), con más de ${HORAS_MINIMAS} hora(s)). Nada que limpiar.`);
    return 0;
  }

  for (const c of encontradas) {
    write(`  ${c.intocable ? 'INTOCABLE' : 'vieja    '} ${c.nombre}  (${c.horas} h)${c.motivo === null ? '' : ` — ${c.motivo}`}`);
  }

  if (!parsed.borrar) {
    write(`${encontradas.length} carpeta(s) de corridas interrumpidas en ${temp}. No se borró nada: agregá --borrar cuando hayas mirado la lista.`);
    return 0;
  }

  const borrar = options.borrar ?? ((ruta) => rmSync(ruta, { recursive: true, force: true }));
  let borradas = 0;
  const intactas = [];
  for (const c of encontradas) {
    if (c.intocable) {
      intactas.push(c.nombre);
      continue;
    }
    try {
      borrar(c.ruta);
      borradas += 1;
    } catch (error) {
      intactas.push(`${c.nombre} (${error.message})`);
    }
  }
  // El motivo de cada una que NO se saco se dice: se guardaba y nunca se imprimia, asi que una que
  // fallaba por estar en uso se veia igual que una protegida por tener un fuente adentro.
  for (const nombre of intactas) write(`  sin tocar: ${nombre}`);
  write(`${borradas} borrada(s), ${intactas.length} intocable(s) sin tocar.`);
  write('LIMITE: usa la antigüedad como aproximación de «corrida muerta». NO sabe si una carpeta es de un proceso vivo: una corrida que lleve más horas que el umbral se vería como basura. Y mira nombres de archivo, no lo que dicen adentro.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('limpiar-temporales.mjs')) {
  process.exitCode = main();
}
