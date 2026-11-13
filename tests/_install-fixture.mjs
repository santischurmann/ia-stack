// _install-fixture.mjs — los ayudantes que comparten las dos mitades de la prueba de instalación.
//
// SE EXTRAJO, NO SE DUPLICÓ, por el mismo motivo que `_e2e-fixture.mjs` y `_receipt-fixture.mjs`:
// dos copias de los mismos ayudantes son dos cosas que se desincronizan, y `assertRuntime` es
// justamente lo que hace que las dos ramas de instalación tengan que producir lo MISMO. Si cada
// archivo tuviera su copia, una podría aflojarse sin que la otra se entere, y la prueba dejaría de
// decir «los dos instaladores producen el mismo runtime».
//
// POR QUÉ SE PARTIÓ. Lo encontró un gate de duración de pruebas en su primera corrida de verdad:
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
import { createHash } from 'node:crypto';

import { resolveBash } from './_entorno.mjs';

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// `resolveBash` y no la ruta de Git Bash escrita a mano. La constante vieja era una ruta de Windows,
// y la prueba de bash se salteaba con `!existsSync(esa ruta)`: en Linux eso da false y la prueba NO
// CORRÍA — justo en la plataforma donde `install.sh` es el único instalador que existe. Windows tenía
// las dos ramas cubiertas y Linux ninguna. Lo encontró `verify-platform-scope simetria`
// en su primera corrida sobre la matriz del CI.
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
  const root = mkdtempSync(join(tmpdir(), 'ia-install-runtime-'));
  const project = join(root, 'project');
  mkdirSync(project);
  writeFileSync(join(project, 'package.json'), '{}\n');
  return { root, project, target: join(root, 'skills'), runtime: join(root, 'runtime') };
}

// --- LA PODA Y EL SELLO ----------------------------------------------------------
//
// El instalador copiaba encima y nunca podaba: en un proyecto real quedaron 15 archivos de mas tras
// reinstalar, y uno era un gate retirado con el que despues se sello un indice. Ahora reinstalar
// APARTA lo que el protocolo ya no tiene -- lo mueve al archivo, no lo borra -- y deja un sello con
// la fecha y el commit de origen. Las dos pruebas de instalacion ya instalan dos veces: el sobrante
// se planta entre las dos, asi que esto no agrega una sola instalacion.

export const SOBRANTE = join('scripts', 'gate-retirado-por-la-prueba.mjs');

/** Un archivo que una instalacion anterior dejo y el protocolo ya no tiene. */
export function plantarSobrante(project) {
  writeFileSync(join(project, '.ia-stack', 'runtime', SOBRANTE), '// un gate que el protocolo ya retiro\n');
}

export function assertApartado(project) {
  const runtime = join(project, '.ia-stack', 'runtime');
  assert.equal(existsSync(join(runtime, SOBRANTE)), false, 'reinstalar tiene que sacar del runtime lo que el protocolo ya no tiene');
  const archivo = join(project, '.ia-stack', 'archivo');
  const fechas = existsSync(archivo) ? readdirSync(archivo) : [];
  assert.ok(
    fechas.some((fecha) => existsSync(join(archivo, fecha, 'runtime', SOBRANTE))),
    `y tiene que MOVERLO al archivo conservando la ruta, no borrarlo. En ${archivo}: ${fechas.join(', ') || '(nada)'}`,
  );
}

// UN AGENTS.md QUE ESCRIBIO EL INSTALADOR Y NADIE TOCO. El instalador nunca
// reescribia un AGENTS.md existente, porque podia ser del usuario; pero la mayoria lo habia escrito
// el propio instalador, y quedaba congelado: en los proyectos de usuarios seguia diciendo «leé el
// protocolo entero» despues de que el protocolo dejara de pedirlo. Ahora lo reconoce por su hash
// —el de git, sobre el texto con LF, para que un checkout CRLF tambien coincida— contra
// contracts/agents-publicados.json, y solo entonces lo actualiza. Este es el de la 3.2.0, tal cual.
// El texto publicado es byte a byte el de entonces, y nombraba la carpeta de estado de esa version:
// se arma por partes para que el nombre no figure en el repositorio.
const CARPETA_DE_LA_3_2_0 = ['.v', 'ibe'].join('');
export const AGENTS_PUBLICADO_3_2_0 = [
  '# IA Stack', '',
  '**Leé el protocolo entero antes de operar**: son once fases con gates mecánicos, y saltarse uno',
  'invalida el resto. Está en `SKILL.md` si este es el repositorio de IA Stack, o en',
  `\`${CARPETA_DE_LA_3_2_0}/ia-stack-runtime/SKILL.md\` si IA Stack está instalado acá como herramienta.`, '',
  'Reglas que no dependen de la fase:', '',
  '- Cada decisión se presenta como **menú de opciones en lista Markdown**, con una recomendación',
  '  explícita, y se espera la respuesta antes de seguir. Nunca una pregunta abierta para una',
  '  decisión de protocolo.',
  '- Sin test rojo visible no hay implementación.',
  '- Los gates viven en `scripts/*.mjs`, son Node nativo sin dependencias y se corren, no se narran.', '',
  '- La limpieza de PHASE 9 **no borra nada**: archiva y deja un comando de vuelta atrás.', '',
  'Este archivo es un puntero, no una copia: si dice algo distinto del protocolo, manda el protocolo.', '',
].join('\n');

/** El hash de blob de git del texto con sus finales normalizados a LF: el mismo que da
 * `tr -d '\r' < archivo | git hash-object --stdin`. */
export function hashGitLf(texto) {
  const cuerpo = Buffer.from(String(texto).replaceAll('\r', ''), 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${cuerpo.length}\0`), cuerpo])).digest('hex');
}

/** `finales` es 'LF' o 'CRLF': un nombre y no la secuencia, para que ningún shell la interprete. */
export function plantarAgentsPublicado(project, finales = 'LF') {
  const eol = finales === 'CRLF' ? '\r\n' : '\n';
  writeFileSync(join(project, 'AGENTS.md'), AGENTS_PUBLICADO_3_2_0.replaceAll('\n', eol));
}

export function assertAgentsActualizado(project, salida) {
  const actual = readFileSync(join(project, 'AGENTS.md'), 'utf8').replaceAll('\r', '');
  const nuevo = readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8').replaceAll('\r', '');
  assert.equal(actual, nuevo, 'el AGENTS.md que escribio el instalador se actualiza a la version actual');
  assert.match(salida, /ACTUALIZADO: [^\n]*AGENTS\.md/u, 'y se dice');
}

// UN .gitignore CON FINALES CRLF. El instalador de bash agregaba sus reglas con LF y el de PowerShell
// con CRLF, sin mirar el archivo: en los proyectos de usuarios quedaban archivos con finales
// mezclados y git avisaba en cada operacion. Ahora cada regla sale con el final que el archivo ya usa.
export function plantarGitignoreCrlf(project) {
  writeFileSync(join(project, '.gitignore'), 'node_modules/\r\n.env\r\n');
}

export function assertGitignoreSinMezcla(project) {
  const texto = readFileSync(join(project, '.gitignore'), 'utf8');
  assert.match(texto, /\.ia-stack\/runtime\//u);
  assert.equal(texto.replaceAll('\r\n', '').includes('\n'), false, `quedo un LF suelto en un .gitignore CRLF: ${JSON.stringify(texto)}`);
}

// UN .gitignore SIN SALTO DE LINEA FINAL, que ya tiene la primera regla del instalador y termina en
// `.env`. El instalador de PowerShell pegaba el comentario de la regla siguiente a esa ultima linea:
// quedaba «.env# IA Stack: ...» y `.env` dejaba de ignorarse, sin aviso. El de bash ya miraba el
// ultimo byte. Lo encontro la cuarta revision; ninguna prueba armaba este archivo.
export function plantarGitignoreSinSaltoFinal(project) {
  writeFileSync(join(project, '.gitignore'), 'node_modules/\n.claude-archive/\n.env');
}

export function assertGitignoreIntacto(project) {
  const lineas = readFileSync(join(project, '.gitignore'), 'utf8').split(/\r?\n/u);
  assert.ok(lineas.includes('.env'), `la ultima regla del usuario tiene que seguir siendo una linea propia: ${JSON.stringify(lineas)}`);
  assert.ok(lineas.includes('.ia-stack/archivo/') && lineas.includes('.ia-stack/runtime/'), `y las reglas del instalador, las suyas: ${JSON.stringify(lineas)}`);
}

/** Mas sobrantes que archivos tiene el paquete: una poda que los moviera apartaria mas de la mitad
 * del runtime. El numero SE DERIVA del paquete y no se escribe: fijo, el dia que el protocolo creciera
 * la prueba pasaria a verde por el motivo equivocado -- la poda dejaria de ser desproporcionada --. */
export function plantarSobrantesDeMas(project) {
  let enElPaquete = 0;
  const contar = (dir) => {
    if (!existsSync(dir)) return;
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.isDirectory()) contar(join(dir, entrada.name));
      else enElPaquete += 1;
    }
  };
  for (const dir of ['scripts', 'contracts', 'tests', 'templates', 'skills', '.agents', 'phases']) contar(join(repoRoot, dir));
  const destino = join(project, '.ia-stack', 'runtime', 'scripts', 'de-mas');
  mkdirSync(destino, { recursive: true });
  const cuantos = enElPaquete + 1;
  for (let i = 0; i < cuantos; i += 1) writeFileSync(join(destino, `sobrante-${i}.mjs`), '');
  return cuantos;
}

export function assertNadaApartado(project, cuantos, salida) {
  const destino = join(project, '.ia-stack', 'runtime', 'scripts', 'de-mas');
  assert.match(salida, /AVISO: la poda iba a apartar/u, 'tiene que decir por que no podo');
  assert.equal(readdirSync(destino).length, cuantos, 'la red de seguridad no tiene que mover NADA');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'scripts', 'pretooluse-red.mjs')), true, 'y el runtime sigue entero');
}

export function assertSellado(project) {
  const ruta = join(project, '.ia-stack', 'runtime', 'INSTALADO.json');
  assert.equal(existsSync(ruta), true, 'el runtime del proyecto tiene que quedar sellado');
  const sello = JSON.parse(readFileSync(ruta, 'utf8').replace(/^\uFEFF/u, ''));
  assert.equal(sello.schema, 'ia.runtime-instalado/1');
  // El sello dice la versión del protocolo que instaló, la misma que declara SKILL.md.
  const declarada = /\*\*Versión:\*\*\s*(\d+\.\d+\.\d+)/u.exec(readFileSync(join(repoRoot, 'SKILL.md'), 'utf8'))[1];
  assert.equal(sello.version, declarada);
  assert.equal(sello.version, '3.4.5');
  assert.match(sello.instalado, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, `fecha ISO en UTC: ${sello.instalado}`);
  // Se instala desde ESTE repositorio, que es un checkout: tiene que nombrar su commit.
  assert.equal(sello.desde, 'checkout');
  assert.match(sello.commit, /^[0-9a-f]{40,64}$/u, `el commit de origen: ${sello.commit}`);
  assert.equal(typeof sello.arbol_limpio, 'boolean', 'y si el checkout tenia cambios sin commitear');
}

/** El runtime global también queda sellado: sin sello no se sabe qué versión hay instalada. */
export function assertSelladoGlobal(runtime) {
  const ruta = join(runtime, 'INSTALADO.json');
  assert.equal(existsSync(ruta), true, 'el runtime global tiene que quedar sellado');
  const sello = JSON.parse(readFileSync(ruta, 'utf8').replace(/^﻿/u, ''));
  assert.equal(sello.schema, 'ia.runtime-instalado/1');
  assert.equal(sello.version, '3.4.5');
  assert.match(sello.instalado, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
}

/** El puntero canonico: la unica fuente de las tres copias que instala el instalador. */
export const PUNTERO = join(repoRoot, '.agents', 'skills', 'ia-stack', 'SKILL.md');

// UNA SKILL QUE CLAUDE CODE CARGA DE VERDAD. Claude Code solo descubre `<skills>/<nombre>/SKILL.md`:
// archivos sueltos en el directorio de skills no se cargan. Y si cargaran, meterian el protocolo
// entero —162 KB— de una vez. Cada copia es el puntero de 2 KB, byte a byte.
export function assertSkillDeClaude(project, target) {
  const fuente = readFileSync(PUNTERO);
  if (target !== undefined) {
    assert.deepEqual(readdirSync(target), ['ia-stack'], 'el directorio de skills global tiene una sola carpeta, la de la skill');
    assert.deepEqual(readFileSync(join(target, 'ia-stack', 'SKILL.md')), fuente, 'la skill global es el puntero, byte a byte');
  }
  assert.deepEqual(readFileSync(join(project, '.claude', 'skills', 'ia-stack', 'SKILL.md')), fuente, 'Claude Code ve el puntero en el proyecto');
  assert.deepEqual(readFileSync(join(project, '.agents', 'skills', 'ia-stack', 'SKILL.md')), fuente, 'y Codex el mismo');
}

// CON UN CLAUDE.md EN EL PROYECTO, CLAUDE CODE NO LEE AGENTS.md con la configuracion predeterminada
// (docs oficiales, memory: lo lee solo si no hay CLAUDE.md, CLAUDE.local.md ni .claude/CLAUDE.md, o si
// uno de ellos lo importa con `@AGENTS.md`). El instalador no reescribe un CLAUDE.md ajeno: avisa.
export function plantarClaudeMd(project, conImport) {
  const lineas = ['# reglas del proyecto', ...(conImport ? ['@AGENTS.md'] : []), ''];
  writeFileSync(join(project, 'CLAUDE.md'), lineas.join('\n'));
}

export function assertAvisoClaudeMd(salida, avisa) {
  const re = /AVISO: [^\n]*CLAUDE\.md[^\n]*@AGENTS\.md/u;
  if (avisa) assert.match(salida, re, 'un CLAUDE.md sin @AGENTS.md se avisa');
  else assert.doesNotMatch(salida, re, 'sin CLAUDE.md, o con @AGENTS.md, no hay nada que avisar');
}

export function assertRuntime(project, target, runtime) {
  // EL DIRECTORIO DE SKILLS, ENTERO: una carpeta, la de la skill, y nada mas. El instalador de bash
  // llego a crear una carpeta vacia de mas en cada instalacion, y ninguna prueba lo veia:
  // miraban que estuviera lo esperado, no que no hubiera nada de mas.
  assertSkillDeClaude(project, target);
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-red-node.mjs')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'verify-scope-diff.mjs')), true, 'runtime needs the scope-vs-diff gate');
  assert.equal(existsSync(join(runtime, 'SECURITY.md')), true, 'runtime docs must carry the native security contract they reference');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'scripts', 'pretooluse-red.mjs')), true);
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'scripts', 'verify-scope-diff.mjs')), true, 'project runtime needs the scope-vs-diff gate');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'SECURITY.md')), true);
  assert.equal(existsSync(join(runtime, 'scripts', 'scripts')), false, 'runtime must not nest scripts on reinstall');
  assert.equal(existsSync(join(runtime, 'contracts', 'contracts')), false, 'runtime must not nest contracts on reinstall');
  assert.equal(existsSync(join(runtime, 'tests', 'tests')), false, 'runtime must not nest tests on reinstall');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'scripts', 'scripts')), false, 'project runtime must not nest scripts on reinstall');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'contracts', 'contracts')), false, 'project runtime must not nest contracts on reinstall');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'tests', 'tests')), false, 'project runtime must not nest tests on reinstall');
  assert.equal(existsSync(join(project, '.ia-stack', 'runtime', 'templates', 'estado', 'LECCIONES.md')), true);
  const check = run(process.execPath, ['.ia-stack/runtime/scripts/verify-red-node.mjs'], { cwd: project });
  assert.equal(check.status, 2, check.output);
}
