// _e2e-fixture.mjs — los ayudantes que comparten las dos mitades del recorrido de punta a punta.
//
// SE EXTRAJO, NO SE DUPLICO, por el mismo motivo que en las pruebas del recibo: dos copias de los
// mismos ayudantes son dos cosas que se desincronizan. Cada prueba de este recorrido instala un
// runtime completo en un proyecto temporal, y eso es lo que hacia que el archivo entero tardara
// 131 s contra un tope de 120 -- medido el 2026-09-16.

// Prueba de punta a punta del protocolo, sobre un proyecto que no existía hace un segundo.
//
// Existe porque dos defectos de esta misma sesión eran INVISIBLES desde el repo de VCP y sólo
// aparecieron mirando desde afuera: el instalador dejaba sus 114 archivos como superficie viva del
// proyecto ajeno (hallazgo 58), y la suite no estaba verde en un clon recién hecho (hallazgo 60).
// Las pruebas por gate no podían verlos, porque cada una mira su gate sobre fixtures que ella misma
// arma. Ésta mira el conjunto, en el orden real, sobre un proyecto vacío.
//
// LÍMITE HONESTO: recorre el camino feliz y el arranque en frío. NO simula una sesión completa con
// subagentes, ni el ciclo RED→GREEN sobre código real, ni un proyecto a medio llenar en cada
// combinación posible. Prueba que la instalación deja algo que funciona y que cada gate dice lo que
// corresponde cuando todavía no hay nada — que es exactamente donde se escondían los dos defectos.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REAL_SPAWN_TIMEOUT_MS } from './spawn-budget.mjs';

// Las dos mitades lo usan al llamar a los gates, asi que se reexporta desde aca.
export { REAL_SPAWN_TIMEOUT_MS };

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const RUNTIME = join('.vibe', 'ia-stack-runtime', 'scripts');
export const bash = process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
  ? 'C:\\Program Files\\Git\\bin\\bash.exe'
  : 'bash';

/** Un proyecto nuevo de verdad: repo git propio, un commit, y nada de VCP todavía. */
export function proyectoLimpio() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-e2e-'));
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '.');
  git('config', 'user.email', 'e2e@test');
  git('config', 'user.name', 'e2e');
  writeFileSync(join(root, 'README.md'), '# proyecto de prueba\n', 'utf8');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n', 'utf8');
  git('add', '-A');
  git('commit', '-q', '-m', 'inicial');
  return { root, git };
}

/** Traduce `C:\x\y` a `/c/x/y`: el argumento viaja adentro de un comando de bash, que interpreta
 * la barra invertida como escape. Mismo helper que `tests/install-runtime.test.mjs`. */
export function aBash(ruta) {
  return ruta.replace(/\\/g, '/').replace(/^([A-Za-z]):/u, (_, unidad) => `/${unidad.toLowerCase()}`);
}

/** El instalador escribe por defecto en `$HOME/.claude/skills` y `$HOME/.claude/ia-stack-runtime`
 * (install.sh:9-10), ANTES del bloque de `--project`: pasar sólo `--project` no suprime esa
 * escritura. Estas pruebas corrían el instalador siete veces por pasada contra el `$HOME` real de
 * quien corre la suite. Se aísla con los tres flags MÁS `HOME` sobrescrito —cinturón y tirantes,
 * por si el instalador expandiera `$HOME` en algún lugar nuevo—, que es el patrón que
 * `tests/install-runtime.test.mjs` ya usaba. Los destinos son hermanos del proyecto dentro del
 * mismo temporal, así que se limpian con el mismo `rmSync`. */
export function instalar(root) {
  const target = join(root, '__skills-aisladas');
  const runtime = join(root, '__runtime-aislado');
  const env = { ...process.env, HOME: aBash(root) };
  delete env.NODE_TEST_CONTEXT;
  const comando = `'${aBash(join(repoRoot, 'scripts', 'install.sh'))}'`
    + ` --target-dir '${aBash(target)}'`
    + ` --runtime-dir '${aBash(runtime)}'`
    + ` --project '${aBash(root)}'`;
  return spawnSync(bash, ['-lc', comando], { encoding: 'utf8', env });
}

export function gate(root, script, ...args) {
  const run = spawnSync(process.execPath, [join(root, RUNTIME, script), ...args], { cwd: root, encoding: 'utf8' });
  const salida = `${run.stdout}${run.stderr}`;
  const clase = run.status === 2 ? 'usage'
    : run.status !== 0 ? 'reject'
      : run.stdout.startsWith('VACÍO: ') || run.stdout.startsWith('VACIO: ') ? 'empty'
        : 'ok';
  return { status: run.status, clase, salida, primera: salida.split('\n')[0] };
}

export function conProyecto(accion) {
  const { root, git } = proyectoLimpio();
  try {
    return accion(root, git);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

