#!/usr/bin/env node
// verify-feature-activa.mjs — los documentos que declaran LA FEATURE ACTIVA tienen que nombrar la
// misma.
//
// POR QUE EXISTE. Tres archivos declaran cual es la feature en curso, cada uno para su lector:
// `docs/spec.md` en su titulo, `.vibe/SESSION.md` en su encabezado y `docs/phase-plan.json` en su
// campo `feature`. Nada los comparaba. Medido en este repositorio el 2026-09-04: los tres decian
// cosas distintas -- `candidatos-de-research`, `integridad-verificable` y
// `research-cycle-2026-08-29` -- y ningun gate lo veia. Un protocolo cuyo estado no coincide consigo
// mismo no puede decir en que esta trabajando, y todo lo que se apoye en esa respuesta hereda la
// duda.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - No sabe cual de los tres tiene razon. Detecta el desacuerdo, no lo resuelve: quien corrige
//     elige, y esa eleccion es humana.
//   - De `.vibe/SESSION.md` lee el PRIMER `**Feature slug:**`, que es el del encabezado. Un archivo
//     de sesion puede acumular secciones de sesiones viejas con su propio slug adentro; esas son
//     historia, no declaracion vigente. Si alguien archiva mal y el encabezado queda viejo, el gate
//     compara el encabezado viejo y no se entera.
//   - No comprueba que la feature exista, ni que el trabajo sea sobre ella. Compara nombres.
//   - No mira `docs/phase-plan.json`. El motivo esta escrito junto a la lista de fuentes, y no es
//     un olvido: es un expediente cerrado, no una declaracion del presente.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-feature-activa.mjs check [<raiz>]';
export const EMPTY_PREFIX = 'VACÍO: ';

/** De donde sale la feature activa, y como se lee de cada uno. Es una lista de FUENTES, no de
 * nombres de feature: agregar un declarante nuevo es agregar una fila. */
export const FUENTES = Object.freeze([
  Object.freeze({ archivo: 'docs/spec.md', como: 'el título `# Spec: <slug>`' }),
  Object.freeze({ archivo: '.vibe/SESSION.md', como: 'el primer `**Feature slug:**` del encabezado' }),
]);

// POR QUE `docs/phase-plan.json` NO ESTA EN ESTA LISTA, aunque tambien tiene un campo `feature`.
// Ese archivo es el expediente de un CICLO DE FASES, y su pareja `docs/phase-decisions.json` guarda
// las decisiones selladas de cada fase. Un expediente terminado sigue nombrando su propia feature
// -- correctamente -- mientras el trabajo en curso ya es otro. Exigir que coincida obligaria a una
// de dos cosas, y las dos son peores que el desacuerdo: borrar el expediente cerrado, o FABRICAR
// decisiones de fase para la feature nueva, con menus que nunca se mostraron. Este protocolo no
// escribe evidencia hacia atras. Medido el 2026-09-04 en este repositorio: phase-plan y
// phase-decisions declaran `research-cycle-2026-08-29` y son coherentes ENTRE SI -- las dos fases
// que declara tienen su decision registrada y `verify-phase-menu` sale verde.
//
// Queda dicho como limite: si alguien deja el expediente de fases apuntando a una feature vieja y
// se olvida de abrir el nuevo, este gate no lo ve. Lo que lo cubre es `verify-phase-menu`, que
// verifica el expediente contra si mismo, no contra el presente.

export function slugDeSpec(texto) {
  const m = texto.match(/^#\s*Spec:\s*(\S+)/mu);
  return m === null ? null : m[1];
}

export function slugDeSession(texto) {
  const m = texto.match(/\*\*Feature slug:\*\*\s*(\S+)/u);
  if (m === null) return null;
  // El placeholder de la plantilla no es una declaración: es el hueco donde todavía no se escribió
  // nada. Tratarlo como slug haría que un proyecto recién instalado rechazara por no haber elegido
  // todavía, que es exactamente cuando no hay nada que comparar.
  return m[1].startsWith('(') ? null : m[1];
}

export function slugDePhasePlan(texto) {
  try {
    const valor = JSON.parse(texto).feature;
    return typeof valor === 'string' && valor !== '' ? valor : null;
  } catch {
    // Un JSON roto no es un desacuerdo de feature: lo rechaza el gate del plan de fases, que es su
    // dueño. Acá no se opina sobre él.
    return null;
  }
}

const LECTORES = Object.freeze({
  'docs/spec.md': slugDeSpec,
  '.vibe/SESSION.md': slugDeSession,
});

/** Lo que cada fuente presente declara. Las ausentes no figuran: un proyecto puede no tener plan de
 * fases todavía, y eso no es un desacuerdo. */
export function declaraciones(raiz, hay = existsSync, leer = readFileSync) {
  const vistas = [];
  for (const fuente of FUENTES) {
    const ruta = join(raiz, fuente.archivo);
    if (!hay(ruta)) continue;
    let slug = null;
    try { slug = LECTORES[fuente.archivo](leer(ruta, 'utf8')); } catch { continue; }
    if (slug !== null) vistas.push({ archivo: fuente.archivo, slug, como: fuente.como });
  }
  return vistas;
}

/** Un solo mensaje que nombra a TODOS los que discrepan, no el primero que aparece. Reportar de a
 * uno haria falta corregir, correr, descubrir el siguiente y repetir: el desacuerdo es entre todos,
 * asi que se muestra entero. */
export function desacuerdos(vistas) {
  const distintos = new Set(vistas.map((v) => v.slug));
  if (distintos.size <= 1) return [];
  const detalle = vistas.map((v) => `${v.archivo} dice "${v.slug}" (en ${v.como})`).join('; ');
  return [`los documentos no coinciden en cuál es la feature activa: ${detalle}. Un protocolo cuyo estado no coincide consigo mismo no puede decir en qué está trabajando.`];
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  if (args[0] !== 'check' || args.length > 2) { writeError(USAGE); return 2; }
  const raiz = args[1] ?? '.';
  const vistas = declaraciones(raiz, io.hay, io.leer);
  if (vistas.length === 0) {
    write(`${EMPTY_PREFIX}ningún documento declara una feature activa: no hay dos nombres que comparar.`);
    return 0;
  }
  if (vistas.length === 1) {
    write(`${EMPTY_PREFIX}sólo ${vistas[0].archivo} declara una feature (${vistas[0].slug}): hace falta más de una para que haya acuerdo o desacuerdo.`);
    return 0;
  }
  const malas = desacuerdos(vistas);
  if (malas.length > 0) {
    for (const m of malas) writeError(`REJECTED: ${m}`);
    return 1;
  }
  write(`OK: ${vistas.length} documento(s) declaran la misma feature activa: ${vistas[0].slug}.`);
  write('LÍMITE: detecta el desacuerdo, no lo resuelve; y compara nombres, no comprueba que el trabajo sea sobre esa feature.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-feature-activa.mjs')) {
  process.exitCode = main();
}
