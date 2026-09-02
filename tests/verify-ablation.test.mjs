import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EMPTY, LIMITS, SCHEMA, USAGE, globToRegExp, loadScope, main, validateAblation } from '../scripts/verify-ablation.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUTA = 'docs/ablation.json';
const ARCHIVO = '.claude-archive/2026-09-01';

const scope = () => JSON.parse(readScope());
function readScope() {
  return JSON.stringify({
    schema: 'vcp.ablation-scope/1',
    why: 'motivo del contrato, largo suficiente para pasar el mínimo',
    golden_rule: 'En la limpieza NO EXISTE rm. Nada se borra: todo se mueve.',
    in_scope: [{ path: '~/.claude/skills', why: 'las skills globales cargan palabras en cada sesión' }],
    untouchable: [
      { pattern: '**/*.mq5', why: 'regla dura del usuario: pérdida irreversible, no está en git' },
      { pattern: '.git/**', why: 'es el único backup real que existe' },
    ],
    test_set: { min: 6, max: 8, why: 'menos de seis no cubre lo que la persona hace de verdad' },
    batch: { max_files: 5, why: 'de a cinco se puede atribuir una regresión a un archivo concreto' },
  });
}

const prueba = (n) => ({ test_id: `t${n}`, task: `tarea representativa número ${n}`, why_representative: `es una de las cosas que la persona hace todas las semanas, caso ${n}` });
const medicion = (n, outcome = 'igual') => ({ test_id: `t${n}`, outcome, evidence: `salida real de la corrida ${n}, citada entera` });

function archivado(nombre, over = {}) {
  return {
    path: `~/.claude/skills/${nombre}.md`,
    archived_to: `${ARCHIVO}/.claude/skills/${nombre}.md`,
    repetible: false,
    requisito: false,
    repartible: false,
    verdict: 'ARCHIVAR',
    reason: `no pasa ninguna de las tres R: no se usa más de tres veces al mes y no trae ningún dato propio`,
    ...over,
  };
}

function registro(over = {}) {
  const ids = [1, 2, 3, 4, 5, 6];
  return {
    schema: SCHEMA,
    run_id: '2026-09-01',
    archive_dir: ARCHIVO,
    rollback_command: `git checkout -- . && mv ${ARCHIVO}/.claude ~/.claude`,
    rollback_tested: { done: true, evidence: 'se restauró, se corrió el set completo y volvió a limpiarse' },
    test_set: ids.map(prueba),
    baseline: ids.map((n) => medicion(n)),
    inventory: [
      { path: '~/.claude/skills/vieja.md', words: 400, percent: 40, last_modified: '2026-01-02' },
      { path: '~/.claude/skills/util.md', words: 600, percent: 60, last_modified: '2026-08-30' },
    ],
    batches: [
      {
        batch: 1,
        archived: [archivado('vieja')],
        measured: ids.map((n) => medicion(n)),
        comparison: 'igual',
        restored: [],
      },
    ],
    survivors: [{ path: '~/.claude/skills/util.md', why: 'trae las rutas y el tono propios, que el modelo no puede adivinar' }],
    totals: { words_before: 1000, words_after: 600, files_before: 2, files_after: 1 },
    ...over,
  };
}

function corrida(registroJson, args = ['check', RUTA], { archivoExiste = true, originalExiste = false, contrato = readScope() } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const salida = [];
  const errores = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), contrato, 'utf8');
    if (registroJson !== null) writeFileSync(join(root, RUTA), registroJson, 'utf8');
    const code = main(args, {
      root,
      write: (l) => salida.push(l),
      writeError: (l) => errores.push(l),
      // El chequeo de "nada se borró" mira el disco: se inyecta para no depender de rutas reales.
      exists: (p) => (String(p).includes('.claude-archive') ? archivoExiste : originalExiste),
    });
    return { code, salida: salida.join('\n'), errores: errores.join('\n') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

// --- Falso rojo: un registro completo y honesto tiene que pasar ----------------------------------

test('un registro completo de una ablación bien hecha sale en verde', () => {
  const { code, errores, salida } = corrida(json(registro()));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
  assert.match(salida, /1 tanda|1 archivo/u);
});

test('el contrato real del repo se carga sin violaciones', () => {
  const { violations } = loadScope(JSON.parse(readScope()));
  assert.deepEqual(violations, []);
});

// --- La regla de oro: nada se borra --------------------------------------------------------------

test('FALSIFICACIÓN · si un archivo archivado no está en el archivo, se rechaza: eso es un borrado', () => {
  const { code, errores } = corrida(json(registro()), ['check', RUTA], { archivoExiste: false });
  assert.equal(code, 1);
  assert.match(errores, /no está en el archivo|se borró|borrad/iu);
});

test('FALSIFICACIÓN · si el original sigue en su lugar, no se movió nada y el registro miente', () => {
  const { code, errores } = corrida(json(registro()), ['check', RUTA], { originalExiste: true });
  assert.equal(code, 1);
  assert.match(errores, /sigue en su lugar|no se movió/iu);
});

test('FALSIFICACIÓN · archivar algo intocable se rechaza por el patrón que lo protege', () => {
  const malo = registro();
  malo.batches[0].archived = [archivado('x', { path: 'EA/el expert advisor.mq5', archived_to: `${ARCHIVO}/EA/el expert advisor.mq5` })];
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /mq5/iu);
});

// --- El filtro de las 3R: archivar algo que aprueba una R es contradecir el propio filtro ---------

test('FALSIFICACIÓN · archivar un archivo que aprueba alguna R se rechaza', () => {
  for (const r of ['repetible', 'requisito', 'repartible']) {
    const malo = registro();
    malo.batches[0].archived = [archivado('vieja', { [r]: true })];
    const { code, errores } = corrida(json(malo));
    assert.deepEqual({ r, code, acusa: new RegExp(r, 'iu').test(errores) }, { r, code: 1, acusa: true });
  }
});

test('FALSIFICACIÓN · un veredicto que no sea ARCHIVAR no puede aparecer en una tanda archivada', () => {
  const malo = registro();
  malo.batches[0].archived = [archivado('vieja', { verdict: 'QUEDA' })];
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /QUEDA|veredicto/iu);
});

test('FALSIFICACIÓN · un archivado sin motivo escrito se rechaza: archivar sin razón es borrar con otro nombre', () => {
  const malo = registro();
  malo.batches[0].archived = [archivado('vieja', { reason: 'no sirve' })];
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /motivo|reason/iu);
});

// --- La medición: sin línea base no hay ablación, hay borrado con buena letra ---------------------

test('FALSIFICACIÓN · un set de pruebas más chico que el mínimo del contrato se rechaza', () => {
  const malo = registro({ test_set: [1, 2, 3].map(prueba), baseline: [1, 2, 3].map((n) => medicion(n)) });
  malo.batches[0].measured = [1, 2, 3].map((n) => medicion(n));
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /set de pruebas|6/u);
});

test('FALSIFICACIÓN · una tanda que no volvió a medir todas las pruebas se rechaza', () => {
  const malo = registro();
  malo.batches[0].measured = [1, 2, 3].map((n) => medicion(n));
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /midió|medicion|medición/iu);
});

test('FALSIFICACIÓN · una tanda que empeoró y no restauró nada se rechaza', () => {
  const malo = registro();
  malo.batches[0].comparison = 'peor';
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /peor/iu);
});

test('una tanda que empeoró y devolvió las líneas mínimas pasa', () => {
  const bueno = registro();
  bueno.batches[0].comparison = 'peor';
  bueno.batches[0].restored = [{ path: '~/.claude/skills/vieja.md', lines: '12-14', why: 'esas tres líneas traían las rutas del proyecto y sin ellas la prueba t3 falló' }];
  const { code, errores } = corrida(json(bueno));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FALSIFICACIÓN · una tanda de más de cinco archivos se rechaza: una regresión no se podría atribuir', () => {
  const malo = registro();
  malo.batches[0].archived = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => archivado(n));
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /cinco|5/u);
});

// --- Los cuatro criterios de término --------------------------------------------------------------

test('FALSIFICACIÓN · sin el rollback probado no se cierra', () => {
  const malo = registro({ rollback_tested: { done: false, evidence: '' } });
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /rollback|vuelta atrás/iu);
});

test('FALSIFICACIÓN · un archivo que sobrevivió sin una razón escrita se rechaza', () => {
  const malo = registro({ survivors: [] });
  const { code, errores } = corrida(json(malo));
  assert.equal(code, 1);
  assert.match(errores, /util\.md|sobreviv/iu);
});

// --- Entradas y límites ---------------------------------------------------------------------------

test('sin registro el gate escribe VACÍO y sale 0: un proyecto que no limpió no incumple nada', () => {
  const { code, salida } = corrida(null);
  assert.equal(code, 0);
  assert.match(salida, new RegExp(EMPTY, 'u'));
});

test('un registro que no es JSON se informa como tal', () => {
  const { code, errores } = corrida('{no es json');
  assert.equal(code, 1);
  assert.match(errores, /JSON/iu);
});

test('un uso inválido sale 2 con el usage', () => {
  for (const args of [[], ['check'], ['check', ''], ['verificar', RUTA], ['check', RUTA, 'de-mas']]) {
    const { code, errores } = corrida(json(registro()), args);
    assert.deepEqual({ args: args.join(' '), code, usage: errores.includes(USAGE) }, { args: args.join(' '), code: 2, usage: true });
  }
});

test('el límite se imprime en verde Y en rojo', () => {
  const verde = corrida(json(registro()));
  const rojo = corrida(json(registro({ survivors: [] })));
  assert.deepEqual(
    { verde: `${verde.salida}${verde.errores}`.includes(LIMITS), rojo: `${rojo.salida}${rojo.errores}`.includes(LIMITS) },
    { verde: true, rojo: true },
  );
});

test('validateAblation devuelve la lista de violaciones sin lanzar nunca', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  assert.deepEqual(validateAblation(registro(), contrato, { exists: (p) => String(p).includes('.claude-archive') }), []);
  assert.equal(validateAblation(null, contrato, { exists: () => true }).length > 0, true);
  assert.equal(validateAblation({ schema: 'otro' }, contrato, { exists: () => true }).length > 0, true);
});

test('FALSIFICACIÓN · un contrato de alcance roto se informa como contrato roto, no como registro malo', () => {
  const { code, errores } = corrida(json(registro()), ['check', RUTA], { contrato: '{"schema":"otra-cosa"}' });
  assert.equal(code, 1);
  assert.match(errores, /contrato/iu);
});

test('el gate del repo vive junto a su contrato real', () => {
  const errores = [];
  const code = main(['check', 'docs/ablation.json'], { root: repoRoot, write: () => {}, writeError: (l) => errores.push(l) });
  // Todavía no hay ninguna corrida de limpieza en el repo: eso es VACÍO, no incumplimiento.
  assert.deepEqual({ code, errores }, { code: 0, errores: [] });
});

test('el comparador de rutas protegidas hace lo que dice, caso por caso', () => {
  // Se prueba caso por caso a propósito: la primera versión de esta función daba el resultado
  // correcto por un motivo que no pude explicar — tenía bytes NUL literales adentro, y sus
  // `replaceAll('')` no eran cadenas vacías. Un comparador que protege los `.mq5` no puede
  // depender de eso.
  const casos = [
    ['**/*.mq5', 'EA/el expert advisor.mq5', true],
    ['**/*.mq5', 'el expert advisor.mq5', true],
    ['**/*.mq5', 'EA/sub/el expert advisor.mq5', true],
    ['**/*.mq5', 'EA/el expert advisor.ex5', false],
    ['.git/**', '.git/config', true],
    ['.git/**', '.git/a/b/c', true],
    ['.git/**', 'docs/x.md', false],
    ['src/**', 'src/a.js', true],
    ['src/**', 'srcx/a.js', false],
    ['~/.claude/settings.json', '~/.claude/settings.json', true],
    ['~/.claude/settings.json', '~/.claude/settings.json.bak', false],
    ['**/.env', 'app/.env', true],
    ['**/.env', '.env', true],
    ['**/.env', 'app/.environment', false],
  ];
  const dio = casos.map(([patron, ruta]) => globToRegExp(patron).test(ruta));
  assert.deepEqual(dio, casos.map(([, , esperado]) => esperado));
});

test('FALSIFICACIÓN · ningún script del repo tiene bytes de control: eso oculta lo que el código hace', () => {
  const sospechosos = [];
  for (const carpeta of ['scripts', 'tests']) {
    for (const archivo of readdirSync(join(repoRoot, carpeta))) {
      const bytes = readFileSync(join(repoRoot, carpeta, archivo));
      for (const byte of bytes) {
        if (byte === 0 || byte < 9 || (byte > 13 && byte < 32)) {
          sospechosos.push(`${carpeta}/${archivo}`);
          break;
        }
      }
    }
  }
  assert.deepEqual(sospechosos, []);
});


// --- El contrato de alcance roto se informa como contrato roto -----------------------------------

test('FALSIFICACIÓN · un contrato sin patrones intocables, o con uno mal escrito, se rechaza', () => {
  const casos = [
    { untouchable: [] },
    { untouchable: [{ pattern: '', why: 'un motivo suficientemente largo para pasar el mínimo' }] },
    { untouchable: [{ pattern: '**/*.mq5', why: 'corto' }] },
    { untouchable: ['no soy un objeto'] },
    { test_set: { min: 0, max: 8, why: 'x' } },
    { test_set: { min: 9, max: 8, why: 'x' } },
    { test_set: 'no soy objeto' },
    { batch: { max_files: 0, why: 'x' } },
    { batch: 'no soy objeto' },
  ];
  for (const caso of casos) {
    const roto = { ...JSON.parse(readScope()), ...caso };
    const { violations } = loadScope(roto);
    assert.deepEqual({ caso: JSON.stringify(caso).slice(0, 40), hay: violations.length > 0 }, { caso: JSON.stringify(caso).slice(0, 40), hay: true });
  }
});

test('loadScope sobre algo que no es el contrato devuelve una violación, no lanza', () => {
  for (const entrada of [null, 'texto', 42, { schema: 'otro' }]) {
    assert.equal(loadScope(entrada).violations.length, 1);
  }
});

// --- El set de pruebas y las mediciones ----------------------------------------------------------

test('FALSIFICACIÓN · un set más grande que el máximo, o mal escrito, se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const casos = [
    { test_set: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(prueba) },
    { test_set: [{ test_id: 't1' }, ...[2, 3, 4, 5, 6].map(prueba)] },
    { test_set: [{ test_id: 't1', task: 'corto', why_representative: 'corto' }, ...[2, 3, 4, 5, 6].map(prueba)] },
    { test_set: [prueba(1), prueba(1), ...[3, 4, 5, 6].map(prueba)] },
  ];
  for (const caso of casos) {
    assert.equal(validateAblation(registro(caso), contrato, io).length > 0, true);
  }
});

test('FALSIFICACIÓN · una medición sin evidencia, o que no es una lista, se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const sinEvidencia = registro();
  sinEvidencia.baseline = [1, 2, 3, 4, 5, 6].map((n) => ({ test_id: `t${n}`, outcome: 'igual', evidence: 'corto' }));
  assert.equal(validateAblation(sinEvidencia, contrato, io).length > 0, true);
  assert.equal(validateAblation(registro({ baseline: 'no soy lista' }), contrato, io).length > 0, true);
});

// --- Las tandas ----------------------------------------------------------------------------------

test('FALSIFICACIÓN · una tanda mal formada, o un archivado con claves de más, se rechazan', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const clavesDeMas = registro();
  clavesDeMas.batches[0].archived = [{ ...archivado('vieja'), extra: 1 }];
  const rNoBooleana = registro();
  rNoBooleana.batches[0].archived = [archivado('vieja', { repetible: 'no' })];
  const fueraDelArchivo = registro();
  fueraDelArchivo.batches[0].archived = [archivado('vieja', { archived_to: 'otro-lado/vieja.md' })];
  const comparacionRara = registro();
  comparacionRara.batches[0].comparison = 'mas o menos';
  const restauracionVaga = registro();
  restauracionVaga.batches[0].comparison = 'peor';
  restauracionVaga.batches[0].restored = [{ path: 'x', lines: '1', why: 'corto' }];
  for (const caso of [clavesDeMas, rNoBooleana, fueraDelArchivo, comparacionRara, restauracionVaga,
    registro({ batches: 'no soy lista' }), registro({ batches: [{ batch: 1 }] })]) {
    assert.equal(validateAblation(caso, contrato, io).length > 0, true);
  }
});

// --- Los cuatro criterios de término --------------------------------------------------------------

test('FALSIFICACIÓN · sin comando de vuelta atrás, sin totales, o con un sobreviviente sin razón, no se cierra', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  for (const caso of [
    registro({ rollback_command: 'mv' }),
    registro({ rollback_tested: 'no soy objeto' }),
    registro({ totals: { words_before: 1 } }),
    registro({ survivors: [{ path: 'x' }] }),
    registro({ survivors: [{ path: '~/.claude/skills/util.md', why: 'corto' }] }),
    registro({ survivors: 'no soy lista' }),
    registro({ inventory: 'no soy lista' }),
  ]) {
    assert.equal(validateAblation(caso, contrato, io).length > 0, true);
  }
});

test('FALSIFICACIÓN · un registro con claves de más se rechaza entero, y un contrato roto tapa todo lo demás', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: () => true };
  assert.equal(validateAblation({ ...registro(), extra: 1 }, contrato, io).length, 1);
  assert.equal(validateAblation(registro(), { ...contrato, violations: ['contrato roto'] }, io).length, 1);
});

// --- Entradas del CLI -----------------------------------------------------------------------------

test('un registro con BOM se parsea igual: el BOM no es JSON inválido', () => {
  const { code, errores } = corrida(String.fromCharCode(0xFEFF) + json(registro()));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FALSIFICACIÓN · si el contrato de alcance no se puede leer, se dice eso y no otra cosa', () => {
  const { code, errores } = corrida(json(registro()), ['check', RUTA], { contrato: '{roto' });
  assert.equal(code, 1);
  assert.match(errores, /contrato de alcance/iu);
});

test('sin inyectar exists, el gate mira el disco de verdad', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const errores = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    mkdirSync(join(root, ARCHIVO, '.claude', 'skills'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    writeFileSync(join(root, ARCHIVO, '.claude', 'skills', 'vieja.md'), 'archivada', 'utf8');
    // El origen es una ruta con `~/` que no existe: cubre las dos ramas de la expansión.
    const real = registro();
    real.batches[0].archived = [archivado('vieja', { path: '~/.claude/skills/__vcp-inexistente__.md' })];
    real.inventory = [{ path: '~/.claude/skills/__vcp-inexistente__.md', words: 400, percent: 40, last_modified: '2026-01-02' }];
    real.survivors = [];
    writeFileSync(join(root, RUTA), json(real), 'utf8');
    const code = main(['check', RUTA], { root, write: () => {}, writeError: (l) => errores.push(l) });
    assert.deepEqual({ code, errores }, { code: 0, errores: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · una ruta que escapa del proyecto se rechaza sin abrirla', () => {
  const { code, errores } = corrida(json(registro()), ['check', '../afuera.json']);
  assert.equal(code, 1);
  assert.match(errores, /REJECTED/u);
});

test('un contrato sin la lista de intocables se informa, no lanza', () => {
  const sinLista = JSON.parse(readScope());
  delete sinLista.untouchable;
  assert.equal(loadScope(sinLista).violations.length > 0, true);
});

test('FALSIFICACIÓN · un set de pruebas que ni siquiera es una lista se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  assert.equal(validateAblation(registro({ test_set: 'no soy lista' }), contrato, io).length > 0, true);
});

test('si el registro desaparece entre resolver la ruta y leerlo, eso es VACÍO y no un rechazo', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const salida = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    writeFileSync(join(root, RUTA), json(registro()), 'utf8');
    let primera = true;
    const code = main(['check', RUTA], {
      root,
      write: (l) => salida.push(l),
      writeError: () => {},
      read: (p, enc) => {
        // El contrato se lee bien; el registro desaparece justo después de resolverse la ruta.
        if (primera) { primera = false; return readFileSync(p, enc); }
        const error = new Error('ENOENT'); error.code = 'ENOENT'; throw error;
      },
    });
    assert.deepEqual({ code, vacio: salida.join('\n').includes(EMPTY) }, { code: 0, vacio: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
