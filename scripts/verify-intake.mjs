#!/usr/bin/env node
// verify-intake.mjs — la primera pregunta del protocolo, hecha archivo.
//
// EL PROBLEMA QUE RESUELVE. El protocolo no preguntaba que se queria construir. Bootstrap pregunta
// el stack y el nivel de rigor; Research ya asume que hay un producto definido. Entre las dos no
// habia nada que capturara objetivo, usuario, problema, resultado esperado ni restricciones, asi
// que un ciclo arrancaba sobre lo que el agente supuso -- y el supuesto no quedaba escrito en
// ningun lado, de modo que nadie podia señalarlo despues.
//
// QUE COMPRUEBA. Que las ocho respuestas esten y sean respuestas. Que los supuestos, los riesgos y
// las preguntas abiertas vivan en listas propias, con id unico, y no mezclados en la prosa de una
// respuesta. Y que una pregunta declarada bloqueante detenga el ciclo: una decision obligatoria
// pendiente no se pasa por alto por descuido.
//
// LIMITE HONESTO. Comprueba FORMA, nunca verdad. No sabe si una respuesta es correcta, ni si es
// suficiente, ni si alguien la contesto de verdad: un intake coherente e inventado pasa igual. Y no
// puede ver un supuesto escondido adentro del texto de una respuesta en vez de declarado aparte,
// que es la manera mas facil de esquivarlo. El minimo de largo por respuesta no distingue una
// respuesta real de relleno del mismo largo: descarta el vacio y la palabra suelta, nada mas.
import { readFileSync } from 'node:fs';

export const SCHEMA = 'vcp.intake/1';
export const USAGE = 'usage: verify-intake.mjs check <intake.json>';
export const EMPTY = 'VACÍO';

/** Las ocho preguntas. El orden es el de la conversacion real, no alfabetico. */
export const ANSWER_KEYS = Object.freeze([
  'que_construir',
  'para_quien',
  'que_problema',
  'resultado_operativo',
  'restricciones',
  'fuentes_aportadas',
  'artefacto_visual',
  'alcance',
]);

/** Piso de largo. No mide calidad: descarta el vacio y la palabra suelta. */
export const MIN_ANSWER = 20;

const LISTS = Object.freeze([
  { key: 'supuestos', singular: 'supuesto' },
  { key: 'riesgos', singular: 'riesgo' },
  { key: 'preguntas_abiertas', singular: 'pregunta abierta' },
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const longEnough = (value) => typeof value === 'string' && value.trim().length >= MIN_ANSWER;

/**
 * Todas las violaciones, sin lanzar nunca. Un gate que se salva por una excepcion no comprobo nada:
 * el que la lee no distingue "esto esta mal" de "el gate se rompio mirandolo".
 */
export function validateIntake(intake) {
  if (!isObject(intake)) return [`el intake debe ser un objeto JSON que declare ${SCHEMA}`];
  // El esquema se mira primero y corta: enumerar campos de un archivo que no es un intake produce
  // una lista de reproches sobre algo que nunca pretendio serlo.
  if (intake.schema !== SCHEMA) return [`el intake debe declarar ${SCHEMA}, no ${JSON.stringify(intake.schema)}`];

  const violations = [];
  // `feature` es un slug corto, no una respuesta: se le pide que exista, no que sea larga.
  if (typeof intake.feature !== 'string' || intake.feature.trim() === '') {
    violations.push('feature debe nombrar la funcionalidad en curso');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(intake.date ?? '')) violations.push('date debe ser una fecha AAAA-MM-DD');

  if (!isObject(intake.answers)) {
    violations.push('answers debe ser un objeto con las ocho respuestas');
  } else {
    for (const key of ANSWER_KEYS) {
      const value = intake.answers[key];
      if (value === undefined) violations.push(`falta la respuesta ${key}`);
      else if (typeof value !== 'string' || value.trim() === '') violations.push(`la respuesta ${key} está vacía`);
      else if (!longEnough(value)) violations.push(`la respuesta ${key} tiene menos de ${MIN_ANSWER} caracteres: no es una respuesta`);
    }
    for (const key of Object.keys(intake.answers)) {
      if (!ANSWER_KEYS.includes(key)) violations.push(`answers trae ${key}, que no es una de las ocho preguntas`);
    }
  }

  for (const { key, singular } of LISTS) {
    const list = intake[key];
    if (!Array.isArray(list)) {
      violations.push(`${key} debe ser una lista propia: un ${singular} escrito adentro de una respuesta no se puede señalar despues`);
      continue;
    }
    const seen = new Set();
    for (const [index, entry] of list.entries()) {
      const label = `${key}[${index}]`;
      if (!isObject(entry)) { violations.push(`${label} debe ser un objeto con id y texto`); continue; }
      if (typeof entry.id !== 'string' || entry.id.trim() === '') violations.push(`${label} no declara un id`);
      else if (seen.has(entry.id)) violations.push(`${key} repite el id ${entry.id}`);
      else seen.add(entry.id);
      if (!longEnough(entry.texto)) violations.push(`${label} no dice nada: el texto tiene menos de ${MIN_ANSWER} caracteres`);
      if (key === 'preguntas_abiertas' && typeof entry.bloqueante !== 'boolean') {
        violations.push(`${label} debe declarar si es bloqueante`);
      }
    }
  }

  if (!longEnough(intake.exito)) violations.push('exito debe declarar cómo se va a saber que esto sirvió');

  const bloqueantes = (Array.isArray(intake.preguntas_abiertas) ? intake.preguntas_abiertas : [])
    .filter((entry) => isObject(entry) && entry.bloqueante === true && typeof entry.id === 'string' && entry.id.trim() !== '');
  for (const entry of bloqueantes) {
    violations.push(`${entry.id} está declarada bloqueante y sin contestar: el ciclo no avanza con una decisión obligatoria pendiente`);
  }

  return violations;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const read = options.read ?? readFileSync;
  if (args.length !== 2 || args[0] !== 'check' || args[1] === '') {
    writeError(USAGE);
    return 2;
  }
  const path = args[1];

  let raw;
  try {
    raw = read(path, 'utf8');
  } catch (error) {
    // Un proyecto que todavia no arranco no incumple nada. Se dice VACIO y no OK: no comparar nada
    // no se escribe igual que verificar algo.
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ningún intake en ${path}. Un proyecto que todavía no arrancó no incumple nada, y esto no verificó nada.`);
      return 0;
    }
    writeError(`REJECTED: no se pudo leer ${path}: ${error.message}`);
    return 1;
  }

  let intake;
  try {
    intake = JSON.parse(raw);
  } catch (error) {
    writeError(`REJECTED: ${path} no es JSON válido: ${error.message}`);
    return 1;
  }

  const violations = validateIntake(intake);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    return 1;
  }

  const bloqueantes = intake.preguntas_abiertas.filter((entry) => entry.bloqueante === true).length;
  write(`OK: ${path} declara ${ANSWER_KEYS.length} respuesta(s), ${intake.supuestos.length} supuesto(s), ${intake.riesgos.length} riesgo(s), ${intake.preguntas_abiertas.length} pregunta(s) abierta(s), ${bloqueantes} bloqueante(s). Verifica forma, nunca verdad: un intake coherente e inventado pasa igual.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-intake.mjs')) {
  process.exitCode = main();
}
