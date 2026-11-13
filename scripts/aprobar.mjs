#!/usr/bin/env node
// aprobar.mjs — registro sellado de las aprobaciones de la persona (IA Stack 3.4.5).
//
// Usage:
//   node scripts/aprobar.mjs registrar --tipo <pedido|research|marca|boceto|spec|preview|produccion> --ref <vN|sha> --texto <texto literal> [--pieza <id>] [--quien <nombre>] [--proyecto <dir>]
//   node scripts/aprobar.mjs usar --sha <sha> [--proyecto <dir>]
//   node scripts/aprobar.mjs check [--proyecto <dir>]
//   node scripts/aprobar.mjs hook            (lee de stdin el evento UserPromptSubmit {prompt, cwd})
//
// Escribe en `.ia-stack/APROBACIONES.md` el formato que lee `verify-aprobacion-humana.mjs` (tabla de 8
// columnas) y cierra cada fila con un sello sha256 encadenado a la anterior (el de verify-audit-chain.mjs,
// importado, no copiado). El tipo es EXPLÍCITO y nunca se deduce del ref: `produccion` exige un sha de 7 a
// 40 hex; todo otro tipo exige `vN`. Cualquier otra combinación sale 2 sin escribir. Sin `--pieza`, el
// objeto de la fila es el tipo. `usar` agrega la fila `usada` a una orden de producción vigente: vale una vez.
// El hook sólo registra un mensaje que EMPIEZA con `apruebo <tipo> <vN|sha>`, con las mismas reglas.
// Exit 0 ok, 1 falla, 2 uso incorrecto (el hook sale 0 siempre que el mensaje no sea una aprobación válida).
//
// LÍMITE HONESTO: el sello detecta una fila editada o borrada en el medio, no a quien reescribe todo el
// archivo ni a quien borra las últimas filas (ver verify-audit-chain.mjs). Que el hook sólo se dispare con
// mensajes de la persona depende de cómo esté cableado el hook en la herramienta; este script no lo sabe.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { fechaAR } from './estado.mjs';
import { sealLineFor, verifyChain } from './verify-audit-chain.mjs';
import { RE_SHA, RE_VERSION, TIPOS, checkProduccion, esHumano, leerTabla } from './verify-aprobacion-humana.mjs';

export const ENCABEZADO = `# Aprobaciones — registro encadenado

Sólo se agregan filas con \`scripts/aprobar.mjs\`; cada fila lleva un sello \`chain:\` y editar una línea
rompe la cadena (\`node scripts/aprobar.mjs check\`). Lo lee \`scripts/verify-aprobacion-humana.mjs\`.

| tipo | objeto | version | evidencia | mostrado | decidido | quien | estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
`;

const limpiar = (t) => String(t ?? '').replace(/\s+/gu, ' ').replaceAll('|', '¦').trim();

/** null si la combinación tipo/ref es válida; si no, el motivo con la forma correcta. */
export function errorDeTipo(tipo, ref) {
  if (!TIPOS.includes(tipo)) return `tipo «${tipo ?? ''}» inválido: --tipo ${TIPOS.join('|')}`;
  if (tipo === 'produccion') return RE_SHA.test(ref ?? '') ? null : `«${ref ?? ''}» no sirve: --tipo produccion --ref <sha de 7 a 40 hex>`;
  return RE_VERSION.test(ref ?? '') ? null : `«${ref ?? ''}» no sirve: --tipo ${tipo} --ref vN (v1, v2…)`;
}

/** Fila de la tabla, sin pipe final: el sello `| chain:<hex>` se agrega después. */
export function filaAprobacion({ tipo, pieza, ref, texto, quien = 'usuario', estado = 'aprobado' }, ahora = new Date()) {
  const fecha = fechaAR(ahora);
  return `| ${tipo} | ${limpiar(pieza ?? tipo)} | ${ref} | ${limpiar(texto)} | ${fecha} | ${fecha} | ${limpiar(quien)} | ${estado}`;
}

function sellar(contenido, fila) {
  const sellada = sealLineFor(contenido, fila);
  if (!sellada.ok) return { ok: false, reason: sellada.reason };
  return { ok: true, texto: contenido + sellada.append, append: sellada.append };
}

export function registrarEnTexto(contenido, datos, ahora = new Date()) {
  const errorTipo = errorDeTipo(datos.tipo, datos.ref);
  if (errorTipo) return { ok: false, uso: true, reason: errorTipo };
  const pieza = limpiar(datos.pieza ?? datos.tipo);
  if (pieza === '' || /\s/u.test(pieza)) return { ok: false, uso: true, reason: 'la pieza no puede ser vacía ni llevar espacios' };
  if (limpiar(datos.texto) === '') return { ok: false, reason: 'falta el texto literal de la aprobación' };
  const quien = datos.quien ?? 'usuario';
  if (!esHumano(quien)) return { ok: false, reason: `«${quien}» no es un humano: un agente o una sesión no aprueban` };
  return sellar(contenido, filaAprobacion({ ...datos, pieza, quien }, ahora));
}

/** La orden vigente del sha pasa a «usada»: la fila nueva copia destino, sha completo y quién de la orden. */
export function usarEnTexto(contenido, sha, ahora = new Date()) {
  let filas;
  try {
    filas = leerTabla(contenido);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  const v = checkProduccion(filas, sha);
  if (!v.ok) return v;
  const fila = filaAprobacion({ tipo: 'produccion', pieza: v.objeto, ref: v.version, texto: `publicado: orden ${v.version} usada`, quien: v.quien, estado: 'usada' }, ahora);
  return { ...sellar(contenido, fila), version: v.version };
}

const PROMPT = /^apruebo[ \t]+(\S+)[ \t]+(\S+)(?=\s|$)/iu;

export function interpretarPrompt(prompt) {
  const texto = typeof prompt === 'string' ? prompt.trim() : '';
  const m = PROMPT.exec(texto);
  if (!m) return null;
  const tipo = m[1].toLowerCase();
  const ref = m[2].toLowerCase();
  return errorDeTipo(tipo, ref) ? null : { tipo, ref, texto };
}

const rutaDe = (proyecto) => join(proyecto, '.ia-stack', 'APROBACIONES.md');

function escribir(proyecto, operar) {
  const ruta = rutaDe(proyecto);
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : ENCABEZADO;
  const r = operar(actual);
  if (!r.ok) return r;
  mkdirSync(dirname(ruta), { recursive: true });
  if (existsSync(ruta)) appendFileSync(ruta, r.append);
  else writeFileSync(ruta, r.texto);
  return r;
}

const USAGE = `usage: aprobar.mjs registrar --tipo <${TIPOS.join('|')}> --ref <vN|sha> --texto <texto> [--pieza <id>] [--quien <nombre>] | usar --sha <sha> | check | hook  (con [--proyecto <dir>])`;

function usage(motivo) {
  if (motivo) console.error(`REJECTED: ${motivo}`);
  console.error(USAGE);
  process.exit(2);
}

function check(proyecto) {
  const ruta = rutaDe(proyecto);
  if (!existsSync(ruta)) {
    console.log('VACÍO: no hay aprobaciones registradas. Esto no verificó nada.');
    return;
  }
  const texto = readFileSync(ruta, 'utf8');
  const v = verifyChain(texto);
  if (!v.ok) {
    console.error(`REJECTED: línea ${v.brokenLine} de ${ruta}: ${v.reason}`);
    process.exit(1);
  }
  try {
    leerTabla(texto);
  } catch (error) {
    console.error(`REJECTED: ${error.message}`);
    process.exit(1);
  }
  console.log(`OK: ${v.verified} aprobación(es) con la cadena íntegra`);
}

function leerStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function hook() {
  let evento;
  try {
    evento = JSON.parse(leerStdin());
  } catch {
    return;
  }
  const datos = interpretarPrompt(evento?.prompt);
  if (!datos) return;
  const proyecto = typeof evento.cwd === 'string' && evento.cwd !== '' ? evento.cwd : process.cwd();
  const r = escribir(proyecto, (actual) => registrarEnTexto(actual, { ...datos, quien: process.env.IA_STACK_QUIEN || 'usuario' }));
  if (!r.ok) {
    console.error(`REJECTED: no se registró la aprobación: ${r.reason}`);
    process.exit(1);
  }
  console.log(`aprobación registrada: ${datos.tipo} ${datos.ref}`);
}

function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  let v;
  try {
    ({ values: v } = parseArgs({
      args: resto,
      options: {
        tipo: { type: 'string' }, ref: { type: 'string' }, pieza: { type: 'string' }, texto: { type: 'string' },
        quien: { type: 'string' }, sha: { type: 'string' }, proyecto: { type: 'string' },
      },
      strict: true,
    }));
  } catch {
    usage();
  }
  const proyecto = v.proyecto ?? process.cwd();
  if (cmd === 'check') return check(proyecto);
  if (cmd === 'hook') return hook();
  if (cmd === 'usar') {
    if (v.sha === undefined) usage();
    if (!RE_SHA.test(v.sha)) usage(`«${v.sha}» no es un sha (7 a 40 hex)`);
    const r = escribir(proyecto, (actual) => usarEnTexto(actual, v.sha));
    if (!r.ok) {
      console.error(`REJECTED: ${r.reason}`);
      process.exit(1);
    }
    console.log(`OK: orden de producción ${r.version} marcada «usada»; no vuelve a valer`);
    return;
  }
  if (cmd !== 'registrar' || v.texto === undefined) usage();
  const errorTipo = errorDeTipo(v.tipo, v.ref);
  if (errorTipo) usage(errorTipo);
  const r = escribir(proyecto, (actual) => registrarEnTexto(actual, v));
  if (!r.ok) {
    if (r.uso) usage(r.reason);
    console.error(`REJECTED: ${r.reason}`);
    process.exit(1);
  }
  console.log(`OK: aprobación ${v.tipo} de ${v.pieza ?? v.tipo} (${v.ref}) registrada`);
}

if (process.argv[1] && process.argv[1].endsWith('aprobar.mjs')) main();
