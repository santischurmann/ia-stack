#!/usr/bin/env node
// Proves the runtime a project actually executes is the runtime this checkout ships.
//
// THE WOUND (2026-08-27, first end-to-end run of VCP on itself, finding 53): the Discovery gate
// rejected a perfectly valid snapshot with DISCOVERY_SNAPSHOT_INVALID when run from
// .vibe/vcp-runtime/scripts/, and accepted the very same evidence when run from scripts/. The
// evidence was never the problem — the installed copy was simply older than the source, and
// nothing anywhere said so. It cost a long detour re-reading valid evidence looking for a defect
// that lived in a stale file copy. install.sh copies the runtime into each project once; from then
// on the copy silently ages, and a project can keep running gates whose defects were already
// fixed upstream — including, at the time this gate was written, an old verify-red-node.mjs.
//
// HONEST LIMIT (do not oversell): this detects that the installed copy DIFFERS from this source
// checkout. It does not prove the runtime is correct, nor that the source is — two identical
// copies of a broken gate pass here. It compares file CONTENT only: the executable bit install.sh
// sets on runtime/scripts/*.sh is not checked, so a runtime whose shell scripts lost +x still
// passes. And it can only speak where both sides exist on one machine: a consumer project without
// the VibeCodeProtocols checkout beside it has no source to compare against, and the freshness of
// its runtime stays simply unverified.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const USAGE = 'usage: verify-runtime-sync.mjs check [--runtime <path>] [--require-inputs]';
export const DEFAULT_RUNTIME_PATH = '.vibe/ia-stack-runtime';

/**
 * LAS DOS CARPETAS, en orden de preferencia. El protocolo paso a llamarse IA Stack el 2026-09-15 y
 * la carpeta instalada cambio de nombre; toda instalacion anterior tiene la vieja, y ese nombre esta
 * en la ruta de CADA comando que el protocolo documenta. Romperlas de golpe convertiria un cambio de
 * nombre en una rotura para todo el que ya lo estaba usando.
 *
 * Se prefiere la nueva y se acepta la vieja, y cuando se usa la vieja el gate lo DICE: un verde
 * silencioso sobre la carpeta vieja dejaria a un proyecto sin migrar para siempre sin enterarse.
 */
export const RUTAS_DE_RUNTIME = Object.freeze(['.vibe/ia-stack-runtime', '.vibe/vcp-runtime']);

/** La carpeta vieja, la unica que este gate acepta ademas de la vigente. */
export const RUTA_LEGADO = '.vibe/vcp-runtime';
export const NO_INPUTS_CODE = 'RUNTIME_SYNC_NO_INPUTS';
export const EMPTY_PREFIX = 'VACÍO: ';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';

/** Si una ruta ES un runtime instalado, reconocido por su FORMA y no por una lista.
 *
 * Vive aca, y no en cada gate que lo necesite, porque dos guardas iguales en dos archivos se
 * desincronizan: ya paso una vez en este repositorio y costo un rojo. Se deriva de
 * DEFAULT_RUNTIME_PATH para que cambiar donde vive el runtime no deje esta comprobacion mintiendo.
 *
 * Para que sirve: varios gates hablan de los documentos de VCP -- README.md, INSTALL.md -- que el
 * instalador NO copia. Corridos adentro del proyecto de otra persona no tienen nada que verificar,
 * y eso no es un OK: es VACIO. */
export function esRuntimeInstalado(root) {
  const partes = resolve(root).split(/[\\/]/u).filter(Boolean);
  // LAS DOS, no solo la vigente: un proyecto con la carpeta vieja que no se reconociera correria
  // self-checks que no le corresponden y veria rojos que no son suyos.
  return RUTAS_DE_RUNTIME.some((ruta) => {
    const esperadas = ruta.split('/');
    return partes.length >= esperadas.length
      && partes.slice(-esperadas.length).join('/') === esperadas.join('/');
  });
}

// Derived from copy_runtime() in scripts/install.sh and Copy-Runtime in scripts/install.ps1 — not
// invented here. tests/verify-runtime-sync.test.mjs parses both installers and fails if either one
// starts copying something this list does not name, so the surface can never drift into a guess.
export const COPIED_DIRECTORIES = ['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents'];
export const COPIED_FILES = ['SKILL.md', 'SECURITY.md', 'AGENTS.md'];

// EL SELLO DE INSTALACION. Decidido por el operador el 2026-09-22: el instalador deja en la raiz del
// runtime del proyecto la fecha y el commit desde el que se instalo. Existe por el limite que este
// gate ya declaraba -- compara CONTRA el checkout, asi que sin el checkout no puede comparar --, y por
// lo que ese limite costo: un proyecto real llevaba dias con un runtime anterior al 2026-09-15,
// rechazando recibos por un prefijo de schema que el runtime nuevo acepta, y nadie se entero.
//
// No entra en la comparacion y no hace falta excluirlo: `readInventory` recorre solo lo que el
// instalador COPIA, y el sello no se copia, se escribe. Tampoco lo toca la poda, que recorre solo las
// carpetas copiadas.
export const SELLO = 'INSTALADO.json';
export const SCHEMA_SELLO = 'ia.runtime-instalado/1';
/** Desde cuando existe el sello: un runtime sin sello se instalo antes, y eso es la cota de su edad. */
export const SELLO_DESDE = '2026-09-22';
const DIA_MS = 86_400_000;

/** Lo que dice el sello del runtime, en tres estados: ausente, valido o ilegible. Un error de lectura
 * que no es «no existe» NO se confunde con un runtime sin sello: seria decir «es viejo» sobre algo
 * que no se pudo mirar. */
export function leerSello(runtimeRoot, io = {}) {
  const read = io.read ?? readFileSync;
  let texto;
  try {
    texto = read(join(runtimeRoot, SELLO), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { estado: 'ausente' };
    return { estado: 'ilegible', motivo: error?.message ?? String(error) };
  }
  let sello;
  try {
    // Sin BOM: PowerShell 5.1 lo antepone con `-Encoding utf8`, y JSON.parse no lo acepta.
    sello = JSON.parse(String(texto).replace(/^\uFEFF/u, ''));
  } catch (error) {
    return { estado: 'ilegible', motivo: `no es JSON: ${error.message}` };
  }
  if (sello?.schema !== SCHEMA_SELLO) {
    return { estado: 'ilegible', motivo: `declara ${JSON.stringify(sello?.schema)} y se esperaba ${SCHEMA_SELLO}` };
  }
  if (typeof sello.instalado !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(sello.instalado)) {
    return { estado: 'ilegible', motivo: `la fecha de instalacion no es una fecha: ${JSON.stringify(sello.instalado)}` };
  }
  return { estado: 'valido', sello };
}

/** El sello, dicho en una frase. Dice la EDAD del runtime, nunca si quedo viejo: eso pide comparar. */
export function describirSello(lectura, ahora) {
  if (lectura.estado === 'ausente') {
    return `Runtime sin sello de instalacion: se instalo antes del ${SELLO_DESDE}, cuando el sello empezo a existir, o se copio a mano. Es por lo menos tan viejo como eso: reinstalalo.`;
  }
  if (lectura.estado === 'ilegible') {
    return `El sello de instalacion del runtime esta ilegible (${lectura.motivo}): no se puede decir cuando se instalo.`;
  }
  const { sello } = lectura;
  const dias = Math.floor((ahora - Date.parse(sello.instalado)) / DIA_MS);
  const origen = sello.desde === 'paquete' || typeof sello.commit !== 'string'
    ? 'desde un paquete sin git, asi que no hay commit que nombrar'
    : `desde el commit ${sello.commit.slice(0, 7)}${sello.arbol_limpio === false ? ', con cambios sin commitear en el checkout: ese commit no describe la copia del todo' : ''}`;
  return `El runtime de este proyecto se instalo el ${sello.instalado.slice(0, 10)}, hace ${dias} ${dias === 1 ? 'dia' : 'dias'}, ${origen}. Eso es su edad, no si quedo viejo: para compararlo hace falta el checkout.`;
}

export function parseArguments(args) {
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  const rest = requireInputs ? args.slice(0, -1) : args;
  if (rest[0] !== 'check') return null;
  if (rest.length === 1) return { runtime: null, requireInputs };
  if (rest.length === 3 && rest[1] === '--runtime' && rest[2].trim() !== '') return { runtime: rest[2], requireInputs };
  return null;
}

export function statKind(path, stat = statSync) {
  const info = stat(path, { throwIfNoEntry: false });
  if (info === undefined) return 'absent';
  return info.isDirectory() ? 'directory' : 'file';
}

/** Everything copy_runtime() would need to read here. Empty means: this really is a source checkout. */
export function missingSourceRoots(root, stat = statSync) {
  const absent = [];
  for (const directory of COPIED_DIRECTORIES) {
    if (statKind(join(root, directory), stat) !== 'directory') absent.push(`${directory}/`);
  }
  for (const file of COPIED_FILES) {
    if (statKind(join(root, file), stat) !== 'file') absent.push(file);
  }
  return absent;
}

function walk(directory, prefix, found, readdir) {
  for (const entry of readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walk(join(directory, entry.name), relative, found, readdir);
    else found.push(relative);
  }
  return found;
}

/**
 * Content hash per copied file, keyed by POSIX-relative path so both sides compare on Windows too.
 * A directory absent under `root` contributes nothing rather than throwing: on the runtime side
 * that absence is a finding for the caller to report, not a crash that hides the other findings.
 */
export function readInventory(root, io = {}) {
  const { stat = statSync, readdir = readdirSync, read = readFileSync } = io;
  const relatives = [];
  for (const directory of COPIED_DIRECTORIES) {
    if (statKind(join(root, directory), stat) === 'directory') walk(join(root, directory), directory, relatives, readdir);
  }
  for (const file of COPIED_FILES) {
    if (statKind(join(root, file), stat) === 'file') relatives.push(file);
  }
  const inventory = new Map();
  for (const relative of relatives.sort()) {
    try {
      inventory.set(relative, createHash('sha256').update(read(join(root, ...relative.split('/')))).digest('hex'));
    } catch (error) {
      // Never degrade an unreadable file into "no difference": that would turn a broken runtime
      // into a green gate, which is the exact blindness this whole script exists to remove.
      throw new Error(`cannot read ${relative} under ${root}: ${error.message}`);
    }
  }
  return inventory;
}

/**
 * Pure set/hash comparison. `extra` matters as much as the other two: a file the source no longer
 * ships is usually a gate that was deleted upstream and that the project still executes.
 */
export function compareInventories(source, runtime) {
  const differing = [];
  const missing = [];
  const extra = [];
  for (const [relative, hash] of source) {
    if (!runtime.has(relative)) missing.push(relative);
    else if (runtime.get(relative) !== hash) differing.push(relative);
  }
  for (const relative of runtime.keys()) {
    if (!source.has(relative)) extra.push(relative);
  }
  return {
    ok: differing.length === 0 && missing.length === 0 && extra.length === 0,
    compared: source.size,
    differing: differing.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
  };
}

export function main(args = process.argv.slice(2), cwd = '.', io = {}, write = console.log, writeError = console.error) {
  const parsed = parseArguments(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const stat = io.stat ?? statSync;

  // LA NUEVA GANA, LA VIEJA SE ACEPTA. Y si estan las DOS no se elige en silencio: una copia vieja
  // que sobrevive a la migracion es un gate retirado que se sigue pudiendo ejecutar, el mismo modo
  // de falla que este gate ya declara para los archivos que sobran.
  const presentes = RUTAS_DE_RUNTIME.filter((ruta) => statKind(join(cwd, ...ruta.split('/')), stat) === 'directory');
  if (parsed.runtime === null && presentes.length > 1) {
    writeError(`REJECTED: hay dos runtimes instalados: ${presentes.join(' y ')}. El segundo es del nombre anterior del protocolo y ya no se actualiza: borralo a mano, mirando la ruta, para que no quede una copia vieja de los gates que alguien pueda ejecutar sin darse cuenta.`);
    return 1;
  }
  const rutaElegida = presentes[0] ?? DEFAULT_RUNTIME_PATH;
  const runtimeRoot = parsed.runtime === null
    ? join(cwd, ...rutaElegida.split('/'))
    : resolve(cwd, parsed.runtime);
  if (statKind(runtimeRoot, stat) !== 'directory') {
    // A path the operator named explicitly and that is not a runtime is a mistake worth failing on:
    // a typo there would otherwise leave this gate permanently, silently green.
    if (parsed.runtime !== null) {
      writeError(`REJECTED: --runtime does not name an installed runtime directory: ${parsed.runtime}`);
      return 1;
    }
    const message = `no runtime installed at ${RUTAS_DE_RUNTIME.join(' ni ')} — nothing to compare (a source checkout without an installed runtime is normal).`;
    if (parsed.requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${message}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${message}`);
    return 0;
  }
  const absent = missingSourceRoots(cwd, stat);
  if (absent.length > 0) {
    writeError(`REJECTED: this directory is not an IA Stack source checkout (missing: ${absent.join(', ')}) — run the gate from the checkout the runtime was installed from, or point --runtime at the project runtime from there.`);
    // Sin el checkout no hay comparacion, y por eso sigue saliendo 1. Pero lo que antes era solo
    // «no puedo» ahora dice la edad del runtime: es lo unico que se puede saber desde aca.
    writeError(describirSello(leerSello(runtimeRoot, io), (io.ahora ?? Date.now)()));
    return 1;
  }
  let result;
  try {
    result = compareInventories(readInventory(cwd, io), readInventory(runtimeRoot, io));
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  if (!result.ok) {
    if (result.differing.length > 0) writeError(`REJECTED: installed runtime files that differ from this source: ${result.differing.join(', ')}`);
    if (result.missing.length > 0) writeError(`REJECTED: source files absent from the installed runtime: ${result.missing.join(', ')}`);
    if (result.extra.length > 0) writeError(`REJECTED: installed runtime files this source no longer has: ${result.extra.join(', ')}`);
    // EL CONSEJO MENTIA PARA UNA DE LAS TRES DIVERGENCIAS, y despues cambio lo que hace el instalador.
    // Comprobado el 2026-09-15: se borro un archivo del checkout, se reinstalo como esta linea
    // indicaba, y el archivo SIGUIO en la copia -- el instalador copiaba y nunca podaba --. Se agrego
    // el aviso de sacarlos a mano. El 2026-09-22 el operador decidio que el instalador los APARTE, y
    // ese aviso paso a mandar a borrar a mano lo que ya se aparta solo: un consejo que manda a hacer
    // algo destructivo que no hace falta es peor que ninguno.
    writeError('Fix: reinstall the runtime from this checkout — scripts/install.sh --project <project-root> (PowerShell: scripts/install.ps1 -ProjectDir <project-root>).');
    if (result.extra.length > 0) {
      writeError('Aviso: reinstalar con --project APARTA los archivos de mas del runtime del proyecto: los mueve a .vibe/ia-stack-archive/<fecha>/ia-stack-runtime/ conservando la ruta, y no los borra — vuelven con un mv si algo se rompio. Un runtime nombrado con --runtime fuera de un proyecto no se poda: ahi hay que sacarlos a mano, mirando cada ruta.');
    }
    return 1;
  }
  if (parsed.runtime === null && rutaElegida === RUTA_LEGADO) {
    write(`AVISO: el runtime instalado está en ${RUTA_LEGADO}, que es el nombre anterior del protocolo. Se sigue aceptando y se compara igual, pero la carpeta vigente es ${DEFAULT_RUNTIME_PATH}: reinstalá para migrar, y después borrá la vieja a mano.`);
  }
  write(`OK: the installed runtime at ${runtimeRoot} matches this source checkout in all ${result.compared} file(s).`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-runtime-sync.mjs')) {
  process.exitCode = main();
}
