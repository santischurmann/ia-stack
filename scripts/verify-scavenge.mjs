#!/usr/bin/env node
// verify-scavenge.mjs — leer el código ANTES de decidir, y dejarlo escrito.
//
// EL HUECO QUE CIERRA, medido sobre las 2207 líneas de SKILL.md el 2026-09-15: **ningún paso previo
// a la spec leía ni razonaba sobre el código del proyecto**. El inventario completo de lo que tocaba
// el repo era `ls package.json pyproject.toml …` para olfatear el stack por existencia de archivos,
// leer `.vibe/*.md` que es memoria del protocolo y no código, y enumerar archivos de contexto — cuya
// salida era **un número para enrutar**, que ningún gate validaba y ningún script leía.
//
// La consecuencia se pagaba tarde: todo el «encontrar huecos y revisar la lógica» ocurría DESPUÉS.
// El escaneo de `[NEEDS CLARIFICATION:` en la fase 3, `verify-plan-conflicts` en la 4, y
// `verify-scope-diff` **después del GREEN** en la 5. Los huecos del plan se descubrían con el código
// ya escrito, que es el momento más caro para descubrirlos.
//
// CUATRO PREGUNTAS, Y LAS CUATRO SON DISTINTAS:
//
//   reusable — qué YA existe que sirva. La única que se puede probar, y por eso se prueba.
//   missing  — qué falta. No se puede probar: justamente no está.
//   breaks   — qué se va a romper. A veces se sabe dónde y a veces todavía no.
//   unknowns — qué queda sin saber, Y CÓMO se contesta. Una duda sin forma de resolverla no es
//              un plan: es una lista de dudas.
//
// POR QUÉ EL LOCATOR SE ABRE Y NO SÓLO SE MIRA. El gate hermano `verify-research-candidates.mjs`
// valida que un locator tenga la FORMA `archivo:línea` y nunca abre el archivo. Para research
// alcanza, porque la fuente vive en otro repositorio y no está acá. Acá no alcanza: la afirmación es
// «esto ya existe en TU código y se puede reusar», así que este gate abre el archivo y comprueba que
// la línea exista. Una afirmación de reuso que apunta a una línea inexistente es exactamente el modo
// de falla que este paso viene a impedir.
//
// LA CONTENCIÓN ES LA DEL PROTOCOLO. Los locators pasan por `isContainedProjectPath`, que resuelve
// con `realpath` y corta un enlace simbólico que apunte afuera. Se rechaza ANTES de abrir nada.
//
// LÍMITE HONESTO. Comprueba que cada locator resuelva a una línea que existe de verdad. **NO
// comprueba que esa línea diga lo que la entrada afirma**, ni que alguien haya leído el código: un
// scavenge coherente e inventado, que apunte a líneas que existen, pasa en verde. Tampoco sabe si lo
// que falta falta de verdad, ni si lo que dice que se va a romper se va a romper. Es un piso —
// obliga a mirar y a dejar constancia— y el piso es estrictamente más de lo que había, que era nada.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isContainedProjectPath } from './verify-red-node.mjs';

export const SCHEMA = 'vcp.scavenge/1';
export const USAGE = 'usage: verify-scavenge.mjs check <scavenge.json>';
export const EMPTY = 'VACÍO';

/** Un hallazgo tiene que decir algo. Mismo piso que el resto de los gates del protocolo. */
export const MIN_TEXTO = 20;

/** `archivo:línea`, con la línea entera y positiva. Sin rangos: una línea o ninguna. */
export const FORMA_LOCATOR = /^([^\s:]+):([1-9]\d*)$/u;

/** El tamaño del scavenge lo pone el trabajo, no el humor del día. Dos valores y no tres. */
export const ALCANCES = Object.freeze(new Set(['corto', 'completo']));

const FECHA = /^\d{4}-\d{2}-\d{2}$/u;
const RELLENO = /^(tbd|todo|pendiente|n\/a|na|placeholder|xxx+|-+|\.+)$/iu;

const RAIZ_KEYS = Object.freeze(['schema', 'feature', 'date', 'scope', 'reusable', 'missing', 'breaks', 'unknowns']);
const LISTAS = Object.freeze(['reusable', 'missing', 'breaks', 'unknowns']);

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;
const explicativo = (v) => noVacio(v) && v.trim().length >= MIN_TEXTO && !RELLENO.test(v.trim());

const clavesExactas = (v, claves) => esObjeto(v)
  && Object.keys(v).length === claves.length
  && claves.every((k) => Object.hasOwn(v, k));

/** Las claves que cada lista admite. `unknowns` es la única que pregunta en vez de afirmar. */
const CLAVES_DE = Object.freeze({
  reusable: ['id', 'what', 'locator'],
  missing: ['id', 'what'],
  breaks: ['id', 'what'],
  unknowns: ['id', 'question', 'how_to_answer'],
});

export function validarScavenge(doc) {
  if (!esObjeto(doc)) return ['el scavenge debe ser un objeto'];
  if (doc.schema !== SCHEMA) return [`el scavenge debe declarar schema ${SCHEMA}, no ${JSON.stringify(doc.schema)}`];
  if (!clavesExactas(doc, RAIZ_KEYS)) return [`el scavenge debe declarar exactamente ${RAIZ_KEYS.join(', ')}`];

  const violaciones = [];
  if (!noVacio(doc.feature)) violaciones.push('feature debe nombrar la funcionalidad que se está mirando');
  if (!FECHA.test(String(doc.date ?? ''))) violaciones.push('date debe ser una fecha AAAA-MM-DD');
  if (!ALCANCES.has(doc.scope)) {
    violaciones.push(`scope debe ser uno de ${[...ALCANCES].join('/')}, no ${JSON.stringify(doc.scope)}`);
  }

  for (const lista of LISTAS) {
    if (!Array.isArray(doc[lista])) violaciones.push(`${lista} debe ser una lista, aunque esté vacía`);
  }
  if (violaciones.length > 0) return violaciones;

  // CUATRO LISTAS VACÍAS NO ES «miré y no había nada»: ES NO HABER MIRADO. Aceptarlo convertiría el
  // paso en un archivo que se crea para destrabar el gate, que es justo lo que no puede pasar.
  if (LISTAS.every((lista) => doc[lista].length === 0)) {
    return ['las cuatro listas están vacías: eso no es «miré y no encontré nada», es no haber mirado. Un scavenge sin un solo hallazgo, ni una sola pregunta abierta, no es un scavenge'];
  }

  const vistos = new Map();
  for (const lista of LISTAS) {
    for (const [indice, e] of doc[lista].entries()) {
      const donde = `${lista}[${indice}]`;
      const claves = CLAVES_DE[lista];

      // `locator` es opcional en breaks: a veces se sabe QUÉ se rompe y todavía no DÓNDE.
      const admitidas = lista === 'breaks' ? [...claves, 'locator'] : claves;
      const presentes = esObjeto(e) ? Object.keys(e) : [];
      if (!esObjeto(e) || !claves.every((k) => presentes.includes(k)) || presentes.some((k) => !admitidas.includes(k))) {
        violaciones.push(`${donde} debe declarar ${claves.join(', ')}${lista === 'breaks' ? ' y opcionalmente locator' : ''}`);
        continue;
      }

      if (!noVacio(e.id)) {
        violaciones.push(`${donde}.id debe nombrar el hallazgo para poder señalarlo después`);
      } else if (vistos.has(e.id)) {
        violaciones.push(`${donde}.id repite ${JSON.stringify(e.id)}, que ya usa ${vistos.get(e.id)}: con ids repetidos no se puede señalar un hallazgo concreto en una revisión posterior`);
      } else {
        vistos.set(e.id, donde);
      }

      if (lista === 'unknowns') {
        if (!explicativo(e.question)) violaciones.push(`${donde}.question debe decir qué es lo que no se sabe, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
        // Una duda sin forma de resolverla no es un plan para sacarla: es una duda anotada.
        if (!explicativo(e.how_to_answer)) violaciones.push(`${donde}.how_to_answer debe decir CÓMO se contesta esa pregunta, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
      } else if (!explicativo(e.what)) {
        // `||` y no `??`: un id vacio NO es nulo, asi que `??` lo dejaba pasar y el mensaje salia
        // «what ()», con un parentesis vacio en vez de decir que falta el id.
        violaciones.push(`${donde}.what (${e.id || 'sin id'}) debe decir algo, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
      }

      if (Object.hasOwn(e, 'locator') && !FORMA_LOCATOR.test(String(e.locator ?? ''))) {
        violaciones.push(`${donde}.locator debe tener la forma archivo:línea, no ${JSON.stringify(e.locator)}`);
      }
    }
  }
  return violaciones;
}

/** Los locators declarados, con su origen, para poder nombrarlo en el rechazo. */
export function locatoresDe(doc) {
  const salida = [];
  for (const lista of LISTAS) {
    for (const [indice, e] of (doc[lista] ?? []).entries()) {
      if (esObjeto(e) && noVacio(e.locator)) salida.push({ donde: `${lista}[${indice}]`, id: e.id, locator: e.locator });
    }
  }
  return salida;
}

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== 'check' || !noVacio(args[1])) return null;
  return { ruta: args[1] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }

  const cwd = options.cwd ?? '.';
  const leer = options.leer ?? ((ruta) => JSON.parse(readFileSync(join(cwd, ruta), 'utf8')));

  let doc;
  try {
    doc = leer(parsed.ruta);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay scavenge en ${parsed.ruta}. Esto no verificó nada: un ciclo que todavía no miró su código no incumple nada, pero tampoco puede decir que entendió el terreno.`);
      return 0;
    }
    writeError(`REJECTED: ${parsed.ruta} existe pero no se puede leer: ${error?.message ?? error}. Un archivo corrupto no es un archivo ausente.`);
    return 1;
  }

  const violaciones = validarScavenge(doc);
  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${parsed.ruta}: ${v}`);
    return 1;
  }

  // CADA «esto ya existe» SE ABRE. La contención va primero: se rechaza sin abrir nada.
  const contenida = options.contenida ?? isContainedProjectPath;
  const abrir = options.abrir ?? ((ruta) => readFileSync(join(cwd, ruta), 'utf8'));
  const locators = locatoresDe(doc);

  for (const { donde, id, locator } of locators) {
    const [, archivo, numero] = FORMA_LOCATOR.exec(locator);
    if (!contenida(archivo, cwd)) {
      writeError(`REJECTED: ${donde} (${id}) apunta a ${JSON.stringify(archivo)}, que no es una ruta contenida en el proyecto. Un hallazgo sobre código de afuera no se puede comprobar acá.`);
      return 1;
    }

    let fuente;
    try {
      fuente = abrir(archivo);
    } catch (error) {
      writeError(`REJECTED: ${donde} (${id}) dice que en ${archivo} hay algo reusable, y ese archivo no se puede leer: ${error?.message ?? error}.`);
      return 1;
    }

    const lineas = String(fuente).split('\n');
    if (Number(numero) > lineas.length) {
      writeError(`REJECTED: ${donde} (${id}) apunta a ${archivo}:${numero} y ese archivo tiene ${lineas.length} línea(s). Una afirmación de que algo YA EXISTE tiene que apuntar a una línea que exista.`);
      return 1;
    }
  }

  const cuenta = LISTAS.map((l) => `${doc[l].length} ${l}`).join(', ');
  write(`OK: ${doc.feature} miró su propio código antes de decidir (alcance ${doc.scope}): ${cuenta}. Los ${locators.length} locator(s) declarado(s) resuelven a una línea que existe.`);
  write('LIMITE: comprueba que cada locator resuelva a una línea real. NO comprueba que esa línea diga lo que la entrada afirma, ni que alguien haya leído el código: un scavenge coherente e inventado, apuntando a líneas que existen, pasa en verde. Tampoco sabe si lo que falta falta de verdad, ni si lo que se declara que se va a romper se va a romper. Es un piso, y el piso es estrictamente más de lo que había, que era nada.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-scavenge.mjs')) {
  process.exitCode = main();
}
