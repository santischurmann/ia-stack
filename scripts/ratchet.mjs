#!/usr/bin/env node
// ratchet.mjs — freezes today's technical debt count, fails only if it GROWS.
//
// WHY A RATCHET AND NOT A CLEAN GATE. A gate that demands zero debt can never be turned on: if a
// project has 37 stray hex colors today, a strict gate is red from day one and gets disabled
// within a week. Freezing today's number and forbidding it from going up is the part that pays
// for itself — it doesn't fix the old debt, but it guarantees new code is born clean.
//
// SOURCE: adopted from nahuelangeles/protocolo `gates/ratchet.mjs` (research/sources/
// protocolo-muralla.md, point #4) — real measurement that motivated it, from that repo's own
// use: where no new code was written, a fixed count held (167 fractional sizes -> 0 -> 0);
// where new surface was added, the debt came back (50 -> 0 -> 29) because nothing covered it.
//
// Counters are declared in `.vibe/counters.json` (see templates/vibe/counters.json) as
// {name, pattern, include, exclude} — regex over versioned files, glob-filtered. This is opt-in:
// VCP does not ship a default counter set, a project only gets this gate once it declares what
// to watch.

import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/** One counter: what to search for, where, and its report name. */
export class Counter {
  constructor({ name, pattern, include, exclude = [] }) {
    this.name = name;
    this.pattern = pattern;
    this.include = include;
    this.exclude = exclude;
  }
}

/**
 * Count occurrences of each counter over an already-read file set.
 *
 * Takes files as `[{ path, content }]` instead of reading them internally so this function can
 * be exercised with synthetic fixtures in a test, without touching disk — a gate whose logic
 * can't be unit-tested is a gate that lies about what it checks.
 */
export function count(files, counters) {
  const total = {};
  for (const c of counters) {
    total[c.name] = 0;
    for (const { path, content } of files) {
      if (!applies(path, c)) continue;
      const re = new RegExp(c.pattern, 'g');
      const found = content.match(re);
      if (found) total[c.name] += found.length;
    }
  }
  return total;
}

function applies(path, counter) {
  const norm = path.replace(/\\/g, '/');
  if (!counter.include.some((g) => matches(norm, g))) return false;
  if (counter.exclude.some((g) => matches(norm, g))) return false;
  return true;
}

/**
 * Minimal glob: `*` (within a path segment) and `**` (any depth, including zero segments).
 *
 * `**\/` must match a root-level file too (e.g. `**\/*.js` has to match `a.js`, not just
 * `src/a.js`) — a naive `split('**').join('.*')` builds a regex that requires a literal `/`
 * wherever `**\/` appeared, which silently excludes every root-level file from every glob that
 * starts with `**\/`. Caught by this file's own falsification test freezing a baseline of 0 for a
 * file that visibly had a match — see FALSIFICACIÓN test history in tests/ratchet.test.mjs.
 */
export function matches(path, glob) {
  let pattern = '';
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith('**/', i)) {
      pattern += '(?:.*/)?';
      i += 3;
      continue;
    }
    if (glob.startsWith('**', i)) {
      pattern += '.*';
      i += 2;
      continue;
    }
    const ch = glob[i];
    pattern += ch === '*' ? '[^/]*' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i++;
  }
  return new RegExp(`^${pattern}$`).test(path);
}

/**
 * Compares current counts against the frozen baseline.
 *
 * Returns `{ ok, grew, shrank, newCounters }`. A counter that SHRANK isn't an error — it's the
 * goal — but it's reported so the baseline can be re-frozen to lock in the improvement.
 */
export function compare(current, baseline) {
  const grew = [];
  const shrank = [];
  const newCounters = [];
  for (const [name, value] of Object.entries(current)) {
    if (!(name in baseline)) {
      newCounters.push({ name, value });
      continue;
    }
    if (value > baseline[name]) grew.push({ name, baseline: baseline[name], current: value });
    else if (value < baseline[name]) shrank.push({ name, baseline: baseline[name], current: value });
  }
  return { ok: grew.length === 0 && newCounters.length === 0, grew, shrank, newCounters };
}

export function isWithin(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder !== '' && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

export function safeProjectFile(root, path, { allowMissing = false } = {}) {
  const file = resolve(root, path);
  if (!isWithin(root, file)) throw new Error(`ratchet path escapes the project: ${path}`);
  if (!existsSync(file)) {
    if (!allowMissing) return null;
    let ancestor = dirname(file);
    while (!existsSync(ancestor)) ancestor = dirname(ancestor);
    if (realpathSync(ancestor) !== root && !isWithin(root, realpathSync(ancestor))) {
      throw new Error(`ratchet path resolves outside the project: ${path}`);
    }
    return file;
  }
  const stat = lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`ratchet path is not a regular project file: ${path}`);
  if (!isWithin(root, realpathSync(file))) throw new Error(`ratchet path resolves outside the project: ${path}`);
  return file;
}

/** Versioned plus untracked, non-ignored files; a pre-commit ratchet must see new code too. */
export function repoFiles(root = '.') {
  const projectRoot = realpathSync(root);
  const tracked = execFileSync('git', ['-C', projectRoot, 'ls-files', '-z'], { encoding: 'utf8' });
  const untracked = execFileSync('git', ['-C', projectRoot, 'ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  return [...new Set(`${tracked}${untracked}`
    .split('\0')
    .filter(Boolean))]
    .map((path) => {
      try {
        const file = safeProjectFile(projectRoot, path);
        return file ? { path, content: readFileSync(file, 'utf8') } : null;
      } catch (error) { throw error; }
    })
    .filter(Boolean);
}

export function main(argv = process.argv.slice(2), cwd = '.', io = { readFile: readFileSync, writeFile: writeFileSync }) {
  let root;
  let configPath;
  let baselinePath;
  try {
    root = realpathSync(cwd);
    configPath = safeProjectFile(root, '.vibe/counters.json', { allowMissing: true });
    baselinePath = safeProjectFile(root, '.vibe/counters-baseline.json', { allowMissing: true });
  } catch (error) {
    console.error(`REJECTED: unable to locate project-local ratchet state safely: ${error.message}`);
    return 1;
  }

  if (!existsSync(configPath)) {
    console.error(`${configPath} does not exist. No counters declared, nothing to ratchet — this gate is opt-in, see templates/vibe/counters.json.`);
    return 2;
  }

  let counters;
  let current;
  try {
    counters = JSON.parse(io.readFile(configPath, 'utf8')).counters.map((c) => new Counter(c));
    current = count(repoFiles(root), counters);
  } catch (error) {
    console.error(`REJECTED: unable to read the ratchet release surface safely: ${error.message}`);
    return 1;
  }

  if (argv.includes('--freeze')) {
    try {
      io.writeFile(baselinePath, JSON.stringify(current, null, 2) + '\n');
    } catch (error) {
      console.error(`REJECTED: unable to write a project-local ratchet baseline safely: ${error.message}`);
      return 1;
    }
    console.log('Baseline frozen:');
    for (const [n, v] of Object.entries(current)) console.log(`  ${n}: ${v}`);
    return 0;
  }

  if (!existsSync(baselinePath)) {
    console.error(`${baselinePath} does not exist. Freeze it first: node scripts/ratchet.mjs --freeze`);
    return 2;
  }

  let baseline;
  try {
    baseline = JSON.parse(io.readFile(baselinePath, 'utf8'));
  } catch (error) {
    console.error(`REJECTED: unable to read the ratchet baseline safely: ${error.message}`);
    return 1;
  }
  const { ok, grew, shrank, newCounters } = compare(current, baseline);

  for (const s of shrank) {
    console.log(`↓ ${s.name}: ${s.baseline} → ${s.current}. Re-freeze with --freeze to lock it in.`);
  }
  for (const n of newCounters) {
    console.error(`✗ ${n.name}: new counter (${n.value}) with no baseline.`);
  }
  for (const g of grew) {
    console.error(`✗ ${g.name}: ${g.baseline} → ${g.current} (+${g.current - g.baseline})`);
  }

  if (!ok) {
    console.error('\nThe ratchet does not turn backwards: new code has to be born clean.');
    return 1;
  }
  console.log('✓ No counter grew.');
  return 0;
}

// Only runs when invoked directly, not when imported by a test.
if (process.argv[1] && process.argv[1].endsWith('ratchet.mjs')) {
  process.exit(main());
}
