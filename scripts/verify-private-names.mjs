#!/usr/bin/env node
// verify-private-names.mjs — lo versionado no nombra nada de una lista privada que el repositorio no conoce.
//
// EL PROBLEMA QUE RESUELVE. `verify-repo-clean.mjs` declara su propio límite: no detecta nombres
// propios, de clientes ni de proyectos privados, porque para un gate son palabras como cualquier
// otra y escribir esa lista dentro del repositorio sería exactamente la filtración que se quiere
// evitar. Este gate cierra ese hueco SIN romper esa regla: la lista no vive en ningún archivo
// versionado. Llega de dos lugares que git no publica.
//
//   1. La variable de entorno `IA_STACK_NOMBRES_PRIVADOS` — en CI, un secreto del repositorio.
//   2. El archivo `.claude/nombres-privados.local.txt` — en la máquina de quien escribe. La carpeta
//      `.claude/` está en `.gitignore`, así que ese archivo no se puede commitear sin forzarlo.
//
// Formato de las dos: un nombre por línea. Las líneas vacías y las que empiezan con `#` se ignoran.
// La comparación no distingue mayúsculas ni tildes, y busca el nombre adentro de cualquier palabra.
//
// NUNCA REPITE UN NOMBRE. Un rechazo dice archivo y línea, y qué nombre fue sólo por su posición
// («nombre #3»), porque la salida de un gate va a parar a registros de integración continua que
// suelen ser públicos, y un detector que grita el dato que protege lo filtra otra vez. Si la ruta
// de un archivo contiene un nombre, el archivo tampoco se nombra: se lo identifica por su posición
// en `git ls-files`. La posición es la de la lista combinada —primero la variable de entorno, después
// el archivo local—, sin contar comentarios, líneas vacías ni repetidos.
//
// SE ESCANEA EL BLOB, NO EL ARCHIVO DEL ÁRBOL DE TRABAJO, y falla cerrado: un archivo rastreado que
// no se puede leer es un hallazgo, no un silencio. Mismo criterio que `verify-repo-clean.mjs`.
//
// SIN LISTA NO HAY VERDE: el gate dice `VACÍO` y sale 0, o sale 1 con `--require-inputs`. En un
// repositorio donde el secreto todavía no existe, o en una bifurcación que no recibe secretos, el
// gate no mira nada, y lo dice. Un verde que no miró no se puede leer como limpio.
//
// LÍMITE HONESTO. La lista es lo que quien la escribe recuerda: un nombre que nadie anotó no se
// detecta. No ve el historial ya publicado, ni el autor de los commits, ni las ramas, ni lo que
// git no rastrea, ni lo binario, ni imágenes con texto. No detecta un nombre escrito de otra forma
// (abreviado, con un guion de más, con las letras separadas). Y un nombre corto o común rechaza
// de más, por eso se exige un mínimo de largo.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esBinario } from './verify-repo-clean.mjs';

export const USAGE = 'usage: verify-private-names.mjs check [--require-inputs]';
export const EMPTY = 'VACÍO';
export const ENV_VAR = 'IA_STACK_NOMBRES_PRIVADOS';
export const ARCHIVO_LOCAL = join('.claude', 'nombres-privados.local.txt');
export const REQUIRE_INPUTS_FLAG = '--require-inputs';

/** Debajo de esto un nombre coincide adentro de media biblioteca y el gate grita en falso. */
export const MIN_NOMBRE = 3;

/** Minúsculas y sin tildes: «Álvarez» y «alvarez» son el mismo nombre para este gate. */
export const plegar = (texto) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Una lista en texto: un nombre por línea, sin vacías ni comentarios. */
export function parsearLista(texto) {
  return texto.split(/\r?\n/u).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
}

/** Las listas unidas, ya plegadas y sin repetidos, en orden de aparición. */
export function unirListas(...listas) {
  const vistos = new Set();
  const nombres = [];
  for (const nombre of listas.flat()) {
    const plano = plegar(nombre);
    if (vistos.has(plano)) continue;
    vistos.add(plano);
    nombres.push(plano);
  }
  return nombres;
}

/** Cada línea de un texto que contiene algún nombre: número de línea y posición del nombre, nunca el texto. */
export function buscarEnTexto(texto, nombres) {
  const hallazgos = [];
  for (const [indice, linea] of texto.split('\n').entries()) {
    const plana = plegar(linea);
    for (const [posicion, nombre] of nombres.entries()) {
      if (plana.includes(nombre)) hallazgos.push({ linea: indice + 1, nombre: posicion + 1 });
    }
  }
  return hallazgos;
}

/** El contenido que git PUBLICA para una ruta rastreada: el blob del índice. */
function leerBlobDeGit(raiz, ruta) {
  return execFileSync('git', ['-C', raiz, 'show', `:${ruta}`], { encoding: 'buffer', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
}

/** Los archivos que git rastrea, relativos a la raíz. Sin repositorio, la lista es vacía. */
function rastreadosPorGit(raiz) {
  try {
    const salida = execFileSync('git', ['-C', raiz, 'ls-files', '-z'], { encoding: 'utf8', stdio: 'pipe' });
    return salida.split('\0').filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const raiz = options.root ?? process.cwd();

  const exigir = args.includes(REQUIRE_INPUTS_FLAG);
  const resto = args.filter((a) => a !== REQUIRE_INPUTS_FLAG);
  if (resto.length !== 1 || resto[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }

  const env = options.env ?? process.env;
  const leerLocal = options.leerLocal ?? ((ruta) => readFileSync(join(raiz, ruta), 'utf8'));
  let local = '';
  try {
    local = leerLocal(ARCHIVO_LOCAL);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      writeError(`REJECTED: ${ARCHIVO_LOCAL} existe pero es ilegible: ${error.message}. Una lista corrupta no es una lista ausente.`);
      return 1;
    }
  }

  const nombres = unirListas(parsearLista(env[ENV_VAR] ?? ''), parsearLista(local));

  if (nombres.length === 0) {
    const motivo = `no hay lista de nombres privados (ni la variable ${ENV_VAR} ni ${ARCHIVO_LOCAL}), así que no se revisó nada.`;
    if (exigir) {
      writeError(`REJECTED: ${motivo} Con ${REQUIRE_INPUTS_FLAG} un gate que no pudo mirar no se lee como verde.`);
      return 1;
    }
    write(`${EMPTY}: ${motivo} Esto NO afirma que el repositorio esté limpio.`);
    return 0;
  }

  const cortos = nombres.map((nombre, i) => ({ nombre, posicion: i + 1 })).filter((n) => n.nombre.length < MIN_NOMBRE);
  if (cortos.length > 0) {
    for (const { posicion } of cortos) {
      writeError(`REJECTED: el nombre #${posicion} de la lista tiene menos de ${MIN_NOMBRE} caracteres: coincidiría adentro de media biblioteca. Alargalo o sacalo.`);
    }
    return 1;
  }

  const archivos = (options.trackedFiles ?? rastreadosPorGit)(raiz);
  if (archivos.length === 0) {
    write(`${EMPTY}: git no rastrea ningún archivo acá, así que no se revisó nada.`);
    return 0;
  }

  const leerBlob = options.leerBlob ?? ((ruta) => leerBlobDeGit(raiz, ruta));
  const hallazgos = [];
  const opacos = [];
  let revisados = 0;

  for (const [indice, archivo] of archivos.entries()) {
    const rutaPlana = plegar(archivo);
    const enLaRuta = nombres.map((n, i) => (rutaPlana.includes(n) ? i + 1 : 0)).filter((p) => p > 0);
    // Si la ruta misma contiene un nombre, el archivo no se nombra: se lo ubica por su posición.
    const rotulo = enLaRuta.length > 0 ? `el archivo #${indice + 1} de git ls-files` : archivo;
    for (const posicion of enLaRuta) hallazgos.push(`REJECTED: la ruta de ${rotulo} contiene el nombre privado #${posicion}.`);

    let bytes;
    try {
      bytes = leerBlob(archivo);
    } catch {
      // Falla cerrado, y sin repetir el mensaje del sistema: puede traer la ruta entera.
      opacos.push(rotulo);
      continue;
    }
    if (esBinario(bytes)) continue;
    revisados += 1;
    for (const h of buscarEnTexto(bytes.toString('utf8'), nombres)) {
      hallazgos.push(`REJECTED: ${rotulo}, línea ${h.linea}: contiene el nombre privado #${h.nombre}.`);
    }
  }

  if (opacos.length > 0) {
    for (const rotulo of opacos) {
      writeError(`REJECTED: ${rotulo} está rastreado y no se pudo leer su contenido publicado. «No pude mirar» no es «miré y no había nada».`);
    }
    return 1;
  }

  if (hallazgos.length > 0) {
    for (const h of hallazgos) writeError(h);
    writeError(`REJECTED: ${hallazgos.length} hallazgo(s) en ${archivos.length} archivo(s) versionado(s). Lo publicado se lee, se clona y se indexa: una vez afuera no se saca.`);
    return 1;
  }

  write(`OK: ${revisados} archivo(s) versionado(s) revisado(s), en su contenido y en su ruta, contra ${nombres.length} nombre(s) privado(s). Ninguno aparece.`);
  write('LIMITE: la lista es lo que quien la escribe recuerda: un nombre que nadie anotó no se detecta. NO ve el historial ya publicado, ni el autor de los commits, ni lo que git no rastrea, ni lo binario, ni un nombre escrito de otra forma.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-private-names.mjs')) {
  process.exitCode = main();
}
