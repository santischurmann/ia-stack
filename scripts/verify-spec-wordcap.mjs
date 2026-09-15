#!/usr/bin/env node
// verify-spec-wordcap.mjs — mechanical enforcement of templates/spec.md's own documented word
// cap ("~650 words for this document (excl. tables/code blocks)"). That cap was prose-only —
// nothing rejected a spec that ignored it. A spec nobody reads poisons every phase that follows
// (source: research/sources/protocolo-muralla.md point #8); this makes that a real gate.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const USAGE = 'usage: verify-spec-wordcap.mjs check <spec.md> [--quality]';
export const WORD_CAP = 650;
export const QUALITY_FLAG = '--quality';

const FENCED_CODE_BLOCK = /```[\s\S]*?```/gu;
const TABLE_LINE = /^\s*\|.*\|\s*$/gmu;
const REQUIRED_SECTIONS = [
  'Problem / Problema',
  'Discovery / Investigación previa',
  'Target Users / Usuarios',
  'Acceptance Criteria / Criterios de aceptación',
  'Constraints / Restricciones',
  'Non-Goals / No-Goals',
  'Stack & Dependencies',
  'Definition of Done (DoD)',
];
/**
 * Las tres secciones que sobreviven en la via corta, y por que cada una:
 *
 *   Problem              sin esto nadie sabe por que se hizo, ni en seis meses ni manana.
 *   Acceptance Criteria  es lo que leen el test rojo, la traza de evidencia y el recibo.
 *                        Sacarlo fue exactamente lo que dejo al atajo publicitado sin salida.
 *   Definition of Done   sin esto «terminado» no quiere decir nada.
 *
 * Se caen Discovery, Target Users, Constraints, Non-Goals y Stack & Dependencies: son el
 * expediente de producto, y un cambio de tres archivos sin ambiguedad no necesita uno.
 *
 * EL RIGOR DE LOS CRITERIOS NO BAJA en via corta: misma gramatica, mismos ids unicos, mismos
 * marcadores prohibidos. Lo que se saca es la ceremonia alrededor, nunca lo que sostiene a los
 * gates de abajo.
 */
export const SECCIONES_VIA_CORTA = Object.freeze([
  'Problem / Problema',
  'Acceptance Criteria / Criterios de aceptación',
  'Definition of Done (DoD)',
]);

export const SCAVENGE_ROOT = 'docs/scavenge';
const FEATURE_TITLE = /^#[ \t]+Spec:[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$/mu;

export const SECURITY_SECTION = 'Security surface / Superficie de ataque';
export const DISCOVERY_ROOT = 'docs/discovery';
const ACCEPTANCE_LINE = /^\s*-\s*\[[ xX]\]\s*\*\*(AC\d+)(?:\s*\([^)]*\))?:\*\*.*$/gmu;
const UNRESOLVED = /\[NEEDS CLARIFICATION:/iu;
const PLACEHOLDER = /<[^>\n]+>/u;

/** Strips fenced code blocks and table rows (both excluded per the documented cap), then counts
 * whitespace-separated words in what remains. Headers/prose/lists all count — only code and
 * tables are exempt, matching the template's own stated exclusion. */
export function countSpecWords(content) {
  const withoutCode = content.replace(FENCED_CODE_BLOCK, '');
  const withoutTables = withoutCode.replace(TABLE_LINE, '');
  const words = withoutTables.split(/\s+/u).filter(Boolean);
  return words.length;
}

/**
 * Strict quality pass for an approved spec. It checks only reviewable shape: required sections,
 * non-placeholder prose, one or more unique AC ids and the documented GIVEN/WHEN/THEN (or
 * invariant) grammar. It cannot judge whether the product decision is good or whether an AC is
 * sufficient; those remain human/adversarial review.
 */
/**
 * Que via sigue esta spec. SE DERIVA DEL ARBOL, no de una bandera, por la misma razon que ya
 * estaba escrita para la seccion de seguridad: una exigencia que depende de que alguien se
 * acuerde de pasar una bandera se olvida en la primera sesion bajo presion de contexto.
 *
 * La fuente es el scavenge de esa misma funcionalidad, que ya declara su `scope`. El nombre de
 * la funcionalidad sale del titulo de la propia spec, asi que quien corre el gate tampoco puede
 * elegir la que le convenga.
 *
 * TODO CAMINO DUDOSO DEVUELVE `completa`: sin scavenge, con un scavenge ilegible, o con una spec
 * sin titulo de funcionalidad. La ausencia nunca afloja una exigencia — aflojarla seria dejar la
 * puerta abierta a conseguir la via corta borrando un archivo.
 */
export function viaDeLaSpec(content, cwd = '.', io = {}) {
  const exists = io.exists ?? existsSync;
  const read = io.read ?? ((ruta) => readFileSync(ruta, 'utf8'));
  const titulo = FEATURE_TITLE.exec(String(content ?? ''));
  if (!titulo) return 'completa';
  const ruta = join(cwd, SCAVENGE_ROOT, `${titulo[1]}.json`);
  if (!exists(ruta)) return 'completa';
  try {
    return JSON.parse(read(ruta, 'utf8')).scope === 'corto' ? 'corta' : 'completa';
  } catch {
    return 'completa';
  }
}

export function checkSpecQuality(content, { requireSecuritySurface = false, via = 'completa' } = {}) {
  const violations = [];
  if (typeof content !== 'string' || content.trim() === '') return ['spec is empty'];
  const withoutCode = content.replace(FENCED_CODE_BLOCK, '');
  // El modelo de amenaza vive en Discovery porque acá no entra: la spec tiene tope de 650 palabras.
  // Pero si el proyecto declaró una superficie, la spec tiene que NOMBRARLA — si no, el modelo
  // queda como un expediente que nadie lee desde el trabajo real. La exigencia se deriva del árbol
  // y no de una bandera que alguien tiene que acordarse de pasar.
  // La seguridad NO tiene via corta: si el proyecto declaro una superficie de ataque, la spec la
  // nombra aunque sea corta. Lo que se acorta es el expediente de producto, nunca esto.
  const base = via === 'corta' ? SECCIONES_VIA_CORTA : REQUIRED_SECTIONS;
  const sections = requireSecuritySurface ? [...base, SECURITY_SECTION] : base;
  for (const section of sections) {
    const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (!new RegExp(`^##\\s+${escapedSection}\\s*$`, 'mu').test(withoutCode)) {
      violations.push(`missing required section: ${section}`);
    }
  }
  if (UNRESOLVED.test(withoutCode)) violations.push('unresolved [NEEDS CLARIFICATION: ...] marker remains');
  if (PLACEHOLDER.test(withoutCode)) violations.push('placeholder angle-bracket text remains outside code blocks');
  const matches = [...withoutCode.matchAll(ACCEPTANCE_LINE)];
  if (matches.length === 0) {
    violations.push('no acceptance criterion with an AC id was found');
  }
  const seen = new Set();
  for (const match of matches) {
    const id = match[1];
    if (seen.has(id)) violations.push(`duplicate acceptance criterion id: ${id}`);
    seen.add(id);
    const line = match[0];
    if (!(/\bGIVEN\b[\s\S]*\bWHEN\b[\s\S]*\bTHEN\b/iu.test(line) || /\bTHE SYSTEM SHALL\b/iu.test(line))) {
      violations.push(`${id} must use GIVEN/WHEN/THEN or THE SYSTEM SHALL grammar`);
    }
  }
  return violations;
}

/** ¿Este proyecto declaró alguna superficie de ataque? Se pregunta al ÁRBOL, no a una bandera que
 * alguien tiene que acordarse de pasar: una exigencia que depende de recordarla se olvida en la
 * primera sesión bajo presión de contexto, que es lo que este protocolo ya tiene escrito. */
export function hasThreatModel(root = DISCOVERY_ROOT, { exists = existsSync, list = readdirSync } = {}) {
  if (!exists(root)) return false;
  return list(root).some((slug) => exists(join(root, slug, 'diagnostics', 'threat.json')));
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const readFile = options.readFile ?? readFileSync;
  const quality = args.includes(QUALITY_FLAG);
  const rest = args.filter((arg) => arg !== QUALITY_FLAG);
  if (rest.length !== 2 || rest[0] !== 'check' || rest[1] === '') {
    writeError(USAGE);
    return 2;
  }
  const path = rest[1];
  let content;
  try {
    content = readFile(path, 'utf8');
  } catch (error) {
    writeError(`REJECTED: unable to read ${path}: ${error.message}`);
    return 1;
  }
  const count = countSpecWords(content);
  if (count > WORD_CAP) {
    writeError(`REJECTED: ${path} is ${count} words (excl. tables/code blocks), over the ${WORD_CAP}-word cap — trim narration, a spec nobody reads poisons every phase that follows.`);
    return 1;
  }
  // La via sale del arbol: del `scope` que declaro el scavenge de esta misma funcionalidad. Se
  // calcula incluso sin `--quality` para poder DECIRLA en la salida: quien lee el verde tiene que
  // saber contra que listado se comprobo, o dos verdes que dicen lo mismo significan cosas distintas.
  const via = (options.viaDeLaSpec ?? viaDeLaSpec)(content, options.cwd ?? '.', options.io ?? {});

  if (quality) {
    const violations = checkSpecQuality(content, {
      requireSecuritySurface: (options.hasThreatModel ?? hasThreatModel)(),
      via,
    });
    if (violations.length > 0) {
      for (const item of violations) writeError(`REJECTED: ${path} quality (vía ${via}): ${item}`);
      if (via === 'completa') {
        writeError(`REJECTED: si esto es un cambio chico, la vía corta pide tres secciones en vez de ocho — y se activa declarando \`scope: "corto"\` en docs/scavenge/<feature-slug>.json, no con una bandera.`);
      }
      return 1;
    }
  }
  write(`OK: ${path} is ${count}/${WORD_CAP} words (excl. tables/code blocks)${quality ? `; quality shape valid (vía ${via})` : ''}.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-spec-wordcap.mjs')) {
  process.exitCode = main();
}
