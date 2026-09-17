// La matriz de stacks tiene que LLEGAR a quien instala, y la copia legible tiene que decir lo mismo.
//
// Medido el 2026-09-14, y es el agujero que esta regla cierra: la matriz vivía en
// `docs/discovery/<feature>/diagnostics/stack-matrix.json` y **el instalador no copia `docs/`**
// (`COPIED_DIRECTORIES` en `scripts/verify-runtime-sync.mjs`). O sea que un proyecto de terceros
// recibía el gate `verify-stack-matrix.mjs` y el contrato `contracts/free-tier-limits.json`, pero
// no la matriz: el gate no tenía qué revisar y la novena pregunta del Intake no devolvía nada.
// Preguntar el tipo de producto y no poder contestar con un stack es el lazo abierto.
//
// La segunda mitad de la regla existe por una cicatriz propia: `tests/plantillas-pareadas.test.mjs`
// se escribió porque una copia embebida en `skills/` divergió de su canónica **dos veces en dos
// días**. Acá pasa lo mismo — `contracts/stack-matrix.json` es la canónica que leen los gates, y
// `skills/stack.md` es la que lee una persona — así que el par se comprueba por forma: las filas se
// descubren leyendo los códigos de la tabla, sin una lista de nombres que mantener a mano.
//
// LO QUE ESTA REGLA NO PUEDE HACER: comprueba que la copia legible diga lo mismo que la canónica y
// que cada plan gratuito que nombra exista en el contrato. **No comprueba que la recomendación sea
// buena, ni que los números del plan gratuito sean ciertos o sigan vigentes** — eso ya está
// declarado como límite honesto de `verify-stack-matrix.mjs`, y esta regla no lo mejora.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

const MATRIZ = join('contracts', 'stack-matrix.json');
const LEGIBLE = join('skills', 'stack.md');
const LIMITES = join('contracts', 'free-tier-limits.json');
const PROTOCOLO = 'SKILL.md';

const leer = (rel) => readFileSync(join(repoRoot, rel), 'utf8');
const leerJson = (rel) => JSON.parse(leer(rel));

/** Las filas de la tabla legible, descubiertas por forma: toda línea de tabla cuya primera celda
 * sea exactamente un código de una letra. Devuelve el código y la línea entera, porque lo que se
 * compara es contención dentro de la fila, no el orden de las columnas. */
function filasDeLaTabla(markdown) {
  const filas = new Map();
  for (const linea of markdown.split('\n')) {
    if (!linea.startsWith('|')) continue;
    const celdas = linea.split('|').slice(1, -1).map((c) => c.trim());
    if (celdas.length < 2) continue;
    const codigo = celdas[0].replace(/\*/gu, '').trim();
    if (!/^[A-H]$/u.test(codigo)) continue;
    filas.set(codigo, linea);
  }
  return filas;
}

test('la matriz canónica vive donde el instalador la copia', SOLO_FUENTE, () => {
  // Sin esto todo lo demás es decoración: el gate de la matriz recibe una ruta por argumento, así
  // que funciona igual, pero en el proyecto de quien instala esa ruta no existe.
  assert.ok(existsSync(join(repoRoot, MATRIZ)), `falta ${MATRIZ}: la matriz tiene que viajar con el runtime, y el instalador no copia docs/`);

  const copiados = leer(join('scripts', 'verify-runtime-sync.mjs'));
  const declarados = /COPIED_DIRECTORIES\s*=\s*\[([^\]]*)\]/u.exec(copiados);
  assert.ok(declarados, 'no pude leer COPIED_DIRECTORIES de verify-runtime-sync.mjs');
  assert.match(declarados[1], /'contracts'/u, 'el instalador dejó de copiar contracts/, así que la matriz ya no viaja');
});

test('la copia legible existe y el protocolo manda usarla', SOLO_FUENTE, () => {
  assert.ok(existsSync(join(repoRoot, LEGIBLE)), `falta ${LEGIBLE}`);

  const protocolo = leer(PROTOCOLO);
  assert.ok(protocolo.includes(LEGIBLE.replace(/\\/gu, '/')), `${PROTOCOLO} no nombra ${LEGIBLE}: una matriz que el protocolo no manda leer no cierra el lazo`);
  assert.ok(protocolo.includes(MATRIZ.replace(/\\/gu, '/')), `${PROTOCOLO} no nombra ${MATRIZ}: el paso tiene que decir de qué archivo sale el stack`);
});

test('cada fila de la canónica está en la tabla legible, y dice lo mismo', SOLO_FUENTE, () => {
  const matriz = leerJson(MATRIZ);
  const filas = filasDeLaTabla(leer(LEGIBLE));

  assert.equal(filas.size, matriz.rows.length, `la tabla legible tiene ${filas.size} fila(s) y la canónica ${matriz.rows.length}`);

  for (const fila of matriz.rows) {
    const linea = filas.get(fila.product_type);
    assert.ok(linea, `el tipo ${fila.product_type} no tiene fila en ${LEGIBLE}`);
    assert.ok(linea.includes(fila.name), `la fila ${fila.product_type} de ${LEGIBLE} no dice el nombre "${fila.name}"`);
    assert.ok(linea.includes(fila.recommended.stack), `la fila ${fila.product_type} de ${LEGIBLE} no dice el stack recomendado de la canónica`);
    for (const ref of fila.free_tier_refs) {
      assert.ok(linea.includes(ref), `la fila ${fila.product_type} de ${LEGIBLE} no nombra el plan gratuito "${ref}" que la canónica le asigna`);
    }
  }
});

test('la tabla legible no inventa tipos que la canónica no tiene', SOLO_FUENTE, () => {
  const canonicos = new Set(leerJson(MATRIZ).rows.map((f) => f.product_type));
  for (const codigo of filasDeLaTabla(leer(LEGIBLE)).keys()) {
    assert.ok(canonicos.has(codigo), `${LEGIBLE} tiene una fila ${codigo} que la canónica no tiene`);
  }
});

test('ningún texto de la canónica lleva una barra vertical, que partiría la tabla en dos', SOLO_FUENTE, () => {
  // Una celda con `|` no rompe nada visible: parte la fila y la comparación de arriba pasa a mirar
  // otra columna. Es el modo de falla silencioso de embeber datos en una tabla de markdown.
  for (const fila of leerJson(MATRIZ).rows) {
    for (const [donde, texto] of [['name', fila.name], ['recommended.stack', fila.recommended.stack]]) {
      assert.ok(!texto.includes('|'), `${fila.product_type}.${donde} contiene "|" y partiría la fila de la tabla legible`);
    }
  }
});

test('cada plan gratuito que la tabla legible nombra existe en el contrato de límites', SOLO_FUENTE, () => {
  const contrato = leerJson(LIMITES);
  const servicios = new Set((contrato.services ?? contrato).map((s) => s.service_id));
  const legible = leer(LEGIBLE);

  const nombrados = new Set();
  for (const fila of leerJson(MATRIZ).rows) for (const ref of fila.free_tier_refs) nombrados.add(ref);

  assert.ok(nombrados.size > 0, 'la canónica no referencia ningún plan gratuito: la regla no estaría comprobando nada');
  for (const ref of nombrados) {
    assert.ok(servicios.has(ref), `la matriz nombra "${ref}" y ${LIMITES} no lo tiene`);
    assert.ok(legible.includes(ref), `${LEGIBLE} no nombra "${ref}", así que quien lee la tabla no puede ir a buscar su límite`);
  }
});

test('la tabla legible dice de dónde salió y cuándo, no sólo qué recomendar', SOLO_FUENTE, () => {
  // El pedido era «stack con fuente, fecha y costo de escalar». Sin la fecha, una recomendación
  // vencida se lee igual que una fresca.
  const matriz = leerJson(MATRIZ);
  const legible = leer(LEGIBLE);

  assert.ok(legible.includes(matriz.captured_at), `${LEGIBLE} no dice la fecha de captura ${matriz.captured_at} de la canónica`);
  for (const fuente of matriz.sources) {
    assert.ok(legible.includes(fuente), `${LEGIBLE} no nombra la fuente "${fuente}" de la que sale la matriz`);
  }
});

test('el tipo sin plan gratuito explica por qué, en vez de dejar la celda vacía', SOLO_FUENTE, () => {
  const sinPlan = leerJson(MATRIZ).rows.filter((f) => f.free_tier_refs.length === 0);
  assert.ok(sinPlan.length > 0, 'ninguna fila quedó sin plan gratuito: si eso cambió, esta regla dejó de comprobar el caso que la motivó');

  const filas = filasDeLaTabla(leer(LEGIBLE));
  for (const fila of sinPlan) {
    assert.ok(typeof fila.no_free_tier_reason === 'string' && fila.no_free_tier_reason.length > 0,
      `${fila.product_type} no referencia ningún plan gratuito y tampoco escribe no_free_tier_reason`);
    assert.ok(filas.get(fila.product_type).includes(fila.no_free_tier_reason),
      `la fila ${fila.product_type} de ${LEGIBLE} no dice por qué no hay plan gratuito`);
  }
});
