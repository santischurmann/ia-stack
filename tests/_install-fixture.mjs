// _install-fixture.mjs — los ayudantes que comparten las dos mitades de la prueba de instalación.
//
// SE EXTRAJO, NO SE DUPLICÓ, por el mismo motivo que `_e2e-fixture.mjs` y `_receipt-fixture.mjs`:
// dos copias de los mismos ayudantes son dos cosas que se desincronizan, y `assertRuntime` es
// justamente lo que hace que las dos ramas de instalación tengan que producir lo MISMO. Si cada
// archivo tuviera su copia, una podría aflojarse sin que la otra se entere, y la prueba dejaría de
// decir «los dos instaladores producen el mismo runtime».
//
// POR QUÉ SE PARTIÓ. Lo encontró `scripts/verify-test-duration.mjs` en su primera corrida de verdad:
// el archivo entero oscilaba entre 96 y 111 s contra un tope de TAP de 120, corriendo SOLO, sin
// contención. Cada una de las dos pruebas instala el runtime COMPLETO dos veces —la segunda para
// comprobar que reinstalar no anida carpetas—, así que son cuatro instalaciones en un archivo. Una
// por archivo deja cada mitad cerca de la mitad del tiempo, y además separa dos cosas que no tienen
// por qué caer juntas: si el instalador de PowerShell se rompe, el de bash sigue contando.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolveBash } from './_entorno.mjs';

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// `resolveBash` y no la ruta de Git Bash escrita a mano. La constante vieja era una ruta de Windows,
// y la prueba de bash se salteaba con `!existsSync(esa ruta)`: en Linux eso da false y la prueba NO
// CORRÍA — justo en la plataforma donde `install.sh` es el único instalador que existe. Windows tenía
// las dos ramas cubiertas y Linux ninguna. Lo encontró `verify-platform-scope simetria` el
// 2026-09-17, en su primera corrida sobre la matriz del CI.
export const gitBash = resolveBash();
export const hayBash = process.platform !== 'win32' || existsSync(gitBash);
export const installSh = join(repoRoot, 'scripts', 'install.sh');
export const installPs = join(repoRoot, 'scripts', 'install.ps1');

export function run(command, args, options = {}) {
  const env = { ...process.env, ...options.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', env });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

export function toBash(path) {
  return path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
}

export function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcp-install-runtime-'));
  const project = join(root, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{}\n');
  return { root, project, target: join(root, 'skills'), runtime: join(root, 'runtime') };
}

// --- LA PODA Y EL SELLO, decididos por el operador el 2026-09-22 ---------------------------------
//
// El instalador copiaba encima y nunca podaba: en un proyecto real quedaron 15 archivos de mas tras
// reinstalar, y uno era un gate retirado con el que despues se sello un indice. Ahora reinstalar
// APARTA lo que el protocolo ya no tiene -- lo mueve al archivo, no lo borra -- y deja un sello con
// la fecha y el commit de origen. Las dos pruebas de instalacion ya instalan dos veces: el sobrante
// se planta entre las dos, asi que esto no agrega una sola instalacion.

export const SOBRANTE = join('scripts', 'gate-retirado-por-la-prueba.mjs');

/** Un archivo que una instalacion anterior dejo y el protocolo ya no tiene. */
export function plantarSobrante(project) {
  writeFileSync(join(project, '.vibe', 'ia-stack-runtime', SOBRANTE), '// un gate que el protocolo ya retiro\n');
}

export function assertApartado(project) {
  const runtime = join(project, '.vibe', 'ia-stack-runtime');
  assert.equal(existsSync(join(runtime, SOBRANTE)), false, 'reinstalar tiene que sacar del runtime lo que el protocolo ya no tiene');
  const archivo = join(project, '.vibe', 'ia-stack-archive');
  const fechas = existsSync(archivo) ? readdirSync(archivo) : [];
  assert.ok(
    fechas.some((fecha) => existsSync(join(archivo, fecha, 'ia-stack-runtime', SOBRANTE))),
    `y tiene que MOVERLO al archivo conservando la ruta, no borrarlo. En ${archivo}: ${fechas.join(', ') || '(nada)'}`,
  );
}

/** Mas sobrantes que archivos tiene el paquete: una poda que los moviera apartaria mas de la mitad
 * del runtime. El numero SE DERIVA del paquete y no se escribe: fijo, el dia que el protocolo creciera
 * la prueba pasaria a verde por el motivo equivocado -- la poda dejaria de ser desproporcionada --. */
export function plantarSobrantesDeMas(project) {
  let enElPaquete = 0;
  const contar = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.isDirectory()) contar(join(dir, entrada.name));
      else enElPaquete += 1;
    }
  };
  for (const dir of ['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents']) contar(join(repoRoot, dir));
  const destino = join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'de-mas');
  mkdirSync(destino, { recursive: true });
  const cuantos = enElPaquete + 1;
  for (let i = 0; i < cuantos; i += 1) writeFileSync(join(destino, `sobrante-${i}.mjs`), '');
  return cuantos;
}

export function assertNadaApartado(project, cuantos, salida) {
  const destino = join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'de-mas');
  assert.match(salida, /AVISO: la poda iba a apartar/u, 'tiene que decir por que no podo');
  assert.equal(readdirSync(destino).length, cuantos, 'la red de seguridad no tiene que mover NADA');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'pretooluse-red.mjs')), true, 'y el runtime sigue entero');
}

export function assertSellado(project) {
  const ruta = join(project, '.vibe', 'ia-stack-runtime', 'INSTALADO.json');
  assert.equal(existsSync(ruta), true, 'el runtime del proyecto tiene que quedar sellado');
  const sello = JSON.parse(readFileSync(ruta, 'utf8').replace(/^\uFEFF/u, ''));
  assert.equal(sello.schema, 'ia.runtime-instalado/1');
  assert.match(sello.instalado, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, `fecha ISO en UTC: ${sello.instalado}`);
  // Se instala desde ESTE repositorio, que es un checkout: tiene que nombrar su commit.
  assert.equal(sello.desde, 'checkout');
  assert.match(sello.commit, /^[0-9a-f]{40,64}$/u, `el commit de origen: ${sello.commit}`);
  assert.equal(typeof sello.arbol_limpio, 'boolean', 'y si el checkout tenia cambios sin commitear');
}

export function assertRuntime(project, target, runtime) {
  assert.equal(existsSync(join(target, 'VibeCodeProtocols.md')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-red-node.mjs')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-discovery-core.mjs')), true, 'runtime needs the I1 immutable Discovery verifier');
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-discovery-views.mjs')), true, 'runtime needs the I1.5 deterministic Discovery view verifier');
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-scope-diff.mjs')), true, 'runtime needs the scope-vs-diff gate');
  assert.equal(existsSync(join(runtime, 'contracts', 'discovery-requirements.json')), true, 'runtime needs the Discovery inventory contract');
  assert.equal(existsSync(join(runtime, 'contracts', 'discovery-phase-plan.json')), true, 'runtime needs the Discovery phase plan');
  assert.equal(existsSync(join(runtime, 'tests', 'verify-discovery-requirements.test.mjs')), true, 'runtime carries its I0 self-tests');
  assert.equal(existsSync(join(runtime, 'tests', 'verify-discovery-requirements-selftest.mjs')), true, 'runtime carries the non-recursive I0 gate self-test');
  assert.equal(existsSync(join(runtime, 'SECURITY.md')), true, 'runtime docs must carry the native security contract they reference');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'pretooluse-red.mjs')), true);
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'verify-discovery-core.mjs')), true, 'project runtime needs the I1 immutable Discovery verifier');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'verify-discovery-views.mjs')), true, 'project runtime needs the I1.5 deterministic Discovery view verifier');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'verify-scope-diff.mjs')), true, 'project runtime needs the scope-vs-diff gate');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'contracts', 'discovery-requirements.json')), true);
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'tests', 'verify-test-bindings.test.mjs')), true);
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'SECURITY.md')), true);
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'templates', 'vibe', 'COMPANY.md')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'scripts')), false, 'runtime must not nest scripts on reinstall');
  assert.equal(existsSync(join(runtime, 'contracts', 'contracts')), false, 'runtime must not nest contracts on reinstall');
  assert.equal(existsSync(join(runtime, 'tests', 'tests')), false, 'runtime must not nest tests on reinstall');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'scripts', 'scripts')), false, 'project runtime must not nest scripts on reinstall');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'contracts', 'contracts')), false, 'project runtime must not nest contracts on reinstall');
  assert.equal(existsSync(join(project, '.vibe', 'ia-stack-runtime', 'tests', 'tests')), false, 'project runtime must not nest tests on reinstall');
  const check = run(process.execPath, ['.vibe/ia-stack-runtime/scripts/verify-red-node.mjs'], { cwd: project });
  assert.equal(check.status, 2, check.output);
  const discovery = run(process.execPath, ['.vibe/ia-stack-runtime/scripts/verify-discovery-requirements.mjs', 'check', '--completed-phase', 'I0'], { cwd: project });
  assert.equal(discovery.status, 0, discovery.output);
  const sourceOnlyDiff = run(process.execPath, ['.vibe/ia-stack-runtime/scripts/verify-discovery-requirements.mjs', 'check', '--diff-against', 'HEAD'], { cwd: project });
  assert.equal(sourceOnlyDiff.status, 1, sourceOnlyDiff.output);
  assert.match(sourceOnlyDiff.output, /DISCOVERY_DIFF_RUNTIME_UNTRACKED/u);
}
