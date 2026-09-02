import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { EMPTY, LIMITS, USAGE, main, parseBlocks, realDate, validateLessons } from '../scripts/verify-lessons.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUTA = '.vibe/LESSONS.md';

// El preámbulo del archivo real trae dos `---`. Van en las fixtures a propósito: el gate no debe
// usarlos jamás para separar lecciones, y una fixture sin ellos no probaría eso.
const PREAMBULO = ['# Lessons — cross-project error memory', '', 'Prosa del encabezado.', '', '---', ''].join('\n');

const PLANTILLA = [
  '## [YYYY-MM-DD] LESSON-1 <title> — status: active',
  '',
  '**Project/phase/run:** <project-slug>/<phase>/<feature-slug or session date>',
  '**What happened:** (observado, factual)',
  '**Why (root cause):** (no el síntoma — la causa real)',
  '**How to avoid:** (regla concreta, chequeable)',
  '**Detection signal:** (qué la flaguearía si se repite)',
  '**Confidence:** high | medium | low',
  '',
  '---',
].join('\n');

const CAMPOS_POR_DEFECTO = {
  'Project/phase/run': 'proyecto/fase/corrida-2026-08-28',
  'What happened': 'pasó algo concreto y observable que se puede contar entero.',
  'Why (root cause):': null,
  'Why (root cause)': 'la causa real, que no es la misma cosa que el síntoma que se vio.',
  'How to avoid': 'una regla concreta que alguien puede chequear sin interpretarla.',
  'Detection signal': 'la señal que la volvería a marcar si el error se repite.',
  Confidence: 'high',
};

const ORDEN = ['Project/phase/run', 'What happened', 'Why (root cause)', 'How to avoid', 'Detection signal', 'Confidence'];

/** Un bloque de lección real. `campos` sobrescribe valores; `null` borra el campo entero. */
function leccion({ n = 2, date = '2026-08-29', titulo = 'Un título de prueba', status = 'active', campos = {}, extra = '' } = {}) {
  const lineas = [`## [${date}] LESSON-${n} ${titulo} — status: ${status}`, ''];
  for (const nombre of ORDEN) {
    const valor = Object.hasOwn(campos, nombre) ? campos[nombre] : CAMPOS_POR_DEFECTO[nombre];
    if (valor === null) continue;
    lineas.push(`**${nombre}:** ${valor}`);
  }
  if (extra !== '') lineas.push(extra);
  return lineas.join('\n');
}

const doc = (...bloques) => `${[PREAMBULO, PLANTILLA, ...bloques].join('\n\n')}\n`;

function corrida(texto, args = ['check', RUTA], extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-lessons-'));
  const salida = [];
  const errores = [];
  try {
    if (texto !== null) {
      mkdirSync(join(root, '.vibe'), { recursive: true });
      writeFileSync(join(root, RUTA), texto, 'utf8');
    }
    const code = main(args, { root, write: (l) => salida.push(l), writeError: (l) => errores.push(l), ...extra });
    return { code, salida: salida.join('\n'), errores: errores.join('\n') };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- Falso rojo: lo que YA está escrito tiene que pasar -------------------------------------------

test('el archivo real del repo pasa: un gate que obliga a escribir mal para pasar es peor que ninguno', () => {
  const { code, errores } = main(['check', RUTA], { root: repoRoot, write: () => {}, writeError: () => {} }) === 0
    ? { code: 0, errores: '' }
    : (() => { const e = []; const c = main(['check', RUTA], { root: repoRoot, write: () => {}, writeError: (l) => e.push(l) }); return { code: c, errores: e.join('\n') }; })();
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('una fixture con plantilla y dos lecciones sale en verde', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 }), leccion({ n: 3, date: '2026-08-30' })));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

// --- Frontera de bloque: por encabezado anclado, nunca por `---` ni por línea en blanco -----------

test('FALSIFICACIÓN · un campo borrado se acusa, aunque los bloques vecinos sí lo tengan', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 }), leccion({ n: 3, campos: { 'Detection signal': null } })));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-3/u);
  assert.match(errores, /Detection signal/u);
});

test('FALSIFICACIÓN · una lección pegada al bloque anterior sin línea en blanco igual se cuenta y se valida', () => {
  const pegada = `${leccion({ n: 2 })}\n${leccion({ n: 3, campos: { Confidence: null } })}`;
  const { code, errores } = corrida(doc(pegada));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-3/u);
});

test('FALSIFICACIÓN · un `---` suelto entre lecciones no separa nada ni tapa un campo faltante', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 }), '---', leccion({ n: 3, campos: { 'How to avoid': null } })));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-3/u);
});

// --- Valores: el campo termina en el próximo marcador, no al final del bloque ---------------------

test('FALSIFICACIÓN · un campo vacío no se llena con el texto del campo siguiente', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, campos: { 'Why (root cause)': '' } })));
  assert.equal(code, 1);
  assert.match(errores, /Why \(root cause\)/u);
});

test('FALSIFICACIÓN · un campo con espacios, tabulación o espacio duro cuenta como vacío', () => {
  for (const relleno of ['   ', '  ', '​']) {
    const { code, errores } = corrida(doc(leccion({ n: 2, campos: { 'How to avoid': relleno } })));
    assert.deepEqual({ relleno: JSON.stringify(relleno), code, acusa: /How to avoid/u.test(errores) }, { relleno: JSON.stringify(relleno), code: 1, acusa: true });
  }
});

test('FALSIFICACIÓN · el texto de la plantilla copiado tal cual no cuenta como contenido', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, campos: { 'What happened': '(observado, factual)' } })));
  assert.equal(code, 1);
  assert.match(errores, /What happened/u);
});

test('FALSIFICACIÓN · un placeholder entre angulares y los rellenos de compromiso se rechazan', () => {
  for (const valor of ['<lo que sea>', 'TBD', 'N/A', 'ver arriba']) {
    const { code } = corrida(doc(leccion({ n: 2, campos: { 'Detection signal': valor } })));
    assert.deepEqual({ valor, code }, { valor, code: 1 });
  }
});

test('FALSIFICACIÓN · un campo duplicado dentro del mismo bloque se acusa, aunque el total del archivo no se mueva', () => {
  const { code, errores } = corrida(doc(
    leccion({ n: 2, extra: '**Confidence:** medium' }),
    leccion({ n: 3, campos: { Confidence: null } }),
  ));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-2/u);
  assert.match(errores, /LESSON-3/u);
});

// --- Fechas: `\d{4}-\d{2}-\d{2}` no alcanza ------------------------------------------------------

test('FALSIFICACIÓN · una fecha imposible se rechaza aunque matchee el formato y Date la acepte rodando', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-09-31']) {
    const { code, errores } = corrida(doc(leccion({ n: 2, date })));
    assert.deepEqual({ date, code, acusa: /fecha/iu.test(errores) }, { date, code: 1, acusa: true });
  }
});

// --- status: el conjunto no se deriva de lo observado --------------------------------------------

test('retired es un status legítimo: el archivo declara retire-not-delete', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, status: 'retired' })));
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FALSIFICACIÓN · un status fuera del conjunto se rechaza', () => {
  for (const status of ['activo', 'Active', 'deleted', '']) {
    const { code } = corrida(doc(leccion({ n: 2, status })));
    assert.deepEqual({ status, code }, { status, code: 1 });
  }
});

// --- Referencias cruzadas: un identificador que resuelve contra el archivo equivocado no vale -----

test('FALSIFICACIÓN · una marca [overlaps with: LESSON-N] que no resuelve contra este archivo se rechaza', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, extra: '**Nota de dedup:** `[overlaps with: LESSON-99]` no existe.' })));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-99/u);
});

test('FALSIFICACIÓN · una lección que se cita a sí misma se rechaza: eso no es dedup', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, extra: '**Nota de dedup:** `[overlaps with: LESSON-2]` a sí misma.' })));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-2/u);
});

test('una marca que sí resuelve pasa, y la salida nombra el archivo contra el que resolvió', () => {
  const texto = doc(leccion({ n: 2 }), leccion({ n: 3, date: '2026-08-30', extra: '**Nota de dedup:** `[overlaps with: LESSON-2]`.' }));
  const { code, salida } = corrida(texto);
  assert.equal(code, 0);
  assert.match(salida, /LESSONS\.md/u);
});

test('cero marcas no se escribe como cero referencias rotas: se dice que no se verificó ninguna', () => {
  const { code, salida } = corrida(doc(leccion({ n: 2 })));
  assert.equal(code, 0);
  assert.match(salida, /0 marca/u);
});

// --- La plantilla se clasifica por contenido, nunca por posición de línea -------------------------

test('FALSIFICACIÓN · sin plantilla el gate se rechaza en vez de calibrar contra nada', () => {
  const { code, errores } = corrida(`${PREAMBULO}\n\n${leccion({ n: 2 })}\n`);
  assert.equal(code, 1);
  assert.match(errores, /plantilla/iu);
});

test('FALSIFICACIÓN · un bloque insertado antes de la plantilla se rechaza: la plantilla es el primer encabezado', () => {
  const texto = `${PREAMBULO}\n\n${leccion({ n: 2 })}\n\n${PLANTILLA}\n`;
  const { code, errores } = corrida(texto);
  assert.equal(code, 1);
  assert.match(errores, /plantilla/iu);
});

test('FALSIFICACIÓN · dos plantillas se rechazan', () => {
  const { code, errores } = corrida(`${PREAMBULO}\n\n${PLANTILLA}\n\n${PLANTILLA}\n\n${leccion({ n: 2 })}\n`);
  assert.equal(code, 1);
  assert.match(errores, /plantilla/iu);
});

test('FALSIFICACIÓN · la plantilla también se valida: si le falta un campo, se acusa', () => {
  const rota = PLANTILLA.split('\n').filter((l) => !l.startsWith('**Confidence:**')).join('\n');
  const { code, errores } = corrida(`${PREAMBULO}\n\n${rota}\n\n${leccion({ n: 2 })}\n`);
  assert.equal(code, 1);
  assert.match(errores, /Confidence/u);
});

test('FALSIFICACIÓN · dos lecciones con el mismo número se rechazan: si no, una marca de dedup no resuelve', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 }), leccion({ n: 2, date: '2026-08-30' })));
  assert.equal(code, 1);
  assert.match(errores, /LESSON-2/u);
});

// --- Entradas y límites --------------------------------------------------------------------------

test('sin archivo el gate escribe VACÍO y sale 0: un proyecto que no registró lecciones no incumple nada', () => {
  const { code, salida } = corrida(null);
  assert.equal(code, 0);
  assert.match(salida, new RegExp(EMPTY, 'u'));
});

test('un uso inválido sale 2 con el usage, sin fingir que verificó nada', () => {
  for (const args of [[], ['check'], ['check', ''], ['verificar', RUTA], ['check', RUTA, '--de-mas']]) {
    const { code, errores } = corrida(doc(leccion({ n: 2 })), args);
    assert.deepEqual({ args: args.join(' '), code, usage: errores.includes(USAGE) }, { args: args.join(' '), code: 2, usage: true });
  }
});

test('los límites declarados se imprimen en verde Y en rojo: un verde acá no prueba suficiencia', () => {
  const verde = corrida(doc(leccion({ n: 2 })));
  const rojo = corrida(doc(leccion({ n: 2, campos: { Confidence: null } })));
  assert.deepEqual(
    { verde: `${verde.salida}${verde.errores}`.includes(LIMITS), rojo: `${rojo.salida}${rojo.errores}`.includes(LIMITS) },
    { verde: true, rojo: true },
  );
});

test('parseBlocks separa por encabezado anclado y devuelve la línea de cada bloque', () => {
  const bloques = parseBlocks(doc(leccion({ n: 2 }), leccion({ n: 3, date: '2026-08-30' })));
  assert.equal(bloques.length, 3);
  assert.deepEqual(bloques.map((b) => b.line > 0), [true, true, true]);
});

test('validateLessons devuelve la lista de violaciones sin lanzar nunca', () => {
  assert.deepEqual(validateLessons(doc(leccion({ n: 2 }))), []);
  assert.equal(validateLessons('').length > 0, true);
});

// --- Las guardias defensivas también traen la prueba que las hace fallar (LESSON-7) ---------------

test('FALSIFICACIÓN · si los dos conteos de encabezados no cierran, el gate se detiene ahí', () => {
  const violaciones = validateLessons(doc(leccion({ n: 2 })), { countAnchored: () => 99 });
  assert.equal(violaciones.length, 1);
  assert.match(violaciones[0], /99/u);
});

test('FALSIFICACIÓN · si el barrido de marcas de dedup no cierra, se rechaza en vez de contar cero', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-lessons-'));
  const errores = [];
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, RUTA), doc(leccion({ n: 2 })), 'utf8');
    const code = main(['check', RUTA], {
      root,
      write: () => {},
      writeError: (l) => errores.push(l),
      summarize: () => ({ lessons: 1, marks: 0, degraded: true, literal: 3 }),
    });
    assert.deepEqual({ code, acusa: /no cierra/u.test(errores.join('\n')) }, { code: 1, acusa: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un encabezado mal formado se acusa antes de intentar validar sus campos', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 }), '## esto no es un encabezado de lección'));
  assert.equal(code, 1);
  assert.match(errores, /encabezado mal formado/u);
});

test('FALSIFICACIÓN · un campo de prosa demasiado corto se rechaza aunque no sea relleno conocido', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, campos: { 'How to avoid': 'corto' } })));
  assert.equal(code, 1);
  assert.match(errores, /How to avoid/u);
});

test('realDate rechaza lo que no tiene forma de fecha, sin lanzar', () => {
  assert.deepEqual(
    ['', 'ayer', '2026-8-1', 'YYYY-MM-DD', '2026-02-30', '2026-08-28'].map(realDate),
    [false, false, false, false, false, true],
  );
});

test('FALSIFICACIÓN · una ruta que escapa del proyecto se rechaza sin abrirla', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2 })), ['check', '../afuera.md']);
  assert.equal(code, 1);
  assert.match(errores, /REJECTED/u);
});

test('FALSIFICACIÓN · un error de lectura que no es "no existe" se informa, no se toma por vacío', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-lessons-'));
  const errores = [];
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, RUTA), doc(leccion({ n: 2 })), 'utf8');
    const code = main(['check', RUTA], {
      root,
      write: () => {},
      writeError: (l) => errores.push(l),
      read: () => { const error = new Error('EISDIR: illegal operation'); error.code = 'EISDIR'; throw error; },
    });
    assert.deepEqual({ code, acusa: /EISDIR/u.test(errores.join('\n')) }, { code: 1, acusa: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('si el archivo desaparece entre resolver la ruta y leerla, eso es VACÍO y no un rechazo', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-lessons-'));
  const salida = [];
  try {
    mkdirSync(join(root, '.vibe'), { recursive: true });
    writeFileSync(join(root, RUTA), doc(leccion({ n: 2 })), 'utf8');
    // safeProjectFile ya devolvió la ruta; la ventana entre esa comprobación y la lectura es real
    // y está declarada como límite honesto del repo. Acá se la provoca a propósito.
    const code = main(['check', RUTA], {
      root,
      write: (l) => salida.push(l),
      writeError: () => {},
      read: () => { const error = new Error('ENOENT: no such file'); error.code = 'ENOENT'; throw error; },
    });
    assert.deepEqual({ code, vacio: salida.join('\n').includes(EMPTY) }, { code: 0, vacio: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- Los siete defectos que la auditoría adversarial confirmó ejecutando --------------------------
// Cada uno se reproduce acá antes de tocar el gate. Fueron encontrados corriendo el gate publicado
// (cf19a91) contra copias mutadas del archivo real, no leyendo el código.

const HOY = { today: '2026-09-02' };

test('FR-1 · el archivo que el instalador copia a todo proyecto nuevo tiene que pasar', () => {
  // scripts/install.sh:60 copia templates/vibe/* a .vibe/. Ese archivo es cabecera + plantilla y
  // cero lecciones: el gate publicado lo rechazaba con exit 1, así que toda instalación nueva de
  // VCP salía roja.
  const plantilla = readFileSync(join(repoRoot, 'templates', 'vibe', 'LESSONS.md'), 'utf8');
  const { code, errores, salida } = corrida(plantilla, ['check', RUTA], HOY);
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
  assert.match(salida, /0 lección/u);
});

test('FR-10 · la única forma documentada de retirar una lección tiene que pasar', () => {
  // skills/vibe-memory.md:250 la define así: `status: retired (<date>, reason: <why>)`.
  const texto = doc(leccion({ n: 2, status: 'retired (2026-09-01, reason: absorbida por LESSON-3)' }), leccion({ n: 3, date: '2026-08-30' }));
  const { code, errores } = corrida(texto, ['check', RUTA], HOY);
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FR-2 · una lección importada de otro proyecto con su fecha real tiene que pasar', () => {
  // El archivo se titula "cross-project error memory" y install.sh copia scripts/ a cada proyecto:
  // un piso fijado en la primera lección de VCP rechaza fechas reales ajenas.
  const { code, errores } = corrida(doc(leccion({ n: 2, date: '2025-11-02' })), ['check', RUTA], HOY);
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('FALSIFICACIÓN · una fecha del futuro se rechaza: no hay lección aprendida mañana', () => {
  const { code, errores } = corrida(doc(leccion({ n: 2, date: '2099-12-31' })), ['check', RUTA], HOY);
  assert.equal(code, 1);
  assert.match(errores, /futur/iu);
});

test('FR-3 · la frase "overlaps with" en prosa no rompe el archivo', () => {
  const texto = doc(leccion({ n: 2, extra: '**Nota:** la convención se escribe overlaps with y punto.' }));
  const { code, errores } = corrida(texto, ['check', RUTA], HOY);
  assert.deepEqual({ code, errores }, { code: 0, errores: '' });
});

test('F3 · FALSIFICACIÓN · una marca colgada dentro de la plantilla se acusa, y el verde no la cuenta como resuelta', () => {
  const plantillaConMarca = PLANTILLA.replace('**Confidence:** high | medium | low', '**Confidence:** high | medium | low\n**Nota de dedup:** [overlaps with: LESSON-99]');
  const texto = `${PREAMBULO}\n\n${plantillaConMarca}\n\n${leccion({ n: 2 })}\n`;
  const { code, errores } = corrida(texto, ['check', RUTA], HOY);
  assert.equal(code, 1);
  assert.match(errores, /LESSON-99/u);
});

test('F2 · FALSIFICACIÓN · una marca con otra capitalización no esquiva la comprobación', () => {
  const texto = doc(leccion({ n: 2, extra: '**Nota de dedup:** [Overlaps with: LESSON-99]' }));
  const { code, errores } = corrida(texto, ['check', RUTA], HOY);
  assert.equal(code, 1);
  assert.match(errores, /LESSON-99/u);
});

test('F1 · FALSIFICACIÓN · un campo relleno con caracteres invisibles cuenta como vacío', () => {
  // U+2060 WORD JOINER, U+00AD SOFT HYPHEN, U+3164 HANGUL FILLER y U+2800 BRAILLE BLANK no los
  // sacaba la normalización publicada, así que 15 copias medían 15 caracteres y pasaban el mínimo.
  for (const invisible of ['⁠', '­', 'ㅤ', '⠀']) {
    const { code, errores } = corrida(doc(leccion({ n: 2, campos: { 'What happened': invisible.repeat(15) } })), ['check', RUTA], HOY);
    assert.deepEqual({ char: invisible.codePointAt(0).toString(16), code, acusa: /What happened/u.test(errores) }, { char: invisible.codePointAt(0).toString(16), code: 1, acusa: true });
  }
});

test('FALSIFICACIÓN · una marca cuyo destino no es un número se acusa como mal formada, no como referencia rota', () => {
  // Es el precio de anclar el barrido al corchete en vez de a la frase: una lección que documente
  // la convención escribiendo la forma genérica `[overlaps with: LESSON-N]` sale roja. El rechazo
  // dice exactamente eso —la marca no nombra ninguna lección— en vez de acusar a un patrón sano.
  const { code, errores } = corrida(doc(leccion({ n: 2, extra: '**Nota:** la forma es [overlaps with: LESSON-N].' })), ['check', RUTA], HOY);
  assert.equal(code, 1);
  assert.match(errores, /no nombra ninguna lección/u);
});
