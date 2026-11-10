// Referencias vivas: toda ruta a scripts/, skills/, phases/, contracts/ o templates/ que mencione un
// archivo versionado tiene que existir. Una referencia muerta le dice al agente que corra o lea algo
// que ya no está, y falla recién cuando alguien la sigue.
//
// Se saltea: lo que lleva `<` (placeholder), los globs con `*`, `scripts/migrar.mjs` y su test (que
// nombran archivos de la versión anterior a propósito) y, dentro de tests/, los nombres inventados
// para un fixture (lista FIXTURES de este archivo, cada uno con su motivo).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const EXTENSIONES = /\.(?:md|json|mjs|yml|sh|ps1)$/u;
const EXENTOS = new Set(['scripts/migrar.mjs', 'tests/migrar.test.mjs', 'tests/referencias-vivas.test.mjs']);
// Nombres que sólo existen dentro de una prueba, como entrada inventada de un caso.
const FIXTURES = new Set([
  'skills/hondo.md', // home-intacto: árbol de juguete
  'scripts/algo.sh', // release-workflow: script de ejemplo
  'scripts/x.sh', // tracked-modes: modos de archivo de juguete
  'scripts/a.sh', // tracked-modes
  'scripts/pagina.mjs', // verify-security-baseline: fuente de ejemplo
  'scripts/otro.mjs', // verify-security-baseline: segundo archivo de ejemplo
  'contracts/otro.json', // verify-repo-clean: contrato de ejemplo
]);
const RUTA = /(?<![A-Za-z0-9_-])((?:scripts|skills|phases|contracts)\/[A-Za-z0-9_.<>*-]+\.(?:mjs|sh|ps1|md|json)|templates\/[A-Za-z0-9_./<>*-]*[A-Za-z0-9_])/gu;

const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout
  .split('\0')
  .filter((f) => f !== '' && EXTENSIONES.test(f) && !EXENTOS.has(f) && existsSync(join(raiz, f)));

/** Referencias de un texto: [{ ruta, linea }] sin placeholders ni globs. */
export function referencias(texto) {
  const refs = [];
  texto.split(/\r?\n/u).forEach((linea, i) => {
    for (const m of linea.matchAll(RUTA)) {
      if (/[<>*]/u.test(m[1])) continue;
      refs.push({ ruta: m[1], linea: i + 1 });
    }
  });
  return refs;
}

test('referencias() ve rutas del protocolo y salta placeholders, globs y rutas ajenas', () => {
  const t = 'node scripts/a.mjs, `skills/x.md`, phases/<n>.md, scripts/*.mjs, templates/estado/ESTADO.md, mi-scripts/y.mjs';
  assert.deepEqual(referencias(t).map((r) => r.ruta), ['scripts/a.mjs', 'skills/x.md', 'templates/estado/ESTADO.md']);
});

test('toda ruta mencionada en un archivo versionado existe', () => {
  const muertas = [];
  for (const archivo of tracked) {
    const enTests = archivo.startsWith('tests/');
    for (const { ruta, linea } of referencias(readFileSync(join(raiz, archivo), 'utf8'))) {
      if (existsSync(join(raiz, ruta))) continue;
      if (enTests && FIXTURES.has(ruta)) continue;
      muertas.push(`${archivo}:${linea} -> ${ruta}`);
    }
  }
  assert.deepEqual(muertas, [], `referencias muertas:\n${muertas.join('\n')}`);
});
