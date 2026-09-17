#!/usr/bin/env node
// verify-test-duration.mjs — que el tope de TAP deje al menos el TRIPLE sobre el archivo mas lento.
//
// POR QUE IMPORTA. `verify-test-bindings` vincula cada requisito a una prueba y espera su resultado
// en la salida TAP, con un tope de tiempo. Un archivo mas lento que ese tope se marca TIMEOUT: el
// requisito queda sin verificar, y el motivo que se lee es «lento», no «roto». Un requisito que no
// se puede comprobar porque su archivo tarda demasiado es un hueco silencioso.
//
// POR QUE ES UN GATE Y NO UNA PRUEBA, que es todo el punto de este archivo. Esto vivia adentro de la
// suite, y ahi corria rodeado de noventa archivos compitiendo por la CPU. Medido el 2026-09-17: el
// archivo que se declaraba entonces tardaba **96 s solo** y **224 s** desde adentro. Factor de
// contencion 2,3x contra el tope de entonces, 120 s -- con eso, cualquier archivo de mas de unos
// 52 s reventaba el tope sin estar roto, y la suite salia roja por contencion.
//
// Partir los archivos mas lentos ayudo -- 131 s a 41, 116 s a 56 -- y NO alcanzo: el problema no es
// el tamano, es donde se mide. Como gate propio corre solo y mide lo que dice medir. El tope no se
// afloja ni se saltea nada: sigue siendo el limite real de TAP.
//
// QUE JUZGA, Y QUE NO. Juzga la REGLA con la que se escribio el tope -- «al menos el triple sobre el
// mas lento» --, no el numero. La regla vivia en un comentario, nadie la comprobaba, y se rompio
// sola cuando la suite crecio: por debajo del tope cabe un margen de 19 s que cualquier maquina
// cargada se come. Ver `MARGEN_MINIMO`. Y no juzga nada cuando no puede medir: ver `RECONCILIAR`.
//
// LIMITE HONESTO. Mide el archivo que `contracts/slowest-test.json` DECLARA como el mas lento: no
// descubre cual es. Correr los noventa para saberlo duplicaria la suite. La declaracion lleva la
// fecha en que se midio para que una que quedo vieja se vea, y ya paso una vez -- estuvo once dias
// apuntando a un archivo que se habia partido en dos mientras otro reventaba el tope sin que nadie
// lo mirara. Y mide UNA corrida en ESTA maquina: una mas lenta da otro numero.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TAP_TIMEOUT_MS } from './verify-test-bindings.mjs';

export const USAGE = 'usage: verify-test-duration.mjs';
export const EMPTY = 'VACÍO';
/** El tercer estado: «medi esto y no me lo creo».
 *
 * El 2026-09-17, en una sola tarde y sin que cambiara una linea, el mismo archivo dio 89, 101, 116 y
 * 247 s. La causa se midio, no se supuso: la CPU al 100% con procesos ajenos al repositorio.
 *
 * Las dos salidas posibles son destructivas, y por eso hay una tercera. Aprobar taparia una
 * regresion de verdad. Rechazar pondria rojo un gate por la carga de la maquina y no por el codigo
 * -- el rojo que no dice nada, y que es como se aprende a ignorar los rojos --. Mismo patron que
 * vivo/muerto/reconciliar y que true/false/null: el tercer estado existe donde adivinar hace dano.
 *
 * EL ARBITRO ES EL RUNNER, NO ESTA MAQUINA. En un runner quieto la medicion cae dentro de la
 * tolerancia y el gate juzga normal, con todo su rigor. En una maquina de trabajo con cosas abiertas
 * dice que no puede medir, que es la verdad. */
export const RECONCILIAR = 'RECONCILIAR';

/** Cuanto puede alejarse la medicion de lo declarado antes de dejar de creerle.
 *
 * 1,5 no es redondo por gusto: por debajo de eso reconciliaria el ruido normal de cualquier maquina
 * -- las cuatro lecturas de ese dia se movieron un 1,3 entre las tres primeras --, y por arriba del
 * doble una regresion de verdad se escondria adentro del margen. */
export const TOLERANCIA = 1.5;
export const TOPE_MS = TAP_TIMEOUT_MS;
/** El margen que el tope tiene que dejar sobre el archivo mas lento.
 *
 * NO ES UN NUMERO NUEVO: es la regla con la que se escribio `TAP_TIMEOUT_MS` -- «120 s deja mas del
 * triple de margen sobre el mas lento medido», con datos del 2026-09-05, cuando el mas lento tardaba
 * 40 s --. Estaba escrita en un comentario y nadie la comprobaba, asi que se rompio sola cuando la
 * suite crecio: el 2026-09-17 ese mismo archivo mide 101 s contra un tope de 120.
 *
 * POR QUE EL TRIPLE Y NO EL DOBLE. Medido en esta maquina entre el 2026-09-16 y el 2026-09-17, sin
 * que cambiara una linea: verify-receipt-gate dio 56 y 89 s, verify-receipt-commit 33 y 53 s. Factor
 * 1,6 entre dias. Un margen del doble se lo come esa variacion sola; el triple no. */
export const MARGEN_MINIMO = 3;
export const CONTRATO = join('contracts', 'slowest-test.json');
export const LIMITS_TEXT = 'LÍMITE: mide el archivo que el contrato DECLARA como el más lento, no descubre cuál es — correr los noventa duplicaría la suite. La declaración lleva la fecha en que se midió para que una vieja se vea, y ya pasó: estuvo once días apuntando a un archivo partido en dos mientras otro reventaba el tope. Y mide UNA corrida en ESTA máquina: el 2026-09-17 el mismo archivo dio 89, 101, 116 y 247 s en una tarde, con la CPU al 100% por procesos ajenos al repositorio. Por eso existe RECONCILIAR, y por eso el árbitro es el runner y no la máquina de trabajo.';

const segundos = (ms) => Math.round(ms / 1000);

/**
 * Correr ese archivo SOLO y contar cuanto tarda.
 *
 * La instrumentacion de cobertura se saca del hijo a proposito: el tope gobierna la corrida normal,
 * y bajo cobertura el mismo archivo tarda unas tres veces mas. Medir instrumentado compararia dos
 * cosas distintas.
 */
export function medir(archivo, cwd, io = {}) {
  const correr = io.spawn ?? spawnSync;
  const ahora = io.ahora ?? Date.now;
  const inicio = ahora();
  const r = correr(process.execPath, ['--test', join('tests', archivo)], {
    cwd,
    encoding: 'utf8',
    timeout: TOPE_MS * 3,
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_V8_COVERAGE: undefined },
  });
  return { status: r?.status, ms: ahora() - inicio, salida: `${r?.stdout ?? ''}${r?.stderr ?? ''}` };
}

/** Que significa ese numero. Tres estados y cuatro motivos, y cada uno se dice distinto. */
export function veredicto(archivo, status, ms, declaradoMs) {
  if (status !== 0) {
    return {
      rechaza: true,
      mensaje: `${archivo} tiene que pasar, o lo que se midió no es su duración: un archivo que falla puede terminar antes o después por motivos que no son el tiempo. Salió ${status}.`,
    };
  }
  if (ms >= TOPE_MS) {
    return {
      rechaza: true,
      mensaje: `${archivo} tarda ${segundos(ms)} s y el tope es ${segundos(TOPE_MS)} s: vincular un requisito a ese archivo lo marcaría TIMEOUT por lento, no por roto, y el requisito quedaría sin verificar sin que nadie lo note.`,
    };
  }
  if (Number.isFinite(declaradoMs) && declaradoMs > 0 && ms > declaradoMs * TOLERANCIA) {
    return {
      rechaza: false,
      reconciliar: true,
      mensaje: `${archivo} tardó ${segundos(ms)} s y el contrato declara ${segundos(declaradoMs)} s: ${(ms / declaradoMs).toFixed(1)} veces más. O el archivo se puso más lento de verdad, o esta máquina estaba cargada mientras se medía — y no hay forma de distinguirlo desde acá. No se aprueba ni se rechaza: volvé a medirlo con la máquina quieta y actualizá el contrato, o mirá lo que da el runner, que es el que decide de verdad.`,
    };
  }
  if (ms * MARGEN_MINIMO > TOPE_MS) {
    return {
      rechaza: true,
      mensaje: `${archivo} tarda ${segundos(ms)} s y el tope es ${segundos(TOPE_MS)} s: entra, pero el tope tiene que dejar ${MARGEN_MINIMO} veces el archivo más lento y acá deja ${(TOPE_MS / ms).toFixed(1)}. Esta máquina ya varió un factor 1,6 entre dos días sin que cambiara una línea, así que ese margen se lo come una máquina cargada y el gate se pone rojo por la carga, no por el código. Para ${segundos(ms)} s el tope tendría que ser ${segundos(ms * MARGEN_MINIMO)} s, o el archivo tendría que partirse.`,
    };
  }
  return {
    rechaza: false,
    mensaje: `${archivo} tarda ${segundos(ms)} s contra un tope de ${segundos(TOPE_MS)} s: queda ${segundos(TOPE_MS - ms)} s de margen, ${(TOPE_MS / ms).toFixed(1)} veces el archivo, contra un mínimo de ${MARGEN_MINIMO}.`,
  };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  if (args.length !== 0) {
    writeError(USAGE);
    return 2;
  }
  const cwd = options.cwd ?? process.cwd();
  const leer = options.leer ?? ((ruta) => readFileSync(join(cwd, ruta), 'utf8'));

  let d;
  try {
    d = JSON.parse(leer(CONTRATO));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay ${CONTRATO}. Este proyecto no declara cuál es su archivo de pruebas más lento, así que no hay nada que medir — y eso no es una aprobación.`);
      return 0;
    }
    writeError(`REJECTED: ${CONTRATO} existe pero no se puede leer: ${error?.message ?? error}.`);
    return 1;
  }

  if (typeof d?.archivo !== 'string' || !/\.test\.mjs$/u.test(d.archivo)) {
    writeError(`REJECTED: ${CONTRATO} no declara un archivo de pruebas válido: ${JSON.stringify(d?.archivo)}.`);
    return 1;
  }
  if (!Number.isFinite(d?.segundos) || d.segundos <= 0) {
    writeError(`REJECTED: ${CONTRATO} declara ${JSON.stringify(d?.segundos)} segundos, y sin un número la declaración no dice nada.`);
    return 1;
  }

  const { status, ms } = medir(d.archivo, cwd, options);
  const v = veredicto(d.archivo, status, ms, d.segundos * 1000);
  if (v.reconciliar) {
    write(`${RECONCILIAR}: ${v.mensaje}`);
    write(LIMITS_TEXT);
    return 0;
  }
  if (v.rechaza) {
    writeError(`REJECTED: ${v.mensaje}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  write(`OK: ${v.mensaje} Declarado el ${d.medido} en ${segundos(d.segundos * 1000)} s.`);
  write(LIMITS_TEXT);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-test-duration.mjs')) {
  process.exitCode = main();
}
