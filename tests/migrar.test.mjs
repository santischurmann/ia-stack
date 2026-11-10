// migrar.mjs — la carpeta de estado del nombre anterior pasa a `.ia-stack/` sin perder nada.
//
// Este archivo y scripts/migrar.mjs son los únicos del repositorio que pueden nombrar la carpeta
// anterior: la migración vive en un solo lugar.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'migrar.mjs');
const VIEJA = '.vibe';
const APROBACIONES = '# Aprobaciones\n\n- 01-01-2026 10:00 — la persona aprobó la fase 4 (ejemplo)\n- 02-01-2026 11:30 — la persona aprobó la fase 6 (ejemplo)\n';

function migrar(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

function listado(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${relative(dir, join(e.parentPath, e.name)).split(sep).join('/')}:${readFileSync(join(e.parentPath, e.name), 'utf8').length}`)
    .sort();
}

/** Un proyecto con estado del nombre anterior: SESSION larga, aprobaciones y un runtime instalado. */
function proyecto() {
  const root = mkdtempSync(join(tmpdir(), 'ia-migrar-'));
  const vieja = join(root, VIEJA);
  mkdirSync(join(vieja, 'ia-stack-runtime', 'scripts'), { recursive: true });
  mkdirSync(join(vieja, 'receipts'), { recursive: true });
  const sesion = [
    '# Session — 01-01-2026', '',
    '**Feature slug:** facturacion-ejemplo',
    '**Goal:** emitir facturas de ejemplo',
    '**Status:** in progress', '', '---', '',
  ];
  for (let i = 1; i <= 150; i += 1) sesion.push(`- paso ${i} hecho: detalle de la fase ${i % 11}`);
  sesion.push('', '- [ ] escribir el test de la fase 8', '- [ ] revisar el contrato de la fase 9', '');
  sesion.push('## Interrumpido en', '', '- Fase: 6 — Build', '- Tarea: T03 — gate de ejemplo', '- Falta: correr la suite completa', '');
  writeFileSync(join(vieja, 'SESSION.md'), sesion.join('\n'));
  writeFileSync(join(vieja, 'APROBACIONES.md'), APROBACIONES);
  writeFileSync(join(vieja, 'AUDIT.md'), '');
  writeFileSync(join(vieja, 'receipts', 'r1.json'), '{"schema":"ia.receipt/v3"}\n');
  writeFileSync(join(vieja, 'ia-stack-runtime', 'scripts', 'gate.mjs'), '// copia del runtime\n');
  return root;
}

test('sin la carpeta del nombre anterior: sale 0, dice «nada que migrar» y no crea nada', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-migrar-'));
  try {
    const r = migrar(root);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /nada que migrar/u);
    assert.deepEqual(readdirSync(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin argumento: uso y exit 2, sin tocar nada', () => {
  const r = migrar();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /uso/iu);
});

test('una ruta que no existe se rechaza con exit 1', () => {
  const r = migrar(join(tmpdir(), 'ia-migrar-no-existe-jamas'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no existe/u);
});

test('migra: respaldo fechado, carpeta renombrada, ESTADO.md corto con las tres secciones e historial con el resto', () => {
  const root = proyecto();
  try {
    const antes = listado(join(root, VIEJA));
    const r = migrar(root);
    assert.equal(r.status, 0, r.stderr + r.stdout);

    assert.equal(existsSync(join(root, VIEJA)), false, 'la carpeta anterior desaparece');
    const respaldos = readdirSync(root).filter((n) => n.startsWith(`${VIEJA}.respaldo-`));
    assert.equal(respaldos.length, 1, `un respaldo: ${respaldos}`);
    assert.match(respaldos[0], /^\.vibe\.respaldo-\d{2}-\d{2}-\d{4}(-\d{4})?$/u, 'fecha DD-MM-AAAA');
    assert.deepEqual(listado(join(root, respaldos[0])), antes, 'el respaldo es copia entera de lo que había');

    const nueva = join(root, '.ia-stack');
    assert.equal(existsSync(join(nueva, 'runtime', 'scripts', 'gate.mjs')), true, 'el runtime instalado pasa a runtime/');
    assert.equal(existsSync(join(nueva, 'ia-stack-runtime')), false);
    assert.equal(existsSync(join(nueva, 'receipts', 'r1.json')), true, 'el resto del estado se conserva');
    assert.equal(readFileSync(join(nueva, 'APROBACIONES.md'), 'utf8'), APROBACIONES, 'APROBACIONES.md queda tal cual');

    const estado = readFileSync(join(nueva, 'ESTADO.md'), 'utf8');
    const lineas = estado.split('\n');
    assert.ok(lineas.length <= 60, `ESTADO.md tiene ${lineas.length} líneas`);
    for (const seccion of ['## Fase', '## Cola', '## Cómo retomar']) {
      assert.ok(lineas.includes(seccion), `falta ${seccion}`);
    }
    assert.match(estado, /facturacion-ejemplo/u, 'la fase conserva el slug');
    assert.match(estado, /escribir el test de la fase 8/u, 'la cola trae lo pendiente');
    assert.match(estado, /correr la suite completa/u, 'cómo retomar trae el punto de retome');

    const historial = readFileSync(join(nueva, 'historial.md'), 'utf8');
    assert.match(historial, /paso 1 hecho/u, 'lo que no entra en ESTADO.md va al historial');
    assert.match(historial, /paso 150 hecho/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('correrlo dos veces no cambia nada la segunda', () => {
  const root = proyecto();
  try {
    assert.equal(migrar(root).status, 0);
    const despues = listado(root);
    const otra = migrar(root);
    assert.equal(otra.status, 0, otra.stderr);
    assert.match(otra.stdout, /nada que migrar/u);
    assert.deepEqual(listado(root), despues);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('si ya existen las dos carpetas no se pisa nada: exit 1 y todo igual', () => {
  const root = proyecto();
  try {
    mkdirSync(join(root, '.ia-stack'));
    writeFileSync(join(root, '.ia-stack', 'ESTADO.md'), '# lo que ya había\n');
    const antes = listado(root);
    const r = migrar(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ya existe/u);
    assert.deepEqual(listado(root), antes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un SESSION.md vacío o ausente igual produce un ESTADO.md válido', () => {
  const root = mkdtempSync(join(tmpdir(), 'ia-migrar-'));
  try {
    mkdirSync(join(root, VIEJA));
    writeFileSync(join(root, VIEJA, 'APROBACIONES.md'), APROBACIONES);
    const r = migrar(root);
    assert.equal(r.status, 0, r.stderr);
    const lineas = readFileSync(join(root, '.ia-stack', 'ESTADO.md'), 'utf8').split('\n');
    for (const seccion of ['## Fase', '## Cola', '## Cómo retomar']) assert.ok(lineas.includes(seccion), seccion);
    assert.ok(lineas.length <= 60);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el respaldo no depende del original: borrar uno no toca al otro', () => {
  const root = proyecto();
  try {
    migrar(root);
    const respaldo = readdirSync(root).find((n) => n.startsWith(`${VIEJA}.respaldo-`));
    const copia = join(tmpdir(), `ia-migrar-copia-${process.pid}`);
    cpSync(join(root, respaldo), copia, { recursive: true });
    try {
      assert.equal(readFileSync(join(copia, 'APROBACIONES.md'), 'utf8'), APROBACIONES);
    } finally {
      rmSync(copia, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
