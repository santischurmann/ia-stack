import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EMPTY, LIMITS, RECORD_KEYS, SCHEMA, USAGE, VERDICTS, globToRegExp, loadScope, main, normalizePath, pathCandidates, validateAblation } from '../scripts/verify-ablation.mjs';

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
const medicion = (n, outcome = 'pass') => ({ test_id: `t${n}`, outcome, evidence: `salida real de la corrida ${n}, citada entera` });

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
    backup: {
      graphify: { done: true, evidence: 'graphify update . reconstruyo el grafo antes de mover el primer archivo' },
      obsidian: { done: true, evidence: 'las notas quedaron espejadas en Obsidian/07_Backups_Log con su sha256' },
    },
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
  malo.batches[0].archived = [archivado('x', { path: 'EA/Trader_1.27.mq5', archived_to: `${ARCHIVO}/EA/Trader_1.27.mq5` })];
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

test('una tanda que empeoró, devolvió las líneas mínimas y volvió a medir en igual, pasa', () => {
  // Reemplaza a una prueba anterior que dejaba pasar una tanda con `comparison: "peor"` mientras
  // hubiera algo en `restored`. La auditoría probó que eso contradice el criterio 1 de cierre de
  // PHASE 9 —el set sale igual o mejor que la línea base—: `comparison` es la comparación FINAL,
  // después de devolver lo que haga falta, y una que sigue diciendo «peor» no cerró.
  const bueno = registro();
  bueno.batches[0].comparison = 'igual';
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
  // El repo lleva el registro de una limpieza REAL: la del 2026-09-02 sobre ~/.claude, reconstruida
  // desde la evidencia primaria que quedó en el archivo y verificada contra git. Que este gate lo
  // acepte es la prueba de que el formato sirve para una corrida de verdad y no sólo para fixtures.
  assert.deepEqual({ code, errores }, { code: 0, errores: [] });
});

test('el comparador de rutas protegidas hace lo que dice, caso por caso', () => {
  // Se prueba caso por caso a propósito: la primera versión de esta función daba el resultado
  // correcto por un motivo que no pude explicar — tenía bytes NUL literales adentro, y sus
  // `replaceAll('')` no eran cadenas vacías. Un comparador que protege los `.mq5` no puede
  // depender de eso.
  const casos = [
    ['**/*.mq5', 'EA/Trader.mq5', true],
    ['**/*.mq5', 'Trader.mq5', true],
    ['**/*.mq5', 'EA/sub/Trader.mq5', true],
    ['**/*.mq5', 'EA/Trader.ex5', false],
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
    writeFileSync(join(root, ARCHIVO, '.claude', 'skills', '__vcp-inexistente__.md'), 'archivada', 'utf8');
    // El origen es una ruta con `~/` que no existe: cubre las dos ramas de la expansión.
    const real = registro();
    real.batches[0].archived = [archivado('vieja', {
      path: '~/.claude/skills/__vcp-inexistente__.md',
      archived_to: `${ARCHIVO}/.claude/skills/__vcp-inexistente__.md`,
    })];
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

// --- Los seis defectos que la auditoria adversarial confirmo ejecutando --------------------------
// Todos son evasiones de la lista de intocables o huecos de contabilidad. Se reproducen aca antes
// de tocar el gate. El mas grave: la proteccion de los .mq5 -- REGLA DURA, archivos que no estan
// en git y cuya perdida es irreversible -- se esquivaba escribiendo la extension en mayusculas.

test('A1 · FALSIFICACIÓN · la protección no se esquiva cambiando mayúsculas', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  for (const ruta of ['Bot/EA.MQ5', 'Bot/EA.Mq5', 'BOT/ea.mq5']) {
    const malo = registro();
    malo.batches[0].archived = [archivado('x', { path: ruta, archived_to: `${ARCHIVO}/${ruta}` })];
    const violaciones = validateAblation(malo, contrato, io);
    assert.deepEqual({ ruta, protegido: violaciones.some((v) => /intocable/u.test(v)) }, { ruta, protegido: true });
  }
});

test('A2 · FALSIFICACIÓN · la protección no se esquiva con ./ , con la carpeta a secas ni con ruta absoluta', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const rutas = [
    './.git/config',
    '.git',
    'C:/repo/.git/config',
    'sub/../.git/config',
  ];
  for (const ruta of rutas) {
    const malo = registro();
    malo.batches[0].archived = [archivado('x', { path: ruta, archived_to: `${ARCHIVO}/x.md` })];
    const violaciones = validateAblation(malo, contrato, io);
    assert.deepEqual({ ruta, protegido: violaciones.some((v) => /intocable/u.test(v)) }, { ruta, protegido: true });
  }
});

test('A3 · FALSIFICACIÓN · un intocable escrito sin ~/ sigue estando protegido', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const conTilde = JSON.parse(readScope());
  conTilde.untouchable.push({ pattern: '~/.claude/settings.json', why: 'decide permisos y hooks: ese cambio es de la persona' });
  const scope = loadScope(conTilde);
  for (const ruta of ['.claude/settings.json', '~/.claude/./settings.json', '~/.CLAUDE/settings.json']) {
    const malo = registro();
    malo.batches[0].archived = [archivado('x', { path: ruta, archived_to: `${ARCHIVO}/settings.json` })];
    const violaciones = validateAblation(malo, scope, io);
    assert.deepEqual({ ruta, protegido: violaciones.some((v) => /intocable/u.test(v)) }, { ruta, protegido: true });
  }
  assert.equal(io && contrato ? true : true, true);
});

test('A4 · FALSIFICACIÓN · un inventario escrito como lista de rutas no desactiva la contabilidad', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const malo = registro({ inventory: ['~/.claude/skills/vieja.md', '~/.claude/skills/nadie-lo-miro.md'] });
  assert.equal(validateAblation(malo, contrato, io).length > 0, true);
});

test('A5 · FALSIFICACIÓN · el archivo de destino tiene que estar adentro del proyecto y ser único', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') || String(p).includes('fuera') };
  const vacio = registro({ archive_dir: '' });
  const afuera = registro({ archive_dir: '../fuera-del-proyecto' });
  afuera.batches[0].archived = [archivado('x', { archived_to: '../fuera-del-proyecto/robado.md' })];
  const colision = registro();
  colision.batches[0].archived = [
    archivado('uno', { path: 'a/uno.md', archived_to: `${ARCHIVO}/dump` }),
    archivado('dos', { path: 'b/dos.md', archived_to: `${ARCHIVO}/dump` }),
  ];
  colision.inventory = [
    { path: 'a/uno.md', words: 1, percent: 50, last_modified: '2026-01-01' },
    { path: 'b/dos.md', words: 1, percent: 50, last_modified: '2026-01-01' },
  ];
  colision.survivors = [];
  for (const [nombre, caso] of [['vacio', vacio], ['afuera', afuera], ['colision', colision]]) {
    assert.deepEqual({ nombre, rechaza: validateAblation(caso, contrato, io).length > 0 }, { nombre, rechaza: true });
  }
});

test('A6 · FALSIFICACIÓN · una tanda que quedó peor que la línea base no cierra, aunque haya devuelto líneas', () => {
  // PHASE 9, criterio 1: el set sale igual o mejor que la línea base. `comparison` es la
  // comparación FINAL, después de devolver lo que haga falta: si sigue diciendo peor, no cerró.
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const malo = registro();
  malo.batches[0].comparison = 'peor';
  malo.batches[0].restored = [{ path: '~/.claude/skills/vieja.md', lines: '12-14', why: 'esas tres líneas traían las rutas del proyecto y sin ellas la prueba t3 falló' }];
  assert.equal(validateAblation(malo, contrato, io).length > 0, true);
});

test('FALSIFICACIÓN · una tanda que trae basura en vez de archivados se rechaza, no se saltea', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const malo = registro();
  malo.batches[0].archived = ['~/.claude/skills/vieja.md', null];
  assert.equal(validateAblation(malo, contrato, io).length > 0, true);
});

test('normalizePath y pathCandidates hacen lo que dicen, caso por caso', () => {
  const casos = [
    ['./src/main.py', 'src/main.py'],
    ['C:/repo/.git/config', 'repo/.git/config'],
    ['sub/../.git/config', '.git/config'],
    ['~/.claude/./settings.json', '.claude/settings.json'],
    ['a\\b\\c.md', 'a/b/c.md'],
    ['', ''],
  ];
  assert.deepEqual(casos.map(([entrada]) => normalizePath(entrada)), casos.map(([, salida]) => salida));
  assert.deepEqual(pathCandidates('a/b/c.md'), ['a/b/c.md', 'b/c.md', 'c.md']);
});

// --- Segunda tanda de la auditoria: la regla de oro no era mecanica ------------------------------

test('F3 · FALSIFICACIÓN · un comando de vuelta atrás que borra se rechaza: la regla de oro es mecánica', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const peligrosos = [
    'rm -rf ~/.claude/skills && echo listo',
    'rm ~/.claude/skills/vieja.md y despues restaurar',
    'Remove-Item -Recurse -Force ~/.claude/skills',
    'del /s /q <home>\\.claude\\skills',
  ];
  for (const comando of peligrosos) {
    const violaciones = validateAblation(registro({ rollback_command: comando }), contrato, io);
    assert.deepEqual({ comando: comando.slice(0, 24), rechaza: violaciones.some((v) => /borra|rm/iu.test(v)) }, { comando: comando.slice(0, 24), rechaza: true });
  }
});

test('F4 · FALSIFICACIÓN · archivar algo fuera del alcance declarado se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  // El contrato de prueba declara in_scope solo ~/.claude/skills.
  const malo = registro();
  malo.batches[0].archived = [archivado('x', { path: 'docs/spec.md', archived_to: `${ARCHIVO}/docs/spec.md` })];
  malo.inventory = [{ path: 'docs/spec.md', words: 10, percent: 100, last_modified: '2026-01-01' }];
  malo.survivors = [];
  const violaciones = validateAblation(malo, contrato, io);
  assert.equal(violaciones.some((v) => /alcance/iu.test(v)), true);
});

test('A7 · FALSIFICACIÓN · una tanda cuyas mediciones fallaron no puede declararse igual o mejor', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const malo = registro();
  malo.batches[0].measured = [1, 2, 3, 4, 5, 6].map((n) => ({ test_id: `t${n}`, outcome: 'fail', evidence: `la sesión crashea al arrancar, corrida ${n}` }));
  malo.batches[0].comparison = 'mejor';
  const violaciones = validateAblation(malo, contrato, io);
  assert.equal(violaciones.some((v) => /se declara/u.test(v)), true);
  // Y el texto libre en outcome tampoco pasa: antes nadie lo leía.
  const textoLibre = registro();
  textoLibre.batches[0].measured = [1, 2, 3, 4, 5, 6].map((n) => ({ test_id: `t${n}`, outcome: 'todo bien', evidence: `salida real de la corrida ${n}, citada entera` }));
  assert.equal(validateAblation(textoLibre, contrato, io).some((v) => /outcome/u.test(v)), true);
});

test('A8 · FALSIFICACIÓN · un set de pruebas clonado seis veces no es un set de seis pruebas', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const clon = [1, 2, 3, 4, 5, 6].map((n) => ({
    test_id: `t${n}`,
    task: 'la misma tarea escrita igual para las seis',
    why_representative: 'el mismo motivo escrito igual para las seis',
  }));
  assert.equal(validateAblation(registro({ test_set: clon }), contrato, io).some((v) => /repite|clonad|iguales/iu.test(v)), true);
});

test('A9 · FALSIFICACIÓN · totales que no son números, o que dicen que la limpieza agrandó todo, se rechazan', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  for (const totals of [
    { words_before: 'cero', words_after: 10, files_before: 1, files_after: 1 },
    { words_before: 10, words_after: 999999, files_before: 1, files_after: 1 },
    { words_before: 10, words_after: 5, files_before: -1, files_after: 1 },
  ]) {
    assert.equal(validateAblation(registro({ totals }), contrato, io).length > 0, true);
  }
});

test('F14 · FALSIFICACIÓN · una limpieza sin ninguna tanda no certifica nada', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const vacia = registro({ batches: [], survivors: [
    { path: '~/.claude/skills/vieja.md', why: 'aprueba requisito: trae las rutas propias del proyecto' },
    { path: '~/.claude/skills/util.md', why: 'trae las rutas y el tono propios, que el modelo no puede adivinar' },
  ] });
  // El fixture trae `rollback_tested.done: true`, que es justamente lo que una corrida sin tandas
  // no puede afirmar: no se movió nada, así que no hubo qué restaurar.
  assert.equal(validateAblation(vacia, contrato, io).some((v) => /no archivó nada|vuelta atrás/iu.test(v)), true);
});

test('FALSIFICACIÓN · un contrato sin alcance, con una entrada rota, o sin la regla de oro, se rechaza', () => {
  const base = JSON.parse(readScope());
  const sinAlcance = { ...base };
  delete sinAlcance.in_scope;
  const casos = [
    sinAlcance,
    { ...base, in_scope: [] },
    { ...base, in_scope: [{ path: '', why: 'un motivo suficientemente largo para pasar el mínimo' }] },
    { ...base, in_scope: ['no soy un objeto'] },
    { ...base, in_scope: [{ path: '~/.claude/skills', why: 'corto' }] },
    { ...base, golden_rule: 'limpiamos la configuración con cuidado y buen criterio' },
  ];
  for (const [i, caso] of casos.entries()) {
    assert.deepEqual({ i, rechaza: loadScope(caso).violations.length > 0 }, { i, rechaza: true });
  }
  const sinRegla = { ...base };
  delete sinRegla.golden_rule;
  assert.equal(loadScope(sinRegla).violations.length > 0, true);
});

test('FALSIFICACIÓN · un scope sin lista de alcance no deja pasar nada por omisión', () => {
  // La rama defensiva: si el objeto de alcance llega sin `inScope`, nada puede estar adentro.
  const cojo = { untouchable: [], minTests: 6, maxTests: 8, maxBatch: 5, violations: [] };
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const violaciones = validateAblation(registro(), cojo, io);
  assert.equal(violaciones.some((v) => /alcance/iu.test(v)), true);
});

test('FALSIFICACIÓN · una tanda sin mediciones y una que ya se declaró peor se acusan igual', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const sinMedir = registro();
  sinMedir.batches[0].measured = 'no soy lista';
  assert.equal(validateAblation(sinMedir, contrato, io).length > 0, true);
  const yaPeor = registro();
  yaPeor.batches[0].measured = [1, 2, 3, 4, 5, 6].map((n) => ({ test_id: `t${n}`, outcome: 'fail', evidence: `la prueba ${n} quedó en rojo después de archivar` }));
  yaPeor.batches[0].comparison = 'peor';
  const violaciones = validateAblation(yaPeor, contrato, io);
  assert.deepEqual(
    { acusaPeor: violaciones.some((v) => /peor/iu.test(v)), noAcusaContradiccion: !violaciones.some((v) => /se declara/u.test(v)) },
    { acusaPeor: true, noAcusaContradiccion: true },
  );
});

// --- Tercera tanda: lo que la fase promete y el registro no decia -------------------------------

test('F7 · FALSIFICACIÓN · una limpieza sin respaldo previo en graphify y Obsidian no cierra', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const casos = [
    undefined,
    { graphify: { done: false, evidence: 'no se corrio' }, obsidian: { done: true, evidence: 'las notas quedaron espejadas en Obsidian con su sha256' } },
    { graphify: { done: true, evidence: 'corto' }, obsidian: { done: true, evidence: 'las notas quedaron espejadas en Obsidian con su sha256' } },
    { graphify: { done: true, evidence: 'graphify update . reconstruyo el grafo antes de mover nada' } },
  ];
  for (const [i, backup] of casos.entries()) {
    const malo = registro();
    if (backup === undefined) delete malo.backup; else malo.backup = backup;
    assert.deepEqual({ i, rechaza: validateAblation(malo, contrato, io).length > 0 }, { i, rechaza: true });
  }
});

test('F9 · FALSIFICACIÓN · el destino tiene que conservar la ruta de origen, no aplanarla', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const aplanado = registro();
  aplanado.batches[0].archived = [archivado('vieja', { archived_to: `${ARCHIVO}/vieja.md` })];
  const violaciones = validateAblation(aplanado, contrato, io);
  assert.equal(violaciones.some((v) => /ruta|conserv/iu.test(v)), true);
});

test('F12 · el subcomando `due` dice si pasaron los 7 días, que es lo que dispara la fase', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const salida = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    writeFileSync(join(root, RUTA), json(registro({ run_id: '2026-09-01' })), 'utf8');
    const corr = (hoy) => {
      const out = [];
      const code = main(['due', RUTA, '--today', hoy], { root, write: (l) => out.push(l), writeError: (l) => out.push(l) });
      return { code, texto: out.join('\n') };
    };
    const pronto = corr('2026-09-05');
    const vencido = corr('2026-09-09');
    salida.push(pronto.texto, vencido.texto);
    assert.deepEqual(
      { prontoCode: pronto.code, prontoDice: /falta/iu.test(pronto.texto), vencidoCode: vencido.code, vencidoDice: /toca|vencid|pasaron/iu.test(vencido.texto) },
      { prontoCode: 0, prontoDice: true, vencidoCode: 0, vencidoDice: true },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('F12 · sin ninguna limpieza previa, `due` dice que toca y no se rompe', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const out = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    const code = main(['due', RUTA, '--today', '2026-09-09'], { root, write: (l) => out.push(l), writeError: (l) => out.push(l) });
    assert.deepEqual({ code, dice: /nunca|toca/iu.test(out.join('\n')) }, { code: 0, dice: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un run_id que no es una fecha real se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  for (const run_id of ['no-es-fecha', '2026-02-30', '', null]) {
    assert.deepEqual({ run_id, rechaza: validateAblation(registro({ run_id }), contrato, io).length > 0 }, { run_id, rechaza: true });
  }
});

test('`due` sin --today usa la fecha de hoy, y con un run_id inválido dice que toca', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    const corr = (contenido, args) => {
      const out = [];
      writeFileSync(join(root, RUTA), contenido, 'utf8');
      const code = main(args, { root, write: (l) => out.push(l), writeError: (l) => out.push(l) });
      return { code, texto: out.join('\n') };
    };
    // Sin --today: la fecha la pone el reloj, y una corrida de 2026-09-01 ya está vencida.
    const sinFecha = corr(json(registro({ run_id: '2026-09-01' })), ['due', RUTA]);
    const rotoId = corr(json(registro({ run_id: 'no-es-fecha' })), ['due', RUTA, '--today', '2026-09-09']);
    assert.deepEqual(
      {
        sinFechaCode: sinFecha.code,
        sinFechaDice: /toca|falta/iu.test(sinFecha.texto),
        rotoCode: rotoId.code,
        rotoDice: /toca limpiar/iu.test(rotoId.texto),
      },
      { sinFechaCode: 0, sinFechaDice: true, rotoCode: 0, rotoDice: true },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('`due` sobre una ruta que ni siquiera existe dice que toca, sin romperse', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const out = [];
  try {
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    const code = main(['due', RUTA], { root, write: (l) => out.push(l), writeError: (l) => out.push(l) });
    assert.deepEqual({ code, dice: /nunca se corrió/iu.test(out.join('\n')) }, { code: 0, dice: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · `due` con una bandera inventada o una fecha falsa sale 2 con el usage', () => {
  for (const args of [['due'], ['due', ''], ['due', RUTA, '--ayer', '2026-09-09'], ['due', RUTA, '--today', '2026-02-30'], ['due', RUTA, '--today']]) {
    const { code, errores } = corrida(json(registro()), args);
    assert.deepEqual({ args: args.join(' '), code, usage: errores.includes(USAGE) }, { args: args.join(' '), code: 2, usage: true });
  }
});

test('`due` con la carpeta creada pero sin registro también dice que toca', () => {
  // Cubre la rama en que la ruta se resuelve bien y el archivo simplemente no está, distinta del
  // caso en que ni la carpeta existe: las dos tienen que decir lo mismo.
  const { code, salida } = corrida(null, ['due', RUTA]);
  assert.deepEqual({ code, dice: /nunca se corrió/iu.test(salida) }, { code: 0, dice: true });
});

test('`due` cuando el registro desaparece entre resolver la ruta y leerlo dice que toca, no se rompe', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const salida = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    writeFileSync(join(root, RUTA), json(registro()), 'utf8');
    let primera = true;
    const code = main(['due', RUTA, '--today', '2026-09-09'], {
      root,
      write: (l) => salida.push(l),
      writeError: () => {},
      read: (p, enc) => {
        if (primera) { primera = false; return readFileSync(p, enc); }
        const error = new Error('ENOENT'); error.code = 'ENOENT'; throw error;
      },
    });
    assert.deepEqual({ code, dice: /nunca se corrió/iu.test(salida.join('\n')) }, { code: 0, dice: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- RA-02: el contrato dice que CLAUDE.md se archiva POR LÍNEAS, y el gate exigía que el archivo
// entero desapareciera. Se contradecían: la operación que la fase prescribe para el archivo más
// importante salía roja.

test('RA-02 · archivar líneas sueltas deja el origen en su lugar, y eso es correcto', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') || String(p).includes('CLAUDE.md') };
  const porLineas = registro();
  porLineas.batches[0].archived = [{
    path: '~/.claude/skills/CLAUDE.md',
    archived_to: `${ARCHIVO}/.claude/skills/CLAUDE.md`,
    mode: 'lines',
    lines: '12-31',
    repetible: false,
    requisito: false,
    repartible: false,
    verdict: 'REESCRIBIR',
    reason: 'las veinte líneas de estilo de razonamiento no aprueban ninguna de las tres R; el resto del archivo sí',
  }];
  porLineas.inventory = [{ path: '~/.claude/skills/CLAUDE.md', words: 400, percent: 100, last_modified: '2026-01-02' }];
  porLineas.survivors = [];
  assert.deepEqual(validateAblation(porLineas, contrato, io), []);
});

test('RA-02 · FALSIFICACIÓN · archivar por líneas sin decir cuáles, o con el archivo entero, se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') || String(p).includes('CLAUDE.md') };
  const base = () => {
    const r = registro();
    r.batches[0].archived = [{
      path: '~/.claude/skills/CLAUDE.md',
      archived_to: `${ARCHIVO}/.claude/skills/CLAUDE.md`,
      mode: 'lines',
      lines: '12-31',
      repetible: false,
      requisito: false,
      repartible: false,
      verdict: 'REESCRIBIR',
      reason: 'las veinte líneas de estilo de razonamiento no aprueban ninguna de las tres R',
    }];
    r.inventory = [{ path: '~/.claude/skills/CLAUDE.md', words: 400, percent: 100, last_modified: '2026-01-02' }];
    r.survivors = [];
    return r;
  };
  const sinLineas = base();
  sinLineas.batches[0].archived[0].lines = '';
  const modoRaro = base();
  modoRaro.batches[0].archived[0].mode = 'a medias';
  // Un archivo movido entero declarado como `file` sigue exigiendo que el origen desaparezca.
  const entero = base();
  entero.batches[0].archived[0].mode = 'file';
  entero.batches[0].archived[0].verdict = 'ARCHIVAR';
  for (const [nombre, caso] of [['sin líneas', sinLineas], ['modo raro', modoRaro], ['entero pero presente', entero]]) {
    assert.deepEqual({ nombre, rechaza: validateAblation(caso, contrato, io).length > 0 }, { nombre, rechaza: true });
  }
});

test('FALSIFICACIÓN · un mode que no es ni file ni lines se rechaza por nombre', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const malo = registro();
  malo.batches[0].archived = [{ ...archivado('vieja'), mode: 'a medias' }];
  const violaciones = validateAblation(malo, contrato, io);
  assert.equal(violaciones.some((v) => /mode debe ser/u.test(v)), true);
  // Y `file` explícito es válido: es el modo por defecto dicho en voz alta.
  const explicito = registro();
  explicito.batches[0].archived = [{ ...archivado('vieja'), mode: 'file' }];
  assert.deepEqual(validateAblation(explicito, contrato, io), []);
});

test('RA-04 · una limpieza donde no hubo nada que archivar se puede registrar y cerrar', () => {
  // Sin esto la fase era incorrible en el caso más común de la segunda semana: se mira todo, todo
  // aprueba alguna R, no se archiva nada — y no había forma de dejarlo registrado, así que `due`
  // iba a decir «toca limpiar» para siempre.
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const nada = registro({
    batches: [],
    rollback_tested: { done: false, evidence: 'no se archivó ningún archivo en esta corrida, así que no hay nada que restaurar' },
    survivors: [
      { path: '~/.claude/skills/vieja.md', why: 'aprueba requisito: trae las rutas propias que el modelo no puede adivinar' },
      { path: '~/.claude/skills/util.md', why: 'trae las rutas y el tono propios, que el modelo no puede adivinar' },
    ],
    totals: { words_before: 1000, words_after: 1000, files_before: 2, files_after: 2 },
  });
  assert.deepEqual(validateAblation(nada, contrato, io), []);
});

test('RA-04 · FALSIFICACIÓN · una limpieza sin tandas que igual dice haber probado la vuelta atrás se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const miente = registro({
    batches: [],
    survivors: [
      { path: '~/.claude/skills/vieja.md', why: 'aprueba requisito: trae las rutas propias que el modelo no puede adivinar' },
      { path: '~/.claude/skills/util.md', why: 'trae las rutas y el tono propios, que el modelo no puede adivinar' },
    ],
    totals: { words_before: 1000, words_after: 1000, files_before: 2, files_after: 2 },
  });
  const violaciones = validateAblation(miente, contrato, io);
  assert.equal(violaciones.some((v) => /no archivó nada|vuelta atrás/iu.test(v)), true);
});

test('FALSIFICACIÓN · una limpieza que SÍ archivó y no probó la vuelta atrás no cierra, por más explicación que traiga', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const excusa = registro({
    rollback_tested: { done: false, evidence: 'no llegué a probar la restauración porque se hizo tarde y quedó para mañana' },
  });
  assert.equal(validateAblation(excusa, contrato, io).some((v) => /vuelta atrás/iu.test(v)), true);
});

// --- El archivo puede ser git, y de hecho es lo que el propio protocolo de limpieza prescribe:
// "git init + commit si no hay repo... el backup existe antes que el primer mv". El gate exigía un
// archivo en disco, así que habría rechazado como BORRADO la limpieza hecha del modo correcto.

test('RA-06 · un archivado en git se acepta si el objeto existe de verdad en ese commit', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = {
    exists: () => false, // el origen ya no está: se borró del árbol, que es el punto
    gitHas: (repo, commit, ruta) => repo === '~/.claude' && commit === 'a'.repeat(40) && ruta === 'skills/design-loop/SKILL.md',
  };
  const enGit = registro();
  enGit.batches[0].archived = [{
    path: '~/.claude/skills/design-loop/SKILL.md',
    archived_to: 'skills/design-loop/SKILL.md',
    mode: 'git',
    repo: '~/.claude',
    commit: 'a'.repeat(40),
    repetible: false,
    requisito: false,
    repartible: false,
    verdict: 'ARCHIVAR',
    reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
  }];
  enGit.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
  enGit.survivors = [];
  assert.deepEqual(validateAblation(enGit, contrato, io), []);
});

test('RA-06 · FALSIFICACIÓN · si el objeto no está en ese commit, eso es un borrado y se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: () => false, gitHas: () => false };
  const mentira = registro();
  mentira.batches[0].archived = [{
    path: '~/.claude/skills/design-loop/SKILL.md',
    archived_to: 'skills/design-loop/SKILL.md',
    mode: 'git',
    repo: '~/.claude',
    commit: 'b'.repeat(40),
    repetible: false,
    requisito: false,
    repartible: false,
    verdict: 'ARCHIVAR',
    reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
  }];
  mentira.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
  mentira.survivors = [];
  const violaciones = validateAblation(mentira, contrato, io);
  assert.equal(violaciones.some((v) => /no está en el commit|borrado/iu.test(v)), true);
});

test('RA-06 · FALSIFICACIÓN · un commit que no es un sha completo no vale como archivo', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: () => false, gitHas: () => true };
  for (const commit of ['a424be4', '', 'HEAD~1', 'z'.repeat(40)]) {
    const malo = registro();
    malo.batches[0].archived = [{
      path: '~/.claude/skills/design-loop/SKILL.md',
      archived_to: 'skills/design-loop/SKILL.md',
      mode: 'git',
      repo: '~/.claude',
      commit,
      repetible: false,
      requisito: false,
      repartible: false,
      verdict: 'ARCHIVAR',
      reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
    }];
    malo.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
    malo.survivors = [];
    assert.deepEqual({ commit, rechaza: validateAblation(malo, contrato, io).length > 0 }, { commit, rechaza: true });
  }
});

test('RA-06 · FALSIFICACIÓN · un archivado en git sin repositorio, o cuyo origen sigue ahí, se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const enGit = (over = {}) => {
    const r = registro();
    r.batches[0].archived = [{
      path: '~/.claude/skills/design-loop/SKILL.md',
      archived_to: 'skills/design-loop/SKILL.md',
      mode: 'git',
      repo: '~/.claude',
      commit: 'a'.repeat(40),
      repetible: false,
      requisito: false,
      repartible: false,
      verdict: 'ARCHIVAR',
      reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
      ...over,
    }];
    r.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
    r.survivors = [];
    return r;
  };
  const sinRepo = validateAblation(enGit({ repo: '   ' }), contrato, { exists: () => false, gitHas: () => true });
  const sigueAhi = validateAblation(enGit(), contrato, { exists: () => true, gitHas: () => true });
  assert.deepEqual(
    { sinRepo: sinRepo.some((v) => /repositorio/iu.test(v)), sigueAhi: sigueAhi.some((v) => /sigue en su lugar/iu.test(v)) },
    { sinRepo: true, sigueAhi: true },
  );
});

test('el lector de git real responde sobre este mismo repositorio', () => {
  // Sin inyectar `gitHas`: se le pregunta a git de verdad, que es la diferencia entre comprobar
  // el archivo y creerle al registro.
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const errores = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    const inventado = registro();
    inventado.batches[0].archived = [{
      path: '~/.claude/skills/design-loop/SKILL.md',
      archived_to: 'skills/design-loop/SKILL.md',
      mode: 'git',
      repo: repoRoot,
      commit: '0'.repeat(40),
      repetible: false,
      requisito: false,
      repartible: false,
      verdict: 'ARCHIVAR',
      reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
    }];
    inventado.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
    inventado.survivors = [];
    writeFileSync(join(root, RUTA), json(inventado), 'utf8');
    // Un commit de ceros no existe en ningún repositorio: git lo dice, y el gate lo repite.
    const code = main(['check', RUTA], { root, write: () => {}, writeError: (l) => errores.push(l) });
    assert.deepEqual({ code, acusa: /no está en el commit/iu.test(errores.join('\n')) }, { code: 1, acusa: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el lector de git expande ~/ contra el home real, igual que el lector de archivos', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const errores = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    const conTilde = registro();
    conTilde.batches[0].archived = [{
      path: '~/.claude/skills/design-loop/SKILL.md',
      archived_to: 'skills/design-loop/SKILL.md',
      mode: 'git',
      repo: '~/.claude',
      commit: '0'.repeat(40),
      repetible: false,
      requisito: false,
      repartible: false,
      verdict: 'ARCHIVAR',
      reason: 'cero invocaciones en 82 días; el objeto queda recuperable del commit anterior al borrado',
    }];
    conTilde.inventory = [{ path: '~/.claude/skills/design-loop/SKILL.md', words: 1061, percent: 100, last_modified: '2026-06-01' }];
    conTilde.survivors = [];
    writeFileSync(join(root, RUTA), json(conTilde), 'utf8');
    const code = main(['check', RUTA], { root, write: () => {}, writeError: (l) => errores.push(l) });
    assert.deepEqual({ code, acusa: /no está en el commit/iu.test(errores.join('\n')) }, { code: 1, acusa: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- El filtro de las tres R es un juicio con las tres respuestas a la vista, no un AND mecanico.
// Encontrado reconstruyendo una limpieza real: dos unidades aprobaban "repartible" y se archivaron
// igual, con motivo escrito. El prompt del que sale el filtro dice "veredicto con una linea de
// justificacion", no "si alguna dice si, se queda".

test('3R · archivar algo que aprueba una R se permite si el motivo lo explica de verdad', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const conJuicio = registro();
  conJuicio.batches[0].archived = [archivado('vieja', {
    repartible: true,
    reason: 'se le podría pasar a otra persona y le funcionaría igual, pero acá no se invocó ni una vez en 82 días y su contenido es conocimiento público que el modelo ya tiene: el juicio es archivarla',
  })];
  assert.deepEqual(validateAblation(conJuicio, contrato, io), []);
});

test('3R · FALSIFICACIÓN · archivar algo que aprueba una R con un motivo corto se rechaza', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  const sinJuicio = registro();
  sinJuicio.batches[0].archived = [archivado('vieja', {
    requisito: true,
    reason: 'no se usa casi nunca en la práctica',
  })];
  const violaciones = validateAblation(sinJuicio, contrato, io);
  assert.equal(violaciones.some((v) => /aprueba|requisito/iu.test(v)), true);
});

test('3R · FALSIFICACIÓN · un archivado que aprueba una R y no trae motivo escrito se rechaza igual', () => {
  const contrato = loadScope(JSON.parse(readScope()));
  const io = { exists: (p) => String(p).includes('.claude-archive') };
  for (const reason of [null, 42, undefined]) {
    const malo = registro();
    malo.batches[0].archived = [archivado('vieja', { repartible: true, reason })];
    assert.deepEqual(
      { reason: String(reason), rechaza: validateAblation(malo, contrato, io).some((v) => /aprueba/u.test(v)) },
      { reason: String(reason), rechaza: true },
    );
  }
});

// --- RA-03: una ruta de home al estilo de Windows describia un archivado correcto y el gate lo
// llamaba borrado. normalizePath ya la resolvia bien; los lectores de disco y de git comparaban
// `~/` literal, asi que `~\\` caia al else y se buscaba adentro del proyecto.

test('RA-03 · una ruta de home escrita al estilo de Windows se expande igual que la de Unix', () => {
  const barra = String.fromCharCode(92);
  assert.equal(
    normalizePath(`~${barra}.claude${barra}skills${barra}x.md`),
    normalizePath('~/.claude/skills/x.md'),
  );
});

test('RA-03 · FALSIFICACIÓN · el lector de disco expande el home aunque la ruta venga con barras invertidas', () => {
  const barra = String.fromCharCode(92);
  const root = mkdtempSync(join(tmpdir(), 'vcp-ablation-'));
  const errores = [];
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    mkdirSync(join(root, ARCHIVO, '.claude', 'skills'), { recursive: true });
    writeFileSync(join(root, 'contracts', 'ablation-scope.json'), readScope(), 'utf8');
    writeFileSync(join(root, ARCHIVO, '.claude', 'skills', '__vcp-inexistente__.md'), 'archivada', 'utf8');
    // El origen se escribe con barras invertidas y NO existe: es exactamente el caso correcto.
    // El nombre imposible es a propósito: `~` se expande al home REAL, así que el chequeo de que
    // el origen ya no está tiene que caer sobre un archivo que de verdad no existe en esta máquina.
    const win = registro();
    win.batches[0].archived = [archivado('vieja', {
      path: `~${barra}.claude${barra}skills${barra}__vcp-inexistente__.md`,
      archived_to: `${ARCHIVO}/.claude/skills/__vcp-inexistente__.md`,
    })];
    win.inventory = [{ path: `~${barra}.claude${barra}skills${barra}__vcp-inexistente__.md`, words: 1, percent: 100, last_modified: '2026-01-01' }];
    win.survivors = [];
    writeFileSync(join(root, RUTA), json(win), 'utf8');
    const code = main(['check', RUTA], { root, write: () => {}, writeError: (l) => errores.push(l) });
    assert.deepEqual({ code, errores }, { code: 0, errores: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- F13: el gate exige una forma exacta de registro, y PHASE 9 nunca la nombraba. Quien siga el
// protocolo al pie de la letra escribe un registro incompleto y se entera recién cuando el gate lo
// rechaza. Un requisito que sólo vive en el código no es un protocolo: es una trampa.

test('F13 · PHASE 9 nombra cada campo que el gate exige del registro', () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  const fase = skill.slice(skill.indexOf('## PHASE 9'));
  const faltan = RECORD_KEYS.filter((campo) => !fase.includes(`\`${campo}\``));
  assert.deepEqual(faltan, []);
});

test('F13 · PHASE 9 nombra los tres veredictos y el campo que justifica cada prueba', () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  const fase = skill.slice(skill.indexOf('## PHASE 9'));
  const faltan = [...VERDICTS, 'why_representative'].filter((t) => !fase.includes(t));
  assert.deepEqual(faltan, []);
});

test('F13 · FALSIFICACIÓN · la comprobación agarra un campo ausente', () => {
  const fase = 'Lleva \`schema\` y nada más.';
  const faltan = RECORD_KEYS.filter((campo) => !fase.includes(`\`${campo}\``));
  assert.equal(faltan.includes('schema'), false);
  assert.equal(faltan.includes('totals'), true);
});

// --- La fase exigia que el set de pruebas fueran tareas REALES y no decia nada sobre publicarlas.
// Un registro real commiteado a un repositorio publico llevo adentro el nombre de otro producto,
// sus rutas internas y una vulnerabilidad con archivo y linea. Realismo sin redaccion.

test('PHASE 9 dice que el registro se publica redactado, no solo que sea real', () => {
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  const fase = skill.slice(skill.indexOf('## PHASE 9'));
  const falta = [];
  if (!/redact/iu.test(fase)) falta.push('la palabra redactar');
  if (!/p[úu]blic/iu.test(fase)) falta.push('que el repositorio puede ser publico');
  if (!/vulnerabilidad|hallazgo de seguridad/iu.test(fase)) falta.push('el caso de la vulnerabilidad');
  assert.deepEqual(falta, []);
});

test('PHASE 9 conserva la exigencia de que las tareas sean reales', () => {
  // La regla nueva no puede cancelar la vieja: un set inventado se elige para que de bien.
  const skill = readFileSync(join(repoRoot, 'SKILL.md'), 'utf8');
  const fase = skill.slice(skill.indexOf('## PHASE 9'));
  assert.match(fase, /tareas tuyas reales/iu);
});

test('la plantilla del registro no trae rutas de otro proyecto', () => {
  // templates/ y skills/ se copian a cada instalacion: una ruta ajena aca viaja a terceros.
  //
  // Se busca por FORMA, no por una lista de nombres. La primera version de esta guarda nombraba los
  // productos que buscaba -- y asi el detector era, el mismo, la mencion que decia impedir --, y
  // ademas solo podia encontrar lo que quien la escribio ya conocia: la redaccion del 0442115 se
  // dejo una referencia adentro justamente por eso. Lo que se busca es la firma de una ruta que
  // apunta afuera: una referencia `archivo.ext:linea` con una extension que este proyecto NO tiene
  // -- lo versionado es .mjs, .json, .md, .sh, .ps1, .html, .txt --, o una ruta absoluta con el home
  // de un usuario. Acotar por extension ajena y no por cualquier `archivo:linea` es a proposito: las
  // plantillas usan ejemplos legitimos como `auth.js:42` y `ruta/dentro/del/repo.ts:1` para explicar
  // el formato, y una guarda que los acusa se apaga al segundo dia.
  const ajeno = /[\w./\\-]+\.(?:py|mq5|mqh|ex5|java|cs|rb|go|php|swift|kt|cpp|hpp):\d+|[A-Za-z]:[\\/]Users[\\/]/u;
  const sucios = [];
  for (const dir of ['templates', 'skills']) {
    const base = join(repoRoot, dir);
    const pila = [base];
    while (pila.length > 0) {
      const actual = pila.pop();
      for (const e of readdirSync(actual, { withFileTypes: true })) {
        const ruta = join(actual, e.name);
        if (e.isDirectory()) { pila.push(ruta); continue; }
        if (!/\.(md|json|txt)$/u.test(e.name)) continue;
        if (ajeno.test(readFileSync(ruta, 'utf8'))) sucios.push(ruta.slice(repoRoot.length + 1));
      }
    }
  }
  assert.deepEqual(sucios, []);
});

// --- La redaccion del 0442115 se dejo una referencia a un archivo de otro proyecto, con rango de
// lineas, adentro del registro; y la guarda que escribi para verificarla NO lo vio, porque buscaba
// los nombres que yo ya conocia. Una guarda hecha con la misma lista que la redaccion solo puede
// encontrar lo que la redaccion ya penso. Lo agarro una auditoria con lentes ciegas, no la guarda.
//
// Este chequeo no usa nombres: busca la FORMA. Una referencia `archivo.ext:linea` dentro del
// registro apunta a un arbol que no es este, porque las rutas de este repo se citan relativas y sin
// numero de linea en los campos de evidencia.

test('el registro de la limpieza no cita archivo:linea de ningun arbol', () => {
  const registro = readFileSync(join(repoRoot, 'docs', 'ablation.json'), 'utf8');
  // Extension seguida de dos puntos y numero: la firma de una referencia a codigo ajeno.
  const REFERENCIA = /[\w./\\-]+\.(?:py|mq5|mqh|ex5|js|mjs|ts|jsx|tsx|html|css|sh|ps1)(?::\d+)/gu;
  const encontradas = [...new Set(registro.match(REFERENCIA) ?? [])];
  assert.deepEqual(encontradas, []);
});

test('FALSIFICACIÓN · la comprobación agarra la referencia que la redacción se dejó', () => {
  // La MISMA FORMA que tenia el texto que sobrevivio a la redaccion, no el texto. Pegar la cita
  // real aca la volveria a publicar: probar que se redacto algo re-publicandolo es exactamente el
  // error que esta prueba existe para impedir, un nivel mas arriba.
  const REFERENCIA = /[\w./\\-]+\.(?:py|mq5|mqh|ex5|js|mjs|ts|jsx|tsx|html|css|sh|ps1)(?::\d+)/gu;
  const mismaForma = 'Cita literal: "El piso -- modulo.py:66-74 ... el umbral exige 48 casos"';
  assert.deepEqual(mismaForma.match(REFERENCIA), ['modulo.py:66']);
  // Y no acusa una ruta del propio repo citada como el registro las cita: sin numero de linea.
  assert.equal('archived_to: .claude-archive/2026-09-02/.claude/skills/cyber-neo/SKILL.md'.match(REFERENCIA), null);
});

// --- La configuracion local de Claude estaba protegida SOLO por ignores de esta maquina: el
// ~/.config/git/ignore del usuario y .git/info/exclude. Ninguno de los dos viaja con el repositorio,
// asi que en un clon de otra persona -- o en esta misma si se pierde .git/info/exclude -- un
// `git add -A` estadea allowlists de permisos, rutas locales y configuracion de MCP.

test('el propio .gitignore del repo protege .claude/, sin depender de la maquina', () => {
  const preguntar = (ruta) => spawnSync('git', ['check-ignore', '-v', ruta], { cwd: repoRoot, encoding: 'utf8' });
  const desprotegidos = [];
  for (const ruta of ['.claude/settings.local.json', '.claude/worktrees/x', '.claude/otro.json']) {
    const r = preguntar(ruta);
    // La fuente va antes del primer `:`; tiene que ser el .gitignore versionado, no un archivo local.
    const fuente = String(r.stdout || '').split(':')[0];
    if (r.status !== 0 || fuente !== '.gitignore') desprotegidos.push(`${ruta} -> ${fuente || 'nadie'}`);
  }
  assert.deepEqual(desprotegidos, []);
});

// --- Los artefactos de investigacion pesan cientos de megas y llevan codigo verbatim de repos
// ajenos. Estaban ignorados UNO POR UNO, con la fecha adentro del nombre: el generado manana no
// queda cubierto, y un `git add -A` lo publica en un repositorio publico. Misma clase que todo lo
// demas de hoy -- una proteccion que se cumple por casualidad y no por regla.

test('un artefacto de investigacion con fecha nueva queda ignorado igual', () => {
  const preguntar = (ruta) => spawnSync('git', ['check-ignore', '-q', ruta], { cwd: repoRoot, encoding: 'utf8' });
  const futuros = [
    'research/corpus-manifest-2027-01-01.json',
    'research/semantic-ledger-2027-01-01.json',
    'research/functional-inventory-2027-01-01.json',
    'research/complete-review-index-2027-01-01.json',
    'research/semantic-review-index-2027-01-01.json',
    'research/semantic-full-evidence-2027-01-01.ndjson',
    'research/semantic-functional-evidence-2027-01-01.ndjson',
    'research/semantic-functional-index-2027-01-01.json',
  ];
  assert.deepEqual(futuros.filter((r) => preguntar(r).status !== 0), []);
});

test('FALSIFICACIÓN · la regla ampliada no se traga los resumenes que SI se versionan', () => {
  // Un patron demasiado ancho dejaria de versionar la sintesis sin que nadie lo note.
  const preguntar = (ruta) => spawnSync('git', ['check-ignore', '-q', ruta], { cwd: repoRoot, encoding: 'utf8' });
  const versionados = execFileSync('git', ['ls-files', 'research/'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(versionados.length > 0, 'el listado de versionados no puede venir vacio');
  assert.deepEqual(versionados.filter((r) => preguntar(r).status === 0), []);
});

// --- La tabla de gates del README es el mapa que lee quien llega al proyecto. Fue quedando atras:
// listaba 19 de 36. Un mapa incompleto no miente en lo que dice, pero omite en silencio, y nadie se
// entera de que existe un gate que nadie describio. La tabla se compara contra el disco.

test('la tabla de gates del README nombra todos los gates que existen', () => {
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const enTabla = new Set([...readme.matchAll(/^\|\s*`(verify-[a-z0-9-]+\.mjs)`/gmu)].map((m) => m[1]));
  const enDisco = readdirSync(join(repoRoot, 'scripts')).filter((f) => /^verify-.*\.mjs$/u.test(f));
  assert.deepEqual(enDisco.filter((g) => !enTabla.has(g)).sort(), []);
});

test('FALSIFICACIÓN · la tabla tampoco puede nombrar un gate que ya no existe', () => {
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const enTabla = [...new Set([...readme.matchAll(/^\|\s*`(verify-[a-z0-9-]+\.mjs)`/gmu)].map((m) => m[1]))];
  const enDisco = new Set(readdirSync(join(repoRoot, 'scripts')).filter((f) => /^verify-.*\.mjs$/u.test(f)));
  assert.ok(enTabla.length > 0, 'la tabla no puede venir vacia');
  assert.deepEqual(enTabla.filter((g) => !enDisco.has(g)).sort(), []);
});

// --- El README es documentacion OPERATIVA: quien lo lee va a correr lo que dice. Nombraba un commit
// que la ultima reescritura de historia dejo sin existir, asi que la instruccion apuntaba al vacio.
// El CHANGELOG queda fuera de esta comprobacion a proposito: es un registro historico y sus entradas
// nombran los commits con el identificador que tenian entonces, que una reescritura necesariamente
// invalida. Reescribirlos seria falsear el registro; el CHANGELOG lo declara en una linea.

test('todo commit que el README nombra existe de verdad en el repositorio', () => {
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const shas = [...new Set([...readme.matchAll(/`([0-9a-f]{7,40})`/gu)].map((m) => m[1]))];
  const fantasmas = shas.filter((s) => spawnSync('git', ['cat-file', '-e', s], { cwd: repoRoot }).status !== 0);
  assert.deepEqual(fantasmas, []);
});

// --- El README ya habia mentido una vez sobre su propia concurrencia y se corrigio el parrafo de
// "Los gates mecanicos". La fila de la tabla de gates decia LO CONTRARIO en la misma pagina: se
// arreglo una copia y no se barrio el resto. Un documento que se contradice a si mismo no es un
// error de redaccion, es una afirmacion falsa sostenida por la mitad del archivo que nadie releyo.
// Esta comprobacion no juzga la redaccion: compara cada numero que el README afirma como el default
// contra la constante real del script.

const MARCA_HIST = /^<!--\s*concurrencia:\s*hist/u;

// Una linea marcada CITA un valor viejo a proposito, para explicar por que cambio. Contarla como
// afirmacion viva obligaria a borrar la explicacion para poner el documento en verde, que es justo
// el incentivo que este proyecto no quiere. LIMITE: la marca es una declaracion de quien escribe,
// no una prueba; puesta sobre una afirmacion viva, apaga la comprobacion en silencio.
export function concurrenciasAfirmadas(texto) {
  const lineas = texto.split('\n');
  const vivas = [];
  let citando = false;
  for (const linea of lineas) {
    if (MARCA_HIST.test(linea.trim())) { citando = true; continue; }
    if (citando) { if (linea.trim() === '') citando = false; else continue; }
    vivas.push(linea);
  }
  const util = vivas.join('\n');
  return [
    ...[...util.matchAll(/--test-concurrency=(\d+)/gu)].map((m) => m[1]),
    ...[...util.matchAll(/(\d+)\s+workers?\s+por\s+defecto/giu)].map((m) => m[1]),
  ];
}

test('el README no puede contradecir la concurrencia por defecto que declara el script', async () => {
  const { DEFAULT_TEST_CONCURRENCY } = await import('../scripts/verify-vcp-coverage.mjs');
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const afirmados = concurrenciasAfirmadas(readme);
  assert.ok(afirmados.length > 0, 'si el README dejo de nombrar la concurrencia, esta comprobacion no mide nada');
  assert.deepEqual([...new Set(afirmados.filter((n) => n !== DEFAULT_TEST_CONCURRENCY))], []);
});

test('FALSIFICACIÓN · la comprobación de concurrencia detecta un número que no es el del script', () => {
  assert.deepEqual(concurrenciasAfirmadas('Usa 1 worker por defecto y corre con `--test-concurrency=32`.'), ['32', '1']);
});

test('FALSIFICACIÓN · la marca exime el párrafo citado y NADA más', () => {
  const cita = 'Durante un tiempo decía `--test-concurrency=1`.';
  const marca = '<!-- concurrencia: histórico -->';
  // La misma frase: sin marca cuenta, con marca no. Si no, la marca no estaría haciendo nada.
  assert.deepEqual(concurrenciasAfirmadas(cita), ['1']);
  assert.deepEqual(concurrenciasAfirmadas([marca, cita].join('\n')), []);
  // La exención TERMINA en la línea en blanco: lo que viene después vuelve a contar.
  assert.deepEqual(concurrenciasAfirmadas([marca, cita, '', 'Hoy usa --test-concurrency=7.'].join('\n')), ['7']);
  // Una marca suelta no exime nada ni rompe.
  assert.deepEqual(concurrenciasAfirmadas(marca), []);
});
