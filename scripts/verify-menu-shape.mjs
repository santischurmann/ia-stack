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
// suelta `A)` sin lista, o cualquier opcion dentro de un fence, se rechazan por nombre. Unica
// salida: un bloque precedido por el comentario `<!-- menu-shape: ejemplo -->` se saltea, para que
// el protocolo pueda citar el anti-patron y explicarlo. Vale para UN bloque y el comentario tiene
// que estar solo al principio de la linea; el gate NO juzga si lo marcado es de verdad un ejemplo.
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
// El mismo emoji al principio de linea pero SIN negrita: es el formato viejo, y no reconocerlo
// hacia que esos menus no existieran para el gate. Encontrado sobre el SKILL.md real.
const LOOSE_HEADING = /^🔵 /u;
// La letra va adentro del item: `- **A)** texto`. Una lista ordenada nativa borraria el token.
const OPTION = /^\s*[-*] \*\*[A-Z]\)\*\*\s/u;
// La forma que colapsa: la letra al principio de linea, sin item de lista.
const BARE = /^\s*[A-Z]\)\s/u;
// Solo h1-h3 cierran un menu. Un `####` es contenido adentro del bloque -- una leccion sobre el
// propio formato empieza justamente asi -- y cortar ahi acusaba tres carencias que el menu no tenia.
const SECTION = /^#{1,3}\s/u;
// Cuatro espacios de indentacion convierten la linea en bloque de codigo en Markdown: la opcion
// deja de ser un item de lista y colapsa igual que dentro de un fence.
const INDENTED_OPTION = /^ {4,}[-*] \*\*[A-Z]\)\*\*\s/u;
// Una pregunta dentro de un menú de varias: `**1. ¿Cuánto detalle?**`. Las letras reinician acá.
const QUESTION = /^\*\*\d+\./u;
// El texto de una opción de plantilla: `[opción]`, `<tema>`. No es contenido, es un hueco a llenar.
const PLACEHOLDER = /^[[<].*[\]>]$/u;
const FENCE = /^\s*(```|~~~)/u;
export const RECOMMENDATION = '*(recomendado';
/**
 * La linea que dice que la fase esta bloqueada, en las formas en que se escribe de verdad. Era un
 * substring exacto y sensible a mayusculas, asi que "Quedo esperando tu respuesta" se rechazaba
 * por la e minuscula -- obligada por estar a mitad de frase.
 */
export const CLOSER_RE = /\b(esperando|espero|espera de)\s+(tu|su)\s+(respuesta|decisi[óo]n)/iu;
export const CLOSER = 'Esperando tu respuesta';

const newlines = (source) => source.replace(/\r\n?/gu, '\n');
// Una cita markdown no cambia lo que el bloque ES, solo como se muestra: un menu citado sigue
// siendo un menu, y antes desaparecia del barrido entero.
const unquote = (line) => line.replace(/^(\s*>)+\s?/u, '');
// Marca explicita de ejemplo: el bloque que sigue se cita para ensenarlo, no es una decision.
// Tiene que ser el comentario solo, al principio de la linea: la prosa que habla de la marca la
// nombra entre backticks, y con un `includes` suelto ese parrafo apagaba el menu siguiente. Lo
// agarro CONTR-2 sobre el SKILL.md real, no un caso de laboratorio.
const EXAMPLE_MARK = /^<!--\s*menu-shape:\s*ejemplo/u;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

/** Las lineas con su estado de fence: una opcion adentro de un fence no es una opcion. */
function scan(source) {
  const lines = newlines(source).split('\n');
  const out = [];
  let fence = false;
  let comment = false;
  for (const [index, raw] of lines.entries()) {
    const text = unquote(raw);
    if (!fence && text.includes(COMMENT_OPEN)) comment = true;
    const dentroDelComentario = comment;
    if (comment && text.includes(COMMENT_CLOSE)) comment = false;
    if (FENCE.test(text)) {
      out.push({ line: index + 1, text, fence: true, delimiter: true, comment: dentroDelComentario });
      fence = !fence;
      continue;
    }
    out.push({ line: index + 1, text, fence, delimiter: false, comment: dentroDelComentario });
  }
  // Un fence sin cerrar se traga todo lo que sigue: el gate contaba menos menus y salia verde.
  return { rows: out, unclosedFence: fence };
}

/**
 * Los bloques de menu. El bloque CIERRA en su linea de espera: cortar en el proximo encabezado
 * haria que la prosa posterior -- que puede tener lineas `A)` legitimas -- entre al bloque y
 * produzca un rojo falso.
 */
export function parseMenus(source) {
  const { rows } = scan(source);
  const menus = [];
  let ejemplo = false;
  for (const [index, row] of rows.entries()) {
    if (EXAMPLE_MARK.test(row.text.trim())) {
      ejemplo = true;
      continue;
    }
    if (row.delimiter) continue;
    // LOOSE_HEADING alcanza: matchea todo `🔵 ` al principio de linea, con negrita o sin ella.
    if (ejemplo && LOOSE_HEADING.test(row.text)) {
      // Vale para UN bloque: si no, una marca suelta arriba del archivo apagaría el gate entero.
      ejemplo = false;
      continue;
    }
    // Un `🔵` al principio de línea SIN negrita es el formato viejo, y el gate ni siquiera lo veía
    // como menú: encontrado sobre el SKILL.md real, dos menús de PHASE 1 escritos así. Se registra
    // igual, para acusarlo por nombre en vez de dejarlo pasar por no reconocerlo.
    if (LOOSE_HEADING.test(row.text) && !HEADING.test(row.text)) {
      menus.push({ line: row.line, title: row.text.trim(), body: [], closed: true, hidden: null, loose: true });
      continue;
    }
    if (!HEADING.test(row.text)) continue;
    if (row.fence || row.comment) {
      // No se descarta: un menu escondido es el verde mas peligroso, porque el gate contaba menos
      // menus y decia OK. Se registra con su motivo para que el bloque se acuse por nombre.
      menus.push({ line: row.line, title: row.text.trim(), body: [], closed: true, hidden: row.fence ? 'un bloque de código' : 'un comentario HTML' });
      continue;
    }
    const body = [];
    let closed = false;
    for (let j = index + 1; j < rows.length; j += 1) {
      const next = rows[j];
      if (!next.fence && !next.delimiter && (HEADING.test(next.text) || SECTION.test(next.text))) break;
      body.push(next);
      if (!next.fence && CLOSER_RE.test(next.text)) {
        closed = true;
        break;
      }
    }
    menus.push({ line: row.line, title: row.text.trim(), body, closed, hidden: null });
  }
  return menus;
}

/** Todas las violaciones, sin lanzar nunca. */
export function validateMenus(source) {
  const violations = [];
  if (scan(source).unclosedFence) {
    violations.push('hay un bloque de código sin cerrar: todo lo que viene después queda escondido del barrido, así que un menú roto ahí abajo no se vería');
  }
  for (const menu of parseMenus(source)) {
    const donde = `línea ${menu.line} (${menu.title.slice(0, 48)})`;
    if (menu.loose === true) {
      violations.push(`${donde}: el título del menú no está en negrita (\`🔵 **título**\`), así que el barrido no lo reconoce como menú y todo lo que sigue queda sin verificar`);
      continue;
    }
    if (menu.hidden !== null) {
      violations.push(`${donde}: el menú está adentro de ${menu.hidden}, así que no se le muestra a nadie`);
      continue;
    }
    const opciones = menu.body.filter((row) => !row.fence && OPTION.test(row.text) && !INDENTED_OPTION.test(row.text));
    const indentadas = menu.body.filter((row) => !row.fence && INDENTED_OPTION.test(row.text));
    if (indentadas.length > 0) {
      violations.push(`${donde}: ${indentadas.length} opción(es) indentadas cuatro espacios o más (línea ${indentadas[0].line}): Markdown las lee como bloque de código y colapsan igual que dentro de un fence`);
    }
    const enFence = menu.body.filter((row) => row.fence && !row.delimiter && BARE.test(row.text));
    const sueltas = menu.body.filter((row) => !row.fence && BARE.test(row.text) && !OPTION.test(row.text));
    if (enFence.length > 0) {
      violations.push(`${donde}: ${enFence.length} opción(es) dentro de un bloque de código (línea ${enFence[0].line}): un fence renderiza como caja de código y sus líneas colapsan a un solo párrafo`);
    }
    // Una linea suelta `A)` solo se acusa cuando el menu no tiene opciones de verdad: si no, una
    // nota legitima que nombra sus propias letras -- "A) y B) publican; C) no" -- tumbaba el
    // documento entero. Reproducido sobre el SKILL.md real.
    if (sueltas.length > 0 && opciones.length < 2) {
      violations.push(`${donde}: la opción de la línea ${sueltas[0].line} no es un ítem de lista: escribila como \`- **A)** texto\`, que es el único formato que se separa en opciones`);
    }
    // Las letras se comparan DENTRO de cada pregunta, no en todo el menú: un CONFIG de dos
    // preguntas reinicia en A) legítimamente, y compararlas juntas rechazaba los menús reales de
    // Spec, Plan y Build. Una pregunta empieza en una línea `**N. ¿...?**`.
    let letras = new Map();
    let textos = new Map();
    for (const fila of menu.body) {
      if (fila.fence) continue;
      if (QUESTION.test(fila.text)) {
        letras = new Map();
        textos = new Map();
        continue;
      }
      if (!OPTION.test(fila.text)) continue;
      const letra = fila.text.match(/\*\*([A-Z])\)\*\*/u)[1];
      const texto = fila.text.replace(OPTION, '').replace(/—\s*\*\(recomendado[^)]*\)\*/u, '').trim().toLowerCase();
      if (letras.has(letra)) violations.push(`${donde}: la letra ${letra}) aparece dos veces en la misma pregunta (líneas ${letras.get(letra)} y ${fila.line}): la persona contesta con la letra, y con dos iguales no hay respuesta posible`);
      letras.set(letra, fila.line);
      // Un placeholder no es una opción repetida: las plantillas canónicas escriben `[opción]` dos
      // veces a propósito, y compararlas como texto rechazaba las plantillas del propio protocolo.
      if (texto === '') {
        violations.push(`${donde}: la opción ${letra}) de la línea ${fila.line} no dice nada: una letra sin texto no es una opción`);
      }
      if (texto !== '' && !PLACEHOLDER.test(texto) && textos.has(texto)) {
        violations.push(`${donde}: las opciones de las líneas ${textos.get(texto)} y ${fila.line} dicen lo mismo: eso no es una elección`);
      }
      textos.set(texto, fila.line);
    }
    if (opciones.length < 2) {
      violations.push(`${donde}: tiene ${opciones.length} opción(es) y un menú necesita al menos dos opciones`);
    }
    if (!menu.body.some((row) => !row.fence && row.text.includes(RECOMMENDATION))) {
      violations.push(`${donde}: ninguna opción lleva la marca de recomendación \`${RECOMMENDATION})*\`, que LAW 7 exige explícita`);
    }
    if (!menu.closed) {
      violations.push(`${donde}: no termina en una línea de espera («${CLOSER}…» o equivalente), así que no dice que la fase está bloqueada`);
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
