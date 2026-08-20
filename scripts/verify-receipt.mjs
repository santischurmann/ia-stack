#!/usr/bin/env node
// verify-receipt.mjs — mechanical receipt gate for VibeCodeProtocols Phase 4.6
// Cross-platform (Node, no npm deps), works on Windows/macOS/Linux identically since it only
// shells out to `git` and uses node:crypto/node:fs. Two commands:
//
//   node verify-receipt.mjs fingerprint [receipt-path-to-exclude]
//       print {git_head, tree_fingerprint} for the current evaluated state.
//   node verify-receipt.mjs check <receipt.json>
//       validate a receipt against that state (the receipt's own path is the only thing
//       excluded from its own fingerprint — see EXCLUSION RULE below).
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
import { readFileSync, existsSync } from 'node:fs';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).replace(/\r\n/g, '\n');
}

// Deterministic content hash for one file's bytes (binary-safe — reads the raw buffer, never
// decodes as text). Used for untracked files only; tracked file content is hashed via
// `git hash-object` instead, so it matches git's own blob addressing exactly.
function hashFileContent(path) {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

function gitHashObject(path) {
  return git(['hash-object', path]).trim();
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
    const realNewSha =
      isZeroSha(e.newSha) && e.status !== 'D' && existsSync(e.path) ? gitHashObject(e.path) : e.newSha;
    return { ...e, newSha: realNewSha };
  });
  const unstagedEntries = unstaged.map(formatEntry).join('\n');

  // --- UNTRACKED (not ignored) — path + sha256 of on-disk bytes.
  const untrackedList = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .filter((p) => p !== exclude)
    .sort();
  const untrackedEntries = untrackedList.map((p) => `${p}\0${hashFileContent(p)}`).join('\n');

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

// CLI entry point — guarded so tests can `import` this module's functions (parseRawDiff, etc.)
// without triggering process.exit() as a side effect of the import.
if (process.argv[1] && process.argv[1].endsWith('verify-receipt.mjs')) {
  const [, , cmd, arg] = process.argv;

  if (cmd === 'fingerprint') {
    console.log(JSON.stringify(currentFingerprint(arg), null, 2));
    process.exit(0);
  }

  if (cmd === 'check') {
    if (!arg) fail('usage: verify-receipt.mjs check <receipt.json>');
    if (!existsSync(arg)) fail(`receipt not found: ${arg}`);

    let receipt;
    try {
      receipt = JSON.parse(readFileSync(arg, 'utf8'));
    } catch (e) {
      fail(`receipt is not valid JSON: ${e.message}`);
    }

    const required = ['schema', 'feature', 'risk_level', 'evidence', 'git_head', 'tree_fingerprint', 'terminal_state'];
    for (const f of required) {
      if (!(f in receipt)) fail(`missing required field: ${f}`);
    }

    if (receipt.schema !== 'vcp.receipt/v1') fail(`unknown schema: ${receipt.schema}`);

    if (!Array.isArray(receipt.evidence) || receipt.evidence.length === 0) {
      fail('evidence array is empty — no receipt without a real command output backing it');
    }

    if (!['approved', 'escalated'].includes(receipt.terminal_state)) {
      fail(`terminal_state must be approved|escalated, got: ${receipt.terminal_state}`);
    }

    // escalated is ALWAYS rejected by this gate, unconditionally — no override_note shortcut.
    // The only path past an escalated finding is: user approves explicitly, orchestrator writes
    // a NEW receipt with terminal_state:"approved" (override_note/override_timestamp kept as
    // audit metadata on that new receipt), and THAT receipt is what gets checked here.
    if (receipt.terminal_state === 'escalated') {
      fail('terminal_state is escalated — this gate never passes an escalated receipt, regardless of override_note. Regenerate a NEW receipt with terminal_state:"approved" after explicit user sign-off (LAW 8).');
    }

    // Exclude ONLY this exact receipt's own path from its own fingerprint (self-invalidation
    // guard) — every other file, including siblings in the same receipts/ directory, still counts.
    const now = currentFingerprint(arg);
    if (receipt.git_head !== now.git_head) {
      fail(`stale receipt: git_head is ${receipt.git_head}, current HEAD is ${now.git_head}`);
    }
    if (receipt.tree_fingerprint !== now.tree_fingerprint) {
      fail('stale receipt: tree_fingerprint does not match current evaluated state (staged, unstaged, or untracked content/mode changed since the receipt was written) — regenerate it');
    }

    console.log(`OK: receipt valid for ${receipt.feature} — terminal_state=approved, risk_level=${receipt.risk_level}`);
    process.exit(0);
  }

  console.error('usage: verify-receipt.mjs fingerprint [exclude-path] | check <receipt.json>');
  process.exit(2);
}
