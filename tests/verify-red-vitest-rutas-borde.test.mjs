// Borde de `ubicacionDelStack` que las pruebas de rutas con espacios no tocan: una URL `file://` con
// una secuencia de escape invalida. `fileURLToPath` LANZA `URIError` ante `%zz`, y el contrato de la
// funcion (ver su comentario en scripts/verify-red-vitest.mjs) es devolver `null` cuando no hay una
// referencia utilizable, porque `main` ya convierte ese `null` en un rechazo explicado. Un throw se
// escapa de `main` como una excepcion cruda en vez de un `REJECTED:` con motivo.
//
// «Mensaje vacio / sin frames => null» NO se repite aca: ya lo fija
// tests/verify-red-cobertura.test.mjs (`ubicacionDelStack(null)` y `ubicacionDelStack('sin ninguna
// ubicacion')`), y `null` pasa por `String(mensaje ?? '')`, o sea el mismo camino que la cadena vacia.

import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-red-vitest.mjs');
const { ubicacionDelStack } = await import(pathToFileURL(script).href);

test('una URL file:// con escape invalido (%zz) devuelve null y no lanza', () => {
  const mensaje = '    at file:///C:/x/%zz/a.test.ts:3:1';
  assert.doesNotThrow(() => ubicacionDelStack(mensaje), 'el contrato es devolver null, no lanzar URIError');
  assert.equal(ubicacionDelStack(mensaje), null);
});
