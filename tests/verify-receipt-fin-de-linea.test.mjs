// El mismo test, con otros finales de línea, sigue siendo el mismo test.
//
// LA HERIDA, medida en un proyecto real el 2026-09-22. `test_hash_sha256` se comparaba contra los
// BYTES CRUDOS del archivo en disco. En Windows con `core.autocrlf=true` el mismo test tiene bytes
// distintos según quién lo escribió último: git lo materializa en CRLF, una herramienta lo reescribe
// en LF. Así que un test idéntico daba «test_hash_sha256 does not match … the test changed», y
// recomprobar un recibo en otra máquina —o en Linux— fallaba sólo por eso. De los hashes que sí
// coincidieron en su punto de sellado, veinte necesitaron la forma CRLF para coincidir.
//
// Y ESTE REPOSITORIO YA SE HABÍA COMIDO ESTA MISMA CLASE, el 2026-09-01: «mismo commit, distintos
// bytes», con la cadena de Discovery rota en un clon de Windows. Lo arregló con un `.gitattributes`
// que materializa todo en LF… para sí mismo. El protocolo corre en repositorios ajenos, que no
// tienen ese archivo: se curó a sí mismo y dejó expuesta cada instalación. Un verde que pertenecía a
// una carpeta, otra vez.
//
// LA ASIMETRÍA QUE LO DELATABA: el fingerprint del árbol usa `git hash-object`, que ya normaliza
// finales de línea. Sólo el hash del test de cada criterio leía bytes crudos.
//
// LO QUE NO SE AFLOJA. Se acepta el mismo CONTENIDO en cualquier forma de fin de línea —crudo, LF o
// CRLF—, y nada más. Un cambio de una sola letra sigue rechazando, en cualquier forma. Y un `\r`
// suelto no es un fin de línea: es contenido, y se respeta.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-receipt.mjs');
const { formasDeFinDeLinea, tieneFinesMezclados, validateAcceptanceCriterion } = await import(pathToFileURL(script).href);

const sha = (contenido) => createHash('sha256').update(contenido).digest('hex');

const LF = Buffer.from("import test from 'node:test';\ntest('x', () => {});\n");
const CRLF = Buffer.from("import test from 'node:test';\r\ntest('x', () => {});\r\n");

const criterio = (hash) => ({
  ac_id: 'AC1',
  scenario: 'GIVEN un test, WHEN cambian sólo sus finales de línea, THEN sigue siendo el mismo test.',
  verdict: 'COMPLIANT',
  test_file: 'tests/algo.test.mjs',
  test_hash_sha256: hash,
  command: 'node --test tests/algo.test.mjs',
  result: 'verde',
});

// Sin `hashOf` inyectado: acá se mide el sha256 de verdad, que es justamente lo que estaba mal.
const deps = (enDisco) => ({
  readFile: () => enDisco,
  resolveFile: (p) => p,
  readRedAdapters: () => ({ adapters: [] }),
});

test('sellado en CRLF y leído en LF es el mismo test', () => {
  // El caso de las veinte: git lo materializó en CRLF al sellar, y en otra máquina llega en LF.
  const r = validateAcceptanceCriterion(criterio(sha(CRLF)), repoRoot, deps(LF));
  assert.equal(r.ok, true, r.reason);
});

test('sellado en LF y leído en CRLF es el mismo test', () => {
  // El reverso: una herramienta lo escribió en LF, y git lo volvió a sacar en CRLF.
  const r = validateAcceptanceCriterion(criterio(sha(LF)), repoRoot, deps(CRLF));
  assert.equal(r.ok, true, r.reason);
});

test('los mismos bytes siguen coincidiendo, como siempre', () => {
  assert.equal(validateAcceptanceCriterion(criterio(sha(LF)), repoRoot, deps(LF)).ok, true);
  assert.equal(validateAcceptanceCriterion(criterio(sha(CRLF)), repoRoot, deps(CRLF)).ok, true);
});

test('un lector que devuelve texto en vez de bytes también se compara en las tres formas', () => {
  const r = validateAcceptanceCriterion(criterio(sha('a\nb\n')), repoRoot, deps('a\r\nb\r\n'));
  assert.equal(r.ok, true, r.reason);
});

test('FALSIFICACIÓN · un cambio de contenido rechaza en cualquier forma de fin de línea', () => {
  const otro = Buffer.from("import test from 'node:test';\r\ntest('y', () => {});\r\n");
  const r = validateAcceptanceCriterion(criterio(sha(LF)), repoRoot, deps(otro));
  assert.equal(r.ok, false, 'una letra distinta es otro test, con los finales de línea que sean');
  assert.match(r.reason, /does not match/u);
});

// El título dice CR y no la secuencia de escape: el escáner que vincula requisitos a pruebas lee el
// título LITERAL del fuente, y un escape en el título lo vuelve invisible. Lo cazó el guarda que
// existe justamente para eso, en la primera corrida.
test('FALSIFICACIÓN · un CR suelto es contenido, no un fin de línea', () => {
  // Normalizar de más convertiría dos archivos distintos en el mismo. Sólo la secuencia CRLF es un
  // fin de línea; un CR sin su LF se deja como está.
  const conCrSuelto = Buffer.from('a\rb\n');
  const sinCr = Buffer.from('ab\n');
  assert.equal(validateAcceptanceCriterion(criterio(sha(sinCr)), repoRoot, deps(conCrSuelto)).ok, false);
});

test('las formas de fin de línea son el crudo, el LF y el CRLF, sin repetir', () => {
  assert.equal(formasDeFinDeLinea(LF).length, 2, 'LF crudo coincide con su forma LF: quedan LF y CRLF');
  assert.equal(formasDeFinDeLinea(CRLF).length, 2, 'CRLF crudo coincide con su forma CRLF: quedan CRLF y LF');
  assert.equal(formasDeFinDeLinea(Buffer.from('a\nb\r\n')).length, 3, 'uno mezclado tiene tres formas distintas');
  assert.equal(formasDeFinDeLinea(Buffer.from('sin saltos')).length, 1, 'sin finales de línea hay una sola forma');
});

// --- FINALES MEZCLADOS: se rechazan ANTES de sellar -------------------------------------------------
//
// Decidido por el operador el 2026-09-22, sobre un caso real: un test con 208 lineas CRLF y una LF,
// escrito por un script que reemplazaba texto con un salto de linea crudo sobre un archivo que git
// habia materializado en CRLF. El recibo se sello con el hash de esos bytes mezclados, y `check` y
// `commit` pasaron porque comparan contra el disco. Pero git guarda el archivo UNIFORME, asi que
// ninguna de las tres formas reproduce la mezcla: ese recibo no se puede recomprobar desde un clon.
//
// Se rechaza en `check` -- y por lo tanto en `commit`, que valida lo mismo -- porque ahi arreglarlo
// cuesta un minuto. Despues del commit lo ve `recheck`, pero ya esta sellado.

const MEZCLADO = Buffer.from("import test from 'node:test';\r\ntest('x', () => {});\n");

test('FALSIFICACIÓN · un test con finales mezclados se rechaza aunque su hash coincida con el disco', () => {
  // La trampa exacta: el hash se calculo sobre los bytes mezclados, asi que coincide con el disco.
  const r = validateAcceptanceCriterion(criterio(sha(MEZCLADO)), repoRoot, deps(MEZCLADO));
  assert.equal(r.ok, false, 'coincidir con el disco no alcanza: ese hash no lo reproduce ningun clon');
  assert.match(r.reason, /mezcla/iu);
});

test('el rechazo dice como se arregla, y que git checkout NO alcanza', () => {
  // Medido el 2026-09-22 con git 2.55: despues de un `git add`, git ya cuenta el archivo mezclado
  // como igual al indice, y `git checkout --` no lo reescribe. Un gate que sugiriera checkout
  // mandaria a hacer algo que no arregla nada.
  const r = validateAcceptanceCriterion(criterio(sha(MEZCLADO)), repoRoot, deps(MEZCLADO));
  assert.match(r.reason, /un solo tipo de fin de l[ií]nea/iu, 'dice que hacer');
  assert.match(r.reason, /checkout[^.]*no alcanza/iu, 'y avisa que el checkout no lo arregla');
});

test('tieneFinesMezclados: CRLF y LF sueltos juntos, y nada mas', () => {
  assert.equal(tieneFinesMezclados(Buffer.from('a\r\nb\n')), true);
  assert.equal(tieneFinesMezclados(Buffer.from('a\nb\r\n')), true, 'en cualquier orden');
  assert.equal(tieneFinesMezclados(Buffer.from('a\r\nb\r\n')), false, 'CRLF uniforme no es mezcla');
  assert.equal(tieneFinesMezclados(Buffer.from('a\nb\n')), false, 'LF uniforme no es mezcla');
  assert.equal(tieneFinesMezclados(Buffer.from('')), false);
  assert.equal(tieneFinesMezclados(Buffer.from('a\rb\n')), false, 'un CR suelto es contenido, no un fin de linea');
  assert.equal(tieneFinesMezclados('texto\r\ny\n'), true, 'un lector que devuelve texto tambien se mira');
});
