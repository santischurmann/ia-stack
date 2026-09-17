#!/usr/bin/env node
// Native, closed-world verifier for the test evidence attached to active Discovery requirements.
// It accepts only project-local test files and runs each file independently with Node TAP. It
// proves path, declaration, isolated execution and exact TAP metadata; it does not prove that a
// test's semantic assertion is sufficient for the requirement's natural-language rule.

import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Tope de tiempo para cada `test_ref`. MEDIDO, no elegido, y con una REGLA: tiene que dejar al
 * menos el TRIPLE del archivo de prueba mas lento del repositorio.
 *
 * El tope existe para atrapar una prueba COLGADA -- un bucle infinito, una espera que nunca llega --,
 * no para juzgar si una prueba de punta a punta es lenta. Esa distincion es la que se pierde cuando
 * el numero queda corto: el fallo deja de hablar del test y pasa a hablar de su duracion.
 *
 * TRES VALORES, Y CADA UNO SE QUEDO CORTO POR EL MISMO MOTIVO. El 30_000 original salio de la
 * intuicion, y quedo POR DEBAJO del archivo de prueba mas lento del propio repositorio -- esa frase
 * se deja literal: `docs/mejoras/2026-09-05-3.json` la cita, y una cita que no resuelve parece
 * evidencia sin serlo. El 2026-09-05 se midio y se subio a 120_000,
 * con la regla del triple escrita al lado: el mas lento era verify-receipt-gate.test.mjs con 35-40 s.
 * El 2026-09-17 ese mismo archivo mide 89-101 s: el tope quedo en 1,2 veces el mas lento, con la
 * regla rota por un factor de 2,5, y sin que nada se pusiera rojo. LA REGLA VIVIA EN ESTE COMENTARIO
 * Y NADIE LA COMPROBABA -- solo se comprobaba «por debajo del tope», y por debajo del tope cabe un
 * margen de 19 s que cualquier maquina cargada se come.
 *
 * SE DIMENSIONA CONTRA LA PEOR LECTURA, NO CONTRA LA MEJOR: asi se rompio la vez anterior. El
 * mismo archivo, sin que cambiara una linea, dio 89, 101 y 116 s en una sola tarde del 2026-09-17, y
 * 56 s el dia anterior. Tomar el mejor numero y multiplicarlo por tres deja un tope que la proxima
 * tarde no cumple su propia regla. 600_000 deja 5,2 veces los 116 s peores medidos, y sigue dejando
 * el triple si esa medicion se va a 200 s.
 *
 * LO QUE CUESTA: una prueba genuinamente colgada tarda 10 minutos en morir en vez de 2. Es el precio
 * de que el tope sea un detector de colgadas y no un limite de velocidad disfrazado -- y es la
 * distincion que los dos numeros anteriores perdian.
 *
 * Y desde ahora `scripts/verify-test-duration.mjs` NO comprueba el numero sino la regla: mide el
 * archivo que el repositorio declara mas lento y rechaza si el tope no deja el triple, aunque entre.
 * Una prueba de la suite comprueba la otra mitad, que es barata y no mide nada: que el tope deje el
 * triple sobre lo que el contrato DECLARA. La regla dejo de ser un comentario. */
export const TAP_TIMEOUT_MS = 600_000;
export const USAGE = 'usage: verify-test-bindings.mjs check';

function failed(code, message = code) {
  return { ok: false, code, message };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Lo que puede venir ANTES de un `/` para que ese `/` abra un literal de expresión regular y no
 * sea una división. Es la heurística estándar: después de un operador, una apertura o una palabra
 * clave hay un valor, y ahí `/` abre regex; después de un identificador, un cierre o un número hay
 * un operando, y ahí `/` divide. */
const ANTES_DE_REGEX = /(?:[({[,;:!?&|+\-*%^~=<>]|\b(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await))\s*$/u;

// The static declaration check deliberately ignores comments, quoted strings and regular-expression
// literals. It is not a JS parser; it only proves the narrow convention VCP relies on: a literal
// test()/it() call with the exact declared title, not a REQ-ID pasted in a comment or in prose.
//
// LA HERIDA (medida el 2026-09-08): no conocía el literal de expresión regular, así que una comilla
// adentro de un regex —`/[data-theme="dark"]/`— lo metía en modo cadena y se tragaba todo hasta la
// siguiente comilla suelta. Doce declaraciones `test()` REALES quedaban invisibles en siete
// archivos de `tests/`, el tramo mayor de 3.702 bytes; sobre `scripts/` llegaba a 15.643. No era
// cosmético: vincular un requisito a cualquiera de esas doce daba
// DISCOVERY_TEST_BINDING_STATIC_INVALID sobre una prueba que está a la vista y pasa en verde.
export function hasLiteralTestDeclaration(source, testName) {
  // La backtick entra acá, y no entraba: cuatro declaraciones del propio repositorio la usan. Un
  // nombre INTERPOLADO no tiene forma literal y por eso no se puede casar — eso es un límite
  // declarado, no un descuido.
  const expected = new RegExp(`^(?:test|it)(?:\\.(?:skip|todo))?\\s*\\(\\s*(['\"\`])${escapeRegex(testName)}\\1`, 'u');
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      i = end === -1 ? source.length : end + 1;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
    } else if (source[i] === "'" || source[i] === '"' || source[i] === '`') {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === '\\') i += 2;
        else if (source[i++] === quote) break;
      }
    } else if (source[i] === '/' && ANTES_DE_REGEX.test(source.slice(0, i))) {
      // Literal de regex: se consume entero. Adentro, una clase `[...]` puede contener una barra
      // sin cerrarlo, y un escape se salta de a dos.
      i += 1;
      let enClase = false;
      while (i < source.length && source[i] !== '\n') {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === '[') enClase = true;
        else if (source[i] === ']') enClase = false;
        else if (source[i] === '/' && !enClase) { i += 1; break; }
        i += 1;
      }
    } else {
      const candidate = source.slice(i);
      if ((i === 0 || !/[A-Za-z0-9_$]/u.test(source[i - 1])) && expected.test(candidate)) return true;
      i++;
    }
  }
  return false;
}

export function validateTestReference(testRef, cwd) {
  if (typeof testRef !== 'string' || !/^tests\/[A-Za-z0-9._/-]+\.test\.mjs$/u.test(testRef) || testRef.includes('..') || testRef.includes('\\')) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref must be a canonical tests/*.test.mjs path');
  }
  try {
    const root = realpathSync(cwd);
    const file = resolve(root, testRef);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref must be a regular non-symlink file');
    realpathSync(file); // The strict lexical tests/* contract above prevents traversal; this catches broken reparse points.
    return { ok: true, file };
  } catch (error) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', `test_ref is unreadable: ${error.message}`);
  }
}

export function parseTapResults(stdout) {
  return stdout.split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^(not )?ok \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/u);
    if (!match) return [];
    return [{ name: match[2], ok: !match[1], skipped: Boolean(match[3]) }];
  });
}

export function checkTestBinding(row, cwd, { spawn = spawnSync } = {}) {
  if (!row || typeof row !== 'object' || typeof row.req_id !== 'string' || typeof row.test_name !== 'string' || !row.test_name.startsWith(`${row.req_id} · `)) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_name must start with its req_id and a middle-dot separator');
  }
  const reference = validateTestReference(row.test_ref, cwd);
  if (!reference.ok) return reference;
  const source = readFileSync(reference.file, 'utf8');
  if (!hasLiteralTestDeclaration(source, row.test_name)) {
    return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'test_ref has no literal test()/it() declaration with the exact test_name');
  }
  const result = spawn(process.execPath, ['--test', '--test-reporter=tap', row.test_ref], {
    cwd,
    encoding: 'utf8',
    timeout: TAP_TIMEOUT_MS,
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return failed('DISCOVERY_TEST_BINDING_TIMEOUT', `test_ref exceeded ${TAP_TIMEOUT_MS}ms`);
  }
  if (result.error || result.status !== 0) {
    return failed('DISCOVERY_TEST_BINDING_FAILED', `test_ref did not exit cleanly: ${result.error?.message ?? `exit ${result.status}`}`);
  }
  const matched = parseTapResults(result.stdout ?? '').filter((item) => item.name === row.test_name);
  if (matched.length === 0) return failed('DISCOVERY_TEST_BINDING_MISSING', 'exact test_name is absent from stdout TAP');
  if (matched.length > 1) return failed('DISCOVERY_TEST_BINDING_DUPLICATE_RESULT', 'exact test_name appears more than once in stdout TAP');
  if (!matched[0].ok) return failed('DISCOVERY_TEST_BINDING_FAILED', 'exact test_name did not pass in stdout TAP');
  if (matched[0].skipped) return failed('DISCOVERY_TEST_BINDING_SKIPPED', 'exact test_name is marked SKIP or TODO');
  return { ok: true };
}

// A TAP file is an execution unit, while each requirement still needs an exact
// title lookup in that TAP output. Reuse the immutable process result per
// cwd/test_ref, then preserve every per-requirement static and TAP check.
export function createCachedBindingCheck(check = checkTestBinding, spawn = spawnSync) {
  if (check !== checkTestBinding) return (row, cwd) => check(row, cwd);
  const executions = new Map();
  return (row, cwd) => checkTestBinding(row, cwd, {
    spawn: (command, args, options) => {
      const key = `${cwd}\u0000${args.at(-1)}`;
      if (!executions.has(key)) executions.set(key, spawn(command, args, options));
      return executions.get(key);
    },
  });
}

export function checkActiveBindings(rows, cwd, { check = checkTestBinding, spawn = spawnSync } = {}) {
  if (!Array.isArray(rows)) return failed('DISCOVERY_TEST_BINDING_STATIC_INVALID', 'requirements must be an array');
  const active = rows.filter((row) => row?.status === 'active');
  const names = new Set();
  for (const row of active) {
    if (names.has(row.test_name)) return failed('DISCOVERY_TEST_BINDING_DUPLICATE', `test_name is shared by active requirements: ${row.test_name}`);
    names.add(row.test_name);
  }
  const cachedCheck = createCachedBindingCheck(check, spawn);
  for (const row of active) {
    const result = cachedCheck(row, cwd);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function defaultReadInventory(runtimeRoot) {
  return JSON.parse(readFileSync(resolve(runtimeRoot, 'contracts/discovery-requirements.json'), 'utf8'));
}

export function main(args = process.argv.slice(2), cwd = '.', dependencies = {}, write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  try {
    const runtimeRoot = dependencies.runtimeRoot ?? RUNTIME_ROOT;
    const inventory = (dependencies.readInventory ?? defaultReadInventory)(runtimeRoot);
    const result = checkActiveBindings(inventory.requirements, runtimeRoot, { check: dependencies.check ?? checkTestBinding });
    if (!result.ok) {
      writeError(`REJECTED: ${result.code}: ${result.message}`);
      return 1;
    }
    const activeCount = inventory.requirements.filter((row) => row.status === 'active').length;
    write(`OK: ${activeCount} active Discovery test binding(s) pass now.`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: DISCOVERY_TEST_BINDING_STATIC_INVALID: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-test-bindings.mjs')) {
  process.exitCode = main();
}
