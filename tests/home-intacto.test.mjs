// Correr la suite no puede tocar el `~/.claude` de quien la corre.
//
// `scripts/install.sh` escribe por defecto en `$HOME/.claude/skills` y `$HOME/.claude/vcp-runtime`
// (lineas 9-10), y lo hace ANTES del bloque `if [ -n "$PROJECT_DIR" ]`: pasar `--project` no
// reemplaza ni suprime esa escritura. Dos pruebas invocaban el instalador con `--project` solo, y
// entre las dos ejecutaban el instalador ocho veces por pasada. Resultado: `git clone && node --test`
// le sobrescribia a cualquiera su configuracion global de Claude Code. Verificado por mtime.
//
// Esta comprobacion mide el DANO, no la intencion: toma una huella del arbol real antes y despues
// de correr las pruebas que invocan el instalador, y falla si algo cambio.
//
// LO QUE ESTA COMPROBACION NO PUEDE VER, dicho de frente:
//   - Distingue ESCRIBIR de LEER, y solo prohibe escribir. La suite lee `~/.claude` a proposito:
//     `verify-ablation.mjs` expande `~/` para comprobar una ablacion real. Eso se queda.
//   - Una escritura que deje el archivo byte a byte igual Y con el mismo mtime es invisible.
//     No es un caso realista de este defecto -- el instalador copia archivos distintos -- pero es
//     un hueco real y por eso esta escrito.
//   - Solo mira `~/.claude`. Una escritura en otro lugar del home no la agarra.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Las pruebas que invocan al instalador. Se nombran a proposito y no se descubren por barrido:
// correr la suite entera adentro de una prueba de la suite entera no termina nunca.
export const INVOCAN_AL_INSTALADOR = Object.freeze([
  'tests/protocolo-e2e.test.mjs',
  'tests/verify-runtime-sync.test.mjs',
  'tests/install-runtime.test.mjs',
]);

/** Huella de un arbol: ruta relativa -> tamano y mtime. Un directorio aporta su nombre y nada mas,
 * asi que crear uno vacio tambien se ve. */
export function huella(raiz, { hay = existsSync, listar = readdirSync, medir = statSync } = {}) {
  if (!hay(raiz)) return new Map();
  const salida = new Map();
  const pendientes = [''];
  while (pendientes.length > 0) {
    const relativo = pendientes.pop();
    const absoluto = relativo === '' ? raiz : join(raiz, relativo);
    for (const entrada of listar(absoluto, { withFileTypes: true })) {
      const hijo = relativo === '' ? entrada.name : `${relativo}/${entrada.name}`;
      if (entrada.isDirectory()) {
        salida.set(`${hijo}/`, 'dir');
        pendientes.push(hijo);
        continue;
      }
      const s = medir(join(raiz, hijo));
      salida.set(hijo, `${s.size}:${s.mtimeMs}`);
    }
  }
  return salida;
}

/** Que cambio entre dos huellas, en el lenguaje de quien lee el fallo. */
export function diferencias(antes, despues) {
  const cambios = [];
  for (const [ruta, valor] of despues) {
    if (!antes.has(ruta)) { cambios.push(`creado: ${ruta}`); continue; }
    if (antes.get(ruta) !== valor) cambios.push(`modificado: ${ruta}`);
  }
  for (const ruta of antes.keys()) if (!despues.has(ruta)) cambios.push(`borrado: ${ruta}`);
  return cambios.sort();
}

/** Los destinos que el propio instalador declara por defecto, leidos de `install.sh`. No es una
 * lista escrita a mano: si manana el instalador cambia su default, esta comprobacion lo sigue.
 * Se acota a esos dos subarboles a proposito -- `~/.claude` entero incluye `projects/` y `backups/`,
 * que el propio Claude Code reescribe mientras la suite corre, y vigilarlos daria rojos que no son
 * de nadie. */
export function destinosDelInstalador(texto) {
  const rutas = [];
  for (const m of texto.matchAll(/^(?:TARGET_DIR|RUNTIME_DIR)="\$HOME\/([^"]+)"/gmu)) rutas.push(m[1]);
  return rutas;
}

/** Toda invocacion al instalador desde una prueba tiene que aislar sus destinos. Es una regla de
 * FORMA: no mide el dano, mide que nadie pueda causarlo. Corre siempre y es instantanea. */
export function invocacionesSinAislar(leer = readFileSync, listar = readdirSync, dir = join(repoRoot, 'tests')) {
  const sueltas = [];
  for (const nombre of listar(dir).filter((f) => f.endsWith('.test.mjs'))) {
    // La regla es POR ARCHIVO, no por llamada. Intenté por llamada con una ventana de líneas y
    // marcaba el ayudante genérico `run()` de install-runtime.test.mjs sólo porque una constante
    // cercana nombraba al instalador: un falso positivo que obligaría a reescribir código correcto.
    // LÍMITE, dicho: un archivo que aísle una invocación y deje otra suelta pasa esta regla. Lo que
    // cubre ese hueco es la comprobación de daño de más abajo, que mide el efecto y no la forma.
    const codigo = leer(join(dir, nombre), 'utf8').split('\n')
      .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/u.test(l))
      .join('\n');
    // Tiene que LANZAR un shell, no sólo mencionar el instalador: este mismo archivo lo lee para
    // sacarle sus destinos por defecto y no lo invoca nunca. `-lc` es bash; `-File`, PowerShell.
    if (!/'-lc'|"-lc"|'-File'|"-File"/u.test(codigo)) continue;
    if (!/install\.(?:sh|ps1)/u.test(codigo)) continue;
    if (/--target-dir|-TargetDir/u.test(codigo)) continue;
    sueltas.push(nombre);
  }
  return sueltas;
}

test('ninguna prueba invoca al instalador sin aislar sus destinos', () => {
  assert.deepEqual(invocacionesSinAislar(), [], 'sin --target-dir el instalador escribe en el $HOME de quien corre la suite');
});

test('FALSIFICACIÓN · la regla de forma distingue una invocación aislada de una suelta', () => {
  const listar = () => ['a.test.mjs', 'b.test.mjs'];
  const leer = (ruta) => (String(ruta).includes('a.test')
    ? "spawnSync(bash, ['-lc', `'${sh}/install.sh' --project '${root}'`])"
    : [
      "const comando = `'${sh}/install.sh' --target-dir '${t}'`;",
      "spawnSync(bash, ['-lc', comando]);",
    ].join('\n'));
  const r = invocacionesSinAislar(leer, listar, 'x');
  assert.equal(r.length, 1, `esperaba sólo la suelta, salió: ${JSON.stringify(r)}`);
  assert.equal(r[0], 'a.test.mjs');
});

// La comprobación de DAÑO real. Lanza una corrida anidada de las tres pruebas que invocan al
// instalador y compara el árbol antes y después. Es la única que mide el efecto y no la forma,
// pero tarda ~200 s y, dentro de la suite completa, compite consigo misma: lanza otra vez archivos
// que la suite ya está corriendo, y la contención hace fallar a las vecinas. Por eso se pide
// explícitamente con `VCP_HOME_GUARD=1`, y por eso la regla de forma de arriba corre siempre.
// LÍMITE: mientras no se pida, el daño no se mide — sólo se comprueba que la forma lo impida.
test('el daño real: correr las pruebas que invocan al instalador no toca ~/.claude', (t) => {
  if (process.env.VCP_HOME_GUARD !== '1') {
    t.skip('comprobación de daño: pedila con VCP_HOME_GUARD=1 (tarda ~200 s y compite con la suite)');
    return;
  }
  const instalador = readFileSync(join(repoRoot, 'scripts', 'install.sh'), 'utf8');
  const destinos = destinosDelInstalador(instalador);
  assert.ok(destinos.length >= 2, `no se pudieron leer los destinos por defecto de install.sh: ${JSON.stringify(destinos)}`);
  const fotografiar = () => new Map(destinos.flatMap(
    (d) => [...huella(join(homedir(), d))].map(([k, v]) => [`${d}/${k}`, v]),
  ));
  const antes = fotografiar();
  // `NODE_TEST_CONTEXT` se borra a proposito. Heredada, el hijo se cree parte de la corrida del
  // padre y no ejecuta las pruebas: la primera version de esta comprobacion daba VERDE en 3
  // segundos sin haber corrido nada. Un comando que no corrio no es un verde. El patron esta
  // tomado de `tests/install-runtime.test.mjs`, que ya borraba esta variable por la misma razon.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const corrida = spawnSync(process.execPath, ['--test', ...INVOCAN_AL_INSTALADOR], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    timeout: 600_000,
  });
  // Si no llego a terminar, no se pudo verificar -- que no es lo mismo que haber pasado.
  assert.equal(corrida.error, undefined, `las pruebas no llegaron a terminar: ${corrida.error?.code}`);
  const cambios = diferencias(antes, fotografiar());
  assert.deepEqual(cambios, [], 'correr la suite le modificó a quien la corre su configuración global de Claude Code');
});

test('FALSIFICACIÓN · la huella ve crear, modificar y borrar, y un árbol ausente no rompe', () => {
  const base = new Map([['a.md', '10:100'], ['sub/', 'dir'], ['sub/b.md', '20:200']]);
  assert.deepEqual(diferencias(base, base), []);
  assert.deepEqual(diferencias(base, new Map([...base, ['c.md', '1:1']])), ['creado: c.md']);
  assert.deepEqual(diferencias(base, new Map([...base, ['a.md', '10:999']])), ['modificado: a.md']);
  const sinB = new Map(base); sinB.delete('sub/b.md');
  assert.deepEqual(diferencias(base, sinB), ['borrado: sub/b.md']);
  // Un home sin ~/.claude devuelve una huella vacía en vez de explotar.
  assert.deepEqual([...huella('/no/existe', { hay: () => false })], []);
});

test('FALSIFICACIÓN · la huella recorre subdirectorios y no sólo el nivel de arriba', () => {
  const arbol = {
    '/raiz': [{ name: 'skills', isDirectory: () => true }, { name: 'top.md', isDirectory: () => false }],
    '/raiz/skills': [{ name: 'hondo.md', isDirectory: () => false }],
  };
  const h = huella('/raiz', {
    hay: () => true,
    listar: (d) => arbol[String(d).replaceAll('\\', '/')] ?? [],
    medir: () => ({ size: 1, mtimeMs: 2 }),
  });
  assert.deepEqual([...h.keys()].sort(), ['skills/', 'skills/hondo.md', 'top.md']);
});
