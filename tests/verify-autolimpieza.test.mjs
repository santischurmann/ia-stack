// verify-autolimpieza.mjs — el verificador de la regla de autolimpieza (lote 5, fase 5A).
//
// Juzga el REGISTRO, no el disco entero: que el contrato de limpieza este bien formado, que cada accion
// del log (cuarentena, restauracion, purga) respete la lista blanca y la retencion, y que lo que esta
// en cuarentena coincida con lo que el log dice haber movido. Namespace y no import con nombre: cada
// prueba falla por su cuenta mientras la API no existe.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { sealLineFor } from '../scripts/verify-audit-chain.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-autolimpieza.mjs');
const gate = await import(pathToFileURL(script).href);

const INTOCABLES = /\.(?:env|key)$/iu;
const SHA = 'a'.repeat(64);
const SHA2 = 'b'.repeat(64);

const CONTRATO = Object.freeze({
  schema: 'ia.autolimpieza/1',
  why: 'Limpiar sin perder: nada se borra de entrada, todo pasa por una cuarentena con su log.',
  cuarentena: { directorio: '.vibe/cuarentena', retencion_dias: 30 },
  log: '.vibe/LIMPIEZA.md',
  categorias: [
    { id: 'temporales-de-corridas', que: 'carpetas que una corrida interrumpida deja tiradas', raiz: 'tmp', prefijo: 'run-', edad_minima_horas: 24, como_se_regenera: 'se vuelven a crear al correr de nuevo la suite' },
  ],
});
const con = (cambio) => ({ ...CONTRATO, ...cambio });
const conCategoria = (cambio) => con({ categorias: [{ ...CONTRATO.categorias[0], ...cambio }] });
const sin = (clave) => { const c = { ...CONTRATO }; delete c[clave]; return c; };

function linea(accion, item = '2026-10-05-001', o = {}) {
  const { fecha = '2026-10-05', categoria = 'temporales-de-corridas', ruta = 'tmp/run-abc123', bytes = 12, sha = SHA } = o;
  return `[${fecha}] Limpieza | ${accion} | ${item} | ${categoria} | ${ruta} | ${bytes} | ${sha}`;
}
const entradas = (...textos) => textos.map((t, i) => ({ ...gate.parsearLinea(t), indice: i + 1 }));

// ---------------------------------------------------------------- el contrato

test('5A · un contrato completo y bien formado se acepta', () => {
  assert.deepEqual(gate.validarContrato(CONTRATO, INTOCABLES), []);
});

test('FALSIFICACION · 5A · al contrato le falta o le sobra una pieza', () => {
  for (const clave of ['schema', 'why', 'cuarentena', 'log', 'categorias']) {
    assert.ok(gate.validarContrato(sin(clave), INTOCABLES).length > 0, `sin ${clave}`);
  }
  assert.ok(gate.validarContrato(con({ extra: 1 }), INTOCABLES).length > 0);
  assert.ok(gate.validarContrato(con({ schema: 'otro/1' }), INTOCABLES).length > 0);
  assert.ok(gate.validarContrato(null, INTOCABLES).length > 0);
  assert.ok(gate.validarContrato([], INTOCABLES).length > 0);
  assert.ok(gate.validarContrato(con({ why: '  ' }), INTOCABLES).length > 0);
});

test('FALSIFICACION · 5A · la cuarentena tiene que ser una de verdad', () => {
  assert.ok(gate.validarContrato(con({ cuarentena: { directorio: '.vibe/c' } }), INTOCABLES).length > 0, 'sin retencion');
  assert.ok(gate.validarContrato(con({ cuarentena: { retencion_dias: 30 } }), INTOCABLES).length > 0, 'sin directorio');
  assert.ok(gate.validarContrato(con({ cuarentena: { directorio: '.vibe/c', retencion_dias: 30, x: 1 } }), INTOCABLES).length > 0, 'clave de mas');
  for (const dias of [0, 1, 6, -3, 7.5, '30', null, Number.NaN]) {
    const p = gate.validarContrato(con({ cuarentena: { directorio: '.vibe/c', retencion_dias: dias } }), INTOCABLES);
    assert.ok(p.some((m) => /retenci/u.test(m)), `retencion_dias=${JSON.stringify(dias)}`);
  }
  assert.deepEqual(gate.validarContrato(con({ cuarentena: { directorio: '.vibe/c', retencion_dias: 7 } }), INTOCABLES), [], 'el piso de 7 dias es valido');
  for (const directorio of ['', '/abs', '../fuera', 'a/../b', 'a\\b', 'C:/x', 7, null]) {
    assert.ok(gate.validarContrato(con({ cuarentena: { directorio, retencion_dias: 30 } }), INTOCABLES).length > 0, `directorio=${JSON.stringify(directorio)}`);
  }
  assert.ok(gate.validarContrato(con({ cuarentena: 'no es objeto' }), INTOCABLES).length > 0);
});

test('FALSIFICACION · 5A · el log tiene que ser una ruta del proyecto', () => {
  for (const log of ['', '/abs', '../x', 'a\\b', 7, null]) {
    assert.ok(gate.validarContrato(con({ log }), INTOCABLES).length > 0, `log=${JSON.stringify(log)}`);
  }
});

test('FALSIFICACION · 5A · las categorias son la lista blanca, y cada una se justifica', () => {
  assert.ok(gate.validarContrato(con({ categorias: [] }), INTOCABLES).some((m) => /categor/u.test(m)), 'sin categorias no hay nada que limpiar');
  assert.ok(gate.validarContrato(con({ categorias: 'x' }), INTOCABLES).length > 0);
  for (const clave of ['id', 'que', 'raiz', 'prefijo', 'edad_minima_horas', 'como_se_regenera']) {
    const c = { ...CONTRATO.categorias[0] };
    delete c[clave];
    assert.ok(gate.validarContrato(con({ categorias: [c] }), INTOCABLES).length > 0, `sin ${clave}`);
  }
  assert.ok(gate.validarContrato(conCategoria({ extra: 1 }), INTOCABLES).length > 0);
  assert.ok(gate.validarContrato(con({ categorias: ['texto'] }), INTOCABLES).length > 0);
  for (const id of ['Mal Id', '', 'a_b', 7]) assert.ok(gate.validarContrato(conCategoria({ id }), INTOCABLES).length > 0, `id=${id}`);
  const dup = { ...CONTRATO.categorias[0] };
  assert.ok(gate.validarContrato(con({ categorias: [dup, { ...dup, prefijo: 'otro-' }] }), INTOCABLES).some((m) => /repetid/u.test(m)));
  for (const campo of ['que', 'como_se_regenera']) {
    assert.ok(gate.validarContrato(conCategoria({ [campo]: '  ' }), INTOCABLES).length > 0, `${campo} vacio`);
  }
});

test('FALSIFICACION · 5A · una categoria no puede barrer de mas', () => {
  for (const raiz of ['', '.', '/abs', '../x', 'a\\b', 'C:/x', 7]) assert.ok(gate.validarContrato(conCategoria({ raiz }), INTOCABLES).length > 0, `raiz=${JSON.stringify(raiz)}`);
  for (const prefijo of ['', 'a/b', 'a\\b', '..', 7]) assert.ok(gate.validarContrato(conCategoria({ prefijo }), INTOCABLES).length > 0, `prefijo=${JSON.stringify(prefijo)}`);
  for (const horas of [0, 5, -1, 6.5, '24', null]) {
    assert.ok(gate.validarContrato(conCategoria({ edad_minima_horas: horas }), INTOCABLES).some((m) => /edad/u.test(m)), `edad=${JSON.stringify(horas)}`);
  }
  assert.deepEqual(gate.validarContrato(conCategoria({ edad_minima_horas: 6 }), INTOCABLES), [], 'el piso de 6 horas es valido');
});

test('FALSIFICACION · 5A · una categoria no puede contener a la cuarentena ni al log', () => {
  const rec = gate.validarContrato(con({ categorias: [{ ...CONTRATO.categorias[0], raiz: '.vibe' }] }), INTOCABLES);
  assert.ok(rec.some((m) => /cuarentena/u.test(m)), 'raiz .vibe contiene .vibe/cuarentena: purgaria su propia cuarentena');
  const logDentro = gate.validarContrato(con({ log: 'tmp/limpieza.md' }), INTOCABLES);
  assert.ok(logDentro.some((m) => /log/u.test(m)), 'el log dentro de una raiz se barreria a si mismo');
  const igual = gate.validarContrato(con({ cuarentena: { directorio: 'tmp', retencion_dias: 30 } }), INTOCABLES);
  assert.ok(igual.some((m) => /cuarentena/u.test(m)));
  assert.deepEqual(gate.validarContrato(con({ categorias: [{ ...CONTRATO.categorias[0], raiz: 'tmp-otro' }] }), INTOCABLES), [], 'un nombre que solo comparte texto no es contencion');
});

test('FALSIFICACION · 5A · una categoria no puede apuntar a lo intocable', () => {
  const p = gate.validarContrato(conCategoria({ prefijo: 'secretos.env' }), INTOCABLES);
  assert.ok(p.some((m) => /intocable/u.test(m)));
  assert.deepEqual(gate.validarContrato(conCategoria({ prefijo: 'run-' }), INTOCABLES), []);
});

// ---------------------------------------------------------------- una linea del log

test('5A · parsearLinea lee los siete campos y rechaza lo que no encaja', () => {
  const ok = gate.parsearLinea(linea('cuarentena'));
  assert.deepEqual({ ...ok }, { ok: true, fecha: '2026-10-05', accion: 'cuarentena', item: '2026-10-05-001', categoria: 'temporales-de-corridas', ruta: 'tmp/run-abc123', bytes: 12, sha256: SHA });
  for (const accion of ['restauracion', 'purga']) assert.equal(gate.parsearLinea(linea(accion)).ok, true);
  const malas = [
    'sin forma', linea('borrado'), linea('cuarentena', 'sin-formato'), linea('cuarentena', '2026-10-05-001', { fecha: '2026-13-45' }),
    linea('cuarentena', '2026-10-05-001', { bytes: -1 }), linea('cuarentena', '2026-10-05-001', { bytes: 'x' }), linea('cuarentena', '2026-10-05-001', { sha: 'corto' }),
    linea('cuarentena', '2026-10-05-001', { ruta: '/abs/x' }), linea('cuarentena', '2026-10-05-001', { ruta: '../x' }), linea('cuarentena', '2026-10-05-001', { ruta: 'a\\b' }),
    `${linea('cuarentena')} | sobra`, `[2026-10-05] Otro | cuarentena | 2026-10-05-001 | c | tmp/x | 1 | ${SHA}`,
  ];
  for (const m of malas) assert.equal(gate.parsearLinea(m).ok, false, m);
});

// ---------------------------------------------------------------- el registro

const problemas = (...textos) => gate.juzgarRegistro(entradas(...textos), CONTRATO, INTOCABLES).problemas;

test('5A · una cuarentena sola es un registro valido y queda pendiente', () => {
  const r = gate.juzgarRegistro(entradas(linea('cuarentena')), CONTRATO, INTOCABLES);
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.pendientes.map((p) => p.item), ['2026-10-05-001']);
  assert.equal(r.resueltas, 0);
});

test('5A · cuarentena y despues purga con la retencion cumplida, o restauracion', () => {
  const purgada = gate.juzgarRegistro(entradas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-04' })), CONTRATO, INTOCABLES);
  assert.deepEqual(purgada.problemas, []);
  assert.deepEqual(purgada.pendientes, []);
  assert.equal(purgada.resueltas, 1);
  const restaurada = gate.juzgarRegistro(entradas(linea('cuarentena'), linea('restauracion', '2026-10-05-001', { fecha: '2026-10-06' })), CONTRATO, INTOCABLES);
  assert.deepEqual(restaurada.problemas, [], 'restaurar no exige esperar la retencion: es deshacer');
  assert.deepEqual(restaurada.pendientes, []);
});

test('FALSIFICACION · 5A · lo que no esta en la lista blanca no se mueve', () => {
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { categoria: 'inventada' })).some((m) => /no está declarada/u.test(m)));
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { ruta: 'src/run-abc123' })).some((m) => /fuera de la raíz/u.test(m)), 'otra raiz');
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { ruta: 'tmp/otra-cosa' })).some((m) => /prefijo/u.test(m)), 'otro prefijo');
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { ruta: 'tmp/run-a/b/c' })).some((m) => /hijo directo/u.test(m)), 'un nieto no es candidato: se mueve el hijo de la raiz');
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { ruta: 'tmp/run-secreto.env' })).some((m) => /intocable/u.test(m)), 'el veto de lo irreemplazable pesa mas que la lista blanca');
});

test('FALSIFICACION · 5A · no se purga lo que no paso por cuarentena ni antes de tiempo', () => {
  assert.ok(problemas(linea('purga')).some((m) => /sin cuarentena previa/u.test(m)));
  assert.ok(problemas(linea('restauracion')).some((m) => /sin cuarentena previa/u.test(m)));
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-03' })).some((m) => /retención/u.test(m)), '29 dias de 30');
  assert.ok(problemas(linea('cuarentena', '2026-10-05-001', { fecha: '2026-10-05' }), linea('purga', '2026-10-05-001', { fecha: '2026-10-05' })).some((m) => /retención/u.test(m)), 'el mismo dia');
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-10-04' })).some((m) => /anterior/u.test(m)), 'purgar antes de haberla movido');
});

test('FALSIFICACION · 5A · un item se resuelve una sola vez y no cambia de identidad', () => {
  assert.ok(problemas(linea('cuarentena'), linea('restauracion', '2026-10-05-001', { fecha: '2026-10-06' }), linea('purga', '2026-10-05-001', { fecha: '2026-12-01' })).some((m) => /ya fue/u.test(m)), 'purgar lo restaurado');
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-10' }), linea('restauracion', '2026-10-05-001', { fecha: '2026-11-11' })).some((m) => /ya fue/u.test(m)), 'restaurar lo purgado');
  assert.ok(problemas(linea('cuarentena'), linea('cuarentena')).some((m) => /repetid/u.test(m)), 'el mismo id dos veces');
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-10', sha: SHA2 })).some((m) => /no coincide con su cuarentena/u.test(m)), 'otro hash');
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-10', ruta: 'tmp/run-otra' })).some((m) => /no coincide con su cuarentena/u.test(m)), 'otra ruta');
  assert.ok(problemas(linea('cuarentena'), linea('purga', '2026-10-05-001', { fecha: '2026-11-10', categoria: 'inventada' })).some((m) => /no coincide con su cuarentena/u.test(m)), 'otra categoria');
});

test('5A · lineas que no se pueden leer se nombran con su numero', () => {
  const r = gate.juzgarRegistro([{ ok: false, motivo: 'no tiene siete campos', indice: 4 }], CONTRATO, INTOCABLES);
  assert.ok(r.problemas.some((m) => /línea 4/u.test(m) && /siete campos/u.test(m)));
});

// ---------------------------------------------------------------- la cuarentena en disco

function proyecto() {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-autolimpieza-'));
  mkdirSync(join(raiz, '.vibe'), { recursive: true });
  return raiz;
}
function plantarEnCuarentena(raiz, item, base, contenido) {
  mkdirSync(join(raiz, '.vibe', 'cuarentena', item, base), { recursive: true });
  writeFileSync(join(raiz, '.vibe', 'cuarentena', item, base, 'dato.txt'), contenido);
  return gate.huellaDeArbol(join(raiz, '.vibe', 'cuarentena', item, base));
}

test('5A · huellaDeArbol: un archivo, un directorio, y que dependa del contenido y de los nombres', () => {
  const raiz = proyecto();
  try {
    writeFileSync(join(raiz, 'a.txt'), 'hola');
    const archivo = gate.huellaDeArbol(join(raiz, 'a.txt'));
    assert.equal(archivo.bytes, 4);
    assert.match(archivo.sha256, /^[0-9a-f]{64}$/u);
    mkdirSync(join(raiz, 'd1'));
    mkdirSync(join(raiz, 'd2'));
    writeFileSync(join(raiz, 'd1', 'x.txt'), 'uno');
    writeFileSync(join(raiz, 'd2', 'x.txt'), 'uno');
    assert.equal(gate.huellaDeArbol(join(raiz, 'd1')).sha256, gate.huellaDeArbol(join(raiz, 'd2')).sha256, 'misma estructura y contenido, misma huella');
    writeFileSync(join(raiz, 'd2', 'x.txt'), 'dos');
    assert.notEqual(gate.huellaDeArbol(join(raiz, 'd1')).sha256, gate.huellaDeArbol(join(raiz, 'd2')).sha256, 'el contenido cambia la huella');
    writeFileSync(join(raiz, 'd2', 'x.txt'), 'uno');
    writeFileSync(join(raiz, 'd2', 'y.txt'), 'uno');
    assert.notEqual(gate.huellaDeArbol(join(raiz, 'd1')).sha256, gate.huellaDeArbol(join(raiz, 'd2')).sha256, 'un archivo de mas cambia la huella');
    assert.equal(gate.huellaDeArbol(join(raiz, 'd1')).bytes, 3);
    assert.equal(gate.huellaDeArbol(join(raiz, 'd2')).bytes, 6);
    assert.throws(() => gate.huellaDeArbol(join(raiz, 'no-existe')), /ENOENT/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · lo pendiente coincide con la cuarentena: presente y con la misma huella', () => {
  const raiz = proyecto();
  try {
    const { sha256, bytes } = plantarEnCuarentena(raiz, '2026-10-05-001', 'run-abc123', 'contenido');
    const pendiente = { item: '2026-10-05-001', ruta: 'tmp/run-abc123', sha256, bytes, fecha: '2026-10-05' };
    const r = gate.juzgarCuarentena(CONTRATO, [pendiente], '2026-10-06', raiz);
    assert.deepEqual(r.problemas, []);
    assert.equal(r.vencidas, 0);
    const vencida = gate.juzgarCuarentena(CONTRATO, [pendiente], '2026-12-01', raiz);
    assert.deepEqual(vencida.problemas, [], 'vencida no es un defecto: es purgable');
    assert.equal(vencida.vencidas, 1);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · lo que falta, lo alterado y lo que el log no conoce se rechaza', () => {
  const raiz = proyecto();
  try {
    const { sha256, bytes } = plantarEnCuarentena(raiz, '2026-10-05-001', 'run-abc123', 'contenido');
    const base = { item: '2026-10-05-001', ruta: 'tmp/run-abc123', sha256, bytes, fecha: '2026-10-05' };
    const falta = gate.juzgarCuarentena(CONTRATO, [{ ...base, item: '2026-10-05-009', ruta: 'tmp/run-nada' }], '2026-10-06', raiz);
    assert.ok(falta.problemas.some((m) => /falta en la cuarentena/u.test(m)), 'el log dice que esta y no esta');
    const alterada = gate.juzgarCuarentena(CONTRATO, [{ ...base, sha256: SHA }], '2026-10-06', raiz);
    assert.ok(alterada.problemas.some((m) => /alterad/u.test(m)), 'esta, pero con otro contenido');
    const huerfana = gate.juzgarCuarentena(CONTRATO, [], '2026-10-06', raiz);
    assert.ok(huerfana.problemas.some((m) => /no registra/u.test(m)), 'hay algo en la cuarentena que ningun log movio');
    mkdirSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-abc123', 'sub'), { recursive: true });
    const sinCuarentena = proyecto();
    try {
      assert.deepEqual(gate.juzgarCuarentena(CONTRATO, [], '2026-10-06', sinCuarentena).problemas, [], 'sin directorio de cuarentena y sin pendientes no hay nada que comparar');
    } finally {
      rmSync(sinCuarentena, { recursive: true, force: true });
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- el CLI

function escribirLog(raiz, ...textos) {
  let contenido = '';
  for (const t of textos) {
    contenido += sealLineFor(contenido, t).append;
  }
  mkdirSync(join(raiz, '.vibe'), { recursive: true });
  writeFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), contenido);
}
function correr(raiz, ...args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { cwd: raiz, encoding: 'utf8', env });
  return { status: r.status, salida: `${r.stdout}${r.stderr}` };
}
function conContrato(raiz, contrato = CONTRATO) {
  mkdirSync(join(raiz, 'contracts'), { recursive: true });
  writeFileSync(join(raiz, 'contracts', 'autolimpieza.json'), JSON.stringify(contrato));
}

test('5A · uso invalido sale 2 y no toca nada', () => {
  const raiz = proyecto();
  try {
    for (const args of [[], ['check'], ['borrar', 'x'], ['check', 'a', 'b'], ['check', 'a', '--otra']]) {
      const r = correr(raiz, ...args);
      assert.equal(r.status, 2, args.join(' '));
      assert.match(r.salida, /usage: verify-autolimpieza\.mjs/u);
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · sin contrato es VACIO y sale 0; con --require-inputs es un rechazo', () => {
  const raiz = proyecto();
  try {
    const vacio = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(vacio.status, 0, vacio.salida);
    assert.match(vacio.salida, /^VACÍO: /u);
    const exigido = correr(raiz, 'check', 'contracts/autolimpieza.json', '--require-inputs');
    assert.equal(exigido.status, 1);
    assert.match(exigido.salida, /AUTOLIMPIEZA_NO_INPUTS/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · un contrato ilegible o mal formado se rechaza y se nombra', () => {
  const raiz = proyecto();
  try {
    mkdirSync(join(raiz, 'contracts'));
    writeFileSync(join(raiz, 'contracts', 'autolimpieza.json'), '{ no es json');
    const roto = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(roto.status, 1);
    assert.match(roto.salida, /AUTOLIMPIEZA_CONTRACT_INVALID.*JSON/u);
    conContrato(raiz, con({ cuarentena: { directorio: '/abs', retencion_dias: 2 } }));
    const malo = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(malo.status, 1);
    assert.match(malo.salida, /AUTOLIMPIEZA_CONTRACT_INVALID/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · contrato valido y sin log es VACIO: ninguna limpieza registrada', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /^VACÍO: .*ninguna limpieza/u);
    const exigido = correr(raiz, 'check', 'contracts/autolimpieza.json', '--require-inputs');
    assert.equal(exigido.status, 1);
    assert.match(exigido.salida, /AUTOLIMPIEZA_NO_INPUTS/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · de punta a punta: una cuarentena real, sellada, coincide con el disco', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    const { sha256, bytes } = plantarEnCuarentena(raiz, '2026-10-05-001', 'run-abc123', 'contenido');
    escribirLog(raiz, linea('cuarentena', '2026-10-05-001', { sha: sha256, bytes }));
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /^OK: /u);
    assert.match(r.salida, /1 en cuarentena/u);
    assert.match(r.salida, /LIMITE:/u, 'el verde trae su limite');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · si alguien toca la cuarentena por fuera, el CLI lo ve', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    const { sha256, bytes } = plantarEnCuarentena(raiz, '2026-10-05-001', 'run-abc123', 'contenido');
    escribirLog(raiz, linea('cuarentena', '2026-10-05-001', { sha: sha256, bytes }));
    writeFileSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-abc123', 'dato.txt'), 'otro contenido');
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 1);
    assert.match(r.salida, /alterad/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · una linea editada del log rompe la cadena y se nombra', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    const { sha256, bytes } = plantarEnCuarentena(raiz, '2026-10-05-001', 'run-abc123', 'contenido');
    escribirLog(raiz, linea('cuarentena', '2026-10-05-001', { sha: sha256, bytes }));
    const ruta = join(raiz, '.vibe', 'LIMPIEZA.md');
    writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('tmp/run-abc123', 'tmp/run-OTRA'));
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 1);
    assert.match(r.salida, /AUTOLIMPIEZA_LOG_BROKEN.*línea 1/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · un log sin sellos no pasa por heredado: la limpieza no tiene pasado anterior', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    writeFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), `${linea('cuarentena')}\n`);
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 1);
    assert.match(r.salida, /AUTOLIMPIEZA_LOG_UNSEALED/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · un fallo de lectura del log o de la cuarentena se informa, no revienta', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    mkdirSync(join(raiz, '.vibe', 'LIMPIEZA.md'));
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 1);
    assert.match(r.salida, /AUTOLIMPIEZA_LOG_UNREADABLE/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- lo que quedaba sin probar

test('5A · una categoria vacia en una linea se rechaza', () => {
  const r = gate.parsearLinea(linea('cuarentena', '2026-10-05-001', { categoria: '' }));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /categoría/u);
});

test('5A · huellaDeArbol no sigue enlaces: los registra por su destino', () => {
  const st = (tipo, size = 0) => ({ isSymbolicLink: () => tipo === 'enlace', isDirectory: () => tipo === 'dir', size });
  const arbol = {
    raiz: ['dir', ['link', 'sub', 'f.txt']],
    'raiz/link': ['enlace', 'destino-afuera'],
    'raiz/sub': ['dir', ['g.txt']],
    'raiz/sub/g.txt': ['archivo', 'GGG'],
    'raiz/f.txt': ['archivo', 'FFF'],
    'enlace-suelto': ['enlace', 'otro-destino'],
  };
  const clave = (p) => p.split(String.fromCharCode(92)).join('/');
  const io = {
    lstat: (p) => st(arbol[clave(p)][0], arbol[clave(p)][0] === 'archivo' ? arbol[clave(p)][1].length : 0),
    readdir: (p) => [...arbol[clave(p)][1]],
    readFile: (p) => Buffer.from(arbol[clave(p)][1]),
    readlink: (p) => arbol[clave(p)][1],
  };
  const dir = gate.huellaDeArbol('raiz', io);
  assert.equal(dir.bytes, 6, 'FFF y GGG; el enlace no suma lo que hay del otro lado');
  assert.match(dir.sha256, /^[0-9a-f]{64}$/u);
  const otroDestino = { ...arbol, 'raiz/link': ['enlace', 'OTRO'] };
  const io2 = { ...io, lstat: (p) => st(otroDestino[clave(p)][0], otroDestino[clave(p)][0] === 'archivo' ? otroDestino[clave(p)][1].length : 0), readlink: (p) => otroDestino[clave(p)][1] };
  assert.notEqual(gate.huellaDeArbol('raiz', io2).sha256, dir.sha256, 'cambiar adonde apunta un enlace cambia la huella');
  const suelto = gate.huellaDeArbol('enlace-suelto', io);
  assert.equal(suelto.bytes, 0);
  assert.match(suelto.sha256, /^[0-9a-f]{64}$/u);
});

test('FALSIFICACION · 5A · un fallo al leer la cuarentena se informa con su causa', () => {
  const pendiente = { item: '2026-10-05-001', ruta: 'tmp/run-abc123', sha256: SHA, bytes: 1, fecha: '2026-10-05' };
  const falla = (code) => Object.assign(new Error(`falla ${code}`), { code });
  const ENOTDIR = gate.juzgarCuarentena(CONTRATO, [pendiente], '2026-10-06', '/p', { huella: () => { throw falla('ENOTDIR'); }, readdir: () => [] });
  assert.ok(ENOTDIR.problemas.some((m) => /falta en la cuarentena/u.test(m)), 'un tramo que es un archivo tambien es faltante');
  const EACCES = gate.juzgarCuarentena(CONTRATO, [pendiente], '2026-10-06', '/p', { huella: () => { throw falla('EACCES'); }, readdir: () => [] });
  assert.ok(EACCES.problemas.some((m) => /no se pudo leer en la cuarentena.*EACCES/u.test(m)));
  const dirMalo = gate.juzgarCuarentena(CONTRATO, [], '2026-10-06', '/p', { readdir: () => { throw falla('EACCES'); } });
  assert.ok(dirMalo.problemas.some((m) => /no se pudo leer la cuarentena.*EACCES/u.test(m)));
  const dirAusente = gate.juzgarCuarentena(CONTRATO, [], '2026-10-06', '/p', { readdir: () => { throw falla('ENOENT'); } });
  assert.deepEqual(dirAusente.problemas, [], 'una cuarentena que todavia no existe no es un defecto');
});

test('5A · main en proceso: un contrato que es una carpeta, o intocables ilegibles, se rechazan con su codigo', () => {
  const raiz = proyecto();
  try {
    mkdirSync(join(raiz, 'contracts', 'autolimpieza.json'), { recursive: true });
    const errores = [];
    const opciones = { cwd: raiz, write: () => {}, writeError: (l) => errores.push(l) };
    assert.equal(gate.main(['check', 'contracts/autolimpieza.json'], opciones), 1);
    assert.match(errores.join('\n'), /AUTOLIMPIEZA_CONTRACT_INVALID.*no se puede leer/u);

    const raiz2 = proyecto();
    try {
      conContrato(raiz2);
      const errores2 = [];
      const code = gate.main(['check', 'contracts/autolimpieza.json'], { cwd: raiz2, write: () => {}, writeError: (l) => errores2.push(l), leerIntocables: () => { throw new Error('no hay lista'); } });
      assert.equal(code, 1);
      assert.match(errores2.join('\n'), /AUTOLIMPIEZA_INTOCABLES_UNREADABLE.*no hay lista/u, 'sin saber que es intocable no se juzga una limpieza');
    } finally {
      rmSync(raiz2, { recursive: true, force: true });
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('5A · un log con solo lineas en blanco es VACIO, no una cadena verificada', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    writeFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), '\n   \n\n');
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 0, r.salida);
    assert.match(r.salida, /^VACÍO: .*ninguna acción/u);
    const exigido = correr(raiz, 'check', 'contracts/autolimpieza.json', '--require-inputs');
    assert.equal(exigido.status, 1);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('FALSIFICACION · 5A · el CLI nombra los problemas del registro y los de la cuarentena por separado', () => {
  const raiz = proyecto();
  try {
    conContrato(raiz);
    escribirLog(raiz, linea('purga', '2026-10-05-001'));
    mkdirSync(join(raiz, '.vibe', 'cuarentena', 'algo-suelto'), { recursive: true });
    const r = correr(raiz, 'check', 'contracts/autolimpieza.json');
    assert.equal(r.status, 1);
    assert.match(r.salida, /AUTOLIMPIEZA_LOG_INVALID.*sin cuarentena previa/u);
    assert.match(r.salida, /AUTOLIMPIEZA_QUARANTINE_INCONSISTENT.*no registra/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
