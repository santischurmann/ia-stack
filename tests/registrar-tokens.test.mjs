// ia-stack-3-4-1-tokens · AC8 — registro de tokens por subagente y su informe semanal.
//
// POR QUE EXISTE. Sin medir el gasto por rol, la tabla de ruteo se revisa a ojo. Esta prueba fija que
// `.vibe/tokens.jsonl` se escribe sellado con el MISMO encadenado de verify-audit-chain (se compara
// contra su `verifyChain`, no contra un hash propio), que valores invalidos se rechazan y que el
// informe lista tokens por rol y modelo mas las escaladas.
//
// LO QUE NO CUBRE: que los numeros declarados por el agente sean ciertos (los pone quien registra), ni
// dos `append` simultaneos (leer-y-agregar no es atomico: el segundo puede sellar sobre una cabeza
// vieja y el siguiente `check` lo rechaza; no corrompe en silencio, pero tampoco lo evita).

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { sealLineFor, verifyChain } from '../scripts/verify-audit-chain.mjs';
import { aRegistro, checkArchivo, leerModelos, leerRegistros, leerRoles, main as registrar } from '../scripts/registrar-tokens.mjs';
import { construirInforme, fechaAR, main as informar, parsearFecha } from '../scripts/informe-tokens.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const REG = join(repoRoot, 'scripts', 'registrar-tokens.mjs');
const INF = join(repoRoot, 'scripts', 'informe-tokens.mjs');
const SELLO = / \| chain:[0-9a-f]{64}$/u;

function run(script, args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.error, undefined, `no pudo lanzar: ${r.error?.message}`);
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
function conDir(fn) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-tokens-'));
  try {
    fn(root, join(root, '.vibe', 'tokens.jsonl'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const cap = () => {
  const o = { out: [], err: [] };
  o.write = (m) => o.out.push(m);
  o.writeError = (m) => o.err.push(m);
  return o;
};
const base = (extra = []) => ['append', '--tarea', 'T01', '--rol', 'green', '--modelo', 'sonnet-5.5', '--in', '1200', '--out', '300', '--escalo', 'no', ...extra];
const AHORA = new Date('2026-10-26T15:30:00.000Z');

test('ia-stack-3-4-1-tokens · AC8 · append escribe una línea JSON sellada que verify-audit-chain verifica', () => {
  conDir((root, file) => {
    const a = run(REG, base(['--file', file]));
    assert.equal(a.status, 0, a.stderr);
    const b = run(REG, ['append', '--tarea', 'T02', '--rol', 'red', '--modelo', 'sonnet-5.5', '--in', '10', '--out', '5', '--escalo', 'si', '--file', file]);
    assert.equal(b.status, 0, b.stderr);
    const texto = readFileSync(file, 'utf8');
    const lineas = texto.trim().split('\n');
    assert.equal(lineas.length, 2);
    assert.match(lineas[0], SELLO);
    const v = verifyChain(texto);
    assert.equal(v.ok, true);
    assert.equal(v.verified, 2);
    const reg = JSON.parse(lineas[0].replace(SELLO, ''));
    assert.deepEqual(Object.keys(reg), ['fecha', 'tarea', 'rol', 'modelo', 'tokens_in', 'tokens_out', 'escalo']);
    assert.match(reg.fecha, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u);
    assert.deepEqual([reg.tarea, reg.rol, reg.modelo, reg.tokens_in, reg.tokens_out, reg.escalo], ['T01', 'green', 'sonnet-5.5', 1200, 300, false]);
    assert.equal(JSON.parse(lineas[1].replace(SELLO, '')).escalo, true);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · append crea .vibe/ si falta y usa .vibe/tokens.jsonl por defecto', () => {
  conDir((root) => {
    const r = run(REG, base(), root);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(root, '.vibe', 'tokens.jsonl')));
    const c = cap();
    assert.equal(registrar(['check', '--file', join(root, '.vibe', 'tokens.jsonl')], { ahora: AHORA }, c.write, c.writeError), 0, c.err.join());
  });
});

test('ia-stack-3-4-1-tokens · AC8 · valores inválidos salen ≠0 con mensaje y no escriben nada', () => {
  conDir((root, file) => {
    const reemplazo = (de, a) => base().map((x) => (x === de ? a : x));
    const casos = [
      [['append', '--tarea', 'T1', '--rol', 'inventado', '--modelo', 'm', '--in', '1', '--out', '1', '--escalo', 'no'], /rol/u],
      [reemplazo('1200', '-3'), /--in/u],
      [reemplazo('1200', '1.5'), /--in/u],
      [reemplazo('300', 'abc'), /--out/u],
      [reemplazo('no', 'quizas'), /--escalo/u],
      [reemplazo('T01', ' '), /--tarea/u],
      [reemplazo('sonnet-5.5', ''), /--modelo/u],
      [base().slice(0, -2), /--escalo/u],
      [[...base(), '--raro', 'x'], /desconocido/u],
      [[...base(), '--tarea'], /--tarea/u],
      [['append', 'suelto'], /inesperado/u],
      [base().filter((x, i, a) => x !== '--in' && a[i - 1] !== '--in'), /falta --in/u],
      [['check', '--tarea', 'x'], /check sólo acepta/u],
      [reemplazo('T01', 'x'.repeat(4100)), /sellar/u],
      [['append', '--in', '1', '--in', '2'], /repetido/u],
      [[], /usage/u],
      [['borrar'], /usage/u],
    ];
    for (const [args, patron] of casos) {
      const r = run(REG, [...args, '--file', file]);
      assert.notEqual(r.status, 0, `debía rechazar ${args.join(' ')}`);
      assert.match(r.stderr, patron, args.join(' '));
    }
    assert.equal(existsSync(file), false);
    const c = cap();
    assert.equal(registrar(['append', '--tarea'], {}, c.write, c.writeError), 1);
    assert.match(c.err.join(), /falta el valor de --tarea/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · append se niega a sellar sobre una cadena rota', () => {
  conDir((root, file) => {
    assert.equal(run(REG, base(['--file', file])).status, 0);
    writeFileSync(file, readFileSync(file, 'utf8').replace('1200', '9999'));
    const r = run(REG, base(['--file', file]));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /REJECTED/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · append falla con mensaje si no puede leer ni escribir el destino', () => {
  conDir((root) => {
    const c = cap();
    // El destino es un directorio: no se puede leer como archivo.
    assert.equal(registrar(base(['--file', root]), { ahora: AHORA }, c.write, c.writeError), 1);
    assert.match(c.err.join(), /REJECTED/u);
    // Se puede leer (no existe) pero no escribir: el padre es un archivo.
    writeFileSync(join(root, 'archivo'), 'x');
    const c2 = cap();
    assert.equal(registrar(base(['--file', join(root, 'archivo', 'sub', 'tokens.jsonl')]), { ahora: AHORA }, c2.write, c2.writeError), 1);
    assert.match(c2.err.join(), /REJECTED/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · check: cadena intacta sale 0; editada o con una línea sin sello sale ≠0', () => {
  conDir((root, file) => {
    run(REG, base(['--file', file]));
    run(REG, base(['--file', file]));
    const ok = run(REG, ['check', '--file', file]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /OK/u);
    const original = readFileSync(file, 'utf8');

    writeFileSync(file, original.replace('1200', '1201'));
    const editada = run(REG, ['check', '--file', file]);
    assert.notEqual(editada.status, 0);
    assert.match(editada.stderr, /REJECTED/u);

    writeFileSync(file, `${original}{"fecha":"2026-10-26T00:00:00.000Z","tarea":"X","rol":"green","modelo":"m","tokens_in":1,"tokens_out":1,"escalo":false}\n`);
    assert.notEqual(run(REG, ['check', '--file', file]).status, 0);

    assert.notEqual(run(REG, ['check', '--file', file, '--extra']).status, 0);
    assert.notEqual(run(REG, ['check', '--file', root]).status, 0);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · leerRegistros rechaza líneas selladas que no son registros válidos', () => {
  const sellar = (contenido, texto) => contenido + sealLineFor(contenido, texto).append;
  const valido = { fecha: '2026-10-26T15:30:00.000Z', tarea: 'T', rol: 'green', modelo: 'm', tokens_in: 1, tokens_out: 2, escalo: false };
  const malos = [
    'esto no es json',
    '[]',
    JSON.stringify({ ...valido, rol: 'inventado' }),
    JSON.stringify({ ...valido, tokens_in: -1 }),
    JSON.stringify({ ...valido, tokens_out: 'x' }),
    JSON.stringify({ ...valido, escalo: 'si' }),
    JSON.stringify({ ...valido, fecha: 'ayer' }),
    JSON.stringify({ ...valido, tarea: '' }),
    JSON.stringify({ ...valido, modelo: 3 }),
  ];
  const roles = leerRoles();
  assert.ok(roles.includes('green'));
  for (const malo of malos) {
    const r = leerRegistros(sellar('', malo), roles);
    assert.equal(r.ok, false, malo);
    assert.match(r.error, /línea 1/u);
  }
  const bien = leerRegistros(sellar('', JSON.stringify(valido)), roles);
  assert.equal(bien.ok, true);
  assert.equal(bien.registros.length, 1);
  // Una línea heredada sin sello: la cadena la toleraría, pero en este archivo todo va sellado.
  const heredada = leerRegistros(`${JSON.stringify(valido)}\n`, roles);
  assert.equal(heredada.ok, false);
  assert.match(heredada.error, /sello/u);
  // Cadena rota.
  const rota = leerRegistros(sellar('', JSON.stringify(valido)).replace('"T"', '"U"'), roles);
  assert.equal(rota.ok, false);
  assert.match(rota.error, /cadena/u);
  assert.deepEqual(leerRegistros('', roles), { ok: true, registros: [], error: null });
  assert.equal(checkArchivo('', roles).ok, true);
});

test('ia-stack-3-4-1-tokens · AC8 · leerRoles lee los roles del contrato y falla con mensaje si el contrato es ilegible', () => {
  conDir((root) => {
    assert.throws(() => leerRoles(join(root, 'no-existe.json')), /contrato/u);
    writeFileSync(join(root, 'c0.json'), '{}');
    assert.throws(() => leerRoles(join(root, 'c0.json')), /roles/u);
    writeFileSync(join(root, 'c.json'), '{"roles":{}}');
    assert.throws(() => leerRoles(join(root, 'c.json')), /roles/u);
    writeFileSync(join(root, 'c2.json'), '{"roles":{"x":{}}}');
    assert.deepEqual(leerRoles(join(root, 'c2.json')), ['x']);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · aRegistro arma el registro con la fecha inyectada', () => {
  const r = aRegistro({ tarea: 'T', rol: 'red', modelo: 'm', in: 1, out: 2, escalo: true }, AHORA);
  assert.deepEqual(r, { fecha: '2026-10-26T15:30:00.000Z', tarea: 'T', rol: 'red', modelo: 'm', tokens_in: 1, tokens_out: 2, escalo: true });
});

// ---- informe ----

function sembrar(file, filas) {
  for (const [fecha, tarea, rol, modelo, tin, tout, escalo] of filas) {
    const c = cap();
    const args = ['append', '--tarea', tarea, '--rol', rol, '--modelo', modelo, '--in', String(tin), '--out', String(tout), '--escalo', escalo, '--file', file];
    assert.equal(registrar(args, { ahora: new Date(fecha) }, c.write, c.writeError), 0, c.err.join());
  }
}
const FILAS = [
  ['2026-10-20T12:00:00.000Z', 'T01', 'green', 'sonnet-5.5', 1000, 200, 'no'],
  ['2026-10-21T12:00:00.000Z', 'T02', 'green', 'sonnet-5.5', 500, 100, 'si'],
  ['2026-10-22T12:00:00.000Z', 'T02', 'green', 'opus-5.5', 4000, 800, 'no'],
  ['2026-10-23T12:00:00.000Z', 'T03', 'docs', 'haiku-5.5', 70, 30, 'no'],
  ['2026-09-01T12:00:00.000Z', 'T00', 'red', 'sonnet-5.5', 9, 9, 'si'],
];

test('ia-stack-3-4-1-tokens · AC8 · el informe lista tokens por rol, por modelo y las escaladas, con fechas DD-MM-AAAA', () => {
  conDir((root, file) => {
    sembrar(file, FILAS);
    const r = run(INF, ['--file', file, '--desde', '2026-10-19', '--hasta', '2026-10-26']);
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout;
    assert.match(out, /19-10-2026/u);
    assert.match(out, /26-10-2026/u);
    assert.doesNotMatch(out, /2026-10-19/u);
    assert.match(out, /\| green \| 3 \| 5500 \| 1100 \|/u);
    assert.match(out, /\| docs \| 1 \| 70 \| 30 \|/u);
    assert.doesNotMatch(out, /\| red \|/u, 'T00 es de septiembre: fuera del período');
    assert.match(out, /\| sonnet-5\.5 \| 2 \| 1500 \| 300 \|/u);
    assert.match(out, /\| opus-5\.5 \| 1 \| 4000 \| 800 \|/u);
    assert.match(out, /\| 21-10-2026 \| T02 \| green \| sonnet-5\.5 \|/u);
    assert.doesNotMatch(out, /T00/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · sin --desde/--hasta toma los últimos 7 días; sin escaladas lo dice', () => {
  conDir((root, file) => {
    sembrar(file, FILAS);
    const c = cap();
    assert.equal(informar(['--file', file], { ahora: new Date('2026-10-26T15:00:00.000Z') }, c.write, c.writeError), 0, c.err.join());
    const out = c.out.join('\n');
    assert.match(out, /20-10-2026 a 26-10-2026/u, '7 días con hoy incluido: desde hoy-6');
    assert.doesNotMatch(out, /19-10-2026/u);
    assert.match(out, /Escaladas/u);
    assert.match(out, /T02/u);
    assert.doesNotMatch(out, /T00/u);

    const c2 = cap();
    assert.equal(informar(['--file', file, '--desde', '2026-10-20', '--hasta', '2026-10-20'], { ahora: AHORA }, c2.write, c2.writeError), 0);
    assert.match(c2.out.join('\n'), /Escaladas[\s\S]*ninguna/u);

    const c3 = cap();
    assert.equal(informar(['--file', file, '--desde', '20-12-2025', '--hasta', '21-12-2025'], { ahora: AHORA }, c3.write, c3.writeError), 0);
    assert.match(c3.out.join('\n'), /sin registros/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · archivo vacío o inexistente: dice «sin registros» y sale 0', () => {
  conDir((root, file) => {
    const sinArgs = run(INF, [], root);
    assert.equal(sinArgs.status, 0, sinArgs.stderr);
    assert.match(sinArgs.stdout, /^VACÍO: sin registros/u);
    const noExiste = run(INF, ['--file', file]);
    assert.equal(noExiste.status, 0, noExiste.stderr);
    assert.match(noExiste.stdout, /sin registros/u);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '');
    const vacio = run(INF, ['--file', file]);
    assert.equal(vacio.status, 0);
    assert.match(vacio.stdout, /sin registros/u);
    const chk = run(REG, ['check', '--file', file]);
    assert.equal(chk.status, 0);
    assert.match(chk.stdout, /sin registros/u);
  });
});

test('ia-stack-3-4-1-tokens · AC8 · el informe sale ≠0 con sello roto, línea sin sello, fecha inválida o argumento desconocido', () => {
  conDir((root, file) => {
    sembrar(file, FILAS.slice(0, 2));
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, original.replace('1000', '1001'));
    const sello = run(INF, ['--file', file, '--desde', '2026-01-01']);
    assert.notEqual(sello.status, 0);
    assert.match(sello.stderr, /REJECTED/u);

    writeFileSync(file, 'basura sin sello\n');
    assert.notEqual(run(INF, ['--file', file, '--desde', '2026-01-01']).status, 0);

    writeFileSync(file, original);
    for (const args of [['--desde', '31-02-2026'], ['--desde', 'ayer'], ['--hasta', '2026-13-01'], ['--desde', '2026-10-27', '--hasta', '2026-10-01'], ['--raro'], ['--desde'], ['suelto']]) {
      const r = run(INF, ['--file', file, ...args]);
      assert.notEqual(r.status, 0, args.join(' '));
      assert.ok(r.stderr.length > 0, args.join(' '));
    }
    assert.notEqual(run(INF, ['--file', root]).status, 0, 'un directorio no se puede leer: error, no «sin registros»');
  });
});

test('ia-stack-3-4-1-tokens · AC8 · parsearFecha, fechaAR y construirInforme', () => {
  assert.equal(parsearFecha('2026-10-19'), '2026-10-19');
  assert.equal(parsearFecha('19-10-2026'), '2026-10-19');
  assert.equal(parsearFecha('29-02-2026'), null);
  assert.equal(parsearFecha('2026-10-1'), null);
  assert.equal(fechaAR('2026-10-27T01:00:00.000Z'), '2026-10-26', 'hora argentina: UTC-3');
  assert.match(construirInforme([], '2026-10-19', '2026-10-26'), /sin registros/u);
});

// ---- Revisión N3 3.4.1 ----

test('revision-n3 · MEDIA 5 · «últimos 7 días» son 7 (hoy-6..hoy): el de hoy-7 queda afuera, el de hoy-6 entra', () => {
  conDir((root, file) => {
    sembrar(file, [
      ['2026-10-19T15:00:00.000Z', 'T-FUERA', 'red', 'sonnet-5.5', 1, 1, 'no'],
      ['2026-10-20T15:00:00.000Z', 'T-BORDE', 'green', 'sonnet-5.5', 2, 2, 'no'],
    ]);
    const c = cap();
    assert.equal(informar(['--file', file], { ahora: new Date('2026-10-26T15:00:00.000Z') }, c.write, c.writeError), 0, c.err.join());
    const out = c.out.join('\n');
    assert.match(out, /\| green \| 1 \| 2 \| 2 \|/u);
    assert.doesNotMatch(out, /\| red \|/u);
  });
});

test('revision-n3 · BAJA · el informe escapa | en tarea y modelo para no romper la tabla markdown', () => {
  const registros = [{ fecha: '2026-10-21T12:00:00.000Z', tarea: 'T|1', rol: 'green', modelo: 'sonnet|x', tokens_in: 1, tokens_out: 1, escalo: true }];
  const out = construirInforme(registros, '2026-10-20', '2026-10-26');
  assert.ok(out.includes('| T\\|1 |'), out);
  assert.ok(out.includes('| sonnet\\|x |'), out);
  assert.ok(!/[^\\]\|1 /u.test(out), out);
});

test('revision-n3 · BAJA · --modelo se normaliza y se valida contra niveles.*.modelo del contrato', () => {
  conDir((root, file) => {
    const con = (modelo) => base().map((x) => (x === 'sonnet-5.5' ? modelo : x));
    for (const modelo of ['  Sonnet-5.5 ', 'OPUS', 'fable-5.1']) {
      const c = cap();
      assert.equal(registrar([...con(modelo), '--file', file], { ahora: AHORA }, c.write, c.writeError), 0, c.err.join());
    }
    const lineas = readFileSync(file, 'utf8').trim().split('\n');
    assert.deepEqual(lineas.map((l) => JSON.parse(l.replace(SELLO, '')).modelo), ['sonnet-5.5', 'opus', 'fable-5.1']);
    for (const malo of ['gpt-4', 'sonnetx', 'sonnet 5', 'm', 'haiku|x']) {
      const c = cap();
      assert.equal(registrar([...con(malo), '--file', file], { ahora: AHORA }, c.write, c.writeError), 1, malo);
      assert.match(c.err.join(), /--modelo/u, malo);
    }
    assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 3);
  });
});

test('revision-n3 · BAJA · leerModelos lee los modelos de los niveles del contrato y valida', () => {
  assert.deepEqual(leerModelos(), ['haiku', 'sonnet', 'opus', 'fable']);
  conDir((root) => {
    const malo = join(root, 'c.json');
    assert.throws(() => leerModelos(malo), /contrato/u);
    for (const contrato of [{}, { niveles: {} }, { niveles: { N1: null, N2: {}, N3: { modelo: '' } } }]) {
      writeFileSync(malo, JSON.stringify(contrato));
      assert.throws(() => leerModelos(malo), /niveles/u);
    }
    writeFileSync(malo, '{');
    assert.throws(() => leerModelos(malo), /contrato/u);
  });
});
