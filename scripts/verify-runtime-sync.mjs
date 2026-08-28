#!/usr/bin/env node
// Proves the runtime a project actually executes is the runtime this checkout ships.
//
// THE WOUND (2026-08-27, first end-to-end run of VCP on itself, finding 53): the Discovery gate
// rejected a perfectly valid snapshot with DISCOVERY_SNAPSHOT_INVALID when run from
// .vibe/vcp-runtime/scripts/, and accepted the very same evidence when run from scripts/. The
// evidence was never the problem — the installed copy was simply older than the source, and
// nothing anywhere said so. It cost a long detour re-reading valid evidence looking for a defect
// that lived in a stale file copy. install.sh copies the runtime into each project once; from then
// on the copy silently ages, and a project can keep running gates whose defects were already
// fixed upstream — including, at the time this gate was written, an old verify-red-node.mjs.
//
// HONEST LIMIT (do not oversell): this detects that the installed copy DIFFERS from this source
// checkout. It does not prove the runtime is correct, nor that the source is — two identical
// copies of a broken gate pass here. It compares file CONTENT only: the executable bit install.sh
// sets on runtime/scripts/*.sh is not checked, so a runtime whose shell scripts lost +x still
// passes. And it can only speak where both sides exist on one machine: a consumer project without
// the VibeCodeProtocols checkout beside it has no source to compare against, and the freshness of
// its runtime stays simply unverified.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const USAGE = 'usage: verify-runtime-sync.mjs check [--runtime <path>] [--require-inputs]';
export const DEFAULT_RUNTIME_PATH = '.vibe/vcp-runtime';
export const NO_INPUTS_CODE = 'RUNTIME_SYNC_NO_INPUTS';
export const EMPTY_PREFIX = 'VACÍO: ';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';

// Derived from copy_runtime() in scripts/install.sh and Copy-Runtime in scripts/install.ps1 — not
// invented here. tests/verify-runtime-sync.test.mjs parses both installers and fails if either one
// starts copying something this list does not name, so the surface can never drift into a guess.
export const COPIED_DIRECTORIES = ['scripts', 'contracts', 'tests', 'templates', 'skills'];
export const COPIED_FILES = ['SKILL.md', 'SECURITY.md'];

export function parseArguments(args) {
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  const rest = requireInputs ? args.slice(0, -1) : args;
  if (rest[0] !== 'check') return null;
  if (rest.length === 1) return { runtime: null, requireInputs };
  if (rest.length === 3 && rest[1] === '--runtime' && rest[2].trim() !== '') return { runtime: rest[2], requireInputs };
  return null;
}

export function statKind(path, stat = statSync) {
  const info = stat(path, { throwIfNoEntry: false });
  if (info === undefined) return 'absent';
  return info.isDirectory() ? 'directory' : 'file';
}

/** Everything copy_runtime() would need to read here. Empty means: this really is a source checkout. */
export function missingSourceRoots(root, stat = statSync) {
  const absent = [];
  for (const directory of COPIED_DIRECTORIES) {
    if (statKind(join(root, directory), stat) !== 'directory') absent.push(`${directory}/`);
  }
  for (const file of COPIED_FILES) {
    if (statKind(join(root, file), stat) !== 'file') absent.push(file);
  }
  return absent;
}

function walk(directory, prefix, found, readdir) {
  for (const entry of readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walk(join(directory, entry.name), relative, found, readdir);
    else found.push(relative);
  }
  return found;
}

/**
 * Content hash per copied file, keyed by POSIX-relative path so both sides compare on Windows too.
 * A directory absent under `root` contributes nothing rather than throwing: on the runtime side
 * that absence is a finding for the caller to report, not a crash that hides the other findings.
 */
export function readInventory(root, io = {}) {
  const { stat = statSync, readdir = readdirSync, read = readFileSync } = io;
  const relatives = [];
  for (const directory of COPIED_DIRECTORIES) {
    if (statKind(join(root, directory), stat) === 'directory') walk(join(root, directory), directory, relatives, readdir);
  }
  for (const file of COPIED_FILES) {
    if (statKind(join(root, file), stat) === 'file') relatives.push(file);
  }
  const inventory = new Map();
  for (const relative of relatives.sort()) {
    try {
      inventory.set(relative, createHash('sha256').update(read(join(root, ...relative.split('/')))).digest('hex'));
    } catch (error) {
      // Never degrade an unreadable file into "no difference": that would turn a broken runtime
      // into a green gate, which is the exact blindness this whole script exists to remove.
      throw new Error(`cannot read ${relative} under ${root}: ${error.message}`);
    }
  }
  return inventory;
}

/**
 * Pure set/hash comparison. `extra` matters as much as the other two: a file the source no longer
 * ships is usually a gate that was deleted upstream and that the project still executes.
 */
export function compareInventories(source, runtime) {
  const differing = [];
  const missing = [];
  const extra = [];
  for (const [relative, hash] of source) {
    if (!runtime.has(relative)) missing.push(relative);
    else if (runtime.get(relative) !== hash) differing.push(relative);
  }
  for (const relative of runtime.keys()) {
    if (!source.has(relative)) extra.push(relative);
  }
  return {
    ok: differing.length === 0 && missing.length === 0 && extra.length === 0,
    compared: source.size,
    differing: differing.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
  };
}

export function main(args = process.argv.slice(2), cwd = '.', io = {}, write = console.log, writeError = console.error) {
  const parsed = parseArguments(args);
  if (!parsed) {
    writeError(USAGE);
    return 2;
  }
  const stat = io.stat ?? statSync;
  const runtimeRoot = parsed.runtime === null
    ? join(cwd, ...DEFAULT_RUNTIME_PATH.split('/'))
    : resolve(cwd, parsed.runtime);
  if (statKind(runtimeRoot, stat) !== 'directory') {
    // A path the operator named explicitly and that is not a runtime is a mistake worth failing on:
    // a typo there would otherwise leave this gate permanently, silently green.
    if (parsed.runtime !== null) {
      writeError(`REJECTED: --runtime does not name an installed runtime directory: ${parsed.runtime}`);
      return 1;
    }
    const message = `no runtime installed at ${DEFAULT_RUNTIME_PATH} — nothing to compare (a source checkout without an installed runtime is normal).`;
    if (parsed.requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${message}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${message}`);
    return 0;
  }
  const absent = missingSourceRoots(cwd, stat);
  if (absent.length > 0) {
    writeError(`REJECTED: this directory is not a VibeCodeProtocols source checkout (missing: ${absent.join(', ')}) — run the gate from the checkout the runtime was installed from, or point --runtime at the project runtime from there.`);
    return 1;
  }
  let result;
  try {
    result = compareInventories(readInventory(cwd, io), readInventory(runtimeRoot, io));
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
  if (!result.ok) {
    if (result.differing.length > 0) writeError(`REJECTED: installed runtime files that differ from this source: ${result.differing.join(', ')}`);
    if (result.missing.length > 0) writeError(`REJECTED: source files absent from the installed runtime: ${result.missing.join(', ')}`);
    if (result.extra.length > 0) writeError(`REJECTED: installed runtime files this source no longer has: ${result.extra.join(', ')}`);
    writeError('Fix: reinstall the runtime from this checkout — scripts/install.sh --project <project-root> (PowerShell: scripts/install.ps1 -ProjectDir <project-root>).');
    return 1;
  }
  write(`OK: the installed runtime at ${runtimeRoot} matches this source checkout in all ${result.compared} file(s).`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-runtime-sync.mjs')) {
  process.exitCode = main();
}
