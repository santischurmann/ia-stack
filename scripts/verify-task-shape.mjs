#!/usr/bin/env node
// verify-task-shape.mjs — los campos de una tarea que ningún gate leía.
//
// MEDIDO el 2026-09-15. `docs/tasks.json` tiene 20 campos por tarea y sólo dos scripts lo abren:
// `verify-plan-conflicts.mjs` y `verify-scope-diff.mjs`. Entre los dos leen **seis**: `id`,
// `depends_on`, `files_to_create`, `files_to_modify`, `test_files` y `status`. Los otros catorce los
// sostenía la prosa, y una obligación que sólo vive en prosa se cumple mientras alguien se acuerde.
//
// LAS REGLAS NO SE INVENTAN ACÁ. Están escritas en `skills/orchestrator-opus.md` § MINIMAL
// AI-COMPANY TASK MODEL, campo por campo, desde hace meses. Lo que faltaba no era la regla: era que
// algo la leyera. Este gate no agrega doctrina, mecaniza la que ya estaba.
//
// LOS DOS VERDES FALSOS QUE CIERRA, medidos contra el plan real de este repositorio:
//
//   `approval_criteria`. La tabla dice «the spec.md AC-id this task closes, verbatim». **Dos de las
//   seis tareas del plan real no nombraban ningún AC**, y cualquiera podía citar AC9 sobre una spec
//   que llega hasta AC5. Es el puente entre el plan y la spec, y estaba sin comprobar de los dos
//   lados: ni que el AC exista, ni que se nombre alguno.
//
//   `verifier`. La tabla lo define como «the mechanical check ... **never** the role that wrote the
//   artifact being checked», y `templates/tasks.json` lo repite: «not a persona — no role certifies
//   its own gate». Nada impedía escribir ahí el nombre de un rol, que es exactamente la falla.
//
// LO QUE NO HACE, Y POR QUÉ. `depends_on` no se toca: `verify-plan-conflicts.mjs` ya lo valida
// entero, referencias colgantes incluidas, y duplicar un check duplica el lugar donde se rompe.
// `description`, `goal`, `rollback` y `handoff` se exigen escritos y nunca verdaderos: son texto
// para una persona, y pedirle a un gate que juzgue su contenido sería empujar mentiras al dato.
//
// LÍMITE HONESTO. Comprueba forma y coherencia interna, más que cada AC citado exista en la spec.
// **No comprueba que la tarea haga lo que dice**, ni que la evidencia listada sea real —un texto
// inventado con el formato correcto pasa en verde—, ni que el comando de `verifier` sea el adecuado
// para esa tarea: sólo que no sea una persona. Cuando la spec no se puede leer, la parte fuerte del
// check no corre y el gate lo dice en vez de aprobar por defecto.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'usage: verify-task-shape.mjs check <tasks.json>';
export const EMPTY = 'VACÍO';

/** Un campo narrativo tiene que decir algo. Mismo piso que el resto de los gates del protocolo. */
export const MIN_TEXTO = 20;

/** El ciclo de vida, tal cual lo declara la tabla del modelo de tareas. Ni un estado más. */
export const ESTADOS = Object.freeze(['pending', 'red', 'green', 'triangulate', 'refactor', 'done', 'blocked']);

/** Texto para una persona: se exige escrito, jamás verdadero. */
export const NARRATIVOS = Object.freeze(['description', 'goal', 'rollback', 'handoff']);

/**
 * La raíz del runtime: la carpeta que contiene a `scripts/`. Instalada es
 * `<proyecto>/.vibe/ia-stack-runtime`; en este repositorio coincide con la raíz del proyecto. La matriz
 * de capacidades y las skills de subagente viajan con el runtime —`COPIED_DIRECTORIES` de
 * `verify-runtime-sync.mjs` las nombra—, así que se abren desde acá y no desde el directorio de
 * trabajo. Mismo patrón que `verify-stack-matrix.mjs`, y por el mismo defecto que allá costó
 * encontrar: en el repositorio fuente las dos raíces coinciden y el error es invisible.
 */
const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const MATRIZ = 'contracts/capability-matrix.json';
const SKILLS = 'skills';
const SUBAGENTE = /^subagent-([a-z0-9-]+)\.md$/u;
const CRITERIO_LINE = /^[ \t]*[-*+][ \t]+\[[ xX]?\][ \t]*\*\*(AC\d+)\b[^*]*:\*\*/gmu;
const AC_MENCION = /\bAC\d+\b/gu;
const RELLENO = /^(tbd|todo|pendiente|n\/a|na|placeholder|xxx+|-+|\.+)$/iu;

const CLAVES_EVIDENCE = Object.freeze(['gate', 'command', 'output_tail', 'timestamp']);
const CLAVES_NO_REVISADO = Object.freeze(['gate', 'declaration', 'report_path']);

/**
 * Cuál de las claves del objeto es la que le habla a una persona, y por eso tiene que decir algo de
 * verdad. En `evidence` ninguna lo es: `gate`, `command` y `timestamp` son identificadores, y
 * `output_tail` puede ser legítimamente `STATUS: pass`. En `not_reviewed`, `declaration` ES el
 * límite declarado — un `declaration: "corto"` pasaba por tener las tres claves llenas, que es la
 * misma forma vacía que el texto de cinco letras que este gate rechaza.
 */
const NARRATIVA_DE = Object.freeze({ evidence: null, not_reviewed: 'declaration' });

const OBLIGATORIOS = Object.freeze([
  'id', 'status', 'role', 'verifier', 'approval_criteria', 'access_needed',
  'owner', 'locked', 'evidence', 'not_reviewed', 'test_files', 'test_types', 'subagents',
  ...NARRATIVOS,
]);

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;
const explicativo = (v) => noVacio(v) && v.trim().length >= MIN_TEXTO && !RELLENO.test(v.trim());

/** Los AC que la spec DECLARA. Mismo patrón que `verify-evidence-trace.mjs`, que es su dueño. */
export function criteriosDeclarados(fuente) {
  return [...new Set([...String(fuente).matchAll(CRITERIO_LINE)].map((m) => m[1]))];
}

/**
 * Una entrada de lista: o un puntero en texto que una persona abre, o el objeto completo que la
 * tabla del modelo describe. **A medias no**: un objeto con dos de cuatro claves parece estructurado
 * y no lo está, que es peor que un texto honesto.
 */
function entradaValida(e, claves, narrativa) {
  if (typeof e === 'string') return explicativo(e);
  if (!esObjeto(e)) return false;
  if (!claves.every((k) => noVacio(e[k])) || !Object.keys(e).every((k) => claves.includes(k))) return false;
  return narrativa === null || explicativo(e[narrativa]);
}

/**
 * @param tareas la lista `tasks` del plan
 * @param ctx las tres listas, OBLIGATORIAS las tres: `roles` de la matriz, `subagentes` del árbol de
 *   skills, y `criterios` de la spec — un arreglo, o `null` cuando la spec no se pudo leer, que NO es
 *   lo mismo que una spec leída que no declara ninguno. Sin valores por defecto a propósito: `main`
 *   arma las tres o rechaza antes, así que un `?? []` acá nunca correría y sólo escondería que esta
 *   función no puede comprobar nada sin ellas.
 */
export function validarTareas(tareas, ctx) {
  if (!Array.isArray(tareas)) return ['tasks debe ser una lista de tareas'];

  const roles = new Set(ctx.roles.map((r) => String(r).toLowerCase()));
  const subagentes = new Set(ctx.subagentes);
  const criterios = ctx.criterios === null ? null : new Set(ctx.criterios);

  const violaciones = [];
  const vistos = new Map();

  for (const [indice, t] of tareas.entries()) {
    const posicion = `tasks[${indice}]`;
    if (!esObjeto(t)) {
      violaciones.push(`${posicion} debe ser un objeto`);
      continue;
    }

    const donde = noVacio(t.id) ? `${posicion} (${t.id})` : posicion;
    const faltantes = OBLIGATORIOS.filter((k) => !Object.hasOwn(t, k));
    if (faltantes.length > 0) {
      // Un campo ausente NO se toma por vacío: se nombra. Confundirlos convierte un plan a medio
      // escribir en un plan que cumple una regla que nadie escribió.
      violaciones.push(`${donde} no declara ${faltantes.join(', ')}: el modelo de tareas de skills/orchestrator-opus.md los pide todos`);
      continue;
    }

    if (!noVacio(t.id)) {
      violaciones.push(`${posicion}.id debe nombrar la tarea para poder señalarla después`);
    } else if (vistos.has(t.id)) {
      violaciones.push(`${posicion}.id repite ${JSON.stringify(t.id)}, que ya usa ${vistos.get(t.id)}: con ids repetidos no se puede señalar una tarea concreta`);
    } else {
      vistos.set(t.id, posicion);
    }

    if (!ESTADOS.includes(t.status)) {
      violaciones.push(`${donde}.status debe ser uno de ${ESTADOS.join('→')}, no ${JSON.stringify(t.status)}`);
    }

    // BLOQUEADA SIN MOTIVO ES UNA TAREA PERDIDA. Y un motivo en una tarea que no está bloqueada es
    // un resto de otro momento que se lee como si fuera de éste.
    const motivo = noVacio(t.blocked_reason);
    if (t.status === 'blocked' && !explicativo(t.blocked_reason)) {
      violaciones.push(`${donde}.blocked_reason debe decir por qué está bloqueada, con al menos ${MIN_TEXTO} caracteres: una tarea frenada sin motivo escrito es una tarea perdida`);
    } else if (t.status !== 'blocked' && motivo) {
      violaciones.push(`${donde}.blocked_reason dice ${JSON.stringify(String(t.blocked_reason).slice(0, 40))} y el estado es ${JSON.stringify(t.status)}: un motivo viejo se lee como si fuera de ahora`);
    }

    // EL ROL, CONTRA LA MATRIZ. La tabla nombra personas en mayúscula y los planes reales las
    // escriben en minúscula: es el mismo rol, así que la comparación ignora la caja.
    if (!roles.has(String(t.role ?? '').toLowerCase())) {
      violaciones.push(`${donde}.role dice ${JSON.stringify(t.role)} y ${MATRIZ} no declara ese rol: un permiso que nadie definió no se puede comprobar`);
    }

    // EL VERIFICADOR ES UN COMANDO, NUNCA UNA PERSONA. Es la regla que sostiene «ningún rol
    // certifica su propio gate», y vivía sólo en prosa.
    if (!noVacio(t.verifier)) {
      violaciones.push(`${donde}.verifier debe decir con qué comando se certifica esta tarea`);
    } else if (roles.has(String(t.verifier).trim().toLowerCase())) {
      violaciones.push(`${donde}.verifier dice ${JSON.stringify(t.verifier)}, que es una persona y no un comando: el modelo de tareas exige una comprobación mecánica, «never the role that wrote the artifact being checked»`);
    }

    // EL PUENTE CON LA SPEC, de los dos lados: que nombre un AC, y que ese AC exista.
    if (!explicativo(t.approval_criteria)) {
      violaciones.push(`${donde}.approval_criteria debe decir qué criterio de la spec cierra esta tarea, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
    } else if (criterios !== null) {
      const citados = [...new Set(String(t.approval_criteria).match(AC_MENCION) ?? [])];
      const inexistentes = citados.filter((ac) => !criterios.has(ac));
      if (citados.length === 0) {
        violaciones.push(`${donde}.approval_criteria no nombra ningún AC de la spec: «${String(t.approval_criteria).slice(0, 60)}…» suena a criterio pero no es trazable a nada. La spec declara ${[...criterios].join(', ') || 'ninguno'}`);
      } else if (inexistentes.length > 0) {
        violaciones.push(`${donde}.approval_criteria nombra ${inexistentes.join(', ')} y la spec no lo declara. Declara ${[...criterios].join(', ') || 'ninguno'}`);
      }
    }

    // EL ACCESO, mudado desde `implementation.json`. Saber que falta una credencial frena antes de
    // empezar, no a la mitad.
    if (!noVacio(t.access_needed) || RELLENO.test(String(t.access_needed).trim())) {
      violaciones.push(`${donde}.access_needed debe decir qué acceso necesita esta tarea, o «ninguno» si no necesita ninguno`);
    }

    // `locked` ES UN BOOLEANO. Encontrado revisando el gate contra si mismo: `locked: "yes"` no es
    // `=== true`, asi que la tarea quedaba sin candado Y sin exigencia de dueno — una cadena que
    // parece decir que si, tratada como un no.
    if (typeof t.locked !== 'boolean') {
      violaciones.push(`${donde}.locked debe ser true o false, no ${JSON.stringify(t.locked)}: cualquier otra cosa se parece a un candado sin serlo`);
    } else if (t.locked && !noVacio(t.owner)) {
      violaciones.push(`${donde}.owner está vacío y locked es true: un candado sin dueño no lo puede soltar nadie`);
    }

    // LAS DOS LISTAS QUE NADIE MAS MIRA. `verify-plan-conflicts.mjs` ya exige que `files_to_*` y
    // `test_files` sean listas; `subagents` y `test_types` no los mira ningun otro gate, y recorrer
    // con `for...of` una cadena que llego donde iba una lista escupe una violacion por letra.
    for (const campo of ['subagents', 'test_types']) {
      if (!Array.isArray(t[campo])) violaciones.push(`${donde}.${campo} debe ser una lista, aunque esté vacía`);
    }

    if (Array.isArray(t.subagents)) {
      for (const nombre of t.subagents) {
        if (!subagentes.has(nombre)) {
          violaciones.push(`${donde}.subagents nombra ${JSON.stringify(nombre)} y no existe ${SKILLS}/subagent-${nombre}.md: es una instrucción a un rol que nadie definió`);
        }
      }
    }

    // MEDIA DECLARACIÓN. Archivos de prueba sin decir de qué tipo son, o tipos sin archivos.
    const conArchivos = Array.isArray(t.test_files) && t.test_files.length > 0;
    const conTipos = Array.isArray(t.test_types) && t.test_types.length > 0;
    if (conArchivos && !conTipos) {
      violaciones.push(`${donde}.test_types está vacío y hay ${t.test_files.length} archivo(s) de prueba: decir cuáles sin decir qué prueban es media declaración`);
    } else if (conTipos && !conArchivos) {
      violaciones.push(`${donde}.test_files está vacío y test_types declara ${t.test_types.join(', ')}: un tipo de prueba sin archivo es una intención`);
    }

    for (const [campo, claves] of [['evidence', CLAVES_EVIDENCE], ['not_reviewed', CLAVES_NO_REVISADO]]) {
      if (!Array.isArray(t[campo])) {
        violaciones.push(`${donde}.${campo} debe ser una lista, aunque esté vacía: una lista vacía dice «todavía nada», y eso es una afirmación`);
        continue;
      }
      for (const [i, e] of t[campo].entries()) {
        if (!entradaValida(e, claves, NARRATIVA_DE[campo])) {
          violaciones.push(`${donde}.${campo}[${i}] debe ser un texto de al menos ${MIN_TEXTO} caracteres, o un objeto con ${claves.join(', ')} completo: a medias parece estructurado y no lo está`);
        }
      }
    }

    // TERMINADA SIN EVIDENCIA NO ES TERMINADA. El gate no sabe si la evidencia es cierta; sí sabe
    // que no haya ninguna.
    if (t.status === 'done' && Array.isArray(t.evidence) && t.evidence.length === 0) {
      violaciones.push(`${donde}.evidence está vacío y el estado es done: una tarea hecha sin nada que mostrar no se puede revisar`);
    }

    for (const campo of NARRATIVOS) {
      if (!explicativo(t[campo])) {
        violaciones.push(`${donde}.${campo} debe decir algo, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
      }
    }
  }

  return violaciones;
}

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== 'check' || !noVacio(args[1])) return null;
  return { ruta: args[1] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }

  const cwd = options.cwd ?? '.';
  const runtimeRoot = options.runtimeRoot ?? RUNTIME_ROOT;
  // `leer` es inyectable, asi que por aca puede llegar cualquier cosa lanzada y no solo un Error de
  // Node: el `?? error` de mas abajo existe por eso, y hay una prueba que lanza una cadena pelada.
  const leer = options.leer ?? ((ruta) => JSON.parse(readFileSync(join(cwd, ruta), 'utf8')));

  let doc;
  try {
    doc = leer(parsed.ruta);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      write(`${EMPTY}: no hay plan en ${parsed.ruta}. Esto no verificó nada: un ciclo sin plan todavía no incumple el modelo de tareas, pero tampoco lo cumple.`);
      return 0;
    }
    writeError(`REJECTED: ${parsed.ruta} existe pero no se puede leer: ${error?.message ?? error}. Un archivo corrupto no es un archivo ausente.`);
    return 1;
  }

  if (!esObjeto(doc) || !Array.isArray(doc.tasks)) {
    writeError(`REJECTED: ${parsed.ruta} debe ser un objeto con una lista tasks`);
    return 1;
  }

  // La matriz y las skills viajan con el runtime; la spec es del proyecto. Cada una desde su raíz.
  let roles = [];
  try {
    // Sin `?? []`: una matriz sin la clave `roles` es una matriz rota, y taparlo la convertiria en
    // «ningun rol existe» — un rechazo que culpa al plan por un defecto del runtime. Asi tira, y el
    // catch de abajo dice donde estaba el problema de verdad.
    roles = JSON.parse(readFileSync(join(runtimeRoot, MATRIZ), 'utf8')).roles.map((r) => r.id);
  } catch (error) {
    writeError(`REJECTED: no se puede leer ${MATRIZ} del runtime (${runtimeRoot}): ${error.message}. Sin la matriz no se puede comprobar ningún rol, y aprobar sin comprobar sería peor que rechazar.`);
    return 1;
  }

  let subagentes = [];
  try {
    subagentes = readdirSync(join(runtimeRoot, SKILLS))
      .map((n) => SUBAGENTE.exec(n)?.[1])
      .filter(Boolean);
  } catch (error) {
    writeError(`REJECTED: no se puede listar ${SKILLS}/ del runtime (${runtimeRoot}): ${error.message}.`);
    return 1;
  }

  // LA SPEC PUEDE NO ESTAR, Y ESO NO APRUEBA NADA. `null` es «no sé qué criterios declara», distinto
  // de una spec leída que no declara ninguno.
  const rutaSpec = noVacio(doc.spec) ? doc.spec : 'docs/spec.md';
  let criterios = null;
  try {
    criterios = criteriosDeclarados(readFileSync(join(cwd, rutaSpec), 'utf8'));
  } catch {
    criterios = null;
  }

  const violaciones = validarTareas(doc.tasks, { roles, subagentes, criterios });
  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${parsed.ruta}: ${v}`);
    return 1;
  }

  const contraSpec = criterios === null
    ? `sin ${rutaSpec} legible: NO se comprobó que los AC citados existan`
    : `contra los ${criterios.length} criterio(s) de ${rutaSpec}`;
  write(`OK: ${doc.tasks.length} tarea(s) cumplen el modelo de tareas, ${contraSpec}. Ningún verifier es una persona y ningún subagente nombrado deja de existir.`);
  write('LIMITE: comprueba forma, coherencia interna y que cada AC citado exista en la spec. NO comprueba que la tarea haga lo que dice, ni que la evidencia listada sea real —un texto inventado con el formato correcto pasa en verde—, ni que el comando de verifier sea el adecuado para esa tarea: sólo que no sea una persona. depends_on no se revisa acá: lo valida entero verify-plan-conflicts.mjs.');
  return 0;
}

// `process.exitCode` y no `process.exit()`: el segundo mata el proceso en el acto, y las dos pruebas
// de arranque importan este archivo con un argv fabricado para cubrir las dos ramas de este guard.
if (process.argv[1] && process.argv[1].endsWith('verify-task-shape.mjs')) {
  process.exitCode = main();
}
