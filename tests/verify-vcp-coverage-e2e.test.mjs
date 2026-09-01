// El gate de cobertura vigila a todos los demás, así que un verde suyo se propaga. Estas pruebas lo
// miden de punta a punta contra un proyecto real y chiquito: correr la suite, leer la medición,
// decidir. No alcanza con probar cada pieza por separado — el 2026-09-01 se midió que el gate
// declaraba 30/30 a 100 % sobre un árbol donde 6 funciones o ramas no las ejecutaba ningún proceso.
//
// Un proyecto de juguete es la única forma de comprobar el veredicto de los dos lados: con la rama
// cubierta y sin cubrir. Sobre el propio repositorio sólo se puede observar el lado verde.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, 'scripts', 'verify-vcp-coverage.mjs');
const { main, runCoverage } = await import(pathToFileURL(script).href);

const DEMO = 'export function demo(x) {\n  if (x) return 1;\n  return 2;\n}\n';
const suite = (body) => [
  "import assert from 'node:assert/strict';",
  "import test from 'node:test';",
  "import { demo } from '../scripts/demo.mjs';",
  body,
  '',
].join('\n');

function toyProject(testBody) {
  const root = mkdtempSync(join(tmpdir(), 'vcp-cov-e2e-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'scripts', 'demo.mjs'), DEMO, 'utf8');
  writeFileSync(join(root, 'tests', 'demo.test.mjs'), suite(testBody), 'utf8');
  return root;
}

function runGate(root) {
  const out = [];
  const err = [];
  const code = main([], runCoverage, (line) => out.push(line), (line) => err.push(line), root);
  return { code, out, err };
}

test('el gate mide el proyecto que le pasan, no el suyo', () => {
  // `main` recibe un cwd y `listMjsScripts` lo respeta. Si la medición no lo respeta también, el
  // gate inventaría los scripts de un proyecto y mide la cobertura de otro: el veredicto no habla
  // de ningún árbol en particular.
  const root = toyProject("test('ambas ramas', () => { assert.equal(demo(1), 1); assert.equal(demo(0), 2); });");
  try {
    const { code, out, err } = runGate(root);
    assert.equal(code, 0, err.join(' || '));
    assert.match(out.at(-1) ?? '', /^OK: /u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('FALSIFICACIÓN · con una rama que nadie ejecutó, el gate la nombra con archivo y línea', () => {
  // La mitad que importa. Un gate que sólo informa un porcentaje no dice QUÉ falta, y un porcentaje
  // fusionado entre procesos puede dar 100 % sobre una rama que nadie corrió.
  const root = toyProject("test('una sola rama', () => { assert.equal(demo(1), 1); });");
  try {
    const { code, err } = runGate(root);
    assert.equal(code, 1, 'el gate aceptó un árbol con una rama sin ejecutar');
    // V8 nombra la rama por donde empieza el bloque implícito —la línea del `if`—, no la del
    // `return` que quedó sin correr. El gate reporta lo que V8 nombra, sin reinterpretarlo.
    const mensaje = err.join(String.fromCharCode(10)).split(sep).join('/');
    assert.ok(mensaje.includes('scripts/demo.mjs:2 (rama demo)'), mensaje);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
