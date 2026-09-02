#!/usr/bin/env node
// verify-research-candidates.mjs — el puente entre una señal lexical y una capacidad adoptada.
//
// EL PROBLEMA QUE RESUELVE. La sintesis del research externo agrupa 14.897 entradas por capacidad y
// las llama «señales de adopcion». Son filtros lexicales: un puntaje que cuenta cuantas palabras de
// una lista aparecen en un archivo. El informe lo declara, pero nada impedia que alguien tomara esa
// tabla y adoptara una idea porque salio con puntaje 22. No habia ningun artefacto entre la señal y
// la adopcion, asi que el salto no dejaba rastro y no habia donde escribir el contraejemplo.
//
// LA REGLA CENTRAL. Un puntaje no es una cita. La evidencia de un candidato tiene que apuntar a
// archivo y linea DEL ARCHIVO QUE EL CANDIDATO DECLARA, y el contraejemplo no puede ser la evidencia
// repetida: copiar la cita y llamarla contraejemplo es la manera mas facil de esquivar la regla.
//
// LIMITE HONESTO. Comprueba FORMA y procedencia. NO abre el archivo citado ni comprueba que la linea
// diga lo que el candidato afirma -- eso es reclonar el corpus, y este gate no sale a la red. No
// juzga si un contraejemplo es bueno, si un costo es realista ni si una decision es sensata. Y no
// adopta nada: la decision sigue siendo humana.
import { readFileSync } from 'node:fs';
import { safeProjectFile } from './ratchet.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const SCHEMA = 'vcp.research-candidates/1';
export const PINNED_PATH = join(repoRoot, 'contracts', 'research-citations.json');
export const USAGE = 'usage: verify-research-candidates.mjs check <candidates.json>';
export const EMPTY = 'VACÍO';
export const DECISIONS = new Set(['adopt', 'defer', 'reject']);

const KEYS = Object.freeze(['candidate_id', 'source', 'commit', 'file', 'line', 'function', 'problem',
  'evidence', 'counterexample', 'cost', 'risk', 'compatibility', 'decision', 'test_needed']);
const TEXT_KEYS = Object.freeze(['candidate_id', 'source', 'commit', 'file', 'function', 'problem',
  'counterexample', 'cost', 'risk', 'compatibility']);
const MIN_TEXT = 12;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const longEnough = (v) => typeof v === 'string' && v.trim().length >= MIN_TEXT;
const exactKeys = (v, keys) => isObject(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const normalize = (v) => String(v ?? '').trim().replace(/\s+/gu, ' ').toLowerCase();

/** Fuente -> commit pineado. Nunca lanza: un contrato roto devuelve un mapa vacio y el llamador decide. */
export function loadPinned(contract) {
  const pinned = new Map();
  if (!isObject(contract) || !Array.isArray(contract.sources)) return pinned;
  for (const source of contract.sources) {
    if (isObject(source) && nonEmpty(source.slug) && nonEmpty(source.commit)) pinned.set(source.slug, source.commit);
  }
  return pinned;
}

/** Todas las violaciones del expediente, sin lanzar nunca. */
export function validateCandidates(document, pinned) {
  if (!isObject(document)) return [`el expediente debe ser un objeto JSON que declare ${SCHEMA}`];
  if (document.schema !== SCHEMA) return [`el expediente debe declarar ${SCHEMA}, no ${JSON.stringify(document.schema)}`];
  const violations = [];
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(document.date ?? '')) violations.push('date debe ser una fecha AAAA-MM-DD');
  if (!Array.isArray(document.candidates) || document.candidates.length === 0) {
    violations.push('candidates debe traer al menos un candidato: un expediente vacío no propone nada');
    return violations;
  }
  const ids = new Set();
  document.candidates.forEach((candidate, index) => {
    const at = `candidates[${index}]`;
    if (!exactKeys(candidate, KEYS)) {
      violations.push(`${at} debe declarar exactamente ${KEYS.join(', ')}`);
      return;
    }
    for (const key of TEXT_KEYS) {
      if (!nonEmpty(candidate[key])) violations.push(`${at}.${key} no puede estar vacío`);
    }
    if (ids.has(candidate.candidate_id)) violations.push(`candidates repite el id ${candidate.candidate_id}`);
    ids.add(candidate.candidate_id);

    // Procedencia: la fuente tiene que ser una de las pineadas y el commit, el que se pineó para ella.
    // Sin esto, un candidato puede citar un repositorio que nadie leyó o un commit que nadie fijó.
    if (!pinned.has(candidate.source)) {
      violations.push(`${at}.source ${candidate.source} no es una de las fuentes pineadas del research`);
    } else if (candidate.commit !== pinned.get(candidate.source)) {
      violations.push(`${at}.commit ${candidate.commit} no es el commit pineado para ${candidate.source} (${pinned.get(candidate.source)})`);
    }

    if (!Number.isInteger(candidate.line) || candidate.line < 1) {
      violations.push(`${at}.line debe ser un número de línea entero y positivo`);
    }

    // Un puntaje lexical no es una cita: la evidencia apunta a archivo y linea del archivo declarado.
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
      violations.push(`${at}.evidence debe traer al menos una cita: un puntaje lexical no es evidencia`);
    } else {
      candidate.evidence.forEach((item, i) => {
        const evidenceAt = `${at}.evidence[${i}]`;
        if (!exactKeys(item, ['locator', 'quote'])) {
          violations.push(`${evidenceAt} debe declarar exactamente locator y quote`);
          return;
        }
        if (!longEnough(item.quote)) violations.push(`${evidenceAt}.quote no dice nada: una cita sin texto no es evidencia`);
        const esperado = new RegExp(`^${String(candidate.file).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}:\\d+$`, 'u');
        if (!esperado.test(String(item.locator))) {
          violations.push(`${evidenceAt}.locator debe ser ${candidate.file}:<línea>, no ${JSON.stringify(item.locator)}`);
        }
      });
    }

    // Copiar la evidencia y llamarla contraejemplo es la manera mas facil de esquivar la regla.
    if (longEnough(candidate.counterexample)) {
      const citas = (Array.isArray(candidate.evidence) ? candidate.evidence : [])
        .map((item) => normalize(isObject(item) ? item.quote : ''));
      if (citas.includes(normalize(candidate.counterexample))) {
        violations.push(`${at}.counterexample repite una de sus evidencias: repetir la cita no es un contraejemplo`);
      }
    } else if (nonEmpty(candidate.counterexample)) {
      violations.push(`${at}.counterexample es demasiado corto para ser un contraejemplo`);
    }

    if (!DECISIONS.has(candidate.decision)) {
      violations.push(`${at}.decision debe ser una de: ${[...DECISIONS].join(', ')}`);
    } else if (candidate.decision === 'adopt' && !nonEmpty(candidate.test_needed)) {
      violations.push(`${at} propone adoptar sin declarar el test necesario: adoptar sin condición de adopción`);
    }
  });
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

  let pinned;
  try {
    pinned = loadPinned(JSON.parse(read(PINNED_PATH, 'utf8')));
  } catch (error) {
    writeError(`REJECTED: no se pudo leer el contrato de fuentes pineadas: ${error.message}`);
    return 1;
  }
  if (pinned.size === 0) {
    writeError('REJECTED: el contrato de fuentes pineadas no declara ninguna fuente utilizable');
    return 1;
  }

  // La ruta se resuelve ANTES de abrirla: un enlace o un `..` no llegan al lector. La lectura no
  // se reimplementa (regla #46): safeProjectFile de ratchet.mjs ya fija el criterio del repo, y
  // devuelve null cuando el archivo no existe -- que acá es el verde de un proyecto que no arrancó.
  const resolverRuta = options.safePath ?? safeProjectFile;
  let archivo;
  try {
    archivo = resolverRuta(options.root ?? process.cwd(), path);
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  if (archivo === null) {
    write(`${EMPTY}: no hay ningún expediente de candidatos en ${path}. Esto no verificó nada.`);
    return 0;
  }
  let document;
  try {
    document = JSON.parse(read(archivo, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ningún expediente de candidatos en ${path}. Esto no verificó nada.`);
      return 0;
    }
    writeError(`REJECTED: ${path} no es JSON válido ni se pudo leer: ${error.message}`);
    return 1;
  }

  const violations = validateCandidates(document, pinned);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    return 1;
  }

  const cuenta = (valor) => document.candidates.filter((c) => c.decision === valor).length;
  write(`OK: ${path} declara ${document.candidates.length} candidato(s) contra ${pinned.size} fuente(s) pineadas: ${cuenta('adopt')} adopt, ${cuenta('defer')} defer, ${cuenta('reject')} reject. Verifica forma y procedencia, nunca que la línea citada diga lo que el candidato afirma.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-research-candidates.mjs')) {
  process.exitCode = main();
}
