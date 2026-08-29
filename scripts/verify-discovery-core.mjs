#!/usr/bin/env node
// Native verifier for the immutable Discovery run history. It checks declared structure,
// lineage, packet bytes and snapshot shape. It deliberately does not read mutable research-ledger
// data while validating historical packets, and cannot judge semantic sufficiency of a claim.

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';

export const DECISION_SCHEMA = 'vcp.discovery-decision/3';
export const PACKET_SCHEMA = 'vcp.discovery-packet/1';
export const USAGE = 'usage: verify-discovery-core.mjs check --feature <feature-slug> | verify-discovery-core.mjs sources --feature <feature-slug> [--require-current]';

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RUN_ID = /^run-(\d{3})$/u;
const DECISION_FILE = /^d(\d{3})\.json$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUSES = new Set(['pending', 'completed', 'skipped', 'overridden']);
const TERMINAL_STATUSES = new Set(['completed', 'skipped', 'overridden']);
const TRANSITIONS = new Set(['initial', 'activation', 'correction']);
const CLASSIFICATIONS = new Set(['SUPPORTED', 'CONTRADICTED', 'INFERRED', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE']);
const DECISION_KEYS = new Set(['schema', 'run_id', 'feature_slug', 'decision_id', 'evaluated_at', 'status', 'transition_kind', 'supersedes', 'predecessor_hash', 'previous_status', 'activation_result', 'triggers_observed', 'correction_reason', 'skip', 'override', 'packet_ref', 'packet_sha256']);
const PACKET_KEYS = new Set(['schema', 'decision_id', 'research_snapshot']);
const SNAPSHOT_KEYS = new Set(['captured_at', 'claims']);
const CLAIM_KEYS = new Set(['claim_id', 'source_id', 'locator', 'retrieved_at', 'content_identity', 'evidence_classification', 'evidence_summary', 'linked_requirement_id', 'linked_ac_id', 'trigger_ids']);
const IDENTITY_KEYS = new Set(['kind', 'value', 'unavailable_reason']);
const SKIP_KEYS = new Set(['reason', 'scope_evidence', 'decided_by']);
const OVERRIDE_KEYS = new Set(['override_reason', 'risk_accepted_by', 'decision_date', 'scope_evidence']);

export class DiscoveryCoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function reject(code, message) {
  throw new DiscoveryCoreError(code, message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function explanatory(value) {
  return nonEmpty(value) && value.trim().length >= 8 && !/^(?:tbd|todo|n\/a|none|unknown|placeholder)$/iu.test(value.trim());
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function contained(rootReal, candidateReal) {
  const path = relative(rootReal, candidateReal);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function lstat(path, code, fs) {
  try {
    return fs.lstatSync(path);
  } catch {
    reject('DISCOVERY_PATH_ESCAPE', `${code}: unreadable path ${path}`);
  }
}

function realpath(path, fs) {
  try {
    return fs.realpathSync(path);
  } catch {
    reject('DISCOVERY_PATH_ESCAPE', `cannot resolve ${path}`);
  }
}

export function assertTrustedDirectory(projectRoot, segments, symlinkCode = 'DISCOVERY_DECISION_SYMLINK', fs = { lstatSync, realpathSync }) {
  const rootReal = realpath(projectRoot, fs);
  let current = rootReal;
  for (const segment of segments) {
    if (!/^[A-Za-z0-9._-]+$/u.test(segment) || segment === '.' || segment === '..') {
      reject('DISCOVERY_PATH_ESCAPE', `invalid Discovery path segment ${segment}`);
    }
    current = resolve(current, segment);
    const stat = lstat(current, symlinkCode, fs);
    if (stat.isSymbolicLink()) reject(symlinkCode, `symlink is forbidden: ${current}`);
    if (!stat.isDirectory()) reject('DISCOVERY_PATH_ESCAPE', `expected directory: ${current}`);
    if (!contained(rootReal, realpath(current, fs))) reject('DISCOVERY_PATH_ESCAPE', `directory escapes project: ${current}`);
  }
  return current;
}

export function assertTrustedRegularFile(projectRoot, segments, symlinkCode = 'DISCOVERY_DECISION_SYMLINK', fs = { lstatSync, realpathSync }) {
  if (!Array.isArray(segments) || segments.length === 0) reject('DISCOVERY_PATH_ESCAPE', 'file path is missing');
  const fileName = segments.at(-1);
  if (!/^[A-Za-z0-9._-]+$/u.test(fileName) || fileName === '.' || fileName === '..') {
    reject('DISCOVERY_PATH_ESCAPE', `invalid Discovery file name ${fileName}`);
  }
  const parent = assertTrustedDirectory(projectRoot, segments.slice(0, -1), symlinkCode, fs);
  const file = resolve(parent, fileName);
  const stat = lstat(file, symlinkCode, fs);
  if (stat.isSymbolicLink()) reject(symlinkCode, `symlink is forbidden: ${file}`);
  if (!stat.isFile()) reject('DISCOVERY_PATH_ESCAPE', `expected regular file: ${file}`);
  if (!contained(realpath(projectRoot, fs), realpath(file, fs))) reject('DISCOVERY_PATH_ESCAPE', `file escapes project: ${file}`);
  return file;
}

function parseJson(bytes, code, path) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    reject(code, `invalid JSON: ${path}`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertDate(value, code) {
  if (!nonEmpty(value) || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) reject(code, 'date must be YYYY-MM-DD');
}

function assertStringList(value, code, label) {
  if (!Array.isArray(value) || value.some((item) => !nonEmpty(item)) || new Set(value).size !== value.length) {
    reject(code, `${label} must be a unique non-empty string array`);
  }
}

function assertSkip(value) {
  if (!isObject(value) || !exactKeys(value, SKIP_KEYS) || !explanatory(value.reason) || !explanatory(value.scope_evidence) || !nonEmpty(value.decided_by)) {
    reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'skip must have exactly reason, scope_evidence and decided_by');
  }
}

function assertOverride(value) {
  if (!isObject(value) || !exactKeys(value, OVERRIDE_KEYS) || !explanatory(value.override_reason) || !explanatory(value.scope_evidence) || !nonEmpty(value.risk_accepted_by) || !nonEmpty(value.decision_date)) {
    reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'override must have exactly override_reason, risk_accepted_by, decision_date and scope_evidence');
  }
}

function assertPayload(decision) {
  const noPacket = decision.packet_ref === null && decision.packet_sha256 === null;
  if (decision.status === 'pending') {
    if (decision.skip !== null || decision.override !== null || !noPacket) reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'pending has no terminal payload');
  } else if (decision.status === 'completed') {
    if (decision.skip !== null || decision.override !== null || typeof decision.packet_ref !== 'string' || !SHA256.test(decision.packet_sha256 ?? '')) {
      reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'completed requires only a packet payload');
    }
  } else if (decision.status === 'skipped') {
    if (decision.override !== null || !noPacket) reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'skipped cannot contain override or packet');
    assertSkip(decision.skip);
  } else if (decision.status === 'overridden') {
    if (decision.skip !== null || !noPacket) reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'overridden cannot contain skip or packet');
    assertOverride(decision.override);
  }
  if (decision.transition_kind === 'correction') {
    if (!explanatory(decision.correction_reason)) reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'correction requires a real correction_reason');
  } else if (decision.correction_reason !== null) {
    reject('DISCOVERY_PAYLOAD_INCOMPATIBLE', 'only corrections may declare correction_reason');
  }
}

function assertDecisionShape(decision) {
  if (!isObject(decision) || !exactKeys(decision, DECISION_KEYS) || decision.schema !== DECISION_SCHEMA || !nonEmpty(decision.run_id) || !nonEmpty(decision.feature_slug) || !/^d\d{3}$/u.test(decision.decision_id)) {
    reject('DISCOVERY_SCHEMA_INVALID', 'decision schema is invalid');
  }
  assertDate(decision.evaluated_at, 'DISCOVERY_SCHEMA_INVALID');
  if (!STATUSES.has(decision.status) || !TRANSITIONS.has(decision.transition_kind) || !nonEmpty(decision.activation_result)) {
    reject('DISCOVERY_SCHEMA_INVALID', 'decision status, transition_kind or activation_result is invalid');
  }
  assertStringList(decision.triggers_observed, 'DISCOVERY_PAYLOAD_INCOMPATIBLE', 'triggers_observed');
  assertPayload(decision);
}

function assertContentIdentity(identity) {
  if (!isObject(identity) || !exactKeys(identity, IDENTITY_KEYS)) reject('DISCOVERY_SNAPSHOT_INVALID', 'content_identity has invalid shape');
  if (identity.kind === 'sha256') {
    if (!SHA256.test(identity.value ?? '') || identity.unavailable_reason !== null) reject('DISCOVERY_SNAPSHOT_INVALID', 'sha256 identity has invalid fields');
  } else if (identity.kind === 'version_ref') {
    if (!explanatory(identity.value) || identity.unavailable_reason !== null) reject('DISCOVERY_SNAPSHOT_INVALID', 'version_ref identity has invalid fields');
  } else if (identity.kind === 'unavailable') {
    if (identity.value !== null || !explanatory(identity.unavailable_reason)) reject('DISCOVERY_SNAPSHOT_INVALID', 'unavailable identity needs a real reason');
  } else {
    reject('DISCOVERY_SNAPSHOT_INVALID', 'content_identity kind is unknown');
  }
}

// Evidence locators are recorded, not fetched: this gate never resolves a URL and never opens a
// repo path. It only proves the recorded string is a safe, unambiguous reference — an https URL
// carrying no embedded credentials, or a project-relative path that cannot escape the checkout.
const CONTROL_CHARACTERS = /[ -]/u;

function assertWebLocator(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    reject('DISCOVERY_SNAPSHOT_INVALID', `claim locator is not a parseable URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') reject('DISCOVERY_SNAPSHOT_INVALID', `claim locator must use https: ${url}`);
  if (parsed.username !== '' || parsed.password !== '') reject('DISCOVERY_SNAPSHOT_INVALID', 'claim locator must not embed credentials');
}

function assertRepoFileLocator(path) {
  const normalized = path.trim().replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-z]:\//iu.test(normalized)) reject('DISCOVERY_SNAPSHOT_INVALID', `claim locator must be project-relative: ${path}`);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || normalized.endsWith('/..')) {
    reject('DISCOVERY_SNAPSHOT_INVALID', `claim locator must not escape the project: ${path}`);
  }
}

function assertLocator(locator) {
  if (!isObject(locator) || !['web', 'repo_file'].includes(locator.kind)) reject('DISCOVERY_SNAPSHOT_INVALID', 'claim locator is invalid');
  // `line` is optional and repo-only: a claim may cite a whole file. Running Discovery for real
  // showed that without it the line had to be buried in the path ("SKILL.md#L693"), which the
  // path rules then had to treat as part of a filename.
  const hasLine = Object.hasOwn(locator, 'line');
  const expected = locator.kind === 'web'
    ? new Set(['kind', 'url'])
    : new Set(hasLine ? ['kind', 'path', 'line'] : ['kind', 'path']);
  if (!exactKeys(locator, expected) || !nonEmpty(locator.url ?? locator.path)) reject('DISCOVERY_SNAPSHOT_INVALID', 'claim locator is incomplete');
  if (hasLine && (!Number.isInteger(locator.line) || locator.line < 1)) {
    reject('DISCOVERY_SNAPSHOT_INVALID', `claim locator line must be a positive integer: ${locator.line}`);
  }
  const reference = locator.url ?? locator.path;
  if (CONTROL_CHARACTERS.test(reference)) reject('DISCOVERY_SNAPSHOT_INVALID', 'claim locator contains control characters');
  if (locator.kind === 'web') assertWebLocator(reference);
  else assertRepoFileLocator(reference);
}

function validateSnapshot(snapshot, decision) {
  if (!isObject(snapshot) || !exactKeys(snapshot, SNAPSHOT_KEYS) || !Array.isArray(snapshot.claims)) reject('DISCOVERY_PACKET_INVALID_SCHEMA', 'research_snapshot is invalid');
  assertDate(snapshot.captured_at, 'DISCOVERY_SNAPSHOT_INVALID');
  if (snapshot.claims.length === 0) reject('DISCOVERY_SNAPSHOT_EMPTY', 'completed packet needs at least one claim');
  const ids = new Set();
  const claimsById = new Map();
  const covered = new Set();
  for (const claim of snapshot.claims) {
    if (!isObject(claim) || !exactKeys(claim, CLAIM_KEYS) || !nonEmpty(claim.claim_id) || !nonEmpty(claim.source_id) || !CLASSIFICATIONS.has(claim.evidence_classification) || !explanatory(claim.evidence_summary)) {
      reject('DISCOVERY_SNAPSHOT_INVALID', 'claim schema is invalid');
    }
    if (ids.has(claim.claim_id)) reject('DISCOVERY_SNAPSHOT_INVALID', `duplicate claim_id ${claim.claim_id}`);
    ids.add(claim.claim_id);
    assertLocator(claim.locator);
    assertDate(claim.retrieved_at, 'DISCOVERY_SNAPSHOT_INVALID');
    assertContentIdentity(claim.content_identity);
    if (![null, undefined].includes(claim.linked_requirement_id) && !nonEmpty(claim.linked_requirement_id)) reject('DISCOVERY_SNAPSHOT_INVALID', 'linked_requirement_id is invalid');
    if (![null, undefined].includes(claim.linked_ac_id) && !nonEmpty(claim.linked_ac_id)) reject('DISCOVERY_SNAPSHOT_INVALID', 'linked_ac_id is invalid');
    assertStringList(claim.trigger_ids, 'DISCOVERY_SNAPSHOT_INVALID', 'claim trigger_ids');
    for (const trigger of claim.trigger_ids) {
      if (!decision.triggers_observed.includes(trigger)) reject('DISCOVERY_TRIGGER_ID_UNKNOWN', `claim covers unknown trigger ${trigger}`);
      covered.add(trigger);
    }
    claimsById.set(claim.claim_id, claim);
  }
  for (const trigger of decision.triggers_observed) {
    if (!covered.has(trigger)) reject('DISCOVERY_TRIGGER_UNCOVERED', `trigger lacks a claim: ${trigger}`);
  }
  return { ids, claimsById };
}

export function readPacket(projectRoot, runId, decision, previousPacket, assertFile = assertTrustedRegularFile) {
  const expectedRef = `packets/${decision.decision_id}.json`;
  if (decision.packet_ref !== expectedRef) reject('DISCOVERY_PACKET_PATH_INVALID', `${decision.decision_id}: packet_ref must be ${expectedRef}`);
  const expectedPath = resolve(projectRoot, 'docs', 'discovery', decision.feature_slug, 'runs', runId, 'packets', `${decision.decision_id}.json`);
  let path;
  try {
    // Inspect the node before existsSync(): a broken symlink makes existsSync()
    // return false, but it must still be classified as a prohibited symlink.
    path = assertFile(projectRoot, ['docs', 'discovery', decision.feature_slug, 'runs', runId, 'packets', `${decision.decision_id}.json`], 'DISCOVERY_PACKET_SYMLINK');
  } catch (error) {
    if (error?.code === 'DISCOVERY_PATH_ESCAPE' && !existsSync(expectedPath)) {
      reject('DISCOVERY_PACKET_MISSING', `${decision.decision_id}: packet is missing`);
    }
    throw error;
  }
  const bytes = readFileSync(path);
  if (sha256(bytes) !== decision.packet_sha256) reject('DISCOVERY_PACKET_HASH_MISMATCH', `${decision.decision_id}: packet hash differs`);
  const packet = parseJson(bytes, 'DISCOVERY_PACKET_INVALID_SCHEMA', path);
  if (!isObject(packet) || !exactKeys(packet, PACKET_KEYS) || packet.schema !== PACKET_SCHEMA || packet.decision_id !== decision.decision_id) {
    reject('DISCOVERY_PACKET_INVALID_SCHEMA', `${decision.decision_id}: packet schema is invalid`);
  }
  const snapshot = validateSnapshot(packet.research_snapshot, decision);
  if (decision.transition_kind === 'correction' && previousPacket) {
    for (const claimId of previousPacket.ids) {
      if (!snapshot.ids.has(claimId)) reject('DISCOVERY_SNAPSHOT_REGRESSION', `${decision.decision_id}: correction removed ${claimId}`);
    }
    const previousTriggers = new Set(previousPacket.decision.triggers_observed);
    for (const trigger of decision.triggers_observed.filter((item) => !previousTriggers.has(item))) {
      const hasNewClaim = [...snapshot.claimsById.entries()].some(([claimId, claim]) => !previousPacket.ids.has(claimId) && claim.trigger_ids.includes(trigger));
      if (!hasNewClaim) reject('DISCOVERY_SNAPSHOT_TRIGGER_UNSUPPORTED', `${decision.decision_id}: new trigger lacks a new claim`);
    }
  }
  return { ...snapshot, decision, packet };
}

export function runDirectoryEntries(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name).sort();
  } catch {
    reject('DISCOVERY_PATH_ESCAPE', `cannot list ${directory}`);
  }
}

function assertRunOwnership(projectRoot, runId, featureSlug) {
  const runPath = assertTrustedDirectory(projectRoot, ['docs', 'discovery', featureSlug, 'runs', runId], 'DISCOVERY_DECISION_SYMLINK');
  const entries = runDirectoryEntries(runPath);
  if (!sameStrings(entries, ['decisions', 'packets'])) reject('DISCOVERY_PATH_ESCAPE', `${runId} has unknown entries`);
  assertTrustedDirectory(projectRoot, ['docs', 'discovery', featureSlug, 'runs', runId, 'decisions'], 'DISCOVERY_DECISION_SYMLINK');
  assertTrustedDirectory(projectRoot, ['docs', 'discovery', featureSlug, 'runs', runId, 'packets'], 'DISCOVERY_PACKET_SYMLINK');
  return runPath;
}

function readRun(projectRoot, featureSlug, runId) {
  const runPath = assertRunOwnership(projectRoot, runId, featureSlug);
  const decisionDir = resolve(runPath, 'decisions');
  const packetDir = resolve(runPath, 'packets');
  const files = runDirectoryEntries(decisionDir);
  if (files.length === 0 || files.some((file) => !DECISION_FILE.test(file))) reject('DISCOVERY_PATH_ESCAPE', `${runId}: decisions must be canonical dNNN.json files`);
  const decisions = files.map((file) => {
    const filePath = assertTrustedRegularFile(projectRoot, ['docs', 'discovery', featureSlug, 'runs', runId, 'decisions', file], 'DISCOVERY_DECISION_SYMLINK');
    const bytes = readFileSync(filePath);
    const decision = parseJson(bytes, 'DISCOVERY_SCHEMA_INVALID', filePath);
    assertDecisionShape(decision);
    if (basename(filePath) !== `${decision.decision_id}.json`) reject('DISCOVERY_DECISION_ID_MISMATCH', `${file}: decision_id differs`);
    return { decision, bytes };
  });
  decisions.sort((left, right) => left.decision.decision_id.localeCompare(right.decision.decision_id));
  let previous = null;
  let previousPacket = null;
  const completed = new Set();
  const history = [];
  for (const [index, entry] of decisions.entries()) {
    const { decision, bytes } = entry;
    const expectedId = `d${String(index + 1).padStart(3, '0')}`;
    if (decision.decision_id !== expectedId) reject('DISCOVERY_DECISION_ID_GAP', `${runId}: expected ${expectedId}`);
    if (decision.run_id !== runId || decision.feature_slug !== featureSlug || decision.schema !== DECISION_SCHEMA) reject('DISCOVERY_IMMUTABLE_FIELD_CHANGED', `${decision.decision_id}: run identity differs`);
    if (!previous) {
      if (decision.decision_id !== 'd001' || decision.status !== 'pending' || decision.transition_kind !== 'initial' || decision.predecessor_hash !== null || decision.previous_status !== null) {
        reject('DISCOVERY_SCHEMA_INVALID', `${runId}: d001 must be the pending initial root`);
      }
      if (decision.supersedes !== null) reject('DISCOVERY_CHAIN_NONLINEAR', `${runId}: d001 cannot supersede a predecessor`);
    } else {
      if (decision.supersedes !== previous.decision.decision_id) reject('DISCOVERY_CHAIN_NONLINEAR', `${decision.decision_id}: supersedes must point to its immediate predecessor`);
      if (decision.predecessor_hash !== sha256(previous.bytes)) reject('DISCOVERY_PREDECESSOR_HASH_MISMATCH', `${decision.decision_id}: predecessor hash differs`);
      if (decision.previous_status !== previous.decision.status) reject('DISCOVERY_PREVIOUS_STATUS_MISMATCH', `${decision.decision_id}: previous_status differs`);
      if (decision.evaluated_at < previous.decision.evaluated_at) reject('DISCOVERY_DATE_NON_MONOTONIC', `${decision.decision_id}: date decreased`);
      for (const field of ['run_id', 'feature_slug', 'activation_result', 'schema']) {
        if (decision[field] !== decisions[0].decision[field]) reject('DISCOVERY_IMMUTABLE_FIELD_CHANGED', `${decision.decision_id}: ${field} changed`);
      }
      if (decision.transition_kind === 'activation') {
        if (previous.decision.status !== 'pending' || !TERMINAL_STATUSES.has(decision.status) || !sameStrings(decision.triggers_observed, previous.decision.triggers_observed)) {
          reject('DISCOVERY_TRANSITION_INVALID', `${decision.decision_id}: invalid activation`);
        }
      } else if (decision.transition_kind === 'correction') {
        const removedTrigger = previous.decision.triggers_observed.some((trigger) => !decision.triggers_observed.includes(trigger));
        if (!TERMINAL_STATUSES.has(previous.decision.status) || decision.status !== previous.decision.status || removedTrigger) {
          reject(removedTrigger ? 'DISCOVERY_TRIGGERS_NOT_SUPERSET' : 'DISCOVERY_TRANSITION_INVALID', `${decision.decision_id}: invalid correction`);
        }
      } else {
        reject('DISCOVERY_TRANSITION_INVALID', `${decision.decision_id}: only d001 may be initial`);
      }
    }
    if (decision.status === 'completed') {
      previousPacket = readPacket(projectRoot, runId, decision, previousPacket);
      completed.add(`${decision.decision_id}.json`);
    }
    history.push({ decision, packet: previousPacket?.decision.decision_id === decision.decision_id ? previousPacket.packet : null });
    previous = { decision, bytes };
  }
  const packetFiles = runDirectoryEntries(packetDir);
  if (packetFiles.some((file) => !DECISION_FILE.test(file)) || !sameStrings(packetFiles, [...completed].sort())) reject('DISCOVERY_PACKET_UNREFERENCED', `${runId}: packets do not match completed decisions`);
  return { runId, leaf: previous.decision.status, history };
}

export function readDiscoveryHistory(projectRoot, featureSlug) {
  if (!FEATURE_SLUG.test(featureSlug)) reject('DISCOVERY_PATH_ESCAPE', 'feature slug is invalid');
  const runsDir = assertTrustedDirectory(projectRoot, ['docs', 'discovery', featureSlug, 'runs'], 'DISCOVERY_DECISION_SYMLINK');
  const runIds = runDirectoryEntries(runsDir);
  if (runIds.length === 0 || runIds.some((id) => !RUN_ID.test(id))) reject('DISCOVERY_PATH_ESCAPE', 'runs must contain only run-NNN directories');
  const runs = runIds.map((runId) => readRun(projectRoot, featureSlug, runId));
  for (const [index, run] of runs.entries()) {
    if (run.runId !== `run-${String(index + 1).padStart(3, '0')}`) reject('DISCOVERY_RUN_ID_GAP', 'run ids must be contiguous');
    if (index > 0 && runs[index - 1].leaf === 'pending') reject('DISCOVERY_RUN_MULTIPLE_PENDING', 'a pending run blocks a later run');
  }
  return { featureSlug, runs };
}

export function verifyDiscoveryFeature(projectRoot, featureSlug) {
  const result = readDiscoveryHistory(projectRoot, featureSlug);
  return { ok: true, runs: result.runs.length };
}

// --- sources: resolver los locators contra el arbol real -----------------------------------------
// `check` valida la cadena historica y no puede exigir que las fuentes sigan iguales: un run viejo
// cita archivos que legitimamente cambiaron desde su captura. Por eso `sources` va aparte, por la
// misma razon que `history` va aparte en verify-audit-chain.mjs: son preguntas distintas.
export const SOURCE_OK = 'OK';
export const SOURCE_DRIFTED = 'DRIFTED';
export const SOURCE_MISSING = 'MISSING';
export const SOURCE_OUT_OF_RANGE = 'LINE_OUT_OF_RANGE';
export const SOURCE_WEB = 'UNVERIFIABLE_WEB';
export const SOURCE_NO_HASH = 'UNVERIFIABLE_NO_HASH';

/** Resuelve un locator contra el arbol real. Nunca sale a la red: una fuente web se cuenta como
 * no verificable, jamas como verificada. Un path que escapa del proyecto no se lee: se reporta
 * como irresoluble, que es fallar cerrado. */
export function classifySource(projectRoot, claim, read = readFileSync) {
  const salida = (status, detail) => ({ claim_id: claim.claim_id, status, detail });
  const { locator, content_identity: identity } = claim;
  if (locator.kind === 'web') return salida(SOURCE_WEB, locator.url);
  if (identity.kind !== 'sha256') {
    return salida(SOURCE_NO_HASH, `${locator.path}: content_identity es ${identity.kind}, no hay huella que comparar`);
  }
  let absolute;
  try {
    // La función espera segmentos, no una ruta entera: pasarla como un solo segmento hacía que
    // cualquier claim con una barra se reportara como irresoluble. Reproducido el 2026-08-29
    // corriendo el gate sobre este mismo repositorio, donde los tres archivos sí existían.
    const segments = locator.path.trim().replaceAll('\\', '/').split('/').filter((s) => s !== '');
    absolute = assertTrustedRegularFile(projectRoot, segments, 'DISCOVERY_SNAPSHOT_INVALID');
  } catch {
    return salida(SOURCE_MISSING, `${locator.path}: no se puede resolver dentro del proyecto`);
  }
  let bytes;
  try {
    bytes = read(absolute);
  } catch {
    return salida(SOURCE_MISSING, `${locator.path}: el archivo citado no existe`);
  }
  const texto = String(bytes);
  if (Object.hasOwn(locator, 'line')) {
    const lineas = texto.split('\n').length;
    if (locator.line > lineas) return salida(SOURCE_OUT_OF_RANGE, `${locator.path}: cita la línea ${locator.line} y el archivo tiene ${lineas}`);
  }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== identity.value) return salida(SOURCE_DRIFTED, `${locator.path}: el contenido cambió desde la captura`);
  return salida(SOURCE_OK, locator.path);
}

/** Solo los claims del ultimo packet de cada run: los packets anteriores son historia congelada
 * y sus fuentes envejecieron a proposito. */
export function activeClaims(history) {
  const claims = [];
  for (const run of history.runs ?? []) {
    // Cada entrada de `history` es {decision, packet}; una decisión pending no trae packet.
    const conPacket = (run.history ?? []).filter((entry) => entry?.packet);
    if (conPacket.length === 0) continue;
    claims.push(...(conPacket[conPacket.length - 1].packet.research_snapshot?.claims ?? []));
  }
  return claims;
}

export function verifyDiscoverySources(projectRoot, featureSlug, options = {}) {
  const leerHistoria = options.history ?? readDiscoveryHistory;
  const history = leerHistoria(projectRoot, featureSlug);
  const claims = activeClaims(history);
  const counts = { [SOURCE_OK]: 0, [SOURCE_DRIFTED]: 0, [SOURCE_MISSING]: 0, [SOURCE_OUT_OF_RANGE]: 0, [SOURCE_WEB]: 0, [SOURCE_NO_HASH]: 0 };
  const findings = claims.map((claim) => classifySource(projectRoot, claim, options.read));
  for (const f of findings) counts[f.status] += 1;
  const bloqueantes = new Set([SOURCE_MISSING, SOURCE_OUT_OF_RANGE]);
  if (options.requireCurrent) bloqueantes.add(SOURCE_DRIFTED);
  return { counts, findings, blocking: findings.filter((f) => bloqueantes.has(f.status)), empty: claims.length === 0 };
}

export function parseArgs(args) {
  const [command, flag, slug, ...resto] = args;
  if (!['check', 'sources'].includes(command) || flag !== '--feature' || !FEATURE_SLUG.test(slug ?? '')) return null;
  if (resto.length === 0) return { command, featureSlug: slug, requireCurrent: false };
  // `--require-current` sólo tiene sentido sobre `sources`: en `check` no hay nada que comparar
  // contra el árbol, así que aceptarlo ahí sería prometer una comprobación que no ocurre.
  if (command === 'sources' && resto.length === 1 && resto[0] === '--require-current') {
    return { command, featureSlug: slug, requireCurrent: true };
  }
  return null;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error, verify = verifyDiscoveryFeature, options = {}) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  try {
    if (parsed.command === 'sources') {
      const sources = (options.sources ?? verifyDiscoverySources)(cwd, parsed.featureSlug, { requireCurrent: parsed.requireCurrent });
      if (sources.empty) {
        write(`VACÍO: ${parsed.featureSlug} no declara ningún claim vigente que resolver.`);
        return 0;
      }
      if (sources.blocking.length > 0) {
        writeError(`REJECTED: DISCOVERY_SOURCE_UNRESOLVABLE: ${sources.blocking.length} claim(s) citan una fuente que no se puede resolver:`);
        for (const f of sources.blocking) writeError(`  ${f.claim_id}: ${f.detail}`);
        return 1;
      }
      const c = sources.counts;
      write(`OK: ${c[SOURCE_OK]} fuente(s) con el contenido declarado; ${c[SOURCE_DRIFTED]} cambiaron desde la captura; ${c[SOURCE_WEB]} web y ${c[SOURCE_NO_HASH]} sin huella quedan sin verificar — este gate no sale a la red.`);
      return 0;
    }
    const result = verify(cwd, parsed.featureSlug);
    write(`OK: ${parsed.featureSlug} has ${result.runs} valid Discovery run(s).`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.code ?? 'DISCOVERY_SCHEMA_INVALID'}: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-discovery-core.mjs')) {
  process.exitCode = main();
}
