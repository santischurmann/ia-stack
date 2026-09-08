#!/usr/bin/env node
// verify-deploy.mjs — la fase 8 dejó de ser «git commit + git push + un zip».
//
// LA HERIDA. En las 1857 líneas del maestro no existía **ningún** concepto de host, runtime,
// preview, health check ni endpoint. El receipt certifica que el árbol commiteado es el revisado;
// no certifica que la cosa arranque. Y tres huecos más:
//
//   - La auditoría de secretos corre en 6.2, y la 8 no la re-corría: un secreto que entra en un fix
//     de 6.3, de 6.4 o en el refactor de la fase 7 no lo miraba nadie.
//   - `verify-scope-diff` no ve lo que Git ignora, y ese límite está declarado con estas palabras:
//     «un .env con un secreto no lo mira ningún gate del protocolo».
//   - `rollback` aparecía tres veces en el protocolo y NINGUNA dentro de la fase 8. El único
//     rollback verificado mecánicamente era el de la fase 9, que es de archivado de archivos.
//
// DEPENDENCIAS: SE DECLARA EL INVENTARIO, NO SE AUDITA. VCP no tiene SCA y ese límite está pineado
// en `contracts/honest-limits.json`. Proponer un SCA acá sería romper esa promesa o mentir sobre lo
// que el protocolo hace. Lo que este gate exige es que quede ESCRITO quién auditó — y «ninguno —
// <motivo>» es una respuesta válida, mientras el silencio no lo sea. Misma doctrina que `VACÍO:` ≠
// `OK:`: hacer visible que nadie miró, en vez de que se lea como limpio.
//
// NUNCA INTERNET, Y ES UN CHEQUEO Y NO UNA PROMESA. El host tiene que resolver a loopback ANTES de
// abrir la conexión. Los límites honestos del protocolo que dicen «no sale a la red» son sobre
// fuentes externas; un servicio local es otra cosa, y su límite propio está declarado abajo.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - **No audita dependencias.** Declara el inventario y quién lo auditó; nada más.
//   - **Comprueba que el servicio responde en esta máquina, nunca que un despliegue remoto esté
//     sano.** Un preview en un host ajeno queda fuera del alcance de este gate, a propósito.
//   - `localhost` se acepta por nombre: alguien que reescriba su archivo de hosts lo puede apuntar
//     a otro lado. Las direcciones literales de loopback no tienen ese problema.
//   - Verifica el REGISTRO de la reversión, no la reversión: que `rollback_tested` traiga evidencia
//     no prueba que el comando se haya corrido.

import { existsSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';

export const USAGE = 'usage: verify-deploy.mjs check --feature <feature-slug> [--require-inputs] | verify-deploy.mjs health --feature <feature-slug>';
export const EMPTY_PREFIX = 'VACÍO: ';
export const SCHEMA = 'vcp.deploy/1';
export const NO_INPUTS_CODE = 'DEPLOY_NO_INPUTS';
export const LOOPBACK_CODE = 'DEPLOY_HOST_NOT_LOOPBACK';
export const STATUS_BEFORE_BODY_CODE = 'DEPLOY_BODY_WITHOUT_STATUS';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const PROBE_TIMEOUT_MS = Number(process.env.VCP_DEPLOY_TIMEOUT_MS ?? 5000);
export const LIMIT_LINE = 'LÍMITE: no audita dependencias —VCP no trae SCA y ese límite está declarado—, comprueba que el servicio responde en esta máquina y nunca que un despliegue remoto esté sano, y verifica el registro de la reversión, no la reversión.';

/** La misma prohibición que la fase 9 ya tiene escrita: la vuelta atrás MUEVE de vuelta, nunca
 * elimina. Un rollback que borra convierte el plan de emergencia en el segundo accidente. */
export const DESTRUCTIVE_ROLLBACK = Object.freeze(['rm', 'del', 'Remove-Item', 'git clean', 'rmdir', 'Clear-Content']);

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const LOOPBACK_HOSTS = new Set(['localhost', '::1', '[::1]']);
const DECLARED_PLACEHOLDERS = new Set(['n/a', 'na', 'unknown', 'nothing', 'none', 'ninguno', 'ninguna', 'nada', 'tbd', 'todo', 'pendiente', '-']);
const NONE_PREFIX = /^(?:none|ninguno|ninguna)\b/iu;

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function deployPath(feature) {
  return join('docs', 'deploy', `${feature}.json`);
}

/** Un campo que admite «no hay» CON motivo y nunca «no hay» a secas. Misma forma que el receipt ya
 * exige para `not_reviewed` y para el bloque de soporte. */
function declaredOrNone(value, at, violations) {
  if (!nonEmpty(value)) { violations.push(`${at} debe decir algo, o «ninguno — <motivo>»`); return; }
  const trimmed = value.trim();
  if (DECLARED_PLACEHOLDERS.has(trimmed.toLowerCase()) || (NONE_PREFIX.test(trimmed) && !/^\S+\s*(?:—|-)\s*\S.*$/u.test(trimmed))) {
    violations.push(`${at}: ${JSON.stringify(trimmed)} es relleno, no una respuesta — escribí «ninguno — <motivo>»`);
  }
}

/** El host tiene que ser de esta máquina, y se decide ANTES de abrir la conexión. */
export function isLoopback(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  const host = parsed.hostname;
  if (LOOPBACK_HOSTS.has(host)) return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(host);
}

export function validateDeploy(document) {
  const violations = [];
  if (!isObject(document)) return ['el expediente de despliegue debe ser un objeto JSON'];
  if (document.schema !== SCHEMA) violations.push(`schema debe ser ${SCHEMA}`);
  if (!FEATURE_SLUG.test(document.feature ?? '')) violations.push('feature debe ser un slug en kebab-case');
  if (!DATE.test(document.date ?? '')) violations.push('date debe ser una fecha AAAA-MM-DD');

  const deps = document.dependencies;
  if (!isObject(deps)) violations.push('dependencies debe declarar manifest, lockfile_sha256, count y audited_by');
  else {
    declaredOrNone(deps.manifest, 'dependencies.manifest', violations);
    declaredOrNone(deps.lockfile_sha256, 'dependencies.lockfile_sha256', violations);
    declaredOrNone(deps.audited_by, 'dependencies.audited_by', violations);
    if (!Number.isInteger(deps.count) || deps.count < 0) violations.push('dependencies.count debe ser un entero no negativo: un conteo es un número, no una impresión');
  }

  // Lo que Git ignora y parece sensible se REPORTA, sin leerlo. Cierra, declarándolo, el límite que
  // dice que un .env con un secreto no lo mira ningún gate del protocolo.
  if (!Array.isArray(document.ignored_sensitive)) violations.push('ignored_sensitive debe ser una lista (vacía está bien)');
  else {
    document.ignored_sensitive.forEach((item, index) => {
      if (!isObject(item) || !nonEmpty(item.path) || !nonEmpty(item.why)) {
        violations.push(`ignored_sensitive[${index}] debe declarar path y why: lo ignorado que parece sensible se nombra, con el motivo por el que está bien`);
      }
    });
  }

  const service = document.service;
  if (!isObject(service) || typeof service.declared !== 'boolean') violations.push('service.declared debe ser booleano');
  else if (service.declared) {
    if (!Array.isArray(service.start_command) || service.start_command.length === 0) violations.push('service.start_command no puede estar vacío: un servicio declarado que nadie sabe arrancar no se puede comprobar');
    if (!isLoopback(service.base_url)) violations.push(`${LOOPBACK_CODE}: service.base_url ${JSON.stringify(service.base_url ?? null)} no resuelve a loopback — este gate comprueba esta máquina, nunca un despliegue remoto`);
    if (!Array.isArray(service.health) || service.health.length === 0) violations.push('service.health necesita al menos una ruta: un servicio sin ninguna comprobación declarada no se puede verificar');
    else {
      service.health.forEach((probe, index) => {
        if (!isObject(probe) || !nonEmpty(probe.path)) { violations.push(`service.health[${index}].path debe ser una ruta`); return; }
        if (!Number.isInteger(probe.expect_status)) violations.push(`service.health[${index}].expect_status debe ser un código de estado: el estado precede al contenido`);
      });
    }
  }

  if (!nonEmpty(document.rollback_command)) violations.push('rollback_command debe decir cómo se vuelve atrás: un cambio sin vuelta atrás es de una sola dirección');
  else {
    const verbo = DESTRUCTIVE_ROLLBACK.find((v) => new RegExp(`(?:^|\\s)${v.replaceAll(' ', '\\s+')}(?:\\s|$)`, 'iu').test(document.rollback_command));
    if (verbo !== undefined) violations.push(`rollback_command contiene «${verbo}»: la vuelta atrás mueve de vuelta, nunca elimina`);
  }
  if (!isObject(document.rollback_tested) || !nonEmpty(document.rollback_tested.when) || !nonEmpty(document.rollback_tested.evidence)) {
    violations.push('rollback_tested debe traer cuándo se probó y su evidencia: un comando de vuelta atrás que nadie corrió es una hipótesis');
  }
  return violations;
}

/**
 * EL ESTADO PRECEDE AL CONTENIDO. Es la misma regla que la fase 5 declara como sexta forma de
 * aserción prohibida, aplicada donde nació: un 404 tiene cuerpo, y ese cuerpo tampoco trae lo que la
 * comprobación dice no encontrar. Los dos veredictos quedan como campos separados para que la
 * evidencia se pueda leer después, y un `body_matched: true` con el estado equivocado es RECHAZO.
 */
export function judgeProbe(expected, observed) {
  const statusMatched = observed.status === expected.expect_status;
  const bodyMatched = expected.expect_body === null || expected.expect_body === undefined
    ? true
    : String(observed.body ?? '').includes(expected.expect_body);
  if (!statusMatched) {
    return {
      ok: false,
      status_matched: false,
      body_matched: bodyMatched,
      reason: `${STATUS_BEFORE_BODY_CODE}: ${expected.path} devolvió ${observed.status} y se esperaba ${expected.expect_status}${bodyMatched ? ' — el cuerpo coincidía igual, que es exactamente por qué el estado va primero' : ''}`,
    };
  }
  if (!bodyMatched) {
    return { ok: false, status_matched: true, body_matched: false, reason: `${expected.path} devolvió ${observed.status} pero su cuerpo no contiene ${JSON.stringify(expected.expect_body)}` };
  }
  return { ok: true, status_matched: true, body_matched: true, reason: `${expected.path} → ${observed.status}` };
}

function fetchLoopback(base, path, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const req = request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function parseArgs(args) {
  if (args[0] !== 'check' && args[0] !== 'health') return null;
  const parsed = { command: args[0], feature: null, requireInputs: false };
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === REQUIRE_INPUTS_FLAG) { parsed.requireInputs = true; continue; }
    if (args[i] !== '--feature') return null;
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) return null;
    parsed.feature = value;
    i += 1;
  }
  if (parsed.feature === null || !FEATURE_SLUG.test(parsed.feature)) return null;
  return parsed;
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArgs(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  const { hay = existsSync, leer = (ruta) => readFileSync(ruta, 'utf8') } = io;
  const pedir = io.pedir ?? ((base, path) => fetchLoopback(base, path, io.timeoutMs));

  const ruta = deployPath(parsed.feature);
  if (!hay(ruta)) {
    if (parsed.requireInputs) { writeError(`REJECTED: ${NO_INPUTS_CODE}: no existe ${ruta}, así que no hay nada declarado sobre cómo se publica ni cómo se vuelve atrás.`); return 1; }
    write(`${EMPTY_PREFIX}no existe ${ruta}: esta feature todavía no declaró su despliegue, y eso no es un incumplimiento acá.`);
    return 0;
  }
  let document;
  try { document = JSON.parse(leer(ruta)); } catch (error) {
    writeError(`REJECTED: ${ruta} no se pudo leer como JSON (${error.message}).`);
    return 1;
  }

  const violations = validateDeploy(document);
  if (violations.length > 0) {
    for (const item of violations) writeError(`REJECTED: ${item}`);
    return 1;
  }
  if (parsed.command === 'check') {
    write(`OK: ${ruta} declara reversión probada, inventario de dependencias y ${document.service.declared ? `${document.service.health.length} comprobación(es) de salud en loopback` : 'ningún servicio'}.`);
    write(LIMIT_LINE);
    return 0;
  }

  // `health` — los tres resultados mecánicos, calcados del gate de lint/typecheck que el protocolo
  // ya tiene resuelto: gate de verdad, BLOQUEA, o no aplica con la evidencia de la detección.
  return probeService(document, write, writeError, pedir, ruta);
}

async function probeService(document, write, writeError, pedir, ruta) {
  const service = document.service;
  if (!service.declared) {
    write(`${EMPTY_PREFIX}no aplica: ${ruta} declara service.declared=false, y ningún marcador de servicio se declaró. Evidencia: el propio expediente, que es donde el proyecto dice si publica un servicio.`);
    write(LIMIT_LINE);
    return 0;
  }
  // El chequeo de loopback NO se repite acá: `validateDeploy` ya rechazó un host que no lo sea, y
  // corre antes que esto en todos los caminos. Repetirlo sería código que ninguna prueba puede
  // alcanzar, y una rama inalcanzable es exactamente lo que el gate de cobertura de este
  // repositorio no deja pasar.
  const fallos = [];
  for (const probe of service.health) {
    let observed;
    try {
      observed = await pedir(service.base_url, probe.path);
    } catch (error) {
      // Declarado y no arranca BLOQUEA. Esto nunca es «no aplica».
      fallos.push(`${probe.path}: el servicio está declarado y no respondió (${error.message}) — un servicio declarado que no arranca bloquea, nunca es «no aplica»`);
      continue;
    }
    const veredicto = judgeProbe(probe, observed);
    write(`  ${veredicto.ok ? 'OK' : 'FALLA'} ${probe.path} · status_matched=${veredicto.status_matched} body_matched=${veredicto.body_matched}`);
    if (!veredicto.ok) fallos.push(veredicto.reason);
  }
  if (fallos.length > 0) {
    for (const fallo of fallos) writeError(`REJECTED: ${fallo}`);
    return 1;
  }
  write(`OK: ${service.health.length} comprobación(es) de salud respondieron lo esperado en ${service.base_url}.`);
  write(LIMIT_LINE);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-deploy.mjs')) {
  const resultado = main();
  Promise.resolve(resultado).then((code) => { process.exitCode = code; });
}
