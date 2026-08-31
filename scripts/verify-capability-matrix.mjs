#!/usr/bin/env node
// Closed-world capability matrix for the native VCP roles.
// This is a declarative guard: it checks the permission model's shape and separation rules.
// It cannot prove which human or agent actually used a tool outside the recorded plan.

import { readFileSync } from 'node:fs';

export const SCHEMA = 'vcp.capability-matrix/v1';
export const USAGE = 'usage: verify-capability-matrix.mjs check <capability-matrix.json>';
export const TOOL_SET = new Set(['Read', 'Write', 'Edit', 'Bash', 'Task', 'Agent', 'Glob', 'Grep', 'TodoWrite', 'Skill']);
export const SURFACES = new Set(['tests', 'production', 'docs', 'state', 'security', 'release']);
export const APPROVALS = new Set(['tests', 'security', 'phase', 'release']);
const MATRIX_KEYS = new Set(['schema', 'roles', 'rules']);
const ROLE_KEYS = new Set(['id', 'phase', 'tools', 'reads', 'writes', 'approves']);
const RULE_KEYS = new Set(['id', 'description']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed) {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function stringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function uniqueList(values) {
  return new Set(values).size === values.length;
}

export function validateMatrix(document) {
  const violations = [];
  if (!isObject(document) || !exactKeys(document, MATRIX_KEYS) || document.schema !== SCHEMA) {
    return [`matrix must use ${SCHEMA} with exactly schema, roles and rules`];
  }
  if (!Array.isArray(document.roles) || document.roles.length === 0) {
    violations.push('roles must be a non-empty array');
  }
  if (!Array.isArray(document.rules) || document.rules.length === 0) {
    violations.push('rules must be a non-empty array');
  }
  const roleIds = new Set();
  for (const [index, role] of (document.roles ?? []).entries()) {
    const at = `roles[${index}]`;
    if (!isObject(role) || !exactKeys(role, ROLE_KEYS)) {
      violations.push(`${at} must contain exactly id, phase, tools, reads, writes and approves`);
      continue;
    }
    if (!nonEmptyString(role.id)) violations.push(`${at}.id must be a non-empty string`);
    if (roleIds.has(role.id)) violations.push(`${at}.id is duplicated: ${role.id}`);
    roleIds.add(role.id);
    if (!nonEmptyString(role.phase)) violations.push(`${role.id}: phase must be a non-empty string`);
    if (!stringList(role.tools) || !uniqueList(role.tools) || role.tools.some((tool) => !TOOL_SET.has(tool))) {
      violations.push(`${role.id}: tools must be unique known tool names`);
    }
    const tools = Array.isArray(role.tools) ? role.tools : [];
    const writes = Array.isArray(role.writes) ? role.writes : [];
    const approves = Array.isArray(role.approves) ? role.approves : [];
    for (const [name, allowed] of [['reads', SURFACES], ['writes', SURFACES], ['approves', APPROVALS]]) {
      if (!Array.isArray(role[name]) || !uniqueList(role[name]) || role[name].some((surface) => !nonEmptyString(surface) || !allowed.has(surface))) {
        violations.push(`${role.id}: ${name} must be a unique list from ${[...allowed].join(', ')}`);
      }
    }
    const overlap = writes.filter((surface) => approves.includes(surface));
    if (overlap.length > 0) violations.push(`${role.id}: cannot write and approve the same surface (${overlap.join(', ')})`);
    if (writes.length === 0 && tools.some((tool) => ['Write', 'Edit'].includes(tool))) {
      violations.push(`${role.id}: a read-only role cannot hold Write or Edit`);
    }
    if (writes.length > 0 && !tools.some((tool) => ['Write', 'Edit'].includes(tool))) {
      violations.push(`${role.id}: a writer must hold Write or Edit`);
    }
  }
  const ruleIds = new Set();
  for (const [index, rule] of (document.rules ?? []).entries()) {
    const at = `rules[${index}]`;
    if (!isObject(rule) || !exactKeys(rule, RULE_KEYS) || !nonEmptyString(rule.id) || !nonEmptyString(rule.description)) {
      violations.push(`${at} must contain a non-empty id and description`);
      continue;
    }
    if (ruleIds.has(rule.id)) violations.push(`${at}.id is duplicated: ${rule.id}`);
    ruleIds.add(rule.id);
  }
  for (const required of ['no-self-approval', 'read-only-no-write']) {
    if (!ruleIds.has(required)) violations.push(`missing mandatory separation rule: ${required}`);
  }
  return violations;
}

export function readMatrix(path, readFile = readFileSync) {
  let raw;
  try {
    raw = readFile(path, 'utf8');
  } catch (error) {
    return { document: null, error: `unable to read ${path}: ${error.message}` };
  }
  try {
    return { document: JSON.parse(raw), error: null };
  } catch (error) {
    return { document: null, error: `${path} is not valid JSON: ${error.message}` };
  }
}

export function main(args = process.argv.slice(2), options = {}) {
  const write = options.write ?? console.log;
  const writeError = options.writeError ?? console.error;
  const readFile = options.readFile ?? readFileSync;
  if (args.length !== 2 || args[0] !== 'check' || args[1] === '') {
    writeError(USAGE);
    return 2;
  }
  const loaded = readMatrix(args[1], readFile);
  if (loaded.error) {
    writeError(`REJECTED: CAPABILITY_MATRIX_INVALID: ${loaded.error}`);
    return 1;
  }
  const violations = validateMatrix(loaded.document);
  if (violations.length > 0) {
    for (const item of violations) writeError(`REJECTED: CAPABILITY_MATRIX_INVALID: ${item}`);
    return 1;
  }
  write(`OK: capability matrix has ${loaded.document.roles.length} role(s), ${loaded.document.rules.length} separation rule(s); no role writes and approves the same surface.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-capability-matrix.mjs')) process.exitCode = main();
