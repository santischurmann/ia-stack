#!/usr/bin/env node
// verify-lessons.mjs — el archivo de lecciones (`.ia-stack/LECCIONES.md`) tiene el formato corto.
//
// Usage:
//   node scripts/verify-lessons.mjs check <LECCIONES.md>
//
// Formato: una lección por bloque, con encabezado anclado `## DD-MM-AAAA · escalada|retrabajo` y los
// campos `Síntoma:`, `Causa:`, `Archivo:`, `Cómo evitarlo:`, una sola vez cada uno. El bloque lo
// delimita el encabezado `## `, nunca una línea en blanco ni `---`. El valor de un campo termina en el
// próximo campo o encabezado, así que un campo vacío no se llena con el texto del siguiente.
// Exit 0 ok (o VACÍO si no hay archivo), 1 rechazado, 2 uso incorrecto.
//
// LÍMITE HONESTO: verifica forma, fecha real y no futura, y que cada campo tenga contenido. NO verifica
// que la causa declarada sea la causa real ni que la lección sirva. Eso es revisión humana.
import { readFileSync } from 'node:fs';
import { fechaAR } from './estado.mjs';
import { safeProjectFile } from './ratchet.mjs';

export const USAGE = 'usage: verify-lessons.mjs check <LECCIONES.md>';
export const EMPTY = 'VACÍO';
export const LIMITS = 'LÍMITES DECLARADOS';
export const LIMITS_TEXT = `${LIMITS}: verifica forma, fecha real y que cada campo tenga contenido. NO verifica que la causa declarada sea la causa real ni que la lección sirva.`;

export const FIELDS = Object.freeze(['Síntoma', 'Causa', 'Archivo', 'Cómo evitarlo']);
export const TIPOS = Object.freeze(['escalada', 'retrabajo']);
const MIN = 12;
const FILLER = new Set(['tbd', 'n/a', 'na', '-', '—', '?', 'pendiente', 'none', 'ver arriba', 'idem', 'ninguno']);
const HEADING = /^## (\d{2})-(\d{2})-(\d{4}) · (escalada|retrabajo)$/u;
const FIELD_LINE = /^(Síntoma|Causa|Archivo|Cómo evitarlo):(.*)$/u;

// Los invisibles (formato, espacios raros) cuentan como contenido si no se sacan antes de medir.
const normalize = (raw) => raw.replace(/\p{Cf}/gu, '').replace(/\p{Zs}/gu, ' ').trim();
const hasSubstance = (v) => /[\p{Ll}\p{Lu}\p{Lt}\p{N}]/u.test(v);

/** DD-MM-AAAA a milisegundos UTC, o null si no es una fecha real. */
export function realDate(dd, mm, aaaa) {
  const t = Date.UTC(Number(aaaa), Number(mm) - 1, Number(dd));
  const d = new Date(t);
  return d.getUTCDate() === Number(dd) && d.getUTCMonth() === Number(mm) - 1 && d.getUTCFullYear() === Number(aaaa) ? t : null;
}

/** Bloques por encabezado `## ` anclado: `{ heading, line, lines }`. Lo previo al primero es prosa. */
export function parseBlocks(source) {
  const bloques = [];
  source.replace(/\r\n?/gu, '\n').split('\n').forEach((texto, i) => {
    if (texto.startsWith('## ')) bloques.push({ heading: texto.trimEnd(), line: i + 1, lines: [] });
    else bloques.at(-1)?.lines.push(texto);
  });
  return bloques;
}

/** Campo → lista de valores (uno por aparición); las líneas sueltas continúan el campo anterior. */
export function parseFields(bloque) {
  const campos = new Map();
  let actual = null;
  for (const texto of bloque.lines) {
    const m = FIELD_LINE.exec(texto);
    if (m) {
      actual = { value: m[2] };
      if (!campos.has(m[1])) campos.set(m[1], []);
      campos.get(m[1]).push(actual);
    } else if (actual) {
      actual.value += ` ${texto}`;
    }
  }
  for (const lista of campos.values()) for (const c of lista) c.value = normalize(c.value).replace(/\s+/gu, ' ');
  return campos;
}

/** Violaciones (lista de textos, vacía si pasa). Nunca lanza. */
export function validateLessons(source, { today } = {}) {
  const v = [];
  const [td, tm, ta] = (today ?? '').split('-');
  const tope = today === undefined ? null : realDate(td, tm, ta);
  for (const bloque of parseBlocks(source)) {
    const donde = `línea ${bloque.line}`;
    const h = HEADING.exec(bloque.heading);
    if (!h) {
      v.push(`${donde}: encabezado mal formado «${bloque.heading}» (esperado: ## DD-MM-AAAA · escalada|retrabajo)`);
      continue;
    }
    const fecha = realDate(h[1], h[2], h[3]);
    if (fecha === null) v.push(`${donde}: la fecha ${h[1]}-${h[2]}-${h[3]} no existe`);
    else if (tope !== null && fecha > tope) v.push(`${donde}: fecha en el futuro (${h[1]}-${h[2]}-${h[3]}): no hay lección aprendida mañana`);
    const campos = parseFields(bloque);
    for (const nombre of FIELDS) {
      const apariciones = campos.get(nombre) ?? [];
      if (apariciones.length === 0) {
        v.push(`${donde}: falta el campo ${nombre}`);
        continue;
      }
      if (apariciones.length > 1) {
        v.push(`${donde}: el campo ${nombre} aparece más de una vez`);
        continue;
      }
      const valor = apariciones[0].value;
      const minimo = nombre === 'Archivo' ? 1 : MIN;
      if (valor === '') v.push(`${donde}: el campo ${nombre} está vacío`);
      else if (!hasSubstance(valor) || FILLER.has(valor.toLowerCase()) || /^<.+>$/u.test(valor)) v.push(`${donde}: el campo ${nombre} no dice nada («${valor}»)`);
      else if (valor.length < minimo) v.push(`${donde}: el campo ${nombre} es demasiado corto (${valor.length} < ${minimo})`);
    }
  }
  return v;
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
  let archivo;
  try {
    archivo = (options.safePath ?? safeProjectFile)(options.root ?? process.cwd(), path);
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  const vacio = () => {
    // Un proyecto sin lecciones no incumple nada; se dice VACÍO y no OK: no se verificó nada.
    write(`${EMPTY}: no hay ningún archivo de lecciones en ${path}. Esto no verificó nada.`);
    write(LIMITS_TEXT);
    return 0;
  };
  if (archivo === null) return vacio();
  let source;
  try {
    source = read(archivo, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return vacio();
    writeError(`REJECTED: no se pudo leer ${path}: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  const violations = validateLessons(source, { today: options.today ?? hoy() });
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  write(`OK: ${path} declara ${parseBlocks(source).length} lección(es) con sus ${FIELDS.length} campos.`);
  write(LIMITS_TEXT);
  return 0;
}

const hoy = () => fechaAR().split(' ')[0];

if (process.argv[1] && process.argv[1].endsWith('verify-lessons.mjs')) {
  process.exitCode = main();
}
