// El protocolo se parte en un nucleo corto y un archivo por fase, y ningun gate se pierde en el corte.
//
// POR QUE EXISTE. SKILL.md de la 3.4.0 pesa 165 KB y se relee entero en cada turno de cada sesion.
// Partirlo en nucleo + phases/NN-*.md baja ese costo, pero un corte a mano puede dejar un comando de
// gate sin la fase donde se ejecuta, o duplicarlo en otra. El inventario de la 3.4.0 queda congelado
// en tests/fixtures/gates-3.4.0.json y esta prueba compara el protocolo partido contra el.
//
// QUE FIJA: SKILL.md <= 20 KB; cada comando de gate (node .vibe/ia-stack-runtime/scripts/<x>.mjs
// <subcomando>, y los envoltorios verify-red.sh/.ps1) suma las mismas ocurrencias que en la 3.4.0;
// cada uno vive solo en los archivos donde vivia; existen los 13 archivos phases/NN-*.md y el MAPA DE
// LECTURA los nombra; y la API de scripts/protocolo.mjs (leerProtocolo, archivosProtocolo).
//
// LO QUE NO CUBRE: que el texto movido conserve el sentido, ni que el agente lea la fase correcta en
// el momento correcto. Cuenta invocaciones, no las interpreta. Los parrafos largos de las leyes van a
// phases/00-reglas-extendidas.md y quedan fuera del conteo de gates (no llevan comandos).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { archivosProtocolo, leerProtocolo } from '../scripts/protocolo.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const fixture = JSON.parse(leer('tests/fixtures/gates-3.4.0.json'));

const FASES = Object.freeze([
  'phases/01-bootstrap.md', 'phases/02-intake.md', 'phases/03-research.md', 'phases/04-spec.md',
  'phases/05-plan.md', 'phases/06-build.md', 'phases/07-triangulate.md', 'phases/08-test.md',
  'phases/09-simplify.md', 'phases/10-deploy.md', 'phases/11-limpieza.md', 'phases/12-menus-y-memoria.md',
  'phases/00-reglas-extendidas.md',
]);

// Misma normalizacion que uso el script que genero el fixture: script + primer argumento no-flag.
const RE = /ia-stack-runtime\/scripts\/([\w-]+\.(?:mjs|sh|ps1))(?:\s+(?!-)(['"]?)([\w.:-]+)\2)?/g;
function contar(texto) {
  const cuenta = {};
  for (const m of texto.matchAll(RE)) {
    const sub = m[1].endsWith('.mjs') && m[3] && /^[a-z][\w-]*$/.test(m[3]) ? ` ${m[3]}` : '';
    const clave = m[1] + sub;
    cuenta[clave] = (cuenta[clave] ?? 0) + 1;
  }
  return cuenta;
}
const archivosLeidos = () => ['SKILL.md', ...FASES].filter((f) => existsSync(join(raiz, f)));

test('el fixture de la 3.4.0 tiene la forma esperada', () => {
  assert.equal(fixture.schema, 'ia.gates-inventario/1');
  assert.ok(Object.keys(fixture.comandos).length > 0);
  assert.deepEqual(Object.keys(fixture.comandos), Object.keys(fixture.fase_de_cada_comando));
  assert.equal(fixture.leyes_extendidas, 'phases/00-reglas-extendidas.md');
});

test('SKILL.md pesa 20 KB o menos', () => {
  assert.ok(Buffer.byteLength(leer('SKILL.md'), 'utf8') <= 20480);
});

test('cada comando de gate suma las mismas ocurrencias que en la 3.4.0', () => {
  const total = {};
  for (const f of archivosLeidos()) {
    for (const [k, n] of Object.entries(contar(leer(f)))) total[k] = (total[k] ?? 0) + n;
  }
  assert.deepEqual(total, fixture.comandos);
});

test('cada comando aparece solo en los archivos donde vivia', () => {
  for (const f of archivosLeidos()) {
    for (const k of Object.keys(contar(leer(f)))) {
      const dest = [fixture.fase_de_cada_comando[k]].flat();
      assert.ok(dest.includes(f), `${k} aparece en ${f} y la 3.4.0 lo declara en ${dest.join(', ')}`);
    }
  }
});

test('existen los 13 archivos de fases y el MAPA DE LECTURA nombra cada uno', () => {
  const skill = leer('SKILL.md');
  const idx = skill.indexOf('MAPA DE LECTURA');
  assert.ok(idx >= 0, 'SKILL.md perdio el MAPA DE LECTURA');
  const mapa = skill.slice(idx);
  for (const f of FASES) {
    assert.ok(existsSync(join(raiz, f)), `falta ${f}`);
    assert.ok(mapa.includes(f), `el MAPA DE LECTURA no nombra ${f}`);
  }
});

test('archivosProtocolo devuelve el nucleo y las fases en orden, como rutas', () => {
  const rutas = archivosProtocolo(raiz);
  assert.equal(rutas.length, 1 + FASES.length);
  assert.ok(rutas[0].endsWith('SKILL.md'));
  const fases = rutas.slice(1).map((r) => r.replace(/[\\]/g, '/').split('/').slice(-2).join('/'));
  assert.deepEqual(fases, [...FASES].sort());
});

test('leerProtocolo devuelve el nucleo y las fases concatenados en orden', () => {
  const rutas = archivosProtocolo(raiz);
  const texto = leerProtocolo(raiz);
  assert.equal(typeof texto, 'string');
  let desde = 0;
  for (const r of rutas) {
    const contenido = readFileSync(r, 'utf8');
    const pos = texto.indexOf(contenido, desde);
    assert.ok(pos >= 0, `${r} no aparece en orden dentro de leerProtocolo`);
    desde = pos + contenido.length;
  }
});
