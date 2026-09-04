#!/usr/bin/env node
// verify-sereno.mjs — el bucle de auto-mejora, y su gate.
//
// QUE ES. Cada 7 dias, al abrir sesion, el protocolo mira lo que se hizo y propone COMO MUCHO
// CUATRO mejoras. No las aplica: las escribe. La persona aplica, saltea o copia.
//
// QUE HACE ESTE SCRIPT, Y QUE NO. No genera las propuestas: eso lo hace el agente, que es el unico
// que leyo la sesion. Este gate verifica el REGISTRO -- la misma disciplina que el resto del
// protocolo: `verify-ablation` verifica el registro de una ablacion, no la ablacion.
//
// LO QUE RECHAZA, Y POR QUE CADA UNA:
//   - Mas de cuatro propuestas. Una lista de veinte no se lee: se archiva. El tope es la feature.
//   - Una cita cuyo texto literal NO esta en el archivo que dice citar. Una propuesta sin origen
//     verificable es una opinion con formato de hallazgo.
//   - Cualquier campo ejecutable. El bucle NO corre nada, y un registro que traiga un comando
//     invita a que alguien lo corra sin leerlo.
//   - Una fecha que no es fecha, o que esta en el futuro.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - No juzga si la mejora es buena. Comprueba que tenga origen, no que valga la pena.
//   - La cita se busca literal en el archivo. Que el texto este ahi no prueba que signifique lo que
//     la propuesta dice que significa.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-sereno.mjs check <mejoras.json> | verify-sereno.mjs due [--today AAAA-MM-DD] [--dir <carpeta>]';
export const SCHEMA = 'vcp.mejoras/1';
export const CARPETA = 'docs/mejoras';
export const PERIODO_DIAS = 7;
export const MAX_PROPUESTAS = 4;
export const EMPTY_PREFIX = 'VACÍO: ';

/** Campos que convertirian el registro en algo ejecutable. El bucle sugiere, no corre. */
export const CAMPOS_EJECUTABLES = Object.freeze(['command', 'run', 'script', 'exec', 'cmd']);

const FECHA = /^\d{4}-\d{2}-\d{2}$/u;

export function diasEntre(desde, hasta) {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.floor((b - a) / 86_400_000);
}

/** Lo que hace invalido a un registro de mejoras. `leer` resuelve las citas contra el disco. */
export function violaciones(registro, leer, hoy) {
  const malas = [];
  if (registro === null || typeof registro !== 'object' || Array.isArray(registro)) {
    return [`el registro tiene que ser un objeto con schema ${SCHEMA}`];
  }
  if (registro.schema !== SCHEMA) malas.push(`el registro debe declarar schema ${SCHEMA}`);
  if (typeof registro.run_id !== 'string' || !FECHA.test(registro.run_id)) {
    malas.push('el run_id tiene que ser una fecha AAAA-MM-DD: sin fecha no hay período que medir');
  } else if (hoy !== undefined && diasEntre(registro.run_id, hoy) < 0) {
    malas.push(`el run_id ${registro.run_id} está en el futuro: un registro no puede adelantarse a la sesión que lo produjo`);
  }
  if (!Array.isArray(registro.propuestas)) return [...malas, 'el registro no declara una lista de propuestas'];
  if (registro.propuestas.length > MAX_PROPUESTAS) {
    malas.push(`${registro.propuestas.length} propuestas: el tope es ${MAX_PROPUESTAS}. Una lista más larga no se lee, se archiva, y el tope es la feature.`);
  }
  for (const [i, p] of registro.propuestas.entries()) {
    const donde = `propuesta ${i + 1}`;
    if (typeof p?.titulo !== 'string' || p.titulo.trim().length < 10) malas.push(`${donde}: necesita un título escrito`);
    if (typeof p?.por_que !== 'string' || p.por_que.trim().length < 30) malas.push(`${donde}: necesita decir por qué, con al menos 30 caracteres`);
    for (const campo of CAMPOS_EJECUTABLES) {
      if (p !== null && typeof p === 'object' && campo in p) {
        malas.push(`${donde}: trae un campo \`${campo}\`. El bucle sugiere, nunca ejecuta: un registro con un comando adentro invita a correrlo sin leerlo.`);
      }
    }
    const cita = p?.cita;
    if (cita === null || typeof cita !== 'object') { malas.push(`${donde}: sin cita no hay origen verificable, y una propuesta sin origen es una opinión con formato de hallazgo`); continue; }
    if (typeof cita.archivo !== 'string' || cita.archivo === '') { malas.push(`${donde}: la cita no dice de qué archivo salió`); continue; }
    if (typeof cita.texto_literal !== 'string' || cita.texto_literal.trim().length < 10) { malas.push(`${donde}: la cita necesita el texto literal que la respalda`); continue; }
    let contenido;
    try { contenido = leer(cita.archivo); } catch (error) {
      malas.push(`${donde}: no se pudo leer ${cita.archivo} (${error.message}): una cita que no resuelve no respalda nada`);
      continue;
    }
    if (!contenido.includes(cita.texto_literal)) {
      malas.push(`${donde}: el texto citado no está en ${cita.archivo}. Una cita que no resuelve es peor que ninguna: parece evidencia.`);
    }
  }
  return malas;
}

export function parseArguments(args) {
  if (args[0] === 'check') {
    if (args.length !== 2) return null;
    return { accion: 'check', ruta: args[1] };
  }
  if (args[0] === 'due') {
    const opciones = { accion: 'due', hoy: null, dir: CARPETA };
    for (let i = 1; i < args.length; i += 2) {
      if (args[i] === '--today' && args[i + 1] !== undefined) opciones.hoy = args[i + 1];
      else if (args[i] === '--dir' && args[i + 1] !== undefined) opciones.dir = args[i + 1];
      else return null;
    }
    return opciones;
  }
  return null;
}

/** El registro mas reciente de la carpeta, por nombre: los nombres son fechas, asi que ordenan. */
export function ultimoRegistro(nombres) {
  return nombres.filter((n) => FECHA.test(n.replace(/\.json$/u, ''))).sort().at(-1) ?? null;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArguments(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  const { hay = existsSync, listar = readdirSync, leer = (p) => readFileSync(join(cwd, p), 'utf8'), hoy = null } = io;
  const fecha = parsed.hoy ?? hoy ?? new Date().toISOString().slice(0, 10);

  if (parsed.accion === 'due') {
    const carpeta = join(cwd, parsed.dir);
    if (!hay(carpeta)) { write(`${EMPTY_PREFIX}todavía no hay ninguna ronda de mejoras en ${parsed.dir}`); return 0; }
    const ultimo = ultimoRegistro(listar(carpeta));
    if (ultimo === null) { write(`${EMPTY_PREFIX}la carpeta ${parsed.dir} no tiene ningún registro con nombre de fecha`); return 0; }
    const dias = diasEntre(ultimo.replace(/\.json$/u, ''), fecha);
    write(dias !== null && dias >= PERIODO_DIAS
      ? `TOCA: pasaron ${dias} día(s) desde la última ronda (${ultimo}); el período es ${PERIODO_DIAS}.`
      : `OK: la última ronda es ${ultimo}, hace ${dias} día(s). No toca todavía.`);
    return 0;
  }

  let registro;
  try { registro = JSON.parse(leer(parsed.ruta)); } catch (error) {
    writeError(`REJECTED: ${parsed.ruta}: no se pudo leer el registro (${error.message})`);
    return 1;
  }
  const malas = violaciones(registro, leer, fecha);
  if (malas.length > 0) {
    for (const m of malas) writeError(`REJECTED: ${parsed.ruta}: ${m}`);
    return 1;
  }
  write(`OK: ${parsed.ruta} registra ${registro.propuestas.length} propuesta(s), cada una con su cita resuelta contra el archivo que dice citar.`);
  write('LÍMITE: comprueba que la propuesta tenga origen, no que valga la pena. Y que el texto citado esté ahí, no que signifique lo que la propuesta dice.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-sereno.mjs')) {
  process.exitCode = main();
}
