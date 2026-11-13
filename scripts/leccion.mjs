#!/usr/bin/env node
// leccion.mjs — anota lecciones en `.ia-stack/LECCIONES.md` y detecta causas repetidas (IA Stack 3.4.5).
//
// Usage:
//   node scripts/leccion.mjs anotar --tipo escalada|retrabajo --sintoma <t> --causa <t> --archivo <ruta> [--desde <barato|medio|fuerte> --hasta <barato|medio|fuerte>] [--proyecto <dir>]
//   node scripts/leccion.mjs repetidas [--dias 30] [--proyecto <dir>]
//
// El archivo sigue el formato que valida `verify-lessons.mjs`: un bloque `## DD-MM-AAAA · tipo` por
// lección y cuatro campos. `anotar` valida el resultado ANTES de escribir y no toca un archivo roto.
// LÍMITE HONESTO: "misma causa" es igualdad de texto normalizado (minúsculas, espacios colapsados);
// dos causas escritas distinto para el mismo problema no se detectan como repetidas.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { fechaAR } from './estado.mjs';
import { parseBlocks, parseFields, validateLessons } from './verify-lessons.mjs';

export const TIPOS = ['escalada', 'retrabajo'];
/** Niveles del protocolo; `--desde/--hasta` también aceptan un número (peldaño de la escalera vieja). */
export const NIVELES = ['barato', 'medio', 'fuerte'];
const esNivel = (t) => NIVELES.includes(t) || /^\d+$/u.test(t);

export const PLANTILLA = `# Lecciones

Una entrada por escalada o retrabajo, escrita con \`scripts/leccion.mjs anotar\`. Nunca se borra una
lección. Formato validado por \`scripts/verify-lessons.mjs\`: un encabezado por lección con la fecha
y el tipo, y cuatro campos (síntoma, causa, archivo, cómo evitarlo). Si la misma causa aparece 2
veces en 30 días, \`scripts/arranque.mjs\` lo avisa.
`;

const uno = (t) => String(t ?? '').replace(/\s+/gu, ' ').trim();
const normalizar = (t) => uno(t).toLowerCase();

/** Fecha de hoy en hora argentina, `DD-MM-AAAA`. */
export function hoyAR(fecha = new Date()) {
  return fechaAR(fecha).split(' ')[0];
}

export function agregarLeccion(texto, datos, hoy = hoyAR()) {
  const tipo = uno(datos.tipo);
  if (!TIPOS.includes(tipo)) return { ok: false, reason: `tipo inválido «${tipo}» (${TIPOS.join(' | ')})` };
  const sintoma = uno(datos.sintoma);
  const causa = uno(datos.causa);
  const archivo = uno(datos.archivo);
  if (sintoma === '' || causa === '' || archivo === '') return { ok: false, reason: 'sintoma, causa y archivo son obligatorios' };
  const desde = uno(datos.desde);
  const hasta = uno(datos.hasta);
  for (const [campo, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor !== '' && !esNivel(valor)) return { ok: false, reason: `--${campo} «${valor}» inválido (${NIVELES.join(' | ')} o un número)` };
  }
  const escalada = tipo === 'escalada' && desde && hasta ? `(${/^\d+$/u.test(desde) ? `peldaño ${desde}` : desde} → ${hasta}) ` : '';
  const evitar = uno(datos.evitar) || `Leer esta lección antes de tocar ${archivo}`;
  const bloque = [
    `## ${hoy} · ${tipo}`,
    '',
    `Síntoma: ${escalada}${sintoma}`,
    `Causa: ${causa}`,
    `Archivo: ${archivo}`,
    `Cómo evitarlo: ${evitar}`,
    '',
  ].join('\n');
  const nuevo = `${texto.endsWith('\n') ? texto : `${texto}\n`}\n${bloque}`;
  const violaciones = validateLessons(nuevo, { today: hoy });
  if (violaciones.length > 0) return { ok: false, reason: violaciones[0] };
  return { ok: true, texto: nuevo, numero: parseBlocks(nuevo).length };
}

const aDias = (dmy) => {
  const [d, m, a] = dmy.split('-');
  return Date.UTC(Number(a), Number(m) - 1, Number(d)) / 86400000;
};

/** Causas con ≥2 lecciones dentro de los últimos `dias` días. */
export function causasRepetidas(texto, { dias = 30, hoy = hoyAR() } = {}) {
  const grupos = new Map();
  for (const bloque of parseBlocks(texto)) {
    const h = /^## (\d{2}-\d{2}-\d{4}) · /u.exec(bloque.heading);
    if (!h) continue;
    const edad = aDias(hoy) - aDias(h[1]);
    if (!(edad >= 0 && edad <= dias)) continue;
    const causa = normalizar(parseFields(bloque).get('Causa')?.[0]?.value);
    if (causa === '') continue;
    if (!grupos.has(causa)) grupos.set(causa, []);
    grupos.get(causa).push(h[1]);
  }
  return [...grupos].filter(([, l]) => l.length >= 2).map(([causa, fechas]) => ({ causa, veces: fechas.length, fechas }));
}

function usage() {
  console.error('usage: leccion.mjs anotar --tipo escalada|retrabajo --sintoma <t> --causa <t> --archivo <ruta> [--desde <barato|medio|fuerte> --hasta <barato|medio|fuerte>] | repetidas [--dias 30]  (ambos con [--proyecto <dir>])');
  process.exit(2);
}

function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  let v;
  try {
    ({ values: v } = parseArgs({
      args: resto,
      options: {
        tipo: { type: 'string' }, sintoma: { type: 'string' }, causa: { type: 'string' }, archivo: { type: 'string' },
        desde: { type: 'string' }, hasta: { type: 'string' }, evitar: { type: 'string' }, senal: { type: 'string' },
        dias: { type: 'string' }, proyecto: { type: 'string' }, hoy: { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    usage();
  }
  const ruta = join(v.proyecto ?? process.cwd(), '.ia-stack', 'LECCIONES.md');
  const hoy = v.hoy ?? hoyAR();
  if (cmd === 'repetidas') {
    if (v.dias !== undefined && !/^\d+$/u.test(v.dias)) usage();
    const texto = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
    const rep = causasRepetidas(texto, { dias: Number(v.dias ?? 30), hoy });
    if (rep.length === 0) console.log('sin repetidas');
    for (const r of rep) console.log(`${r.causa} (${r.veces}): ${r.fechas.join(', ')}`);
    return;
  }
  if (cmd !== 'anotar' || !v.tipo || !TIPOS.includes(v.tipo) || !v.sintoma || !v.causa || !v.archivo) usage();
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : PLANTILLA;
  const r = agregarLeccion(actual, v, hoy);
  if (!r.ok) {
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, r.texto);
  console.log(`OK: lección ${r.numero} anotada en ${ruta}`);
}

if (process.argv[1] && process.argv[1].endsWith('leccion.mjs')) main();
