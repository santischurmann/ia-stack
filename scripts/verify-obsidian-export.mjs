#!/usr/bin/env node
// Verify that a Graphify Obsidian export is a real, project-local vault.
// This proves destination and basic export shape only; it does not judge note semantics.

import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const FILESYSTEM = { lstatSync, readdirSync, realpathSync };

export const USAGE = 'usage: verify-obsidian-export.mjs check <project-relative-vault-dir>';
export const DEFAULT_VAULT = 'graphify-out/obsidian';

function contained(root, target) {
  const rest = relative(root, target);
  return rest !== '' && rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest);
}

export function projectDirectory(candidate, cwd = '.') {
  if (typeof candidate !== 'string' || candidate.trim() === '' || isAbsolute(candidate)) {
    throw new Error(`vault path must be project-relative: ${candidate}`);
  }
  const root = realpathSync(resolve(cwd));
  const lexical = resolve(root, candidate);
  if (!contained(root, lexical)) throw new Error(`vault path escapes the project: ${candidate}`);
  const stat = lstatSync(lexical);
  const physical = realpathSync(lexical);
  if (!contained(root, physical)) throw new Error(`vault directory resolves outside the project: ${candidate}`);
  if (stat.isSymbolicLink()) throw new Error(`vault directory must not be a symlink: ${candidate}`);
  if (!stat.isDirectory()) throw new Error(`vault path is not a directory: ${candidate}`);
  return { root, directory: physical };
}

export function walk(directory, root, entries = [], relativeDirectory = '', filesystem = FILESYSTEM) {
  for (const entry of filesystem.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const fullPath = resolve(directory, entry.name);
    const stat = filesystem.lstatSync(fullPath);
    const physical = filesystem.realpathSync(fullPath);
    if (!contained(root, physical)) throw new Error(`vault entry resolves outside the project: ${relativePath}`);
    if (stat.isSymbolicLink()) throw new Error(`vault contains a symlink: ${relativePath}`);
    if (stat.isDirectory()) walk(fullPath, root, entries, relativePath, filesystem);
    else if (stat.isFile()) entries.push({ path: relativePath, bytes: stat.size });
    else throw new Error(`vault contains a non-regular entry: ${relativePath}`);
  }
  return entries;
}

export function inspectVault(candidate = DEFAULT_VAULT, cwd = '.') {
  const { root, directory } = projectDirectory(candidate, cwd);
  const entries = walk(directory, root);
  const markdown = entries.filter((entry) => /\.md$/iu.test(entry.path));
  const canvas = entries.find((entry) => entry.path === 'graph.canvas');
  if (!canvas || canvas.bytes === 0) throw new Error('vault must contain a non-empty graph.canvas');
  let parsedCanvas;
  try { parsedCanvas = JSON.parse(readFileSync(resolve(directory, 'graph.canvas'), 'utf8')); }
  catch (error) { throw new Error(`graph.canvas is not valid JSON: ${error.message}`); }
  if (!parsedCanvas || typeof parsedCanvas !== 'object' || Array.isArray(parsedCanvas)
    || !Array.isArray(parsedCanvas.nodes) || !Array.isArray(parsedCanvas.edges)) {
    throw new Error('graph.canvas must contain nodes and edges arrays');
  }
  if (markdown.length === 0) throw new Error('vault must contain at least one Markdown note');
  return { directory, files: entries.length, markdown: markdown.length, canvas_nodes: parsedCanvas.nodes.length, canvas_edges: parsedCanvas.edges.length };
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error) {
  if (args.length !== 2 || args[0] !== 'check' || args[1] === '') {
    writeError(USAGE);
    return 2;
  }
  try {
    const result = inspectVault(args[1], cwd);
    write(`OK: Obsidian vault ${args[1]} is project-local, regular, symlink-free, and contains ${result.markdown} Markdown note(s) plus graph.canvas (${result.canvas_nodes} node(s), ${result.canvas_edges} edge(s)).`);
    return 0;
  } catch (error) {
    writeError(`REJECTED: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-obsidian-export.mjs')) process.exitCode = main();
