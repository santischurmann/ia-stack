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
import { dirname, join, relative, sep } from 'node:path';
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

// LA CARPETA DEL NOMBRE ANTERIOR, como la tiene todo proyecto que instalo antes del 2026-09-15. Los
// dos instaladores la mueven al archivo desde entonces, y ninguna prueba la habia plantado nunca: la
// rama que la poda no habia corrido una sola vez. Lo pidio la revision del 2026-09-26, con un
// proyecto real que todavia la tiene. Se planta entre las dos instalaciones que la prueba ya hace.
export const RUNTIME_ANTERIOR = join('.vibe', 'vcp-runtime');
// Dos niveles y la raiz: la prueba exige la carpeta ENTERA, y con un solo archivo no lo podia saber.
const PLANTADO_ANTERIOR = ['SKILL.md', 'scripts/gate-de-una-instalacion-anterior.mjs', 'contracts/viejo/contrato.json'];

// EL PUNTERO DE CODEX DEL NOMBRE ANTERIOR. Los instaladores de antes del rename dejaban en cada
// proyecto `.agents/skills/<nombre anterior>/SKILL.md`, apuntando a `.vibe/vcp-runtime/SKILL.md`.
// Mover el runtime sin moverlo dejaba a Codex con dos skills del protocolo, una rota. Lo encontro la
// revision del 2026-09-27, en el disco de un proyecto real que todavia tiene la instalacion vieja.
export const PUNTERO_ANTERIOR = '.agents/skills/vibecodeprotocols';

export function plantarRuntimeAnterior(project) {
  for (const rel of PLANTADO_ANTERIOR) {
    mkdirSync(dirname(join(project, RUNTIME_ANTERIOR, rel)), { recursive: true });
    writeFileSync(join(project, RUNTIME_ANTERIOR, rel), `// ${rel}, de una instalacion anterior al rename\n`);
  }
  mkdirSync(join(project, PUNTERO_ANTERIOR), { recursive: true });
  writeFileSync(join(project, PUNTERO_ANTERIOR, 'SKILL.md'), 'El protocolo vive en `.vibe/vcp-runtime/SKILL.md`.\n');
}

// UNA INSTALACION ANTERIOR, VERSIONADA. La tercera revision del 2026-09-27 encontro dos cosas que la
// prueba de arriba no ve, porque su proyecto no es un repositorio: si el puntero viejo estaba
// commiteado, moverlo deja un borrado en git -- y el instalador decia que podar no ensucia el arbol --;
// y el AGENTS.md que escribio el instalador viejo sigue apuntando a la carpeta que la poda acaba de
// mover, y solo se imprimia el aviso generico de «ya existe».
export const AGENTS_ANTERIOR = 'Leé el protocolo en `.vibe/vcp-runtime/SKILL.md` antes de operar.\n';

export function plantarInstalacionAnteriorVersionada(project) {
  const git = (...args) => spawnSync('git', ['-C', project, ...args], { encoding: 'utf8' });
  git('init', '-q');
  // El runtime viejo, commiteado: entre ee7d747 y a0ffaa8 (2026-08-23 a 08-28) el instalador lo
  // escribia sin regla de ignore, asi que un proyecto de esa semana puede tenerlo en su git.
  mkdirSync(join(project, RUNTIME_ANTERIOR), { recursive: true });
  writeFileSync(join(project, RUNTIME_ANTERIOR, 'SKILL.md'), '// el protocolo, instalado antes del rename\n');
  mkdirSync(join(project, PUNTERO_ANTERIOR), { recursive: true });
  writeFileSync(join(project, PUNTERO_ANTERIOR, 'SKILL.md'), 'El protocolo vive en `.vibe/vcp-runtime/SKILL.md`.\n');
  writeFileSync(join(project, 'AGENTS.md'), AGENTS_ANTERIOR);
  git('add', '-A');
  const commit = git('-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'instalacion anterior');
  assert.equal(commit.status, 0, `el fixture no pudo commitear la instalacion anterior: ${commit.stderr}`);
}

export function assertInstalacionAnteriorAvisada(project, salida) {
  assert.equal(existsSync(join(project, PUNTERO_ANTERIOR)), false, 'el puntero viejo se aparta aunque este versionado');
  assert.match(salida, /puntero estaba versionado/u, 'y se avisa que moverlo deja un borrado en git, para commitearlo');
  assert.equal(existsSync(join(project, RUNTIME_ANTERIOR)), false, 'la carpeta del runtime viejo se aparta aunque este versionada');
  assert.match(salida, /vcp-runtime estaba versionada/u, 'y se avisa su borrado igual que el del puntero');
  assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), AGENTS_ANTERIOR, 'AGENTS.md no se toca');
  assert.match(salida, /AGENTS\.md apunta a [^\n]*vcp-runtime/u, 'pero se avisa que apunta a la carpeta del nombre anterior');
}

// UN .gitignore SIN SALTO DE LINEA FINAL, que ya tiene la primera regla del instalador y termina en
// `.env`. El instalador de PowerShell pegaba el comentario de la regla siguiente a esa ultima linea:
// quedaba «.env# IA Stack: ...» y `.env` dejaba de ignorarse, sin aviso. El de bash ya miraba el
// ultimo byte. Lo encontro la cuarta revision del 2026-09-27; ninguna prueba armaba este archivo.
export function plantarGitignoreSinSaltoFinal(project) {
  writeFileSync(join(project, '.gitignore'), 'node_modules/\n.claude-archive/\n.env');
}

export function assertGitignoreIntacto(project) {
  const lineas = readFileSync(join(project, '.gitignore'), 'utf8').split(/\r?\n/u);
  assert.ok(lineas.includes('.env'), `la ultima regla del usuario tiene que seguir siendo una linea propia: ${JSON.stringify(lineas)}`);
  assert.ok(lineas.includes('.vibe/ia-stack-archive/') && lineas.includes('.vibe/ia-stack-runtime/'), `y las reglas del instalador, las suyas: ${JSON.stringify(lineas)}`);
}

function listado(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

export function assertRuntimeAnteriorApartado(project, salida) {
  assert.equal(existsSync(join(project, RUNTIME_ANTERIOR)), false, 'la carpeta del nombre anterior tiene que salir de .vibe');
  assert.equal(existsSync(join(project, PUNTERO_ANTERIOR)), false, 'y el puntero de Codex que apuntaba a ella tambien: si no, Codex ve dos skills del protocolo, una rota');
  assert.deepEqual(readdirSync(join(project, '.agents', 'skills')), ['ia-stack'], 'Codex tiene que ver una sola skill del protocolo');
  const archivo = join(project, '.vibe', 'ia-stack-archive');
  const fechas = existsSync(archivo) ? readdirSync(archivo) : [];
  const donde = fechas.find((fecha) => existsSync(join(archivo, fecha, 'vcp-runtime')));
  assert.ok(donde, `la carpeta tiene que MOVERSE al archivo. En ${archivo}: ${fechas.join(', ') || '(nada)'}`);
  // Con fecha Y hora, como los sobrantes: con la fecha sola, una segunda poda el mismo dia caia en
  // una carpeta que ya existia, y mover adentro de ella anidaba.
  assert.match(donde, /^\d{4}-\d{2}-\d{2}T\d{6}$/u, `el archivo tiene que llevar fecha y hora, no ${donde}`);
  assert.deepEqual(listado(join(archivo, donde, 'vcp-runtime')), [...PLANTADO_ANTERIOR].sort(), 'la carpeta tiene que quedar entera, con sus dos niveles');
  assert.equal(existsSync(join(archivo, donde, PUNTERO_ANTERIOR, 'SKILL.md')), true, 'el puntero viejo va al mismo archivo, conservando su ruta');
  assert.match(salida, /PODADO: /u, 'y tiene que decir que la movio');
  // El caso negativo: este proyecto no es un repositorio, asi que no hay borrado en git que avisar.
  assert.doesNotMatch(salida, /versionad/u, 'sin repositorio, avisar un borrado en git seria inventarlo');
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
  // EL DIRECTORIO DE SKILLS, ENTERO: la skill, su alias y las sub-skills, y nada mas. El instalador
  // de bash creaba ademas una carpeta vacia con el nombre anterior en cada instalacion, y ninguna
  // prueba lo veia: miraban que estuviera lo esperado, no que no hubiera nada de mas. El guarda del
  // nombre anterior tampoco, porque su excepcion para los temporales tapaba cualquier cosa que
  // empezara igual. Lo encontro la revision del 2026-09-26. El de PowerShell nunca la creo.
  assert.deepEqual(readdirSync(target).sort(), ['VibeCodeProtocols.md', 'ia-stack-skills', 'ia-stack.md'].sort(), 'el directorio de skills tiene algo de mas o de menos');
  assert.ok(readdirSync(join(target, 'ia-stack-skills')).length > 0, 'las sub-skills tienen que quedar en ia-stack-skills');
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
