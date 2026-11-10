import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parseEstado, fechaAR } from '../scripts/estado.mjs';
import { huerfanas, resumenArranque } from '../scripts/arranque.mjs';
import { PLANTILLA, agregarLeccion, hoyAR } from '../scripts/leccion.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'arranque.mjs');

const ESTADO = `## Fase
5 — construir

## Tamaño
medio

## Cola
- [en curso] pantalla de login — sesión a
- [pendiente] endpoint de pagos de prueba — sesión b
- [pendiente] docs
- [en pausa] migrar tabla demo — sesión c
- [hecha] esqueleto — sesión a

## Cómo retomar
Abrir la pantalla de login y seguir con el test rojo.
`;

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
  assert.equal(r.error, undefined);
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function conProyecto(estado, callback, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ia-arranque-'));
  mkdirSync(join(root, '.ia-stack'));
  if (estado !== null) writeFileSync(join(root, '.ia-stack', 'ESTADO.md'), estado);
  for (const [nombre, contenido] of Object.entries(extra)) writeFileSync(join(root, '.ia-stack', nombre), contenido);
  try {
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('estado · parseEstado lee fase, tamaño, cola y cómo retomar', () => {
  const e = parseEstado(ESTADO);
  assert.equal(e.fase, '5 — construir');
  assert.equal(e.tamano, 'medio');
  assert.equal(e.cola.length, 5);
  assert.deepEqual(e.cola[0], { estado: 'en curso', tarea: 'pantalla de login', dueno: 'sesión a' });
  assert.equal(e.cola[2].dueno, '');
  assert.match(e.retomar, /test rojo/);
  assert.equal(e.lineas, 15);
});

test('estado · líneas de cola mal escritas van a invalidas; tamaño desconocido es null', () => {
  const e = parseEstado('## Tamaño\nenorme\n## Cola\n- [rota] algo — x\nlibre\n');
  assert.equal(e.tamano, null);
  assert.equal(e.invalidas.length, 2);
  assert.equal(e.fase, null);
});

test('estado · fechaAR es DD-MM-AAAA HH:MM en hora argentina', () => {
  assert.equal(fechaAR(new Date('2026-11-10T14:35:00Z')), '10-11-2026 11:35');
  assert.equal(fechaAR(new Date('2026-01-01T02:05:00Z')), '31-12-2025 23:05');
});

test('arranque · huérfanas: apuntan a tarea hecha o que no está en la cola; en pausa no', () => {
  const cola = parseEstado(ESTADO).cola;
  const h = huerfanas(cola, [
    { id: 's1', tarea: 'pantalla de login' },
    { id: 's2', tarea: 'esqueleto' },
    { id: 's3', tarea: 'migrar tabla demo' },
    { id: 's4', tarea: 'no existe' },
  ]);
  assert.deepEqual(h.map((x) => x.id), ['s2', 's4']);
});

test('arranque · resumen: 5 líneas máximo, cupo desconocido nunca estimado', () => {
  const e = parseEstado(ESTADO);
  const lineas = resumenArranque({ estado: e, ventana: null, semana: null, repetidas: [], huerfanas: [] });
  assert.ok(lineas.length <= 5);
  assert.match(lineas[0], /5 — construir/);
  assert.match(lineas[0], /medio/);
  assert.match(lineas.join('\n'), /pantalla de login/);
  assert.match(lineas.join('\n'), /desconocido/);
});

test('arranque · ventana >=85 avisa frenar; lecciones repetidas y huérfanas aparecen', () => {
  const e = parseEstado(ESTADO);
  const lineas = resumenArranque({
    estado: e, ventana: 90, semana: 10,
    repetidas: [{ causa: 'mock falso', veces: 2, lecciones: [1, 2] }],
    huerfanas: [{ id: 's9', tarea: 'x' }],
  });
  assert.ok(lineas.length <= 5);
  const t = lineas.join('\n');
  assert.match(t, /frenar/);
  assert.match(t, /mock falso/);
  assert.match(t, /s9/);
  assert.match(t, /90%/);
  const ok = resumenArranque({ estado: e, ventana: 84, semana: 10, repetidas: [], huerfanas: [] }).join('\n');
  assert.doesNotMatch(ok, /frenar/);
});

test('arranque · CLI sin ESTADO.md dice proyecto nuevo y sale 0', () => {
  conProyecto(null, (root) => {
    const r = run(['--proyecto', root]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /proyecto nuevo: empezá por la fase 1/);
  });
});

test('arranque · CLI imprime el resumen con cupo por argumento', () => {
  conProyecto(ESTADO, (root) => {
    const r = run(['--proyecto', root, '--ventana', '90', '--semana', '30']);
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.trim().split(/\r?\n/).length <= 5);
    assert.match(r.out, /ventana 90%/);
    assert.match(r.out, /frenar/);
    const sin = run(['--proyecto', root]);
    assert.match(sin.out, /desconocido/);
  });
});

test('arranque · CLI lee lecciones repetidas, plan.json y huérfanas', () => {
  let l = PLANTILLA;
  const hoy = hoyAR();
  for (let i = 0; i < 2; i += 1) {
    l = agregarLeccion(l, { tipo: 'retrabajo', sintoma: 'síntoma suficientemente largo', causa: 'faltó leer el contrato', archivo: 'a.mjs' }, hoy).texto;
  }
  const plan = JSON.stringify({ tasks: [{ id: 'T1', status: 'done' }, { id: 'T2', status: 'pending' }] });
  conProyecto(ESTADO, (root) => {
    const r = run(['--proyecto', root, '--sesiones', JSON.stringify([{ id: 'sx', tarea: 'esqueleto' }])]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /faltó leer el contrato/);
    assert.match(r.out, /sx/);
    assert.match(r.out, /1\/2/);
    assert.ok(r.out.trim().split(/\r?\n/).length <= 5);
  }, { 'LECCIONES.md': l, 'plan.json': plan });
});

test('arranque · CLI falla si ESTADO.md pasa de 60 líneas y manda lo viejo a historial.md', () => {
  conProyecto(`${ESTADO}${'nota\n'.repeat(50)}`, (root) => {
    const r = run(['--proyecto', root]);
    assert.equal(r.status, 1);
    assert.match(r.out, /historial\.md/);
  });
  conProyecto(`${ESTADO}${'nota\n'.repeat(43)}`, (root) => {
    assert.equal(run(['--proyecto', root]).status, 0);
  });
});

test('arranque · CLI usa 2 con argumentos inválidos', () => {
  assert.equal(run(['--zzz']).status, 2);
  assert.equal(run(['--ventana', 'x']).status, 2);
  assert.equal(run(['--ventana', '150']).status, 2);
  assert.equal(run(['--sesiones', 'no-json']).status, 2);
});

test('arranque · CLI con la plantilla de ESTADO.md sin llenar también dice proyecto nuevo', () => {
  const plantilla = readFileSync(join(repoRoot, 'templates', 'estado', 'ESTADO.md'), 'utf8');
  conProyecto(plantilla, (root) => {
    const r = run(['--proyecto', root]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /proyecto nuevo: empezá por la fase 1/);
  });
});
