// El ejemplo es lo primero que copia alguien que llega al proyecto: si se desincroniza de las
// plantillas, ensena a saltear controles que el protocolo exige. Hasta el 2026-08-29 no lo miraba
// ningun gate ni ninguna prueba, y habia derivado: sin la seccion Discovery y sin tasks.json.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ejemplo = join(repoRoot, 'examples', 'example-feature');
const gate = (script, ...args) => spawnSync(process.execPath, [join(repoRoot, 'scripts', script), ...args], { cwd: repoRoot, encoding: 'utf8' });
const secciones = (texto) => [...texto.matchAll(/^## (.+)$/gmu)].map((m) => m[1].trim());

test('el ejemplo declara las mismas secciones que la plantilla de spec', () => {
  const plantilla = secciones(readFileSync(join(repoRoot, 'templates', 'spec.md'), 'utf8'));
  const propias = secciones(readFileSync(join(ejemplo, 'spec.md'), 'utf8'));
  const faltan = plantilla.filter((s) => !propias.includes(s));
  assert.deepEqual(faltan, [], `el ejemplo enseña una spec sin: ${faltan.join(', ')}`);
});

test('el ejemplo declara las mismas secciones que la plantilla de plan', () => {
  const plantilla = secciones(readFileSync(join(repoRoot, 'templates', 'plan.md'), 'utf8'));
  const propias = secciones(readFileSync(join(ejemplo, 'plan.md'), 'utf8'));
  const faltan = plantilla.filter((s) => !propias.includes(s));
  assert.deepEqual(faltan, [], `el ejemplo enseña un plan sin: ${faltan.join(', ')}`);
});

test('la spec del ejemplo cumple el tope de palabras que el protocolo exige', () => {
  const run = gate('verify-spec-wordcap.mjs', 'check', 'examples/example-feature/spec.md');
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

// Un ejemplo sin tasks.json ensena a saltear el preflight de conflictos de escritura, que es el
// unico control que impide que dos tareas se pisen sin orden declarado.
test('el ejemplo trae su tasks.json y pasa el preflight de conflictos', () => {
  const tareas = join(ejemplo, 'tasks.json');
  assert.ok(existsSync(tareas), 'un plan sin tasks.json no se puede verificar');
  const run = gate('verify-plan-conflicts.mjs', 'check', 'examples/example-feature/tasks.json');
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

test('cada tarea del plan del ejemplo existe en su tasks.json, y al revés', () => {
  const enPlan = [...readFileSync(join(ejemplo, 'plan.md'), 'utf8').matchAll(/^\| (T\d{2}) \|/gmu)].map((m) => m[1]);
  const enJson = JSON.parse(readFileSync(join(ejemplo, 'tasks.json'), 'utf8')).tasks.map((t) => t.id);
  assert.deepEqual(enPlan.slice().sort(), enJson.slice().sort(), 'el plan y el inventario de tareas describen features distintas');
});
