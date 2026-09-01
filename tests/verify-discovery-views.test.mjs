import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DiscoveryViewsError, canonicalViewBytes, listViewFiles, main, parseArgs, readTrustedView,
  renderDecision, renderDiscoveryViews, renderRunView, trustedViewsDirectory, verifyDiscoveryViews,
} from '../scripts/verify-discovery-views.mjs';

const feature = 'research-flow';
const script = fileURLToPath(new URL('../scripts/verify-discovery-views.mjs', import.meta.url));
const decisionSchema = 'vcp.discovery-decision/3';
const packetSchema = 'vcp.discovery-packet/1';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function write(path, value) { const bytes = Buffer.isBuffer(value) ? value : encode(value); writeFileSync(path, bytes); return bytes; }
function expectCode(action, code) { assert.throws(action, (error) => error?.code === code, `expected ${code}`); }
function paths(root) { const run = join(root, 'docs', 'discovery', feature, 'runs', 'run-001'); return { run, decisions: join(run, 'decisions'), packets: join(run, 'packets'), views: join(root, 'docs', 'discovery', feature, 'views') }; }
function decision(overrides = {}) {
  return {
    schema: decisionSchema, run_id: 'run-001', feature_slug: feature, decision_id: 'd001', evaluated_at: '2026-08-27', status: 'pending', transition_kind: 'initial', supersedes: null, predecessor_hash: null, previous_status: null, activation_result: 'discovery-result-v1', triggers_observed: ['scope'], correction_reason: null, skip: null, override: null, packet_ref: null, packet_sha256: null, ...overrides,
  };
}
function packet() {
  return {
    schema: packetSchema, decision_id: 'd002', research_snapshot: {
      captured_at: '2026-08-28', claims: [{
        claim_id: 'claim-001', source_id: 'source-001', locator: { kind: 'web', url: 'https://example.test/source' }, retrieved_at: '2026-08-28', content_identity: { kind: 'sha256', value: 'a'.repeat(64), unavailable_reason: null }, evidence_classification: 'SUPPORTED', evidence_summary: 'Evidence supports the scoped decision.', linked_requirement_id: null, linked_ac_id: null, trigger_ids: ['scope'],
      }, {
        claim_id: 'claim-002', source_id: 'source-002', locator: { kind: 'web', url: 'https://example.test/contradiction' }, retrieved_at: '2026-08-28', content_identity: { kind: 'sha256', value: 'b'.repeat(64), unavailable_reason: null }, evidence_classification: 'CONTRADICTED', evidence_summary: 'Evidence contradicts the scoped decision.', linked_requirement_id: null, linked_ac_id: null, trigger_ids: ['scope'],
      }],
    },
  };
}
function fixture({ skipped = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-discovery-views-'));
  const out = paths(root);
  mkdirSync(out.decisions, { recursive: true });
  mkdirSync(out.packets, { recursive: true });
  const d1 = write(join(out.decisions, 'd001.json'), decision());
  if (skipped) {
    write(join(out.decisions, 'd002.json'), decision({ decision_id: 'd002', evaluated_at: '2026-08-28', status: 'skipped', transition_kind: 'activation', supersedes: 'd001', predecessor_hash: hash(d1), previous_status: 'pending', skip: { reason: 'Scope was excluded after review.', scope_evidence: 'Evidence documents the exclusion.', decided_by: 'owner' } }));
  } else {
    const p2 = write(join(out.packets, 'd002.json'), packet());
    write(join(out.decisions, 'd002.json'), decision({ decision_id: 'd002', evaluated_at: '2026-08-28', status: 'completed', transition_kind: 'activation', supersedes: 'd001', predecessor_hash: hash(d1), previous_status: 'pending', packet_ref: 'packets/d002.json', packet_sha256: hash(p2) }));
  }
  return { root, ...out };
}
function withFixture(options, action) { const value = fixture(options); try { return action(value); } finally { rmSync(value.root, { recursive: true, force: true }); } }

test('REQ-F01 · views sólo contiene Markdown derivado', () => withFixture({}, (x) => {
  assert.deepEqual(renderDiscoveryViews(x.root, feature), { ok: true, views: 1 });
  assert.deepEqual(verifyDiscoveryViews(x.root, feature), { ok: true, views: 1 });
  writeFileSync(join(x.views, 'notes.txt'), 'unexpected');
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_UNEXPECTED_FILE');
}));

test('REQ-F02 · Los runs no contienen vistas Markdown', () => withFixture({}, (x) => {
  renderDiscoveryViews(x.root, feature);
  writeFileSync(join(x.run, 'view.md'), '# misplaced');
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_PATH_ESCAPE');
}));

test('REQ-F03 · skip y override no admiten campos extra', () => withFixture({ skipped: true }, (x) => {
  renderDiscoveryViews(x.root, feature);
  const path = join(x.decisions, 'd002.json');
  const value = JSON.parse(readFileSync(path, 'utf8'));
  value.skip.extra = 'not allowed';
  write(path, value);
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
}));

test('REQ-H01 · Las vistas usan UTF-8 sin BOM, LF y un newline final', () => withFixture({}, (x) => {
  renderDiscoveryViews(x.root, feature);
  const view = join(x.views, 'run-001.md');
  const original = readFileSync(view);
  assert.equal(canonicalViewBytes(original), true);
  write(view, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original]));
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_FORMAT_INVALID');
  write(view, Buffer.from(original.toString('utf8').replace(/\n/gu, '\r\n')));
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_FORMAT_INVALID');
  write(view, original.subarray(0, -1));
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_FORMAT_INVALID');
}));

test('REQ-H02 · Las vistas no incluyen timestamps, rutas absolutas ni entorno', () => withFixture({}, (x) => {
  renderDiscoveryViews(x.root, feature);
  const text = readFileSync(join(x.views, 'run-001.md'), 'utf8');
  assert.doesNotMatch(text, /2026-|[A-Z]:\\|\/Users\/|NODE_/u);
  assert.match(text, /^# Discovery: research-flow\n\n## run-001\n/u);
}));

test('REQ-H03 · Cada vista coincide byte a byte con su regeneración', () => withFixture({}, (x) => {
  renderDiscoveryViews(x.root, feature);
  const view = join(x.views, 'run-001.md');
  writeFileSync(view, `${readFileSync(view, 'utf8')}Cambio manual\n`);
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_STALE');
  renderDiscoveryViews(x.root, feature);
  assert.deepEqual(verifyDiscoveryViews(x.root, feature), { ok: true, views: 1 });
}));

test('FALSIFICACIÓN · render fail-closed ante directorios, formatos, archivos o writes inseguros', () => withFixture({}, (x) => {
  expectCode(() => verifyDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_MISSING');
  mkdirSync(x.views);
  writeFileSync(join(x.views, 'run-01.md'), 'bad');
  expectCode(() => renderDiscoveryViews(x.root, feature), 'DISCOVERY_VIEW_UNEXPECTED_FILE');
  expectCode(() => readTrustedView(x.root, feature, 'outside.txt'), 'DISCOVERY_VIEW_UNEXPECTED_FILE');
  expectCode(() => renderRunView('bad_slug', { runId: 'run-001', history: [] }), 'DISCOVERY_VIEW_RENDER_INVALID');
  expectCode(() => renderDecision({ decision_id: 'd001', status: 'bad' }, null), 'DISCOVERY_VIEW_RENDER_INVALID');
  assert.equal(canonicalViewBytes(Buffer.alloc(0)), false);
  assert.equal(canonicalViewBytes(Buffer.from('x\n')), true);
  assert.equal(canonicalViewBytes(Buffer.from('x\r\n')), false);
  expectCode(() => listViewFiles('missing', { readdirSync: () => { throw new Error('no'); } }), 'DISCOVERY_VIEW_PATH_INVALID');
}));

test('FALSIFICACIÓN · helpers de path clasifican symlink, tipo erróneo, escape y errores de E/S sin seguirlos', () => withFixture({}, (x) => {
  mkdirSync(x.views);
  const base = { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync };
  const viewsOnly = (stat) => (candidate) => candidate === x.views ? (typeof stat === 'function' ? stat() : stat) : lstatSync(candidate);
  expectCode(() => trustedViewsDirectory(x.root, feature, false, { ...base, lstatSync: viewsOnly({ isSymbolicLink: () => true, isDirectory: () => true }) }), 'DISCOVERY_VIEW_SYMLINK');
  expectCode(() => trustedViewsDirectory(x.root, feature, false, { ...base, lstatSync: viewsOnly({ isSymbolicLink: () => false, isDirectory: () => false }) }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => trustedViewsDirectory(x.root, feature, false, { ...base, realpathSync: (path) => path === x.views ? 'C:/outside' : realpathSync(path) }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => trustedViewsDirectory(x.root, feature, false, { ...base, realpathSync: (path) => { if (path === x.views) throw new Error('no'); return realpathSync(path); } }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => trustedViewsDirectory(x.root, feature, true, { ...base, existsSync: (path) => path === x.views ? false : existsSync(path), mkdirSync: () => { throw new Error('no'); } }), 'DISCOVERY_VIEW_WRITE_FAILED');
  expectCode(() => trustedViewsDirectory(x.root, feature, false, { ...base, lstatSync: viewsOnly(() => { throw new Error('no'); }) }), 'DISCOVERY_VIEW_MISSING');
  const view = join(x.views, 'run-001.md');
  writeFileSync(view, 'x\n');
  const fileOnly = (stat) => (candidate) => candidate === view ? (typeof stat === 'function' ? stat() : stat) : lstatSync(candidate);
  expectCode(() => readTrustedView(x.root, feature, 'run-001.md', { ...base, lstatSync: fileOnly(() => { throw new Error('no'); }) }), 'DISCOVERY_VIEW_MISSING');
  expectCode(() => readTrustedView(x.root, feature, 'run-001.md', { ...base, lstatSync: fileOnly({ isSymbolicLink: () => true, isFile: () => true }) }), 'DISCOVERY_VIEW_SYMLINK');
  expectCode(() => readTrustedView(x.root, feature, 'run-001.md', { ...base, lstatSync: fileOnly({ isSymbolicLink: () => false, isFile: () => false }) }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => readTrustedView(x.root, feature, 'run-001.md', { ...base, realpathSync: (path) => path === view ? 'C:/outside' : realpathSync(path) }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => readTrustedView(x.root, feature, 'run-001.md', { ...base, readFileSync: () => { throw new Error('no'); } }), 'DISCOVERY_VIEW_PATH_INVALID');
  expectCode(() => renderDiscoveryViews(x.root, feature, () => ({ featureSlug: feature, runs: [{ runId: 'run-001', history: [] }] }), () => { throw new Error('no'); }), 'DISCOVERY_VIEW_WRITE_FAILED');
}));

test('CLI parsea sólo check/render canónicos y comunica resultados controlados', () => {
  assert.deepEqual(parseArgs(['check', '--feature', feature]), { command: 'check', featureSlug: feature });
  assert.deepEqual(parseArgs(['render', '--feature', feature]), { command: 'render', featureSlug: feature });
  assert.equal(parseArgs(['check']), null);
  const errors = [];
  assert.equal(main(['bad'], '.', () => {}, (line) => errors.push(line)), 2);
  assert.equal(main(['check', '--feature', feature], '.', () => {}, () => {}, () => ({ ok: true, views: 1 })), 0);
  assert.equal(main(['render', '--feature', feature], '.', () => {}, () => {}, () => ({ ok: true, views: 1 }), () => { throw new DiscoveryViewsError('DISCOVERY_VIEW_WRITE_FAILED', 'no'); }), 1);
  const cli = spawnSync(process.execPath, [script, 'bad'], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /usage:/u);
});

test('FALSIFICACIÓN · un error sin código propio se reporta con el código genérico, no como undefined', () => {
  // La única prueba de este camino lanzaba un DiscoveryViewsError, que trae `code`, así que el
  // respaldo `?? DISCOVERY_VIEW_RENDER_INVALID` no lo ejecutaba ningún proceso de la suite. Medido
  // el 2026-09-01 sobre verify-discovery-views.mjs:176.
  // No es cosmético: un fallo inesperado —un permiso, un disco lleno, un bug del propio gate— llega
  // acá como Error pelado. Sin el respaldo el rechazo diría `REJECTED: undefined:` y quien lo lea
  // no tendría con qué buscarlo.
  const errores = [];
  const code = main(['render', '--feature', 'x'], '.', () => {}, (line) => errores.push(line),
    () => ({ ok: true, views: 1 }),
    () => { throw new Error('EACCES: permission denied'); });
  assert.equal(code, 1);
  assert.match(errores.at(-1), /^REJECTED: DISCOVERY_VIEW_RENDER_INVALID: EACCES: permission denied$/u);
  assert.doesNotMatch(errores.at(-1), /undefined/u);
});
