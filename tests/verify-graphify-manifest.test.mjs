import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-graphify-manifest.mjs');
const {
  EXCLUSIONS_SCHEMA,
  USAGE,
  compareCoverage,
  readExclusions,
  readManifestPaths,
  readTrackedFiles,
  main,
} = await import(`file://${script.replaceAll('\\', '/')}`);

function expectError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

const reason = 'Configuration only: no semantic content to index.';

test('compareCoverage acepta un manifiesto que cubre todo lo rastreado', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'b.md', '.gitignore'],
    manifest: ['a.mjs', 'b.md'],
    exclusions: [{ path: '.gitignore', reason }],
  });
  assert.deepEqual(result, { ok: true, missing: [], ghosts: [], dead: [], contradictions: [] });
});

test('FALSIFICACIÓN · un archivo rastreado sin nodo ni exclusión declarada se reporta', () => {
  const result = compareCoverage({
    tracked: ['a.mjs', 'scripts/new-gate.mjs'],
    manifest: ['a.mjs'],
    exclusions: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['scripts/new-gate.mjs']);
});

test('FALSIFICACIÓN · una entrada del manifiesto que ya no existe en Git es un fantasma', () => {
  const result = compareCoverage({
    tracked: ['templates/vibe/counters.json'],
    manifest: ['templates/vibe/counters.json', 'templates/vibe/COUNTERS.json'],
    exclusions: [],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.ghosts, ['templates/vibe/COUNTERS.json']);
});

test('FALSIFICACIÓN · una exclusión sin archivo real y una contradictoria se rechazan', () => {
  const dead = compareCoverage({ tracked: ['a.mjs'], manifest: ['a.mjs'], exclusions: [{ path: 'gone.md', reason }] });
  assert.equal(dead.ok, false);
  assert.deepEqual(dead.dead, ['gone.md']);

  const contradictory = compareCoverage({
    tracked: ['a.mjs', 'b.md'],
    manifest: ['a.mjs', 'b.md'],
    exclusions: [{ path: 'b.md', reason }],
  });
  assert.equal(contradictory.ok, false);
  assert.deepEqual(contradictory.contradictions, ['b.md']);
});

test('un proyecto sin contrato de exclusiones no falla: no declara ninguna', () => {
  const absent = () => { const error = new Error('ENOENT: no such file'); error.code = 'ENOENT'; throw error; };
  assert.deepEqual(readExclusions(absent), []);
  // Any other read failure is real and must surface instead of silently hiding coverage.
  const denied = () => { const error = new Error('EACCES: permission denied'); error.code = 'EACCES'; throw error; };
  expectError(() => readExclusions(denied), /not valid JSON/u);
});

test('FALSIFICACIÓN · readExclusions rechaza schema, forma, duplicados y razones vacías', () => {
  assert.deepEqual(readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason }] })), [{ path: 'x', reason }]);
  expectError(() => readExclusions(() => '{'), /not valid JSON/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: 'other', exclusions: [] })), /schema/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA })), /exclusions array/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x' }] })), /path and a reason/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason: 'tbd' }] })), /placeholder/u);
  expectError(() => readExclusions(() => JSON.stringify({ schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason, extra: 1 }] })), /path and a reason/u);
  const duplicated = { schema: EXCLUSIONS_SCHEMA, exclusions: [{ path: 'x', reason }, { path: 'x', reason }] };
  expectError(() => readExclusions(() => JSON.stringify(duplicated)), /duplicate exclusion/u);
});

test('FALSIFICACIÓN · readManifestPaths exige un objeto indexado por path y normaliza separadores', () => {
  assert.deepEqual(readManifestPaths('.', () => JSON.stringify({ 'a.mjs': {}, 'dir\\b.md': {} })), ['a.mjs', 'dir/b.md']);
  expectError(() => readManifestPaths('.', () => '{'), /unable to read the Graphify manifest/u);
  expectError(() => readManifestPaths('.', () => { throw new Error('ENOENT'); }), /unable to read the Graphify manifest/u);
  for (const shape of ['[]', 'null', '"text"']) {
    expectError(() => readManifestPaths('.', () => shape), /path-keyed object/u);
  }
});

test('readTrackedFiles normaliza la salida de Git y propaga un fallo real', () => {
  assert.deepEqual(readTrackedFiles('.', () => 'a.mjs\nb.md\n'), ['a.mjs', 'b.md']);
  assert.deepEqual(readTrackedFiles('.', () => ''), []);
  expectError(() => readTrackedFiles('.', () => { throw new Error('not a repository'); }), /unable to list tracked files/u);
});

// `graphify-out/` está en .gitignore, así que un clon recién hecho no tiene manifiesto y esta
// prueba no se puede correr ahí. Se declara SALTEADA con el motivo a la vista, nunca en verde: un
// pase por ausencia de entrada se leería como "la cobertura del grafo está bien", y no se miró.
test('el repositorio real declara cobertura Graphify honesta', (t) => {
  if (!existsSync(join(repoRoot, 'graphify-out', 'manifest.json'))) {
    return t.skip('sin graphify-out/manifest.json: corré `graphify update .` antes. No es un verde, es una prueba que no corrió.');
  }
  const tracked = readTrackedFiles(repoRoot, (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }));
  assert.ok(tracked.includes('SKILL.md'), 'the fixture must read the real tracked set');
  const result = spawnSync(process.execPath, [script, 'check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Graphify manifest covers/u);
});

test('CLI rechaza uso inválido y reporta cada clase de divergencia', () => {
  const errors = [];
  assert.equal(main([], repoRoot, {}, () => {}, (line) => errors.push(line)), 2);
  assert.equal(errors.at(-1), USAGE);
  assert.equal(main(['check', 'extra'], repoRoot, {}, () => {}, () => {}), 2);

  const injected = {
    readTracked: () => ['a.mjs', 'orphan.md'],
    readManifestPaths: () => ['a.mjs', 'ghost.md'],
    readExclusionList: () => [{ path: 'gone.md', reason }],
  };
  const failures = [];
  assert.equal(main(['check'], repoRoot, injected, () => {}, (line) => failures.push(line)), 1);
  const joined = failures.join('\n');
  assert.match(joined, /orphan\.md/u);
  assert.match(joined, /ghost\.md/u);
  assert.match(joined, /gone\.md/u);

  const output = [];
  assert.equal(main(['check'], repoRoot, {
    readTracked: () => ['a.mjs', '.gitignore'],
    readManifestPaths: () => ['a.mjs'],
    readExclusionList: () => [{ path: '.gitignore', reason }],
  }, (line) => output.push(line), () => {}), 0);
  assert.match(output.at(-1), /Graphify manifest covers 1 tracked file/u);

  const broken = [];
  assert.equal(main(['check'], repoRoot, { readManifestPaths: () => { throw new Error('manifest is unreadable'); } }, () => {}, (line) => broken.push(line)), 1);
  assert.match(broken.at(-1), /manifest is unreadable/u);
});
