// autolimpieza.mjs — el ejecutor de la regla de autolimpieza (lote 5, fase 5B).
//
// Mueve a una cuarentena, purga lo vencido y restaura; nunca borra de entrada. La prueba que importa no
// es que haga lo que dice, sino que lo que DEJA lo acepte verify-autolimpieza.mjs: ejecutor y
// verificador son dos juicios sobre el mismo registro, y si discreparan, uno de los dos miente.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { sealLineFor } from '../scripts/verify-audit-chain.mjs';
import * as verificador from '../scripts/verify-autolimpieza.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gate = await import(pathToFileURL(join(repoRoot, 'scripts', 'autolimpieza.mjs')).href);

const HOY = '2026-10-05';
const AHORA = Date.parse('2026-10-05T12:00:00Z');
const HORA = 3_600_000;
const CONTRATO = {
  schema: 'ia.autolimpieza/1',
  why: 'Limpiar sin perder: nada se borra de entrada, todo pasa por una cuarentena con su log.',
  cuarentena: { directorio: '.vibe/cuarentena', retencion_dias: 30 },
  log: '.vibe/LIMPIEZA.md',
  categorias: [
    { id: 'temporales-de-corridas', que: 'carpetas que una corrida interrumpida deja tiradas', raiz: 'tmp', prefijo: 'run-', edad_minima_horas: 24, como_se_regenera: 'se vuelven a crear al correr de nuevo la suite' },
  ],
};

/** Deja `ruta` (y todo lo que tiene adentro) con la fecha de modificacion de hace `horas`. */
function envejecer(ruta, horas, base = AHORA) {
  const fecha = new Date(base - horas * HORA);
  const visitar = (p) => {
    utimesSync(p, fecha, fecha);
    if (existsSync(p) && readdirSyncSafe(p) !== null) for (const n of readdirSyncSafe(p)) visitar(join(p, n));
  };
  visitar(ruta);
}
function readdirSyncSafe(p) {
  try { return readdirSync(p); } catch { return null; }
}
function archivo(raiz, ruta, contenido = 'dato') {
  mkdirSync(dirname(join(raiz, ruta)), { recursive: true });
  writeFileSync(join(raiz, ruta), contenido);
}

function proyecto() {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-autolimp-'));
  mkdirSync(join(raiz, 'contracts'), { recursive: true });
  writeFileSync(join(raiz, 'contracts', 'autolimpieza.json'), JSON.stringify(CONTRATO));
  archivo(raiz, 'tmp/run-viejo-1/dato.txt', 'uno');
  archivo(raiz, 'tmp/run-viejo-2/sub/x.txt', 'dos');
  archivo(raiz, 'tmp/run-nuevo/dato.txt', 'tres');
  archivo(raiz, 'tmp/run-secreto/credenciales.env', 'CLAVE=1');
  archivo(raiz, 'tmp/otra-cosa/x.txt', 'cuatro');
  for (const v of ['tmp/run-viejo-1', 'tmp/run-viejo-2', 'tmp/run-secreto', 'tmp/otra-cosa']) envejecer(join(raiz, v), 48);
  envejecer(join(raiz, 'tmp/run-nuevo'), 1);
  return raiz;
}
function limpiar(raiz) {
  rmSync(raiz, { recursive: true, force: true });
}

function correr(raiz, args, extra = {}) {
  const salida = [];
  const errores = [];
  const code = gate.main(args, { cwd: raiz, hoy: HOY, ahora: AHORA, write: (l) => salida.push(l), writeError: (l) => errores.push(l), ...extra });
  return { code, salida: salida.join('\n'), errores: errores.join('\n') };
}
const C = 'contracts/autolimpieza.json';
const verificar = (raiz, hoy = HOY) => {
  const salida = [];
  const errores = [];
  const code = verificador.main(['check', C], { cwd: raiz, hoy, write: (l) => salida.push(l), writeError: (l) => errores.push(l) });
  return { code, salida: salida.join('\n'), errores: errores.join('\n') };
};
const logDe = (raiz) => readFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), 'utf8').split('\n').filter(Boolean);
const enCuarentena = (raiz) => (existsSync(join(raiz, '.vibe', 'cuarentena')) ? readdirSync(join(raiz, '.vibe', 'cuarentena')).sort() : []);

// ---------------------------------------------------------------- listar: no escribe nada

test('5B · listar nombra las candidatas y por que se omite el resto, y no escribe nada', () => {
  const raiz = proyecto();
  try {
    const r = correr(raiz, ['listar', C]);
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /CANDIDATA tmp\/run-viejo-1 \(temporales-de-corridas, 48 h\)/u);
    assert.match(r.salida, /CANDIDATA tmp\/run-viejo-2/u);
    assert.match(r.salida, /OMITIDA tmp\/run-nuevo: demasiado reciente \(1 h; la categoría pide 24\)/u);
    assert.match(r.salida, /OMITIDA tmp\/run-secreto: contiene una fuente intocable \(credenciales\.env\)/u);
    assert.doesNotMatch(r.salida, /otra-cosa/u, 'lo que no empieza con el prefijo no esta en la lista blanca: ni se nombra');
    assert.match(r.salida, /2 candidata\(s\).*No se movió nada/u);
    assert.equal(existsSync(join(raiz, '.vibe', 'cuarentena')), false);
    assert.equal(existsSync(join(raiz, '.vibe', 'LIMPIEZA.md')), false);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-1')), 'listar no mueve');
  } finally {
    limpiar(raiz);
  }
});

test('5B · candidatas toma la edad de lo MAS RECIENTE que hay adentro, no de la carpeta', () => {
  const raiz = proyecto();
  try {
    archivo(raiz, 'tmp/run-viejo-1/reciente.txt', 'se acaba de escribir');
    envejecer(join(raiz, 'tmp/run-viejo-1/dato.txt'), 48);
    utimesSync(join(raiz, 'tmp/run-viejo-1'), new Date(AHORA - 48 * HORA), new Date(AHORA - 48 * HORA));
    utimesSync(join(raiz, 'tmp/run-viejo-1/reciente.txt'), new Date(AHORA - HORA), new Date(AHORA - HORA));
    const r = gate.candidatas(CONTRATO, raiz, AHORA, /\.env$/iu);
    assert.ok(!r.candidatas.some((c) => c.ruta === 'tmp/run-viejo-1'), 'una corrida en curso toca archivos adentro sin cambiar la fecha de la carpeta');
    assert.ok(r.omitidas.some((o) => o.ruta === 'tmp/run-viejo-1' && /demasiado reciente/u.test(o.motivo)));
  } finally {
    limpiar(raiz);
  }
});

test('5B · masReciente y contieneIntocable, sobre un arbol real', () => {
  const raiz = proyecto();
  try {
    assert.equal(gate.masReciente(join(raiz, 'tmp/run-viejo-2')), AHORA - 48 * HORA);
    assert.equal(gate.masReciente(join(raiz, 'tmp/run-viejo-2/sub/x.txt')), AHORA - 48 * HORA, 'un archivo suelto es su propia fecha');
    assert.equal(gate.contieneIntocable(join(raiz, 'tmp/run-secreto'), /\.env$/iu), 'credenciales.env');
    assert.equal(gate.contieneIntocable(join(raiz, 'tmp/run-viejo-2'), /\.env$/iu), null);
    archivo(raiz, 'tmp/run-viejo-2/sub/hondo/clave.env', 'x');
    assert.equal(gate.contieneIntocable(join(raiz, 'tmp/run-viejo-2'), /\.env$/iu), 'sub/hondo/clave.env', 'lo intocable escondido en un subdirectorio tambien cuenta');
    assert.equal(gate.contieneIntocable(join(raiz, 'tmp/run-viejo-2/sub/x.txt'), /\.env$/iu), null);
    assert.equal(gate.contieneIntocable(join(raiz, 'tmp/run-secreto/credenciales.env'), /\.env$/iu), 'credenciales.env', 'si el candidato ES el archivo intocable');
  } finally {
    limpiar(raiz);
  }
});

// ---------------------------------------------------------------- aplicar: mueve, no borra

test('5B · aplicar mueve a la cuarentena, sella el log, y el verificador lo acepta', () => {
  const raiz = proyecto();
  try {
    const r = correr(raiz, ['aplicar', C]);
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /MOVIDA tmp\/run-viejo-1 -> \.vibe\/cuarentena\/2026-10-05-001/u);
    assert.match(r.salida, /MOVIDA tmp\/run-viejo-2 -> \.vibe\/cuarentena\/2026-10-05-002/u);
    assert.match(r.salida, /2 movida\(s\) a la cuarentena \(retención 30 días\)/u);
    assert.equal(existsSync(join(raiz, 'tmp', 'run-viejo-1')), false, 'salio de donde estaba');
    assert.equal(readFileSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-viejo-1', 'dato.txt'), 'utf8'), 'uno', 'y NO se perdio: esta entero en la cuarentena');
    assert.equal(readFileSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-002', 'run-viejo-2', 'sub', 'x.txt'), 'utf8'), 'dos');
    for (const intacta of ['tmp/run-nuevo', 'tmp/run-secreto', 'tmp/otra-cosa']) assert.ok(existsSync(join(raiz, intacta)), `${intacta} no se toca`);
    assert.equal(logDe(raiz).length, 2);
    const v = verificar(raiz);
    assert.equal(v.code, 0, v.errores);
    assert.match(v.salida, /2 en cuarentena/u);
  } finally {
    limpiar(raiz);
  }
});

test('5B · aplicar dos veces el mismo dia no repite nada y numera siguiendo el log', () => {
  const raiz = proyecto();
  try {
    assert.equal(correr(raiz, ['aplicar', C]).code, 0);
    const otra = correr(raiz, ['aplicar', C]);
    assert.equal(otra.code, 0);
    assert.match(otra.salida, /ninguna candidata: nada que mover/u);
    assert.equal(logDe(raiz).length, 2, 'no agrego lineas');
    archivo(raiz, 'tmp/run-viejo-3/dato.txt', 'cinco');
    envejecer(join(raiz, 'tmp/run-viejo-3'), 48);
    const tercera = correr(raiz, ['aplicar', C]);
    assert.match(tercera.salida, /2026-10-05-003/u);
    assert.equal(verificar(raiz).code, 0);
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · aplicar se niega a actuar sobre un registro roto, y no mueve nada', () => {
  const raiz = proyecto();
  try {
    assert.equal(correr(raiz, ['aplicar', C]).code, 0);
    const ruta = join(raiz, '.vibe', 'LIMPIEZA.md');
    writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('run-viejo-1', 'run-OTRO'));
    archivo(raiz, 'tmp/run-viejo-9/dato.txt', 'nuevo');
    envejecer(join(raiz, 'tmp/run-viejo-9'), 48);
    const r = correr(raiz, ['aplicar', C]);
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_LOG_BROKEN/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-9')), 'sobre un registro roto no se agrega nada mas');
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · si el log no se puede leer, no se mueve nada', () => {
  const raiz = proyecto();
  try {
    mkdirSync(join(raiz, '.vibe', 'LIMPIEZA.md'), { recursive: true });
    const r = correr(raiz, ['aplicar', C]);
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_LOG_UNREADABLE/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-1')));
    assert.equal(existsSync(join(raiz, '.vibe', 'cuarentena')), false, 'ni se crea la cuarentena');
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · lo que no se puede mover se queda donde esta y se dice; lo demas sigue', () => {
  const raiz = proyecto();
  try {
    const falla = (desde, hasta) => {
      if (desde.includes('run-viejo-1')) throw Object.assign(new Error('recurso ocupado'), { code: 'EBUSY' });
      return renameReal(desde, hasta);
    };
    const r = correr(raiz, ['aplicar', C], { io: { rename: falla } });
    assert.equal(r.code, 1, 'algo no se pudo: la corrida no es limpia');
    assert.match(r.errores, /AUTOLIMPIEZA_MOVE_FAILED.*run-viejo-1.*recurso ocupado/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-1')), 'se queda en su lugar');
    assert.equal(existsSync(join(raiz, 'tmp', 'run-viejo-2')), false, 'la otra si se movio');
    assert.equal(logDe(raiz).length, 1, 'y solo se registro lo que de verdad se movio');
    assert.equal(verificar(raiz).code, 0, 'el estado que queda es consistente');
  } finally {
    limpiar(raiz);
  }
});
const renameReal = (await import('node:fs')).renameSync;

// ---------------------------------------------------------------- purgar: solo lo vencido, solo desde la cuarentena

test('5B · purgar no toca lo que todavia esta dentro de su retencion', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['purgar', C], { hoy: '2026-11-03' });
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /ninguna vencida: nada que purgar/u);
    assert.deepEqual(enCuarentena(raiz), ['2026-10-05-001', '2026-10-05-002']);
    assert.equal(logDe(raiz).length, 2);
  } finally {
    limpiar(raiz);
  }
});

test('5B · purgar elimina de verdad lo vencido, sella la purga, y el verificador lo acepta', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['purgar', C], { hoy: '2026-11-04' });
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /PURGADA 2026-10-05-001 \(tmp\/run-viejo-1\)/u);
    assert.match(r.salida, /PURGADA 2026-10-05-002 \(tmp\/run-viejo-2\)/u);
    assert.match(r.salida, /2 purgada\(s\)/u);
    assert.deepEqual(enCuarentena(raiz), [], 'ahora si se fue');
    assert.equal(logDe(raiz).length, 4);
    const v = verificar(raiz, '2026-11-04');
    assert.equal(v.code, 0, v.errores);
    assert.match(v.salida, /0 en cuarentena.*2 resuelta/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-nuevo')), 'y nada mas se toco');
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · purgar no elimina lo que cambio dentro de la cuarentena', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    writeFileSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-viejo-1', 'dato.txt'), 'cambiado por alguien');
    const r = correr(raiz, ['purgar', C], { hoy: '2026-11-10' });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_QUARANTINE_INCONSISTENT.*alterad/u, 'sobre un estado inconsistente no se purga nada');
    assert.deepEqual(enCuarentena(raiz), ['2026-10-05-001', '2026-10-05-002']);
  } finally {
    limpiar(raiz);
  }
});

function plantarCuarentenaA_Mano(raiz, item, base, ruta, archivos) {
  for (const [rel, contenido] of Object.entries(archivos)) archivo(raiz, `.vibe/cuarentena/${item}/${base}/${rel}`, contenido);
  const { sha256, bytes } = verificador.huellaDeArbol(join(raiz, '.vibe', 'cuarentena', item, base));
  const texto = `[2026-10-05] Limpieza | cuarentena | ${item} | temporales-de-corridas | ${ruta} | ${bytes} | ${sha256}`;
  const previo = existsSync(join(raiz, '.vibe', 'LIMPIEZA.md')) ? readFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), 'utf8') : '';
  mkdirSync(join(raiz, '.vibe'), { recursive: true });
  writeFileSync(join(raiz, '.vibe', 'LIMPIEZA.md'), previo + sealLineFor(previo, texto).append);
}

test('FALSIFICACION · 5B · purgar no elimina una carpeta con una fuente intocable adentro', () => {
  const raiz = proyecto();
  try {
    plantarCuarentenaA_Mano(raiz, '2026-10-05-001', 'run-con-clave', 'tmp/run-con-clave', { 'datos.txt': 'x', 'sub/clave.env': 'SECRETO=1' });
    const r = correr(raiz, ['purgar', C], { hoy: '2026-12-01' });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_PURGE_REFUSED.*2026-10-05-001.*intocable.*sub\/clave\.env/u);
    assert.ok(existsSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-con-clave', 'sub', 'clave.env')), 'la fuente intocable sigue ahi');
    assert.equal(logDe(raiz).length, 1, 'y no se registro una purga que no ocurrio');
  } finally {
    limpiar(raiz);
  }
});

test('5B · si una purga falla, el resto sigue y se informa', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const real = (await_rm);
    const r = correr(raiz, ['purgar', C], { hoy: '2026-11-04', io: { rm: (p, o) => { if (p.includes('2026-10-05-001')) throw Object.assign(new Error('permiso denegado'), { code: 'EPERM' }); return real(p, o); } } });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_PURGE_REFUSED.*2026-10-05-001.*permiso denegado/u);
    assert.deepEqual(enCuarentena(raiz), ['2026-10-05-001']);
    assert.equal(verificar(raiz, '2026-11-04').code, 0, 'lo que no se purgo sigue pendiente y consistente');
  } finally {
    limpiar(raiz);
  }
});
const await_rm = (await import('node:fs')).rmSync;

// ---------------------------------------------------------------- restaurar: deshacer

test('5B · restaurar devuelve el item a su lugar, lo registra, y el verificador lo acepta', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['restaurar', C, '2026-10-05-001']);
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /RESTAURADA 2026-10-05-001 -> tmp\/run-viejo-1/u);
    assert.equal(readFileSync(join(raiz, 'tmp', 'run-viejo-1', 'dato.txt'), 'utf8'), 'uno');
    assert.deepEqual(enCuarentena(raiz), ['2026-10-05-002']);
    assert.equal(logDe(raiz).length, 3);
    assert.equal(verificar(raiz).code, 0);
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · restaurar no pisa lo que ya esta en el lugar de origen', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    archivo(raiz, 'tmp/run-viejo-1/otra-cosa.txt', 'alguien lo volvio a crear');
    const r = correr(raiz, ['restaurar', C, '2026-10-05-001']);
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_RESTORE_REFUSED.*ya existe/u);
    assert.deepEqual(enCuarentena(raiz), ['2026-10-05-001', '2026-10-05-002'], 'sigue en la cuarentena');
    assert.equal(logDe(raiz).length, 2);
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · restaurar rechaza lo que no esta pendiente', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['restaurar', C, '2026-10-05-777']);
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_RESTORE_REFUSED.*no está en la cuarentena/u);
    const mal = correr(raiz, ['restaurar', C, 'no-es-un-item']);
    assert.equal(mal.code, 2, 'un identificador que no tiene forma de item es un uso invalido');
    correr(raiz, ['purgar', C], { hoy: '2026-11-04' });
    const yaPurgada = correr(raiz, ['restaurar', C, '2026-10-05-001'], { hoy: '2026-11-04' });
    assert.equal(yaPurgada.code, 1);
    assert.match(yaPurgada.errores, /AUTOLIMPIEZA_RESTORE_REFUSED/u);
  } finally {
    limpiar(raiz);
  }
});

// ---------------------------------------------------------------- uso, contrato y numeracion

test('5B · uso invalido sale 2', () => {
  const raiz = proyecto();
  try {
    for (const args of [[], ['listar'], ['borrar', C], ['listar', C, 'x'], ['restaurar', C], ['restaurar', C, '2026-10-05-001', 'x'], ['aplicar', C, 'x'], ['purgar', C, 'x']]) {
      const r = correr(raiz, args);
      assert.equal(r.code, 2, args.join(' '));
      assert.match(r.errores, /usage: autolimpieza\.mjs/u);
    }
  } finally {
    limpiar(raiz);
  }
});

test('5B · sin contrato no hay regla: VACIO y no se limpia nada; con un contrato roto se rechaza', () => {
  const raiz = proyecto();
  try {
    rmSync(join(raiz, 'contracts', 'autolimpieza.json'));
    const vacio = correr(raiz, ['aplicar', C]);
    assert.equal(vacio.code, 0);
    assert.match(vacio.salida, /^VACÍO: .*no hay contrato/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-1')));
    writeFileSync(join(raiz, 'contracts', 'autolimpieza.json'), JSON.stringify({ ...CONTRATO, categorias: [] }));
    const roto = correr(raiz, ['aplicar', C]);
    assert.equal(roto.code, 1);
    assert.match(roto.errores, /AUTOLIMPIEZA_CONTRACT_INVALID/u);
  } finally {
    limpiar(raiz);
  }
});

test('5B · una categoria cuya raiz no existe no es un error: no hay nada que limpiar', () => {
  const raiz = proyecto();
  try {
    writeFileSync(join(raiz, 'contracts', 'autolimpieza.json'), JSON.stringify({ ...CONTRATO, categorias: [{ ...CONTRATO.categorias[0], raiz: 'no-existe' }] }));
    const r = correr(raiz, ['listar', C]);
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /0 candidata\(s\)/u);
  } finally {
    limpiar(raiz);
  }
});

test('5B · siguienteItem numera por dia y no pasa de 999', () => {
  assert.equal(gate.siguienteItem('2026-10-05', []), '2026-10-05-001');
  const e = (item) => ({ ok: true, item });
  assert.equal(gate.siguienteItem('2026-10-05', [e('2026-10-05-001'), e('2026-10-05-007'), e('2026-10-04-020')]), '2026-10-05-008', 'sigue al maximo del dia, no cuenta los de otro dia');
  assert.equal(gate.siguienteItem('2026-10-06', [e('2026-10-05-009')]), '2026-10-06-001');
  assert.equal(gate.siguienteItem('2026-10-05', [{ ok: false }, e('2026-10-05-002')]), '2026-10-05-003', 'una linea ilegible no cuenta');
  assert.throws(() => gate.siguienteItem('2026-10-05', [e('2026-10-05-999')]), /999/u);
});

// ---------------------------------------------------------------- cuando falla el disco

const sinEspacio = () => { throw Object.assign(new Error('no hay espacio en el dispositivo'), { code: 'ENOSPC' }); };

test('FALSIFICACION · 5B · si no se puede sellar el log despues de mover, lo movido vuelve a su lugar', () => {
  const raiz = proyecto();
  try {
    const r = correr(raiz, ['aplicar', C], { io: { append: sinEspacio } });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_LOG_WRITE_FAILED.*run-viejo-1.*se devolvió a su lugar.*no hay espacio/u);
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-1', 'dato.txt')), 'volvio a donde estaba, entero');
    assert.ok(existsSync(join(raiz, 'tmp', 'run-viejo-2')));
    assert.deepEqual(enCuarentena(raiz), [], 'y no queda una carpeta vacia en la cuarentena');
    assert.equal(existsSync(join(raiz, '.vibe', 'LIMPIEZA.md')), false, 'ni una linea a medias');
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · si no se puede sellar una purga, se dice a gritos: ya no hay vuelta atras', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['purgar', C], { hoy: '2026-11-04', io: { append: sinEspacio } });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_LOG_WRITE_FAILED.*2026-10-05-001.*se eliminó pero no se pudo sellar/u);
    assert.doesNotMatch(r.salida, /PURGADA/u, 'no se anuncia como hecha una purga que no quedo registrada');
    const v = verificar(raiz, '2026-11-04');
    assert.equal(v.code, 1, 'el verificador ve lo que falta: el item se fue de la cuarentena sin pasar por el log');
    assert.match(v.errores, /falta en la cuarentena/u);
  } finally {
    limpiar(raiz);
  }
});

test('FALSIFICACION · 5B · si no se puede sellar una restauracion, el item vuelve a la cuarentena', () => {
  const raiz = proyecto();
  try {
    correr(raiz, ['aplicar', C]);
    const r = correr(raiz, ['restaurar', C, '2026-10-05-001'], { io: { append: sinEspacio } });
    assert.equal(r.code, 1);
    assert.match(r.errores, /AUTOLIMPIEZA_LOG_WRITE_FAILED.*volvió a la cuarentena/u);
    assert.equal(existsSync(join(raiz, 'tmp', 'run-viejo-1')), false);
    assert.equal(readFileSync(join(raiz, '.vibe', 'cuarentena', '2026-10-05-001', 'run-viejo-1', 'dato.txt'), 'utf8'), 'uno');
    assert.equal(verificar(raiz).code, 0, 'el estado que queda es consistente');
  } finally {
    limpiar(raiz);
  }
});

test('5B · una raiz que no se puede leer se omite con su motivo, sin tumbar la corrida', () => {
  const raiz = proyecto();
  try {
    rmSync(join(raiz, 'tmp'), { recursive: true, force: true });
    writeFileSync(join(raiz, 'tmp'), 'soy un archivo y no una carpeta');
    const r = correr(raiz, ['listar', C]);
    assert.equal(r.code, 0, r.errores);
    assert.match(r.salida, /OMITIDA tmp: no se pudo leer la raíz/u);
  } finally {
    limpiar(raiz);
  }
});

test('5B · el CLI real usa el directorio actual, la fecha de hoy y el reloj del sistema', async () => {
  const { spawnSync } = await import('node:child_process');
  const raiz = proyecto();
  try {
    // Las fechas del proyecto de prueba son las de una fecha fija y el CLI real juzga contra el reloj
    // del sistema: se las vuelve relativas al AHORA REAL. Con fechas fijas esta prueba dejaria de
    // cumplirse sola el dia que el reloj se alejara de ellas.
    const real = Date.now();
    for (const v of ['tmp/run-viejo-1', 'tmp/run-viejo-2', 'tmp/run-secreto', 'tmp/otra-cosa']) envejecer(join(raiz, v), 48, real);
    envejecer(join(raiz, 'tmp/run-nuevo'), 1, real);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'autolimpieza.mjs'), 'listar', C], { cwd: raiz, encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /listar: 2 candidata\(s\)/u);
    assert.match(r.stdout, /CANDIDATA tmp\/run-viejo-1/u);
    assert.match(r.stdout, /OMITIDA tmp\/run-nuevo: demasiado reciente/u);
  } finally {
    limpiar(raiz);
  }
});
