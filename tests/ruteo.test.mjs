// Ruteo de modelos (spec 3.4.4, criterio 3): cuatro niveles, todo esfuerzo `low`, el nivel más caro sólo
// para el orquestador, y la tabla de SKILL.md igual al contrato.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const crudo = readFileSync(join(raiz, 'contracts/model-routing.json'), 'utf8');
const contrato = JSON.parse(crudo);

function esfuerzos(nodo, ruta = '$') {
  if (Array.isArray(nodo)) return nodo.flatMap((x, i) => esfuerzos(x, `${ruta}[${i}]`));
  if (nodo && typeof nodo === 'object') {
    return Object.entries(nodo).flatMap(([k, v]) => (k === 'esfuerzo' ? [[`${ruta}.${k}`, v]] : esfuerzos(v, `${ruta}.${k}`)));
  }
  return [];
}

test('todo esfuerzo del contrato es low, y hay al menos uno por nivel', () => {
  const todos = esfuerzos(contrato);
  assert.ok(todos.length >= 4);
  for (const [ruta, valor] of todos) assert.equal(valor, 'low', ruta);
  assert.ok(!/"(medium|high)"/u.test(crudo), 'el contrato no nombra medium ni high como valor');
});

test('hay exactamente los niveles barato, medio, fuerte y orquestador', () => {
  assert.deepEqual(Object.keys(contrato.niveles), ['barato', 'medio', 'fuerte', 'orquestador']);
  assert.equal(contrato.por_defecto, 'barato');
});

test('fable aparece sólo en el nivel orquestador', () => {
  for (const [nivel, def] of Object.entries(contrato.niveles)) {
    const aparece = /fable/iu.test(JSON.stringify(def));
    assert.equal(aparece, nivel === 'orquestador', nivel);
  }
  const fuera = JSON.stringify({ ...contrato, niveles: undefined });
  assert.ok(!/fable/iu.test(fuera), 'fable aparece fuera de niveles.orquestador');
});

test('Codex usa luna, terra, sol y astra, una familia por nivel', () => {
  const familias = Object.values(contrato.niveles).map((n) => n.codex.familia);
  assert.deepEqual(familias, ['luna', 'terra', 'sol', 'astra']);
});

test('los topes del contrato son los de la spec', () => {
  assert.equal(contrato.contexto.tope_orquestador, 120000);
  assert.equal(contrato.contexto.tope_subsesion, 60000);
  assert.equal(contrato.contexto.aviso_desde, 0.7);
  assert.equal(contrato.encargo.brief_max_tokens, 4000);
  assert.equal(contrato.encargo.brief_max_archivos, 3);
  assert.equal(contrato.encargo.reporte_max_lineas, 40);
  assert.equal(contrato.presupuesto.freno_ventana_5h, 0.85);
});

test('la tabla de modelos de SKILL.md coincide con el contrato', () => {
  const skill = readFileSync(join(raiz, 'SKILL.md'), 'utf8');
  const filas = new Map();
  for (const l of skill.split(/\r?\n/u)) {
    const celdas = l.split('|').slice(1, -1).map((c) => c.trim());
    if (celdas.length >= 3 && Object.hasOwn(contrato.niveles, celdas[0]) && /^[A-Z][a-z]+ low$/u.test(celdas[1])) filas.set(celdas[0], celdas[1]);
  }
  assert.deepEqual([...filas.keys()], Object.keys(contrato.niveles), 'SKILL.md no lista los cuatro niveles');
  for (const [nivel, def] of Object.entries(contrato.niveles)) {
    const esperado = `${def.modelo[0].toUpperCase()}${def.modelo.slice(1)} ${def.esfuerzo}`;
    assert.equal(filas.get(nivel), esperado, nivel);
  }
});
