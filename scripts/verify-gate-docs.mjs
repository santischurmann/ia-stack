#!/usr/bin/env node
// verify-gate-docs.mjs — un gate que nadie puede correr desde el documento es un gate que no existe.
//
// MEDIDO el 2026-09-15 sobre los 54 scripts de `scripts/` y los 20 documentos del protocolo: **ocho
// no tenían un solo comando copiable en ninguna parte**. Seis de ellos ni siquiera aparecen en
// `SKILL.md`: están nombrados únicamente en la tabla de `skills/gates.md`, que dice qué hacen y
// nunca cómo se corren. Quien lee el protocolo no puede ejecutarlos; quien los escribió, sí. Es la
// forma más silenciosa de que el documento se despegue de la máquina, porque la batería sigue verde:
// los gates andan, sólo que nadie afuera sabe invocarlos.
//
// LA REGLA YA ESTABA A MEDIAS. `tests/verify-ablation.test.mjs` exige desde hace meses que la tabla
// de `skills/gates.md` nombre a todos los gates que existen, y funcionó: los 54 están nombrados.
// Nombrar no es alcanzar. Lo que faltaba es el otro tramo, y es el que le sirve a quien lo usa.
//
// LOS DOS ESTADOS SON DISTINTOS, Y ÉSA ES TODA LA GRACIA. Un gate sin ejemplo puede ser un olvido —y
// entonces hay que escribirlo— o puede ser correcto, porque no se invoca a mano: `verify-red.mjs`
// despacha a `verify-red-pytest.mjs` y a `verify-red-vitest.mjs`, y `ratchet.mjs` es una biblioteca
// de rutas seguras con un CLI mínimo. Darle un ejemplo a un adaptador sería enseñar a saltear el
// despachador, o sea a elegir a mano el adaptador equivocado, que es peor que no documentarlo. Lo
// que este gate impide no es que falte el ejemplo: es que **no se sepa cuál de los dos casos es**.
//
// EL CONTRATO ES LA ÚNICA SALIDA, y se paga escribiendo quién invoca al script y por qué. Sin el
// contrato el gate rechaza en vez de aprobar: una lista de excepciones que no está no es una lista
// vacía. Y un contrato que declara un script inexistente también rechaza — el espejo de la regla de
// la tabla de gates—, porque una excepción viva para algo que ya no está hace que el próximo script
// con ese nombre nazca exceptuado sin que nadie lo haya decidido.
//
// LÍMITE HONESTO. Comprueba que el nombre del script aparezca dentro de un bloque de código de algún
// documento del protocolo. **NO comprueba que ese comando funcione**, ni que sus argumentos sean los
// correctos, ni que el ejemplo esté en la fase que le corresponde: un comando mal escrito adentro de
// un bloque pasa igual. Tampoco juzga si el motivo escrito en el contrato es cierto.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: verify-gate-docs.mjs check';
export const EMPTY = 'VACÍO';
export const SCHEMA = 'vcp.gate-docs/1';
export const CONTRATO = 'contracts/gate-docs.json';

/** Un motivo tiene que decir algo. Mismo piso que el resto de los gates del protocolo. */
export const MIN_TEXTO = 20;

/**
 * Los documentos donde un ejemplo cuenta. Son TODOS los del protocolo y no sólo `SKILL.md`, y eso
 * sale de una medición: de los nueve «huérfanos» que se contaron mirando sólo `SKILL.md`, seis ya
 * tenían su ejemplo en una skill. Exigirlo en `SKILL.md` habría mandado a duplicar documentación
 * que ya estaba bien puesta, y duplicarla es garantizar que las dos copias diverjan.
 */
export const DOCUMENTOS = Object.freeze(['SKILL.md', 'README.md', 'skills']);

const GATE = /^(?:verify-|ratchet|pretooluse-).*\.(?:mjs|sh|ps1)$/u;
const FENCE = /^\s*(?:```|~~~)/u;
const NOMBRE_EN_COMANDO = /[A-Za-z0-9_.-]+\.(?:mjs|sh|ps1)/gu;
const RELLENO = /^(tbd|todo|pendiente|n\/a|na|placeholder|xxx+|-+|\.+)$/iu;

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;
const explicativo = (v) => noVacio(v) && v.trim().length >= MIN_TEXTO && !RELLENO.test(v.trim());

/**
 * Los scripts nombrados DENTRO de un bloque de código. Fuera del bloque es prosa: la tabla de gates
 * nombra a los 54 y eso nunca alcanzó para poder correr uno. Un bloque sin cerrar no convierte al
 * resto del documento en comandos — el mismo criterio que `verify-menu-shape.mjs` usa para su
 * barrido, y por la misma razón: lo que queda abierto se traga todo lo que sigue.
 */
export function comandosDe(fuente) {
  const bloques = [];
  let actual = null;
  for (const linea of String(fuente).replace(/\r\n?/gu, '\n').split('\n')) {
    if (FENCE.test(linea)) {
      if (actual === null) actual = [];
      else {
        bloques.push(actual);
        actual = null;
      }
      continue;
    }
    if (actual !== null) actual.push(linea);
  }
  // `actual` sigue abierto: ese bloque nunca se cerró y se descarta entero, en vez de tragarse
  // todo lo que venía después. Mismo criterio que el barrido de `verify-menu-shape.mjs`.

  const encontrados = new Set();
  for (const bloque of bloques) {
    for (const linea of bloque) {
      for (const nombre of linea.match(NOMBRE_EN_COMANDO) ?? []) {
        if (GATE.test(nombre)) encontrados.add(nombre);
      }
    }
  }
  return encontrados;
}

/**
 * @param gates los scripts que existen en `scripts/`
 * @param documentados los que aparecen en algún bloque de código
 * @param contrato el documento de excepciones, o `null` si no se pudo leer
 */
export function validar(gates, documentados, contrato) {
  if (!esObjeto(contrato)) return [`no hay ${CONTRATO} legible: sin la lista de excepciones no se puede distinguir un gate que no se invoca a mano de uno al que se le olvidó el ejemplo, y aprobar sin esa distinción sería aprobar cualquier cosa`];
  if (contrato.schema !== SCHEMA) return [`${CONTRATO} debe declarar schema ${SCHEMA}, no ${JSON.stringify(contrato.schema)}`];
  if (!Array.isArray(contrato.not_invoked_directly)) return [`${CONTRATO} debe declarar not_invoked_directly como una lista, aunque esté vacía`];

  const violaciones = [];
  const declarados = new Set();
  const existentes = new Set(gates);

  for (const [indice, e] of contrato.not_invoked_directly.entries()) {
    const donde = `not_invoked_directly[${indice}]`;
    if (!esObjeto(e) || !noVacio(e.script)) {
      violaciones.push(`${donde} debe declarar script, invoked_by y why`);
      continue;
    }
    if (!noVacio(e.invoked_by)) {
      violaciones.push(`${donde} (${e.script}) no dice quién lo invoca: sin eso la excepción no se puede revisar`);
    }
    if (!explicativo(e.why)) {
      violaciones.push(`${donde} (${e.script}) debe decir por qué no se invoca a mano, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
    }
    // EL ESPEJO DE LA REGLA DE LA TABLA DE GATES: una excepción viva para un script borrado hace que
    // el próximo con ese nombre nazca exceptuado sin que nadie lo haya decidido.
    if (!existentes.has(e.script)) {
      violaciones.push(`${donde} declara ${e.script} y ese script no existe en scripts/: una excepción para algo que ya no está exceptúa al próximo que se llame igual`);
    }
    // LAS DOS COSAS NO PUEDEN SER CIERTAS a la vez, y dejarlo pasar convierte al contrato en una
    // lista que nadie revisa.
    if (documentados.has(e.script)) {
      violaciones.push(`${donde} declara que ${e.script} no se invoca a mano, y hay un comando copiable que lo invoca: una de las dos cosas está de más`);
    }
    declarados.add(e.script);
  }

  for (const gate of gates) {
    if (documentados.has(gate) || declarados.has(gate)) continue;
    violaciones.push(`${gate} no tiene un solo comando copiable en ${DOCUMENTOS.join(', ')}: nombrarlo en la tabla de gates dice qué hace y nunca cómo se corre. Escribí un ejemplo, o declaralo en ${CONTRATO} diciendo quién lo invoca`);
  }

  return violaciones;
}

function leerDocumentos(root, io) {
  const leer = io.leer ?? ((ruta) => readFileSync(ruta, 'utf8'));
  const listar = io.listar ?? readdirSync;
  const fuentes = [];
  for (const entrada of DOCUMENTOS) {
    const ruta = join(root, entrada);
    let nombres;
    try {
      nombres = listar(ruta).filter((n) => n.endsWith('.md')).map((n) => join(ruta, n));
    } catch {
      nombres = [ruta];
    }
    for (const archivo of nombres) {
      try {
        fuentes.push(leer(archivo));
      } catch {
        // Un documento que no está no es un defecto acá: el gate de índice es el dueño de esa regla.
      }
    }
  }
  return fuentes;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }

  const root = options.root ?? resolve(fileURLToPath(new URL('..', import.meta.url)));
  const listar = options.listar ?? readdirSync;

  let gates;
  try {
    gates = listar(join(root, 'scripts')).filter((n) => GATE.test(n)).sort();
  } catch (error) {
    writeError(`REJECTED: no se puede listar scripts/ en ${root}: ${error.message}`);
    return 1;
  }

  const fuentes = leerDocumentos(root, options);
  if (fuentes.length === 0) {
    write(`${EMPTY}: no hay ningún documento del protocolo en ${root}. Esto no verificó nada: sin documentos no se puede decir que un gate esté documentado ni que no lo esté.`);
    return 0;
  }

  const documentados = new Set();
  for (const fuente of fuentes) {
    for (const nombre of comandosDe(fuente)) documentados.add(nombre);
  }

  let contrato = null;
  try {
    contrato = JSON.parse((options.leer ?? ((r) => readFileSync(r, 'utf8')))(join(root, CONTRATO)));
  } catch {
    contrato = null;
  }

  const violaciones = validar(gates, documentados, contrato);
  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${v}`);
    return 1;
  }

  const exceptuados = contrato.not_invoked_directly.length;
  write(`OK: los ${gates.length} gate(s) se pueden correr desde un documento del protocolo, salvo ${exceptuados} declarado(s) sin ejemplo a propósito, cada uno diciendo quién lo invoca y por qué.`);
  write('LIMITE: comprueba que el nombre del script aparezca dentro de un bloque de código de algún documento. NO comprueba que ese comando funcione, ni que sus argumentos sean los correctos, ni que el ejemplo esté en la fase que le corresponde: un comando mal escrito adentro de un bloque pasa igual. Tampoco juzga si el motivo escrito en el contrato es cierto.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-gate-docs.mjs')) {
  process.exitCode = main();
}
