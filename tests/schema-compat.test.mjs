// El protocolo cambió de nombre, y los artefactos ya escritos siguen valiendo.
//
// EL PROBLEMA, medido el 2026-09-15 antes de tocar nada: **42 familias de schema** llevan el prefijo
// `vcp.`, y cada artefacto que el protocolo produce lo declara — recibos, contratos, paquetes de
// Discovery, planes de fase—. Los gates lo comparan **por igualdad exacta**, que es correcto: un
// schema es un identificador, no una descripción. Renombrarlo de golpe convertiría en inválido todo
// lo que este repositorio y cualquier instalación produjeron hasta hoy.
//
// LA SALIDA NO ES NO RENOMBRAR, ES **ACEPTAR EL VIEJO Y ESCRIBIR EL NUEVO**. Es la migración de
// siempre, y lo único que importa es que la tolerancia viva en UN SOLO LUGAR con su límite escrito.
// Si cada gate hiciera su propia excepción, en seis meses habría 42 reglas distintas sobre qué se
// acepta, y nadie sabría cuál es la vigente — el mismo error que este repositorio ya evitó con la
// redacción reusable de `validateDeclaredField`.
//
// LO QUE ESTO NO ES. No es un traductor de versiones: `ia.receipt/v2` y `ia.receipt/v3` siguen
// siendo distintos, y ninguno acepta al otro. La equivalencia es **sólo del prefijo**, con la misma
// familia y la misma versión. Un artefacto viejo se lee; un artefacto de otra versión, no.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'schema-compat.mjs');
const { LEGADO, PREFIJO, aLegado, mismoSchema } = await import(pathToFileURL(script).href);

test('los dos prefijos son los que el protocolo declara, y no se adivinan', () => {
  assert.equal(PREFIJO, 'ia.');
  assert.equal(LEGADO, 'vcp.');
});

test('el nombre nuevo vale', () => {
  assert.equal(mismoSchema('ia.receipt/v3', 'ia.receipt/v3'), true);
});

test('EL NOMBRE VIEJO TAMBIÉN VALE: un recibo escrito antes del cambio se sigue leyendo', () => {
  // Es toda la razón de ser de este módulo. `.vibe/receipts/` tiene decenas de recibos con el
  // prefijo viejo, y son el registro de lo que realmente pasó: invalidarlos sería reescribir la
  // historia para que cierre con el nombre nuevo.
  assert.equal(mismoSchema('vcp.receipt/v3', 'ia.receipt/v3'), true);
  assert.equal(mismoSchema('vcp.index/1', 'ia.index/1'), true);
});

test('LA EQUIVALENCIA ES SÓLO DEL PREFIJO: la familia y la versión tienen que coincidir', () => {
  // No es un traductor de versiones. Aflojar acá convertiría una tolerancia de nombre en una
  // tolerancia de formato, que es exactamente lo que un schema existe para impedir.
  assert.equal(mismoSchema('vcp.receipt/v2', 'ia.receipt/v3'), false);
  assert.equal(mismoSchema('ia.receipt/v2', 'ia.receipt/v3'), false);
  assert.equal(mismoSchema('vcp.index/1', 'ia.intake/1'), false);
  assert.equal(mismoSchema('vcp.intake/1', 'ia.index/1'), false);
});

test('FALSIFICACIÓN · la tolerancia va en UNA sola dirección', () => {
  // Un artefacto con el nombre NUEVO no puede pasar por un gate que todavía espera el viejo: eso
  // seria aceptar un futuro que nadie escribió. Y el esperado siempre es el nuevo, por construcción.
  assert.equal(mismoSchema('ia.receipt/v3', 'vcp.receipt/v3'), false);
});

test('FALSIFICACIÓN · un prefijo parecido no es el prefijo', () => {
  for (const impostor of ['vcpx.receipt/v3', 'ia-stack.receipt/v3', 'xvcp.receipt/v3', 'VCP.receipt/v3', 'IA.receipt/v3']) {
    assert.equal(mismoSchema(impostor, 'ia.receipt/v3'), false, impostor);
  }
});

test('FALSIFICACIÓN · lo que no es una cadena no es un schema', () => {
  for (const basura of [null, undefined, 42, {}, ['ia.receipt/v3'], true, '']) {
    assert.equal(mismoSchema(basura, 'ia.receipt/v3'), false, JSON.stringify(basura));
  }
  for (const esperadoMalo of [null, undefined, 42, '', 'sin-prefijo/1']) {
    assert.equal(mismoSchema('ia.receipt/v3', esperadoMalo), false, JSON.stringify(esperadoMalo));
  }
});

test('aLegado nombra la forma vieja, para poder decirla en un mensaje de rechazo', () => {
  // Un rechazo que sólo nombra el schema nuevo deja a quien migra sin saber qué se sigue aceptando.
  assert.equal(aLegado('ia.receipt/v3'), 'vcp.receipt/v3');
  assert.equal(aLegado('vcp.receipt/v3'), 'vcp.receipt/v3');
  assert.equal(aLegado('sin-prefijo/1'), 'sin-prefijo/1');
});

test('TODOS los schemas que los gates esperan usan el prefijo nuevo', async () => {
  // La prueba que impide que la migración quede a medias: si un gate nuevo nace con `vcp.`, acá se
  // ve. Se mira el literal en el código, no una lista escrita a mano que alguien tenga que recordar.
  const { readdirSync, readFileSync } = await import('node:fs');
  const viejos = [];
  for (const nombre of readdirSync(join(repoRoot, 'scripts')).filter((n) => n.endsWith('.mjs'))) {
    if (nombre === 'schema-compat.mjs') continue;
    const fuente = readFileSync(join(repoRoot, 'scripts', nombre), 'utf8');
    // Sólo los literales de schema: `'vcp.algo/1'`. La prosa de los comentarios no cuenta.
    for (const [literal] of fuente.matchAll(/'vcp\.[a-z0-9-]+\/[a-z0-9]+'/gu)) {
      viejos.push(`${nombre}: ${literal}`);
    }
  }
  assert.deepEqual(viejos, []);
});
