import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DIR_TOKEN,
  SCHEMA,
  TRACE_PREFIX,
  USAGE,
  WINDOWS_GIT_BASH,
  coverageOf,
  executableLines,
  main,
  measure,
  readContract,
  resolveBash,
  runScenario,
  tracedLines,
} from '../scripts/verify-shell-coverage.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-shell-coverage.mjs');
const NL = String.fromCharCode(10);

const contratoDe = (scripts) => JSON.stringify({ schema: SCHEMA, scripts });

// --- El denominador: qué línea puede llegar a ejecutarse -----------------------------------------

test('executableLines descarta comentarios y vacías, y numera desde 1', () => {
  const fuente = ['#!/bin/bash', '', '  # comentario indentado', 'echo hola', '   ', 'if true; then', '  echo si', 'fi'].join(NL);
  assert.deepEqual([...executableLines(fuente)], [4, 6, 7, 8]);
  assert.deepEqual([...executableLines('')], []);
  assert.deepEqual([...executableLines('# sólo comentarios' + NL + '# y nada más')], []);
});

// --- El numerador: qué línea dijo bash haber ejecutado --------------------------------------------

test('tracedLines lee la traza que escribe el propio bash, con o sin los signos de anidamiento', () => {
  const traza = [
    TRACE_PREFIX + '4 echo hola',
    '++' + TRACE_PREFIX + '7 echo si',
    'una línea cualquiera que no es traza',
    TRACE_PREFIX + '4 echo hola',
  ].join(NL);
  assert.deepEqual([...tracedLines(traza)].sort((a, b) => a - b), [4, 7]);
  assert.deepEqual([...tracedLines('')], []);
  assert.deepEqual([...tracedLines(TRACE_PREFIX + 'noesnumero algo')], []);
});

test('coverageOf calcula el porcentaje y nombra exactamente lo que no se ejecutó', () => {
  const r = coverageOf(new Set([1, 2, 3, 4]), new Set([1, 3, 99]));
  assert.deepEqual(r, { porcentaje: 50, cubiertas: 2, total: 4, sinCubrir: [2, 4] });
  assert.deepEqual(coverageOf(new Set(), new Set([1])), { porcentaje: 0, cubiertas: 0, total: 0, sinCubrir: [] });
  assert.equal(coverageOf(new Set([1, 2, 3]), new Set([1, 2, 3])).porcentaje, 100);
});

// --- El contrato ----------------------------------------------------------------------------------

test('readContract acepta el contrato real de este repo', () => {
  const { documento, error } = readContract(join(repoRoot, 'contracts', 'shell-coverage.json'));
  assert.equal(error, null);
  assert.ok(documento.scripts.length >= 2);
});

test('FALSIFICACIÓN · readContract nombra cada forma de romper el contrato', () => {
  const casos = [
    ['{ roto', /como JSON/u],
    ['null', /schema/u],
    ['[]', /schema/u],
    [JSON.stringify({ schema: 'otro/v1', scripts: [] }), /schema/u],
    [contratoDe([]), /ningún script/u],
    [contratoDe([{ script: 'install.ps1', scenarios: [{}], floor: 10 }]), /\.sh/u],
    [contratoDe([{ script: 42 }]), /\.sh/u],
    // Sin escenarios es una exclusión, y una exclusión sin motivo es el agujero que este gate cierra.
    [contratoDe([{ script: 'scripts/x.sh' }]), /"why"/u],
    [contratoDe([{ script: 'scripts/x.sh', why: '   ' }]), /"why"/u],
    [contratoDe([{ script: 'scripts/x.sh', scenarios: [{}] }]), /"floor"/u],
    [contratoDe([{ script: 'scripts/x.sh', scenarios: [{}], floor: 101 }]), /"floor"/u],
    [contratoDe([{ script: 'scripts/x.sh', scenarios: [{}], floor: -1 }]), /"floor"/u],
  ];
  for (const [texto, esperado] of casos) {
    const { documento, error } = readContract('c.json', () => texto);
    assert.equal(documento, null, texto.slice(0, 40) + ' tendría que rechazar');
    assert.match(error, esperado);
  }
});

// --- La medición --------------------------------------------------------------------------------

test('measure junta las líneas de todos los escenarios declarados, no sólo del primero', () => {
  const fuente = ['echo a', 'echo b', 'echo c'].join(NL);
  const trazas = [TRACE_PREFIX + '1 a', TRACE_PREFIX + '2 b'];
  let cual = 0;
  const r = measure(
    { script: 'x.sh', scenarios: [{}, {}], floor: 0 },
    { read: () => fuente, run: () => trazas[cual++] },
  );
  assert.deepEqual(r, { porcentaje: 66.7, cubiertas: 2, total: 3, sinCubrir: [3] });
});

test('runScenario corre bash de verdad y devuelve la traza con números de línea', () => {
  const salida = runScenario(join(repoRoot, 'scripts', 'verify-red.sh'), { setup: [], args: [] });
  assert.match(salida, new RegExp(TRACE_PREFIX, 'u'), 'sin PS4 con LINENO no hay cobertura que calcular');
  assert.ok(tracedLines(salida).size > 0);
});

test('resolveBash evita el shim WSL roto cuando hay Git Bash disponible', () => {
  if (process.platform !== 'win32') assert.equal(resolveBash({}), 'bash');
  else assert.equal(resolveBash({}), existsSync(WINDOWS_GIT_BASH) ? WINDOWS_GIT_BASH : 'bash');
  assert.equal(resolveBash({}, () => true, 'linux'), 'bash');
  assert.equal(resolveBash({ VCP_BASH_PATH: 'C:/custom/bash.exe' }, (path) => path === 'C:/custom/bash.exe'), 'C:/custom/bash.exe');
  assert.equal(resolveBash({ VCP_BASH_PATH: 'C:/missing/bash.exe' }, () => false), 'bash');
});

test('runScenario sustituye el directorio temporal en setup y args', () => {
  const vistos = [];
  const falso = (cmd, args) => { vistos.push(args.join(' ')); return { stderr: '' }; };
  runScenario('/x.sh', { setup: ['echo ' + DIR_TOKEN], args: ['--project', DIR_TOKEN] }, falso);
  assert.equal(vistos.length, 2);
  assert.ok(!vistos.join(' ').includes(DIR_TOKEN), 'el marcador tiene que quedar reemplazado por la ruta real');
  assert.match(vistos[1], /vcp-shell-cov-/u);
});

test('runScenario tolera un escenario sin setup ni args, y una corrida sin stderr', () => {
  assert.equal(runScenario('/x.sh', {}, () => ({})), '');
});

// --- main -----------------------------------------------------------------------------------------

test('FALSIFICACIÓN · main rechaza el uso inválido y el contrato roto', () => {
  const errores = [];
  const e = (l) => errores.push(l);
  assert.equal(main([], {}, () => {}, e), 2);
  assert.equal(errores.at(-1), USAGE);
  assert.equal(main(['check'], {}, () => {}, e), 2);
  assert.equal(main(['medir', 'c.json'], {}, () => {}, e), 2);
  assert.equal(main(['check', 'c.json'], { readFile: () => '{ roto' }, () => {}, e), 1);
  assert.match(errores.at(-1), /SHELL_COVERAGE_CONTRACT_INVALID/u);
});

test('FALSIFICACIÓN · un script por debajo de su piso rechaza y nombra las líneas sin cubrir', () => {
  const errores = [];
  const status = main(['check', 'c.json'], {
    readFile: () => contratoDe([{ script: 'scripts/x.sh', floor: 90, scenarios: [{}] }]),
    read: () => ['echo a', 'echo b'].join(NL),
    run: () => TRACE_PREFIX + '1 a',
  }, () => {}, (l) => errores.push(l));

  assert.equal(status, 1);
  assert.match(errores[0], /SHELL_COVERAGE_BELOW_FLOOR/u);
  assert.match(errores[0], /50%/u);
  assert.match(errores[0], /Sin cubrir: 2/u);
});

test('main informa el número, cuenta los excluidos y dice que mide líneas, no ramas', () => {
  const salida = [];
  const status = main(['check', 'c.json'], {
    readFile: () => contratoDe([
      { script: 'scripts/x.sh', floor: 40, scenarios: [{}] },
      { script: 'scripts/y.sh', why: 'no se corre en pruebas por diseño' },
    ]),
    read: () => ['echo a', 'echo b'].join(NL),
    run: () => TRACE_PREFIX + '1 a',
  }, (l) => salida.push(l), () => {});

  assert.equal(status, 0);
  assert.match(salida[0], /scripts\/x\.sh 50% \(1\/2\)/u);
  assert.match(salida[0], /1 script\(s\) sin escenario declarado/u);
  assert.match(salida[0], /no ramas/u, 'el límite viaja en la salida, no sólo en la documentación');
});

test('el CLI real mide los scripts de shell de este repo', () => {
  const run = spawnSync(process.execPath, [script, 'check', 'contracts/shell-coverage.json'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /install\.sh \d+(\.\d+)?%/u);
});
