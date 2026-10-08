// El adaptador de vitest lee la ubicacion del fallo desde el stack. Con un proyecto en una ruta
// CON ESPACIOS (ej. `C:\proj con espacios\...`) la regex de `ubicacionDelStack` no engancha el
// frame del test, cae en un frame de `node_modules` con forma `file:///.../proj%20con%20espacios/...`
// sin decodificar, y un rojo valido de vitest se rechaza. Estas pruebas fijan el comportamiento
// correcto: la ubicacion es la del frame del test, con la ruta completa, con espacios y decodificada.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-red-vitest.mjs');
const { ubicacionDelStack, ubicacionADentroDelProyecto } = await import(pathToFileURL(script).href);

test('a) frame entre parentesis con espacios en la ruta Windows devuelve la ruta completa y la linea', () => {
  const mensaje = 'AssertionError: x\n    at Object.<anonymous> (C:\\proj con espacios\\packages\\t.test.ts:5:45)';
  assert.deepEqual(ubicacionDelStack(mensaje), {
    archivo: 'C:\\proj con espacios\\packages\\t.test.ts',
    linea: 5,
  });
});

test('b) frame sin parentesis con espacios en la ruta devuelve la ruta completa y la linea', () => {
  const mensaje = '    at C:\\proj con espacios\\packages\\t.test.ts:7:3';
  assert.deepEqual(ubicacionDelStack(mensaje), {
    archivo: 'C:\\proj con espacios\\packages\\t.test.ts',
    linea: 7,
  });
});

test('c) frame con URL file:// codificada devuelve la ruta de sistema decodificada y la linea', () => {
  const url = 'file:///C:/proj%20con%20espacios/packages/t.test.ts';
  const mensaje = `    at ${url}:9:1`;
  assert.deepEqual(ubicacionDelStack(mensaje), {
    archivo: fileURLToPath(url),
    linea: 9,
  });
});

test('d) regresion: frame sin espacios entre parentesis sigue devolviendo ruta y linea', () => {
  const mensaje = '    at Object.<anonymous> (/repo/tests/a.test.ts:3:2)';
  assert.deepEqual(ubicacionDelStack(mensaje), {
    archivo: '/repo/tests/a.test.ts',
    linea: 3,
  });
});

test('e) ruta absoluta con espacios dentro de un cwd con espacios se informa relativa al proyecto', () => {
  const cwd = join(process.cwd(), 'proj con espacios');
  const ruta = join(cwd, 'packages', 't.test.ts');
  assert.equal(ubicacionADentroDelProyecto(ruta, cwd, () => true), 'packages/t.test.ts');
});
