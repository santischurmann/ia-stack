// La rama bash del instalador. La de PowerShell vive en `install-runtime-powershell.test.mjs`.
//
// Las dos comparten `_install-fixture.mjs`, y en particular `assertRuntime`, que es lo que hace que
// las dos ramas tengan que producir el MISMO runtime. Están en archivos separados porque juntas
// rozaban el tope de TAP —96 a 111 s contra 120, corriendo solas—, y porque si una se rompe la otra
// tiene que seguir contando.

import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { assertVentana, assertVentanaNoAplicada, plantarSettingsInvalido, plantarClaudeMd, assertAvisoClaudeMd, assertAgentsActualizado, assertApartado, assertGitignoreIntacto, assertGitignoreSinMezcla, assertNadaApartado, assertRuntime, assertSellado, assertSelladoGlobal, fixture, gitBash, hayBash, installSh, plantarAgentsPublicado, plantarGitignoreCrlf, plantarGitignoreSinSaltoFinal, plantarSobrante, plantarSobrantesDeMas, run, toBash } from './_install-fixture.mjs';

test('un .gitignore sin salto de línea final no pierde su última regla', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    plantarGitignoreSinSaltoFinal(project);
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assertGitignoreIntacto(project);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un AGENTS.md que escribió el instalador se actualiza aunque venga con CRLF, y el .gitignore CRLF no mezcla finales', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    plantarAgentsPublicado(project, 'CRLF');
    plantarGitignoreCrlf(project);
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assertAgentsActualizado(project, result.output);
    assertGitignoreSinMezcla(project);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('un CLAUDE.md sin @AGENTS.md se avisa', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    plantarClaudeMd(project, false);
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assertAvisoClaudeMd(result.output, true);
    plantarClaudeMd(project, true);
    const otra = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(otra.status, 0, otra.output);
    assertAvisoClaudeMd(otra.output, false);
    assertRuntime(project, target, runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fresh Bash installation produces a project-local runtime whose gate command resolves', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const result = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /project runtime/);
    plantarSobrante(project);
    const repeat = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(repeat.status, 0, repeat.output);
    assertRuntime(project, target, runtime);
    assertApartado(project);
    assertSellado(project);
    assertSelladoGlobal(runtime);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// LA RED DE SEGURIDAD de la poda: si moveria mas de la mitad del runtime, es un defecto y no mueve
// nada. Existe, cuando la version de PowerShell vacio el runtime entero en el CI.
// Los sobrantes se plantan ANTES de la unica instalacion: el instalador copia el paquete encima y
// despues poda, asi que alcanza con una.
test('una poda desproporcionada no mueve nada: es un defecto, no una limpieza', { skip: !hayBash }, () => {
  const { root, project, target, runtime } = fixture();
  try {
    const cuantos = plantarSobrantesDeMas(project);
    const command = `'${toBash(installSh)}' --target-dir '${toBash(target)}' --runtime-dir '${toBash(runtime)}' --project '${toBash(project)}'`;
    const r = run(gitBash, ['-lc', command], { env: { HOME: toBash(root) } });
    assert.equal(r.status, 0, r.output);
    assertNadaApartado(project, cuantos, r.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// 3.4.5 · tres instalaciones con --project-only (no tocan lo global): con la ventana, sin ella y
// con un settings.local.json que no es JSON estricto.
test('3.4.5 · el instalador deja la ventana y los dos hooks, salvo con --sin-ventana; un settings inválido se avisa y no corta', { skip: !hayBash }, () => {
  const { root, project } = fixture();
  const sin = join(root, 'sin');
  const roto = join(root, 'roto');
  try {
    for (const p of [sin, roto]) mkdirSync(p);
    const instalar = (p, extra = '') => run(gitBash, ['-lc', `'${toBash(installSh)}' --project-only --project '${toBash(p)}' ${extra}`], { env: { HOME: toBash(root) } });
    const a = instalar(project);
    assert.equal(a.status, 0, a.output);
    assertVentana(project, true);
    const b = instalar(sin, '--sin-ventana');
    assert.equal(b.status, 0, b.output);
    assertVentana(sin, false);
    plantarSettingsInvalido(roto);
    const c = instalar(roto);
    assert.equal(c.status, 0, c.output);
    assertVentanaNoAplicada(roto, c.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
