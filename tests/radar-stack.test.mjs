import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { compararVersiones, esPrerelease, elegirEstable, versionesNpm, versionesPypi, consultar, main } from '../scripts/radar-stack.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'radar-stack.mjs');
const AHORA = new Date('2026-11-10T12:00:00Z');

test('radar · esPrerelease reconoce alpha, beta, rc, dev, canary, next y formas pypi', () => {
  for (const v of ['1.0.0-alpha.1', '2.0.0-beta', '3.0.0-rc.2', '1.2.3-dev.4', '19.0.0-canary-abc', '15.0.0-next.1', '1.0a1', '2.0b3', '3.0rc1', '1.0.dev2']) {
    assert.equal(esPrerelease(v), true, v);
  }
  for (const v of ['1.0.0', '2.31.0', '0.5.1', '1.0.post1']) assert.equal(esPrerelease(v), false, v);
});

test('radar · compararVersiones ordena numéricamente', () => {
  assert.ok(compararVersiones('1.10.0', '1.9.9') > 0);
  assert.ok(compararVersiones('2.0.0', '10.0.0') < 0);
  assert.equal(compararVersiones('1.2.3', '1.2.3'), 0);
  assert.ok(compararVersiones('1.2', '1.2.1') < 0);
});

test('radar · elegirEstable descarta prereleases, recientes y yanked', () => {
  const v = [
    { version: '1.0.0', fecha: '2026-01-01T00:00:00Z' },
    { version: '1.1.0', fecha: '2026-06-01T00:00:00Z' },
    { version: '2.0.0-rc.1', fecha: '2026-07-01T00:00:00Z' },
    { version: '1.2.0', fecha: '2026-11-05T00:00:00Z' },
    { version: '1.1.5', fecha: '2026-06-02T00:00:00Z', retirada: true },
  ];
  assert.equal(elegirEstable(v, { ahora: AHORA }).version, '1.1.0');
  assert.equal(elegirEstable(v, { ahora: AHORA, diasMinimos: 3 }).version, '1.2.0');
  assert.equal(elegirEstable(v, { ahora: AHORA, diasMinimos: 0 }).version, '1.2.0');
  assert.equal(elegirEstable([], { ahora: AHORA }), null);
  assert.equal(elegirEstable([{ version: '1.0.0-beta', fecha: '2026-01-01T00:00:00Z' }], { ahora: AHORA }), null);
  assert.equal(elegirEstable([{ version: '1.0.0', fecha: 'no-es-fecha' }], { ahora: AHORA }), null);
});

test('radar · adaptadores de npm y pypi con fixtures', () => {
  const npm = { time: { created: '2020-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z', '1.0.0': '2026-01-01T00:00:00Z', '1.1.0-beta.1': '2026-02-01T00:00:00Z' }, versions: { '1.0.0': {}, '1.1.0-beta.1': { deprecated: 'x' } } };
  assert.deepEqual(versionesNpm(npm).map((x) => x.version), ['1.0.0', '1.1.0-beta.1']);
  assert.equal(versionesNpm(npm)[1].retirada, true);
  const pypi = { releases: { '2.0.0': [{ upload_time_iso_8601: '2026-03-01T00:00:00Z', yanked: false }], '2.1.0': [{ upload_time_iso_8601: '2026-04-01T00:00:00Z', yanked: true }], '2.2.0': [] } };
  const p = versionesPypi(pypi);
  assert.deepEqual(p.map((x) => x.version), ['2.0.0', '2.1.0']);
  assert.equal(p[1].retirada, true);
});

test('radar · consultar usa el fetch inyectado y nunca inventa versión', async () => {
  const pedidos = [];
  const fetchJson = async (url) => {
    pedidos.push(url);
    if (url.includes('registry.npmjs.org')) return { time: { '1.0.0': '2026-01-01T00:00:00Z' }, versions: { '1.0.0': {} } };
    if (url.includes('pypi.org')) return { releases: { '0.9.0': [{ upload_time_iso_8601: '2026-02-01T00:00:00Z' }] } };
    throw new Error('sin red');
  };
  const r = await consultar(['npm:paquete-demo', 'pypi:paquete-demo'], { fetchJson, ahora: AHORA });
  assert.deepEqual(r.map((x) => x.version), ['1.0.0', '0.9.0']);
  assert.ok(pedidos.includes('https://registry.npmjs.org/paquete-demo'));
  assert.ok(pedidos.includes('https://pypi.org/pypi/paquete-demo/json'));
  const caido = await consultar(['npm:otro'], { fetchJson: async () => { throw new Error('ECONNREFUSED'); }, ahora: AHORA });
  assert.equal(caido[0].version, null);
  assert.match(caido[0].error, /ECONNREFUSED/);
});

test('radar · main: salida, --json, error de red = sin dato y exit 1', async () => {
  const fetchJson = async () => ({ time: { '3.1.4': '2026-01-01T15:00:00Z' }, versions: { '3.1.4': {} } });
  const out = [];
  const err = [];
  const io = { fetchJson, ahora: AHORA, write: (s) => out.push(s), writeError: (s) => err.push(s) };
  assert.equal(await main(['npm:paquete-demo'], io), 0);
  assert.match(out.join('\n'), /npm:paquete-demo 3\.1\.4 \(01-01-2026\)/);
  out.length = 0;
  assert.equal(await main(['--json', 'npm:paquete-demo'], io), 0);
  assert.deepEqual(JSON.parse(out.join('\n'))[0].version, '3.1.4');
  out.length = 0;
  assert.equal(await main(['npm:x'], { ...io, fetchJson: async () => { throw new Error('sin red'); } }), 1);
  assert.match(out.join('\n') + err.join('\n'), /sin dato/);
  assert.equal(await main(['--dias-minimos', '9999', 'npm:paquete-demo'], io), 1);
});

test('radar · main: uso incorrecto da 2', async () => {
  const io = { fetchJson: async () => ({}), write() {}, writeError() {} };
  assert.equal(await main([], io), 2);
  assert.equal(await main(['paquete-sin-prefijo'], io), 2);
  assert.equal(await main(['gem:algo'], io), 2);
  assert.equal(await main(['npm:../etc'], io), 2);
  assert.equal(await main(['--dias-minimos', 'x', 'npm:a'], io), 2);
  assert.equal(await main(['--zzz', 'npm:a'], io), 2);
});

test('radar · CLI sin argumentos sale 2 (sin tocar la red)', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env });
  assert.equal(r.status, 2);
});
