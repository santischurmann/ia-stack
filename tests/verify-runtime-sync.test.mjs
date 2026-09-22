import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const bash = process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash';
const script = join(repoRoot, 'scripts', 'verify-runtime-sync.mjs');
const {
  COPIED_DIRECTORIES,
  COPIED_FILES,
  DEFAULT_RUNTIME_PATH,
  RUTAS_DE_RUNTIME,
  SELLO,
  USAGE,
  leerSello,
  compareInventories,
  esRuntimeInstalado,
  main,
  missingSourceRoots,
  parseArguments,
  readInventory,
  statKind,
} = await import(`file://${script.replaceAll('\\', '/')}`);

const SOURCE_FILES = [
  ['scripts/verify-red-node.mjs', 'export const gate = 1;\n'],
  ['contracts/honest-limits.json', '{"schema":"ia.honest-limits/1"}\n'],
  ['tests/verify-red-node.test.mjs', 'import test from "node:test";\n'],
  ['templates/vibe/PROJECT.md', '# (fill in)\nStarted: YYYY-MM-DD\n'],
  ['skills/vibe-memory.md', '# memoria\n'],
  ['SKILL.md', '# skill\n'],
  ['SECURITY.md', '# security\n'],
  // Los punteros de Codex: el instalador los LEE del paquete, asi que tienen que viajar con el
  // runtime o una reinstalacion desde el runtime falla con "cannot stat".
  ['.agents/skills/vibecodeprotocols/SKILL.md', '# puntero\n'],
  ['AGENTS.md', '# agents\n'],
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
  const installer = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8').split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
  const start = installer.indexOf('copy_runtime()');
  const body = installer.slice(start, installer.indexOf('\n}\n', start));
  const directories = [...body.matchAll(/cp -R "\$PACKAGE_DIR\/([^/"]+)\/\." /gu)].map((match) => match[1]);
  const files = [...body.matchAll(/cp "\$PACKAGE_DIR\/([^/"]+)" /gu)].map((match) => match[1]);
  // Pinned against the installer as it actually reads today: if copy_runtime() starts copying
  // something else, this goes red and the gate's surface must be re-derived, never guessed.
  assert.deepEqual(directories, ['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents']);
  assert.deepEqual(files, ['SKILL.md', 'SECURITY.md', 'AGENTS.md']);
  assert.deepEqual([...COPIED_DIRECTORIES], directories);
  assert.deepEqual([...COPIED_FILES], files);
});

test('el instalador PowerShell copia exactamente la misma superficie', () => {
  // Git normaliza los finales de linea al hacer checkout: en Windows este archivo llega con CRLF.
  // Buscar el cierre con LF crudo devolvia -1 en un clon recien hecho, el slice se comia el resto
  // del archivo, y la prueba encontraba directorios que Copy-Runtime no copia. Pasaba solo en la
  // maquina donde el archivo casualmente tenia LF. Reproducido clonando desde GitHub el 2026-08-28.
  const installer = readFileSync(join(repoRoot, 'scripts', 'install.ps1'), 'utf8').split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
  const start = installer.indexOf('function Copy-Runtime');
  const cierre = installer.indexOf(String.fromCharCode(10) + '}' + String.fromCharCode(10), start);
  assert.ok(start !== -1 && cierre > start, 'no se ubicó el cuerpo de Copy-Runtime en install.ps1');
  const body = installer.slice(start, cierre);
  const directories = [...body.matchAll(/Copy-Item "\$PackageDir\\([^\\"]+)\\\*"/gu)].map((match) => match[1]);
  const files = [...body.matchAll(/Copy-Item "\$PackageDir\\([^\\"*]+)" /gu)].map((match) => match[1]);
  assert.deepEqual(directories, ['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents']);
  assert.deepEqual(files, ['SKILL.md', 'SECURITY.md', 'AGENTS.md']);
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
    assert.deepEqual(missingSourceRoots(join(root, 'vacio')), ['scripts/', 'contracts/', 'tests/', 'templates/', 'skills/', '.agents/', 'SKILL.md', 'SECURITY.md', 'AGENTS.md']);
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
        // Se ancla en la ruta EXACTA y no en el sufijo: con `.agents/skills/.../SKILL.md` en la
        // superficie, `endsWith('SKILL.md')` agarraba dos archivos y el mensaje nombraba el otro.
        if (String(path) === join(source, 'SKILL.md')) throw new Error('EACCES: permission denied');
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
    // Nueve, no siete: la superficie sumó `.agents/` y `AGENTS.md` cuando se cerró el defecto de
    // que un runtime instalado no podía reinstalarse. El número sale de SOURCE_FILES.
    assert.match(result.output, new RegExp(`${SOURCE_FILES.length} file`, 'u'));
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
    assert.match(result.output, /not an IA Stack source checkout/u);
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

// EL CONSEJO DE ARREGLO MENTIA PARA UNA DE LAS TRES DIVERGENCIAS.
//
// Medido el 2026-09-15 sobre la instalacion real de este repositorio: se borro
// `templates/diagnostics/implementation.json` del checkout, se corrio `scripts/install.sh --project .`
// tal como el gate indica, y el archivo SIGUIO en el runtime instalado. El instalador copia, nunca
// poda: para `differing` y `missing` reinstalar alcanza, para `extra` no hace absolutamente nada.
//
// Un gate que rechaza y da un comando que no arregla lo que rechaza deja a quien lo lee corriendo el
// mismo comando dos veces y viendo el mismo rojo. El gate sigue rechazando —la divergencia es real y
// peligrosa: un archivo borrado del origen que sigue vivo en la copia instalada es un gate retirado
// que se sigue ejecutando—, pero ahora dice lo que de verdad lo saca.
test('el consejo de arreglo distingue lo que reinstalar arregla de lo que no', () => {
  const { root, source } = sourceCheckout();
  try {
    const runtime = installRuntime(source);
    mkdirSync(join(runtime, 'scripts'), { recursive: true });
    writeFileSync(join(runtime, 'scripts', 'verify-gate-retirado.mjs'), 'export const x = 1;\n');

    const errors = [];
    assert.equal(main(['check'], source, {}, () => {}, (line) => errors.push(line)), 1);
    const salida = errors.join('\n');
    assert.match(salida, /verify-gate-retirado\.mjs/u);
    // EL CONSEJO CAMBIO EL 2026-09-22, porque cambio lo que hace el instalador. Antes decia «el
    // instalador copia, no borra: borralos a mano», y era verdad. Desde que reinstalar con
    // --project APARTA lo que sobra, ese consejo mandaria a borrar a mano lo que el instalador ya
    // aparta solo -- y un consejo que manda a hacer algo destructivo que no hace falta es peor que
    // ninguno. Tiene que decir que reinstalar lo aparta, adonde, y que no lo borra.
    assert.match(salida, /ia-stack-archive/u, `el consejo tiene que decir adonde va lo apartado: ${salida}`);
    assert.match(salida, /no (los )?borra/iu, `y que apartar no es borrar: ${salida}`);
    assert.doesNotMatch(salida, /borralos a mano/iu, 'el consejo viejo manda a borrar a mano lo que ya se aparta solo');
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
  assert.deepEqual(parseArguments(['check', '--runtime', '.vibe/ia-stack-runtime', '--require-inputs']), { runtime: '.vibe/ia-stack-runtime', requireInputs: true });
  assert.equal(parseArguments(['--require-inputs']), null);
});

// --- El instalador tiene que proteger el repo del usuario de su propio runtime ------------------

test('los dos instaladores ignoran .vibe/ia-stack-runtime/ en el repo del proyecto', () => {
  const sh = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8');
  const ps = readFileSync(join(repoRoot, 'scripts', 'install.ps1'), 'utf8');
  for (const [nombre, source] of [['install.sh', sh], ['install.ps1', ps]]) {
    assert.ok(source.includes('.gitignore'), `${nombre} tiene que escribir la regla en .gitignore`);
    assert.ok(source.includes('.vibe/ia-stack-runtime/'), `${nombre} tiene que ignorar el runtime instalado`);
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

    // Los tres flags MÁS `HOME` sobrescrito: sin `--target-dir` y `--runtime-dir`, el instalador
    // escribe en el `$HOME/.claude` real de quien corre la suite (install.sh:9-10), porque esa
    // escritura ocurre antes del bloque de `--project`. Ver tests/home-intacto.test.mjs.
    const aBash = (r) => r.replace(/\\/g, '/').replace(/^([A-Za-z]):/u, (_, u) => `/${u.toLowerCase()}`);
    const entorno = { ...process.env, HOME: aBash(root) };
    delete entorno.NODE_TEST_CONTEXT;
    const comando = `'${aBash(join(repoRoot, 'scripts', 'install.sh'))}'`
      + ` --target-dir '${aBash(join(root, '__skills-aisladas'))}'`
      + ` --runtime-dir '${aBash(join(root, '__runtime-aislado'))}'`
      + ` --project '${aBash(root)}'`;
    const instalado = spawnSync(bash, ['-lc', comando], { encoding: 'utf8', env: entorno });
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

// --- Un runtime instalado no podia reinstalarse, y eso contradice de frente la promesa de
// "self-contained runtime" que el propio instalador imprime. `install.sh` lee de $PACKAGE_DIR dos
// archivos que NO estan en la lista de copia -- `AGENTS.md` y el puntero de Codex --, asi que al
// reinstalar desde el runtime `cp` falla con "cannot stat". Medido: de los 26 fallos que deja una
// instalacion, DIEZ salen de aca, y siete son la misma llamada cascadeando.
//
// La regla es un PUNTO FIJO, no una lista de nombres: todo lo que el instalador lee de $PACKAGE_DIR
// tiene que estar en la superficie que el instalador copia. Si manana lee un archivo nuevo y se
// olvida de copiarlo, esto lo agarra sin que nadie actualice nada.

export function leidoDelPaquete(texto) {
  const rutas = new Set();
  for (const m of texto.matchAll(/\$PACKAGE_DIR\/([A-Za-z0-9_.\-/]+)/gu)) rutas.add(m[1]);
  const BARRA = String.fromCharCode(92);
  for (const m of texto.matchAll(new RegExp(`\\$PackageDir[${BARRA}${BARRA}/]([A-Za-z0-9_.-]+(?:[${BARRA}${BARRA}/][A-Za-z0-9_.-]+)*)`, 'gu'))) {
    rutas.add(m[1].split(BARRA).join('/'));
  }
  // `scripts/.` y compañía: el `copy_runtime` copia el contenido del directorio.
  return [...rutas].map((r) => r.replace(/\/\.$/u, '')).filter((r) => r !== '');
}

export function fueraDeLaSuperficie(rutas, directorios = COPIED_DIRECTORIES, archivos = COPIED_FILES) {
  return rutas.filter((r) => !directorios.includes(r.split('/')[0]) && !archivos.includes(r)).sort();
}

/** Rutas del paquete que el instalador solo PREGUNTA si existen —`[ -e "$PACKAGE_DIR/x" ]`— y nunca
 * lee ni copia.
 *
 * LLEGO CON EL SELLO DE INSTALACION, el 2026-09-22: el instalador pregunta si hay `$PACKAGE_DIR/.git`
 * para saber si puede nombrar un commit, y esta regla lo acuso como una lectura que no se copia. No
 * rompe el punto fijo: reinstalar desde una copia del runtime cae justo en la rama de «no hay .git»,
 * que dice «paquete sin git» y funciona.
 *
 * Y NO ES UNA LISTA BLANCA con `.git` adentro, que taparia el dia en que alguien haga
 * `cp -R "$PACKAGE_DIR/.git"`. Una ruta cuenta como sonda solo si TODAS sus apariciones son
 * preguntas de existencia: una sola lectura la vuelve una dependencia, y la regla la vuelve a acusar. */
export function sondasDeExistencia(texto) {
  const apariciones = new Map();
  for (const m of texto.matchAll(/\$PACKAGE_DIR\/([A-Za-z0-9_.\-/]+)/gu)) {
    const cuenta = apariciones.get(m[1]) ?? { total: 0, preguntas: 0 };
    cuenta.total += 1;
    apariciones.set(m[1], cuenta);
  }
  for (const m of texto.matchAll(/\[ -[edf] "\$PACKAGE_DIR\/([A-Za-z0-9_.\-/]+)" \]/gu)) {
    apariciones.get(m[1]).preguntas += 1;
  }
  return [...apariciones].filter(([, c]) => c.total === c.preguntas).map(([ruta]) => ruta);
}

test('todo lo que el instalador lee del paquete está en la superficie que copia', () => {
  const sh = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8');
  const rutas = leidoDelPaquete(sh);
  assert.ok(rutas.length > 0, 'no se pudo leer ninguna ruta de $PACKAGE_DIR: la comprobación no midió nada');
  const sondas = sondasDeExistencia(sh);
  assert.deepEqual(
    fueraDeLaSuperficie(rutas.filter((ruta) => !sondas.includes(ruta))),
    [],
    'el instalador lee esto del paquete pero no lo copia: un runtime instalado no puede reinstalarse',
  );
});

test('FALSIFICACIÓN · una sonda de existencia deja de serlo en cuanto la ruta se lee una sola vez', () => {
  assert.deepEqual(sondasDeExistencia('[ -e "$PACKAGE_DIR/.git" ] && x'), ['.git']);
  assert.deepEqual(sondasDeExistencia('[ -d "$PACKAGE_DIR/cache" ] || y'), ['cache']);
  // La trampa que la regla existe para no tapar: preguntar y despues copiar.
  assert.deepEqual(
    sondasDeExistencia('[ -e "$PACKAGE_DIR/.git" ] && cp -R "$PACKAGE_DIR/.git" dst'),
    [],
    'si la ruta se copia en algun lado ya es una dependencia, aunque tambien se pregunte',
  );
  assert.deepEqual(sondasDeExistencia('cp "$PACKAGE_DIR/AGENTS.md" x'), [], 'una copia no es una pregunta');
});

test('FALSIFICACIÓN · la regla del punto fijo distingue copiado de leído-y-no-copiado', () => {
  assert.deepEqual(leidoDelPaquete('cp "$PACKAGE_DIR/scripts/." x'), ['scripts']);
  assert.deepEqual(leidoDelPaquete('cp "$PACKAGE_DIR/AGENTS.md" y').sort(), ['AGENTS.md']);
  assert.deepEqual(leidoDelPaquete('nada que ver'), []);
  // Lo que está en la lista no se acusa; lo que no, sí. Las listas se pasan explícitas: una
  // falsificación que dependa de la configuración real deja de falsificar cuando la configuración
  // cambia — pasó al agregar `.agents` y `AGENTS.md`, y esta prueba se volvió verde sin motivo.
  const dirs = ['scripts'];
  const files = ['SKILL.md'];
  assert.deepEqual(fueraDeLaSuperficie(['scripts/x.mjs', 'SKILL.md'], dirs, files), []);
  assert.deepEqual(fueraDeLaSuperficie(['AGENTS.md', '.agents/skills/x/SKILL.md'], dirs, files), ['.agents/skills/x/SKILL.md', 'AGENTS.md']);
});

// --- La guarda de forma que varios gates usan para saber si estan corriendo adentro del runtime
// instalado de otra persona. Vive aca, derivada de DEFAULT_RUNTIME_PATH, y no copiada en cada gate:
// dos guardas iguales en dos archivos se desincronizan, y eso ya costo un rojo en este repositorio.

test('esRuntimeInstalado reconoce un runtime por su forma, y sólo eso', () => {
  assert.equal(esRuntimeInstalado(join('C:', 'proy', '.vibe', 'vcp-runtime')), true);
  assert.equal(esRuntimeInstalado(join('C:', 'a', 'b', '.vibe', 'vcp-runtime')), true, 'la profundidad no importa: importa el sufijo');
});

test('FALSIFICACIÓN · esRuntimeInstalado no confunde un checkout con una instalación', () => {
  assert.equal(esRuntimeInstalado(join('C:', 'Users', 'x', 'ia-stack')), false);
  assert.equal(esRuntimeInstalado(join('C:', 'proy', 'vcp-runtime')), false, 'sin .vibe encima no es una instalación');
  assert.equal(esRuntimeInstalado(join('C:', 'proy', '.vibe', 'otra-cosa')), false);
  // Una ruta más corta que el sufijo buscado: la rama que evita leer fuera del arreglo.
  assert.equal(esRuntimeInstalado('/'), false);
});

// --- LA CARPETA DEL RUNTIME CAMBIO DE NOMBRE, Y LAS INSTALACIONES VIEJAS SIGUEN ANDANDO ----------
//
// El protocolo pasó a llamarse IA Stack el 2026-09-15 y la carpeta instalada pasó de
// `.vibe/vcp-runtime` a `.vibe/ia-stack-runtime`. Toda instalación anterior tiene la vieja, y ese
// nombre está en la ruta de CADA comando que el protocolo documenta. Romperlas de golpe convertiría
// un cambio de nombre en una rotura para todo el que ya lo estaba usando.
//
// La regla: **se prefiere la nueva y se acepta la vieja**, y cuando se usa la vieja el gate lo DICE.
// Un verde silencioso sobre la carpeta vieja dejaría a un proyecto sin migrar para siempre sin
// enterarse, que es la misma trampa que el gate de sincronía ya tiene declarada sobre los archivos
// que sobran: lo que no se nombra, no se migra.

test('la ruta vigente es la nueva, y la vieja se sigue reconociendo', () => {
  assert.equal(DEFAULT_RUNTIME_PATH, '.vibe/ia-stack-runtime');
  assert.deepEqual([...RUTAS_DE_RUNTIME], ['.vibe/ia-stack-runtime', '.vibe/vcp-runtime']);
});

test('esRuntimeInstalado reconoce las DOS carpetas', () => {
  // Varios gates se saltean sus self-checks preguntando esto. Si sólo reconociera la nueva, un
  // proyecto con la carpeta vieja correría comprobaciones que no le corresponden y vería rojos que
  // no son suyos.
  assert.equal(esRuntimeInstalado('/proyecto/.vibe/ia-stack-runtime'), true);
  assert.equal(esRuntimeInstalado('/proyecto/.vibe/vcp-runtime'), true);
  assert.equal(esRuntimeInstalado('/proyecto/.vibe'), false);
  assert.equal(esRuntimeInstalado('/proyecto/.vibe/otra-cosa'), false);
});

test('UNA INSTALACION VIEJA se compara igual, y el gate dice que está con el nombre viejo', () => {
  const { root, source } = sourceCheckout();
  try {
    installRuntime(source, join(source, '.vibe', 'vcp-runtime'));
    const salida = [];
    const code = main(['check'], source, {}, (l) => salida.push(l), (l) => salida.push(l));
    assert.equal(code, 0, salida.join('\n'));
    assert.match(salida.join('\n'), /vcp-runtime/u, 'tiene que nombrar la carpeta vieja que encontró');
    assert.match(salida.join('\n'), /ia-stack-runtime/u, 'y decir cuál es la nueva');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('con LAS DOS carpetas, gana la nueva y la vieja se acusa como sobrante', () => {
  // Es el estado peligroso de verdad: el instalador copia y no poda, así que después de migrar
  // quedan las dos. Un gate viejo que sigue vivo en la carpeta vieja se puede seguir ejecutando.
  const { root, source } = sourceCheckout();
  try {
    installRuntime(source, join(source, '.vibe', 'ia-stack-runtime'));
    installRuntime(source, join(source, '.vibe', 'vcp-runtime'));
    const salida = [];
    const code = main(['check'], source, {}, (l) => salida.push(l), (l) => salida.push(l));
    assert.equal(code, 1, salida.join('\n'));
    assert.match(salida.join('\n'), /vcp-runtime/u);
    assert.match(salida.join('\n'), /borr|saca|elimin/iu, 'tiene que decir qué hacer con la vieja');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- EL SELLO DE INSTALACION, decidido por el operador el 2026-09-22 ------------------------------
//
// Este gate compara la copia instalada CONTRA el checkout fuente, asi que sin el checkout no puede
// comparar y sale 1 pidiendolo. Quien solo tiene su proyecto -- el caso normal de quien instala --
// no podia responder «¿mi runtime esta viejo?». YA PASO: un proyecto real llevaba dias con un runtime
// anterior al 2026-09-15, rechazando recibos por un prefijo que el runtime nuevo acepta, y nadie se
// entero. Ahora el instalador deja un sello con la fecha y el commit de origen, y este gate lo lee
// justo donde antes solo podia decir «no puedo».
//
// Sigue saliendo 1: sin el checkout no hay comparacion, y decir cuando se instalo no es comparar.

function proyectoConRuntime(sello) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-runtime-sync-sello-'));
  const runtime = join(root, ...DEFAULT_RUNTIME_PATH.split('/'));
  mkdirSync(join(runtime, 'scripts'), { recursive: true });
  if (sello !== undefined) writeFileSync(join(runtime, SELLO), typeof sello === 'string' ? sello : JSON.stringify(sello));
  return root;
}

const SELLO_DE_PRUEBA = {
  schema: 'ia.runtime-instalado/1',
  instalado: '2026-09-01T00:00:00Z',
  desde: 'checkout',
  commit: 'c'.repeat(40),
  arbol_limpio: true,
};
const DIA_22 = Date.parse('2026-09-22T00:00:00Z');

test('sin el checkout al lado, el rechazo dice CUANDO se instalo el runtime y desde que commit', () => {
  const root = proyectoConRuntime(SELLO_DE_PRUEBA);
  try {
    const errors = [];
    const code = main(['check'], root, { ahora: () => DIA_22 }, () => {}, (l) => errors.push(l));
    assert.equal(code, 1, 'decir cuando se instalo no es comparar: sigue rechazando');
    const salida = errors.join(' | ');
    assert.match(salida, /2026-09-01/u);
    assert.match(salida, /c{7}/u, 'nombra el commit de origen');
    assert.match(salida, /21 d[ií]as/u, 'y cuanto hace');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un runtime SIN sello tambien es un dato: se instalo antes de que el sello existiera', () => {
  const root = proyectoConRuntime(undefined);
  try {
    const errors = [];
    assert.equal(main(['check'], root, {}, () => {}, (l) => errors.push(l)), 1);
    assert.match(errors.join(' | '), /sin sello/iu);
    assert.match(errors.join(' | '), /2026-09-22/u, 'dice desde cuando existe el sello, que es la cota de su edad');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un sello de un paquete sin git lo dice, en vez de inventar un commit', () => {
  const root = proyectoConRuntime({ ...SELLO_DE_PRUEBA, desde: 'paquete', commit: null, arbol_limpio: null });
  try {
    const errors = [];
    assert.equal(main(['check'], root, { ahora: () => DIA_22 }, () => {}, (l) => errors.push(l)), 1);
    assert.match(errors.join(' | '), /paquete/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un checkout con cambios sin commitear al instalar se dice: el commit no describe la copia', () => {
  const root = proyectoConRuntime({ ...SELLO_DE_PRUEBA, arbol_limpio: false });
  try {
    const errors = [];
    main(['check'], root, { ahora: () => DIA_22 }, () => {}, (l) => errors.push(l));
    assert.match(errors.join(' | '), /sin commitear/iu);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACION · un sello ilegible no tumba el gate ni se lee como una fecha', () => {
  for (const roto of ['{ no es json', JSON.stringify({ schema: 'otra.cosa/1' }), JSON.stringify({ ...SELLO_DE_PRUEBA, instalado: 'ayer' })]) {
    const root = proyectoConRuntime(roto);
    try {
      const errors = [];
      assert.equal(main(['check'], root, { ahora: () => DIA_22 }, () => {}, (l) => errors.push(l)), 1);
      assert.match(errors.join(' | '), /ilegible/iu, roto);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('leerSello distingue ausente, valido e ilegible', () => {
  const root = proyectoConRuntime(SELLO_DE_PRUEBA);
  try {
    const runtime = join(root, ...DEFAULT_RUNTIME_PATH.split('/'));
    assert.equal(leerSello(runtime).estado, 'valido');
    assert.equal(leerSello(join(root, 'no-existe')).estado, 'ausente');
    assert.equal(leerSello(runtime, { read: () => { throw new Error('permiso denegado'); } }).estado, 'ilegible',
      'un error que no es «no existe» no se confunde con un runtime sin sello');
    const raro = leerSello(runtime, { read: () => { throw 'algo que no es un Error'; } });
    assert.equal(raro.estado, 'ilegible');
    assert.match(raro.motivo, /no es un Error/u, 'lo que se tira sin ser un Error igual se reporta, no sale «undefined»');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un dia se dice en singular: la frase se lee, no se descifra', () => {
  const root = proyectoConRuntime(SELLO_DE_PRUEBA);
  try {
    const errors = [];
    main(['check'], root, { ahora: () => Date.parse('2026-09-02T00:00:00Z') }, () => {}, (l) => errors.push(l));
    assert.match(errors.join(' | '), /hace 1 dia,/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
