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
//      se aplica aunque el nombre coincida: un `.mq5` no está en git, así que borrarlo es pérdida
//      total e irreversible.
//
// Y UNA CUARTA, que es la que evita el desastre: si no se puede derivar un solo prefijo, **no barre
// nada** y rechaza. Una lista vacía con un comodín de respaldo borraría el temporal entero.
//
// LÍMITE HONESTO. Sabe qué prefijos usan las pruebas de ESTE árbol y cuántas horas tiene cada
// carpeta. **No sabe si una carpeta es de una corrida muerta o de una viva**: usa la antigüedad como
// aproximación, y una corrida que lleve más horas que el umbral se vería como basura. Tampoco sabe
// si el contenido importa — mira nombres de archivo, no lo que dicen.

import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: limpiar-temporales.mjs listar [--temp <carpeta>] [--tests <raiz>] [--borrar]';
export const EMPTY = 'VACÍO';

/** Lo que `mkdtempSync` agrega al prefijo: seis caracteres, siempre. */
export const SUFIJO_MKDTEMP = 6;

/** Una corrida en curso no se toca. El umbral es la única defensa contra eso. */
export const HORAS_MINIMAS = 6;

/** Lo que jamás se borra, esté donde esté. Un `.mq5` no está en git: no hay vuelta. */
const INTOCABLES = /\.(?:mq5|ex5|key|pem)$|(?:^|[\\/])\.env$/iu;

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

const tieneIntocable = (dir, listar) => {
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
      if (INTOCABLES.test(nombre)) return nombre;
    }
  }
  return null;
};

/** Las carpetas del temporal que coinciden EXACTO con un prefijo de prueba y ya están frías. */
export function candidatas(temp, prefijos, io = {}) {
  const listar = io.listar ?? readdirSync;
  const stat = io.stat ?? statSync;
  const ahora = io.ahora ?? Date.now();
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

    const intocable = tieneIntocable(ruta, listar);
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

  const encontradas = candidatas(temp, prefijos, options);
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
