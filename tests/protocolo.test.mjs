// scripts/protocolo.mjs: el lector comun del protocolo partido (SKILL.md + phases/NN-*.md).
// Lo que se mide: el orden, que solo entren archivos con forma de fase, y que un arbol sin phases/
// (un checkout viejo, un runtime a medio copiar, una fixture) lea SKILL.md y nada mas.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const { archivosProtocolo, leerProtocolo } = await import(pathToFileURL(join(repoRoot, 'scripts', 'protocolo.mjs')).href);

function arbol(archivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-protocolo-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(raiz, ruta)), { recursive: true });
    writeFileSync(join(raiz, ruta), contenido);
  }
  return raiz;
}

test('el repositorio real: SKILL.md primero y despues phases/00..12 en orden', () => {
  const nombres = archivosProtocolo(repoRoot).map((r) => basename(r));
  assert.equal(nombres[0], 'SKILL.md');
  assert.equal(nombres.length, 14);
  assert.deepEqual(nombres.slice(1), [...nombres.slice(1)].sort());
  assert.match(nombres[1], /^00-/u);
  assert.match(nombres.at(-1), /^12-/u);
});

test('leerProtocolo concatena lo mismo que archivosProtocolo lista, con salto de linea entre archivos', () => {
  const esperado = archivosProtocolo(repoRoot).map((r) => readFileSync(r, 'utf8')).join('\n');
  assert.equal(leerProtocolo(repoRoot), esperado);
});

test('FALSIFICACION · una raiz sin phases/ lee SKILL.md solo, sin lanzar', () => {
  const raiz = arbol({ 'SKILL.md': 'solo el nucleo\n' });
  try {
    assert.deepEqual(archivosProtocolo(raiz), [join(raiz, 'SKILL.md')]);
    assert.equal(leerProtocolo(raiz), 'solo el nucleo\n');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('solo entran archivos NN-nombre.md: notas, borradores y otras extensiones quedan afuera', () => {
  const raiz = arbol({
    'SKILL.md': 'N',
    'phases/02-b.md': 'B',
    'phases/01-a.md': 'A',
    'phases/LEEME.md': 'no',
    'phases/3-corto.md': 'no',
    'phases/04-c.txt': 'no',
  });
  try {
    assert.deepEqual(archivosProtocolo(raiz).map((r) => basename(r)), ['SKILL.md', '01-a.md', '02-b.md']);
    assert.equal(leerProtocolo(raiz), 'N\nA\nB');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
