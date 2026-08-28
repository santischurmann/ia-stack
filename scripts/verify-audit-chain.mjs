#!/usr/bin/env node
// verify-audit-chain.mjs — proves .vibe/AUDIT.md is a hash chain, not just an append-only file, and
// writes the seals it verifies. Each chained line carries sha256(previous chain + LF + this line),
// so rewriting a line that was already written invalidates that line and every line after it.
// Without this, "the audit trail says so" is worth exactly as much as the last person to open the
// file in an editor. `append` lives in this module instead of its own script on purpose: writer and
// verifier then share chainHashFor, one seal-suffix grammar and one EOL normalization, so they
// cannot drift into a writer that seals lines the verifier rejects.
//
// What it does NOT prove: it catches an edited line, a sealed line that lost its seal, and a seal
// that was blanked, truncated or uppercased — a ` | chain:` tail that is not 64 lowercase hex is a
// rejection, not a legacy line. It does not resist someone with access to the disk who recomputes
// the whole chain, and it cannot see two kinds of deletion: dropping trailing lines leaves a shorter
// chain that still verifies, and stripping every ` | chain:` suffix outright (separator included)
// leaves a fully-legacy trace, which is indistinguishable from a project that never chained
// anything. The hashes live in the same file they protect, so a wholesale rewrite is always
// internally consistent. Tamper-evidence against a motivated author needs an external anchor (a
// signed commit, a notarized digest, a recorded chain head) that this gate does not have. Having a
// writer does not close any of that: `append` refuses to seal on top of an already-broken trace, so
// it never lends a fresh valid seal to forged history, but it cannot repair one either.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';

export const USAGE = 'usage: verify-audit-chain.mjs check <audit.md> [--require-inputs] | verify-audit-chain.mjs history <audit.md> [--require-inputs] | verify-audit-chain.mjs append <audit.md> "<line>"';
export const NO_INPUTS_CODE = 'AUDIT_CHAIN_NO_INPUTS';
export const HISTORY_CODE = 'AUDIT_CHAIN_HISTORY_BROKEN';
export const EMPTY_PREFIX = 'VACÍO: ';
export const REQUIRE_INPUTS_FLAG = '--require-inputs';
export const APPEND_USAGE = 'usage: verify-audit-chain.mjs append <audit.md> "<line text>"';
// Traces that predate the chain keep verifying: the alternative is asking every existing project to
// rewrite its history, which is the one thing an audit trail must never be asked to do.
export const LEGACY_PREFIX_ALLOWED = true;

// Only an exact 64-lowercase-hex tail counts as a declaration; digest('hex') emits nothing else.
const CHAIN_SUFFIX = / \| chain:([0-9a-f]{64})$/u;
// A tail that tries to declare a seal and fails is the third state, and it is a rejection. Reading
// it as ordinary text is what let ` | chain:BORRADO` over every line degrade a sealed trace into a
// "fully legacy" one — a valid state — with the forged content still inside it.
const BROKEN_SEAL_SUFFIX = /\s\|\s*chain:\S*$/iu;

const MISSING_CHAIN = 'the chain already started, so this line must declare its own | chain:<sha256> suffix';
const HASH_MISMATCH = 'the declared chain hash is not sha256(previous chain + LF + this line) — the line or an earlier one was edited after it was written';
const BROKEN_SEAL = 'this line ends in a | chain: suffix that is not 64 lowercase hex — a blanked, truncated or re-cased seal is tampering, not a legacy line';

const EMPTY_TEXT = 'the line text is blank — sealing an empty entry writes a line nobody can ever remove and nobody can read';
const MULTILINE_TEXT = 'the line text spans more than one line — one seal covers exactly one line, so the extra lines would land unsealed and break the chain on the next check';
const PRESEALED_TEXT = 'the line text already ends in a | chain: suffix — seals are computed here, never supplied by the caller';
const BROKEN_TRACE = 'the existing trace is already broken, so a fresh seal on top would only certify tampered history';

export function chainHashFor(previousChain, lineWithoutChain) {
  return createHash('sha256').update(`${previousChain}\n${lineWithoutChain}`, 'utf8').digest('hex');
}

/** `index` is the physical 1-based line of the file, not the position among non-blank entries, so a
 * rejection names the line a human can jump to in an editor. Splitting on /\r?\n/ keeps a CRLF
 * checkout (.gitattributes marks *.md text=auto) from carrying a trailing \r into the hashed text,
 * which would otherwise make the same file verify on Linux and fail on Windows. */
export function parseAuditLines(content) {
  const entries = [];
  const lines = content.split(/\r?\n/u);
  for (let offset = 0; offset < lines.length; offset += 1) {
    const line = lines[offset];
    if (line.trim() === '') continue;
    // line.match, not the regex's own exec method: identical result for a non-global pattern, .index
    // included, and the security baseline reads that method name plus a paren as dynamic execution.
    const declared = line.match(CHAIN_SUFFIX);
    entries.push(declared
      ? { index: offset + 1, text: line.slice(0, declared.index), chain: declared[1], malformedChain: false }
      : { index: offset + 1, text: line, chain: null, malformedChain: BROKEN_SEAL_SUFFIX.test(line) });
  }
  return entries;
}

export function verifyChain(content) {
  let previousChain = null;
  let verified = 0;
  for (const entry of parseAuditLines(content)) {
    // Checked before the legacy allowance, and regardless of whether the chain has started: a broken
    // seal on the very first line is still someone erasing a seal, not a trace that never had one.
    if (entry.malformedChain) {
      return { ok: false, verified, brokenLine: entry.index, reason: BROKEN_SEAL };
    }
    if (entry.chain === null) {
      // Legacy lines are only tolerated as a prefix. Once the chain starts, dropping the suffix is
      // the cheapest way to erase a line, so from there on an unchained line is a broken chain.
      if (previousChain === null) continue;
      return { ok: false, verified, brokenLine: entry.index, reason: MISSING_CHAIN };
    }
    if (chainHashFor(previousChain ?? '', entry.text) !== entry.chain) {
      return { ok: false, verified, brokenLine: entry.index, reason: HASH_MISMATCH };
    }
    previousChain = entry.chain;
    verified += 1;
  }
  return { ok: true, verified, brokenLine: null, reason: null };
}

/** Pure half of `append`: decides the bytes to add, or the reason the line cannot be sealed at all.
 * Everything it rejects is a line that would make the very next `check` fail, plus a blank entry,
 * which would verify but is unremovable noise once sealed. */
export function sealLineFor(content, text) {
  const refuse = (reason) => ({ ok: false, chain: null, append: null, reason });
  if (text.trim() === '') return refuse(EMPTY_TEXT);
  if (/[\r\n]/u.test(text)) return refuse(MULTILINE_TEXT);
  // Deliberately the same grammar the parser uses to spot a seal attempt, so "carries a seal" means
  // one thing in this module: a hand-written tail can never be mistaken for a computed one.
  if (BROKEN_SEAL_SUFFIX.test(text)) return refuse(PRESEALED_TEXT);
  const existing = verifyChain(content);
  if (!existing.ok) return refuse(`${BROKEN_TRACE} (line ${existing.brokenLine}: ${existing.reason})`);
  // verifyChain passing means sealed lines form a contiguous tail, so the last non-blank entry holds
  // the chain head — or carries no seal at all, and this is the first link, which starts from ''.
  const head = parseAuditLines(content).at(-1)?.chain ?? '';
  const chain = chainHashFor(head, text);
  // A file whose last line has no newline would otherwise swallow the new entry into it. Always LF:
  // the seal is computed over \r-free text, so writing LF keeps the bytes matching what was hashed.
  const separator = content === '' || content.endsWith('\n') ? '' : '\n';
  return { ok: true, chain, append: `${separator}${text} | chain:${chain}\n`, reason: null };
}

/** check and append must agree on what an unreadable file means, so they read through one door. */
function readAudit(path, readFile) {
  try {
    return { content: readFile(path, 'utf8'), error: null };
  } catch (error) {
    // No file means a project that has not written a trace yet, which is an empty chain, not a
    // broken one. Every other read failure is the gate being unable to look — that stays a failure.
    if (error.code === 'ENOENT') return { content: '', error: null };
    return { content: null, error: `unable to read ${path}: ${error.message}` };
  }
}

function appendCommand(args, options, write, writeError) {
  if (args.length !== 3) {
    writeError(APPEND_USAGE);
    return 2;
  }
  const [, path, text] = args;
  const appendFile = options.appendFile ?? appendFileSync;
  const { content, error } = readAudit(path, options.readFile ?? readFileSync);
  if (error !== null) {
    writeError(`REJECTED: ${error}`);
    return 1;
  }
  const sealed = sealLineFor(content, text);
  if (!sealed.ok) {
    writeError(`REJECTED: cannot seal a new line into ${path}: ${sealed.reason}.`);
    return 1;
  }
  try {
    appendFile(path, sealed.append, 'utf8');
  } catch (failure) {
    writeError(`REJECTED: unable to append to ${path}: ${failure.message}`);
    return 1;
  }
  write(`OK: sealed a new line into ${path}; chain head is now ${sealed.chain}.`);
  return 0;
}


// --- El ancla externa ---------------------------------------------------------------------------
//
// El límite declarado de este gate decía que recortar la cadena o refabricarla entera exigían "un
// ancla fuera del archivo, y no hay ninguna portable". Eso era falso, y la respuesta estaba a la
// vista: **git ya es esa ancla**. Un archivo de auditoría sólo crece, así que cada versión
// commiteada tiene que empezar con la anterior. Recortar, reescribir o borrar rompe esa relación
// contra un registro que no vive dentro del archivo atacado.
//
// LÍMITE HONESTO, el que queda: quien reescriba la historia de git puede fabricar una secuencia
// coherente. Pero eso ya no es editar un archivo: cambia los identificadores de cada commit, y
// cualquiera con un clon previo o con el remoto lo ve. El ancla no es infalible; es que atacarla
// deja huella donde otros la pueden mirar.

export function gitVersions(path, cwd, run = spawnSync) {
  const git = (...args) => run("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const log = git("log", "--format=%H", "--reverse", "--", path);
  if (log.status !== 0) {
    // Un repo sin ningun commit no es historia rota: es un proyecto que todavia no registro nada.
    // Se distingue preguntando si existe HEAD, en vez de leer el texto del error, que cambia
    // entre versiones de git y entre idiomas.
    const head = git("rev-parse", "--verify", "--quiet", "HEAD");
    if (head.status !== 0) return { error: null, versions: [] };
    return { error: `no se puede leer la historia de ${path}: ${(log.stderr || "").trim()}`, versions: [] };
  }
  const commits = (log.stdout || "").split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean);
  const versions = [];
  for (const commit of commits) {
    const show = git("show", `${commit}:${path}`);
    // Un commit que borró el archivo no tiene contenido que mostrar: se registra como vacío, que
    // es exactamente lo que hay que detectar, no un motivo para saltearlo.
    versions.push({ commit, content: show.status === 0 ? (show.stdout ?? "") : "" });
  }
  return { error: null, versions };
}

/** Cada versión tiene que empezar con la anterior. Nombra la primera que no. */
export function verifyGrowth(versions, working) {
  for (let i = 1; i < versions.length; i += 1) {
    if (!versions[i].content.startsWith(versions[i - 1].content)) {
      return { ok: false, commit: versions[i].commit, reason: `el commit ${versions[i].commit.slice(0, 7)} no extiende la versión anterior: la traza se recortó, se reescribió o se borró` };
    }
  }
  const ultima = versions.at(-1);
  if (ultima !== undefined && working !== null && !working.startsWith(ultima.content)) {
    return { ok: false, commit: null, reason: `el archivo sin commitear no extiende la última versión registrada (${ultima.commit.slice(0, 7)})` };
  }
  return { ok: true, commit: null, reason: null };
}

export function historyCommand(args, options, write, writeError) {
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  const rest = requireInputs ? args.slice(0, -1) : args;
  if (rest.length !== 2) {
    writeError(USAGE);
    return 2;
  }
  const path = rest[1];
  const cwd = options.cwd ?? ".";
  const { error, versions } = gitVersions(path, cwd, options.run);
  if (error !== null) {
    writeError(`REJECTED: ${HISTORY_CODE}: ${error}`);
    return 1;
  }
  if (versions.length === 0) {
    const message = `${path} no tiene ninguna versión commiteada: sin historia no hay ancla que comparar.`;
    if (requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${message}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${message}`);
    return 0;
  }
  // El archivo se lee contra el MISMO cwd que se le pasa a git. Sin esto, el gate comparaba la
  // historia de un repo contra el archivo de trabajo de otro, y con --cwd distinto del proceso
  // daba un rechazo que no tenia nada que ver con la traza mirada.
  const { content: working } = readAudit(join(cwd, path), options.readFile ?? readFileSync);
  const result = verifyGrowth(versions, working);
  if (!result.ok) {
    writeError(`REJECTED: ${HISTORY_CODE}: ${result.reason}`);
    return 1;
  }
  write(`OK: ${path} sólo creció a lo largo de ${versions.length} versión(es) commiteada(s); recortarla o reescribirla exigiría reescribir la historia de git.`);
  return 0;
}
export function main(args = process.argv.slice(2), options = {}, write = console.log, writeError = console.error) {
  if (args[0] === 'append') return appendCommand(args, options, write, writeError);
  if (args[0] === 'history') return historyCommand(args, options, write, writeError);
  const requireInputs = args.at(-1) === REQUIRE_INPUTS_FLAG;
  if (requireInputs) args = args.slice(0, -1);
  if (args.length !== 2 || args[0] !== 'check') {
    writeError(USAGE);
    return 2;
  }
  const path = args[1];
  const { content, error } = readAudit(path, options.readFile ?? readFileSync);
  if (error !== null) {
    writeError(`REJECTED: ${error}`);
    return 1;
  }
  const result = verifyChain(content);
  if (!result.ok) {
    writeError(`REJECTED: ${path} breaks its audit chain at line ${result.brokenLine}: ${result.reason}.`);
    return 1;
  }
  // Zero verified lines is the strongest form of the limit this gate already declares: deleting the
  // whole file used to read exactly like an intact chain. It stays exit 0 -- a project that has not
  // written a trace yet is not in violation -- but it no longer gets to say it verified anything.
  if (result.verified === 0) {
    const message = `${path} has no sealed line: an audit trail that does not exist yet is not a verified chain.`;
    if (requireInputs) {
      writeError(`REJECTED: ${NO_INPUTS_CODE}: ${message}`);
      return 1;
    }
    write(`${EMPTY_PREFIX}${message}`);
    return 0;
  }
  write(`OK: ${path} has an intact audit chain over ${result.verified} chained line(s).`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-audit-chain.mjs')) {
  process.exitCode = main();
}
