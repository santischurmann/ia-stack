#!/usr/bin/env node
// verify-lessons.mjs — el archivo donde se registra como no repetir un error, verificado.
//
// EL PROBLEMA QUE RESUELVE. `.vibe/LESSONS.md` era el unico artefacto del protocolo que ningun
// gate miraba: se escribia a mano y se confiaba en que estuviera bien. Medido sobre el archivo
// real, un gate ingenuo que parte el texto por `---` produce UN solo bloque con las ocho lecciones
// adentro -- el archivo solo tiene dos `---`, y delimitan la plantilla, no las lecciones-- asi que
// sale verde aunque se borre un campo entero. Un archivo de memoria que nadie comprueba deja de
// ser memoria y pasa a ser decoracion.
//
// COMO. La frontera de bloque es el encabezado anclado `## `, nunca `---` ni una linea en blanco.
// El valor de un campo termina en el PROXIMO marcador, no al final del bloque: si no, un campo
// vacio se llena con el texto del siguiente y cualquier medida de longitud mide texto ajeno. La
// plantilla se identifica por CONTENIDO -- su encabezado lleva la fecha literal YYYY-MM-DD -- y
// nunca por numero de linea, y sus propios valores son la lista negra de relleno: un campo que
// repite el placeholder no dice nada. Las marcas `[overlaps with: LESSON-N]` tienen que resolver
// contra los numeros de este mismo archivo, y el barrido se cuenta dos veces por caminos
// independientes para que un regex degradado no se lea como cero referencias rotas.
//
// LIMITE HONESTO. Verifica FORMA, unicidad de identificadores y resolucion de referencias
// internas. NO verifica que la causa raiz declarada sea la causa real ni que se distinga del
// sintoma, ni que la senal de deteccion detecte algo, ni que la leccion sirva para algo. Eso es
// revision humana. El gate imprime ese limite en verde y en rojo, para que un verde no se lea
// como mas de lo que es.
import { readFileSync } from 'node:fs';
import { safeProjectFile } from './ratchet.mjs';

export const USAGE = 'usage: verify-lessons.mjs check <lessons.md>';
export const EMPTY = 'VACÍO';
export const LIMITS = 'LÍMITES DECLARADOS';
export const LIMITS_TEXT = `${LIMITS}: verifica forma, unicidad de identificadores y resolución de referencias internas. NO verifica que la causa raíz declarada sea la causa real, ni que se distinga del síntoma, ni que la señal de detección detecte algo. Un verde acá no es evidencia de que la lección sirva.`;

/** Los seis campos que el propio archivo declara obligatorios en su plantilla. */
export const FIELDS = Object.freeze(['Project/phase/run', 'What happened', 'Why (root cause)', 'How to avoid', 'Detection signal', 'Confidence']);
const PROSE = new Set(FIELDS.filter((name) => name !== 'Confidence'));
const MIN_PROSE = 12;
// El conjunto NO se deriva de lo que usan las lecciones de hoy -- todas `active` --: derivarlo
// dejaria `retired` en rojo. La fuente es el encabezado del archivo: "retire-not-delete (nunca se
// borra, solo `status: retired`)".
export const STATUS = new Set(['active', 'retired']);
export const CONFIDENCE = new Set(['high', 'medium', 'low']);
// La primera leccion registrada del proyecto. Una fecha anterior no es un error de tipeo posible:
// es una entrada copiada de otro lado o una fecha inventada.
const FLOOR = '2026-08-28';
const PLACEHOLDER_DATE = 'YYYY-MM-DD';
const FILLER = new Set(['tbd', 'n/a', 'na', '-', '—', '?', 'pendiente', 'none', 'ver arriba', 'idem', 'ninguno']);

const HEADING = /^## /u;
const HEADING_FULL = /^## \[([^\]]*)\] LESSON-(\d+) (.+?) — status: (.*)$/u;
const MARKER = /^\*\*([^*]+?):\*\*/u;
const PLACEHOLDER = /^<.+>$/u;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Espacios que no se ven pero cuentan como contenido si no se normalizan antes de medir. */
const normalize = (raw) => raw.replace(/\r/gu, '').replace(/[ ​-‍﻿]/gu, ' ').trim();
const newlines = (source) => source.replace(/\r\n?/gu, '\n');

/**
 * Bloques por encabezado anclado. Nunca por `---`: el archivo real no separa lecciones con `---`,
 * y un gate que lo cree valida un mega-bloque que contiene todos los marcadores.
 */
export function parseBlocks(source) {
  const lines = newlines(source).split('\n');
  const starts = [];
  for (const [index, line] of lines.entries()) if (HEADING.test(line)) starts.push(index);
  return starts.map((start, k) => ({
    line: start + 1,
    heading: lines[start],
    body: lines.slice(start + 1, k + 1 < starts.length ? starts[k + 1] : lines.length),
  }));
}

/**
 * Los campos de un bloque. El valor termina en el PROXIMO marcador, no al final del bloque: cortar
 * hasta el final hace que un campo vacio se coma el texto del siguiente y deje de estar vacio.
 */
export function parseFields(block) {
  const found = new Map();
  for (const [index, line] of block.body.entries()) {
    const match = MARKER.exec(line);
    if (!match) continue;
    const parts = [line.slice(match[0].length)];
    for (let j = index + 1; j < block.body.length; j += 1) {
      if (MARKER.test(block.body[j]) || HEADING.test(block.body[j])) break;
      parts.push(block.body[j]);
    }
    if (!found.has(match[1])) found.set(match[1], []);
    found.get(match[1]).push({ value: normalize(parts.join('\n')), line: block.line + 1 + index });
  }
  return found;
}

/** `\d{4}-\d{2}-\d{2}` acepta 2026-02-30, y `new Date` la rueda a marzo en vez de rechazarla. */
export function realDate(value) {
  const match = ISO.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

/** Cuenta un substring con indexOf: un camino que no puede degradarse como un regex. */
function countLiteral(text, needle) {
  let total = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) total += 1;
  return total;
}

/** Todas las violaciones, sin lanzar nunca: un archivo roto se informa como archivo roto. */
export const countAnchored = (text) => (text.match(/^## /gmu) ?? []).length;

export function validateLessons(source, options = {}) {
  const text = newlines(source);
  const blocks = parseBlocks(text);
  // Dos conteos por caminos independientes. Si difieren, el reconocedor de encabezados se degradó
  // y todo lo que sigue estaría midiendo bloques que no son los del archivo.
  const anchored = (options.countAnchored ?? countAnchored)(text);
  if (blocks.length !== anchored) {
    return [`el barrido de encabezados no cierra: ${blocks.length} por línea contra ${anchored} por patrón`];
  }
  if (blocks.length < 2) {
    return ['el archivo debe traer la plantilla y al menos una lección: sin plantilla no hay contra qué comparar el relleno'];
  }

  const violations = [];
  const parsed = [];
  for (const block of blocks) {
    const match = HEADING_FULL.exec(block.heading);
    if (!match) {
      violations.push(`línea ${block.line}: encabezado mal formado, se espera "## [fecha] LESSON-<n> <título> — status: <estado>"`);
      continue;
    }
    parsed.push({ block, date: match[1], number: Number(match[2]), title: match[3], status: match[4], fields: parseFields(block) });
  }
  if (violations.length > 0) return violations;

  const templates = parsed.filter((entry) => entry.date === PLACEHOLDER_DATE);
  if (templates.length !== 1) {
    violations.push(`el archivo debe traer exactamente una plantilla (encabezado con ${PLACEHOLDER_DATE}) y trae ${templates.length}`);
    return violations;
  }
  if (templates[0] !== parsed[0]) {
    violations.push(`la plantilla debe ser el primer encabezado del archivo: lo que quede antes (línea ${parsed[0].block.line}) no lo mira nadie`);
    return violations;
  }
  const template = templates[0];
  const lessons = parsed.slice(1);

  // Los valores de la plantilla SON los placeholders, así que se leen del archivo en vez de fijarse
  // acá: si la plantilla cambia, la lista negra cambia con ella y no queda desactualizada en
  // silencio.
  const placeholders = new Set();
  for (const entries of template.fields.values()) for (const entry of entries) placeholders.add(entry.value.toLowerCase());

  for (const entry of [template, ...lessons]) {
    const esPlantilla = entry === template;
    const nombre = esPlantilla ? 'la plantilla' : `LESSON-${entry.number}`;
    for (const field of FIELDS) {
      const entries = entry.fields.get(field) ?? [];
      if (entries.length === 0) {
        violations.push(`${nombre} (línea ${entry.block.line}) no declara **${field}:**`);
        continue;
      }
      if (entries.length > 1) {
        violations.push(`${nombre} declara **${field}:** ${entries.length} veces (líneas ${entries.map((e) => e.line).join(', ')}): un campo contado sobre el archivo entero no ve esto`);
        continue;
      }
      const { value } = entries[0];
      if (value === '') {
        violations.push(`${nombre}: **${field}:** está vacío. El marcador presente no es el campo escrito`);
        continue;
      }
      if (esPlantilla) continue;
      if (placeholders.has(value.toLowerCase())) {
        violations.push(`${nombre}: **${field}:** repite el texto de la plantilla, así que no dice nada`);
        continue;
      }
      if (PLACEHOLDER.test(value) || FILLER.has(value.toLowerCase())) {
        violations.push(`${nombre}: **${field}:** es relleno (${JSON.stringify(value)}), no contenido`);
        continue;
      }
      if (PROSE.has(field) && value.length < MIN_PROSE) {
        violations.push(`${nombre}: **${field}:** tiene ${value.length} caracteres, menos que el mínimo de ${MIN_PROSE}`);
      }
      if (field === 'Confidence' && !CONFIDENCE.has(value)) {
        violations.push(`${nombre}: **Confidence:** debe ser una de ${[...CONFIDENCE].join(', ')}, no ${JSON.stringify(value)}`);
      }
    }
  }

  const numbers = new Set();
  for (const entry of lessons) {
    if (numbers.has(entry.number)) {
      violations.push(`LESSON-${entry.number} aparece más de una vez (línea ${entry.block.line}): con el número repetido, una marca de dedup deja de resolver a una sola lección`);
    }
    numbers.add(entry.number);
    if (!realDate(entry.date)) {
      violations.push(`LESSON-${entry.number}: ${JSON.stringify(entry.date)} no es una fecha real`);
    } else if (entry.date < FLOOR) {
      violations.push(`LESSON-${entry.number}: la fecha ${entry.date} es anterior a la primera lección del proyecto (${FLOOR})`);
    }
    if (!STATUS.has(entry.status)) {
      violations.push(`LESSON-${entry.number}: status ${JSON.stringify(entry.status)} no es uno de ${[...STATUS].join(', ')}`);
    }
  }

  for (const entry of lessons) {
    const cuerpo = entry.block.body.join('\n');
    for (const [, cited] of cuerpo.matchAll(/\[overlaps with: LESSON-(\d+)\]/gu)) {
      const numero = Number(cited);
      if (numero === entry.number) {
        violations.push(`LESSON-${entry.number} se cita a sí misma: una nota de dedup contra uno mismo no dedupea nada`);
      } else if (!numbers.has(numero)) {
        violations.push(`LESSON-${entry.number} cita LESSON-${numero}, que este archivo no declara`);
      }
    }
  }
  return violations;
}

/** El resumen que va en el verde. Cuenta las marcas por dos caminos: uno solo puede degradarse. */
export function summarize(source) {
  const text = newlines(source);
  const lessons = parseBlocks(text).length - 1;
  const parsed = [...text.matchAll(/\[overlaps with: LESSON-(\d+)\]/gu)].length;
  const literal = countLiteral(text, 'overlaps with');
  return { lessons, marks: parsed, degraded: parsed !== literal, literal };
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
  // La ruta se resuelve ANTES de abrirla (regla #46: la lectura no se reimplementa).
  const resolver = options.safePath ?? safeProjectFile;
  let archivo;
  try {
    archivo = resolver(options.root ?? process.cwd(), path);
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  if (archivo === null) {
    // Un proyecto que todavia no registro lecciones no incumple nada. Se dice VACIO y no OK: no
    // haber comparado nada no se escribe igual que haber verificado algo.
    write(`${EMPTY}: no hay ningún archivo de lecciones en ${path}. Esto no verificó nada.`);
    write(LIMITS_TEXT);
    return 0;
  }
  let source;
  try {
    source = read(archivo, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ningún archivo de lecciones en ${path}. Esto no verificó nada.`);
      write(LIMITS_TEXT);
      return 0;
    }
    writeError(`REJECTED: no se pudo leer ${path}: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }

  const resumen = (options.summarize ?? summarize)(source);
  const violations = validateLessons(source);
  if (resumen.degraded) {
    violations.push(`el barrido de marcas de dedup no cierra: ${resumen.marks} por patrón contra ${resumen.literal} por texto literal. Cero marcas encontradas por un patrón roto se leería como cero referencias rotas`);
  }
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  write(`OK: ${path} declara ${resumen.lessons} lección(es) con sus ${FIELDS.length} campos, y ${resumen.marks} marca(s) de dedup que resuelven contra este mismo archivo.`);
  write(LIMITS_TEXT);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-lessons.mjs')) {
  process.exitCode = main();
}
