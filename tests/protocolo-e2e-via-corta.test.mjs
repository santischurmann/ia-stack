import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { REAL_SPAWN_TIMEOUT_MS, RUNTIME, bash, conProyecto, gate, instalar, proyectoLimpio, repoRoot } from './_e2e-fixture.mjs';

// Segunda mitad del recorrido de punta a punta: como cambia el estado a medida que aparecen los
// artefactos, y el cierre de la via corta. La primera, en `protocolo-e2e.test.mjs`.
// --- El estado va cambiando a medida que el proyecto se llena ------------------------------------

test('E2E · a medida que aparecen los artefactos, los gates pasan de VACÍO a verificar de verdad', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  // 1. Sin spec: vacío.
  assert.equal(gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests').clase, 'empty');

  // 2. Con spec y una prueba que nombra su criterio: verifica de verdad.
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  // El titulo lleva la funcionalidad, y la prueba la nombra junto al id: el par <slug> + <id> es lo
  // que identifica un criterio. Sin el slug, AC1 de esta spec quedaria cubierto por la prueba de
  // cualquier otra, que es el verde falso que se cerro el 2026-09-14.
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec: demo-de-gates\n\n- [ ] **AC1:** GIVEN algo WHEN corre THEN sale 0.\n', 'utf8');
  writeFileSync(join(root, 'tests', 'demo.test.mjs'), "import test from 'node:test';\ntest('demo-de-gates · AC1 · cubre el criterio', () => {});\n", 'utf8');
  const conSpec = gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests');
  assert.deepEqual({ clase: conSpec.clase, nombra: conSpec.salida.includes('AC1') || conSpec.salida.includes('1 criterio') }, { clase: 'ok', nombra: true }, conSpec.salida);

  // 3. Un criterio sin prueba que lo nombre: rechaza, y dice cuál.
  writeFileSync(join(root, 'docs', 'spec.md'), '# Spec: demo-de-gates\n\n- [ ] **AC1:** uno.\n- [ ] **AC2:** dos, sin prueba.\n', 'utf8');
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
  const sonda = gate(root, 'verify-empty-probe.mjs', 'check', join('.vibe', 'ia-stack-runtime', 'contracts', 'empty-probe.json'));
  assert.deepEqual({ clase: sonda.clase }, { clase: 'ok' }, sonda.salida);

  // El gate de sincronización corrido DESDE el proyecto no es un checkout fuente: tiene que
  // rechazar con un motivo, nunca decir que todo coincide.
  const sync = gate(root, 'verify-runtime-sync.mjs', 'check');
  assert.notEqual(sync.clase, 'ok', 'desde el proyecto no se puede afirmar que el runtime coincide con su fuente');
}));

// --- LA VIA CORTA CIERRA -------------------------------------------------------------------------
//
// ESTA ES LA PRUEBA QUE NO EXISTIA, y su ausencia dejo pasar el defecto mas grave que se encontro en
// todo el rediseno: el protocolo publicitaba un atajo —«Cambio chico, ≤3 archivos: ¿pipeline
// completo o directo a Build?»— que NO TENIA SALIDA LEGAL. Medido el 2026-09-15:
//
//   1. El test rojo exigia una prueba por cada criterio de `docs/spec.md`, y el atajo saltaba la spec.
//   2. La fase 6 corria la traza con `--require-inputs`, donde la ausencia de spec pasa a RECHAZO.
//   3. El recibo pedia campos que el atajo nunca escribia.
//
// Empezabas liviano y te frenaba al final, con el trabajo ya hecho. La bateria entera estaba en
// verde mientras tanto, porque ninguna prueba recorria el camino completo: cada gate se probaba por
// separado y el recorrido no se probaba nunca.
//
// Esta prueba recorre la via corta de punta a punta con los gates REALES del runtime instalado. Si
// alguien vuelve a romper el recorrido, se entera aca y no seis fases despues.
test('E2E · la via corta cierra: scavenge, spec minima, test rojo y traza, sin quedar trabada', () => conProyecto((root) => {
  assert.equal(instalar(root).status, 0);

  mkdirSync(join(root, 'docs', 'scavenge'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });

  // El codigo que ya existe, para que el locator del scavenge resuelva a una linea de verdad.
  writeFileSync(join(root, 'scripts', 'util.mjs'), 'export function sumar(a, b) {\n  return a + b;\n}\n', 'utf8');

  writeFileSync(join(root, 'docs', 'scavenge', 'cambio-chico.json'), JSON.stringify({
    schema: 'ia.scavenge/1',
    feature: 'cambio-chico',
    date: '2026-09-15',
    scope: 'corto',
    reusable: [{
      id: 'R1',
      what: 'Ya existe la funcion de suma que este cambio tiene que endurecer, en vez de escribir otra al lado.',
      locator: 'scripts/util.mjs:1',
    }],
    missing: [{ id: 'M1', what: 'No valida sus entradas: con texto devuelve una concatenacion en vez de fallar.' }],
    breaks: [],
    unknowns: [],
  }, null, 2), 'utf8');

  // Tres secciones, no ocho. La via sale del scavenge, no de una bandera.
  writeFileSync(join(root, 'docs', 'spec.md'), [
    '# Spec: cambio-chico',
    '',
    '## Problem / Problema',
    'La funcion de suma no valida sus entradas y con texto devuelve una concatenacion.',
    '',
    '## Acceptance Criteria / Criterios de aceptación',
    '- [ ] **AC1:** GIVEN una entrada que no es un numero, WHEN se llama a sumar, THEN lanza en vez de concatenar.',
    '',
    '## Definition of Done (DoD)',
    'Suite verde y el gate declarando su limite.',
    '',
  ].join('\n'), 'utf8');

  // El titulo nombra funcionalidad Y criterio: es lo que la traza exige desde que se cerro el
  // solapamiento de identificadores entre features.
  writeFileSync(join(root, 'tests', 'util.test.mjs'), [
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "import { sumar } from '../scripts/util.mjs';",
    '',
    "test('cambio-chico · AC1 · sumar rechaza lo que no es un numero', () => {",
    "  assert.throws(() => sumar('a', 1));",
    '});',
    '',
  ].join('\n'), 'utf8');

  const scavenge = gate(root, 'verify-scavenge.mjs', 'check', 'docs/scavenge/cambio-chico.json');
  assert.equal(scavenge.clase, 'ok', scavenge.salida);

  const tope = gate(root, 'verify-spec-wordcap.mjs', 'check', 'docs/spec.md');
  assert.equal(tope.clase, 'ok', tope.salida);

  // La pieza central: tres secciones aprueban PORQUE el scavenge declaro scope corto.
  const calidad = gate(root, 'verify-spec-wordcap.mjs', 'check', 'docs/spec.md', '--quality');
  assert.equal(calidad.clase, 'ok', calidad.salida);
  assert.match(calidad.salida, /vía corta/u, 'el verde tiene que decir contra que listado se comprobo');

  // La contradiccion numero 2, la que frenaba al final: con la spec presente, la traza cierra.
  const traza = gate(root, 'verify-evidence-trace.mjs', 'criteria', '--spec', 'docs/spec.md', '--tests', 'tests', '--require-inputs');
  assert.equal(traza.clase, 'ok', traza.salida);
}));

test('E2E · sin scavenge en scope corto, esa misma spec de tres secciones se RECHAZA', () => conProyecto((root) => {
  // La contraprueba: la via corta no se consigue escribiendo menos, se consigue declarando el
  // alcance en el scavenge. Sin eso, una spec de tres secciones es una spec incompleta.
  assert.equal(instalar(root).status, 0);
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'spec.md'), [
    '# Spec: cambio-chico',
    '',
    '## Problem / Problema',
    'La funcion de suma no valida sus entradas.',
    '',
    '## Acceptance Criteria / Criterios de aceptación',
    '- [ ] **AC1:** GIVEN algo que no es numero, WHEN se suma, THEN lanza.',
    '',
    '## Definition of Done (DoD)',
    'Suite verde.',
    '',
  ].join('\n'), 'utf8');

  const calidad = gate(root, 'verify-spec-wordcap.mjs', 'check', 'docs/spec.md', '--quality');
  assert.equal(calidad.clase, 'reject', calidad.salida);
  assert.match(calidad.salida, /vía completa/u);
  assert.match(calidad.salida, /Discovery/u);
}));
