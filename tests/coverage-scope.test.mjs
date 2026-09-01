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

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contract = JSON.parse(readFileSync(join(repoRoot, 'contracts', 'coverage-scope.json'), 'utf8'));
const { listMjsScripts } = await import(pathToFileURL(join(repoRoot, 'scripts', 'verify-vcp-coverage.mjs')).href);

const MIN_REASON = 60;
const trackedMjs = () => {
  const run = spawnSync('git', ['ls-files', '*.mjs'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.split(String.fromCharCode(10)).filter(Boolean);
};

test('el contrato declara su esquema y una razón real por cada directorio', () => {
  assert.equal(contract.schema, 'vcp.coverage-scope/1');
  assert.ok(contract.why.length >= MIN_REASON, 'el contrato tiene que decir por qué existe');
  const todos = [...contract.measured, ...contract.excluded];
  assert.ok(todos.length > 0, 'un contrato vacío declara un denominador vacío');
  for (const entrada of todos) {
    assert.match(entrada.directory, /^[a-z][a-z0-9-]*$/u, `directorio con forma inesperada: ${entrada.directory}`);
    assert.ok(typeof entrada.why === 'string' && entrada.why.trim().length >= MIN_REASON,
      `${entrada.directory}: la razón es demasiado corta para ser una razón`);
  }
  const nombres = todos.map((entrada) => entrada.directory);
  assert.equal(new Set(nombres).size, nombres.length, 'un directorio no puede estar medido y excluido a la vez');
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

test('ningún archivo Node del repositorio queda fuera del contrato', () => {
  const archivos = trackedMjs();
  assert.ok(archivos.length > 50, `git ls-files devolvió ${archivos.length} archivo(s): el barrido no miró el repositorio`);
  const declarados = new Set([...contract.measured, ...contract.excluded].map((entrada) => entrada.directory));
  const huerfanos = [...new Set(archivos.map((archivo) => archivo.split('/')[0]))].filter((dir) => !declarados.has(dir));
  assert.deepEqual(huerfanos, [], `directorio(s) con archivos .mjs que el contrato de alcance no menciona: ${huerfanos.join(', ')}`);
});

test('lo que el gate inventaría es exactamente lo que el contrato declara medido', () => {
  // Si el inventario y el contrato se separan, el contrato pasa a describir algo que no ocurre.
  const medidos = new Set(contract.measured.map((entrada) => entrada.directory));
  const inventario = listMjsScripts(repoRoot);
  assert.ok(inventario.length > 0, 'el inventario del gate salió vacío');
  for (const archivo of inventario) {
    assert.ok(medidos.has(archivo.split('/')[0]), `el gate mide ${archivo}, que el contrato no declara medido`);
  }
  const trackeadosMedidos = trackedMjs().filter((archivo) => medidos.has(archivo.split('/')[0]));
  assert.deepEqual(inventario.slice().sort(), trackeadosMedidos.slice().sort(),
    'el gate y git no ven el mismo conjunto de archivos medidos');
});
