#!/usr/bin/env node
// Este gate existe por un fallo propio, reproducido: T12 marcó como "vacíos" los seis caminos donde
// un gate decía OK sin haber comparado nada, y la lista salió de leer el código. La batería completa
// encontró un séptimo minutos después —en el gate que T11 había agregado horas antes— y una sonda de
// diez líneas encontró dos más, uno grave: `verify-audit-chain.mjs check` sobre un AUDIT.md borrado
// decía "cadena íntegra". Leer el código no alcanzó tres veces seguidas. Ejecutarlo sí.
//
// La sonda es tonta a propósito: corre cada gate en un directorio vacío y mira qué dice. Un gate que
// escribe `OK:` ahí está afirmando haber verificado algo cuando no había absolutamente nada que
// verificar. Cada gate declara en contracts/empty-probe.json cuál de los cuatro comportamientos
// espera, y —esto es lo que cierra el agujero— un script verify-*.mjs que no esté declarado es un
// rechazo: agregar un gate obliga a decir qué hace cuando no hay entradas.
//
// LÍMITE HONESTO: prueba UNA invocación por gate, la que declara el contrato. Un gate con varios
// subcomandos puede tener un camino vacío en otro subcomando y esta sonda no lo ve. Tampoco prueba
// proyectos a medio llenar —un repo con spec pero sin tests, por ejemplo—: sólo el caso extremo del
// directorio vacío, que es el que resultó suficiente para encontrar los tres que se escaparon.
// `self` es una declaración humana, no una comprobación: si alguien la escribe sobre un gate que sí
// mira el proyecto, la sonda lo acepta y el verde vacío vuelve a pasar sin que nadie lo note.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: verify-empty-probe.mjs check <empty-probe.json>';
export const SCHEMA = 'vcp.empty-probe/v1';
export const SCRIPTS_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
export const GATE_FILE = /^verify-.*\.mjs$/u;
/**
 * reject: sale distinto de 0 — no hay entradas y el gate lo dice.
 * usage:  sale 2 — le faltan argumentos obligatorios, ni siquiera llega a mirar.
 * empty:  sale 0 y escribe VACÍO: — no había nada que comparar, y no se disfraza de verde.
 * self:   sale 0 y escribe OK: legítimamente, porque verifica el propio checkout de VCP y no el
 *         directorio de trabajo. Exige un `why` que lo explique: es la única salida que permite un
 *         OK sobre un directorio vacío, así que no puede quedar sin justificar.
 * skip:   no se corre. Exige un `why`. El número de excluidos se escribe en la salida: un gate que
 *         nadie prueba tiene que verse, no desaparecer.
 */
export const EXPECTATIONS = ['reject', 'usage', 'empty', 'self', 'skip'];
// `usage` tambien exige motivo: un gate declarado con argumentos deliberadamente incompletos sale
// 2 SIEMPRE, asi que la sonda nunca lo prueba de verdad y queda contado como si lo hubiera hecho.
// Encontrado atacando esta sonda el 2026-08-28. Sin motivo escrito, es un skip invisible.
export const JUSTIFIED = ['self', 'skip', 'usage'];

export function parseArgs(args) {
  if (args.length === 2 && args[0] === 'check' && args[1] !== '') return { contract: args[1] };
  return null;
}

export function readContract(path, readFile = readFileSync) {
  let document;
  try {
    document = JSON.parse(readFile(path, 'utf8'));
  } catch (error) {
    return { document: null, error: `no se puede leer ${path} como JSON: ${error.message}` };
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { document: null, error: `${path} no es un objeto` };
  }
  if (document.schema !== SCHEMA) {
    return { document: null, error: `${path} declara schema ${JSON.stringify(document.schema)}, se esperaba ${SCHEMA}` };
  }
  if (!Array.isArray(document.gates) || document.gates.length === 0) {
    return { document: null, error: `${path} no declara ningún gate en "gates"` };
  }
  return { document, error: null };
}

export function validateShape(gates) {
  const violations = [];
  const seen = new Set();
  for (const [index, gate] of gates.entries()) {
    const at = `gates[${index}]`;
    if (gate === null || typeof gate !== 'object' || Array.isArray(gate)) {
      violations.push(`${at} no es un objeto`);
      continue;
    }
    if (typeof gate.script !== 'string' || !GATE_FILE.test(gate.script)) {
      violations.push(`${at}.script no nombra un verify-*.mjs: ${JSON.stringify(gate.script)}`);
      continue;
    }
    if (seen.has(gate.script)) violations.push(`${at}.script está declarado dos veces: ${gate.script}`);
    seen.add(gate.script);
    if (!Array.isArray(gate.args) || gate.args.some((arg) => typeof arg !== 'string')) {
      violations.push(`${gate.script}: "args" tiene que ser una lista de strings`);
    }
    if (!EXPECTATIONS.includes(gate.expect)) {
      violations.push(`${gate.script}: "expect" tiene que ser uno de ${EXPECTATIONS.join(', ')}, no ${JSON.stringify(gate.expect)}`);
    }
    // Un `self` o un `skip` sin motivo escrito serían la puerta trasera: cualquier verde vacío se
    // taparía etiquetándolo así. El motivo no prueba nada, pero deja el argumento a la vista.
    if (JUSTIFIED.includes(gate.expect) && (typeof gate.why !== 'string' || gate.why.trim() === '')) {
      violations.push(`${gate.script}: "${gate.expect}" exige un "why" que lo justifique por escrito`);
    }
  }
  return violations;
}

export function undeclaredGates(declared, present) {
  const names = new Set(declared);
  return present.filter((script) => !names.has(script));
}

export function missingGates(declared, present) {
  const names = new Set(present);
  return declared.filter((script) => !names.has(script));
}

export function classify(outcome) {
  if (outcome.status === 2) return 'usage';
  if (outcome.status !== 0) return 'reject';
  return outcome.stdout.startsWith('VACÍO: ') ? 'empty' : 'self';
}

/** Corre un gate con su directorio vacío propio, para que ninguno vea lo que dejó otro. */
export function runInEmptyDirectory(script, args, spawn = spawnSync) {
  const directory = mkdtempSync(join(tmpdir(), 'vcp-empty-probe-'));
  try {
    // Si el spawn falla del todo -- el binario de node no está, se acabaron los descriptores -- no hay
    // salida que leer y `status` es null. Eso se clasifica como "reject", nunca como verificación.
    const result = spawn(process.execPath, [join(SCRIPTS_DIR, script), ...args], { cwd: directory, encoding: 'utf8' });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function probe(gates, run = runInEmptyDirectory) {
  const violations = [];
  for (const gate of gates) {
    if (gate.expect === 'skip') continue;
    const outcome = run(gate.script, gate.args);
    const actual = classify(outcome);
    if (actual === gate.expect) continue;
    const said = (outcome.stdout || outcome.stderr || '').split('\n')[0].trim();
    violations.push(`${gate.script} sobre un directorio vacío se comporta como "${actual}" y el contrato declara "${gate.expect}": ${said}`);
  }
  return violations;
}

export function listGateScripts(list = readdirSync) {
  return list(SCRIPTS_DIR).filter((name) => GATE_FILE.test(name)).sort();
}

export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const { document, error } = readContract(parsed.contract, options.readFile);
  if (error !== null) {
    writeError(`REJECTED: EMPTY_PROBE_CONTRACT_INVALID: ${error}`);
    return 1;
  }
  const shape = validateShape(document.gates);
  if (shape.length > 0) {
    for (const violation of shape) writeError(`REJECTED: EMPTY_PROBE_CONTRACT_INVALID: ${violation}`);
    return 1;
  }
  const declared = document.gates.map((gate) => gate.script);
  const present = listGateScripts(options.list);
  const undeclared = undeclaredGates(declared, present);
  const missing = missingGates(declared, present);
  if (undeclared.length > 0 || missing.length > 0) {
    if (undeclared.length > 0) {
      writeError(`REJECTED: EMPTY_PROBE_GATE_UNDECLARED: ${undeclared.join(', ')} no declara(n) qué hace(n) sobre un directorio vacío. Agregalo a ${parsed.contract}.`);
    }
    if (missing.length > 0) {
      writeError(`REJECTED: EMPTY_PROBE_GATE_ABSENT: ${parsed.contract} declara gates que ya no existen: ${missing.join(', ')}`);
    }
    return 1;
  }
  const violations = probe(document.gates, options.run);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: EMPTY_PROBE_BEHAVIOUR_MISMATCH: ${violation}`);
    return 1;
  }
  const count = (expect) => document.gates.filter((gate) => gate.expect === expect).length;
  const probed = document.gates.length - count('skip');
  write(`OK: ${probed} gate(s) se comportan sobre un directorio vacío como declara ${parsed.contract}; ${count('self')} verifica(n) el propio checkout y por eso pueden salir OK; ${count('skip')} excluido(s) con motivo escrito.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-empty-probe.mjs')) {
  process.exitCode = main();
}
