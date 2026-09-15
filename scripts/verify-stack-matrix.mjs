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
// LÍMITE HONESTO. Comprueba que cada campo esté escrito, fechado y que no sea relleno; **nunca que
// el número sea cierto ni que siga vigente hoy**. No sale a la red: lee los archivos que alguien
// escribió. Un contrato con cifras inventadas y fecha de hoy pasa en verde, y un disparador que diga
// «no lo sabemos» con veinte caracteres también. Tampoco impide crear un recurso pago: no es un
// sandbox, y cualquier proceso con las mismas credenciales lo elude.

import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeProjectFile } from './ratchet.mjs';
import { mismoSchema } from './schema-compat.mjs';

export const SCHEMA = 'ia.free-tier-limits/1';
export const MATRIX_SCHEMA = 'ia.stack-matrix/1';
export const USAGE = 'usage: verify-stack-matrix.mjs check <matrix.json>';
export const EMPTY = 'VACÍO';

/** Piso de largo para un campo explicativo. No mide calidad: descarta el vacío y la frase suelta. */
export const MIN_TEXT = 20;

/** Techo del período de vencimiento, en días.
 *
 * LA HERIDA: sin techo, el dato bajo prueba elegía su propio umbral de aprobación. Una ronda
 * adversarial escribió `max_age_days: 3650000` con una captura de 1970 y el gate aprobó, imprimiendo
 * el número absurdo sin inmutarse. Un año es el techo porque más allá de eso la captura ya no
 * describe un plan que se mueve varias veces por año, que es lo que el research midió. */
export const MAX_AGE_CEILING = 365;

const RAIZ_KEYS = Object.freeze(['schema', 'why', 'revalidated', 'max_age_days', 'method', 'services']);
const SERVICIO_KEYS = Object.freeze(['service_id', 'plan_name', 'captured_from', 'captured_at', 'limits', 'upgrade_trigger', 'paid_from', 'escalation']);
const ESCALON_KEYS = Object.freeze(['when', 'to_plan', 'cost_note']);
const CUPO_KEYS = Object.freeze(['metric', 'value', 'unit', 'hard']);
const FILA_KEYS = Object.freeze(['product_type', 'name', 'decision_criterion', 'recommended', 'alternatives', 'free_tier_refs', 'no_free_tier_reason', 'red_adapter', 'evidence']);
const RECOMENDADO_KEYS = Object.freeze(['stack', 'why']);

/** Fichas sueltas que ocupan un campo sin decir nada. */
const FICHA_VACIA = /^(?:tbd|todo|n\/a|na|none|unknown|placeholder|pendiente|-|x|depende|varios|etc\.?)$/iu;

/** Frases enteras que son relleno y que NO sobreviven a partirse en fichas: sus palabras sueltas son
 * legítimas. Van aparte por eso, no por gusto — meterlas entre las fichas las volvía entradas
 * muertas, que es el mismo defecto en miniatura que este módulo ya tuvo una vez. */
const FRASE_VACIA = /^(?:por definir|si crece|cuando crezca|a definir|sin definir|ver despues|lo de siempre)$/iu;

const FECHA = /^\d{4}-\d{2}-\d{2}$/u;
const IDENTIFICADOR = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/u;

/** La regla del período, escrita UNA vez. Estaba duplicada entre las dos funciones que la
 * comprueban y las dos copias no decían lo mismo: una rechazaba por encima del techo y la otra
 * no, así que la comprobación de antigüedad llamada sola aceptaba un período de diez mil años.
 * Dos redacciones de la misma garantía divergen con el tiempo, y ésta ya había divergido. */
export function violacionDePeriodo(dias) {
  if (!Number.isInteger(dias) || dias < 1) {
    return 'max_age_days debe ser un entero positivo: sin período declarado no hay nada contra qué medir la antigüedad, y adivinar uno sería inventar la garantía';
  }
  if (dias > MAX_AGE_CEILING) {
    return `max_age_days declara ${dias} y el techo es ${MAX_AGE_CEILING}: sin techo, el dato elige su propio umbral de aprobación y la regla de antigüedad se desactiva editando el archivo que valida`;
  }
  return null;
}

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim() !== '';

/** Relleno: texto que ocupa el campo sin decir nada.
 *
 * LA HERIDA, con su número de veces: UNA, y la encontró una pasada de mutación. La versión anterior
 * listaba sólo alternativas cortas —la más larga tenía trece caracteres— mientras el piso de largo
 * era veinte. O sea que la comprobación de relleno NUNCA podía cambiar el resultado: era código
 * inalcanzable, y las dos pruebas que decían cubrirlo probaban el piso de largo. El relleno que de
 * verdad se cuela es el LARGO.
 *
 * LÍMITE: agarra el relleno que se parece a relleno, nunca una frase bien escrita que no dice nada.
 * Eso lo lee una persona. */
export function esRelleno(valor) {
  if (typeof valor !== 'string') return false;
  const limpio = valor.trim().replace(/[.,;:!?]+$/u, '');
  if (limpio === '') return false;
  return limpio.split(/[,;]+/u).map((parte) => parte.trim()).filter(Boolean).every((parte) => {
    if (FRASE_VACIA.test(parte)) return true;
    const fichas = parte.split(/[\s/]+/u).filter(Boolean);
    return fichas.length > 0 && fichas.every((ficha) => FICHA_VACIA.test(ficha));
  });
}

const explicativo = (v) => typeof v === 'string' && v.trim().length >= MIN_TEXT && !esRelleno(v);
const clavesExactas = (v, claves) => esObjeto(v) && Object.keys(v).length === claves.length && claves.every((k) => Object.hasOwn(v, k));

/** Un servicio que declara no tener plan pago no puede inventar un escalón al cual escalar. */
const SIN_PLAN_PAGO = /no (?:existe|hay) (?:ningun |ningún )?plan pago/iu;

/**
 * Todas las violaciones, sin lanzar nunca. Un gate que se salva por una excepción no comprobó nada:
 * quien lo lee no distingue "esto está mal" de "el gate se rompió mirándolo".
 */
export function validateLimits(contrato) {
  if (!esObjeto(contrato)) return [`el contrato de límites debe ser un objeto JSON que declare ${SCHEMA}`];
  // El esquema se mira primero y corta: enumerar campos de un archivo que no es el contrato produce
  // una lista de reproches sobre algo que nunca pretendió serlo.
  if (!mismoSchema(contrato.schema, SCHEMA)) return [`el contrato debe declarar ${SCHEMA}, no ${JSON.stringify(contrato.schema)}`];

  const violaciones = [];
  if (!clavesExactas(contrato, RAIZ_KEYS)) {
    violaciones.push(`el contrato debe declarar exactamente ${RAIZ_KEYS.join(', ')}`);
  }
  if (!explicativo(contrato.why)) violaciones.push('why debe decir para qué existe este contrato');
  if (!explicativo(contrato.method)) violaciones.push('method debe decir cómo se capturaron los números');
  if (!FECHA.test(contrato.revalidated ?? '')) violaciones.push('revalidated debe ser una fecha AAAA-MM-DD');
  const periodo = violacionDePeriodo(contrato.max_age_days);
  if (periodo !== null) violaciones.push(periodo);

  if (!Array.isArray(contrato.services) || contrato.services.length === 0) {
    violaciones.push('services debe ser una lista con al menos un servicio');
    return violaciones;
  }

  const vistos = new Set();
  for (const [indice, servicio] of contrato.services.entries()) {
    const donde = `services[${indice}]`;
    if (!clavesExactas(servicio, SERVICIO_KEYS)) {
      violaciones.push(`${donde} (${esObjeto(servicio) && typeof servicio.service_id === 'string' ? servicio.service_id : 'sin id'}) debe declarar exactamente ${SERVICIO_KEYS.join(', ')}`);
      continue;
    }
    const id = servicio.service_id;
    // `typeof` ANTES del regex: `.test()` coacciona a cadena, así que `true` y `123` pasaban por
    // kebab-case válidos, y `123` y `"123"` contaban como dos servicios distintos con el mismo
    // nombre para un humano. Encontrado por una ronda adversarial.
    if (typeof id !== 'string' || !IDENTIFICADOR.test(id)) {
      violaciones.push(`${donde}.service_id debe ser una cadena en kebab-case: ${JSON.stringify(id)}`);
      continue;
    }
    if (vistos.has(id)) violaciones.push(`services repite el identificador ${id}`);
    else vistos.add(id);

    if (!noVacio(servicio.plan_name)) violaciones.push(`${id}: plan_name debe nombrar el plan`);
    if (!noVacio(servicio.captured_from)) violaciones.push(`${id}: captured_from debe decir de dónde salió el dato`);
    if (!FECHA.test(servicio.captured_at ?? '')) violaciones.push(`${id}: captured_at debe ser una fecha AAAA-MM-DD`);

    // LA INVARIANTE DE FONDO. Un stack recomendado cuyo plan gratuito no dice qué lo rompe es
    // exactamente el agujero que este artefacto viene a hacer visible.
    if (!explicativo(servicio.upgrade_trigger)) {
      violaciones.push(`${id}: upgrade_trigger debe decir QUÉ evento concreto saca del plan gratuito, y casi nunca es un cupo`);
    }
    if (!explicativo(servicio.paid_from)) violaciones.push(`${id}: paid_from debe decir a cuánto sale el primer escalón pago, o declarar que no existe ninguno`);

    const sinPlanPago = SIN_PLAN_PAGO.test(String(servicio.paid_from ?? ''));
    if (!Array.isArray(servicio.escalation)) {
      violaciones.push(`${id}: escalation debe ser una lista`);
    } else if (servicio.escalation.length === 0 && !sinPlanPago) {
      // Una lista vacía se acepta SÓLO si `paid_from` declara que no hay plan pago. Sin esa salida,
      // un servicio gratuito para siempre tenía que inventar un escalón: la regla empujaba una
      // mentira al dato en vez de ponerse roja.
      violaciones.push(`${id}: escalation vacía y paid_from no declara que no existe plan pago. Si de verdad no hay adónde escalar, hay que decirlo ahí con esas palabras`);
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
        // `hard` admite null, y null cubre los DOS motivos por los que un booleano no alcanza: que la
        // fuente no lo verificara, y que el comportamiento dependa de una condición —tener o no medio
        // de pago— que un sí o un no no expresa. Un null MUDO sería el mismo agujero con otro nombre,
        // así que el disparador tiene que nombrarlo.
        if (cupo.hard === null) {
          if (!/\bnull\b/u.test(String(servicio.upgrade_trigger ?? ''))) {
            violaciones.push(`${etiqueta}.hard es null y el upgrade_trigger de ${id} no lo nombra. Un null mudo es una afirmación escondida: hay que decir por qué este cupo no se resuelve en un sí o un no`);
          }
        } else if (typeof cupo.hard !== 'boolean') {
          violaciones.push(`${etiqueta}.hard debe declarar si corta el servicio o factura el excedente, o null si no se resuelve en un sí o un no`);
        }
      }
    }
  }

  return violaciones;
}

/** Los ocho tipos de producto. Están los ocho o no está la matriz: con cuatro filas, las otras
 * cuatro son invisibles y no se distingue «lo miré y no aplica» de «no lo miré». */
export const TIPOS_DE_PRODUCTO = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

/** El único tipo que puede no recomendar nada: `H` es «otro», y por definición todavía no se sabe
 * qué es. Su valor está en obligar a escribir por qué ninguno de los siete alcanza. */
const SIN_RECOMENDACION = 'H';

/**
 * La matriz cubre los ocho tipos y cada servicio que referencia existe en el contrato.
 * `idsDisponibles` se inyecta en vez de leerse para que esta función se pueda falsificar sin tocar
 * el filesystem.
 *
 * POR QUÉ LA EXENCIÓN DE REFERENCIAS ES UN DATO Y NO UNA LISTA DE TIPOS. La versión anterior eximía
 * a `G` y `H` por su código, y una ronda adversarial mostró que eso EMPUJABA MENTIRAS AL DATO: para
 * que el tipo `D` entrara hubo que escribirle a la firma de código un `plan_name` que no es un plan
 * y un `-1` como centinela de «esto no es un número». Una regla que obliga a mentir es peor que una
 * que se pone roja. Ahora cualquier fila puede tener `free_tier_refs` vacía **si dice por qué**, y
 * la lista de tipos exentos desapareció.
 */
export function validateMatrix(matriz, idsDisponibles = new Set()) {
  if (!esObjeto(matriz)) return [`la matriz debe ser un objeto JSON que declare ${MATRIX_SCHEMA}`];
  if (!mismoSchema(matriz.schema, MATRIX_SCHEMA)) return [`la matriz debe declarar ${MATRIX_SCHEMA}, no ${JSON.stringify(matriz.schema)}`];

  const violaciones = [];
  if (!Array.isArray(matriz.rows)) return ['rows debe ser una lista de filas'];

  const porTipo = new Map();
  for (const [indice, f] of matriz.rows.entries()) {
    const donde = `rows[${indice}]`;
    if (!clavesExactas(f, FILA_KEYS)) { violaciones.push(`${donde} debe declarar exactamente ${FILA_KEYS.join(', ')}`); continue; }
    const tipo = f.product_type;
    if (!TIPOS_DE_PRODUCTO.includes(tipo)) { violaciones.push(`${donde}.product_type declara ${JSON.stringify(tipo)}, que no es uno de los ocho códigos`); continue; }
    if (porTipo.has(tipo)) violaciones.push(`el tipo ${tipo} tiene más de una fila: la segunda no agrega cobertura, tapa un tipo que quedó sin ninguna`);
    else porTipo.set(tipo, f);

    if (!noVacio(f.name)) violaciones.push(`${tipo}: name debe nombrar el tipo de producto`);
    // El criterio es lo que hace que la tabla no sea decorativa: una pregunta con respuesta
    // observable, no un adjetivo.
    if (!explicativo(f.decision_criterion)) violaciones.push(`${tipo}: decision_criterion debe ser una pregunta con respuesta observable, no un relleno`);
    if (!Array.isArray(f.alternatives)) violaciones.push(`${tipo}: alternatives debe ser una lista, aunque esté vacía`);
    if (!noVacio(f.red_adapter)) violaciones.push(`${tipo}: red_adapter debe decir cuál le toca, o ninguno con su motivo`);
    // `evidence` pedía sólo ser una lista, así que una lista vacía —o de nulos y ceros— compraba el
    // verde. Una fila sin nada que la respalde es una opinión, no una recomendación.
    if (!Array.isArray(f.evidence) || f.evidence.length === 0) {
      violaciones.push(`${tipo}: evidence debe tener al menos una entrada — una fila sin nada que la respalde es una opinión`);
    } else if (!f.evidence.every((e) => explicativo(e))) {
      violaciones.push(`${tipo}: cada entrada de evidence tiene que decir algo, y una lista de valores vacíos no cuenta`);
    }

    if (tipo === SIN_RECOMENDACION) {
      if (!esObjeto(f.recommended)) violaciones.push(`${tipo}: recommended debe existir aunque declare que no hay recomendación`);
    } else if (!clavesExactas(f.recommended, RECOMENDADO_KEYS) || !explicativo(f.recommended.stack) || !explicativo(f.recommended.why)) {
      violaciones.push(`${tipo}: recommended debe declarar stack y why, y recomendar sin decir por qué es anunciar, no recomendar`);
    }

    if (!Array.isArray(f.free_tier_refs)) {
      violaciones.push(`${tipo}: free_tier_refs debe ser una lista`);
    } else if (f.free_tier_refs.length === 0) {
      if (!explicativo(f.no_free_tier_reason)) {
        violaciones.push(`${tipo}: free_tier_refs vacía y no_free_tier_reason no dice por qué. Hay motivos legítimos —un artefacto que se entrega una vez, un stack que se paga desde el primer día— pero hay que escribirlos, no dejarlos en blanco`);
      }
    } else {
      if (f.no_free_tier_reason !== null) {
        violaciones.push(`${tipo}: declara servicios Y un motivo para no tenerlos. no_free_tier_reason debe ser null cuando free_tier_refs trae algo`);
      }
      for (const ref of f.free_tier_refs) {
        if (!idsDisponibles.has(ref)) violaciones.push(`${tipo}: free_tier_refs nombra ${JSON.stringify(ref)}, que no existe en el contrato de límites: la recomendación queda sin respaldo`);
      }
    }
  }

  for (const tipo of TIPOS_DE_PRODUCTO) {
    if (!porTipo.has(tipo)) violaciones.push(`el tipo de producto ${tipo} no tiene fila: quien lo elija se queda sin respuesta, y el silencio no compra verde`);
  }

  return violaciones;
}

const MS_POR_DIA = 86400000;

/** Una fecha AAAA-MM-DD en milisegundos, o `null` si no es una fecha real. `2026-13-45` y `2026-02-31`
 * parsean con el constructor pero no existen: se compara la forma normalizada contra la escrita. */
function diaEnMs(valor) {
  if (typeof valor !== 'string' || !FECHA.test(valor)) return null;
  const ms = Date.parse(`${valor}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10) === valor ? ms : null;
}

/**
 * La captura de cada servicio está dentro del período que el contrato declara.
 *
 * EL RELOJ SE INYECTA, nunca se lee del sistema acá adentro: una comprobación que mira la hora real
 * no se puede falsificar sin esperar noventa días. Quien llama pasa el día de hoy, **en UTC**.
 *
 * LÍMITE: mide la EDAD DECLARADA, no la vigencia del dato. Un contrato con la fecha de hoy y cifras
 * inventadas sale verde, y uno viejo cuyos números no cambiaron sale rojo igual.
 */
export function validateFreshness(contrato, hoy) {
  if (!esObjeto(contrato)) return ['el contrato de límites debe ser un objeto JSON'];
  const violaciones = [];

  const limite = contrato.max_age_days;
  const periodo = violacionDePeriodo(limite);
  if (periodo !== null) {
    violaciones.push(periodo);
    return violaciones;
  }

  const hoyMs = diaEnMs(hoy);
  if (hoyMs === null) return [...violaciones, `la fecha de referencia ${JSON.stringify(hoy)} no es un día AAAA-MM-DD válido`];

  const servicios = Array.isArray(contrato.services) ? contrato.services : [];
  for (const servicio of servicios) {
    const id = esObjeto(servicio) && noVacio(servicio.service_id) ? servicio.service_id : 'sin id';
    const capturaMs = diaEnMs(esObjeto(servicio) ? servicio.captured_at : null);
    if (capturaMs === null) {
      violaciones.push(`${id}: captured_at ${JSON.stringify(esObjeto(servicio) ? servicio.captured_at : null)} no es un día AAAA-MM-DD válido, así que no se puede fechar el dato`);
      continue;
    }
    if (capturaMs > hoyMs) {
      violaciones.push(`${id}: captured_at es posterior a la fecha de referencia — una captura del futuro es un dato mal escrito, no uno muy fresco. El reloj de este gate es UTC`);
      continue;
    }
    const dias = Math.round((hoyMs - capturaMs) / MS_POR_DIA);
    if (dias > limite) {
      violaciones.push(`${id}: la captura tiene ${dias} dias y el período declarado es ${limite}. La causa del rechazo es la ANTIGÜEDAD y no un defecto del contrato: revalidalo contra la documentación oficial y actualizá captured_at. Un número de plan gratuito vencido se lee como cierto, y por eso no se deja pasar con un aviso.`);
    }
  }

  return violaciones;
}

const CONTRATO_PATH = join('contracts', 'free-tier-limits.json');

/**
 * La raíz del runtime: la carpeta que contiene a `scripts/`, o sea este mismo paquete. Instalada es
 * `<proyecto>/.vibe/ia-stack-runtime`; en el repositorio de VCP coincide con la raíz del proyecto, y **por
 * esa coincidencia el defecto era invisible desde acá**: el contrato se abría relativo al directorio
 * de trabajo y funcionaba, mientras que en un proyecto ajeno el gate no encontraba su propio
 * contrato y rechazaba. Medido sobre una instalación real el 2026-09-14, con la batería en verde.
 * Mismo patrón que `verify-discovery-requirements.mjs`.
 */
const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Los TRES estados de una lectura. Antes eran dos y por eso un archivo corrupto se convertía en
 * silencio: una marca de orden de bytes hace fallar el parseo, y tratar cualquier fallo como
 * ausencia hacía que el gate escribiera VACÍO y saliera 0 sobre un archivo roto. Ausente es un
 * proyecto que todavía no eligió stack; ilegible es un defecto.
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
    return { estado: 'ilegible', motivo: `no es JSON válido (una marca de orden de bytes al principio también rompe el parseo): ${error.message}` };
  }
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const read = options.read ?? ((ruta) => readFileSync(ruta, 'utf8'));
  // El reloj por defecto es UTC, y el mensaje de rechazo lo dice: quien fecha con su día local desde
  // un huso adelantado puede recibir un «captura del futuro» que no es culpa suya.
  const hoy = options.hoy ?? new Date().toISOString().slice(0, 10);

  if (args.length !== 2 || args[0] !== 'check' || !noVacio(args[1])) {
    writeError(USAGE);
    return 2;
  }

  // LAS DOS RUTAS pasan por el resolvedor, no una. La versión anterior protegía la matriz y abría el
  // contrato con la ruta cruda, mientras el comentario prometía la garantía para los dos: una ronda
  // adversarial leyó el contrato desde fuera del proyecto con un enlace de directorio y el gate
  // aprobó. Una garantía que cubre la mitad es peor que ninguna, porque nadie revisa la otra mitad.
  const resolver = options.safePath ?? safeProjectFile;
  const raiz = options.root ?? process.cwd();
  // CADA RUTA SE CONTIENE CONTRA LA RAÍZ QUE LE CORRESPONDE, y son dos raíces distintas.
  //
  // La matriz entra por argumento: es una ruta que provee el proyecto, así que se contiene contra la
  // raíz del PROYECTO. El contrato de límites no lo provee nadie — viaja adentro del runtime, al
  // lado de este mismo archivo — así que se contiene contra la raíz del RUNTIME. La ronda
  // adversarial que motivó esta contención atacaba con un enlace de directorio que redirigía
  // `contracts/` afuera; anclado acá ese enlace tendría que vivir adentro del runtime, y ahí lo
  // corta igual. Lo que NO se puede exigir es que el runtime esté adentro del proyecto: instalado
  // vive en `.vibe/ia-stack-runtime/` y la sonda de carpeta vacía lo corre desde un directorio que no lo
  // contiene. Exigirlo rompía los dos casos legítimos, medido el 2026-09-14.
  const runtimeRoot = options.runtimeRoot ?? RUNTIME_ROOT;
  const nombreContrato = CONTRATO_PATH;
  let rutaMatriz;
  let rutaContrato;
  try {
    rutaMatriz = resolver(raiz, args[1]) ?? args[1];
    rutaContrato = resolver(runtimeRoot, nombreContrato) ?? nombreContrato;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }

  const matrizLeida = leerDocumento(read, rutaMatriz);
  const contratoLeido = leerDocumento(read, rutaContrato);

  for (const [nombre, leida] of [[args[1], matrizLeida], [nombreContrato, contratoLeido]]) {
    if (leida.estado === 'ilegible') {
      writeError(`REJECTED: el archivo ${nombre} existe pero es ilegible: ${leida.motivo}. Un archivo corrupto no es un archivo ausente, así que esto rechaza en vez de escribir ${EMPTY}.`);
      return 1;
    }
  }

  // SIN MATRIZ NO HAY NADA QUE VERIFICAR, haya contrato o no. La versión anterior rechazaba cuando
  // encontraba el contrato sin la matriz, y eso era correcto mientras la matriz fuera un artefacto
  // por proyecto. Desde que el contrato viaja adentro del runtime está presente en toda instalación
  // desde el minuto cero, así que su presencia no dice nada sobre si ESTE proyecto eligió stack:
  // rechazar ahí convertía el estado normal de cualquier instalación nueva en un incumplimiento.
  if (matrizLeida.estado === 'ausente') {
    write(`${EMPTY}: no hay matriz en ${args[1]}. Esto no verificó nada: un proyecto que todavía no eligió stack no incumple nada. El contrato de límites viaja con el gate, así que que esté o no presente no dice nada de este proyecto.`);
    return 0;
  }
  // El mensaje dice «hay un archivo en», no «hay una matriz»: en este punto el gate todavía no miró
  // si ese archivo es una matriz, y afirmarlo desviaba el diagnóstico hacia el archivo equivocado.
  if (contratoLeido.estado === 'ausente') {
    writeError(`REJECTED: hay un archivo en ${args[1]} pero falta ${nombreContrato}: una recomendación sin el contrato de límites no dice qué cuesta crecer. Si el protocolo está instalado, el contrato tiene que estar en la misma carpeta que este gate — un runtime incompleto se reinstala.`);
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

  // Sin guarda a propósito: para llegar acá las dos listas existen, porque `validateLimits` rechaza
  // un contrato cuyos `services` no sean una lista con al menos un servicio y `validateMatrix` corta
  // si `rows` no es una lista. Una guarda defensiva acá sería código muerto.
  const tipos = matriz.rows.length;
  const servicios = contrato.services.length;
  // El mensaje NO dice «con su disparador de escalado»: eso afirmaría que el disparador es correcto,
  // y lo único comprobado es que los cuatro campos están escritos y no son relleno.
  write(`OK: ${tipos} tipo(s) de producto cubierto(s) y ${servicios} servicio(s) con los cuatro campos del disparador escritos, capturados dentro de los ${contrato.max_age_days} dias declarados.`);
  write('LIMITE: verifica que cada campo esté escrito, fechado y que no sea relleno. NUNCA que el número sea cierto ni que siga vigente hoy: no sale a la red, lee los archivos que alguien escribió.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-stack-matrix.mjs')) {
  process.exitCode = main();
}
