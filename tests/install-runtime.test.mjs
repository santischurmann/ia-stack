// La rama bash del instalador. La de PowerShell vive en `install-runtime-powershell.test.mjs`.
//
// Las dos comparten `_install-fixture.mjs`, y en particular `assertRuntime`, que es lo que hace que
// las dos ramas tengan que producir el MISMO runtime. Están en archivos separados porque juntas
// rozaban el tope de TAP —96 a 111 s contra 120, corriendo solas—, y porque si una se rompe la otra
// tiene que seguir contando.

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import test from 'node:test';

import { assertApartado, assertNadaApartado, assertRuntime, assertSellado, fixture, gitBash, hayBash, installSh, plantarSobrante, plantarSobrantesDeMas, run, toBash } from './_install-fixture.mjs';

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
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// LA RED DE SEGURIDAD de la poda: si moveria mas de la mitad del runtime, es un defecto y no mueve
// nada. Existe desde el 2026-09-22, cuando la version de PowerShell vacio el runtime entero en el CI.
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
