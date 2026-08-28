import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  EXPECTATIONS,
  SCHEMA,
  USAGE,
  classify,
  listGateScripts,
  main,
  missingGates,
  parseArgs,
  probe,
  readContract,
  runInEmptyDirectory,
  undeclaredGates,
  validateShape,
} from '../scripts/verify-empty-probe.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-empty-probe.mjs');

const GATE = { script: 'verify-uno.mjs', args: ['check'], expect: 'reject' };
const contractOf = (gates) => JSON.stringify({ schema: SCHEMA, gates });

/** Un runner falso: devuelve lo que se le declara por script, sin tocar el disco ni lanzar procesos. */
function runner(byScript) {
  return (name, args) => {
    assert.ok(Array.isArray(args), 'el runner siempre recibe la lista de argumentos declarada');
    return byScript[name] ?? { status: 1, stdout: '', stderr: 'REJECTED: sin declarar' };
  };
}

function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-empty-probe-test-'));
  try {
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- Clasificación de una corrida ---------------------------------------------------------------

test('classify separa los cuatro comportamientos por exit code y prefijo de salida', () => {
  assert.equal(classify({ status: 2, stdout: '', stderr: 'usage: ...' }), 'usage');
  assert.equal(classify({ status: 1, stdout: '', stderr: 'REJECTED: ...' }), 'reject');
  assert.equal(classify({ status: null, stdout: '', stderr: 'murió' }), 'reject');
  assert.equal(classify({ status: 0, stdout: 'VACÍO: no había nada\n', stderr: '' }), 'empty');
  assert.equal(classify({ status: 0, stdout: 'OK: verificado\n', stderr: '' }), 'self');
});

test('classify no confunde un VACÍO mencionado más adelante con un VACÍO declarado al principio', () => {
  assert.equal(classify({ status: 0, stdout: 'OK: sin VACÍO: adentro\n', stderr: '' }), 'self');
});

// --- Lectura del contrato -----------------------------------------------------------------------

test('readContract acepta el contrato bien formado y nombra cada forma de romperlo', () => {
  const ok = readContract('c.json', () => contractOf([GATE]));
  assert.equal(ok.error, null);
  assert.deepEqual(ok.document.gates, [GATE]);

  const casos = [
    [() => '{ roto', /no se puede leer c\.json como JSON/u],
    [() => { throw new Error('ENOENT: no such file'); }, /no such file/u],
    [() => 'null', /no es un objeto/u],
    [() => '[]', /no es un objeto/u],
    [() => '"texto"', /no es un objeto/u],
    [() => JSON.stringify({ schema: 'otro/v9', gates: [GATE] }), /declara schema "otro\/v9"/u],
    [() => JSON.stringify({ schema: SCHEMA }), /no declara ningún gate/u],
    [() => JSON.stringify({ schema: SCHEMA, gates: [] }), /no declara ningún gate/u],
  ];
  for (const [readFile, expected] of casos) {
    const result = readContract('c.json', readFile);
    assert.equal(result.document, null);
    assert.match(result.error, expected);
  }
});

test('readContract usa readFileSync cuando no le pasan lector, y falla sobre un archivo que no existe', () => fixture((root) => {
  const result = readContract(join(root, 'no-esta.json'));
  assert.equal(result.document, null);
  assert.match(result.error, /ENOENT/u);
}));

// --- Forma de cada entrada declarada ------------------------------------------------------------

test('validateShape acepta las cinco expectativas y exige motivo escrito sólo en self y skip', () => {
  const válidos = [
    { script: 'verify-a.mjs', args: [], expect: 'reject' },
    { script: 'verify-b.mjs', args: ['check'], expect: 'usage' },
    { script: 'verify-c.mjs', args: ['check'], expect: 'empty' },
    { script: 'verify-d.mjs', args: ['check'], expect: 'self', why: 'mira el propio checkout' },
    { script: 'verify-e.mjs', args: [], expect: 'skip', why: 'cuesta minutos' },
  ];
  assert.deepEqual(validateShape(válidos), []);
  assert.deepEqual(EXPECTATIONS, ['reject', 'usage', 'empty', 'self', 'skip']);
});

test('FALSIFICACIÓN · validateShape nombra cada entrada mal formada, y un self o un skip sin motivo no pasan', () => {
  const violations = validateShape([
    null,
    ['no', 'es', 'objeto'],
    { script: 'noesungate.mjs', args: [], expect: 'reject' },
    { script: 42, args: [], expect: 'reject' },
    { script: 'verify-a.mjs', args: 'check', expect: 'reject' },
    { script: 'verify-b.mjs', args: [7], expect: 'reject' },
    { script: 'verify-c.mjs', args: [], expect: 'aprobado' },
    { script: 'verify-d.mjs', args: [], expect: 'self' },
    { script: 'verify-e.mjs', args: [], expect: 'self', why: '   ' },
    { script: 'verify-f.mjs', args: [], expect: 'self', why: 42 },
    { script: 'verify-g.mjs', args: [], expect: 'skip' },
    { script: 'verify-a.mjs', args: [], expect: 'reject' },
  ]);
  assert.deepEqual(violations, [
    'gates[0] no es un objeto',
    'gates[1] no es un objeto',
    'gates[2].script no nombra un verify-*.mjs: "noesungate.mjs"',
    'gates[3].script no nombra un verify-*.mjs: 42',
    'verify-a.mjs: "args" tiene que ser una lista de strings',
    'verify-b.mjs: "args" tiene que ser una lista de strings',
    'verify-c.mjs: "expect" tiene que ser uno de reject, usage, empty, self, skip, no "aprobado"',
    'verify-d.mjs: "self" exige un "why" que lo justifique por escrito',
    'verify-e.mjs: "self" exige un "why" que lo justifique por escrito',
    'verify-f.mjs: "self" exige un "why" que lo justifique por escrito',
    'verify-g.mjs: "skip" exige un "why" que lo justifique por escrito',
    'gates[11].script está declarado dos veces: verify-a.mjs',
  ]);
});

// --- Inventario declarado contra inventario real -------------------------------------------------

test('undeclaredGates y missingGates comparan los dos inventarios en las dos direcciones', () => {
  assert.deepEqual(undeclaredGates(['verify-a.mjs'], ['verify-a.mjs', 'verify-b.mjs']), ['verify-b.mjs']);
  assert.deepEqual(undeclaredGates(['verify-a.mjs', 'verify-b.mjs'], ['verify-a.mjs']), []);
  assert.deepEqual(missingGates(['verify-a.mjs', 'verify-z.mjs'], ['verify-a.mjs']), ['verify-z.mjs']);
  assert.deepEqual(missingGates(['verify-a.mjs'], ['verify-a.mjs', 'verify-b.mjs']), []);
});

test('listGateScripts toma sólo los verify-*.mjs y los devuelve ordenados', () => {
  const listed = listGateScripts(() => ['ratchet.mjs', 'verify-b.mjs', 'install.sh', 'verify-a.mjs', 'verify-a.test.mjs']);
  assert.deepEqual(listed, ['verify-a.mjs', 'verify-a.test.mjs', 'verify-b.mjs']);
  assert.ok(listGateScripts().includes('verify-empty-probe.mjs'), 'sin lector, lista el directorio scripts/ real');
});

// --- La sonda ------------------------------------------------------------------------------------

test('probe no corre los skip y no reporta nada cuando cada gate se comporta como declara', () => {
  const corridos = [];
  const run = (name, args) => {
    corridos.push(name);
    return runner({
      'verify-a.mjs': { status: 1, stdout: '', stderr: 'REJECTED: x' },
      'verify-b.mjs': { status: 0, stdout: 'VACÍO: nada\n', stderr: '' },
      'verify-c.mjs': { status: 0, stdout: 'OK: propio\n', stderr: '' },
      'verify-d.mjs': { status: 2, stdout: '', stderr: 'usage: x' },
    })(name, args);
  };
  const violations = probe([
    { script: 'verify-a.mjs', args: [], expect: 'reject' },
    { script: 'verify-b.mjs', args: [], expect: 'empty' },
    { script: 'verify-c.mjs', args: [], expect: 'self', why: 'mira su propio checkout' },
    { script: 'verify-d.mjs', args: [], expect: 'usage' },
    { script: 'verify-e.mjs', args: [], expect: 'skip', why: 'cuesta minutos' },
  ], run);

  assert.deepEqual(violations, []);
  assert.deepEqual(corridos, ['verify-a.mjs', 'verify-b.mjs', 'verify-c.mjs', 'verify-d.mjs']);
});

test('FALSIFICACIÓN · probe delata al gate que dice OK sobre un directorio vacío y cita lo que escribió', () => {
  const violations = probe(
    [{ script: 'verify-a.mjs', args: ['check'], expect: 'empty' }, { script: 'verify-b.mjs', args: ['check'], expect: 'reject' }],
    runner({
      'verify-a.mjs': { status: 0, stdout: 'OK: 0 cosas verificadas\nsegunda línea\n', stderr: '' },
      'verify-b.mjs': { status: 0, stdout: '', stderr: '' },
    }),
  );
  assert.deepEqual(violations, [
    'verify-a.mjs sobre un directorio vacío se comporta como "self" y el contrato declara "empty": OK: 0 cosas verificadas',
    'verify-b.mjs sobre un directorio vacío se comporta como "self" y el contrato declara "reject": ',
  ]);
});

test('probe cita stderr cuando el gate no escribió nada en stdout', () => {
  const violations = probe(
    [{ script: 'verify-a.mjs', args: [], expect: 'empty' }],
    runner({ 'verify-a.mjs': { status: 1, stdout: '', stderr: 'REJECTED: se rompió  \n' } }),
  );
  assert.deepEqual(violations, ['verify-a.mjs sobre un directorio vacío se comporta como "reject" y el contrato declara "empty": REJECTED: se rompió']);
});

test('runInEmptyDirectory lanza el gate real en un directorio propio y devuelve su salida', () => {
  const outcome = runInEmptyDirectory('verify-empty-probe.mjs', []);
  assert.deepEqual({ status: outcome.status, usa: outcome.stderr.includes(USAGE), stdout: outcome.stdout }, { status: 2, usa: true, stdout: '' });
});

// --- main ----------------------------------------------------------------------------------------

test('parseArgs acepta sólo la forma documentada', () => {
  assert.deepEqual(parseArgs(['check', 'contracts/empty-probe.json']), { contract: 'contracts/empty-probe.json' });
  for (const args of [[], ['check'], ['check', ''], ['probe', 'c.json'], ['check', 'c.json', 'extra']]) {
    assert.equal(parseArgs(args), null, `${JSON.stringify(args)} no es una invocación válida`);
  }
});

test('main sale 0 y cuenta los self y los skip cuando todo coincide', () => {
  const written = [];
  const status = main(['check', 'c.json'], {
    readFile: () => contractOf([
      { script: 'verify-a.mjs', args: [], expect: 'reject' },
      { script: 'verify-b.mjs', args: [], expect: 'self', why: 'mira su propio checkout' },
      { script: 'verify-c.mjs', args: [], expect: 'skip', why: 'cuesta minutos' },
    ]),
    list: () => ['verify-a.mjs', 'verify-b.mjs', 'verify-c.mjs'],
    run: runner({ 'verify-b.mjs': { status: 0, stdout: 'OK: propio\n', stderr: '' } }),
  }, (line) => written.push(line), () => {});

  assert.equal(status, 0);
  assert.deepEqual(written, ['OK: 2 gate(s) se comportan sobre un directorio vacío como declara c.json; 1 verifica(n) el propio checkout y por eso pueden salir OK; 1 excluido(s) con motivo escrito.']);
});

test('FALSIFICACIÓN · main rechaza el uso inválido, el contrato roto y la forma inválida sin correr ningún gate', () => {
  const errors = [];
  const written = [];
  let corridas = 0;
  const run = () => { corridas += 1; return { status: 1, stdout: '', stderr: '' }; };
  const call = (args, readFile) => main(args, { readFile, list: () => [], run }, (line) => written.push(line), (line) => errors.push(line));

  assert.equal(call(['probe'], () => contractOf([GATE])), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(call(['check', 'c.json'], () => '{ roto'), 1);
  assert.match(errors.at(-1), /^REJECTED: EMPTY_PROBE_CONTRACT_INVALID: /u);
  assert.equal(call(['check', 'c.json'], () => contractOf([{ script: 'verify-a.mjs', args: [], expect: 'self' }])), 1);
  assert.match(errors.at(-1), /exige un "why"/u);
  assert.deepEqual({ corridas, written }, { corridas: 0, written: [] });
});

test('FALSIFICACIÓN · un gate nuevo sin declarar es un rechazo, y un declarado que ya no existe también', () => {
  const errors = [];
  let corridas = 0;
  const run = () => { corridas += 1; return { status: 1, stdout: '', stderr: '' }; };
  const call = (gates, present) => main(['check', 'c.json'], {
    readFile: () => contractOf(gates),
    list: () => present,
    run,
  }, () => {}, (line) => errors.push(line));

  assert.equal(call([GATE], ['verify-uno.mjs', 'verify-nuevo.mjs']), 1);
  assert.match(errors.at(-1), /EMPTY_PROBE_GATE_UNDECLARED: verify-nuevo\.mjs/u);

  assert.equal(call([GATE, { script: 'verify-borrado.mjs', args: [], expect: 'reject' }], ['verify-uno.mjs']), 1);
  assert.match(errors.at(-1), /EMPTY_PROBE_GATE_ABSENT: c\.json declara gates que ya no existen: verify-borrado\.mjs/u);

  // Los dos a la vez se reportan juntos, y ninguno de los dos casos llega a correr un gate.
  errors.length = 0;
  assert.equal(call([GATE, { script: 'verify-borrado.mjs', args: [], expect: 'reject' }], ['verify-uno.mjs', 'verify-nuevo.mjs']), 1);
  assert.equal(errors.length, 2);
  assert.equal(corridas, 0);
});

test('FALSIFICACIÓN · main propaga cada desvío de comportamiento como un rechazo propio', () => {
  const errors = [];
  const status = main(['check', 'c.json'], {
    readFile: () => contractOf([{ script: 'verify-a.mjs', args: [], expect: 'empty' }]),
    list: () => ['verify-a.mjs'],
    run: runner({ 'verify-a.mjs': { status: 0, stdout: 'OK: nada verificado\n', stderr: '' } }),
  }, () => {}, (line) => errors.push(line));

  assert.equal(status, 1);
  assert.deepEqual(errors, ['REJECTED: EMPTY_PROBE_BEHAVIOUR_MISMATCH: verify-a.mjs sobre un directorio vacío se comporta como "self" y el contrato declara "empty": OK: nada verificado']);
});

test('el CLI real corre el contrato de este repo de punta a punta', () => {
  const real = spawnSync(process.execPath, [script, 'check', 'contracts/empty-probe.json'], { cwd: repoRoot, encoding: 'utf8' });
  assert.deepEqual({ status: real.status, ok: real.stdout.startsWith('OK: ') }, { status: 0, ok: true }, real.stderr);
});

test('FALSIFICACIÓN · el CLI real rechaza un contrato que declara mal el comportamiento de un gate', () => fixture((root) => {
  const contract = join(root, 'mentiroso.json');
  const gates = JSON.parse(spawnSync(process.execPath, ['-e', "process.stdout.write(require('fs').readFileSync('contracts/empty-probe.json','utf8'))"], { cwd: repoRoot, encoding: 'utf8' }).stdout).gates;
  const mentira = gates.map((gate) => (gate.script === 'verify-spec-wordcap.mjs' ? { ...gate, expect: 'empty' } : gate));
  writeFileSync(contract, JSON.stringify({ schema: SCHEMA, gates: mentira }), 'utf8');

  const run = spawnSync(process.execPath, [script, 'check', contract], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /EMPTY_PROBE_BEHAVIOUR_MISMATCH: verify-spec-wordcap\.mjs/u);
}));

test('FALSIFICACIÓN · un spawn que falla del todo no puede clasificarse como verificación legítima', () => {
  // spawnSync devuelve status null y stdout/stderr null cuando el proceso no llega a arrancar.
  // Sin los fallbacks, classify reventaría sobre null y la sonda entera moriría por un gate roto.
  const muerto = () => ({ status: null, stdout: null, stderr: null, error: new Error('spawn ENOENT') });
  const outcome = runInEmptyDirectory('verify-cualquiera.mjs', [], muerto);

  assert.deepEqual(outcome, { status: null, stdout: '', stderr: '' });
  assert.equal(classify(outcome), 'reject');
  assert.deepEqual(probe([{ script: 'verify-cualquiera.mjs', args: [], expect: 'empty' }], (s, a) => runInEmptyDirectory(s, a, muerto)), [
    'verify-cualquiera.mjs sobre un directorio vacío se comporta como "reject" y el contrato declara "empty": ',
  ]);
});
