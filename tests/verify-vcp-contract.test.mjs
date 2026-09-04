import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio de VCP: le preguntan a git o a un gate por ESTE checkout. Adentro del
// runtime instalado de otra persona no tienen nada que afirmar -- y ademas el instalador gitignora
// el runtime, asi que git no puede contestar. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const script = join(repoRoot, 'scripts', 'verify-vcp-contract.mjs');
const {
  FORBIDDEN_PHRASES,
  HONEST_LIMITS_SCHEMA,
  REQUIREMENTS,
  contractViolations,
  honestLimitViolations,
  main,
  readHonestLimits,
} = await import(pathToFileURL(script).href);

function completeReadBase(path) {
  const requirement = REQUIREMENTS.find(([candidate]) => candidate === path);
  return `VCP ayuda a una IA\n.vibe/vcp-runtime/scripts/\n--project <project-root>\n-ProjectDir <project-root>\n.vibe/vcp-runtime/scripts/verify-plan-conflicts.mjs\nverify-security-baseline.mjs\nverify-backup-state.mjs\nEl sello lo registra el protocolo, no Graphify\ncommit → graphify → record → check\nModelo de seguridad y límites\nResearch: investigar antes de especificar\ndato no confiable\nno hace taint analysis\nconfiguraciones peligrosas de GitHub Actions\nno una frontera de confianza\nno autentica a quien\nRegla dura sobre \`acceptance_criteria\`: \`terminal_state: "approved"\` exige TODOS los AC\nnunca re-ejecuta el comando ni prueba criptográficamente\nno lo llames "el scope\nreal del plan"\nscope.declared_paths sigue siendo un writer set verify-scope-diff.mjs\n.vibe/vcp-runtime/scripts/verify-spec-wordcap.mjs\n## PHASE 1 — BOOTSTRAP
## PHASE 2 — RESEARCH
## PHASE 3 — SPEC
## PHASE 4 — PLAN
## PHASE 5 — BUILD
## PHASE 6 — TEST
## PHASE 7 — SIMPLIFY
## PHASE 8 — DEPLOY
simplificar sin volver a
verificar es exactamente cómo se rompe algo en silencio\nverify-discovery-core.mjs\nverify-scope-diff.mjs check\nverify-graphify-manifest.mjs check\nverify-obsidian-export.mjs check graphify-out/obsidian\nEl gate prueba contabilidad, no comprensión\nverify-runtime-sync.mjs check\nnunca desde el runtime\nReproducir antes de diagnosticar\nContexto acotado por agente\nCuándo una fase está terminada\nRedacción reutilizable\nverify-audit-chain.mjs history .vibe/AUDIT.md
No agarra recortar el final ni
verify-audit-chain.mjs append\nLo que el gate no detecta\n--baseline <archivo>\nLo que no cubre\nverify-receipt.mjs custody
si el agente puede correr \`git commit -S\`, firma como vos
Un agente que espera igual pasa: detecta lo imposible
verify-receipt.mjs commit\nnunca reescribe historial por su cuenta\ncontracts/honest-limits.json\nverify-evidence-trace.mjs criteria\nverify-evidence-trace.mjs claims\ncriteria --spec docs/spec.md --tests tests --require-inputs\nescribe VACÍO, no OK\nverify-session-state.mjs check\ntercer intento fallido sobre el mismo problema\n## Diccionario: qué significa cada palabra rara
| **verde vacío** |
prueban forma, cadena y estado, nunca
verify-shell-coverage.mjs check contracts/shell-coverage.json
Mide líneas ejecutadas, no ramas
verify-empty-probe.mjs check contracts/empty-probe.json
un gate nuevo tiene que declarar qué hace cuando no hay nada que verificar
verify-phase-decisions.mjs check docs/phase-decisions.json\nNinguna fase cierra sin una elección registrada\n## Intentos fallidos\n## Interrumpido en\n## No verificado\n## Discovery / Investigación previa\n## Write-conflict preflight\n${requirement?.[1].source ?? ''}`;
}

// Keep the synthetic reader aligned with the live documentation contract.
function completeRead(path) {
  const content = `${completeReadBase(path)}\nclaims --feature <feature-slug> --require-inputs --require-links\n\`--require-links\` exige además un packet no vacío y que cada claim tenga al menos uno\n--test-concurrency=32 y \`VCP_TEST_CONCURRENCY=<n>\` existe para **bajarlo**\nVCP_BASH_PATH\nverify-spec-wordcap.mjs check docs/spec.md --quality\nverify-spec-wordcap.mjs --quality\nverify-capability-matrix.mjs check .vibe/vcp-runtime/contracts/capability-matrix.json\nverify-evidence-runner.mjs run .vibe/evidence/request.json .vibe/evidence/record.json\nverify-evidence-runner.mjs check .vibe/evidence/record.json --require-complete\nbuild-complete-review-index.mjs\nsin confundirlas con comprensión semántica\nverify-product-diagnostics.mjs check\nLos diagnósticos comprueban forma e invariantes, nunca verdad semántica.\nverify-phase-menu.mjs check docs/phase-decisions.json --plan docs/phase-plan.json\nvcp.caio/1\nvcp.phase-plan/1\nverify-sereno.mjs due\nverify-sereno.mjs check docs/mejoras/AAAA-MM-DD.json\n.vibe/vcp-runtime/scripts/verify-sereno.mjs\n**como mucho cuatro**\n4000 caracteres`;
  return path === 'SKILL.md' ? `${content}\n--require-complete` : content;
}

test('contract accepts all required user-visible promises when every source is present', () => {
  assert.deepEqual(contractViolations(completeRead), []);
});

test('FALSIFICACIÓN · contract rejects missing mechanical scope-vs-diff documentation', () => {
  const missingReadme = contractViolations((path) => path === 'README.md'
    ? completeRead(path).replace('verify-scope-diff.mjs check', 'scope gate omitted')
    : completeRead(path));
  assert.equal(missingReadme.some((item) => /README\.md: missing mechanical scope-vs-diff gate/u.test(item)), true);

  const missingSkill = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('verify-scope-diff.mjs check', 'scope gate omitted')
    : completeRead(path));
  assert.equal(missingSkill.some((item) => /SKILL\.md: missing mechanical scope-vs-diff gate/u.test(item)), true);
});

test('FALSIFICACIÓN · contract rejects the evidence-trace gate dropped from either phase or from the README gate table', () => {
  const missingCriteria = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('verify-evidence-trace.mjs criteria', 'trazabilidad omitida')
    : completeRead(path));
  assert.equal(missingCriteria.some((item) => /SKILL\.md: missing mechanical criterion-to-test trace gate/u.test(item)), true);
  assert.equal(missingCriteria.some((item) => /missing mechanical claim-to-spec reference gate/u.test(item)), false);

  const missingClaims = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('verify-evidence-trace.mjs claims', 'trazabilidad omitida')
    : completeRead(path));
  assert.equal(missingClaims.some((item) => /SKILL\.md: missing mechanical claim-to-spec reference gate/u.test(item)), true);

  // El ancla se mudo a skills/gates.md cuando la tabla salio del README: la falsificacion sigue
  // al ancla, no al archivo que la tenia antes.
  const missingReadme = contractViolations((path) => path === 'skills/gates.md'
    ? completeRead(path).replaceAll('verify-evidence-trace.mjs', 'trazabilidad omitida')
    : completeRead(path));
  assert.equal(missingReadme.some((item) => /skills\/gates\.md: missing mechanical evidence-trace gate/u.test(item)), true);
});

test('FALSIFICACIÓN · contract rejects the session-state gate, the retry rule or the documented sections dropped from their file', () => {
  const missingGate = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('verify-session-state.mjs check', 'estado de sesión omitido')
    : completeRead(path));
  assert.equal(missingGate.some((item) => /SKILL\.md: missing mechanical resumable-session-state gate/u.test(item)), true);
  assert.equal(missingGate.some((item) => /README\.md: missing/u.test(item)), false);

  const missingRule = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('tercer intento fallido sobre el mismo problema', 'se reintenta hasta que salga')
    : completeRead(path));
  assert.equal(missingRule.some((item) => /SKILL\.md: missing three-attempt stop-and-ask rule/u.test(item)), true);

  const missingTemplate = contractViolations((path) => path === 'templates/vibe/SESSION.md'
    ? completeRead(path).replace('## Interrumpido en', '## Otra cosa')
    : completeRead(path));
  assert.equal(missingTemplate.some((item) => /SESSION\.md: missing documented interruption resume point/u.test(item)), true);
  assert.equal(missingTemplate.some((item) => /missing documented failed-attempt section/u.test(item)), false);
});

test('FALSIFICACIÓN · contract rejects the backup seal ownership or its recording order dropped from its file', () => {
  // Las dos anclas se mudaron a `skills/integracion-graphify.md` cuando la integración con el grafo
  // dejó de ser parte del camino obligatorio. La falsificación sigue al ancla, no al archivo que la
  // tenía antes: lo que se prueba es que borrarla duela, no dónde está escrita.
  const DOC = 'skills/integracion-graphify.md';
  const missingOwnership = contractViolations((path) => path === DOC
    ? completeRead(path).replace('El sello lo registra el protocolo, no Graphify', 'el sello lo escribe Graphify')
    : completeRead(path));
  assert.equal(missingOwnership.some((item) => /missing the backup seal is recorded by the protocol/u.test(item)), true);
  assert.equal(missingOwnership.some((item) => /missing documented backup ordering/u.test(item)), false);

  const missingOrder = contractViolations((path) => path === DOC
    ? completeRead(path).replace('commit → graphify → record → check', 'en cualquier orden')
    : completeRead(path));
  assert.equal(missingOrder.some((item) => /missing documented backup ordering/u.test(item)), true);
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

test('FALSIFICACIÓN · contract rejects SKILL.md missing receipt evidence limits or the scope-vs-diff gate', () => {
  const missingAllCompliant = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC', 'algo distinto')
    : completeRead(path));
  assert.equal(missingAllCompliant.some((item) => /SKILL\.md: missing receipt v2: all-AC-COMPLIANT requirement/u.test(item)), true);

  const missingCryptoLimit = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('nunca re-ejecuta el comando ni prueba criptográficamente', 'algo distinto')
    : completeRead(path));
  assert.equal(missingCryptoLimit.some((item) => /SKILL\.md: missing receipt v2: command\/result is reviewable evidence/u.test(item)), true);

  const missingScopeLimit = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('scope.declared_paths sigue siendo un writer set verify-scope-diff.mjs', 'scope declaration omitted')
    : completeRead(path));
  assert.equal(missingScopeLimit.some((item) => /SKILL\.md: missing receipt v2: scope declaration and separate diff gate/u.test(item)), true);
});

test('FALSIFICACIÓN · contract rejects docs that drop the runtime-sync gate or the promise that it runs from the source checkout', () => {
  const missingSkill = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('verify-runtime-sync.mjs check', 'runtime sync omitido')
    : completeRead(path));
  assert.equal(missingSkill.some((item) => /SKILL\.md: missing mechanical runtime-sync gate/u.test(item)), true);

  const missingReadme = contractViolations((path) => path === 'skills/gates.md'
    ? completeRead(path).replace('verify-runtime-sync.mjs check', 'runtime sync omitido')
    : completeRead(path));
  assert.equal(missingReadme.some((item) => /skills\/gates\.md: missing mechanical runtime-sync gate/u.test(item)), true);

  // Sin esta frase el gate se puede terminar corriendo desde .vibe/vcp-runtime/, comparando la
  // copia instalada consigo misma: verde siempre, evidencia cero.
  const missingOrigin = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('nunca desde el runtime', 'o desde el runtime, da igual')
    : completeRead(path));
  assert.equal(missingOrigin.some((item) => /SKILL\.md: missing runtime-sync gate runs from the source checkout/u.test(item)), true);
});

test('FALSIFICACIÓN · contract rejects SKILL.md missing the mechanical spec word-cap gate command', () => {
  const missingWordcap = contractViolations((path) => path === 'SKILL.md'
    ? completeRead(path).replace('.vibe/vcp-runtime/scripts/verify-spec-wordcap.mjs', 'algo distinto')
    : completeRead(path));
  assert.equal(missingWordcap.some((item) => /SKILL\.md: missing mechanical spec word-cap gate/u.test(item)), true);
});

test('main reports pass, invalid usage and a real repository contract failure without trusting narration', SOLO_FUENTE, () => {
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

// --- Honest limits declared as reviewable data (AC10) -------------------------------------------

const HONEST_LIMITS_FILE = 'contracts/honest-limits.json';
const HONEST_LIMITS_VERSION = 'vcp.honest-limits/1';

const TRUST_BOUNDARY_LIMIT = {
  limit_id: 'pretooluse-not-a-trust-boundary',
  file: 'SECURITY.md',
  phrase: 'no una frontera de confianza',
  why: 'El hook agrega fricción a Write y Edit, pero Bash y cualquier proceso con acceso al mismo filesystem lo eluden. Sin esta frase, un lector puede tomarlo por un sandbox.',
};

function honestLimitsDocument(limits, schema = HONEST_LIMITS_VERSION) {
  return JSON.stringify({ schema, limits });
}

/** A reader over a fixed document set: an unexpected path is a real failure, never an empty file. */
function readDocuments(documents) {
  return (path) => {
    if (!(path in documents)) throw new Error(`unexpected read: ${path}`);
    return documents[path];
  };
}

function expectError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

/** Materializes on disk the same fully-compliant project `completeRead` describes in memory. */
function writeContractFixture(root, overrides = {}) {
  for (const path of new Set([...REQUIREMENTS, ...FORBIDDEN_PHRASES].map(([candidate]) => candidate))) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, overrides[path] ?? completeRead(path), 'utf8');
  }
}

function writeHonestLimits(root, contract) {
  mkdirSync(join(root, 'contracts'), { recursive: true });
  writeFileSync(join(root, HONEST_LIMITS_FILE), contract, 'utf8');
}

test('los límites honestos declaran un schema versionado y se leen desde contracts/honest-limits.json', () => {
  assert.equal(HONEST_LIMITS_SCHEMA, HONEST_LIMITS_VERSION);
  const requested = [];
  const limits = readHonestLimits((path) => {
    requested.push(String(path).replaceAll('\\', '/'));
    return honestLimitsDocument([TRUST_BOUNDARY_LIMIT]);
  });
  assert.deepEqual(requested, [HONEST_LIMITS_FILE]);
  assert.deepEqual(limits, [TRUST_BOUNDARY_LIMIT]);
});

test('FALSIFICACIÓN · readHonestLimits rechaza schema ajeno, forma inválida, limit_id no kebab-case y duplicados', () => {
  const withLimits = (limits) => () => honestLimitsDocument(limits);
  const withLimit = (patch) => withLimits([{ ...TRUST_BOUNDARY_LIMIT, ...patch }]);

  expectError(() => readHonestLimits(() => honestLimitsDocument([TRUST_BOUNDARY_LIMIT], 'vcp.honest-limits/2')), /schema/u);
  expectError(() => readHonestLimits(() => JSON.stringify({ limits: [TRUST_BOUNDARY_LIMIT] })), /schema/u);
  expectError(() => readHonestLimits(() => honestLimitsDocument(TRUST_BOUNDARY_LIMIT)), /limits array/u);
  expectError(() => readHonestLimits(withLimits([{ ...TRUST_BOUNDARY_LIMIT, owner: 'alguien' }])), /limit_id, file, phrase and why/u);
  expectError(() => readHonestLimits(withLimits([{ limit_id: 'sin-motivo', file: 'SECURITY.md', phrase: 'no una frontera' }])), /limit_id, file, phrase and why/u);
  expectError(() => readHonestLimits(withLimits([null])), /limit_id, file, phrase and why/u);
  expectError(() => readHonestLimits(withLimits(['pretooluse-not-a-trust-boundary'])), /limit_id, file, phrase and why/u);
  expectError(() => readHonestLimits(withLimits([[]])), /limit_id, file, phrase and why/u);
  // JSON admite números: un campo sin tipar llegaría como número a la validación del motivo.
  expectError(() => readHonestLimits(withLimit({ why: 20 })), /limit_id, file, phrase and why/u);
  expectError(() => readHonestLimits(withLimit({ phrase: '   ' })), /phrase must not be empty/u);

  expectError(() => readHonestLimits(withLimit({ limit_id: 'PreToolUse-Trust-Boundary' })), /kebab-case/u);
  expectError(() => readHonestLimits(withLimit({ limit_id: 'trust_boundary' })), /kebab-case/u);
  expectError(() => readHonestLimits(withLimit({ limit_id: '-trust-boundary-' })), /kebab-case/u);
  expectError(() => readHonestLimits(withLimits([TRUST_BOUNDARY_LIMIT, { ...TRUST_BOUNDARY_LIMIT, file: 'README.md' }])), /duplicate/u);
});

test('FALSIFICACIÓN · readHonestLimits rechaza un motivo de relleno y un file fuera del proyecto', () => {
  const withLimit = (patch) => () => honestLimitsDocument([{ ...TRUST_BOUNDARY_LIMIT, ...patch }]);

  // 19 caracteres: por debajo del piso que obliga a escribir un motivo de verdad.
  expectError(() => readHonestLimits(withLimit({ why: 'Motivo demasiado co' })), /needs a real reason, not a placeholder/u);
  // Relleno que ya supera el piso de longitud: el largo por sí solo no prueba que haya un motivo.
  expectError(() => readHonestLimits(withLimit({ why: 'placeholder placeholder' })), /needs a real reason, not a placeholder/u);
  expectError(() => readHonestLimits(withLimit({ why: 'TODO / TBD / N/A / none' })), /needs a real reason, not a placeholder/u);

  expectError(() => readHonestLimits(withLimit({ file: '../SECURITY.md' })), /must stay inside the project/u);
  expectError(() => readHonestLimits(withLimit({ file: '..\\SECURITY.md' })), /must stay inside the project/u);
  expectError(() => readHonestLimits(withLimit({ file: '/etc/SECURITY.md' })), /must stay inside the project/u);
  expectError(() => readHonestLimits(withLimit({ file: 'C:/Windows/SECURITY.md' })), /must stay inside the project/u);
  expectError(() => readHonestLimits(withLimit({ file: '   ' })), /must stay inside the project/u);

  // El piso es "al menos 20": exactamente 20 caracteres de motivo real alcanza.
  const minimal = { ...TRUST_BOUNDARY_LIMIT, why: 'Veinte caracteres ok' };
  assert.deepEqual(readHonestLimits(() => honestLimitsDocument([minimal])), [minimal]);
});

test('FALSIFICACIÓN · readHonestLimits nunca degrada a "sin límites" ante un contrato ausente, ilegible, vacío o mal formado', () => {
  const failing = (message, code) => () => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  // Un contrato ausente es un error de configuración, no "cero límites que verificar": degradar
  // en silencio convertiría borrar el archivo en la vía para borrar todas las garantías.
  expectError(() => readHonestLimits(failing('ENOENT: no such file or directory', 'ENOENT')), /honest-limits\.json: cannot read/u);
  expectError(() => readHonestLimits(failing('EACCES: permission denied', 'EACCES')), /honest-limits\.json: cannot read/u);
  expectError(() => readHonestLimits(() => '{'), /is not valid JSON/u);
  expectError(() => readHonestLimits(() => 'null'), /schema/u);
  expectError(() => readHonestLimits(() => '[]'), /schema/u);
  expectError(() => readHonestLimits(() => '"vcp.honest-limits/1"'), /schema/u);
  expectError(() => readHonestLimits(() => honestLimitsDocument([])), /at least one honest limit/u);
});

test('honestLimitViolations no reporta nada cuando cada frase declarada sigue presente en su archivo', () => {
  const bookkeeping = {
    limit_id: 'graphify-coverage-is-bookkeeping',
    file: 'README.md',
    phrase: 'Prueba contabilidad, no comprensión',
    why: 'Un archivo indexado puede haber producido cero nodos: sin el límite, "cubierto" se lee como "entendido".',
  };
  const read = readDocuments({
    'SECURITY.md': `Límites que no ocultamos\n- El hook es evidencia revisable, ${TRUST_BOUNDARY_LIMIT.phrase}.\n`,
    'README.md': `| verify-graphify-manifest.mjs | cobertura declarada | ${bookkeeping.phrase}: un archivo indexado puede dar cero nodos. |\n`,
  });
  assert.deepEqual(honestLimitViolations(read, [TRUST_BOUNDARY_LIMIT, bookkeeping]), []);
});

test('FALSIFICACIÓN · honestLimitViolations nombra el limit_id, el archivo y el motivo cuando la frase falta o el archivo no se puede leer', () => {
  const limits = [TRUST_BOUNDARY_LIMIT];

  const weakened = honestLimitViolations(() => 'El hook PreToolUse es una frontera de confianza sólida.', limits);
  assert.equal(weakened.length, 1);
  assert.match(weakened[0], /pretooluse-not-a-trust-boundary/u);
  assert.match(weakened[0], /SECURITY\.md/u);
  // El motivo es lo más importante del mensaje: quien rompió la frase tiene que entender qué
  // garantía se pierde, no sólo que un test se puso rojo.
  assert.match(weakened[0], /un lector puede tomarlo por un sandbox/u);

  const unreadable = honestLimitViolations(() => { throw new Error('EACCES: permission denied'); }, limits);
  assert.equal(unreadable.length, 1);
  assert.match(unreadable[0], /pretooluse-not-a-trust-boundary/u);
  assert.match(unreadable[0], /cannot read/u);
  assert.match(unreadable[0], /EACCES/u);
});

test('FALSIFICACIÓN · honestLimitViolations compara texto literal, no un patrón que alguien pueda aflojar', () => {
  const parenthesized = {
    limit_id: 'receipt-command-is-not-re-executed',
    file: 'SKILL.md',
    phrase: 'nunca re-ejecuta el comando (ni prueba criptográficamente que corrió)',
    why: 'El receipt es evidencia escrita por quien la generó; sin el límite se lee como prueba de que el comando corrió.',
  };
  assert.deepEqual(honestLimitViolations(() => `previo\n${parenthesized.phrase}\nposterior`, [parenthesized]), []);
  // Leída como regex, la frase también aceptaría este texto sin paréntesis: no debe aceptarlo.
  const asPattern = honestLimitViolations(() => 'nunca re-ejecuta el comando ni prueba criptográficamente que corrió', [parenthesized]);
  assert.equal(asPattern.length, 1);
  assert.match(asPattern[0], /receipt-command-is-not-re-executed/u);

  const versioned = {
    limit_id: 'zip-checksum-does-not-authenticate',
    file: 'SECURITY.md',
    phrase: 'el checksum v1.0 no autentica a quien lo publicó',
    why: 'Detecta corrupción accidental del archivo distribuido; la procedencia exige un canal de verificación externo.',
  };
  const nearMiss = honestLimitViolations(() => 'el checksum v1X0 no autentica a quien lo publicó', [versioned]);
  assert.equal(nearMiss.length, 1);
  assert.match(nearMiss[0], /zip-checksum-does-not-authenticate/u);
});

test('FALSIFICACIÓN · AC10 · debilitar una frase de límite honesto en README.md, SKILL.md o SECURITY.md se reporta por archivo', () => {
  const limits = [
    {
      limit_id: 'security-scanner-is-pattern-based',
      file: 'README.md',
      phrase: 'no es SAST, SCA, taint analysis ni una base de CVEs',
      why: 'Sin esta frase el piso de patrones se lee como un análisis de seguridad completo y nadie suma la revisión que falta.',
    },
    {
      limit_id: 'receipt-evidence-not-execution-proof',
      file: 'SKILL.md',
      phrase: 'nunca re-ejecuta el comando ni prueba criptográficamente',
      why: 'El receipt lo escribe quien generó la evidencia; sin el límite se lee como prueba de que el comando corrió.',
    },
    TRUST_BOUNDARY_LIMIT,
  ];
  const intact = Object.fromEntries(limits.map((limit) => [limit.file, `contexto previo\n${limit.phrase}\ncontexto posterior`]));
  assert.deepEqual(honestLimitViolations(readDocuments(intact), limits), []);

  const reports = limits.map((target) => {
    const weakenedFile = { ...intact, [target.file]: 'redacción mejorada, sin el límite declarado' };
    const [violation, ...rest] = honestLimitViolations(readDocuments(weakenedFile), limits);
    return {
      file: target.file,
      extra: rest.length,
      namesLimit: `${violation}`.includes(target.limit_id),
      namesFile: `${violation}`.includes(target.file),
      namesWhy: `${violation}`.includes(target.why),
    };
  });
  assert.deepEqual(reports, [
    { file: 'README.md', extra: 0, namesLimit: true, namesFile: true, namesWhy: true },
    { file: 'SKILL.md', extra: 0, namesLimit: true, namesFile: true, namesWhy: true },
    { file: 'SECURITY.md', extra: 0, namesLimit: true, namesFile: true, namesWhy: true },
  ]);
});

test('el contrato real de límites honestos del repositorio verifica en verde, y cada archivo que nombra existe', SOLO_FUENTE, () => {
  const readRepositoryFile = (path) => readFileSync(join(repoRoot, path), 'utf8');
  const limits = readHonestLimits(readRepositoryFile);
  assert.deepEqual(honestLimitViolations(readRepositoryFile, limits), []);
  // Antes esta prueba fijaba los tres archivos por nombre. Dejó de valer cuando el README se acortó
  // y 46 de sus límites se MUDARON a `skills/`: la prueba se ponía roja por un cambio correcto, y
  // arreglarla agregando los nombres nuevos habría vuelto a clavar una lista que envejece igual.
  // Lo que de verdad importa no es DÓNDE vive cada límite, sino que el archivo exista y la frase
  // siga adentro —eso ya lo comprueba `honestLimitViolations`— y que la cuenta no se desplome sin
  // que nadie lo note.
  const guarded = [...new Set(limits.map((limit) => limit.file))].sort();
  assert.ok(guarded.length >= 3, `sólo ${guarded.length} archivo(s) guardan límites honestos`);
  const ausentes = guarded.filter((file) => !existsSync(join(repoRoot, file)));
  assert.deepEqual(ausentes, [], 'un límite honesto que apunta a un archivo inexistente no protege nada');
  assert.ok(limits.length >= 80, `el contrato declara ${limits.length} límites: una caída así se mira`);
});

test('FALSIFICACIÓN · main verifica los límites honestos además de los REQUIREMENTS y falla si el contrato falta, no parsea o la frase se debilitó', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-honest-limits-'));
  try {
    writeContractFixture(root);
    const rejections = (errors) => errors.filter((line) => line.startsWith('REJECTED'));

    const absent = [];
    assert.equal(main(['check'], root, () => {}, (line) => absent.push(line)), 1);
    assert.match(absent.join('\n'), /honest-limits\.json/u);

    writeHonestLimits(root, '{ "schema": "vcp.honest-limits/1", "limits": [');
    const malformed = [];
    assert.equal(main(['check'], root, () => {}, (line) => malformed.push(line)), 1);
    assert.match(malformed.join('\n'), /honest-limits\.json/u);

    const limit = {
      limit_id: 'graphify-coverage-is-bookkeeping',
      file: 'README.md',
      phrase: 'El gate prueba contabilidad, no comprensión',
      why: 'Un archivo indexado puede haber producido cero nodos: sin el límite, "cubierto" se lee como "entendido".',
    };
    writeHonestLimits(root, honestLimitsDocument([limit]));
    const output = [];
    assert.equal(main(['check'], root, (line) => output.push(line), () => {}), 0);
    assert.match(output.at(-1), /1 honest limit/u);

    writeContractFixture(root, { 'README.md': completeRead('README.md').replace(limit.phrase, 'El gate prueba comprensión') });
    const weakened = [];
    assert.equal(main(['check'], root, () => {}, (line) => weakened.push(line)), 1);
    // Los límites se suman a los REQUIREMENTS, no los reemplazan: acá el único rechazo es el límite.
    assert.equal(rejections(weakened).length, 1);
    assert.match(weakened.join('\n'), /graphify-coverage-is-bookkeeping/u);
    assert.match(weakened.join('\n'), /README\.md/u);
    assert.match(weakened.join('\n'), /"cubierto" se lee como "entendido"/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- El contrato habla de los documentos de VCP: README.md, INSTALL.md, SKILL.md. El instalador
// copia este gate al proyecto de otra persona pero NO copia README.md ni INSTALL.md, asi que alla
// el gate rechazaba SIEMPRE, con violaciones que hablan del repositorio de VCP y no del suyo. Era
// lastre copiado que nunca podia salir verde. Medido: 5 de los 26 fallos de una instalacion.
//
// Adentro de un runtime instalado no hay nada que verificar, y eso NO es un OK: es VACIO, que es la
// palabra que este protocolo usa para "no habia con que comparar". La deteccion es por FORMA y sale
// de una sola fuente -- `esRuntimeInstalado`, derivada de DEFAULT_RUNTIME_PATH en
// verify-runtime-sync.mjs -- para que no existan dos guardas que se puedan desincronizar.

test('adentro de un runtime instalado el contrato dice VACÍO, no rechaza', () => {
  const salidas = [];
  const errores = [];
  const raiz = join('C:', 'proyecto-ajeno', '.vibe', 'vcp-runtime');
  const codigo = main(['check'], raiz, (m) => salidas.push(m), (m) => errores.push(m));
  assert.equal(codigo, 0, `esperaba VACÍO y salió ${codigo}: ${errores.join(' | ')}`);
  assert.deepEqual(errores, []);
  assert.match(salidas.join('\n'), /^VACÍO:/u);
});

// --- El gate corrido desde la raíz del proyecto, que es como lo corre una persona ---------------
//
// La guarda de runtime instalado miraba SOLO el directorio de trabajo. Quien instala VCP no hace
// `cd .vibe/vcp-runtime` para correr un gate: corre `node .vibe/vcp-runtime/scripts/<gate>.mjs`
// desde la raíz de su proyecto, y ahí el cwd es su proyecto, no el runtime. Medido el 2026-09-04
// sobre una instalación real: 113 rechazos, todos hablando de README.md e INSTALL.md del
// repositorio de VCP, que el instalador no copia.
//
// Lo que decide es DÓNDE VIVE EL SCRIPT, no desde dónde se lo llamó.

test('el contrato escribe VACÍO cuando el script vive en un runtime instalado, se lo llame desde donde se lo llame', () => {
  const salidas = [];
  const errores = [];
  const code = main(['check'], '/un/proyecto/cualquiera', (l) => salidas.push(l), (l) => errores.push(l), '/un/proyecto/.vibe/vcp-runtime');
  assert.deepEqual({ code, errores }, { code: 0, errores: [] });
  assert.match(salidas.join('\n'), /^VACÍO: /u);
});

test('FALSIFICACIÓN · desde un checkout de VCP el gate sigue verificando de verdad', SOLO_FUENTE, () => {
  // Si esta prueba se pone verde por la guarda, el gate quedó apagado para todos.
  const salidas = [];
  const code = main(['check'], repoRoot, (l) => salidas.push(l), () => {}, join(repoRoot, 'scripts'));
  assert.equal(code, 0);
  assert.doesNotMatch(salidas.join('\n'), /^VACÍO: /u);
});
