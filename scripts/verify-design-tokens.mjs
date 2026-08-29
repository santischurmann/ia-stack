#!/usr/bin/env node
// verify-design-tokens.mjs — gate mecanico del sistema de diseno de VCP.
//
//   node scripts/verify-design-tokens.mjs check <design-tokens.json>
//
// Las reglas de diseno eran convencion sin detector, que es lo que este proyecto llama decoracion.
// El prestamo de shadcn/ui no es su stack -React, Tailwind y Radix son justo lo que VCP no puede
// tener, porque su contrato declara cero dependencias- sino su modelo: el sistema de diseno como
// contrato declarado que una maquina revisa.
//
// Seis reglas, todas mecanicas:
//   1. Cada token que el contrato declara existe en el bloque claro.
//   2. Ningun token vive solo en un bloque oscuro. El lector tiene TRES estados de tema, no dos:
//      claro estampado, oscuro estampado, y el default del sistema, que no estampa nada. Un color
//      definido unicamente bajo un selector oscuro no aplica jamas en ese tercer estado, y la
//      pagina termina pintando el texto de un tema sobre el fondo del otro.
//   3. Los dos bloques oscuros coinciden. La duplicacion es estructural -hacen falta los dos- pero
//      editar uno solo es hoy un cambio invisible.
//   4. Cada superficie trae su color de texto emparejado, la regla de shadcn: `X` con
//      `X-foreground`, para que pintar un fondo nunca herede el texto del tema anterior.
//   5. Ningun color literal fuera de los bloques de tokens: un color suelto no participa del tema.
//   6. El body fija su fondo desde el token declarado. Un body transparente hereda el fondo del
//      anfitrion, que puede estar en el otro tema.
//
// LO QUE NO PRUEBA, y hay que decirlo antes de que alguien lo tome por una revision de diseno:
// comprueba que los tokens existan, coincidan y esten emparejados. NO mide contraste, no juzga si
// un color es legible sobre otro, y no sabe si la pagina se ve bien. Dos tokens que cumplen todas
// las reglas de aca pueden ser gris sobre gris.
//
// Lee el CSS con expresiones regulares, no con un parser: un token definido adentro de una at-rule
// que este gate no conoce, o un archivo minificado, le son invisibles. Un token invisible se
// reporta como faltante -falla cerrado-, nunca como presente. Y solo detecta colores en
// hexadecimal o en notacion funcional (rgb/hsl/oklch/lab/lch): un `red` escrito con su nombre
// pasa, porque distinguirlo de `inherit` o `currentColor` sin un parser da falsos positivos.

import { readFileSync } from 'node:fs';

export const USAGE = 'usage: verify-design-tokens.mjs check <design-tokens.json>';
export const SCHEMA = 'vcp.design-tokens/v1';

/** Los tres estados de tema del lector. El default del sistema no estampa nada, asi que un color
 * que solo existe en un bloque oscuro no aplica nunca ahi. */
export const LIGHT = 'light';
export const DARK_MEDIA = 'dark-media';
export const DARK_STAMPED = 'dark-stamped';

const STATE_LABEL = new Map([
  [LIGHT, 'claro (:root)'],
  [DARK_MEDIA, 'oscuro por preferencia del sistema'],
  [DARK_STAMPED, 'oscuro estampado (data-theme="dark")'],
]);

const ROOT_BLOCK = /(:root(?:\[[^\]]*\])?(?::not\([^)]*\))?)\s*\{([^}]*)\}/gu;
const DECLARATION = /--([A-Za-z0-9-]+)\s*:\s*([^;]+);/gu;
const ANY_DECLARATION = /([a-zA-Z-]+)\s*:\s*([^;{}]+)[;}]/gu;
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/u;

export function parseArgs(args) {
  if (args.length === 2 && args[0] === 'check' && args[1] !== '') return { contract: args[1] };
  return null;
}

export function readContract(path, readFile = readFileSync) {
  let document;
  try {
    document = JSON.parse(readFile(path, 'utf8'));
  } catch (error) {
    return { document: null, error: `no se puede leer ${path} como JSON: ${error.message}` };
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { document: null, error: `${path} no es un objeto` };
  }
  if (document.schema !== SCHEMA) {
    return { document: null, error: `${path} declara schema ${JSON.stringify(document.schema)}, se esperaba ${SCHEMA}` };
  }
  if (!Array.isArray(document.surfaces) || document.surfaces.length === 0) {
    return { document: null, error: `${path} no declara ninguna superficie en "surfaces"` };
  }
  return { document, error: null };
}

/** Cual de los tres estados de tema define este selector, o null si no define ninguno. */
export function classifyBlock(selector) {
  const normalized = selector.trim();
  if (normalized === ':root') return LIGHT;
  if (/^:root:not\(\[data-theme=["']?light["']?\]\)$/u.test(normalized)) return DARK_MEDIA;
  if (/^:root\[data-theme=["']?dark["']?\]$/u.test(normalized)) return DARK_STAMPED;
  return null;
}

export function extractTokenBlocks(css) {
  const blocks = [];
  for (const match of css.matchAll(ROOT_BLOCK)) {
    const state = classifyBlock(match[1]);
    if (state === null) continue;
    const tokens = new Map();
    for (const declaration of match[2].matchAll(DECLARATION)) tokens.set(declaration[1], declaration[2].trim());
    if (tokens.size === 0) continue;
    blocks.push({ selector: match[1].trim(), state, tokens, raw: match[0] });
  }
  return blocks;
}

/** Colores escritos fuera de los bloques que definen tokens: no participan del tema, así que se
 * ven bien en uno y mal en el otro sin que nada lo delate. */
export function findLooseColors(css, blocks) {
  let rest = css;
  for (const block of blocks) rest = rest.replace(block.raw, '');
  const loose = [];
  for (const declaration of rest.matchAll(ANY_DECLARATION)) {
    const value = declaration[2];
    const hit = value.match(COLOR_LITERAL);
    if (hit) loose.push(`${declaration[1].trim()}: ${value.trim()}`);
  }
  return loose;
}

/** Un font-size que no sale de la rampa declarada. Los relativos (`em`, `%`, `rem`) quedan fuera de
 * la regla: son proporcionales por definicion, asi que no rompen el ritmo, lo heredan. */
export function findScaleBreaks(css, scale, property, label) {
  if (!Array.isArray(scale) || scale.length === 0) return [];
  const allowed = new Set(scale.map((entry) => entry.trim()));
  const breaks = [];
  const pattern = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;{}]+)[;}]`, 'gu');
  for (const declaration of css.matchAll(pattern)) {
    for (const part of declaration[1].trim().split(/\s+(?![^(]*\))/u)) {
      const value = part.trim();
      if (value === '' || allowed.has(value)) continue;
      if (/^-?[\d.]+(?:em|rem|ch|%|vw|vh)$/u.test(value)) continue;
      if (/^(?:inherit|initial|unset|revert|auto|none|normal)$/u.test(value)) continue;
      breaks.push(`${value} (en ${property})`);
    }
  }
  return breaks.map((entry) => `${label}: ${entry}`);
}

/** Firmas de diseno generico, declaradas como datos revisables en el contrato. El gate detecta la
 * firma; no puede juzgar si un diseno es bueno. */
export function findSlopSignatures(html, signatures) {
  const hits = [];
  for (const signature of signatures ?? []) {
    let pattern;
    try {
      pattern = new RegExp(signature.pattern, 'iu');
    } catch {
      hits.push(`firma ${signature.id}: su patrón no compila como expresión regular`);
      continue;
    }
    if (pattern.test(html)) hits.push(`firma de diseño genérico ${signature.id} — ${signature.why}`);
  }
  return hits;
}

export function findViolations(surface, html, slopSignatures = []) {
  const violations = [];
  const at = surface.file;
  const blocks = extractTokenBlocks(html);
  const byState = new Map(blocks.map((block) => [block.state, block]));

  for (const [state, label] of STATE_LABEL) {
    if (!byState.has(state)) violations.push(`${at}: falta el bloque de tokens ${label}`);
  }

  const light = byState.get(LIGHT);
  const darkMedia = byState.get(DARK_MEDIA);
  const darkStamped = byState.get(DARK_STAMPED);

  if (light) {
    for (const token of surface.tokens ?? []) {
      if (!light.tokens.has(token)) {
        violations.push(`${at}: --${token} está declarado en el contrato y no está definido en el bloque claro`);
      }
    }
    if (surface.radius_base && !light.tokens.has(surface.radius_base)) {
      violations.push(`${at}: falta el token de radio base --${surface.radius_base} en el bloque claro, que es la única fuente de verdad de las esquinas`);
    }
    for (const [background, foreground] of surface.pairs ?? []) {
      if (!light.tokens.has(foreground)) {
        violations.push(`${at}: la superficie --${background} no trae su color de texto --${foreground}: pintar ese fondo hereda el texto del tema anterior`);
      }
    }
    for (const block of [darkMedia, darkStamped]) {
      if (!block) continue;
      for (const token of block.tokens.keys()) {
        if (!light.tokens.has(token)) {
          violations.push(`${at}: --${token} sólo existe en ${block.selector} y no en el bloque claro: en el estado por defecto del sistema no aplica nunca`);
        }
      }
    }
  }

  if (darkMedia && darkStamped) {
    const names = new Set([...darkMedia.tokens.keys(), ...darkStamped.tokens.keys()]);
    for (const name of [...names].sort()) {
      const inMedia = darkMedia.tokens.get(name);
      const inStamped = darkStamped.tokens.get(name);
      if (inMedia === undefined || inStamped === undefined) {
        violations.push(`${at}: --${name} está en uno de los dos bloques oscuros y no en el otro; editar uno solo es un cambio invisible`);
      } else if (inMedia !== inStamped) {
        violations.push(`${at}: --${name} vale ${inMedia} en el bloque oscuro por preferencia y ${inStamped} en el estampado`);
      }
    }
  }

  for (const loose of findLooseColors(html, blocks)) {
    violations.push(`${at}: color fuera del sistema de tokens — ${loose}`);
  }

  for (const outOfRamp of findScaleBreaks(html, surface.type_scale, 'font-size', 'tamaño fuera de la rampa tipográfica declarada')) {
    violations.push(`${at}: ${outOfRamp}`);
  }
  for (const property of ['padding', 'margin', 'gap', 'row-gap', 'column-gap']) {
    for (const outOfRhythm of findScaleBreaks(html, surface.space_scale, property, 'espaciado fuera del ritmo declarado')) {
      violations.push(`${at}: ${outOfRhythm}`);
    }
  }
  for (const slop of findSlopSignatures(html, slopSignatures)) {
    violations.push(`${at}: ${slop}`);
  }

  if (surface.body_background_token) {
    const body = html.match(/(?:^|[\s},])body\s*\{([^}]*)\}/u);
    const token = surface.body_background_token;
    const declared = body && new RegExp(`background(?:-color)?\\s*:\\s*[^;]*var\\(\\s*--${token}\\b`, 'u').test(body[1]);
    if (!declared) {
      violations.push(`${at}: el body no fija su fondo con var(--${token}); un body transparente hereda el fondo del anfitrión, que puede estar en el otro tema`);
    }
  }

  return violations;
}

export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const readFile = options.readFile ?? readFileSync;
  const { document, error } = readContract(parsed.contract, readFile);
  if (error !== null) {
    writeError(`REJECTED: DESIGN_TOKENS_CONTRACT_INVALID: ${error}`);
    return 1;
  }
  const violations = [];
  let checked = 0;
  for (const surface of document.surfaces) {
    let html;
    try {
      html = String(readFile(surface.file, 'utf8'));
    } catch (readError) {
      violations.push(`${surface.file}: no se puede leer la superficie declarada: ${readError.message}`);
      continue;
    }
    violations.push(...findViolations(surface, html, document.slop_signatures));
    checked += 1;
  }
  if (violations.length > 0) {
    writeError(`REJECTED: DESIGN_TOKENS_VIOLATION:\n  ${violations.join('\n  ')}`);
    return 1;
  }
  write(`OK: ${checked} superficie(s) cumplen el contrato de diseño: tokens completos en los tres estados de tema, los dos bloques oscuros coinciden, cada superficie con su color de texto emparejado y ningún color fuera del sistema. Verifica forma y coherencia, nunca contraste ni legibilidad.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-design-tokens.mjs')) {
  process.exitCode = main();
}
