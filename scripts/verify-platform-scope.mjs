#!/usr/bin/env node
// verify-platform-scope.mjs — una prueba que no corre en una plataforma tiene que DECIRLO.
//
// EL PROBLEMA QUE RESUELVE, y aparecio midiendo. El CI de este repositorio corrio por primera vez
// fuera de la maquina del autor el 2026-09-16 y nueve pruebas salieron rojas: la suite asumia
// Windows -- PowerShell, el shim de WSL, junctions, rutas con letra de unidad -- y el runner era
// Ubuntu. No era una regresion: era el estreno. Verde en un solo lugar, nunca probada en otro.
//
// LA SALIDA FACIL SERIA UN `if` SUELTO en cada prueba, y es exactamente lo que este gate impide. Un
// salteo escrito adentro de la prueba que se saltea no lo revisa nadie: una prueba que se saltea en
// TODAS las plataformas, o por un motivo que dejo de valer, se ve igual que una que corre. La
// declaracion vive en un contrato -- como los limites honestos -- y se comprueba en los DOS
// sentidos: lo declarado existe en el arbol, y lo que se saltea esta declarado.
//
// Y SE SALTEA COMO **VACIO**, NUNCA COMO OK. Es el vocabulario del propio protocolo: «no habia nada
// que comparar» no es «compare y paso». Seria incoherente que el repositorio del protocolo se lo
// aplicara al reves a si mismo.
//
// LO QUE SE EXIGE POR CADA DECLARACION son dos cosas y la segunda es la que importa: por que la
// prueba es de esa plataforma, y QUE QUEDA SIN VERIFICAR en las demas. «Esta prueba es de Windows»
// no dice nada. El hueco es lo otro.
//
// LIMITE HONESTO. Comprueba que el salteo este declarado y que la declaracion corresponda a una
// prueba real, nunca que el motivo sea cierto: una prueba que declara plataforma sin necesitarla
// pasa en verde. Y no corre nada: no sabe si la prueba pasaria en la plataforma que dice excluir.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { mismoSchema } from './schema-compat.mjs';

export const USAGE = 'usage: verify-platform-scope.mjs check';
export const SCHEMA = 'ia.platform-scope/1';
export const EMPTY = 'VACÍO';
export const CONTRATO = join('contracts', 'platform-scope.json');

/** Los valores reales de `process.platform`. Lista cerrada: «windows» no es ninguno y se saltearia siempre. */
export const PLATAFORMAS = Object.freeze(['win32', 'linux', 'darwin', 'freebsd', 'openbsd', 'sunos', 'aix', 'android']);

const MIN_MOTIVO = 20;
const largo = (v) => typeof v === 'string' && v.trim().length >= MIN_MOTIVO;
const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Las pruebas que DECLARAN plataforma, leidas del arbol y no de una lista.
 *
 * Se busca la forma exacta con la que se escribe -- `test('titulo', soloEnWindows(` -- y no la
 * simple mencion del nombre: un comentario que explica el mecanismo no es una prueba que se saltee,
 * y contarlo obligaria a declarar en el contrato una prueba que no existe.
 */
export function salteosEnElArbol(archivos, leer) {
  const encontrados = [];
  // Las tres comillas de JavaScript, porque las tres se usan en este repositorio.
  // EL TITULO NO CRUZA UN SALTO DE LINEA. Con `[\s\S]*?` el cierre mas cercano puede estar cuarenta
  // lineas mas abajo, en otra prueba, y el barrido devuelve medio archivo como si fuera un titulo.
  // Se contempla la comilla escapada: un titulo puede traer \' adentro y cortar ahi lo partiria.
  const PATRON = /(^|[\s;{(])test\(\s*(['"`])((?:\\.|(?!\2)[^\\\n])*)\2\s*,\s*soloEn[A-Za-z]+\(/gu;
  for (const archivo of archivos) {
    let fuente;
    try { fuente = leer(archivo); } catch { continue; }
    for (const m of String(fuente).matchAll(PATRON)) encontrados.push([archivo, m[3]]);
  }
  return encontrados;
}

/**
 * LO QUE REALMENTE SE SALTEO, leido de la salida TAP de la corrida.
 *
 * El barrido del arbol solo ve la forma que este protocolo inventa -- `soloEnWindows(` -- y hay
 * otras dos: `{ skip: motivo }` en las opciones de la prueba, y `t.skip(motivo)` desde adentro.
 * Las tres emiten la misma linea en TAP, asi que leer la corrida las ve a todas. Medido el
 * 2026-09-16 sobre una corrida verde: Linux salteo 12 pruebas que Windows corrio, y el gate
 * informaba que ninguna se salteaba sin declarar.
 */
export function salteosDeTap(texto) {
  const salteadas = new Set();
  // `ok 2 - nombre de la prueba # SKIP motivo`. El `not ok` no cuenta: una que falla no se salteo.
  const PATRON = /^ok\s+\d+\s+-\s+(.*?)\s+#\s*SKIP\b/gmu;
  for (const m of String(texto).matchAll(PATRON)) salteadas.add(m[1]);
  return salteadas;
}

/**
 * LA ASIMETRIA, que es lo que de verdad importa. No el salteo.
 *
 * En este arbol hay 55 salteos y casi todos son correctos: los self-checks del repositorio se
 * saltean en las dos plataformas y eso no deja nada sin verificar en una que la otra si verifique.
 * Lo que rompe la simetria es una prueba que se saltea en UNA y corre en la OTRA -- ahi una
 * plataforma tiene un hueco que la otra no, y tiene que estar declarado.
 *
 * Y una declaracion MUERTA tambien se rechaza: si ya no corresponde a ningun salteo, oculta cuanto
 * se esta salteando de verdad, y el dia que el salteo vuelva nadie lo va a mirar.
 */
export function asimetriaDeSalteos(a, b, declaradas) {
  const soloEnA = [...a.salteos].filter((t) => !b.salteos.has(t));
  const soloEnB = [...b.salteos].filter((t) => !a.salteos.has(t));
  const asimetricas = [
    ...soloEnA.map((t) => [t, a.plataforma, b.plataforma]),
    ...soloEnB.map((t) => [t, b.plataforma, a.plataforma]),
  ];
  const sinDeclarar = asimetricas
    .filter(([t]) => !declaradas.has(t))
    .map(([t, salteo, corrio]) => `${JSON.stringify(t)} se saltea en ${salteo} y CORRE en ${corrio}, y no está declarada: esa plataforma tiene un hueco que la otra no`);
  const vivas = new Set(asimetricas.map(([t]) => t));
  const declaracionesMuertas = [...declaradas]
    .filter((t) => !vivas.has(t))
    .map((t) => `${JSON.stringify(t)} está declarada como salteo de plataforma y ya no se saltea en ninguna: una declaración muerta oculta cuánto se está salteando de verdad`);
  return {
    sinDeclarar,
    declaracionesMuertas,
    asimetricas: asimetricas.length,
    resumen: `${a.plataforma} salteó ${a.salteos.size}, ${b.plataforma} salteó ${b.salteos.size}; ${asimetricas.length} rompe(n) la simetría`,
  };
}

/** Los pares archivo/prueba que el contrato declara. */
export function declaracionesDeclaradas(contrato) {
  const lista = esObjeto(contrato) && Array.isArray(contrato.solo_en) ? contrato.solo_en : [];
  return lista.filter((e) => esObjeto(e) && typeof e.archivo === 'string' && typeof e.prueba === 'string').map((e) => [e.archivo, e.prueba]);
}

/** Todo lo que hace invalido al contrato. `leer` resuelve cada archivo declarado contra el disco. */
export function violaciones(contrato, enElArbol, leer) {
  const malas = [];
  if (!esObjeto(contrato)) return ['el contrato no es un objeto'];
  if (!mismoSchema(contrato.schema, SCHEMA)) malas.push(`el contrato tiene que declarar schema ${SCHEMA}`);
  if (!largo(contrato.why)) malas.push('el contrato tiene que decir por qué existe, con al menos 20 caracteres');
  if (!Array.isArray(contrato.solo_en)) return [...malas, 'solo_en tiene que ser una lista de declaraciones'];

  const vistas = new Set();
  for (const [i, e] of contrato.solo_en.entries()) {
    const donde = `declaración ${i + 1}`;
    if (!esObjeto(e)) { malas.push(`${donde}: tiene que ser un objeto`); continue; }
    if (!PLATAFORMAS.includes(e.plataforma)) {
      malas.push(`${donde}: ${JSON.stringify(e.plataforma)} no es una plataforma real: los valores de process.platform son ${PLATAFORMAS.join(', ')}. Una que no existe se saltearía en todos lados`);
    }
    if (typeof e.archivo !== 'string' || e.archivo === '' || typeof e.prueba !== 'string' || e.prueba === '') {
      malas.push(`${donde}: necesita archivo y prueba`);
      continue;
    }
    const clave = JSON.stringify([e.archivo, e.prueba]);
    if (vistas.has(clave)) malas.push(`${donde}: declara dos veces la misma prueba (${e.prueba}); se repite`);
    vistas.add(clave);
    if (!largo(e.por_que)) malas.push(`${donde}: por_que tiene que decir por qué esa prueba es de esa plataforma`);
    // LA MITAD QUE IMPORTA. «Esta prueba es de Windows» no dice nada: el hueco es que deja de estar
    // comprobado en las demas, y eso es lo que alguien necesita leer para decidir si le alcanza.
    if (!largo(e.que_queda_sin_verificar)) {
      malas.push(`${donde}: que_queda_sin_verificar tiene que decir QUÉ deja de estar comprobado en las otras plataformas. Sin eso, el salteo se lee como si no costara nada`);
    }
    let fuente;
    try { fuente = leer(e.archivo); } catch (error) {
      malas.push(`${donde}: no se pudo leer ${e.archivo} (${error.message}): una declaración sobre un archivo que no existe describe un mundo que no ocurre`);
      continue;
    }
    if (!String(fuente).includes(e.prueba)) {
      malas.push(`${donde}: el título ${JSON.stringify(e.prueba)} no está en ${e.archivo}. O se renombró la prueba —y su salteo dejó de estar declarado— o la declaración sobró`);
    }
  }

  // EL SENTIDO QUE DE VERDAD PROTEGE: lo que se saltea en el arbol tiene que estar declarado. Sin
  // esto, agregar un salteo es gratis y nadie lo revisa nunca.
  for (const [archivo, prueba] of enElArbol) {
    if (!vistas.has(JSON.stringify([archivo, prueba]))) {
      malas.push(`${archivo}: la prueba ${JSON.stringify(prueba)} se saltea sin declararlo en ${CONTRATO}. Un salteo que nadie revisa es un hueco que se ve igual que una prueba que corre`);
    }
  }
  return malas;
}

/** Los archivos de pruebas del arbol. Derivado del directorio, nunca de una lista escrita a mano. */
function archivosDePrueba(cwd, listar = readdirSync) {
  return listar(join(cwd, 'tests'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.test.mjs'))
    .map((e) => `tests/${e.name}`)
    .sort();
}

/**
 * COMPARAR LO QUE CADA PLATAFORMA SALTEO DE VERDAD. El otro subcomando mira el arbol y ve el
 * mecanismo que este protocolo inventa; este mira la CORRIDA y ve todos los salteos, incluidos los
 * que una prueba decide por su cuenta. Necesita el dato de las dos plataformas, asi que corre donde
 * estan las dos: en el trabajo que junta los artefactos, igual que la cobertura.
 */
function simetria(rutaA, rutaB, cwd, options, write, writeError) {
  const leer = options.leer ?? ((ruta) => readFileSync(join(cwd, ruta), 'utf8'));

  let contrato;
  try {
    contrato = JSON.parse(leer(CONTRATO));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay ${CONTRATO}. Ninguna prueba declara plataforma acá, así que no hay nada contra qué comparar.`);
      return 0;
    }
    writeError(`REJECTED: ${CONTRATO} existe pero no se puede leer: ${error?.message ?? error}.`);
    return 1;
  }

  const corridas = [];
  for (const ruta of [rutaA, rutaB]) {
    try {
      corridas.push({ plataforma: ruta, salteos: salteosDeTap(leer(ruta)) });
    } catch (error) {
      writeError(`REJECTED: no se pudo leer ${ruta} (${error?.message ?? error}): sin las dos corridas no se puede comparar qué salteó cada una, y suponerlo sería inventarlo.`);
      return 1;
    }
  }

  const declaradas = new Set(declaracionesDeclaradas(contrato).map(([, prueba]) => prueba));
  const r = asimetriaDeSalteos(corridas[0], corridas[1], declaradas);
  if (r.sinDeclarar.length > 0 || r.declaracionesMuertas.length > 0) {
    for (const m of [...r.sinDeclarar, ...r.declaracionesMuertas]) writeError(`REJECTED: ${m}`);
    return 1;
  }
  write(`OK: ${r.resumen}, y cada una de esas está declarada en ${CONTRATO} con lo que queda sin verificar.`);
  write('LÍMITE: compara los NOMBRES de las pruebas salteadas, así que dos pruebas homónimas en archivos distintos se ven como una. Y sólo ve las plataformas que se le pasan: un salteo en una tercera no lo puede saber. Tampoco juzga si el motivo del salteo es cierto.');
  return 0;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const esSimetria = args.length === 3 && args[0] === 'simetria' && args[1] !== '' && args[2] !== '';
  if (!esSimetria && (args.length !== 1 || args[0] !== 'check')) {
    writeError(USAGE);
    return 2;
  }
  // EL PROYECTO DONDE SE CORRE, no el repositorio de donde salio el script. Con la raiz del propio
  // gate como omision, correrlo parado en un directorio vacio seguia midiendo ESTE repositorio y
  // contestaba OK sobre un proyecto que no tiene ni un archivo: la sonda de vacio lo encontro.
  const cwd = options.cwd ?? process.cwd();
  if (esSimetria) return simetria(args[1], args[2], cwd, options, write, writeError);
  const leer = options.leer ?? ((ruta) => readFileSync(join(cwd, ruta), 'utf8'));

  let contrato;
  try {
    contrato = JSON.parse(leer(CONTRATO));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay ${CONTRATO}. Ninguna prueba declara plataforma acá, y eso no es una aprobación: es que no había nada que comparar.`);
      return 0;
    }
    writeError(`REJECTED: ${CONTRATO} existe pero no se puede leer: ${error?.message ?? error}.`);
    return 1;
  }

  let enElArbol = [];
  try {
    enElArbol = salteosEnElArbol(archivosDePrueba(cwd, options.listar), leer);
  } catch (error) {
    writeError(`REJECTED: no se pudo recorrer tests/ (${error?.message ?? error}): sin el árbol no se puede saber qué se saltea.`);
    return 1;
  }

  const malas = violaciones(contrato, enElArbol, leer);
  if (malas.length > 0) {
    for (const m of malas) writeError(`REJECTED: ${m}`);
    return 1;
  }

  const porPlataforma = new Map();
  for (const e of contrato.solo_en) porPlataforma.set(e.plataforma, (porPlataforma.get(e.plataforma) ?? 0) + 1);
  const detalle = [...porPlataforma].map(([p, n]) => `${n} sólo en ${p}`).join(', ');
  write(`OK: ${contrato.solo_en.length} prueba(s) declaran plataforma (${detalle}), cada una con su motivo y con lo que queda sin verificar escrito, y ninguna prueba del árbol se saltea sin declararlo.`);
  write('LÍMITE: comprueba que el salteo esté declarado y que la declaración corresponda a una prueba real, nunca que el motivo sea cierto: una prueba que declara plataforma sin necesitarla pasa en verde. Y no corre nada, así que no sabe si esa prueba pasaría en la plataforma que dice excluir.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-platform-scope.mjs')) {
  process.exitCode = main();
}
