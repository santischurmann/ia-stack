#!/usr/bin/env node
// Guards the small set of user-visible protocol promises that previously drifted across docs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EMPTY_PREFIX, esRuntimeInstalado } from './verify-runtime-sync.mjs';

export const USAGE = 'usage: verify-vcp-contract.mjs check';
export const REQUIREMENTS = [
  ['README.md', /VCP ayuda a una IA/u, 'simple purpose statement'],
  ['README.md', /\.vibe\/vcp-runtime\/scripts\//u, 'project-local runtime command path'],
  ['INSTALL.md', /--project\b/u, 'explicit Bash project installation'],
  ['INSTALL.md', /-ProjectDir\b/u, 'explicit PowerShell project installation'],
  ['SKILL.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'runtime plan gate'],
  ['SKILL.md', /verify-security-baseline\.mjs/u, 'mechanical security baseline'],
  ['skills/integracion-graphify.md', /verify-backup-state\.mjs/u, 'verified Graphify backup'],
  ['README.md', /verify-backup-state\.mjs/u, 'verified Graphify backup'],
  // Two halves of one promise, pinned apart because each fails on its own. Who owns the seal is
  // what stops somebody from wiring the gate back to the report's `Built from commit:` line — the
  // line Graphify leaves behind on a docs-only commit. The order is what makes the seal true:
  // recording before the commit binds the receipt to the previous HEAD.
  ['skills/integracion-graphify.md', /El sello lo registra el protocolo, no Graphify/u, 'the backup seal is recorded by the protocol, never read from the Graphify report'],
  ['skills/integracion-graphify.md', /commit → graphify → record → check/u, 'documented backup ordering'],
  ['README.md', /Modelo de seguridad y límites/u, 'native security-model link'],
  ['README.md', /Research: investigar antes de especificar/u, 'research-first user workflow'],
  ['skills/gates.md', /verify-product-diagnostics\.mjs/u, 'six product-discovery diagnostics gate'],
  ['SKILL.md', /verify-product-diagnostics\.mjs check/u, 'six product-discovery diagnostics gate'],
  ['skills/research.md', /Los diagnósticos comprueban forma e invariantes, nunca verdad semántica\./u, 'diagnostics honest semantic limit'],
  ['skills/research.md', /build-complete-review-index\.mjs/u, 'complete static research review index'],
  ['skills/research.md', /sin confundirlas con comprensión\s+semántica/u, 'research static-pass honesty boundary'],
  ['README.md', /verify-scope-diff\.mjs check/u, 'mechanical scope-vs-diff gate'],
  ['README.md', /verify-graphify-manifest\.mjs check/u, 'mechanical Graphify coverage gate'],
  ['skills/integracion-graphify.md', /verify-obsidian-export\.mjs check graphify-out\/obsidian/u, 'project-local Obsidian export gate'],
  ['README.md', /verify-obsidian-export\.mjs check graphify-out\/obsidian/u, 'project-local Obsidian export gate'],
  ['skills/gates.md', /verify-audit-chain\.mjs/u, 'mechanical audit-chain gate'],
  ['SKILL.md', /--baseline <archivo>/u, 'security baseline for reviewed debt'],
  ['SKILL.md', /verify-receipt\.mjs commit/u, 'validate-and-write in one run'],
  // Los dos cierres de esta noche: quien firmo, y cuanto tardo la persona en elegir. Fijados como
  // comando + motivo, porque borrar el comando y borrar la explicacion son dos perdidas distintas.
  ['SKILL.md', /verify-receipt\.mjs custody/u, 'the protocol reports who signed the commit carrying the receipt'],
  ['SKILL.md', /si el agente puede correr `git commit -S`, firma como vos/u, 'custody holds only as far as the key demands a human'],
  ['SKILL.md', /Un agente que espera igual pasa: detecta lo imposible/u, 'the deliberation floor catches the impossible, not the dishonest'],
  ['SKILL.md', /contracts\/honest-limits\.json/u, 'honest limits declared as reviewable data'],
  ['README.md', /contracts\/honest-limits\.json/u, 'honest limits declared as reviewable data'],
  ['SKILL.md', /nunca reescribe historial por su cuenta/u, 'sealed commit never rewrites history'],
  ['SKILL.md', /Lo que no cubre/u, 'security baseline honest limit'],
  ['SKILL.md', /verify-audit-chain\.mjs append/u, 'audit lines are sealed, never hand-written'],
  // El ancla externa y el motivo, por separado: si alguien saca el comando, el contrato lo dice;
  // si alguien saca la explicacion de por que `check` no alcanza, tambien.
  ['SKILL.md', /verify-audit-chain\.mjs history \.vibe\/AUDIT\.md/u, 'external anchor: git history backs the audit trail'],
  ['SKILL.md', /No agarra recortar el final ni/u, 'check alone does not catch truncation or wholesale rewrite'],
  ['skills/vibe-memory.md', /verify-audit-chain\.mjs append/u, 'audit lines are sealed, never hand-written'],
  ['skills/vibe-memory.md', /Lo que el gate no detecta/u, 'audit-chain honest limit'],
  ['SKILL.md', /verify-runtime-sync\.mjs check/u, 'mechanical runtime-sync gate'],
  ['SKILL.md', /Reproducir antes de diagnosticar/u, 'reproduce before diagnosing'],
  ['SKILL.md', /Contexto acotado por agente/u, 'bounded per-agent context'],
  ['SKILL.md', /Cuándo una fase está terminada/u, 'explicit phase-completion rule'],
  ['SKILL.md', /Redacción reutilizable/u, 'reuse canonical wording'],
  ['skills/gates.md', /verify-runtime-sync\.mjs check/u, 'mechanical runtime-sync gate'],
  // Running the gate from inside .vibe/vcp-runtime/ compares the installed copy with itself: it is
  // always green and proves nothing. The promise that it runs from the source checkout is the whole
  // gate, so it is pinned as text and not left to whoever edits the phase later.
  ['SKILL.md', /nunca desde el runtime/u, 'runtime-sync gate runs from the source checkout, never against itself'],
  ['skills/integracion-graphify.md', /verify-graphify-manifest\.mjs check/u, 'mechanical Graphify coverage gate'],
  ['skills/integracion-graphify.md', /El gate prueba contabilidad, no comprensión/u, 'Graphify coverage honest limit'],
  ['SECURITY.md', /dato no confiable/u, 'external-artifact trust boundary'],
  ['SECURITY.md', /no hace taint analysis/u, 'honest native-security limit'],
  ['SECURITY.md', /configuraciones peligrosas de GitHub Actions/u, 'documented GitHub Actions detection scope'],
  ['SECURITY.md', /no una frontera de confianza/u, 'PreToolUse hook honest limit'],
  ['SECURITY.md', /no autentica a quien/u, 'ZIP checksum honest limit'],
  ['SKILL.md', /Regla dura sobre `acceptance_criteria`: `terminal_state: "approved"` exige TODOS los AC/u, 'receipt v2: all-AC-COMPLIANT requirement'],
  ['SKILL.md', /nunca re-ejecuta el comando ni prueba criptográficamente/u, 'receipt v2: command/result is reviewable evidence, not cryptographic proof'],
  ['SKILL.md', /`?scope\.declared_paths`? sigue siendo un writer set[\s\S]*verify-scope-diff\.mjs/u, 'receipt v2: scope declaration and separate diff gate'],
  ['SKILL.md', /\.vibe\/vcp-runtime\/scripts\/verify-spec-wordcap\.mjs/u, 'mechanical spec word-cap gate'],
  ['SKILL.md', /verify-spec-wordcap\.mjs check docs\/spec\.md --quality/u, 'strict spec quality-shape gate'],
  ['skills/gates.md', /verify-spec-wordcap\.mjs --quality/u, 'strict spec quality-shape gate'],
  ['SKILL.md', /verify-capability-matrix\.mjs check \.vibe\/vcp-runtime\/contracts\/capability-matrix\.json/u, 'mechanical capability-separation gate'],
  ['skills/gates.md', /verify-capability-matrix\.mjs/u, 'capability matrix gate'],
  ['SKILL.md', /verify-discovery-core\.mjs/u, 'immutable Discovery history gate'],
  ['SKILL.md', /verify-scope-diff\.mjs check/u, 'mechanical scope-vs-diff gate'],
  // The two halves are pinned separately on purpose: `criteria` closes Phase 6 and `claims` closes
  // Phase 2, so deleting either command from its phase must fail on its own. The old comment said
  // "Phase 4" and "Phase 0.5": neither matched where the commands actually live, and Phase 0.5 does
  // not exist. Fixed when the five phase vocabularies were unified.
  ['SKILL.md', /verify-evidence-trace\.mjs criteria/u, 'mechanical criterion-to-test trace gate'],
  ['SKILL.md', /verify-evidence-trace\.mjs claims/u, 'mechanical claim-to-spec reference gate'],
  ['SKILL.md', /claims --feature <feature-slug> --require-inputs --require-links/u, 'strict claim-link completeness at final close'],
  ['skills/gates.md', /`--require-links` exige además[\s\S]*packet no vacío[\s\S]*cada claim/u, 'strict claim-link completeness documented'],
  ['skills/gates.md', /verify-evidence-trace\.mjs/u, 'mechanical evidence-trace gate'],
  // Este ancla fijaba `Usa 1 worker por defecto`, que es FALSO: la constante del script es 32 y la
  // variable de entorno existe para bajarla. El contrato clavaba la mentira en su lugar, y por eso
  // una correccion anterior pudo arreglar el parrafo de arriba y no la fila de la tabla. Ahora fija
  // el hecho -- el valor real y para que sirve el override -- en vez de una redaccion.
  ['skills/gates.md', /--test-concurrency=32[\s\S]*?VCP_TEST_CONCURRENCY=<n>` existe para \*\*bajarlo\*\*/u, 'coverage runner default is 32 and the override only lowers it'],
  ['skills/gates.md', /VCP_BASH_PATH/u, 'explicit Windows Bash selection'],
  ['SKILL.md', /verify-evidence-runner\.mjs run/u, 'native argv evidence runner'],
  ['SKILL.md', /verify-evidence-runner\.mjs check .*--require-complete/u, 'strict evidence completion gate'],
  ['skills/gates.md', /verify-evidence-runner\.mjs/u, 'native evidence runner'],
  // Phase 6 runs `criteria` where the spec must already exist, so dropping the flag would turn a
  // deleted spec back into a green. The flag is pinned separately from the command for that reason.
  ['SKILL.md', /criteria --spec docs\/spec\.md --tests tests --require-inputs/u, 'Phase 6 criteria run rejects a missing spec instead of passing empty'],
  ['SKILL.md', /escribe VACÍO, no OK/u, 'empty green is written as empty, never as verified'],
  // The gate and the rule are pinned separately: the retry limit is a protocol rule that must stay
  // written even if somebody moves, renames or deletes the gate that detects it.
  ['SKILL.md', /verify-session-state\.mjs check/u, 'mechanical resumable-session-state gate'],
  ['SKILL.md', /tercer intento fallido sobre el mismo problema/u, 'three-attempt stop-and-ask rule'],
  ['skills/gates.md', /verify-session-state\.mjs check/u, 'mechanical resumable-session-state gate'],
  // Las dos mitades se fijan aparte a propósito: el gate detecta la regla, pero la regla —ninguna
  // fase cierra sin una elección registrada— es del protocolo y tiene que seguir escrita aunque
  // alguien mueva, renombre o borre el gate que la detecta.
  ['SKILL.md', /verify-phase-decisions\.mjs check docs\/phase-decisions\.json/u, 'mechanical phase-decision gate'],
  ['SKILL.md', /verify-phase-decisions\.mjs check docs\/phase-decisions\.json[\s\S]*--require-complete/u, 'complete phase-decision gate at final close'],
  ['SKILL.md', /Ninguna fase cierra sin una elección registrada/u, 'no phase closes without a recorded human choice'],
  ['skills/gates.md', /verify-phase-decisions\.mjs check/u, 'mechanical phase-decision gate'],
  ['SKILL.md', /verify-phase-menu\.mjs check docs\/phase-decisions\.json --plan docs\/phase-plan\.json/u, 'canonical phase-plan integration gate'],
  ['skills/gates.md', /verify-phase-menu\.mjs check/u, 'canonical phase-plan integration gate'],
  ['templates/diagnostics/caio.json', /vcp\.caio\/1/u, 'CAIO diagnostic template schema'],
  ['templates/phase-plan.json', /vcp\.phase-plan\/1/u, 'canonical phase-plan template schema'],
  // El gate y la regla, otra vez por separado: la sonda detecta el verde vacío, y la regla dice por
  // qué existe. Borrar el gate no puede borrar en silencio el motivo por el que se agregó.
  ['SKILL.md', /verify-empty-probe\.mjs check contracts\/empty-probe\.json/u, 'mechanical empty-directory probe gate'],
  ['SKILL.md', /un gate nuevo tiene que declarar qué hace cuando no hay nada que verificar/iu, 'a new gate must declare its no-input behaviour'],
  ['skills/gates.md', /verify-empty-probe\.mjs check/u, 'mechanical empty-directory probe gate'],
  // El gate y su limite: el numero sin la advertencia de que son lineas y no ramas se lee como
  // "el 72% del comportamiento esta probado", que es exactamente lo que no dice.
  ['SKILL.md', /verify-shell-coverage\.mjs check contracts\/shell-coverage\.json/u, 'mechanical shell line-coverage gate'],
  ['SKILL.md', /Mide líneas ejecutadas, no ramas/u, 'shell coverage counts executed lines, never branches'],
  ['skills/gates.md', /verify-shell-coverage\.mjs check/u, 'mechanical shell line-coverage gate'],
  // El diccionario es la promesa de que este README se puede leer sin saber la jerga. Fijado como
  // texto: si alguien lo borra al reorganizar, el contrato lo dice en vez de quedar en silencio.
  ['README.md', /## Diccionario: qué significa cada palabra rara/u, 'plain-language dictionary for every technical term'],
  // El titulo solo no alcanza: borrar la tabla entera dejaba el README prometiendo un diccionario
  // que no estaba, y el contrato en verde. Se fija tambien una fila, que es el cuerpo real.
  ['README.md', /\| \*\*verde vac\u00edo\*\* \|/u, 'the dictionary body, not only its heading'],
  ['README.md', /prueban forma, cadena y estado, nunca/u, 'gates prove form, chain and state -- never truth'],
  ['templates/vibe/SESSION.md', /## Intentos fallidos/u, 'documented failed-attempt section'],
  ['templates/vibe/SESSION.md', /## Interrumpido en/u, 'documented interruption resume point'],
  ['templates/vibe/SESSION.md', /## No verificado/u, 'documented unverified-check section'],
  ['templates/spec.md', /## Discovery \/ Investigación previa/u, 'Discovery evidence section in canonical spec'],
  ['templates/plan.md', /## Write-conflict preflight/u, 'canonical plan preflight section'],
  ['templates/plan.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'canonical plan gate command'],
  ['skills/spec-plan-templates.md', /\.vibe\/vcp-runtime\/scripts\/verify-plan-conflicts\.mjs/u, 'embedded plan gate command'],
  // El bucle de auto-mejora. Las dos mitades se fijan por separado a proposito: `due` sin `check` es
  // un recordatorio que no verifica nada, y `check` sin `due` es un gate que nadie sabe cuando correr.
  ['README.md', /verify-sereno\.mjs due/u, 'self-improvement loop: how to know a round is due'],
  ['README.md', /verify-sereno\.mjs check/u, 'self-improvement loop: how to verify the round it wrote'],
  ['SKILL.md', /\.vibe\/vcp-runtime\/scripts\/verify-sereno\.mjs/u, 'self-improvement loop wired into PHASE 9'],
  ['README.md', /\*\*como mucho cuatro\*\*/u, 'the cap of four proposals, which is the feature'],
  ['skills/vibe-memory.md', /4000 caracteres/u, 'the forward-only cap on a new audit line'],
];

// Narrow, phrase-level bans — never a bare word ban — so legitimate uses of "genuine" elsewhere
// (e.g. "a receipt produced by a genuine emit() run", "genuinely the same work") stay untouched.
// Each entry targets the exact collocation that overclaims what the PreToolUse RED gate proves;
// see scripts/pretooluse-red.mjs's own header comment for the honest claim these must match.
export const FORBIDDEN_PHRASES = [
  ['SKILL.md', /confirms a genuine RED/iu, 'overclaims RED as genuine instead of accepted/evidence-based'],
  ['SKILL.md', /\bgenuine RED\b/iu, 'overclaims RED as genuine instead of accepted/evidence-based'],
  ['SKILL.md', /if Skill `cyber-neo` is present/iu, 'depends on an external security skill'],
  ['skills/security-baseline.md', /fallback when cyber-neo/i, 'describes the native gate as an external-skill fallback'],
  ['SKILL.md', /fableultracode|cyber-neo/iu, 'depends on a named external skill in the live protocol'],
  ['skills/caveman-tdd.md', /cyber-neo/iu, 'depends on a named external security skill in a live checklist'],
  ['skills/orchestrator-opus.md', /fableultracode|cyber-neo/iu, 'depends on a named external skill in the orchestrator contract'],
  ['skills/vibe-memory.md', /cyber-neo/iu, 'depends on a named external security skill in the memory protocol'],
];

// --- Honest limits declared as reviewable data -------------------------------------------------
// The REQUIREMENTS above pin phrases without saying WHY each one matters, so an edit that
// "improves the wording" can weaken a limit and nobody learns which guarantee was lost. This half
// moves the limits into a data file where each one carries the reason it exists.
export const HONEST_LIMITS_FILE = 'contracts/honest-limits.json';
export const HONEST_LIMITS_SCHEMA = 'vcp.honest-limits/1';
const LIMIT_FIELDS = ['limit_id', 'file', 'phrase', 'why'];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const WINDOWS_DRIVE = /^[a-z]:/iu;
const MIN_WHY_LENGTH = 20;
// Padded filler defeats a length floor on its own ('placeholder placeholder' clears 20 characters),
// so the test is "the whole reason is nothing but filler tokens" rather than an anchored blocklist:
// at this floor an anchored list could only ever match strings the floor already rejected.
const FILLER_REASONS = new Set([
  'todo', 'tbd', 'tbc', 'na', 'n/a', 'none', 'null', 'nil', 'ninguno', 'ninguna', 'pendiente',
  'placeholder', 'relleno', 'lorem', 'ipsum', 'xxx', 'yyy', 'zzz', 'foo', 'bar', 'fixme', 'wip',
  'unknown', 'desconocido', 'porque', 'because', 'reason', 'motivo', 'razon', 'why', 'etc',
]);

function isWellFormedLimit(limit) {
  if (limit === null || typeof limit !== 'object') return false;
  return Object.keys(limit).length === LIMIT_FIELDS.length
    && LIMIT_FIELDS.every((field) => typeof limit[field] === 'string');
}

function escapesProject(file) {
  const normalized = file.trim().replaceAll('\\', '/');
  return normalized === ''
    || normalized.startsWith('/')
    || WINDOWS_DRIVE.test(normalized)
    || normalized.split('/').includes('..');
}

function isPlaceholderReason(why) {
  const tokens = why.toLowerCase().split(/\s+/u)
    .map((token) => token.replace(/^\W+|\W+$/gu, ''))
    .filter((token) => token !== '');
  return tokens.every((token) => FILLER_REASONS.has(token));
}

export function readHonestLimits(read) {
  let raw;
  try {
    raw = read(HONEST_LIMITS_FILE);
  } catch (error) {
    // A missing contract is a configuration error, never "zero limits to verify": degrading here
    // would make deleting one file the way to delete every guarantee it protects.
    throw new Error(`${HONEST_LIMITS_FILE}: cannot read (${error.message})`);
  }
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${HONEST_LIMITS_FILE} is not valid JSON: ${error.message}`);
  }
  if (document?.schema !== HONEST_LIMITS_SCHEMA) {
    throw new Error(`${HONEST_LIMITS_FILE} must declare schema ${HONEST_LIMITS_SCHEMA}`);
  }
  if (!Array.isArray(document.limits)) throw new Error(`${HONEST_LIMITS_FILE} must contain a limits array`);
  if (document.limits.length === 0) throw new Error(`${HONEST_LIMITS_FILE} must declare at least one honest limit`);
  const seen = new Set();
  for (const limit of document.limits) {
    if (!isWellFormedLimit(limit)) {
      throw new Error(`every honest limit needs exactly a limit_id, file, phrase and why: ${JSON.stringify(limit)}`);
    }
    if (!KEBAB_CASE.test(limit.limit_id)) throw new Error(`limit_id must be kebab-case: ${limit.limit_id}`);
    if (limit.phrase.trim() === '') throw new Error(`phrase must not be empty: ${limit.limit_id}`);
    if (escapesProject(limit.file)) throw new Error(`the guarded file must stay inside the project: ${limit.file}`);
    if (limit.why.trim().length < MIN_WHY_LENGTH || isPlaceholderReason(limit.why)) {
      throw new Error(`${limit.limit_id} needs a real reason, not a placeholder`);
    }
    // Two entries under one id cannot both be reviewed as "the" reason for that limit, and the
    // second silently shadows the first in every report that keys by limit_id.
    if (seen.has(limit.limit_id)) throw new Error(`duplicate honest limit: ${limit.limit_id}`);
    seen.add(limit.limit_id);
  }
  return document.limits;
}

export function honestLimitViolations(read, limits) {
  const violations = [];
  for (const limit of limits) {
    let content;
    try {
      content = read(limit.file);
    } catch (error) {
      violations.push(`${limit.file}: honest limit ${limit.limit_id} cannot read (${error.message})`);
      continue;
    }
    // Literal containment, never a regex: an honest limit must not rest on a pattern somebody can
    // loosen. The reason travels with the violation because whoever broke the phrase needs to know
    // which guarantee was lost, not just that a test turned red.
    if (!content.includes(limit.phrase)) {
      violations.push(`${limit.file}: honest limit ${limit.limit_id} is no longer stated — ${limit.why}`);
    }
  }
  return violations;
}

export function contractViolations(read) {
  const violations = [];
  for (const [path, required, label] of REQUIREMENTS) {
    let content;
    try {
      content = read(path);
    } catch (error) {
      violations.push(`${path}: cannot read (${error.message})`);
      continue;
    }
    if (!required.test(content)) violations.push(`${path}: missing ${label}`);
    if (/at least 90%/iu.test(content)) violations.push(`${path}: stale 90% coverage policy`);
  }
  for (const [path, forbidden, label] of FORBIDDEN_PHRASES) {
    let content;
    try {
      content = read(path);
    } catch (error) {
      violations.push(`${path}: cannot read (${error.message})`);
      continue;
    }
    if (forbidden.test(content)) violations.push(`${path}: ${label}`);
  }
  return violations;
}

export function main(args = process.argv.slice(2), cwd = '.', write = console.log, writeError = console.error) {
  if (args.length !== 1 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  // The declared limits are wired here and never inside contractViolations: that helper is called
  // with readers that answer prose for every path, so making it read the JSON contract would turn
  // its own callers into parse failures.
  // Este contrato habla de los documentos de VCP, y el instalador no copia README.md ni INSTALL.md.
  // Adentro del runtime instalado de otra persona no hay nada que verificar, y eso NO es un OK:
  // es VACIO. Antes rechazaba siempre, con violaciones que hablaban del repositorio de VCP.
  if (esRuntimeInstalado(cwd)) {
    write(`${EMPTY_PREFIX}este contrato verifica los documentos de VCP, que el instalador no copia: adentro de un runtime instalado no hay nada que comparar`);
    return 0;
  }
  const read = (path) => readFileSync(join(cwd, path), 'utf8');
  const violations = contractViolations(read);
  let limits = [];
  try {
    limits = readHonestLimits(read);
    violations.push(...honestLimitViolations(read, limits));
  } catch (error) {
    violations.push(error.message);
  }
  if (violations.length > 0) {
    for (const violation of violations) writeError(`REJECTED: ${violation}`);
    return 1;
  }
  write(`OK: ${REQUIREMENTS.length + FORBIDDEN_PHRASES.length} user-visible protocol contract checks pass; ${limits.length} honest limit${limits.length === 1 ? '' : 's'} verified.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-vcp-contract.mjs')) {
  process.exitCode = main();
}
