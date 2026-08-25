import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-spec-wordcap.mjs');
const { USAGE, WORD_CAP, countSpecWords, main } = await import(pathToFileURL(script).href);

test('countSpecWords excludes fenced code blocks and table rows, counts everything else', () => {
  assert.equal(countSpecWords('one two three'), 3);
  assert.equal(countSpecWords('a\n```\ncode word here does not count\n```\nb'), 2);
  assert.equal(countSpecWords('prose\n| a | b |\n|---|---|\n| c | d |\nmore'), 2);
  assert.equal(countSpecWords('  \n\n  '), 0, 'pure whitespace counts as zero words');
  assert.equal(countSpecWords(''), 0);
});

test('FALSIFICACIÓN · a spec under the cap passes, one word over the cap rejects', () => {
  const output = [];
  const errors = [];
  const atCap = { readFile: () => Array.from({ length: WORD_CAP }, () => 'x').join(' ') };
  assert.equal(main(['check', 'spec.md'], { ...atCap, write: (l) => output.push(l), writeError: (l) => errors.push(l) }), 0);
  assert.match(output.at(-1), new RegExp(`${WORD_CAP}/${WORD_CAP} words`));

  const overCap = { readFile: () => Array.from({ length: WORD_CAP + 1 }, () => 'x').join(' ') };
  const overOutput = [];
  const overErrors = [];
  assert.equal(main(['check', 'spec.md'], { ...overCap, write: (l) => overOutput.push(l), writeError: (l) => overErrors.push(l) }), 1);
  assert.match(overErrors.at(-1), /over the 650-word cap/);
  assert.deepEqual(overOutput, []);
});

test('FALSIFICACIÓN · usage on bad args, unreadable file, and the real templates/spec.md fixture', () => {
  const errors = [];
  assert.equal(main([], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check'], { writeError: (l) => errors.push(l) }), 2);
  assert.equal(main(['check', 'a.md', 'extra'], { writeError: (l) => errors.push(l) }), 2);

  const missingErrors = [];
  assert.equal(main(['check', 'does-not-exist.md'], { writeError: (l) => missingErrors.push(l) }), 1);
  assert.match(missingErrors.at(-1), /unable to read/);

  const output = [];
  assert.equal(main(['check', join(repoRoot, 'templates', 'spec.md')], { write: (l) => output.push(l) }), 0, 'the real template must be under its own documented cap');
  assert.match(output.at(-1), /\/650 words/);
});

test('CLI exit codes match the library behavior for a real over-cap file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-wordcap-'));
  const tmp = join(dir, 'spec.md');
  writeFileSync(tmp, Array.from({ length: WORD_CAP + 5 }, () => 'x').join(' '));
  try {
    const result = spawnSync(process.execPath, [script, 'check', tmp], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /over the 650-word cap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
