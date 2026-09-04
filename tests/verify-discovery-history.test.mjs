// Pruebas del ancla externa de Discovery. El agujero que cierra: predecessor_hash y packet_sha256
// se calculan sobre archivos del mismo arbol que protegen, asi que reescribir el run entero y
// recalcular los hashes da una secuencia coherente y `check` sale verde. El ancla es git, igual que
// en verify-audit-chain: un expediente solo crece.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';
import {
  IMMUTABLE_IN_RUN,
  findMutations,
  gitDiscoveryVersions,
  main,
  parseArgs,
  verifyDiscoveryGrowth,
} from '../scripts/verify-discovery-core.mjs';

const SLUG = 'mi-feature';

/** Un repositorio git de verdad: el ancla no se puede probar con un doble. */
function repo(accion) {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-dhistory-'));
  const git = (...args) => execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8' });
  try {
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    return accion({ raiz, git, escribir: (rel, texto) => {
      const destino = join(raiz, rel);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, texto);
    }, commit: (mensaje) => { git('add', '-A'); git('commit', '-q', '-m', mensaje); } });
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

const decision = (slug, n) => `docs/discovery/${slug}/runs/run-001/decisions/d00${n}.json`;
const packet = (slug, n) => `docs/discovery/${slug}/runs/run-001/packets/d00${n}.json`;

// --- Que archivos son inmutables ------------------------------------------------------------------

test('IMMUTABLE_IN_RUN cubre decisiones y packets, y deja afuera las vistas', () => {
  assert.ok(IMMUTABLE_IN_RUN.test(`docs/discovery/${SLUG}/runs/run-001/decisions/d001.json`));
  assert.ok(IMMUTABLE_IN_RUN.test(`docs/discovery/${SLUG}/runs/run-012/packets/d003.json`));
  // Las vistas se regeneran: cambiar es su trabajo, no una violación.
  assert.equal(IMMUTABLE_IN_RUN.test(`docs/discovery/${SLUG}/views/run-001.md`), false);
  assert.equal(IMMUTABLE_IN_RUN.test('docs/spec.md'), false);
});

// --- El ancla ---------------------------------------------------------------------------------------

test('gitDiscoveryVersions lista las versiones commiteadas del expediente', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    commit('primera decisión');
    escribir(decision(SLUG, 2), '{"decision_id":"d002"}');
    commit('segunda decisión');
    const r = gitDiscoveryVersions(raiz, SLUG);
    assert.equal(r.error, null, r.error ?? '');
    assert.equal(r.commits.length, 2);
  });
});

// Un proyecto sin ningún commit no es historia rota: es uno que todavía no registró nada.
test('un repositorio sin commits no es un ancla rota, es un proyecto que no registró nada', () => {
  repo(({ raiz }) => {
    const r = gitDiscoveryVersions(raiz, SLUG);
    assert.equal(r.error, null);
    assert.deepEqual(r.commits, []);
  });
});

// Un ancla que se apaga sola cuando el expediente nunca se commiteó no sirve como ancla.
test('FALSIFICACIÓN · un expediente que existe en disco y nunca se commiteó no pasa en silencio', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir('README.md', 'algo\n');
    commit('inicial');
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.equal(r.anchored, false, 'sin versión commiteada no hay nada contra qué comparar');
    assert.match(r.error ?? '', /nunca/u, `debería decir que el expediente no está en la historia: ${JSON.stringify(r)}`);
  });
});

// --- Lo que el ancla agarra --------------------------------------------------------------------------

test('FALSIFICACIÓN · reescribir una decisión ya commiteada rompe el ancla', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001","claim":"original"}');
    commit('decisión original');
    escribir(decision(SLUG, 1), '{"decision_id":"d001","claim":"reescrita"}');
    commit('reescribo la decisión y recalculo todo');
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.equal(r.violations.length, 1, JSON.stringify(r));
    assert.match(r.violations[0].path, /d001\.json$/u);
    assert.equal(r.violations[0].change, 'M');
  });
});

test('FALSIFICACIÓN · borrar una decisión ya commiteada rompe el ancla', () => {
  repo(({ raiz, git, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    escribir(decision(SLUG, 2), '{"decision_id":"d002"}');
    commit('dos decisiones');
    git('rm', '-q', decision(SLUG, 2));
    commit('recorto el final del expediente');
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.equal(r.violations.length, 1, JSON.stringify(r));
    assert.equal(r.violations[0].change, 'D');
  });
});

test('FALSIFICACIÓN · reescribir un packet ya commiteado también rompe el ancla', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(packet(SLUG, 2), '{"schema":"vcp.discovery-packet/1"}');
    commit('packet original');
    escribir(packet(SLUG, 2), '{"schema":"vcp.discovery-packet/1","research_snapshot":{"claims":[]}}');
    commit('reescribo el packet');
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.equal(r.violations.length, 1, JSON.stringify(r));
  });
});

// --- Lo que el ancla NO tiene que agarrar --------------------------------------------------------------

test('agregar decisiones nuevas es exactamente lo que un expediente hace, y no es una violación', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    commit('primera');
    escribir(decision(SLUG, 2), '{"decision_id":"d002"}');
    escribir(packet(SLUG, 2), '{"schema":"vcp.discovery-packet/1"}');
    commit('segunda, con su packet');
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.deepEqual(r.violations, []);
    assert.equal(r.anchored, true);
    assert.equal(r.commits, 2);
  });
});

test('regenerar una vista no es una violación: las vistas son derivadas', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    escribir(`docs/discovery/${SLUG}/views/run-001.md`, '# vista\n');
    commit('decisión y vista');
    escribir(`docs/discovery/${SLUG}/views/run-001.md`, '# vista regenerada\n');
    commit('regenero la vista');
    assert.deepEqual(verifyDiscoveryGrowth(raiz, SLUG).violations, []);
  });
});

test('un expediente de otra feature no cuenta como violación de ésta', () => {
  repo(({ raiz, escribir, commit }) => {
    escribir(decision(SLUG, 1), '{"decision_id":"d001"}');
    escribir(decision('otra-feature', 1), '{"decision_id":"d001"}');
    commit('dos expedientes');
    escribir(decision('otra-feature', 1), '{"decision_id":"d001","reescrito":true}');
    commit('reescribo el de la otra feature');
    assert.deepEqual(verifyDiscoveryGrowth(raiz, SLUG).violations, [], 'el ancla mira sólo su feature');
  });
});

// --- El CLI -------------------------------------------------------------------------------------------

test('parseArgs acepta history junto a check y sources', () => {
  assert.deepEqual(parseArgs(['history', '--feature', SLUG]), { command: 'history', featureSlug: SLUG, requireCurrent: false });
  assert.equal(parseArgs(['history', '--feature', SLUG, '--require-current']), null, '--require-current no aplica a history');
});

test('main informa las tres salidas de history: sin ancla, con violación y verde', () => {
  const sinAncla = [];
  assert.equal(main(['history', '--feature', SLUG], '.', () => {}, (m) => sinAncla.push(m), undefined, { growth: () => ({ anchored: false, error: 'el expediente nunca se commiteó', commits: 0, violations: [] }) }), 1);
  assert.match(sinAncla.join('\n'), /nunca se commiteó/u);

  const errores = [];
  const rota = { anchored: true, error: null, commits: 3, violations: [{ commit: 'abc1234', path: `docs/discovery/${SLUG}/runs/run-001/decisions/d001.json`, change: 'M' }] };
  assert.equal(main(['history', '--feature', SLUG], '.', () => {}, (m) => errores.push(m), undefined, { growth: () => rota }), 1);
  assert.match(errores.join('\n'), /DISCOVERY_HISTORY_REWRITTEN/u);
  assert.match(errores.join('\n'), /d001\.json/u);

  const salidas = [];
  assert.equal(main(['history', '--feature', SLUG], '.', (m) => salidas.push(m), () => {}, undefined, { growth: () => ({ anchored: true, error: null, commits: 5, violations: [] }) }), 0);
  assert.match(salidas.join('\n'), /5 versión/u);
});

// --- El repositorio real ---------------------------------------------------------------------------------

test('el expediente real de este repositorio sólo creció', (t) => {
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  // Self-check del repositorio de VCP: le pregunta a git por ESTE checkout, con un slug de feature
  // de VCP. Adentro del runtime instalado de otra persona no hay nada que afirmar, y ademas el
  // instalador gitignora el runtime, asi que git tampoco puede contestar. Se saltea diciendo por que.
  if (esRuntimeInstalado(repoRoot)) {
    t.skip('runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala');
    return;
  }
  const r = verifyDiscoveryGrowth(repoRoot, 'integridad-verificable');
  assert.equal(r.anchored, true, JSON.stringify(r));
  assert.deepEqual(r.violations, [], 'ninguna decisión ni packet commiteado se modificó jamás');
});

// --- Casos borde del ancla ------------------------------------------------------------------------

test('un proyecto sin expediente ni commits no es un rechazo: no hay nada que anclar', () => {
  repo(({ raiz }) => {
    const r = verifyDiscoveryGrowth(raiz, SLUG);
    assert.equal(r.anchored, false);
    assert.equal(r.error, null, 'sin expediente en disco tampoco, no hay violación que declarar');
    const salidas = [];
    assert.equal(main(['history', '--feature', SLUG], raiz, (m) => salidas.push(m), () => {}), 0);
    assert.match(salidas.join('\n'), /^VACÍO:/u, 'y se escribe distinto de un OK');
  });
});

test('un fallo de git que no es "repo sin commits" se reporta como ancla rota', () => {
  // El doble tiene que distinguir: `log` falla, pero HEAD existe. Si devolviera 128 para todo,
  // el gate lo leería como "repo sin commits" y el caso quedaría sin probar.
  const roto = (_cmd, args) => (args.includes('rev-parse')
    ? { status: 0, stdout: 'abc1234', stderr: '' }
    : { status: 128, stdout: '', stderr: 'fatal: bad revision' });
  const r = gitDiscoveryVersions('/no/importa', SLUG, roto);
  assert.match(r.error ?? '', /no se puede leer la historia/u);
  assert.deepEqual(r.commits, []);
  const g = verifyDiscoveryGrowth('/no/importa', SLUG, { versions: () => r });
  assert.equal(g.anchored, false);
  assert.equal(g.violations.length, 0);
});

test('findMutations devuelve vacío si git no puede responder, y descarta lo que no es del expediente', () => {
  assert.deepEqual(findMutations('.', SLUG, () => ({ status: 1, stdout: '', stderr: 'x' })), []);
  const NUL = String.fromCharCode(0);
  const salida = [
    `${NUL}abc1234`,
    `M\tdocs/discovery/${SLUG}/runs/run-001/decisions/d001.json`,
    `M\tdocs/discovery/${SLUG}/views/run-001.md`,
    'M\tREADME.md',
    `D\tdocs/discovery/${SLUG}/runs/run-001/packets/d002.json`,
  ].join('\n');
  const m = findMutations('.', SLUG, () => ({ status: 0, stdout: salida, stderr: '' }));
  assert.deepEqual(m.map((x) => x.change), ['M', 'D'], 'la vista y un archivo de afuera no cuentan');
  assert.equal(m[0].commit, 'abc1234');
});

test('el ancla no explota si git no devuelve ni stdout ni stderr', () => {
  const sinCampos = (_cmd, args) => (args.includes('rev-parse') ? { status: 0 } : { status: 128 });
  const r = gitDiscoveryVersions('.', SLUG, sinCampos);
  assert.match(r.error ?? '', /no se puede leer la historia/u, 'sin stderr igual reporta');

  const vacio = () => ({ status: 0 });
  assert.deepEqual(gitDiscoveryVersions('.', SLUG, vacio).commits, [], 'sin stdout no inventa commits');
  assert.deepEqual(findMutations('.', SLUG, vacio), []);
});

test('main dice "borrado" y no "modificado" cuando el expediente se recortó', () => {
  const errores = [];
  const borrada = { anchored: true, error: null, commits: 2, violations: [{ commit: 'def5678', path: `docs/discovery/${SLUG}/runs/run-001/decisions/d002.json`, change: 'D' }] };
  assert.equal(main(['history', '--feature', SLUG], '.', () => {}, (m) => errores.push(m), undefined, { growth: () => borrada }), 1);
  assert.match(errores.join('\n'), /borrado en def5678/u);
});
