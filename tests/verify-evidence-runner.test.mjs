import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { REAL_SPAWN_TIMEOUT_MS } from './spawn-budget.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-evidence-runner.mjs');
const { MAX_TAIL, REQUEST_SCHEMA, REQUIRE_COMPLETE_FLAG, SCHEMA, USAGE, main, runEvidence, validateRecord, validateRequest } = await import(pathToFileURL(script).href);

const sha = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const commandHash = (command) => sha(JSON.stringify(command));
function request(overrides = {}) {
  return { schema: REQUEST_SCHEMA, command: ['node', '-e', 'process.exit(0)'], cwd: '.', timeout_ms: REAL_SPAWN_TIMEOUT_MS, skip_reason: null, ...overrides };
}
function record(overrides = {}) {
  const command = ['node', '-e', 'process.exit(0)'];
  return {
    schema: SCHEMA, status: 'passed', command, command_sha256: commandHash(command), cwd: '.', git_head: null,
    exit_code: 0, signal: null, timed_out: false, duration_ms: 2, stdout_tail: '', stderr_tail: '',
    stdout_tail_sha256: sha(''), stderr_tail_sha256: sha(''), started_at: '2026-08-31T10:00:00.000Z', finished_at: '2026-08-31T10:00:02.000Z', skip_reason: null,
    ...overrides,
  };
}

test('valid request and record pass strict validation', () => {
  assert.deepEqual(validateRequest(request()), []);
  assert.deepEqual(validateRecord(record(), { requireComplete: true }), []);
});

test('FALSIFICACIÓN · request rejects shape, unsafe paths, timeout, unknown executable and skip reason', () => {
  assert.match(validateRequest(null)[0], /must use/);
  const bad = request({ command: [], cwd: '../outside', timeout_ms: 0, skip_reason: '' });
  assert.ok(validateRequest(bad).length >= 4);
  assert.ok(validateRequest(request({ command: ['./node', '-e', 'process.exit(0)'] })).some((item) => item.includes('bare allowlisted')));
  assert.ok(validateRequest(request({ command: ['C:node', '-e', 'process.exit(0)'] })).some((item) => item.includes('bare allowlisted')));
  assert.ok(validateRequest(request({ command: ['.node', '-e', 'process.exit(0)'] })).some((item) => item.includes('bare allowlisted')));
  assert.deepEqual(validateRequest(request({ command: ['node.exe', '-e', 'process.exit(0)'] })), []);
  assert.ok(validateRequest(request({ cwd: null })).some((item) => item.includes('project-relative')));
  assert.ok(validateRequest(request({ cwd: '' })).some((item) => item.includes('project-relative')));
  assert.ok(validateRequest(request({ cwd: 'C:relative' })).some((item) => item.includes('project-relative')));
  assert.ok(validateRequest(request({ cwd: 'safe\0path' })).some((item) => item.includes('project-relative')));
  assert.ok(validateRequest(request({ cwd: '/outside' })).some((item) => item.includes('project-relative')));
  const unknown = request({ command: ['curl', 'https://example.test'] });
  assert.ok(validateRequest(unknown).some((item) => item.includes('allowlist')));
  const abs = request({ cwd: 'C:/outside' });
  assert.ok(validateRequest(abs).some((item) => item.includes('project-relative')));
});

test('FALSIFICACIÓN · record rejects hashes, timestamps, status invariants and strict skipped/failed states', () => {
  const badHash = record({ command_sha256: '0'.repeat(64), stdout_tail: 'x' });
  assert.ok(validateRecord(badHash).some((item) => item.includes('command_sha256')));
  assert.ok(validateRecord(record({ stdout_tail_sha256: '0'.repeat(64) })).some((item) => item.includes('stdout_tail_sha256')));
  assert.ok(validateRecord(record({ finished_at: '2026-08-30T00:00:00.000Z' })).some((item) => item.includes('finished_at cannot')));
  assert.ok(validateRecord(record({ status: 'unknown' })).some((item) => item.includes('status')));
  assert.ok(validateRecord(record({ status: 'skipped', skip_reason: null }), { requireComplete: true }).some((item) => item.includes('skip_reason')));
  assert.ok(validateRecord(record({ status: 'skipped', skip_reason: 'not available', exit_code: 0 }), { requireComplete: false }).some((item) => item.includes('cannot have')));
  assert.ok(validateRecord(record({ status: 'failed', exit_code: 0, timed_out: false })).some((item) => item.includes('failed evidence')));
  assert.deepEqual(validateRecord(record({ status: 'failed', exit_code: null, timed_out: false })), []);
  assert.deepEqual(validateRecord(record({ status: 'failed', exit_code: null, timed_out: true })), []);
  assert.ok(validateRecord(record({ status: 'passed', exit_code: 1 })).some((item) => item.includes('passed evidence')));
  assert.ok(validateRecord(record({ status: 'passed', exit_code: 0, timed_out: true })).some((item) => item.includes('passed evidence')));
  assert.ok(validateRecord(record({ status: 'passed', exit_code: 0, skip_reason: 'not actually run' })).some((item) => item.includes('passed evidence')));
  const pathRecordCommand = ['./node', '-e', 'process.exit(0)'];
  assert.ok(validateRecord(record({ command: pathRecordCommand, command_sha256: commandHash(pathRecordCommand) })).some((item) => item.includes('bare allowlisted')));
  assert.ok(validateRecord(record({ status: 'skipped', skip_reason: 'deferred' }), { requireComplete: true }).some((item) => item.includes('cannot close')));
  assert.ok(validateRecord(record({ status: 'skipped', skip_reason: 'deferred', exit_code: null, timed_out: true }), { requireComplete: false }).some((item) => item.includes('cannot have')));
  assert.ok(validateRecord(record({ stderr_tail: 'err', stderr_tail_sha256: '0'.repeat(64) })).some((item) => item.includes('stderr_tail_sha256')));
  const unicode = '🚀'.repeat(Math.ceil(MAX_TAIL / 4) + 1);
  assert.ok(validateRecord(record({ stdout_tail: unicode, stdout_tail_sha256: sha(unicode) })).some((item) => item.includes('no longer than')));
});

test('FALSIFICACIÓN · record rejects malformed fields without throwing', () => {
  assert.ok(validateRecord(null).some((item) => item.includes('must use')));
  assert.ok(validateRecord(record({ command: [] })).some((item) => item.includes('non-empty argv')));
  const bad = record({ command: ['curl'], cwd: '../x', git_head: 'not-hex', exit_code: 1.5, signal: '', timed_out: 'no', duration_ms: -1, stdout_tail: 'x'.repeat(MAX_TAIL + 1), started_at: 'bad', finished_at: 'bad', skip_reason: '' });
  const violations = validateRecord(bad);
  assert.ok(violations.length >= 8);
  const malformed = record({
    command: ['node', ''], git_head: 42, exit_code: '1', signal: 7, stdout_tail: 3, stderr_tail: null,
    stdout_tail_sha256: sha(''), stderr_tail_sha256: sha(''), started_at: 'bad', finished_at: 'bad',
  });
  assert.ok(validateRecord(malformed).length >= 8);
});

test('runEvidence records passed, failed, skipped and timeout results without shell execution', () => {
  const passed = runEvidence(request(), { cwd: repoRoot, now: (() => { let n = 0; return () => n += 5; })(), iso: () => '2026-08-31T10:00:00.000Z' });
  assert.equal(passed.violations.length, 0);
  assert.equal(passed.record.status, 'passed');
  assert.equal(passed.record.exit_code, 0);
  const failed = runEvidence(request({ command: ['node', '-e', 'console.error("bad"); process.exit(3)'] }), { cwd: repoRoot });
  assert.equal(failed.record.status, 'failed');
  assert.equal(failed.record.exit_code, 3);
  assert.match(failed.record.stderr_tail, /bad/);
  const skipped = runEvidence(request({ skip_reason: 'tool not available' }), { cwd: repoRoot, run: () => { throw new Error('must not run'); } });
  assert.equal(skipped.record.status, 'skipped');
  assert.equal(skipped.record.exit_code, null);

  const timeout = runEvidence(request({ timeout_ms: 1, command: ['node', '-e', 'setTimeout(() => {}, 1000)'] }), { cwd: repoRoot });
  assert.equal(timeout.record.status, 'failed');
  assert.equal(timeout.record.timed_out, true);
  const longOutput = runEvidence(request({ command: ['node', '-e', `process.stdout.write('x'.repeat(${MAX_TAIL + 100}))`] }), { cwd: repoRoot });
  assert.equal(longOutput.record.status, 'passed');
  assert.ok(Buffer.byteLength(longOutput.record.stdout_tail, 'utf8') <= MAX_TAIL);

  // Exercise missing stdout/stderr, a non-zero/invalid git probe, and the SIGTERM timeout path
  // without touching the real checkout.
  let gitProbe = 0;
  const injectedTimeout = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => {
      if (executable === 'git') return { status: gitProbe++ === 0 ? 1 : 0, stdout: 'not-a-commit' };
      return { status: null, signal: 'SIGTERM', stdout: undefined, stderr: undefined };
    },
  });
  assert.equal(injectedTimeout.record.status, 'failed');
  assert.equal(injectedTimeout.record.timed_out, true);
  assert.equal(injectedTimeout.record.git_head, null);
  const badHead = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => executable === 'git'
      ? { status: 0, stdout: 'not-a-commit' }
      : { status: 0, stdout: '', stderr: '' },
  });
  assert.equal(badHead.record.status, 'passed');
  assert.equal(badHead.record.git_head, null);
  const nullHead = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => executable === 'git' ? null : { status: 0, stdout: '', stderr: '' },
  });
  assert.equal(nullHead.record.git_head, null);
  const nullResult = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => executable === 'git' ? { status: 0, stdout: 'abcdef1234567' } : null,
  });
  assert.equal(nullResult.record.status, 'failed');
  assert.equal(nullResult.record.exit_code, null);
  const passedStatusTimedOut = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => executable === 'git'
      ? { status: 0, stdout: 'abcdef1234567' }
      : { status: 0, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' },
  });
  assert.equal(passedStatusTimedOut.record.status, 'failed');
  assert.equal(passedStatusTimedOut.record.timed_out, true);
  const signalled = runEvidence(request({ command: ['node', '-e', 'ignored'] }), {
    cwd: repoRoot,
    run: (executable) => executable === 'git'
      ? { status: 0, stdout: 'abcdef1234567' }
      : { status: 1, signal: 'SIGTERM', stdout: '', stderr: '' },
  });
  assert.equal(signalled.record.status, 'failed');
  assert.equal(signalled.record.timed_out, false);

  let observedGitCwd;
  const nested = runEvidence(request({ cwd: 'nested-project' }), {
    cwd: repoRoot,
    run: (executable, _args, options) => {
      if (executable === 'git') {
        observedGitCwd = options.cwd;
        return { status: 0, stdout: 'abcdef1234567' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.equal(nested.record.git_head, 'abcdef1234567');
  assert.equal(observedGitCwd, join(repoRoot, 'nested-project'));
});

test('runEvidence rejects invalid requests before running', () => {
  const result = runEvidence(request({ command: ['curl'] }));
  assert.equal(result.record, null);
  assert.ok(result.violations.some((item) => item.includes('allowlist')));
});

test('CLI records and checks a real command, including strict rejection of skipped evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-evidence-'));
  try {
    const req = join(dir, 'request.json');
    const rec = join(dir, 'record.json');
    writeFileSync(req, `${JSON.stringify(request())}\n`, 'utf8');
    const run = spawnSync(process.execPath, [script, 'run', req, rec], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const check = spawnSync(process.execPath, [script, 'check', rec, REQUIRE_COMPLETE_FLAG], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);

    const skipReq = join(dir, 'skip-request.json');
    const skipRec = join(dir, 'skip-record.json');
    writeFileSync(skipReq, `${JSON.stringify(request({ skip_reason: 'deferred by owner' }))}\n`, 'utf8');
    const skipRun = spawnSync(process.execPath, [script, 'run', skipReq, skipRec], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(skipRun.status, 0, skipRun.stderr);
    const strict = spawnSync(process.execPath, [script, 'check', skipRec, REQUIRE_COMPLETE_FLAG], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(strict.status, 1);
    assert.match(strict.stderr, /cannot close/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI handles invalid usage, malformed JSON, invalid request and write failure', () => {
  const errors = [];
  assert.equal(main([], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check', 'missing.json'], { writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['run', 'request.json', 'record.json'], { readFile: () => '{', writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['run', 'request.json', 'record.json'], { readFile: () => JSON.stringify(request({ command: ['curl'] })), writeError: (line) => errors.push(line) }), 1);
  assert.equal(main(['run', 'request.json', 'record.json'], { readFile: () => JSON.stringify(request()), writeFile: () => { throw new Error('disk full'); }, writeError: (line) => errors.push(line) }), 1);
  const writes = [];
  assert.equal(main(['run', 'request.json', 'record.json'], {
    readFile: () => JSON.stringify(request()),
    run: (executable) => executable === 'git' ? { status: 0, stdout: 'abcdef1234567' } : { status: 0, stdout: '', stderr: '' },
    writeFile: (_path, value) => writes.push(value),
    write: (line) => writes.push(line),
  }), 0);
  assert.match(writes.at(-1), /evidence recorded as passed/);
  assert.equal(main(['run', 'request.json'], { writeError: (line) => errors.push(line) }), 2);
  assert.equal(main(['check', 'record.json'], { readFile: () => JSON.stringify(record()), write: () => {} }), 0);
  assert.equal(main(['check', 'record.json', REQUIRE_COMPLETE_FLAG], { readFile: () => JSON.stringify(record()), write: () => {} }), 0);
  const strictErrors = [];
  assert.equal(main(['check', 'record.json', REQUIRE_COMPLETE_FLAG], {
    readFile: () => JSON.stringify(record({ status: 'skipped', skip_reason: 'deferred' })),
    writeError: (line) => strictErrors.push(line),
  }), 1);
  assert.match(strictErrors.at(-1), /cannot close/);
  assert.equal(main(['check', 'record.json', '--bad'], { readFile: () => JSON.stringify(record()), writeError: (line) => errors.push(line) }), 2);
});

test('CLI default entrypoint and direct run use controlled output', () => {
  const result = spawnSync(process.execPath, [script, 'check', 'missing.json'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EVIDENCE_RECORD_INVALID/);
});
