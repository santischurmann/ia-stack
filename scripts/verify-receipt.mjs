#!/usr/bin/env node
// verify-receipt.mjs — mechanical receipt gate for VibeCodeProtocols Phase 4.6
// Cross-platform (Node, no npm deps), works on Windows/macOS/Linux identically since it only
// shells out to `git` and uses node:crypto/node:fs. Three commands:
//
//   node verify-receipt.mjs fingerprint [receipt-path-to-exclude]
//       print {git_head, tree_fingerprint} for the current evaluated state.
//   node verify-receipt.mjs check <receipt.json> [--require-clean-worktree]
//       validate a receipt against that state (the receipt's own path is the only thing
//       excluded from its own fingerprint — see EXCLUSION RULE below).
//   node verify-receipt.mjs commit <receipt.json> --message "<message>"
//       revalidate exactly what `check --require-clean-worktree` validates, write the commit in
//       the same invocation, then confirm afterwards that what landed is what was validated.
//       Bad arguments exit 2 here (`check` still answers its own usage errors with exit 1; that
//       inconsistency is left alone rather than moving a contract 33 green tests already pin).
//
//       ITS HONEST LIMIT — carried in the command's own output, not just in this comment:
//       running both halves together takes the gap between validating and writing from minutes
//       down to milliseconds, but it does NOT close it. Another process can still write in that
//       instant. The after-the-fact confirmation compares the tree that got committed against
//       the index that was validated (`git write-tree` before the write vs `HEAD^{tree}` after),
//       so what it proves is precisely "the commit contains the reviewed index" — never "no
//       concurrent write happened". A write to the worktree during the gap is exactly the case
//       it cannot see, and that residual hole is the reason the subcommand is called `commit`
//       and nothing stronger.
//
//       Two deliberate non-behaviours. It never passes --no-verify: a gate that silently skips
//       the operator's own hooks is worse than the problem it solves. And a failed confirmation
//       never reverts anything — it reports what differs, LEAVES the commit in place, and prints
//       the command a human can run to undo it. Rewriting history is the human's call, not this
//       script's.
//
// Exit 0 = valid, ONLY when terminal_state is "approved" and the fingerprint matches exactly.
// Exit 1 = rejected, reason printed to stderr. `escalated` is ALWAYS exit 1, unconditionally —
// there is no override_note path through this script (see SKILL.md LAW 8).
//
// FINGERPRINT MODEL — three states, hashed separately, not just "final worktree bytes":
//   HEAD → INDEX  (staged changes)    — `git diff --raw --cached --no-abbrev` (both sides are
//                                        real git blobs, real hashes, real modes — no gaps).
//   INDEX → WORKTREE (unstaged changes) — `git diff --raw --no-abbrev` gives the real mode for
//                                        both sides, but git leaves the worktree-side blob hash
//                                        as an all-zero placeholder (length matches the repo's
//                                        hash algorithm — 40 zero-chars for SHA-1, 64 for
//                                        SHA-256) for performance — it does NOT compute worktree
//                                        content hashes itself. We replace that placeholder with
//                                        `git hash-object <path>`, which computes the actual
//                                        blob hash git would assign if the file were staged
//                                        right now (same filters, same result, same algorithm as
//                                        the repo — sha1/sha256 both handled, hash length is
//                                        never hardcoded anywhere in this script).
//   UNTRACKED (not ignored)           — path + sha256 of on-disk bytes, as before.
//
// Each changed tracked path is recorded under EXACTLY ONE bucket (staged or unstaged) per git's
// own raw-diff output — a path with staged AND unstaged changes appears in both, correctly.
// This is why `git add` on an already-modified-but-unstaged file invalidates a receipt taken
// before the add even when the file's bytes never change: before `git add`, the path's entry
// lives in the INDEX→WORKTREE bucket; after, the same content now lives in the HEAD→INDEX
// bucket instead (and drops out of the unstaged bucket, since index now matches worktree) — the
// combined string differs, so the hash differs. Same mechanism catches a chmod/mode-only change
// with byte-identical content: raw diff still emits a line (old mode != new mode), so the mode
// transition is part of what gets hashed even when the blob hash itself doesn't change.
//
// WHY NOT HASH `git diff` TEXT DIRECTLY (earlier, wrong approach): for binary files, plain
// `git diff` prints a fixed message ("Binary files a/x and b/x differ") with no content — two
// DIFFERENT binary modifications would produce IDENTICAL diff text and thus an identical
// fingerprint. `--raw` mode avoids this entirely: it always deals in blob hashes, never
// human-readable diff text, so it's content-addressed and binary-safe by construction.
//
// EXCLUSION RULE (precise, not directory-wide): the ONLY path ever excluded from a fingerprint
// is the exact receipt file being written/checked (self-invalidation guard — a receipt can't
// include its own not-yet-written bytes). Every OTHER file under .vibe/receipts/ — another
// receipt, a stray untracked file, anything — is a normal untracked/tracked entry and DOES
// invalidate the fingerprint like any other file. There is no directory-wide exemption.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).replace(/\r\n/g, '\n');
}

// Deterministic content hash for one file's bytes (binary-safe — reads the raw buffer, never
// decodes as text). Used for untracked files only; tracked file content is hashed via
// `git hash-object` instead, so it matches git's own blob addressing exactly.
export function isWithin(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder !== '' && remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

// Git may list a path that is lexically inside the checkout but reaches outside through a
// junction/symlink. Receipts must never follow it while calculating evidence: reject the whole
// fingerprint rather than hashing an arbitrary external file and calling that project state.
export function safeRegularFile(path, root) {
  if (typeof path !== 'string' || path === '' || isAbsolute(path)) throw new Error(`unsafe repository path: ${path}`);
  const file = resolve(root, path);
  if (!isWithin(root, file)) throw new Error(`repository path escapes the checkout: ${path}`);
  const stat = lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`repository path is a symbolic link: ${path}`);
  if (!stat.isFile()) throw new Error(`repository path is not a regular file: ${path}`);
  if (!isWithin(root, realpathSync(file))) throw new Error(`repository path resolves outside the checkout: ${path}`);
  return file;
}

function hashFileContent(path, root) {
  const buf = readFileSync(safeRegularFile(path, root));
  return createHash('sha256').update(buf).digest('hex');
}

function gitHashObject(path, root) {
  // `--` prevents a Git-tracked filename beginning with `-` from becoming an option.
  safeRegularFile(path, root);
  return git(['hash-object', '--', path]).trim();
}

// Normalize a filesystem path (possibly Windows backslashes, possibly with ./ prefix) to the
// forward-slash, repo-relative form git's plumbing commands always emit, so exact string
// comparison against those outputs works regardless of how the caller wrote the path.
function toGitPath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

// Hash length is NOT fixed at 40 hex chars: a `--object-format=sha256` repo emits 64-char blob
// hashes in `git diff --raw` output, same format otherwise. Match hex runs of any length so this
// works unmodified on both SHA-1 (40 hex) and SHA-256 (64 hex) repos — never hardcode {40}.
const RAW_HEADER = /^:(\d{6}) (\d{6}) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])(\d*)$/;
const isZeroSha = (sha) => /^0+$/.test(sha);

// Shared by both the staged and unstaged sections of currentFingerprint() — extracted (instead
// of duplicated inline per section) so each is a single, directly unit-testable unit instead of
// two copies whose branches can only be exercised by whatever a real `git diff` happens to emit
// (e.g. unstaged rename detection off by default with the flags this script uses — see tests).
export const byPath = (a, b) => (a.path < b.path ? -1 : 1);
export const formatEntry = (e) =>
  `${e.path}\0${e.oldMode}:${e.oldSha}->${e.newMode}:${e.newSha}\0${e.status}` +
  (e.renamedFrom ? `\0renamed-from:${e.renamedFrom}` : '');

// Parse `git diff --raw --no-abbrev -z` output. MUST use -z (NUL-delimited), not plain newline
// splitting: a rename/copy record (status R/C) carries TWO paths (source, destination), and
// either path can itself contain characters that plain tab/newline parsing can't distinguish
// from record boundaries. With -z, each record is unambiguous: a header token (no path, no
// tab), followed by one path token (normal M/A/D/T/...) or two path tokens (R/C — old path,
// then new path). We key every record on the DESTINATION path — for R/C that's the second path
// token, which is what must actually exist on disk / in the index going forward. Using the
// wrong path here (e.g. treating the whole raw line as one opaque path, or defaulting to the
// source) means a later edit to the destination file can go undetected by existsSync()/
// hash-object on a stale path, silently keeping a zero/absent placeholder — this is exactly the
// gap that made a post-rename edit invisible to the fingerprint before this fix.
export function parseRawDiff(text) {
  const tokens = text.split('\0');
  const records = [];
  let i = 0;
  while (i < tokens.length) {
    const header = tokens[i];
    if (!header) {
      i++;
      continue;
    }
    const m = header.match(RAW_HEADER);
    if (!m) {
      i++; // defensive skip of an unexpected token — never silently misparse as a path
      continue;
    }
    const [, oldMode, newMode, oldSha, newSha, statusLetter] = m;
    i++;
    if (statusLetter === 'R' || statusLetter === 'C') {
      const renamedFrom = tokens[i++];
      const path = tokens[i++];
      records.push({ oldMode, newMode, oldSha, newSha, status: statusLetter, path, renamedFrom });
    } else {
      const path = tokens[i++];
      records.push({ oldMode, newMode, oldSha, newSha, status: statusLetter, path, renamedFrom: null });
    }
  }
  return records;
}

function currentFingerprint(excludePath) {
  const root = realpathSync('.');
  const head = git(['rev-parse', 'HEAD']).trim();
  const exclude = excludePath ? toGitPath(excludePath) : null;

  // --- HEAD -> INDEX (staged) — both sides are real committed/staged blobs, hashes as-is.
  // -z is required for correct R/C (rename/copy) parsing — see parseRawDiff.
  const staged = parseRawDiff(git(['diff', '--raw', '--cached', '--no-abbrev', '-z']))
    .filter((e) => e.path !== exclude)
    .sort(byPath);
  const stagedEntries = staged.map(formatEntry).join('\n');

  // --- INDEX -> WORKTREE (unstaged) — mode is real; newSha is a placeholder (all zeros) that
  // we replace with the actual current on-disk blob hash via `git hash-object`, read from the
  // DESTINATION path (e.path — for a rename/copy record this is the new path, never the old
  // one) — deleted files keep the zero/absent marker, nothing to hash.
  const unstagedRaw = parseRawDiff(git(['diff', '--raw', '--no-abbrev', '-z']))
    .filter((e) => e.path !== exclude)
    .sort(byPath);
  const unstaged = unstagedRaw.map((e) => {
    const realNewSha = isZeroSha(e.newSha) && e.status !== 'D' ? gitHashObject(e.path, root) : e.newSha;
    return { ...e, newSha: realNewSha };
  });
  const unstagedEntries = unstaged.map(formatEntry).join('\n');

  // --- UNTRACKED (not ignored) — path + sha256 of on-disk bytes.
  const untrackedList = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .filter((p) => p !== exclude)
    .sort();
  const untrackedEntries = untrackedList.map((p) => `${p}\0${hashFileContent(p, root)}`).join('\n');

  const combined =
    `HEAD:${head}\n` +
    `---STAGED(${staged.length})---\n${stagedEntries}\n` +
    `---UNSTAGED(${unstaged.length})---\n${unstagedEntries}\n` +
    `---UNTRACKED(${untrackedList.length})---\n${untrackedEntries}`;
  const hash = createHash('sha256').update(combined).digest('hex');

  return {
    git_head: head,
    tree_fingerprint: hash,
    staged_count: staged.length,
    unstaged_count: unstaged.length,
    untracked_count: untrackedList.length,
  };
}

function fail(reason) {
  console.error(`REJECTED: ${reason}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// vcp.receipt/v2 — strict schema for gates that authorize a commit/publish decision.
//
// HONEST SCOPE (do not oversell): `command`, `result`, `measurements` and `reproduction` are
// structured, human-reviewable evidence — a record of what an author claims ran and what it
// produced. Nothing in this validator re-executes a command or cryptographically proves it ran;
// that is the same procedural-not-cryptographic disclosure this project already makes for
// `evidence` on v1 (see SKILL.md). `scope.declared_paths` is a self-declared writer set inside
// the receipt. The separate `verify-scope-diff.mjs` gate compares the task's planned writers
// with the real Git delta; this validator deliberately stays focused on receipt integrity.
// ---------------------------------------------------------------------------------------------

const V2_SCHEMA = 'vcp.receipt/v2';
const V1_SCHEMA = 'vcp.receipt/v1';
const AC_VERDICTS = new Set(['COMPLIANT', 'FAILING', 'UNTESTED', 'PARTIAL']);
const SHA256_HEX = /^[0-9a-f]{64}$/u;
const NOT_REVIEWED_PLACEHOLDERS = new Set(['n/a', 'unknown', 'nothing']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Same disclosure discipline as scripts/verify-handoff-report.mjs's NOT_REVIEWED, applied to a
 * plain string field instead of a markdown declaration line. */
export function validateNotReviewedField(value) {
  if (!nonEmptyString(value)) return { ok: false, reason: 'not_reviewed must be a non-empty string' };
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (NOT_REVIEWED_PLACEHOLDERS.has(normalized)) return { ok: false, reason: `not_reviewed placeholder ${JSON.stringify(trimmed)} hides review limits` };
  if (normalized === 'none') return { ok: false, reason: 'not_reviewed cannot be bare "none"; state the reviewed scope after "none —"' };
  if (normalized.startsWith('none') && !/^none\s*(?:—|-)\s*\S.*$/iu.test(trimmed)) {
    return { ok: false, reason: 'not_reviewed uses "none" without a reviewed-scope basis' };
  }
  return { ok: true };
}

/** One acceptance-criteria entry. `verdict !== 'COMPLIANT'` blocks by itself — a receipt with any
 * UNTESTED/PARTIAL/FAILING AC can exist as a draft, but never reaches an approved `check`. */
export function validateAcceptanceCriterion(ac, cwd, { readFile = readFileSync } = {}) {
  if (!ac || typeof ac !== 'object' || Array.isArray(ac)) return { ok: false, reason: 'acceptance_criteria entry must be an object' };
  if (!nonEmptyString(ac.ac_id)) return { ok: false, reason: 'acceptance_criteria entry missing ac_id' };
  const label = ac.ac_id;
  if (!nonEmptyString(ac.scenario)) return { ok: false, reason: `${label}: scenario must be a non-empty string` };
  if (!AC_VERDICTS.has(ac.verdict)) return { ok: false, reason: `${label}: verdict must be one of ${[...AC_VERDICTS].join('|')}` };
  if (ac.verdict !== 'COMPLIANT') return { ok: false, reason: `${label}: verdict is ${ac.verdict}, not COMPLIANT — an approved v2 receipt requires every AC to be COMPLIANT` };
  if (!nonEmptyString(ac.test_file)) return { ok: false, reason: `${label}: COMPLIANT requires a non-empty test_file` };
  if (!SHA256_HEX.test(ac.test_hash_sha256 ?? '')) return { ok: false, reason: `${label}: test_hash_sha256 must be a full 64-character hex sha256` };
  if (!nonEmptyString(ac.command)) return { ok: false, reason: `${label}: COMPLIANT requires a non-empty command` };
  if (!nonEmptyString(ac.result)) return { ok: false, reason: `${label}: COMPLIANT requires a non-empty result` };
  let file;
  try {
    file = safeRegularFile(ac.test_file, cwd);
  } catch (error) {
    return { ok: false, reason: `${label}: test_file is unsafe: ${error.message}` };
  }
  const actualHash = createHash('sha256').update(readFile(file)).digest('hex');
  if (actualHash !== ac.test_hash_sha256) {
    return { ok: false, reason: `${label}: test_hash_sha256 does not match ${ac.test_file} on disk — the test changed since this AC was verified, regenerate the AC entry` };
  }
  return { ok: true, testPath: file };
}

export function validateAcceptanceCriteria(acceptanceCriteria, cwd, options, declaredPaths) {
  if (!Array.isArray(acceptanceCriteria) || acceptanceCriteria.length === 0) {
    return { ok: false, reason: 'acceptance_criteria must be a non-empty array' };
  }
  const ids = new Set();
  for (const ac of acceptanceCriteria) {
    const result = validateAcceptanceCriterion(ac, cwd, options);
    if (!result.ok) return result;
    const id = ac.ac_id.trim();
    if (ids.has(id)) return { ok: false, reason: `duplicate ac_id: ${id}` };
    ids.add(id);
    if (declaredPaths && !declaredPaths.has(result.testPath)) {
      return { ok: false, reason: `${id}: test_file is not declared in scope.declared_paths` };
    }
  }
  return { ok: true };
}

/** measured=false requires before/after pinned to -1 plus a non-empty reason — "-1" is only
 * honest when it's paired with why nothing was measured, never a silent default. */
export function validateMeasurements(measurements) {
  if (!Array.isArray(measurements)) return { ok: false, reason: 'measurements must be an array' };
  for (const m of measurements) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || !nonEmptyString(m.metric)) {
      return { ok: false, reason: 'measurement entry missing a non-empty metric name' };
    }
    if (typeof m.measured !== 'boolean') return { ok: false, reason: `${m.metric}: measured must be a boolean` };
    if (m.measured) {
      if (typeof m.before !== 'number' || typeof m.after !== 'number') {
        return { ok: false, reason: `${m.metric}: measured=true requires numeric before/after` };
      }
    } else {
      if (m.before !== -1 || m.after !== -1) return { ok: false, reason: `${m.metric}: measured=false requires before and after to both be -1` };
      if (!nonEmptyString(m.reason)) return { ok: false, reason: `${m.metric}: measured=false requires a non-empty reason` };
    }
  }
  return { ok: true };
}

/** scope.declared_paths — project-local, regular, no symlink/junction escape. Self-declared by
 * the receipt's own author; plan-vs-delta comparison belongs to verify-scope-diff.mjs. */
export function validateScope(scope, cwd) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return { ok: false, reason: 'scope must be an object' };
  if (!Array.isArray(scope.declared_paths) || scope.declared_paths.length === 0) {
    return { ok: false, reason: 'scope.declared_paths must be a non-empty array' };
  }
  const declaredPaths = new Set();
  for (const path of scope.declared_paths) {
    if (!nonEmptyString(path)) return { ok: false, reason: 'scope.declared_paths entries must be non-empty strings' };
    try {
      declaredPaths.add(safeRegularFile(path, cwd));
    } catch (error) {
      return { ok: false, reason: `scope.declared_paths entry is unsafe: ${error.message}` };
    }
  }
  return { ok: true, declaredPaths };
}

/** review_4r — shape-only: an object carrying the 4 named lenses. This gate does not grade
 * their content (no invariant for that was specified), only that the record exists structurally
 * so an approved receipt cannot omit the 4R pass entirely. */
export function validateReview4r(review) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) return { ok: false, reason: 'review_4r must be an object' };
  for (const lens of ['risk', 'readability', 'reliability', 'resilience']) {
    if (!review[lens] || typeof review[lens] !== 'object' || Array.isArray(review[lens])) {
      return { ok: false, reason: `review_4r.${lens} must be an object` };
    }
  }
  return { ok: true };
}

/** Full vcp.receipt/v2 validation, everything the module header's honest-scope note applies to.
 * Does NOT check git_head/tree_fingerprint — the caller compares those against a live
 * fingerprint the same way it already does for v1. */
export function validateReceiptV2(receipt, cwd, options) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return { ok: false, reason: 'receipt must be an object' };
  const required = ['feature', 'task', 'scope', 'acceptance_criteria', 'review_4r', 'measurements', 'reproduction', 'not_reviewed', 'evidence', 'git_head', 'tree_fingerprint', 'terminal_state'];
  for (const f of required) {
    if (!(f in receipt)) return { ok: false, reason: `missing required field: ${f}` };
  }
  if (!nonEmptyString(receipt.feature)) return { ok: false, reason: 'feature must be a non-empty string' };
  if (!nonEmptyString(receipt.task)) return { ok: false, reason: 'task must be a non-empty string' };
  if (!Array.isArray(receipt.evidence) || receipt.evidence.length === 0) return { ok: false, reason: 'evidence array is empty — no receipt without real evidence backing it' };
  if (receipt.evidence.some((entry) => !nonEmptyString(entry))) return { ok: false, reason: 'evidence entries must be non-empty strings' };
  if (!nonEmptyString(receipt.reproduction)) return { ok: false, reason: 'reproduction must be a non-empty string' };
  if (!['approved', 'escalated'].includes(receipt.terminal_state)) return { ok: false, reason: `terminal_state must be approved|escalated, got: ${receipt.terminal_state}` };
  if (receipt.terminal_state === 'escalated') {
    return { ok: false, reason: 'terminal_state is escalated — this gate never passes an escalated receipt, regardless of override_note. Regenerate a NEW receipt with terminal_state:"approved" after explicit user sign-off (LAW 8).' };
  }

  const scope = validateScope(receipt.scope, cwd);
  if (!scope.ok) return scope;
  const ac = validateAcceptanceCriteria(receipt.acceptance_criteria, cwd, options, scope.declaredPaths);
  if (!ac.ok) return ac;
  const review = validateReview4r(receipt.review_4r);
  if (!review.ok) return review;
  const measurements = validateMeasurements(receipt.measurements);
  if (!measurements.ok) return measurements;
  const notReviewed = validateNotReviewedField(receipt.not_reviewed);
  if (!notReviewed.ok) return notReviewed;

  return { ok: true };
}

// CLI entry point — guarded so tests can `import` this module's functions (parseRawDiff, etc.)
// without triggering process.exit() as a side effect of the import.
if (process.argv[1] && process.argv[1].endsWith('verify-receipt.mjs')) {
  const [, , cmd, arg] = process.argv;

  // git plumbing throws (e.g. `git rev-parse HEAD` on a repo with zero commits) rather than
  // returning an error value; wrap both CLI call sites so that case is a clean `REJECTED:`
  // message on stderr with exit 1, not an uncaught stack trace leaking internal paths.
  function safeFingerprint(exclude) {
    try {
      return currentFingerprint(exclude);
    } catch (error) {
      fail(`unable to evaluate the current repository state: ${error.message}`);
    }
  }

  if (cmd === 'fingerprint') {
    console.log(JSON.stringify(safeFingerprint(arg), null, 2));
    process.exit(0);
  }

  // Shared by `check` and `inspect-legacy`: resolve+read the receipt path safely, parse JSON.
  // Same TOCTOU disclosure as before — see the module header note near safeRegularFile.
  function readReceiptSafely(path) {
    if (!existsSync(path)) fail(`receipt not found: ${path}`);
    let safePath;
    try {
      safePath = safeRegularFile(path, realpathSync('.'));
    } catch (error) {
      fail(`receipt path is unsafe: ${error.message}`);
    }
    try {
      return JSON.parse(readFileSync(safePath, 'utf8'));
    } catch (e) {
      fail(`receipt is not valid JSON: ${e.message}`);
    }
  }

  // The whole "may this receipt authorize anything" question, in one place. `check` and `commit`
  // share it verbatim so the commit boundary can never drift from what `check` means — a second
  // copy of these rules would be free to rot in one direction. Every rejection is a fail() (exit
  // 1) naming the exact reason; the parsed receipt comes back only when nothing rejected it.
  function validateReceiptOrFail(path, requireCleanWorktree) {
    const receipt = readReceiptSafely(path);

    // v1 is archival only — it can never authorize a `check`-gated commit/publish decision,
    // regardless of its content. Point the caller at the read-only inspector instead of leaving
    // it looking like a transient rejection.
    if (receipt.schema === V1_SCHEMA) {
      fail(`schema vcp.receipt/v1 is archival-only and cannot pass check; inspect it read-only with: node verify-receipt.mjs inspect-legacy ${path}`);
    }
    if (receipt.schema !== V2_SCHEMA) fail(`unknown schema: ${receipt.schema}`);

    const shape = validateReceiptV2(receipt, realpathSync('.'));
    if (!shape.ok) fail(shape.reason);

    // Exclude ONLY this exact receipt's own path from its own fingerprint (self-invalidation
    // guard) — every other file, including siblings in the same receipts/ directory, still counts.
    const now = safeFingerprint(path);
    if (receipt.git_head !== now.git_head) {
      fail(`stale receipt: git_head is ${receipt.git_head}, current HEAD is ${now.git_head}`);
    }
    if (receipt.tree_fingerprint !== now.tree_fingerprint) {
      fail('stale receipt: tree_fingerprint does not match current evaluated state (staged, unstaged, or untracked content/mode changed since the receipt was written) — regenerate it');
    }

    if (requireCleanWorktree && (now.unstaged_count > 0 || now.untracked_count > 0)) {
      fail(`release requires a clean worktree: ${now.unstaged_count} unstaged and ${now.untracked_count} untracked path(s) remain — stage or remove them so the reviewed tree is the committed tree`);
    }
    return receipt;
  }

  function validatedSummary(receipt, label) {
    return `${label}: receipt valid for ${receipt.feature}/${receipt.task} — terminal_state=approved, ${receipt.acceptance_criteria.length} AC(s) COMPLIANT`;
  }

  if (cmd === 'check') {
    if (!arg) fail('usage: verify-receipt.mjs check <receipt.json> [--require-clean-worktree]');
    // Opt-in release strictness. A plain `check` attests whatever state was evaluated, including
    // unstaged edits and untracked files — that is correct for a mid-task receipt. At the commit
    // boundary the reviewed tree and the committed tree must be the same one, so 4.5 asks for this
    // flag. It narrows, but does not close, the window between `check` and `git commit`: nothing
    // stops a write landing in between. Unknown flags are rejected rather than silently ignored.
    const extraFlags = process.argv.slice(4);
    const requireCleanWorktree = extraFlags.includes('--require-clean-worktree');
    const unknownFlag = extraFlags.find((flag) => flag !== '--require-clean-worktree');
    if (unknownFlag) fail(`unknown option ${unknownFlag}; usage: verify-receipt.mjs check <receipt.json> [--require-clean-worktree]`);

    const receipt = validateReceiptOrFail(arg, requireCleanWorktree);
    const cleanliness = requireCleanWorktree ? ', clean worktree' : '';
    console.log(`${validatedSummary(receipt, 'OK')}${cleanliness}`);
    process.exit(0);
  }

  if (cmd === 'inspect-legacy') {
    if (!arg) fail('usage: verify-receipt.mjs inspect-legacy <receipt.json>');
    const receipt = readReceiptSafely(arg);
    if (receipt.schema !== V1_SCHEMA) {
      fail(`inspect-legacy is for schema vcp.receipt/v1 only, got: ${receipt.schema} — use check for vcp.receipt/v2`);
    }
    // Read-only report — no fingerprint recomputation, no exit-1 path past this point, no write
    // of any kind. This is archival evidence: it never authorizes a commit/publish decision.
    console.log(`ARCHIVAL: vcp.receipt/v1 receipt for feature="${receipt.feature ?? '(missing)'}", terminal_state="${receipt.terminal_state ?? '(missing)'}".`);
    console.log('This receipt predates the vcp.receipt/v2 schema. It is archival evidence only —');
    console.log('it cannot pass `check` and does not authorize any commit, publish, or gate decision.');
    process.exit(0);
  }

  // `commit <receipt.json> --message "<msg>"` — see the module header for the full contract and
  // for the limit this command is required to state in its own output.
  const COMMIT_USAGE = 'usage: verify-receipt.mjs commit <receipt.json> --message "<message>"';
  if (cmd === 'commit') {
    // Exit 2, not 1: bad arguments are a caller mistake, never a verdict about the receipt.
    // Destructuring the tail makes each rejection its own condition — a missing receipt, a flag
    // that is not --message, a missing/blank message, and any extra argument.
    const [flag, message, ...extra] = process.argv.slice(4);
    if (!arg || flag !== '--message' || !nonEmptyString(message) || extra.length > 0) {
      console.error(COMMIT_USAGE);
      process.exit(2);
    }

    const receipt = validateReceiptOrFail(arg, true);

    // The index git is about to turn into a commit, addressed as a real tree object BEFORE the
    // write. This is the only value the after-the-fact confirmation can honestly compare against:
    // it pins the reviewed INDEX, which is what a commit is made of.
    const validatedTree = git(['write-tree']).trim();
    const headTree = git(['rev-parse', 'HEAD^{tree}']).trim();
    if (validatedTree === headTree) {
      // Say this ourselves instead of letting `git commit` answer it: git's "nothing to commit"
      // is written for an interactive user, and here it is a gate verdict.
      fail('nothing to commit: the index is identical to HEAD, so there is no reviewed change to write — stage the work this receipt attests, then run commit again');
    }

    console.log(`${validatedSummary(receipt, 'VALIDATED')}, clean worktree`);
    try {
      // No --no-verify: the operator's hooks run exactly as they would by hand. A hook that
      // rewrites the index is precisely what the confirmation below exists to catch.
      git(['commit', '--message', message]);
    } catch (error) {
      fail(`git commit failed, so this run confirmed nothing: ${error.message.trim()}`);
    }

    const committed = git(['rev-parse', 'HEAD']).trim();
    const committedTree = git(['rev-parse', 'HEAD^{tree}']).trim();
    if (committedTree !== validatedTree) {
      fail(`the committed tree does not match the index that was validated (validated ${validatedTree}, committed ${committedTree} in ${committed}) — something rewrote the index after the validation, a re-staging pre-commit hook being the usual cause. `
        + `The commit was made and is left exactly as it is: this gate never rewrites history on its own. Review it and, if you want it gone, run it yourself: git reset --soft HEAD~1 (or git revert ${committed} if it is already published).`);
    }

    console.log(`COMMITTED: ${committed} — ${message}`);
    console.log('CONFIRMED: the committed tree is the index this run validated (write-tree before the write == HEAD^{tree} after it).');
    console.log('LIMIT: validating and writing in one run narrows the window between them from minutes to milliseconds, it does not close it — another process can still write inside that window. The confirmation above proves the commit contains the reviewed index; it cannot prove that no concurrent write happened.');
    process.exit(0);
  }

  console.error('usage: verify-receipt.mjs fingerprint [exclude-path] | check <receipt.json> [--require-clean-worktree] | commit <receipt.json> --message "<message>" | inspect-legacy <receipt.json>');
  process.exit(2);
}
