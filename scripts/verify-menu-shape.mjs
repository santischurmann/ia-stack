#!/usr/bin/env node
// verify-menu-shape.mjs — que el menu de una decision llegue como opciones y no como parrafo.
//
// EL PROBLEMA QUE RESUELVE. LAW 7 exige que toda decision del protocolo se presente como multiple
// choice con recomendacion explicita. La plantilla canonica que SKILL.md prescribia lo escribia
// DENTRO de un bloque de codigo, con lineas sueltas `A)` / `B)`. Medido sobre motores de Markdown:
// esas lineas colapsan a UN solo parrafo, y un fence ademas renderiza como caja de codigo. O sea
// que el protocolo prescribia por escrito el unico formato que garantiza que el menu NO se vea
// como menu. Ningun gate se enteraba: verify-vcp-contract pasa 107 checks sin una sola regla de
// forma sobre los menus.
//
// COMO. Un menu arranca en una linea `🔵 **titulo**` y termina en su linea de espera. Entre las
// dos tiene que haber al menos dos opciones escritas como item de lista con la letra adentro
// -- `- **A)** texto` --, que es el unico formato que produce items separados tanto en CommonMark
// estricto como en GFM, y que conserva el token `A)` con el que la persona contesta (una lista
// ordenada nativa lo borraria). Al menos una opcion lleva la marca de recomendacion. Una linea
// suelta `A)` sin lista, o cualquier opcion dentro de un fence, se rechazan por nombre.
//
// LIMITE HONESTO. Verifica las PLANTILLAS que el protocolo prescribe en sus propios documentos.
// NO verifica el mensaje que el agente efectivamente escribio en la conversacion, ni como lo pinto
// la terminal, ni que la persona haya visto nada: no hay forma portable de comprobar eso. Tampoco
// juzga si las opciones son buenas ni si la recomendacion es la correcta.
import { readFileSync } from 'node:fs';
import { safeProjectFile } from './ratchet.mjs';

export const USAGE = 'usage: verify-menu-shape.mjs check <archivo.md>';
export const EMPTY = 'VACÍO';
export const LIMITS = 'LÍMITE';
export const LIMITS_TEXT = `${LIMITS}: verifica las plantillas de menú que el protocolo prescribe en sus documentos. NO verifica el mensaje que el agente escribió en la conversación, ni cómo lo pintó la terminal, ni que la persona lo haya visto. Nada verifica eso de forma portable.`;

const HEADING = /^🔵 \*\*/u;
// La letra va adentro del item: `- **A)** texto`. Una lista ordenada nativa borraria el token.
const OPTION = /^\s*[-*] \*\*[A-Z]\)\*\*\s/u;
// La forma que colapsa: la letra al principio de linea, sin item de lista.
const BARE = /^\s*[A-Z]\)\s/u;
const SECTION = /^#{1,6}\s/u;
const FENCE = /^\s*(```|~~~)/u;
export const RECOMMENDATION = '*(recomendado';
export const CLOSER = 'Esperando tu respuesta';

const newlines = (source) => source.replace(/\r\n?/gu, '\n');

/** Las lineas con su estado de fence: una opcion adentro de un fence no es una opcion. */
function scan(source) {
  const lines = newlines(source).split('\n');
  const out = [];
  let fence = false;
  for (const [index, text] of lines.entries()) {
    if (FENCE.test(text)) {
      out.push({ line: index + 1, text, fence: true, delimiter: true });
      fence = !fence;
      continue;
    }
    out.push({ line: index + 1, text, fence, delimiter: false });
  }
  return out;
}

/**
 * Los bloques de menu. El bloque CIERRA en su linea de espera: cortar en el proximo encabezado
 * haria que la prosa posterior -- que puede tener lineas `A)` legitimas -- entre al bloque y
 * produzca un rojo falso.
 */
export function parseMenus(source) {
  const rows = scan(source);
  const menus = [];
  for (const [index, row] of rows.entries()) {
    if (row.fence || row.delimiter || !HEADING.test(row.text)) continue;
    const body = [];
    let closed = false;
    for (let j = index + 1; j < rows.length; j += 1) {
      const next = rows[j];
      if (!next.fence && !next.delimiter && (HEADING.test(next.text) || SECTION.test(next.text))) break;
      body.push(next);
      if (!next.fence && next.text.includes(CLOSER)) {
        closed = true;
        break;
      }
    }
    menus.push({ line: row.line, title: row.text.trim(), body, closed });
  }
  return menus;
}

/** Todas las violaciones, sin lanzar nunca. */
export function validateMenus(source) {
  const violations = [];
  for (const menu of parseMenus(source)) {
    const donde = `línea ${menu.line} (${menu.title.slice(0, 48)})`;
    const opciones = menu.body.filter((row) => !row.fence && OPTION.test(row.text));
    const enFence = menu.body.filter((row) => row.fence && !row.delimiter && BARE.test(row.text));
    const sueltas = menu.body.filter((row) => !row.fence && BARE.test(row.text) && !OPTION.test(row.text));
    if (enFence.length > 0) {
      violations.push(`${donde}: ${enFence.length} opción(es) dentro de un bloque de código (línea ${enFence[0].line}): un fence renderiza como caja de código y sus líneas colapsan a un solo párrafo`);
    }
    if (sueltas.length > 0) {
      violations.push(`${donde}: la opción de la línea ${sueltas[0].line} no es un ítem de lista: escribila como \`- **A)** texto\`, que es el único formato que se separa en opciones`);
    }
    if (opciones.length < 2) {
      violations.push(`${donde}: tiene ${opciones.length} opción(es) y un menú necesita al menos dos opciones`);
    }
    if (!menu.body.some((row) => !row.fence && row.text.includes(RECOMMENDATION))) {
      violations.push(`${donde}: ninguna opción lleva la marca de recomendación \`${RECOMMENDATION})*\`, que LAW 7 exige explícita`);
    }
    if (!menu.closed) {
      violations.push(`${donde}: no termina en la línea de espera («${CLOSER}…»), así que no dice que la fase está bloqueada`);
    }
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
    write(`${EMPTY}: no hay ningún documento en ${path}. Esto no verificó nada.`);
    write(LIMITS_TEXT);
    return 0;
  }
  let source;
  try {
    source = read(archivo, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ningún documento en ${path}. Esto no verificó nada.`);
      write(LIMITS_TEXT);
      return 0;
    }
    writeError(`REJECTED: no se pudo leer ${path}: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }

  const violations = validateMenus(source);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  const total = parseMenus(source).length;
  write(`OK: ${path} declara ${total} menú(s) como lista con al menos dos opciones, recomendación explícita y línea de espera.`);
  write(LIMITS_TEXT);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-menu-shape.mjs')) {
  process.exitCode = main();
}
