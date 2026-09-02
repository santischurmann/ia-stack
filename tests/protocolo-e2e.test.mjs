// Prueba de punta a punta del protocolo, sobre un proyecto que no existía hace un segundo.
//
// Existe porque dos defectos de esta misma sesión eran INVISIBLES desde el repo de VCP y sólo
// aparecieron mirando desde afuera: el instalador dejaba sus 114 archivos como superficie viva del
// proyecto ajeno (hallazgo 58), y la suite no estaba verde en un clon recién hecho (hallazgo 60).
// Las pruebas por gate no podían verlos, porque cada una mira su gate sobre fixtures que ella misma
// arma. Ésta mira el conjunto, en el orden real, sobre un proyecto vacío.
//
// LÍMITE HONESTO: recorre el camino feliz y el arranque en frío. NO simula una sesión completa con
// subagentes, ni el ciclo RED→GREEN sobre código real, ni un proyecto a medio llenar en cada
// combinación posible. Prueba que la instalación deja algo que funciona y que cada gate dice lo que
// corresponde cuando todavía no hay nada — que es exactamente donde se escondían los dos defectos.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { REAL_SPAWN_TIMEOUT_MS } from './spawn-budget.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNTIME = join('.vibe', 'vcp-runtime', 'scripts');
const bash = process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
  ? 'C:\\Program Files\\Git\\bin\\bash.exe'
  : 'bash';

/** Un proyecto nuevo de verdad: repo git propio, un commit, y nada de VCP todavía. */
function proyectoLimpio() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-e2e-'));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '.');
  git('config', 'user.email', 'e2e@test');
  git('config', 'user.name', 'e2e');
  writeFileSync(join(root, 'README.md'), '# proyecto de prueba\n', 'utf8');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n', 'utf8');
  git('add', '-A');
  git('commit', '-q', '-m', 'inicial');
  return { root, git };
}

function instalar(root) {
  return spawnSync(bash, [join(repoRoot, 'scripts', 'install.sh'), '--project', root], { encoding: 'utf8' });
}

function gate(root, script, ...args) {
  const run = spawnSync(process.execPath, [join(root, RUNTIME, script), ...args], { cwd: root, encoding: 'utf8' });
  const salida = `${run.stdout}${run.stderr}`;
  const clase = run.status === 2 ? 'usage'
    : run.status !== 0 ? 'reject'
      : run.stdout.startsWith('VACÍO: ') || run.stdout.startsWith('VACIO: ') ? 'empty'
        : 'ok';
  return { status: run.status, clase, salida, primera: salida.split('\n')[0] };
}

function conProyecto(accion) {
  const { root, git } = proyectoLimpio();
  try {
    return accion(root, git);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- Arranque en frío ---------------------------------------------------------------------------

test('E2E · instalar en un proyecto limpio deja el runtime usable y fuera de la superficie', () => conProyecto((root, git) => {
  const instalacion = instalar(root);
  assert.equal(instalacion.status, 0, instalacion.stderr);

  // El runtime existe y es ejecutable desde el proyecto.
  assert.ok(existsSync(join(root, RUNTIME, 'verify-empty-probe.mjs')), 'el runtime tiene que quedar instalado');

  // Hallazgo 58: ni un solo archivo del runtime puede quedar como código vivo del usuario.
  const superficie = git('ls-files', '--others', '--exclude-standard').stdout.split('\n').filter(Boolean);
  assert.deepEqual(superficie.filter((f) => f.includes('vcp-runtime')), [], 'el runtime no es código del proyecto');

  // Y el .gitignore que ya tenía el proyecto sigue estando.
  const ignore = git('check-ignore', '-v', '.vibe/vcp-runtime/scripts/verify-receipt.mjs').stdout;
  assert.match(ignore, /vcp-runtime/u, 'la regla tiene que ser la que ignora el runtime');
}));

test('E2E · las nuevas garantías del runtime instalado funcionan sobre un proyecto real', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  const matrix = gate(root, 'verify-capability-matrix.mjs', 'check', '.vibe/vcp-runtime/contracts/capability-matrix.json');
  assert.equal(matrix.clase, 'ok', matrix.salida);

  // The strict spec gate is opt-in but usable from the installed runtime.
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), [
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
    schema: 'vcp.evidence-request/v1', command: ['node', '-e', 'process.exit(0)'], cwd: '.', timeout_ms: REAL_SPAWN_TIMEOUT_MS, skip_reason: null,
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

// --- El estado va cambiando a medida que el proyecto se llena ------------------------------------

test('E2E · a medida que aparecen los artefactos, los gates pasan de VACÍO a verificar de verdad', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  // 1. Sin spec: vacío.
  assert.equal(gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests').clase, 'empty');

  // 2. Con spec y una prueba que nombra su criterio: verifica de verdad.
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec\n\n- [ ] **AC1:** GIVEN algo WHEN corre THEN sale 0.\n', 'utf8');
  writeFileSync(join(root, 'tests', 'demo.test.mjs'), "import test from 'node:test';\ntest('AC1 · cubre el criterio', () => {});\n", 'utf8');
  const conSpec = gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests');
  assert.deepEqual({ clase: conSpec.clase, nombra: conSpec.salida.includes('AC1') || conSpec.salida.includes('1 criterio') }, { clase: 'ok', nombra: true }, conSpec.salida);

  // 3. Un criterio sin prueba que lo nombre: rechaza, y dice cuál.
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec\n\n- [ ] **AC1:** uno.\n- [ ] **AC2:** dos, sin prueba.\n', 'utf8');
  const faltante = gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests');
  assert.deepEqual({ clase: faltante.clase, nombraAC2: faltante.salida.includes('AC2') }, { clase: 'reject', nombraAC2: true });

  // 4. Y con --require-inputs, borrar la spec deja de comprar silencio.
  rmSync(join(root, 'docs', 'spec.md'));
  assert.equal(gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs').clase, 'reject');
}));

test('E2E · la traza de auditoría se sella, se verifica, y su historia en git la respalda', () => conProyecto((root, git) => {
  assert.equal(instalar(root).status, 0);

  const append = (texto) => gate(root, 'verify-audit-chain.mjs', 'append', '.vibe/AUDIT.md', texto);
  assert.equal(append('[2026-08-28] E2E | primera | evidencia | ref').status, 0);
  assert.equal(append('[2026-08-28] E2E | segunda | evidencia | ref').status, 0);

  // La cadena interna cierra.
  const cadena = gate(root, 'verify-audit-chain.mjs', 'check', '.vibe/AUDIT.md', '--require-inputs');
  assert.deepEqual({ clase: cadena.clase, dos: cadena.salida.includes('2 chained') }, { clase: 'ok', dos: true }, cadena.salida);

  // Sin commitear, el ancla todavía no tiene contra qué comparar.
  assert.equal(gate(root, 'verify-audit-chain.mjs', 'history', '.vibe/AUDIT.md').clase, 'empty');

  git('add', '-A');
  git('commit', '-q', '-m', 'traza');
  assert.equal(gate(root, 'verify-audit-chain.mjs', 'history', '.vibe/AUDIT.md').clase, 'ok');

  // Y ahora el ataque que `check` no puede ver: recortar la traza a la mitad.
  const entero = spawnSync('git', ['-C', root, 'show', 'HEAD:.vibe/AUDIT.md'], { encoding: 'utf8' }).stdout;
  writeFileSync(join(root, '.vibe', 'AUDIT.md'), entero.split('\n').slice(0, 1).join('\n') + '\n', 'utf8');
  const recortada = gate(root, 'verify-audit-chain.mjs', 'check', '.vibe/AUDIT.md');
  const anclada = gate(root, 'verify-audit-chain.mjs', 'history', '.vibe/AUDIT.md');
  assert.deepEqual(
    { check: recortada.clase, history: anclada.clase },
    { check: 'ok', history: 'reject' },
    'recortar pasa `check` y tiene que caer en `history`: es exactamente para eso que existe el ancla',
  );
}));

test('E2E · la sonda de carpeta vacía y el contrato corren desde el runtime instalado', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  // La sonda mira los gates del propio runtime, así que su contrato viaja con él.
  const sonda = gate(root, 'verify-empty-probe.mjs', 'check', join('.vibe', 'vcp-runtime', 'contracts', 'empty-probe.json'));
  assert.deepEqual({ clase: sonda.clase }, { clase: 'ok' }, sonda.salida);

  // El gate de sincronización corrido DESDE el proyecto no es un checkout fuente: tiene que
  // rechazar con un motivo, nunca decir que todo coincide.
  const sync = gate(root, 'verify-runtime-sync.mjs', 'check');
  assert.notEqual(sync.clase, 'ok', 'desde el proyecto no se puede afirmar que el runtime coincide con su fuente');
}));
