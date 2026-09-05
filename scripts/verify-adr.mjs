#!/usr/bin/env node
// verify-adr.mjs — los registros de decisión de arquitectura tienen la forma que dicen tener.
//
// QUE ES UN ADR, Y POR QUE VIVE APARTE DE `.vibe/DECISIONS.md`. `DECISIONS.md` es la bitácora
// corrida de la sesión: qué se eligió y por qué, en orden. Un ADR es otra cosa y por eso el
// protocolo lo pide sólo cuando corresponde: una decisión ESTRUCTURAL, de las que atan al proyecto
// por meses, escrita con las opciones que se descartaron y -- esto es lo que ningún otro artefacto
// del protocolo exige -- **qué se vuelve más difícil**. Un plan dice qué se hace; un ADR dice qué
// se pierde al hacerlo.
//
// LO QUE RECHAZA, Y POR QUE CADA UNA:
//   - Que falte cualquiera de las cuatro secciones. Sin `Options Considered` no es una decisión, es
//     un anuncio; sin `Consequences` es una decisión sin costo, que no existe.
//   - Un estado que no sea uno de los cuatro. "Status: listo" no dice si la decisión rige.
//   - Los huecos de la plantilla sin llenar. Un ADR con `<title>` adentro es la plantilla, no un
//     registro, y contarlo como registro infla la cuenta de decisiones documentadas.
//   - Un `Chosen:` sin su `Reason:`. Elegir sin decir por qué es lo mismo que no documentar.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - No juzga la decisión. Comprueba que estén las secciones y que digan algo, no que la opción
//     elegida sea la correcta ni que las descartadas se hayan evaluado de verdad.
//   - No sabe si un ADR hacía falta. Un proyecto que toma diez decisiones estructurales y no
//     escribe ninguna sale igual de verde que uno que no tomó ninguna: sin carpeta escribe VACIO.
//   - `Consequences` puede hablar sólo de lo que mejora. El gate exige que la sección tenga texto,
//     no que sea honesta sobre el costo -- eso lo lee una persona.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-adr.mjs check [<carpeta>]';
export const CARPETA = 'docs/adr';
export const EMPTY_PREFIX = 'VACÍO: ';

/** Las cuatro secciones. Es la lista de lo que un ADR ES, no de nombres de archivo: cambiarla es
 * cambiar el artefacto, y por eso vive acá y no repartida entre las dos plantillas. */
export const SECCIONES = Object.freeze(['Context', 'Decision', 'Options Considered', 'Consequences']);
export const ESTADOS = Object.freeze(['Proposed', 'Accepted', 'Deprecated', 'Superseded']);

const HUECO = /<[^>\n]{2,}>/u;
const MINIMO_POR_SECCION = 15;

/** El cuerpo de una sección: lo que hay entre su encabezado y el siguiente. */
export function cuerpoDeSeccion(texto, nombre) {
  const inicio = texto.search(new RegExp(`^##\\s+${nombre}\\s*$`, 'mu'));
  if (inicio === -1) return null;
  const resto = texto.slice(inicio);
  const siguiente = resto.slice(1).search(/^##\s+/mu);
  const cuerpo = siguiente === -1 ? resto : resto.slice(0, siguiente + 1);
  return cuerpo.replace(/^##\s+.*$/mu, '').replace(/^-+$/gmu, '').trim();
}

export function violaciones(nombre, texto) {
  const malas = [];
  // El estado primero: sin el no se sabe si la decision rige, y una decision que no se sabe si rige
  // es peor que ninguna -- alguien la sigue creyendo vigente.
  const estado = texto.match(/\*\*Status:\*\*\s*([A-Za-z]+)/u);
  if (estado === null || !ESTADOS.includes(estado[1])) {
    malas.push(`${nombre}: Status tiene que ser uno de ${ESTADOS.join(', ')}, no ${estado === null ? '(ausente)' : JSON.stringify(estado[1])}`);
  }
  for (const seccion of SECCIONES) {
    const cuerpo = cuerpoDeSeccion(texto, seccion);
    if (cuerpo === null) { malas.push(`${nombre}: falta la sección ## ${seccion}`); continue; }
    // Un encabezado sin nada debajo pasaria cualquier detector que solo cuente encabezados, y es
    // justo la forma de fingir un ADR con el menor esfuerzo posible.
    if (cuerpo.length < MINIMO_POR_SECCION) malas.push(`${nombre}: la sección ## ${seccion} está vacía o dice demasiado poco`);
  }
  // Los huecos de la plantilla. Un ADR con `<title>` adentro ES la plantilla, y contarlo como
  // registro infla la cuenta de decisiones documentadas con un archivo que nadie escribio.
  if (HUECO.test(texto)) malas.push(`${nombre}: quedan huecos de la plantilla sin llenar (${texto.match(HUECO)[0]})`);
  // Elegir sin decir por que es lo mismo que no documentar: la opcion elegida sin su motivo no deja
  // nada que revisar en seis meses.
  if (/\*\*Chosen:\*\*/u.test(texto) && !/\*\*Reason:\*\*\s*\S/u.test(texto)) {
    malas.push(`${nombre}: hay un **Chosen:** sin su **Reason:** — elegir sin decir por qué no documenta nada`);
  }
  return malas;
}

export function esAdr(nombre) {
  return /^\d{4}-[\w-]+\.md$/u.test(nombre);
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  if (args[0] !== 'check' || args.length > 2) { writeError(USAGE); return 2; }
  const carpeta = args[1] ?? CARPETA;
  const { hay = existsSync, listar = readdirSync, leer = readFileSync } = io;
  if (!hay(carpeta)) {
    write(`${EMPTY_PREFIX}no hay ninguna decisión de arquitectura registrada en ${carpeta}. Eso no es un incumplimiento: es un proyecto que todavía no tomó una, o que no las escribió.`);
    return 0;
  }
  const archivos = listar(carpeta).filter(esAdr);
  if (archivos.length === 0) {
    write(`${EMPTY_PREFIX}la carpeta ${carpeta} no tiene ningún archivo con forma de ADR (<NNNN>-<titulo>.md).`);
    return 0;
  }
  const malas = [];
  for (const nombre of archivos) {
    let texto;
    try { texto = leer(join(carpeta, nombre), 'utf8'); } catch (error) {
      malas.push(`${nombre}: no se pudo leer (${error.message})`);
      continue;
    }
    malas.push(...violaciones(nombre, texto));
  }
  if (malas.length > 0) {
    for (const m of malas) writeError(`REJECTED: ${m}`);
    return 1;
  }
  write(`OK: ${archivos.length} decisión(es) de arquitectura con sus cuatro secciones escritas y su estado declarado.`);
  write('LÍMITE: comprueba la forma, no la decisión. Que estén las opciones descartadas no prueba que se hayan evaluado, y que haya consecuencias escritas no prueba que digan lo que de verdad se vuelve más difícil.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-adr.mjs')) {
  process.exitCode = main();
}
