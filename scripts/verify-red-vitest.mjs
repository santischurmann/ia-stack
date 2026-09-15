#!/usr/bin/env node
// verify-red-vitest.mjs — adaptador de test rojo para vitest. GARANTÍA MENOR, y está declarado.
//
// MEDIDO DOS VECES, la segunda en un proyecto nuevo con `vitest@5.0.0` como única dependencia y sin
// configuración previa. Las dos corridas coinciden. La tabla completa está en
// `research/sources/adaptadores-red-2026-09-14.md`.
//
//   Falla un assert   → exit 1, 1 assertionResult failed, message "", prefijo `AssertionError:`
//   throw de otra cosa→ exit 1, 1 assertionResult failed, message "", prefijo `TypeError:`
//   error de hook     → exit 1, 1 assertionResult failed, message "", prefijo `Error:`
//   error de import   → exit 1, assertionResults VACÍO, numTotalTests 0, message lleno
//   archivo sin suite → exit 1, ídem
//   cero archivos     → exit 1, testResults vacío
//
// EL DISCRIMINADOR ES ESTRUCTURAL, y hay que subrayar por qué importa: el JSON de vitest **no tiene**
// la separación `failures` contra `errors` que sí tiene el JUnit de pytest. Lo único estructural
// disponible es que un error de carga deja `assertionResults` VACÍO y llena `testResults[].message`,
// mientras que en un fallo genuino `message` es exactamente la cadena vacía.
//
// LO QUE EL JSON NO DISTINGUE: un error de hook de un fallo de aserción. Los dos quedan como un
// `assertionResult` con `status:"failed"`, y sólo el prefijo del string los separa. Ese prefijo sale
// de `err.stack`, o sea de `error.name`, que es ESCRIBIBLE.
//
// POR QUÉ NO SE USA EL REPORTER `junit`, que traería un atributo `type` más limpio que el prefijo:
// para un error de import y para un archivo vacío **sintetiza un `<testcase>` falso con `tests="1"`**,
// o sea miente sobre cuántas pruebas corrieron. Un reporte que miente en el conteo no sirve de fuente
// primaria; a lo sumo serviría de cruce, y los dos salen de `error.name` igual.
//
// POR QUÉ SIEMPRE `--outputFile`: desde v4 el reporter `json` ya no escribe a la salida estándar —
// por stdout sale `JSON report written to <ruta>`. Se puede forzar stdout con la opción `stdout: true`
// del reporter, y NO hay que hacerlo: en la misma corrida se comprobó que un `process.stdout.write()`
// desde adentro de una prueba llega crudo a stdout, así que mezclar el JSON con stdout reabre la
// falsificación por intercalado.
//
// LÍMITE HONESTO. Prueba que vitest escribió un reporte JSON donde un archivo sin error de carga
// registró un `assertionResult` con `status:"failed"` cuyo error se llama `AssertionError`, en una
// línea del proyecto que contiene una aserción. **NO prueba que la aserción sea genuina**:
// `failureMessages` es literalmente `err.stack` y `Error.prototype.name` es escribible, así que un
// `new Error(...)` con `e.name = 'AssertionError'` lanzado desde un `test()` real reproduce la forma
// exacta (falsificado). Y a diferencia del adaptador nativo, **vitest carga `vitest.config.js` del
// proyecto**, que es código arbitrario: un `globalSetup` cuyo teardown corre después del reporter
// puede reescribir el `--outputFile` y fijar `process.exitCode = 1` con cero pruebas fallando
// (falsificado, y reproducido en entorno virgen). `--config` apuntando a un archivo neutral cierra
// el vector pero deja al proyecto sin sus alias, sus `setupFiles` y su `environment`, así que no es
// usable como default. La brecha residual es de protocolo y revisión, no técnica.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { isContainedProjectPath } from './verify-red-node.mjs';

export const USAGE = 'usage: verify-red-vitest.mjs check --test <project-relative-test-file> --command "vitest"';
export const COMANDO = 'vitest';

/** `AssertionError: ...` — el prefijo es lo único que separa un assert de un error de hook. */
export const PREFIJO_ESPERADO = 'AssertionError';

/** Una aserción, en las formas que vitest y el ecosistema producen. */
const FORMA_DE_ASERCION = /\b(expect|assert|should)\b/u;

const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;

/** Clasifica el reporte JSON por ESTRUCTURA. Ver el comentario de arriba sobre por qué es la única. */
export function clasificarReporte(bruto) {
  if (bruto === null || bruto === undefined) return { clase: 'ausente' };
  let json;
  try {
    json = JSON.parse(String(bruto));
  } catch (error) {
    return { clase: 'ilegible', motivo: error.message };
  }
  if (typeof json !== 'object' || json === null) return { clase: 'ilegible', motivo: 'el reporte no es un objeto' };

  const archivos = Array.isArray(json.testResults) ? json.testResults : [];
  if (archivos.length === 0) return { clase: 'sin-pruebas', total: json.numTotalTests ?? 0 };

  const conCarga = archivos.find((f) => (f?.assertionResults ?? []).length === 0 && noVacio(f?.message));
  if (conCarga) return { clase: 'error-de-carga', archivo: conCarga.name, mensaje: String(conCarga.message).split('\n')[0] };

  const aserciones = archivos.flatMap((f) => f?.assertionResults ?? []);
  if (aserciones.length === 0) return { clase: 'sin-pruebas', total: json.numTotalTests ?? 0 };

  const falladas = aserciones.filter((a) => a?.status === 'failed');
  if (falladas.length === 0) return { clase: 'sin-fallo', total: aserciones.length };

  const primera = falladas[0];
  const mensaje = String((primera.failureMessages ?? [])[0] ?? '');
  return {
    clase: 'fallo',
    total: json.numTotalTests ?? aserciones.length,
    falladas: falladas.length,
    nombreDelError: mensaje.split(':')[0].trim(),
    mensaje,
  };
}

/** La primera referencia `archivo:línea:columna` del stack, que es donde vitest señala el fallo. */
export function ubicacionDelStack(mensaje) {
  const m = /at\s+(?:.*?\()?([^\s()]+?):(\d+):(\d+)\)?/u.exec(String(mensaje ?? ''));
  return m ? { archivo: m[1], linea: Number(m[2]) } : null;
}

/** La ruta que entra por la linea de comandos: relativa al proyecto, literal, y adentro. */
// Sin valor por defecto para `contenida`: main siempre lo pasa, asi que un default aca seria
// codigo muerto. El default vive en main, que es donde de verdad puede faltar.
function rutaDeProyecto(ruta, cwd, contenida) {
  if (!noVacio(ruta) || isAbsolute(ruta)) return null;
  const normal = String(ruta).replaceAll('\\', '/');
  if (normal.split('/').includes('..')) return null;
  // LA CONTENCION ES LA DEL PROTOCOLO, no una propia. `isContainedProjectPath` resuelve con
  // `realpath`, asi que corta tambien un enlace simbolico adentro del proyecto que apunte afuera y
  // un enlace colgado: dos casos que una comparacion textual de rutas deja pasar. La primera
  // version de esta funcion comparaba texto, y el gate de cobertura mostro que su guarda de
  // contencion era INALCANZABLE, o sea que no comprobaba nada. Escribir una segunda
  // implementacion mas debil al lado de una ya endurecida es como se abren los agujeros.
  if (!contenida(normal, cwd)) return null;
  return normal;
}

/**
 * La ruta que viene ADENTRO DEL REPORTE, que es otra cosa: **vitest la informa ABSOLUTA**, a
 * diferencia de pytest, que la informa relativa al rootdir. Encontrado corriendo el adaptador contra
 * vitest de verdad, con la bateria entera en verde: los fixtures se habian escrito desde la ficha de
 * research, que cita rutas cortas, asi que el caso genuino salia RECHAZADO — un falso negativo
 * exactamente sobre el rojo que habia que aprobar.
 *
 * Devuelve siempre la forma relativa al proyecto: una ruta absoluta impresa en el mensaje lleva
 * adentro el nombre de usuario de quien corrio, y ese mensaje termina en registros de integracion
 * continua que suelen ser publicos.
 */
export function ubicacionADentroDelProyecto(ruta, cwd, contenida = isContainedProjectPath) {
  if (!noVacio(ruta)) return null;
  const normal = String(ruta).replaceAll('\\', '/');
  if (!isAbsolute(normal)) return rutaDeProyecto(normal, cwd, contenida);
  const dentro = relative(resolve(cwd), resolve(normal));
  if (dentro === '' || dentro.startsWith('..') || isAbsolute(dentro)) return null;
  return dentro.replaceAll('\\', '/');
}

function parseArgs(args) {
  if (args.length !== 5 || args[0] !== 'check' || args[1] !== '--test' || args[3] !== '--command') return null;
  if (!noVacio(args[2]) || !noVacio(args[4])) return null;
  return { testPath: args[2], command: args[4] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;

  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  if (parsed.command !== COMANDO) {
    writeError(`REJECTED: este adaptador verifica el comando exacto ${JSON.stringify(COMANDO)} y recibió ${JSON.stringify(parsed.command)}. Las opciones cambian la forma del reporte, así que un comando parecido se clasifica con el parser equivocado.`);
    return 1;
  }

  const cwd = options.cwd ?? '.';
  // Inyectable para poder probar la clasificacion sin montar un arbol real en disco; el valor por
  // defecto es la contencion endurecida del protocolo, que resuelve con realpath.
  const contenida = options.contenida ?? isContainedProjectPath;
  const normal = rutaDeProyecto(parsed.testPath, cwd, contenida);
  if (!normal) {
    writeError(`REJECTED: la ruta de prueba ${JSON.stringify(parsed.testPath)} tiene que ser relativa al proyecto, literal, y quedar adentro de él.`);
    return 1;
  }

  const existe = options.existe ?? existsSync;
  if (!existe(join(cwd, normal))) {
    writeError(`REJECTED: el archivo de prueba no existe: ${normal}`);
    return 1;
  }

  const binario = options.binario ?? join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
  if (!existe(binario)) {
    writeError(`REJECTED: vitest no está instalado en este proyecto (no se encontró ${binario}). Esto NO es un veredicto sobre el test rojo — es que el adaptador no pudo medir. Instalá vitest, o corré el runner que tengas declarado.`);
    return 1;
  }

  // El reporte va FUERA del proyecto: así no ensucia el árbol que el protocolo sella.
  const destino = options.destino ?? join(tmpdir(), `vcp-red-vitest-${process.pid}-${Date.now()}.json`);
  const run = options.run ?? spawnSync;
  const argumentos = [
    binario, 'run',
    '--root', '.',
    '--reporter=json',
    `--outputFile=${destino}`,
    normal,
  ];
  const resultado = run(process.execPath, argumentos, { cwd, encoding: 'utf8' });

  const leerReporte = options.leerReporte ?? ((ruta) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : null));
  const limpiar = options.limpiar ?? ((ruta) => rmSync(ruta, { force: true }));
  let bruto = null;
  try {
    bruto = leerReporte(destino);
  } finally {
    limpiar(destino);
  }

  if (resultado?.error) {
    writeError(`REJECTED: no se pudo lanzar vitest: ${resultado.error.message}. Esto NO es un veredicto sobre el test rojo.`);
    return 1;
  }

  const c = clasificarReporte(bruto);

  if (c.clase === 'ausente') {
    writeError(`REJECTED: vitest terminó con código ${resultado?.status} y el reporte JSON no se escribió en el archivo pedido. Sin reporte no hay veredicto. Recordá que desde v4 el reporter json NO escribe a la salida estándar, así que \`--outputFile\` es la única vía.`);
    return 1;
  }
  if (c.clase === 'ilegible') {
    writeError(`REJECTED: el reporte existe pero no se puede leer: ${c.motivo}. Un reporte corrupto no es un reporte ausente, y ninguno de los dos es un rojo.`);
    return 1;
  }
  if (c.clase === 'error-de-carga') {
    writeError(`REJECTED: ${c.archivo ?? normal} no llegó a ejecutar ninguna prueba: ${c.mensaje}. Un error de import o un archivo sin suite deja \`assertionResults\` vacío con \`message\` lleno — es un archivo que no corrió, no una aserción que falló.`);
    return 1;
  }
  if (c.clase === 'sin-pruebas') {
    writeError(`REJECTED: vitest no registró ninguna prueba para ${normal} (numTotalTests=${c.total}). Ojo: vitest no tiene el código de salida 5 de pytest y sale 1 igual, así que esto se detecta en el JSON y nunca por el exit code.`);
    return 1;
  }
  if (c.clase === 'sin-fallo') {
    writeError(`REJECTED: vitest corrió ${c.total} aserción(es) y ninguna falló. Sin rojo visible no hay implementación (LAW 1).`);
    return 1;
  }

  if (c.nombreDelError !== PREFIJO_ESPERADO) {
    writeError(`REJECTED: la prueba falló con ${JSON.stringify(c.nombreDelError)}, no con ${PREFIJO_ESPERADO}. El JSON de vitest NO distingue un error de hook de un fallo de aserción —los dos quedan como un assertionResult failed— y el prefijo del mensaje es lo único que los separa.`);
    return 1;
  }

  const ubicacion = ubicacionDelStack(c.mensaje);
  if (!ubicacion) {
    writeError(`REJECTED: el mensaje de fallo no trae una ubicación \`archivo:línea:columna\` que se pueda comprobar contra el fuente: ${JSON.stringify(c.mensaje.split('\n')[0])}.`);
    return 1;
  }

  const archivo = ubicacionADentroDelProyecto(ubicacion.archivo, cwd, contenida);
  if (!archivo) {
    writeError(`REJECTED: el reporte señala ${JSON.stringify(ubicacion.archivo)}, que no es una ruta contenida en el proyecto. Un fallo que apunta afuera del árbol no se puede comprobar contra el fuente.`);
    return 1;
  }

  const read = options.read ?? ((ruta) => readFileSync(ruta, 'utf8'));
  let fuente;
  try {
    fuente = read(join(cwd, archivo), 'utf8');
  } catch (error) {
    writeError(`REJECTED: el reporte señala ${archivo} y ese archivo no se puede leer: ${error?.message ?? error}.`);
    return 1;
  }

  const lineas = String(fuente).split('\n');
  const linea = lineas[ubicacion.linea - 1];
  if (linea === undefined) {
    writeError(`REJECTED: el reporte señala ${archivo}:${ubicacion.linea} y ese archivo tiene ${lineas.length} línea(s). El fallo apunta a una línea que no existe.`);
    return 1;
  }
  if (!FORMA_DE_ASERCION.test(linea)) {
    writeError(`REJECTED: el reporte informa AssertionError en ${archivo}:${ubicacion.linea}, y esa línea del fuente no contiene ninguna aserción (\`expect\`, \`assert\` o \`should\`). O el reporte está forjado, o señala la línea equivocada; en los dos casos no hay evidencia de una aserción que falló.`);
    return 1;
  }

  write(`OK: vitest registró ${c.falladas} aserción(es) fallada(s) con AssertionError en ${archivo}:${ubicacion.linea}, y esa línea del fuente contiene una aserción. Pruebas totales en el reporte: ${c.total}.`);
  write('ATENCION — GARANTIA MENOR: este verde NO equivale al del adaptador nativo de Node.');
  write('LIMITE: prueba que vitest escribió un reporte con esa forma. NO prueba que la aserción sea genuina: `failureMessages` es literalmente `err.stack` y `Error.prototype.name` es escribible, así que un `new Error(...)` con `e.name = "AssertionError"` lanzado desde un `test()` real reproduce la forma exacta (falsificado). Y a diferencia del adaptador nativo, vitest carga `vitest.config.js` del proyecto, que es código arbitrario: un `globalSetup` cuyo teardown corre después del reporter puede reescribir el `--outputFile` y fijar `process.exitCode` con cero pruebas fallando (falsificado, reproducido también en entorno virgen). `--config` apuntando a un archivo neutral cierra ese vector y deja al proyecto sin sus alias, sus `setupFiles` y su `environment`, así que no es un default usable: la brecha es de protocolo y revisión, no técnica.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-red-vitest.mjs')) {
  process.exitCode = main();
}
