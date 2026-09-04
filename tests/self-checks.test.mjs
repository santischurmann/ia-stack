// Esta prueba busca los self-checks SOLA, en vez de que alguien los liste.
//
// Una lista sólo encuentra lo que ya pensó quien la escribió — es el defecto que este repositorio
// ya pagó cuatro veces. Así que acá no hay lista de pruebas culpables: hay una regla de forma.
//
// REGLA: una prueba que lee un archivo de la raíz del checkout que el instalador NO copia sólo
// puede existir si el archivo que la contiene sabe distinguir dónde está corriendo. El instalador
// copia `tests/` entero al proyecto de otra persona; sin esa guarda, la prueba se ejecuta allá y
// falla —o peor, le pregunta cosas al repositorio ajeno.
//
// Lo que esta comprobación NO puede hacer, dicho de frente: verifica que el archivo IMPORTE la
// guarda, no que la use en la prueba correcta. Un archivo puede importarla y olvidarse de aplicarla
// en un caso. Lo que sí cierra ese hueco es la medición de punta a punta —instalar y correr la
// suite—, que no se puede hacer desde acá adentro sin volverse circular.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { COPIADO_A_LA_RAIZ, esRuntimeInstalado, existeEnRuntimeInstalado, saltarSiEsRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const testsDir = join(repoRoot, 'tests');

// `join(repoRoot, 'README.md')`, `join(repoRoot, 'docs', 'x')`, `join(repoRoot, 'examples', ...)`.
const LECTURA_DESDE_RAIZ = /join\(\s*repoRoot\s*,\s*'([^']+)'/gu;

export function archivosQueLeenLaRaiz(leer = readFileSync, listar = readdirSync, dir = testsDir, hay = existsSync, raiz = repoRoot) {
  const fuera = [];
  for (const nombre of listar(dir).filter((f) => f.endsWith('.test.mjs'))) {
    const texto = leer(join(dir, nombre), 'utf8');
    const rutas = [...new Set([...texto.matchAll(LECTURA_DESDE_RAIZ)].map((m) => m[1]))]
      // Sin copiar: sólo esas pueden faltar en una instalación.
      .filter((r) => !existeEnRuntimeInstalado(r))
      // Y que EXISTAN en el checkout. Una ruta inventada a propósito por la prueba —para ejercitar
      // el caso «no está»— no depende del checkout y se comporta igual en cualquier máquina.
      .filter((r) => hay(join(raiz, r)));
    if (rutas.length === 0) continue;
    fuera.push({ archivo: nombre, rutas, tieneGuarda: texto.includes('_entorno.mjs') });
  }
  return fuera;
}

test('toda prueba que lee la raíz del checkout sabe si está en un runtime instalado', () => {
  const sinGuarda = archivosQueLeenLaRaiz().filter((f) => !f.tieneGuarda);
  assert.deepEqual(
    sinGuarda.map((f) => `${f.archivo} lee ${f.rutas.join(', ')}`),
    [],
    'estas pruebas se copian al proyecto de otra persona y ahí leen archivos que el instalador no dejó',
  );
});

test('FALSIFICACIÓN · el detector distingue lo que el instalador copia de lo que no', () => {
  const falso = (nombre) => (nombre.endsWith('con.test.mjs')
    ? "readFileSync(join(repoRoot, 'README.md'));\nimport './_entorno.mjs';"
    : "readFileSync(join(repoRoot, 'README.md'));");
  const listar = () => ['sin.test.mjs', 'con.test.mjs', 'copiado.test.mjs', 'ignorado.mjs'];
  const leer = (ruta) => (String(ruta).includes('copiado')
    ? "readFileSync(join(repoRoot, 'contracts', 'x.json'));"
    : falso(String(ruta)));
  const r = archivosQueLeenLaRaiz(leer, listar, 'x', () => true, 'raiz');
  // `copiado` lee contracts/, que el instalador SÍ copia: no es un self-check y no aparece.
  assert.deepEqual(r.map((f) => f.archivo), ['sin.test.mjs', 'con.test.mjs']);
  assert.equal(r.find((f) => f.archivo === 'sin.test.mjs').tieneGuarda, false);
  assert.equal(r.find((f) => f.archivo === 'con.test.mjs').tieneGuarda, true);
  // `ignorado.mjs` no termina en .test.mjs: no lo copia el runner, no lo mira el detector.
  assert.equal(r.some((f) => f.archivo === 'ignorado.mjs'), false);
});

test('FALSIFICACIÓN · lo que el instalador copia a la raíz no se inventa acá', () => {
  // Si `COPIED_DIRECTORIES` del gate de sincronía cambia y esta lista no, el detector empieza a
  // acusar pruebas legítimas o a dejar pasar self-checks. Se comparan contra la fuente única.
  const gate = readFileSync(join(repoRoot, 'scripts', 'verify-runtime-sync.mjs'), 'utf8');
  const m = gate.match(/COPIED_DIRECTORIES\s*=\s*\[([^\]]*)\]/u);
  assert.ok(m, 'no se pudo leer COPIED_DIRECTORIES del gate de sincronía');
  const directorios = [...m[1].matchAll(/'([^']+)'/gu)].map((x) => x[1]);
  assert.deepEqual(directorios, COPIADO_A_LA_RAIZ.filter((x) => !x.endsWith('.md')));
});

test('FALSIFICACIÓN · la guarda de entorno reconoce una instalación y no un checkout', (t) => {
  assert.equal(esRuntimeInstalado(join('C:', 'proy', '.vibe', 'vcp-runtime')), true);
  assert.equal(esRuntimeInstalado(join('C:', 'Users', 'x', 'ia-stack')), false);
  // Y el atajo que usan las pruebas: en el checkout no saltea nada.
  assert.equal(saltarSiEsRuntimeInstalado(t, repoRoot, 'prueba'), esRuntimeInstalado(repoRoot));
});
