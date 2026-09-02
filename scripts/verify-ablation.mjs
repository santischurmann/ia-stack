#!/usr/bin/env node
// verify-ablation.mjs — que la limpieza sea una ablacion medida y no un borrado con buena letra.
//
// EL PROBLEMA QUE RESUELVE. Una limpieza de configuracion es la operacion mas facil de contar mal:
// se archivan diez archivos, todo "sigue andando", y nadie puede decir si algo de eso aportaba.
// Peor: "sigue andando" se mide de memoria, contra la impresion de la sesion en curso. El metodo
// que este gate exige es el de Anthropic -- borrar todo y devolver linea por linea lo que
// demuestre que aporta --, y lo que hace verificable no es la limpieza sino su REGISTRO: que hubo
// linea base antes de mover el primer archivo, que cada tanda volvio a medir el mismo set, que
// cada archivo archivado tiene motivo escrito y no aprueba ninguna de las tres R, que nada se
// borro, y que la vuelta atras se probo de verdad una vez.
//
// LA REGLA DE ORO. En la limpieza NO EXISTE `rm`. Nada se borra: todo se mueve al archivo
// conservando la ruta relativa. El gate lo comprueba contra el disco: cada archivo archivado tiene
// que EXISTIR en su destino y NO existir en su origen. Un registro que dice haber archivado algo
// que no esta en ninguno de los dos lados describe un borrado.
//
// LIMITE HONESTO. Verifica el REGISTRO de una ablacion, no la ablacion. No corre las pruebas del
// set, no juzga si son representativas, y no sabe si el resultado que dice `igual` era igual: un
// registro coherente e inventado pasa en verde. Tampoco decide que merece archivarse -- el filtro
// de las tres R lo aplica una persona y el gate solo comprueba que no se contradiga.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeProjectFile } from './ratchet.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const USAGE = 'usage: verify-ablation.mjs check <ablation.json>';
export const EMPTY = 'VACÍO';
export const LIMITS = 'LÍMITE';
export const LIMITS_TEXT = `${LIMITS}: verifica el registro de una ablación, no la ablación. No corre las pruebas del set, no juzga si son representativas y no sabe si un resultado que dice "igual" era igual. Un registro coherente e inventado pasa en verde.`;
export const SCHEMA = 'vcp.ablation/1';
export const SCOPE_SCHEMA = 'vcp.ablation-scope/1';
export const SCOPE_PATH = join(repoRoot, 'contracts', 'ablation-scope.json');
export const VERDICTS = new Set(['QUEDA', 'ARCHIVAR', 'REESCRIBIR']);
export const COMPARISONS = new Set(['igual', 'mejor', 'peor']);
/** Las tres R del filtro. Aprobar CUALQUIERA alcanza para no archivar. */
export const R = Object.freeze(['repetible', 'requisito', 'repartible']);

const RECORD_KEYS = ['schema', 'run_id', 'archive_dir', 'rollback_command', 'rollback_tested', 'test_set', 'baseline', 'inventory', 'batches', 'survivors', 'totals'];
const ARCHIVED_KEYS = ['path', 'archived_to', ...R, 'verdict', 'reason'];
const MIN_REASON = 20;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v, keys) => isObject(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const longEnough = (v) => typeof v === 'string' && v.trim().length >= MIN_REASON;
const stripBom = (t) => (typeof t === 'string' && t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);
const slashes = (p) => String(p).replaceAll('\\', '/');

/** Un glob de los que usa el contrato -- `**\/*.mq5`, `.git/**`, `src/**` -- a expresion regular. */
export function globToRegExp(pattern) {
  const glob = slashes(pattern);
  let body = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char !== '*') {
      // Todo lo que no sea alfanumerico o separador se escapa: el patron protege rutas, y un punto
      // que matchee cualquier caracter volveria `**/*.mq5` mas ancho de lo que el contrato declara.
      body += /[a-zA-Z0-9_~/-]/u.test(char) ? char : `\\${char}`;
      continue;
    }
    if (glob[index + 1] !== '*') {
      body += '[^/]*'; // un `*` suelto no cruza separadores
      continue;
    }
    if (glob[index + 2] === '/') {
      body += '(?:[^/]+/)*'; // `**/` cruza cero o mas directorios
      index += 2;
      continue;
    }
    body += '.*'; // `**` al final se traga el resto de la ruta
    index += 1;
  }
  return new RegExp(`^${body}$`, 'u');
}

/** Los datos del contrato, sin lanzar nunca: un contrato roto se informa como contrato roto. */
export function loadScope(contract) {
  const violations = [];
  if (!isObject(contract) || contract.schema !== SCOPE_SCHEMA) {
    return { untouchable: [], minTests: 0, maxTests: 0, maxBatch: 0, violations: [`el contrato de alcance debe declarar ${SCOPE_SCHEMA}`] };
  }
  if (!Array.isArray(contract.untouchable) || contract.untouchable.length === 0) {
    violations.push('el contrato de alcance debe declarar al menos un patrón intocable');
  }
  const untouchable = [];
  for (const [index, entry] of (contract.untouchable ?? []).entries()) {
    if (!isObject(entry) || typeof entry.pattern !== 'string' || entry.pattern === '' || !longEnough(entry.why)) {
      violations.push(`el contrato de alcance: untouchable[${index}] necesita un patrón y un motivo escrito`);
      continue;
    }
    untouchable.push({ pattern: entry.pattern, why: entry.why, re: globToRegExp(entry.pattern) });
  }
  const set = isObject(contract.test_set) ? contract.test_set : {};
  const batch = isObject(contract.batch) ? contract.batch : {};
  if (!Number.isInteger(set.min) || !Number.isInteger(set.max) || set.min < 1 || set.max < set.min) {
    violations.push('el contrato de alcance debe declarar test_set.min y test_set.max coherentes');
  }
  if (!Number.isInteger(batch.max_files) || batch.max_files < 1) {
    violations.push('el contrato de alcance debe declarar batch.max_files');
  }
  return { untouchable, minTests: set.min, maxTests: set.max, maxBatch: batch.max_files, violations };
}

function checkTestSet(record, scope, violations) {
  if (!Array.isArray(record.test_set) || record.test_set.length < scope.minTests || record.test_set.length > scope.maxTests) {
    violations.push(`el set de pruebas tiene ${Array.isArray(record.test_set) ? record.test_set.length : 0} tarea(s) y el contrato pide entre ${scope.minTests} y ${scope.maxTests}: sin un set acordado antes de mover nada, la línea base no significa nada`);
    return new Set();
  }
  const ids = new Set();
  for (const [index, entry] of record.test_set.entries()) {
    if (!exactKeys(entry, ['test_id', 'task', 'why_representative']) || typeof entry.test_id !== 'string' || entry.test_id === '') {
      violations.push(`el set de pruebas: la tarea ${index + 1} necesita test_id, task y why_representative`);
      continue;
    }
    if (!longEnough(entry.task) || !longEnough(entry.why_representative)) {
      violations.push(`el set de pruebas: ${entry.test_id} no dice qué hace ni por qué representa el trabajo real`);
    }
    if (ids.has(entry.test_id)) violations.push(`el set de pruebas repite ${entry.test_id}`);
    ids.add(entry.test_id);
  }
  return ids;
}

function checkMeasurement(rows, ids, donde, violations) {
  if (!Array.isArray(rows)) {
    violations.push(`${donde}: no midió nada`);
    return;
  }
  const vistos = new Set();
  for (const row of rows) {
    if (!exactKeys(row, ['test_id', 'outcome', 'evidence']) || !ids.has(row.test_id)) {
      violations.push(`${donde}: una medición no corresponde a ninguna tarea del set`);
      continue;
    }
    if (!longEnough(row.evidence)) violations.push(`${donde}: ${row.test_id} no trae la evidencia de lo que salió`);
    vistos.add(row.test_id);
  }
  const faltan = [...ids].filter((id) => !vistos.has(id));
  if (faltan.length > 0) violations.push(`${donde}: no midió ${faltan.join(', ')}, así que la comparación contra la línea base no cierra`);
}

function checkArchived(entry, batchNo, record, scope, io, violations) {
  const donde = `tanda ${batchNo}`;
  if (!exactKeys(entry, ARCHIVED_KEYS)) {
    violations.push(`${donde}: un archivado debe declarar exactamente ${ARCHIVED_KEYS.join(', ')}`);
    return;
  }
  const ruta = slashes(entry.path);
  const golpe = scope.untouchable.find((u) => u.re.test(ruta) || u.re.test(ruta.replace(/^~\//u, '')));
  if (golpe) {
    violations.push(`${donde}: ${entry.path} está protegido por el patrón intocable \`${golpe.pattern}\` — ${golpe.why}`);
    return;
  }
  const aprueba = R.filter((r) => entry[r] === true);
  if (aprueba.length > 0) {
    violations.push(`${donde}: ${entry.path} se archiva pero aprueba ${aprueba.join(' y ')}: el filtro de las tres R dice que se queda`);
  }
  if (R.some((r) => typeof entry[r] !== 'boolean')) {
    violations.push(`${donde}: ${entry.path} no responde las tres R con sí o no`);
  }
  if (entry.verdict !== 'ARCHIVAR') {
    violations.push(`${donde}: ${entry.path} lleva veredicto ${JSON.stringify(entry.verdict)} y sólo se archiva lo que dice ARCHIVAR`);
  }
  if (!longEnough(entry.reason)) {
    violations.push(`${donde}: ${entry.path} se archiva sin un motivo escrito: archivar sin razón es borrar con otro nombre`);
  }
  if (!slashes(entry.archived_to).startsWith(slashes(record.archive_dir))) {
    violations.push(`${donde}: ${entry.path} se guardó fuera de ${record.archive_dir}, así que el comando de vuelta atrás no lo alcanza`);
  }
  // La regla de oro contra el disco: tiene que estar en el archivo y NO en su lugar original.
  if (!io.exists(entry.archived_to)) {
    violations.push(`${donde}: ${entry.path} no está en el archivo (${entry.archived_to}): eso no es un archivado, es un borrado`);
  }
  if (io.exists(entry.path)) {
    violations.push(`${donde}: ${entry.path} sigue en su lugar, así que no se movió nada y el registro dice lo contrario`);
  }
}

/** Todas las violaciones, sin lanzar nunca. */
export function validateAblation(record, scope, io) {
  if (scope.violations.length > 0) return scope.violations;
  if (!isObject(record)) return [`el registro debe ser un objeto JSON que declare ${SCHEMA}`];
  if (record.schema !== SCHEMA) return [`el registro debe declarar ${SCHEMA}, no ${JSON.stringify(record.schema)}`];
  if (!exactKeys(record, RECORD_KEYS)) return [`el registro debe declarar exactamente ${RECORD_KEYS.join(', ')}`];

  const violations = [];
  const ids = checkTestSet(record, scope, violations);
  checkMeasurement(record.baseline, ids, 'la línea base', violations);

  const archivados = new Set();
  for (const [index, batch] of (Array.isArray(record.batches) ? record.batches : []).entries()) {
    const donde = `tanda ${index + 1}`;
    if (!exactKeys(batch, ['batch', 'archived', 'measured', 'comparison', 'restored']) || !Array.isArray(batch.archived) || !Array.isArray(batch.restored)) {
      violations.push(`${donde}: debe declarar batch, archived, measured, comparison y restored`);
      continue;
    }
    if (batch.archived.length > scope.maxBatch) {
      violations.push(`${donde}: archiva ${batch.archived.length} archivos y el contrato permite ${scope.maxBatch}: con una tanda más grande, una regresión no se puede atribuir a un archivo`);
    }
    for (const entry of batch.archived) {
      checkArchived(entry, index + 1, record, scope, io, violations);
      if (isObject(entry)) archivados.add(entry.path);
    }
    checkMeasurement(batch.measured, ids, donde, violations);
    if (!COMPARISONS.has(batch.comparison)) {
      violations.push(`${donde}: comparison debe ser una de ${[...COMPARISONS].join(', ')}`);
    }
    if (batch.comparison === 'peor' && batch.restored.length === 0) {
      violations.push(`${donde}: salió peor que la línea base y no devolvió nada. Una regresión se arregla devolviendo las líneas mínimas, no dejándola pasar`);
    }
    for (const vuelta of batch.restored) {
      if (!exactKeys(vuelta, ['path', 'lines', 'why']) || !longEnough(vuelta.why)) {
        violations.push(`${donde}: una restauración no dice qué líneas volvieron ni por qué`);
      }
    }
  }

  if (!isObject(record.rollback_tested) || record.rollback_tested.done !== true || !longEnough(record.rollback_tested.evidence)) {
    violations.push('la vuelta atrás no se probó: restaurar, verificar y volver a limpiar es uno de los cuatro criterios de término');
  }
  if (!longEnough(record.rollback_command)) {
    violations.push('no hay un comando de vuelta atrás escrito');
  }

  const sobrevivientes = new Set();
  for (const entry of Array.isArray(record.survivors) ? record.survivors : []) {
    if (!exactKeys(entry, ['path', 'why']) || !longEnough(entry.why)) {
      violations.push('un sobreviviente no trae la frase que dice por qué se queda');
      continue;
    }
    sobrevivientes.add(entry.path);
  }
  if (!Array.isArray(record.inventory) || record.inventory.length === 0) {
    violations.push('no hay inventario: sin la lista de lo que había antes, no se puede decir qué sobrevivió ni cuánto pesaba');
  }
  for (const entry of Array.isArray(record.inventory) ? record.inventory : []) {
    if (!isObject(entry) || archivados.has(entry.path) || sobrevivientes.has(entry.path)) continue;
    violations.push(`${entry.path} sobrevivió y no hay una frase que diga por qué: no poder decirlo en una línea es la señal de que nadie lo miró`);
  }
  if (!isObject(record.totals) || !exactKeys(record.totals, ['words_before', 'words_after', 'files_before', 'files_after'])) {
    violations.push('faltan los totales de antes y después en palabras y archivos');
  }
  return violations;
}

/** `~/` se expande contra el home real; lo demás se resuelve contra la raíz del proyecto. */
function makeExists(root) {
  return (path) => {
    const raw = String(path);
    return existsSync(raw.startsWith('~/') ? join(homedir(), raw.slice(2)) : resolve(root, raw));
  };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const read = options.read ?? readFileSync;
  if (args.length !== 2 || args[0] !== 'check' || args[1] === '') {
    writeError(USAGE);
    return 2;
  }
  const path = args[1];
  const root = options.root ?? process.cwd();

  let scope;
  try {
    const contractPath = options.root === undefined ? SCOPE_PATH : join(root, 'contracts', 'ablation-scope.json');
    scope = loadScope(JSON.parse(stripBom(read(contractPath, 'utf8'))));
  } catch (error) {
    writeError(`REJECTED: no se pudo leer el contrato de alcance: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }

  // La ruta se resuelve ANTES de abrirla (regla #46: la lectura no se reimplementa).
  const resolver = options.safePath ?? safeProjectFile;
  let archivo;
  try {
    archivo = resolver(root, path);
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  if (archivo === null) {
    write(`${EMPTY}: no hay ninguna corrida de limpieza en ${path}. Esto no verificó nada.`);
    write(LIMITS_TEXT);
    return 0;
  }
  let record;
  try {
    record = JSON.parse(stripBom(read(archivo, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') {
      write(`${EMPTY}: no hay ninguna corrida de limpieza en ${path}. Esto no verificó nada.`);
      write(LIMITS_TEXT);
      return 0;
    }
    writeError(`REJECTED: ${path} no es JSON válido ni se pudo leer: ${error.message}`);
    writeError(LIMITS_TEXT);
    return 1;
  }

  const io = { exists: options.exists ?? makeExists(root) };
  const violations = validateAblation(record, scope, io);
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${path}: ${violation}`);
    writeError(LIMITS_TEXT);
    return 1;
  }
  const tandas = record.batches.length;
  const archivados = record.batches.reduce((total, batch) => total + batch.archived.length, 0);
  write(`OK: ${path} registra ${tandas} tanda(s) y ${archivados} archivo(s) archivado(s), cada uno con motivo escrito, medido contra un set de ${record.test_set.length} pruebas, y con la vuelta atrás probada. Nada se borró: cada archivo está en el archivo y ya no en su lugar.`);
  write(LIMITS_TEXT);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-ablation.mjs')) {
  process.exitCode = main();
}
