// El gate de cobertura mide `scripts/` y nada más. Ese recorte era invisible: nada lo declaraba y el
// README hablaba de "los scripts Node de VCP", que también son los de `research/`. Un denominador
// que no se declara se lee como si fuera todo.
//
// Esta guardia no mide cobertura: comprueba que ningún archivo Node del repositorio quede fuera del
// contrato sin que alguien lo haya escrito. Un directorio nuevo con `.mjs` adentro no puede aparecer
// en silencio ni del lado medido ni del excluido.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { esRuntimeInstalado } from './_entorno.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Self-checks del repositorio de VCP: le preguntan a git o a un gate por ESTE checkout. Adentro del
// runtime instalado de otra persona no tienen nada que afirmar -- y ademas el instalador gitignora
// el runtime, asi que git no puede contestar. Se saltean DICIENDO por que.
const SOLO_FUENTE = esRuntimeInstalado(repoRoot)
  ? { skip: 'runtime instalado: self-check del repositorio de VCP, no del proyecto de quien instala' }
  : {};

const contract = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'coverage-scope.json'), 'utf8'));
const { listMjsScripts } = await import(pathToFileURL(join(repoRoot, 'scripts', 'verify-ia-stack-coverage.mjs')).href);

const MIN_REASON = 60;
/**
 * Los archivos Node que forman parte del repositorio AHORA: los trackeados mas los que existen sin
 * trackear y que .gitignore no excluye. Mirar solo los trackeados dejaba un hueco de tiempo real:
 * un script recien escrito lo mide el gate pero git todavia no lo ve, asi que la comparacion
 * fallaba sobre trabajo en curso en vez de sobre un problema. Los ignorados quedan afuera a
 * proposito: no son del repositorio.
 */
const repoMjs = () => {
  const run = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.mjs'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return [...new Set(run.stdout.split(String.fromCharCode(10)).filter(Boolean))];
};

test('el contrato declara su esquema y una razón real por cada directorio', () => {
  assert.equal(contract.schema, 'ia.coverage-scope/1');
  assert.ok(contract.why.length >= MIN_REASON, 'el contrato tiene que decir por qué existe');
  const todos = [...contract.measured, ...contract.excluded];
  assert.ok(todos.length > 0, 'un contrato vacío declara un denominador vacío');
  for (const entrada of todos) {
    // DOS FORMAS desde el 2026-09-16: un árbol entero por `directory`, o archivos sueltos por
    // `files`. La segunda existe porque research/ es mitad y mitad, y sin ella habría que elegir
    // entre medirlo todo o no medir nada. Las dos exigen lo mismo: una forma válida y un motivo.
    const nombre = entrada.directory ?? (entrada.files ?? []).join(', ');
    if (entrada.directory === undefined) {
      assert.ok(Array.isArray(entrada.files) && entrada.files.length > 0, `entrada sin directory tiene que traer files: ${JSON.stringify(entrada)}`);
      for (const archivo of entrada.files) {
        assert.match(archivo, /^[a-z][a-z0-9-]*\/[^\\]+\.mjs$/u, `archivo con forma inesperada: ${archivo}`);
      }
    } else {
      assert.match(entrada.directory, /^[a-z][a-z0-9-]*$/u, `directorio con forma inesperada: ${entrada.directory}`);
    }
    assert.ok(typeof entrada.why === 'string' && entrada.why.trim().length >= MIN_REASON,
      `${nombre}: la razón es demasiado corta para ser una razón`);
  }
  const nombres = todos.map((entrada) => entrada.directory).filter(Boolean);
  assert.equal(new Set(nombres).size, nombres.length, 'un directorio no puede estar medido y excluido a la vez');
  // Un archivo suelto medido NO puede estar dentro de un directorio ya medido: se contaría dos veces.
  const medidosDir = new Set(contract.measured.map((e) => e.directory).filter(Boolean));
  for (const archivo of contract.measured.flatMap((e) => e.files ?? [])) {
    assert.equal(medidosDir.has(archivo.split('/')[0]), false, `${archivo} ya está cubierto por su directorio medido`);
  }
});

test('cada exclusión con deuda la escribe, y ninguna sin deuda la finge', () => {
  // Sin esto, `debt: true` sería una etiqueta: acá tiene que venir con el detalle de qué queda sin
  // probar, porque una deuda que no se nombra no se paga.
  for (const entrada of contract.excluded) {
    assert.equal(typeof entrada.debt, 'boolean', `${entrada.directory}: debt tiene que ser booleano`);
    if (entrada.debt) {
      assert.ok(typeof entrada.debt_detail === 'string' && entrada.debt_detail.trim().length >= MIN_REASON,
        `${entrada.directory}: declara deuda sin decir cuál`);
    } else {
      assert.equal(entrada.debt_detail, undefined, `${entrada.directory}: detalla una deuda que dice no tener`);
    }
  }
});

test('ningún archivo Node del repositorio queda fuera del contrato', SOLO_FUENTE, () => {
  const archivos = repoMjs();
  assert.ok(archivos.length > 50, `git ls-files devolvió ${archivos.length} archivo(s): el barrido no miró el repositorio`);
  const declarados = new Set([...contract.measured, ...contract.excluded].map((entrada) => entrada.directory));
  const huerfanos = [...new Set(archivos.map((archivo) => archivo.split('/')[0]))].filter((dir) => !declarados.has(dir));
  assert.deepEqual(huerfanos, [], `directorio(s) con archivos .mjs que el contrato de alcance no menciona: ${huerfanos.join(', ')}`);
});

test('lo que el gate inventaría es exactamente lo que el contrato declara medido', SOLO_FUENTE, () => {
  // Si el inventario y el contrato se separan, el contrato pasa a describir algo que no ocurre.
  // Desde el 2026-09-16 el contrato habla de directorios Y de archivos sueltos, porque los cuatro
  // verificadores de research/ se miden y el resto de research/ no.
  const dirs = new Set(contract.measured.map((entrada) => entrada.directory).filter(Boolean));
  const sueltos = new Set(contract.measured.flatMap((entrada) => entrada.files ?? []));
  const inventario = listMjsScripts(repoRoot);
  assert.ok(inventario.length > 0, 'el inventario del gate salió vacío');
  for (const archivo of inventario) {
    assert.ok(dirs.has(archivo.split('/')[0]) || sueltos.has(archivo), `el gate mide ${archivo}, que el contrato no declara medido`);
  }
  const delRepoMedidos = repoMjs().filter((archivo) => dirs.has(archivo.split('/')[0]) || sueltos.has(archivo));
  assert.deepEqual(inventario.slice().sort(), delRepoMedidos.slice().sort(),
    'el gate y git no ven el mismo conjunto de archivos medidos');
});

test('cada archivo suelto que el contrato declara medido existe de verdad', SOLO_FUENTE, () => {
  // Un contrato que nombra un archivo que no esta deja el denominador mas chico de lo que dice, y
  // eso sube la cobertura sin que nadie escriba una prueba.
  const sueltos = contract.measured.flatMap((entrada) => entrada.files ?? []);
  assert.ok(sueltos.length > 0, 'el contrato no declara ningún archivo suelto medido');
  const enGit = new Set(repoMjs());
  for (const archivo of sueltos) assert.ok(enGit.has(archivo), `${archivo} está declarado medido y git no lo tiene`);
});
