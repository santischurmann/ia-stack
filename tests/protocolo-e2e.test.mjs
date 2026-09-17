import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { REAL_SPAWN_TIMEOUT_MS, RUNTIME, bash, conProyecto, gate, instalar, proyectoLimpio, repoRoot } from './_e2e-fixture.mjs';

// Primera mitad: el arranque en frio. La segunda, en `protocolo-e2e-via-corta.test.mjs`,
// cubre como cambia el estado a medida que el proyecto se llena y el cierre de la via corta.
// --- Arranque en frío ---------------------------------------------------------------------------

test('E2E · instalar en un proyecto limpio deja el runtime usable y fuera de la superficie', () => conProyecto((root, git) => {
  const instalacion = instalar(root);
  assert.equal(instalacion.status, 0, instalacion.stderr);

  // El runtime existe y es ejecutable desde el proyecto.
  assert.ok(existsSync(join(root, RUNTIME, 'verify-empty-probe.mjs')), 'el runtime tiene que quedar instalado');

  // Hallazgo 58: ni un solo archivo del runtime puede quedar como código vivo del usuario.
  const superficie = git('ls-files', '--others', '--exclude-standard').stdout.split('\n').filter(Boolean);
  assert.deepEqual(superficie.filter((f) => f.includes('ia-stack-runtime')), [], 'el runtime no es código del proyecto');

  // Y el .gitignore que ya tenía el proyecto sigue estando.
  const ignore = git('check-ignore', '-v', '.vibe/ia-stack-runtime/scripts/verify-receipt.mjs').stdout;
  assert.match(ignore, /ia-stack-runtime/u, 'la regla tiene que ser la que ignora el runtime');
}));

test('E2E · las nuevas garantías del runtime instalado funcionan sobre un proyecto real', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  const matrix = gate(root, 'verify-capability-matrix.mjs', 'check', '.vibe/ia-stack-runtime/contracts/capability-matrix.json');
  assert.equal(matrix.clase, 'ok', matrix.salida);

  // The strict spec gate is opt-in but usable from the installed runtime.
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), [
    // El titulo con la funcionalidad no es decorativo: un identificador como AC1 no identifica nada
    // sin el, porque todas las specs numeran desde AC1 y el criterio de una quedaria cubierto por la
    // prueba de otra. `verify-evidence-trace criteria` rechaza una spec con criterios y sin titulo.
    '# Spec: demo-de-punta-a-punta', '',
    '## Problem / Problema', 'Necesitamos un resultado repetible.',
    '## Discovery / Investigación previa', 'La evidencia local fue revisada.',
    '## Target Users / Usuarios', 'Equipo de producto.',
    '## Acceptance Criteria / Criterios de aceptación', '- [ ] **AC1:** GIVEN un proyecto WHEN corre el gate THEN sale 0.',
    '## Constraints / Restricciones', 'Sin dependencias nuevas.',
    '## Non-Goals / No-Goals', 'No reemplaza revisión humana.',
    '## Stack & Dependencies', 'Node nativo.',
    '## Definition of Done (DoD)', 'Tests y gates verdes.',
  ].join('\n') + '\n', 'utf8');
  const quality = gate(root, 'verify-spec-wordcap.mjs', 'check', 'docs/spec.md', '--quality');
  assert.equal(quality.clase, 'ok', quality.salida);

  mkdirSync(join(root, '.vibe', 'evidence'), { recursive: true });
  writeFileSync(join(root, '.vibe', 'evidence', 'request.json'), JSON.stringify({
    schema: 'ia.evidence-request/v1', command: ['node', '-e', 'process.exit(0)'], cwd: '.', timeout_ms: REAL_SPAWN_TIMEOUT_MS, skip_reason: null,
  }) + '\n', 'utf8');
  const recorded = gate(root, 'verify-evidence-runner.mjs', 'run', '.vibe/evidence/request.json', '.vibe/evidence/record.json');
  assert.equal(recorded.clase, 'ok', recorded.salida);
  const evidence = gate(root, 'verify-evidence-runner.mjs', 'check', '.vibe/evidence/record.json', '--require-complete');
  assert.equal(evidence.clase, 'ok', evidence.salida);
}));

test('E2E · en un proyecto que todavía no arrancó, cada gate dice VACÍO o rechaza, ninguno miente', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  // Lo que un proyecto recién instalado tiene que responder. `empty` es la respuesta correcta donde
  // no hay nada que comparar; `reject` donde falta algo que el protocolo exige de entrada.
  const esperado = [
    ['verify-audit-chain.mjs', ['check', '.vibe/AUDIT.md'], 'empty'],
    ['verify-audit-chain.mjs', ['history', '.vibe/AUDIT.md'], 'empty'],
    ['verify-phase-decisions.mjs', ['check', 'docs/phase-decisions.json'], 'empty'],
    ['verify-evidence-trace.mjs', ['criteria', '--spec', 'docs/spec.md', '--tests', 'tests'], 'empty'],
    ['verify-spec-wordcap.mjs', ['check', 'docs/spec.md'], 'reject'],
    ['verify-receipt.mjs', ['check', '.vibe/receipts/x.json'], 'reject'],
    ['verify-triangulate.mjs', ['check', 'docs/triangulate/x.json'], 'empty'],
    ['verify-graphify-manifest.mjs', ['check'], 'reject'],
  ];

  const observado = esperado.map(([script, args]) => [script, args, gate(root, script, ...args).clase]);
  assert.deepEqual(observado, esperado, 'algún gate cambió de comportamiento en el arranque en frío');
}));

test('E2E · ningún gate escribe OK sobre un proyecto donde no hay nada que verificar', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  const mentirosos = [];
  for (const [script, args] of [
    ['verify-audit-chain.mjs', ['check', '.vibe/AUDIT.md']],
    ['verify-audit-chain.mjs', ['history', '.vibe/AUDIT.md']],
    ['verify-phase-decisions.mjs', ['check', 'docs/phase-decisions.json']],
    ['verify-evidence-trace.mjs', ['criteria', '--spec', 'docs/spec.md', '--tests', 'tests']],
    ['verify-evidence-trace.mjs', ['claims', '--feature', 'no-existe']],
    ['verify-receipt.mjs', ['custody', 'docs/spec.md']],
  ]) {
    const r = gate(root, script, ...args);
    if (r.clase === 'ok') mentirosos.push(`${script} ${args.join(' ')} -> ${r.primera}`);
  }
  assert.deepEqual(mentirosos, [], 'un OK acá es un gate afirmando haber verificado la nada');
}));
