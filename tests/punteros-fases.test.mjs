// Revisión N3 3.4.1 · punteros a fases: desde la 3.4.1 SKILL.md es sólo el núcleo y cada fase vive en
// phases/NN-*.md. Esta prueba fija que las skills, el contrato de gates y el README no manden al lector
// a buscar un menú o una fase dentro de SKILL.md, donde ya no están.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

test('revision-n3 · MEDIA 6 · el menú de Phase 1 se busca en phases/01-bootstrap.md, no en SKILL.md', () => {
  for (const ruta of ['skills/caveman-tdd.md', 'skills/orchestrator-opus.md', 'skills/vibe-memory.md']) {
    const texto = leer(ruta).replace(/\s+/gu, ' ');
    assert.doesNotMatch(texto, /Phase 1 [^.]{0,40}menu in `SKILL\.md`/u, `${ruta} manda al menú dentro de SKILL.md`);
    assert.match(texto, /phases\/01-bootstrap\.md/u, `${ruta} no apunta a phases/01-bootstrap.md`);
  }
});

test('revision-n3 · BAJA · spec-plan-templates apunta a phases/04-spec.md y phases/05-plan.md, no a SKILL.md Phase 3/2', () => {
  const texto = leer('skills/spec-plan-templates.md');
  assert.doesNotMatch(texto, /SKILL\.md Phase 3\/2/u);
  assert.doesNotMatch(texto, /`SKILL\.md`\) picks/u);
  assert.match(texto, /phases\/04-spec\.md/u);
  assert.match(texto, /phases\/05-plan\.md/u);
});

test('revision-n3 · BAJA · gate-docs.json manda la fase 5.1 a phases/06-build.md', () => {
  const texto = leer('contracts/gate-docs.json');
  assert.doesNotMatch(texto, /La fase 5\.1 de SKILL\.md/u);
  assert.match(texto, /La fase 5\.1 .{0,30}phases\/06-build\.md/u);
});

test('revision-n3 · BAJA · README describe SKILL.md como núcleo + mapa con las fases en phases/', () => {
  const fila = leer('README.md').split('\n').find((l) => l.includes('[`SKILL.md`](SKILL.md)'));
  assert.ok(fila, 'falta la fila de SKILL.md en el README');
  assert.doesNotMatch(fila, /protocolo completo/u);
  assert.match(fila, /núcleo \+ mapa/u);
  assert.match(fila, /phases\//u);
});

test('revision-n3 · BAJA · SKILL.md aclara la ruta instalada de las fases y protocolo.mjs declara el tope y el tamaño real', () => {
  assert.match(leer('SKILL.md'), /\.vibe\/ia-stack-runtime\/phases\//u);
  const cabecera = leer('scripts/protocolo.mjs').split('\n').slice(0, 8).join('\n');
  assert.match(cabecera, /tope 20 KB, hoy ~15 KB/u);
  assert.doesNotMatch(cabecera, /nucleo de 20 KB/u);
});
