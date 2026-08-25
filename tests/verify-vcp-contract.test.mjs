import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-vcp-contract.mjs');
const { FORBIDDEN_PHRASES, REQUIREMENTS, contractViolations, main } = await import(pathToFileURL(script).href);

function completeRead(path) {
  const requirement = REQUIREMENTS.find(([candidate]) => candidate === path);
  return `VCP ayuda a una IA\n.vibe/vcp-runtime/scripts/\n--project <project-root>\n-ProjectDir <project-root>\n.vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs\nverify-security-baseline.mjs\nverify-backup-state.mjs\nModelo de seguridad y límites\ndato no confiable\nno hace taint analysis\nconfiguraciones peligrosas de GitHub Actions\nno una frontera de confianza\nno autentica a quien\nRegla dura sobre \`acceptance_criteria\`: \`terminal_state: "approved"\` exige TODOS los AC\nnunca re-ejecuta el comando ni prueba criptográficamente\nno lo llames "el scope\nreal del plan"\n## Write-conflict preflight\n${requirement?.[1].source ?? ''}`;
}

test('contract accepts all required user-visible promises when every source is present', () => {
  assert.deepEqual(contractViolations(completeRead), []);
});

test('FALSIFICACIÓN · contract rejects unreadable, missing and stale-policy documentation', () => {
  const missing = contractViolations((path) => path === 'README.md' ? 'VCP ayuda a una IA\nat least 90%' : completeRead(path));
  assert.equal(missing.some((item) => /README\.md: missing project-local runtime/u.test(item)), true);
  assert.equal(missing.some((item) => /stale 90%/u.test(item)), true);
  const unreadable = contractViolations(() => { throw new Error('ENOENT'); });
  assert.equal(unreadable.length, REQUIREMENTS.length + FORBIDDEN_PHRASES.length);
});

test('FALSIFICACIÓN · contract rejects SECURITY.md missing the GitHub Actions scope, PreToolUse limit, or ZIP checksum limit statements', () => {
  const missingScope = contractViolations((path) => path === 'SECURITY.md'
    ? completeRead(path).replace('configuraciones peligrosas de GitHub Actions', 'algo distinto')
    : completeRead(path));
  assert.equal(missingScope.some((item) => /SECURITY\.md: missing documented GitHub Actions detection scope/u.test(item)), true);

  const missingHookLimit = contractViolations((path) => path === 'SECURITY.md'
    ? completeRead(path).replace('no una frontera de confianza', 'algo distinto')
    : completeRead(path));
  assert.equal(missingHookLimit.some((item) => /SECURITY\.md: missing PreToolUse hook honest limit/u.test(item)), true);

  const missingChecksumLimit = contractViolations((path) => path === 'SECURITY.md'
    ? completeRead(path).replace('no autentica a quien', 'algo distinto')
    : completeRead(path));
  assert.equal(missingChecksumLimit.some((item) => /SECURITY\.md: missing ZIP checksum honest limit/u.test(item)), true);
});

test('FALSIFICACIÓN · contract rejects "confirms a genuine RED" / "genuine RED" while leaving unrelated legitimate uses of "genuine" untouched', () => {
  const withOverclaim = contractViolations((path) => path === 'SKILL.md'
    ? `${completeRead(path)}\nimmediately after verify-red.sh confirms a genuine RED, run:`
    : completeRead(path));
  assert.equal(withOverclaim.some((item) => /SKILL\.md: overclaims RED as genuine/u.test(item)), true);

  const legitimateOnly = contractViolations((path) => path === 'SKILL.md'
    ? `${completeRead(path)}\na receipt produced by a genuine emit() run\nretag only if it is genuinely the same work`
    : completeRead(path));
  assert.deepEqual(legitimateOnly, []);
});

test('FALSIFICACIÓN · contract rejects SKILL.md missing the receipt v2 all-AC-COMPLIANT rule, the command/result honest-evidence limit, or the scope honest limit', () => {
  const missingAllCompliant = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC', 'algo distinto')
    : completeRead(path));
  assert.equal(missingAllCompliant.some((item) => /SKILL\.md: missing receipt v2: all-AC-COMPLIANT requirement/u.test(item)), true);

  const missingCryptoLimit = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('nunca re-ejecuta el comando ni prueba criptográficamente', 'algo distinto')
    : completeRead(path));
  assert.equal(missingCryptoLimit.some((item) => /SKILL\.md: missing receipt v2: command\/result is reviewable evidence/u.test(item)), true);

  const missingScopeLimit = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('no lo llames "el scope\nreal del plan"', 'algo distinto')
    : completeRead(path));
  assert.equal(missingScopeLimit.some((item) => /SKILL\.md: missing receipt v2: scope\.declared_paths honest limit/u.test(item)), true);
});

test('main reports pass, invalid usage and a real repository contract failure without trusting narration', () => {
  const output = [];
  const errors = [];
  assert.equal(main(['check'], repoRoot, (line) => output.push(line), (line) => errors.push(line)), 0);
  assert.match(output.at(-1), /contract checks pass/);
  assert.equal(main([], repoRoot, () => {}, (line) => errors.push(line)), 2);
  assert.match(errors.at(-1), /usage:/i);
  assert.equal(main(['check'], join(repoRoot, 'does-not-exist'), () => {}, (line) => errors.push(line)), 1);
  assert.match(errors.at(-1), /cannot read/);
  const result = spawnSync(process.execPath, [script, 'check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
