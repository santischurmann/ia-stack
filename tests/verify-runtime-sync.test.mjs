import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-runtime-sync.mjs');
const {
  COPIED_DIRECTORIES,
  COPIED_FILES,
  DEFAULT_RUNTIME_PATH,
  USAGE,
  compareInventories,
  main,
  missingSourceRoots,
  parseArguments,
  readInventory,
  statKind,
} = await import(`file://${script.replaceAll('\\', '/')}`);

const SOURCE_FILES = [
  ['scripts/verify-red-node.mjs', 'export const gate = 1;\n'],
  ['contracts/honest-limits.json', '{"schema":"vcp.honest-limits/1"}\n'],
  ['tests/verify-red-node.test.mjs', 'import test from "node:test";\n'],
  ['templates/vibe/PROJECT.md', '# (fill in)\nStarted: YYYY-MM-DD\n'],
  ['skills/vibe-memory.md', '# memoria\n'],
  ['SKILL.md', '# skill\n'],
  ['SECURITY.md', '# security\n'],
];

/** A minimal checkout with exactly the surface copy_runtime() reads, and no runtime installed yet. */
function sourceCheckout() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-runtime-sync-'));
  const source = join(root, 'source');
  for (const [relative, content] of SOURCE_FILES) {
    const parts = relative.split('/');
    mkdirSync(join(source, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(source, ...parts), content);
  }
  return { root, source };
}

/** Reproduces copy_runtime(): plain byte copies of the five directories plus the two root files. */
function installRuntime(source, destination = join(source, ...DEFAULT_RUNTIME_PATH.split('/'))) {
  mkdirSync(destination, { recursive: true });
  for (const directory of COPIED_DIRECTORIES) {
    cpSync(join(source, directory), join(destination, directory), { recursive: true });
  }
  for (const file of COPIED_FILES) cpSync(join(source, file), join(destination, file));
  return destination;
}

function run(args, cwd) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: environment });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function inventory(entries) {
  return new Map(entries);
}

test('la superficie comparada se deriva de lo que copia el instalador Bash', () => {
  const installer = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8');
  const start = installer.indexOf('copy_runtime()');
  const body = installer.slice(start, installer.indexOf('\n}\n', start));
  const directories = [...body.matchAll(/cp -R "\$PACKAGE_DIR\/([^/"]+)\/\." /gu)].map((match) => match[1]);
  const files = [...body.matchAll(/cp "\$PACKAGE_DIR\/([^/"]+)" /gu)].map((match) => match[1]);
  // Pinned against the installer as it actually reads today: if copy_runtime() starts copying
  // something else, this goes red and the gate's surface must be re-derived, never guessed.
  assert.deepEqual(directories, ['scripts', 'contracts', 'tests', 'templates', 'skills']);
  assert.deepEqual(files, ['SKILL.md', 'SECURITY.md']);
  assert.deepEqual([...COPIED_DIRECTORIES], directories);
  assert.deepEqual([...COPIED_FILES], files);
});

test('el instalador PowerShell copia exactamente la misma superficie', () => {
  const installer = readFileSync(join(repoRoot, 'scripts', 'install.ps1'), 'utf8');
  const start = installer.indexOf('function Copy-Runtime');
  const body = installer.slice(start, installer.indexOf('\n}\n', start));
  const directories = [...body.matchAll(/Copy-Item "\$PackageDir\\([^\\"]+)\\\*"/gu)].map((match) => match[1]);
  const files = [...body.matchAll(/Copy-Item "\$PackageDir\\([^\\"*]+)" /gu)].map((match) => match[1]);
  assert.deepEqual(directories, ['scripts', 'contracts', 'tests', 'templates', 'skills']);
  assert.deepEqual(files, ['SKILL.md', 'SECURITY.md']);
  assert.deepEqual([...COPIED_DIRECTORIES], directories);
  assert.deepEqual([...COPIED_FILES], files);
});

test('compareInventories acepta dos inventarios idénticos', () => {
  const source = inventory([['SKILL.md', 'aa'], ['scripts/a.mjs', 'bb']]);
  const runtime = inventory([['scripts/a.mjs', 'bb'], ['SKILL.md', 'aa']]);
  assert.deepEqual(compareInventories(source, runtime), {
    ok: true, compared: 2, differing: [], missing: [], extra: [],
  });
});

test('FALSIFICACIÓN · un archivo con otro contenido se nombra como divergente', () => {
  const result = compareInventories(
    inventory([['scripts/verify-red-node.mjs', 'c48f23d22090'], ['SKILL.md', 'aa']]),
    inventory([['scripts/verify-red-node.mjs', '16230919d901'], ['SKILL.md', 'aa']]),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.differing, ['scripts/verify-red-node.mjs']);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, []);
});

test('FALSIFICACIÓN · un archivo del fuente que falta en el runtime se nombra', () => {
  const result = compareInventories(
    inventory([['SKILL.md', 'aa'], ['scripts/verify-audit-chain.mjs', 'bb']]),
    inventory([['SKILL.md', 'aa']]),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['scripts/verify-audit-chain.mjs']);
  assert.deepEqual(result.differing, []);
});

test('FALSIFICACIÓN · un gate que sobra en el runtime se nombra: el proyecto lo sigue corriendo', () => {
  const result = compareInventories(
    inventory([['SKILL.md', 'aa']]),
    inventory([['SKILL.md', 'aa'], ['scripts/verify-gate-borrado.mjs', 'bb']]),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.extra, ['scripts/verify-gate-borrado.mjs']);
  assert.deepEqual(result.missing, []);
});

test('compareInventories ordena cada clase de divergencia', () => {
  const result = compareInventories(
    inventory([['b.md', '1'], ['a.md', '2'], ['SKILL.md', 'x'], ['zz.md', '9'], ['SECURITY.md', 'k']]),
    inventory([['b.md', '9'], ['a.md', '9'], ['SKILL.md', 'x'], ['n.md', '1'], ['m.md', '1']]),
  );
  assert.deepEqual(result.differing, ['a.md', 'b.md']);
  assert.deepEqual(result.missing, ['SECURITY.md', 'zz.md']);
  assert.deepEqual(result.extra, ['m.md', 'n.md']);
  assert.equal(result.compared, 5);
});

test('parseArguments acepta check con y sin --runtime, y rechaza el resto', () => {
  assert.deepEqual(parseArguments(['check']), { runtime: null, requireInputs: false });
  assert.deepEqual(parseArguments(['check', '--runtime', '/tmp/rt']), { runtime: '/tmp/rt', requireInputs: false });
  assert.equal(parseArguments([]), null);
  assert.equal(parseArguments(['status']), null);
  assert.equal(parseArguments(['check', 'extra']), null);
  assert.equal(parseArguments(['check', '--rt', '/tmp/rt']), null);
  assert.equal(parseArguments(['check', '--runtime', '   ']), null);
  assert.equal(parseArguments(['check', '--runtime', '/tmp/rt', 'extra']), null);
});

test('statKind distingue directorio, archivo y ausencia sobre el filesystem real', () => {
  const { root, source } = sourceCheckout();
  try {
    assert.equal(statKind(join(source, 'scripts')), 'directory');
    assert.equal(statKind(join(source, 'SKILL.md')), 'file');
    assert.equal(statKind(join(source, 'no-existe.md')), 'absent');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missingSourceRoots nombra cada pieza que el instalador necesitaría copiar', () => {
  const { root, source } = sourceCheckout();
  try {
    assert.deepEqual(missingSourceRoots(source), []);
    rmSync(join(source, 'contracts'), { recursive: true, force: true });
    rmSync(join(source, 'SECURITY.md'), { force: true });
    assert.deepEqual(missingSourceRoots(source), ['contracts/', 'SECURITY.md']);
    // A file where a directory belongs is just as unusable to the installer as an absent one.
    writeFileSync(join(source, 'contracts'), 'no soy un directorio\n');
    assert.deepEqual(missingSourceRoots(source), ['contracts/', 'SECURITY.md']);
    mkdirSync(join(root, 'vacio'));
    assert.deepEqual(missingSourceRoots(join(root, 'vacio')), ['scripts/', 'contracts/', 'tests/', 'templates/', 'skills/', 'SKILL.md', 'SECURITY.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readInventory hashea el contenido real de la superficie copiada', () => {
  const { root, source } = sourceCheckout();
  try {
    const found = readInventory(source);
    assert.deepEqual([...found.keys()], SOURCE_FILES.map(([relative]) => relative).sort());
    const expected = createHash('sha256').update(readFileSync(join(source, 'SKILL.md'))).digest('hex');
    assert.equal(found.get('SKILL.md'), expected);
    assert.notEqual(found.get('SKILL.md'), found.get('SECURITY.md'));
    // A runtime missing whole directories still yields an inventory: absence is the caller's verdict.
    rmSync(join(source, 'skills'), { recursive: true, force: true });
    rmSync(join(source, 'SECURITY.md'), { force: true });
    assert.deepEqual([...readInventory(source).keys()].filter((path) => path.startsWith('skills/')), []);
    assert.equal(readInventory(source).has('SECURITY.md'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · readInventory no se traga un archivo ilegible', () => {
  const { root, source } = sourceCheckout();
  try {
    const io = {
      read: (path) => {
        if (String(path).endsWith('SKILL.md')) throw new Error('EACCES: permission denied');
        return readFileSync(path);
      },
    };
    assert.throws(() => readInventory(source, io), (error) => {
      assert.match(error.message, /cannot read SKILL\.md/u);
      assert.match(error.message, /permission denied/u);
      return true;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sin runtime instalado no es un error: el checkout fuente limpio es normal', () => {
  const { root, source } = sourceCheckout();
  try {
    const result = run(['check'], source);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /no runtime installed/u);
    assert.match(result.output, new RegExp(DEFAULT_RUNTIME_PATH.replace('.', '\\.'), 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un runtime idéntico al fuente pasa', () => {
  const { root, source } = sourceCheckout();
  try {
    installRuntime(source);
    const result = run(['check'], source);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /matches this source checkout/u);
    assert.match(result.output, /7 file/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un archivo modificado en el runtime rechaza y lo nombra', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtime = installRuntime(source);
    writeFileSync(join(runtime, 'scripts', 'verify-red-node.mjs'), 'export const gate = 0; // versión vieja\n');
    const result = run(['check'], source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /scripts\/verify-red-node\.mjs/u);
    assert.match(result.output, /differ/u);
    assert.match(result.output, /reinstall/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un archivo que falta en el runtime rechaza y lo nombra', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtime = installRuntime(source);
    rmSync(join(runtime, 'contracts', 'honest-limits.json'), { force: true });
    const result = run(['check'], source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /contracts\/honest-limits\.json/u);
    assert.match(result.output, /absent from the installed runtime/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un gate borrado que sobrevive en el runtime rechaza y lo nombra', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtime = installRuntime(source);
    writeFileSync(join(runtime, 'scripts', 'verify-gate-borrado.mjs'), 'export const removed = true;\n');
    const result = run(['check'], source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /scripts\/verify-gate-borrado\.mjs/u);
    assert.match(result.output, /no longer has/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--runtime compara la copia nombrada y no la ruta por defecto', () => {
  const { root, source } = sourceCheckout();
  try {
    const elsewhere = installRuntime(source, join(root, 'otro-proyecto', '.vibe', 'vcp-runtime'));
    const clean = run(['check', '--runtime', elsewhere], source);
    assert.equal(clean.status, 0, clean.output);
    writeFileSync(join(elsewhere, 'SKILL.md'), '# skill viejo\n');
    const stale = run(['check', '--runtime', elsewhere], source);
    assert.equal(stale.status, 1, stale.output);
    assert.match(stale.output, /SKILL\.md/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un --runtime que no existe no puede pasar en verde', () => {
  const { root, source } = sourceCheckout();
  try {
    const result = run(['check', '--runtime', join(root, 'no-existe')], source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /--runtime/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un runtime mal formado (archivo en vez de directorio) rechaza', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtimePath = join(source, ...DEFAULT_RUNTIME_PATH.split('/'));
    mkdirSync(dirname(runtimePath), { recursive: true });
    writeFileSync(runtimePath, 'no soy un runtime\n');
    const byDefault = run(['check'], source);
    assert.equal(byDefault.status, 0, byDefault.output);
    assert.match(byDefault.output, /no runtime installed/u);
    const named = run(['check', '--runtime', runtimePath], source);
    assert.equal(named.status, 1, named.output);
    assert.match(named.output, /--runtime/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · un directorio que no es checkout fuente no se compara en silencio', () => {
  const { root, source } = sourceCheckout();
  try {
    const consumer = join(root, 'proyecto-consumidor');
    installRuntime(source, join(consumer, ...DEFAULT_RUNTIME_PATH.split('/')));
    const result = run(['check'], consumer);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /not a VibeCodeProtocols source checkout/u);
    assert.match(result.output, /scripts\//u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI rechaza uso inválido con exit 2', () => {
  const { root, source } = sourceCheckout();
  try {
    const result = run([], source);
    assert.equal(result.status, 2, result.output);
    assert.match(result.output, /--runtime/u);
    assert.equal(USAGE.includes('verify-runtime-sync.mjs check'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('main reporta un fallo de lectura del runtime en vez de darlo por sincronizado', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtime = installRuntime(source);
    const errors = [];
    const io = {
      readdir: (path, options) => {
        if (String(path).startsWith(runtime)) throw new Error('EIO: el runtime es ilegible');
        return readdirSync(path, options);
      },
    };
    assert.equal(main(['check'], source, io, () => {}, (line) => errors.push(line)), 1);
    assert.match(errors.join('\n'), /el runtime es ilegible/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('main usa console por defecto cuando no le pasan escritores', () => {
  const { root, source } = sourceCheckout();
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (line) => lines.push(line);
  console.error = (line) => lines.push(line);
  try {
    assert.equal(main(['check'], source), 0);
    assert.equal(main(['nope'], source), 2);
    assert.match(lines.join('\n'), /no runtime installed/u);
    assert.match(lines.join('\n'), /usage: verify-runtime-sync\.mjs/u);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    rmSync(root, { recursive: true, force: true });
  }
});

test('el repositorio real es un checkout fuente y se inventaría entero', () => {
  assert.deepEqual(missingSourceRoots(repoRoot), []);
  const found = readInventory(repoRoot);
  assert.equal(found.has('scripts/verify-runtime-sync.mjs'), true);
  assert.equal(found.has('SKILL.md'), true);
  const expected = createHash('sha256').update(readFileSync(join(repoRoot, 'scripts', 'install.sh'))).digest('hex');
  assert.equal(found.get('scripts/install.sh'), expected);
});

// --- Verde vacío: sin runtime instalado no se comparó nada --------------------------------------

// Contrato de salida fijado literal: el RED falla por aserción, no por un import que no resuelve.
const SYNC_NO_INPUTS = 'RUNTIME_SYNC_NO_INPUTS';

test('sin runtime instalado el gate escribe VACÍO, no OK', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-sync-vacio-'));
  try {
    const run = (...args) => spawnSync(process.execPath, [script, 'check', ...args], { cwd: root, encoding: 'utf8' });

    const permisivo = run();
    assert.deepEqual({ status: permisivo.status, vacio: permisivo.stdout.startsWith('VACÍO: ') }, { status: 0, vacio: true });

    const estricto = run('--require-inputs');
    assert.equal(estricto.status, 1);
    assert.match(estricto.stderr, new RegExp(SYNC_NO_INPUTS, 'u'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseArguments informa --require-inputs sin perder --runtime', () => {
  assert.deepEqual(parseArguments(['check']), { runtime: null, requireInputs: false });
  assert.deepEqual(parseArguments(['check', '--require-inputs']), { runtime: null, requireInputs: true });
  assert.deepEqual(parseArguments(['check', '--runtime', '.vibe/vcp-runtime', '--require-inputs']), { runtime: '.vibe/vcp-runtime', requireInputs: true });
  assert.equal(parseArguments(['--require-inputs']), null);
});

// --- El instalador tiene que proteger el repo del usuario de su propio runtime ------------------

test('los dos instaladores ignoran .vibe/vcp-runtime/ en el repo del proyecto', () => {
  const sh = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8');
  const ps = readFileSync(join(repoRoot, 'scripts', 'install.ps1'), 'utf8');
  for (const [nombre, source] of [['install.sh', sh], ['install.ps1', ps]]) {
    assert.ok(source.includes('.gitignore'), `${nombre} tiene que escribir la regla en .gitignore`);
    assert.ok(source.includes('.vibe/vcp-runtime/'), `${nombre} tiene que ignorar el runtime instalado`);
  }
});

test('FALSIFICACIÓN · sin la regla, el runtime instalado queda como superficie del proyecto', () => {
  const root = mkdtempSync(join(tmpdir(), 'vcp-instalacion-limpia-'));
  try {
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q', '.');
    writeFileSync(join(root, 'README.md'), '# limpio\n', 'utf8');
    git('add', '-A');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init');

    const instalado = spawnSync('bash', [join(repoRoot, 'scripts', 'install.sh'), '--project', root], { encoding: 'utf8' });
    assert.equal(instalado.status, 0, instalado.stderr);

    // Lo que git considera superficie viva del proyecto. El runtime no puede estar acá: un archivo
    // que trajo el instalador bloquearía el gate de seguridad del usuario con un hallazgo que no
    // escribió, y se commitearía sin querer junto con su trabajo.
    const sinSeguimiento = git('ls-files', '--others', '--exclude-standard').stdout.split('\n').filter(Boolean);
    const delRuntime = sinSeguimiento.filter((f) => f.includes('vcp-runtime'));
    assert.deepEqual(delRuntime, [], `el instalador dejó ${delRuntime.length} archivo(s) del runtime como superficie del proyecto`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
