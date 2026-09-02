// La sintesis del research agrupa 14.897 entradas por capacidad y las llama «señales de adopción».
// Son filtros lexicales: un puntaje que cuenta palabras de una lista. El informe lo declara, pero
// nada impedia que alguien adoptara una idea porque salio con puntaje 22, y ese salto no dejaba
// rastro ni tenia donde escribir el contraejemplo.
//
// El gate comprueba FORMA y procedencia: que la fuente sea una de las pineadas, que el commit sea
// el que el contrato pineo para ella, que la evidencia cite archivo y linea, y que el
// contraejemplo no sea la evidencia repetida. No abre el archivo citado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-research-candidates.mjs');
const { DECISIONS, SCHEMA, USAGE, loadPinned, main, validateCandidates } = await import(pathToFileURL(script).href);

const contrato = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'research-citations.json'), 'utf8'));
const PIN = new Map(contrato.sources.map((s) => [s.slug, s.commit]));
const FUENTE = contrato.sources[0].slug;
const COMMIT = PIN.get(FUENTE);
const largo = 'texto suficientemente largo para no ser una excusa de dos palabras';

function candidato(overrides = {}) {
  return {
    candidate_id: 'C1', source: FUENTE, commit: COMMIT,
    file: 'lib/egress-receipt.ts', line: 392, function: 'buildEgressReceipt',
    problem: `problema que resuelve, ${largo}`,
    evidence: [{ locator: 'lib/egress-receipt.ts:392', quote: `lo que dice la linea citada, ${largo}` }],
    counterexample: `donde esta idea falla o no aplica, ${largo}`,
    cost: `lo que cuesta traerlo, ${largo}`,
    risk: `que se rompe si sale mal, ${largo}`,
    compatibility: `como encaja con lo que ya existe, ${largo}`,
    decision: 'defer',
    test_needed: `la prueba que tendria que existir antes de adoptarlo, ${largo}`,
    ...overrides,
  };
}
function expediente(...cands) {
  return { schema: SCHEMA, date: '2026-09-01', candidates: cands.length ? cands : [candidato()] };
}
function correr(contenido) {
  const salida = [];
  const errores = [];
  const code = main(['check', 'research/candidates.json'], {
    read: (ruta) => {
      if (String(ruta).includes('research-citations')) return JSON.stringify(contrato);
      if (contenido instanceof Error) throw contenido;
      return JSON.stringify(contenido);
    },
    write: (l) => salida.push(l), writeError: (l) => errores.push(l),
  });
  return { code, salida, errores };
}

test('AC1 · un candidato con sus catorce campos sale en verde y dice el reparto por decisión', () => {
  const { code, salida, errores } = correr(expediente(candidato(), candidato({ candidate_id: 'C2', decision: 'reject' })));
  assert.equal(code, 0, errores.join(' || '));
  assert.match(salida.at(-1), /^OK: /u);
  assert.match(salida.at(-1), /2 candidato\(s\)/u);
  assert.match(salida.at(-1), /0 adopt, 1 defer, 1 reject/u, 'un verde sin el reparto no deja ver qué se está proponiendo');
});

test('AC2 · FALSIFICACIÓN · una fuente ajena o un commit que no es el pineado se rechazan', () => {
  const ajena = correr(expediente(candidato({ source: 'alguien/inventado' })));
  assert.equal(ajena.code, 1);
  assert.ok(ajena.errores.join(' ').includes('alguien/inventado'), 'aceptó una fuente que no está pineada');

  const otroCommit = correr(expediente(candidato({ commit: 'deadbeef' })));
  assert.equal(otroCommit.code, 1);
  assert.ok(otroCommit.errores.join(' ').includes('deadbeef'), 'aceptó un commit que no es el que el contrato pineó');
});

test('AC3 · FALSIFICACIÓN · un puntaje lexical no es una cita', () => {
  // La regla central: la evidencia tiene que apuntar a archivo y línea del archivo declarado.
  // Un número no puede satisfacer eso, y ese era exactamente el salto que nadie registraba.
  for (const roto of [
    { evidence: [] },
    { evidence: 'score lexical 22' },
    { evidence: [{ locator: 'score-22', quote: largo }] },
    { evidence: [{ locator: 'otro/archivo.ts:1', quote: largo }] },
    { evidence: [{ locator: 'lib/egress-receipt.ts', quote: largo }] },
    { evidence: [{ locator: 'lib/egress-receipt.ts:392', quote: '' }] },
    { evidence: [{ locator: 'lib/egress-receipt.ts:392' }] },
  ]) {
    assert.equal(correr(expediente(candidato(roto))).code, 1, `aceptó ${JSON.stringify(roto)}`);
  }
});

test('AC4 · FALSIFICACIÓN · repetir la evidencia no es un contraejemplo', () => {
  const cita = `lo que dice la linea citada, ${largo}`;
  const repetido = candidato({ counterexample: cita, evidence: [{ locator: 'lib/egress-receipt.ts:392', quote: cita }] });
  const { code, errores } = correr(expediente(repetido));
  assert.equal(code, 1, 'aceptó un contraejemplo que es la evidencia copiada');
  assert.ok(errores.join(' ').includes('counterexample'), errores.join(' || '));

  assert.equal(correr(expediente(candidato({ counterexample: '' }))).code, 1);
  assert.equal(correr(expediente(candidato({ counterexample: 'no' }))).code, 1, 'dos letras no son un contraejemplo');
});

test('AC5 · FALSIFICACIÓN · adoptar sin test es adoptar sin condición de adopción', () => {
  assert.equal(correr(expediente(candidato({ decision: 'adopt', test_needed: '' }))).code, 1);
  assert.equal(correr(expediente(candidato({ decision: 'adopt' }))).code, 0, 'un adopt con test declarado sí pasa');
  assert.equal(correr(expediente(candidato({ decision: 'quizas' }))).code, 1, 'aceptó una decisión que no existe');
  assert.deepEqual([...DECISIONS].sort(), ['adopt', 'defer', 'reject']);
});

test('AC6 · sin expediente informa VACÍO, y un esquema ajeno se rechaza antes de mirar candidatos', () => {
  const ausente = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const vacio = correr(ausente);
  assert.equal(vacio.code, 0);
  assert.match(vacio.salida.at(-1), /^VACÍO: /u);

  const ajeno = correr({ schema: 'otra.cosa/9' });
  assert.equal(ajeno.code, 1);
  assert.ok(ajeno.errores.join(' ').includes(SCHEMA));
  assert.equal(ajeno.errores.join(' ').includes('candidate_id'), false, 'enumeró candidatos de un archivo que no lo es');
});

test('FALSIFICACIÓN · los campos obligatorios se rechazan uno por uno, y los ids no se repiten', () => {
  for (const campo of ['candidate_id', 'source', 'commit', 'file', 'function', 'problem', 'cost', 'risk', 'compatibility']) {
    assert.equal(correr(expediente(candidato({ [campo]: '' }))).code, 1, `aceptó ${campo} vacío`);
    const sin = candidato(); delete sin[campo];
    assert.equal(correr(expediente(sin)).code, 1, `aceptó un candidato sin ${campo}`);
  }
  for (const linea of [0, -1, 1.5, '392', null]) {
    assert.equal(correr(expediente(candidato({ line: linea }))).code, 1, `aceptó line = ${JSON.stringify(linea)}`);
  }
  const repetidos = correr(expediente(candidato(), candidato()));
  assert.equal(repetidos.code, 1);
  assert.ok(repetidos.errores.join(' ').includes('C1'), 'dos candidatos con el mismo id no se distinguen después');
});

test('FALSIFICACIÓN · uso inválido, JSON roto, contrato ilegible y lista vacía se distinguen', () => {
  const errores = [];
  const io = { read: () => '{', write: () => {}, writeError: (l) => errores.push(l) };
  assert.equal(main([], io), 2);
  assert.equal(errores.at(-1), USAGE);
  assert.equal(main(['check', 'x.json', 'extra'], io), 2);
  assert.equal(main(['check', ''], io), 2);
  assert.equal(correr(expediente(...[])).code, 0, 'el expediente por defecto trae un candidato');
  assert.equal(correr({ schema: SCHEMA, date: '2026-09-01', candidates: [] }).code, 1, 'una lista vacía no es un expediente');
  assert.equal(correr({ schema: SCHEMA, date: 'ayer', candidates: [candidato()] }).code, 1);

  const contratoRoto = [];
  assert.equal(main(['check', 'research/candidates.json'], {
    read: (ruta) => (String(ruta).includes('research-citations') ? '{' : JSON.stringify(expediente())),
    write: () => {}, writeError: (l) => contratoRoto.push(l),
  }), 1);
  assert.match(contratoRoto.at(-1), /contrato/u);
});

test('FALSIFICACIÓN · loadPinned y validateCandidates no lanzan sobre basura', () => {
  for (const basura of [null, undefined, 42, 'texto', [], {}, { sources: 'no' }, { sources: [] }]) {
    assert.ok(loadPinned(basura) instanceof Map, `loadPinned lanzó sobre ${JSON.stringify(basura)}`);
    assert.ok(validateCandidates(basura, PIN).length > 0, `validateCandidates no acusó nada sobre ${JSON.stringify(basura)}`);
  }
  assert.deepEqual(validateCandidates(expediente(), PIN), []);
  assert.equal(loadPinned(contrato).size, 14);
});

test('FALSIFICACIÓN · fecha ausente, evidencia no-objeto, contrato sin fuentes y lectura fallida', () => {
  // Las nombró la cobertura una por una: verify-research-candidates.mjs:56, :107, :141 y :153.
  assert.ok(validateCandidates({ schema: SCHEMA, candidates: [candidato()] }, PIN).some((v) => v.includes('date')),
    'aceptó un expediente sin fecha');

  // El contraejemplo se compara contra las citas, y una entrada que no es objeto no tiene quote:
  // sin esta rama, comparar contra ella lanzaría en vez de rechazar.
  const evidenciaSuelta = candidato({ evidence: ['una cita suelta que no es un objeto'] });
  const violaciones = validateCandidates({ schema: SCHEMA, date: '2026-09-01', candidates: [evidenciaSuelta] }, PIN);
  assert.ok(violaciones.length > 0);
  assert.ok(violaciones.some((v) => v.includes('locator y quote')), violaciones.join(' || '));

  // Un contrato que parsea pero no declara ninguna fuente utilizable no puede validar procedencia.
  const sinFuentes = [];
  assert.equal(main(['check', 'research/candidates.json'], {
    read: (ruta) => JSON.stringify(String(ruta).includes('research-citations') ? { schema: 'x', sources: [] } : expediente()),
    write: () => {}, writeError: (l) => sinFuentes.push(l),
  }), 1);
  assert.match(sinFuentes.at(-1), /ninguna fuente utilizable/u);

  // Y un expediente ilegible por permisos no es un proyecto que todavía no propuso nada.
  const permiso = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const errores = [];
  assert.equal(main(['check', 'research/candidates.json'], {
    read: (ruta) => { if (String(ruta).includes('research-citations')) return JSON.stringify(contrato); throw permiso; },
    write: () => {}, writeError: (l) => errores.push(l),
  }), 1);
  assert.doesNotMatch(errores.at(-1), /VACÍO/u);
});
