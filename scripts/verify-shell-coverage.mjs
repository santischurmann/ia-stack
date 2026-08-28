#!/usr/bin/env node
// El hueco declarado decía que no hay cobertura instrumentada de Bash, y el research externo lo
// confirmó: `bash -n` sólo parsea —cero ramas ejecutadas, cero afirmaciones— y todo lo demás que
// encontró exigía infraestructura. Pero bash trae su propio instrumento y nadie lo estaba usando:
// con `PS4` conteniendo `$LINENO` y `set -x`, el propio shell escribe qué línea ejecutó.
//
// Eso convierte "no se puede medir" en un número. No es cobertura de ramas —una línea ejecutada no
// dice que sus dos caminos se probaron— pero es infinitamente más que parsear.
//
// LÍMITE HONESTO: mide LÍNEAS EJECUTADAS, no ramas ni condiciones. Una línea `if` cuenta como
// cubierta apenas se evalúa, sin importar si el `else` se probó alguna vez. Mide los escenarios que
// el contrato declara, así que un camino que nadie escribió como escenario no aparece: el número
// dice cuánto ejercitan los escenarios declarados, nunca cuánto del script es correcto. Y no mide
// PowerShell: `Set-PSDebug -Trace` existe pero su salida no da número de línea de forma portable,
// así que ese lenguaje queda declarado sin medición, no medido en cero.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: verify-shell-coverage.mjs check <shell-coverage.json>';
export const SCHEMA = 'vcp.shell-coverage/v1';
export const REPO_ROOT = resolve(dirname(fileURLToPath(new URL('.', import.meta.url))));
export const TRACE_PREFIX = 'VCPLINE:';
export const DIR_TOKEN = '{DIR}';

const TRACED = new RegExp(`^\\+*${TRACE_PREFIX}(\\d+)\\b`, 'u');
const COMMENT_OR_BLANK = /^\s*(?:#.*)?$/u;

/** Las líneas que bash puede llegar a ejecutar: ni vacías ni comentarios. Es el denominador. */
export function executableLines(source) {
  const lineas = new Set();
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    if (!COMMENT_OR_BLANK.test(line)) lineas.add(index + 1);
  }
  return lineas;
}

/** Las líneas que bash dijo haber ejecutado, leídas de su propia traza. */
export function tracedLines(stderr) {
  const lineas = new Set();
  for (const line of String(stderr).split(/\r?\n/u)) {
    const encontrado = line.match(TRACED);
    if (encontrado) lineas.add(Number(encontrado[1]));
  }
  return lineas;
}

export function coverageOf(executable, traced) {
  if (executable.size === 0) return { porcentaje: 0, cubiertas: 0, total: 0, sinCubrir: [] };
  const cubiertas = [...executable].filter((n) => traced.has(n));
  return {
    porcentaje: Number(((100 * cubiertas.length) / executable.size).toFixed(1)),
    cubiertas: cubiertas.length,
    total: executable.size,
    sinCubrir: [...executable].filter((n) => !traced.has(n)).sort((a, b) => a - b),
  };
}

/** Corre un escenario en un directorio temporal propio y devuelve la traza que bash escribió. */
export function runScenario(scriptPath, scenario, run = spawnSync) {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-shell-cov-'));
  try {
    for (const paso of scenario.setup ?? []) {
      run('bash', ['-c', paso.split(DIR_TOKEN).join(dir)], { cwd: dir, encoding: 'utf8' });
    }
    const args = (scenario.args ?? []).map((a) => a.split(DIR_TOKEN).join(dir));
    // PS4 lleva el número de línea: es todo el truco. `set -x` sin esto escribe el comando pero no
    // dónde estaba, y sin la posición no hay cobertura que calcular.
    const salida = run('bash', ['-x', scriptPath, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PS4: `${TRACE_PREFIX}\${LINENO} ` },
    });
    return `${salida.stderr ?? ''}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function readContract(path, readFile = readFileSync) {
  let documento;
  try {
    documento = JSON.parse(readFile(path, 'utf8'));
  } catch (error) {
    return { documento: null, error: `no se puede leer ${path} como JSON: ${error.message}` };
  }
  if (documento === null || typeof documento !== 'object' || Array.isArray(documento) || documento.schema !== SCHEMA) {
    return { documento: null, error: `${path} tiene que declarar schema ${SCHEMA}` };
  }
  if (!Array.isArray(documento.scripts) || documento.scripts.length === 0) {
    return { documento: null, error: `${path} no declara ningún script en "scripts"` };
  }
  for (const entrada of documento.scripts) {
    if (typeof entrada?.script !== 'string' || !entrada.script.endsWith('.sh')) {
      return { documento: null, error: `cada entrada tiene que nombrar un archivo .sh, no ${JSON.stringify(entrada?.script)}` };
    }
    const medido = Array.isArray(entrada.scenarios) && entrada.scenarios.length > 0;
    // Un script sin escenarios es una exclusión, y una exclusión sin motivo escrito es el agujero
    // por donde vuelve a entrar lo que este gate viene a medir.
    if (!medido && (typeof entrada.why !== 'string' || entrada.why.trim() === '')) {
      return { documento: null, error: `${entrada.script}: sin escenarios hay que declarar "why"` };
    }
    if (medido && (typeof entrada.floor !== 'number' || entrada.floor < 0 || entrada.floor > 100)) {
      return { documento: null, error: `${entrada.script}: "floor" tiene que ser un porcentaje entre 0 y 100` };
    }
  }
  return { documento, error: null };
}

export function measure(entrada, io = {}) {
  const scriptPath = join(io.root ?? REPO_ROOT, entrada.script);
  const source = (io.read ?? readFileSync)(scriptPath, 'utf8');
  const ejecutables = executableLines(source);
  const trazadas = new Set();
  for (const escenario of entrada.scenarios) {
    for (const linea of tracedLines((io.run ?? runScenario)(scriptPath, escenario, io.spawn))) trazadas.add(linea);
  }
  return coverageOf(ejecutables, trazadas);
}

export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  if (args.length !== 2 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const { documento, error } = readContract(args[1], options.readFile);
  if (error !== null) {
    writeError(`REJECTED: SHELL_COVERAGE_CONTRACT_INVALID: ${error}`);
    return 1;
  }
  const bajos = [];
  const medidos = [];
  let excluidos = 0;
  for (const entrada of documento.scripts) {
    if (!Array.isArray(entrada.scenarios) || entrada.scenarios.length === 0) {
      excluidos += 1;
      continue;
    }
    const resultado = measure(entrada, options);
    medidos.push(`${entrada.script} ${resultado.porcentaje}% (${resultado.cubiertas}/${resultado.total})`);
    if (resultado.porcentaje < entrada.floor) {
      bajos.push(`${entrada.script}: ${resultado.porcentaje}% de líneas ejecutadas, por debajo del piso declarado de ${entrada.floor}%. Sin cubrir: ${resultado.sinCubrir.join(', ')}`);
    }
  }
  if (bajos.length > 0) {
    for (const bajo of bajos) writeError(`REJECTED: SHELL_COVERAGE_BELOW_FLOOR: ${bajo}`);
    return 1;
  }
  write(`OK: ${medidos.join(' · ')}; ${excluidos} script(s) sin escenario declarado, con motivo escrito. Mide líneas ejecutadas, no ramas.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-shell-coverage.mjs')) {
  process.exitCode = main();
}
