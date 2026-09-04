import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'build-zip.sh');
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';

function run(args) {
  const result = spawnSync(bash, args, { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function runAt(args, cwd, env = process.env) {
  const result = spawnSync(bash, args, { cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

test('build-zip shell script parses and rejects traversal-shaped version input before it can remove or create output', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const syntax = run(['-n', script]);
  assert.equal(syntax.status, 0, syntax.output);
  const invalid = run([script, '../outside']);
  assert.equal(invalid.status, 2, invalid.output);
  assert.match(invalid.output, /version must be/i);
});

// El nombre viejo de esta prueba decía «never local state or the full tree» mirando sólo la lista
// blanca de arriba, que no dice nada de lo que hay ADENTRO de cada directorio. Ahora afirma lo que
// de verdad comprueba: que fuera de la lista blanca no entra nada, ni siquiera si está versionado.
test('FALSIFICACIÓN · lo que está fuera de la lista blanca no entra al paquete, aunque esté versionado', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-'));
  try {
    const packageDir = join(root, 'VCP');
    const scriptsDir = join(packageDir, 'scripts');
    const binDir = join(root, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(packageDir, '.env'), 'must-not-ship\n');
    mkdirSync(join(packageDir, '.vibe'));
    mkdirSync(join(packageDir, 'graphify-out'));
    const fixtureScript = join(scriptsDir, 'build-zip.sh');
    writeFileSync(fixtureScript, readFileSync(script, 'utf8'));
    // El paquete se arma desde lo versionado, asi que el fixture tiene que ser un repositorio. Se
    // versiona TODO a proposito -- incluidos .env, .vibe y graphify-out -- para que la prueba
    // demuestre que quedan afuera por la lista blanca y no por casualidad de no estar en git.
    const git = (...args) => spawnSync('git', ['-C', packageDir, ...args], { encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.email', 'tests@example.test');
    git('config', 'user.name', 'VCP tests');
    writeFileSync(join(packageDir, '.vibe', 'estado.json'), '{}\n');
    writeFileSync(join(packageDir, 'graphify-out', 'graph.json'), '{}\n');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'fixture');
    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$VCP_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([fixtureScript, 'security-test'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, VCP_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    const archiveArgs = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u);
    assert.deepEqual(archiveArgs.slice(0, 2), ['-r', 'vibecodeprotocols-security-test.zip']);
    // Los directorios del fixture estan vacios y git no versiona directorios vacios, asi que lo
    // unico versionado dentro de la lista blanca son los seis documentos de raiz mas el script.
    assert.deepEqual(archiveArgs.slice(2).sort(), [
      'VCP/CHANGELOG.md', 'VCP/INSTALL.md', 'VCP/LICENSE', 'VCP/README.md', 'VCP/SECURITY.md', 'VCP/SKILL.md',
      'VCP/scripts/build-zip.sh',
    ].sort());
    assert.equal(archiveArgs.some((item) => item.includes('.env') || item.includes('.vibe') || item.includes('graphify-out') || item === 'VCP'), false);
    assert.equal(existsSync(join(root, 'vibecodeprotocols-security-test.zip')), true);
    assert.equal(existsSync(join(root, 'vibecodeprotocols-security-test.sha256')), true);
    // FALSIFICACIÓN: the printed recipient instructions must `cd` into the package's REAL
    // directory case ("VCP" here — mixed case on purpose), never a hardcoded lowercase literal
    // that breaks the instructions verbatim on a case-sensitive filesystem (the primary target,
    // since scripts/install.sh is the Linux/macOS installer).
    assert.match(result.output, /cd VCP && \.\/scripts\/install\.sh/u);
    assert.equal(result.output.includes('cd vibecodeprotocols'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- El empaquetador daba a zip los DIRECTORIOS y confiaba en que la lista blanca alcanzara. La
// lista blanca sirve en el nivel de arriba: adentro de scripts/, contracts/, tests/, skills/,
// templates/ y examples/, `zip -r` se lleva TODO lo que haya en disco, versionado o no. Hoy esos
// directorios estan limpios, asi que la propiedad se cumplia por casualidad y no por regla -- que es
// exactamente la clase de defecto que este repositorio se paso el dia arreglando.
//
// La prueba vieja afirmaba "nunca estado local ni el arbol entero" mirando solo esa lista blanca.

test('FALSIFICACIÓN · un archivo ignorado adentro de un directorio empaquetado no viaja al release', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-git-'));
  try {
    const packageDir = join(root, 'VCP');
    const scriptsDir = join(packageDir, 'scripts');
    const binDir = join(root, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(scriptsDir, 'build-zip.sh'), readFileSync(script, 'utf8'));
    // Un archivo versionado y uno ignorado, los dos ADENTRO de un directorio de la lista blanca.
    writeFileSync(join(packageDir, 'tests', 'real.test.mjs'), 'export default 1;\n');
    writeFileSync(join(packageDir, '.gitignore'), 'tests/secreto.local\n');
    writeFileSync(join(packageDir, 'tests', 'secreto.local'), 'no-debe-viajar\n');

    const git = (...args) => spawnSync('git', ['-C', packageDir, ...args], { encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.email', 'tests@example.test');
    git('config', 'user.name', 'VCP tests');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'fixture');

    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$VCP_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([join(scriptsDir, 'build-zip.sh'), 'git-test'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, VCP_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    const args = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u);
    assert.equal(args.includes('VCP/tests/real.test.mjs'), true, `el archivo versionado tiene que viajar: ${args.join(' ')}`);
    assert.equal(args.some((a) => a.includes('secreto.local')), false, 'un archivo ignorado no puede viajar al release');
    assert.equal(args.some((a) => a === 'VCP/tests'), false, 'pasar el directorio suelto se lleva lo ignorado adentro');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el empaquetador falla cerrado si no puede saber que esta versionado', (t) => {
  if (!existsSync(bash)) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-nogit-'));
  try {
    const packageDir = join(root, 'VCP');
    const scriptsDir = join(packageDir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(scriptsDir, 'build-zip.sh'), readFileSync(script, 'utf8'));
    // Las herramientas SI estan: se ponen los mismos stubs que el resto de las pruebas para que el
    // rechazo sea por el chequeo de git y no por un `zip` ausente. Un rojo por el motivo equivocado
    // es una prueba hueca.
    const binDir = join(root, 'bin');
    mkdirSync(binDir, { recursive: true });
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    // Sin git init no hay forma de distinguir versionado de local, y publicar a ciegas es peor
    // que no publicar.
    const result = runAt([join(scriptsDir, 'build-zip.sh'), 'sin-git'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /REJECTED: .*not a Git work tree/u);
    assert.equal(existsSync(join(root, 'vibecodeprotocols-sin-git.zip')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
