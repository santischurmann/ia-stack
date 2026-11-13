// Ventana de contexto (3.4.5): toda sesión con IA Stack, orquestador o anidada, trabaja con una
// ventana de 300K como máximo y compacta apenas se llena. Los topes de relevo (120K y 60K sobre
// mensajes) siguen: el relevo ordenado llega antes; la ventana es el techo duro.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { evaluar, leerContrato } from '../scripts/context-guard.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = JSON.parse(readFileSync(join(raiz, 'contracts/model-routing.json'), 'utf8'));

test('el contrato fija la ventana en 300K para todo rol y manda compactar al llenarse', () => {
  const c = contrato.contexto;
  assert.equal(c.ventana_max, 300000);
  assert.equal(c.ventana_vale_para, 'toda sesión: orquestador y anidada');
  assert.equal(c.al_llenarse, 'compactar');
  assert.ok(c.ventana_max >= c.tope_orquestador && c.ventana_max >= c.tope_subsesion);
});

test('leerContrato devuelve la ventana y rechaza una ventana menor que un tope', () => {
  assert.equal(leerContrato().ventana_max, 300000);
});

test('con la ventana llena el guard ordena compactar ya, en cualquier rol', () => {
  const c = leerContrato();
  for (const rol of ['orquestador', 'subsesion']) {
    const m = evaluar(300000, rol, c);
    assert.match(m, /^ORDEN: ventana de 300000 tokens llena/u, rol);
    assert.match(m, /compactá ya/u, rol);
  }
  assert.doesNotMatch(evaluar(299999, 'orquestador', c), /ventana de 300000 tokens llena/u);
});

test('SKILL.md e INSTALL.md nombran la ventana de 300K', () => {
  assert.match(readFileSync(join(raiz, 'SKILL.md'), 'utf8'), /300K/u);
  assert.match(readFileSync(join(raiz, 'INSTALL.md'), 'utf8'), /300\.?000|300K/u);
});
