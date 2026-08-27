import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DECISION_SCHEMA, PACKET_SCHEMA, DiscoveryCoreError, assertTrustedDirectory, assertTrustedRegularFile, main, parseArgs, readPacket, runDirectoryEntries, verifyDiscoveryFeature } from '../scripts/verify-discovery-core.mjs';

const feature = 'research-flow';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
function write(path, value) { const bytes = Buffer.isBuffer(value) ? value : json(value); writeFileSync(path, bytes); return bytes; }
function expectCode(action, code) { assert.throws(action, (error) => error instanceof DiscoveryCoreError && error.code === code, `expected ${code}`); }

function d(overrides = {}) {
  return { schema: DECISION_SCHEMA, run_id: 'run-001', feature_slug: feature, decision_id: 'd001', evaluated_at: '2026-08-27', status: 'pending', transition_kind: 'initial', supersedes: null, predecessor_hash: null, previous_status: null, activation_result: 'discovery-result-v1', triggers_observed: ['scope'], correction_reason: null, skip: null, override: null, packet_ref: null, packet_sha256: null, ...overrides };
}
function c(overrides = {}) {
  return { claim_id: 'claim-001', source_id: 'source-001', locator: { kind: 'web', url: 'https://example.test/source' }, retrieved_at: '2026-08-27', content_identity: { kind: 'sha256', value: 'a'.repeat(64), unavailable_reason: null }, evidence_classification: 'SUPPORTED', evidence_summary: 'Evidence supports the scoped decision.', linked_requirement_id: null, linked_ac_id: null, trigger_ids: ['scope'], ...overrides };
}
function p(id, claims = [c()]) { return { schema: PACKET_SCHEMA, decision_id: id, research_snapshot: { captured_at: '2026-08-27', claims } }; }
function loc(root, runId = 'run-001') { const run = join(root, 'docs', 'discovery', feature, 'runs', runId); return { run, decisions: join(run, 'decisions'), packets: join(run, 'packets') }; }

function createRun(root, runId = 'run-001', options = {}) {
  const { completed = true, correction = false, newTrigger = false } = options;
  const out = loc(root, runId); mkdirSync(out.decisions, { recursive: true }); mkdirSync(out.packets, { recursive: true });
  const d1Path = join(out.decisions, 'd001.json'); const d1Bytes = write(d1Path, d({ run_id: runId }));
  if (!completed) return { ...out, d1Path };
  const p2Path = join(out.packets, 'd002.json'); const p2Bytes = write(p2Path, p('d002'));
  const d2Path = join(out.decisions, 'd002.json'); const d2Bytes = write(d2Path, d({ run_id: runId, decision_id: 'd002', evaluated_at: '2026-08-28', status: 'completed', transition_kind: 'activation', supersedes: 'd001', predecessor_hash: hash(d1Bytes), previous_status: 'pending', packet_ref: 'packets/d002.json', packet_sha256: hash(p2Bytes) }));
  if (!correction) return { ...out, d1Path, d2Path, p2Path };
  const claims = newTrigger ? [c(), c({ claim_id: 'claim-002', source_id: 'source-002', trigger_ids: ['new-trigger'] })] : [c()];
  const p3Path = join(out.packets, 'd003.json'); const p3Bytes = write(p3Path, p('d003', claims));
  const d3Path = join(out.decisions, 'd003.json'); write(d3Path, d({ run_id: runId, decision_id: 'd003', evaluated_at: '2026-08-29', status: 'completed', transition_kind: 'correction', supersedes: 'd002', predecessor_hash: hash(d2Bytes), previous_status: 'completed', triggers_observed: newTrigger ? ['scope', 'new-trigger'] : ['scope'], correction_reason: 'Corrected the research evidence scope.', packet_ref: 'packets/d003.json', packet_sha256: hash(p3Bytes) }));
  return { ...out, d1Path, d2Path, d3Path, p2Path, p3Path };
}
function fixture(options = {}) { const root = mkdtempSync(join(tmpdir(), 'vcp-discovery-core-')); return { root, ...createRun(root, 'run-001', options) }; }
function withFixture(options, action) { const value = fixture(options); try { return action(value); } finally { rmSync(value.root, { recursive: true, force: true }); } }
function verify(value) { return verifyDiscoveryFeature(value.root, feature); }
function rewriteDecision(path, mutate) { const value = read(path); mutate(value); return write(path, value); }
function rewritePacket(decisionPath, packetPath, mutate) { const value = read(packetPath); mutate(value); const bytes = write(packetPath, value); rewriteDecision(decisionPath, (item) => { item.packet_sha256 = hash(bytes); }); }
function symlinkAt(path) { return { lstatSync: (candidate) => candidate === path ? { isSymbolicLink: () => true } : lstatSync(candidate), realpathSync }; }

test('REQ-A01 · d001 inicia el run como raíz pending e initial', () => withFixture({}, (x) => assert.deepEqual(verify(x), { ok: true, runs: 1 })));
test('REQ-A02 · d001 no puede superseder otra decisión', () => withFixture({}, (x) => { rewriteDecision(x.d1Path, (v) => { v.supersedes = 'd000'; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A03 · El nombre del archivo de decisión coincide con decision_id', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.decision_id = 'd003'; }); expectCode(() => verify(x), 'DISCOVERY_DECISION_ID_MISMATCH'); }));
test('REQ-A04 · Los decision_id son contiguos dentro de un run', () => withFixture({}, (x) => { const moved = join(x.decisions, 'd003.json'); renameSync(x.d2Path, moved); rewriteDecision(moved, (v) => { v.decision_id = 'd003'; }); expectCode(() => verify(x), 'DISCOVERY_DECISION_ID_GAP'); }));
test('REQ-A05 · supersedes referencia una decisión existente', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.supersedes = 'd099'; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A06 · Cada decisión supersede exactamente a su predecesora', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.supersedes = 'd001'; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A07 · La cadena de decisiones no se bifurca', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.supersedes = 'd001'; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A08 · Cada run tiene una única raíz', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.supersedes = null; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A09 · La cadena de decisiones no contiene ciclos', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d2Path, (v) => { v.supersedes = 'd003'; }); expectCode(() => verify(x), 'DISCOVERY_CHAIN_NONLINEAR'); }));
test('REQ-A10 · predecessor_hash coincide con los bytes del predecesor', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.predecessor_hash = 'b'.repeat(64); }); expectCode(() => verify(x), 'DISCOVERY_PREDECESSOR_HASH_MISMATCH'); }));
test('REQ-A11 · evaluated_at nunca decrece en la cadena', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.evaluated_at = '2026-08-26'; }); expectCode(() => verify(x), 'DISCOVERY_DATE_NON_MONOTONIC'); }));
test('REQ-A12 · previous_status coincide con el estado real del predecesor', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.previous_status = 'completed'; }); expectCode(() => verify(x), 'DISCOVERY_PREVIOUS_STATUS_MISMATCH'); }));
test('REQ-A13 · activation sólo parte de pending', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.transition_kind = 'activation'; v.correction_reason = null; }); expectCode(() => verify(x), 'DISCOVERY_TRANSITION_INVALID'); }));
test('REQ-A14 · correction conserva el mismo estado terminal', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.status = 'skipped'; v.packet_ref = null; v.packet_sha256 = null; v.skip = { reason: 'Skip after a full reviewed scope.', scope_evidence: 'Evidence documents the excluded scope.', decided_by: 'owner' }; }); expectCode(() => verify(x), 'DISCOVERY_TRANSITION_INVALID'); }));
test('REQ-A15 · Una decisión terminal no regresa a pending', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.status = 'pending'; v.packet_ref = null; v.packet_sha256 = null; }); expectCode(() => verify(x), 'DISCOVERY_TRANSITION_INVALID'); }));
test('REQ-A16 · correction exige un motivo explícito', () => withFixture({ correction: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.correction_reason = 'TBD'; }); expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE'); }));

test('REQ-B01 · run_id es inmutable dentro de un run', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.run_id = 'run-009'; }); expectCode(() => verify(x), 'DISCOVERY_IMMUTABLE_FIELD_CHANGED'); }));
test('REQ-B02 · feature_slug es inmutable dentro de un run', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.feature_slug = 'other-flow'; }); expectCode(() => verify(x), 'DISCOVERY_IMMUTABLE_FIELD_CHANGED'); }));
test('REQ-B03 · activation_result es inmutable dentro de un run', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.activation_result = 'different-result'; }); expectCode(() => verify(x), 'DISCOVERY_IMMUTABLE_FIELD_CHANGED'); }));
test('REQ-B04 · El schema de decisión es consistente dentro de un run', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.schema = 'vcp.discovery-decision/2'; }); expectCode(() => verify(x), 'DISCOVERY_SCHEMA_INVALID'); }));
test('REQ-C01 · triggers_observed no contiene duplicados', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.triggers_observed = ['scope', 'scope']; }); expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE'); }));
test('REQ-C02 · activation conserva exactamente los triggers observados', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.triggers_observed = ['scope', 'extra']; }); expectCode(() => verify(x), 'DISCOVERY_TRANSITION_INVALID'); }));
test('REQ-C03 · correction no elimina triggers previos', () => withFixture({ correction: true, newTrigger: true }, (x) => { rewriteDecision(x.d3Path, (v) => { v.triggers_observed = ['new-trigger']; }); expectCode(() => verify(x), 'DISCOVERY_TRIGGERS_NOT_SUPERSET'); }));
test('REQ-C04 · correction puede agregar triggers conservando los previos', () => withFixture({ correction: true, newTrigger: true }, (x) => assert.deepEqual(verify(x), { ok: true, runs: 1 })));

test('REQ-D01 · Los estados no completed no declaran packet', () => withFixture({ completed: false }, (x) => { rewriteDecision(x.d1Path, (v) => { v.packet_ref = 'packets/d001.json'; v.packet_sha256 = 'a'.repeat(64); }); expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE'); }));
test('REQ-D02 · packet_ref usa una ruta canónica interna', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.packet_ref = '../outside.json'; }); expectCode(() => verify(x), 'DISCOVERY_PACKET_PATH_INVALID'); }));
test('REQ-D03 · El packet usa el decision_id de su decisión', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.packet_ref = 'packets/d001.json'; }); expectCode(() => verify(x), 'DISCOVERY_PACKET_PATH_INVALID'); }));
test('REQ-D04 · Un packet final es un archivo regular, no symlink', () => withFixture({}, (x) => expectCode(() => assertTrustedRegularFile(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'packets', 'd002.json'], 'DISCOVERY_PACKET_SYMLINK', symlinkAt(x.p2Path)), 'DISCOVERY_PACKET_SYMLINK')));
test('REQ-D05 · El directorio packets no es symlink', () => withFixture({}, (x) => expectCode(() => assertTrustedDirectory(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'packets'], 'DISCOVERY_PACKET_SYMLINK', symlinkAt(x.packets)), 'DISCOVERY_PACKET_SYMLINK')));
test('REQ-D06 · Los ancestros del árbol Discovery respetan la política de symlink', () => withFixture({}, (x) => expectCode(() => assertTrustedDirectory(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'decisions'], 'DISCOVERY_DECISION_SYMLINK', symlinkAt(x.decisions)), 'DISCOVERY_DECISION_SYMLINK')));
test('REQ-D07 · packet_sha256 coincide con los bytes del packet', () => withFixture({}, (x) => { writeFileSync(x.p2Path, `${readFileSync(x.p2Path, 'utf8')} `); expectCode(() => verify(x), 'DISCOVERY_PACKET_HASH_MISMATCH'); }));
test('REQ-D08 · Cada packet satisface su schema propio', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.schema = 'wrong'; }); expectCode(() => verify(x), 'DISCOVERY_PACKET_INVALID_SCHEMA'); }));
test('REQ-D09 · completed exige un packet presente', () => withFixture({}, (x) => { unlinkSync(x.p2Path); expectCode(() => verify(x), 'DISCOVERY_PACKET_MISSING'); }));
test('REQ-D10 · No existen packets huérfanos', () => withFixture({}, (x) => { write(join(x.packets, 'd003.json'), p('d003')); expectCode(() => verify(x), 'DISCOVERY_PACKET_UNREFERENCED'); }));
test('REQ-D11 · No existen archivos desconocidos en packets', () => withFixture({}, (x) => { writeFileSync(join(x.packets, 'notes.txt'), 'unexpected'); expectCode(() => verify(x), 'DISCOVERY_PACKET_UNREFERENCED'); }));
test('REQ-D12 · No existen decisiones fuera del nombre canónico', () => withFixture({}, (x) => { writeFileSync(join(x.decisions, 'd002-old.json'), '{}'); expectCode(() => verify(x), 'DISCOVERY_PATH_ESCAPE'); }));

test('FALSIFICACIÓN · un packet symlink roto conserva prioridad sobre el error de ausencia', () => withFixture({}, (x) => {
  const decision = read(x.d2Path);
  const brokenSymlink = () => { throw new DiscoveryCoreError('DISCOVERY_PACKET_SYMLINK', 'packet is a symlink'); };
  expectCode(() => readPacket(x.root, 'run-001', decision, null, brokenSymlink), 'DISCOVERY_PACKET_SYMLINK');
  unlinkSync(x.p2Path);
  const missingPath = () => { throw new DiscoveryCoreError('DISCOVERY_PATH_ESCAPE', 'missing packet'); };
  expectCode(() => readPacket(x.root, 'run-001', decision, null, missingPath), 'DISCOVERY_PACKET_MISSING');
}));

test('REQ-E01 · Existe a lo sumo un run con hoja pending', () => withFixture({ completed: false }, (x) => { createRun(x.root, 'run-002', { completed: false }); expectCode(() => verify(x), 'DISCOVERY_RUN_MULTIPLE_PENDING'); }));
test('REQ-E02 · Un run nuevo requiere que los anteriores sean terminales', () => withFixture({ completed: false }, (x) => { createRun(x.root, 'run-002', { completed: false }); expectCode(() => verify(x), 'DISCOVERY_RUN_MULTIPLE_PENDING'); }));
test('REQ-E03 · Un run terminal puede preceder a uno pending', () => withFixture({}, (x) => { createRun(x.root, 'run-002', { completed: false }); assert.deepEqual(verify(x), { ok: true, runs: 2 }); }));
test('REQ-E04 · Los run_id son contiguos', () => withFixture({}, (x) => { createRun(x.root, 'run-003', { completed: false }); expectCode(() => verify(x), 'DISCOVERY_RUN_ID_GAP'); }));
test('REQ-E05 · El directorio del run coincide con run_id interno', () => withFixture({}, (x) => { rewriteDecision(x.d2Path, (v) => { v.run_id = 'run-002'; }); expectCode(() => verify(x), 'DISCOVERY_IMMUTABLE_FIELD_CHANGED'); }));
test('REQ-E06 · runs sólo contiene la estructura autorizada', () => withFixture({}, (x) => { writeFileSync(join(x.run, 'notes.txt'), 'unexpected'); expectCode(() => verify(x), 'DISCOVERY_PATH_ESCAPE'); }));

test('REQ-G01 · Un snapshot completed tiene claims no vacíos', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims = []; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_EMPTY'); }));
test('REQ-G02 · claim_id es único dentro de un snapshot', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims.push(c()); }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID'); }));
test('REQ-G03 · content_identity usa una sola rama válida', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity.unavailable_reason = 'not applicable today'; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID'); }));
test('REQ-G04 · evidence_summary es explicativa y no placeholder', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].evidence_summary = 'TBD'; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID'); }));
test('REQ-G05 · Un packet histórico no relee el ledger mutable', () => withFixture({}, (x) => { write(join(x.root, 'docs', 'discovery', feature, 'research-ledger.json'), { mutable: 'changed after completion' }); assert.deepEqual(verify(x), { ok: true, runs: 1 }); }));
test('REQ-G06 · Una correction completed conserva los claims previos', () => withFixture({ correction: true }, (x) => { rewritePacket(x.d3Path, x.p3Path, (v) => { v.research_snapshot.claims = [c({ claim_id: 'claim-002' })]; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_REGRESSION'); }));
test('REQ-G07 · Un trigger nuevo en correction exige un claim nuevo', () => withFixture({ correction: true, newTrigger: true }, (x) => { rewritePacket(x.d3Path, x.p3Path, (v) => { v.research_snapshot.claims = [c({ trigger_ids: ['scope', 'new-trigger'] })]; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_TRIGGER_UNSUPPORTED'); }));
test('REQ-G08 · trigger_ids no contiene duplicados', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].trigger_ids = ['scope', 'scope']; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID'); }));
test('REQ-G09 · Cada trigger_id pertenece a la decisión', () => withFixture({}, (x) => { rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].trigger_ids = ['outside']; }); expectCode(() => verify(x), 'DISCOVERY_TRIGGER_ID_UNKNOWN'); }));
test('REQ-G10 · Cada trigger observado tiene al menos un claim', () => withFixture({ correction: true, newTrigger: true }, (x) => { rewritePacket(x.d3Path, x.p3Path, (v) => { v.research_snapshot.claims[1].trigger_ids = ['scope']; }); expectCode(() => verify(x), 'DISCOVERY_TRIGGER_UNCOVERED'); }));
test('REQ-G11 · Un trigger agregado se cubre con un claim nuevo', () => withFixture({ correction: true, newTrigger: true }, (x) => { rewritePacket(x.d3Path, x.p3Path, (v) => { v.research_snapshot.claims = [c({ trigger_ids: ['scope', 'new-trigger'] })]; }); expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_TRIGGER_UNSUPPORTED'); }));

test('REQ-G12 · El locator de evidencia rechaza credenciales, esquemas y paths inseguros', () => withFixture({}, (x) => {
  const unsafe = [
    { kind: 'web', url: 'https://user:secret@example.test/source' },
    { kind: 'web', url: 'https://user@example.test/source' },
    { kind: 'web', url: 'http://example.test/source' },
    { kind: 'web', url: 'file:///etc/passwd' },
    { kind: 'web', url: 'example.test/source' },
    { kind: 'web', url: 'https://example.test/so\u0001urce' },
    { kind: 'repo_file', path: '../outside.md' },
    { kind: 'repo_file', path: '/etc/passwd' },
    { kind: 'repo_file', path: 'C:/Windows/system.ini' },
    { kind: 'repo_file', path: 'research/so\u0000urce.md' },
  ];
  for (const locator of unsafe) {
    rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = locator; });
    expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  }
  for (const locator of [{ kind: 'web', url: 'https://example.test/source?q=1#frag' }, { kind: 'repo_file', path: 'research/source.md' }]) {
    rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = locator; });
    assert.deepEqual(verify(x), { ok: true, runs: 1 });
  }
}));

test('REQ-G13 · Un locator repo_file admite una línea entera positiva y rechaza toda otra forma', () => withFixture({}, (x) => {
  // Found by running Discovery for real: without a `line` field the only way to record a line was
  // to bury it in the path ("SKILL.md#L693"), which the path rules then had to treat as a filename.
  for (const locator of [{ kind: 'repo_file', path: 'research/source.md', line: 1 }, { kind: 'repo_file', path: 'research/source.md', line: 693 }]) {
    rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = locator; });
    assert.deepEqual(verify(x), { ok: true, runs: 1 });
  }
  const invalid = [
    { kind: 'repo_file', path: 'research/source.md', line: 0 },
    { kind: 'repo_file', path: 'research/source.md', line: -3 },
    { kind: 'repo_file', path: 'research/source.md', line: 1.5 },
    { kind: 'repo_file', path: 'research/source.md', line: '12' },
    { kind: 'repo_file', path: 'research/source.md', line: null },
    { kind: 'web', url: 'https://example.test/source', line: 12 },
  ];
  for (const locator of invalid) {
    rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = locator; });
    expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  }
}));

test('core CLI rejects malformed use and reports a valid feature', () => withFixture({}, (x) => { assert.equal(parseArgs(['check', '--feature', feature]).featureSlug, feature); assert.equal(parseArgs(['check']), null); const errors = []; assert.equal(main(['check'], x.root, () => {}, (line) => errors.push(line)), 2); assert.equal(main(['check', '--feature', feature], x.root, () => {}, (line) => errors.push(line)), 0); }));

test('FALSIFICACIÓN · core rejects malformed paths, unreadable nodes and invalid JSON without falling back', () => withFixture({}, (x) => {
  expectCode(() => assertTrustedDirectory(x.root, ['..']), 'DISCOVERY_PATH_ESCAPE');
  expectCode(() => assertTrustedRegularFile(x.root, []), 'DISCOVERY_PATH_ESCAPE');
  expectCode(() => assertTrustedRegularFile(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'packets', '..']), 'DISCOVERY_PATH_ESCAPE');
  expectCode(() => assertTrustedDirectory(x.root, ['missing']), 'DISCOVERY_PATH_ESCAPE');
  expectCode(() => assertTrustedDirectory(x.root, ['docs'], 'DISCOVERY_DECISION_SYMLINK', { lstatSync, realpathSync: () => { throw new Error('no realpath'); } }), 'DISCOVERY_PATH_ESCAPE');
  writeFileSync(x.d2Path, '{');
  expectCode(() => verify(x), 'DISCOVERY_SCHEMA_INVALID');
}));

test('FALSIFICACIÓN · terminal payload branches require exact complete skip and override shapes', () => withFixture({}, (x) => {
  rewriteDecision(x.d2Path, (v) => { v.status = 'skipped'; v.packet_ref = null; v.packet_sha256 = null; v.skip = { reason: 'Skip after a full reviewed scope.', scope_evidence: 'Evidence documents the excluded scope.', decided_by: 'owner' }; });
  unlinkSync(x.p2Path);
  assert.deepEqual(verify(x), { ok: true, runs: 1 });
  rewriteDecision(x.d2Path, (v) => { v.skip.extra = 'no'; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
}));

test('FALSIFICACIÓN · override and decision/schema alternatives are validated without loose defaults', () => withFixture({}, (x) => {
  rewriteDecision(x.d2Path, (v) => { v.status = 'overridden'; v.packet_ref = null; v.packet_sha256 = null; v.override = { override_reason: 'Risk accepted after a full review.', risk_accepted_by: 'owner', decision_date: '2026-08-28', scope_evidence: 'Evidence documents the accepted scope.' }; });
  unlinkSync(x.p2Path);
  assert.deepEqual(verify(x), { ok: true, runs: 1 });
  rewriteDecision(x.d2Path, (v) => { v.override.override_reason = 'TBD'; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
}));

test('FALSIFICACIÓN · snapshot accepts all declared identity branches and rejects unknown locator/identity fields', () => withFixture({}, (x) => {
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity = { kind: 'version_ref', value: 'release-2026-08', unavailable_reason: null }; v.research_snapshot.claims[0].locator = { kind: 'repo_file', path: 'research/source.md' }; });
  assert.deepEqual(verify(x), { ok: true, runs: 1 });
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity = { kind: 'unavailable', value: null, unavailable_reason: 'Remote source no longer provides a stable version.' }; });
  assert.deepEqual(verify(x), { ok: true, runs: 1 });
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity.kind = 'magic'; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
}));

test('FALSIFICACIÓN · CLI reports verifier errors with controlled status', () => withFixture({}, (x) => {
  const errors = [];
  assert.equal(main(['check', '--feature', 'missing-flow'], x.root, () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /DISCOVERY_PATH_ESCAPE/u);
}));

test('FALSIFICACIÓN · decision payload and transition forms have no permissive fallback', () => withFixture({}, (x) => {
  rewriteDecision(x.d2Path, (v) => { v.packet_sha256 = null; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  rewriteDecision(x.d2Path, (v) => { v.packet_sha256 = 'a'.repeat(64); v.correction_reason = 'Unexpected correction text.'; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  rewriteDecision(x.d2Path, (v) => { v.correction_reason = null; v.transition_kind = 'initial'; });
  expectCode(() => verify(x), 'DISCOVERY_TRANSITION_INVALID');
  rewriteDecision(x.d1Path, (v) => { v.activation_result = ''; });
  expectCode(() => verify(x), 'DISCOVERY_SCHEMA_INVALID');
}));

test('FALSIFICACIÓN · root role and directory reads fail closed', () => withFixture({}, (x) => {
  rewriteDecision(x.d1Path, (v) => { v.transition_kind = 'activation'; });
  expectCode(() => verify(x), 'DISCOVERY_SCHEMA_INVALID');
  expectCode(() => runDirectoryEntries(join(x.root, 'not-here')), 'DISCOVERY_PATH_ESCAPE');
}));

test('FALSIFICACIÓN · trusted path helpers reject wrong node types and physical escapes', () => withFixture({}, (x) => {
  expectCode(() => assertTrustedDirectory(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'decisions', 'd001.json']), 'DISCOVERY_PATH_ESCAPE');
  expectCode(() => assertTrustedRegularFile(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'decisions']), 'DISCOVERY_PATH_ESCAPE');
  const outsideDirectory = { lstatSync, realpathSync: (candidate) => candidate.endsWith('docs') ? 'C:/outside' : realpathSync(candidate) };
  expectCode(() => assertTrustedDirectory(x.root, ['docs'], 'DISCOVERY_DECISION_SYMLINK', outsideDirectory), 'DISCOVERY_PATH_ESCAPE');
  const outsideFile = { lstatSync, realpathSync: (candidate) => candidate === x.p2Path ? 'C:/outside' : realpathSync(candidate) };
  expectCode(() => assertTrustedRegularFile(x.root, ['docs', 'discovery', feature, 'runs', 'run-001', 'packets', 'd002.json'], 'DISCOVERY_PACKET_SYMLINK', outsideFile), 'DISCOVERY_PATH_ESCAPE');
}));

test('FALSIFICACIÓN · every typed snapshot and payload rejection remains fail-closed', () => withFixture({}, (x) => {
  rewriteDecision(x.d1Path, (v) => { v.evaluated_at = 'not-a-date'; });
  expectCode(() => verify(x), 'DISCOVERY_SCHEMA_INVALID');
  const skip = fixture({ completed: false });
  try {
    rewriteDecision(skip.d1Path, (v) => { v.status = 'skipped'; v.skip = null; });
    expectCode(() => verify(skip), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  } finally { rmSync(skip.root, { recursive: true, force: true }); }
  const overridden = fixture({ completed: false });
  try {
    rewriteDecision(overridden.d1Path, (v) => { v.status = 'overridden'; v.override = null; });
    expectCode(() => verify(overridden), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  } finally { rmSync(overridden.root, { recursive: true, force: true }); }
}));

test('FALSIFICACIÓN · skip/override cross-payloads and missing SHA values reject explicitly', () => withFixture({}, (x) => {
  rewriteDecision(x.d2Path, (v) => { v.status = 'skipped'; v.packet_ref = null; v.packet_sha256 = null; v.skip = { reason: 'Skip after a full reviewed scope.', scope_evidence: 'Evidence documents the excluded scope.', decided_by: 'owner' }; v.override = {}; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  rewriteDecision(x.d2Path, (v) => { v.status = 'overridden'; v.skip = {}; v.override = { override_reason: 'Risk accepted after a full review.', risk_accepted_by: 'owner', decision_date: '2026-08-28', scope_evidence: 'Evidence documents the accepted scope.' }; });
  expectCode(() => verify(x), 'DISCOVERY_PAYLOAD_INCOMPATIBLE');
  const fresh = fixture({});
  try {
    rewritePacket(fresh.d2Path, fresh.p2Path, (v) => { v.research_snapshot.claims[0].content_identity.value = null; });
    expectCode(() => verify(fresh), 'DISCOVERY_SNAPSHOT_INVALID');
  } finally { rmSync(fresh.root, { recursive: true, force: true }); }
}));

test('FALSIFICACIÓN · claims reject malformed identity, locator, linkage and snapshot structures', () => withFixture({}, (x) => {
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot = {}; });
  expectCode(() => verify(x), 'DISCOVERY_PACKET_INVALID_SCHEMA');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot = p('d002').research_snapshot; v.research_snapshot.claims[0].content_identity = { kind: 'version_ref', value: 'TBD', unavailable_reason: null }; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity = { kind: 'unavailable', value: null, unavailable_reason: 'TBD' }; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity = { kind: 'sha256', value: 'a'.repeat(64), unavailable_reason: null, extra: 'x' }; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].content_identity = { kind: 'sha256', value: 'a'.repeat(64), unavailable_reason: null }; v.research_snapshot.claims[0].locator = { kind: 'other', path: 'x' }; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = { kind: 'web' }; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].locator = { kind: 'web', url: 'https://example.test/source' }; v.research_snapshot.claims[0].linked_requirement_id = ''; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
  rewritePacket(x.d2Path, x.p2Path, (v) => { v.research_snapshot.claims[0].linked_requirement_id = null; v.research_snapshot.claims[0].linked_ac_id = ''; });
  expectCode(() => verify(x), 'DISCOVERY_SNAPSHOT_INVALID');
}));

test('FALSIFICACIÓN · invalid feature/runs and untyped CLI errors never pass', () => withFixture({}, (x) => {
  expectCode(() => verifyDiscoveryFeature(x.root, 'bad_slug'), 'DISCOVERY_PATH_ESCAPE');
  const run = join(x.root, 'docs', 'discovery', feature, 'runs', 'invalid');
  mkdirSync(run);
  expectCode(() => verify(x), 'DISCOVERY_PATH_ESCAPE');
  const errors = [];
  assert.equal(main(['check', '--feature', feature], x.root, () => {}, (line) => errors.push(line), () => { throw new Error('unexpected'); }), 1);
  assert.match(errors.at(-1), /DISCOVERY_SCHEMA_INVALID/u);
}));
