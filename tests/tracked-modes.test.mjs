// Un script que la documentación manda ejecutar tiene que viajar ejecutable.
//
// LA HERIDA, medida el 2026-09-08: los cuatro `.sh` del repositorio estaban en modo `100644` en el
// índice de git, y `./scripts/install.sh` se publica como **el primer comando del proyecto** en
// `README.md:35`, en `INSTALL.md` dos veces y dentro del propio `scripts/build-zip.sh`. En Linux y
// macOS, quien clona y sigue el README recibe `permission denied` antes de haber hecho nada. Es el
// camino de entrada de cualquiera que no esté en Windows.
//
// SE COMPARA CONTRA EL INDICE, NUNCA CONTRA EL DISCO. `git config core.filemode` es `false` en
// Windows y el filesystem no sabe nada del bit: leerlo con `statSync` daría rojo sobre los 339
// archivos trackeados. El índice es la única fuente que viaja en el clon, y es la que importa.
//
// Y LA LISTA NO SE ESCRIBE A MANO: se deriva grepeando qué scripts invoca la documentación por
// ruta. Una lista escrita a mano sólo encuentra lo que ya pensó quien la escribió, y se queda vieja
// el día que aparezca un script nuevo publicado como comando.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const INVOCACION = /\.\/(scripts\/[a-z0-9-]+\.sh)/gu;
export const MODO_EJECUTABLE = '100755';

/** Qué scripts de shell publica un documento como comando a correr, por ruta. */
export function invocadosPorRuta(texto) {
  return [...new Set([...texto.matchAll(INVOCACION)].map((m) => m[1]))];
}

/** El modo que el ÍNDICE de git declara para cada ruta. */
export function modosDelIndice(salida) {
  const modos = new Map();
  for (const linea of salida.split('\n')) {
    const m = linea.match(/^(\d{6})\s+[0-9a-f]+\s+\d+\t(.+)$/u);
    if (m !== null) modos.set(m[2].trim(), m[1]);
  }
  return modos;
}

test('todo script de shell que la documentación manda correr viaja ejecutable en el índice', SOLO_FUENTE, () => {
  const versionados = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);

  // Los documentos donde se busca: todo `.md` versionado más los propios scripts de shell, que
  // también publican comandos para el receptor.
  const documentos = versionados.filter((f) => f.endsWith('.md') || f.endsWith('.sh'));
  const publicados = new Set();
  for (const doc of documentos) {
    for (const script of invocadosPorRuta(readFileSync(join(repoRoot, doc), 'utf8'))) {
      if (versionados.includes(script)) publicados.add(script);
    }
  }
  assert.ok(publicados.size > 0, 'ningún documento publica un script por ruta: la comprobación no midió nada');

  const modos = modosDelIndice(execFileSync('git', ['ls-files', '-s'], { cwd: repoRoot, encoding: 'utf8' }));
  const sinBit = [...publicados].sort().filter((script) => modos.get(script) !== MODO_EJECUTABLE);
  assert.deepEqual(
    sinBit,
    [],
    `estos scripts se publican como comando y viajan sin bit de ejecución: quien clone en Linux recibe permission denied. Arreglo: git update-index --chmod=+x <ruta>`,
  );
});

test('FALSIFICACIÓN · el barrido lee las invocaciones por ruta y no cualquier mención', () => {
  assert.deepEqual(invocadosPorRuta('corré `./scripts/install.sh --project x`'), ['scripts/install.sh']);
  assert.deepEqual(invocadosPorRuta('el archivo scripts/install.sh existe'), [], 'nombrarlo no es invocarlo');
  assert.deepEqual(invocadosPorRuta('./scripts/a.sh y ./scripts/a.sh'), ['scripts/a.sh'], 'sin duplicados');
});

test('FALSIFICACIÓN · el lector de modos entiende la salida de git y descarta la basura', () => {
  const salida = [
    '100755 fb341b98d1cf46021f14dc200d0bc47b3a942973 0\tscripts/install.sh',
    '100644 ea2b00a2ae25c45c0fdd03bf70eae85bec7f952c 0\tscripts/verify-red.sh',
    'una línea que no es de git',
  ].join('\n');
  const modos = modosDelIndice(salida);
  assert.equal(modos.get('scripts/install.sh'), '100755');
  assert.equal(modos.get('scripts/verify-red.sh'), '100644');
  assert.equal(modos.size, 2);
});
