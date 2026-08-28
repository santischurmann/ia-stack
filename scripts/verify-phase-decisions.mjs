#!/usr/bin/env node
// La herida: VCP exige desde su LAW 7 que cada fase cierre con un menú 🔵 —opciones explícitas,
// recomendación, y la persona elige— y **nada lo verificaba**. Una fase podía cerrarse sin haber
// mostrado el menú, con una opción que no estaba en la lista, o editando las opciones después de
// que la persona eligió, y ningún gate se enteraba. Es exactamente el tipo de regla decorativa que
// el propio protocolo dice combatir: una regla sin detector se olvida en la primera sesión bajo
// presión de contexto (SKILL.md § "Al evolucionar este propio protocolo", punto 1).
//
// El encadenado NO se inventa acá: `chainHashFor` se importa de verify-audit-chain.mjs, que ya fija
// el criterio del repo —sha256(cadena anterior + LF + contenido)— y es la misma regla que hace que
// editar una línea vieja invalide esa línea y todas las que siguen (SKILL.md § "Redacción
// reutilizable": una solución que ya existe se reusa citándola). Lo que entra a la preimagen son los
// nueve campos de contenido, `options` y `selected_option` incluidos: si el menú quedara afuera,
// agregar después la opción que se eligió —el ataque principal contra este gate— pasaría en verde.
//
// LÍMITE HONESTO: este gate demuestra que una decisión quedó registrada de forma coherente. No
// demuestra que la persona realmente haya querido esa opción ni que haya comprendido sus
// consecuencias. Un agente puede registrar decisiones que nadie tomó —menú, recomendación, elección
// y justificación inventados de punta a punta— y el gate las acepta: sella la forma del registro,
// nunca el acto de decidir. Reproducido con el CLI real contra este mismo archivo.
//
// Lo que tampoco detecta, todo reproducido atacando el gate con el CLI real:
//  - recortar las últimas decisiones deja una cadena más corta que sigue verificando (truncado);
//  - la ÚLTIMA decisión es la cabeza de la cadena y nada la sigue, así que editar su menú o su
//    elección y volver a sellarla pasa en verde — justo la decisión de la fase vigente;
//  - quien tenga acceso al disco puede recalcular la cadena entera sobre contenido falso, incluido
//    borrar una decisión `superseded` para que nadie vea que hubo otra antes;
//  - `phase_order` no está encadenado: agregar una fase futura al final es legítimo e indetectable
//    (insertarla en el medio, o sacar una que ya tiene decisión, sí se rechazan);
//  - una clave repetida en el JSON la resuelve `JSON.parse` quedándose con la última, así que el
//    sello cubre lo que el parser leyó, no necesariamente lo que un humano lee de arriba hacia abajo.
// Los tres primeros son los mismos de verify-audit-chain.mjs y exigen un ancla fuera del archivo.

import { readFileSync } from 'node:fs';
import { chainHashFor } from './verify-audit-chain.mjs';

export const USAGE = 'usage: verify-phase-decisions.mjs check <decisions.json> [--require-inputs]';
export const NO_INPUTS_CODE = 'PHASE_DECISION_NO_INPUTS';
export const EMPTY_PREFIX = 'VACÍO: ';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const SCHEMA = 'vcp.phase-decisions/1';
// `superseded` existe para que una decisión reemplazada no se borre: se marca y se registra la
// nueva, igual que hace el inventario de requisitos con `replaced`. Borrarla dejaría la cadena rota
// y, peor, el historial sin la decisión que se abandonó.
export const STATUSES = Object.freeze(['decided', 'superseded']);
// Un menú de una sola opción no es un menú: no hay nada que elegir y la elección no informa nada.
export const MIN_OPTIONS = 2;
// Piso de lectura. No prueba consentimiento -eso necesita un canal fuera de este proceso- pero si
// detecta el modo de falla concreto: un agente que fabrica el menu y la decision en el mismo
// aliento. Dos segundos es deliberadamente bajo: tiene que rechazar lo imposible, no lo apurado.
export const MIN_DELIBERATION_MS = 2000;
export const CONTENT_FIELDS = Object.freeze(['phase_id', 'phase_name', 'options', 'recommendation', 'selected_option', 'reason', 'shown_at', 'timestamp', 'input_hash', 'status']);

const DOCUMENT_KEYS = new Set(['schema', 'phase_order', 'decisions']);
const DECISION_KEYS = new Set([...CONTENT_FIELDS, 'previous_hash', 'current_hash']);
const SHA256 = /^[0-9a-f]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;

function violation(code, message) {
  return { code, message };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function hasExactKeys(value, allowed) {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

/** La unicidad se mide sobre el texto recortado, no sobre los bytes: encontrado atacando este
 * mismo gate con el CLI real, `['A) una spec', 'A) una spec ']` pasaba como menú de dos opciones
 * siendo una sola para cualquiera que lo lea. Un menú que sólo se distingue en espacios satisface
 * el mínimo sin ofrecer nada que elegir, que es exactamente la regla decorativa que este gate viene
 * a detectar. */
function isMenu(value) {
  return Array.isArray(value)
    && value.length >= MIN_OPTIONS
    && value.every(nonEmpty)
    && new Set(value.map((option) => option.trim())).size === value.length;
}

function isDigest(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function isTimestamp(value) {
  return nonEmpty(value) && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

/** Preimagen canónica de una decisión: los nueve campos de contenido en orden fijo, serializados
 * como pares para que el orden de las claves en el archivo no cambie el hash pero su contenido sí.
 * `previous_hash` queda afuera porque entra como semilla del encadenado, igual que en la traza de
 * auditoría; `current_hash` queda afuera porque es el resultado. */
export function decisionPayload(decision) {
  return JSON.stringify(CONTENT_FIELDS.map((field) => [field, decision[field]]));
}

export function hashDecision(previousHash, decision) {
  return chainHashFor(previousHash, decisionPayload(decision));
}

export function checkDocument(document) {
  if (!isObject(document) || !hasExactKeys(document, DOCUMENT_KEYS)) {
    return [violation('PHASE_DECISION_SCHEMA_INVALID', `el archivo debe declarar exactamente ${[...DOCUMENT_KEYS].join(', ')}`)];
  }
  if (document.schema !== SCHEMA) {
    return [violation('PHASE_DECISION_SCHEMA_INVALID', `el archivo debe declarar schema ${SCHEMA}`)];
  }
  // El orden de fases lo declara el propio archivo, nunca una lista fija acá: VCP usa fases -1, 0,
  // 0.5, 1... y un proyecto consumidor puede tener otras. El gate verifica coherencia contra lo
  // declarado, no coincidencia con una lista suya.
  if (!Array.isArray(document.phase_order) || document.phase_order.length === 0
    || !document.phase_order.every(nonEmpty) || new Set(document.phase_order).size !== document.phase_order.length) {
    return [violation('PHASE_DECISION_SCHEMA_INVALID', 'phase_order debe ser una lista no vacía de identificadores de fase únicos y no vacíos')];
  }
  if (!Array.isArray(document.decisions)) {
    return [violation('PHASE_DECISION_SCHEMA_INVALID', 'decisions debe ser una lista')];
  }
  return [];
}

function checkRow(decision, position, phaseOrder) {
  const at = `decisión #${position + 1}`;
  if (!isObject(decision) || !hasExactKeys(decision, DECISION_KEYS)) {
    return [violation('PHASE_DECISION_SCHEMA_INVALID', `${at}: debe declarar exactamente ${[...DECISION_KEYS].join(', ')}`)];
  }
  const violations = [];
  if (!nonEmpty(decision.phase_id) || !nonEmpty(decision.phase_name)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: phase_id y phase_name son obligatorios y no pueden estar vacíos`));
  } else if (!phaseOrder.includes(decision.phase_id)) {
    violations.push(violation('PHASE_DECISION_PHASE_UNKNOWN', `${at}: la fase ${decision.phase_id} (${decision.phase_name}) no está declarada en phase_order`));
  }
  if (!isMenu(decision.options)) {
    violations.push(violation('PHASE_DECISION_MENU_INVALID', `${at}: options debe ser el menú que se mostró — al menos ${MIN_OPTIONS} opciones distintas y no vacías`));
  } else {
    if (!nonEmpty(decision.recommendation) || !decision.options.includes(decision.recommendation)) {
      violations.push(violation('PHASE_DECISION_RECOMMENDATION_MISSING', `${at}: falta la recomendación explícita, o recomienda algo que no estaba en el menú: ${JSON.stringify(decision.recommendation)}`));
    }
    if (!nonEmpty(decision.selected_option)) {
      violations.push(violation('PHASE_DECISION_NOT_CLOSED', `${at}: la fase ${decision.phase_id} no registra ninguna elección; ninguna fase cierra sin una elección registrada`));
    } else if (!decision.options.includes(decision.selected_option)) {
      violations.push(violation('PHASE_DECISION_OPTION_UNKNOWN', `${at}: la opción elegida no está en el menú que se mostró: ${decision.selected_option}`));
    }
  }
  if (!nonEmpty(decision.reason)) {
    violations.push(violation('PHASE_DECISION_REASON_MISSING', `${at}: falta la justificación de por qué se eligió esa opción`));
  }
  if (!STATUSES.includes(decision.status)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: status debe ser uno de ${STATUSES.join(', ')}`));
  }
  if (!isTimestamp(decision.shown_at)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: shown_at debe ser una marca ISO-8601 real — es cuándo se le mostró el menú a la persona`));
  }
  if (isTimestamp(decision.shown_at) && isTimestamp(decision.timestamp)) {
    // Elegir antes de que el menú exista es imposible, no rápido: un delta negativo cae acá también.
    const delta = Date.parse(decision.timestamp) - Date.parse(decision.shown_at);
    if (delta < MIN_DELIBERATION_MS) {
      violations.push(violation('PHASE_DECISION_TOO_FAST', `${at}: entre mostrar el menú y registrar la elección pasaron ${delta} ms, y el piso es ${MIN_DELIBERATION_MS}: nadie leyó ese menú`));
    }
  }
  if (!isTimestamp(decision.timestamp)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: timestamp debe ser una marca ISO-8601 real`));
  }
  if (!isDigest(decision.input_hash)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: input_hash debe ser un sha256 en 64 hex minúsculas`));
  }
  if (decision.previous_hash !== '' && !isDigest(decision.previous_hash)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: previous_hash debe ser un sha256, o "" en la primera decisión`));
  }
  if (!isDigest(decision.current_hash)) {
    violations.push(violation('PHASE_DECISION_FIELD_INVALID', `${at}: current_hash debe ser un sha256 en 64 hex minúsculas`));
  }
  return violations;
}

function checkSequence(decisions, phaseOrder) {
  const violations = [];
  const names = new Map();
  const opened = new Set();
  let cursor = -1;
  let current = null;
  for (const [position, decision] of decisions.entries()) {
    const index = phaseOrder.indexOf(decision.phase_id);
    if (decision.phase_id !== current) {
      if (opened.has(decision.phase_id)) {
        violations.push(violation('PHASE_DECISION_OUT_OF_ORDER', `decisión #${position + 1}: la fase ${decision.phase_id} (${decision.phase_name}) se reabre después de haber pasado a otra fase`));
      } else if (index < cursor) {
        violations.push(violation('PHASE_DECISION_OUT_OF_ORDER', `decisión #${position + 1}: la fase ${decision.phase_id} (${decision.phase_name}) cierra después de una fase que phase_order declara posterior`));
      }
      opened.add(decision.phase_id);
      current = decision.phase_id;
      cursor = index;
    }
    const known = names.get(decision.phase_id);
    if (known !== undefined && known !== decision.phase_name) {
      violations.push(violation('PHASE_DECISION_PHASE_NAME_INCONSISTENT', `decisión #${position + 1}: la fase ${decision.phase_id} ya se había registrado como "${known}" y ahora aparece como "${decision.phase_name}"`));
    }
    names.set(decision.phase_id, decision.phase_name);
  }

  const live = new Map();
  const last = new Map();
  for (const decision of decisions) {
    last.set(decision.phase_id, decision);
    if (decision.status !== 'decided') continue;
    live.set(decision.phase_id, (live.get(decision.phase_id) ?? 0) + 1);
  }
  for (const [phaseId, count] of live) {
    if (count === 1) continue;
    violations.push(violation('PHASE_DECISION_DUPLICATE', `la fase ${phaseId} registra ${count} decisiones vigentes: una decisión reemplazada se marca superseded, no se deja como decided al lado de la nueva`));
  }
  for (const [phaseId, decision] of last) {
    if (decision.status === 'decided') continue;
    violations.push(violation('PHASE_DECISION_NOT_CLOSED', `la fase ${phaseId} (${decision.phase_name}) termina en una decisión ${decision.status} y ninguna la reemplaza: ninguna fase cierra sin una elección registrada`));
  }

  // Una fase omitida sólo es detectable contra lo que el archivo declara: si ya se registró una
  // decisión de una fase posterior, toda fase anterior de phase_order tenía que haber pasado.
  const touched = new Set(decisions.map((decision) => decision.phase_id));
  const furthest = decisions.reduce((max, decision) => Math.max(max, phaseOrder.indexOf(decision.phase_id)), -1);
  for (let index = 0; index < furthest; index += 1) {
    if (touched.has(phaseOrder[index])) continue;
    const closed = decisions.find((decision) => phaseOrder.indexOf(decision.phase_id) === furthest);
    violations.push(violation('PHASE_DECISION_PHASE_SKIPPED', `la fase ${phaseOrder[index]} no registra ninguna decisión y la fase ${closed.phase_id} (${closed.phase_name}) ya cerró`));
  }

  for (let index = 1; index < decisions.length; index += 1) {
    if (Date.parse(decisions[index].timestamp) >= Date.parse(decisions[index - 1].timestamp)) continue;
    violations.push(violation('PHASE_DECISION_OUT_OF_ORDER', `decisión #${index + 1}: su timestamp ${decisions[index].timestamp} es anterior al de la decisión #${index}`));
  }
  return violations;
}

/** Se frena en el primer eslabón roto a propósito: desde ahí toda cabeza de cadena posterior es
 * derivada de un valor que ya no se puede confiar, y seguir listando produce ruido, no hallazgos. */
function checkChain(decisions) {
  let previous = '';
  for (const [position, decision] of decisions.entries()) {
    if (decision.previous_hash !== previous) {
      return [violation('PHASE_DECISION_CHAIN_BROKEN', `decisión #${position + 1}: previous_hash no es el current_hash de la decisión anterior — se borró, se insertó o se reordenó una decisión`)];
    }
    if (decision.current_hash !== hashDecision(previous, decision)) {
      return [violation('PHASE_DECISION_HASH_MISMATCH', `decisión #${position + 1}: current_hash no se corresponde con su contenido — el menú, la elección, la recomendación o la justificación se editaron después de registrarla`)];
    }
    previous = decision.current_hash;
  }
  return [];
}

export function checkDecisions(document) {
  const structural = checkDocument(document);
  if (structural.length > 0) return { ok: false, violations: structural, summary: '' };
  const decisions = document.decisions;
  // Las etapas están escalonadas: sin filas bien formadas no tiene sentido hablar de orden ni de
  // hashes, y una fila a medio declarar produciría rechazos derivados que tapan la causa real.
  const rows = decisions.flatMap((decision, position) => checkRow(decision, position, document.phase_order));
  if (rows.length > 0) return { ok: false, violations: rows, summary: '' };
  const violations = [...checkSequence(decisions, document.phase_order), ...checkChain(decisions)];
  const phases = new Set(decisions.map((decision) => decision.phase_id));
  return {
    ok: violations.length === 0,
    violations,
    summary: `registra ${decisions.length} decisión(es) encadenadas sobre ${phases.size} fase(s), cada una con su menú, su recomendación, la opción elegida y por qué.`,
  };
}

export function readDecisions(path, readFile) {
  try {
    return { content: readFile(path, 'utf8'), missing: false, error: null };
  } catch (error) {
    // Decisión explícita: un proyecto que no arrancó ninguna fase no incumple nada. Cualquier otro
    // fallo de lectura es el gate sin poder mirar, y eso sí es un rechazo.
    if (error.code === 'ENOENT') return { content: null, missing: true, error: null };
    return { content: null, missing: false, error: `no se puede leer ${path}: ${error.message}` };
  }
}

export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  const rest = requireInputs ? args.slice(0, -1) : args;
  if (rest.length !== 2 || rest[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const path = rest[1];
  const { content, missing, error } = readDecisions(path, options.readFile ?? readFileSync);
  if (error !== null) {
    writeError(`REJECTED: PHASE_DECISION_UNREADABLE: ${error}`);
    return 1;
  }
  if (missing) {
    // Mismo criterio que verify-evidence-trace y verify-session-state: no haber comparado nada no
    // se escribe como haber comparado y pasado. Sigue saliendo 0 salvo que se exija la entrada.
    const message = `no hay ${path}: un proyecto que todavía no cerró ninguna fase no incumple nada.`;
    if (requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${message}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${message}`);
    return 0;
  }
  let document;
  try {
    document = JSON.parse(content);
  } catch (failure) {
    writeError(`REJECTED: PHASE_DECISION_SCHEMA_INVALID: ${path} no se puede leer como JSON: ${failure.message}`);
    return 1;
  }
  const result = checkDecisions(document);
  if (!result.ok) {
    for (const item of result.violations) writeError(`REJECTED: ${item.code}: ${item.message}`);
    return 1;
  }
  write(`OK: ${path} ${result.summary}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-phase-decisions.mjs')) {
  process.exitCode = main();
}
