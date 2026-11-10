#!/usr/bin/env node
// radar-stack.mjs — última versión ESTABLE de paquetes npm y PyPI (IA Stack 3.4.4, fase de stack).
//
// Usage:
//   node scripts/radar-stack.mjs [--json] [--dias-minimos 14] npm:<paquete> pypi:<paquete> ...
//
// Consulta registry.npmjs.org y pypi.org. Descarta prereleases (alpha, beta, rc, dev, canary, next, pre),
// versiones retiradas (deprecated / yanked) y versiones publicadas hace menos de `--dias-minimos` días
// (14 por defecto: una versión recién salida todavía no la probó nadie). Exit 0 ok, 1 si algún paquete
// quedó «sin dato», 2 uso incorrecto.
// LÍMITE HONESTO: "estable" es la ausencia de marcas de prerelease más la antigüedad; no sabe si una
// versión vieja tiene una vulnerabilidad publicada. Ante un error de red NO inventa una versión.

import { parseArgs } from 'node:util';
import { fechaAR } from './estado.mjs';

const PRERELEASE = /(^|[-.+_])(alpha|beta|rc|dev|canary|next|pre|preview)/iu;
const PRERELEASE_PYPI = /\d(a|b|rc)\d*([.+-]|$)/iu;
const NOMBRE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/iu;
const DIA = 86400000;

export function esPrerelease(version) {
  return PRERELEASE.test(version) || PRERELEASE_PYPI.test(version);
}

export function compararVersiones(a, b) {
  const x = a.split(/[.+-]/u).map((p) => parseInt(p, 10) || 0);
  const y = b.split(/[.+-]/u).map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Función pura: `versiones` = [{version, fecha ISO, retirada?}]. Devuelve la más alta elegible o null. */
export function elegirEstable(versiones, { ahora = new Date(), diasMinimos = 14 } = {}) {
  const elegibles = versiones.filter((v) => {
    if (v.retirada || esPrerelease(v.version)) return false;
    const t = Date.parse(v.fecha);
    return Number.isFinite(t) && ahora.getTime() - t >= diasMinimos * DIA;
  });
  if (elegibles.length === 0) return null;
  return elegibles.reduce((mejor, v) => (compararVersiones(v.version, mejor.version) > 0 ? v : mejor));
}

export function versionesNpm(doc) {
  const meta = doc?.versions ?? {};
  return Object.entries(doc?.time ?? {})
    .filter(([version]) => version in meta)
    .map(([version, fecha]) => ({ version, fecha, retirada: Boolean(meta[version]?.deprecated) }));
}

export function versionesPypi(doc) {
  return Object.entries(doc?.releases ?? {})
    .filter(([, archivos]) => Array.isArray(archivos) && archivos.length > 0)
    .map(([version, archivos]) => ({
      version,
      fecha: archivos[0].upload_time_iso_8601 ?? archivos[0].upload_time,
      retirada: archivos.every((a) => a.yanked === true),
    }));
}

const FUENTES = {
  npm: { url: (p) => `https://registry.npmjs.org/${p.startsWith('@') ? p.replace('/', '%2F') : p}`, versiones: versionesNpm },
  pypi: { url: (p) => `https://pypi.org/pypi/${p}/json`, versiones: versionesPypi },
};

export async function fetchJsonReal(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function parseSpec(spec) {
  const i = spec.indexOf(':');
  const eco = spec.slice(0, i);
  const nombre = spec.slice(i + 1);
  if (i < 1 || !FUENTES[eco] || !NOMBRE.test(nombre)) return null;
  return { eco, nombre };
}

export async function consultar(specs, { fetchJson = fetchJsonReal, ahora = new Date(), diasMinimos = 14 } = {}) {
  return Promise.all(specs.map(async (spec) => {
    const { eco, nombre } = parseSpec(spec);
    try {
      const doc = await fetchJson(FUENTES[eco].url(nombre));
      const elegida = elegirEstable(FUENTES[eco].versiones(doc), { ahora, diasMinimos });
      if (!elegida) return { spec, version: null, fecha: null, error: `ninguna versión estable de ${diasMinimos}+ días` };
      return { spec, version: elegida.version, fecha: elegida.fecha, error: null };
    } catch (error) {
      return { spec, version: null, fecha: null, error: error.message };
    }
  }));
}

const USAGE = 'usage: radar-stack.mjs [--json] [--dias-minimos 14] npm:<paquete> pypi:<paquete> ...';

export async function main(args = process.argv.slice(2), io = {}) {
  const write = io.write ?? console.log;
  const writeError = io.writeError ?? console.error;
  let parsed;
  try {
    parsed = parseArgs({ args, options: { json: { type: 'boolean' }, 'dias-minimos': { type: 'string' } }, allowPositionals: true, strict: true });
  } catch {
    writeError(USAGE);
    return 2;
  }
  const dias = parsed.values['dias-minimos'];
  if ((dias !== undefined && !/^\d+$/u.test(dias)) || parsed.positionals.length === 0 || parsed.positionals.some((s) => !parseSpec(s))) {
    writeError(USAGE);
    return 2;
  }
  const resultados = await consultar(parsed.positionals, { fetchJson: io.fetchJson, ahora: io.ahora, diasMinimos: dias === undefined ? 14 : Number(dias) });
  if (parsed.values.json) {
    write(JSON.stringify(resultados, null, 2));
  } else {
    for (const r of resultados) {
      write(r.version ? `${r.spec} ${r.version} (${fechaAR(new Date(r.fecha)).split(' ')[0]})` : `${r.spec} sin dato (${r.error})`);
    }
  }
  return resultados.every((r) => r.version) ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('radar-stack.mjs')) process.exitCode = await main();
