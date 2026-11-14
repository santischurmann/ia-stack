// Ventana de contexto (3.4.5): toda sesión con IA Stack, orquestador o anidada, trabaja con una
// ventana de 300K como máximo y compacta apenas se llena. Los topes de relevo (120K y 60K sobre
// mensajes) siguen: el relevo ordenado llega antes; la ventana es el techo duro.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { evaluar, leerContrato } from '../scripts/context-guard.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const contrato = JSON.parse(readFileSync(join(raiz, 'contracts/model-routing.json'), 'utf8'));

test('el contrato fija la ventana en 300K para todo rol y manda compactar al llenarse', () => {
  const c = contrato.contexto;
  assert.equal(c.ventana_max, 300000);
  assert.match(c.ventana_vale_para, /^toda sesión abierta en un proyecto instalado/u);
  assert.match(c.ventana_vale_para, /anidada.*si el host le pasa la variable/u);
  assert.equal(c.al_llenarse, 'compactar');
  assert.ok(c.ventana_max >= c.tope_orquestador && c.ventana_max >= c.tope_subsesion);
});

test('leerContrato devuelve la ventana y rechaza una ventana menor que un tope', () => {
  assert.equal(leerContrato().ventana_max, 300000);
  const dir = mkdtempSync(join(tmpdir(), 'ia-ventana-contexto-'));
  try {
    const ruta = join(dir, 'model-routing.json');
    writeFileSync(ruta, JSON.stringify({ contexto: { ...contrato.contexto, ventana_max: 50000 } }));
    assert.throws(() => leerContrato(ruta), /ventana_max del contrato debe ser un número no menor que los topes/u);
    // Presente e inválida es contrato roto (el guard calla y lo dice por stderr); sólo la ausente se tolera.
    writeFileSync(ruta, JSON.stringify({ contexto: { ...contrato.contexto, ventana_max: '300000' } }));
    assert.throws(() => leerContrato(ruta), /ventana_max del contrato debe ser un número no menor que los topes/u);
    const { ventana_max: _fuera, ...sinVentana } = contrato.contexto;
    writeFileSync(ruta, JSON.stringify({ contexto: sinVentana }));
    assert.equal(leerContrato(ruta).ventana_max, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('por_que no promete más que lo que se cumple: techo donde está la variable, y el guard como respaldo', () => {
  const p = contrato.contexto.por_que;
  assert.doesNotMatch(p, /Sin dato del host|nunca trabaja con más/u);
  assert.match(p, /donde el host recibe la variable/u);
  assert.match(p, /respaldo.*guard.*sobre mensajes/u);
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
