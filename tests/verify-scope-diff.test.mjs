import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-scope-diff.mjs');
const {
  changedProjectPaths,
  compareScope,
  main,
  normalizeProjectPath,
  taskWriterSet,
  verifyScope,
} = await import(`file://${script.replaceAll('\\', '/')}`);

function expectError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.match(error.message, pattern);
    return true;
  });
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-scope-diff-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'test'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'vcp@example.invalid');
  git(root, 'config', 'user.name', 'VCP test');
  writeFileSync(join(root, 'src', 'a.js'), 'export const a = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'fixture');
  return root;
}

function planFile(root, tasks) {
  const path = join(root, 'tasks.json');
  writeFileSync(path, JSON.stringify({ tasks }) + '\n');
  return path;
}

const task = {
  id: 'T01',
  files_to_create: ['src/new.js'],
  files_to_modify: ['src/a.js'],
  test_files: ['test/a.test.js'],
};

test('normaliza paths de proyecto y rechaza entradas inseguras', () => {
  assert.equal(normalizeProjectPath('./SRC\\a.js'), 'src/a.js');
  assert.equal(normalizeProjectPath('dir//file.md'), 'dir/file.md');
  for (const value of ['', '   ', '../secret', '/tmp/x', 'C:/x', '.', './', null, 42]) {
    expectError(() => normalizeProjectPath(value), /safe project-relative path|non-empty/u);
  }
});

test('taskWriterSet valida tareas, arrays, ids y paths exactos', () => {
  const result = taskWriterSet({ tasks: [task] }, 'T01');
  assert.deepEqual([...result.planned].sort(), ['src/a.js', 'src/new.js', 'test/a.test.js']);
  expectError(() => taskWriterSet({ tasks: [] }, 'T01'), /task not found/u);
  assert.equal(taskWriterSet({ tasks: [null, task] }, 'T01').planned.size, 3);
  expectError(() => taskWriterSet({ tasks: [task, task] }, 'T01'), /duplicate task id/u);
  expectError(() => taskWriterSet({ tasks: [{ ...task, files_to_create: 'src/x' }] }, 'T01'), /must be an array/u);
  expectError(() => taskWriterSet({ tasks: [{ ...task, files_to_modify: ['src/a.js', './SRC\\a.js'] }] }, 'T01'), /duplicate writer path/u);
  expectError(() => taskWriterSet({ tasks: [{ ...task, files_to_create: [], files_to_modify: [], test_files: [] }] }, 'T01'), /no writer paths/u);
  expectError(() => taskWriterSet({ tasks: [task] }, ''), /task id/u);
  expectError(() => taskWriterSet({ tasks: [task] }, 42), /task id/u);
});

test('changedProjectPaths reúne diff tracked y untracked con Git real', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a.js'), 'export const a = 2;\n');
    writeFileSync(join(root, 'test', 'a.test.js'), 'assert(1);\n');
    const changed = changedProjectPaths(root, 'HEAD');
    assert.deepEqual([...changed].sort(), ['src/a.js', 'test/a.test.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  expectError(() => changedProjectPaths('C:/missing-vcp-project', 'HEAD', () => { throw new Error('boom'); }), /unable to inspect Git diff/u);
  const injected = changedProjectPaths('C:/unused', 'HEAD', (_command, args) => args.includes('diff') ? 'M\0src/a.js\0' : null);
  assert.deepEqual([...injected], ['src/a.js']);
});

test('changedProjectPaths conserva el alcance completo de un rename Git', () => {
  const root = fixture();
  try {
    git(root, 'mv', 'src/a.js', 'src/renamed.js');
    const changed = changedProjectPaths(root, 'HEAD');
    assert.deepEqual([...changed].sort(), ['src/a.js', 'src/renamed.js']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('changedProjectPaths trata una copia como una escritura sólo en el destino', () => {
  const injected = changedProjectPaths('C:/unused', 'HEAD', (_command, args) => args.includes('diff')
    ? 'C100\0src/a.js\0src/copied.js\0'
    : null);
  assert.deepEqual([...injected], ['src/copied.js']);
});

test('FALSIFICACIÓN · changedProjectPaths rechaza registros Git truncados en vez de perder un path', () => {
  const truncatedStatus = (_command, args) => args.includes('diff') ? 'M\0' : null;
  expectError(() => changedProjectPaths('C:/unused', 'HEAD', truncatedStatus), /tracked change without a path: M/u);
  const truncatedRename = (_command, args) => args.includes('diff') ? 'R100\0src/a.js\0' : null;
  expectError(() => changedProjectPaths('C:/unused', 'HEAD', truncatedRename), /incomplete R record/u);
});

test('compareScope distingue exacto, faltantes, extras e ignorados', () => {
  const planned = new Set(['src/a.js', 'test/a.js']);
  const exact = compareScope(planned, new Set(['src/a.js', 'test/a.js']));
  assert.equal(exact.ok, true);
  const mismatch = compareScope(planned, new Set(['src/a.js', 'extra.md']));
  assert.equal(mismatch.ok, false);
  assert.deepEqual(mismatch.missing, ['test/a.js']);
  assert.deepEqual(mismatch.extra, ['extra.md']);
  const ignored = compareScope(planned, new Set(['src/a.js', 'test/a.js', 'tasks.json']), new Set(['tasks.json']));
  assert.equal(ignored.ok, true);
});

test('verifyScope pasa con diff exacto e ignora sólo artefactos declarados', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a.js'), 'export const a = 2;\n');
    writeFileSync(join(root, 'src', 'new.js'), 'export const n = 1;\n');
    writeFileSync(join(root, 'test', 'a.test.js'), 'assert(1);\n');
    const tasksPath = planFile(root, [task]);
    const result = verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['tasks.json'] });
    assert.equal(result.ok, true);
    assert.equal(result.observed.size, 3);
    rmSync(join(root, 'test', 'a.test.js'));
    const mismatch = verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['tasks.json'] });
    assert.equal(mismatch.ok, false);
    assert.deepEqual(mismatch.missing, ['test/a.test.js']);
    expectError(() => verifyScope({ tasksPath, taskId: 'T99', base: 'HEAD', cwd: root }), /task not found/u);
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: '', cwd: root }), /base Git ref/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifyScope rechaza extra, plan inválido y exclusiones inseguras', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a.js'), 'export const a = 2;\n');
    writeFileSync(join(root, 'src', 'new.js'), 'export const n = 1;\n');
    writeFileSync(join(root, 'src', 'extra.js'), 'export const x = 1;\n');
    const tasksPath = planFile(root, [{ ...task, test_files: [] }]);
    const result = verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['tasks.json'] });
    assert.equal(result.ok, false);
    assert.deepEqual(result.extra, ['src/extra.js']);
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['../outside'] }), /safe project-relative path/u);
    const malformed = join(root, 'malformed.json');
    writeFileSync(malformed, JSON.stringify({}));
    expectError(() => verifyScope({ tasksPath: malformed, taskId: 'T01', base: 'HEAD', cwd: root }), /must contain a tasks array/u);
    const existing = join(root, 'ignore.txt');
    writeFileSync(existing, 'x');
    const fakeSymlinkStat = () => ({ isSymbolicLink: () => true, isFile: () => false });
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], stat: fakeSymlinkStat }), /symbolic link/u);
    const fakeDirectoryStat = () => ({ isSymbolicLink: () => false, isFile: () => false });
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], stat: fakeDirectoryStat }), /regular file/u);
    const fakeOutside = (candidate) => candidate === root ? root : join(root, '..', 'outside');
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], realpath: fakeOutside }), /resolves outside/u);
    const fakeParent = (candidate) => candidate === root ? root : join(root, '..');
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], realpath: fakeParent }), /resolves outside/u);
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], realpath: () => root }), /resolves outside/u);
    expectError(() => verifyScope({ tasksPath, taskId: 'T01', base: 'HEAD', cwd: root, ignores: ['ignore.txt'], read: () => { throw new Error('read denied'); } }), /read denied/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI rechaza uso inválido y comunica éxito o diferencias', () => {
  const errors = [];
  assert.equal(main([], '.', () => {}, (line) => errors.push(line)), 2);
  assert.match(errors[0], /usage:/u);
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a.js'), 'export const a = 2;\n');
    writeFileSync(join(root, 'src', 'new.js'), 'export const n = 1;\n');
    const tasksPath = planFile(root, [{ ...task, test_files: ['test/a.test.js'] }]);
    writeFileSync(join(root, 'test', 'a.test.js'), 'assert(1);\n');
    git(root, 'add', 'src/new.js');
    const output = [];
    const ok = main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'HEAD', '--ignore', 'tasks.json'], root, (line) => output.push(line), (line) => errors.push(line));
    assert.equal(ok, 0);
    assert.match(output.at(-1), /scope matches real Git delta/u);
    writeFileSync(join(root, 'src', 'extra.js'), 'export const x = 1;\n');
    const extra = [];
    assert.equal(main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'HEAD', '--ignore', 'tasks.json'], root, () => {}, (line) => extra.push(line)), 1);
    assert.match(extra.join('\n'), /outside T01/u);
    rmSync(join(root, 'src', 'extra.js'));
    rmSync(join(root, 'test', 'a.test.js'));
    const rejected = [];
    const bad = main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'HEAD', '--ignore', 'tasks.json'], root, () => {}, (line) => rejected.push(line));
    assert.equal(bad, 1);
    assert.match(rejected.join('\n'), /planned paths not changed/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI captura plan JSON corrupto y ref Git inválido sin stack trace', () => {
  const root = fixture();
  try {
    const tasksPath = join(root, 'bad.json');
    writeFileSync(tasksPath, '{');
    const errors = [];
    assert.equal(main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'HEAD'], root, () => {}, (line) => errors.push(line)), 1);
    assert.match(errors.join('\n'), /not valid JSON/u);
    writeFileSync(tasksPath, JSON.stringify({ tasks: [task] }));
    const badRef = [];
    assert.equal(main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'no-such-ref'], root, () => {}, (line) => badRef.push(line)), 1);
    assert.match(badRef.join('\n'), /unable to inspect Git diff/u);
    writeFileSync(tasksPath, 'null');
    const malformedShape = [];
    assert.equal(main(['check', '--tasks', tasksPath, '--task', 'T01', '--base', 'HEAD'], root, () => {}, (line) => malformedShape.push(line)), 1);
    assert.match(malformedShape.join('\n'), /must contain a tasks array/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI parser rechaza opciones desconocidas, repetidas y truncadas', () => {
  const root = fixture();
  const badArgs = [
    ['nope'],
    ['check'],
    ['check', '--tasks'],
    ['check', '--tasks', 'x', '--task'],
    ['check', '--tasks', 'x', '--task', 'T01', '--base'],
    ['check', '--tasks', 'x', '--task', 'T01', '--base', 'HEAD', '--ignore'],
    ['check', '--tasks', 'x', '--task', 'T01', '--base', 'HEAD', '--bogus', 'x'],
    ['check', '--tasks', 'x', '--tasks', 'y', '--task', 'T01', '--base', 'HEAD'],
  ];
  try {
    for (const args of badArgs) assert.equal(main(args, root, () => {}, () => {}), 2, args.join(' '));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('la invocación directa del script cubre su entrada CLI real', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, 'src', 'a.js'), 'export const a = 2;\n');
    writeFileSync(join(root, 'tasks.json'), JSON.stringify({ tasks: [{ id: 'T01', files_to_create: [], files_to_modify: ['src/a.js'], test_files: [] }] }));
    const result = spawnSync(process.execPath, [script, 'check', '--tasks', 'tasks.json', '--task', 'T01', '--base', 'HEAD', '--ignore', 'tasks.json'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /scope matches real Git delta/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
