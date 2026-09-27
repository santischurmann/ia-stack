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
//
// Y CADA EXCEPCIÓN ES UNA FORMA, NO UNA CADENA, desde el 2026-09-27. La versión anterior borraba el
// texto de cada excepción de la línea ENTERA antes de buscar, y `vcp-` —declarado para los prefijos
// de `mkdtempSync`— se comía cualquier cosa que empezara igual: la carpeta `vcp-skills` que el
// instalador de bash seguía creando, cuatro mails de fixtures, un paquete falso, nombres de prueba.
// Lo encontró la revisión del 2026-09-26; medido, esa sola excepción tapaba 196 sitios. Ahora una
// aparición queda exenta sólo si cae ENTERA adentro de lo que la forma de su excepción reconoce, en
// esa línea y en ese archivo, y cada excepción trae un ejemplo que cubre y uno que no.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { prefijosDe } from '../scripts/limpiar-temporales.mjs';
import { COPIED_DIRECTORIES, COPIED_FILES } from '../scripts/verify-runtime-sync.mjs';
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
// SIN DISTINGUIR MAYUSCULAS, desde el 2026-09-26. Con la bandera `u` sola, la forma en minuscula le
// era invisible, y por ahi se escapo el nombre del zip de la release —`vibecodeprotocols-<version>.zip`—
// durante once dias despues de declarar terminado el rename. Un guarda que busca un nombre tiene que
// buscarlo en las formas en que se escribe, no en la que uso quien lo escribio primero.
export const NOMBRE_ANTERIOR = new RegExp(`${LARGO}|\\b${CORTO}\\b`, 'iu');
const TODAS = new RegExp(NOMBRE_ANTERIOR.source, 'giu');

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

/** Una excepción lista para aplicar. Una cadena suelta es su propia forma, literal. */
export function compilarExcepcion(e) {
  if (typeof e === 'string') return { forma: new RegExp(e.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu'), en: '' };
  return { forma: new RegExp(e.forma, 'gu'), en: e.en ?? '' };
}

/** Los sitios de un archivo donde el nombre anterior sobrevive. Una aparición queda exenta SÓLO si
 * cae entera adentro de lo que reconoce la forma de una excepción que vale para ese archivo. En un
 * documento no hay comentarios: una línea que empieza con `#` es un título, y se lee. */
export function residuos(texto, exentos, archivo = '', { comentarios = true } = {}) {
  const formas = exentos.map(compilarExcepcion).filter((e) => archivo.startsWith(e.en));
  const encontrados = [];
  for (const [i, linea] of texto.split(/\r?\n/u).entries()) {
    if (comentarios && esComentario(linea)) continue;
    const resto = comentarios ? sinComentarioDeCola(linea) : linea;
    const cubierto = formas.flatMap(({ forma }) => [...resto.matchAll(forma)].map((m) => [m.index, m.index + m[0].length]));
    const libre = [...resto.matchAll(TODAS)].some((m) => !cubierto.some(([a, b]) => a <= m.index && m.index + m[0].length <= b));
    if (libre) encontrados.push({ linea: i + 1, texto: linea.trim().slice(0, 100) });
  }
  return encontrados;
}

export function leerContrato(cwd = repoRoot, leer = (r) => readFileSync(join(cwd, r), 'utf8')) {
  const d = JSON.parse(leer(CONTRATO));
  assert.ok(Array.isArray(d.excepciones) && d.excepciones.length > 0, 'un contrato sin excepciones no declara nada');
  for (const e of d.excepciones) {
    const nombre = e.forma ?? e.archivo;
    assert.ok((typeof e.forma === 'string') !== (typeof e.archivo === 'string'), `cada excepción es una forma o un archivo, una sola de las dos: ${JSON.stringify(nombre)}`);
    assert.ok(String(e.por_que ?? '').length > 40, `la excepción ${nombre} no dice por qué se queda`);
    assert.ok(String(e.que_pasa_si_se_toca ?? '').length > 40, `la excepción ${nombre} no dice qué se rompe si se toca`);
    if (e.archivo !== undefined) continue;
    // La forma se prueba contra sus dos ejemplos: uno que tiene que cubrir y uno, del mismo aspecto,
    // que no. Sin el segundo, una forma demasiado ancha pasa igual que una justa —que es lo que pasó.
    const donde = `${e.en ?? ''}ejemplo.mjs`;
    assert.equal(typeof e.ejemplo, 'string', `la excepción ${nombre} no trae un ejemplo de lo que cubre`);
    assert.equal(typeof e.no_cubre, 'string', `la excepción ${nombre} no trae un ejemplo de lo que NO cubre`);
    assert.ok(new RegExp(e.forma, 'u').test(e.ejemplo), `la forma de ${nombre} no reconoce su propio ejemplo`);
    assert.deepEqual(residuos(e.ejemplo, [e], donde), [], `la excepción ${nombre} no cubre su propio ejemplo`);
    assert.equal(residuos(e.no_cubre, [e], donde).length, 1, `la excepción ${nombre} cubre lo que dice que no cubre`);
  }
  return d;
}

test('ninguna cadena de código versionado publica todavía el nombre anterior', SOLO_FUENTE, () => {
  const contrato = leerContrato();
  const archivosExentos = contrato.excepciones.filter((e) => e.archivo).map((e) => e.archivo);
  const formas = contrato.excepciones.filter((e) => e.forma);
  const archivos = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((l) => l.trim())
    .filter((f) => f && EXTENSIONES.some((ext) => f.endsWith(ext)));
  assert.ok(archivos.length > 50, `sólo ${archivos.length} archivos de código: el barrido no midió nada`);

  const sobran = [];
  for (const archivo of archivos) {
    if (archivosExentos.includes(archivo)) continue;
    for (const { linea, texto } of residuos(readFileSync(join(repoRoot, archivo), 'utf8'), formas, archivo)) {
      sobran.push(`${archivo}:${linea}  ${texto}`);
    }
  }
  assert.deepEqual(sobran, [], `${sobran.length} sitio(s) siguen publicando el nombre anterior. Si alguno es un identificador atado a algo que ya existe afuera, declaralo en ${CONTRATO} con qué se rompe si se toca`);
});

// LOS DOCUMENTOS QUE VIAJAN AL RUNTIME, desde el 2026-09-27. El barrido de arriba mira código, y
// la revisión del 2026-09-26 encontró la sigla anterior como nombre del producto en lo que el
// instalador copia a cada proyecto: el título de SECURITY.md, la descripción de la skill, los
// punteros para Codex, las sub-skills. Se barren con la MISMA máquina y el MISMO contrato; lo único
// distinto es que en Markdown una línea con `#` es un título y no un comentario. README, INSTALL y
// CHANGELOG quedan afuera: no viajan al runtime y cuentan, a propósito, la historia del rename.
export function documentosEntregados(listados) {
  return listados.filter((f) => f.endsWith('.md')
    && (COPIED_FILES.includes(f) || COPIED_DIRECTORIES.includes(f.split('/')[0])));
}

test('los documentos que el instalador copia no usan el nombre anterior como nombre del producto', SOLO_FUENTE, () => {
  const formas = leerContrato().excepciones.filter((e) => e.forma);
  const documentos = documentosEntregados(execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).split('\n').map((l) => l.trim()));
  assert.ok(documentos.length > 10, `sólo ${documentos.length} documentos entregados: el barrido no midió nada`);
  const sobran = [];
  for (const archivo of documentos) {
    for (const { linea, texto } of residuos(readFileSync(join(repoRoot, archivo), 'utf8'), formas, archivo, { comentarios: false })) {
      sobran.push(`${archivo}:${linea}  ${texto}`);
    }
  }
  assert.deepEqual(sobran, [], `${sobran.length} sitio(s) de documentos entregados usan el nombre anterior`);
});

test('FALSIFICACIÓN · en un documento, un título con el nombre anterior se marca', () => {
  assert.deepEqual(residuos(`# Seguridad de ${CORTO}`, []), [], 'en código es un comentario');
  assert.equal(residuos(`# Seguridad de ${CORTO}`, [], 'SECURITY.md', { comentarios: false }).length, 1, 'en un documento es un título');
  assert.deepEqual(documentosEntregados(['SKILL.md', 'README.md', 'skills/a.md', 'skills/a.mjs', 'docs/x.md', '.agents/skills/b/SKILL.md']), ['SKILL.md', 'skills/a.md', '.agents/skills/b/SKILL.md']);
});

// La excepción de los temporales se justifica por el limpiador: `scripts/limpiar-temporales.mjs`
// deriva los prefijos de cada `mkdtempSync` de tests/, y renombrarlos dejaría huérfanas las carpetas
// que ya están en el disco. Entonces la forma tiene que reconocer EXACTAMENTE esos prefijos: si cubre
// uno que el limpiador no deriva, el motivo no vale para ese; si le falta uno, lo acusa de residuo.
test('la excepción de los temporales reconoce los mismos prefijos que deriva el limpiador', () => {
  const excepcion = leerContrato().excepciones.find((e) => /mkdtempSync/u.test(e.forma ?? ''));
  assert.ok(excepcion, 'no hay excepción para los prefijos de mkdtempSync');
  const forma = compilarExcepcion(excepcion).forma;
  const reconocidos = new Set();
  const carpeta = join(repoRoot, excepcion.en);
  for (const nombre of readdirSync(carpeta).filter((n) => n.endsWith('.mjs'))) {
    for (const m of readFileSync(join(carpeta, nombre), 'utf8').matchAll(forma)) reconocidos.add(m[0].match(/'([^']*)'$/u)[1]);
  }
  const derivados = prefijosDe(repoRoot).filter((p) => NOMBRE_ANTERIOR.test(p));
  assert.ok(derivados.length > 0, 'el limpiador no derivó ningún prefijo con el nombre anterior: la comparación no mide nada');
  assert.deepEqual([...reconocidos].sort(), derivados);
});

test('FALSIFICACIÓN · el barrido separa prosa de comentario y respeta las excepciones', () => {
  assert.deepEqual(residuos('const a = 1;', []), []);
  assert.equal(residuos(`write('el repositorio de ${CORTO}');`, []).length, 1, 'una cadena visible se marca');
  assert.deepEqual(residuos(`// el repositorio de ${CORTO} se llamaba así`, []), [], 'un comentario es historia');
  assert.deepEqual(residuos(` * el repositorio de ${CORTO}`, []), [], 'un bloque JSDoc también');
  assert.deepEqual(residuos(`# banner de ${CORTO}`, []), [], 'y un comentario de shell');
  assert.deepEqual(residuos(`const x = 1; // ${CORTO} legacy`, []), [], 'un comentario de cola no es código');
  // La versión anterior probaba esto con `VCPLINE:`, que el guarda ni siquiera detecta —no hay
  // frontera de palabra entre la sigla y LINE—: la falsificación pasaba sin falsificar nada.
  assert.equal(residuos(`const p = '${CORTO}:';`, []).length, 1, 'sin la excepción, se marca');
  assert.deepEqual(residuos(`const p = '${CORTO}:';`, [`${CORTO}:`]), [], 'con la excepción declarada, no');
});

test('FALSIFICACIÓN · una excepción cubre sólo lo que cae ENTERO adentro de su forma', () => {
  const temporales = { forma: "mkdtempSync\\(\\s*join\\(\\s*tmpdir\\(\\)\\s*,\\s*'vcp-[^']*'", en: 'tests/' };
  // Lo que la versión anterior tapaba: la cadena de la excepción aparecía, y se borraba de la línea.
  assert.equal(residuos('mkdir -p "$TARGET_DIR/vcp-skills"', ['vcp-'], 'scripts/install.sh').length, 0, 'la forma vieja lo tapaba');
  assert.equal(residuos('mkdir -p "$TARGET_DIR/vcp-skills"', [temporales], 'tests/x.test.mjs').length, 1, 'la forma nueva no');
  assert.equal(residuos("git(root, 'config', 'user.email', 'vcp-tests@example.invalid');", [temporales], 'tests/x.test.mjs').length, 1);
  assert.deepEqual(residuos("const r = mkdtempSync(join(tmpdir(), 'vcp-ratchet-'));", [temporales], 'tests/x.test.mjs'), []);
  // Dos apariciones en la misma línea: la que cae adentro de la forma se perdona, la otra no.
  assert.equal(residuos(`const r = mkdtempSync(join(tmpdir(), 'vcp-a-')); log('${CORTO}');`, [temporales], 'tests/x.test.mjs').length, 1);
  // Y la forma vale donde dice que vale: el mismo mkdtemp en scripts/ no lo deriva el limpiador.
  assert.equal(residuos("const r = mkdtempSync(join(tmpdir(), 'vcp-a-'));", [temporales], 'scripts/x.mjs').length, 1);
});

test('FALSIFICACIÓN · una excepción sin motivo, sin ejemplos, o con una forma más ancha de lo que dice, no es una excepción', () => {
  const motivo = 'un motivo escrito de largo más que suficiente para pasar el umbral de cuarenta';
  const rompe = 'lo que se rompe, también escrito de largo más que suficiente para el umbral';
  const bien = { forma: 'VCP:', ejemplo: "const p = 'VCP:';", no_cubre: "const p = 'VCP';", por_que: motivo, que_pasa_si_se_toca: rompe };
  // La referencia pasa: si no pasara, lo de abajo fallaría por el motivo equivocado.
  assert.doesNotThrow(() => leerContrato(repoRoot, () => JSON.stringify({ excepciones: [bien] })));
  for (const [cambio, motivoDelRechazo] of [
    [{ por_que: 'porque sí' }, /no dice por qué/u],
    [{ que_pasa_si_se_toca: 'nada' }, /no dice qué se rompe/u],
    [{ ejemplo: undefined }, /no trae un ejemplo de lo que cubre/u],
    [{ no_cubre: undefined }, /no trae un ejemplo de lo que NO cubre/u],
    [{ ejemplo: "const p = 'otra cosa';" }, /no reconoce su propio ejemplo/u],
    // La forma demasiado ancha: `VCP` cubre también lo que el ejemplo negativo dice que no cubre.
    [{ forma: 'VCP' }, /cubre lo que dice que no cubre/u],
    [{ archivo: 'x.mjs' }, /una forma o un archivo, una sola/u],
  ]) {
    const excepcion = { ...bien, ...cambio };
    assert.throws(() => leerContrato(repoRoot, () => JSON.stringify({ excepciones: [excepcion] })), motivoDelRechazo, JSON.stringify(cambio));
  }
});

test('el nombre CORTO se busca con frontera de palabra, o marcaría cualquier palabra que lo contenga', () => {
  assert.equal(residuos(`const s = 'MIVCPX';`, []).length, 0, 'adentro de otra palabra no es el nombre');
  assert.equal(residuos(`const s = 'el ${CORTO} nuevo';`, []).length, 1);
});

test('FALSIFICACIÓN · la forma en minúscula también es el nombre anterior', () => {
  // La que se escapó: el nombre del zip de la release, en minúscula, en un script de shell.
  assert.equal(residuos(`OUTPUT_NAME="${LARGO.toLowerCase()}-1.0.0"`, []).length, 1);
  assert.equal(residuos(`const d = '.agents/skills/${LARGO.toLowerCase()}/SKILL.md';`, []).length, 1);
  assert.equal(residuos(`const s = '${CORTO.toLowerCase()}';`, []).length, 1, 'la sigla en minúscula, como palabra suelta');
});
