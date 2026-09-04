// Pruebas del gate de citas del research externo. Las que llevan FALSIFICACION atacan al gate:
// arman un contrato que deberia pasar por sano y comprueban que el gate no se lo crea.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import {
  LIMIT,
  SCHEMA,
  STATUSES,
  USAGE,
  compareReportToContract,
  extractCitations,
  main,
  parseArgs,
  readContract,
  summarize,
  validateCitationRecords,
  validateSweep,
} from '../scripts/verify-research-citations.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio de VCP: le preguntan a git o a un gate por ESTE checkout. Adentro del
// runtime instalado de otra persona no tienen nada que afirmar -- y ademas el instalador gitignora
// el runtime, asi que git no puede contestar. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const script = join(repoRoot, 'scripts', 'verify-research-citations.mjs');

const REPORT = [
  'Prosa cualquiera que no cita nada.',
  'El gate de garden-skills `update-readme.mjs:79-81` pasa en verde si borras el marcador.',
  'Y marin `lib/marin/src/marin/execution/artifact.py:396` trata sin registro como sin deriva.',
].join('\n');

/** Un contrato sano para ese informe: las dos citas registradas y resueltas. */
function healthyContract(overrides = {}) {
  return {
    schema: SCHEMA,
    revalidated: '2026-08-30',
    report: 'research/x.md',
    corpus: { declared_files: 2, materialized_files: 2, readable_files: 2, scanned_files: 2 },
    sources: [
      { slug: 'ConardLi/garden-skills', commit: 'aaf9a82f', files: 1 },
      { slug: 'marin-community/marin', commit: 'dc584e76', files: 1 },
    ],
    citations: [
      {
        raw: 'update-readme.mjs:79-81',
        report_line: 2,
        status: 'RESOLVED',
        repo: 'ConardLi/garden-skills',
        path: 'scripts/release/update-readme.mjs',
        line_start: 79,
        line_end: 81,
        sha256: 'a'.repeat(64),
      },
      {
        raw: 'lib/marin/src/marin/execution/artifact.py:396',
        report_line: 3,
        status: 'RESOLVED',
        repo: 'marin-community/marin',
        path: 'lib/marin/src/marin/execution/artifact.py',
        line_start: 396,
        line_end: 396,
        sha256: 'b'.repeat(64),
      },
    ],
    ...overrides,
  };
}

test('parseArgs solo acepta la forma check <contrato>', () => {
  assert.deepEqual(parseArgs(['check', 'c.json']), { contract: 'c.json' });
  assert.equal(parseArgs([]), null);
  assert.equal(parseArgs(['check']), null);
  assert.equal(parseArgs(['check', '']), null);
  assert.equal(parseArgs(['verify', 'c.json']), null);
});

test('readContract rechaza un esquema que no es el suyo', () => {
  const read = () => JSON.stringify({ schema: 'otro/v9', citations: [] });
  const { document, error } = readContract('c.json', read);
  assert.equal(document, null);
  assert.match(error, /esquema/iu);
});

test('readContract rechaza un JSON que no parsea', () => {
  const { document, error } = readContract('c.json', () => '{ roto');
  assert.equal(document, null);
  assert.ok(error.length > 0);
});

test('extractCitations encuentra cada cita con su linea del informe', () => {
  const found = extractCitations(REPORT);
  assert.equal(found.length, 2);
  assert.equal(found[0].raw, 'update-readme.mjs:79-81');
  assert.equal(found[0].report_line, 2);
  assert.equal(found[0].line_start, 79);
  assert.equal(found[0].line_end, 81);
  assert.equal(found[1].line_start, 396);
  assert.equal(found[1].line_end, 396);
});

test('FALSIFICACION · una cita nueva en el informe sin revalidar no pasa en verde', () => {
  const contract = healthyContract();
  const conNueva = `${REPORT}\nY googletest \`gtest.cc:6019\` baraja con semilla.`;
  const fallas = compareReportToContract(extractCitations(conNueva), contract.citations);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /gtest\.cc:6019/u);
});

test('FALSIFICACION · un registro que ya no corresponde a ninguna cita del informe se denuncia', () => {
  const contract = healthyContract();
  contract.citations.push({
    raw: 'borrada.py:1',
    report_line: 99,
    status: 'RESOLVED',
    repo: 'google/googletest',
    path: 'x.py',
    line_start: 1,
    line_end: 1,
    sha256: 'c'.repeat(64),
  });
  const fallas = compareReportToContract(extractCitations(REPORT), contract.citations);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /borrada\.py:1/u);
});

test('FALSIFICACION · un contrato con cero citas sobre un informe que si las tiene no pasa', () => {
  const fallas = compareReportToContract(extractCitations(REPORT), []);
  assert.equal(fallas.length, 2);
});

test('validateCitationRecords rechaza un estado que no esta en el conjunto cerrado', () => {
  const contract = healthyContract();
  contract.citations[0].status = 'PROBABLEMENTE_BIEN';
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /PROBABLEMENTE_BIEN/u);
});

test('FALSIFICACION · una cita RESOLVED sin huella del contenido citado no pasa', () => {
  const contract = healthyContract();
  delete contract.citations[0].sha256;
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /sha256/u);
});

test('FALSIFICACION · una cita RESOLVED sin ruta ni repo no pasa', () => {
  const contract = healthyContract();
  delete contract.citations[1].path;
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /path/u);
});

test('FALSIFICACION · una cita no resuelta sin motivo escrito no pasa', () => {
  const contract = healthyContract();
  contract.citations[0] = { raw: 'update-readme.mjs:79-81', report_line: 2, status: 'ELIDED_PATH' };
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /motivo/iu);
});

test('una cita no resuelta con motivo escrito si pasa', () => {
  const contract = healthyContract();
  contract.citations[0] = {
    raw: 'update-readme.mjs:79-81',
    report_line: 2,
    status: 'ELIDED_PATH',
    reason: 'el informe la abrevia con puntos suspensivos y no identifica un archivo',
  };
  assert.deepEqual(validateCitationRecords(contract.citations, contract.sources), []);
});

test('FALSIFICACION · una cita atribuida a un repo que el contrato no pinea no pasa', () => {
  const contract = healthyContract();
  contract.citations[0].repo = 'inventado/repo';
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /inventado\/repo/u);
});

test('FALSIFICACION · un rango de lineas invertido o cero no pasa', () => {
  const contract = healthyContract();
  contract.citations[0].line_start = 81;
  contract.citations[0].line_end = 79;
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /rango/iu);
});

test('summarize cuenta por estado y no inventa denominador', () => {
  const contract = healthyContract();
  contract.citations[1].status = 'ELIDED_PATH';
  contract.citations[1].reason = 'abreviada en el informe';
  delete contract.citations[1].sha256;
  const resumen = summarize(contract.citations);
  assert.equal(resumen.total, 2);
  assert.equal(resumen.resolved, 1);
  assert.equal(resumen.by_status.RESOLVED, 1);
  assert.equal(resumen.by_status.ELIDED_PATH, 1);
});

test('STATUSES es un conjunto cerrado con los estados que el barrido produce', () => {
  for (const estado of ['RESOLVED', 'ELIDED_PATH', 'AMBIGUOUS', 'AMBIGUOUS_SAME_REPO', 'FILE_NOT_FOUND', 'LINE_OUT_OF_RANGE']) {
    assert.ok(STATUSES.has(estado), `falta ${estado}`);
  }
  assert.ok(!STATUSES.has('PROBABLEMENTE_BIEN'));
});

test('main acepta el contrato sano e imprime el limite junto al OK', () => {
  const files = new Map([
    ['c.json', JSON.stringify(healthyContract())],
    ['research/x.md', REPORT],
  ]);
  const salida = [];
  const code = main(['check', 'c.json'], { readFile: (p) => files.get(String(p)) }, (m) => salida.push(m), () => {});
  const texto = salida.join('\n');
  assert.equal(code, 0, texto);
  assert.match(texto, /^OK: /mu);
  assert.match(texto, /2 cita/u);
  assert.ok(texto.includes(LIMIT), 'el OK tiene que viajar con su limite');
});

test('main informa VACIO cuando el informe no cita nada, en vez de un verde comun', () => {
  const contract = healthyContract({ citations: [] });
  const files = new Map([
    ['c.json', JSON.stringify(contract)],
    ['research/x.md', 'Prosa sin una sola cita.'],
  ]);
  const salida = [];
  const code = main(['check', 'c.json'], { readFile: (p) => files.get(String(p)) }, (m) => salida.push(m), () => {});
  assert.equal(code, 0);
  assert.match(salida.join('\n'), /^VACÍO: /mu);
});

test('main rechaza y nombra el token cuando una cita quedo sin revalidar', () => {
  const files = new Map([
    ['c.json', JSON.stringify(healthyContract({ citations: [] }))],
    ['research/x.md', REPORT],
  ]);
  const errores = [];
  const code = main(['check', 'c.json'], { readFile: (p) => files.get(String(p)) }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: RESEARCH_CITATIONS_DRIFT/u);
});

test('main rechaza un contrato invalido con su propio token', () => {
  const files = new Map([['c.json', JSON.stringify({ schema: 'otro/v1' })]]);
  const errores = [];
  const code = main(['check', 'c.json'], { readFile: (p) => files.get(String(p)) }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: RESEARCH_CITATIONS_CONTRACT_INVALID/u);
});

test('main rechaza cuando el informe declarado no se puede leer', () => {
  const files = new Map([['c.json', JSON.stringify(healthyContract())]]);
  const errores = [];
  const code = main(
    ['check', 'c.json'],
    {
      readFile: (p) => {
        const v = files.get(String(p));
        if (v === undefined) throw new Error('no existe');
        return v;
      },
    },
    () => {},
    (m) => errores.push(m),
  );
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: RESEARCH_CITATIONS_REPORT_UNREADABLE/u);
});

test('main rechaza un registro de cita mal formado con su token', () => {
  const contract = healthyContract();
  delete contract.citations[0].sha256;
  const files = new Map([
    ['c.json', JSON.stringify(contract)],
    ['research/x.md', REPORT],
  ]);
  const errores = [];
  const code = main(['check', 'c.json'], { readFile: (p) => files.get(String(p)) }, () => {}, (m) => errores.push(m));
  assert.equal(code, 1);
  assert.match(errores.join('\n'), /REJECTED: RESEARCH_CITATIONS_RECORD_INVALID/u);
});

test('main sin argumentos imprime el uso y devuelve 2', () => {
  const errores = [];
  const code = main([], {}, () => {}, (m) => errores.push(m));
  assert.equal(code, 2);
  assert.equal(errores.join('\n'), USAGE);
});

test('el gate corre de verdad contra el contrato del repositorio', SOLO_FUENTE, () => {
  const run = spawnSync(process.execPath, [script, 'check', 'contracts/research-citations.json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^OK: /mu);
  assert.ok(run.stdout.includes(LIMIT));
});

test('el CLI rechaza argumentos sin leer nada', SOLO_FUENTE, () => {
  const run = spawnSync(process.execPath, [script], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage:/u);
});

test('readContract informa cuando el archivo del contrato no se puede leer', () => {
  const { document, error } = readContract('c.json', () => {
    throw new Error('ENOENT');
  });
  assert.equal(document, null);
  assert.match(error, /no se puede leer el contrato/u);
});

test('readContract exige lista de citas, lista de fuentes e informe declarado', () => {
  const sinCitas = readContract('c.json', () => JSON.stringify({ schema: SCHEMA }));
  assert.match(sinCitas.error, /lista de citas/u);

  const sinFuentes = readContract('c.json', () => JSON.stringify({ schema: SCHEMA, citations: [] }));
  assert.match(sinFuentes.error, /fuentes pineadas/u);

  const sinInforme = readContract('c.json', () => JSON.stringify({ schema: SCHEMA, citations: [], sources: [] }));
  assert.match(sinInforme.error, /qué informe cubre/u);
});

test('FALSIFICACION · una cita RESOLVED sin repo no pasa', () => {
  const contract = healthyContract();
  delete contract.citations[0].repo;
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /sin repo/u);
});

test('FALSIFICACION · una cita no resuelta atribuida a un repo sin pinear no pasa', () => {
  const contract = healthyContract();
  contract.citations[0] = {
    raw: 'update-readme.mjs:79-81',
    report_line: 2,
    status: 'AMBIGUOUS',
    repo: 'inventado/repo',
    reason: 'hay varios archivos con ese nombre',
  };
  const fallas = validateCitationRecords(contract.citations, contract.sources);
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /inventado\/repo/u);
});

test('validateCitationRecords sin lista de fuentes trata todo repo como no pineado', () => {
  const contract = healthyContract();
  const fallas = validateCitationRecords(contract.citations, undefined);
  assert.equal(fallas.length, 2);
  assert.match(fallas[0], /no pinea/u);
});

test('summarize sobre citas sin ninguna resuelta informa cero, no undefined', () => {
  const resumen = summarize([{ raw: 'x.py:1', report_line: 1, status: 'ELIDED_PATH', reason: 'abreviada' }]);
  assert.equal(resumen.total, 1);
  assert.equal(resumen.resolved, 0);
  assert.equal(resumen.by_status.RESOLVED, undefined);
});

test('validateSweep exige que cada sonda declare patron, motivo y sus conteos', () => {
  const sano = [{ id: 'x', why: 'porque si', pattern: 'append-only', files: 3, repos: 2 }];
  assert.deepEqual(validateSweep({ scanned: 10, probes: sano }), []);

  const sinPatron = [{ id: 'x', why: 'porque si', files: 0, repos: 0 }];
  assert.match(validateSweep({ scanned: 10, probes: sinPatron })[0], /patrón/iu);

  const sinMotivo = [{ id: 'x', pattern: 'a', files: 0, repos: 0 }];
  assert.match(validateSweep({ scanned: 10, probes: sinMotivo })[0], /motivo/iu);
});

test('FALSIFICACION · una sonda cuyo patron no compila no pasa por sonda valida', () => {
  const rota = [{ id: 'x', why: 'porque si', pattern: '[sin cerrar', files: 0, repos: 0 }];
  const fallas = validateSweep({ scanned: 10, probes: rota });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /no compila/u);
});

test('FALSIFICACION · una sonda con mas repos que archivos declara un imposible', () => {
  const imposible = [{ id: 'x', why: 'porque si', pattern: 'a', files: 1, repos: 5 }];
  const fallas = validateSweep({ scanned: 10, probes: imposible });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /repo/u);
});

test('FALSIFICACION · un barrido que dice haber escaneado cero archivos no sostiene una sonda en cero', () => {
  const fallas = validateSweep({ scanned: 0, probes: [{ id: 'x', why: 'y', pattern: 'a', files: 0, repos: 0 }] });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /cero archivos/u);
});

test('validateSweep sin bloque de barrido no inventa violaciones', () => {
  assert.deepEqual(validateSweep(undefined), []);
});

test('FALSIFICACION · una sonda con conteos que no son enteros no pasa', () => {
  const fallas = validateSweep({ scanned: 10, probes: [{ id: 'x', why: 'y', pattern: 'a', files: '3', repos: 1 }] });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /enteros/u);
});

test('FALSIFICACION · una sonda con mas hallazgos que archivos escaneados no pasa', () => {
  const fallas = validateSweep({ scanned: 10, probes: [{ id: 'x', why: 'y', pattern: 'a', files: 99, repos: 1 }] });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /escaneado/u);
});

test('el contrato del repositorio trae el barrido y sus seis sondas validas', SOLO_FUENTE, () => {
  const raw = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'research-citations.json'), 'utf8'));
  assert.equal(raw.sweep.probes.length, 6);
  assert.ok(raw.sweep.scanned > 14000, `escaneados: ${raw.sweep.scanned}`);
  assert.deepEqual(validateSweep(raw.sweep), []);
  const bash = raw.sweep.probes.find((p) => p.id === 'cobertura-bash-ps4');
  assert.equal(bash.files, 0, 'la sonda de cobertura de bash tiene que seguir en cero sobre el corpus');
});

test('FALSIFICACION · un barrido sin lista de sondas no aporta ninguna evidencia', () => {
  assert.deepEqual(validateSweep({ scanned: 10 }), []);
  assert.deepEqual(validateSweep({ scanned: 10, probes: 'seis' }), []);
});

test('FALSIFICACION · una sonda sin id y un escaneo sin número se nombran igual', () => {
  const fallas = validateSweep({ scanned: 'muchos', probes: [{ why: 'y', pattern: 'a', files: 0, repos: 0 }] });
  assert.equal(fallas.length, 1);
  assert.match(fallas[0], /\(sin id\)/u);
  assert.match(fallas[0], /cero archivos/u);
});
