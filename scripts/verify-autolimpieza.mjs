#!/usr/bin/env node
// verify-autolimpieza.mjs — la regla de autolimpieza de un proyecto, y el registro de lo que se limpió.
//
// LA REGLA, del lote 5 del plan (docs/plan.md) y de las reglas duras del operador: **nada se borra de
// entrada**. Todo candidato pasa por una cuarentena —se MUEVE, no se borra— y sólo una purga posterior,
// vencida la retención, lo elimina de verdad. Sólo es candidato lo que cae en una categoría declarada
// (lista blanca positiva), y lo que `irreplaceable-sources` nombra no se mueve ni se purga nunca. Cada
// acción es una línea de un log sellado con la cadena de verify-audit-chain.mjs.
//
// ESTE GATE JUZGA EL REGISTRO, no limpia. Comprueba cuatro cosas:
//   1. el contrato (`contracts/autolimpieza.json` u otro) está bien formado: una cuarentena de verdad
//      —retención de al menos 7 días, que es el período de la FASE 9—, categorías con edad mínima de al
//      menos 6 horas —el piso de limpiar-temporales: una corrida en curso no se toca— y cada una con
//      cómo se regenera, porque sólo se limpia solo lo que se puede volver a generar;
//   2. el log es una cadena íntegra y sin lineas heredadas: la limpieza no tiene pasado anterior que
//      tolerar, así que una línea sin sello es una línea que alguien escribió a mano;
//   3. cada acción respeta el contrato: la categoría está declarada, la ruta es un hijo directo de su
//      raíz con su prefijo, no es intocable, cada purga tiene su cuarentena previa y la retención
//      cumplida, y un item se resuelve una sola vez;
//   4. lo que está en cuarentena es lo que el log dice haber movido: presente y con el mismo sha256.
//
// LÍMITE HONESTO, que viaja con el verde. Prueba que el registro es consistente y que lo que está en la
// cuarentena es lo que el log dijo mover. NO prueba que lo movido fuera lo correcto ni que su contenido
// no importara: el sha256 identifica los bytes, no su valor. Algo borrado por fuera del ejecutor no
// aparece en el log: sólo se ve si estaba en la cuarentena, y entonces falta. Las fechas del log las
// escribe quien limpia: este gate las compara entre sí y con hoy sólo para contar lo vencido, no las
// autentica. Y una cuarentena en el mismo disco que el proyecto no protege de un fallo del disco.

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { basename, join } from 'node:path';

import { parseAuditLines, verifyChain } from './verify-audit-chain.mjs';
import { HORAS_MINIMAS, leerIntocables } from './limpiar-temporales.mjs';

export const USAGE = 'usage: verify-autolimpieza.mjs check <contrato.json> [--require-inputs]';
export const SCHEMA = 'ia.autolimpieza/1';
export const EMPTY_PREFIX = 'VACÍO: ';
export const NO_INPUTS_CODE = 'AUTOLIMPIEZA_NO_INPUTS';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const ACCIONES = Object.freeze(['cuarentena', 'restauracion', 'purga']);
/** Una cuarentena que dura menos que el período de la limpieza no da tiempo a notar el error. */
export const RETENCION_MINIMA_DIAS = 7;
export const LIMITE = 'LIMITE: prueba que el registro es consistente y que lo que está en la cuarentena es lo que el log dijo mover; no que lo movido fuera lo correcto ni que su contenido no importara. Algo borrado por fuera del ejecutor no aparece en el log, y las fechas las escribe quien limpia: se comparan, no se autentican.';
export { HORAS_MINIMAS };

const CONTRACT_KEYS = ['schema', 'why', 'cuarentena', 'log', 'categorias'];
const CUARENTENA_KEYS = ['directorio', 'retencion_dias'];
const CATEGORIA_KEYS = ['id', 'que', 'raiz', 'prefijo', 'edad_minima_horas', 'como_se_regenera'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ITEM = /^\d{4}-\d{2}-\d{2}-\d{3}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DIA_MS = 86_400_000;

const esObjeto = (valor) => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
const hayTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';
const exactas = (valor, claves) => esObjeto(valor) && Object.keys(valor).length === claves.length && claves.every((clave) => clave in valor);
/** Una ruta que se puede leer sin salirse del proyecto: relativa, con barras normales y sin tramos vacíos, `.` ni `..`. */
const rutaDelProyecto = (valor) => hayTexto(valor) && !valor.startsWith('/') && !/^[A-Za-z]:/u.test(valor)
  && !valor.includes(String.fromCharCode(92)) && valor.split('/').every((tramo) => tramo !== '' && tramo !== '.' && tramo !== '..');
const dentroDe = (ruta, carpeta) => ruta.toLowerCase() === carpeta.toLowerCase() || ruta.toLowerCase().startsWith(`${carpeta.toLowerCase()}/`);

/** Una fecha que existe en el calendario. El formato AAAA-MM-DD ya lo garantiza quien llama. */
function fechaReal(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function diasEntre(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS);
}

/** El contrato, como dato. Devuelve una lista de problemas; vacía es válido. */
export function validarContrato(doc, intocables = null) {
  if (!esObjeto(doc)) return ['el contrato debe ser un objeto'];
  if (!exactas(doc, CONTRACT_KEYS)) return [`el contrato debe declarar exactamente ${CONTRACT_KEYS.join(', ')}`];
  const problemas = [];
  if (doc.schema !== SCHEMA) problemas.push(`el schema debe ser ${SCHEMA}`);
  if (!hayTexto(doc.why)) problemas.push('why debe explicar para qué es el contrato');

  const cuarentena = doc.cuarentena;
  let directorioValido = false;
  if (!exactas(cuarentena, CUARENTENA_KEYS)) {
    problemas.push(`cuarentena debe declarar exactamente ${CUARENTENA_KEYS.join(' y ')}`);
  } else {
    directorioValido = rutaDelProyecto(cuarentena.directorio);
    if (!directorioValido) problemas.push('cuarentena.directorio debe ser una ruta relativa dentro del proyecto');
    if (!Number.isInteger(cuarentena.retencion_dias) || cuarentena.retencion_dias < RETENCION_MINIMA_DIAS) {
      problemas.push(`la retención (retencion_dias) debe ser un entero de al menos ${RETENCION_MINIMA_DIAS} días: una cuarentena más corta que el período de la limpieza no da tiempo a notar el error`);
    }
  }
  const logValido = rutaDelProyecto(doc.log);
  if (!logValido) problemas.push('log debe ser una ruta relativa dentro del proyecto');

  if (!Array.isArray(doc.categorias) || doc.categorias.length === 0) {
    problemas.push('categorias debe declarar al menos una categoría: sin lista blanca no hay nada que limpiar');
    return problemas;
  }
  const ids = new Set();
  for (const [i, categoria] of doc.categorias.entries()) {
    const en = `categorias[${i}]`;
    if (!exactas(categoria, CATEGORIA_KEYS)) {
      problemas.push(`${en}: debe declarar exactamente ${CATEGORIA_KEYS.join(', ')}`);
      continue;
    }
    if (!hayTexto(categoria.id) || !KEBAB.test(categoria.id)) problemas.push(`${en}: id debe ser kebab-case`);
    else if (ids.has(categoria.id)) problemas.push(`${en}: el id ${categoria.id} está repetido`);
    ids.add(categoria.id);
    if (!hayTexto(categoria.que)) problemas.push(`${en}: que debe decir qué se limpia`);
    if (!hayTexto(categoria.como_se_regenera)) problemas.push(`${en}: como_se_regenera debe decir cómo se vuelve a generar: sólo se limpia solo lo que se puede regenerar`);
    if (!Number.isInteger(categoria.edad_minima_horas) || categoria.edad_minima_horas < HORAS_MINIMAS) {
      problemas.push(`${en}: la edad mínima (edad_minima_horas) debe ser un entero de al menos ${HORAS_MINIMAS} horas: una corrida en curso no se toca`);
    }
    const prefijoValido = hayTexto(categoria.prefijo) && !categoria.prefijo.includes('/') && !categoria.prefijo.includes(String.fromCharCode(92)) && !categoria.prefijo.includes('..');
    if (!prefijoValido) problemas.push(`${en}: prefijo debe ser un texto sin barras ni '..': un prefijo vacío barrería toda la raíz`);
    else if (intocables !== null && intocables.test(categoria.prefijo)) problemas.push(`${en}: el prefijo ${categoria.prefijo} nombra una fuente intocable`);
    if (!rutaDelProyecto(categoria.raiz)) {
      problemas.push(`${en}: raiz debe ser una carpeta relativa dentro del proyecto, y no '.'`);
      continue;
    }
    if (directorioValido && (dentroDe(cuarentena.directorio, categoria.raiz) || dentroDe(categoria.raiz, cuarentena.directorio))) {
      problemas.push(`${en}: la raíz ${categoria.raiz} contiene a la cuarentena (${cuarentena.directorio}) o está dentro de ella: purgaría su propia cuarentena`);
    }
    if (logValido && dentroDe(doc.log, categoria.raiz)) {
      problemas.push(`${en}: el log (${doc.log}) está dentro de la raíz ${categoria.raiz}: se barrería a sí mismo`);
    }
  }
  return problemas;
}

/** Una línea del log: `[AAAA-MM-DD] Limpieza | accion | item | categoria | ruta | bytes | sha256`. */
export function parsearLinea(texto) {
  const partes = String(texto).split(' | ');
  if (partes.length !== 7) return { ok: false, motivo: `tiene ${partes.length} campos y deben ser siete: [fecha] Limpieza | accion | item | categoria | ruta | bytes | sha256` };
  const [encabezado, accion, item, categoria, ruta, bytes, sha256] = partes;
  const cabecera = encabezado.match(/^\[(\d{4}-\d{2}-\d{2})\] Limpieza$/u);
  if (cabecera === null || !fechaReal(cabecera[1])) return { ok: false, motivo: `el encabezado "${encabezado}" debe ser [AAAA-MM-DD] Limpieza, con una fecha real` };
  if (!ACCIONES.includes(accion)) return { ok: false, motivo: `la acción "${accion}" no es una de ${ACCIONES.join(', ')}` };
  if (!ITEM.test(item)) return { ok: false, motivo: `el item "${item}" debe ser AAAA-MM-DD-NNN` };
  if (!hayTexto(categoria)) return { ok: false, motivo: 'falta la categoría' };
  if (!rutaDelProyecto(ruta)) return { ok: false, motivo: `la ruta "${ruta}" debe ser relativa al proyecto, con barras normales` };
  if (!/^\d+$/u.test(bytes)) return { ok: false, motivo: `bytes "${bytes}" debe ser un entero no negativo` };
  if (!SHA256.test(sha256)) return { ok: false, motivo: 'sha256 debe ser 64 hex en minúsculas' };
  return { ok: true, fecha: cabecera[1], accion, item, categoria, ruta, bytes: Number(bytes), sha256 };
}

/** El registro contra el contrato: lista blanca, retención y que un item se resuelva una sola vez. */
export function juzgarRegistro(entradas, contrato, intocables = null) {
  const problemas = [];
  const items = new Map();
  let resueltas = 0;
  for (const e of entradas) {
    if (!e.ok) {
      problemas.push(`línea ${e.indice}: ${e.motivo}`);
      continue;
    }
    const en = `línea ${e.indice} (${e.accion} ${e.item})`;
    if (e.accion === 'cuarentena') {
      if (items.has(e.item)) {
        problemas.push(`${en}: el id ${e.item} está repetido`);
        continue;
      }
      const categoria = contrato.categorias.find((c) => c.id === e.categoria);
      if (categoria === undefined) {
        problemas.push(`${en}: la categoría ${e.categoria} no está declarada en el contrato: lo que no está en la lista blanca no se mueve`);
      } else if (!e.ruta.toLowerCase().startsWith(`${categoria.raiz.toLowerCase()}/`)) {
        problemas.push(`${en}: la ruta ${e.ruta} está fuera de la raíz declarada (${categoria.raiz})`);
      } else {
        const resto = e.ruta.slice(categoria.raiz.length + 1);
        if (resto.includes('/')) problemas.push(`${en}: ${e.ruta} no es un hijo directo de ${categoria.raiz}: se mueve el hijo de la raíz, no lo que tiene adentro`);
        else if (!resto.startsWith(categoria.prefijo)) problemas.push(`${en}: el nombre ${resto} no empieza con el prefijo declarado (${categoria.prefijo})`);
      }
      if (intocables !== null && intocables.test(e.ruta)) problemas.push(`${en}: ${e.ruta} es una fuente intocable y no se mueve nunca, ni con la categoría declarada`);
      items.set(e.item, { entrada: e, estado: 'pendiente' });
      continue;
    }
    const base = items.get(e.item);
    if (base === undefined) {
      problemas.push(`${en}: sin cuarentena previa: no se resuelve algo que nunca se movió`);
      continue;
    }
    if (base.estado !== 'pendiente') {
      problemas.push(`${en}: el item ya fue ${base.estado}`);
      continue;
    }
    const q = base.entrada;
    if (e.categoria !== q.categoria || e.ruta !== q.ruta || e.sha256 !== q.sha256 || e.bytes !== q.bytes) {
      problemas.push(`${en}: no coincide con su cuarentena (categoría, ruta, bytes y sha256 tienen que ser los mismos)`);
    }
    const dias = diasEntre(q.fecha, e.fecha);
    if (dias < 0) {
      problemas.push(`${en}: su fecha ${e.fecha} es anterior a la de su cuarentena (${q.fecha})`);
    } else if (e.accion === 'purga' && dias < contrato.cuarentena.retencion_dias) {
      problemas.push(`${en}: purga antes de cumplir la retención (${dias} de ${contrato.cuarentena.retencion_dias} días en cuarentena)`);
    }
    base.estado = e.accion === 'purga' ? 'purgado' : 'restaurado';
    resueltas += 1;
  }
  const pendientes = [...items.values()].filter((i) => i.estado === 'pendiente').map((i) => ({ item: i.entrada.item, ruta: i.entrada.ruta, sha256: i.entrada.sha256, bytes: i.entrada.bytes, fecha: i.entrada.fecha }));
  return { problemas, pendientes, resueltas };
}

/**
 * La huella de una entrada del sistema de archivos: sha256 del contenido si es un archivo, y si es un
 * directorio, sha256 de la lista ordenada `ruta NUL sha256` de todo lo que tiene adentro. Un enlace se
 * registra por su destino y NO se sigue: una huella que siguiera enlaces saldría del proyecto.
 */
export function huellaDeArbol(ruta, io = {}) {
  const lstat = io.lstat ?? lstatSync;
  const listar = io.readdir ?? readdirSync;
  const leer = io.readFile ?? readFileSync;
  const enlace = io.readlink ?? readlinkSync;
  const sha = (contenido) => createHash('sha256').update(contenido).digest('hex');
  let bytes = 0;
  const recorrer = (dir, prefijo, acumulado) => {
    for (const nombre of listar(dir).sort()) {
      const p = join(dir, nombre);
      const st = lstat(p);
      const relativa = `${prefijo}${nombre}`;
      if (st.isSymbolicLink()) acumulado.push(`${relativa}${String.fromCharCode(0)}L:${enlace(p)}`);
      else if (st.isDirectory()) recorrer(p, `${relativa}/`, acumulado);
      else {
        acumulado.push(`${relativa}${String.fromCharCode(0)}${sha(leer(p))}`);
        bytes += st.size;
      }
    }
    return acumulado;
  };
  const raiz = lstat(ruta);
  if (raiz.isSymbolicLink()) return { sha256: sha(`L:${enlace(ruta)}`), bytes: 0 };
  if (raiz.isDirectory()) return { sha256: sha(recorrer(ruta, '', []).join('\n')), bytes };
  return { sha256: sha(leer(ruta)), bytes: raiz.size };
}

/** Lo pendiente contra el disco: cada item presente y con su huella, y nada en la cuarentena que el log no mueva. */
export function juzgarCuarentena(contrato, pendientes, hoy, raiz, io = {}) {
  const huella = io.huella ?? huellaDeArbol;
  const listar = io.readdir ?? readdirSync;
  const directorio = join(raiz, contrato.cuarentena.directorio);
  const problemas = [];
  let vencidas = 0;
  for (const p of pendientes) {
    const ubicacion = join(directorio, p.item, basename(p.ruta));
    try {
      const actual = huella(ubicacion);
      if (actual.sha256 !== p.sha256) problemas.push(`${p.item}: alterado en la cuarentena: el sha256 de ${p.ruta} no es el que registró el log`);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') problemas.push(`${p.item}: falta en la cuarentena: el log dice que ${p.ruta} se movió a ${contrato.cuarentena.directorio}/${p.item} y no está`);
      else problemas.push(`${p.item}: no se pudo leer en la cuarentena: ${error.message}`);
    }
    if (diasEntre(p.fecha, hoy) >= contrato.cuarentena.retencion_dias) vencidas += 1;
  }
  let presentes = [];
  try {
    presentes = listar(directorio);
  } catch (error) {
    if (error.code !== 'ENOENT') problemas.push(`no se pudo leer la cuarentena ${contrato.cuarentena.directorio}: ${error.message}`);
  }
  const conocidos = new Set(pendientes.map((p) => p.item));
  for (const nombre of presentes) {
    if (!conocidos.has(nombre)) problemas.push(`${nombre}: hay algo en la cuarentena que el log no registra (${contrato.cuarentena.directorio}/${nombre})`);
  }
  return { problemas, vencidas };
}

function vacio(requireInputs, mensaje, write, writeError) {
  if (requireInputs) {
    writeError(`REJECTED: ${NO_INPUTS_CODE}: ${mensaje}`);
    return 1;
  }
  write(`${EMPTY_PREFIX}${mensaje}`);
  return 0;
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const flags = args.slice(2);
  if (args[0] !== 'check' || !hayTexto(args[1]) || flags.length > 1 || flags.some((f) => f !== REQUIRE_INPUTS_FLAG)) {
    writeError(USAGE);
    return 2;
  }
  const requireInputs = flags.includes(REQUIRE_INPUTS_FLAG);
  const cwd = options.cwd ?? '.';
  const leer = options.leer ?? ((ruta) => readFileSync(join(cwd, ruta), 'utf8'));
  const rechazar = (codigo, mensaje) => {
    writeError(`REJECTED: ${codigo}: ${mensaje}`);
    return 1;
  };

  let crudo;
  try {
    crudo = leer(args[1]);
  } catch (error) {
    if (error.code === 'ENOENT') return vacio(requireInputs, `no hay contrato en ${args[1]}: un proyecto sin regla de limpieza no tiene nada que comparar.`, write, writeError);
    return rechazar('AUTOLIMPIEZA_CONTRACT_INVALID', `no se puede leer ${args[1]}: ${error.message}`);
  }
  let contrato;
  try {
    contrato = JSON.parse(crudo);
  } catch (error) {
    return rechazar('AUTOLIMPIEZA_CONTRACT_INVALID', `${args[1]} no se puede leer como JSON: ${error.message}`);
  }
  let intocables;
  try {
    intocables = (options.leerIntocables ?? leerIntocables)(cwd);
  } catch (error) {
    return rechazar('AUTOLIMPIEZA_INTOCABLES_UNREADABLE', `no se pudo saber qué es intocable, y sin esa lista no se juzga una limpieza: ${error.message}`);
  }
  const malos = validarContrato(contrato, intocables);
  if (malos.length > 0) {
    for (const problema of malos) writeError(`REJECTED: AUTOLIMPIEZA_CONTRACT_INVALID: ${problema}`);
    return 1;
  }

  let log;
  try {
    log = leer(contrato.log);
  } catch (error) {
    if (error.code === 'ENOENT') return vacio(requireInputs, `el contrato está bien formado y no hay log en ${contrato.log}: ninguna limpieza registrada, nada que comparar.`, write, writeError);
    return rechazar('AUTOLIMPIEZA_LOG_UNREADABLE', `no se puede leer ${contrato.log}: ${error.message}`);
  }
  const lineas = parseAuditLines(log);
  if (lineas.length === 0) return vacio(requireInputs, `${contrato.log} no tiene ninguna acción: ninguna limpieza registrada, nada que comparar.`, write, writeError);
  const cadena = verifyChain(log);
  if (!cadena.ok) return rechazar('AUTOLIMPIEZA_LOG_BROKEN', `${contrato.log} rompe su cadena en la línea ${cadena.brokenLine}: ${cadena.reason}`);
  const sinSello = lineas.find((linea) => linea.chain === null);
  if (sinSello !== undefined) {
    return rechazar('AUTOLIMPIEZA_LOG_UNSEALED', `la línea ${sinSello.index} de ${contrato.log} no tiene sello: la limpieza no tiene un pasado anterior que tolerar, así que una línea sin sello es una escrita a mano`);
  }

  const registro = juzgarRegistro(lineas.map((linea) => ({ ...parsearLinea(linea.text), indice: linea.index })), contrato, intocables);
  const hoy = options.hoy ?? new Date().toISOString().slice(0, 10);
  const cuarentena = juzgarCuarentena(contrato, registro.pendientes, hoy, cwd, options.io);
  if (registro.problemas.length + cuarentena.problemas.length > 0) {
    for (const problema of registro.problemas) writeError(`REJECTED: AUTOLIMPIEZA_LOG_INVALID: ${problema}`);
    for (const problema of cuarentena.problemas) writeError(`REJECTED: AUTOLIMPIEZA_QUARANTINE_INCONSISTENT: ${problema}`);
    return 1;
  }
  write(`OK: ${args[1]} y ${contrato.log}: ${lineas.length} acción(es) selladas, ${registro.pendientes.length} en cuarentena (${cuarentena.vencidas} vencida(s), ya purgables), ${registro.resueltas} resuelta(s); lo que está en la cuarentena es lo que el log dice haber movido.`);
  write(LIMITE);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-autolimpieza.mjs')) {
  process.exitCode = main();
}
