#!/usr/bin/env node
// tamano.mjs — clasifica el trabajo en chico | medio | grande y dice qué fases recorrer (IA Stack 3.4.5).
//
// Usage:
//   node scripts/tamano.mjs --archivos <n> [--pantalla-nueva] [--proyecto-nuevo] [--riesgo plata|seguridad|auth|migracion]
//   node scripts/tamano.mjs --diff <base> [--proyecto <dir>]
//
// Reglas en contracts/tamano.json. Un dato faltante o inválido da el tamaño mayor, nunca el menor.
// LÍMITE HONESTO: clasifica lo que se declara; no sabe si el riesgo o la pantalla nueva se omitieron.
// Con --diff cuenta archivos del diff real, pero no ve pantallas ni riesgos: sólo puede delatar que
// el alcance creció más allá de lo declarado en ESTADO.md.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseEstado } from './estado.mjs';

const contrato = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'tamano.json'), 'utf8'));
const ORDEN = contrato.orden;

export function clasificarTamano({ archivos, pantallaNueva = false, proyectoNuevo = false, riesgo } = {}) {
  if (proyectoNuevo) return 'grande';
  if (!Number.isInteger(archivos) || archivos < 0) return contrato.reglas.dato_faltante;
  const chico = archivos <= contrato.reglas.chico_max_archivos && !pantallaNueva && !riesgo;
  return chico ? 'chico' : 'medio';
}

export function fasesDe(tamano) {
  const fases = contrato.recorrido[tamano];
  if (!fases) throw new Error(`tamaño desconocido: ${tamano}`);
  return [...fases];
}

/** true si `real` es mayor que `declarado`. */
export function excede(declarado, real) {
  return ORDEN.indexOf(real) > ORDEN.indexOf(declarado);
}

function usage() {
  console.error('usage: tamano.mjs --archivos <n> [--pantalla-nueva] [--proyecto-nuevo] [--riesgo plata|seguridad|auth|migracion] | --diff <base> [--proyecto <dir>]');
  process.exit(2);
}

function modoDiff(base, proyecto) {
  let declarado;
  try {
    declarado = parseEstado(readFileSync(join(proyecto, '.ia-stack', 'ESTADO.md'), 'utf8')).tamano;
  } catch {
    declarado = null;
  }
  if (!declarado) {
    console.error('REJECTED: sin tamaño declarado en .ia-stack/ESTADO.md');
    process.exit(1);
  }
  const g = spawnSync('git', ['diff', '--name-only', base], { cwd: proyecto, encoding: 'utf8' });
  if (g.status !== 0) {
    console.error(`REJECTED: git diff ${base} falló: ${(g.stderr ?? '').trim()}`);
    process.exit(1);
  }
  const archivos = g.stdout.split(/\r?\n/u).filter((l) => l !== '').length;
  const real = clasificarTamano({ archivos });
  if (excede(declarado, real)) {
    console.error(`REJECTED: el diff toca ${archivos} archivos (${real}) y ESTADO.md declara ${declarado}: re-clasificar`);
    process.exit(1);
  }
  console.log(`OK: ${archivos} archivos en el diff, dentro de lo declarado (${declarado})`);
}

function main() {
  let v;
  try {
    ({ values: v } = parseArgs({
      args: process.argv.slice(2),
      options: {
        archivos: { type: 'string' },
        'pantalla-nueva': { type: 'boolean' },
        'proyecto-nuevo': { type: 'boolean' },
        riesgo: { type: 'string' },
        diff: { type: 'string' },
        proyecto: { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    usage();
  }
  if (v.diff !== undefined) return modoDiff(v.diff, v.proyecto ?? process.cwd());
  if (v.riesgo !== undefined && !contrato.reglas.riesgos.includes(v.riesgo)) usage();
  let archivos;
  if (v.archivos !== undefined) {
    if (!/^\d+$/u.test(v.archivos)) usage();
    archivos = Number(v.archivos);
  }
  const t = clasificarTamano({ archivos, pantallaNueva: v['pantalla-nueva'], proyectoNuevo: v['proyecto-nuevo'], riesgo: v.riesgo });
  console.log(`${t}\nfases: ${fasesDe(t).join(' ')}`);
}

if (process.argv[1] && process.argv[1].endsWith('tamano.mjs')) main();
