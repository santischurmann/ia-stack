// AC2 de docs/spec.md · La matriz cubre los ocho tipos de producto, y cada servicio que referencia
// resuelve contra el contrato de límites.
//
// POR QUÉ LOS OCHO O NINGUNO. Un tipo sin fila deja sin respuesta a quien lo elija, y con ocho
// códigos las filas que faltan son invisibles: no se distingue «lo miré y no aplica» de «no lo
// miré». Es el mismo criterio que la cobertura del diagnóstico CAIO ya aplica en este repositorio.
//
// POR QUÉ LA REFERENCIA TIENE QUE RESOLVER. Una fila que nombra un servicio inexistente recomienda
// sin respaldo: el costo de escalar queda como una promesa sin dato detrás.
//
// LÍMITE HONESTO: comprueba que los ocho tipos tengan fila y que las referencias resuelvan, nunca
// que un producto concreto esté bien clasificado. Una clasificación coherente y equivocada recibe
// la recomendación equivocada y pasa en verde.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-stack-matrix.mjs');
const { TIPOS_DE_PRODUCTO, validateMatrix } = await import(pathToFileURL(script).href);

import { esRuntimeInstalado } from './_entorno.mjs';

// Self-check del repositorio: estas pruebas leen `docs/`, que el instalador NO copia al proyecto de
// otra persona. Allá no aplican y además fallarían. Se saltean DICIENDO por qué.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};


const texto = (base) => `${base} — texto real y suficientemente largo para no ser relleno.`;

const fila = (product_type, overrides = {}) => ({
  product_type,
  name: `Tipo ${product_type}`,
  decision_criterion: texto('La pregunta con respuesta observable que separa este tipo del vecino'),
  recommended: { stack: texto('El stack recomendado'), why: texto('Por qué ése y no otro') },
  alternatives: [],
  free_tier_refs: ['proveedor-free'],
  red_adapter: texto('El adaptador que le toca, o ninguno con su motivo'),
  evidence: [texto('Lo que respalda esta fila')],
  ...overrides,
});

const matriz = (overrides = {}) => ({
  schema: 'vcp.stack-matrix/1',
  feature: 'eleccion-de-stack',
  date: '2026-09-14',
  captured_at: '2026-09-14',
  sources: ['research/sources/ejemplo.md'],
  note: texto('Artefacto de discovery, no contrato'),
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((t) => fila(t)),
  limits: [texto('Lo que esta matriz no promete')],
  ...overrides,
});

const idsDisponibles = new Set(['proveedor-free', 'otro-free']);

test('AC2 · una matriz con los ocho tipos y referencias que resuelven no tiene violaciones', () => {
  assert.deepEqual(validateMatrix(matriz(), idsDisponibles), []);
});

test('los ocho códigos son exactamente A a H, y el orden es el declarado', () => {
  assert.deepEqual(TIPOS_DE_PRODUCTO, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
});

test('FALSIFICACIÓN · AC2 · un tipo de producto sin fila se rechaza nombrándolo', () => {
  const sinE = matriz({ rows: matriz().rows.filter((r) => r.product_type !== 'E') });
  const violaciones = validateMatrix(sinE, idsDisponibles);
  assert.ok(
    violaciones.some((v) => /\bE\b/u.test(v)),
    `tiene que nombrar el tipo faltante, y devolvió: ${JSON.stringify(violaciones)}`,
  );
});

test('FALSIFICACIÓN · AC2 · una referencia a un servicio inexistente se rechaza nombrando el servicio', () => {
  const rota = matriz();
  rota.rows[1].free_tier_refs = ['proveedor-que-no-existe'];
  const violaciones = validateMatrix(rota, idsDisponibles);
  assert.ok(violaciones.some((v) => /proveedor-que-no-existe/u.test(v)), JSON.stringify(violaciones));
});

test('FALSIFICACIÓN · un tipo repetido no compra cobertura', () => {
  const repetido = matriz();
  repetido.rows[7] = fila('A');
  const violaciones = validateMatrix(repetido, idsDisponibles);
  assert.ok(violaciones.some((v) => /\bA\b/u.test(v)), 'dos filas para el mismo tipo dejan otro sin fila');
  assert.ok(violaciones.some((v) => /\bH\b/u.test(v)), JSON.stringify(violaciones));
});

test('FALSIFICACIÓN · un criterio de decisión de relleno no es un criterio', () => {
  for (const relleno of ['tbd', '-', 'depende']) {
    const floja = matriz();
    floja.rows[0].decision_criterion = relleno;
    assert.ok(
      validateMatrix(floja, idsDisponibles).some((v) => /decision_criterion/u.test(v)),
      `aceptó el relleno ${relleno}`,
    );
  }
});

test('FALSIFICACIÓN · una fila sin recomendación o sin su motivo se rechaza', () => {
  const sinWhy = matriz();
  sinWhy.rows[2].recommended = { stack: texto('Algo'), why: '' };
  assert.ok(validateMatrix(sinWhy, idsDisponibles).some((v) => /recommended/u.test(v)), 'recomendar sin decir por qué es anunciar');

  const noEsObjeto = matriz();
  noEsObjeto.rows[2].recommended = texto('Un stack suelto');
  assert.ok(validateMatrix(noEsObjeto, idsDisponibles).some((v) => /recommended/u.test(v)), JSON.stringify(validateMatrix(noEsObjeto, idsDisponibles)));
});

// LA HERIDA, con su número de veces: UNA, y la encontró el propio gate sobre la matriz real. La
// regla original exigía referencias a todo tipo que recomendara un stack, y dejó al tipo G en rojo.
// G es «artefacto»: algo que se entrega una vez y no se opera, así que genuinamente no usa ningún
// servicio alojado. No era un defecto de la matriz sino de la regla, escrita desde los casos web.
// Son DOS los tipos exentos y no uno, y por motivos distintos: H porque todavía no se sabe qué es,
// G porque se sabe y no se opera.
test('FALSIFICACIÓN · G y H pueden no tener referencias, y los otros seis no', () => {
  const exentos = matriz();
  exentos.rows[6].free_tier_refs = [];
  exentos.rows[7].free_tier_refs = [];
  exentos.rows[7].alternatives = [];
  assert.deepEqual(validateMatrix(exentos, idsDisponibles), []);

  for (const indice of [0, 1, 2, 3, 4, 5]) {
    const sinRefs = matriz();
    sinRefs.rows[indice].free_tier_refs = [];
    assert.ok(
      validateMatrix(sinRefs, idsDisponibles).some((v) => /free_tier_refs/u.test(v)),
      `el tipo ${sinRefs.rows[indice].product_type} recomienda un stack alojado y tiene que decir contra qué servicio`,
    );
  }
});

test('FALSIFICACIÓN · el esquema se mira primero y corta', () => {
  assert.ok(validateMatrix(null, idsDisponibles).some((v) => /objeto/u.test(v)));
  assert.equal(validateMatrix({ schema: 'otro' }, idsDisponibles).length, 1);
});

test('la matriz real del repositorio pasa contra el contrato real', SOLO_FUENTE, () => {
  const real = JSON.parse(readFileSync(join(repoRoot, 'docs', 'discovery', 'eleccion-de-stack', 'diagnostics', 'stack-matrix.json'), 'utf8'));
  const contrato = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'free-tier-limits.json'), 'utf8'));
  const ids = new Set(contrato.services.map((s) => s.service_id));
  assert.deepEqual(validateMatrix(real, ids), []);
});

test('FALSIFICACIÓN · una fila con free_tier_refs que no es lista se rechaza', () => {
  const noEsLista = matriz();
  noEsLista.rows[3].free_tier_refs = 'proveedor-free';
  assert.ok(validateMatrix(noEsLista, idsDisponibles).some((v) => /free_tier_refs/u.test(v)));

  const sinAlternativas = matriz();
  sinAlternativas.rows[3].alternatives = 'ninguna';
  assert.ok(validateMatrix(sinAlternativas, idsDisponibles).some((v) => /alternatives/u.test(v)));

  const sinEvidencia = matriz();
  sinEvidencia.rows[3].evidence = 'algo';
  assert.ok(validateMatrix(sinEvidencia, idsDisponibles).some((v) => /evidence/u.test(v)));

  const sinAdaptador = matriz();
  sinAdaptador.rows[3].red_adapter = '';
  assert.ok(validateMatrix(sinAdaptador, idsDisponibles).some((v) => /red_adapter/u.test(v)));

  const sinNombre = matriz();
  sinNombre.rows[3].name = '';
  assert.ok(validateMatrix(sinNombre, idsDisponibles).some((v) => /name/u.test(v)));
});

test('FALSIFICACIÓN · una fila con claves de más, o con un tipo inventado, se rechaza', () => {
  const claveDeMas = matriz();
  claveDeMas.rows[0] = { ...fila('A'), extra: 1 };
  assert.ok(validateMatrix(claveDeMas, idsDisponibles).some((v) => /exactamente/u.test(v)));

  const tipoInventado = matriz();
  tipoInventado.rows[0] = fila('Z');
  assert.ok(validateMatrix(tipoInventado, idsDisponibles).some((v) => /"Z"/u.test(v)), 'un tipo fuera del enum se nombra');

  const sinFilas = validateMatrix(matriz({ rows: 'ninguna' }), idsDisponibles);
  assert.ok(sinFilas.some((v) => /rows/u.test(v)), JSON.stringify(sinFilas));
});

test('FALSIFICACIÓN · el tipo H tiene que traer recommended aunque no recomiende', () => {
  const sinObjeto = matriz();
  sinObjeto.rows[7].recommended = null;
  assert.ok(validateMatrix(sinObjeto, idsDisponibles).some((v) => /recommended/u.test(v)));
});
