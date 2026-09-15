#!/usr/bin/env node
// verify-repo-clean.mjs — lo versionado no lleva la identidad de quien lo escribió.
//
// EL PROBLEMA QUE RESUELVE. Un protocolo publicado para que otros lo usen no puede venir con los
// datos de su autor adentro: quien lo instala tiene que ir aprendiendo sobre SUS proyectos, no
// leyendo los ajenos. Medido sobre este mismo repositorio el 2026-09-14: cuatro filtraciones
// introducidas sin querer en un solo ciclo —un nombre de usuario dentro de fixtures, una subcarpeta
// personal en otro test, una ruta absoluta en el cuaderno de sesión, y una línea de auditoría
// nombrando proyectos privados—, y **la cuarta resultó irreparable**: `.vibe/AUDIT.md` es
// append-only y sellada, LAW 5 prohíbe editarla, así que lo único que se pudo hacer fue agregar una
// línea de corrección debajo. Una filtración que se detecta tarde no se deshace. Por eso este gate
// corre ANTES de sellar.
//
// LAS DOS COMPROBACIONES, Y POR QUÉ SON DOS.
//
//   FORMA — rutas con pinta de directorio personal (`X:\Users\<alguien>`, `/home/<alguien>`,
//   `/Users/<alguien>`). Agarra también las de otra máquina: una ruta copiada de un pantallazo, de
//   un log ajeno o de la documentación de un tercero. La comprobación de identidad no la vería.
//
//   IDENTIDAD — el directorio personal de quien corre el gate y su nombre de usuario, resueltos EN
//   EL MOMENTO con `os.homedir()`. Agarra el caso que no parece una ruta: el nombre a secas metido
//   en un fixture, que fue la primera filtración real. **No hay ninguna lista de nombres escrita en
//   ningún archivo**: escribir el nombre del autor adentro del detector sería exactamente la misma
//   filtración con otra forma.
//
// SE ESCANEA EL BLOB, NO EL ARCHIVO DEL ARBOL DE TRABAJO. Lo que un repositorio publica es lo que
// git guarda, y las dos cosas divergen. El caso que lo demostro: git guarda un enlace simbolico
// como un blob cuyo contenido es LA RUTA DESTINO, asi que un enlace a `/home/<alguien>/...`
// publica esa ruta personal — y leer el archivo del arbol de trabajo **sigue el enlace** y lee el
// destino, nunca el texto. Reproducido el 2026-09-14: un repositorio que publicaba
// `/home/<alguien>/.config/secretos` salia en VERDE. Leer el blob tambien cubre el caso de un
// archivo borrado del arbol pero todavia rastreado, que se publica igual.
//
// Y FALLA CERRADO. Un archivo que no se puede leer es un HALLAZGO, no un silencio: «no pude
// mirar» no es «mire y no habia nada». El gate hermano `verify-security-baseline.mjs` ya lo hacia
// asi —un fuente ilegible es severidad alta— de modo que el protocolo ya tenia el patron correcto
// y este gate no lo seguia. Esa asimetria entre dos gates que escanean la misma superficie era el
// defecto de fondo.
//
// LÍMITE HONESTO. Detecta rutas y la identidad de la máquina que lo corre. **No detecta nombres
// propios, de clientes, de proyectos privados ni de carpetas personales que no tengan forma de
// ruta**: para el gate son palabras como cualquier otra, y no hay forma mecánica de distinguirlas.
// Tampoco ve lo que no está rastreado por git, ni lo binario, ni el historial ya escrito. Y una
// excepción declarada con un motivo plausible apaga la comprobación de ese archivo: el gate no
// puede distinguir un marcador legítimo de una tapadera.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir as homedirReal } from 'node:os';
import { basename, join } from 'node:path';
import { mismoSchema } from './schema-compat.mjs';

export const SCHEMA = 'ia.repo-clean/1';
export const USAGE = 'usage: verify-repo-clean.mjs check [contrato.json]';
export const EMPTY = 'VACÍO';

/** Un motivo de excepción tiene que explicar, no rellenar. Mismo piso que el resto de los gates. */
export const MIN_MOTIVO = 20;

/**
 * Debajo de esto, buscar el nombre de usuario a secas produce más ruido que señal: un usuario de dos
 * o tres letras coincide adentro de media biblioteca. La comprobación se apaga, pero NUNCA en
 * silencio — se apaga diciéndolo, porque un gate que se desactiva callado es peor que no tenerlo.
 */
export const MIN_USUARIO = 4;

/**
 * Un nombre de usuario que aparece en mas de esta fraccion de los archivos versionados es una
 * PALABRA DEL DOMINIO, no una identidad, y buscarlo produce ruido en vez de senal.
 *
 * EL UMBRAL SALE DE UNA MEDICION, no de una intuicion. En un runner de GitHub Actions la cuenta se
 * llama literalmente `runner`, y este protocolo menciona esa palabra en 72 de sus 393 archivos
 * versionados —un 18%— porque el despachador de test rojo habla de runners todo el tiempo. La
 * filtracion real que motivo este gate era el nombre del autor en 3 de 393: un 0,8%. La separacion
 * entre las dos es de veinte veces, asi que el corte no esta en el filo de nada.
 *
 * Un gate que grita en cada corrida se termina apagando, y esa es la forma mas comun de perder un
 * gate. Apagar la mitad ruidosa DICIENDOLO conserva la otra mitad, que no tiene este problema: una
 * ruta de directorio personal es una ruta se llame como se llame la cuenta.
 */
export const FRACCION_DE_PALABRA = 0.05;

/**
 * Cuantos archivos hacen falta para que una frecuencia sea una medicion y no una anecdota.
 *
 * EL NUMERO NO ES ARBITRARIO: con veinte archivos, UNO SOLO es exactamente el 5%, o sea el
 * umbral. Por debajo de veinte, un unico archivo con el nombre adentro ya superaria la
 * fraccion y apagaria la comprobacion — que es justo el caso que hay que detectar, porque una
 * filtracion real empieza en un archivo. Debajo del piso la regla no se aplica y se busca el
 * nombre igual, que es el lado seguro del error.
 */
export const MIN_CORPUS = 20;

const CONTRATO_POR_DEFECTO = join('contracts', 'repo-clean.json');

const RELLENO = /^(tbd|todo|pendiente|n\/a|na|placeholder|xxx+|-+|\.+)$/iu;

/**
 * Rutas con forma de directorio personal, en las tres convenciones que existen.
 *
 * La etiqueta nombra el PREFIJO y no el sistema operativo, a propósito: bajo Git Bash en Windows el
 * directorio personal se ve como `/c/Users/<alguien>`, que casa con la convención de macOS. Decirle
 * «ruta de macOS» a alguien parado en Windows convierte un diagnóstico correcto en uno confuso, y el
 * mensaje de rechazo es lo único que esa persona va a leer. Medido sobre una instalación real.
 */
export const PATRONES_DE_RUTA = Object.freeze([
  { que: 'ruta de directorio personal, con unidad y carpeta de usuarios', re: /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}([A-Za-z0-9._-]+)/gu },
  { que: 'ruta de directorio personal, con el prefijo /home/', re: /\/home\/([A-Za-z0-9._-]+)/gu },
  { que: 'ruta de directorio personal, con el prefijo /Users/', re: /\/Users\/([A-Za-z0-9._-]+)/gu },
]);

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const noVacio = (v) => typeof v === 'string' && v.trim().length > 0;
const explicativo = (v) => noVacio(v) && v.trim().length >= MIN_MOTIVO && !RELLENO.test(v.trim());

const CONTRATO_KEYS = Object.freeze(['schema', 'why', 'allowed']);
const PERMISO_KEYS = Object.freeze(['path', 'pattern', 'reason']);

const clavesExactas = (v, claves) => esObjeto(v)
  && Object.keys(v).length === claves.length
  && claves.every((k) => Object.hasOwn(v, k));

export function validarContrato(contrato) {
  if (!esObjeto(contrato)) return ['el contrato debe ser un objeto'];
  if (!mismoSchema(contrato.schema, SCHEMA)) return [`el contrato debe declarar schema ${SCHEMA}, no ${JSON.stringify(contrato.schema)}`];
  if (!clavesExactas(contrato, CONTRATO_KEYS)) {
    return [`el contrato debe declarar exactamente ${CONTRATO_KEYS.join(', ')}`];
  }

  const violaciones = [];
  if (!explicativo(contrato.why)) {
    violaciones.push(`why debe explicar para qué existe la lista de excepciones, con al menos ${MIN_MOTIVO} caracteres`);
  }
  if (!Array.isArray(contrato.allowed)) {
    violaciones.push('allowed debe ser una lista de excepciones, aunque esté vacía');
    return violaciones;
  }

  for (const [indice, permiso] of contrato.allowed.entries()) {
    const donde = `allowed[${indice}]`;
    if (!clavesExactas(permiso, PERMISO_KEYS)) {
      violaciones.push(`${donde} debe declarar exactamente ${PERMISO_KEYS.join(', ')}`);
      continue;
    }
    if (!noVacio(permiso.path)) violaciones.push(`${donde}.path debe nombrar el archivo que la excepción cubre`);
    if (!noVacio(permiso.pattern)) violaciones.push(`${donde}.pattern debe decir QUÉ texto se permite, no dejar el archivo entero abierto`);
    if (!explicativo(permiso.reason)) {
      violaciones.push(`${donde}.reason debe decir por qué ese texto es legítimo, con al menos ${MIN_MOTIVO} caracteres y sin relleno`);
    }
  }
  return violaciones;
}

/**
 * Un archivo es binario si trae un byte cero en su arranque. Es la heurística de git, y alcanza:
 * lo que este gate busca es texto, y un falso negativo acá no tapa nada que no estuviera tapado.
 */
export function esBinario(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  return buf.subarray(0, 8000).includes(0);
}

/**
 * Los hallazgos de un texto, cada uno con su número de línea. Devuelve QUÉ clase de hallazgo es y el
 * fragmento que lo disparó, nunca el texto completo de la línea: el mensaje de rechazo va a parar a
 * registros de integración continua que suelen ser públicos, y un gate que grita el dato que
 * protege lo filtra otra vez.
 */
export function buscarEnTexto(texto, identidad = {}) {
  const { home, usuario } = identidad;
  const hallazgos = [];
  const lineas = String(texto).split('\n');

  for (const [indice, linea] of lineas.entries()) {
    const numero = indice + 1;
    // Una clase de hallazgo por línea, no una por aparición: `linea.includes(...)` y `re.test(...)`
    // contestan una sola vez por línea, aunque el texto se repita tres veces adentro. Una guarda de
    // deduplicación acá sería código muerto —cada clase tiene un único lugar que la anota— y el gate
    // de cobertura la marcó como tal cuando se intentó escribirla.
    const anotar = (que) => hallazgos.push({ linea: numero, que });

    if (noVacio(home) && linea.includes(home)) anotar('la ruta del directorio personal de esta máquina');
    if (noVacio(usuario) && linea.includes(usuario)) anotar('el nombre de usuario de esta máquina');

    for (const { que, re } of PATRONES_DE_RUTA) {
      re.lastIndex = 0;
      if (re.test(linea)) anotar(que);
    }
  }
  return hallazgos;
}

/**
 * El contenido que git PUBLICA para una ruta rastreada: el blob del indice, no el archivo del
 * arbol de trabajo. `git show :<ruta>` lee exactamente lo que un clon va a recibir, y para un
 * enlace simbolico eso es el texto del destino.
 */
function leerBlobDeGit(raiz, ruta) {
  return execFileSync('git', ['-C', raiz, 'show', `:${ruta}`], { encoding: 'buffer', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
}

/** Los archivos que git rastrea, relativos a la raíz. Sin repositorio, la lista es vacía. */
function rastreadosPorGit(raiz) {
  try {
    const salida = execFileSync('git', ['-C', raiz, 'ls-files', '-z'], { encoding: 'utf8', stdio: 'pipe' });
    return salida.split('\0').filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

function permisoQueCubre(permisos, archivo, linea) {
  return permisos.some((p) => p.path === archivo && linea.includes(p.pattern));
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const raiz = options.root ?? process.cwd();

  if (args.length < 1 || args.length > 2 || args[0] !== 'check' || (args.length === 2 && !noVacio(args[1]))) {
    writeError(USAGE);
    return 2;
  }

  const homedir = options.homedir ?? homedirReal;
  const home = homedir();
  const usuarioCrudo = basename(String(home ?? ''));
  // El nombre corto se descarta ACÁ, y el límite de abajo lo dice. No se puede apagar en silencio.
  const usuario = usuarioCrudo.length >= MIN_USUARIO ? usuarioCrudo : '';

  const rutaContrato = args[1] ?? CONTRATO_POR_DEFECTO;
  const readContract = options.readContract
    ?? ((ruta) => JSON.parse(readFileSync(join(raiz, ruta), 'utf8')));

  let contrato;
  try {
    contrato = readContract(rutaContrato);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      writeError(`REJECTED: ${rutaContrato} existe pero es ilegible: ${error?.message ?? error}. Un contrato corrupto no es un contrato ausente.`);
      return 1;
    }
    // Sin contrato no hay excepciones declaradas, que es el estado más estricto y no un defecto.
    contrato = { schema: SCHEMA, why: 'sin contrato: ninguna excepción declarada', allowed: [] };
  }

  const violaciones = validarContrato(contrato);
  if (violaciones.length > 0) {
    for (const v of violaciones) writeError(`REJECTED: ${rutaContrato}: ${v}`);
    return 1;
  }

  const archivos = (options.trackedFiles ?? rastreadosPorGit)(raiz);
  if (archivos.length === 0) {
    write(`${EMPTY}: git no rastrea ningún archivo acá, así que no se revisó nada. Una carpeta sin versionar no puede filtrar nada versionado.`);
    return 0;
  }

  const leerBlob = options.leerBlob ?? ((ruta) => leerBlobDeGit(raiz, ruta));
  const identidad = { home, usuario };
  const hallazgos = [];
  const opacos = [];
  let revisados = 0;
  let binarios = 0;

  // Se lee TODO primero y se clasifica despues: decidir si el nombre de usuario es una identidad o
  // una palabra del dominio necesita la frecuencia sobre el conjunto, no sobre el archivo de turno.
  const textos = [];
  for (const archivo of archivos) {
    let bytes;
    try {
      bytes = leerBlob(archivo);
    } catch (error) {
      // FALLA CERRADO: no poder mirar un archivo que el repositorio publica no es haberlo mirado.
      opacos.push({ archivo, motivo: error?.message ?? String(error) });
      continue;
    }
    if (esBinario(bytes)) { binarios += 1; continue; }
    revisados += 1;
    textos.push({ archivo, texto: Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes) });
  }

  // La frecuencia separa una identidad de una palabra del vocabulario del proyecto. Ver
  // FRACCION_DE_PALABRA: el umbral sale de una medicion, no de una intuicion.
  let usuarioEsPalabra = false;
  if (identidad.usuario !== '' && revisados >= MIN_CORPUS) {
    const conElNombre = textos.filter((f) => f.texto.includes(identidad.usuario)).length;
    usuarioEsPalabra = conElNombre / revisados > FRACCION_DE_PALABRA;
    if (usuarioEsPalabra) identidad.usuario = '';
  }

  for (const { archivo, texto } of textos) {
    // El indice siempre resuelve: los hallazgos traen el numero de linea que `buscarEnTexto` saco de
    // ESTE mismo texto, asi que una caida por si falta seria codigo muerto.
    const lineas = texto.split('\n');
    for (const h of buscarEnTexto(texto, identidad)) {
      if (permisoQueCubre(contrato.allowed, archivo, lineas[h.linea - 1])) continue;
      hallazgos.push({ archivo, ...h });
    }
  }

  if (opacos.length > 0) {
    for (const o of opacos) {
      writeError(`REJECTED: ${o.archivo} está rastreado y no se pudo leer su contenido publicado: ${o.motivo}. Un archivo que el repositorio publica y este gate no puede revisar NO es un archivo limpio: es uno que nadie miró.`);
    }
    writeError(`REJECTED: ${opacos.length} archivo(s) versionado(s) quedaron sin revisar. Este gate falla cerrado a propósito, igual que verify-security-baseline.mjs: «no pude mirar» no es «miré y no había nada».`);
    return 1;
  }

  if (hallazgos.length > 0) {
    for (const h of hallazgos) {
      writeError(`REJECTED: ${h.archivo}, línea ${h.linea}: ${h.que}. Sacalo antes de sellar la traza, o declaralo en ${rutaContrato} diciendo por qué es legítimo.`);
    }
    writeError(`REJECTED: ${hallazgos.length} hallazgo(s) en ${revisados} archivo(s) versionado(s). Lo publicado se lee, se clona y se indexa: una vez afuera no se saca.`);
    return 1;
  }

  write(`OK: ${revisados} archivo(s) versionado(s) revisado(s) por su CONTENIDO PUBLICADO —el blob, no el archivo del árbol de trabajo— sin rastro de la identidad de quien corre este gate ni de rutas personales, con ${contrato.allowed.length} excepción(es) declarada(s) y ${binarios} archivo(s) binario(s) fuera del alcance.`);
  write(`LIMITE: detecta rutas con forma de directorio personal y la identidad de LA MÁQUINA QUE LO CORRE. NO detecta nombres propios, de clientes, de proyectos privados ni de carpetas personales que no tengan forma de ruta — para este gate son palabras como cualquier otra. Tampoco ve lo binario, lo no rastreado, ni lo ya escrito en el historial. Y una excepción declarada apaga su archivo: no distingue un marcador legítimo de una tapadera.${usuario === '' ? ` ADEMÁS, en esta corrida la búsqueda del nombre de usuario quedó APAGADA porque tiene menos de ${MIN_USUARIO} caracteres y produciría coincidencias falsas: acá sólo corrió la comprobación de rutas.` : ''}${usuarioEsPalabra ? ` ADEMÁS, en esta corrida la búsqueda del nombre de usuario quedó APAGADA porque ese nombre aparece en más del ${Math.round(FRACCION_DE_PALABRA * 100)}% de lo versionado: acá es una PALABRA del vocabulario del proyecto y no una identidad, así que buscarla sería ruido. La comprobación de rutas sí corrió. Si ese nombre además fuera una identidad filtrada, este gate no la vería.` : ''}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-repo-clean.mjs')) {
  process.exitCode = main();
}
