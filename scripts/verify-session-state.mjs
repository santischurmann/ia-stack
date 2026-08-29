#!/usr/bin/env node
// Tres heridas del mismo día, todas sobre lo que queda escrito cuando algo se corta o falla.
// La cuota se agotó a mitad de la primera corrida real de este protocolo y el trabajo quedó donde
// estaba: `SESSION.md` no decía en qué fase, en qué tarea ni qué faltaba, así que retomar costó
// reconstruirlo leyendo el diff. El gate de límites honestos rechazó dos veces seguidas la misma
// frase y nada obligaba a frenar en el tercero. Y un `git fetch origin/main` que dio timeout no
// dejó ningún registro: un fallo silencioso se lee igual que un éxito.
//
// Este gate NO ejecuta red, NO mide cuota y NO pone presupuestos ni topes por fase — decisión del
// 2026-08-28: un tope mal calibrado frena trabajo legítimo y no hay datos históricos para
// calibrarlo. Verifica que lo que la sesión declaró sea coherente y retomable, nada más.
//
// LÍMITE HONESTO: verifica que lo declarado sea coherente, no que sea verdad. Una sesión que miente
// en su propio archivo pasa el gate, y una que no declara nada también — el silencio compra verde,
// no un rechazo. Sólo puede hablar de las tres secciones opcionales: un éxito afirmado en la prosa
// del resto del archivo le es invisible.
//
// La lectura NO se reimplementa (regla #46): usa `safeProjectFile` de ratchet.mjs, que ya fija el
// criterio del repo —nada fuera del proyecto, ningún symlink, ningún archivo que no sea regular— y
// devuelve `null` cuando el archivo no existe, que acá es exactamente el verde de un proyecto que
// todavía no arrancó. Por eso el rechazo por path inseguro conserva la redacción de ratchet.

import { readFileSync, realpathSync } from 'node:fs';
import { safeProjectFile } from './ratchet.mjs';

export const USAGE = 'usage: verify-session-state.mjs check --session <SESSION.md> [--require-inputs]';
export const NO_INPUTS_CODE = 'SESSION_STATE_NO_INPUTS';
export const EMPTY_PREFIX = 'VACÍO: ';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const ATTEMPT_LIMIT = 3;
export const SECTION_ATTEMPTS = 'Intentos fallidos';
export const SECTION_INTERRUPTED = 'Interrumpido en';
export const SECTION_UNVERIFIED = 'No verificado';
export const RESUME_FIELDS = ['Fase', 'Tarea', 'Falta'];
export const UNVERIFIED_MARK = 'no verificado';

const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/u;
const PROBLEM = /^###[ \t]+(.+?)[ \t]*$/u;
const BULLET = /^[ \t]*[-*+][ \t]+(.*)$/u;
const ATTEMPT = /^intento[ \t]+(\d+)[ \t]*:[ \t]*(.*)$/iu;
const DECISION = /^decisión humana[ \t]*:[ \t]*(.*)$/iu;
const FIELD = /^([^:]+?)[ \t]*:[ \t]*(.*)$/u;
const OUTCOME = /[ \t]*(?:→|->)[ \t]*/u;
const REASON_LEAD = /^[\s:—–-]+/u;
const TRAILING_LABEL = /[\s:]+$/u;
// `templates/vibe/SESSION.md` documenta las tres secciones con un ejemplo de cada una, y esa
// plantilla se copia tal cual a cada proyecto nuevo. Sin esto, todo proyecto arrancaría declarando
// una interrupción y unos intentos que nunca ocurrieron: un bloque comentado no es estado.
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

/** El énfasis Markdown es decoración del lector; el parseo no puede depender de dónde se puso. */
function stripEmphasis(text) {
  return text.replaceAll('**', '').replaceAll('`', '');
}

export function sectionLines(source, title) {
  const collected = [];
  let inside = false;
  for (const line of source.replace(HTML_COMMENT, '').split(/\r?\n/u)) {
    const heading = line.match(HEADING);
    if (heading && heading[1].length <= 2) {
      inside = heading[1].length === 2 && heading[2].toLowerCase() === title.toLowerCase();
      continue;
    }
    if (inside) collected.push(line);
  }
  return collected;
}

function hasSection(source, title) {
  return source.replace(HTML_COMMENT, '').split(/\r?\n/u).some((line) => {
    const heading = line.match(HEADING);
    return heading !== null && heading[1].length === 2 && heading[2].toLowerCase() === title.toLowerCase();
  });
}

export function parseAttempts(lines) {
  const problems = [];
  const errors = [];
  for (const line of lines) {
    const heading = line.match(PROBLEM);
    if (heading) {
      problems.push({ problem: heading[1], attempts: [], decision: null });
      continue;
    }
    const bullet = line.match(BULLET);
    if (!bullet) continue;
    const text = stripEmphasis(bullet[1]).trim();
    const current = problems.at(-1);
    if (!current) {
      errors.push(`"${text}" está fuera de todo problema: cada problema abre con "### <problema>".`);
      continue;
    }
    const attempt = text.match(ATTEMPT);
    if (attempt) {
      const expected = current.attempts.length + 1;
      if (Number(attempt[1]) !== expected) {
        errors.push(`"${current.problem}": después de ${current.attempts.length} intento(s) viene el intento ${expected}, no el ${attempt[1]}. La numeración corrida es la que hace contable el tope.`);
        continue;
      }
      const [tried, ...rest] = attempt[2].split(OUTCOME);
      const failed = rest.join(' ').trim();
      if (tried.trim() === '' || failed === '') {
        errors.push(`"${current.problem}", intento ${expected}: la forma es "- intento ${expected}: <qué se probó> → <por qué falló>". Sin las dos mitades, frenar no puede mostrar qué se probó ni por qué falló.`);
        continue;
      }
      current.attempts.push({ number: expected, tried: tried.trim(), failed });
      continue;
    }
    const decision = text.match(DECISION);
    if (decision) {
      if (decision[1].trim() === '') {
        errors.push(`"${current.problem}": la decisión humana está declarada vacía.`);
        continue;
      }
      if (current.decision !== null) {
        errors.push(`"${current.problem}": declara la decisión humana dos veces y no hay forma de saber cuál rige.`);
        continue;
      }
      current.decision = decision[1].trim();
      continue;
    }
    errors.push(`"${current.problem}": la viñeta "${text}" no dice nada de lo que el formato pide — "- intento <n>: ... → ..." o "- decisión humana: ...".`);
  }
  return { problems, errors };
}

function checkAttempts(lines) {
  const { problems, errors } = parseAttempts(lines);
  const violations = errors.map((message) => ({ code: 'SESSION_STATE_ATTEMPT_MALFORMED', message }));
  for (const problem of problems) {
    if (problem.decision !== null || problem.attempts.length < ATTEMPT_LIMIT) continue;
    const detail = problem.attempts.map((attempt) => `intento ${attempt.number}: ${attempt.tried} → ${attempt.failed}`).join('; ');
    violations.push({
      code: 'SESSION_STATE_ATTEMPT_LIMIT',
      message: `"${problem.problem}" acumula ${problem.attempts.length} intento(s) fallido(s) sin decisión humana registrada: ${detail}. El protocolo frena en el ${ATTEMPT_LIMIT}.º y consulta; la respuesta se anota con "- decisión humana: ...".`,
    });
  }
  return { violations, problems: problems.length };
}

function checkInterruption(lines) {
  const declared = new Map();
  for (const line of lines) {
    const bullet = line.match(BULLET);
    if (!bullet) continue;
    const field = stripEmphasis(bullet[1]).trim().match(FIELD);
    if (!field) continue;
    const label = RESUME_FIELDS.find((name) => name.toLowerCase() === field[1].trim().toLowerCase());
    if (!label) continue;
    declared.set(label, [...(declared.get(label) ?? []), field[2].trim()]);
  }
  const violations = [];
  const twice = RESUME_FIELDS.filter((name) => (declared.get(name) ?? []).length > 1);
  if (twice.length > 0) {
    violations.push({
      code: 'SESSION_STATE_RESUME_POINT_AMBIGUOUS',
      message: `"## ${SECTION_INTERRUPTED}" declara dos veces: ${twice.join(', ')}. Un punto de retome con dos valores no es un punto de retome.`,
    });
  }
  const missing = RESUME_FIELDS.filter((name) => !(declared.get(name) ?? []).some((value) => value !== ''));
  if (missing.length > 0) {
    violations.push({
      code: 'SESSION_STATE_RESUME_POINT_INCOMPLETE',
      message: `la sesión declara que se interrumpió pero no dice dónde retomar: sin ${missing.join(', ')}. Cada campo va como "- <campo>: <valor>" dentro de "## ${SECTION_INTERRUPTED}".`,
    });
  }
  return violations;
}

function checkUnverified(lines) {
  const violations = [];
  let declared = 0;
  for (const line of lines) {
    const bullet = line.match(BULLET);
    if (!bullet) continue;
    const text = stripEmphasis(bullet[1]).trim();
    if (text === '') continue;
    const mark = text.toLowerCase().indexOf(UNVERIFIED_MARK);
    if (mark === -1) {
      violations.push({
        code: 'SESSION_STATE_VERIFICATION_CLAIMED',
        message: `"${text}" no lleva la marca "${UNVERIFIED_MARK}": dentro de "## ${SECTION_UNVERIFIED}" una entrada sin la marca se lee como comprobación realizada, y acá no hay evidencia que la respalde.`,
      });
      continue;
    }
    const subject = text.slice(0, mark).replace(TRAILING_LABEL, '').trim();
    const reason = text.slice(mark + UNVERIFIED_MARK.length).replace(REASON_LEAD, '').trim();
    if (subject === '' || reason === '') {
      violations.push({
        code: 'SESSION_STATE_VERIFICATION_UNEXPLAINED',
        message: `"${text}": falta ${subject === '' ? 'decir qué verificación quedó sin hacer' : 'el motivo por el que no se pudo hacer'}. La forma es "- <qué verificación>: ${UNVERIFIED_MARK} — <motivo>".`,
      });
      continue;
    }
    declared += 1;
  }
  return { violations, declared };
}

export function checkSessionState(projectRoot, sessionPath) {
  let source;
  try {
    const file = safeProjectFile(realpathSync(projectRoot), sessionPath);
    if (file === null) {
      return { ok: true, vacuous: true, violations: [], summary: `no hay ${sessionPath}: un proyecto que todavía no arrancó no tiene estado que retomar.` };
    }
    source = readFileSync(file, 'utf8');
  } catch (error) {
    return { ok: false, summary: '', violations: [{ code: 'SESSION_STATE_UNREADABLE', message: `no se puede leer ${sessionPath} como archivo del proyecto: ${error.message}` }] };
  }
  // Un archivo sin contenido no es estado declarado: `touch` convertia el VACIO en un OK que decia
  // "es retomable". Reproducido el 2026-08-28 atacando este gate.
  if (source.trim() === '') {
    return { ok: true, vacuous: true, violations: [], summary: `${sessionPath} está vacío: un archivo sin una sola sección no declara ningún estado que retomar.` };
  }
  const attempts = checkAttempts(sectionLines(source, SECTION_ATTEMPTS));
  const interrupted = hasSection(source, SECTION_INTERRUPTED);
  const resume = interrupted ? checkInterruption(sectionLines(source, SECTION_INTERRUPTED)) : [];
  const unverified = checkUnverified(sectionLines(source, SECTION_UNVERIFIED));
  const violations = [...attempts.violations, ...resume, ...unverified.violations];
  return {
    ok: violations.length === 0,
    violations,
    summary: `${sessionPath} es retomable: ${attempts.problems} problema(s) con intentos declarados, ${interrupted ? 'punto de retome completo' : 'sin interrupción declarada'}, ${unverified.declared} verificación(es) declaradas como no verificadas.`,
  };
}

export function parseArgs(args) {
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  const rest = requireInputs ? args.slice(0, -1) : args;
  if (rest.length === 3 && rest[0] === 'check' && rest[1] === '--session' && rest[2] !== '' && !rest[2].startsWith('--')) {
    return { session: rest[2], requireInputs };
  }
  return null;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, check = checkSessionState) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const result = check(cwd, parsed.session);
  if (!result.ok) {
    for (const violation of result.violations) writeError(`REJECTED: ${violation.code}: ${violation.message}`);
    return 1;
  }
  // Mismo criterio que verify-evidence-trace: el silencio se escribe como silencio. Una sesión sin
  // archivo de estado no es una sesión revisada, y con --require-inputs deja de pasar por tal.
  if (result.vacuous) {
    if (parsed.requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${result.summary}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${result.summary}`);
    return 0;
  }
  write(`OK: ${result.summary}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-session-state.mjs')) {
  process.exitCode = main();
}
