#!/usr/bin/env node
// verify-stack-matrix.mjs — la matriz de stacks dice lo que cuesta crecer, o no dice nada.
//
// EL PROBLEMA QUE RESUELVE. Una recomendación de stack sin el costo de escalarla es media
// recomendación. El research del 2026-09-14 midió ocho proveedores y encontró que **el evento que
// saca a un proyecto del plan gratuito casi nunca es un número**: es una cláusula de uso comercial
// sin contador ni alerta, una pausa tras siete días de inactividad, o una base de datos que expira
// a los treinta días de creada. Un contrato que guardara sólo cupos dejaría afuera justo lo que
// rompe a la gente.
//
// POR ESO LA INVARIANTE DE FONDO ES EL DISPARADOR, NO EL CUPO. Un servicio puede no declarar ningún
// cupo numérico y ser honesto; lo que no puede es no decir qué evento concreto saca del plan
// gratuito, ni a cuánto sale el primer escalón pago.
//
// LÍMITE HONESTO. Comprueba que el disparador esté escrito, fechado y que no sea relleno; **nunca
// que el número sea cierto ni que siga vigente hoy**. No sale a la red: lee el archivo que alguien
// escribió. Un contrato con cifras inventadas y fecha de hoy pasa en verde. Y tampoco impide crear
// un recurso pago: no es un sandbox — cualquier proceso con las mismas credenciales lo elude.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { safeProjectFile } from './ratchet.mjs';

export const SCHEMA = 'vcp.free-tier-limits/1';
export const USAGE = 'usage: verify-stack-matrix.mjs check <matrix.json>';
export const EMPTY = 'VACÍO';

/** Piso de largo para un campo explicativo. No mide calidad: descarta el vacío y la frase suelta. */
export const MIN_TEXT = 20;

const RAIZ_KEYS = Object.freeze(['schema', 'why', 'revalidated', 'max_age_days', 'method', 'services']);
const SERVICIO_KEYS = Object.freeze(['service_id', 'plan_name', 'captured_from', 'captured_at', 'limits', 'upgrade_trigger', 'paid_from', 'escalation']);
const ESCALON_KEYS = Object.freeze(['when', 'to_plan', 'cost_note']);
const CUPO_KEYS = Object.freeze(['metric', 'value', 'unit', 'hard']);

const RELLENO = /^(?:tbd|todo|n\/a|na|none|unknown|placeholder|-|si crece|cuando crezca)$/iu;
const FECHA = /^\d{4}-\d{2}-\d{2}$/u;
const IDENTIFICADOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim() !== '';
const explicativo = (v) => typeof v === 'string' && v.trim().length >= MIN_TEXT && !RELLENO.test(v.trim());
const clavesExactas = (v, claves) => esObjeto(v) && Object.keys(v).length === claves.length && claves.every((k) => Object.hasOwn(v, k));

/**
 * Todas las violaciones, sin lanzar nunca. Un gate que se salva por una excepción no comprobó nada:
 * quien lo lee no distingue "esto está mal" de "el gate se rompió mirándolo".
 */
export function validateLimits(contrato) {
  if (!esObjeto(contrato)) return [`el contrato de límites debe ser un objeto JSON que declare ${SCHEMA}`];
  // El esquema se mira primero y corta: enumerar campos de un archivo que no es el contrato produce
  // una lista de reproches sobre algo que nunca pretendió serlo.
  if (contrato.schema !== SCHEMA) return [`el contrato debe declarar ${SCHEMA}, no ${JSON.stringify(contrato.schema)}`];

  const violaciones = [];
  if (!clavesExactas(contrato, RAIZ_KEYS)) {
    violaciones.push(`el contrato debe declarar exactamente ${RAIZ_KEYS.join(', ')}`);
  }
  if (!explicativo(contrato.why)) violaciones.push('why debe decir para qué existe este contrato');
  if (!explicativo(contrato.method)) violaciones.push('method debe decir cómo se capturaron los números');
  if (!FECHA.test(contrato.revalidated ?? '')) violaciones.push('revalidated debe ser una fecha AAAA-MM-DD');
  if (!Number.isInteger(contrato.max_age_days) || contrato.max_age_days < 1) {
    violaciones.push('max_age_days debe ser un entero positivo: sin período declarado no hay nada contra qué medir la antigüedad');
  }

  if (!Array.isArray(contrato.services) || contrato.services.length === 0) {
    violaciones.push('services debe ser una lista con al menos un servicio');
    return violaciones;
  }

  const vistos = new Set();
  for (const [indice, servicio] of contrato.services.entries()) {
    const donde = `services[${indice}]`;
    if (!clavesExactas(servicio, SERVICIO_KEYS)) {
      violaciones.push(`${donde} (${servicio?.service_id ?? 'sin id'}) debe declarar exactamente ${SERVICIO_KEYS.join(', ')}`);
      continue;
    }
    const id = servicio.service_id;
    if (!IDENTIFICADOR.test(id)) violaciones.push(`${donde}.service_id debe ser kebab-case: ${JSON.stringify(id)}`);
    else if (vistos.has(id)) violaciones.push(`services repite el identificador ${id}`);
    else vistos.add(id);

    if (!noVacio(servicio.plan_name)) violaciones.push(`${id}: plan_name debe nombrar el plan`);
    if (!noVacio(servicio.captured_from)) violaciones.push(`${id}: captured_from debe decir de dónde salió el dato`);
    if (!FECHA.test(servicio.captured_at ?? '')) violaciones.push(`${id}: captured_at debe ser una fecha AAAA-MM-DD`);

    // LA INVARIANTE DE FONDO. Un stack recomendado cuyo plan gratuito no dice qué lo rompe es
    // exactamente el agujero que este artefacto viene a hacer visible.
    if (!explicativo(servicio.upgrade_trigger)) {
      violaciones.push(`${id}: upgrade_trigger debe decir QUÉ evento concreto saca del plan gratuito, y casi nunca es un cupo`);
    }
    if (!explicativo(servicio.paid_from)) violaciones.push(`${id}: paid_from debe decir a cuánto sale el primer escalón pago`);

    if (!Array.isArray(servicio.escalation) || servicio.escalation.length === 0) {
      violaciones.push(`${id}: escalation debe tener al menos una fila, o la recomendación no dice qué hacer al crecer`);
    } else {
      for (const [n, escalon] of servicio.escalation.entries()) {
        const etiqueta = `${id}.escalation[${n}]`;
        if (!clavesExactas(escalon, ESCALON_KEYS)) {
          violaciones.push(`${etiqueta} debe declarar exactamente ${ESCALON_KEYS.join(', ')}`);
          continue;
        }
        if (!explicativo(escalon.when)) violaciones.push(`${etiqueta}.when debe decir cuándo se llega a este escalón`);
        if (!noVacio(escalon.to_plan)) violaciones.push(`${etiqueta}.to_plan debe nombrar el plan destino`);
        if (!explicativo(escalon.cost_note)) violaciones.push(`${etiqueta}.cost_note debe decir cuánto cuesta`);
      }
    }

    // Una lista de cupos vacía se acepta a propósito: un servicio puede no tener ningún cupo
    // numérico y ser honesto. Lo medido es que el disparador casi nunca es un número.
    if (!Array.isArray(servicio.limits)) {
      violaciones.push(`${id}: limits debe ser una lista, aunque esté vacía`);
    } else {
      for (const [n, cupo] of servicio.limits.entries()) {
        const etiqueta = `${id}.limits[${n}]`;
        if (!clavesExactas(cupo, CUPO_KEYS)) { violaciones.push(`${etiqueta} debe declarar exactamente ${CUPO_KEYS.join(', ')}`); continue; }
        if (!noVacio(cupo.metric)) violaciones.push(`${etiqueta}.metric debe nombrar lo que se mide`);
        if (typeof cupo.value !== 'number' || Number.isNaN(cupo.value)) violaciones.push(`${etiqueta}.value debe ser un número`);
        if (!noVacio(cupo.unit)) violaciones.push(`${etiqueta}.unit debe decir en qué unidad`);
        if (typeof cupo.hard !== 'boolean') violaciones.push(`${etiqueta}.hard debe declarar si corta el servicio o factura el excedente`);
      }
    }
  }

  return violaciones;
}

export const MATRIX_SCHEMA = 'vcp.stack-matrix/1';

/** Los ocho tipos de producto. Estan los ocho o no esta la matriz: con cuatro filas, las otras
 * cuatro son invisibles y no se distingue "lo mire y no aplica" de "no lo mire". Mismo criterio que
 * la cobertura del diagnostico CAIO.
 *
 * `H` va ultimo a proposito: es "otro", y su valor es obligar a escribir por que ninguno de los
 * siete anteriores alcanza. Por eso es el unico que puede no recomendar nada. */
export const TIPOS_DE_PRODUCTO = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

const FILA_KEYS = Object.freeze(['product_type', 'name', 'decision_criterion', 'recommended', 'alternatives', 'free_tier_refs', 'red_adapter', 'evidence']);
const RECOMENDADO_KEYS = Object.freeze(['stack', 'why']);
const SIN_RECOMENDACION = 'H';
/** Los dos tipos que pueden no referenciar ningun servicio, por motivos distintos: `H` porque
 * todavia no se sabe que es, `G` porque se sabe y NO SE OPERA -- un artefacto se entrega una vez.
 * La regla original solo exentaba a `H` y dejo la matriz real en rojo sobre `G`: el defecto estaba
 * en la regla, escrita desde los casos web, no en el dato. */
const SIN_SERVICIO = Object.freeze(['G', 'H']);

/**
 * La matriz cubre los ocho tipos y cada servicio que referencia existe en el contrato.
 * `idsDisponibles` es el conjunto de `service_id` del contrato de limites, inyectado en vez de leido
 * para que esta funcion se pueda falsificar sin tocar el filesystem.
 */
export function validateMatrix(matriz, idsDisponibles = new Set()) {
  if (!esObjeto(matriz)) return [`la matriz debe ser un objeto JSON que declare ${MATRIX_SCHEMA}`];
  if (matriz.schema !== MATRIX_SCHEMA) return [`la matriz debe declarar ${MATRIX_SCHEMA}, no ${JSON.stringify(matriz.schema)}`];

  const violaciones = [];
  if (!Array.isArray(matriz.rows)) return [...violaciones, 'rows debe ser una lista de filas'];

  const porTipo = new Map();
  for (const [indice, f] of matriz.rows.entries()) {
    const donde = `rows[${indice}]`;
    if (!clavesExactas(f, FILA_KEYS)) { violaciones.push(`${donde} debe declarar exactamente ${FILA_KEYS.join(', ')}`); continue; }
    const tipo = f.product_type;
    if (!TIPOS_DE_PRODUCTO.includes(tipo)) { violaciones.push(`${donde}.product_type declara ${JSON.stringify(tipo)}, que no es uno de los ocho codigos`); continue; }
    if (porTipo.has(tipo)) violaciones.push(`el tipo ${tipo} tiene mas de una fila: la segunda no agrega cobertura, tapa un tipo que quedo sin ninguna`);
    else porTipo.set(tipo, f);

    if (!noVacio(f.name)) violaciones.push(`${tipo}: name debe nombrar el tipo de producto`);
    // El criterio es lo que hace que la tabla no sea decorativa: una pregunta con respuesta
    // observable, no un adjetivo.
    if (!explicativo(f.decision_criterion)) violaciones.push(`${tipo}: decision_criterion debe ser una pregunta con respuesta observable, no un relleno`);
    if (!Array.isArray(f.alternatives)) violaciones.push(`${tipo}: alternatives debe ser una lista, aunque este vacia`);
    if (!noVacio(f.red_adapter)) violaciones.push(`${tipo}: red_adapter debe decir cual le toca, o ninguno con su motivo`);
    if (!Array.isArray(f.evidence)) violaciones.push(`${tipo}: evidence debe ser una lista`);

    if (tipo === SIN_RECOMENDACION) {
      // `H` es el unico que puede no recomendar: por definicion no se sabe que es.
      if (!esObjeto(f.recommended)) violaciones.push(`${tipo}: recommended debe existir aunque declare que no hay recomendacion`);
    } else if (!clavesExactas(f.recommended, RECOMENDADO_KEYS) || !explicativo(f.recommended.stack) || !explicativo(f.recommended.why)) {
      violaciones.push(`${tipo}: recommended debe declarar stack y why, y recomendar sin decir por que es anunciar, no recomendar`);
    }

    if (!Array.isArray(f.free_tier_refs)) {
      violaciones.push(`${tipo}: free_tier_refs debe ser una lista`);
    } else {
      if (f.free_tier_refs.length === 0 && !SIN_SERVICIO.includes(tipo)) {
        violaciones.push(`${tipo}: free_tier_refs vacia mientras la fila recomienda un stack alojado — tiene que decir contra que servicio se mide el costo de crecer`);
      }
      for (const ref of f.free_tier_refs) {
        if (!idsDisponibles.has(ref)) violaciones.push(`${tipo}: free_tier_refs nombra ${JSON.stringify(ref)}, que no existe en el contrato de limites: la recomendacion queda sin respaldo`);
      }
    }
  }

  for (const tipo of TIPOS_DE_PRODUCTO) {
    if (!porTipo.has(tipo)) violaciones.push(`el tipo de producto ${tipo} no tiene fila: quien lo elija se queda sin respuesta, y el silencio no compra verde`);
  }

  return violaciones;
}

const MS_POR_DIA = 86400000;

/** Una fecha AAAA-MM-DD en milisegundos, o `null` si no es una fecha real. `2026-13-45` parsea con
 * el constructor pero no existe: se compara la forma normalizada contra la escrita. */
function diaEnMs(valor) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return null;
  const ms = Date.parse(`${valor}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10) === valor ? ms : null;
}

/**
 * La captura de cada servicio esta dentro del periodo que el contrato declara.
 *
 * EL RELOJ SE INYECTA, nunca se lee del sistema aca adentro: una comprobacion que mira la hora real
 * no se puede falsificar sin esperar noventa dias, y una prueba que no se puede falsificar no prueba
 * nada. Quien llama pasa el dia de hoy.
 *
 * POR QUE RECHAZA EN VEZ DE AVISAR: razonado en docs/adr/0001. Un numero de plan gratuito vencido es
 * peor que ninguno, porque se lee como cierto.
 *
 * LIMITE HONESTO: mide la EDAD DECLARADA, no la vigencia del dato. Un contrato con la fecha de hoy y
 * cifras inventadas sale verde, y uno viejo cuyos numeros no cambiaron sale rojo igual. La fecha
 * dice cuando alguien miro, no si lo que vio sigue siendo cierto.
 */
export function validateFreshness(contrato, hoy) {
  if (!esObjeto(contrato)) return ['el contrato de limites debe ser un objeto JSON'];
  const violaciones = [];

  const limite = contrato.max_age_days;
  if (!Number.isInteger(limite) || limite < 1) {
    violaciones.push('max_age_days debe ser un entero positivo: sin periodo declarado no hay contra que medir la antigüedad, y adivinar uno seria inventar la garantia');
    return violaciones;
  }

  const hoyMs = diaEnMs(hoy);
  if (hoyMs === null) return [...violaciones, `la fecha de referencia ${JSON.stringify(hoy)} no es un dia AAAA-MM-DD valido`];

  const servicios = Array.isArray(contrato.services) ? contrato.services : [];
  for (const servicio of servicios) {
    const id = esObjeto(servicio) && noVacio(servicio.service_id) ? servicio.service_id : 'sin id';
    const capturaMs = diaEnMs(esObjeto(servicio) ? servicio.captured_at : null);
    if (capturaMs === null) {
      violaciones.push(`${id}: captured_at ${JSON.stringify(esObjeto(servicio) ? servicio.captured_at : null)} no es un dia AAAA-MM-DD valido, asi que no se puede fechar el dato`);
      continue;
    }
    if (capturaMs > hoyMs) {
      violaciones.push(`${id}: captured_at es posterior a la fecha de referencia — una captura del futuro es un dato mal escrito, no uno muy fresco`);
      continue;
    }
    const dias = Math.round((hoyMs - capturaMs) / MS_POR_DIA);
    if (dias > limite) {
      violaciones.push(`${id}: la captura tiene ${dias} dias y el periodo declarado es ${limite}. La causa del rechazo es la ANTIGÜEDAD y no un defecto del contrato: revalidalo contra la documentacion oficial y actualiza captured_at. Un numero de plan gratuito vencido se lee como cierto, y por eso no se deja pasar con un aviso.`);
    }
  }

  return violaciones;
}

const CONTRATO_PATH = join('contracts', 'free-tier-limits.json');

/**
 * Los TRES estados de una lectura, que antes eran dos y por eso un archivo corrupto se convertia en
 * silencio. Lo encontro la triangulacion: una marca de orden de bytes hace fallar el parseo, y
 * tratar cualquier fallo como ausencia hacia que el gate escribiera VACIO y saliera 0 sobre un
 * archivo roto. Ausente es un proyecto que todavia no eligio stack; ilegible es un defecto.
 */
function leerDocumento(read, ruta) {
  let bruto;
  try {
    bruto = read(ruta, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { estado: 'ausente' };
    return { estado: 'ilegible', motivo: error?.message ?? String(error) };
  }
  try {
    return { estado: 'ok', valor: JSON.parse(bruto) };
  } catch (error) {
    return { estado: 'ilegible', motivo: `no es JSON valido (una marca de orden de bytes al principio tambien rompe el parseo): ${error.message}` };
  }
}

/**
 * `main` compone las tres invariantes y decide el veredicto. Todas las lecturas se inyectan para que
 * el comportamiento se pueda falsificar sin tocar el filesystem.
 *
 * SIN ENTRADA NO APRUEBA: si no hay matriz ni contrato escribe el prefijo de vacio y sale 0, que es
 * DISTINTO de aprobar. Un gate que aprueba por ausencia de entrada dice que la cobertura esta bien
 * cuando en realidad no se miro nada.
 */
export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const read = options.read ?? ((ruta) => readFileSync(ruta, 'utf8'));
  const hoy = options.hoy ?? new Date().toISOString().slice(0, 10);

  if (args.length !== 2 || args[0] !== 'check' || !noVacio(args[1])) {
    writeError(USAGE);
    return 2;
  }

  // La ruta se resuelve ANTES de abrirla, con el ayudante que ya fija el criterio de este
  // repositorio: nada de enlaces simbolicos, nada que se escape del proyecto. La lectura no se
  // reimplementa. Lo encontro la triangulacion: la ruta llegaba por argumento y se abria tal cual.
  const resolver = options.safePath ?? safeProjectFile;
  let rutaMatriz;
  try {
    rutaMatriz = resolver(options.root ?? process.cwd(), args[1]) ?? args[1];
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }

  const matrizLeida = leerDocumento(read, rutaMatriz);
  const contratoLeido = leerDocumento(read, CONTRATO_PATH);

  for (const [nombre, leida] of [['la matriz', matrizLeida], [CONTRATO_PATH, contratoLeido]]) {
    if (leida.estado === 'ilegible') {
      writeError(`REJECTED: ${nombre} existe pero es ilegible: ${leida.motivo}. Un archivo corrupto no es un archivo ausente, asi que esto rechaza en vez de escribir ${EMPTY}.`);
      return 1;
    }
  }

  if (matrizLeida.estado === 'ausente' && contratoLeido.estado === 'ausente') {
    write(`${EMPTY}: no hay matriz en ${args[1]} ni contrato de limites en ${CONTRATO_PATH}. Esto no verifico nada: un proyecto que todavia no eligio stack no incumple nada.`);
    return 0;
  }
  if (contratoLeido.estado === 'ausente') {
    writeError(`REJECTED: hay matriz pero falta ${CONTRATO_PATH}: una recomendacion sin el contrato de limites no dice que cuesta crecer`);
    return 1;
  }
  if (matrizLeida.estado === 'ausente') {
    writeError(`REJECTED: hay contrato de limites pero falta la matriz en ${args[1]}`);
    return 1;
  }

  const matriz = matrizLeida.valor;
  const contrato = contratoLeido.valor;

  const violaciones = [
    ...validateLimits(contrato),
    ...validateFreshness(contrato, hoy),
    ...validateMatrix(matriz, new Set((Array.isArray(contrato.services) ? contrato.services : []).map((s) => s?.service_id))),
  ];

  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${v}`);
    return 1;
  }

  // Sin guarda a proposito: para llegar aca las dos listas existen. `validateLimits` rechaza un
  // contrato cuyos `services` no sean una lista con al menos un servicio, y `validateMatrix` corta
  // en seco si `rows` no es una lista. Una guarda defensiva aca seria codigo muerto que finge cubrir
  // un caso imposible, y el gate de cobertura de este repositorio la marca como rama sin ejecutar.
  const tipos = matriz.rows.length;
  const servicios = contrato.services.length;
  write(`OK: ${tipos} tipo(s) de producto cubierto(s) y ${servicios} servicio(s) con su disparador de escalado, capturados dentro de los ${contrato.max_age_days} dias declarados.`);
  write('LIMITE: verifica que el dato este declarado, fechado y que no sea relleno. NUNCA que el numero sea cierto ni que siga vigente hoy: no sale a la red, lee el archivo que alguien escribio.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-stack-matrix.mjs')) {
  process.exitCode = main();
}
