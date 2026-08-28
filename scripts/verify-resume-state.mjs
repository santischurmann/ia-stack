#!/usr/bin/env node
// verify-resume-state.mjs — mechanical feature-identity gate for VCP Phase 1 resume.
//
// Usage:
//   node scripts/verify-resume-state.mjs check --session .vibe/SESSION.md --feature <kebab-case-slug>
//
// A zero exit means the declared feature identity in SESSION.md exactly matches the requested
// feature. Any unknown, malformed, or mismatched declaration exits 1: Phase 1 must then show
// the user a decision menu instead of silently resuming a different feature's incomplete gate.
// This gate reads only; it never retags, archives, or overwrites session state.

import { readFileSync } from 'node:fs';

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isFeatureSlug(value) {
  return typeof value === 'string' && FEATURE_SLUG.test(value);
}

export function declaredFeature(sessionText) {
  const declarations = [...sessionText.matchAll(/^\*\*Feature slug:\*\*\s*(.*?)\s*$/gim)];
  if (declarations.length === 0 || !declarations[0][1]) {
    return { kind: 'UNKNOWN', message: 'SESSION.md has no Feature slug declaration' };
  }
  if (declarations.length !== 1) {
    return { kind: 'UNKNOWN', message: 'SESSION.md must contain exactly one Feature slug declaration' };
  }

  const feature = declarations[0][1].trim();
  if (!isFeatureSlug(feature)) {
    return { kind: 'UNKNOWN', message: `SESSION.md Feature slug must be valid kebab-case, got ${JSON.stringify(feature)}` };
  }

  return { kind: 'DECLARED', feature };
}

export function checkResumeIdentity(sessionText, requestedFeature) {
  if (!isFeatureSlug(requestedFeature)) {
    throw new TypeError(`Feature slug must be kebab-case, got ${JSON.stringify(requestedFeature)}`);
  }

  const declared = declaredFeature(sessionText);
  if (declared.kind === 'UNKNOWN') return { ok: false, ...declared };

  if (declared.feature !== requestedFeature) {
    return {
      ok: false,
      kind: 'CONFLICT',
      message: `SESSION.md belongs to ${JSON.stringify(declared.feature)}, requested feature is ${JSON.stringify(requestedFeature)}. Do not resume silently.`,
    };
  }

  return { ok: true, kind: 'OK', feature: requestedFeature, message: `SESSION.md belongs to requested feature ${JSON.stringify(requestedFeature)}` };
}

function usage(message) {
  if (message) console.error(`usage: ${message}`);
  console.error('usage: verify-resume-state.mjs check --session <SESSION.md> --feature <kebab-case-feature-slug>');
  process.exit(2);
}

function parseCheckArgs(args) {
  let session;
  let feature;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if ((flag !== '--session' && flag !== '--feature') || !value || value.startsWith('--')) {
      usage('expected exactly --session <path> and --feature <kebab-case-feature-slug>');
    }
    if (flag === '--session' && session !== undefined) usage('--session may appear only once');
    if (flag === '--feature' && feature !== undefined) usage('--feature may appear only once');
    if (flag === '--session') session = value;
    if (flag === '--feature') feature = value;
    index += 1;
  }

  if (!session || !feature) usage('both --session and --feature are required');
  if (!isFeatureSlug(feature)) usage(`Feature slug must be kebab-case, got ${JSON.stringify(feature)}`);
  return { session, feature };
}

function main() {
  const [, , command, ...args] = process.argv;
  if (command !== 'check') usage();

  const { session, feature } = parseCheckArgs(args);
  let sessionText;
  try {
    sessionText = readFileSync(session, 'utf8');
  } catch (error) {
    usage(`cannot read SESSION.md at ${JSON.stringify(session)}: ${error.message}`);
  }

  const result = checkResumeIdentity(sessionText, feature);
  if (!result.ok) {
    console.error(`${result.kind}: ${result.message}`);
    process.exit(1);
  }
  console.log(`OK: ${result.message}`);
}

if (process.argv[1] && process.argv[1].endsWith('verify-resume-state.mjs')) main();
