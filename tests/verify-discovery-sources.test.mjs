// Pruebas del subcomando `sources`: resolver contra el arbol real los locators que `check` sólo
// valida como string. El agujero que cierra se reprodujo el 2026-08-29 construyendo un run entero
// con fuentes inventadas -archivo inexistente, linea 99999, sha256 al azar- que salia en verde.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  SOURCE_DRIFTED,
  SOURCE_MISSING,
  SOURCE_NO_HASH,
  SOURCE_OK,
  SOURCE_OUT_OF_RANGE,
  SOURCE_WEB,
  activeClaims,
  classifySource,
  main,
  parseArgs,
  verifyDiscoverySources,
} from '../scripts/verify-discovery-core.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');

/** Un claim con locator de repo, apuntando a `path`, con la huella que se le declare. */
function claimRepo({ id = 'c1', path = 'fuente.md', line, value = null, kind = 'sha256', reason = null } = {}) {
  const locator = { kind: 'repo_file', path };
  if (line !== undefined) locator.line = line;
  return { claim_id: id, locator, content_identity: { kind, value, unavailable_reason: reason } };
}

/** Una entrada de history con la forma real: {decision, packet}. */
function conClaims(id) {
  return { decision: { decision_id: id }, packet: { research_snapshot: { claims: [claimRepo({ id })] } } };
}

function fixture(accion) {
  const raiz = mkdtempSync(join(tmpdir(), 'vcp-sources-'));
  try {
    return accion(raiz);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

function escribir(raiz, rel, contenido) {
  const destino = join(raiz, rel);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  return contenido;
}

// --- Clasificacion de una fuente ----------------------------------------------------------------

test('classifySource confirma una fuente cuyo contenido sigue siendo el declarado', () => {
  fixture((raiz) => {
    const cuerpo = escribir(raiz, 'fuente.md', 'linea uno\nlinea dos\n');
    const r = classifySource(raiz, claimRepo({ value: sha256(cuerpo), line: 2 }));
    assert.equal(r.status, SOURCE_OK, JSON.stringify(r));
    assert.equal(r.claim_id, 'c1');
  });
});

// El caso que motivo todo: un claim que cita un archivo que no existe no es evidencia, es relleno.
test('FALSIFICACIÓN · un claim que cita un archivo inexistente es rechazo', () => {
  fixture((raiz) => {
    const r = classifySource(raiz, claimRepo({ path: 'no/existe/jamas.md', value: sha256('x') }));
    assert.equal(r.status, SOURCE_MISSING, JSON.stringify(r));
  });
});

test('FALSIFICACIÓN · una línea más allá del final del archivo es rechazo', () => {
  fixture((raiz) => {
    const cuerpo = escribir(raiz, 'fuente.md', 'una sola linea\n');
    const r = classifySource(raiz, claimRepo({ value: sha256(cuerpo), line: 99999 }));
    assert.equal(r.status, SOURCE_OUT_OF_RANGE, JSON.stringify(r));
  });
});

// El contenido que cambió no es una mentira: es una fuente que envejeció. Se informa distinto.
test('un archivo que existe pero cambió desde la captura se marca como derivado, no como falso', () => {
  fixture((raiz) => {
    escribir(raiz, 'fuente.md', 'contenido nuevo\n');
    const r = classifySource(raiz, claimRepo({ value: sha256('contenido viejo\n') }));
    assert.equal(r.status, SOURCE_DRIFTED, JSON.stringify(r));
  });
});

test('lo que este gate no puede resolver se cuenta, nunca se pinta de verde', () => {
  fixture((raiz) => {
    const web = classifySource(raiz, { claim_id: 'w1', locator: { kind: 'web', url: 'https://ejemplo.test/a' }, content_identity: { kind: 'sha256', value: sha256('x'), unavailable_reason: null } });
    assert.equal(web.status, SOURCE_WEB, 'este gate nunca sale a la red');
    escribir(raiz, 'fuente.md', 'algo\n');
    for (const identidad of [{ kind: 'version_ref', value: 'v1.2.3', reason: null }, { kind: 'unavailable', value: null, reason: 'la fuente es un PDF impreso' }]) {
      const r = classifySource(raiz, claimRepo({ kind: identidad.kind, value: identidad.value, reason: identidad.reason }));
      assert.equal(r.status, SOURCE_NO_HASH, `sin huella no hay nada que comparar: ${JSON.stringify(r)}`);
    }
  });
});

// Un locator que escapa del proyecto no se resuelve: se rechaza antes de tocar el disco.
test('FALSIFICACIÓN · un locator que escapa del proyecto no se lee', () => {
  fixture((raiz) => {
    for (const malo of ['../afuera.md', '/etc/passwd', 'C:/Windows/win.ini']) {
      const r = classifySource(raiz, claimRepo({ path: malo, value: sha256('x') }));
      assert.equal(r.status, SOURCE_MISSING, `${malo} no puede resolverse: ${JSON.stringify(r)}`);
    }
  });
});

// --- Que claims se miran ------------------------------------------------------------------------

test('activeClaims toma los claims del último packet de cada run, no los de toda la historia', () => {
  // La forma es la real de readDiscoveryHistory: cada run trae `history` con {decision, packet},
  // y una decisión pending no tiene packet. Un fixture inventado acá haría que la prueba valide
  // el mock en vez del código — pasó el 2026-08-29 y lo destapó correr el gate sobre el repo real.
  const historia = {
    runs: [
      { runId: 'run-001', history: [conClaims('viejo'), conClaims('vigente')] },
      { runId: 'run-002', history: [{ decision: {}, packet: null }, conClaims('otro')] },
    ],
  };
  assert.deepEqual(activeClaims(historia).map((c) => c.claim_id), ['vigente', 'otro']);
  assert.deepEqual(activeClaims({ runs: [] }), []);
  assert.deepEqual(activeClaims({ runs: [{ runId: 'run-001', history: [] }] }), []);
  assert.deepEqual(activeClaims({ runs: [{ runId: 'run-001', history: [{ decision: {}, packet: null }] }] }), [], 'una decisión pending no aporta claims');
});

// --- El gate entero -----------------------------------------------------------------------------

test('parseArgs acepta sources con y sin --require-current, y sigue aceptando check', () => {
  assert.deepEqual(parseArgs(['check', '--feature', 'mi-feature']), { command: 'check', featureSlug: 'mi-feature', requireCurrent: false });
  assert.deepEqual(parseArgs(['sources', '--feature', 'mi-feature']), { command: 'sources', featureSlug: 'mi-feature', requireCurrent: false });
  assert.deepEqual(parseArgs(['sources', '--feature', 'mi-feature', '--require-current']), { command: 'sources', featureSlug: 'mi-feature', requireCurrent: true });
  for (const malo of [[], ['sources'], ['sources', '--feature'], ['check', '--feature', 'MAL SLUG'], ['check', '--feature', 'x', '--require-current']]) {
    assert.equal(parseArgs(malo), null, `no debería aceptar ${JSON.stringify(malo)}`);
  }
});

test('verifyDiscoverySources cuenta cada estado y sólo falla por fuentes irresolubles', () => {
  fixture((raiz) => {
    const cuerpo = escribir(raiz, 'buena.md', 'contenido\n');
    const claims = [
      claimRepo({ id: 'ok', path: 'buena.md', value: sha256(cuerpo) }),
      claimRepo({ id: 'derivada', path: 'buena.md', value: sha256('otra cosa') }),
    ];
    const historia = { runs: [{ runId: 'run-001', history: [{ decision: {}, packet: { research_snapshot: { claims } } }] }] };
    const r = verifyDiscoverySources(raiz, 'f', { history: () => historia });
    assert.equal(r.counts[SOURCE_OK], 1);
    assert.equal(r.counts[SOURCE_DRIFTED], 1);
    assert.equal(r.blocking.length, 0, 'una fuente que cambió no bloquea');

    const conFalsa = { runs: [{ runId: 'run-001', history: [{ decision: {}, packet: { research_snapshot: { claims: [...claims, claimRepo({ id: 'falsa', path: 'inventada.md', value: sha256('x') })] } } }] }] };
    const r2 = verifyDiscoverySources(raiz, 'f', { history: () => conFalsa });
    assert.equal(r2.blocking.length, 1);
    assert.equal(r2.blocking[0].claim_id, 'falsa');
  });
});

test('con --require-current una fuente que cambió también bloquea', () => {
  fixture((raiz) => {
    escribir(raiz, 'buena.md', 'contenido\n');
    const historia = { runs: [{ runId: 'run-001', history: [{ decision: {}, packet: { research_snapshot: { claims: [claimRepo({ id: 'derivada', path: 'buena.md', value: sha256('vieja') })] } } }] }] };
    const flojo = verifyDiscoverySources(raiz, 'f', { history: () => historia });
    assert.equal(flojo.blocking.length, 0);
    const estricto = verifyDiscoverySources(raiz, 'f', { history: () => historia, requireCurrent: true });
    assert.equal(estricto.blocking.length, 1, 'con --require-current el drift bloquea');
  });
});

// Sin Discovery no hay nada que resolver, y eso se escribe distinto de un verde.
test('sin claims que resolver el resultado es vacío, no un OK', () => {
  fixture((raiz) => {
    const r = verifyDiscoverySources(raiz, 'f', { history: () => ({ runs: [] }) });
    assert.equal(r.empty, true);
    assert.equal(r.blocking.length, 0);
  });
});

// --- El CLI ---------------------------------------------------------------------------------------

test('main informa las tres salidas de sources: vacío, rechazo y verde', () => {
  const vacio = [];
  assert.equal(main(['sources', '--feature', 'f'], '.', (m) => vacio.push(m), () => {}, undefined, { sources: () => ({ empty: true, blocking: [], counts: {} }) }), 0);
  assert.match(vacio.join('\n'), /^VACÍO:/u, 'sin claims no es un OK');

  const errores = [];
  const conFalsa = { empty: false, blocking: [{ claim_id: 'falsa', detail: 'inventada.md: el archivo citado no existe' }], counts: {} };
  assert.equal(main(['sources', '--feature', 'f'], '.', () => {}, (m) => errores.push(m), undefined, { sources: () => conFalsa }), 1);
  assert.match(errores.join('\n'), /DISCOVERY_SOURCE_UNRESOLVABLE/u);
  assert.match(errores.join('\n'), /falsa: inventada\.md/u, 'nombra el claim y la fuente');

  const salidas = [];
  const sano = { empty: false, blocking: [], counts: { [SOURCE_OK]: 2, [SOURCE_DRIFTED]: 1, [SOURCE_WEB]: 1, [SOURCE_NO_HASH]: 0 } };
  assert.equal(main(['sources', '--feature', 'f'], '.', (m) => salidas.push(m), () => {}, undefined, { sources: () => sano }), 0);
  assert.match(salidas.join('\n'), /2 fuente\(s\).*1 cambiaron.*1 web/su);
  assert.match(salidas.join('\n'), /no sale a la red/u, 'el límite viaja en la salida');
});

// Un archivo que resuelve pero no se puede leer no es una fuente verificada: falla cerrado.
test('FALSIFICACIÓN · un archivo ilegible se reporta ausente, nunca verificado', () => {
  fixture((raiz) => {
    escribir(raiz, 'fuente.md', 'algo\n');
    const r = classifySource(raiz, claimRepo({ value: sha256('algo\n') }), () => { throw new Error('EACCES'); });
    assert.equal(r.status, SOURCE_MISSING, JSON.stringify(r));
  });
});

test('activeClaims tolera un run sin history y un packet sin research_snapshot', () => {
  assert.deepEqual(activeClaims({}), [], 'sin runs no explota');
  assert.deepEqual(activeClaims({ runs: [{ runId: 'run-001' }] }), [], 'un run sin history tampoco');
  assert.deepEqual(activeClaims({ runs: [{ runId: 'run-001', history: [{ decision: {}, packet: {} }] }] }), [], 'un packet sin research_snapshot no aporta claims');
});

test('verifyDiscoverySources lee la historia real del repositorio cuando no se le pasa una', () => {
  const r = verifyDiscoverySources(repoRoot, 'integridad-verificable');
  assert.equal(r.empty, false, 'este repositorio tiene claims vigentes');
  assert.equal(r.blocking.length, 0, `las fuentes reales resuelven: ${JSON.stringify(r.blocking)}`);
  assert.ok(r.counts[SOURCE_DRIFTED] > 0, 'y varias cambiaron desde su captura, que es lo esperado');
});

test('main resuelve las fuentes reales cuando no se le inyecta el verificador', () => {
  const salidas = [];
  assert.equal(main(['sources', '--feature', 'integridad-verificable'], repoRoot, (m) => salidas.push(m), () => {}), 0, salidas.join('\n'));
  assert.match(salidas.join('\n'), /^OK:/u);
});
