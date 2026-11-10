import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PLANTILLA, agregarLeccion, causasRepetidas } from '../scripts/leccion.mjs';
import { validateLessons } from '../scripts/verify-lessons.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'leccion.mjs');
const gate = join(repoRoot, 'scripts', 'verify-lessons.mjs');

function run(args, cwd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function conProyecto(callback) {
  const root = mkdtempSync(join(tmpdir(), 'ia-leccion-'));
  mkdirSync(join(root, '.ia-stack'));
  try {
    callback(root, join(root, '.ia-stack', 'LECCIONES.md'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const base = ['anotar', '--tipo', 'retrabajo', '--sintoma', 'el test pasaba y la pantalla no cargaba', '--causa', 'el mock devolvía datos que la API real no devuelve', '--archivo', 'src/api/cliente.mjs'];

test('leccion · la plantilla del repo es la que se crea y pasa verify-lessons', () => {
  assert.equal(readFileSync(join(repoRoot, 'templates', 'estado', 'LECCIONES.md'), 'utf8'), PLANTILLA);
  assert.deepEqual(validateLessons(PLANTILLA, { today: '10-11-2026' }), []);
});

test('leccion · agregarLeccion numera, fecha y valida', () => {
  const a = agregarLeccion(PLANTILLA, { tipo: 'escalada', sintoma: 'falló la migración en el peldaño 3', causa: 'faltaba leer las lecciones del área', archivo: 'db/mig.sql', desde: '3', hasta: '5' }, '10-11-2026');
  assert.equal(a.ok, true);
  assert.match(a.texto, /## 10-11-2026 · escalada/);
  assert.match(a.texto, /peldaño 3 → 5/);
  const b = agregarLeccion(a.texto, { tipo: 'retrabajo', sintoma: 'otro síntoma bien largo', causa: 'otra causa bien larga', archivo: 'x.mjs' }, '11-11-2026');
  assert.equal(b.numero, 2);
  assert.deepEqual(validateLessons(b.texto, { today: '11-11-2026' }), []);
});

test('leccion · rechaza campos vacíos, cortos o tipo inválido', () => {
  const mal = (d) => agregarLeccion(PLANTILLA, { tipo: 'retrabajo', sintoma: 'síntoma suficientemente largo', causa: 'causa suficientemente larga', archivo: 'a.mjs', ...d }, '10-11-2026');
  assert.equal(mal({ tipo: 'otra' }).ok, false);
  assert.equal(mal({ causa: 'corta' }).ok, false);
  assert.equal(mal({ sintoma: '' }).ok, false);
  assert.equal(mal({ archivo: '' }).ok, false);
});

test('leccion · valores multilínea se colapsan y no rompen el formato', () => {
  const a = agregarLeccion(PLANTILLA, { tipo: 'retrabajo', sintoma: 'línea uno\n## 10-11-2026 · escalada falsa\nlínea tres', causa: 'Archivo: x y más texto de causa', archivo: 'a.mjs' }, '10-11-2026');
  assert.equal(a.ok, true);
  assert.deepEqual(validateLessons(a.texto, { today: '10-11-2026' }), []);
});

test('leccion · causasRepetidas: misma causa ≥2 veces dentro de la ventana', () => {
  const datos = (causa) => ({ tipo: 'retrabajo', sintoma: 'síntoma suficientemente largo', causa, archivo: 'a.mjs' });
  let t = PLANTILLA;
  t = agregarLeccion(t, datos('El mock devolvía datos falsos'), '01-10-2026').texto;
  t = agregarLeccion(t, datos('el  mock devolvía datos falsos'), '05-11-2026').texto;
  t = agregarLeccion(t, datos('causa única que no se repite'), '06-11-2026').texto;
  assert.equal(causasRepetidas(t, { dias: 30, hoy: '10-11-2026' }).length, 0);
  assert.equal(causasRepetidas(t, { dias: 60, hoy: '10-11-2026' }).length, 1);
  assert.equal(causasRepetidas(t, { dias: 60, hoy: '10-11-2026' })[0].veces, 2);
  assert.deepEqual(causasRepetidas(t, { dias: 60, hoy: '10-11-2026' })[0].fechas, ['01-10-2026', '05-11-2026']);
});

test('leccion · CLI anotar crea el archivo, pasa verify-lessons y repetidas lo lista', () => {
  conProyecto((root, archivo) => {
    const r = run([...base, '--proyecto', root], root);
    assert.equal(r.status, 0, r.out);
    const g = spawnSync(process.execPath, [gate, 'check', '.ia-stack/LECCIONES.md'], { encoding: 'utf8', cwd: root });
    assert.equal(g.status, 0, g.stderr);
    assert.match(readFileSync(archivo, 'utf8'), /^Archivo: src\/api\/cliente\.mjs$/mu);
    assert.match(run(['repetidas', '--proyecto', root], root).out, /sin repetidas/);
    run([...base, '--proyecto', root], root);
    const rep = run(['repetidas', '--proyecto', root, '--dias', '30'], root);
    assert.equal(rep.status, 0);
    assert.match(rep.out, /\(2\)/);
  });
});

test('leccion · CLI usa 2 con flags faltantes y 1 con contenido inválido', () => {
  conProyecto((root) => {
    assert.equal(run(['anotar', '--proyecto', root], root).status, 2);
    assert.equal(run([], root).status, 2);
    assert.equal(run(['repetidas', '--dias', 'x', '--proyecto', root], root).status, 2);
    assert.equal(run(['anotar', '--tipo', 'otra', '--sintoma', 'a', '--causa', 'b', '--archivo', 'c', '--proyecto', root], root).status, 2);
    assert.equal(run(['anotar', '--tipo', 'retrabajo', '--sintoma', 'corto', '--causa', 'corta', '--archivo', 'c.mjs', '--proyecto', root], root).status, 1);
  });
});

test('leccion · anotar no escribe sobre un archivo que ya está roto', () => {
  conProyecto((root, archivo) => {
    writeFileSync(archivo, '## encabezado roto\n');
    assert.equal(run([...base, '--proyecto', root], root).status, 1);
    assert.equal(readFileSync(archivo, 'utf8'), '## encabezado roto\n');
  });
});

test('leccion · desde/hasta aceptan barato|medio|fuerte y números; otra cosa se rechaza', () => {
  const d = (desde, hasta) => agregarLeccion(PLANTILLA, { tipo: 'escalada', sintoma: 'falló la migración en el nivel bajo', causa: 'faltaba leer las lecciones del área', archivo: 'db/mig.sql', desde, hasta }, '10-11-2026');
  const ok = d('barato', 'medio');
  assert.equal(ok.ok, true);
  assert.match(ok.texto, /\(barato → medio\)/u);
  assert.equal(d('medio', 'fuerte').ok, true);
  assert.equal(d('barato', 'ultra').ok, false);
  assert.equal(d('x', 'medio').ok, false);
});
