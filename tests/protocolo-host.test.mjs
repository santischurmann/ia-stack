// Protocolo y host (IA Stack 3.4.6): sin reglas por recursos de la máquina, suites a la vez sólo con puerto y
// base de prueba propios, revisor en otra sesión con /code-review medium, /ship y /steward fuera, opcionales del host.
// LO QUE NO CUBRE: que el host tenga esos comandos ni que la sesión los use.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { saltarSiEsRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const leer = (rel) => readFileSync(join(repoRoot, rel), 'utf8');
const contrato = JSON.parse(leer('contracts/model-routing.json'));
const REGLA_VIEJA = /midiendo la RAM|medí la RAM|un proceso pesado a la vez/u;
const md = (dir) => readdirSync(join(repoRoot, dir)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`);
const copiados = ['SKILL.md', 'AGENTS.md', 'contracts/model-routing.json', ...md('phases'), ...md('skills')];

test('ninguna regla frena ni mide por la RAM ni pide un proceso pesado a la vez', () => {
  for (const rel of copiados) assert.doesNotMatch(leer(rel), REGLA_VIEJA, rel);
});

test('README e INSTALL tampoco traen la regla vieja', (t) => {
  if (saltarSiEsRuntimeInstalado(t, repoRoot, 'README e INSTALL sin la regla de RAM')) return;
  assert.doesNotMatch(readFileSync(join(repoRoot, 'README.md'), 'utf8'), REGLA_VIEJA);
  assert.doesNotMatch(readFileSync(join(repoRoot, 'INSTALL.md'), 'utf8'), REGLA_VIEJA);
});

test('suites a la vez sólo con puerto y base de prueba propios; las sesiones no hablan de procesos pesados', () => {
  for (const re of [/su puerto/u, /base de prueba/u, /de a una/u]) assert.match(contrato.encargo.suites_en_paralelo ?? '', re);
  assert.doesNotMatch(contrato.encargo.sesiones, /pesado/u);
});

test('fase 8: revisor en otra sesión con /code-review medium sin --fix; /ship y /steward no se usan', () => {
  const t = leer('phases/08-publicar.md');
  for (const p of ['`/code-review medium', 'sin su conversación', 'sin `--fix`', '`/ship` y `/steward` no se usan']) assert.ok(t.includes(p), p);
  assert.doesNotMatch(t, /`\/code-review (high|xhigh|max|ultra)/u);
  assert.doesNotMatch(t, /nada más/u);
});

test('encargo: los opcionales del host, cada uno con su condición', () => {
  const t = leer('skills/encargo.md');
  for (const p of ['## Si el host lo tiene', '`isolation: worktree`', '`effort`', '`maxTurns`', 'Workflows', 'Code Mode', 'Advisor: no', 'Skills desde MCP: no']) assert.ok(t.includes(p), p);
});
