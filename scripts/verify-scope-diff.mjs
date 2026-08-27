#!/usr/bin/env node
// Verifies that a task's real Git delta stays inside its declared writer set.
// This is intentionally separate from verify-receipt.mjs: a receipt proves the evaluated
// tree fingerprint, while this gate proves that the task plan and the observed paths agree.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { posix, relative, resolve, sep } from 'node:path';

export const USAGE = 'usage: verify-scope-diff.mjs check --tasks <tasks.json> --task <task-id> --base <git-ref> [--ignore <project-relative-path>]...';
const WRITE_FIELDS = ['files_to_create', 'files_to_modify', 'test_files'];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Canonical project-relative path used for both plan declarations and Git output. */
export function normalizeProjectPath(value, label = 'path') {
  if (!nonEmpty(value)) throw new Error(`${label} must be a non-empty string`);
  const input = value.trim().replaceAll('\\', '/').replace(/^(\.\/)+/u, '').replace(/\/{2,}/g, '/');
  const normalized = posix.normalize(input);
  if (normalized === '' || normalized === '.' || normalized.startsWith('/') || /^[a-z]:\//iu.test(normalized)
    || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} is not a safe project-relative path: ${value}`);
  }
  return normalized.toLowerCase();
}

function readPlan(tasksPath, read = readFileSync) {
  let plan;
  try {
    plan = JSON.parse(read(tasksPath, 'utf8'));
  } catch (error) {
    throw new Error(`tasks plan is not valid JSON: ${error.message}`);
  }
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.tasks)) {
    throw new Error('tasks plan must contain a tasks array');
  }
  return plan;
}

export function taskWriterSet(plan, taskId) {
  if (!nonEmpty(taskId)) throw new Error('task id must be a non-empty string');
  const matches = plan.tasks.filter((task) => task && task.id === taskId);
  if (matches.length === 0) throw new Error(`task not found: ${taskId}`);
  if (matches.length > 1) throw new Error(`duplicate task id: ${taskId}`);
  const task = matches[0];
  const planned = new Set();
  for (const field of WRITE_FIELDS) {
    if (!Array.isArray(task[field])) throw new Error(`${taskId}.${field} must be an array`);
    for (const value of task[field]) {
      const path = normalizeProjectPath(value, `${taskId}.${field}`);
      if (planned.has(path)) throw new Error(`${taskId} declares duplicate writer path: ${path}`);
      planned.add(path);
    }
  }
  if (planned.size === 0) throw new Error(`${taskId} declares no writer paths`);
  return { task, planned };
}

function gitText(cwd, args, runGit = execFileSync) {
  const value = runGit('git', ['-C', cwd, ...args], { encoding: 'buffer' });
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

export function changedProjectPaths(cwd, base, runGit = execFileSync) {
  if (!nonEmpty(base)) throw new Error('base Git ref must be a non-empty string');
  let tracked;
  let untracked;
  try {
    tracked = gitText(cwd, ['diff', '--name-status', '--find-renames', '-z', base, '--'], runGit);
    untracked = gitText(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], runGit);
  } catch (error) {
    throw new Error(`unable to inspect Git diff from ${base}: ${error.message}`);
  }
  const paths = new Set();
  const trackedTokens = tracked.split('\0');
  for (let index = 0; index < trackedTokens.length;) {
    const status = trackedTokens[index++];
    if (!status) continue;
    const source = trackedTokens[index++];
    if (!source) throw new Error(`Git returned a tracked change without a path: ${status}`);
    const statusLetter = status[0];
    const destination = statusLetter === 'R' || statusLetter === 'C' ? trackedTokens[index++] : source;
    if (!destination) throw new Error(`Git returned an incomplete ${statusLetter} record`);
    if (statusLetter === 'R') paths.add(normalizeProjectPath(source, 'Git changed path'));
    paths.add(normalizeProjectPath(destination, 'Git changed path'));
  }
  for (const token of untracked.split('\0')) {
    if (token !== '') paths.add(normalizeProjectPath(token, 'Git changed path'));
  }
  return paths;
}

export function compareScope(planned, changed, ignored = new Set()) {
  const expected = new Set([...planned].filter((path) => !ignored.has(path)));
  const observed = new Set([...changed].filter((path) => !ignored.has(path)));
  const missing = [...expected].filter((path) => !observed.has(path)).sort();
  const extra = [...observed].filter((path) => !expected.has(path)).sort();
  return { ok: missing.length === 0 && extra.length === 0, missing, extra, expected, observed };
}

function validateIgnoredPaths(cwd, values, read = readFileSync, stat = lstatSync, realpath = realpathSync) {
  const ignored = new Set();
  const root = realpath(cwd);
  for (const value of values) {
    const normalized = normalizeProjectPath(value, 'ignore path');
    const candidate = resolve(root, normalized);
    if (existsSync(candidate)) {
      const info = stat(candidate);
      if (info.isSymbolicLink()) throw new Error(`ignore path is a symbolic link: ${value}`);
      if (!info.isFile()) throw new Error(`ignore path is not a regular file: ${value}`);
      const physical = relative(root, realpath(candidate));
      if (!physical || physical === '..' || physical.startsWith(`..${sep}`)) {
        throw new Error(`ignore path resolves outside the project: ${value}`);
      }
      // A read proves the path is accessible before it is allowed to hide a real delta.
      read(candidate);
    }
    ignored.add(normalized);
  }
  return ignored;
}

export function verifyScope({ tasksPath, taskId, base, cwd = '.', ignores = [], read = readFileSync, runGit = execFileSync, stat = lstatSync, realpath = realpathSync } = {}) {
  const plan = readPlan(tasksPath, read);
  const { planned } = taskWriterSet(plan, taskId);
  const ignored = validateIgnoredPaths(cwd, ignores, read, stat, realpath);
  const changed = changedProjectPaths(cwd, base, runGit);
  const result = compareScope(planned, changed, ignored);
  return { ...result, taskId, base, ignored };
}

function parseArgs(args) {
  if (args[0] !== 'check') return null;
  const values = { ignores: [] };
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--ignore') {
      if (!args[index + 1]) return null;
      values.ignores.push(args[++index]);
      continue;
    }
    if (!['--tasks', '--task', '--base'].includes(option) || !args[index + 1] || values[option]) return null;
    values[option] = args[++index];
  }
  if (!values['--tasks'] || !values['--task'] || !values['--base']) return null;
  return { tasksPath: values['--tasks'], taskId: values['--task'], base: values['--base'], ignores: values.ignores };
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error) {
  const parsed = parseArgs(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  try {
    const result = verifyScope({ ...parsed, cwd });
    if (!result.ok) {
      if (result.extra.length > 0) writeError(`REJECTED: changed paths outside ${result.taskId}: ${result.extra.join(', ')}`);
      if (result.missing.length > 0) writeError(`REJECTED: planned paths not changed for ${result.taskId}: ${result.missing.join(', ')}`);
      return 1;
    }
    write(`OK: scope matches real Git delta for ${result.taskId} against ${result.base} (${result.observed.size} path(s)).`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-scope-diff.mjs')) process.exitCode = main();
