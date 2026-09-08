#!/usr/bin/env node
// verify-assert-order.mjs — la aserción sobre el CONTENIDO de una respuesta que pasa porque la
// respuesta no existe.
//
// LA HERIDA, medida sobre un proyecto real en septiembre de 2026: un test afirmaba que ningún
// campo prohibido salía por un endpoint, y pasaba en verde porque el endpoint devolvía 404 y el
// cuerpo de un 404 tampoco trae esos campos. La prueba no probó nada, la cobertura la contó como
// ejercitada, y ningún gate lo vio.
//
// NO ES UN DEFECTO NUEVO: es el sexto miembro de la lista de «formas de aserción prohibidas» que
// SKILL.md ya tenía, al lado de «una aserción adentro de un bucle que puede dar cero vueltas: si
// la entrada viene vacía, pasa sin haber probado nada». Es la misma familia. Lo que cambia es que
// la lista entera era honor system —el propio documento decía «ninguna de estas falla
// mecánicamente»— y ésta es la primera que trae detector, que es lo que SKILL.md exige de toda
// regla nueva.
//
// LA REGLA, en una línea: toda aserción sobre el contenido de una respuesta tiene que estar
// precedida, en el mismo bloque de prueba, por una aserción sobre su estado.
//
// POR QUE SALE 0 SIEMPRE (modo aviso), y cuándo dejaría de hacerlo. Este repositorio ya midió qué
// pasa cuando un detector se publica sin medir su tasa de falsos: cinco diseños de reglas de
// seguridad dieron 43, 26, 6, 5 y 3 hallazgos, TODOS falsos, sin un solo verdadero positivo en 210
// archivos ni en 191 commits, y se eligió declarar el límite en vez de shipear un gate que grita
// en falso (docs/mejoras/2026-09-04.json). Un gate que grita en falso se ignora, y un gate
// ignorado no detecta nada. CRITERIO DE PROMOCION, escrito de antemano: pasa a rechazar sólo
// cuando una corrida sobre un corpus real dé cero falsos positivos, y ese número quede registrado.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - Es un barrido léxico, no un analizador de flujo: BARRER NO ES LEER. Un test que hace la
//     petición a través de una función auxiliar no muestra ninguna de las señales que esto busca,
//     y pasa sin que nadie lo mire.
//   - No entiende expresiones regulares literales: una llave dentro de un `/.../` desalinea el
//     recorte del bloque. Sí entiende cadenas y comentarios, que son el caso común.
//   - No sabe si la aserción de estado que encontró comprueba el estado correcto: un
//     `assert.ok(res.status)` la satisface y no verifica nada útil.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-assert-order.mjs check [<carpeta>]';
export const CARPETA = 'tests';
export const EMPTY_PREFIX = 'VACÍO: ';
export const AVISO_PREFIX = 'AVISO: ';

/** La guarda que evita el mar de falsos positivos: sin una petición a la vista, `data` y `body`
 * son nombres de variable como cualquier otro y marcarlos sería ruido puro. Sólo se mira adentro
 * de un bloque que efectivamente le habla a algo. */
export const SENAL_DE_PETICION = /\b(?:fetch|request|supertest|axios|got|undici|http)\b/u;
/** `.ok` va con punto delante a propósito: `assert.ok(` es la aserción misma, no una comprobación
 * de estado, y contarla haría que cualquier `assert.ok` sobre el cuerpo se rescatara sola. */
export const SOBRE_ESTADO = /\bstatus(?:Code|Text|Message)?\b|(?<!assert)(?<!expect)\.ok\b/u;
export const SOBRE_CONTENIDO = /\b(?:body|json|text|payload|data)\b/u;
/** De dónde sale el cuerpo de una respuesta. Lo que se le asigne a una variable acá pasa a contar
 * como contenido aunque la variable se llame `cuerpo`, `u` o cualquier otra cosa. Una lista de
 * nombres en inglés sólo encuentra lo que ya pensó quien la escribió, y el caso real que motivó
 * este gate la esquivaba con una variable en castellano. */
const FUENTE_DE_CUERPO = /\.(?:json|text)\s*\(|\.(?:body|data|payload)\b/u;
const DECLARACION = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/u;
const ASERCION = /\b(?:assert|expect)\b/u;
const LLAMADA_DE_PRUEBA = /\b(?:test|it)\s*\(/gu;
const ARCHIVO_DE_PRUEBA = /\.test\.[cm]?[jt]s$/u;
const TITULO = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/u;

/** Reemplaza el contenido de cadenas y comentarios por espacios, CONSERVANDO el largo y los saltos
 * de línea. Contar llaves sobre el texto crudo es lo que hace que un `'}'` adentro de una cadena
 * cierre un bloque que sigue abierto, y a partir de ahí todo lo que se mida está corrido. */
export function sinCadenasNiComentarios(texto) {
  const salida = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    const siguiente = texto[i + 1];
    if (c === '/' && siguiente === '/') {
      while (i < texto.length && texto[i] !== '\n') { salida.push(' '); i += 1; }
      continue;
    }
    if (c === '/' && siguiente === '*') {
      salida.push(' ', ' ');
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) {
        salida.push(texto[i] === '\n' ? '\n' : ' ');
        i += 1;
      }
      // Un comentario sin cerrar consume hasta el final en vez de colgar el barrido.
      if (i < texto.length) { salida.push(' ', ' '); i += 2; }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      salida.push(' ');
      i += 1;
      while (i < texto.length && texto[i] !== c) {
        if (texto[i] === '\\') { salida.push(' '); i += 1; }
        if (i < texto.length) { salida.push(texto[i] === '\n' ? '\n' : ' '); i += 1; }
      }
      if (i < texto.length) { salida.push(' '); i += 1; }
      continue;
    }
    salida.push(c);
    i += 1;
  }
  return salida.join('');
}

function lineaDe(texto, indice) {
  let n = 1;
  for (let i = 0; i < indice; i += 1) if (texto[i] === '\n') n += 1;
  return n;
}

/** Devuelve el índice del carácter que cierra el que abre en `desde`, o -1 si nunca cierra. */
function cierreDe(limpio, desde, abre, cierra) {
  let profundidad = 0;
  for (let i = desde; i < limpio.length; i += 1) {
    if (limpio[i] === abre) profundidad += 1;
    else if (limpio[i] === cierra) {
      profundidad -= 1;
      if (profundidad === 0) return i;
    }
  }
  return -1;
}

/** Cada `test()`/`it()` con su título, su cuerpo y la línea donde empieza. El recorte se calcula
 * sobre el texto sin cadenas ni comentarios; el cuerpo que se devuelve es el original, porque es
 * lo que después se le muestra a una persona como evidencia. */
export function bloquesDePrueba(texto) {
  const limpio = sinCadenasNiComentarios(texto);
  const bloques = [];
  LLAMADA_DE_PRUEBA.lastIndex = 0;
  let coincidencia;
  while ((coincidencia = LLAMADA_DE_PRUEBA.exec(limpio)) !== null) {
    const abreParen = coincidencia.index + coincidencia[0].length - 1;
    const cierraParen = cierreDe(limpio, abreParen, '(', ')');
    // Sin paréntesis que cierre no hay llamada completa: un archivo a medio escribir no inventa un
    // bloque. Se busca la llave SOLO adentro de la llamada, para no robarle el cuerpo al test
    // siguiente cuando éste no tiene ninguno.
    if (cierraParen === -1) continue;
    const abreLlave = limpio.indexOf('{', abreParen);
    if (abreLlave === -1 || abreLlave > cierraParen) continue;
    const cierraLlave = cierreDe(limpio, abreLlave, '{', '}');
    if (cierraLlave === -1) continue;
    const titulo = TITULO.exec(texto.slice(abreParen, abreLlave));
    bloques.push({
      titulo: titulo === null ? '' : titulo[2],
      cuerpo: texto.slice(abreLlave + 1, cierraLlave),
      cuerpoLimpio: limpio.slice(abreLlave + 1, cierraLlave),
      linea: lineaDe(limpio, coincidencia.index),
      lineaCuerpo: lineaDe(limpio, abreLlave),
    });
    LLAMADA_DE_PRUEBA.lastIndex = cierraLlave;
  }
  return bloques;
}

/** Una línea afirma sobre el cuerpo si lo nombra directamente o si nombra una variable que en
 * este mismo bloque salió de la respuesta. */
function esSobreElCuerpo(linea, rastreadas) {
  if (SOBRE_CONTENIDO.test(linea)) return true;
  return rastreadas.some((v) => new RegExp(String.raw`\b${v.replaceAll('$', String.raw`\$`)}\b`, 'u').test(linea));
}

/** Un hallazgo por bloque, no uno por línea: el defecto es del bloque —nadie comprobó el estado—,
 * y repetirlo en cada aserción convierte un problema en una lista. */
export function hallazgos(nombre, texto) {
  const encontrados = [];
  for (const bloque of bloquesDePrueba(texto)) {
    if (!SENAL_DE_PETICION.test(bloque.cuerpoLimpio)) continue;
    const lineasLimpias = bloque.cuerpoLimpio.split('\n');
    const lineasCrudas = bloque.cuerpo.split('\n');
    let vistoElEstado = false;
    const rastreadas = [];
    for (let i = 0; i < lineasLimpias.length; i += 1) {
      const linea = lineasLimpias[i];
      const declarada = DECLARACION.exec(linea);
      if (declarada !== null && FUENTE_DE_CUERPO.test(linea)) rastreadas.push(declarada[1]);
      if (!ASERCION.test(linea)) continue;
      if (SOBRE_ESTADO.test(linea)) { vistoElEstado = true; continue; }
      if (vistoElEstado || !esSobreElCuerpo(linea, rastreadas)) continue;
      encontrados.push({
        archivo: nombre,
        linea: bloque.lineaCuerpo + i,
        titulo: bloque.titulo,
        evidencia: lineasCrudas[i].trim(),
      });
      break;
    }
  }
  return encontrados;
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  if (args[0] !== 'check' || args.length > 2) { writeError(USAGE); return 2; }
  const carpeta = args[1] ?? CARPETA;
  const { hay = existsSync, listar = readdirSync, leer = readFileSync } = io;
  if (!hay(carpeta)) {
    write(`${EMPTY_PREFIX}no existe ${carpeta}: no hay ninguna prueba que barrer, y eso no es un incumplimiento.`);
    return 0;
  }
  const archivos = listar(carpeta).filter((n) => ARCHIVO_DE_PRUEBA.test(n));
  if (archivos.length === 0) {
    write(`${EMPTY_PREFIX}${carpeta} no tiene ningún archivo de prueba: no había nada que comparar.`);
    return 0;
  }
  const encontrados = [];
  for (const nombre of archivos) {
    let texto;
    try { texto = leer(join(carpeta, nombre), 'utf8'); } catch (error) {
      // Un archivo que no se puede leer no se saltea en silencio: un fallo callado se lee igual
      // que un archivo limpio, que es el mismo defecto que este gate existe para atrapar.
      writeError(`${AVISO_PREFIX}${nombre}: no se pudo leer (${error.message}) — quedó sin barrer.`);
      continue;
    }
    encontrados.push(...hallazgos(nombre, texto));
  }
  if (encontrados.length > 0) {
    writeError(`${AVISO_PREFIX}${encontrados.length} bloque(s) afirman sobre el contenido de una respuesta sin haber comprobado antes su estado:`);
    for (const h of encontrados) {
      writeError(`${AVISO_PREFIX}${h.archivo}:${h.linea} — «${h.titulo}» → ${h.evidencia}`);
    }
    writeError(`${AVISO_PREFIX}Un 404 tiene un cuerpo, y ese cuerpo tampoco trae los campos que la prueba dice no encontrar.`);
  } else {
    write(`OK: ${archivos.length} archivo(s) de prueba barridos, ninguna aserción de contenido sin su aserción de estado delante.`);
  }
  write('LÍMITE: barrer no es leer. Es un barrido léxico, no un análisis de flujo: una petición hecha a través de una función auxiliar no muestra ninguna de las señales que esto busca y pasa sin que nadie la mire. Sale 0 siempre — es un aviso, todavía no un gate.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-assert-order.mjs')) {
  process.exitCode = main();
}
