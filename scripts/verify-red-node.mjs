#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export const USAGE = 'usage: verify-red-node.mjs check --test <project-relative-test-file> --command "node --test"';
// Wording-only signal: it refines a rejection already decided elsewhere and can never cause one on
// its own. See the guard in classifyNodeRed for why that restriction exists and must stay.
const SYNTAX_SIGNAL = /SyntaxError|ParseError|Unexpected token|collection error|ERROR collecting|IndentationError/iu;
const TEST_PATH = /(?:^|\/)(?:test|tests|__tests__|spec|specs)\/|(?:\.|\/)(?:test|spec)\.[a-z]+$/iu;
const TAP_HEADER = /^TAP version 13$/mu;
const FOOTER_TESTS = /^# tests? (\d+)$/mu;
const FOOTER_FAIL = /^# fail (\d+)$/mu;
const NOT_OK_LINE = /^not ok \d+ - /u;
const BLOCK_ASSERTION_LINE = "  code: 'ERR_ASSERTION'";
const HOST_ENVIRONMENT_KEYS = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive', 'ComSpec', 'PATHEXT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR'];
const EXPLICIT_ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]*$/u;

export function normalizeProjectPath(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const path = value.trim().replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '').replace(/\/+/gu, '/');
  if (path === '' || path.startsWith('/') || /^[A-Za-z]:\//u.test(path) || path.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  return path;
}

export function isTestPath(value) {
  const path = normalizeProjectPath(value);
  return path !== null && TEST_PATH.test(path);
}

function contained(root, candidate) {
  const path = relative(root, candidate);
  if (path === '') return true;
  if (/^\.\.(?:[\\/]|$)/u.test(path)) return false;
  return !/^(?:[A-Za-z]:[\\/]|\\\\)/u.test(path);
}

export function isContainedProjectPath(value, cwd = '.') {
  const normalized = normalizeProjectPath(value);
  if (!normalized) return false;
  let root;
  try {
    root = realpathSync(cwd);
  } catch {
    return false;
  }
  let probe = join(root, ...normalized.split('/'));
  while (true) {
    try {
      return contained(root, realpathSync(probe));
    } catch {
      try {
        if (lstatSync(probe).isSymbolicLink()) return false;
      } catch {
        // A non-existent path is safe only if its closest existing ancestor is contained.
      }
      probe = dirname(probe);
    }
  }
}

/**
 * Target test files are executable project code. Do not pass every secret from the parent agent
 * process into that code by default: only OS bootstrap variables survive, plus names an operator
 * explicitly opts into with VCP_RED_ENV_ALLOW=NAME_A,NAME_B. NODE_* values are never forwarded
 * because NODE_OPTIONS/NODE_PATH can alter the runner itself. This reduces ambient-secret leaks;
 * it is deliberately NOT a filesystem, network, or process sandbox for an untrusted project.
 */
export function redTestEnvironment(source = process.env) {
  const environment = {};
  for (const key of HOST_ENVIRONMENT_KEYS) {
    if (typeof source[key] === 'string') environment[key] = source[key];
  }
  const allowed = typeof source.VCP_RED_ENV_ALLOW === 'string' ? source.VCP_RED_ENV_ALLOW.split(',') : [];
  for (const rawName of allowed) {
    const name = rawName.trim();
    if (EXPLICIT_ENVIRONMENT_NAME.test(name) && !name.startsWith('NODE_') && typeof source[name] === 'string') {
      environment[name] = source[name];
    }
  }
  return environment;
}

/**
 * Extract the diagnostic YAML blocks Node's own TAP harness writes between an unindented
 * `  ---`/`  ...` pair, requiring the line immediately before `  ---` to be a real `not ok N - `
 * line (also unindented) so an isolated or misplaced block is never mistaken for one that
 * actually documents a failing subtest. This position/indentation is produced exclusively by the
 * harness itself: everything the test FILE prints to stdout is captured and re-emitted by Node as
 * `#`-prefixed TAP comments (with any literal `#` in the file's own text escaped to `\#`), so a
 * forged copy of these exact two-space-indented, unprefixed lines is not reachable from inside
 * the process under test — confirmed by falsification against several vectors (direct
 * console.log, process.stdout/stderr.write, and a child process spawned with stdio:'inherit'
 * piping a real, unrelated TAP failure) — see tests/verify-red-node.test.mjs and
 * research/adversarial-productivity-audit-2026-08-23.md.
 *
 * Only ever called with `result.stdout` — never with stderr concatenated in — since TAP is
 * exclusively a stdout protocol; deciding evidence from stderr would let the caller feed
 * arbitrary unstructured text into the same decision path.
 */
export function realDiagnosticBlocks(output) {
  const lines = output.split(/\r?\n/u);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== '  ---') continue;
    const precedingLine = lines[index - 1] ?? '';
    let end = index + 1;
    while (end < lines.length && lines[end] !== '  ...') end += 1;
    if (end < lines.length && NOT_OK_LINE.test(precedingLine)) blocks.push(lines.slice(index + 1, end));
    index = end;
  }
  return blocks;
}

function tapFooter(output) {
  const tests = output.match(FOOTER_TESTS);
  const fail = output.match(FOOTER_FAIL);
  if (!tests || !fail) return null;
  return { tests: Number(tests[1]), fail: Number(fail[1]) };
}

/**
 * Accepts RED only on structural, harness-produced evidence that a real `node:test` `test()`
 * callback failed with a metadata shape matching `AssertionError` (`code: 'ERR_ASSERTION'` inside
 * a diagnostic block genuinely associated with a `not ok` line). Two evidence classes accepted by
 * an earlier version of this gate — regex matches over raw merged stdout/stderr for local-module
 * and SUT-runtime signals — were REMOVED after adversarial falsification showed the same class
 * of forgery (a script that never imports `node:test`, just prints matching text and exits
 * non-zero) defeats any check based on unstructured process output. This is a deliberately
 * narrower gate: a legitimate RED that crashes via an uncaught runtime error or a missing import,
 * rather than a `test()` assertion, is no longer accepted here — wrap the expected failure in a
 * real assertion (`assert.throws`, `assert.rejects`) to get a valid RED.
 *
 * HONEST LIMIT (do not oversell): this proves a real `test()` failed with metadata shaped like an
 * `AssertionError` — it is deliberately NOT called "a genuine assertion failure", because it
 * isn't proven to be one. The `code` field on the block's error object is still an ordinary JS
 * property on whatever object the test file's `test()` callback throws. A test file that manually
 * constructs `Object.assign(new Error('x'), { code: 'ERR_ASSERTION' })` and throws it from inside
 * a real `test()` reproduces this exact structural shape — confirmed by falsification, see
 * tests/verify-red-node.test.mjs. No signal available from the tested process's own stdout can
 * distinguish that from a genuine `node:assert` failure, because the process under test is the
 * same process whose author controls the artifact being verified. This gate closes trivial
 * forgery (no real `test()`, printed/faked TAP text, an unassociated diagnostic block, evidence
 * smuggled through stderr); it does not provide cryptographic proof of a genuine assertion. That
 * residual gap is a protocol/review responsibility, not a technical one — see README.md "Gates
 * que sí son código".
 */
export function classifyNodeRed(result) {
  const stdout = result.stdout ?? '';
  const output = `${stdout}${result.stderr ?? ''}`;
  if (result.error) return { ok: false, output, reason: `Node test runner could not launch: ${result.error.message}` };
  if (result.status === 0) return { ok: false, output, reason: 'tests passed (exit 0), so this is not RED' };
  if (!TAP_HEADER.test(stdout)) return { ok: false, output, reason: 'Node did not produce a genuine TAP-native test run on stdout (no framework header)' };
  const footer = tapFooter(stdout);
  if (!footer || footer.tests < 1 || footer.fail < 1) {
    return { ok: false, output, reason: 'no genuine TAP harness footer on stdout reporting at least one collected, failing test' };
  }
  // SYNTAX_SIGNAL may only speak when there is NO ERR_ASSERTION block, and that ordering is the
  // whole point: a file that does not parse never reaches an assert, so it cannot produce one.
  // Run unconditionally over raw output — as it was before — the signal also matched the TEST
  // TITLES the harness echoes on that same stdout, so a perfectly valid test named "maneja un
  // collection error del runner" was rejected with "the test file failed to parse/load", a claim
  // that was simply false about a file that compiled fine. That cost a real task: it blocked T02
  // until an existing, unrelated test was renamed ("source-collection errors" →
  // "source-collection failures") just to get past the gate. Do not hoist this check back above
  // the assertion-block check without re-reading finding 51 in
  // research/adversarial-productivity-audit-2026-08-23.md. Nothing is loosened: the broken file
  // this signal protects against still falls right here, rejected for having no assertion block,
  // and still gets the specific parse-failure wording instead of the generic one.
  if (!realDiagnosticBlocks(stdout).some((block) => block.includes(BLOCK_ASSERTION_LINE))) {
    const reason = SYNTAX_SIGNAL.test(output)
      ? 'the test file failed to parse/load, not a valid RED'
      : 'no test() failure on stdout with an AssertionError-shaped diagnostic block associated to its own not-ok line';
    return { ok: false, output, reason };
  }
  return { ok: true, output, reason: 'Node-native TAP runner registered a real test() that failed with AssertionError-shaped metadata (not proof the assertion itself is genuine — see doc comment)' };
}

export function verifyNodeRed({ testPath, command, cwd = '.', run = spawnSync, read = readFileSync, environment = process.env }) {
  const normalized = normalizeProjectPath(testPath);
  if (!normalized || !isTestPath(normalized)) return { ok: false, reason: 'test path must be a project-relative, literal test file' };
  if (!isContainedProjectPath(normalized, cwd)) return { ok: false, reason: 'test path resolves outside the project or through a dangling link' };
  if (command !== 'node --test') return { ok: false, reason: 'unsupported runner command; only exact "node --test" is currently verified' };
  const fullPath = join(cwd, normalized);
  if (!existsSync(fullPath)) return { ok: false, reason: `test file does not exist: ${normalized}` };
  try {
    read(fullPath, 'utf8');
  } catch (error) {
    return { ok: false, reason: `test file cannot be read: ${error.message}` };
  }
  const result = run(process.execPath, ['--test', '--test-reporter=tap', normalized], { cwd, encoding: 'utf8', env: redTestEnvironment(environment) });
  return classifyNodeRed(result);
}

function parseArgs(args) {
  if (args.length !== 5 || args[0] !== 'check' || args[1] !== '--test' || args[3] !== '--command') return null;
  return { testPath: args[2], command: args[4] };
}

export function main(args = process.argv.slice(2), options = {}) {
  const parsed = parseArgs(args);
  if (!parsed) {
    (options.writeError ?? console.error)(USAGE);
    return 2;
  }
  const result = verifyNodeRed({ ...parsed, cwd: options.cwd ?? '.' });
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  if (!result.ok) {
    if (result.output) writeError(result.output.trim());
    writeError(`REJECTED: ${result.reason}`);
    return 1;
  }
  write('OK: RED gate passed — Node-native runner registered a real test() failing with AssertionError-shaped metadata.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-red-node.mjs')) {
  process.exitCode = main();
}
