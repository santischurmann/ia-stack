#!/usr/bin/env node
// contraste.mjs — relación de contraste WCAG 2.x entre dos colores hex (IA Stack 3.4.5).
//
// Usage: node scripts/contraste.mjs <hex> <hex>      (#rrggbb, rrggbb, #rgb)
// Imprime la relación (p. ej. 4,54:1). Exit 0 si llega a 4,5:1 (texto normal), 1 si no, 2 si el uso es incorrecto.
//
// LÍMITE HONESTO: mide dos colores planos. No sabe si el texto va sobre una imagen, un degradé o un
// estado hover, ni el tamaño de la letra (el texto grande admite 3:1; acá siempre se pide 4,5).

export const MINIMO = 4.5;

function canales(hex) {
  let h = String(hex ?? '').trim().replace(/^#/u, '');
  if (/^[0-9a-f]{3}$/iu.test(h)) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/iu.test(h)) throw new Error(`«${hex}» no es un color hex (#rrggbb o #rgb)`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

/** Luminancia relativa WCAG. */
export function luminancia(hex) {
  const [r, g, b] = canales(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste (1 a 21), sin importar el orden. */
export function relacion(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function main() {
  const [a, b, ...resto] = process.argv.slice(2);
  if (a === undefined || b === undefined || resto.length > 0) {
    console.error('usage: contraste.mjs <hex> <hex>');
    process.exit(2);
  }
  let r;
  try {
    r = relacion(a, b);
  } catch (e) {
    console.error(`usage: ${e.message}`);
    process.exit(2);
  }
  const texto = r.toFixed(2).replace('.', ',');
  const llega = r >= MINIMO;
  console.log(`${texto}:1 ${llega ? 'llega' : 'NO llega'} a ${String(MINIMO).replace('.', ',')}:1`);
  process.exit(llega ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('contraste.mjs')) main();
