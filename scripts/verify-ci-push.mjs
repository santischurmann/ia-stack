#!/usr/bin/env node
// verify-ci-push.mjs — gate 8: el CI corre cuando hay algo que publicar, no con cada push (IA Stack 3.4.5).
//
// Usage:
//   node scripts/verify-ci-push.mjs check [--workflows .github/workflows] [--principal main,master]
//
// Falla (exit 1) si algún workflow dispara en `push` a ramas que no sean la principal (ni siquiera con
// `branches-ignore`, que equivale a «todas las demás») o si declara `schedule`. Acepta `push` a
// main/master, `pull_request`, `workflow_dispatch` y `push` de tags. Exit 2 por uso incorrecto.
//
// LÍMITE HONESTO: es un parser de YAML por líneas, no un parser de YAML. Lee el bloque `on:` en sus formas
// habituales (escalar, lista, mapa en bloque y mapa en línea). Anclas, alias o expresiones fuera de esas
// formas no las entiende y NO las da por buenas: un `on:` que no puede interpretar sale rojo. Tampoco ve
// quién dispara un workflow a mano (`workflow_dispatch`) ni cuántas veces se pushea a main.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const PRINCIPALES = ['main', 'master'];

const sinComillas = (t) => t.trim().replace(/^(["'])(.*)\1$/u, '$2');

/** Parte `texto` por `sep` ignorando lo que esté dentro de [], {} o comillas. */
function partirTop(texto, sep = ',') {
  const partes = [];
  let nivel = 0;
  let comilla = null;
  let actual = '';
  for (const c of texto) {
    if (comilla) {
      if (c === comilla) comilla = null;
    } else if (c === '"' || c === "'") comilla = c;
    else if (c === '[' || c === '{') nivel += 1;
    else if (c === ']' || c === '}') nivel -= 1;
    else if (c === sep && nivel === 0) {
      partes.push(actual);
      actual = '';
      continue;
    }
    actual += c;
  }
  if (actual.trim() !== '') partes.push(actual);
  return partes.map((p) => p.trim()).filter((p) => p !== '');
}

const quitarEnvoltura = (t) => t.trim().replace(/^[[{]/u, '').replace(/[\]}]$/u, '');

function valores(texto) {
  const t = texto.trim();
  if (t === '') return [];
  return t.startsWith('[') ? partirTop(quitarEnvoltura(t)).map(sinComillas) : [sinComillas(t)];
}

function lineasLimpias(texto) {
  return texto.split(/\r?\n/u)
    .map((l) => l.replace(/(^|\s)#.*$/u, '').replace(/\s+$/u, ''))
    .filter((l) => l.trim() !== '')
    .map((l) => ({ indent: l.length - l.trimStart().length, texto: l.trim() }));
}

const CLAVE = /^("[^"]+"|'[^']+'|[\w.-]+)\s*:\s*(.*)$/u;

/** Mapa clave → valores[] a partir de un mapa en línea (`inline`) y/o un cuerpo en bloque. */
function mapaDe(inline, cuerpo) {
  const mapa = new Map();
  if (inline.trim().startsWith('{')) {
    for (const entrada of partirTop(quitarEnvoltura(inline))) {
      const m = CLAVE.exec(entrada);
      if (m) mapa.set(sinComillas(m[1]), m[2].trim().startsWith('{') ? [] : valores(m[2]));
    }
  }
  if (cuerpo.length === 0) return mapa;
  const base = cuerpo[0].indent;
  for (let i = 0; i < cuerpo.length; i += 1) {
    const l = cuerpo[i];
    if (l.indent !== base) continue;
    const m = CLAVE.exec(l.texto);
    if (!m) continue;
    const clave = sinComillas(m[1]);
    if (m[2].trim() !== '') {
      mapa.set(clave, valores(m[2]));
      continue;
    }
    const items = [];
    for (let j = i + 1; j < cuerpo.length && cuerpo[j].indent > base; j += 1) {
      if (cuerpo[j].texto.startsWith('-')) items.push(sinComillas(cuerpo[j].texto.slice(1)));
    }
    mapa.set(clave, items);
  }
  return mapa;
}

/** Eventos de `on:` como Map nombre → {inline, cuerpo}; null si el formato no se entiende. */
function eventosDe(lineas) {
  const i = lineas.findIndex((l) => l.indent === 0 && /^("on"|'on'|on)\s*:/u.test(l.texto));
  if (i === -1) return null;
  const resto = lineas[i].texto.replace(/^("on"|'on'|on)\s*:/u, '').trim();
  const eventos = new Map();
  if (resto.startsWith('{')) {
    for (const entrada of partirTop(quitarEnvoltura(resto))) {
      const m = CLAVE.exec(entrada);
      if (!m) return null;
      eventos.set(sinComillas(m[1]), { inline: m[2], cuerpo: [] });
    }
    return eventos;
  }
  if (resto !== '') {
    for (const nombre of valores(resto)) eventos.set(nombre, { inline: '', cuerpo: [] });
    return eventos;
  }
  const hijos = [];
  for (let j = i + 1; j < lineas.length && lineas[j].indent > 0; j += 1) hijos.push(lineas[j]);
  if (hijos.length === 0) return null;
  const base = hijos[0].indent;
  for (let j = 0; j < hijos.length; j += 1) {
    if (hijos[j].indent !== base) continue;
    if (hijos[j].texto.startsWith('-')) {
      eventos.set(sinComillas(hijos[j].texto.slice(1).split(':')[0]), { inline: '', cuerpo: [] });
      continue;
    }
    const m = CLAVE.exec(hijos[j].texto);
    if (!m) return null;
    const cuerpo = [];
    for (let k = j + 1; k < hijos.length && hijos[k].indent > base; k += 1) cuerpo.push(hijos[k]);
    eventos.set(sinComillas(m[1]), { inline: m[2], cuerpo });
  }
  return eventos;
}

export function analizarWorkflow(texto, { principales = PRINCIPALES } = {}) {
  const eventos = eventosDe(lineasLimpias(texto));
  if (eventos === null || eventos.size === 0) {
    return { problemas: ['no se pudo leer el bloque on: (formato no soportado o ausente)'] };
  }
  const problemas = [];
  if (eventos.has('schedule')) problemas.push('declara schedule: un cron corre sin que haya nada que publicar');
  if (eventos.has('push')) {
    const { inline, cuerpo } = eventos.get('push');
    const mapa = mapaDe(inline, cuerpo);
    if (mapa.has('branches-ignore')) {
      problemas.push('push con branches-ignore: dispara en todas las ramas menos las ignoradas');
    } else if (mapa.has('branches')) {
      const otras = mapa.get('branches').filter((b) => !principales.includes(b));
      if (otras.length > 0) problemas.push(`push dispara en ramas que no son la principal: ${otras.join(', ')}`);
    } else if (!mapa.has('tags')) {
      problemas.push('push sin branches ni tags: dispara en todas las ramas');
    }
  }
  return { problemas };
}

function usage() {
  console.error('usage: verify-ci-push.mjs check [--workflows .github/workflows] [--principal main,master]');
  process.exit(2);
}

function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  let v;
  try {
    ({ values: v } = parseArgs({ args: resto, options: { workflows: { type: 'string' }, principal: { type: 'string' } }, strict: true }));
  } catch {
    usage();
  }
  if (cmd !== 'check') usage();
  const dir = v.workflows ?? join('.github', 'workflows');
  const principales = v.principal ? v.principal.split(',').map((p) => p.trim()).filter(Boolean) : PRINCIPALES;
  if (!existsSync(dir)) {
    console.log(`VACÍO: no hay carpeta ${dir}. Esto no verificó nada.`);
    return;
  }
  const archivos = readdirSync(dir).filter((f) => /\.ya?ml$/iu.test(f)).sort();
  let fallas = 0;
  for (const f of archivos) {
    for (const p of analizarWorkflow(readFileSync(join(dir, f), 'utf8'), { principales }).problemas) {
      console.error(`REJECTED: ${f}: ${p}`);
      fallas += 1;
    }
  }
  if (fallas > 0) process.exit(1);
  console.log(`OK: ${archivos.length} workflow(s) sin push a ramas de trabajo ni schedule`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-ci-push.mjs')) main();
