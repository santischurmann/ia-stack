#!/usr/bin/env node
// verify-research-citations.mjs — gate mecanico de las citas del research externo.
//
//   node scripts/verify-research-citations.mjs check <research-citations.json>
//
// EL PROBLEMA QUE RESUELVE. El informe de research externo apoya sus conclusiones en 138 citas
// `archivo:linea` que apuntan a catorce repositorios ajenos, pineados a un commit. Durante dos dias
// ese informe declaro, con todas las letras, que nadie las habia revalidado y que no se podian
// verificar sin volver a clonar las catorce fuentes. Una afirmacion sostenida por evidencia que
// nadie puede revisar es exactamente lo que este proyecto llama decoracion.
//
// COMO SE ARREGLA, Y POR QUE ASI. La revalidacion de verdad -clonar 15581 archivos, resolver cada
// cita contra su commit pineado, leer la linea citada- se hace una vez y queda escrita en el
// contrato. Los clones pesan mas de un giga y no pueden vivir en el repositorio, asi que el gate
// no los necesita: compara el informe contra el registro de esa revalidacion. Si alguien agrega una
// cita al informe y no la revalida, el gate lo ve; si borra una cita, tambien. La revalidacion cara
// pasa una vez, la deteccion de deriva es barata y corre siempre.
//
// OCHO REGLAS, TODAS MECANICAS:
//   1. El contrato declara su esquema y parsea.
//   2. Toda cita que esta en el informe figura en el contrato. Una cita nueva sin revalidar frena.
//   3. Todo registro del contrato corresponde a una cita del informe. Un registro huerfano frena.
//   4. El estado de cada cita sale de un conjunto cerrado. Un estado inventado frena.
//   5. Una cita RESOLVED trae repo, ruta y la huella del contenido citado. Sin huella no hay
//      revalidacion, hay afirmacion.
//   6. Una cita que NO resolvio trae su motivo escrito. Un hueco sin explicar frena.
//   7. Todo repo que una cita nombra esta pineado en `sources` con su commit.
//   8. El rango de lineas es coherente: empieza en uno o mas y no termina antes de empezar.
//   9. Si el contrato trae el barrido mecanico, cada sonda declara su patron -que tiene que
//      compilar-, la hipotesis que pone a prueba, y conteos posibles. Un cero solo es evidencia si
//      se ve con que patron se busco y sobre cuantos archivos.
//
// LO QUE NO PRUEBA, y hay que decirlo antes de que alguien lo lea como una auditoria de la fuente:
// verifica que el REGISTRO de la revalidacion cubra cada cita del informe, no que la revalidacion
// haya sido honesta. Los clones no estan en el repositorio y este gate no sale a la red, asi que un
// contrato escrito a mano con huellas inventadas pasa igual. El ancla contra eso esta afuera: el
// contrato se commitea y la cadena de auditoria lo cubre.
//
// Y una cita en RESOLVED significa que el archivo y la linea existen en el commit pineado, NO que
// esa linea sostenga lo que el informe afirma sobre ella. Juzgar eso es leer, no comparar.

import { readFileSync } from 'node:fs';
import { mismoSchema } from './schema-compat.mjs';

export const USAGE = 'usage: verify-research-citations.mjs check <research-citations.json>';
export const SCHEMA = 'ia.research-citations/v1';

export const LIMIT =
  'Límite: esto compara el informe contra el registro de la revalidación, no contra los repositorios. ' +
  'Los clones no están acá y el gate no sale a la red: un contrato con huellas inventadas pasa igual. ' +
  'Y una cita resuelta dice que el archivo y la línea existen, no que digan lo que el informe afirma.';

/** El conjunto cerrado de estados. Cualquier otro es un estado inventado y frena el gate. */
export const STATUSES = new Set([
  'RESOLVED',
  'ELIDED_PATH',
  'AMBIGUOUS',
  'AMBIGUOUS_SAME_REPO',
  'FILE_NOT_FOUND',
  'LINE_OUT_OF_RANGE',
  'UNREADABLE',
]);

/** Los estados que NO son una resolucion y por eso exigen motivo escrito. */
const NEEDS_REASON = new Set([...STATUSES].filter((s) => s !== 'RESOLVED'));

const CITE =
  /`([A-Za-z0-9_./-]+\.(?:py|mjs|js|ts|tsx|sh|md|json|yml|yaml|toml|cc|h|cpp|ps1|txt)):(\d+)(?:-(\d+))?`/gu;

const SHA256 = /^[0-9a-f]{64}$/u;

export function parseArgs(args) {
  if (args.length === 2 && args[0] === 'check' && args[1] !== '') return { contract: args[1] };
  return null;
}

export function readContract(path, readFile = readFileSync) {
  let raw;
  try {
    raw = String(readFile(path, 'utf8'));
  } catch (error) {
    return { document: null, error: `no se puede leer el contrato: ${error.message}` };
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    return { document: null, error: `el contrato no es JSON válido: ${error.message}` };
  }
  if (!mismoSchema(document?.schema, SCHEMA)) {
    return { document: null, error: `el esquema declarado no es ${SCHEMA}` };
  }
  if (!Array.isArray(document.citations)) {
    return { document: null, error: 'el contrato no trae una lista de citas' };
  }
  if (!Array.isArray(document.sources)) {
    return { document: null, error: 'el contrato no trae la lista de fuentes pineadas' };
  }
  if (typeof document.report !== 'string' || document.report === '') {
    return { document: null, error: 'el contrato no declara qué informe cubre' };
  }
  return { document, error: null };
}

/** Saca del texto del informe cada cita `archivo:linea`, con la linea del informe donde aparece. */
export function extractCitations(text) {
  const found = [];
  const lines = String(text).split(/\r?\n/u);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(CITE)) {
      found.push({
        raw: `${match[1]}:${match[2]}${match[3] ? `-${match[3]}` : ''}`,
        path: match[1],
        line_start: Number(match[2]),
        line_end: match[3] ? Number(match[3]) : Number(match[2]),
        report_line: index + 1,
      });
    }
  });
  return found;
}

// El separador es un NUL porque es el unico byte que no puede aparecer ni en el texto de una cita
// ni en un numero de linea: con un separador imprimible, dos citas distintas podrian producir la
// misma clave. Se escribe con String.fromCharCode y no crudo: un NUL en el fuente hace que git y
// grep traten a este gate como binario.
const KEY_SEPARATOR = String.fromCharCode(0);
const keyOf = (citation) => `${citation.raw}${KEY_SEPARATOR}${citation.report_line}`;

/** Reglas 2 y 3: el informe y el contrato tienen que cubrir exactamente las mismas citas. */
export function compareReportToContract(reportCitations, contractCitations) {
  const violations = [];
  const inContract = new Map();
  for (const record of contractCitations) inContract.set(keyOf(record), record);
  const inReport = new Set(reportCitations.map(keyOf));

  for (const citation of reportCitations) {
    if (!inContract.has(keyOf(citation))) {
      violations.push(
        `la cita \`${citation.raw}\` de la línea ${citation.report_line} del informe no figura en el contrato: quedó sin revalidar`,
      );
    }
  }
  for (const record of contractCitations) {
    if (!inReport.has(keyOf(record))) {
      violations.push(
        `el contrato registra \`${record.raw}\` en la línea ${record.report_line}, que ya no es una cita del informe: el registro quedó viejo`,
      );
    }
  }
  return violations;
}

/** Reglas 4 a 8: cada registro es utilizable como evidencia, o dice por qué no lo es. */
export function validateCitationRecords(citations, sources) {
  const violations = [];
  const pinned = new Set((sources ?? []).map((source) => source.slug));

  for (const record of citations) {
    const at = `\`${record.raw}\` (informe línea ${record.report_line})`;

    if (!STATUSES.has(record.status)) {
      violations.push(`${at}: el estado ${record.status} no está en el conjunto cerrado de estados`);
      continue;
    }

    if (record.status === 'RESOLVED') {
      if (typeof record.repo !== 'string' || record.repo === '') {
        violations.push(`${at}: resuelta pero sin repo`);
        continue;
      }
      if (typeof record.path !== 'string' || record.path === '') {
        violations.push(`${at}: resuelta pero sin path del archivo citado`);
        continue;
      }
      if (typeof record.sha256 !== 'string' || !SHA256.test(record.sha256)) {
        violations.push(`${at}: resuelta pero sin sha256 del contenido citado; sin huella no hay revalidación`);
        continue;
      }
      if (!Number.isInteger(record.line_start) || !Number.isInteger(record.line_end) || record.line_start < 1 || record.line_end < record.line_start) {
        violations.push(`${at}: el rango de líneas ${record.line_start}-${record.line_end} no es coherente`);
        continue;
      }
      if (!pinned.has(record.repo)) {
        violations.push(`${at}: la atribuye a ${record.repo}, que el contrato no pinea en sus fuentes`);
        continue;
      }
    } else if (NEEDS_REASON.has(record.status)) {
      if (typeof record.reason !== 'string' || record.reason.trim() === '') {
        violations.push(`${at}: quedó en ${record.status} y no trae el motivo escrito`);
        continue;
      }
      if (typeof record.repo === 'string' && record.repo !== '' && !pinned.has(record.repo)) {
        violations.push(`${at}: la atribuye a ${record.repo}, que el contrato no pinea en sus fuentes`);
        continue;
      }
    }
  }
  return violations;
}

/** Regla 9: el barrido mecanico declara sus sondas y sus conteos, o no es evidencia.
 * Un resultado en cero solo vale si el patron que lo produjo esta a la vista y compila, y si el
 * barrido dice sobre cuantos archivos corrio. Cero hallazgos sobre cero archivos no prueba nada. */
export function validateSweep(sweep) {
  if (!sweep) return [];
  const violations = [];
  const probes = Array.isArray(sweep.probes) ? sweep.probes : [];
  const scanned = Number.isInteger(sweep.scanned) ? sweep.scanned : 0;

  for (const probe of probes) {
    const at = `sonda ${probe?.id ?? '(sin id)'}`;
    if (typeof probe?.pattern !== 'string' || probe.pattern === '') {
      violations.push(`${at}: no declara su patrón, así que su resultado no se puede revisar`);
      continue;
    }
    try {
      new RegExp(probe.pattern, 'u');
    } catch {
      violations.push(`${at}: su patrón no compila como expresión regular`);
      continue;
    }
    if (typeof probe.why !== 'string' || probe.why.trim() === '') {
      violations.push(`${at}: no declara el motivo, o sea qué hipótesis pone a prueba`);
      continue;
    }
    if (!Number.isInteger(probe.files) || !Number.isInteger(probe.repos) || probe.files < 0 || probe.repos < 0) {
      violations.push(`${at}: sus conteos de archivos y repos no son números enteros`);
      continue;
    }
    if (probe.repos > probe.files) {
      violations.push(`${at}: declara ${probe.repos} repo(s) con hallazgos sobre ${probe.files} archivo(s), que es imposible`);
      continue;
    }
    if (probe.files > scanned) {
      violations.push(`${at}: declara ${probe.files} archivo(s) con hallazgos sobre ${scanned} escaneado(s)`);
      continue;
    }
    if (scanned === 0) {
      violations.push(`${at}: el barrido dice haber escaneado cero archivos, así que su resultado no sostiene nada`);
      continue;
    }
  }
  return violations;
}

/** Cuenta por estado. El denominador es el que hay, no uno estimado. */
export function summarize(citations) {
  const byStatus = {};
  for (const record of citations) {
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
  }
  return { total: citations.length, resolved: byStatus.RESOLVED ?? 0, by_status: byStatus };
}

export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const readFile = options.readFile ?? readFileSync;

  const { document, error } = readContract(parsed.contract, readFile);
  if (error !== null) {
    writeError(`REJECTED: RESEARCH_CITATIONS_CONTRACT_INVALID: ${error}`);
    return 1;
  }

  let reportText;
  try {
    reportText = String(readFile(document.report, 'utf8'));
  } catch (readError) {
    writeError(
      `REJECTED: RESEARCH_CITATIONS_REPORT_UNREADABLE: no se puede leer ${document.report}: ${readError.message}`,
    );
    return 1;
  }

  const recordViolations = [
    ...validateCitationRecords(document.citations, document.sources),
    ...validateSweep(document.sweep),
  ];
  if (recordViolations.length > 0) {
    writeError(`REJECTED: RESEARCH_CITATIONS_RECORD_INVALID:\n  ${recordViolations.join('\n  ')}`);
    return 1;
  }

  const reportCitations = extractCitations(reportText);
  const drift = compareReportToContract(reportCitations, document.citations);
  if (drift.length > 0) {
    writeError(`REJECTED: RESEARCH_CITATIONS_DRIFT:\n  ${drift.join('\n  ')}`);
    return 1;
  }

  if (reportCitations.length === 0) {
    write(`VACÍO: ${document.report} no trae una sola cita archivo:línea, así que no hay nada que revalidar.`);
    write(LIMIT);
    return 0;
  }

  const summary = summarize(document.citations);
  const pending = Object.entries(summary.by_status)
    .filter(([status]) => status !== 'RESOLVED')
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
  const sources = document.sources.length;

  write(
    `OK: ${summary.total} cita(s) del informe están todas registradas contra ${sources} fuente(s) pineadas; ` +
      `${summary.resolved} resuelven a un archivo y una línea que existen en su commit${pending ? `, y ${pending} con su motivo escrito` : ''}.`,
  );
  write(LIMIT);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-research-citations.mjs')) {
  process.exitCode = main();
}
