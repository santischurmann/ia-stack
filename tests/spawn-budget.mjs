import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));

/**
 * Presupuesto de tiempo para la evidencia que lanza un proceso de verdad.
 *
 * Medición real en esta máquina (2026-09-01, 30 muestras por tanda), cronometrando
 * `spawnSync(node, ['-e', 'process.exit(0)'])` con N procesos node compitiendo por CPU —
 * las mismas condiciones que `node --test --test-concurrency=32`:
 *
 *   carga  0 → p50 33.9ms · p90   39.3ms · max  103.7ms · 0/30  por encima de 1000ms
 *   carga 32 → p50 43.9ms · p90 2631.5ms · max 4895.4ms · 4/30 (13%) por encima de 1000ms
 *
 * Un presupuesto de 1000ms cae DENTRO de esa banda de ruido. La evidencia salía `failed` con
 * `timed_out: true` por falta de tiempo, no porque el comando fallara, y el `check
 * --require-complete` la rechazaba con razón. Efecto medido sobre la suite completa:
 * 2 de cada 5 corridas de `node --test --test-concurrency=32` salían rojas.
 *
 * El valor elegido no es nuevo en el proyecto: `scripts/verify-discovery-requirements.mjs:350`
 * ya usa 30_000ms para lanzar una suite entera.
 */
export const MEASURED_WORST_CASE_MS = 4896;

/** Presupuesto para toda petición de evidencia que lance un proceso real. */
export const REAL_SPAWN_TIMEOUT_MS = 30_000;

/**
 * Los dos únicos números literales que un archivo de pruebas puede escribir como presupuesto,
 * porque el presupuesto ES lo que la prueba examina y no puede venir de una constante compartida:
 *   0 → presupuesto inválido, para comprobar que `validateRequest` lo rechaza.
 *   1 → presupuesto imposible a propósito, para forzar el camino de timeout.
 */
export const INTENTIONAL_BUDGET_LITERALS = Object.freeze([0, 1]);

/**
 * Los dos archivos de la guardia se excluyen porque sus fixtures escriben presupuestos a ojo A
 * PROPÓSITO: son la entrada con la que se comprueba que el escáner acusa. Toda otra exclusión
 * sería un agujero, así que no hay lista de exentos: la guardia mira el árbol entero de pruebas.
 */
export const GUARD_OWN_FILES = Object.freeze(['spawn-budget.mjs', 'spawn-budget.test.mjs']);

/**
 * Todo archivo de pruebas del proyecto, descubierto al momento y no escrito a mano. Una lista fija
 * envejece: el archivo de pruebas que alguien agregue mañana con un presupuesto a ojo no estaría
 * en ella, y la guardia daría verde sin haber mirado.
 */
export function guardedTestFiles(dir = testsDir, readDirectory = readdirSync) {
  return [...readDirectory(dir)]
    .filter((name) => name.endsWith('.mjs') && !GUARD_OWN_FILES.includes(name))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * Devuelve todo presupuesto escrito como número literal que no esté en la lista de intencionales.
 * Un literal fuera de esa lista es un presupuesto a ojo: puede quedar por debajo de la latencia
 * real de spawn y convertir una corrida lenta en evidencia roja.
 */
export function literalBudgetViolations(source, intentional = INTENTIONAL_BUDGET_LITERALS) {
  const allowed = new Set(intentional);
  const violations = [];
  const pattern = new RegExp(String.raw`timeout_ms\s*:\s*(-?\d[\d_]*)`, 'gu');
  for (const match of source.matchAll(pattern)) {
    const value = Number(match[1].replaceAll('_', ''));
    if (allowed.has(value)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    violations.push({ line, value });
  }
  return violations;
}
