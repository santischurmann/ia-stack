// El gate que busca en lo versionado los nombres de una lista que el repositorio no conoce.
//
// Los nombres de estas pruebas son inventados (aves) a propósito: la regla que se prueba es que la
// lista de verdad no vive en ningún archivo versionado, y una prueba con un nombre real adentro
// sería la misma filtración con otra forma.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-private-names.mjs');
const {
  ARCHIVO_LOCAL, EMPTY, ENV_VAR, MIN_NOMBRE, USAGE, buscarEnTexto, main, parsearLista, plegar, unirListas,
} = await import(pathToFileURL(script).href);

const NL = String.fromCharCode(10);

/** Corre `main` con todo inyectado y devuelve código, salida y errores. */
function correr(args, options = {}) {
  const salida = [];
  const errores = [];
  const codigo = main(args, {
    env: {},
    leerLocal: () => { throw Object.assign(new Error('no existe'), { code: 'ENOENT' }); },
    trackedFiles: () => ['README.md'],
    leerBlob: () => Buffer.from('nada que ver' + NL, 'utf8'),
    write: (l) => salida.push(l),
    writeError: (l) => errores.push(l),
    ...options,
  });
  return { codigo, salida, errores, todo: [...salida, ...errores].join(NL) };
}

test('un uso inválido sale 2 y dice cómo se usa', () => {
  for (const args of [[], ['otra'], ['check', 'extra'], ['--require-inputs']]) {
    const r = correr(args);
    assert.equal(r.codigo, 2, JSON.stringify(args));
    assert.deepEqual(r.errores, [USAGE]);
  }
});

test('plegar no distingue mayúsculas ni tildes', () => {
  assert.equal(plegar('ÁLVAREZ Peña'), 'alvarez pena');
});

test('parsearLista toma un nombre por línea y se salta vacías y comentarios', () => {
  const texto = ['# comentario', 'Zorzal', '', '   ', '  Quetzal  ', '#otro'].join('\r\n');
  assert.deepEqual(parsearLista(texto), ['Zorzal', 'Quetzal']);
  assert.deepEqual(parsearLista(''), []);
});

test('unirListas pliega y no repite, y conserva el orden de aparición', () => {
  assert.deepEqual(unirListas(['Zorzal', 'Quetzal'], ['ZORZAL', 'Chingolo']), ['zorzal', 'quetzal', 'chingolo']);
});

test('buscarEnTexto da línea y posición del nombre, nunca el texto', () => {
  const texto = ['nada', 'un Zorzal pasó', 'y un QUETZAL también', 'zorzal otra vez'].join(NL);
  assert.deepEqual(buscarEnTexto(texto, ['zorzal', 'quetzal']), [
    { linea: 2, nombre: 1 },
    { linea: 3, nombre: 2 },
    { linea: 4, nombre: 1 },
  ]);
  assert.deepEqual(buscarEnTexto('limpio', ['zorzal']), []);
});

test('SIN LISTA el gate dice VACÍO y sale 0: un verde que no miró no se lee como limpio', () => {
  const r = correr(['check']);
  assert.equal(r.codigo, 0);
  assert.match(r.salida[0], new RegExp(`^${EMPTY}: `, 'u'));
  assert.match(r.salida[0], /NO afirma que el repositorio esté limpio/u);
});

test('SIN LISTA y con --require-inputs rechaza: no poder mirar no es estar limpio', () => {
  const r = correr(['check', '--require-inputs']);
  assert.equal(r.codigo, 1);
  assert.match(r.errores[0], /^REJECTED: no hay lista de nombres privados/u);
  assert.match(r.errores[0], new RegExp(ENV_VAR, 'u'));
});

test('un archivo local ilegible que no es «no existe» rechaza, no se confunde con ausente', () => {
  const r = correr(['check'], { leerLocal: () => { throw Object.assign(new Error('permiso denegado'), { code: 'EACCES' }); } });
  assert.equal(r.codigo, 1);
  assert.match(r.errores[0], /ilegible: permiso denegado/u);
});

test('la lista sale de la variable de entorno y del archivo local, y las dos suman', () => {
  const r = correr(['check'], {
    env: { [ENV_VAR]: 'Zorzal' },
    leerLocal: () => 'Quetzal' + NL,
    leerBlob: () => Buffer.from('un quetzal' + NL, 'utf8'),
  });
  assert.equal(r.codigo, 1);
  assert.match(r.errores[0], /README\.md, línea 1: contiene el nombre privado #2\./u, 'el del archivo local es el #2: primero el entorno');
});

test('un nombre demasiado corto rechaza sin repetir el nombre', () => {
  const r = correr(['check'], { env: { [ENV_VAR]: 'qz' } });
  assert.equal(r.codigo, 1);
  assert.match(r.errores[0], new RegExp(`el nombre #1 de la lista tiene menos de ${MIN_NOMBRE} caracteres`, 'u'));
  assert.ok(!r.todo.includes('qz'), 'no repite el nombre');
});

test('sin archivos rastreados dice VACÍO: una carpeta sin versionar no puede filtrar nada versionado', () => {
  const r = correr(['check'], { env: { [ENV_VAR]: 'Zorzal' }, trackedFiles: () => [] });
  assert.equal(r.codigo, 0);
  assert.match(r.salida[0], new RegExp(`^${EMPTY}: git no rastrea`, 'u'));
});

test('un repositorio sin rastro de la lista pasa y declara su límite', () => {
  const r = correr(['check'], { env: { [ENV_VAR]: 'Zorzal' } });
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida[0], /^OK: 1 archivo\(s\) versionado\(s\) revisado\(s\).*contra 1 nombre\(s\) privado\(s\)/u);
  assert.match(r.salida[1], /^LIMITE: /u);
});

test('un nombre en el contenido rechaza con archivo, línea y posición, sin repetir el nombre', () => {
  const r = correr(['check'], {
    env: { [ENV_VAR]: 'Zorzal Azul' },
    leerBlob: () => Buffer.from(['uno', 'el ZORZAL AZUL canta', 'tres'].join(NL), 'utf8'),
  });
  assert.equal(r.codigo, 1);
  assert.equal(r.errores[0], 'REJECTED: README.md, línea 2: contiene el nombre privado #1.');
  assert.match(r.errores[1], /^REJECTED: 1 hallazgo\(s\) en 1 archivo\(s\) versionado\(s\)\./u);
  assert.ok(!/zorzal/iu.test(r.todo), 'la salida no repite el nombre');
});

test('un nombre en la RUTA rechaza y el archivo se identifica por su posición, no por su ruta', () => {
  const r = correr(['check'], {
    env: { [ENV_VAR]: 'Zorzal' },
    trackedFiles: () => ['README.md', 'docs/notas-zorzal.md'],
    leerBlob: (ruta) => Buffer.from(ruta === 'README.md' ? 'limpio' : 'el zorzal en el texto', 'utf8'),
  });
  assert.equal(r.codigo, 1);
  assert.equal(r.errores[0], 'REJECTED: la ruta de el archivo #2 de git ls-files contiene el nombre privado #1.');
  assert.equal(r.errores[1], 'REJECTED: el archivo #2 de git ls-files, línea 1: contiene el nombre privado #1.');
  assert.ok(!/zorzal/iu.test(r.todo), 'ni el contenido ni la ruta se repiten');
});

test('lo binario no se lee como texto', () => {
  const r = correr(['check'], {
    env: { [ENV_VAR]: 'Zorzal' },
    leerBlob: () => Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('zorzal')]),
  });
  assert.equal(r.codigo, 0, r.todo);
  assert.match(r.salida[0], /^OK: 0 archivo\(s\)/u);
});

test('FALLA CERRADO: un archivo rastreado que no se puede leer rechaza y no repite el mensaje del sistema', () => {
  const r = correr(['check'], {
    env: { [ENV_VAR]: 'Zorzal' },
    leerBlob: () => { throw new Error('fatal: C:/algo/ruta/privada no existe'); },
  });
  assert.equal(r.codigo, 1);
  assert.match(r.errores[0], /^REJECTED: README\.md está rastreado y no se pudo leer/u);
  assert.ok(!r.todo.includes('ruta/privada'), 'el mensaje del sistema puede traer una ruta: no se repite');
});

/** Un repositorio git de verdad, para probar el camino que no se inyecta. */
function repoConArchivo(nombre, contenido) {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-nombres-'));
  const git = (...args) => spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  git('init', '-q', '.');
  mkdirSync(join(raiz, 'docs'), { recursive: true });
  writeFileSync(join(raiz, nombre), contenido, 'utf8');
  git('add', '-A');
  return raiz;
}

test('contra un repositorio git real: lee el blob que git publica y rechaza lo que encuentra', () => {
  const raiz = repoConArchivo('docs/nota.md', 'el Zorzal Azul' + NL);
  try {
    const r = spawnSync(process.execPath, [script, 'check'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, [ENV_VAR]: 'zorzal azul' } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /docs\/nota\.md, línea 1: contiene el nombre privado #1\./u);
    assert.ok(!/zorzal/iu.test(r.stdout + r.stderr), 'la salida real no repite el nombre');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('contra un repositorio git real y el archivo local: lo toma de .claude/ y pasa si no aparece', () => {
  const raiz = repoConArchivo('docs/nota.md', 'texto limpio' + NL);
  try {
    mkdirSync(join(raiz, '.claude'), { recursive: true });
    writeFileSync(join(raiz, ARCHIVO_LOCAL), 'Zorzal' + NL, 'utf8');
    const entorno = { ...process.env };
    delete entorno[ENV_VAR];
    const r = spawnSync(process.execPath, [script, 'check'], { cwd: raiz, encoding: 'utf8', env: entorno });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /contra 1 nombre\(s\) privado\(s\)/u);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('en una carpeta que no es un repositorio no hay nada que revisar y lo dice', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'ia-nombres-vacio-'));
  try {
    const r = spawnSync(process.execPath, [script, 'check'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, [ENV_VAR]: 'zorzal' } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`^${EMPTY}: git no rastrea`, 'u'));
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el archivo local no se puede versionar sin forzarlo: .claude/ está ignorado', () => {
  const raiz = repoConArchivo('docs/nota.md', 'x' + NL);
  try {
    writeFileSync(join(raiz, '.gitignore'), '.claude/' + NL, 'utf8');
    mkdirSync(join(raiz, '.claude'), { recursive: true });
    writeFileSync(join(raiz, ARCHIVO_LOCAL), 'Zorzal' + NL, 'utf8');
    const r = spawnSync('git', ['check-ignore', '-q', ARCHIVO_LOCAL], { cwd: raiz });
    assert.equal(r.status, 0, 'git tiene que ignorar la lista local');
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('el .gitignore de ESTE repositorio ignora la lista local', () => {
  const r = spawnSync('git', ['check-ignore', '-q', ARCHIVO_LOCAL], { cwd: repoRoot });
  assert.equal(r.status, 0, 'si la lista local no estuviera ignorada, un git add -A la publicaría');
});
