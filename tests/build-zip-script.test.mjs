import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { COPIED_DIRECTORIES, COPIED_FILES } from '../scripts/verify-runtime-sync.mjs';
import { resolveBash } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'build-zip.sh');
// `resolveBash` y no una constante propia: en Windows prefiere Git Bash sobre el shim de WSL, y
// fuera de Windows devuelve `bash` a secas. Antes esto se comparaba con `existsSync`, y en Linux
// `existsSync('bash')` da false —es un nombre del PATH, no una ruta—, así que las cuatro pruebas de
// este archivo se salteaban enteras justo en la plataforma donde el `.sh` es EL camino.
const bash = resolveBash();
const hayBash = process.platform !== 'win32' || existsSync(bash);

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

// AGENTS.md y el puntero de Codex: los dos instaladores los leen del paquete sin condicion, asi que
// el empaquetador los exige como al resto de la lista blanca, y todo fixture tiene que traerlos.
function ponerLoDeCodex(packageDir) {
  writeFileSync(join(packageDir, 'AGENTS.md'), 'AGENTS.md\n');
  mkdirSync(join(packageDir, '.agents', 'skills', 'ia-stack'), { recursive: true });
  writeFileSync(join(packageDir, '.agents', 'skills', 'ia-stack', 'SKILL.md'), 'puntero\n');
}

test('build-zip shell script parses and rejects traversal-shaped version input before it can remove or create output', (t) => {
  if (!hayBash) t.skip('Git Bash is unavailable on this Windows host');
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
  if (!hayBash) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-'));
  try {
    const packageDir = join(root, 'IAStack');
    const scriptsDir = join(packageDir, 'scripts');
    const binDir = join(root, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    ponerLoDeCodex(packageDir);
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
    git('config', 'user.name', 'IAStack tests');
    writeFileSync(join(packageDir, '.vibe', 'estado.json'), '{}\n');
    writeFileSync(join(packageDir, 'graphify-out', 'graph.json'), '{}\n');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'fixture');
    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$IA_STACK_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([fixtureScript, 'security-test'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, IA_STACK_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    const archiveArgs = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u);
    assert.equal(archiveArgs[0], '-r');
    assert.equal(basename(archiveArgs[1]), 'ia-stack-security-test.zip');
    // Los directorios del fixture estan vacios y git no versiona directorios vacios, asi que lo
    // versionado dentro de la lista blanca son los documentos de raiz, el script, AGENTS.md y el
    // puntero de Codex. TODO bajo `ia-stack/`, aunque la carpeta del checkout se llame IAStack: la
    // raiz del zip salia del nombre de esa carpeta, y la de este repositorio todavia tiene el nombre
    // anterior del protocolo. El paquete no puede depender de donde lo clonaron.
    assert.deepEqual(archiveArgs.slice(2).sort(), [
      'ia-stack/.agents/skills/ia-stack/SKILL.md', 'ia-stack/AGENTS.md',
      'ia-stack/CHANGELOG.md', 'ia-stack/INSTALL.md', 'ia-stack/LICENSE', 'ia-stack/README.md', 'ia-stack/SECURITY.md', 'ia-stack/SKILL.md',
      'ia-stack/scripts/build-zip.sh',
    ].sort());
    assert.equal(archiveArgs.some((item) => item.includes('.env') || item.includes('.vibe') || item.includes('graphify-out') || item === 'ia-stack'), false);
    assert.equal(existsSync(join(root, 'ia-stack-security-test.zip')), true);
    assert.equal(existsSync(join(root, 'ia-stack-security-test.sha256')), true);
    // El checksum nombra el zip por su nombre y no por una ruta: `sha256sum -c` se corre al lado del
    // zip descargado, y ahi una ruta absoluta de la maquina que lo armo no existe. El separador es
    // ` ` o `*`: en Windows el stub no llega a correr -- el bash de Git antepone /usr/bin al PATH -- y
    // el sha256sum real escribe en modo binario. Las dos formas las acepta `sha256sum -c`.
    assert.match(readFileSync(join(root, 'ia-stack-security-test.sha256'), 'utf8'), /^[0-9a-f]{64} [ *]ia-stack-security-test\.zip\r?\n$/u);
    // FALSIFICACIÓN: las instrucciones impresas tienen que hacer `cd` a la carpeta que el comando de
    // al lado CREA, en un sistema de archivos que distingue mayusculas -- el destino principal,
    // porque install.sh es el instalador de Linux y macOS --. Antes esa carpeta era la del checkout;
    // con el prefijo fijo, el zip crea `ia-stack/`, y el clon tambien, porque se le pasa el nombre
    // como hace INSTALL.md. La carpeta local (IAStack aca, con mayusculas a proposito) no se filtra.
    assert.match(result.output, /unzip ia-stack-security-test\.zip && cd ia-stack && \.\/scripts\/install\.sh/u);
    assert.match(result.output, /git clone <your-repo-url> ia-stack && cd ia-stack && \.\/scripts\/install\.sh/u);
    assert.equal(result.output.includes('cd IAStack'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- ALTO de la revision del 2026-09-26: el zip no llevaba AGENTS.md ni .agents/, y los dos
// instaladores los copian sin condicion. Bajo `set -euo pipefail`, quien descomprimia y corria
// ./scripts/install.sh caia en `cp: cannot stat .../.agents/.` con la instalacion a medias. La
// lista del empaquetador estaba escrita a mano y nada la comparaba con lo que el instalador lee.
//
// Se compara contra `COPIED_DIRECTORIES` y `COPIED_FILES` del gate de sincronia, que
// tests/verify-runtime-sync.test.mjs deriva de los DOS instaladores, y otra prueba de ese archivo
// exige que todo lo que un instalador lee del paquete este en esa superficie. Por transitividad: si
// el zip lleva la superficie, lleva todo lo que el instalador lee. Si manana el instalador copia algo
// nuevo, esta prueba se pone roja sin que nadie actualice una lista.
test('el zip lleva todo lo que el instalador copia del paquete', (t) => {
  if (!hayBash) t.skip('Git Bash is unavailable on this Windows host');
  assert.ok(COPIED_DIRECTORIES.length > 0 && COPIED_FILES.length > 0, 'la superficie del instalador vino vacia: la prueba no mediria nada');
  const root = mkdtempSync(join(tmpdir(), 'ia-stack-build-zip-superficie-'));
  try {
    const packageDir = join(root, 'IAStack');
    const binDir = join(root, 'bin');
    mkdirSync(binDir, { recursive: true });
    // Un archivo versionado adentro de cada directorio que el instalador copia, y cada archivo suelto.
    for (const dir of COPIED_DIRECTORIES) {
      mkdirSync(join(packageDir, dir), { recursive: true });
      writeFileSync(join(packageDir, dir, 'uno.txt'), `${dir}\n`);
    }
    for (const file of COPIED_FILES) writeFileSync(join(packageDir, file), `${file}\n`);
    // Lo demas de la lista blanca, que el empaquetador exige aunque el instalador no lo copie.
    for (const name of ['README.md', 'INSTALL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    mkdirSync(join(packageDir, 'examples'), { recursive: true });
    writeFileSync(join(packageDir, 'scripts', 'build-zip.sh'), readFileSync(script, 'utf8'));
    const git = (...args) => spawnSync('git', ['-C', packageDir, ...args], { encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.email', 'tests@example.test');
    git('config', 'user.name', 'IAStack tests');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'fixture');
    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$IA_STACK_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([join(packageDir, 'scripts', 'build-zip.sh'), 'superficie'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, IA_STACK_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    // Sin el primer segmento: esta prueba mira QUE viaja; el prefijo lo mira la prueba de la lista blanca.
    const relativas = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u).slice(2).map((a) => a.split('/').slice(1).join('/'));
    const faltan = [
      ...COPIED_DIRECTORIES.filter((dir) => !relativas.some((r) => r.startsWith(`${dir}/`))),
      ...COPIED_FILES.filter((file) => !relativas.includes(file)),
    ];
    assert.deepEqual(faltan, [], `el instalador copia esto del paquete y el zip no lo lleva: ${faltan.join(', ')}`);
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
  if (!hayBash) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-git-'));
  try {
    const packageDir = join(root, 'IAStack');
    const scriptsDir = join(packageDir, 'scripts');
    const binDir = join(root, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(scriptsDir, 'build-zip.sh'), readFileSync(script, 'utf8'));
    ponerLoDeCodex(packageDir);
    // Un archivo versionado y uno ignorado, los dos ADENTRO de un directorio de la lista blanca.
    writeFileSync(join(packageDir, 'tests', 'real.test.mjs'), 'export default 1;\n');
    writeFileSync(join(packageDir, '.gitignore'), 'tests/secreto.local\n');
    writeFileSync(join(packageDir, 'tests', 'secreto.local'), 'no-debe-viajar\n');

    const git = (...args) => spawnSync('git', ['-C', packageDir, ...args], { encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.email', 'tests@example.test');
    git('config', 'user.name', 'IAStack tests');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'fixture');

    const argsFile = join(root, 'zip-args.txt');
    const zipStub = join(binDir, 'zip');
    const shaStub = join(binDir, 'sha256sum');
    writeFileSync(zipStub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$IA_STACK_ZIP_ARGS"\nprintf archive > "$2"\n');
    writeFileSync(shaStub, '#!/usr/bin/env bash\nprintf "0000000000000000000000000000000000000000000000000000000000000000  %s\\n" "$1"\n');
    chmodSync(zipStub, 0o755);
    chmodSync(shaStub, 0o755);
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const result = runAt([join(scriptsDir, 'build-zip.sh'), 'git-test'], packageDir, {
      ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`, IA_STACK_ZIP_ARGS: argsFile,
    });
    assert.equal(result.status, 0, result.output);
    const args = readFileSync(argsFile, 'utf8').trim().split(/\r?\n/u);
    assert.equal(args.includes('ia-stack/tests/real.test.mjs'), true, `el archivo versionado tiene que viajar: ${args.join(' ')}`);
    assert.equal(args.some((a) => a.includes('secreto.local')), false, 'un archivo ignorado no puede viajar al release');
    assert.equal(args.some((a) => a === 'ia-stack/tests'), false, 'pasar el directorio suelto se lleva lo ignorado adentro');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('el empaquetador falla cerrado si no puede saber que esta versionado', (t) => {
  if (!hayBash) t.skip('Git Bash is unavailable on this Windows host');
  const root = mkdtempSync(join(tmpdir(), 'vcp-build-zip-nogit-'));
  try {
    const packageDir = join(root, 'IAStack');
    const scriptsDir = join(packageDir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    for (const name of ['README.md', 'SECURITY.md', 'INSTALL.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']) writeFileSync(join(packageDir, name), `${name}\n`);
    for (const name of ['contracts', 'tests', 'skills', 'templates', 'examples']) mkdirSync(join(packageDir, name));
    writeFileSync(join(scriptsDir, 'build-zip.sh'), readFileSync(script, 'utf8'));
    ponerLoDeCodex(packageDir);
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
    assert.equal(existsSync(join(root, 'ia-stack-sin-git.zip')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
