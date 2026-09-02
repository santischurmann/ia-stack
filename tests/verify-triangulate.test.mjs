// TRIANGULATE existía en el protocolo como prosa adentro del bucle de Build: quien refactorizaba
// decidía solo qué vectores buscó, y nadie podía leer después cuáles miró. Sin una lista fija se
// revisa lo que uno ya sabe buscar, que es justo lo que no encuentra nada nuevo — medido en esta
// misma sesión, la lista de gates con verde vacío se armó tres veces leyendo código y quedó corta
// las tres.
//
// El gate comprueba FORMA: que los 26 vectores del contrato estén declarados uno por uno, que un
// `covered` nombre la prueba que lo cubre y que un `not_applicable` o un `pending` traigan motivo.
// No comprueba que esa prueba ejercite ese vector.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-triangulate.mjs');
const { COMPLETE_FLAG, SCHEMA, STATES, USAGE, loadVectors, main, validateTriangulate } = await import(pathToFileURL(script).href);

const contrato = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'triangulate-vectors.json'), 'utf8'));
const IDS = contrato.vectors.map((v) => v.vector_id);
const motivo = 'motivo suficientemente largo para ser un motivo escrito y no una excusa';

function expediente(overrides = {}) {
  const vectors = Object.fromEntries(IDS.map((id) => [id, { state: 'covered', test: 'tests/ejemplo.test.mjs' }]));
  return { schema: SCHEMA, feature: 'demo-feature', date: '2026-09-01', vectors, ...overrides };
}
function correr(contenido, ...flags) {
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/triangulate/x.json', ...flags], {
    read: (ruta) => {
      if (String(ruta).includes('triangulate-vectors')) return JSON.stringify(contrato);
      if (contenido instanceof Error) throw contenido;
      return JSON.stringify(contenido);
    },
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  return { code, salida, errores };
}

test('AC1 · un expediente con los 26 vectores declarados sale en verde y dice el reparto', () => {
  const documento = expediente();
  documento.vectors[IDS[0]] = { state: 'not_applicable', reason: motivo };
  const { code, salida, errores } = correr(documento);
  assert.equal(code, 0, errores.join(' || '));
  assert.match(salida.at(-1), /^OK: /u);
  assert.match(salida.at(-1), /25 cubierto\(s\), 1 no aplica\(n\), 0 pendiente\(s\)/u,
    'un verde que no dice el reparto no deja ver cuánto se miró de verdad');
});

test('AC2 · FALSIFICACIÓN · un vector que falta o uno que el contrato no tiene se rechazan por nombre', () => {
  const falta = expediente();
  delete falta.vectors[IDS[5]];
  assert.ok(correr(falta).errores.join(' ').includes(IDS[5]), 'aceptó un expediente al que le falta un vector');

  const sobra = expediente();
  sobra.vectors.vector_inventado = { state: 'covered', test: 'tests/x.test.mjs' };
  assert.ok(correr(sobra).errores.join(' ').includes('vector_inventado'), 'aceptó un vector que el contrato no declara');
});

test('AC3 · FALSIFICACIÓN · cubierto sin nombrar la prueba es una afirmación sin respaldo', () => {
  for (const roto of [{ state: 'covered' }, { state: 'covered', test: '' }, { state: 'covered', test: 'x', reason: 'de más' }]) {
    const documento = expediente();
    documento.vectors[IDS[3]] = roto;
    const { code, errores } = correr(documento);
    assert.equal(code, 1, `aceptó ${JSON.stringify(roto)}`);
    assert.ok(errores.join(' ').includes(IDS[3]), errores.join(' || '));
  }
});

test('AC4 · FALSIFICACIÓN · descartar o postergar un vector sin motivo es no haberlo mirado', () => {
  for (const state of ['not_applicable', 'pending']) {
    for (const roto of [{ state }, { state, reason: '' }, { state, reason: 'corto' }]) {
      const documento = expediente();
      documento.vectors[IDS[7]] = roto;
      assert.equal(correr(documento).code, 1, `aceptó ${state} con ${JSON.stringify(roto)}`);
    }
  }
  const inventado = expediente();
  inventado.vectors[IDS[9]] = { state: 'quizas', reason: motivo };
  assert.ok(correr(inventado).errores.join(' ').includes('state'), 'aceptó un estado que no existe');
  assert.deepEqual([...STATES].sort(), ['covered', 'not_applicable', 'pending']);
});

test('AC5 · un pendiente informa sin bloquear, y bloquea con --require-complete', () => {
  const documento = expediente();
  documento.vectors[IDS[2]] = { state: 'pending', reason: motivo };
  const suave = correr(documento);
  assert.equal(suave.code, 0, suave.errores.join(' || '));
  assert.match(suave.salida.at(-1), /1 pendiente\(s\)/u);

  const estricto = correr(documento, COMPLETE_FLAG);
  assert.equal(estricto.code, 1, 'con la bandera, un pendiente tiene que frenar el cierre');
  assert.ok(estricto.errores.join(' ').includes(IDS[2]), 'el rechazo tiene que nombrar el vector que falta');
});

test('AC6 · sin expediente informa VACÍO, y un esquema ajeno se rechaza antes de mirar los vectores', () => {
  const ausente = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const vacio = correr(ausente);
  assert.equal(vacio.code, 0);
  assert.match(vacio.salida.at(-1), /^VACÍO: /u);

  const ajeno = correr({ schema: 'otra.cosa/9' });
  assert.equal(ajeno.code, 1);
  assert.ok(ajeno.errores.join(' ').includes(SCHEMA));
  assert.equal(ajeno.errores.join(' ').includes(IDS[0]), false, 'enumeró vectores de un archivo que no es un expediente');
});

test('FALSIFICACIÓN · uso inválido, JSON roto y contrato ilegible se distinguen entre sí', () => {
  const errores = [];
  const io = { read: () => '{', write: () => {}, writeError: (l) => errores.push(l) };
  assert.equal(main([], io), 2);
  assert.equal(errores.at(-1), USAGE);
  assert.equal(main(['check', 'x.json', '--otra'], io), 2, 'una bandera desconocida es error de uso');
  assert.equal(main(['check', ''], io), 2);
  assert.equal(correr({ schema: SCHEMA, feature: 'x', date: 'ayer', vectors: {} }).code, 1);

  const contratoRoto = [];
  const code = main(['check', 'docs/triangulate/x.json'], {
    read: (ruta) => (String(ruta).includes('triangulate-vectors') ? '{' : JSON.stringify(expediente())),
    write: () => {}, writeError: (l) => contratoRoto.push(l),
  });
  assert.equal(code, 1);
  assert.match(contratoRoto.at(-1), /contrato/u, 'un contrato ilegible no puede leerse como un expediente incompleto');
});

test('FALSIFICACIÓN · loadVectors y validateTriangulate no lanzan sobre basura', () => {
  for (const basura of [null, undefined, 42, 'texto', [], {}, { vectors: 'no' }, { vectors: [] }]) {
    assert.ok(Array.isArray(loadVectors(basura).violations), `loadVectors lanzó sobre ${JSON.stringify(basura)}`);
    assert.ok(validateTriangulate(basura, IDS).length > 0, `validateTriangulate no acusó nada sobre ${JSON.stringify(basura)}`);
  }
  assert.deepEqual(validateTriangulate(expediente(), IDS), []);
  assert.equal(loadVectors(contrato).violations.length, 0);
  assert.deepEqual(loadVectors(contrato).ids, IDS);
  assert.equal(IDS.length, 26, 'el encargo lista veintiséis vectores');
});

test('correr el gate dos veces sobre la misma entrada da el mismo resultado', () => {
  // Un gate que solo funciona la primera vez no es un gate. validateTriangulate es puro: no guarda
  // estado entre llamadas, y esto lo fija en vez de suponerlo.
  const documento = expediente();
  documento.vectors[IDS[1]] = { state: 'pending', reason: motivo };
  const primera = correr(documento);
  const segunda = correr(documento);
  assert.deepEqual(segunda, primera, 'dos corridas idénticas dieron resultados distintos');
  assert.deepEqual(validateTriangulate(documento, IDS), validateTriangulate(documento, IDS));
});

test('FALSIFICACIÓN · un archivo válido con BOM no se reporta como JSON inválido', () => {
  // El BOM rompe JSON.parse y el archivo puede estar perfecto: decir "no es JSON válido" manda a
  // buscar el error donde no está. Se saca antes de parsear, tanto del expediente como del contrato.
  const BOM = String.fromCharCode(0xFEFF);
  const salida = [];
  const errores = [];
  const code = main(['check', 'docs/triangulate/x.json'], {
    read: (ruta) => BOM + JSON.stringify(String(ruta).includes('triangulate-vectors') ? contrato : expediente()),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
  });
  assert.equal(code, 0, errores.join(' || '));
  assert.match(salida.at(-1), /^OK: /u);
});

test('FALSIFICACIÓN · un contrato de vectores mal formado se rechaza como contrato, no como expediente', () => {
  // Estas ramas las nombró la cobertura una por una. Un contrato roto que se leyera como expediente
  // incompleto mandaría a corregir el archivo equivocado.
  const conVectors = (vectors) => ({ schema: 'vcp.triangulate-vectors/1', why: motivo, vectors });
  const casos = [
    [conVectors([]), 'al menos un vector'],
    [conVectors('no es lista'), 'al menos un vector'],
    [conVectors([{ vector_id: 'x', name: 'n' }]), 'vector_id, name y why'],
    [conVectors([{ vector_id: '', name: 'n', why: motivo }]), 'no declara un vector_id'],
    [conVectors([{ vector_id: 42, name: 'n', why: motivo }]), 'no declara un vector_id'],
    [conVectors([{ vector_id: 'x', name: 'n', why: motivo }, { vector_id: 'x', name: 'n', why: motivo }]), 'repite x'],
    [conVectors([{ vector_id: 'x', name: 'n', why: 'corto' }]), 'no dice por qué importa'],
  ];
  for (const [roto, esperado] of casos) {
    const violaciones = loadVectors(roto).violations;
    assert.ok(violaciones.some((v) => v.includes(esperado)), `no acusó "${esperado}": ${violaciones.join(' || ')}`);
  }

  // Y por la CLI: un contrato mal formado frena antes de mirar el expediente.
  const errores = [];
  const code = main(['check', 'docs/triangulate/x.json'], {
    read: (ruta) => JSON.stringify(String(ruta).includes('triangulate-vectors') ? conVectors([]) : expediente()),
    write: () => {}, writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1);
  assert.match(errores.at(-1), /contrato de vectores/u);
});

test('FALSIFICACIÓN · la cabecera del expediente se rechaza campo por campo', () => {
  for (const [override, esperado] of [
    [{ feature: '' }, 'feature'],
    [{ feature: 42 }, 'feature'],
    [{ date: undefined }, 'date'],
    [{ date: 'ayer' }, 'date'],
    [{ vectors: 'no es un objeto' }, 'vectors debe ser un objeto'],
    [{ vectors: [] }, 'vectors debe ser un objeto'],
  ]) {
    const violaciones = validateTriangulate(expediente(override), IDS);
    assert.ok(violaciones.some((v) => v.includes(esperado)),
      `no acusó ${esperado} con ${JSON.stringify(override)}: ${violaciones.join(' || ')}`);
  }
});

test('FALSIFICACIÓN · un expediente ilegible por otro motivo no se confunde con uno ausente', () => {
  const errores = [];
  const permiso = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const code = main(['check', 'docs/triangulate/x.json'], {
    read: (ruta) => { if (String(ruta).includes('triangulate-vectors')) return JSON.stringify(contrato); throw permiso; },
    write: () => {}, writeError: (l) => errores.push(l),
  });
  assert.equal(code, 1, 'trató un problema de permisos como un proyecto que todavía no trianguló');
  assert.doesNotMatch(errores.at(-1), /VACÍO/u);
});
