import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { ENCABEZADO, filaAprobacion, interpretarPrompt, registrarEnTexto } from '../scripts/aprobar.mjs';
import { leerTabla } from '../scripts/verify-aprobacion-humana.mjs';
import { verifyChain } from '../scripts/verify-audit-chain.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'aprobar.mjs');
const gate = join(repoRoot, 'scripts', 'verify-aprobacion-humana.mjs');
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const AHORA = new Date('2026-11-10T14:35:00Z');

function run(args, input) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  // cwd fuera del repo: un registrar sin --proyecto nunca escribe en el .ia-stack del repo.
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, input, cwd: tmpdir() });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function conProyecto(callback) {
  const root = mkdtempSync(join(tmpdir(), 'ia-aprobar-'));
  mkdirSync(join(root, '.ia-stack'));
  try {
    callback(root, join(root, '.ia-stack', 'APROBACIONES.md'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('aprobar · la plantilla del repo es el encabezado y la cadena vacía verifica', () => {
  assert.equal(readFileSync(join(repoRoot, 'templates', 'estado', 'APROBACIONES.md'), 'utf8'), ENCABEZADO);
  assert.equal(verifyChain(ENCABEZADO).ok, true);
  assert.deepEqual(leerTabla(ENCABEZADO), []);
});

test('aprobar · filaAprobacion: el tipo es el explícito, nunca deducido del ref; fecha argentina', () => {
  const prod = filaAprobacion({ tipo: 'produccion', pieza: 'main', ref: SHA, texto: 'apruebo main', quien: 'Ana' }, AHORA);
  assert.equal(prod, '| produccion | main | a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 | apruebo main | 10-11-2026 11:35 | 10-11-2026 11:35 | Ana | aprobado');
  assert.match(filaAprobacion({ tipo: 'preview', pieza: 'landing', ref: 'v2', texto: 'ok', quien: 'Ana' }, AHORA), /^\| preview \| landing \| v2 \|/);
  assert.match(filaAprobacion({ tipo: 'boceto', pieza: 'landing', ref: 'v1', texto: 'ok', quien: 'Ana' }, AHORA), /^\| boceto \| landing \| v1 \|/);
  assert.match(filaAprobacion({ tipo: 'marca', ref: 'v1', texto: 'ok', quien: 'Ana' }, AHORA), /^\| marca \| marca \| v1 \|/, 'sin --pieza el objeto es el tipo');
});

test('aprobar · el texto literal no rompe la tabla (pipes y saltos de línea)', () => {
  const f = filaAprobacion({ tipo: 'produccion', pieza: 'main', ref: SHA, texto: 'a | b\nc | chain:x', quien: 'Ana' }, AHORA);
  assert.equal(f.split('|').length, 9);
  assert.doesNotMatch(f, /\n/);
});

test('aprobar · registrarEnTexto valida tipo, ref, pieza, texto y quién', () => {
  const ok = registrarEnTexto(ENCABEZADO, { tipo: 'produccion', pieza: 'main', ref: SHA, texto: 'apruebo main', quien: 'Ana' }, AHORA);
  assert.equal(ok.ok, true);
  assert.equal(verifyChain(ok.texto).ok, true);
  const malos = [
    { pieza: 'a b' }, { ref: 'xyz' }, { quien: 'Claude' }, { texto: '' }, { tipo: undefined }, { tipo: 'deploy' },
  ];
  for (const m of malos) {
    assert.equal(registrarEnTexto(ENCABEZADO, { tipo: 'produccion', pieza: 'main', ref: SHA, texto: 'apruebo', quien: 'Ana', ...m }, AHORA).ok, false, JSON.stringify(m));
  }
});

test('aprobar · defecto 1: un sha sólo vale con tipo produccion; todo otro tipo exige vN (uso incorrecto)', () => {
  for (const tipo of ['pedido', 'research', 'marca', 'boceto', 'spec', 'preview']) {
    const conSha = registrarEnTexto(ENCABEZADO, { tipo, ref: SHA, texto: 'apruebo', quien: 'Ana' }, AHORA);
    assert.equal(conSha.ok, false, tipo);
    assert.equal(conSha.uso, true, tipo);
    assert.match(conSha.reason, new RegExp(`--tipo ${tipo} .*vN`), 'el error dice la forma correcta');
    assert.equal(registrarEnTexto(ENCABEZADO, { tipo, ref: 'v1', texto: 'apruebo', quien: 'Ana' }, AHORA).ok, true, tipo);
  }
  for (const ref of ['v2', 'abc123', 'a'.repeat(41), 'ABCDEF1x']) {
    const r = registrarEnTexto(ENCABEZADO, { tipo: 'produccion', ref, texto: 'apruebo', quien: 'Ana' }, AHORA);
    assert.equal(r.ok, false, ref);
    assert.equal(r.uso, true, ref);
    assert.match(r.reason, /--tipo produccion .*sha/);
  }
});

test('aprobar · interpretarPrompt: sólo «apruebo <tipo> <vN|sha>» con las reglas de tipo', () => {
  assert.deepEqual(interpretarPrompt(`apruebo produccion ${SHA}`), { tipo: 'produccion', ref: SHA, texto: `apruebo produccion ${SHA}` });
  assert.equal(interpretarPrompt('apruebo boceto v3 dale, así está bien').tipo, 'boceto');
  assert.equal(interpretarPrompt('Apruebo Preview V2').ref, 'v2');
  assert.equal(interpretarPrompt('apruebo marca abc1234'), null, 'una marca no se aprueba con un sha');
  assert.equal(interpretarPrompt('apruebo produccion v2'), null, 'producción no se aprueba con una versión');
  assert.equal(interpretarPrompt(`apruebo main ${SHA}`), null, 'la forma vieja «apruebo <pieza> <sha>» ya no registra');
  assert.equal(interpretarPrompt('apruebo'), null);
  assert.equal(interpretarPrompt('apruebo preview'), null);
  assert.equal(interpretarPrompt('apruebo preview nosesha'), null);
  assert.equal(interpretarPrompt('hola apruebo produccion abcdef1'), null);
  assert.equal(interpretarPrompt(''), null);
  assert.equal(interpretarPrompt(undefined), null);
});

test('aprobar · CLI registrar, check y el gate de aprobación humana lo aceptan', () => {
  conProyecto((root, ledger) => {
    const r = run(['registrar', '--tipo', 'produccion', '--pieza', 'main', '--ref', SHA, '--texto', `apruebo produccion ${SHA}`, '--quien', 'Ana', '--proyecto', root]);
    assert.equal(r.status, 0, r.out);
    assert.equal(run(['registrar', '--tipo', 'preview', '--pieza', 'landing', '--ref', 'v1', '--texto', 'apruebo preview v1', '--quien', 'Ana', '--proyecto', root]).status, 0);
    assert.equal(run(['check', '--proyecto', root]).status, 0);
    const g = spawnSync(process.execPath, [gate, 'produccion', ledger, '--sha', SHA], { encoding: 'utf8' });
    assert.equal(g.status, 0, g.stderr);
    const p = spawnSync(process.execPath, [gate, 'preview', ledger, '--pieza', 'landing'], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
  });
});

test('aprobar · check sale 1 si alguien editó una línea', () => {
  conProyecto((root, ledger) => {
    run(['registrar', '--tipo', 'produccion', '--pieza', 'main', '--ref', SHA, '--texto', 'apruebo main', '--quien', 'Ana', '--proyecto', root]);
    run(['registrar', '--tipo', 'produccion', '--pieza', 'api', '--ref', 'abcdef1', '--texto', 'apruebo api', '--quien', 'Ana', '--proyecto', root]);
    writeFileSync(ledger, readFileSync(ledger, 'utf8').replace('Ana', 'Beto'));
    const c = run(['check', '--proyecto', root]);
    assert.equal(c.status, 1);
    assert.match(c.out, /REJECTED/);
    assert.equal(run(['registrar', '--tipo', 'produccion', '--pieza', 'x', '--ref', 'abcdef2', '--texto', 't', '--quien', 'Ana', '--proyecto', root]).status, 1);
  });
});

test('aprobar · check sin registro dice VACÍO y sale 0', () => {
  conProyecto((root) => {
    const c = run(['check', '--proyecto', root]);
    assert.equal(c.status, 0);
    assert.match(c.out, /VAC/);
  });
});

test('aprobar · hook registra sólo «apruebo <tipo> <vN|sha>» y siempre sale 0', () => {
  conProyecto((root, ledger) => {
    const evento = (prompt) => JSON.stringify({ prompt, cwd: root });
    for (const basura of [evento('hola'), evento('apruebo'), evento('apruebo main'), evento('apruebo marca abc1234'), evento('apruebo produccion v2'),
      evento(`apruebo main ${SHA}`), 'esto no es json', '', JSON.stringify({ cwd: root })]) {
      const r = run(['hook'], basura);
      assert.equal(r.status, 0, r.out);
    }
    assert.throws(() => readFileSync(ledger), /ENOENT/);
    const ok = run(['hook'], evento(`apruebo produccion ${SHA}`));
    assert.equal(ok.status, 0, ok.out);
    assert.match(readFileSync(ledger, 'utf8'), /\| produccion \| produccion \| a1b2c3d4/);
    assert.equal(run(['hook'], evento('apruebo boceto v1 así')).status, 0);
    assert.match(readFileSync(ledger, 'utf8'), /\| boceto \| boceto \| v1 \|/);
    assert.equal(run(['check', '--proyecto', root]).status, 0);
  });
});

test('aprobar · uso incorrecto sale 2', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(['zzz']).status, 2);
  assert.equal(run(['registrar', '--tipo', 'preview']).status, 2);
  assert.equal(run(['registrar', '--que', 'a', '--sha', SHA, '--texto', 't']).status, 2, 'la interfaz vieja ya no existe');
  assert.equal(run(['check', '--zzz']).status, 2);
  assert.equal(run(['usar']).status, 2);
});

test('aprobar · CLI registrar: combinación tipo/ref inválida sale 2 sin escribir nada', () => {
  conProyecto((root, ledger) => {
    const casos = [
      ['--tipo', 'marca', '--ref', SHA], ['--tipo', 'pedido', '--ref', 'abc1234'], ['--tipo', 'produccion', '--ref', 'v2'],
      ['--tipo', 'deploy', '--ref', 'v1'], ['--ref', SHA], ['--tipo', 'preview', '--ref', 'dos'],
    ];
    for (const c of casos) {
      const r = run(['registrar', ...c, '--texto', 'apruebo', '--quien', 'Ana', '--proyecto', root]);
      assert.equal(r.status, 2, `${c.join(' ')}\n${r.out}`);
    }
    assert.throws(() => readFileSync(ledger), /ENOENT/);
  });
});

test('aprobar · defecto 1: una marca aprobada nunca es orden de producción para el gate 5', () => {
  conProyecto((root, ledger) => {
    assert.equal(run(['registrar', '--tipo', 'marca', '--ref', 'v1', '--texto', 'apruebo marca v1', '--quien', 'Ana', '--proyecto', root]).status, 0);
    const g = spawnSync(process.execPath, [gate, 'produccion', ledger, '--sha', SHA], { encoding: 'utf8' });
    assert.equal(g.status, 1, g.stdout);
  });
});

test('aprobar · usar: la orden de producción vale una vez (fila «usada» encadenada; la segunda sale 1)', () => {
  conProyecto((root, ledger) => {
    assert.equal(run(['usar', '--sha', SHA, '--proyecto', root]).status, 1, 'sin orden no hay nada que usar');
    run(['registrar', '--tipo', 'produccion', '--pieza', 'main', '--ref', SHA, '--texto', 'apruebo produccion', '--quien', 'Ana', '--proyecto', root]);
    const u = run(['usar', '--sha', SHA.slice(0, 10), '--proyecto', root]);
    assert.equal(u.status, 0, u.out);
    const texto = readFileSync(ledger, 'utf8');
    assert.match(texto, new RegExp(`\\| produccion \\| main \\| ${SHA} \\| .* \\| Ana \\| usada \\| chain:`), 'la fila usada lleva el sha completo de la orden');
    assert.equal(run(['check', '--proyecto', root]).status, 0);
    const g = spawnSync(process.execPath, [gate, 'produccion', ledger, '--sha', SHA], { encoding: 'utf8' });
    assert.equal(g.status, 1);
    assert.match(g.stderr, /usada/);
    const dos = run(['usar', '--sha', SHA, '--proyecto', root]);
    assert.equal(dos.status, 1, dos.out);
    assert.equal(readFileSync(ledger, 'utf8'), texto, 'la segunda vez no escribe');
    assert.equal(run(['usar', '--sha', 'v2', '--proyecto', root]).status, 2);
  });
});
