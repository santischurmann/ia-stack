#!/usr/bin/env node
// informe-tokens.mjs — informe semanal de gasto por subagente, en Markdown, desde .vibe/tokens.jsonl.
//
// Usage: node .vibe/ia-stack-runtime/scripts/informe-tokens.mjs [--file .vibe/tokens.jsonl] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]
// Sin --desde/--hasta toma los últimos 7 días (hoy y los 6 anteriores, hora argentina). También acepta DD-MM-AAAA.
//
// Imprime tokens in/out y cantidad por rol y por modelo, y la lista de escaladas (fecha, tarea, rol,
// modelo). Está pensado para pegarse en docs/lecciones-modelos.md y revisar la tabla de ruteo.
//
// DECISION. Archivo inexistente o vacío: imprime «VACÍO: sin registros» (el prefijo que usan los demás gates
// para «no había nada que comparar») y sale 0; período sin registros: título y «sin registros entre…», también 0.
// Una semana sin subagentes es un estado legítimo, y rechazarla haría que el informe semanal falle justo
// cuando no hay nada que informar. Lo que NO se disfraza: archivo ilegible, línea sin sello, sello roto,
// JSON roto o registro inválido salen ≠0 (misma lectura que `registrar-tokens.mjs check`).
//
// LIMITES HONESTOS. Los tokens son los que declaró quien registró; el sello prueba que no se editaron.
// El período se corta por fecha en hora argentina (UTC-3, sin horario de verano), no por la del servidor.
// No convierte tokens a plata ni juzga si la tabla de ruteo está bien: sólo muestra los números.

import { ARCHIVO_DEFECTO, leerArchivo, leerRegistros, leerRoles } from './registrar-tokens.mjs';

export const USAGE = 'usage: informe-tokens.mjs [--file <tokens.jsonl>] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]';
const TRES_HORAS = 3 * 60 * 60 * 1000;
const DIA = 24 * 60 * 60 * 1000;

/** Fecha AAAA-MM-DD en hora argentina de un instante ISO o de un Date. */
export function fechaAR(instante) {
  const ms = instante instanceof Date ? instante.getTime() : Date.parse(instante);
  return new Date(ms - TRES_HORAS).toISOString().slice(0, 10);
}

/** AAAA-MM-DD válido a partir de AAAA-MM-DD o DD-MM-AAAA; null si no es una fecha real. */
export function parsearFecha(valor) {
  const iso = /^(\d{4})-(\d\d)-(\d\d)$/u.exec(valor);
  const ar = /^(\d\d)-(\d\d)-(\d{4})$/u.exec(valor);
  const [anio, mes, dia] = iso ? [iso[1], iso[2], iso[3]] : ar ? [ar[3], ar[2], ar[1]] : [];
  if (anio === undefined) return null;
  const canonica = `${anio}-${mes}-${dia}`;
  const d = new Date(`${canonica}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== canonica ? null : canonica;
}

const ddmmaaaa = (iso) => iso.split('-').reverse().join('-');

function agrupar(registros, clave) {
  const grupos = new Map();
  for (const r of registros) {
    const g = grupos.get(r[clave]) ?? { n: 0, tin: 0, tout: 0 };
    g.n += 1;
    g.tin += r.tokens_in;
    g.tout += r.tokens_out;
    grupos.set(r[clave], g);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Escapa el `|` para que un valor libre no rompa la tabla markdown. */
const celda = (v) => String(v).replaceAll('|', '\\|');

function tabla(titulo, columna, registros, clave) {
  const filas = agrupar(registros, clave).map(([k, g]) => `| ${celda(k)} | ${g.n} | ${g.tin} | ${g.tout} |`);
  return [`### ${titulo}`, '', `| ${columna} | registros | tokens in | tokens out |`, '| --- | --- | --- | --- |', ...filas, ''];
}

/** Markdown del período [desde, hasta] (AAAA-MM-DD, inclusivo, hora argentina). */
export function construirInforme(registros, desde, hasta) {
  const rango = `${ddmmaaaa(desde)} a ${ddmmaaaa(hasta)}`;
  const titulo = `## Tokens por subagente · ${rango}`;
  const dentro = registros.filter((r) => fechaAR(r.fecha) >= desde && fechaAR(r.fecha) <= hasta);
  if (dentro.length === 0) return `${titulo}\n\nsin registros entre ${rango}.\n`;
  const escaladas = dentro.filter((r) => r.escalo);
  const filasEscaladas = escaladas.map((r) => `| ${ddmmaaaa(fechaAR(r.fecha))} | ${celda(r.tarea)} | ${celda(r.rol)} | ${celda(r.modelo)} |`);
  return [
    titulo, '',
    `Registros: ${dentro.length} · tokens in: ${dentro.reduce((s, r) => s + r.tokens_in, 0)} · tokens out: ${dentro.reduce((s, r) => s + r.tokens_out, 0)}`, '',
    ...tabla('Por rol', 'rol', dentro, 'rol'),
    ...tabla('Por modelo', 'modelo', dentro, 'modelo'),
    `### Escaladas (${escaladas.length})`, '',
    ...(escaladas.length === 0 ? ['ninguna'] : ['| fecha | tarea | rol | modelo |', '| --- | --- | --- | --- |', ...filasEscaladas]),
    '',
  ].join('\n');
}

function parsearArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!['--file', '--desde', '--hasta'].includes(flag)) throw new Error(`argumento desconocido: ${flag}`);
    if (i + 1 >= argv.length) throw new Error(`falta el valor de ${flag}`);
    i += 1;
    args[flag.slice(2)] = argv[i];
  }
  return args;
}

export function main(argv = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  try {
    const args = parsearArgs(argv);
    const ahora = options.ahora ?? new Date();
    const fecha = (valor, defecto, flag) => {
      if (valor === undefined) return defecto;
      const f = parsearFecha(valor);
      if (f === null) throw new Error(`${flag} no es una fecha válida (AAAA-MM-DD o DD-MM-AAAA): ${valor}`);
      return f;
    };
    const hasta = fecha(args.hasta, fechaAR(ahora), '--hasta');
    const desde = fecha(args.desde, fechaAR(new Date(ahora.getTime() - 6 * DIA)), '--desde');
    if (desde > hasta) throw new Error(`--desde (${ddmmaaaa(desde)}) es posterior a --hasta (${ddmmaaaa(hasta)})`);
    const ruta = args.file ?? ARCHIVO_DEFECTO;
    const { content, error } = leerArchivo(ruta);
    if (error !== null) throw new Error(error);
    const lectura = leerRegistros(content, leerRoles());
    if (!lectura.ok) throw new Error(`${ruta}: ${lectura.error}`);
    if (lectura.registros.length === 0) {
      write(`VACÍO: sin registros: ${ruta} no existe o no tiene líneas todavía.`);
      return 0;
    }
    write(construirInforme(lectura.registros, desde, hasta));
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('informe-tokens.mjs')) {
  process.exitCode = main();
}
