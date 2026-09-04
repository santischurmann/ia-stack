// Los bytes de los archivos trackeados tienen que seguir siendo texto revisable en cualquier
// máquina. Dos cosas lo rompen, y las dos se midieron el 2026-09-01 sobre este repositorio.
//
// Un clon limpio de este repositorio tiene que salir verde. El 2026-09-01 no salía: `git ls-files`
// da 229 archivos y 215 llegaban CRLF a un clon en Windows, porque `.gitattributes` sólo pineaba
// `*.sh`. Eso rompe dos cosas a la vez: la cadena de decisiones de Discovery guarda el hash del
// predecesor —los mismos bytes tienen que llegar a toda máquina— y `verify-discovery-views` exige
// LF de forma explícita. Medido: `d002.json` era `{\n…` sha256 a3260e9f… en el árbol de trabajo y
// `{\r\n…` sha256 ef3d2077… en el clon, con el mismo commit.
//
// Estas pruebas no dependen de la plataforma: fuerzan `core.autocrlf=true` en un repositorio de
// juguete, así que el defecto se reproduce igual en Linux y en macOS.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio: leen archivos de la raiz del checkout que el instalador NO copia al
// proyecto de otra persona. Alla no aplican y ademas fallarian. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const CRLF = `${String.fromCharCode(13)}${String.fromCharCode(10)}`;
const HASHED_TREE = join('docs', 'discovery');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} falló: ${result.stderr}`);
  return result.stdout;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

/**
 * Arma un repositorio de juguete con los atributos que se le pasen y el árbol real que los gates
 * hashean, lo commitea, borra los archivos y los deja rematerializar por el pipeline de atributos
 * de git. Devuelve los que volvieron con CRLF. Es el mecanismo exacto de un `git clone`.
 */
function rematerialize(attributes) {
  const dir = mkdtempSync(join(tmpdir(), 'vcp-eol-'));
  try {
    writeFileSync(join(dir, '.gitattributes'), attributes, 'utf8');
    cpSync(join(repoRoot, HASHED_TREE), join(dir, HASHED_TREE), { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'core.autocrlf', 'true');
    git(dir, 'config', 'user.email', 'gate@vcp.local');
    git(dir, 'config', 'user.name', 'vcp');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'seed');
    for (const file of walk(join(dir, HASHED_TREE))) rmSync(file);
    git(dir, 'checkout', '-q', '--', '.');
    const files = walk(join(dir, HASHED_TREE)).sort();
    assert.ok(files.length > 0, 'el árbol de juguete quedó vacío: la prueba no midió nada');
    return {
      total: files.length,
      crlf: files.filter((file) => readFileSync(file, 'utf8').includes(CRLF))
        .map((file) => file.slice(dir.length + 1).split(sep).join('/')),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('un checkout con core.autocrlf=true materializa en LF todo lo que los gates hashean', SOLO_FUENTE, () => {
  const { total, crlf } = rematerialize(readFileSync(join(repoRoot, '.gitattributes'), 'utf8'));
  assert.deepEqual(crlf, [], `${crlf.length}/${total} archivo(s) volvieron con CRLF; la cadena de hashes de Discovery se rompe en cualquier clon:\n${crlf.join('\n')}`);
});

test('FALSIFICACIÓN · sin la regla de finales de línea, la sonda acusa el CRLF', SOLO_FUENTE, () => {
  // Sin esto, un cero arriba no distingue entre "el atributo funciona" y "la sonda no mira nada".
  const { total, crlf } = rematerialize('*.json text=auto\n*.md text=auto\n');
  assert.equal(crlf.length, total, 'la sonda no detectó el CRLF que el atributo permisivo produce');
});

test('la regla cubre todo el árbol trackeado, no sólo lo que ya rompió una vez', SOLO_FUENTE, () => {
  const tracked = git(repoRoot, 'ls-files').split('\n').filter(Boolean);
  assert.ok(tracked.length > 100, `git ls-files devolvió ${tracked.length} archivo(s): el barrido no miró el repositorio`);
  const attr = spawnSync('git', ['check-attr', '--stdin', 'eol'], { cwd: repoRoot, encoding: 'utf8', input: `${tracked.join('\n')}\n` });
  assert.equal(attr.status, 0, attr.stderr);
  const offenders = attr.stdout.split('\n').filter(Boolean).map((line) => {
    const path = line.slice(0, line.indexOf(': eol: '));
    const value = line.slice(line.indexOf(': eol: ') + 7).trim();
    const expected = path.endsWith('.ps1') ? 'crlf' : 'lf';
    return value === expected ? null : `${path} → eol=${value} (se esperaba ${expected})`;
  }).filter(Boolean);
  assert.deepEqual(offenders, [], `archivo(s) trackeado(s) sin final de línea pineado:\n${offenders.slice(0, 20).join('\n')}`);
});

/**
 * Un byte NUL crudo adentro de un archivo de texto hace que git lo clasifique `-text` y que grep
 * lo trate como binario. Medido el 2026-09-01: `grep -n "CONTROL_CHARACTERS"
 * scripts/verify-discovery-core.mjs` respondía `Binary file ... matches` y escondía la línea, así
 * que buscar en el código saltaba en silencio dos gates enteros. El mismo defecto ya se había
 * arreglado una vez en verify-vcp-coverage.mjs con `String.fromCharCode(0)`, que produce el mismo
 * byte en tiempo de ejecución sin escribirlo en el fuente.
 */
export function rawNulBytes(buffer) {
  return buffer.filter((byte) => byte === 0).length;
}

test('ningún archivo trackeado esconde código detrás de un byte NUL crudo', SOLO_FUENTE, () => {
  const tracked = git(repoRoot, 'ls-files').split(String.fromCharCode(10)).filter(Boolean);
  assert.ok(tracked.length > 100, `git ls-files devolvió ${tracked.length} archivo(s): el barrido no miró el repositorio`);
  const offenders = tracked
    .map((path) => ({ path, nul: rawNulBytes(readFileSync(join(repoRoot, path))) }))
    .filter((entry) => entry.nul > 0)
    .map((entry) => `${entry.path} → ${entry.nul} byte(s) NUL; escribilo como String.fromCharCode(0)`);
  assert.deepEqual(offenders, [], `git y grep tratan como binarios a:${String.fromCharCode(10)}${offenders.join(String.fromCharCode(10))}`);
});

test('FALSIFICACIÓN · el barrido de NUL distingue el byte crudo de su forma escrita', SOLO_FUENTE, () => {
  // Sin esto, un cero arriba no distingue entre "no hay NUL" y "el barrido no sabe buscarlos".
  assert.equal(rawNulBytes(Buffer.from(`a${String.fromCharCode(0)}b${String.fromCharCode(0)}`, 'utf8')), 2);
  // La forma escrita es la que se busca como reemplazo: son caracteres normales, no un NUL.
  assert.equal(rawNulBytes(Buffer.from('String.fromCharCode(0)', 'utf8')), 0);
  assert.equal(rawNulBytes(Buffer.from('sin nada raro', 'utf8')), 0);
});
