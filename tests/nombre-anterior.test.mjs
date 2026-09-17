// El nombre anterior no vuelve a aparecer en algo que alguien lee.
//
// LA HERIDA, del 2026-09-17: el mensaje de rechazo de `verify-runtime-sync` decía «this directory is
// not a VibeCodeProtocols source checkout». El rename de fondo se había hecho dos días antes, en
// `45c6172`, pero la prosa quedó: banners de los dos instaladores, el límite de `verify-deploy`, los
// mensajes de `--diff-against`, y el motivo de salteo copiado a mano en **35 archivos de prueba**.
// 82 sitios en 52 archivos. Nadie lo vio porque un rename se revisa por su diff, y esas cadenas no
// estaban en el diff de nada.
//
// LA LISTA SE DERIVA DEL ÁRBOL, NO SE ESCRIBE. Una lista escrita a mano de «lo que falta renombrar»
// sólo encuentra lo que ya pensó quien la escribió, y se queda vieja el día que alguien agrega la
// cadena número 83. Acá se barre el código versionado y lo que sobra es lo que falta.
//
// LO QUE NO SE TOCA VIVE EN UN CONTRATO, `contracts/nombre-anterior.json`, con el motivo de cada uno
// y qué se rompe si alguien lo «completa». Porque la parte difícil de este rename no es encontrar lo
// que falta: es no tocar lo que parece faltar y no falta. Un identificador con el nombre viejo está
// atado a algo que ya existe afuera —una carpeta en el disco de otra persona, un comando en su
// memoria muscular, un artefacto ya escrito— y cambiarlo no completa el rename: rompe instalaciones.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de IA Stack, no del proyecto de quien instala' }
  : {};

export const CONTRATO = join('contracts', 'nombre-anterior.json');
export const EXTENSIONES = ['.mjs', '.sh', '.ps1'];

// El nombre anterior, armado en piezas para que este archivo no se acuse a sí mismo por escribirlo.
// La excepción de abajo lo cubre igual; esto es que no dependa sólo de ella.
const LARGO = ['Vibe', 'Code', 'Protocols'].join('');
const CORTO = 'VCP';
export const NOMBRE_ANTERIOR = new RegExp(`${LARGO}|\\b${CORTO}\\b`, 'u');

/** Una línea que es sólo un comentario es historia, no residuo. */
export function esComentario(linea) {
  const s = linea.trim();
  return s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('#');
}

/** Lo que queda de una línea de código después de sacarle el comentario de la cola. */
export function sinComentarioDeCola(linea) {
  const i = linea.indexOf('//');
  if (i === -1) return linea;
  // Un `//` adentro de comillas no abre un comentario. Se cuenta si el tramo previo cierra pares.
  const previo = linea.slice(0, i);
  for (const comilla of ['"', "'", '`']) {
    if ((previo.split(comilla).length - 1) % 2 === 1) return linea;
  }
  return previo;
}

/** Los sitios de un archivo donde el nombre anterior sobrevive, ya descontadas las excepciones. */
export function residuos(texto, exentos) {
  const encontrados = [];
  for (const [i, linea] of texto.split(/\r?\n/u).entries()) {
    if (esComentario(linea)) continue;
    let resto = sinComentarioDeCola(linea);
    for (const patron of exentos) resto = resto.split(patron).join('');
    if (NOMBRE_ANTERIOR.test(resto)) encontrados.push({ linea: i + 1, texto: linea.trim().slice(0, 100) });
  }
  return encontrados;
}

export function leerContrato(cwd = repoRoot, leer = (r) => readFileSync(join(cwd, r), 'utf8')) {
  const d = JSON.parse(leer(CONTRATO));
  assert.ok(Array.isArray(d.excepciones) && d.excepciones.length > 0, 'un contrato sin excepciones no declara nada');
  for (const e of d.excepciones) {
    assert.equal(typeof e.patron, 'string', 'cada excepción necesita su patrón');
    assert.ok(String(e.por_que ?? '').length > 40, `la excepción ${e.patron} no dice por qué se queda`);
    assert.ok(String(e.que_pasa_si_se_toca ?? '').length > 40, `la excepción ${e.patron} no dice qué se rompe si se toca`);
  }
  return d;
}

test('ninguna cadena de código versionado publica todavía el nombre anterior', SOLO_FUENTE, () => {
  const contrato = leerContrato();
  const exentos = contrato.excepciones.map((e) => e.patron);
  const archivos = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((l) => l.trim())
    .filter((f) => f && EXTENSIONES.some((ext) => f.endsWith(ext)));
  assert.ok(archivos.length > 50, `sólo ${archivos.length} archivos de código: el barrido no midió nada`);

  const sobran = [];
  for (const archivo of archivos) {
    if (exentos.includes(archivo)) continue;
    for (const { linea, texto } of residuos(readFileSync(join(repoRoot, archivo), 'utf8'), exentos)) {
      sobran.push(`${archivo}:${linea}  ${texto}`);
    }
  }
  assert.deepEqual(sobran, [], `${sobran.length} sitio(s) siguen publicando el nombre anterior. Si alguno es un identificador atado a algo que ya existe afuera, declaralo en ${CONTRATO} con qué se rompe si se toca`);
});

test('FALSIFICACIÓN · el barrido separa prosa de comentario y respeta las excepciones', () => {
  assert.deepEqual(residuos('const a = 1;', []), []);
  assert.equal(residuos(`write('el repositorio de ${CORTO}');`, []).length, 1, 'una cadena visible se marca');
  assert.deepEqual(residuos(`// el repositorio de ${CORTO} se llamaba así`, []), [], 'un comentario es historia');
  assert.deepEqual(residuos(` * el repositorio de ${CORTO}`, []), [], 'un bloque JSDoc también');
  assert.deepEqual(residuos(`# banner de ${CORTO}`, []), [], 'y un comentario de shell');
  assert.deepEqual(residuos(`const x = 1; // ${CORTO} legacy`, []), [], 'un comentario de cola no es código');
  assert.deepEqual(residuos(`const p = '${CORTO}LINE:';`, ['VCPLINE:']), [], 'una excepción declarada no se marca');
});

test('FALSIFICACIÓN · una excepción sin motivo, o sin decir qué rompe, no es una excepción', () => {
  for (const excepciones of [
    [{ patron: 'x' }],
    [{ patron: 'x', por_que: 'porque sí' }],
    [{ patron: 'x', por_que: 'un motivo escrito de largo más que suficiente para pasar el umbral', que_pasa_si_se_toca: 'nada' }],
  ]) {
    assert.throws(() => leerContrato(repoRoot, () => JSON.stringify({ excepciones })));
  }
});

test('el nombre CORTO se busca con frontera de palabra, o marcaría cualquier palabra que lo contenga', () => {
  assert.equal(residuos(`const s = 'MIVCPX';`, []).length, 0, 'adentro de otra palabra no es el nombre');
  assert.equal(residuos(`const s = 'el ${CORTO} nuevo';`, []).length, 1);
});
