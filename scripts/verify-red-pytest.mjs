#!/usr/bin/env node
// verify-red-pytest.mjs — adaptador de test rojo para pytest. GARANTÍA MENOR, y está declarado.
//
// POR QUÉ EXISTE. Sin él, un proyecto Python no puede pasar LAW 1: no hay test rojo verificable, así
// que no hay implementación permitida. Lo que este adaptador da es un piso —obliga a que exista un
// reporte estructurado coherente y a que la línea señalada contenga una aserción— y eso es
// estrictamente más de lo que había, que era nada.
//
// POR QUÉ SE CLASIFICA SOBRE EL XML Y NO SOBRE stdout. La salida capturada de la prueba se reimprime
// textual y sin escapar bajo `Captured stdout call`, así que un `print()` adentro de una prueba puede
// dibujar el reporte que quiera. El JUnit XML al menos tiene estructura, y `failures` contra `errors`
// son contadores separados: esa separación es el discriminador que stdout no puede dar.
//
// TODO LO DE ACÁ ESTÁ MEDIDO DOS VECES, la segunda en un entorno virgen con `pytest==9.1.1` y cero
// complementos. Las dos corridas coinciden. La tabla completa está en
// `research/sources/adaptadores-red-2026-09-14.md`.
//
//   Falla un assert  → exit 1, <failure>, tests=1 errors=0 failures=1, última línea AssertionError
//   raise de otra    → exit 1, <failure>, ídem, última línea con el nombre de ESA excepción
//   pytest.fail()    → exit 1, <failure>, ídem, última línea `Failed` — NO es AssertionError
//   error de fixture → exit 1, <error>,   tests=1 errors=1 failures=0
//   error de colecta → exit 2, <error>,   errors=1, classname VACÍO
//   sintaxis rota    → exit 2, <error>,   ídem
//   cero recolectados→ exit 5, tests=0
//   usage error      → exit 4
//
// EL REFINAMIENTO QUE TRAJO LA REMEDICIÓN: el error de fixture produce una última línea con la MISMA
// FORMA que un fallo de aserción (`<archivo>:<línea>: <Excepción>`), así que apoyarse en la línea
// sola sería ambiguo. El discriminador es el par `errors`/`failures`, y la línea se mira después.
//
// EL EXIT CODE NO ALCANZA COMO ANCLA: la documentación describe el `2` como «interrumpido por el
// usuario», pero un error de recolección también sale 2. Mezcla dos cosas, así que el veredicto se
// ancla en los contadores del XML y el exit code sólo acompaña.
//
// LÍMITE HONESTO. Prueba que pytest, corriendo en este proyecto, escribió un JUnit XML donde un
// `<failure>` informa `AssertionError` en una línea del proyecto que contiene un `assert`. **NO
// prueba que haya corrido una prueba**, y menos que la aserción sea genuina: pytest ejecuta
// `conftest.py` del proyecto como plugin, con acceso a `session.config.option.xmlpath` y a
// `session.exitstatus`. Falsificado y reproducido en entorno virgen: un hookwrapper de
// `pytest_sessionfinish` reescribe el XML después de `LogXML` y fuerza el código de salida, con una
// única prueba que PASA. `--noconftest` cierra el vector pero rompe cualquier proyecto con fixtures,
// así que no sirve como default. Esta brecha es de protocolo y revisión, no técnica.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { isContainedProjectPath } from './verify-red-node.mjs';

export const USAGE = 'usage: verify-red-pytest.mjs check --test <project-relative-test-file> --command "pytest"';
export const COMANDO = 'pytest';

/** `<archivo>:<línea>: <NombreDeExcepción>` — la forma medida de la última línea del cuerpo. */
export const FORMA_ULTIMA_LINEA = /^(.*?):(\d+):\s*([A-Za-z_][A-Za-z0-9_.]*)\s*$/u;

const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;

/** La última línea NO vacía del cuerpo: es donde pytest deja el discriminador. */
export function ultimaLineaDelCuerpo(cuerpo) {
  const lineas = String(cuerpo ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return lineas.length > 0 ? lineas.at(-1) : null;
}

const atributo = (texto, nombre) => {
  const m = new RegExp(`${nombre}="([^"]*)"`, 'u').exec(texto);
  return m ? m[1] : null;
};

/**
 * Clasifica el JUnit XML por CONTADORES, que es lo único estructural que pytest da. Sin librería de
 * XML porque el protocolo no tiene dependencias externas: se extraen los atributos del `<testsuite>`
 * y el primer `<testcase>`, que es todo lo que hace falta para un archivo de prueba único.
 */
export function clasificarXml(bruto) {
  if (bruto === null || bruto === undefined) return { clase: 'ausente' };
  const texto = String(bruto);
  const suite = /<testsuite\b[^>]*>/u.exec(texto);
  if (!suite) return { clase: 'ilegible', motivo: 'el XML no trae un <testsuite>' };

  const tests = Number(atributo(suite[0], 'tests'));
  const errores = Number(atributo(suite[0], 'errors'));
  const fallos = Number(atributo(suite[0], 'failures'));
  if (!Number.isInteger(tests) || !Number.isInteger(errores) || !Number.isInteger(fallos)) {
    return { clase: 'ilegible', motivo: 'los contadores del <testsuite> no son números enteros' };
  }

  if (tests === 0) return { clase: 'sin-pruebas', tests, errores, fallos };
  if (errores > 0) {
    const caso = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/u.exec(texto);
    const cuerpo = /<error\b[^>]*>([\s\S]*?)<\/error>/u.exec(texto);
    return {
      clase: 'error',
      tests,
      errores,
      fallos,
      classname: caso ? atributo(caso[1], 'classname') : null,
      ultima: cuerpo ? ultimaLineaDelCuerpo(cuerpo[1]) : null,
    };
  }
  if (fallos === 0) return { clase: 'sin-fallo', tests, errores, fallos };

  const cuerpo = /<failure\b[^>]*>([\s\S]*?)<\/failure>/u.exec(texto);
  if (!cuerpo) return { clase: 'ilegible', motivo: `el XML declara failures="${fallos}" pero no trae ningún <failure>` };
  return { clase: 'fallo', tests, errores, fallos, ultima: ultimaLineaDelCuerpo(cuerpo[1]) };
}

/**
 * El entorno con el que se lanza pytest. `PYTEST_ADDOPTS` se saca porque se MIDIÓ que inyecta
 * opciones: con `--co` metido ahí, pytest sólo recolecta y el reporte queda en cero. Es el
 * equivalente exacto de lo que el adaptador nativo hace con `NODE_OPTIONS`.
 */
export function entornoPytest(base = process.env) {
  const copia = { ...base };
  delete copia.PYTEST_ADDOPTS;
  return copia;
}

/** Project-relative, literal, y adentro del proyecto. Sin esto la comprobación de fuente no vale. */
// Sin valor por defecto para `contenida`: main siempre lo pasa, asi que un default aca seria
// codigo muerto. El default vive en main, que es donde de verdad puede faltar.
function rutaDeProyecto(ruta, cwd, contenida) {
  if (!noVacio(ruta) || isAbsolute(ruta)) return null;
  const normal = ruta.replaceAll('\\', '/');
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

  // Sonda antes de medir: sin pytest, «no pude medir» NO es «medí y no había rojo».
  const sonda = options.sonda ?? ((bin) => spawnSync(bin, ['-c', 'import pytest'], { cwd, encoding: 'utf8', env: entornoPytest(options.env) }));
  const python = options.python ?? 'python';
  const disponible = sonda(python);
  if (disponible?.error || disponible?.status !== 0) {
    // Sin `?? 'sin detalle'` al final: `String(...).trim()` nunca devuelve nulo, asi que esa caida
    // seria codigo muerto. Lo marco el gate de cobertura cuando se intento escribirla.
    const detalle = disponible?.error?.message ?? String(disponible?.stderr ?? '').trim();
    writeError(`REJECTED: pytest no está disponible con ${JSON.stringify(python)}: ${detalle}. Esto NO es un veredicto sobre el test rojo — es que el adaptador no pudo medir. Instalá pytest en el intérprete que este proyecto usa, o corré el runner que tengas declarado.`);
    return 1;
  }

  // El reporte se escribe FUERA del proyecto a propósito: así no ensucia el árbol que el protocolo
  // sella, y no hay forma de que quede committeado por accidente.
  const destino = options.destino ?? join(tmpdir(), `vcp-red-pytest-${process.pid}-${Date.now()}.xml`);
  const run = options.run ?? spawnSync;
  const argumentos = [
    '-m', 'pytest',
    `--junit-xml=${destino}`,
    '-p', 'no:cacheprovider',
    // Obligatorio y medido: sin esto, un `pytest.ini` del proyecto con `addopts = -p no:junitxml`
    // hace que el XML no se escriba NUNCA, y el adaptador se quedaría sin nada que clasificar.
    '-o', 'addopts=',
    '-q', normal,
  ];
  const resultado = run(python, argumentos, { cwd, encoding: 'utf8', env: entornoPytest(options.env) });

  const leerXml = options.leerXml ?? ((ruta) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : null));
  const limpiar = options.limpiar ?? ((ruta) => rmSync(ruta, { force: true }));
  let bruto = null;
  try {
    bruto = leerXml(destino);
  } finally {
    limpiar(destino);
  }

  if (resultado?.error) {
    writeError(`REJECTED: no se pudo lanzar pytest: ${resultado.error.message}. Esto NO es un veredicto sobre el test rojo.`);
    return 1;
  }

  const clasificado = clasificarXml(bruto);

  if (clasificado.clase === 'ausente') {
    writeError(`REJECTED: pytest terminó con código ${resultado?.status} y el JUnit XML no se escribió. La causa medida más común es un \`pytest.ini\` del proyecto que apaga el reporte; por eso el comando lleva \`-o addopts=\`, y si aun así no aparece, el entorno está haciendo algo que este adaptador no puede ver. Sin reporte no hay veredicto.`);
    return 1;
  }
  if (clasificado.clase === 'ilegible') {
    writeError(`REJECTED: el JUnit XML existe pero no se puede leer: ${clasificado.motivo}. Un reporte corrupto no es un reporte ausente, y ninguno de los dos es un rojo.`);
    return 1;
  }
  if (clasificado.clase === 'sin-pruebas') {
    writeError(`REJECTED: pytest no recolectó ninguna prueba en ${normal} (tests=0, código ${resultado?.status}). Cero pruebas no es un test rojo: es un archivo que no corrió.`);
    return 1;
  }
  if (clasificado.clase === 'error') {
    const donde = clasificado.classname ? `en ${clasificado.classname}` : 'durante la recolección (classname vacío)';
    writeError(`REJECTED: pytest informó errors=${clasificado.errores} y failures=${clasificado.fallos} ${donde}: ${clasificado.ultima ?? 'sin detalle'}. Un error de fixture, de importación o de sintaxis NO es una aserción que falla — la prueba nunca llegó a ejecutarse. Ojo: su última línea tiene la misma forma que la de un assert fallido, y por eso el veredicto sale de los contadores y no de la línea.`);
    return 1;
  }
  if (clasificado.clase === 'sin-fallo') {
    writeError(`REJECTED: pytest corrió ${clasificado.tests} prueba(s) y ninguna falló. Sin rojo visible no hay implementación (LAW 1).`);
    return 1;
  }

  const ultima = clasificado.ultima;
  const forma = FORMA_ULTIMA_LINEA.exec(ultima ?? '');
  if (!forma) {
    writeError(`REJECTED: la última línea del <failure> no tiene la forma <archivo>:<línea>: <Excepción>: ${JSON.stringify(ultima)}. Sin esa forma no se puede saber qué excepción fue ni dónde.`);
    return 1;
  }

  const [, archivoBruto, lineaBruta, excepcion] = forma;
  if (excepcion !== 'AssertionError') {
    writeError(`REJECTED: la prueba falló con ${excepcion}, no con AssertionError. \`pytest.fail()\` y un \`pytest.raises\` que no lanza producen \`Failed\`, y una excepción cualquiera produce su propio nombre: ninguno es una aserción que falla. Rechazarlos es el default coherente con el adaptador nativo.`);
    return 1;
  }

  // EL ENDURECIMIENTO: se lee el archivo fuente en vez de creerle al reporte. Cierra el ataque «el
  // conftest inventa un fallo para una prueba que no existe». NO cierra un `raise AssertionError`
  // escrito literalmente en esa línea, y eso está declarado abajo.
  const archivo = rutaDeProyecto(archivoBruto, cwd, contenida);
  if (!archivo) {
    writeError(`REJECTED: el reporte señala ${JSON.stringify(archivoBruto)}, que no es una ruta contenida en el proyecto. Un fallo que apunta afuera del árbol no se puede comprobar contra el fuente.`);
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

  const numero = Number(lineaBruta);
  const lineas = String(fuente).split('\n');
  const linea = lineas[numero - 1];
  if (linea === undefined) {
    writeError(`REJECTED: el reporte señala ${archivo}:${numero} y ese archivo tiene ${lineas.length} línea(s). El fallo apunta a una línea que no existe.`);
    return 1;
  }
  if (!/\bassert\b/u.test(linea)) {
    writeError(`REJECTED: el reporte informa AssertionError en ${archivo}:${numero}, y esa línea del fuente no contiene ningún \`assert\`. O el reporte está forjado, o señala la línea equivocada; en los dos casos no hay evidencia de una aserción que falló.`);
    return 1;
  }

  write(`OK: pytest registró un <failure> de fase de llamada con AssertionError en ${archivo}:${numero}, y esa línea del fuente contiene un \`assert\`. Contadores del reporte: tests=${clasificado.tests} errors=${clasificado.errores} failures=${clasificado.fallos}.`);
  write('ATENCION — GARANTIA MENOR: este verde NO equivale al del adaptador nativo de Node.');
  write('LIMITE: prueba que pytest escribió un reporte con esa forma. NO prueba que haya corrido una prueba, y menos que la aserción sea genuina: pytest ejecuta `conftest.py` del proyecto como plugin, con acceso a la ruta del XML y al código de salida, y está falsificado —reproducido también en entorno virgen— que un hookwrapper de `pytest_sessionfinish` reescribe el XML después de escrito y fuerza el exit code con una única prueba que PASA. La comprobación contra el fuente cierra el caso de un fallo inventado para una prueba inexistente, pero un reporte forjado que señale una línea que SÍ tiene un `assert` pasa igual, y un `raise AssertionError` escrito a mano en esa línea también. `--noconftest` cerraría el vector y rompería cualquier proyecto con fixtures, así que no es un default usable: la brecha es de protocolo y revisión, no técnica.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-red-pytest.mjs')) {
  process.exitCode = main();
}
