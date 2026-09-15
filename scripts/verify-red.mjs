#!/usr/bin/env node
// verify-red.mjs — el despachador de test rojo: resuelve el runner declarado, y no adivina nunca.
//
// EL PROBLEMA QUE RESUELVE. `verify-red-node.mjs` rechaza cualquier comando que no sea exactamente
// `node --test`, así que hasta hoy **un proyecto Python no podía pasar LAW 1**: sin test rojo
// verificable no hay implementación permitida, y no había forma de verificar uno. Abrir la puerta a
// más runners es necesario, y es justo donde aparece la tentación de adivinar — ver `pytest` adentro
// del comando y suponer el adaptador. Adivinar acá significa clasificar la salida de un runner con
// el parser de otro, y un rojo mal clasificado es un verde disfrazado.
//
// POR ESO NO INFIERE NADA. El comando se resuelve contra `contracts/red-adapters.json` por IGUALDAD
// EXACTA. `pytest` declarado no habilita `pytest -q`: las opciones cambian el reporte, y el
// adaptador depende de la forma del reporte. Lo que no está declarado se rechaza nombrándolo y
// listando lo que sí existe, para que quien lo corre sepa qué escribir en vez de adivinar.
//
// CADA ADAPTADOR DECLARA SU GARANTÍA, y no son iguales. El nativo de Node es `fuerte`: el único
// código del proyecto que corre es el archivo de prueba, adentro del marco TAP del harness. pytest y
// vitest son `menor`, porque los dos ejecutan código de configuración del proyecto —`conftest.py`,
// `vitest.config.js`— con control sobre el pipeline de reporte **y sobre el código de salida**. Los
// dos ataques están falsificados y medidos, incluso en entorno virgen, en
// `research/sources/adaptadores-red-2026-09-14.md`. Un verde de garantía menor **no se imprime igual
// que uno fuerte**: sale con su límite escrito al lado, porque si se lee igual, es igual.
//
// LÍMITE HONESTO. Este despachador verifica QUÉ adaptador corresponde y lo lanza; **no verifica lo
// que el adaptador concluye**. Si el adaptador miente, el despachador propaga la mentira con su
// etiqueta de garantía puesta. Tampoco valida que el comando declarado sea el que el proyecto
// realmente usa para sus pruebas: alguien puede declarar `node --test` y correr otra cosa.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'vcp.red-adapters/1';
export const USAGE = 'usage: verify-red.mjs check --test <project-relative-test-file> --command "<runner>"';

/** Dos garantías y no tres: una intermedia sería el cajón donde va a parar lo que no se quiso medir. */
export const GARANTIAS = Object.freeze(new Set(['fuerte', 'menor']));

export const MIN_TEXTO = 20;

const CONTRATO_PATH = join('contracts', 'red-adapters.json');

/**
 * La raíz del runtime: la carpeta que contiene a `scripts/`. El contrato viaja CON el gate, así que
 * se busca desde acá y no desde donde alguien paró la terminal — instalado, el runtime vive en
 * `.vibe/vcp-runtime/` y una ruta relativa al directorio de trabajo no existe. Medido el 2026-09-14
 * sobre una instalación real, con la batería entera en verde.
 */
const RUNTIME_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const RELLENO = /^(tbd|todo|pendiente|n\/a|na|placeholder|xxx+|-+|\.+)$/iu;
const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;
const explicativo = (v) => noVacio(v) && v.trim().length >= MIN_TEXTO && !RELLENO.test(v.trim());

const CONTRATO_KEYS = Object.freeze(['schema', 'why', 'adapters']);
const ADAPTADOR_KEYS = Object.freeze(['command', 'script', 'guarantee', 'why', 'limit']);

const clavesExactas = (v, claves) => esObjeto(v)
  && Object.keys(v).length === claves.length
  && claves.every((k) => Object.hasOwn(v, k));

export function validarContrato(contrato) {
  if (!esObjeto(contrato)) return ['el contrato debe ser un objeto'];
  if (contrato.schema !== SCHEMA) return [`el contrato debe declarar schema ${SCHEMA}, no ${JSON.stringify(contrato.schema)}`];
  if (!clavesExactas(contrato, CONTRATO_KEYS)) return [`el contrato debe declarar exactamente ${CONTRATO_KEYS.join(', ')}`];

  const violaciones = [];
  if (!explicativo(contrato.why)) violaciones.push(`why debe explicar para qué existe la lista, con al menos ${MIN_TEXTO} caracteres`);
  if (!Array.isArray(contrato.adapters)) {
    violaciones.push('adapters debe ser una lista de adaptadores declarados');
    return violaciones;
  }
  if (contrato.adapters.length === 0) {
    violaciones.push('adapters debe declarar al menos un adaptador: una lista vacía deja al protocolo sin forma de verificar un test rojo');
    return violaciones;
  }

  const vistos = new Map();
  for (const [indice, a] of contrato.adapters.entries()) {
    const donde = `adapters[${indice}]`;
    if (!clavesExactas(a, ADAPTADOR_KEYS)) {
      violaciones.push(`${donde} debe declarar exactamente ${ADAPTADOR_KEYS.join(', ')}`);
      continue;
    }
    if (!noVacio(a.command)) violaciones.push(`${donde}.command debe ser el comando exacto que el proyecto corre`);
    // El script tiene que ser un adaptador y no cualquier ruta: esto se lanza con node.
    if (!/^verify-red-[a-z0-9-]+\.mjs$/u.test(String(a.script ?? ''))) {
      violaciones.push(`${donde}.script debe nombrar un archivo verify-red-<runner>.mjs de scripts/, no ${JSON.stringify(a.script)}`);
    }
    if (!GARANTIAS.has(a.guarantee)) {
      violaciones.push(`${donde}.guarantee debe ser una de ${[...GARANTIAS].join('/')}, no ${JSON.stringify(a.guarantee)}`);
    }
    if (!explicativo(a.why)) violaciones.push(`${donde}.why debe decir por qué la garantía es esa, con al menos ${MIN_TEXTO} caracteres y sin relleno`);
    if (!explicativo(a.limit)) violaciones.push(`${donde}.limit debe decir qué NO prueba este adaptador, con al menos ${MIN_TEXTO} caracteres y sin relleno`);

    if (noVacio(a.command)) {
      if (vistos.has(a.command)) {
        violaciones.push(`${donde}.command está repetido: ${JSON.stringify(a.command)} ya lo declara adapters[${vistos.get(a.command)}]. Con dos filas para el mismo comando, cuál corre depende del orden del archivo, y el accidente puede elegir el de garantía menor`);
      } else {
        vistos.set(a.command, indice);
      }
    }
  }
  return violaciones;
}

/** Igualdad exacta, a propósito: el más parecido es el que clasifica con el parser equivocado. */
export function resolverAdaptador(adaptadores, comando) {
  return adaptadores.find((a) => a.command === comando);
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

  const runtimeRoot = options.runtimeRoot ?? RUNTIME_ROOT;
  const readContract = options.readContract ?? ((ruta) => JSON.parse(readFileSync(join(runtimeRoot, ruta), 'utf8')));

  let contrato;
  try {
    contrato = readContract(CONTRATO_PATH);
  } catch (error) {
    writeError(`REJECTED: no se pudo leer ${CONTRATO_PATH}: ${error?.message ?? error}. Sin el contrato de adaptadores no hay forma de saber qué runner está declarado, y adivinarlo es lo que este gate existe para impedir.`);
    return 1;
  }

  const violaciones = validarContrato(contrato);
  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${CONTRATO_PATH}: ${v}`);
    return 1;
  }

  const elegido = resolverAdaptador(contrato.adapters, parsed.command);
  if (!elegido) {
    const declarados = contrato.adapters.map((a) => `"${a.command}"`).join(', ');
    writeError(`REJECTED: el runner ${JSON.stringify(parsed.command)} no está declarado en ${CONTRATO_PATH}. Los declarados son: ${declarados}.`);
    writeError('REJECTED: la coincidencia es EXACTA y no se adivina adaptador: las opciones cambian la forma del reporte, y clasificar la salida de un runner con el parser de otro convierte un rojo mal leído en un verde. Declaralo con su garantía y su límite, o corré el comando tal como está escrito arriba.');
    return 1;
  }

  const run = options.run ?? spawnSync;
  const adaptador = join(runtimeRoot, 'scripts', elegido.script);
  const resultado = run(process.execPath, [adaptador, 'check', '--test', parsed.testPath, '--command', parsed.command], {
    cwd: options.cwd ?? '.',
    encoding: 'utf8',
  });

  if (resultado?.error) {
    writeError(`REJECTED: el adaptador ${elegido.script} no se pudo lanzar: ${resultado.error.message}. Esto NO es un veredicto sobre el test rojo — es que el adaptador no llegó a correr.`);
    return 1;
  }

  const salidaCruda = String(resultado?.stdout ?? '').trim();
  const errorCrudo = String(resultado?.stderr ?? '').trim();

  if (resultado?.status !== 0) {
    if (salidaCruda) write(salidaCruda);
    if (errorCrudo) writeError(errorCrudo);
    writeError(`REJECTED: ${elegido.script} (garantía ${elegido.guarantee}) no aprobó el test rojo de ${parsed.testPath}.`);
    return resultado?.status === 2 ? 2 : 1;
  }

  if (salidaCruda) write(salidaCruda);
  write(`OK: el test rojo de ${parsed.testPath} lo verificó ${elegido.script}, con garantía ${elegido.guarantee.toUpperCase()}, para el runner ${JSON.stringify(elegido.command)}.`);

  // Un verde de garantía menor NO se imprime igual que uno fuerte. Si se lee igual, es igual.
  if (elegido.guarantee !== 'fuerte') {
    write(`ATENCION — GARANTIA MENOR: ${elegido.limit}`);
    write(`ATENCION — GARANTIA MENOR: por qué: ${elegido.why}`);
    write('ATENCION — GARANTIA MENOR: este verde NO equivale al del adaptador nativo, y el receipt tiene que registrar con cuál se obtuvo. Un verde débil leído como fuerte es el modo de falla que esta distinción existe para impedir.');
  }

  write(`LIMITE: este despachador verifica QUÉ adaptador corresponde y lo lanza; NO verifica lo que el adaptador concluye — si el adaptador miente, acá la mentira pasa con su etiqueta puesta. Tampoco comprueba que ${JSON.stringify(parsed.command)} sea el comando que el proyecto usa de verdad para correr sus pruebas.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-red.mjs')) {
  process.exitCode = main();
}
