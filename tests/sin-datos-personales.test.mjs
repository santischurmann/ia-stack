// El repositorio se publica para cualquier usuario: no puede llevar datos de una persona.
//
// Recorre `git ls-files` y falla si encuentra:
//   1. rutas de directorio personal (`X:\Users\<nombre>`, `/home/<nombre>/`, `/Users/<nombre>/`)
//      cuyo nombre no sea un marcador de ejemplo;
//   2. correos que no sean de ejemplo (`@example.com`, `noreply@`, `@users.noreply`);
//   3. la cadena del nombre anterior del protocolo, fuera de los dos archivos de migración.
//
// Este archivo no contiene ningún nombre real: el nombre anterior se arma por partes para que la
// regla 3 no se encuentre a sí misma, y los casos de falsificación usan nombres inventados.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Las expresiones, nombradas para poder falsificarlas: un detector que no detecta pasa en verde.
const RUTA_WINDOWS = /[A-Za-z]:[\\/]+Users[\\/]+([A-Za-z0-9._~-]+)/gu;
const RUTA_LINUX = /(?<![A-Za-z0-9._-])\/home\/([A-Za-z0-9._~-]+)\//gu;
const RUTA_MAC = /(?<![A-Za-z0-9._-])\/Users\/([A-Za-z0-9._~-]+)\//gu;
const CORREO = /([A-Za-z0-9._%+-]+)@([A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/gu;
// Armado por partes: este archivo no puede contener la cadena que busca.
const NOMBRE_ANTERIOR = new RegExp(`${['v', 'ibe'].join('')}|${['v', 'cp'].join('')}(?!u)`, 'giu');
const MIGRACION = ['scripts/migrar.mjs', 'tests/migrar.test.mjs'];

const MARCADORES = new Set([
  'ejemplo', 'example', 'alguien', 'nombre', 'usuario', 'user', 'username', 'you', 'yo', 'tu', 'tu-usuario',
  'name', 'tuusuario', 'persona', 'runner', 'runner~1', 'public', 'default', 'x', 'u', 'ana', 'proy', 'proyecto',
]);
const esMarcador = (m) => MARCADORES.has(m[1].toLowerCase());
const esCorreoDeEjemplo = (m) => {
  const dominio = m[2].toLowerCase();
  return dominio === 'example.com' || dominio.endsWith('.example.com') || m[1].toLowerCase() === 'noreply' || dominio.endsWith('users.noreply.github.com');
};

const listado = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 26 });
assert.equal(listado.status, 0, `git ls-files falló: ${listado.stderr}`);
const archivos = listado.stdout.split('\0').filter(Boolean);

/** Los textos del repositorio, sin los binarios (un NUL en el contenido los delata). */
const textos = archivos.flatMap((ruta) => {
  let buffer;
  try { buffer = readFileSync(join(repoRoot, ruta)); } catch { return []; }
  if (buffer.includes(0)) return [];
  return [{ ruta, texto: buffer.toString('utf8') }];
});

function hallazgos(regex, aceptable = () => true, excluidos = []) {
  const lista = [];
  for (const { ruta, texto } of textos) {
    if (excluidos.includes(ruta)) continue;
    texto.split(/\r?\n/u).forEach((linea, i) => {
      for (const m of linea.matchAll(regex)) {
        if (!aceptable(m)) lista.push(`${ruta}:${i + 1}: ${m[0]}`);
      }
    });
  }
  return lista;
}

const coincidencias = (regex, texto, aceptable) => [...texto.matchAll(regex)].filter((m) => !aceptable(m)).length;

test('el listado de archivos versionados no está vacío y se pudo leer', () => {
  assert.ok(archivos.length > 50, `solo ${archivos.length} archivos`);
  assert.ok(textos.length > 50);
});

test('FALSIFICACIÓN · los detectores detectan lo inventado y dejan pasar los marcadores', () => {
  const inventado = 'fulano-de-prueba';
  // Armado por partes para que el gate del repositorio limpio no encuentre estas rutas de ejemplo.
  const U = ['Us', 'ers'].join('');
  const H = ['ho', 'me'].join('');
  assert.equal(coincidencias(RUTA_WINDOWS, `C:\\Users\\${inventado}\\Desktop`, esMarcador), 1);
  assert.equal(coincidencias(RUTA_WINDOWS, `D:/${U}/${inventado}/x`, esMarcador), 1);
  assert.equal(coincidencias(RUTA_LINUX, `cd /${H}/${inventado}/proyectos`, esMarcador), 1);
  assert.equal(coincidencias(RUTA_MAC, `open /${U}/${inventado}/Documents`, esMarcador), 1);
  assert.equal(coincidencias(RUTA_WINDOWS, `C:\\${U}\\ejemplo\\Desktop`, esMarcador), 0);
  assert.equal(coincidencias(RUTA_LINUX, `cd /${H}/usuario/proyectos`, esMarcador), 0);
  assert.equal(coincidencias(CORREO, `${inventado}@correo-inventado.org`, esCorreoDeEjemplo), 1);
  assert.equal(coincidencias(CORREO, 'ana@example.com', esCorreoDeEjemplo), 0);
  assert.equal(coincidencias(CORREO, 'noreply@anthropic.com', esCorreoDeEjemplo), 0);
  assert.equal(coincidencias(CORREO, `12345+${inventado}@users.noreply.github.com`, esCorreoDeEjemplo), 0);
  assert.equal(coincidencias(CORREO, 'actions/checkout@v5.1.0', esCorreoDeEjemplo), 0, 'package@version no es un correo');
  assert.equal(coincidencias(NOMBRE_ANTERIOR, `${['.v', 'ibe'].join('')}/SESSION.md`, () => false), 1);
  assert.equal(coincidencias(NOMBRE_ANTERIOR, `${['V', 'CP'].join('')} y ${['v', 'cp'].join('')}-runtime`, () => false), 2);
  assert.equal(coincidencias(NOMBRE_ANTERIOR, 'vCPU de un plan gratuito', () => false), 0, 'vCPU es otra cosa');
});

test('ninguna ruta de directorio personal real', () => {
  const lista = [
    ...hallazgos(RUTA_WINDOWS, esMarcador),
    ...hallazgos(RUTA_LINUX, esMarcador),
    ...hallazgos(RUTA_MAC, esMarcador),
  ];
  assert.deepEqual(lista, []);
});

test('ningún correo que no sea de ejemplo', () => {
  assert.deepEqual(hallazgos(CORREO, esCorreoDeEjemplo), []);
});

test('el nombre anterior del protocolo sólo aparece en los dos archivos de migración', () => {
  assert.deepEqual(hallazgos(NOMBRE_ANTERIOR, () => false, MIGRACION), []);
  for (const ruta of MIGRACION) assert.ok(archivos.includes(ruta), `${ruta} tiene que estar versionado`);
});
