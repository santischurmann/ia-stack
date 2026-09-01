#!/usr/bin/env node
// verify-vcp-coverage.mjs — prueba que cada script Node inventariado ejecutó todas sus funciones y
// todas sus ramas durante la suite, y lo prueba de una manera que da el MISMO resultado sobre el
// mismo árbol.
//
// Antes leía la tabla de texto de `node --experimental-test-coverage`. Ese número lo produce un
// merge de la cobertura de ~600 procesos (los workers de cada archivo de prueba, cada CLI que las
// pruebas lanzan, y las corridas anidadas de `node --test`), y el merge depende del ORDEN en que
// se leen los archivos de cobertura, cuyos nombres llevan pid y timestamp. Reproducido el
// 2026-08-29: tres corridas seguidas sobre un árbol quieto dieron OK / FALLA / OK, y en corridas
// distintas la misma tabla acusó a verify-audit-chain.mjs (99.10% de ramas), a
// verify-discovery-views.mjs (98.85%) o a nadie. Peor que la inestabilidad: la tabla también
// ESCONDÍA huecos reales — verify-receipt.mjs tenía tres ramas jamás ejecutadas y salía 100.00% en
// todas las corridas. Un gate que responde distinto sobre la misma entrada no sirve como gate, y
// uno que responde 100% sobre ramas que nadie ejecutó es un verde vacío.
//
// Ahora el gate mide él mismo, sobre los datos crudos de V8 (NODE_V8_COVERAGE), con una suma:
// para cada rango, la cuenta total es la suma de lo que reportó cada proceso. Sumar es conmutativo
// y asociativo, así que el resultado no puede depender del orden de lectura.
//
// Este metodo se escribio el 2026-08-29 y quedo sin integrar a main durante 37 commits. Main se
// quedo mientras tanto con el arreglo del sintoma -- serializar la suite --, que no elimina el
// merge: node lanza un proceso por archivo de prueba igual, asi que los huecos seguian tapados.
// Medido el 2026-09-01 sobre un clon limpio de af55a45: el gate de main informaba 30/30 a 100 %
// mientras este metodo encontraba 7 funciones o ramas que ningun proceso habia ejecutado.
//
// LÍMITE HONESTO: mide EJECUCIÓN, no aserción. Una rama ejecutada por una prueba que no afirma
// nada cuenta igual que una verificada. Tampoco mide los scripts de shell (eso es
// verify-shell-coverage.mjs), ni las copias del runtime que las pruebas E2E dejan en directorios
// temporales: sólo cuenta la cobertura del archivo real del proyecto, porque la cobertura de una
// copia no prueba nada sobre el original.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const USAGE = 'usage: node scripts/verify-vcp-coverage.mjs';
export const NO_INPUTS_SOURCE_CHANGED = 'COVERAGE_SOURCE_CHANGED';
export const NO_COVERAGE_DATA = 'COVERAGE_NO_DATA';
export const UNREADABLE_COVERAGE = 'COVERAGE_UNREADABLE';

/** Inventory every Node executable we claim line/branch/function coverage for. */
/** Rutas relativas al proyecto, no nombres sueltos: un ayudante de pruebas homonimo cubria a un
 * script sin tener una sola prueba. Reproducido el 2026-08-28. */
export function listMjsScripts(cwd = repoRoot, readDirectory = readdirSync) {
  return readDirectory(`${cwd}/scripts`, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => `scripts/${entry.name}`)
    .sort();
}

/**
 * La cuenta que UN proceso le atribuye a un offset: la del rango más chico que lo contiene. V8 sólo
 * emite un sub-rango cuando su cuenta difiere de la del bloque que lo envuelve, así que un bloque
 * sin rango propio hereda la cuenta del rango de afuera. Leer sólo los rangos explícitos es lo que
 * hace que un proceso que apenas importó el módulo parezca declarar "esto nunca se ejecutó" sobre
 * código que otro proceso sí ejecutó.
 * `null` -- y no 0 -- cuando el proceso no tiene ningún rango sobre ese offset: no vio ese código,
 * así que no tiene nada que decir, ni a favor ni en contra.
 */
export function innermostCount(functions, offset) {
  let best = null;
  for (const fn of functions) {
    for (const range of fn.ranges) {
      if (range.startOffset > offset || offset >= range.endOffset) continue;
      if (best === null || range.endOffset - range.startOffset < best.endOffset - best.startOffset) best = range;
    }
  }
  return best === null ? null : best.count;
}

/** Suma sobre procesos. Conmutativa y asociativa: acá vive la determinación del gate. */
export function totalCount(processes, offset) {
  let total = 0;
  for (const functions of processes) {
    const count = innermostCount(functions, offset);
    if (count !== null) total += count;
  }
  return total;
}

/** Número de línea 1-based del offset, para que un rechazo nombre un lugar al que ir. */
export function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/**
 * Las funciones y las ramas que ningún proceso ejecutó. La unión de rangos se toma sobre todos los
 * procesos porque cada uno reporta una forma distinta del mismo archivo; el veredicto de cada rango
 * sale de la suma, no del proceso que lo reportó.
 * No hace falta una comprobación de líneas aparte: una línea que nadie ejecutó está dentro de algún
 * rango que nadie ejecutó -- V8 emite un rango para cada bloque no ejecutado, incluido el cuerpo de
 * un `if` de nivel superior -- así que este chequeo la agarra por el rango que la contiene.
 */
export function uncoveredRanges(processes, source) {
  const candidates = new Map();
  for (const functions of processes) {
    for (const fn of functions) {
      const root = fn.ranges[0];
      if (root === undefined) continue;
      candidates.set(`${root.startOffset}-${root.endOffset}`, { kind: 'función', offset: root.startOffset, name: fn.functionName });
      if (fn.isBlockCoverage !== true) continue;
      for (let i = 1; i < fn.ranges.length; i += 1) {
        const range = fn.ranges[i];
        const key = `${range.startOffset}-${range.endOffset}`;
        if (!candidates.has(key)) candidates.set(key, { kind: 'rama', offset: range.startOffset, name: fn.functionName });
      }
    }
  }
  return [...candidates.values()]
    .filter((candidate) => totalCount(processes, candidate.offset) === 0)
    .sort((a, b) => a.offset - b.offset)
    .map((candidate) => ({ ...candidate, line: lineAt(source, candidate.offset) }));
}

/**
 * Junta los datos crudos de V8, indexados por la URL EXACTA del archivo del proyecto. Comparar la
 * URL completa, y no un nombre ni un sufijo, es lo que deja afuera a las copias del runtime que las
 * pruebas E2E instalan en directorios temporales: son otro archivo, y su cobertura no dice nada
 * sobre el original.
 * Un archivo de cobertura ilegible se informa, nunca se saltea: saltearlo perdería la cobertura que
 * ese proceso midió y podría inventar un hueco que no existe.
 */
export function collectScriptCoverage(directory, scripts, cwd = repoRoot, io = {}) {
  const list = io.list ?? readdirSync;
  const read = io.read ?? ((file) => readFileSync(file, 'utf8'));
  const byUrl = new Map();
  const byScript = new Map();
  for (const script of scripts) {
    const url = pathToFileURL(join(cwd, script)).href;
    const processes = [];
    byUrl.set(url, processes);
    byScript.set(script, processes);
  }
  const unreadable = [];
  for (const name of [...list(directory)].sort()) {
    let document;
    try {
      document = JSON.parse(read(join(directory, name)));
    } catch (error) {
      unreadable.push(`${name}: ${error.message}`);
      continue;
    }
    for (const entry of document?.result ?? []) {
      const processes = byUrl.get(entry.url);
      if (processes !== undefined) processes.push(entry.functions ?? []);
    }
  }
  return { byScript, unreadable };
}

/** Traduce lo medido en un veredicto. Sin efectos: recibe las fuentes ya leídas. */
export function evaluateCoverage(byScript, sources) {
  const sinDatos = [];
  const huecos = [];
  for (const [script, processes] of byScript) {
    if (processes.length === 0) {
      sinDatos.push(script);
      continue;
    }
    for (const gap of uncoveredRanges(processes, sources.get(script) ?? '')) {
      huecos.push(`${script}:${gap.line} (${gap.kind}${gap.name ? ` ${gap.name}` : ''})`);
    }
  }
  if (sinDatos.length > 0) {
    return { ok: false, code: NO_COVERAGE_DATA, message: `la suite no dejó ni un dato de cobertura para: ${sinDatos.join(', ')}. Un script sin medición no está en 100%: está sin medir.` };
  }
  if (huecos.length > 0) {
    return { ok: false, code: null, message: `hay ${huecos.length} función(es)/rama(s) que ningún proceso ejecutó: ${huecos.join('; ')}` };
  }
  return { ok: true, code: null, message: `los ${byScript.size} script(s) Node inventariado(s) ejecutaron todas sus funciones y todas sus ramas.` };
}

/**
 * Concurrencia de la suite medida. El default es 32 desde que el presupuesto de spawn de la
 * evidencia dejo de caer dentro de la latencia real (ver tests/spawn-budget.mjs): hasta entonces
 * el gate serializaba, y serializar tapaba la inestabilidad en vez de arreglarla. El override
 * existe para una maquina con menos nucleos, no para volver a esconder un rojo.
 */
export const DEFAULT_TEST_CONCURRENCY = '32';

export function resolveTestConcurrency(env = process.env) {
  const requested = env.VCP_TEST_CONCURRENCY;
  return typeof requested === 'string' && /^[1-9][0-9]*$/u.test(requested)
    ? requested
    : DEFAULT_TEST_CONCURRENCY;
}

export function runCoverage(run = spawnSync, cwd = repoRoot, directory = '', env = process.env) {
  return run(process.execPath, ['--test', `--test-concurrency=${resolveTestConcurrency(env)}`], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    // NODE_TEST_CONTEXT se limpia porque si el gate se corre DESDE un worker de `node --test`
    // -- que es como lo prueba su propia suite -- la suite hija hereda el protocolo del padre y no
    // termina limpia. NODE_V8_COVERAGE se pisa siempre: la medicion tiene que caer en el directorio
    // de esta corrida y no en el de quien nos haya lanzado.
    env: { ...env, NODE_TEST_CONTEXT: undefined, NODE_V8_COVERAGE: directory },
  });
}
/**
 * Huella del contenido de todos los scripts. Se toma antes y después de medir: una corrida de
 * cobertura sobre código que cambió debajo reporta ramas sin cubrir que no existen. Reproducido
 * el 2026-08-28 -- ocho corridas seguidas, las tres hechas mientras se editaba un script
 * inventaron ramas, las cinco con el árbol quieto salieron limpias.
 */
// El inventario ya viene con la ruta relativa al proyecto, asi que no se le antepone nada.
// El separador entre entradas es un NUL, escrito como String.fromCharCode(0) y no como byte crudo:
// un byte NUL adentro del archivo hace que git y grep traten a este script como binario, y un gate
// cuyo diff nadie puede leer es un gate que nadie revisa. Tiene que ser NUL y no un espacio: es el
// unico byte que no puede aparecer en un nombre de archivo ni en el texto de un script, asi que es
// el unico que garantiza que dos inventarios distintos no puedan producir la misma huella.
export function fingerprintScripts(list = () => listMjsScripts(), read = (name) => readFileSync(join(repoRoot, name), 'utf8')) {
  const huella = createHash('sha256');
  const separador = String.fromCharCode(0);
  for (const name of [...list()].sort()) huella.update(`${name}
`).update(read(name)).update(separador);
  return huella.digest('hex');
}

export function main(args = process.argv.slice(2), run = runCoverage, write = console.log, writeError = console.error, cwd = repoRoot, io = {}) {
  if (args.length !== 0) {
    writeError(USAGE);
    return 2;
  }

  let expectedScripts;
  try {
    expectedScripts = listMjsScripts(cwd, io.readScriptsDir);
  } catch (error) {
    writeError(`Unable to inventory scripts/*.mjs: ${error.message}`);
    return 1;
  }

  // Ligadas al proyecto medido: `main` recibe un cwd y la huella tiene que hablar de ESE arbol.
  const listarParaHuella = io.list ?? (() => listMjsScripts(cwd, io.readScriptsDir));
  const leerParaHuella = io.read ?? ((name) => readFileSync(join(cwd, name), 'utf8'));

  // Un script que desaparece o se vuelve ilegible mientras corre la medicion es exactamente el
  // caso que la huella existe para detectar, asi que se rechaza con su codigo propio en vez de
  // salir por una excepcion sin manejar. Y la huella inicial se toma ANTES de crear el directorio
  // temporal: si fallara despues, el directorio quedaria huerfano en el disco del usuario.
  const tomarHuella = () => {
    try {
      return { ok: true, valor: fingerprintScripts(listarParaHuella, leerParaHuella) };
    } catch (error) {
      return { ok: false, motivo: error.message };
    }
  };
  const huellaAntes = tomarHuella();
  if (!huellaAntes.ok) {
    writeError(`REJECTED: ${NO_INPUTS_SOURCE_CHANGED}: no se pudo leer el inventario de scripts para tomar la huella previa: ${huellaAntes.motivo}`);
    return 1;
  }

  const makeDirectory = io.mkdtemp ?? ((prefix) => mkdtempSync(prefix));
  const removeDirectory = io.rmdir ?? ((path) => rmSync(path, { recursive: true, force: true }));
  const directory = makeDirectory(join(tmpdir(), 'vcp-coverage-'));
  try {
    const result = run(spawnSync, cwd, directory);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.error) {
      writeError(`Coverage command could not launch: ${result.error.message}`);
      return 1;
    }
    if (result.status !== 0) {
      if (output) writeError(output.trim());
      writeError(`Coverage command exited ${result.status}`);
      return 1;
    }
    const { byScript, unreadable } = collectScriptCoverage(directory, expectedScripts, cwd, { list: io.listCoverage, read: io.readCoverage });
    // Un número medido sobre código que se movió no es un número: se rechaza en vez de publicarlo.
    const huellaDespues = tomarHuella();
    if (!huellaDespues.ok || huellaDespues.valor !== huellaAntes.valor) {
      writeError(`REJECTED: ${NO_INPUTS_SOURCE_CHANGED}: los scripts cambiaron mientras corría la medición; el resultado no vale. Volvé a correrlo con el árbol quieto.`);
      return 1;
    }
    if (unreadable.length > 0) {
      writeError(`REJECTED: ${UNREADABLE_COVERAGE}: no se pudo leer ${unreadable.length} archivo(s) de cobertura, así que la medición está incompleta: ${unreadable.join('; ')}`);
      return 1;
    }
    const sources = new Map(expectedScripts.map((script) => [script, (io.read ?? ((name) => readFileSync(join(cwd, name), 'utf8')))(script)]));
    const verdict = evaluateCoverage(byScript, sources);
    if (!verdict.ok) {
      writeError(`REJECTED: ${verdict.code === null ? '' : `${verdict.code}: `}${verdict.message}`);
      return 1;
    }
    write(`OK: ${verdict.message}`);
    return 0;
  } finally {
    removeDirectory(directory);
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-coverage.mjs')) {
  process.exitCode = main();
}
