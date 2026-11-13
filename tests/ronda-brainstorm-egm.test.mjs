// Regla fija «ronda de brainstormings + EGM» (Santi, 13-11-2026): siempre nivel fuerte (Opus),
// 5 pasos en orden, EGM de 5 a 10 rondas, y enrutamiento por falla barato -> medio -> fuerte.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (rel) => readFileSync(join(raiz, rel), 'utf8');
const contrato = JSON.parse(leer('contracts/model-routing.json'));

test('el rol ronda_brainstorm_egm es de nivel fuerte, es decir Opus', () => {
  const rol = contrato.roles.ronda_brainstorm_egm;
  assert.ok(rol, 'falta el rol ronda_brainstorm_egm');
  assert.equal(rol.nivel, 'fuerte');
  assert.equal(contrato.niveles[rol.nivel].modelo, 'opus');
});

test('la ronda de brainstormings tiene 5 pasos en el orden fijado', () => {
  const r = contrato.rondas;
  assert.ok(r, 'falta contrato.rondas');
  assert.equal(r.nivel, 'fuerte');
  assert.deepEqual(r.brainstorming.pasos, ['brainstorming', 'adversarial', 'brainstorming', 'adversarial', 'brainstorming final']);
});

test('EGM: mínimo 5 rondas, máximo 10, sigue hasta una ronda limpia', () => {
  const e = contrato.rondas.egm;
  assert.equal(e.minimo, 5);
  assert.equal(e.maximo, 10);
  assert.match(e.hasta, /limpia/u);
  assert.equal(contrato.rondas.excepcion_a, 'el_modelo_mas_barato');
});

test('el enrutamiento por falla pasa de barato a medio y de medio a fuerte con la falla exacta', () => {
  const f = contrato.escalada.por_falla;
  assert.ok(f, 'falta escalada.por_falla');
  assert.deepEqual(f, { barato: 'medio', medio: 'fuerte' });
  assert.match(contrato.escalada.pasa_la_falla, /comando, la salida, archivo:línea/u);
});

test('la skill, la fase 5 y SKILL.md nombran la ronda', () => {
  assert.match(leer('skills/brainstorm-egm.md'), /ronda de brainstormings/iu);
  assert.match(leer('skills/brainstorm-egm.md'), /mínimo 5/iu);
  assert.match(leer('phases/05-spec.md'), /ronda de brainstormings/iu);
  assert.match(leer('SKILL.md'), /ronda de brainstormings/iu);
});
