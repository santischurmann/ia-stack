#!/usr/bin/env node
// Native evidence runner. It executes an explicit argv vector (never a shell string), records the
// observable result and lets the final gate reject skipped/unverifiable evidence.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export const SCHEMA = 'vcp.evidence-runner/v1';
export const REQUEST_SCHEMA = 'vcp.evidence-request/v1';
export const USAGE = 'usage: verify-evidence-runner.mjs run <request.json> <record.json> | verify-evidence-runner.mjs check <record.json> [--require-complete]';
export const REQUIRE_COMPLETE_FLAG = '--require-complete';
export const STATUSES = new Set(['passed', 'failed', 'skipped']);
export const MAX_TAIL = 4096;
const ALLOWED_EXECUTABLES = new Set(['node', 'npm', 'pnpm', 'yarn', 'bun', 'python', 'python3', 'pytest', 'go', 'cargo', 'make', 'cmake', 'bazel', 'bash', 'pwsh', 'powershell']);
const REQUEST_KEYS = new Set(['schema', 'command', 'cwd', 'timeout_ms', 'skip_reason']);
const RECORD_KEYS = new Set(['schema', 'status', 'command', 'command_sha256', 'cwd', 'git_head', 'exit_code', 'signal', 'timed_out', 'duration_ms', 'stdout_tail', 'stderr_tail', 'stdout_tail_sha256', 'stderr_tail_sha256', 'started_at', 'finished_at', 'skip_reason']);

function exactKeys(value, allowed) {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function safeRelative(path) {
  if (typeof path !== 'string' || path.trim() === '' || isAbsolute(path)) return false;
  const normalized = path.replaceAll('\\', '/');
  return normalized !== '' && !normalized.includes('\0') && !normalized.split('/').includes('..')
    && !normalized.startsWith('/') && !/^[A-Za-z]:/u.test(normalized);
}

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalCommand(command) {
  return JSON.stringify(command);
}

function executableName(command) {
  const first = command[0].replaceAll('\\', '/').split('/').at(-1).toLowerCase().replace(/\.exe$/u, '');
  return first;
}

function isBareExecutable(value) {
  return !/[\\/]/u.test(value) && !value.startsWith('.') && !/^[A-Za-z]:/u.test(value);
}

function tail(value) {
  const bytes = Buffer.from(String(value ?? ''), 'utf8');
  if (bytes.length <= MAX_TAIL) return bytes.toString('utf8');
  return bytes.subarray(bytes.length - MAX_TAIL).toString('utf8');
}

function readJson(path, readFile = readFileSync) {
  let raw;
  try {
    raw = readFile(path, 'utf8');
  } catch (error) {
    return { value: null, error: `unable to read ${path}: ${error.message}` };
  }
  try {
    return { value: JSON.parse(raw), error: null };
  } catch (error) {
    return { value: null, error: `${path} is not valid JSON: ${error.message}` };
  }
}

export function validateRequest(request) {
  const violations = [];
  if (!isObject(request) || !exactKeys(request, REQUEST_KEYS) || request.schema !== REQUEST_SCHEMA) {
    return [`request must use ${REQUEST_SCHEMA} with exactly schema, command, cwd, timeout_ms and skip_reason`];
  }
  if (!Array.isArray(request.command) || request.command.length === 0 || request.command.some((item) => typeof item !== 'string' || item === '')) {
    violations.push('command must be a non-empty argv array of strings');
  } else if (!isBareExecutable(request.command[0])) {
    violations.push('command executable must be a bare allowlisted name, not a path');
  } else if (!ALLOWED_EXECUTABLES.has(executableName(request.command))) {
    violations.push(`executable is not in the native allowlist: ${executableName(request.command)}`);
  }
  if (typeof request.cwd !== 'string' || !safeRelative(request.cwd)) violations.push('cwd must be a safe project-relative path');
  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms < 1 || request.timeout_ms > 86_400_000) violations.push('timeout_ms must be an integer between 1 and 86400000');
  if (request.skip_reason !== null && !nonEmpty(request.skip_reason)) violations.push('skip_reason must be null or a non-empty string');
  return violations;
}

export function validateRecord(record, { requireComplete = false } = {}) {
  const violations = [];
  if (!isObject(record) || !exactKeys(record, RECORD_KEYS) || record.schema !== SCHEMA) {
    return [`record must use ${SCHEMA} with its exact fields`];
  }
  if (!STATUSES.has(record.status)) violations.push(`status must be one of ${[...STATUSES].join(', ')}`);
  if (!Array.isArray(record.command) || record.command.length === 0 || record.command.some((item) => typeof item !== 'string' || item === '')) {
    violations.push('command must be a non-empty argv array');
  } else {
    if (!isBareExecutable(record.command[0])) violations.push('command executable must be a bare allowlisted name, not a path');
    else if (!ALLOWED_EXECUTABLES.has(executableName(record.command))) violations.push(`executable is not in the native allowlist: ${executableName(record.command)}`);
    if (record.command_sha256 !== hash(canonicalCommand(record.command))) violations.push('command_sha256 does not match command');
  }
  if (typeof record.cwd !== 'string' || !safeRelative(record.cwd)) violations.push('cwd must be project-relative');
  if (record.git_head !== null && (typeof record.git_head !== 'string' || !/^[0-9a-f]{7,64}$/u.test(record.git_head))) violations.push('git_head must be null or a hex commit id');
  if (record.exit_code !== null && !Number.isInteger(record.exit_code)) violations.push('exit_code must be an integer or null');
  if (record.signal !== null && !nonEmpty(record.signal)) violations.push('signal must be null or a non-empty string');
  if (typeof record.timed_out !== 'boolean') violations.push('timed_out must be boolean');
  if (!Number.isInteger(record.duration_ms) || record.duration_ms < 0) violations.push('duration_ms must be a non-negative integer');
  for (const field of ['stdout_tail', 'stderr_tail']) {
    if (typeof record[field] !== 'string' || Buffer.byteLength(record[field], 'utf8') > MAX_TAIL) {
      violations.push(`${field} must be a string no longer than ${MAX_TAIL} bytes`);
    }
  }
  if (typeof record.stdout_tail === 'string' && Buffer.byteLength(record.stdout_tail, 'utf8') <= MAX_TAIL
    && record.stdout_tail_sha256 !== hash(record.stdout_tail)) violations.push('stdout_tail_sha256 does not match stdout_tail');
  if (typeof record.stderr_tail === 'string' && Buffer.byteLength(record.stderr_tail, 'utf8') <= MAX_TAIL
    && record.stderr_tail_sha256 !== hash(record.stderr_tail)) violations.push('stderr_tail_sha256 does not match stderr_tail');
  for (const field of ['started_at', 'finished_at']) if (typeof record[field] !== 'string' || Number.isNaN(Date.parse(record[field]))) violations.push(`${field} must be an ISO timestamp`);
  if (!violations.some((item) => item.includes('started_at')) && !violations.some((item) => item.includes('finished_at')) && Date.parse(record.finished_at) < Date.parse(record.started_at)) violations.push('finished_at cannot precede started_at');
  if (record.skip_reason !== null && !nonEmpty(record.skip_reason)) violations.push('skip_reason must be null or a non-empty string');
  if (record.status === 'skipped') {
    if (!nonEmpty(record.skip_reason)) violations.push('skipped evidence requires skip_reason');
    if (record.exit_code !== null || record.timed_out) violations.push('skipped evidence cannot have an exit code or timeout');
  }
  if (record.status === 'passed' && (record.exit_code !== 0 || record.timed_out || record.skip_reason !== null)) violations.push('passed evidence requires exit_code 0, no timeout and no skip_reason');
  if (record.status === 'failed' && record.exit_code === 0 && !record.timed_out) violations.push('failed evidence requires non-zero exit_code or timeout');
  if (requireComplete && record.status !== 'passed') violations.push(`evidence status ${record.status} cannot close a phase; only passed is complete`);
  return violations;
}

function gitHead(cwd, run) {
  const result = run('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }) ?? {};
  const value = String(result.stdout ?? '').trim();
  return result.status === 0 && /^[0-9a-f]{7,64}$/u.test(value) ? value : null;
}

export function runEvidence(request, { cwd = process.cwd(), run = spawnSync, now = () => Date.now(), iso = () => new Date().toISOString() } = {}) {
  const violations = validateRequest(request);
  if (violations.length > 0) return { record: null, violations };
  const projectCwd = resolve(cwd, request.cwd);
  const startedMs = now();
  const startedAt = iso();
  if (request.skip_reason !== null) {
    const finishedAt = iso();
    return {
      record: {
        schema: SCHEMA, status: 'skipped', command: request.command, command_sha256: hash(canonicalCommand(request.command)), cwd: request.cwd,
        // A skipped vector must not execute even the metadata probe: null makes the omission
        // explicit instead of pretending that a checkout was observed while skipping.
        git_head: null, exit_code: null, signal: null, timed_out: false, duration_ms: Math.max(0, now() - startedMs),
        stdout_tail: '', stderr_tail: '', stdout_tail_sha256: hash(''), stderr_tail_sha256: hash(''), started_at: startedAt, finished_at: finishedAt, skip_reason: request.skip_reason,
      },
      violations: [],
    };
  }
  const result = run(request.command[0], request.command.slice(1), { cwd: projectCwd, encoding: 'utf8', timeout: request.timeout_ms, shell: false }) ?? {};
  const finishedMs = now();
  const stdout = tail(result.stdout);
  const stderr = tail(result.stderr);
  const timedOut = Boolean(result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM' && result.status === null);
  const record = {
    schema: SCHEMA, status: result.status === 0 && !timedOut ? 'passed' : 'failed', command: request.command,
    command_sha256: hash(canonicalCommand(request.command)), cwd: request.cwd, git_head: gitHead(projectCwd, run),
    exit_code: Number.isInteger(result.status) ? result.status : null, signal: result.signal ?? null, timed_out: timedOut,
    duration_ms: Math.max(0, finishedMs - startedMs), stdout_tail: stdout, stderr_tail: stderr,
    stdout_tail_sha256: hash(stdout), stderr_tail_sha256: hash(stderr), started_at: startedAt, finished_at: iso(), skip_reason: null,
  };
  return { record, violations: [] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const readFile = options.readFile ?? readFileSync;
  const writeFile = options.writeFile ?? writeFileSync;
  const requireComplete = args.includes(REQUIRE_COMPLETE_FLAG);
  const rest = args.filter((arg) => arg !== REQUIRE_COMPLETE_FLAG);
  if (rest[0] === 'run' && rest.length === 3) {
    const request = readJson(rest[1], readFile);
    if (request.error) { writeError(`REJECTED: EVIDENCE_REQUEST_INVALID: ${request.error}`); return 1; }
    const result = runEvidence(request.value, { cwd: options.cwd ?? process.cwd(), run: options.run ?? spawnSync, now: options.now, iso: options.iso });
    if (result.violations.length > 0) { for (const item of result.violations) writeError(`REJECTED: EVIDENCE_REQUEST_INVALID: ${item}`); return 1; }
    try { writeFile(rest[2], `${JSON.stringify(result.record, null, 2)}\n`, 'utf8'); } catch (error) { writeError(`REJECTED: EVIDENCE_RECORD_WRITE_FAILED: ${error.message}`); return 1; }
    write(`OK: evidence recorded as ${result.record.status} (${result.record.command.join(' ')}); check with --require-complete before phase close.`);
    return 0;
  }
  if (rest[0] === 'check' && rest.length === 2) {
    const loaded = readJson(rest[1], readFile);
    if (loaded.error) { writeError(`REJECTED: EVIDENCE_RECORD_INVALID: ${loaded.error}`); return 1; }
    const violations = validateRecord(loaded.value, { requireComplete });
    if (violations.length > 0) { for (const item of violations) writeError(`REJECTED: EVIDENCE_RECORD_INVALID: ${item}`); return 1; }
    write(`OK: evidence record is ${loaded.value.status}${requireComplete ? ' and complete' : ''}.`);
    return 0;
  }
  writeError(USAGE);
  return 2;
}

if (process.argv[1] && process.argv[1].endsWith('verify-evidence-runner.mjs')) process.exitCode = main();
