#!/usr/bin/env node
// verify-threat-model.mjs — el puente entre «declaré un control» y «ese control está probado».
//
// LA HERIDA. Toda la seguridad de VCP era POSTERIOR al código: la fase 6.2 escanea un delta ya
// escrito y la lente Riesgo de 6.3 revisa un diff ya escrito. Nada declaraba QUÉ HAY QUE PROTEGER
// antes de construir. Y `skills/security-baseline.md` dice textualmente que los huecos de authz
// **no están cubiertos** por el escáner de patrones — que fue exactamente lo peor que apareció en
// la corrida real que motivó todo esto.
//
// COMO CIERRA ESE AGUJERO SIN INVENTAR NINGUN MECANISMO. El modelo de amenaza declara un control
// con su `ac_id`. De ahí el aparato que ya existe lo arrastra solo: RED escribe el test (LAW 1),
// `verify-evidence-trace criteria` exige una prueba que nombre el criterio, y el receipt exige ese
// AC `COMPLIANT` con hash de test vigente. **Un control de authz declarado y no probado bloquea el
// push con los gates que ya estaban.** Este gate es sólo el que cruza las dos mitades.
//
// ES ORTOGONAL AL ESCANER, no lo reemplaza: el escáner mira patrones en un delta ya escrito, el
// modelo mira superficie declarada. Hasta ahora corría uno solo, y por eso una superficie sin
// control pasaba en verde mientras el escáner no encontrara un patrón conocido.
//
// LO QUE NO PUEDE HACER, dicho de frente:
//   - Comprueba que el criterio EXISTA y esté COMPLIANT, **nunca que el control exista en el código
//     ni que sirva**. Un modelo entero inventado con criterios reales pasa en verde.
//   - No descubre superficies: sólo mira las que alguien declaró. Una entrada que nadie escribió le
//     es invisible, igual que al resto del protocolo.
//   - Sin `--receipt` sólo resuelve contra la spec: que el criterio esté escrito no es que esté
//     probado.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { declaredIdentifiers } from './verify-evidence-trace.mjs';

export const USAGE = 'usage: verify-threat-model.mjs check --feature <feature-slug> [--spec <spec-file>] [--receipt <receipt.json>] [--require-inputs]';
export const EMPTY_PREFIX = 'VACÍO: ';
export const NO_INPUTS_CODE = 'THREAT_MODEL_NO_INPUTS';
export const UNKNOWN_AC_CODE = 'THREAT_CONTROL_AC_UNKNOWN';
export const UNPROVEN_AC_CODE = 'THREAT_CONTROL_AC_NOT_COMPLIANT';
export const SPEC_PATH = 'docs/spec.md';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const LIMIT_LINE = 'LÍMITE: comprueba que el criterio exista y esté COMPLIANT, nunca que el control exista en el código ni que sirva. Y no descubre superficies: sólo mira las que alguien declaró.';

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function threatPath(feature) {
  return join('docs', 'discovery', feature, 'diagnostics', 'threat.json');
}

function controlsOf(model) {
  return model !== null && typeof model === 'object' && Array.isArray(model.controls) ? model.controls : [];
}

/** Un control que cita un criterio que la spec no declara es una referencia rota, no evidencia. */
export function unresolvedControls(model, spec) {
  const declared = declaredIdentifiers(spec);
  return controlsOf(model)
    .filter((control) => !declared.has(control?.ac_id))
    .map((control) => `${UNKNOWN_AC_CODE}: el control ${control?.id ?? '(sin id)'} cita ${JSON.stringify(control?.ac_id ?? null)}, que docs/spec.md no declara: una referencia rota no es un control`);
}

/** Y un criterio escrito no es un criterio probado: sin `COMPLIANT` en el receipt, el control está
 * declarado y nada más. Un criterio que el receipt ni menciona cuenta como NO probado, nunca como
 * ausente — el silencio no compra verde. */
export function unprovenControls(model, receipt) {
  const compliant = new Set();
  if (receipt !== null && typeof receipt === 'object' && Array.isArray(receipt.acceptance_criteria)) {
    for (const ac of receipt.acceptance_criteria) {
      if (ac !== null && typeof ac === 'object' && ac.verdict === 'COMPLIANT') compliant.add(ac.ac_id);
    }
  }
  return controlsOf(model)
    .filter((control) => !compliant.has(control?.ac_id))
    .map((control) => `${UNPROVEN_AC_CODE}: el control ${control?.id ?? '(sin id)'} declara ${JSON.stringify(control?.ac_id ?? null)} y el receipt no lo tiene COMPLIANT: un control declarado y no probado no existe`);
}

function parseArgs(args) {
  if (args[0] !== 'check') return null;
  const parsed = { spec: SPEC_PATH, receipt: null, requireInputs: false, feature: null };
  for (let i = 1; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === REQUIRE_INPUTS_FLAG) { parsed.requireInputs = true; continue; }
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) return null;
    if (flag === '--feature') parsed.feature = value;
    else if (flag === '--spec') parsed.spec = value;
    else if (flag === '--receipt') parsed.receipt = value;
    else return null;
    i += 1;
  }
  if (parsed.feature === null || !FEATURE_SLUG.test(parsed.feature)) return null;
  return parsed;
}

export function main(args = process.argv.slice(2), write = console.log, writeError = console.error, io = {}) {
  const parsed = parseArgs(args);
  if (parsed === null) { writeError(USAGE); return 2; }
  const { hay = existsSync, leer = (ruta) => readFileSync(ruta, 'utf8') } = io;

  const ruta = threatPath(parsed.feature);
  if (!hay(ruta)) {
    if (parsed.requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: no existe ${ruta}, así que no hay superficie declarada que cruzar contra la spec.`);
      return 1;
    }
    write(`${EMPTY_PREFIX}no existe ${ruta}: esta feature todavía no declaró su superficie de ataque, y eso no es un incumplimiento acá.`);
    return 0;
  }

  let model;
  try {
    model = JSON.parse(leer(ruta));
  } catch (error) {
    writeError(`REJECTED: ${ruta} no se pudo leer como JSON (${error.message}).`);
    return 1;
  }

  // Sin spec no hay contra qué resolver, y eso se dice en vez de pasar en verde: un gate que no
  // tuvo con qué decidir nunca escribe OK.
  if (!hay(parsed.spec)) {
    writeError(`REJECTED: no existe ${parsed.spec}, así que ningún control se puede resolver contra un criterio: sin spec este gate no puede decidir.`);
    return 1;
  }
  const spec = leer(parsed.spec);

  const problemas = unresolvedControls(model, spec);
  if (parsed.receipt !== null) {
    if (!hay(parsed.receipt)) {
      writeError(`REJECTED: no existe ${parsed.receipt}: se pidió comprobar los controles contra un receipt que no está.`);
      return 1;
    }
    try {
      problemas.push(...unprovenControls(model, JSON.parse(leer(parsed.receipt))));
    } catch (error) {
      writeError(`REJECTED: ${parsed.receipt} no se pudo leer como JSON (${error.message}).`);
      return 1;
    }
  }

  if (problemas.length > 0) {
    for (const problema of problemas) writeError(`REJECTED: ${problema}`);
    return 1;
  }
  const total = controlsOf(model).length;
  write(`OK: ${total} control(es) declarados resuelven contra ${parsed.spec}${parsed.receipt === null ? '' : ` y están COMPLIANT en ${parsed.receipt}`}.`);
  write(LIMIT_LINE);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-threat-model.mjs')) {
  process.exitCode = main();
}
