#!/usr/bin/env node
// registrar-tokens.mjs — registra lo que gastó cada subagente al terminar, sellado y verificable.
//
// Usage:
//   node .vibe/ia-stack-runtime/scripts/registrar-tokens.mjs append --tarea <id> --rol <rol> --modelo <m> --in <n> --out <n> --escalo si|no [--file .vibe/tokens.jsonl]
//   node .vibe/ia-stack-runtime/scripts/registrar-tokens.mjs check [--file .vibe/tokens.jsonl]
//
// POR QUE EXISTE. Sin medir el gasto por rol, la tabla de ruteo (contracts/model-routing.json) se
// revisa a ojo. Cada línea es un JSON {fecha, tarea, rol, modelo, tokens_in, tokens_out, escalo} y
// lleva el MISMO sello que .vibe/AUDIT.md: se sella con `sealLineFor` y se verifica con `verifyChain`
// de verify-audit-chain.mjs (sha256 de la cadena anterior + LF + la línea). No hay un segundo hash.
// `check` es esa verificación más la forma de cada registro; `informe-tokens.mjs` lee por la misma puerta.
//
// El rol tiene que existir en contracts/model-routing.json § roles (junto al script, ../contracts/).
//
// LIMITES HONESTOS. (1) Los números los declara quien registra: el sello prueba que la línea no se
// editó después, no que los tokens sean ciertos. (2) El sello vive en el mismo archivo que protege,
// así que quien reescriba el archivo entero lo rehace (límite heredado de verify-audit-chain; el ancla
// externa es git). (3) Leer-y-agregar no es atómico: dos `append` simultáneos pueden sellar sobre la
// misma cabeza y el siguiente `check` rechaza la cadena; no corrompe en silencio, pero no lo evita.
// Registrá de a uno. (4) En este archivo toda línea va sellada: a diferencia de AUDIT.md no hay
// prefijo heredado tolerado.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAuditLines, sealLineFor, verifyChain } from './verify-audit-chain.mjs';

const CONTRATO = join(dirname(fileURLToPath(import.meta.url)), '..', 'contracts', 'model-routing.json');
export const ARCHIVO_DEFECTO = '.vibe/tokens.jsonl';
export const USAGE = 'usage: registrar-tokens.mjs append --tarea <id> --rol <rol> --modelo <m> --in <n> --out <n> --escalo si|no [--file <tokens.jsonl>] | registrar-tokens.mjs check [--file <tokens.jsonl>]';
const FECHA_ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/u;
const CAMPOS = ['tarea', 'rol', 'modelo', 'in', 'out', 'escalo', 'file'];

/** Nombres de rol del contrato. Lanza un Error con el motivo. */
export function leerRoles(ruta = CONTRATO) {
  let roles;
  try {
    roles = JSON.parse(readFileSync(ruta, 'utf8')).roles;
  } catch (error) {
    throw new Error(`no se pudo leer el contrato ${ruta}: ${error.message}`);
  }
  const nombres = roles && typeof roles === 'object' ? Object.keys(roles) : [];
  if (nombres.length === 0) throw new Error(`el contrato ${ruta} no trae roles`);
  return nombres;
}

/** Familias de modelo de contracts/model-routing.json § niveles (haiku, sonnet, opus, fable). */
export function leerModelos(ruta = CONTRATO) {
  let niveles;
  try {
    niveles = JSON.parse(readFileSync(ruta, 'utf8')).niveles;
  } catch (error) {
    throw new Error(`no se pudo leer el contrato ${ruta}: ${error.message}`);
  }
  const modelos = Object.values(niveles ?? {}).map((n) => n?.modelo).filter((m) => typeof m === 'string' && m !== '');
  if (modelos.length === 0) throw new Error(`el contrato ${ruta} no trae niveles con modelo`);
  return modelos;
}

/** Argumentos de `append` o `check`: devuelve los campos crudos o lanza con el motivo. */
function parsearOpciones(argv) {
  const dato = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) throw new Error(`argumento inesperado: ${flag}`);
    const campo = flag.slice(2);
    if (!CAMPOS.includes(campo)) throw new Error(`argumento desconocido: ${flag}`);
    if (campo in dato) throw new Error(`argumento repetido: ${flag}`);
    if (i + 1 >= argv.length) throw new Error(`falta el valor de ${flag}`);
    i += 1;
    dato[campo] = argv[i];
  }
  return dato;
}

const entero = (valor, flag) => {
  if (valor === undefined) throw new Error(`falta ${flag}`);
  if (!/^\d+$/u.test(valor)) throw new Error(`${flag} debe ser un entero >= 0: ${valor}`);
  return Number(valor);
};
const texto = (valor, flag) => {
  if (valor === undefined || valor.trim() === '') throw new Error(`falta ${flag} (no puede estar vacío)`);
  return valor.trim();
};

/** Valida los campos de `append` contra los roles del contrato. */
export function validarAppend(dato, roles, modelos) {
  const tarea = texto(dato.tarea, '--tarea');
  const rol = texto(dato.rol, '--rol');
  if (!roles.includes(rol)) throw new Error(`--rol inválido (${roles.join('|')}): ${rol}`);
  const modelo = texto(dato.modelo, '--modelo').toLowerCase();
  if (!modelos.some((m) => modelo === m || modelo.startsWith(`${m}-`))) {
    throw new Error(`--modelo inválido (${modelos.join('|')}, con versión opcional como sonnet-5.5): ${modelo}`);
  }
  if (!/^[a-z0-9][a-z0-9.-]*$/u.test(modelo)) throw new Error(`--modelo inválido (sólo letras, dígitos, punto y guion): ${modelo}`);
  const tokensIn = entero(dato.in, '--in');
  const tokensOut = entero(dato.out, '--out');
  if (!['si', 'no'].includes(dato.escalo)) throw new Error(`--escalo debe ser si|no: ${dato.escalo ?? '(falta)'}`);
  return { tarea, rol, modelo, in: tokensIn, out: tokensOut, escalo: dato.escalo === 'si' };
}

/** El registro que se escribe; la fecha entra por parámetro para poder probarlo. */
export function aRegistro(v, ahora) {
  return { fecha: ahora.toISOString(), tarea: v.tarea, rol: v.rol, modelo: v.modelo, tokens_in: v.in, tokens_out: v.out, escalo: v.escalo };
}

/** null si el registro es válido; si no, el motivo. */
function motivoInvalido(obj, roles) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 'no es un objeto JSON';
  if (typeof obj.fecha !== 'string' || !FECHA_ISO.test(obj.fecha) || Number.isNaN(Date.parse(obj.fecha))) return 'fecha no es ISO 8601 UTC';
  for (const campo of ['tarea', 'modelo']) {
    if (typeof obj[campo] !== 'string' || obj[campo].trim() === '') return `${campo} debe ser un texto no vacío`;
  }
  if (!roles.includes(obj.rol)) return `rol fuera del contrato: ${String(obj.rol)}`;
  for (const campo of ['tokens_in', 'tokens_out']) {
    if (!Number.isInteger(obj[campo]) || obj[campo] < 0) return `${campo} debe ser un entero >= 0`;
  }
  if (typeof obj.escalo !== 'boolean') return 'escalo debe ser true o false';
  return null;
}

/** Lee el contenido del archivo: cadena íntegra, todo sellado y cada línea un registro válido. */
export function leerRegistros(content, roles) {
  const fallo = (error) => ({ ok: false, registros: [], error });
  const cadena = verifyChain(content);
  if (!cadena.ok) return fallo(`cadena rota en la línea ${cadena.brokenLine}: ${cadena.reason}`);
  const registros = [];
  for (const entrada of parseAuditLines(content)) {
    if (entrada.chain === null) return fallo(`línea ${entrada.index} sin sello: en este archivo toda línea va sellada`);
    let obj;
    try {
      obj = JSON.parse(entrada.text);
    } catch (error) {
      return fallo(`línea ${entrada.index} no es JSON: ${error.message}`);
    }
    const motivo = motivoInvalido(obj, roles);
    if (motivo !== null) return fallo(`línea ${entrada.index} inválida: ${motivo}`);
    registros.push(obj);
  }
  return { ok: true, registros, error: null };
}

export const checkArchivo = leerRegistros;

/** Lee el archivo; ENOENT es un archivo todavía sin registros, cualquier otra falla es no poder mirar. */
export function leerArchivo(ruta, leer = readFileSync) {
  try {
    return { content: leer(ruta, 'utf8'), error: null };
  } catch (error) {
    if (error.code === 'ENOENT') return { content: '', error: null };
    return { content: null, error: `no se pudo leer ${ruta}: ${error.message}` };
  }
}

export function main(argv = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  const [comando, ...resto] = argv;
  if (comando !== 'append' && comando !== 'check') {
    writeError(USAGE);
    return 2;
  }
  try {
    const roles = leerRoles();
    const dato = parsearOpciones(resto);
    const ruta = dato.file ?? ARCHIVO_DEFECTO;
    const { content, error } = leerArchivo(ruta);
    if (error !== null) throw new Error(error);
    if (comando === 'check') {
      const solo = Object.keys(dato).filter((k) => k !== 'file');
      if (solo.length > 0) throw new Error(`check sólo acepta --file: ${solo.join(', ')}`);
      const r = leerRegistros(content, roles);
      if (!r.ok) throw new Error(`${ruta}: ${r.error}`);
      write(r.registros.length === 0
        ? `VACÍO: sin registros: ${ruta} no tiene líneas selladas todavía; no hay cadena que verificar.`
        : `OK: ${ruta} tiene una cadena íntegra de ${r.registros.length} registro(s), todos válidos.`);
      return 0;
    }
    const previo = leerRegistros(content, roles);
    if (!previo.ok) throw new Error(`no se sella sobre un archivo inválido (${ruta}: ${previo.error})`);
    const registro = aRegistro(validarAppend(dato, roles, leerModelos()), options.ahora ?? new Date());
    const sellado = sealLineFor(content, JSON.stringify(registro));
    if (!sellado.ok) throw new Error(`no se pudo sellar la línea: ${sellado.reason}`);
    mkdirSync(dirname(ruta), { recursive: true });
    appendFileSync(ruta, sellado.append, 'utf8');
    write(`OK: registrado ${registro.rol} ${registro.tarea} en ${ruta}; cabeza de cadena ${sellado.chain}.`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('registrar-tokens.mjs')) {
  process.exitCode = main();
}
