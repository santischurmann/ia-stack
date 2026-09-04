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

// --- LO QUE FALTA, Y NO SE FINGE QUE ESTE.
//
// La regla de arriba mira que ARCHIVOS lee una prueba. Falta la otra mitad: a QUIEN le pregunta.
// Diez de los veintiseis fallos de una instalacion no leian ningun archivo de la raiz -- le pasaban
// `repoRoot` a un gate o corrian `git` con `cwd: repoRoot`, y el instalador gitignora el runtime,
// asi que git devuelve cero para todo.
//
// Esas diez se marcaron A MANO. Se intentaron TRES reglas de forma y las tres fallaron con numeros:
//
//   1. Marcar toda prueba que pasa `repoRoot` a cualquier funcion. Sobre-disparo: es legitimo
//      cuando lee un archivo que el instalador SI copia.
//   2. Acotarla a git con una VENTANA DE LINEAS. Sobre-disparo: agarra `git` y `repoRoot` en
//      partes del archivo que no tienen nada que ver entre si.
//   3. Estructural, medida el 2026-09-04 sobre los 90 archivos: marcar la llamada cuyo PRIMER
//      argumento es el literal 'git' y cuya MISMA lista lleva `cwd: repoRoot` o `'-C', repoRoot`.
//      No sobre-dispara, y por eso es la que mas duele: marca 5 archivos y los 5 YA TIENEN GUARDA.
//      Cero hallazgos nuevos, hoy y desde el dia que se escriba. Y es ciega a las tres formas que
//      este repositorio usa todo el tiempo -- el `cwd` por shorthand (`{ cwd, ... }`, 10 sitios),
//      la raiz que llega como parametro de un helper (16 de 35 call-sites de git) y la raiz que se
//      llama `root` en vez de `repoRoot` (29 archivos contra 49). La peor de las tres es la que
//      importa: `repoRemoto` en tests/verify-ablation.test.mjs:1499 corre `git remote get-url
//      origin` con la raiz en el DEFAULT DEL PARAMETRO y el `cwd` por shorthand, que es
//      exactamente la fuga historica que motivo la guarda, y ninguna version de la regla la ve.
//      Ensancharla a `root` cuesta ~14 falsos positivos sobre directorios temporales, con 0
//      hallazgos reales.
//
// Marcar pruebas correctas para que mi regla quede verde habria sido peor que no tener regla: un
// guarda que grita en falso se ignora, y uno que se ignora no detecta nada. Pagar ~140 lineas de
// lexer por cero hallazgos tampoco es un gate: es superficie de mantenimiento con etiqueta de
// seguridad.
//
// Entonces queda dicho, y es dato en el contrato, no un comentario que se pueda borrar en silencio:
// **La regla de forma mira qué archivos lee una prueba, nunca a quién le pregunta.** Lo que cubre
// esa otra mitad no es una regla, es la medicion de punta a punta -- instalar en un proyecto limpio
// y correr la suite -- que hoy da cero fallos.
