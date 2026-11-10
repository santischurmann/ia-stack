// verify-lessons — el archivo de lecciones (`.ia-stack/LECCIONES.md`) tiene el formato corto en castellano.
// Cada lección: `## DD-MM-AAAA · escalada|retrabajo` y los campos Síntoma, Causa, Archivo, Cómo evitarlo.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EMPTY, FIELDS, LIMITS, USAGE, main, parseBlocks, validateLessons } from '../scripts/verify-lessons.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const HOY = '10-11-2026';
const INTRO = '# Lecciones\n\nProsa del encabezado.\n\n';

const campos = (c = {}) => {
  const v = {
    Síntoma: 'la pantalla no cargaba con datos reales',
    Causa: 'el mock devolvía lo que la API real no devuelve',
    Archivo: 'src/api/cliente.mjs',
    'Cómo evitarlo': 'probar contra la API real antes de dar por buena la pantalla',
    ...c,
  };
  return Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => `${k}: ${x}`).join('\n');
};
const leccion = (c, encabezado = '## 05-11-2026 · retrabajo') => `${encabezado}\n\n${campos(c)}\n`;
const archivo = (...bloques) => `${INTRO}${bloques.join('\n')}`;

test('los cuatro campos obligatorios', () => {
  assert.deepEqual(FIELDS, ['Síntoma', 'Causa', 'Archivo', 'Cómo evitarlo']);
});

test('un archivo sin lecciones y uno con dos lecciones pasan', () => {
  assert.deepEqual(validateLessons(INTRO, { today: HOY }), []);
  assert.deepEqual(validateLessons(archivo(leccion(), leccion({}, '## 06-11-2026 · escalada')), { today: HOY }), []);
});

test('la plantilla que instala el repo pasa', () => {
  const t = readFileSync(join(repoRoot, 'templates', 'estado', 'LECCIONES.md'), 'utf8');
  assert.deepEqual(validateLessons(t, { today: HOY }), []);
});

test('parseBlocks parte por encabezado `## ` y devuelve la línea de cada bloque', () => {
  const b = parseBlocks(archivo(leccion(), leccion()));
  assert.equal(b.length, 2);
  assert.equal(b[0].heading, '## 05-11-2026 · retrabajo');
  assert.equal(b[0].line, 5);
});

test('FALSIFICACIÓN · encabezado mal formado: fecha ISO, tipo desconocido o sin fecha', () => {
  for (const h of ['## 2026-11-05 · retrabajo', '## 05-11-2026 · otra', '## LESSON-1 algo', '## 05-11-2026 retrabajo']) {
    assert.match(validateLessons(archivo(leccion({}, h)), { today: HOY })[0], /encabezado/, h);
  }
});

test('FALSIFICACIÓN · fecha imposible o del futuro', () => {
  assert.match(validateLessons(archivo(leccion({}, '## 31-02-2026 · escalada')), { today: HOY })[0], /fecha/);
  assert.match(validateLessons(archivo(leccion({}, '## 11-11-2026 · escalada')), { today: HOY })[0], /futuro/);
  assert.deepEqual(validateLessons(archivo(leccion({}, '## 10-11-2026 · escalada')), { today: HOY }), []);
});

test('FALSIFICACIÓN · campo faltante, vacío, repetido, corto o de relleno', () => {
  for (const c of ['Síntoma', 'Causa', 'Archivo', 'Cómo evitarlo']) {
    assert.match(validateLessons(archivo(leccion({ [c]: null })), { today: HOY })[0], new RegExp(c, 'u'), `falta ${c}`);
    assert.match(validateLessons(archivo(leccion({ [c]: '   ' })), { today: HOY })[0], new RegExp(c, 'u'), `vacío ${c}`);
  }
  assert.match(validateLessons(archivo(`${leccion()}Causa: otra causa suficientemente larga\n`), { today: HOY })[0], /Causa.*más de una vez/);
  assert.match(validateLessons(archivo(leccion({ Causa: 'corta' })), { today: HOY })[0], /Causa.*corto/);
  assert.match(validateLessons(archivo(leccion({ Causa: 'pendiente' })), { today: HOY })[0], /Causa/);
  assert.match(validateLessons(archivo(leccion({ Causa: '⁠'.repeat(15) })), { today: HOY })[0], /Causa/);
  assert.match(validateLessons(archivo(leccion({ Causa: '<la causa real del problema>' })), { today: HOY })[0], /Causa/);
});

test('FALSIFICACIÓN · un campo vacío no se llena con el texto del campo siguiente', () => {
  const t = archivo('## 05-11-2026 · retrabajo\n\nSíntoma: la pantalla no cargaba con datos reales\nCausa:\nArchivo: a.mjs\nCómo evitarlo: probar contra la API real siempre\n');
  assert.match(validateLessons(t, { today: HOY })[0], /Causa/);
});

test('el archivo se lee tal cual: CRLF y valores en varias líneas', () => {
  const t = archivo(leccion()).replace(/\n/gu, '\r\n');
  assert.deepEqual(validateLessons(t, { today: HOY }), []);
  const larga = archivo('## 05-11-2026 · retrabajo\n\nSíntoma: la pantalla no cargaba\ncon datos reales de verdad\nCausa: el mock devolvía lo que la API real no devuelve\nArchivo: a.mjs\nCómo evitarlo: probar contra la API real siempre\n');
  assert.deepEqual(validateLessons(larga, { today: HOY }), []);
});

function conArchivo(texto, callback, opciones = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ia-lessons-'));
  try {
    mkdirSync(join(root, '.ia-stack'));
    if (texto !== null) writeFileSync(join(root, '.ia-stack', 'LECCIONES.md'), texto);
    const salida = { out: [], err: [] };
    const code = main(['check', '.ia-stack/LECCIONES.md'], { root, today: HOY, write: (x) => salida.out.push(x), writeError: (x) => salida.err.push(x), ...opciones });
    callback(code, salida);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('main · verde cuenta las lecciones; rojo sale 1 y nombra el archivo', () => {
  conArchivo(archivo(leccion(), leccion()), (code, s) => {
    assert.equal(code, 0);
    assert.match(s.out.join('\n'), /OK: .*2 lección/);
  });
  conArchivo(archivo(leccion({ Causa: null })), (code, s) => {
    assert.equal(code, 1);
    assert.match(s.err.join('\n'), /REJECTED: .*LECCIONES\.md/);
  });
});

test('main · sin archivo escribe VACÍO y sale 0; uso inválido sale 2', () => {
  conArchivo(null, (code, s) => {
    assert.equal(code, 0);
    assert.match(s.out.join('\n'), new RegExp(EMPTY, 'u'));
  });
  const err = [];
  assert.equal(main([], { writeError: (x) => err.push(x) }), 2);
  assert.equal(err[0], USAGE);
});

test('main · una ruta que escapa del proyecto se rechaza; un error de lectura se informa', () => {
  const err = [];
  assert.equal(main(['check', '../fuera.md'], { root: repoRoot, writeError: (x) => err.push(x) }), 1);
  assert.match(err.join('\n'), /REJECTED/);
  conArchivo(archivo(leccion()), (code, s) => {
    assert.equal(code, 1);
    assert.match(s.err.join('\n'), /no se pudo leer/);
  }, { read: () => { throw Object.assign(new Error('boom'), { code: 'EACCES' }); } });
});

test('los límites declarados se imprimen en verde y en rojo', () => {
  conArchivo(archivo(leccion()), (_c, s) => assert.match(s.out.join('\n'), new RegExp(LIMITS, 'u')));
  conArchivo(archivo(leccion({ Causa: null })), (_c, s) => assert.match(s.err.join('\n'), new RegExp(LIMITS, 'u')));
});
