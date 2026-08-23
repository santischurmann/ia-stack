#!/usr/bin/env node
// Strict Node-native RED adapter. It deliberately accepts one runner invocation only:
// `node --test <literal-test-file>`. A generic regex over arbitrary command output can be
// forged by a wrapper, so unsupported runners block until they get their own tested adapter.

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export const USAGE = 'usage: verify-red-node.mjs check --test <project-relative-test-file> --command "node --test"';
const ASSERTION_SIGNAL = /AssertionError|assert\.|assert_|expect\(/iu;
const TEST_BUG_SIGNAL = /NameError|ReferenceError|is not defined|is not a function/iu;
const SYNTAX_SIGNAL = /SyntaxError|ParseError|Unexpected token|collection error|ERROR collecting|IndentationError/iu;
const FRAMEWORK_SIGNAL = /\btests?\s+[0-9]+\b|\b(pass|fail)\s+[0-9]+\b|[0-9]+\s+(passed|failed|failing)\b|Ran [0-9]+ test|collected [0-9]+ item/iu;
const TEST_PATH = /(?:^|\/)(?:test|tests|__tests__|spec|specs)\/|(?:\.|\/)(?:test|spec)\.[a-z]+$/iu;

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

/** Reject lexical escapes and physical escapes through a live or dangling symbolic link. */
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

function localModuleEvidence(output) {
  const match = output.match(/Cannot find module '([^']+)'/iu);
  if (!match || /node_modules|Cannot find package/iu.test(output)) return false;
  return /^(?:\.\.?[\\/]|[\\/]|[A-Za-z]:[\\/]|\\\\)/u.test(match[1]);
}

function sutRuntimeEvidence(output, testPath, testSource) {
  if (!ASSERTION_SIGNAL.test(testSource)) return false;
  const testBase = testPath.split('/').at(-1);
  return output.split(/\r?\n/u).some((line) => {
    if (!/^\s+at\s+/u.test(line)) return false;
    if (line.includes('node:') || line.includes('node_modules') || line.includes(`${testBase}:`)) return false;
    return /\((?:file:|[A-Za-z]:|\.?[\\/]).*:\d+:\d+\)/u.test(line);
  });
}

/** Classify output that was produced by the Node-native invocation below, never an arbitrary shell. */
export function classifyNodeRed({ testPath, testSource, result }) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) return { ok: false, output, reason: `Node test runner could not launch: ${result.error.message}` };
  if (result.status === 0) return { ok: false, output, reason: 'tests passed (exit 0), so this is not RED' };
  if (SYNTAX_SIGNAL.test(output)) return { ok: false, output, reason: 'the test file failed to parse/load, not a valid RED' };
  if (/no tests found|no test files|0 tests? (?:found|collected|ran)|collected 0 items?|0 passing, 0 failing/iu.test(output)) {
    return { ok: false, output, reason: 'no tests were collected' };
  }
  if (!FRAMEWORK_SIGNAL.test(output)) return { ok: false, output, reason: 'Node did not report a collected test run' };
  if (TEST_BUG_SIGNAL.test(output) && !ASSERTION_SIGNAL.test(output) && !localModuleEvidence(output)) {
    return { ok: false, output, reason: 'output indicates a probable test-code bug, not a SUT failure' };
  }
  if (ASSERTION_SIGNAL.test(output) || localModuleEvidence(output) || sutRuntimeEvidence(output, testPath, testSource)) {
    return { ok: true, output, reason: 'Node-native runner executed the requested test and produced valid RED evidence' };
  }
  return { ok: false, output, reason: 'no accepted assertion, local-module, or SUT-runtime RED evidence' };
}

export function verifyNodeRed({ testPath, command, cwd = '.', run = spawnSync, read = readFileSync }) {
  const normalized = normalizeProjectPath(testPath);
  if (!normalized || !isTestPath(normalized)) return { ok: false, reason: 'test path must be a project-relative, literal test file' };
  if (!isContainedProjectPath(normalized, cwd)) return { ok: false, reason: 'test path resolves outside the project or through a dangling link' };
  if (command !== 'node --test') return { ok: false, reason: 'unsupported runner command; only exact "node --test" is currently verified' };
  const fullPath = join(cwd, normalized);
  if (!existsSync(fullPath)) return { ok: false, reason: `test file does not exist: ${normalized}` };
  let testSource;
  try {
    testSource = read(fullPath, 'utf8');
  } catch (error) {
    return { ok: false, reason: `test file cannot be read: ${error.message}` };
  }
  const result = run(process.execPath, ['--test', normalized], { cwd, encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
  return classifyNodeRed({ testPath: normalized, testSource, result });
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
  write('OK: RED gate passed — Node-native runner proved the requested test is genuinely RED.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-red-node.mjs')) {
  process.exitCode = main();
}
